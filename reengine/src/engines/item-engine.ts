import {
  WEAPON_PROPERTY_DEFINITIONS,
  type WeaponKind,
  type WeaponProp,
  type WeaponPropertyControlState,
  type WeaponPropertyLocks,
} from "../domain/item";

/**
 * Returns the exact forced/blocked property sets used by the legacy App.tsx
 * weapon editor. Keep this function behaviorally stable until a separately
 * reviewed rules change is approved.
 */
export function lockedWeaponProps(
  kind: WeaponKind,
  props: WeaponProp[],
): WeaponPropertyLocks {
  const on = new Set(props);
  const forced = new Set<WeaponProp>();

  if (on.has("heavy")) forced.add("two-handed");
  if (on.has("loading")) forced.add("ammunition");

  const blocked = new Set<WeaponProp>();

  if (on.has("versatile")) {
    blocked.add("two-handed");
    blocked.add("heavy");
    blocked.add("finesse");
  }
  if (on.has("finesse")) blocked.add("versatile");
  if (on.has("heavy")) blocked.add("versatile");
  if (on.has("two-handed")) blocked.add("versatile");
  if (kind === "ranged") blocked.add("versatile");
  if (kind === "ranged") blocked.add("reach");
  if (kind === "melee") {
    blocked.add("ammunition");
    blocked.add("loading");
  }
  if (on.has("light")) {
    blocked.add("heavy");
    blocked.add("two-handed");
  }
  if (on.has("two-handed")) blocked.add("light");
  if (on.has("heavy")) blocked.add("light");

  return { forced, blocked };
}

/**
 * Sanitizes a property list using the legacy App.tsx algorithm and canonical
 * property ordering. This intentionally preserves legacy edge-case behavior.
 */
export function cleanWeaponProps(
  kind: WeaponKind,
  props: WeaponProp[],
): WeaponProp[] {
  const { forced, blocked } = lockedWeaponProps(kind, props);
  const next = new Set<WeaponProp>([...props, ...forced]);

  blocked.forEach((property) => {
    if (!forced.has(property)) next.delete(property);
  });

  if (next.has("heavy") && next.has("light")) next.delete("light");

  if (kind === "ranged") {
    next.delete("versatile");
    next.delete("reach");
  }
  if (kind === "melee") {
    next.delete("ammunition");
    next.delete("loading");
  }

  return WEAPON_PROPERTY_DEFINITIONS
    .map((definition) => definition.id)
    .filter((id) => next.has(id));
}

/**
 * Returns the state needed by a property editor. UI components should consume
 * this result instead of maintaining their own compatibility rules.
 */
export function getWeaponPropertyControlStates(
  kind: WeaponKind,
  props: WeaponProp[],
): WeaponPropertyControlState[] {
  const normalized = cleanWeaponProps(kind, props);
  const { forced, blocked } = lockedWeaponProps(kind, props);

  return WEAPON_PROPERTY_DEFINITIONS.map((definition) => {
    const isForced = forced.has(definition.id);
    const isBlocked = blocked.has(definition.id) && !isForced;

    return {
      ...definition,
      selected: normalized.includes(definition.id),
      forced: isForced,
      blocked: isBlocked,
      disabled: isForced || isBlocked,
      lockReason: isForced
        ? "Required by another property"
        : isBlocked
          ? "Not available with the current type or properties"
          : definition.hint,
    };
  });
}

/**
 * Applies the same toggle guard used by the old WeaponEditor before cleaning
 * the resulting list. Attempting to toggle a forced/blocked property is a
 * no-op.
 */
export function toggleWeaponProperty(
  kind: WeaponKind,
  props: WeaponProp[],
  property: WeaponProp,
): WeaponProp[] {
  const { forced, blocked } = lockedWeaponProps(kind, props);
  if (forced.has(property) || blocked.has(property)) {
    return cleanWeaponProps(kind, props);
  }

  const next = props.includes(property)
    ? props.filter((entry) => entry !== property)
    : [...props, property];

  return cleanWeaponProps(kind, next);
}

/**
 * Changes a weapon's kind while retaining only properties valid under the
 * legacy normalization rules.
 */
export function changeWeaponKind(
  nextKind: WeaponKind,
  props: WeaponProp[],
): WeaponProp[] {
  return cleanWeaponProps(nextKind, props);
}
