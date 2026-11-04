import type { Ability, ContentRuleset } from "../domain/types";
import type { ItemDefinition, WeaponProfile } from "../domain/item";
import type {
  WeaponAttackInput,
  WeaponAttackIssue,
  WeaponAttackResult,
  WeaponProficiency,
  WeaponAttackDisadvantageReason,
  CreatureSize,
} from "../domain/combat";
import { calculateAbilityModifier } from "./character-calculation-engine";

const ABILITIES: readonly Ability[] = ["str", "dex", "con", "int", "wis", "cha"];

function assertInteger(value: number, label: string): void {
  if (!Number.isInteger(value)) throw new RangeError(label + " must be an integer.");
}

function assertAbilityScores(scores: Record<Ability, number>): void {
  if (!scores || typeof scores !== "object" || Array.isArray(scores)) {
    throw new TypeError("Ability scores must be a record.");
  }
  for (const ability of ABILITIES) {
    const score = scores[ability];
    if (!Number.isInteger(score) || score < 1 || score > 30) {
      throw new RangeError(ability.toUpperCase() + " score must be an integer from 1 to 30.");
    }
  }
}

function getWeaponProfile(definition: ItemDefinition): WeaponProfile | undefined {
  if (definition.category === "weapon" || definition.category === "magic-item") {
    return definition.weaponProfile;
  }
  return undefined;
}

function isRulesetCompatible(itemRuleset: ContentRuleset, ruleset: "2014" | "2024"): boolean {
  return itemRuleset === "shared" || itemRuleset === ruleset;
}

function validateWeaponProficiencies(
  proficiencies: readonly WeaponProficiency[],
): void {
  if (!Array.isArray(proficiencies)) {
    throw new TypeError("Weapon proficiencies must be an array.");
  }
  for (const proficiency of proficiencies) {
    if (!proficiency || typeof proficiency !== "object") {
      throw new TypeError("Weapon proficiency entries must be objects.");
    }
    if (proficiency.kind === "category") {
      if (proficiency.category !== "simple" && proficiency.category !== "martial") {
        throw new RangeError("Unknown weapon proficiency category.");
      }
    } else if (proficiency.kind === "weapon") {
      if (typeof proficiency.weaponId !== "string" || !proficiency.weaponId.trim()) {
        throw new TypeError("Weapon-specific proficiency requires a non-empty weaponId.");
      }
    } else {
      throw new RangeError("Unknown weapon proficiency kind.");
    }
  }
}

function hasWeaponProficiency(
  definition: ItemDefinition,
  profile: WeaponProfile,
  proficiencies: readonly WeaponProficiency[],
): boolean {
  return proficiencies.some((proficiency) => {
    if (proficiency.kind === "category") {
      return proficiency.category === profile.weaponCategory;
    }
    return proficiency.weaponId === definition.id ||
      (definition.baseItemId !== undefined && proficiency.weaponId === definition.baseItemId);
  });
}

function displayFormula(formula: string, modifier: number): string {
  if (modifier > 0) return formula + " + " + modifier;
  if (modifier < 0) return formula + " - " + Math.abs(modifier);
  return formula;
}

/**
 * Resolves a weapon attack snapshot. Melee weapons use Strength by default
 * and ranged weapons use Dexterity. Finesse permits an explicit Strength or
 * Dexterity choice on either weapon type; absent a choice, the higher modifier
 * is selected. A Thrown melee weapon retains the melee ability rule.
 *
 * Proficiency is added only when a category or exact/base-item grant matches.
 * The damage modifier is applied once to the first (primary) damage component.
 */
