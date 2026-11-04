import { CONDITION_TYPES } from "../domain/conditions";
import type {
  ConditionExpiry,
  ConditionInstance,
} from "../domain/conditions";
import type {
  ConditionLifecycleEvent,
  ConditionLifecycleInput,
  ConditionLifecycleIssue,
  ConditionLifecycleResult,
} from "../domain/condition-lifecycle";

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIntegerAtLeast(value: unknown, minimum: number): value is number {
  return Number.isInteger(value) && (value as number) >= minimum;
}

function cloneCondition(instance: ConditionInstance): ConditionInstance {
  return {
    ...instance,
    source: { ...instance.source },
    ...(instance.appliedAt ? { appliedAt: { ...instance.appliedAt } } : {}),
    expiresOn: instance.expiresOn.map((expiry) => ({ ...expiry })),
  };
}

function validateCondition(instance: ConditionInstance, affectedCreatureId: string): void {
  if (!instance || typeof instance !== "object") {
    throw new TypeError("Condition instances must be objects.");
  }
  if (!isNonEmptyString(instance.id)) {
    throw new TypeError("Condition instance ID must be non-empty.");
  }
  if (!(CONDITION_TYPES as readonly string[]).includes(instance.type)) {
    throw new RangeError("Unknown condition type: " + String(instance.type));
  }
  if (instance.affectedCreatureId !== affectedCreatureId) {
    throw new RangeError("Every condition instance must belong to the affected creature.");
  }
  if (!instance.source || typeof instance.source !== "object" ||
      !isNonEmptyString(instance.source.label)) {
    throw new TypeError("Condition source and label are required.");
  }
  if (!Array.isArray(instance.expiresOn)) {
    throw new TypeError("Condition expiry triggers must be an array.");
  }
  if (instance.appliedAt) {
    const time = instance.appliedAt;
    for (const [label, value] of [
      ["application sequence", time.sequence],
      ["application timestamp", time.timestampMs],
      ["application round", time.round],
      ["application turn", time.turn],
    ] as const) {
      if (value !== undefined && !isIntegerAtLeast(value, 0)) {
        throw new RangeError(label + " must be a non-negative integer.");
      }
    }
  }
}

function validateExpiry(expiry: ConditionExpiry): void {
  if (!expiry || typeof expiry !== "object") {
    throw new TypeError("Condition expiry rules must be objects.");
  }
  switch (expiry.kind) {
    case "manual":
      return;
    case "rest":
      if (!["short", "long", "dawn"].includes(expiry.rest)) {
        throw new RangeError("Unknown rest expiry event.");
      }
      return;
    case "turn":
      if (!isNonEmptyString(expiry.creatureId) ||
          !["start", "end"].includes(expiry.boundary) ||
          !isIntegerAtLeast(expiry.afterTurns, 1)) {
        throw new RangeError("Turn expiry requires a creature, boundary, and positive turn count.");
      }
      return;
    case "round":
      if (!["start", "end"].includes(expiry.boundary) ||
          !isIntegerAtLeast(expiry.afterRounds, 1)) {
        throw new RangeError("Round expiry requires a boundary and positive round count.");
      }
      return;
    case "elapsed-time":
      if (!isIntegerAtLeast(expiry.minutes, 1)) {
        throw new RangeError("Elapsed-time expiry must be a positive whole number of minutes.");
      }
      return;
    case "saving-throw":
      if (!isNonEmptyString(expiry.creatureId) ||
          !(ABILITIES as readonly string[]).includes(expiry.ability) ||
          !isIntegerAtLeast(expiry.dc, 1) ||
          !["start-of-turn", "end-of-turn"].includes(expiry.timing) ||
          expiry.on !== "success") {
        throw new RangeError("Saving-throw expiry rule is invalid.");
      }
      return;
    case "event":
      if (!isNonEmptyString(expiry.eventId) ||
          (expiry.subjectId !== undefined && !isNonEmptyString(expiry.subjectId))) {
        throw new RangeError("Event expiry requires a trigger ID and optional non-empty subject ID.");
      }
      return;
    default:
      throw new RangeError("Unknown condition expiry rule.");
  }
}

function isStaleForInstance(
  event: ConditionLifecycleEvent,
  condition: ConditionInstance,
): boolean {
  const appliedSequence = condition.appliedAt?.sequence;
  return appliedSequence !== undefined && event.sequence <= appliedSequence;
}

