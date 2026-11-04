import {
  applyHitPointDamage,
  applyHitPointHealing,
} from "./hit-point-engine";
import type {
  DeathSaveDamageInput,
  DeathSaveDamageResult,
  DeathSaveState,
  DeathSavingThrowInput,
  DeathSavingThrowResult,
  DeathSaveStatus,
  DeathStateHealingResult,
  StabilizationInput,
  StabilizationResult,
  StableRecoveryResult,
} from "../domain/death-saves";
import type { HitPointState } from "../domain/hit-points";

function validateDeathSaveState(
  hitPoints: HitPointState,
  state: DeathSaveState,
): void {
  if (!state || typeof state !== "object") {
    throw new TypeError("Death Save state is required.");
  }
  const statuses: readonly DeathSaveStatus[] = ["active", "stable", "dead"];
  if (!statuses.includes(state.status)) {
    throw new RangeError("Unknown Death Save status.");
  }
  for (const [label, value] of [
    ["Death Save successes", state.successes],
    ["Death Save failures", state.failures],
  ] as const) {
    if (!Number.isInteger(value) || value < 0 || value > 3) {
      throw new RangeError(label + " must be an integer from 0 to 3.");
    }
  }
  if (state.status === "stable") {
    if (hitPoints.currentHitPoints !== 0) {
      throw new RangeError("A Stable character must have 0 Hit Points.");
    }
    if (state.successes !== 0 || state.failures !== 0) {
      throw new RangeError("Death Save tallies reset when a character becomes Stable.");
    }
  } else if (state.status === "dead") {
    if (hitPoints.currentHitPoints !== 0) {
      throw new RangeError("A dead character must have 0 Hit Points.");
    }
  } else if (hitPoints.currentHitPoints > 0) {
    if (state.successes !== 0 || state.failures !== 0) {
      throw new RangeError("Death Save tallies reset when Hit Points are regained.");
    }
  } else if (state.successes >= 3 || state.failures >= 3) {
    throw new RangeError("A character with three Death Save successes or failures cannot remain active.");
  }
}

function copyDeathSaveState(state: DeathSaveState): DeathSaveState {
  return { status: state.status, successes: state.successes, failures: state.failures };
}

/** Creates the initial death-save tracker. At 0 HP, an active character is unconscious and rolling saves. */
export function createDeathSaveState(): DeathSaveState {
  return { status: "active", successes: 0, failures: 0 };
}

/**
 * Applies ordinary damage and resolves the death-state consequences.
 * Damage is assumed to have already been adjusted by resistance, vulnerability,
 * and other damage modifiers. Temporary HP is then absorbed by the HP engine.
 */
export function applyDamageWithDeathSaveState(
  input: DeathSaveDamageInput,
): DeathSaveDamageResult {
  if (!input || typeof input !== "object") {
    throw new TypeError("Death-state damage input is required.");
  }
  if (input.isCritical !== undefined && typeof input.isCritical !== "boolean") {
    throw new TypeError("Critical-hit flag must be boolean.");
  }
  const validatedDamage = applyHitPointDamage(input.hitPoints, input.amount);
  validateDeathSaveState(input.hitPoints, input.deathSaveState);
  const prior = copyDeathSaveState(input.deathSaveState);

  if (prior.status === "dead") {
    return {
      applied: false,
      hitPoints: { ...input.hitPoints },
      deathSaveState: prior,
      outcome: "dead",
      issue: { code: "already-dead", message: "A dead character cannot take further damage." },
    };
  }
  if (input.amount === 0) {
    return {
      applied: true,
      hitPoints: validatedDamage.state,
      deathSaveState: prior,
      damageResult: validatedDamage,
      outcome: "no-damage",
    };
  }

  if (input.hitPoints.currentHitPoints > 0) {
    if (validatedDamage.state.currentHitPoints > 0) {
      return {
        applied: true,
        hitPoints: validatedDamage.state,
        deathSaveState: prior,
        damageResult: validatedDamage,
        outcome: "hit-points-remain",
      };
    }
    const massiveDamage = validatedDamage.excessDamage >= input.hitPoints.maximumHitPoints;
    return {
      applied: true,
      hitPoints: validatedDamage.state,
      deathSaveState: massiveDamage
        ? { status: "dead", successes: 0, failures: 0 }
        : { status: "active", successes: 0, failures: 0 },
      damageResult: validatedDamage,
      outcome: massiveDamage ? "dead" : "unconscious",
    };
  }

  // A character already at 0 HP suffers a failure for any damage, even when
  // Temporary HP absorbs it. A Critical Hit causes two failures.
  const instantDeath = input.amount >= input.hitPoints.maximumHitPoints;
  if (instantDeath) {
    return {
      applied: true,
      hitPoints: validatedDamage.state,
      deathSaveState: { status: "dead", successes: 0, failures: 0 },
      damageResult: validatedDamage,
      outcome: "dead",
    };
  }
  const failures = Math.min(3, prior.failures + (input.isCritical ? 2 : 1));
  const died = failures >= 3;
  return {
    applied: true,
    hitPoints: validatedDamage.state,
    deathSaveState: {
      status: died ? "dead" : "active",
      successes: prior.successes,
      failures,
    },
    damageResult: validatedDamage,
    outcome: died ? "dead" : prior.status === "stable" ? "stability-ended" : "death-save-failure",
  };
}

