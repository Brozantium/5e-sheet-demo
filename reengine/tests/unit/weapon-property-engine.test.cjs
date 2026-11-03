const test = require("node:test");
const assert = require("node:assert/strict");

const {
  WEAPON_PROPERTY_DEFINITIONS,
} = require("../../.test-dist/domain/item.js");

const {
  changeWeaponKind,
  cleanWeaponProps,
  getWeaponPropertyControlStates,
  lockedWeaponProps,
  toggleWeaponProperty,
} = require("../../.test-dist/engines/item-engine.js");

const propertyIds = WEAPON_PROPERTY_DEFINITIONS.map(({ id }) => id);

/**
 * Frozen behavioral oracle copied from the audited src/App.tsx implementation.
 * Do not edit this oracle to make a new implementation pass. Any deliberate
 * rules change must be proposed and tested separately from parity.
 */
function legacyLockedWeaponProps(kind, props) {
  const on = new Set(props);
  const forced = new Set();
  if (on.has("heavy")) forced.add("two-handed");
  if (on.has("loading")) forced.add("ammunition");

  const blocked = new Set();
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

function legacyCleanWeaponProps(kind, props) {
  const { forced, blocked } = legacyLockedWeaponProps(kind, props);
  const next = new Set([...props, ...forced]);
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
  return propertyIds.filter((id) => next.has(id));
}

function fromMask(mask) {
  return propertyIds.filter((_, bit) => (mask & (1 << bit)) !== 0);
}

test("exhaustive parity with legacy lock and clean rules for all 2,048 cases", () => {
  let checked = 0;

  for (const kind of ["melee", "ranged"]) {
    for (let mask = 0; mask < (1 << propertyIds.length); mask += 1) {
      const input = fromMask(mask);
      const expectedLocks = legacyLockedWeaponProps(kind, input);
      const actualLocks = lockedWeaponProps(kind, input);

      assert.deepEqual([...actualLocks.forced], [...expectedLocks.forced], `forced mismatch: ${kind} mask ${mask}`);
      assert.deepEqual([...actualLocks.blocked], [...expectedLocks.blocked], `blocked mismatch: ${kind} mask ${mask}`);
      assert.deepEqual(cleanWeaponProps(kind, input), legacyCleanWeaponProps(kind, input), `clean mismatch: ${kind} mask ${mask}`);

      checked += 1;
    }
  }

  assert.equal(checked, 2048);
});

test("cleaning is idempotent for every weapon kind and property combination", () => {
  for (const kind of ["melee", "ranged"]) {
    for (let mask = 0; mask < (1 << propertyIds.length); mask += 1) {
      const once = cleanWeaponProps(kind, fromMask(mask));
      const twice = cleanWeaponProps(kind, once);
      assert.deepEqual(twice, once, `not idempotent: ${kind} mask ${mask}`);
    }
  }
});

test("legacy examples remain stable", () => {
  assert.deepEqual(cleanWeaponProps("melee", ["heavy"]), ["heavy", "two-handed"]);
  assert.deepEqual(cleanWeaponProps("ranged", ["loading"]), ["ammunition", "loading"]);
  assert.deepEqual(cleanWeaponProps("melee", ["loading"]), []);
  assert.deepEqual(cleanWeaponProps("melee", ["heavy", "light"]), ["two-handed"]);
  assert.deepEqual(cleanWeaponProps("melee", ["heavy", "versatile"]), ["two-handed"]);
  assert.deepEqual(cleanWeaponProps("melee", ["versatile", "finesse"]), []);
  assert.deepEqual(cleanWeaponProps("melee", ["finesse", "light", "thrown"]), ["finesse", "light", "thrown"]);
});

test("property control state shares the engine's forced and blocked decisions", () => {
  const states = getWeaponPropertyControlStates("melee", ["heavy"]);
  const byId = Object.fromEntries(states.map((state) => [state.id, state]));

  assert.equal(byId["two-handed"].selected, true);
  assert.equal(byId["two-handed"].forced, true);
  assert.equal(byId["two-handed"].disabled, true);
  assert.equal(byId.light.blocked, true);
  assert.equal(byId.light.disabled, true);
  assert.equal(byId.finesse.disabled, false);
});

test("toggle ignores locked properties and normalizes accepted changes", () => {
  assert.deepEqual(toggleWeaponProperty("melee", ["heavy", "two-handed"], "two-handed"), ["heavy", "two-handed"]);
  assert.deepEqual(toggleWeaponProperty("melee", [], "ammunition"), []);
  assert.deepEqual(toggleWeaponProperty("melee", [], "finesse"), ["finesse"]);
  assert.deepEqual(toggleWeaponProperty("melee", ["finesse"], "versatile"), ["finesse"]);
});

test("changing weapon kind applies legacy kind-specific cleanup", () => {
  assert.deepEqual(changeWeaponKind("ranged", ["finesse", "reach", "versatile", "thrown"]), ["thrown"]);
  assert.deepEqual(changeWeaponKind("melee", ["ammunition", "loading", "reach"]), ["reach"]);
});


test("Light blocks Heavy and Two-Handed through the real toggle sequence", () => {
  const withLight = toggleWeaponProperty("melee", [], "light");
  assert.deepEqual(withLight, ["light"]);
  assert.deepEqual(toggleWeaponProperty("melee", withLight, "heavy"), ["light"]);
  assert.deepEqual(toggleWeaponProperty("melee", withLight, "two-handed"), ["light"]);
});

test("Heavy automatically adds Two-Handed and blocks Light through the real toggle sequence", () => {
  const withHeavy = toggleWeaponProperty("melee", [], "heavy");
  assert.deepEqual(withHeavy, ["heavy", "two-handed"]);
  assert.deepEqual(toggleWeaponProperty("melee", withHeavy, "light"), ["heavy", "two-handed"]);
});
