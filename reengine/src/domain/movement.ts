import type { ConditionMovementRules } from "./conditions";
import type { ExhaustionSpeedEffect } from "./exhaustion";

export const MOVEMENT_MODES = [
  "walking",
  "climbing",
  "swimming",
  "flying",
  "burrowing",
] as const;

export type MovementMode = (typeof MOVEMENT_MODES)[number];

export interface MovementSource {
  kind: "ancestry" | "class" | "subclass" | "feat" | "spell" | "item" | "other";
  id: string;
  label: string;
}

/**
 * One normalized base Speed per movement mode. The builder/content layer
 * resolves multiple grants for the same mode and preserves their provenance
 * in sources before calling the movement resolver.
 *
 * An absent mode means the creature has no recorded Speed for that mode.
 * A present profile with speedFeet: 0 is an explicit zero-Speed profile.
 */
export interface MovementProfile {
  mode: MovementMode;
  speedFeet: number;
  sources: MovementSource[];
}

export interface MovementSpeedModifier {
  id: string;
  mode: MovementMode;
  source: MovementSource;
  /** Explicit caller-defined order; lower values are applied first. */
  order: number;
  operation: "add" | "multiply" | "set";
  /** Feet for add/set; non-negative factor for multiply. */
  value: number;
}

export interface MovementResolutionInput {
  profiles: MovementProfile[];
  modifiers?: MovementSpeedModifier[];
  /** Pass the result of resolveExhaustionEffects; F does not reimplement E2. */
  exhaustionSpeed?: ExhaustionSpeedEffect;
  /** Pass the movement portion of resolveConditionEffects when available. */
  conditionMovement?: ConditionMovementRules;
}

export interface MovementResolutionResult {
  speedByMode: Partial<Record<MovementMode, number>>;
  movement: ConditionMovementRules;
  appliedModifierIds: string[];
  blockedModifierIds: string[];
}

export function emptyConditionMovementRules(): ConditionMovementRules {
  return {
    speedIsZero: false,
    speedCannotIncrease: false,
    crawlAllowed: false,
    standUpMovementCost: null,
    cannotStandWhenSpeedIsZero: false,
    cannotWillinglyApproachCreatureIds: [],
    grappleDragRules: [],
  };
}