/** Resolves one turn-start Death Saving Throw. 2014 and 2024 use the same core roll. */
export function makeDeathSavingThrow(
  input: DeathSavingThrowInput,
): DeathSavingThrowResult {
  if (!input || typeof input !== "object") {
    throw new TypeError("Death Saving Throw input is required.");
  }
  // Reuse the HP engine's state validation without applying any damage.
  applyHitPointDamage(input.hitPoints, 0);
  validateDeathSaveState(input.hitPoints, input.deathSaveState);
  if (input.hitPoints.currentHitPoints !== 0) {
    return {
      made: false,
      hitPoints: { ...input.hitPoints },
      deathSaveState: copyDeathSaveState(input.deathSaveState),
      outcome: "no-roll",
      issue: { code: "not-at-zero-hit-points", message: "Death Saving Throws are made only at 0 Hit Points." },
    };
  }
  if (input.deathSaveState.status === "stable") {
    return {
      made: false,
      hitPoints: { ...input.hitPoints },
      deathSaveState: copyDeathSaveState(input.deathSaveState),
      outcome: "stable",
      issue: { code: "already-stable", message: "A Stable character does not make Death Saving Throws." },
    };
  }
  if (input.deathSaveState.status === "dead") {
    return {
      made: false,
      hitPoints: { ...input.hitPoints },
      deathSaveState: copyDeathSaveState(input.deathSaveState),
      outcome: "dead",
      issue: { code: "already-dead", message: "A dead character does not make Death Saving Throws." },
    };
  }
  if (!Number.isInteger(input.roll) || input.roll < 1 || input.roll > 20) {
    throw new RangeError("Death Saving Throw roll must be an integer from 1 to 20.");
  }

  if (input.roll === 20) {
    const healed = applyHitPointHealing(input.hitPoints, 1);
    return {
      made: true,
      hitPoints: healed.state,
      deathSaveState: { status: "active", successes: 0, failures: 0 },
      outcome: "regained-1-hit-point",
    };
  }
  if (input.roll === 1) {
    const failures = Math.min(3, input.deathSaveState.failures + 2);
    const died = failures >= 3;
    return {
      made: true,
      hitPoints: { ...input.hitPoints },
      deathSaveState: {
        status: died ? "dead" : "active",
        successes: input.deathSaveState.successes,
        failures,
      },
      outcome: died ? "dead" : "failure",
    };
  }
  if (input.roll >= 10) {
    const successes = input.deathSaveState.successes + 1;
    const stabilized = successes >= 3;
    return {
      made: true,
      hitPoints: { ...input.hitPoints },
      deathSaveState: stabilized
        ? { status: "stable", successes: 0, failures: 0 }
        : { status: "active", successes, failures: input.deathSaveState.failures },
      outcome: stabilized ? "stable" : "success",
    };
  }
  const failures = Math.min(3, input.deathSaveState.failures + 1);
  const died = failures >= 3;
  return {
    made: true,
    hitPoints: { ...input.hitPoints },
    deathSaveState: {
      status: died ? "dead" : "active",
      successes: input.deathSaveState.successes,
      failures,
    },
    outcome: died ? "dead" : "failure",
  };
}

/**
 * Stabilizes a character at 0 HP. A caller supplies the final Medicine check
 * total or the current 10-use Healer's Kit count; action availability/range is
 * owned by the action coordinator.
 */
