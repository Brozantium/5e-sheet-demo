import type { Ruleset } from "../domain/types";
import type { EquipmentCalculationEntry } from "../domain/equipment";
import type { WeaponAttackMode } from "../domain/combat";
import type { WeaponProfile } from "../domain/item";

export type WeaponAttackActionWindow = "action" | "bonus-action" | "reaction";

export type WeaponAttackCycleIssueCode =
  | "weapon-not-equipped"
  | "incompatible-ruleset-item"
  | "weapon-mode-not-supported"
  | "ammunition-type-missing"
  | "ammunition-required"
  | "free-hand-state-required"
  | "no-free-hand-to-load"
  | "loading-limit-reached";

export interface WeaponAttackCycleInput {
  ruleset: Ruleset;
  weapon: EquipmentCalculationEntry;
  attackMode: WeaponAttackMode;
  /** The Action, Bonus Action, or Reaction currently being resolved. */
  actionWindow: WeaponAttackActionWindow;
  /** Quantity of the weapon's required ammunition currently available. */
  ammunitionAvailable?: number;
  /** Number of unoccupied hands available before this attack is loaded. */
  freeHands?: number;
  /** Shots already made with this weapon during this same action window. */
  ammunitionShotsAlreadyMadeWithWeaponThisAction: number;
}

export interface WeaponAttackCycleIssue {
  code: WeaponAttackCycleIssueCode;
  message: string;
}

export interface WeaponAttackCycleResult {
  canAttack: boolean;
  actionWindow: WeaponAttackActionWindow;
  ammunitionType?: string;
  requiresAmmunition: boolean;
  ammunitionToConsume: number;
  requiresFreeHandToLoad: boolean;
  loadingLimit: number | null;
  shotsAlreadyMadeWithWeaponThisAction: number;
  /** Ranged weapons used for melee attacks are handled through the improvised-weapon rules. */
  treatAsImprovisedWeapon: boolean;
  issues: WeaponAttackCycleIssue[];
}

function getWeaponProfile(
  definition: EquipmentCalculationEntry["definition"],
): WeaponProfile | undefined {
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

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(label + " must be a non-negative integer.");
  }
}

/**
 * Validates the weapon-property portion of one attack's action window.
 * This is a stateless calculation: the caller supplies the current ammunition,
 * free-hand count, and the number of shots already made in this same window.
 *
 * Ammunition is consumed only for ranged/Thrown attacks made with the
 * Ammunition property. Loading limits those attacks to one shot per
 * Action, Bonus Action, or Reaction. The action engine owns when the window
 * opens/resets and when the returned ammunitionToConsume is committed.
 */
