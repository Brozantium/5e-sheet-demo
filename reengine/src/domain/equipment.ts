import type { Ability, Ruleset } from "./types";
import type { ArmorProfile, ItemDefinition } from "./item";

export type ArmorTrainingCategory = "light" | "medium" | "heavy";
export type ArmorTrainingGrant = ArmorTrainingCategory | "shield";

export interface ArmorTrainingGrantSource {
  sourceId: string;
  ruleset: "2014" | "2024" | "shared";
  grants: readonly ArmorTrainingGrant[];
}

export interface ArmorTrainingGrantIssue {
  code: "incompatible-ruleset-source";
  sourceId: string;
  message: string;
}

export interface ArmorTrainingGrantResolution {
  armorTraining: ArmorTrainingCategory[];
  shieldTraining: boolean;
  sourcesByGrant: Record<ArmorTrainingGrant, string[]>;
  issues: ArmorTrainingGrantIssue[];
}

/**
 * Character-owned inventory instance linked to an immutable canonical item.
 * Instance identity and equipped state must not be stored on ItemDefinition.
 */
export interface EquipmentCalculationEntry {
  instanceId: string;
  definition: ItemDefinition;
  equipped: boolean;
}

export interface UnarmoredDefenseRule {
  /** Additional ability modifier used by a class feature, such as CON or WIS. */
  ability: Ability;
  /** Barbarian-style Unarmored Defense permits a shield; Monk-style does not. */
  allowsShield: boolean;
}

export interface ArmorClassInput {
  ruleset: Ruleset;
  abilityScores: Record<Ability, number>;
  equipment: EquipmentCalculationEntry[];
  armorTraining: readonly ArmorTrainingCategory[];
  shieldTraining: boolean;
  unarmoredDefense?: UnarmoredDefenseRule;
  otherBonus?: number;
}

export type ArmorClassIssueCode =
  | "incompatible-ruleset-item"
  | "armor-not-proficient"
  | "shield-not-proficient"
  | "unarmored-defense-requires-no-shield";

export interface ArmorClassIssue {
  code: ArmorClassIssueCode;
  message: string;
}

export interface ArmorClassResult {
  total: number;
  baseAC: number;
  dexterityModifier: number;
  dexterityContribution: number;
  shieldBonus: number;
  otherBonus: number;
  defenseMode: "armor" | "unarmored" | "unarmored-defense";
  armorInstanceId?: string;
  shieldInstanceId?: string;
  armorProficient?: boolean;
  shieldProficient?: boolean;
  stealthDisadvantage: boolean;
  speedPenalty: number;
  issues: ArmorClassIssue[];
}

export type ResolvedArmorProfile = {
  instanceId: string;
  definition: ItemDefinition;
  profile: ArmorProfile;
  kind: "armor" | "shield";
};

export interface ArmorTrainingConsequenceInput {
  ruleset: Ruleset;
  equipment: EquipmentCalculationEntry[];
  armorTraining: readonly ArmorTrainingCategory[];
  shieldTraining: boolean;
}

export type ArmorTrainingConsequenceIssueCode =
  | "incompatible-ruleset-item"
  | "armor-not-proficient"
  | "shield-not-proficient";

export interface ArmorTrainingConsequenceIssue {
  code: ArmorTrainingConsequenceIssueCode;
  message: string;
  instanceId: string;
}

/**
 * Rule consequences from wearing armor / wielding a shield without the
 * appropriate training. This is deliberately separate from AC calculation:
 * the AC engine decides whether a shield grants AC; this engine resolves
 * attack/check/save Disadvantage and spellcasting restrictions.
 */
export interface ArmorTrainingConsequenceResult {
  untrainedArmorInstanceIds: string[];
  untrainedArmorCategories: ArmorTrainingCategory[];
  untrainedShieldInstanceIds: string[];
  /** Disadvantage on D20 Tests/checks/saves/attacks that involve STR or DEX. */
  disadvantageOnStrengthDexterityD20Tests: boolean;
  /** Whether the character is prohibited from casting spells. */
  cannotCastSpells: boolean;
  /** 2024: an untrained Shield does not grant its AC benefit. */
  shieldACBenefitDenied: boolean;
  issues: ArmorTrainingConsequenceIssue[];
}
