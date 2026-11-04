import type {
  ExhaustionLevelChangeResult,
  ExhaustionResolutionInput,
  ExhaustionResolutionResult,
  ExhaustionSpeedEffect,
} from "../domain/exhaustion";

/** Validates the dedicated Exhaustion level. Level 6 is a valid terminal state. */
export function validateExhaustionLevel(level: number): void {
  if (!Number.isInteger(level) || level < 0 || level > 6) {
    throw new RangeError("Exhaustion level must be an integer from 0 to 6.");
  }
}

function validateResolutionInput(input: ExhaustionResolutionInput): void {
  if (!input || typeof input !== "object") {
    throw new TypeError("Exhaustion resolution input is required.");
  }
  if (input.ruleset !== "2014" && input.ruleset !== "2024") {
    throw new RangeError("Exhaustion ruleset must be 2014 or 2024.");
  }
  validateExhaustionLevel(input.level);
  if (input.baseSpeed !== undefined &&
      (!Number.isInteger(input.baseSpeed) || input.baseSpeed < 0)) {
    throw new RangeError("Base Speed must be a non-negative integer.");
  }
  if (input.baseMaximumHitPoints !== undefined &&
      (!Number.isInteger(input.baseMaximumHitPoints) || input.baseMaximumHitPoints < 1)) {
    throw new RangeError("Base maximum Hit Points must be a positive integer.");
  }
}

function resolveSpeed(
  input: ExhaustionResolutionInput,
): ExhaustionSpeedEffect {
  if (input.ruleset === "2014") {
    if (input.level >= 5) {
      return {
        kind: "zero",
        multiplier: 0,
        reductionFeet: 0,
        ...(input.baseSpeed !== undefined ? { effectiveSpeed: 0 } : {}),
      };
    }
    if (input.level >= 2) {
      const effectiveSpeed = input.baseSpeed === undefined
        ? undefined
        : Math.floor(input.baseSpeed / 2);
      return {
        kind: "halved",
        multiplier: 0.5,
        reductionFeet: 0,
        ...(effectiveSpeed !== undefined ? { effectiveSpeed } : {}),
      };
    }
    return {
      kind: "normal",
      multiplier: 1,
      reductionFeet: 0,
      ...(input.baseSpeed !== undefined ? { effectiveSpeed: input.baseSpeed } : {}),
    };
  }

  const reductionFeet = input.level * 5;
  const effectiveSpeed = input.baseSpeed === undefined
    ? undefined
    : Math.max(0, input.baseSpeed - reductionFeet);
  if (reductionFeet === 0) {
    return {
      kind: "normal",
      multiplier: 1,
      reductionFeet: 0,
      ...(effectiveSpeed !== undefined ? { effectiveSpeed } : {}),
    };
  }
  return {
    kind: "reduced",
    multiplier: 1,
    reductionFeet,
    ...(effectiveSpeed !== undefined ? { effectiveSpeed } : {}),
  };
}

/**
 * Resolves only Exhaustion's derived effects.
 * Long Rest recovery belongs to RE-006D4, and death-state orchestration
 * belongs to RE-006D3. This function never mutates either state.
 */
export function resolveExhaustionEffects(
  input: ExhaustionResolutionInput,
): ExhaustionResolutionResult {
  validateResolutionInput(input);

  const is2014 = input.ruleset === "2014";
  const maximumHitPointsMultiplier: 1 | 0.5 =
    is2014 && input.level >= 4 ? 0.5 : 1;
  const effectiveMaximumHitPoints =
    input.baseMaximumHitPoints === undefined
      ? undefined
      : maximumHitPointsMultiplier === 0.5
        ? Math.max(1, Math.floor(input.baseMaximumHitPoints / 2))
        : input.baseMaximumHitPoints;

  return {
    ruleset: input.ruleset,
    level: input.level,
    isDead: input.level === 6,
    d20TestModifier: is2014 || input.level === 0 ? 0 : -2 * input.level,
    attackRollDisadvantage: is2014 && input.level >= 3,
    abilityCheckDisadvantage: is2014 && input.level >= 1,
    savingThrowDisadvantage: is2014 && input.level >= 3,
    speed: resolveSpeed(input),
    maximumHitPointsMultiplier,
    ...(effectiveMaximumHitPoints !== undefined
      ? { effectiveMaximumHitPoints }
      : {}),
  };
}

/**
 * Adds one or more Exhaustion levels, capped at level 6.
 * This operation does not create Death Save failures or mutate character state.
 */
export function addExhaustionLevels(input: {
  currentLevel: number;
  amount: number;
}): ExhaustionLevelChangeResult {
  if (!input || typeof input !== "object") {
    throw new TypeError("Exhaustion level change input is required.");
  }
  validateExhaustionLevel(input.currentLevel);
  if (!Number.isInteger(input.amount) || input.amount < 0) {
    throw new RangeError("Exhaustion levels gained must be a non-negative integer.");
  }
  const level = Math.min(6, input.currentLevel + input.amount);
  return {
    previousLevel: input.currentLevel,
    level,
    levelsAdded: level - input.currentLevel,
    isDead: level === 6,
  };
}