export function validateWeaponAttackCycle(
  input: WeaponAttackCycleInput,
): WeaponAttackCycleResult {
  if (!input || typeof input !== "object") {
    throw new TypeError("Weapon attack cycle input is required.");
  }
  if (input.ruleset !== "2014" && input.ruleset !== "2024") {
    throw new RangeError("Weapon attack cycle ruleset must be 2014 or 2024.");
  }
  if (
    input.actionWindow !== "action" &&
    input.actionWindow !== "bonus-action" &&
    input.actionWindow !== "reaction"
  ) {
    throw new RangeError("Unknown weapon attack action window.");
  }
  if (
    input.attackMode !== "melee" &&
    input.attackMode !== "ranged" &&
    input.attackMode !== "thrown"
  ) {
    throw new RangeError("Unknown weapon attack mode.");
  }
  assertNonNegativeInteger(
    input.ammunitionShotsAlreadyMadeWithWeaponThisAction,
    "Ammunition shots already made with this weapon this action",
  );
  const ammunitionAvailable = input.ammunitionAvailable ?? 0;
  assertNonNegativeInteger(ammunitionAvailable, "Available ammunition");
  if (input.freeHands !== undefined) {
    assertNonNegativeInteger(input.freeHands, "Available free hands");
    if (input.freeHands > 2) {
      throw new RangeError("Available free hands cannot exceed two.");
    }
  }

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
  if (profile.weaponType !== "melee" && profile.weaponType !== "ranged") {
    throw new RangeError("Unknown weapon type.");
  }
  if (
    definition.properties !== undefined &&
    (!Array.isArray(definition.properties) ||
      definition.properties.some((property) => typeof property !== "string"))
  ) {
    throw new TypeError("Weapon properties must be an array of strings.");
  }

  const properties = new Set(definition.properties ?? []);
  const hasAmmunition = properties.has("ammunition");
  const hasLoading = properties.has("loading");
  const hasThrown = properties.has("thrown");
  const isMeleeAttack = input.attackMode === "melee";
  const isRangedAttack = !isMeleeAttack;
  const treatAsImprovisedWeapon =
    isMeleeAttack && profile.weaponType === "ranged";

  const issues: WeaponAttackCycleIssue[] = [];
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
  if (input.attackMode === "thrown" && !hasThrown) {
    canAttack = false;
    issues.push({
      code: "weapon-mode-not-supported",
      message: definition.name + " does not have the Thrown property.",
    });
  }
  if (input.attackMode === "ranged" && profile.weaponType !== "ranged") {
    canAttack = false;
    issues.push({
      code: "weapon-mode-not-supported",
      message: definition.name + " is not a ranged weapon; use Thrown mode if its property allows it.",
    });
  }
  if (
    input.attackMode === "thrown" &&
    profile.weaponType === "melee" &&
    !hasThrown
  ) {
    canAttack = false;
  }

  const requiresAmmunition = hasAmmunition && isRangedAttack;
  const ammunitionType = profile.ammunitionType;
  const requiresFreeHandToLoad =
    requiresAmmunition && !properties.has("two-handed");
  const loadingLimit = hasLoading && isRangedAttack ? 1 : null;

  if (requiresAmmunition) {
    if (typeof ammunitionType !== "string" || !ammunitionType.trim()) {
      canAttack = false;
      issues.push({
        code: "ammunition-type-missing",
        message: definition.name + " has Ammunition but no ammunitionType is defined.",
      });
    }
    if (ammunitionAvailable < 1) {
      canAttack = false;
      issues.push({
        code: "ammunition-required",
        message:
          definition.name + " requires " + (ammunitionType || "ammunition") +
          " to make this ranged attack.",
      });
    }
  }

  if (requiresFreeHandToLoad) {
    if (input.freeHands === undefined) {
      canAttack = false;
      issues.push({
        code: "free-hand-state-required",
        message: "The available free-hand count is required to load " + definition.name + ".",
      });
    } else if (input.freeHands < 1) {
      canAttack = false;
      issues.push({
        code: "no-free-hand-to-load",
        message: "A free hand is required to load " + definition.name + ".",
      });
    }
  }

  if (
    loadingLimit !== null &&
    input.ammunitionShotsAlreadyMadeWithWeaponThisAction >= loadingLimit
  ) {
    canAttack = false;
    issues.push({
      code: "loading-limit-reached",
      message:
        definition.name + " can fire only one piece of ammunition per " +
        input.actionWindow + ".",
    });
  }

  return {
    canAttack,
    actionWindow: input.actionWindow,
    ...(ammunitionType ? { ammunitionType } : {}),
    requiresAmmunition,
    ammunitionToConsume: canAttack && requiresAmmunition ? 1 : 0,
    requiresFreeHandToLoad,
    loadingLimit,
    shotsAlreadyMadeWithWeaponThisAction: input.ammunitionShotsAlreadyMadeWithWeaponThisAction,
    treatAsImprovisedWeapon,
    issues,
  };
}

/**
 * Both 2014 and 2024 allow recovering half of expended ammunition after a
 * battle (round down) by spending 1 minute searching the battlefield.
 */
export function calculateAmmunitionRecovery(expendedAmmunition: number): number {
  assertNonNegativeInteger(expendedAmmunition, "Expended ammunition");
  return Math.floor(expendedAmmunition / 2);
}
