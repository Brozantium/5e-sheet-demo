import { calculateAbilityModifier } from "./character-calculation-engine";
import type {
  HitDieSize, HitPointDamageResult, HitPointHealingResult, HitPointLevelCalculation,
  HitPointLevelInput, HitPointState, MaximumHitPointsInput, MaximumHitPointsResult,
  TemporaryHitPointResult,
} from "../domain/hit-points";

const HIT_DIE_SIZES: readonly HitDieSize[] = [6, 8, 10, 12];

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) throw new RangeError(label + " must be a non-negative integer.");
}
function assertHitPointState(state: HitPointState): void {
  if (!state || typeof state !== "object") throw new TypeError("Hit Point state is required.");
  assertNonNegativeInteger(state.maximumHitPoints, "Maximum Hit Points");
  if (state.maximumHitPoints < 1) throw new RangeError("Maximum Hit Points must be at least 1.");
  assertNonNegativeInteger(state.currentHitPoints, "Current Hit Points");
  assertNonNegativeInteger(state.temporaryHitPoints, "Temporary Hit Points");
  if (state.currentHitPoints > state.maximumHitPoints) throw new RangeError("Current Hit Points cannot exceed maximum Hit Points.");
}
function validateLevelInput(level: HitPointLevelInput): void {
  if (!level || typeof level !== "object") throw new TypeError("Hit Point level entries must be objects.");
  if (!Number.isInteger(level.characterLevel) || level.characterLevel < 1 || level.characterLevel > 20) {
    throw new RangeError("Character level must be an integer from 1 to 20.");
  }
  if (typeof level.classId !== "string" || !level.classId.trim()) throw new TypeError("Hit Point class ID must be non-empty.");
  if (!Number.isInteger(level.classLevel) || level.classLevel < 1 || level.classLevel > 20) {
    throw new RangeError("Class level must be an integer from 1 to 20.");
  }
  if (!HIT_DIE_SIZES.includes(level.hitDie)) throw new RangeError("Hit Die must be d6, d8, d10, or d12.");
  if (level.method !== "first-level" && level.method !== "average" && level.method !== "roll") {
    throw new RangeError("Unknown Hit Point gain method.");
  }
}

/** Fixed averages are d6:4, d8:5, d10:6, d12:7. Each level has a 1 HP minimum gain. */
export function calculateMaximumHitPoints(input: MaximumHitPointsInput): MaximumHitPointsResult {
  if (!input || typeof input !== "object") throw new TypeError("Maximum Hit Points input is required.");
  if (!Array.isArray(input.levels) || input.levels.length === 0) throw new TypeError("At least one Hit Point level is required.");
  const constitutionModifier = calculateAbilityModifier(input.constitutionScore);
  const additionalHitPoints = input.additionalHitPoints ?? 0;
  assertNonNegativeInteger(additionalHitPoints, "Additional Hit Points");
  const levels = [...input.levels].sort((a, b) => a.characterLevel - b.characterLevel);
  const seen = new Set<number>();
  const classes = new Map<string, number[]>();
  const hitDice = new Map<string, HitDieSize>();
  const calculations: HitPointLevelCalculation[] = [];

  levels.forEach((level, index) => {
    validateLevelInput(level);
    if (seen.has(level.characterLevel)) throw new RangeError("Duplicate character level " + level.characterLevel + ".");
    seen.add(level.characterLevel);
    if (level.characterLevel !== index + 1) throw new RangeError("Hit Point levels must cover each character level from 1 without gaps.");
    const classLevels = classes.get(level.classId) ?? [];
    classLevels.push(level.classLevel);
    classes.set(level.classId, classLevels);
    const priorDie = hitDice.get(level.classId);
    if (priorDie !== undefined && priorDie !== level.hitDie) throw new RangeError("Hit Die size changed within class " + level.classId + ".");
    hitDice.set(level.classId, level.hitDie);

    if (level.characterLevel === 1 && level.method !== "first-level") {
      throw new RangeError("Character level 1 must use the first-level maximum Hit Die.");
    }
    if (level.characterLevel > 1 && level.method === "first-level") {
      throw new RangeError("Only character level 1 can use the first-level Hit Die method.");
    }
    let rollValue: number;
    if (level.method === "first-level") {
      if (level.roll !== undefined) throw new RangeError("First-level Hit Points use the maximum Hit Die, not a roll.");
      rollValue = level.hitDie;
    } else if (level.method === "average") {
      if (level.roll !== undefined) throw new RangeError("Average Hit Point gain must not supply a roll.");
      rollValue = Math.floor(level.hitDie / 2) + 1;
    } else {
      if (!Number.isInteger(level.roll) || (level.roll as number) < 1 || (level.roll as number) > level.hitDie) {
        throw new RangeError("Rolled Hit Die result must be from 1 to " + level.hitDie + ".");
      }
      rollValue = level.roll as number;
    }
    calculations.push({
      characterLevel: level.characterLevel,
      classId: level.classId,
      classLevel: level.classLevel,
      hitDie: level.hitDie,
      rollValue,
      constitutionModifier,
      gainedHitPoints: Math.max(1, rollValue + constitutionModifier),
    });
  });
  for (const [classId, entries] of classes) {
    const sorted = [...entries].sort((a, b) => a - b);
    sorted.forEach((classLevel, index) => {
      if (classLevel !== index + 1) throw new RangeError("Class levels for " + classId + " must be consecutive from 1.");
    });
  }
  return {
    maximumHitPoints: calculations.reduce((total, level) => total + level.gainedHitPoints, 0) + additionalHitPoints,
    constitutionModifier,
    additionalHitPoints,
    levels: calculations,
  };
}

export function applyHitPointDamage(state: HitPointState, amount: number): HitPointDamageResult {
  assertHitPointState(state);
  assertNonNegativeInteger(amount, "Damage");
  const damageAppliedToTemporaryHitPoints = Math.min(state.temporaryHitPoints, amount);
  const remainingDamage = amount - damageAppliedToTemporaryHitPoints;
  const damageAppliedToHitPoints = Math.min(state.currentHitPoints, remainingDamage);
  const excessDamage = remainingDamage - damageAppliedToHitPoints;
  const nextState = {
    ...state,
    temporaryHitPoints: state.temporaryHitPoints - damageAppliedToTemporaryHitPoints,
    currentHitPoints: state.currentHitPoints - damageAppliedToHitPoints,
  };
  return {
    state: nextState,
    damageAppliedToTemporaryHitPoints,
    damageAppliedToHitPoints,
    excessDamage,
    reachedZeroHitPoints: nextState.currentHitPoints === 0,
  };
}

export function applyHitPointHealing(state: HitPointState, amount: number): HitPointHealingResult {
  assertHitPointState(state);
  assertNonNegativeInteger(amount, "Healing");
  const hitPointsRestored = Math.min(amount, state.maximumHitPoints - state.currentHitPoints);
  return { state: { ...state, currentHitPoints: state.currentHitPoints + hitPointsRestored }, hitPointsRestored };
}

/** Temporary HP never stacks; keep the larger existing/new value. */
export function grantTemporaryHitPoints(state: HitPointState, amount: number): TemporaryHitPointResult {
  assertHitPointState(state);
  assertNonNegativeInteger(amount, "Temporary Hit Points");
  const replace = amount > state.temporaryHitPoints;
  const next = replace ? amount : state.temporaryHitPoints;
  return {
    state: { ...state, temporaryHitPoints: next },
    temporaryHitPointsGained: next - state.temporaryHitPoints,
    replacedExistingTemporaryHitPoints: replace && state.temporaryHitPoints > 0,
  };
}
