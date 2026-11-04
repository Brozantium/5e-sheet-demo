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

test("two Light melee weapons qualify for the Light extra attack in both rulesets", () => {
  for (const ruleset of ["2014", "2024"]) {
    const result = validateWeaponHandOccupancy({
      ruleset,
      heldItems: [
        { instanceId: "dagger-a", definition: weapon("dagger-a", ["light"]), hands: ["main"] },
        { instanceId: "dagger-b", definition: weapon("dagger-b", ["light"]), hands: ["off"] },
      ],
    });
    assert.equal(result.valid, true);
    assert.equal(result.lightWeaponPairEligible, true);
    assert.equal(result.issues.length, 0);
  }
});

test("two non-Light weapons may be held but do not qualify for the Light extra attack", () => {
  const result = validateWeaponHandOccupancy({
    ruleset: "2014",
    heldItems: [
      { instanceId: "longsword", definition: weapon("longsword"), hands: ["main"] },
      { instanceId: "dagger", definition: weapon("dagger", ["light"]), hands: ["off"] },
    ],
  });
  assert.equal(result.valid, true);
  assert.equal(result.lightWeaponPairEligible, false);
});

test("2014 Light extra attacks require melee weapons, while 2024 accepts Light ranged weapons", () => {
  const result = validateWeaponHandOccupancy({
    ruleset: "2014",
    heldItems: [
      { instanceId: "hand-crossbow-a", definition: weapon("hand-crossbow-a", ["light"], "ranged"), hands: ["main"] },
      { instanceId: "hand-crossbow-b", definition: weapon("hand-crossbow-b", ["light"], "ranged"), hands: ["off"] },
    ],
  });
  assert.equal(result.valid, true);
  assert.equal(result.lightWeaponPairEligible, false);

  const rules2024 = validateWeaponHandOccupancy({
    ruleset: "2024",
    heldItems: [
      { instanceId: "hand-crossbow-a", definition: weapon("hand-crossbow-a", ["light"], "ranged"), hands: ["main"] },
      { instanceId: "hand-crossbow-b", definition: weapon("hand-crossbow-b", ["light"], "ranged"), hands: ["off"] },
    ],
  });
  assert.equal(rules2024.valid, true);
  assert.equal(rules2024.lightWeaponPairEligible, true);
});

test("Only Two-Handed requires both hands; Heavy alone does not", () => {
  const heavy = validateWeaponHandOccupancy({
    ruleset: "2024",
    heldItems: [
      { instanceId: "heavy-weapon", definition: weapon("heavy-weapon", ["heavy"]), hands: ["main"] },
    ],
  });
  const twoHanded = validateWeaponHandOccupancy({
    ruleset: "2024",
    heldItems: [
      { instanceId: "two-handed-weapon", definition: weapon("two-handed-weapon", ["two-handed"]), hands: ["main"] },
    ],
  });
  assert.equal(heavy.valid, true);
  assert.equal(twoHanded.valid, false);
  assert.ok(twoHanded.issues.some((issue) => issue.code === "weapon-requires-two-hands"));
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
  assert.equal(result.lightWeaponPairEligible, false);
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
