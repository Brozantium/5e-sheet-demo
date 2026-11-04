import type { Ruleset } from "../domain/types";
import type { EquipmentCalculationEntry } from "../domain/equipment";
import type { WeaponAttackMode } from "../domain/combat";
import type { WeaponProfile } from "../domain/item";

export type LightExtraAttackTiming = "bonus-action" | "attack-action";

export type LightExtraAttackIssueCode =
  | "attack-action-not-taken"
  | "primary-weapon-not-light"
  | "extra-weapon-not-light"
  | "same-weapon-instance"
  | "extra-weapon-unavailable"
  | "2014-requires-melee-weapons"
  | "2014-requires-other-hand"
  | "extra-attack-already-used"
  | "bonus-action-unavailable"
  | "extra-weapon-mode-not-supported"
  | "incompatible-ruleset-item";

export interface LightExtraAttackInput {
  ruleset: Ruleset;
  /** The Light weapon used for an attack as part of this turn's Attack action. */
  primaryWeapon: EquipmentCalculationEntry;
  /** A different Light weapon used for the additional attack. */
  extraWeapon: EquipmentCalculationEntry;
  attackActionTakenThisTurn: boolean;
  extraAttackAlreadyUsedThisTurn: boolean;
  bonusActionAvailable: boolean;
  /** Resolved by the caller: this weapon can be drawn, held, or otherwise used now. */
  extraWeaponAvailable: boolean;
  /** 2014 requires the extra Light melee weapon to be held in the other hand. */
  extraWeaponHeldInOtherHand?: boolean;
  /** True only when Nick is unlocked and selected for the extra weapon. */
  nickMasteryAvailableForExtraWeapon?: boolean;
  extraAttackMode: WeaponAttackMode;
}

export interface LightExtraAttackIssue {
  code: LightExtraAttackIssueCode;
  message: string;
}

export interface LightExtraAttackResult {
  canMakeExtraAttack: boolean;
  timing: LightExtraAttackTiming | null;
  /** Light/TWF extra attacks omit a positive ability modifier but retain a negative one. */
  abilityModifierDamageMode: "negative-only";
  issues: LightExtraAttackIssue[];
}

function getWeaponProfile(
  entry: EquipmentCalculationEntry,
): WeaponProfile | undefined {
  const definition = entry.definition;
  if (definition.category === "weapon" || definition.category === "magic-item") {
    return definition.weaponProfile;
  }
  return undefined;
}

function isRulesetCompatible(
  itemRuleset: "2014" | "2024" | "shared",
  ruleset: Ruleset,
): boolean {
  return itemRuleset === "shared" || itemRuleset === ruleset;
}

function assertBoolean(value: unknown, label: string): asserts value is boolean {
  if (typeof value !== "boolean") {
    throw new TypeError(label + " must be boolean.");
  }
}

/**
 * Validates the Light-property extra-attack trigger and action placement.
 *
 * 2014: both weapons must be Light melee weapons, the extra weapon must be
 * held in the other hand, and the extra attack uses a Bonus Action.
 *
 * 2024: both weapons must be different Light weapons. Nick, when already
 * unlocked and selected for the extra weapon, moves the extra attack into
 * the Attack action instead of consuming a Bonus Action.
 *
 * The caller owns turn state and commits the accepted attack. This helper
 * validates a snapshot only; it does not roll, consume an action, or mutate
 * inventory. The returned damage mode can be passed to calculateWeaponAttack.
 */
