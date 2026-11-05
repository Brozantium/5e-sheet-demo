import {
  MOVEMENT_MODES,
  emptyConditionMovementRules,
  type MovementMode,
  type MovementResolutionInput,
  type MovementResolutionResult,
  type MovementSpeedModifier,
} from "../domain/movement";

function validateModifier(modifier: MovementSpeedModifier): void {
  if (!modifier.id.trim()) throw new TypeError("Movement modifier ID is required.");
  if (!MOVEMENT_MODES.includes(modifier.mode)) {
    throw new TypeError("Unknown movement mode: " + modifier.mode);
  }
  if (!Number.isFinite(modifier.order)) {
    throw new RangeError("Movement modifier order must be finite.");
  }
  if (!Number.isFinite(modifier.value)) {
    throw new RangeError("Movement modifier value must be finite.");
  }
  if (modifier.operation === "multiply" && modifier.value < 0) {
    throw new RangeError("Movement multiplier cannot be negative.");
  }
  if (modifier.operation === "set" && modifier.value < 0) {
    throw new RangeError("Set Speed cannot be negative.");
  }
}

function applyModifier(speed: number, modifier: MovementSpeedModifier): number {
  switch (modifier.operation) {
    case "add":
      return speed + modifier.value;
    case "multiply":
      return speed * modifier.value;
    case "set":
      return modifier.value;
  }
}

/**
 * Composes normalized base movement profiles with ordered modifiers and the
 * existing E2 Exhaustion result. E1 hard movement constraints are applied last.
 *
 * Ordering contract:
 * 1. Caller-supplied modifiers in ascending order, then modifier ID.
 * 2. E2 Exhaustion multiplier/reduction applied to each mode.
 * 3. E1 hard Speed-zero constraint applied last.
 *
 * This resolver does not infer how arbitrary feature bonuses stack. The caller
 * must normalize grants and assign explicit modifier order before invoking it.
 * It does not consume movement, resolve paths, or execute turn/action timing.
 */
export function resolveMovement(
  input: MovementResolutionInput,
): MovementResolutionResult {
  const profiles = input.profiles ?? [];
  const modifiers = [...(input.modifiers ?? [])];
  const condition = {
    ...emptyConditionMovementRules(),
    ...(input.conditionMovement ?? {}),
    cannotWillinglyApproachCreatureIds: [
      ...(input.conditionMovement?.cannotWillinglyApproachCreatureIds ?? []),
    ],
    grappleDragRules: [
      ...(input.conditionMovement?.grappleDragRules ?? []),
    ],
  };

  const seenModes = new Set<MovementMode>();
  for (const profile of profiles) {
    if (!MOVEMENT_MODES.includes(profile.mode)) {
      throw new TypeError("Unknown movement mode: " + profile.mode);
    }
    if (!Number.isInteger(profile.speedFeet) || profile.speedFeet < 0) {
      throw new RangeError("Base Speed must be a non-negative integer.");
    }
    if (seenModes.has(profile.mode)) {
      throw new TypeError("Duplicate base movement profile: " + profile.mode);
    }
    seenModes.add(profile.mode);
  }

  const seenModifierIds = new Set<string>();
  for (const modifier of modifiers) {
    validateModifier(modifier);
    if (seenModifierIds.has(modifier.id)) {
      throw new TypeError("Duplicate movement modifier ID: " + modifier.id);
    }
    seenModifierIds.add(modifier.id);
  }

  modifiers.sort(
    (a, b) => a.order - b.order || a.id.localeCompare(b.id),
  );

  const speedByMode: MovementResolutionResult["speedByMode"] = {};
  const appliedModifierIds: string[] = [];
  const blockedModifierIds: string[] = [];

  for (const profile of profiles) {
    let speed = profile.speedFeet;
    for (const modifier of modifiers) {
      if (modifier.mode !== profile.mode) continue;
      const candidate = applyModifier(speed, modifier);
      if (condition.speedCannotIncrease && candidate > speed) {
        blockedModifierIds.push(modifier.id);
        continue;
      }
      speed = Math.max(0, Math.floor(candidate));
      appliedModifierIds.push(modifier.id);
    }

    const exhaustion = input.exhaustionSpeed;
    if (exhaustion) {
      if (exhaustion.kind === "zero") speed = 0;
      else {
        speed = Math.floor(speed * exhaustion.multiplier);
        speed = Math.max(0, speed - exhaustion.reductionFeet);
      }
    }

    if (condition.speedIsZero) speed = 0;
    speedByMode[profile.mode] = speed;
  }

  return {
    speedByMode,
    movement: {
      ...condition,
      cannotWillinglyApproachCreatureIds: [
        ...new Set(condition.cannotWillinglyApproachCreatureIds),
      ],
      grappleDragRules: condition.grappleDragRules.map((rule) => ({ ...rule })),
    },
    appliedModifierIds,
    blockedModifierIds,
  };
}
