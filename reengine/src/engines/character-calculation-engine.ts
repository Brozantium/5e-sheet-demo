import type { Ability } from "../domain/types";
import {
  SKILL_DEFINITIONS,
  type CharacterCalculationInput,
  type CharacterCoreCalculations,
  type ProficiencyRank,
  type SkillId,
} from "../domain/character";

const ABILITIES: readonly Ability[] = [
  "str",
  "dex",
  "con",
  "int",
  "wis",
  "cha",
];

const SKILL_IDS = new Set<string>(SKILL_DEFINITIONS.map((skill) => skill.id));

function assertIntegerInRange(
  value: number,
  minimum: number,
  maximum: number,
  label: string,
): void {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(
      label + " must be an integer from " + minimum + " to " + maximum + ".",
    );
  }
}

function assertFlatBonus(value: number, label: string): void {
  if (!Number.isInteger(value)) {
    throw new RangeError(label + " must be an integer.");
  }
}

function assertProficiencyRank(rank: ProficiencyRank): void {
  if (
    rank !== "none" &&
    rank !== "half" &&
    rank !== "proficient" &&
    rank !== "expertise"
  ) {
    throw new RangeError("Unknown proficiency rank.");
  }
}

/** Standard 5e ability modifier, including floor behavior for odd negatives. */
export function calculateAbilityModifier(score: number): number {
  assertIntegerInRange(score, 1, 30, "Ability score");
  return Math.floor((score - 10) / 2);
}

/** Adds class levels to determine total character level for multiclass characters. */
export function calculateTotalLevel(
  classLevels: Record<string, number>,
): number {
  if (
    !classLevels ||
    typeof classLevels !== "object" ||
    Array.isArray(classLevels)
  ) {
    throw new TypeError("Class levels must be a record.");
  }

  const levels = Object.values(classLevels);
  levels.forEach((level) =>
    assertIntegerInRange(level, 0, 20, "Class level"),
  );

  const total = levels.reduce((sum, level) => sum + level, 0);
  assertIntegerInRange(total, 0, 20, "Total character level");
  return total;
}

/** Returns PB from total character level. Level zero represents an unfinished draft. */
export function calculateProficiencyBonus(totalLevel: number): number {
  assertIntegerInRange(totalLevel, 0, 20, "Total character level");
  return totalLevel === 0 ? 0 : 2 + Math.floor((totalLevel - 1) / 4);
}

/** Resolves one proficiency contribution without allowing duplicate PB stacking. */
export function calculateProficiencyContribution(
  proficiencyBonus: number,
  rank: ProficiencyRank,
): number {
  assertIntegerInRange(proficiencyBonus, 0, 6, "Proficiency bonus");
  assertProficiencyRank(rank);

  switch (rank) {
    case "none":
      return 0;
    case "half":
      return Math.floor(proficiencyBonus / 2);
    case "proficient":
      return proficiencyBonus;
    case "expertise":
      return proficiencyBonus * 2;
  }
}

export function calculateAbilityCheckBonus(
  abilityScore: number,
  proficiencyBonus: number,
  rank: ProficiencyRank = "none",
): number {
  return (
    calculateAbilityModifier(abilityScore) +
    calculateProficiencyContribution(proficiencyBonus, rank)
  );
}

export function calculateSavingThrowBonus(
  abilityScore: number,
  proficiencyBonus: number,
  proficient: boolean,
): number {
  if (typeof proficient !== "boolean") {
    throw new TypeError("Saving throw proficiency must be boolean.");
  }

  return (
    calculateAbilityModifier(abilityScore) +
    (proficient
      ? calculateProficiencyContribution(proficiencyBonus, "proficient")
      : 0)
  );
}

export function calculateSkillBonus(
  skillId: SkillId,
  abilityScores: Record<Ability, number>,
  proficiencyBonus: number,
  rank: ProficiencyRank = "none",
): number {
  const skill = SKILL_DEFINITIONS.find((entry) => entry.id === skillId);
  if (!skill) throw new RangeError("Unknown skill: " + String(skillId));
  return calculateAbilityCheckBonus(
    abilityScores[skill.ability],
    proficiencyBonus,
    rank,
  );
}

/** Passive check score before situational advantage/disadvantage adjustments. */
export function calculatePassiveScore(
  checkBonus: number,
  flatBonus = 0,
): number {
  assertFlatBonus(checkBonus, "Check bonus");
  assertFlatBonus(flatBonus, "Passive check bonus");
  return 10 + checkBonus + flatBonus;
}

export function calculateCharacterCore(
  input: CharacterCalculationInput,
): CharacterCoreCalculations {
  if (!input || typeof input !== "object") {
    throw new TypeError("Character calculation input is required.");
  }

  const totalLevel = calculateTotalLevel(input.classLevels);
  const proficiencyBonus = calculateProficiencyBonus(totalLevel);

  const abilityModifiers = Object.fromEntries(
    ABILITIES.map((ability) => [
      ability,
      calculateAbilityModifier(input.abilityScores?.[ability]),
    ]),
  ) as Record<Ability, number>;

  const proficiencies = input.proficiencies ?? {};
  const savingThrowRanks = proficiencies.savingThrows ?? [];
  if (!Array.isArray(savingThrowRanks)) {
    throw new TypeError("Saving throw proficiencies must be an array.");
  }
  savingThrowRanks.forEach((ability) => {
    if (!ABILITIES.includes(ability)) {
      throw new RangeError("Unknown saving throw ability: " + String(ability));
    }
  });
  const proficientSaves = new Set(savingThrowRanks);

  const skillRanks = proficiencies.skills ?? {};
  if (!skillRanks || typeof skillRanks !== "object" || Array.isArray(skillRanks)) {
    throw new TypeError("Skill proficiencies must be a record.");
  }
  Object.entries(skillRanks).forEach(([skillId, rank]) => {
    if (!SKILL_IDS.has(skillId)) {
      throw new RangeError("Unknown skill: " + skillId);
    }
    assertProficiencyRank(rank as ProficiencyRank);
  });

  const initiativeRank = proficiencies.initiative ?? "none";
  assertProficiencyRank(initiativeRank);

  const savingThrows = Object.fromEntries(
    ABILITIES.map((ability) => [
      ability,
      calculateSavingThrowBonus(
        input.abilityScores[ability],
        proficiencyBonus,
        proficientSaves.has(ability),
      ),
    ]),
  ) as Record<Ability, number>;

  const skills = Object.fromEntries(
    SKILL_DEFINITIONS.map((skill) => [
      skill.id,
      calculateSkillBonus(
        skill.id,
        input.abilityScores,
        proficiencyBonus,
        skillRanks[skill.id] ?? "none",
      ),
    ]),
  ) as Record<SkillId, number>;

  const initiativeBonus = input.initiativeBonus ?? 0;
  const passivePerceptionBonus = input.passivePerceptionBonus ?? 0;
  assertFlatBonus(initiativeBonus, "Initiative bonus");
  assertFlatBonus(passivePerceptionBonus, "Passive Perception bonus");

  return {
    totalLevel,
    proficiencyBonus,
    abilityModifiers,
    savingThrows,
    skills,
    initiative:
      abilityModifiers.dex +
      calculateProficiencyContribution(proficiencyBonus, initiativeRank) +
      initiativeBonus,
    passivePerception: calculatePassiveScore(
      skills.perception,
      passivePerceptionBonus,
    ),
  };
}
