import { applyHitPointHealing } from "./hit-point-engine";
import { recoverResource, type ResourceState } from "./resource-engine";
import type {
  HitDicePool,
  LongRestInput,
  LongRestInterruption,
  LongRestResult,
} from "../domain/long-rest";

const HIT_DIE_SIZES = [6, 8, 10, 12] as const;

function assertMinute(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(label + " must be a non-negative integer minute value.");
  }
}

function validateLongRestInput(input: LongRestInput): void {
  if (!input || typeof input !== "object") throw new TypeError("Long Rest input is required.");
  if (input.ruleset !== "2014" && input.ruleset !== "2024") {
    throw new RangeError("Long Rest ruleset must be 2014 or 2024.");
  }
  applyHitPointHealing(input.hitPoints, 0);
  assertMinute(input.startedAtMinute, "Long Rest start time");
  assertMinute(input.completedAtMinute, "Long Rest completion time");
  if (input.completedAtMinute < input.startedAtMinute) {
    throw new RangeError("Long Rest completion cannot precede its start.");
  }
  if (input.lastLongRestCompletedAtMinute !== undefined) {
    assertMinute(input.lastLongRestCompletedAtMinute, "Previous Long Rest completion time");
    if (input.lastLongRestCompletedAtMinute > input.startedAtMinute) {
      throw new RangeError("The previous Long Rest cannot finish after the current rest starts.");
    }
  }
  if (input.foodAndDrinkConsumed !== undefined && typeof input.foodAndDrinkConsumed !== "boolean") {
    throw new TypeError("Food and drink consumed flag must be boolean.");
  }
  if (!Number.isInteger(input.hitPointsAtStart) || input.hitPointsAtStart < 0 ||
      input.hitPointsAtStart > input.hitPoints.maximumHitPoints) {
    throw new RangeError("Long Rest starting Hit Points must be an integer within the character's HP maximum.");
  }
  assertMinute(input.sleepMinutes, "Long Rest sleep duration");
  assertMinute(input.lightActivityMinutes, "Long Rest light activity duration");
  const elapsedMinutes = input.completedAtMinute - input.startedAtMinute;
  if (input.sleepMinutes > elapsedMinutes || input.lightActivityMinutes > elapsedMinutes ||
      input.sleepMinutes + input.lightActivityMinutes > elapsedMinutes) {
    throw new RangeError("Long Rest sleep and light activity cannot exceed elapsed rest time.");
  }
  if (!Array.isArray(input.interruptions)) throw new TypeError("Long Rest interruptions must be an array.");
  input.interruptions.forEach((entry) => validateInterruption(entry, elapsedMinutes));
  validateHitDicePools(input.hitDicePools);
  validateResources(input.resources);
  if (!Number.isInteger(input.exhaustionLevel) || input.exhaustionLevel < 0 || input.exhaustionLevel > 5) {
    throw new RangeError("A living character's Exhaustion level must be an integer from 0 to 5.");
  }
}

function validateInterruption(entry: LongRestInterruption, elapsedMinutes: number): void {
  if (!entry || typeof entry !== "object") throw new TypeError("Long Rest interruption entries must be objects.");
  assertMinute(entry.minuteFromStart, "Interruption time");
  if (entry.minuteFromStart > elapsedMinutes) {
    throw new RangeError("Long Rest interruption cannot occur after completion.");
  }
  switch (entry.kind) {
    case "initiative":
    case "non-cantrip-spell":
    case "damage":
      return;
    case "physical-exertion":
    case "strenuous-activity":
      assertMinute(entry.durationMinutes, "Interruption activity duration");
      return;
    default:
      throw new RangeError("Unknown Long Rest interruption kind.");
  }
}

function validateHitDicePools(pools: readonly HitDicePool[]): void {
  if (!Array.isArray(pools)) throw new TypeError("Hit Dice pools must be an array.");
  const seen = new Set<string>();
  let total = 0;
  for (const pool of pools) {
    if (!pool || typeof pool !== "object") throw new TypeError("Hit Dice pool entries must be objects.");
    if (typeof pool.classId !== "string" || !pool.classId.trim()) {
      throw new TypeError("Hit Dice pool class ID must be non-empty.");
    }
    if (seen.has(pool.classId)) throw new RangeError("Duplicate Hit Dice pool for class " + pool.classId + ".");
    seen.add(pool.classId);
    if (!(HIT_DIE_SIZES as readonly number[]).includes(pool.hitDie)) {
      throw new RangeError("Hit Die must be d6, d8, d10, or d12.");
    }
    if (!Number.isInteger(pool.total) || pool.total < 1 || pool.total > 20) {
      throw new RangeError("Hit Dice pool total must be an integer from 1 to 20.");
    }
    if (!Number.isInteger(pool.spent) || pool.spent < 0 || pool.spent > pool.total) {
      throw new RangeError("Spent Hit Dice must be between zero and the pool total.");
    }
    total += pool.total;
  }
  if (total > 20) throw new RangeError("A character cannot have more than 20 total Hit Dice.");
}

