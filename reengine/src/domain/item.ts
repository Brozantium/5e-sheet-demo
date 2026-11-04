import type { ContentRuleset, ContentSource } from "./types";

export const WEAPON_PROPERTY_DEFINITIONS = [
  { id: "ammunition", label: "Ammunition", hint: "Requires ammunition for ranged attacks" },
  { id: "finesse", label: "Finesse", hint: "Choose Strength or Dexterity for attack and damage" },
  { id: "heavy", label: "Heavy", hint: "Uses the ruleset-specific Heavy attack restriction" },
  { id: "light", label: "Light", hint: "Enables the ruleset-specific extra-attack rule" },
  { id: "loading", label: "Loading", hint: "Limits ammunition fired per action" },
  { id: "reach", label: "Reach", hint: "Adds 5 feet to attack and Opportunity Attack reach" },
  { id: "special", label: "Special", hint: "Uses a structured 2014 Special weapon rule" },
  { id: "thrown", label: "Thrown", hint: "Can be thrown to make a ranged attack" },
  { id: "two-handed", label: "Two-Handed", hint: "Requires two hands when attacking unless the profile says otherwise" },
  { id: "versatile", label: "Versatile", hint: "Has an alternate damage formula for two-handed melee attacks" },
] as const;

export type WeaponProp = (typeof WEAPON_PROPERTY_DEFINITIONS)[number]["id"];
export type WeaponKind = "melee" | "ranged";
export type WeaponSpecialRuleId = "lance-2014" | "net-2014";

export const WEAPON_MASTERY_DEFINITIONS = [
  { id: "cleave", name: "Cleave" },
  { id: "graze", name: "Graze" },
  { id: "nick", name: "Nick" },
  { id: "push", name: "Push" },
  { id: "sap", name: "Sap" },
  { id: "slow", name: "Slow" },
  { id: "topple", name: "Topple" },
  { id: "vex", name: "Vex" },
] as const;

export type WeaponMasteryId = (typeof WEAPON_MASTERY_DEFINITIONS)[number]["id"];

export type WeaponPropertyDefinition = (typeof WEAPON_PROPERTY_DEFINITIONS)[number];

const WEAPON_PROPERTY_DEFINITIONS_2024 = WEAPON_PROPERTY_DEFINITIONS.filter(
  (definition) => definition.id !== "special",
);

export const WEAPON_PROPERTY_DEFINITIONS_BY_RULESET: Record<
  "2014" | "2024",
  readonly WeaponPropertyDefinition[]
> = {
  "2014": WEAPON_PROPERTY_DEFINITIONS,
  "2024": WEAPON_PROPERTY_DEFINITIONS_2024,
};

/**
 * Returns properties available to canonical content for a ruleset.
 * Shared content receives only the properties common to both editions;
 * 2014 Special is deliberately not treated as a shared/2024 property.
 */
export function getWeaponPropertyDefinitions(
  ruleset: ContentRuleset,
): readonly WeaponPropertyDefinition[] {
  return ruleset === "2014"
    ? WEAPON_PROPERTY_DEFINITIONS_BY_RULESET["2014"]
    : WEAPON_PROPERTY_DEFINITIONS_BY_RULESET["2024"];
}

export interface WeaponPropertyLocks {
  forced: Set<WeaponProp>;
  blocked: Set<WeaponProp>;
}

export interface WeaponPropertyControlState {
  id: WeaponProp;
  label: string;
  hint: string;
  selected: boolean;
  forced: boolean;
  blocked: boolean;
  disabled: boolean;
  lockReason: string;
}

export type ItemCategory =
  | "weapon"
  | "armor"
  | "shield"
  | "gear"
  | "tool"
  | "ammunition"
  | "consumable"
  | "magic-item";

export interface ItemDamageComponent {
  formula: string;
  damageType: string;
  /** Alternate die expression when a Versatile weapon is wielded in two hands. */
  versatileFormula?: string;
}

export interface WeaponRange {
  /** Normal range in feet. */
  normal: number;
  /** Long range in feet. */
  long: number;
}

export interface WeaponProfile {
  weaponCategory: "simple" | "martial";
  weaponType: WeaponKind;
  damage: ItemDamageComponent[];
  /** Normal/long range for a weapon's standard ranged attack. */
  range?: WeaponRange;
  /** Normal/long range when this weapon is thrown. Kept separate from standard range. */
  thrownRange?: WeaponRange;
  /** Required ammunition kind when the Ammunition property is present. */
  ammunitionType?: string;
  /** Two-Handed defaults to always; this records an explicit exception such as the 2024 Lance. */
  twoHandedRule?: { unlessMounted?: true };
  /** 2024 Weapon Mastery assigned to this weapon type. */
  mastery?: WeaponMasteryId;
  /** Structured mechanics for the 2014 Special property; descriptions remain display-only. */
  specialRules?: WeaponSpecialRuleId[];
}

interface ArmorProfileBase {
  baseAC: number;
  strengthRequirement?: number;
  stealthDisadvantage: boolean;
}

type ArmorDexterityRule =
  | { dexterity: "full" | "none"; maxDexterityModifier?: null }
  | { dexterity: "capped"; maxDexterityModifier: number };

export type ArmorProfile =
  | (ArmorProfileBase &
      ArmorDexterityRule & {
        armorCategory: "light" | "medium" | "heavy";
      })
  | (ArmorProfileBase & {
      armorCategory: "shield";
      dexterity: "none";
      maxDexterityModifier?: null;
    });

export interface ItemDefinitionBase {
  id: string;
  name: string;
  ruleset: ContentRuleset;
  baseItemId?: string;
  properties?: string[];
  tags?: string[];
  source?: ContentSource;
}

/**
 * Immutable canonical definition for equipment/content. Inventory instance state
 * (quantity, equipped slot, charges remaining) belongs to character state.
 * Actions and event triggers are separate records in the RE-008 action/effect phase.
 */
export type ItemDefinition =
  | (ItemDefinitionBase & {
      category: "weapon";
      weaponProfile: WeaponProfile;
      armorProfile?: never;
    })
  | (ItemDefinitionBase & {
      category: "armor";
      armorProfile: ArmorProfile & { armorCategory: "light" | "medium" | "heavy" };
      weaponProfile?: never;
    })
  | (ItemDefinitionBase & {
      category: "shield";
      armorProfile: ArmorProfile & { armorCategory: "shield" };
      weaponProfile?: never;
    })
  | (ItemDefinitionBase & {
      category: "gear" | "tool" | "ammunition" | "consumable";
      weaponProfile?: never;
      armorProfile?: never;
    })
  | (ItemDefinitionBase & {
      category: "magic-item";
      weaponProfile?: WeaponProfile;
      armorProfile?: ArmorProfile;
    });