export function calculateWeaponAttack(input: WeaponAttackInput): WeaponAttackResult {
  if (!input || typeof input !== "object") {
    throw new TypeError("Weapon attack input is required.");
  }
  if (input.ruleset !== "2014" && input.ruleset !== "2024") {
    throw new RangeError("Weapon attack ruleset must be 2014 or 2024.");
  }
  assertAbilityScores(input.abilityScores);

  if (!input.weapon || typeof input.weapon !== "object") {
    throw new TypeError("Weapon equipment entry is required.");
  }
  if (typeof input.weapon.instanceId !== "string" || !input.weapon.instanceId.trim()) {
    throw new TypeError("Weapon instance ID must be non-empty.");
  }
  if (typeof input.weapon.equipped !== "boolean") {
    throw new TypeError("Weapon equipped state must be boolean.");
  }
  const definition = input.weapon.definition;
  if (!definition || typeof definition !== "object") {
    throw new TypeError("Weapon equipment requires an item definition.");
  }
  const profile = getWeaponProfile(definition);
  if (!profile) {
    throw new TypeError("Item definition does not contain a weapon profile.");
  }
  if (profile.weaponCategory !== "simple" && profile.weaponCategory !== "martial") {
    throw new RangeError("Unknown weapon category.");
  }
  if (profile.weaponType !== "melee" && profile.weaponType !== "ranged") {
    throw new RangeError("Unknown weapon type.");
  }
  if (!Array.isArray(profile.damage) || profile.damage.length === 0) {
    throw new TypeError("Weapon profile requires at least one damage component.");
  }
  profile.damage.forEach((component) => {
    if (!component || typeof component.formula !== "string" || !component.formula.trim()) {
      throw new TypeError("Weapon damage formulas must be non-empty strings.");
    }
    if (typeof component.damageType !== "string" || !component.damageType.trim()) {
      throw new TypeError("Weapon damage types must be non-empty strings.");
    }
    if (
      component.versatileFormula !== undefined &&
      (typeof component.versatileFormula !== "string" || !component.versatileFormula.trim())
    ) {
      throw new TypeError("Versatile damage formulas must be non-empty strings.");
    }
  });

  const proficiencyBonus = input.proficiencyBonus;
  if (!Number.isInteger(proficiencyBonus) || proficiencyBonus < 0 || proficiencyBonus > 6) {
    throw new RangeError("Proficiency bonus must be an integer from 0 to 6.");
  }
  const attackBonusAdjustment = input.attackBonus ?? 0;
  const damageBonus = input.damageBonus ?? 0;
  assertInteger(attackBonusAdjustment, "Additional attack bonus");
  assertInteger(damageBonus, "Additional damage bonus");

  const grip = input.grip ?? "one-handed";
  if (grip !== "one-handed" && grip !== "two-handed") {
    throw new RangeError("Weapon grip must be one-handed or two-handed.");
  }
  const abilityModifierDamageMode = input.abilityModifierDamageMode ?? "normal";
  if (
    abilityModifierDamageMode !== "normal" &&
    abilityModifierDamageMode !== "none" &&
    abilityModifierDamageMode !== "negative-only"
  ) {
    throw new RangeError("Unknown ability modifier damage mode.");
  }

  const proficiencies = input.weaponProficiencies ?? [];
  validateWeaponProficiencies(proficiencies);

  if (
    definition.properties !== undefined &&
    (!Array.isArray(definition.properties) ||
      definition.properties.some((property) => typeof property !== "string"))
  ) {
    throw new TypeError("Weapon properties must be an array of strings.");
  }
  const properties = new Set(definition.properties ?? []);
  if (properties.has("versatile") && profile.weaponType !== "melee") {
    throw new RangeError("Versatile property requires a melee weapon.");
  }
  const strengthModifier = calculateAbilityModifier(input.abilityScores.str);
  const dexterityModifier = calculateAbilityModifier(input.abilityScores.dex);
  const hasFinesse = properties.has("finesse");

  if (input.abilityChoice !== undefined && input.abilityChoice !== "str" && input.abilityChoice !== "dex") {
    throw new RangeError("Finesse ability choice must be Strength or Dexterity.");
  }
  if (input.abilityChoice !== undefined && !hasFinesse) {
    throw new RangeError("An explicit ability choice is only valid for a Finesse weapon.");
  }

  let ability: Ability;
  if (hasFinesse) {
    ability =
      input.abilityChoice ??
      (dexterityModifier > strengthModifier ? "dex" : "str");
  } else {
    ability = profile.weaponType === "ranged" ? "dex" : "str";
  }
  const abilityModifier = calculateAbilityModifier(input.abilityScores[ability]);

  const proficient = hasWeaponProficiency(definition, profile, proficiencies);
  const proficiencyContribution = proficient ? proficiencyBonus : 0;
  const issues: WeaponAttackIssue[] = [];
  const heavyWeaponDisadvantageReasons: WeaponAttackDisadvantageReason[] = [];
  let canAttack = true;

  if (!input.weapon.equipped) {
    canAttack = false;
    issues.push({
      code: "weapon-not-equipped",
      message: definition.name + " is not equipped.",
    });
  }
  if (!isRulesetCompatible(definition.ruleset, input.ruleset)) {
    canAttack = false;
    issues.push({
      code: "incompatible-ruleset-item",
      message:
        definition.name + " is " + definition.ruleset +
        " content and is not usable by a " + input.ruleset + " character.",
    });
  }
  if (properties.has("two-handed") && grip !== "two-handed") {
    canAttack = false;
    issues.push({
      code: "weapon-requires-two-hands",
      message: definition.name + " requires a two-handed grip.",
    });
  }

  // Heavy is distinct from Two-Handed. Its attack penalty changed between editions.
  if (properties.has("heavy")) {
    if (input.ruleset === "2014") {
      const validSizes: readonly CreatureSize[] = [
        "tiny", "small", "medium", "large", "huge", "gargantuan",
      ];
      if (input.creatureSize === undefined) {
        throw new TypeError("Creature size is required to resolve the 2014 Heavy weapon rule.");
      }
      if (!validSizes.includes(input.creatureSize)) {
        throw new RangeError("Unknown creature size.");
      }
      if (input.creatureSize === "tiny" || input.creatureSize === "small") {
        heavyWeaponDisadvantageReasons.push("heavy-weapon-size");
      }
    } else {
      const requiredAbilityScore =
        profile.weaponType === "melee"
          ? input.abilityScores.str
          : input.abilityScores.dex;
      if (requiredAbilityScore < 13) {
        heavyWeaponDisadvantageReasons.push("heavy-weapon-ability-score");
      }
    }
  }
  if (!proficient) {
    issues.push({
      code: "weapon-not-proficient",
      message: "The character is not proficient with " + definition.name + "; proficiency bonus is not added.",
    });
  }

  const abilityDamageModifier =
    abilityModifierDamageMode === "normal"
      ? abilityModifier
      : abilityModifierDamageMode === "negative-only"
        ? Math.min(abilityModifier, 0)
        : 0;
  const damageModifier = abilityDamageModifier + damageBonus;
  const damage = profile.damage.map((component, index) => {
    let formula = component.formula;
    if (index === 0 && grip === "two-handed" && properties.has("versatile")) {
      if (component.versatileFormula && component.versatileFormula.trim()) {
        formula = component.versatileFormula;
      } else {
        issues.push({
          code: "missing-versatile-damage",
          message:
            definition.name + " is Versatile but its primary damage component has no versatileFormula.",
        });
      }
    }
    const modifier = index === 0 ? damageModifier : 0;
    return {
      formula,
      damageType: component.damageType,
      modifier,
      displayFormula: displayFormula(formula, modifier),
      primary: index === 0,
    };
  });

  return {
    canAttack,
    weaponInstanceId: input.weapon.instanceId,
    ability,
    abilityModifier,
    proficient,
    proficiencyContribution,
    attackBonus: abilityModifier + proficiencyContribution + attackBonusAdjustment,
    damageModifier,
    hasHeavyWeaponDisadvantage: heavyWeaponDisadvantageReasons.length > 0,
    heavyWeaponDisadvantageReasons,
    grip,
    damage,
    issues,
  };
}