function validateResources(resources: LongRestInput["resources"]): void {
  if (!Array.isArray(resources)) throw new TypeError("Long Rest resources must be an array.");
  const seen = new Set<string>();
  for (const entry of resources) {
    if (!entry || typeof entry !== "object") throw new TypeError("Long Rest resource entries must be objects.");
    if (typeof entry.id !== "string" || !entry.id.trim()) throw new TypeError("Long Rest resource ID must be non-empty.");
    if (seen.has(entry.id)) throw new RangeError("Duplicate Long Rest resource ID " + entry.id + ".");
    seen.add(entry.id);
    if (!Number.isFinite(entry.maximum) || entry.maximum < 0 ||
        !Number.isFinite(entry.current) || entry.current < 0 ||
        entry.current > entry.maximum) {
      throw new RangeError("Long Rest resource values must be finite and within the maximum.");
    }
    if (!["short-rest", "long-rest", "dawn", "manual", "special"].includes(entry.recovery)) {
      throw new RangeError("Unknown resource recovery event.");
    }
  }
}

function get2024Interruptions(interruptions: readonly LongRestInterruption[]): LongRestInterruption[] {
  return interruptions.filter((entry) => {
    if (entry.kind === "initiative" || entry.kind === "non-cantrip-spell" || entry.kind === "damage") {
      return true;
    }
    return entry.durationMinutes >= 60;
  });
}

function has2014RestartingInterruption(interruptions: readonly LongRestInterruption[]): boolean {
  return interruptions.some((entry) =>
    (entry.kind === "physical-exertion" || entry.kind === "strenuous-activity") &&
    entry.durationMinutes >= 60
  );
}

function emptyResult(input: LongRestInput, options: {
  issue?: LongRestResult["issue"];
  shortRestEarnedFromInterruption?: boolean;
  additionalHoursRequired?: number;
} = {}): LongRestResult {
  return {
    completed: false,
    hitPoints: { ...input.hitPoints },
    hitDicePools: input.hitDicePools.map((pool) => ({ ...pool })),
    resources: input.resources.map((resource) => ({ ...resource })),
    exhaustionLevel: input.exhaustionLevel,
    hitDiceRecovered: 0,
    hitDiceRecoveryLimit: 0,
    hitDiceRecoveryChoices: [],
    shortRestEarnedFromInterruption: options.shortRestEarnedFromInterruption ?? false,
    additionalHoursRequired: options.additionalHoursRequired ?? 0,
    ...(options.issue ? { issue: options.issue } : {}),
  };
}

/**
 * Completes an eligible Long Rest and applies its benefits.
 *
 * 2014: once per 24 hours, a strenuous interruption lasting at least one
 * hour forces the rest to restart, and up to half total Hit Dice (minimum one)
 * are recovered by player choice.
 *
 * 2024: wait 16 hours after the previous Long Rest, qualifying interruption
 * events add one hour apiece, and all spent Hit Dice are recovered.
 *
 * The supplied time window and activity totals are a resolved rest log. This
 * pure engine does not run clocks or schedule interruptions.
 */
