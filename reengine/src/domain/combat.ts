import type { Ability, ContentRuleset, Ruleset } from "./types";
import type { ItemDefinition, WeaponProfile, WeaponSpecialRuleId } from "./item";
import type { EquipmentCalculationEntry } from "./equipment";

export type WeaponCategory = WeaponProfile["weaponCategory"];
export type WeaponGrip = "one-handed" | "two-handed";
export type WeaponAttackMode = "melee" | "ranged" | "thrown";
export type WeaponRangeBand = "melee" | "normal" | "long";
export type CreatureSize = "tiny" | "small" | "medium" | "large" | "huge" | "gargantuan";
export type WeaponHeavyDisadvantageReason =
  | "heavy-weapon-size"
  | "heavy-weapon-ability-score";
export type WeaponRangeDisadvantageReason =
  | "long-range"
  | "lance-close-range-2014";
export type WeaponAttackDisadvantageReason =
  | WeaponHeavyDisadvantageReason
  | WeaponRangeDisadvantageReason;
export type AbilityModifierDamageMode = "normal" | "none" | "negative-only";

export type WeaponProficiency =
  | { kind: "category"; category: WeaponCategory }
  | { kind: "weapon"; weaponId: string };

export interface WeaponAttackInput {
  ruleset: Ruleset;
  weapon: EquipmentCalculationEntry;
  abilityScores: Record<Ability, number>;
  proficiencyBonus: number;
  weaponProficiencies?: readonly WeaponProficiency[];
  /** Explicit STR/DEX choice for a Finesse weapon; otherwise the higher modifier is used. */
  abilityChoice?: "str" | "dex";
  /** Required for 2014 Heavy weapons so the Small/Tiny size rule can be resolved. */
  creatureSize?: CreatureSize;
  /** Defaults from the weapon's base melee/ranged classification. */
  attackMode?: WeaponAttackMode;
  /** Optional target distance in feet. When supplied, range/reach is validated. */
  targetDistanceFeet?: number;
  /** Creature's base reach; defaults to 5 feet. Reach adds another 5 feet. */
  baseReachFeet?: number;
  /** Whether the attacker is currently mounted; resolves Lance hand rules. */
  isMounted?: boolean;
  grip?: WeaponGrip;
  attackBonus?: number;
  damageBonus?: number;
  /** Supports normal attacks and rules such as Light's negative-modifier-only damage. */
  abilityModifierDamageMode?: AbilityModifierDamageMode;
}

export type WeaponAttackIssueCode =
  | "weapon-not-equipped"
  | "incompatible-ruleset-item"
  | "weapon-not-proficient"
  | "weapon-requires-two-hands"
  | "missing-versatile-damage"
  | "weapon-mode-not-supported"
  | "missing-weapon-range"
  | "target-out-of-range"
  | "target-out-of-reach";

export interface WeaponAttackIssue {
  code: WeaponAttackIssueCode;
  message: string;
}

export interface WeaponDamageCalculation {
  formula: string;
  damageType: string;
  modifier: number;
  displayFormula: string;
  primary: boolean;
}

export interface WeaponAttackResult {
  canAttack: boolean;
  weaponInstanceId: string;
  attackMode: WeaponAttackMode;
  ability: Ability;
  abilityModifier: number;
  proficient: boolean;
  proficiencyContribution: number;
  attackBonus: number;
  damageModifier: number;
  hasHeavyWeaponDisadvantage: boolean;
  heavyWeaponDisadvantageReasons: WeaponHeavyDisadvantageReason[];
  hasRangeDisadvantage: boolean;
  rangeDisadvantageReasons: WeaponRangeDisadvantageReason[];
  hasDisadvantage: boolean;
  disadvantageReasons: WeaponAttackDisadvantageReason[];
  targetDistanceFeet?: number;
  effectiveReachFeet?: number;
  rangeBand: WeaponRangeBand | null;
  grip: WeaponGrip;
  /** Special rules are returned as data for the action/effect layer to resolve. */
  specialRules: WeaponSpecialRuleId[];
  damage: WeaponDamageCalculation[];
  issues: WeaponAttackIssue[];
}

export type WeaponHand = "main" | "off";

export interface HeldItemAssignment {
  instanceId: string;
  definition: ItemDefinition;
  /** Hands occupied by this item. A two-handed weapon must list both. */
  hands: readonly WeaponHand[];
}

export interface WeaponHandOccupancyInput {
  ruleset: Ruleset;
  /** Controls the 2014 Lance and 2024 Lance grip exceptions. */
  isMounted?: boolean;
  heldItems: readonly HeldItemAssignment[];
}

export type WeaponHandOccupancyIssueCode =
  | "incompatible-ruleset-item"
  | "hand-already-occupied"
  | "weapon-requires-two-hands";

export interface WeaponHandOccupancyIssue {
  code: WeaponHandOccupancyIssueCode;
  message: string;
  instanceId?: string;
}

export interface WeaponHandOccupancyResult {
  valid: boolean;
  occupiedHands: Record<WeaponHand, string | null>;
  /** Whether the held pair satisfies the weapon-property prerequisites for Light's extra-attack feature; the required Attack-action trigger is validated separately. */
  lightWeaponPairEligible: boolean;
  issues: WeaponHandOccupancyIssue[];
}
