export type Ruleset = "2014" | "2024";
export type ContentRuleset = Ruleset | "shared";
export type Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";
export type Recovery = "short-rest" | "long-rest" | "dawn" | "manual" | "special";

export interface ContentSource {
  book?: string;
  page?: string | number;
  publisher?: string;
  license?: string;
}

export type ProgressionValue =
  | { kind: "fixed"; value: number }
  | {
      kind: "class-table";
      tableId: string;
      column: string;
      levelFromClassId?: string;
      fallback?: number;
    };

export type Requirement =
  | { kind: "class-level"; classId: string; minimum: number }
  | { kind: "ability-score"; ability: Ability; minimum: number }
  | { kind: "known-option"; selectionId: string; optionId: string }
  | { kind: "spell-known"; spellId: string }
  | { kind: "feature-owned"; featureId: string }
  | { kind: "all"; requirements: Requirement[] }
  | { kind: "any"; requirements: Requirement[] };

export interface OptionDefinition {
  id: string;
  name: string;
  description: string;
  prerequisites?: Requirement[];
  repeatable?: boolean;
  resourceCost?: { resourceId: string; amount: number };
  effects?: EffectDefinition[];
  tags?: string[];
  source?: ContentSource;
}

export type EffectDefinition =
  | { kind: "modifier"; target: string; amount: number; condition?: string }
  | { kind: "grant-spell"; spellId: string; preparation?: "always" | "known" | "prepared" }
  | { kind: "defense"; defense: "resistance" | "immunity" | "vulnerability"; value: string }
  | { kind: "proficiency"; proficiency: "skill" | "tool" | "weapon" | "armor" | "language"; value: string }
  | { kind: "action-grant"; actionId: string };

export interface OptionSetDefinition {
  id: string;
  ruleset: ContentRuleset;
  name: string;
  options: OptionDefinition[];
  source?: ContentSource;
}

export interface ProgressionRow {
  level: number;
  values: Record<string, number | string | boolean | null>;
}

export interface ProgressionTable {
  id: string;
  /** Class or progression owner used as the default level source. */
  classId: string;
  /** Override when this table advances from another class, such as a subclass table. */
  levelFromClassId?: string;
  rows: ProgressionRow[];
}

export interface SelectionMechanic {
  kind: "selection";
  id: string;
  optionSetId: string;
  mode: "single" | "multiple";
  count: ProgressionValue;
  allowDuplicates?: boolean;
  replacement?: { when: "class-level-gained" | "long-rest" | "manual"; count: number };
}

export interface AssignmentMechanic {
  kind: "assignment";
  id: string;
  selectionId: string;
  targetKind: "inventory-item" | "creature" | "spell";
  capacity: ProgressionValue;
  maxPerTarget: number;
  /** Optional upper bound for how often one selected option may be assigned. */
  maxPerOption?: number;
  resetOn?: "short-rest" | "long-rest" | "never";
  eligibleItemTags?: string[];
}

export interface ResourcePoolMechanic {
  kind: "resource-pool";
  id: string;
  resourceId: string;
  maximum: ProgressionValue;
  recovery: Recovery;
}

export interface SpellModifierMechanic {
  kind: "spell-modifier";
  id: string;
  optionSetId: string;
  resourceId: string;
  timing: "spell-cast";
  maxPerSpell: number;
  replacement?: { when: "class-level-gained" | "manual"; count: number };
}

export interface ActionMechanic {
  kind: "action";
  id: string;
  actionIds: string[];
}

export interface TriggerMechanic {
  kind: "trigger";
  id: string;
  triggerIds: string[];
}

export type FeatureMechanic =
  | SelectionMechanic
  | AssignmentMechanic
  | ResourcePoolMechanic
  | SpellModifierMechanic
  | ActionMechanic
  | TriggerMechanic;

export interface FeatureDefinition {
  id: string;
  name: string;
  level: number;
  description: string;
  ruleset: ContentRuleset;
  optional?: boolean;
  source?: ContentSource;
  mechanics: FeatureMechanic[];
  tags?: string[];
}

export interface ClassDefinition {
  id: string;
  name: string;
  ruleset: ContentRuleset;
  hitDie: 6 | 8 | 10 | 12;
  progression: ProgressionTable;
  features: FeatureDefinition[];
  primaryAbilities?: Ability[];
  source?: ContentSource;
}

export interface CharacterMechanicsState {
  id: string;
  ruleset: Ruleset;
  classLevels: Record<string, number>;
  abilityScores: Record<Ability, number>;
  selections: Record<string, string[]>;
  assignments: Array<{ mechanicId: string; optionId: string; targetId: string }>;
  resources: Record<string, { maximum: number; current: number }>;
  knownSpells: string[];
  ownedFeatures: string[];
  inventoryItemTags: Record<string, string[]>;
}

export interface RequirementResult {
  met: boolean;
  reason?: string;
}

export interface EngineIssue {
  code: string;
  message: string;
  subjectId?: string;
}
