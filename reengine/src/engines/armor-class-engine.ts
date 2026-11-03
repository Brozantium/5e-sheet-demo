import type { Ability, ContentRuleset } from "../domain/types";
import type { ArmorProfile, ItemDefinition } from "../domain/item";
import {
  type ArmorClassInput,
  type ArmorClassIssue,
  type ArmorClassResult,
  type ArmorTrainingCategory,
  type ResolvedArmorProfile,
} from "../domain/equipment";
import { calculateAbilityModifier } from "./character-calculation-engine";

const ABILITIES: readonly Ability[] = [
  "str",
  "dex",
  "con",
  "int",
  "wis",
  "cha",
];

function assertInteger(value: number, label: string): void {
  if (!Number.isInteger(value)) {
    throw new RangeError(label + " must be an integer.");
  }
}

function assertAbilityScore(score: number, label: string): void {
  if (!Number.isInteger(score) || score < 1 || score > 30) {
    throw new RangeError(label + " must be an integer from 1 to 30.");
  }
}

function profileFor(definition: ItemDefinition): ArmorProfile | undefined {
  if (
    definition.category === "armor" ||
    definition.category === "shield" ||
    definition.category === "magic-item"
  ) {
    return definition.armorProfile;
  }
  return undefined;
}

function resolveProtectiveItem(
  instanceId: string,
  definition: ItemDefinition,
  profile: ArmorProfile,
): ResolvedArmorProfile {
  if (!instanceId.trim()) {
    throw new TypeError("Equipment instance ID must be non-empty.");
  }
  if (!Number.isInteger(profile.baseAC) || profile.baseAC < 0 || profile.baseAC > 30) {
    throw new RangeError("Armor profile baseAC must be an integer from 0 to 30.");
  }
  if (
    profile.strengthRequirement !== undefined &&
    (!Number.isInteger(profile.strengthRequirement) ||
      profile.strengthRequirement < 0 ||
      profile.strengthRequirement > 30)
  ) {
    throw new RangeError("Armor strength requirement must be an integer from 0 to 30.");
  }
  if (
    profile.dexterity === "capped" &&
    (!Number.isInteger(profile.maxDexterityModifier) ||
      profile.maxDexterityModifier < 0)
  ) {
    throw new RangeError("Capped Dexterity armor requires a non-negative integer cap.");
  }

  if (definition.category === "armor" && profile.armorCategory === "shield") {
    throw new TypeError("An armor item cannot use a shield armor profile.");
  }
  if (definition.category === "shield" && profile.armorCategory !== "shield") {
    throw new TypeError("A shield item must use a shield armor profile.");
  }

  return {
    instanceId,
    definition,
    profile,
    kind: profile.armorCategory === "shield" ? "shield" : "armor",
  };
}

function isRulesetCompatible(
  ruleset: ContentRuleset,
  characterRuleset: "2014" | "2024",
): boolean {
  return ruleset === "shared" || ruleset === characterRuleset;
}

function hasArmorTraining(
  training: readonly ArmorTrainingCategory[],
  category: ArmorTrainingCategory,
): boolean {
  return training.includes(category);
}

/**
 * Calculates AC from one worn armor (or an unarmored formula), one shield,
 * and an explicit flat bonus. It never mutates equipment or content records.
 *
 * In 2014, an untrained shield still contributes its AC bonus but creates a
 * training issue for downstream rule handling. In 2024, shield AC requires
 * shield training and therefore contributes no bonus when untrained.
 */
