import type { Ability } from "./types";
import type { ConditionInstance } from "./conditions";

export interface ConditionLifecycleEventBase {
  /** Stable unique ID used for idempotency within the supplied event batch. */
  eventId: string;
  /** Strictly increasing sequence assigned by the caller's event stream. */
  sequence: number;
}

export type ConditionLifecycleEvent =
  | (ConditionLifecycleEventBase & {
      kind: "manual-remove";
      conditionId: string;
    })
  | (ConditionLifecycleEventBase & {
      kind: "rest-completed";
      rest: "short" | "long" | "dawn";
    })
  | (ConditionLifecycleEventBase & {
      kind: "turn-boundary";
      creatureId: string;
      boundary: "start" | "end";
      turnIndex: number;
    })
  | (ConditionLifecycleEventBase & {
      kind: "round-boundary";
      boundary: "start" | "end";
      round: number;
    })
  | (ConditionLifecycleEventBase & {
      kind: "time-advanced";
      timestampMs: number;
    })
  | (ConditionLifecycleEventBase & {
      kind: "saving-throw";
      creatureId: string;
      ability: Ability;
      timing: "start-of-turn" | "end-of-turn";
      total: number;
    })
  | (ConditionLifecycleEventBase & {
      kind: "trigger";
      triggerId: string;
      subjectId?: string;
    });

export type ConditionLifecycleIssueCode =
  | "invalid-event"
  | "duplicate-event-id"
  | "out-of-order-event"
  | "stale-event"
  | "duplicate-condition-instance-id"
  | "condition-not-found"
  | "missing-application-time"
  | "invalid-expiry-rule";

export interface ConditionLifecycleIssue {
  code: ConditionLifecycleIssueCode;
  message: string;
  eventId?: string;
  conditionId?: string;
}

export interface ConditionLifecycleInput {
  affectedCreatureId: string;
  conditions: readonly ConditionInstance[];
  events: readonly ConditionLifecycleEvent[];
}

export interface ConditionLifecycleResult {
  remainingConditions: ConditionInstance[];
  removedConditionIds: string[];
  processedEventIds: string[];
  issues: ConditionLifecycleIssue[];
}
