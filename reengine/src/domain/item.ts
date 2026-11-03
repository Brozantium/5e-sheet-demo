import type { ContentRuleset, ContentSource } from "./types";

export const WEAPON_PROPERTY_DEFINITIONS = [
  { id: "ammunition", label: "Ammunition", hint: "Needs ammo; ranged weapons only" },
  { id: "finesse", label: "Finesse", hint: "Use the better of STR or DEX" },
  { id: "heavy", label: "Heavy", hint: "Always two-handed" },
  { id: "light", label: "Light", hint: "Can be dual wielded" },
  { id: "loading", label: "Loading", hint: "Always has Ammunition" },
  { id: "reach", label: "Reach", hint: "+5 ft. reach; melee only" },
  { id: "special", label: "Special", hint: "Has special rules" },
  { id: "thrown", label: "Thrown", hint: "Can be thrown" },
  { id: "two-handed", label: "Two-Handed", hint: "Needs both hands" },
  { id: "versatile", label: "Versatile", hint: "One or two hands; melee only" },
] as const;

export type WeaponProp = (typeof WEAPON_PROPERTY_DEFINITIONS)[number]["id"];
export type WeaponKind = "melee" | "ranged";

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

export interface WeaponProfile {
  weaponCategory: "simple" | "martial";
  weaponType: WeaponKind;
  damage: ItemDamageComponent[];
  range?: { normal: number; long?: number };
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
