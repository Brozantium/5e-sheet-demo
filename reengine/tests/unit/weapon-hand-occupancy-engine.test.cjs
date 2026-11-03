const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateWeaponHandOccupancy,
} = require("../../.test-dist/engines/weapon-hand-occupancy-engine.js");

const weapon = (id, properties = [], weaponType = "melee", ruleset = "shared") => ({
  id: "weapon:" + id,
  name: id,
  ruleset,
  category: "weapon",
  properties,
  weaponProfile: {
    weaponCategory: "martial",
    weaponType,
    damage: [{ formula: "1d6", damageType: "slashing" }],
  },
});

const shield = {
  id: "armor:shield",
  name: "Shield",
  ruleset: "shared",
  category: "shield",
  armorProfile: {
    armorCategory: "shield",
    baseAC: 2,
    dexterity: "none",
    stealthDisadvantage: false,
  },
};

test("a one-handed weapon can be held with a shield in the other hand", () => {
  const result = validateWeaponHandOccupancy({
    ruleset: "2014",
    heldItems: [
      { instanceId: "sword", definition: weapon("sword"), hands: ["main"] },
      { instanceId: "shield", definition: shield, hands: ["off"] },
    ],
  });
  assert.equal(result.valid, true);
  assert.deepEqual(result.occupiedHands, { main: "sword", off: "shield" });
});

test("two Light melee weapons may occupy separate hands", () => {
  const result = validateWeaponHandOccupancy({
    ruleset: "2024",
    heldItems: [
      { instanceId: "dagger-a", definition: weapon("dagger-a", ["light"]), hands: ["main"] },
      { instanceId: "dagger-b", definition: weapon("dagger-b", ["light"]), hands: ["off"] },
    ],
  });
  assert.equal(result.valid, true);
  assert.equal(result.issues.length, 0);
});

test("dual wielding a non-Light melee weapon is rejected", () => {
  const result = validateWeaponHandOccupancy({
    ruleset: "2014",
    heldItems: [
      { instanceId: "longsword", definition: weapon("longsword"), hands: ["main"] },
      { instanceId: "dagger", definition: weapon("dagger", ["light"]), hands: ["off"] },
    ],
  });
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "two-weapon-wielding-requires-light-melee-weapons"));
});

test("dual wielding requires two melee weapons, not two ranged weapons", () => {
  const result = validateWeaponHandOccupancy({
    ruleset: "2014",
    heldItems: [
      { instanceId: "hand-crossbow-a", definition: weapon("hand-crossbow-a", ["light"], "ranged"), hands: ["main"] },
      { instanceId: "hand-crossbow-b", definition: weapon("hand-crossbow-b", ["light"], "ranged"), hands: ["off"] },
    ],
  });
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "two-weapon-wielding-requires-light-melee-weapons"));
});

test("Heavy and Two-Handed weapons must occupy both hands", () => {
  const result = validateWeaponHandOccupancy({
    ruleset: "2024",
    heldItems: [
      { instanceId: "greatsword", definition: weapon("greatsword", ["heavy", "two-handed"]), hands: ["main"] },
    ],
  });
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "weapon-requires-two-hands"));
});

test("a two-handed weapon blocks a shield or another held item", () => {
  const result = validateWeaponHandOccupancy({
    ruleset: "2014",
    heldItems: [
      { instanceId: "greatsword", definition: weapon("greatsword", ["two-handed"]), hands: ["main", "off"] },
      { instanceId: "shield", definition: shield, hands: ["off"] },
    ],
  });
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "hand-already-occupied"));
});

test("two weapons cannot occupy the same hand", () => {
  const result = validateWeaponHandOccupancy({
    ruleset: "2014",
    heldItems: [
      { instanceId: "weapon-a", definition: weapon("weapon-a", ["light"]), hands: ["main"] },
      { instanceId: "weapon-b", definition: weapon("weapon-b", ["light"]), hands: ["main"] },
    ],
  });
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "hand-already-occupied"));
});

test("edition-incompatible held content is reported", () => {
  const result = validateWeaponHandOccupancy({
    ruleset: "2024",
    heldItems: [
      { instanceId: "old-weapon", definition: weapon("old-weapon", [], "melee", "2014"), hands: ["main"] },
    ],
  });
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "incompatible-ruleset-item"));
});

test("duplicate instance IDs and malformed hand assignments are rejected", () => {
  assert.throws(() => validateWeaponHandOccupancy({
    ruleset: "2014",
    heldItems: [
      { instanceId: "same", definition: weapon("a"), hands: ["main"] },
      { instanceId: "same", definition: weapon("b"), hands: ["off"] },
    ],
  }), /Duplicate held item/);
  assert.throws(() => validateWeaponHandOccupancy({
    ruleset: "2014",
    heldItems: [
      { instanceId: "bad", definition: weapon("bad"), hands: ["main", "main"] },
    ],
  }), /same hand twice/);
});