function expiresOnEvent(
  expiry: ConditionExpiry,
  condition: ConditionInstance,
  event: ConditionLifecycleEvent,
): boolean {
  switch (expiry.kind) {
    case "manual":
      return event.kind === "manual-remove" && event.conditionId === condition.id;

    case "rest":
      if (event.kind !== "rest-completed") return false;
      if (expiry.rest === "short") return event.rest === "short" || event.rest === "long";
      if (expiry.rest === "long") return event.rest === "long";
      return event.rest === "dawn";

    case "turn":
      if (event.kind !== "turn-boundary" ||
          event.creatureId !== expiry.creatureId ||
          event.boundary !== expiry.boundary) return false;
      if (condition.appliedAt?.turn === undefined) return false;
      return event.turnIndex - condition.appliedAt.turn >= expiry.afterTurns;

    case "round":
      if (event.kind !== "round-boundary" || event.boundary !== expiry.boundary) return false;
      if (condition.appliedAt?.round === undefined) return false;
      return event.round - condition.appliedAt.round >= expiry.afterRounds;

    case "elapsed-time":
      if (event.kind !== "time-advanced" ||
          condition.appliedAt?.timestampMs === undefined) return false;
      return event.timestampMs - condition.appliedAt.timestampMs >= expiry.minutes * 60_000;

    case "saving-throw":
      if (event.kind !== "saving-throw" ||
          event.creatureId !== expiry.creatureId ||
          event.ability !== expiry.ability ||
          event.timing !== expiry.timing) return false;
      return event.total >= expiry.dc;

    case "event":
      if (event.kind !== "trigger" || event.triggerId !== expiry.eventId) return false;
      return expiry.subjectId === undefined || event.subjectId === expiry.subjectId;
  }
}

function validateEvent(event: ConditionLifecycleEvent): void {
  if (!event || typeof event !== "object") {
    throw new TypeError("Lifecycle events must be objects.");
  }
  if (!isNonEmptyString(event.eventId)) {
    throw new TypeError("Lifecycle event ID must be non-empty.");
  }
  if (!isIntegerAtLeast(event.sequence, 0)) {
    throw new RangeError("Lifecycle event sequence must be a non-negative integer.");
  }
  switch (event.kind) {
    case "manual-remove":
      if (!isNonEmptyString(event.conditionId)) throw new TypeError("Manual removal requires a condition ID.");
      return;
    case "rest-completed":
      if (!["short", "long", "dawn"].includes(event.rest)) throw new RangeError("Unknown completed rest event.");
      return;
    case "turn-boundary":
      if (!isNonEmptyString(event.creatureId) ||
          !["start", "end"].includes(event.boundary) ||
          !isIntegerAtLeast(event.turnIndex, 0)) {
        throw new RangeError("Turn-boundary event is invalid.");
      }
      return;
    case "round-boundary":
      if (!["start", "end"].includes(event.boundary) ||
          !isIntegerAtLeast(event.round, 0)) {
        throw new RangeError("Round-boundary event is invalid.");
      }
      return;
    case "time-advanced":
      if (!isIntegerAtLeast(event.timestampMs, 0)) throw new RangeError("Event timestamp must be a non-negative integer.");
      return;
    case "saving-throw":
      if (!isNonEmptyString(event.creatureId) ||
          !(ABILITIES as readonly string[]).includes(event.ability) ||
          !["start-of-turn", "end-of-turn"].includes(event.timing) ||
          !Number.isInteger(event.total)) {
        throw new RangeError("Saving-throw lifecycle event is invalid.");
      }
      return;
    case "trigger":
      if (!isNonEmptyString(event.triggerId) ||
          (event.subjectId !== undefined && !isNonEmptyString(event.subjectId))) {
        throw new RangeError("Trigger event requires a trigger ID and optional non-empty subject ID.");
      }
      return;
    default:
      throw new RangeError("Unknown condition lifecycle event.");
  }
}

/**
 * Applies caller-supplied lifecycle events to active condition instances.
 * Any matching expiry rule ends that instance. It is immutable and does not
 * run timers, schedule turns, persist state, or execute the underlying effect.
 */
