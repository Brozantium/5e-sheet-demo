import type { Ruleset } from "./types";

/** Exhaustion is cumulative and intentionally separate from ordinary conditions. */
export interface ExhaustionState {
  level: number;
}

export interface ExhaustionResolutionInput {
  ruleset: Ruleset;
  level: number;
  /** Optional base walking Speed in feet, before condition and other modifiers. */
  baseSpeed?: number;
  /** Optional maximum HP before ruleset-specific Exhaustion reduction. */
  baseMaximumHitPoints?: number;
}

export type ExhaustionSpeedEffect =
  | {
      kind: "normal";
      multiplier: 1;
      reductionFeet: 0;
      effectiveSpeed?: number;
    }
  | {
      kind: "halved";
      multiplier: 0.5;
      reductionFeet: 0;
      effectiveSpeed?: number;
    }
  | {
      kind: "zero";
      multiplier: 0;
      reductionFeet: 0;
      effectiveSpeed?: number;
    }
  | {
      kind: "reduced";
      multiplier: 1;
      reductionFeet: number;
      effectiveSpeed?: number;
    };

export interface ExhaustionResolutionResult {
  ruleset: Ruleset;
  level: number;
  /** Level 6 is an explicit death outcome, not three failed Death Saves. */
  isDead: boolean;
  /** 2024 applies this negative numeric modifier to every D20 Test. */
  d20TestModifier: number;
  attackRollDisadvantage: boolean;
  abilityCheckDisadvantage: boolean;
  savingThrowDisadvantage: boolean;
  speed: ExhaustionSpeedEffect;
  maximumHitPointsMultiplier: 1 | 0.5;
  effectiveMaximumHitPoints?: number;
}

export type ExhaustionIssueCode =
  | "invalid-exhaustion-level"
  | "invalid-exhaustion-amount";

export interface ExhaustionLevelChangeResult {
  previousLevel: number;
  level: number;
  levelsAdded: number;
  isDead: boolean;
  issue?: {
    code: ExhaustionIssueCode;
    message: string;
  };
}
