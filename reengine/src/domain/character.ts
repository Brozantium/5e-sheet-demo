import type { Ability } from "./types";
import type { ArmorTrainingCategory } from "./equipment";

export const SKILL_DEFINITIONS = [
  { id: "acrobatics", name: "Acrobatics", ability: "dex" },
  { id: "animal-handling", name: "Animal Handling", ability: "wis" },
  { id: "arcana", name: "Arcana", ability: "int" },
  { id: "athletics", name: "Athletics", ability: "str" },
  { id: "deception", name: "Deception", ability: "cha" },
  { id: "history", name: "History", ability: "int" },
  { id: "insight", name: "Insight", ability: "wis" },
  { id: "intimidation", name: "Intimidation", ability: "cha" },
  { id: "investigation", name: "Investigation", ability: "int" },
  { id: "medicine", name: "Medicine", ability: "wis" },
  { id: "nature", name: "Nature", ability: "int" },
  { id: "perception", name: "Perception", ability: "wis" },
  { id: "performance", name: "Performance", ability: "cha" },
  { id: "persuasion", name: "Persuasion", ability: "cha" },
  { id: "religion", name: "Religion", ability: "int" },
  { id: "sleight-of-hand", name: "Sleight of Hand", ability: "dex" },
  { id: "stealth", name: "Stealth", ability: "dex" },
  { id: "survival", name: "Survival", ability: "wis" },
] as const satisfies readonly {
  id: string;
  name: string;
  ability: Ability;
}[];

export type SkillId = (typeof SKILL_DEFINITIONS)[number]["id"];

/**
 * One normalized proficiency state per check. "half" models effects such as
 * Jack of All Trades; "expertise" replaces ordinary proficiency with double PB.
 * These are alternatives, not additive flags.
 */
export type ProficiencyRank = "none" | "half" | "proficient" | "expertise";

export interface CharacterProficiencies {
  skills?: Partial<Record<SkillId, ProficiencyRank>>;
  savingThrows?: Ability[];
  /** Normalized grants from owned class, subclass, species, background, and feat content. */
  armorTraining?: ArmorTrainingCategory[];
  /** Shield training is separate from Light/Medium/Heavy armor training. */
  shieldTraining?: boolean;
  /** Explicit grants only; ordinary initiative adds no proficiency bonus. */
  initiative?: ProficiencyRank;
}

/**
 * Calculation input is a resolved snapshot. Feature/class/background content
 * grants are normalized into this shape by the builder/content layer.
 */
export interface CharacterCalculationInput {
  classLevels: Record<string, number>;
  abilityScores: Record<Ability, number>;
  proficiencies?: CharacterProficiencies;
  initiativeBonus?: number;
  passivePerceptionBonus?: number;
}

export interface CharacterCoreCalculations {
  totalLevel: number;
  proficiencyBonus: number;
  abilityModifiers: Record<Ability, number>;
  savingThrows: Record<Ability, number>;
  skills: Record<SkillId, number>;
  initiative: number;
  passivePerception: number;
}