export function completeLongRest(input: LongRestInput): LongRestResult {
  validateLongRestInput(input);

  const elapsedMinutes = input.completedAtMinute - input.startedAtMinute;
  const shortRestEarnedFromInterruption =
    input.ruleset === "2024" &&
    get2024Interruptions(input.interruptions).some((entry) => entry.minuteFromStart >= 60);

  if (input.hitPointsAtStart < 1) {
    return emptyResult(input, {
      shortRestEarnedFromInterruption,
      issue: {
        code: "requires-positive-hit-points",
        message: "A character must have at least 1 Hit Point when starting a Long Rest.",
      },
    });
  }

  if (input.lastLongRestCompletedAtMinute !== undefined) {
    const timeSinceLastFinish = input.startedAtMinute - input.lastLongRestCompletedAtMinute;
    const cooldown = input.ruleset === "2014" ? 1440 : 960;
    if (timeSinceLastFinish < cooldown) {
      return emptyResult(input, {
        shortRestEarnedFromInterruption,
        issue: {
          code: "long-rest-too-soon",
          message: input.ruleset === "2014"
            ? "A character cannot benefit from more than one Long Rest in a 24-hour period."
            : "A character must wait at least 16 hours after finishing a Long Rest before starting another.",
        },
      });
    }
  }

  if (input.ruleset === "2014" && has2014RestartingInterruption(input.interruptions)) {
    return emptyResult(input, {
      issue: {
        code: "restart-required",
        message: "A 2014 Long Rest interrupted by at least 1 hour of strenuous activity must be restarted.",
      },
    });
  }

  const qualifying2024Interruptions =
    input.ruleset === "2024" ? get2024Interruptions(input.interruptions) : [];
  const interruptionCount = new Set(
    qualifying2024Interruptions.map((entry) => entry.minuteFromStart),
  ).size;
  const additionalHoursRequired = interruptionCount;
  const requiredMinutes = 480 + additionalHoursRequired * 60;
  if (elapsedMinutes < requiredMinutes) {
    return emptyResult(input, {
      shortRestEarnedFromInterruption,
      additionalHoursRequired,
      issue: {
        code: "insufficient-duration",
        message: "The Long Rest requires at least " + requiredMinutes +
          " minutes including interruption recovery time.",
      },
    });
  }
  if (input.sleepMinutes < 360) {
    return emptyResult(input, {
      shortRestEarnedFromInterruption,
      additionalHoursRequired,
      issue: {
        code: "insufficient-sleep",
        message: "A Long Rest requires at least 6 hours of sleep.",
      },
    });
  }
  if (input.lightActivityMinutes > 120) {
    return emptyResult(input, {
      shortRestEarnedFromInterruption,
      additionalHoursRequired,
      issue: {
        code: "too-much-light-activity",
        message: "A Long Rest allows no more than 2 hours of light activity.",
      },
    });
  }

  const totalHitDice = input.hitDicePools.reduce((total, pool) => total + pool.total, 0);
  const spentHitDice = input.hitDicePools.reduce((total, pool) => total + pool.spent, 0);
  const recoveryLimit = input.ruleset === "2014"
    ? Math.min(spentHitDice, Math.max(1, Math.floor(totalHitDice / 2)))
    : spentHitDice;
  const choices = input.hitDiceRecoveryChoices ?? [];
  if (!Array.isArray(choices)) throw new TypeError("Hit Dice recovery choices must be an array.");
  const choiceIds = new Set<string>();
  let chosenTotal = 0;
  for (const choice of choices) {
    if (!choice || typeof choice !== "object") throw new TypeError("Hit Dice recovery choices must be objects.");
    if (typeof choice.classId !== "string" || !choice.classId.trim()) {
      throw new TypeError("Hit Dice recovery class ID must be non-empty.");
    }
    if (choiceIds.has(choice.classId)) {
      throw new RangeError("Duplicate Hit Dice recovery choice for class " + choice.classId + ".");
    }
    choiceIds.add(choice.classId);
    if (!Number.isInteger(choice.count) || choice.count < 0) {
      throw new RangeError("Hit Dice recovery count must be a non-negative integer.");
    }
    const pool = input.hitDicePools.find((entry) => entry.classId === choice.classId);
    if (!pool) throw new RangeError("Unknown Hit Dice recovery pool " + choice.classId + ".");
    if (choice.count > pool.spent) {
      throw new RangeError("Cannot recover more spent Hit Dice than class " + choice.classId + " has.");
    }
    chosenTotal += choice.count;
  }

  if (input.ruleset === "2014" && chosenTotal > recoveryLimit) {
    throw new RangeError("2014 Long Rest Hit Dice recovery cannot exceed " + recoveryLimit + " die/dice.");
  }
  if (input.ruleset === "2024" && choices.length > 0) {
    throw new RangeError("2024 Long Rest automatically restores all expended Hit Dice; do not supply choices.");
  }

  const hitDiceRecoveryChoices = input.ruleset === "2024"
    ? input.hitDicePools.filter((pool) => pool.spent > 0).map((pool) => ({
        classId: pool.classId,
        count: pool.spent,
      }))
    : choices.filter((choice) => choice.count > 0).map((choice) => ({ ...choice }));

  const restoredByClass = new Map(hitDiceRecoveryChoices.map((choice) => [choice.classId, choice.count]));
  const hitDicePools = input.hitDicePools.map((pool) => ({
    ...pool,
    spent: pool.spent - (restoredByClass.get(pool.classId) ?? 0),
  }));
  const hitDiceRecovered = hitDiceRecoveryChoices.reduce((total, choice) => total + choice.count, 0);

  const healed = applyHitPointHealing(input.hitPoints, input.hitPoints.maximumHitPoints);
  const resources = input.resources.map((entry) => {
    const resource: ResourceState = {
      maximum: entry.maximum,
      current: entry.current,
      recovery: entry.recovery,
    };
    const recovered = recoverResource(resource, "long-rest");
    return { ...entry, current: recovered.current };
  });
  const exhaustionRecoveryEligible =
    input.ruleset === "2024" || input.foodAndDrinkConsumed === true;
  const exhaustionLevel = exhaustionRecoveryEligible
    ? Math.max(0, input.exhaustionLevel - 1)
    : input.exhaustionLevel;

  return {
    completed: true,
    hitPoints: healed.state,
    hitDicePools,
    resources,
    exhaustionLevel,
    hitDiceRecovered,
    hitDiceRecoveryLimit: recoveryLimit,
    hitDiceRecoveryChoices,
    shortRestEarnedFromInterruption,
    additionalHoursRequired,
  };
}
