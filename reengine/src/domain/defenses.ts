import type { ConditionDerivedEffects } from "./conditions";

export type DefenseSourceKind =
  | "feature"
  | "temporary"
  | "equipment"
  | "condition"
  | "other";

export interface DefenseSource {
  kind: DefenseSourceKind;
  id: string;
  label: string;
}

export interface DefenseGrant {
  source: DefenseSource;
  resistances?: string[];
  vulnerabilities?: string[];
  immunities?: string[];
  conditionImmunities?: string[];
  /** Preserved as source records; AC calculation remains owned by the AC engine. */
  acBonus?: number;
}

export type DefenseEntry = {
  value: string;
  sources: DefenseSource[];
};

export interface DerivedDefenseInput {
  grants: DefenseGrant[];
  /** E1 output is adapted as a condition-origin grant without duplicating E1 rules. */
  conditionEffects?: Pick<
    ConditionDerivedEffects,
    "damageResistances" | "damageImmunities" | "conditionImmunities"
  >;
}

export interface DerivedDefenseResult {
  resistances: DefenseEntry[];
  vulnerabilities: DefenseEntry[];
  immunities: DefenseEntry[];
  conditionImmunities: DefenseEntry[];
  /** Do not sum here; the AC engine/consumer owns AC arithmetic and stacking. */
  acBonuses: Array<{ value: number; source: DefenseSource }>;
}