export function calculateArmorClass(input: ArmorClassInput): ArmorClassResult {
  if (!input || typeof input !== "object") {
    throw new TypeError("Armor Class input is required.");
  }
  if (input.ruleset !== "2014" && input.ruleset !== "2024") {
    throw new RangeError("Armor Class ruleset must be 2014 or 2024.");
  }
  if (!Array.isArray(input.equipment)) {
    throw new TypeError("Equipment must be an array.");
  }
  if (!Array.isArray(input.armorTraining)) {
    throw new TypeError("Armor training must be an array.");
  }
  if (typeof input.shieldTraining !== "boolean") {
    throw new TypeError("Shield training must be boolean.");
  }
  for (const ability of ABILITIES) {
    assertAbilityScore(input.abilityScores?.[ability], ability.toUpperCase() + " score");
  }

  const dexterityModifier = calculateAbilityModifier(input.abilityScores.dex);
  const strengthScore = input.abilityScores.str;
  const otherBonus = input.otherBonus ?? 0;
  assertInteger(otherBonus, "Other Armor Class bonus");

  const issues: ArmorClassIssue[] = [];
  const seenInstanceIds = new Set<string>();
  const protectiveItems: ResolvedArmorProfile[] = [];

  for (const entry of input.equipment) {
    if (!entry || typeof entry !== "object") {
      throw new TypeError("Equipment entries must be objects.");
    }
    if (typeof entry.instanceId !== "string" || !entry.instanceId.trim()) {
      throw new TypeError("Equipment instance ID must be non-empty.");
    }
    if (seenInstanceIds.has(entry.instanceId)) {
      throw new RangeError("Duplicate equipment instance ID: " + entry.instanceId);
    }
    seenInstanceIds.add(entry.instanceId);

    if (typeof entry.equipped !== "boolean") {
      throw new TypeError("Equipment equipped state must be boolean.");
    }
    if (!entry.equipped) continue;

    const definition = entry.definition;
    if (!definition || typeof definition !== "object") {
      throw new TypeError("Equipped equipment requires an item definition.");
    }
    const profile = profileFor(definition);
    if (!profile) continue;

    if (!isRulesetCompatible(definition.ruleset, input.ruleset)) {
      issues.push({
        code: "incompatible-ruleset-item",
        message:
          definition.name +
          " is " +
          definition.ruleset +
          " content and is not equipped for a " +
          input.ruleset +
          " character.",
      });
      continue;
    }

    protectiveItems.push(
      resolveProtectiveItem(entry.instanceId, definition, profile),
    );
  }

  const armors = protectiveItems.filter((entry) => entry.kind === "armor");
  const shields = protectiveItems.filter((entry) => entry.kind === "shield");
  if (armors.length > 1) {
    throw new RangeError("Only one armor item can be equipped at a time.");
  }
  if (shields.length > 1) {
    throw new RangeError("Only one shield can be equipped at a time.");
  }

  const armor = armors[0];
  const shield = shields[0];
  let baseAC: number;
  let dexterityContribution: number;
  let defenseMode: ArmorClassResult["defenseMode"] = "unarmored";
  let armorProficient: boolean | undefined;
  let stealthDisadvantage = false;
  let speedPenalty = 0;

  if (armor) {
    const profile = armor.profile;
    defenseMode = "armor";
    dexterityContribution =
      profile.dexterity === "full"
        ? dexterityModifier
        : profile.dexterity === "capped"
          ? Math.min(dexterityModifier, profile.maxDexterityModifier)
          : 0;
    baseAC = profile.baseAC + dexterityContribution;
    stealthDisadvantage = profile.stealthDisadvantage;
    const category = profile.armorCategory as ArmorTrainingCategory;
    armorProficient = hasArmorTraining(input.armorTraining, category);

    if (!armorProficient) {
      issues.push({
        code: "armor-not-proficient",
        message: "The character lacks training with the equipped " + category + " armor.",
      });
    }
    if (
      profile.strengthRequirement !== undefined &&
      strengthScore < profile.strengthRequirement
    ) {
      speedPenalty = 10;
    }
  } else {
    const unarmoredDefense = input.unarmoredDefense;
    const shieldBlocksDefense =
      !!shield && !!unarmoredDefense && !unarmoredDefense.allowsShield;

    if (unarmoredDefense && shieldBlocksDefense) {
      issues.push({
        code: "unarmored-defense-requires-no-shield",
        message: "This Unarmored Defense feature cannot be used while wielding a shield.",
      });
    }

    if (unarmoredDefense && !shieldBlocksDefense) {
      if (!ABILITIES.includes(unarmoredDefense.ability)) {
        throw new RangeError("Unknown Unarmored Defense ability.");
      }
      if (typeof unarmoredDefense.allowsShield !== "boolean") {
        throw new TypeError("Unarmored Defense shield policy must be boolean.");
      }
      defenseMode = "unarmored-defense";
      dexterityContribution = dexterityModifier;
      baseAC =
        10 +
        dexterityModifier +
        calculateAbilityModifier(input.abilityScores[unarmoredDefense.ability]);
    } else {
      dexterityContribution = dexterityModifier;
      baseAC = 10 + dexterityModifier;
    }
  }

  let shieldBonus = 0;
  let shieldProficient: boolean | undefined;
  if (shield) {
    shieldProficient = input.shieldTraining;
    if (input.ruleset === "2014" || shieldProficient) {
      shieldBonus = shield.profile.baseAC;
    }
    if (!shieldProficient) {
      issues.push({
        code: "shield-not-proficient",
        message:
          input.ruleset === "2014"
            ? "The shield grants its AC bonus, but the character lacks shield training."
            : "The shield AC benefit requires shield training in the 2024 ruleset.",
      });
    }
  }

  return {
    total: baseAC + shieldBonus + otherBonus,
    baseAC,
    dexterityModifier,
    dexterityContribution,
    shieldBonus,
    otherBonus,
    defenseMode,
    ...(armor ? { armorInstanceId: armor.instanceId } : {}),
    ...(shield ? { shieldInstanceId: shield.instanceId } : {}),
    ...(armor ? { armorProficient } : {}),
    ...(shield ? { shieldProficient } : {}),
    stealthDisadvantage,
    speedPenalty,
    issues,
  };
}
