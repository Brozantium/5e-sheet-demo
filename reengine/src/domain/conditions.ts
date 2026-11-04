import type { Ability, Ruleset } from "./types";

/** The fourteen non-Exhaustion conditions defined in both core rulesets. */
export const CONDITION_TYPES = [
  "blinded",
  "charmed",
  "deafened",
  "frightened",
  "grappled",
  "incapacitated",
  "invisible",
  "paralyzed",
  "petrified",
  "poisoned",
  "prone",
  "restrained",
  "stunned",
  "unconscious",
] as const;

export type ConditionType = (typeof CONDITION_TYPES)[number];

export type ConditionSourceKind =
  | "creature"
  | "feature"
  | "spell"
  | "item"
  | "environment"
  | "manual"
  | "system";

export interface ConditionSource {
  kind: ConditionSourceKind;
  /** Stable source record ID where one exists. */
  id?: string;
  /** Creature imposing the condition; required for source-dependent rules. */
  creatureId?: string;
  label: string;
}

export type ConditionExpiry =
  | { kind: "manual" }
  | { kind: "rest"; rest: "short" | "long" | "dawn" }
  | {
      kind: "turn";
      creatureId: string;
      boundary: "start" | "end";
      afterTurns: number;
    }
  | {
      kind: "round";
      boundary: "start" | "end";
      afterRounds: number;
    }
  | { kind: "elapsed-time"; minutes: number }
  | {
      kind: "saving-throw";
      creatureId: string;
      ability: Ability;
      dc: number;
      timing: "start-of-turn" | "end-of-turn";
      on: "success";
    }
  | { kind: "event"; eventId: string; subjectId?: string };

/** Caller-owned clock/turn snapshot recorded when the instance was applied. */
export interface ConditionApplicationTime {
  timestampMs?: number;
  round?: number;
  turn?: number;
  turnOwnerId?: string;
}

/**
 * A condition instance retains its own identity, source, and independent
 * expiration. Multiple instances of one type are allowed; their derived
 * mechanical effects are aggregated and do not become more severe.
 */
export interface ConditionInstance {
  id: string;
  type: ConditionType;
  affectedCreatureId: string;
  source: ConditionSource;
  appliedAt?: ConditionApplicationTime;
  /** Human-readable duration for display only; never parse this to expire state. */
  durationLabel?: string;
  /** Any one of these caller-supplied expiry triggers may end this instance. */
  expiresOn: readonly ConditionExpiry[];
  notes?: string;
}

export type ConditionRollKind =
  | "attack"
  | "ability-check"
  | "saving-throw"
  | "initiative";

export type ConditionRollPerspective =
  | "self"
  | "against-subject"
  | "source";

export type ConditionRollPredicate =
  | { kind: "always" }
  | { kind: "source-visible" }
  | { kind: "affected-creature-unseen" }
  | { kind: "target-is-source" }
  | { kind: "target-is-not-source" }
  | { kind: "within-distance"; feet: number }
  | { kind: "beyond-distance"; feet: number }
  | { kind: "social-interaction" };

export type RollMode = "normal" | "advantage" | "disadvantage";

export interface ConditionRollModifier {
  conditionId: string;
  conditionType: ConditionType;
  affectedCreatureId: string;
  sourceCreatureId?: string;
  roll: ConditionRollKind;
  perspective: ConditionRollPerspective;
  mode: Exclude<RollMode, "normal">;
  when: ConditionRollPredicate;
}

export interface ConditionRollContext {
  roll: ConditionRollKind;
  perspective: ConditionRollPerspective;
  affectedCreatureId: string;
  actorCreatureId: string;
  targetCreatureId?: string;
  distanceFeet?: number;
  /** Creature IDs visible to the roller in this specific situation. */
  visibleCreatureIds?: readonly string[];
  socialInteraction?: boolean;
}

export type ConditionAbilityCheckSense = "sight" | "hearing";

export interface ConditionMovementRules {
  speedIsZero: boolean;
  speedCannotIncrease: boolean;
  crawlAllowed: boolean;
  /** Standing ends Prone and costs half the creature's Speed (round down). */
  standUpMovementCost: "half-speed" | null;
  /** Standing is unavailable when the creature's effective Speed is 0. */
  cannotStandWhenSpeedIsZero: boolean;
  cannotWillinglyApproachCreatureIds: string[];
  /** 2024 Grappled movement: each foot dragged costs one extra foot. */
  grappleDragRules: Array<{
    grapplerCreatureId: string;
    extraFeetPerFootMoved: 1;
    exemptWhenTargetIsTiny: true;
    exemptWhenTargetIsAtLeastTwoSizesSmaller: true;
  }>;
}

export interface ConditionActionAvailability {
  canTakeAction: boolean;
  canTakeBonusAction: boolean;
  canTakeReaction: boolean;
  breaksConcentration: boolean;
  speech: "normal" | "faltering" | "none";
}

export interface ConditionDerivedEffects {
  /** Unique active types; duplicate instances do not increase severity. */
  activeTypes: ConditionType[];
  rollModifiers: ConditionRollModifier[];
  automaticSavingThrowFailures: Ability[];
  automaticAbilityCheckFailures: ConditionAbilityCheckSense[];
  /** A Charmed creature cannot harm/target these source creatures. */
  prohibitedHarmfulTargetCreatureIds: string[];
  actions: ConditionActionAvailability;
  movement: ConditionMovementRules;
  mustDropHeldItems: boolean;
  mustFallProne: boolean;
  damageResistances: string[];
  damageImmunities: string[];
  conditionImmunities: ConditionType[];
  diseaseImmunity: boolean;
}

export type ConditionResolutionIssueCode =
  | "missing-source-creature"
  | "duplicate-condition-instance-id";

export interface ConditionResolutionIssue {
  code: ConditionResolutionIssueCode;
  message: string;
  conditionId?: string;
}

export interface ConditionResolutionResult {
  valid: boolean;
  effects: ConditionDerivedEffects;
  issues: ConditionResolutionIssue[];
}

export interface ConditionResolutionInput {
  ruleset: Ruleset;
  affectedCreatureId: string;
  conditions: readonly ConditionInstance[];
}