export function resolveConditionLifecycle(
  input: ConditionLifecycleInput,
): ConditionLifecycleResult {
  if (!input || typeof input !== "object") {
    throw new TypeError("Condition lifecycle input is required.");
  }
  if (!isNonEmptyString(input.affectedCreatureId)) {
    throw new TypeError("Affected creature ID is required.");
  }
  if (!Array.isArray(input.conditions) || !Array.isArray(input.events)) {
    throw new TypeError("Conditions and lifecycle events must be arrays.");
  }

  const issues: ConditionLifecycleIssue[] = [];
  const conditions: ConditionInstance[] = [];
  const seenConditionIds = new Set<string>();
  for (const instance of input.conditions) {
    validateCondition(instance, input.affectedCreatureId);
    for (const expiry of instance.expiresOn) validateExpiry(expiry);
    if (seenConditionIds.has(instance.id)) {
      issues.push({
        code: "duplicate-condition-instance-id",
        conditionId: instance.id,
        message: "Duplicate condition instance ID was ignored: " + instance.id,
      });
      continue;
    }
    seenConditionIds.add(instance.id);
    conditions.push(cloneCondition(instance));
  }

  let remaining = conditions;
  const removedConditionIds: string[] = [];
  const processedEventIds: string[] = [];
  const seenEventIds = new Set<string>();
  let lastSequence = -1;
  let lastTimestamp: number | undefined;
  let lastTurnIndex: number | undefined;
  let lastRound: number | undefined;

  for (const event of input.events) {
    try {
      validateEvent(event);
    } catch (error) {
      issues.push({
        code: "invalid-event",
        eventId: isNonEmptyString((event as { eventId?: unknown })?.eventId)
          ? (event as { eventId: string }).eventId
          : undefined,
        message: error instanceof Error ? error.message : "Invalid lifecycle event.",
      });
      continue;
    }

    if (seenEventIds.has(event.eventId)) {
      issues.push({
        code: "duplicate-event-id",
        eventId: event.eventId,
        message: "Duplicate lifecycle event ID was ignored: " + event.eventId,
      });
      continue;
    }
    seenEventIds.add(event.eventId);

    if (event.sequence <= lastSequence) {
      issues.push({
        code: "out-of-order-event",
        eventId: event.eventId,
        message: "Lifecycle event sequence must be strictly increasing.",
      });
      continue;
    }

    if (event.kind === "time-advanced" &&
        lastTimestamp !== undefined &&
        event.timestampMs < lastTimestamp) {
      issues.push({
        code: "out-of-order-event",
        eventId: event.eventId,
        message: "Lifecycle timestamps cannot move backwards.",
      });
      continue;
    }
    if (event.kind === "turn-boundary" &&
        lastTurnIndex !== undefined &&
        event.turnIndex < lastTurnIndex) {
      issues.push({
        code: "out-of-order-event",
        eventId: event.eventId,
        message: "Turn indexes cannot move backwards.",
      });
      continue;
    }
    if (event.kind === "round-boundary" &&
        lastRound !== undefined &&
        event.round < lastRound) {
      issues.push({
        code: "out-of-order-event",
        eventId: event.eventId,
        message: "Round indexes cannot move backwards.",
      });
      continue;
    }

    lastSequence = event.sequence;
    if (event.kind === "time-advanced") lastTimestamp = event.timestampMs;
    if (event.kind === "turn-boundary") lastTurnIndex = event.turnIndex;
    if (event.kind === "round-boundary") lastRound = event.round;
    processedEventIds.push(event.eventId);

    if (event.kind === "manual-remove" &&
        !remaining.some((condition) => condition.id === event.conditionId)) {
      issues.push({
        code: "condition-not-found",
        eventId: event.eventId,
        conditionId: event.conditionId,
        message: "Manual removal referenced no active condition instance.",
      });
      continue;
    }

    const keep: ConditionInstance[] = [];
    for (const condition of remaining) {
      if (isStaleForInstance(event, condition)) {
        issues.push({
          code: "stale-event",
          eventId: event.eventId,
          conditionId: condition.id,
          message: "Lifecycle event predates this condition instance and was ignored for it.",
        });
        keep.push(condition);
        continue;
      }

      const expired = condition.expiresOn.some((expiry) =>
        expiresOnEvent(expiry, condition, event),
      );
      if (expired) {
        removedConditionIds.push(condition.id);
      } else {
        keep.push(condition);
      }
    }
    remaining = keep;
  }

  return {
    remainingConditions: remaining,
    removedConditionIds: [...new Set(removedConditionIds)],
    processedEventIds,
    issues,
  };
}