export function stabilizeCharacter(input: StabilizationInput): StabilizationResult {
  if (!input || typeof input !== "object") {
    throw new TypeError("Stabilization input is required.");
  }
  if (input.ruleset !== "2014" && input.ruleset !== "2024") {
    throw new RangeError("Stabilization ruleset must be 2014 or 2024.");
  }
  applyHitPointDamage(input.hitPoints, 0);
  validateDeathSaveState(input.hitPoints, input.deathSaveState);
  if (input.method !== "medicine-check" && input.method !== "healer-kit") {
    throw new RangeError("Unknown stabilization method.");
  }
  const actionType =
    input.method === "healer-kit"
      ? input.ruleset === "2014" ? "action" : "utilize"
      : input.ruleset === "2014" ? "action" : "help";
  const base = {
    hitPoints: { ...input.hitPoints },
    deathSaveState: copyDeathSaveState(input.deathSaveState),
    method: input.method,
    actionType: actionType as "action" | "help" | "utilize",
  };

  if (input.hitPoints.currentHitPoints !== 0) {
    return {
      stabilized: false,
      ...base,
      issue: { code: "not-at-zero-hit-points", message: "Only a character at 0 Hit Points can be stabilized." },
    };
  }
  if (input.deathSaveState.status === "dead") {
    return {
      stabilized: false,
      ...base,
      issue: { code: "already-dead", message: "A dead character cannot be stabilized." },
    };
  }
  if (input.deathSaveState.status === "stable") {
    return {
      stabilized: false,
      ...base,
      issue: { code: "already-stable", message: "The character is already Stable." },
    };
  }

  if (input.method === "medicine-check") {
    if (!Number.isInteger(input.medicineCheckTotal)) {
      throw new TypeError("A final Wisdom (Medicine) check total is required.");
    }
    if ((input.medicineCheckTotal as number) < 10) {
      return {
        stabilized: false,
        ...base,
        issue: { code: "medicine-check-failed", message: "The DC 10 Wisdom (Medicine) check failed." },
      };
    }
    return {
      stabilized: true,
      ...base,
      deathSaveState: { status: "stable", successes: 0, failures: 0 },
    };
  }

  if (
    !Number.isInteger(input.healerKitUsesRemaining) ||
    (input.healerKitUsesRemaining as number) < 0 ||
    (input.healerKitUsesRemaining as number) > 10
  ) {
    throw new RangeError("Healer's Kit uses remaining must be an integer from 0 to 10.");
  }
  if (input.healerKitUsesRemaining === 0) {
    return {
      stabilized: false,
      ...base,
      healerKitUsesRemaining: 0,
      issue: { code: "no-healer-kit-uses", message: "The Healer's Kit has no uses remaining." },
    };
  }
  return {
    stabilized: true,
    ...base,
    deathSaveState: { status: "stable", successes: 0, failures: 0 },
    healerKitUsesRemaining: (input.healerKitUsesRemaining as number) - 1,
  };
}

/** Call after the Stable recovery timer (1d4 hours) has elapsed. */
export function recoverStableCharacter(
  hitPoints: HitPointState,
  deathSaveState: DeathSaveState,
): StableRecoveryResult {
  applyHitPointDamage(hitPoints, 0);
  validateDeathSaveState(hitPoints, deathSaveState);
  if (deathSaveState.status !== "stable" || hitPoints.currentHitPoints !== 0) {
    return {
      recovered: false,
      hitPoints: { ...hitPoints },
      deathSaveState: copyDeathSaveState(deathSaveState),
      hitPointsRestored: 0,
      issue: { code: "not-stable", message: "Only a Stable character can recover after 1d4 hours." },
    };
  }
  const healing = applyHitPointHealing(hitPoints, 1);
  return {
    recovered: true,
    hitPoints: healing.state,
    deathSaveState: { status: "active", successes: 0, failures: 0 },
    hitPointsRestored: healing.hitPointsRestored,
  };
}

/** Applies healing and clears Death Save tallies when actual HP is regained. */
export function applyHealingWithDeathSaveState(
  hitPoints: HitPointState,
  deathSaveState: DeathSaveState,
  amount: number,
): DeathStateHealingResult {
  validateDeathSaveState(hitPoints, deathSaveState);
  if (deathSaveState.status === "dead") {
    throw new RangeError("Healing cannot restore a dead character; resurrection is outside this engine.");
  }
  const healingResult = applyHitPointHealing(hitPoints, amount);
  const revived = hitPoints.currentHitPoints === 0 && healingResult.hitPointsRestored > 0;
  return {
    hitPoints: healingResult.state,
    deathSaveState: revived
      ? { status: "active", successes: 0, failures: 0 }
      : copyDeathSaveState(deathSaveState),
    healingResult,
    revived,
  };
}
