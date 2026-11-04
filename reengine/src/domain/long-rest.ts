import type { Recovery } from "./types";

export type LongRestInterruption =
  | { kind: "initiative"; minuteFromStart: number }
  | { kind: "non-cantrip-spell"; minuteFromStart: number }
  | { kind: "damage"; minuteFromStart: number }
  | { kind: "physical-exertion" | "strenuous-activity"; minuteFromStart: number; durationMinutes: number };

export interface LongRestResourceState {
  id: string;
  maximum: number;
  current: number;
  recovery: Recovery;
}

export interface HitDiceRecoveryChoice {
  classId: string;
  count: number;
}

export type LongRestIssueCode =
  | "requires-positive-hit-points"
  | "invalid-time-window"
  | "long-rest-too-soon"
  | "insufficient-duration"
  | "insufficient-sleep"
  | "too-much-light-activity"
  | "restart-required";

export interface LongRestInput {
  ruleset: "2014" | "2024";
  /** HP before the Long Rest begins; eligibility is checked at the start, not at completion. */
  hitPointsAtStart: number;
  hitPoints: {
    currentHitPoints: number;
    maximumHitPoints: number;
    temporaryHitPoints: number;
  };
  hitDicePools: readonly {
    classId: string;
    hitDie: 6 | 8 | 10 | 12;
    total: number;
    spent: number;
  }[];
  resources: readonly LongRestResourceState[];
  exhaustionLevel: number;
  startedAtMinute: number;
  completedAtMinute: number;
  lastLongRestCompletedAtMinute?: number;
  sleepMinutes: number;
  lightActivityMinutes: number;
  interruptions: readonly LongRestInterruption[];
  /** 2014 characters choose which multiclass Hit Dice to recover. 2024 restores all automatically. */
  hitDiceRecoveryChoices?: readonly HitDiceRecoveryChoice[];
  /** Required to remove 2014 Exhaustion; ignored by 2024. */
  foodAndDrinkConsumed?: boolean;
}

export interface LongRestResult {
  completed: boolean;
  hitPoints: {
    currentHitPoints: number;
    maximumHitPoints: number;
    temporaryHitPoints: number;
  };
  hitDicePools: {
    classId: string;
    hitDie: 6 | 8 | 10 | 12;
    total: number;
    spent: number;
  }[];
  resources: LongRestResourceState[];
  exhaustionLevel: number;
  hitDiceRecovered: number;
  hitDiceRecoveryLimit: number;
  hitDiceRecoveryChoices: HitDiceRecoveryChoice[];
  shortRestEarnedFromInterruption: boolean;
  additionalHoursRequired: number;
  issue?: { code: LongRestIssueCode; message: string };
}
