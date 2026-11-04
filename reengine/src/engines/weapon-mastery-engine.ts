import type { ProgressionValue, SelectionMechanic, ContentRuleset } from "../domain/types";
import type { ItemDefinition, WeaponMasteryId } from "../domain/item";
import type { WeaponProficiency } from "../domain/combat";

export type WeaponMasteryClassId = "barbarian" | "fighter" | "paladin" | "ranger" | "rogue";

export interface WeaponMasteryClassPolicy {
  classId: WeaponMasteryClassId;
  initialChoices: number;
  capacitySource: "class-progression" | "fixed";
  weaponType: "melee" | "any";
  requiresWeaponProficiency: boolean;
  replacement: { when: "long-rest"; count: number };
}

export const WEAPON_MASTERY_CLASS_POLICIES: Record<WeaponMasteryClassId, WeaponMasteryClassPolicy> = {
  barbarian: {
    classId: "barbarian", initialChoices: 2, capacitySource: "class-progression",
    weaponType: "melee", requiresWeaponProficiency: false,
    replacement: { when: "long-rest", count: 1 },
  },
  fighter: {
    classId: "fighter", initialChoices: 3, capacitySource: "class-progression",
    weaponType: "any", requiresWeaponProficiency: false,
    replacement: { when: "long-rest", count: 1 },
  },
  paladin: {
    classId: "paladin", initialChoices: 2, capacitySource: "fixed",
    weaponType: "any", requiresWeaponProficiency: true,
    replacement: { when: "long-rest", count: 2 },
  },
  ranger: {
    classId: "ranger", initialChoices: 2, capacitySource: "fixed",
    weaponType: "any", requiresWeaponProficiency: true,
    replacement: { when: "long-rest", count: 2 },
  },
  rogue: {
    classId: "rogue", initialChoices: 2, capacitySource: "fixed",
    weaponType: "any", requiresWeaponProficiency: true,
    replacement: { when: "long-rest", count: 2 },
  },
};

export function getWeaponMasteryClassPolicy(classId: string): WeaponMasteryClassPolicy | undefined {
  return WEAPON_MASTERY_CLASS_POLICIES[classId as WeaponMasteryClassId];
}

export function createWeaponMasterySelectionMechanic(input: {
  classId: WeaponMasteryClassId;
  id: string;
  optionSetId: string;
  classProgressionCount?: ProgressionValue;
}): SelectionMechanic {
  const policy = WEAPON_MASTERY_CLASS_POLICIES[input.classId];
  let count: ProgressionValue;
  if (policy.capacitySource === "fixed") {
    count = { kind: "fixed", value: policy.initialChoices };
  } else {
    if (!input.classProgressionCount) {
      throw new TypeError(input.classId + " Weapon Mastery requires its class-progression count.");
    }
    count = input.classProgressionCount;
  }
  return {
    kind: "selection",
    id: input.id,
    optionSetId: input.optionSetId,
    mode: "multiple",
    count,
    replacement: policy.replacement,
  };
}

function isRulesetCompatible(itemRuleset: ContentRuleset): boolean {
  return itemRuleset === "2024";
}

function hasWeaponProficiency(
  weapon: Extract<ItemDefinition, { category: "weapon" }>,
  proficiencies: readonly WeaponProficiency[],
): boolean {
  return proficiencies.some((proficiency) => {
    if (proficiency.kind === "category") {
      return proficiency.category === weapon.weaponProfile.weaponCategory;
    }
    return proficiency.weaponId === weapon.id ||
      (weapon.baseItemId !== undefined && proficiency.weaponId === weapon.baseItemId);
  });
}

export function getEligibleWeaponMasteryWeapons(input: {
  ruleset: "2014" | "2024";
  classId: WeaponMasteryClassId;
  weapons: readonly ItemDefinition[];
  weaponProficiencies?: readonly WeaponProficiency[];
}): Extract<ItemDefinition, { category: "weapon" }>[] {
  if (input.ruleset !== "2024") return [];
  const policy = WEAPON_MASTERY_CLASS_POLICIES[input.classId];
  const proficiencies = input.weaponProficiencies ?? [];
  return input.weapons.filter((item): item is Extract<ItemDefinition, { category: "weapon" }> => {
    if (item.category !== "weapon") return false;
    if (!isRulesetCompatible(item.ruleset) || !item.weaponProfile.mastery) return false;
    if (policy.weaponType === "melee" && item.weaponProfile.weaponType !== "melee") return false;
    if (policy.requiresWeaponProficiency && !hasWeaponProficiency(item, proficiencies)) return false;
    return true;
  });
}

export type WeaponMasterySelectionIssueCode =
  | "weapon-mastery-ruleset"
  | "weapon-mastery-selection-count"
  | "duplicate-weapon-mastery-choice"
  | "unknown-weapon-mastery-choice"
  | "ineligible-weapon-mastery-choice";

export interface WeaponMasterySelectionIssue {
  code: WeaponMasterySelectionIssueCode;
  message: string;
  subjectId?: string;
}
export interface WeaponMasterySelectionResult {
  valid: boolean;
  eligibleWeaponIds: string[];
  issues: WeaponMasterySelectionIssue[];
}

