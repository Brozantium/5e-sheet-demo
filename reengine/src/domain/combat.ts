import type { Ability, ContentRuleset, Ruleset } from "./types";
import type { ItemDefinition, WeaponProfile } from "./item";
import type { EquipmentCalculationEntry } from "./equipment";

export type WeaponCategory = WeaponProfile["weaponCategory"];
export type WeaponGrip = "one-handed" | "two-handed";

export type WeaponProficiency =
  | { kind: "category"; category: WeaponCategory }
  | { kind: "weapon"; weaponId: string };

export interface WeaponAttackInput {
  ruleset: Ruleset;
  weapon: EquipmentCalculationEntry;
  abilityScores: Record<Ability, number>;
  proficiencyBonus: number;
  weaponProficiencies?: readonly WeaponProficiency[];
  grip?: WeaponGrip;
  attackBonus?: number;
  damageBonus?: number;
  /** Set false for effects that explicitly omit the ability modifier from damage. */
  includeAbilityModifierInDamage?: boolean;
}

export type WeaponAttackIssueCode =
  | "weapon-not-equipped"
  | "incompatible-ruleset-item"
  | "weapon-not-proficient"
  | "weapon-requires-two-hands"
  | "missing-versatile-damage";

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
  ability: Ability;
  abilityModifier: number;
  proficient: boolean;
  proficiencyContribution: number;
  attackBonus: number;
  damageModifier: number;
  grip: WeaponGrip;
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
  heldItems: readonly HeldItemAssignment[];
}

export type WeaponHandOccupancyIssueCode =
  | "incompatible-ruleset-item"
  | "hand-already-occupied"
  | "weapon-requires-two-hands"
  | "two-weapon-wielding-requires-light-melee-weapons";

export interface WeaponHandOccupancyIssue {
  code: WeaponHandOccupancyIssueCode;
  message: string;
  instanceId?: string;
}

export interface WeaponHandOccupancyResult {
  valid: boolean;
  occupiedHands: Record<WeaponHand, string | null>;
  issues: WeaponHandOccupancyIssue[];
}
