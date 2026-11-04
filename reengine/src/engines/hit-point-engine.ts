import { calculateAbilityModifier } from "./character-calculation-engine";
import type {
  HitDieSize, HitPointDamageResult, HitPointHealingResult, HitPointLevelCalculation,
  HitPointLevelInput, HitPointState, MaximumHitPointsInput, MaximumHitPointsResult,
  TemporaryHitPointResult, HitDicePool, ShortRestHitDieSpendInput,
  ShortRestHitDieSpendResult,
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

/**
 * Temporary HP never stacks. When a creature already has Temporary HP,
 * the rules let it choose whether to keep the current amount or take the new
 * grant; the new amount is not automatically compared or optimized.
 */
export function grantTemporaryHitPoints(
  state: HitPointState,
  amount: number,
  choice?: "keep-current" | "take-new",
): TemporaryHitPointResult {
  assertHitPointState(state);
  assertNonNegativeInteger(amount, "Temporary Hit Points");
  if (choice !== undefined && choice !== "keep-current" && choice !== "take-new") {
    throw new RangeError("Unknown Temporary Hit Point choice.");
  }
  if (state.temporaryHitPoints > 0 && amount > 0 && choice === undefined) {
    throw new TypeError("Choose whether to keep or replace existing Temporary Hit Points.");
  }
  const replace =
    amount > 0 &&
    (state.temporaryHitPoints === 0 || choice === "take-new");
  const next = replace ? amount : state.temporaryHitPoints;
  return {
    state: { ...state, temporaryHitPoints: next },
    temporaryHitPointsGained: Math.max(0, next - state.temporaryHitPoints),
    replacedExistingTemporaryHitPoints: replace && state.temporaryHitPoints > 0,
  };
}


/**
 * Builds one Hit Dice pool per class from the validated per-level HP snapshot.
 * Character-level order is checked so a malformed multiclass progression
 * cannot silently create or lose Hit Dice.
 */
export function createHitDicePools(
  levels: readonly Pick<HitPointLevelCalculation, "characterLevel" | "classId" | "classLevel" | "hitDie">[],
): HitDicePool[] {
  if (!Array.isArray(levels) || levels.length === 0) {
    throw new TypeError("At least one character level is required to build Hit Dice pools.");
  }
  if (levels.length > 20) {
    throw new RangeError("A character cannot have more than 20 Hit Dice.");
  }
  const grouped = new Map<string, { hitDie: HitDieSize; classLevels: number[] }>();
  levels.forEach((level, index) => {
    if (!level || typeof level !== "object") {
      throw new TypeError("Hit Dice level entries must be objects.");
    }
    if (!Number.isInteger(level.characterLevel) || level.characterLevel !== index + 1) {
      throw new RangeError("Hit Dice levels must cover each character level from 1 without gaps.");
    }
    if (typeof level.classId !== "string" || !level.classId.trim()) {
      throw new TypeError("Hit Dice class ID must be non-empty.");
    }
    if (!Number.isInteger(level.classLevel) || level.classLevel < 1 || level.classLevel > 20) {
      throw new RangeError("Hit Dice class level must be an integer from 1 to 20.");
    }
    if (!HIT_DIE_SIZES.includes(level.hitDie)) {
      throw new RangeError("Hit Die must be d6, d8, d10, or d12.");
    }
    const current = grouped.get(level.classId);
    if (!current) {
      grouped.set(level.classId, { hitDie: level.hitDie, classLevels: [level.classLevel] });
      return;
    }
    if (current.hitDie !== level.hitDie) {
      throw new RangeError("Hit Die size changed within class " + level.classId + ".");
    }
    current.classLevels.push(level.classLevel);
  });

  const pools: HitDicePool[] = [];
  for (const [classId, entry] of grouped) {
    const sortedLevels = [...entry.classLevels].sort((a, b) => a - b);
    sortedLevels.forEach((classLevel, index) => {
      if (classLevel !== index + 1) {
        throw new RangeError("Class levels for " + classId + " must be consecutive from 1.");
      }
    });
    pools.push({
      classId,
      hitDie: entry.hitDie,
      total: sortedLevels.length,
      spent: 0,
    });
  }
  return pools.sort((a, b) => a.classId.localeCompare(b.classId));
}

function validateHitDicePools(pools: readonly HitDicePool[]): void {
  if (!Array.isArray(pools)) throw new TypeError("Hit Dice pools must be an array.");
  const seen = new Set<string>();
  let totalHitDice = 0;
  for (const pool of pools) {
    if (!pool || typeof pool !== "object") throw new TypeError("Hit Dice pool entries must be objects.");
    if (typeof pool.classId !== "string" || !pool.classId.trim()) {
      throw new TypeError("Hit Dice pool class ID must be non-empty.");
    }
    if (seen.has(pool.classId)) throw new RangeError("Duplicate Hit Dice pool for class " + pool.classId + ".");
    seen.add(pool.classId);
    if (!HIT_DIE_SIZES.includes(pool.hitDie)) throw new RangeError("Hit Die must be d6, d8, d10, or d12.");
    if (!Number.isInteger(pool.total) || pool.total < 1 || pool.total > 20) {
      throw new RangeError("Total Hit Dice must be an integer from 1 to 20.");
    }
    if (!Number.isInteger(pool.spent) || pool.spent < 0 || pool.spent > pool.total) {
      throw new RangeError("Spent Hit Dice must be between zero and the pool total.");
    }
    totalHitDice += pool.total;
  }
  if (totalHitDice > 20) throw new RangeError("A character cannot have more than 20 total Hit Dice.");
}

/**
 * Spends exactly one class-specific Hit Die at the end of a completed Short Rest.
 * Call again with the returned HP/pool snapshots only after the player decides
 * whether to spend another die. This resolver does not track rest duration or
 * interruption; the rest coordinator owns those state transitions.
 *
 * 2014: each die restores max(0, roll + CON modifier).
 * 2024: a character must have at least 1 HP when the rest starts, and each die
 * restores max(1, roll + CON modifier).
 */
export function spendShortRestHitDie(
  input: ShortRestHitDieSpendInput,
): ShortRestHitDieSpendResult {
  if (!input || typeof input !== "object") {
    throw new TypeError("Short Rest Hit Die spend input is required.");
  }
  if (input.ruleset !== "2014" && input.ruleset !== "2024") {
    throw new RangeError("Short Rest ruleset must be 2014 or 2024.");
  }
  assertHitPointState(input.hitPoints);
  validateHitDicePools(input.hitDicePools);
  if (typeof input.classId !== "string" || !input.classId.trim()) {
    throw new TypeError("Hit Die spend class ID must be non-empty.");
  }
  assertNonNegativeInteger(input.shortRestStartedAtHitPoints, "Short Rest starting Hit Points");
  if (input.shortRestStartedAtHitPoints > input.hitPoints.maximumHitPoints) {
    throw new RangeError("Short Rest starting Hit Points cannot exceed maximum Hit Points.");
  }
  if (!Number.isInteger(input.roll) || input.roll < 1) {
    throw new RangeError("Hit Die roll must be a positive integer.");
  }
  const constitutionModifier = calculateAbilityModifier(input.constitutionScore);
  const selectedPool = input.hitDicePools.find((pool) => pool.classId === input.classId);
  const baseResult: ShortRestHitDieSpendResult = {
    canSpend: false,
    hitPoints: { ...input.hitPoints },
    hitDicePools: input.hitDicePools.map((pool) => ({ ...pool })),
    classId: input.classId,
    hitDie: selectedPool?.hitDie ?? null,
    rollValue: input.roll,
    constitutionModifier,
    healingBeforeMaximum: 0,
    hitPointsRestored: 0,
  };

  if (input.ruleset === "2024" && input.shortRestStartedAtHitPoints < 1) {
    return {
      ...baseResult,
      issue: {
        code: "short-rest-requires-positive-hit-points",
        message: "A 2024 character must have at least 1 Hit Point to start a Short Rest.",
      },
    };
  }
  if (!selectedPool) {
    return {
      ...baseResult,
      issue: {
        code: "unknown-hit-die-pool",
        message: "No Hit Dice pool exists for class " + input.classId + ".",
      },
    };
  }
  if (input.roll > selectedPool.hitDie) {
    throw new RangeError("Hit Die roll must be from 1 to " + selectedPool.hitDie + ".");
  }
  if (selectedPool.spent >= selectedPool.total) {
    return {
      ...baseResult,
      issue: {
        code: "no-hit-dice-remaining",
        message: "No unspent Hit Dice remain for class " + input.classId + ".",
      },
    };
  }

  const healingBeforeMaximum = input.ruleset === "2014"
    ? Math.max(0, input.roll + constitutionModifier)
    : Math.max(1, input.roll + constitutionModifier);
  const healing = applyHitPointHealing(input.hitPoints, healingBeforeMaximum);
  const hitDicePools = input.hitDicePools.map((pool) =>
    pool.classId === input.classId ? { ...pool, spent: pool.spent + 1 } : { ...pool },
  );
  return {
    canSpend: true,
    hitPoints: healing.state,
    hitDicePools,
    classId: input.classId,
    hitDie: selectedPool.hitDie,
    rollValue: input.roll,
    constitutionModifier,
    healingBeforeMaximum,
    hitPointsRestored: healing.hitPointsRestored,
  };
}
