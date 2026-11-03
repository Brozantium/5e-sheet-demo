import type { Ability, Ruleset } from "./types";
import type { ArmorProfile, ItemDefinition } from "./item";

export type ArmorTrainingCategory = "light" | "medium" | "heavy";

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