export function validateWeaponMasterySelection(input: {
  ruleset: "2014" | "2024";
  classId: WeaponMasteryClassId;
  selectedWeaponIds: readonly string[];
  maximumSelections: number;
  weapons: readonly ItemDefinition[];
  weaponProficiencies?: readonly WeaponProficiency[];
  mode?: "draft" | "complete";
}): WeaponMasterySelectionResult {
  if (!input || typeof input !== "object") throw new TypeError("Weapon Mastery selection input is required.");
  if (!Array.isArray(input.selectedWeaponIds)) throw new TypeError("Selected Weapon Mastery IDs must be an array.");
  if (!Number.isInteger(input.maximumSelections) || input.maximumSelections < 0) {
    throw new RangeError("Maximum Weapon Mastery selections must be a non-negative integer.");
  }
  const mode = input.mode ?? "complete";
  if (mode !== "draft" && mode !== "complete") throw new RangeError("Unknown Weapon Mastery selection mode.");
  for (const id of input.selectedWeaponIds) {
    if (typeof id !== "string" || !id.trim()) throw new TypeError("Weapon Mastery selection IDs must be non-empty strings.");
  }

  const eligibleWeapons = getEligibleWeaponMasteryWeapons({
    ruleset: input.ruleset,
    classId: input.classId,
    weapons: input.weapons,
    weaponProficiencies: input.weaponProficiencies,
  });
  const eligibleIds = new Set(eligibleWeapons.map((weapon) => weapon.id));
  const allWeaponIds = new Set(input.weapons
    .filter((item): item is Extract<ItemDefinition, { category: "weapon" }> => item.category === "weapon")
    .map((weapon) => weapon.id));
  const issues: WeaponMasterySelectionIssue[] = [];

  if (input.ruleset !== "2024") {
    issues.push({
      code: "weapon-mastery-ruleset",
      message: "Weapon Mastery selection is only available in the 2024 ruleset.",
    });
  }
  const counts = new Map<string, number>();
  for (const id of input.selectedWeaponIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  if (input.selectedWeaponIds.length > input.maximumSelections ||
      (mode === "complete" && input.selectedWeaponIds.length !== input.maximumSelections)) {
    issues.push({
      code: "weapon-mastery-selection-count",
      message: "Choose " + (mode === "draft" ? "up to " : "exactly ") +
        input.maximumSelections + " weapon type(s); currently selected: " + input.selectedWeaponIds.length + ".",
    });
  }
  for (const [id, count] of counts) {
    if (count > 1) {
      issues.push({
        code: "duplicate-weapon-mastery-choice",
        message: "Weapon type " + id + " cannot be selected more than once.",
        subjectId: id,
      });
    }
    if (!allWeaponIds.has(id)) {
      issues.push({
        code: "unknown-weapon-mastery-choice",
        message: "Weapon type " + id + " does not exist in the canonical weapon list.",
        subjectId: id,
      });
    } else if (!eligibleIds.has(id)) {
      issues.push({
        code: "ineligible-weapon-mastery-choice",
        message: "Weapon type " + id + " is not eligible for this class's Weapon Mastery feature.",
        subjectId: id,
      });
    }
  }
  return { valid: issues.length === 0, eligibleWeaponIds: [...eligibleIds], issues };
}

export type WeaponMasteryAvailabilityReason =
  | "wrong-ruleset"
  | "missing-feature"
  | "weapon-has-no-mastery"
  | "weapon-not-selected"
  | "incompatible-ruleset-item";
export interface WeaponMasteryAvailabilityResult {
  available: boolean;
  mastery: WeaponMasteryId | null;
  reason?: WeaponMasteryAvailabilityReason;
}

export function resolveWeaponMasteryAvailability(input: {
  ruleset: "2014" | "2024";
  weapon: ItemDefinition;
  /** Canonical weapon definition linked by baseItemId, when weapon is a magic-item instance. */
  baseWeapon?: ItemDefinition;
  ownsWeaponMasteryFeature: boolean;
  selectedWeaponIds: readonly string[];
}): WeaponMasteryAvailabilityResult {
  if (!input || typeof input !== "object") throw new TypeError("Weapon Mastery availability input is required.");
  if (typeof input.ownsWeaponMasteryFeature !== "boolean") {
    throw new TypeError("Weapon Mastery feature ownership must be boolean.");
  }
  if (!Array.isArray(input.selectedWeaponIds)) {
    throw new TypeError("Selected Weapon Mastery IDs must be an array.");
  }
  if (input.ruleset !== "2024") return { available: false, mastery: null, reason: "wrong-ruleset" };
  if (!isRulesetCompatible(input.weapon.ruleset)) {
    return { available: false, mastery: null, reason: "incompatible-ruleset-item" };
  }
  if (!input.ownsWeaponMasteryFeature) return { available: false, mastery: null, reason: "missing-feature" };

  const profile = input.weapon.category === "weapon" || input.weapon.category === "magic-item"
    ? input.weapon.weaponProfile
    : undefined;
  const baseProfile =
    input.baseWeapon?.category === "weapon" &&
    input.weapon.baseItemId === input.baseWeapon.id &&
    input.baseWeapon.ruleset === "2024"
      ? input.baseWeapon.weaponProfile
      : undefined;
  const mastery = profile?.mastery ?? baseProfile?.mastery ?? null;
  if (!mastery) return { available: false, mastery: null, reason: "weapon-has-no-mastery" };
  const selected = input.selectedWeaponIds.some((id) =>
    id === input.weapon.id ||
    (input.weapon.baseItemId !== undefined && id === input.weapon.baseItemId) ||
    (input.baseWeapon !== undefined && id === input.baseWeapon.id),
  );
  if (!selected) return { available: false, mastery, reason: "weapon-not-selected" };
  return { available: true, mastery };
}