export function validateLightWeaponExtraAttack(
  input: LightExtraAttackInput,
): LightExtraAttackResult {
  if (!input || typeof input !== "object") {
    throw new TypeError("Light extra-attack input is required.");
  }
  if (input.ruleset !== "2014" && input.ruleset !== "2024") {
    throw new RangeError("Light extra-attack ruleset must be 2014 or 2024.");
  }

  assertBoolean(input.attackActionTakenThisTurn, "Attack-action state");
  assertBoolean(input.extraAttackAlreadyUsedThisTurn, "Extra-attack state");
  assertBoolean(input.bonusActionAvailable, "Bonus Action availability");
  assertBoolean(input.extraWeaponAvailable, "Extra weapon availability");
  if (input.extraWeaponHeldInOtherHand !== undefined) {
    assertBoolean(input.extraWeaponHeldInOtherHand, "Other-hand state");
  }
  const nickMasteryAvailable = input.nickMasteryAvailableForExtraWeapon ?? false;
  assertBoolean(nickMasteryAvailable, "Nick mastery availability");
  if (nickMasteryAvailable && input.ruleset !== "2024") {
    throw new RangeError("Nick mastery is only available in the 2024 ruleset.");
  }
  if (
    input.extraAttackMode !== "melee" &&
    input.extraAttackMode !== "ranged" &&
    input.extraAttackMode !== "thrown"
  ) {
    throw new RangeError("Unknown Light extra-attack mode.");
  }

  if (!input.primaryWeapon || !input.extraWeapon) {
    throw new TypeError("Primary and extra weapon entries are required.");
  }
  if (
    typeof input.primaryWeapon.instanceId !== "string" ||
    !input.primaryWeapon.instanceId.trim() ||
    typeof input.extraWeapon.instanceId !== "string" ||
    !input.extraWeapon.instanceId.trim()
  ) {
    throw new TypeError("Weapon instance IDs must be non-empty.");
  }
  if (!input.primaryWeapon.definition || !input.extraWeapon.definition) {
    throw new TypeError("Weapon entries require item definitions.");
  }
  if (
    typeof input.primaryWeapon.equipped !== "boolean" ||
    typeof input.extraWeapon.equipped !== "boolean"
  ) {
    throw new TypeError("Weapon equipped state must be boolean.");
  }

  const primaryDefinition = input.primaryWeapon.definition;
  const extraDefinition = input.extraWeapon.definition;
  for (const [definition, label] of [
    [primaryDefinition, "Primary"],
    [extraDefinition, "Extra"],
  ] as const) {
    if (
      definition.properties !== undefined &&
      (!Array.isArray(definition.properties) ||
        definition.properties.some((property) => typeof property !== "string"))
    ) {
      throw new TypeError(label + " weapon properties must be an array of strings.");
    }
  }

  const primaryProfile = getWeaponProfile(input.primaryWeapon);
  const extraProfile = getWeaponProfile(input.extraWeapon);
  if (!primaryProfile || !extraProfile) {
    throw new TypeError("Both entries must contain weapon profiles.");
  }

  const issues: LightExtraAttackIssue[] = [];
  let canMakeExtraAttack = true;

  if (!input.primaryWeapon.equipped) {
    canMakeExtraAttack = false;
    issues.push({
      code: "primary-weapon-not-light",
      message: primaryDefinition.name + " was not equipped for the triggering attack.",
    });
  }
  if (!isRulesetCompatible(primaryDefinition.ruleset, input.ruleset)) {
    canMakeExtraAttack = false;
    issues.push({
      code: "incompatible-ruleset-item",
      message: primaryDefinition.name + " is not compatible with the " + input.ruleset + " ruleset.",
    });
  }
  if (!isRulesetCompatible(extraDefinition.ruleset, input.ruleset)) {
    canMakeExtraAttack = false;
    issues.push({
      code: "incompatible-ruleset-item",
      message: extraDefinition.name + " is not compatible with the " + input.ruleset + " ruleset.",
    });
  }
  if (!input.attackActionTakenThisTurn) {
    canMakeExtraAttack = false;
    issues.push({
      code: "attack-action-not-taken",
      message: "The Light extra attack requires an Attack action on this turn.",
    });
  }
  if (!(primaryDefinition.properties ?? []).includes("light")) {
    canMakeExtraAttack = false;
    issues.push({
      code: "primary-weapon-not-light",
      message: primaryDefinition.name + " does not have the Light property.",
    });
  }
  if (!(extraDefinition.properties ?? []).includes("light")) {
    canMakeExtraAttack = false;
    issues.push({
      code: "extra-weapon-not-light",
      message: extraDefinition.name + " does not have the Light property.",
    });
  }
  if (input.primaryWeapon.instanceId === input.extraWeapon.instanceId) {
    canMakeExtraAttack = false;
    issues.push({
      code: "same-weapon-instance",
      message: "The Light extra attack must use a different weapon instance.",
    });
  }
  if (!input.extraWeaponAvailable || !input.extraWeapon.equipped) {
    canMakeExtraAttack = false;
    issues.push({
      code: "extra-weapon-unavailable",
      message: extraDefinition.name + " is not available for the extra attack.",
    });
  }
  if (input.extraAttackAlreadyUsedThisTurn) {
    canMakeExtraAttack = false;
    issues.push({
      code: "extra-attack-already-used",
      message: "The Light extra attack can be made only once per turn.",
    });
  }

  if (input.ruleset === "2014") {
    if (
      primaryProfile.weaponType !== "melee" ||
      extraProfile.weaponType !== "melee"
    ) {
      canMakeExtraAttack = false;
      issues.push({
        code: "2014-requires-melee-weapons",
        message: "2014 Two-Weapon Fighting requires two Light melee weapons.",
      });
    }
    if (input.extraWeaponHeldInOtherHand !== true) {
      canMakeExtraAttack = false;
      issues.push({
        code: "2014-requires-other-hand",
        message: "The 2014 extra Light weapon must be held in the other hand.",
      });
    }
  }

  if (input.extraAttackMode === "melee" && extraProfile.weaponType !== "melee") {
    canMakeExtraAttack = false;
    issues.push({
      code: "extra-weapon-mode-not-supported",
      message: extraDefinition.name + " is not a melee weapon.",
    });
  } else if (
    input.extraAttackMode === "ranged" &&
    extraProfile.weaponType !== "ranged"
  ) {
    canMakeExtraAttack = false;
    issues.push({
      code: "extra-weapon-mode-not-supported",
      message: extraDefinition.name + " is not a ranged weapon.",
    });
  } else if (
    input.extraAttackMode === "thrown" &&
    !(extraDefinition.properties ?? []).includes("thrown")
  ) {
    canMakeExtraAttack = false;
    issues.push({
      code: "extra-weapon-mode-not-supported",
      message: extraDefinition.name + " does not have the Thrown property.",
    });
  }

  const timing: LightExtraAttackTiming =
    input.ruleset === "2024" && nickMasteryAvailable
      ? "attack-action"
      : "bonus-action";
  if (timing === "bonus-action" && !input.bonusActionAvailable) {
    canMakeExtraAttack = false;
    issues.push({
      code: "bonus-action-unavailable",
      message: "A Bonus Action is required for the Light extra attack unless Nick applies.",
    });
  }

  return {
    canMakeExtraAttack,
    timing: canMakeExtraAttack ? timing : null,
    abilityModifierDamageMode: "negative-only",
    issues,
  };
}
