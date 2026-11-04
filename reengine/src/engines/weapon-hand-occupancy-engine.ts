import type { ContentRuleset } from "../domain/types";
import type { ItemDefinition, WeaponProfile } from "../domain/item";
import type {
  WeaponHandOccupancyInput,
  WeaponHandOccupancyIssue,
  WeaponHandOccupancyResult,
  WeaponHand,
} from "../domain/combat";

function isRulesetCompatible(itemRuleset: ContentRuleset, ruleset: "2014" | "2024"): boolean {
  return itemRuleset === "shared" || itemRuleset === ruleset;
}

function getWeaponProfile(definition: ItemDefinition): WeaponProfile | undefined {
  if (definition.category === "weapon" || definition.category === "magic-item") {
    return definition.weaponProfile;
  }
  return undefined;
}

/**
 * Validates physical hand occupancy independently from combat benefits.
 * Two weapons may be held in separate hands even when they do not qualify
 * for the Light-property extra attack. Pair eligibility is returned separately
 * from the Attack-action trigger and follows the 2014/2024 ruleset distinction.
 */
export function validateWeaponHandOccupancy(
  input: WeaponHandOccupancyInput,
): WeaponHandOccupancyResult {
  if (!input || typeof input !== "object") {
    throw new TypeError("Weapon hand occupancy input is required.");
  }
  if (input.ruleset !== "2014" && input.ruleset !== "2024") {
    throw new RangeError("Weapon hand occupancy ruleset must be 2014 or 2024.");
  }
  if (input.isMounted !== undefined && typeof input.isMounted !== "boolean") {
    throw new TypeError("Mounted state must be boolean.");
  }
  const isMounted = input.isMounted ?? false;
  if (!Array.isArray(input.heldItems)) {
    throw new TypeError("Held items must be an array.");
  }

  const occupiedHands: Record<WeaponHand, string | null> = { main: null, off: null };
  const issues: WeaponHandOccupancyIssue[] = [];
  const seenIds = new Set<string>();
  const heldWeapons: Array<{
    instanceId: string;
    definition: ItemDefinition;
    profile: WeaponProfile;
    hands: WeaponHand[];
  }> = [];

  for (const entry of input.heldItems) {
    if (!entry || typeof entry !== "object") {
      throw new TypeError("Held item entries must be objects.");
    }
    if (typeof entry.instanceId !== "string" || !entry.instanceId.trim()) {
      throw new TypeError("Held item instance ID must be non-empty.");
    }
    if (seenIds.has(entry.instanceId)) {
      throw new RangeError("Duplicate held item instance ID: " + entry.instanceId);
    }
    seenIds.add(entry.instanceId);

    if (!entry.definition || typeof entry.definition !== "object") {
      throw new TypeError("Held items require an item definition.");
    }
    if (!Array.isArray(entry.hands) || entry.hands.length < 1 || entry.hands.length > 2) {
      throw new RangeError("Each held item must occupy one or two hands.");
    }
    const hands: WeaponHand[] = [...entry.hands];
    if (hands.some((hand) => hand !== "main" && hand !== "off")) {
      throw new RangeError("Unknown hand assignment.");
    }
    if (new Set(hands).size !== hands.length) {
      throw new RangeError("A held item cannot occupy the same hand twice.");
    }

    if (!isRulesetCompatible(entry.definition.ruleset, input.ruleset)) {
      issues.push({
        code: "incompatible-ruleset-item",
        instanceId: entry.instanceId,
        message: entry.definition.name + " is not compatible with the " + input.ruleset + " ruleset.",
      });
    }

    const profile = getWeaponProfile(entry.definition);
    if (profile) {
      const properties = new Set(entry.definition.properties ?? []);
      const hasMountedTwoHandedException =
        input.ruleset === "2024" &&
        isMounted &&
        profile.twoHandedRule?.unlessMounted === true;
      const has2014LanceRequiresTwoHands =
        input.ruleset === "2014" &&
        !isMounted &&
        profile.specialRules?.includes("lance-2014") === true;
      const requiresTwoHands =
        (properties.has("two-handed") && !hasMountedTwoHandedException) ||
        has2014LanceRequiresTwoHands;
      if (requiresTwoHands && hands.length !== 2) {
        issues.push({
          code: "weapon-requires-two-hands",
          instanceId: entry.instanceId,
          message: entry.definition.name + " requires both hands in the current mounted state.",
        });
      }
      heldWeapons.push({
        instanceId: entry.instanceId,
        definition: entry.definition,
        profile,
        hands,
      });
    }

    for (const hand of hands) {
      if (occupiedHands[hand] !== null) {
        issues.push({
          code: "hand-already-occupied",
          instanceId: entry.instanceId,
          message:
            hand + " hand is already occupied by " + occupiedHands[hand] +
            "; it cannot also hold " + entry.definition.name + ".",
        });
      } else {
        occupiedHands[hand] = entry.instanceId;
      }
    }
  }

  const hasTwoWeaponsInSeparateHands =
    heldWeapons.length === 2 &&
    heldWeapons.every((weapon) => weapon.hands.length === 1) &&
    heldWeapons[0].hands[0] !== heldWeapons[1].hands[0];
  const bothWeaponsAreLight = heldWeapons.every((weapon) =>
    (weapon.definition.properties ?? []).includes("light"),
  );
  const lightWeaponPairEligible =
    issues.length === 0 &&
    hasTwoWeaponsInSeparateHands &&
    bothWeaponsAreLight &&
    (input.ruleset === "2024" ||
      heldWeapons.every((weapon) => weapon.profile.weaponType === "melee"));

  return {
    valid: issues.length === 0,
    occupiedHands,
    lightWeaponPairEligible,
    issues,
  };
}
