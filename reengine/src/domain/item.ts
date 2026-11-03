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
