import type { ContentRuleset } from "../domain/types";
import type { ArmorProfile, ItemDefinition } from "../domain/item";
import {
  type ArmorTrainingCategory,
  type ArmorTrainingConsequenceInput,
  type ArmorTrainingConsequenceIssue,
  type ArmorTrainingConsequenceResult,
  type EquipmentCalculationEntry,
} from "../domain/equipment";

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

function isRulesetCompatible(
  itemRuleset: ContentRuleset,
  ruleset: "2014" | "2024",
): boolean {
  return itemRuleset === "shared" || itemRuleset === ruleset;
}

function isArmorTrainingCategory(value: unknown): value is ArmorTrainingCategory {
  return value === "light" || value === "medium" || value === "heavy";
}

function assertProtectiveProfile(
  entry: EquipmentCalculationEntry,
  profile: ArmorProfile,
): "armor" | "shield" {
  if (
    profile.armorCategory !== "light" &&
    profile.armorCategory !== "medium" &&
    profile.armorCategory !== "heavy" &&
    profile.armorCategory !== "shield"
  ) {
    throw new RangeError("Unknown armor category on " + entry.definition.name + ".");
  }
  if (entry.definition.category === "armor" && profile.armorCategory === "shield") {
    throw new TypeError("An armor item cannot use a shield armor profile.");
  }
  if (entry.definition.category === "shield" && profile.armorCategory !== "shield") {
    throw new TypeError("A shield item must use a shield armor profile.");
  }
  return profile.armorCategory === "shield" ? "shield" : "armor";
}

function validateEquipmentShape(
  equipment: readonly EquipmentCalculationEntry[],
): void {
  const seen = new Set<string>();
  for (const entry of equipment) {
    if (!entry || typeof entry !== "object") {
      throw new TypeError("Equipment entries must be objects.");
    }
    if (typeof entry.instanceId !== "string" || !entry.instanceId.trim()) {
      throw new TypeError("Equipment instance ID must be non-empty.");
    }
    if (seen.has(entry.instanceId)) {
      throw new RangeError("Duplicate equipment instance ID: " + entry.instanceId);
    }
    seen.add(entry.instanceId);
    if (typeof entry.equipped !== "boolean") {
      throw new TypeError("Equipment equipped state must be boolean.");
    }
    if (entry.equipped && (!entry.definition || typeof entry.definition !== "object")) {
      throw new TypeError("Equipped equipment requires an item definition.");
    }
  }
}

/**
 * Resolves untrained armor / shield consequences for both editions.
 *
 * 2014: untrained armor OR an untrained shield imposes Disadvantage on
 * STR/DEX ability checks, saving throws, and attack rolls, and prevents
 * spellcasting. The untrained shield still grants its AC bonus in the
 * separate Armor Class engine.
 *
 * 2024: untrained Light/Medium/Heavy armor imposes Disadvantage on any
 * STR/DEX D20 Test and prevents spellcasting. An untrained Shield only
 * loses its AC benefit; it does not impose those other drawbacks.
 */
export function calculateArmorTrainingConsequences(
  input: ArmorTrainingConsequenceInput,
): ArmorTrainingConsequenceResult {
  if (!input || typeof input !== "object") {
    throw new TypeError("Armor training consequence input is required.");
  }
  if (input.ruleset !== "2014" && input.ruleset !== "2024") {
    throw new RangeError("Armor training ruleset must be 2014 or 2024.");
  }
  if (!Array.isArray(input.equipment)) {
    throw new TypeError("Equipment must be an array.");
  }
  if (!Array.isArray(input.armorTraining)) {
    throw new TypeError("Armor training must be an array.");
  }
  if (input.armorTraining.some((category) => !isArmorTrainingCategory(category))) {
    throw new RangeError("Unknown armor training category.");
  }
  if (new Set(input.armorTraining).size !== input.armorTraining.length) {
    throw new RangeError("Armor training categories must be unique.");
  }
  if (typeof input.shieldTraining !== "boolean") {
    throw new TypeError("Shield training must be boolean.");
  }

  validateEquipmentShape(input.equipment);

  const issues: ArmorTrainingConsequenceIssue[] = [];
  const wornArmors: Array<{
    instanceId: string;
    definition: ItemDefinition;
    category: ArmorTrainingCategory;
  }> = [];
  const wieldedShields: Array<{
    instanceId: string;
    definition: ItemDefinition;
  }> = [];

  for (const entry of input.equipment) {
    if (!entry.equipped) continue;
    const profile = profileFor(entry.definition);
    if (!profile) continue;

    if (!isRulesetCompatible(entry.definition.ruleset, input.ruleset)) {
      issues.push({
        code: "incompatible-ruleset-item",
        instanceId: entry.instanceId,
        message:
          entry.definition.name + " is " + entry.definition.ruleset +
          " content and is not compatible with a " + input.ruleset + " character.",
      });
      continue;
    }

    const kind = assertProtectiveProfile(entry, profile);
    if (kind === "shield") {
      wieldedShields.push({ instanceId: entry.instanceId, definition: entry.definition });
    } else {
      wornArmors.push({
        instanceId: entry.instanceId,
        definition: entry.definition,
        category: profile.armorCategory as ArmorTrainingCategory,
      });
    }
  }

  if (wornArmors.length > 1) {
    throw new RangeError("Only one armor item can be equipped at a time.");
  }
  if (wieldedShields.length > 1) {
    throw new RangeError("Only one shield can be equipped at a time.");
  }

  const untrainedArmor = wornArmors.filter(
    (armor) => !input.armorTraining.includes(armor.category),
  );
  const untrainedShields = input.shieldTraining ? [] : wieldedShields;

  for (const armor of untrainedArmor) {
    issues.push({
      code: "armor-not-proficient",
      instanceId: armor.instanceId,
      message:
        "The character lacks training with the equipped " + armor.category + " armor.",
    });
  }
  for (const shield of untrainedShields) {
    issues.push({
      code: "shield-not-proficient",
      instanceId: shield.instanceId,
      message: "The character lacks training with the equipped shield.",
    });
  }

  const hasUntrainedArmor = untrainedArmor.length > 0;
  const hasUntrainedShield = untrainedShields.length > 0;
  const untrainedShieldHas2014Consequences =
    input.ruleset === "2014" && hasUntrainedShield;

  const disadvantageOnStrengthDexterityD20Tests =
    hasUntrainedArmor || untrainedShieldHas2014Consequences;
  const cannotCastSpells =
    hasUntrainedArmor || untrainedShieldHas2014Consequences;
  const shieldACBenefitDenied =
    input.ruleset === "2024" && hasUntrainedShield;

  return {
    untrainedArmorInstanceIds: untrainedArmor.map((armor) => armor.instanceId),
    untrainedArmorCategories: untrainedArmor.map((armor) => armor.category),
    untrainedShieldInstanceIds: untrainedShields.map((shield) => shield.instanceId),
    disadvantageOnStrengthDexterityD20Tests,
    cannotCastSpells,
    shieldACBenefitDenied,
    issues,
  };
}
