const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateLightWeaponExtraAttack,
} = require("../../.test-dist/engines/light-weapon-extra-attack-engine.js");

const weapon = ({
  id,
  name = id,
  ruleset = "shared",
  weaponType = "melee",
  properties = ["light"],
} = {}) => ({
  instanceId: id,
  equipped: true,
  definition: {
    id: "weapon:" + id,
    name,
    ruleset,
    category: "weapon",
    properties,
    weaponProfile: {
      weaponCategory: "simple",
      weaponType,
      damage: [{ formula: "1d6", damageType: "piercing" }],
      ...(properties.includes("thrown")
        ? { thrownRange: { normal: 20, long: 60 } }
        : {}),
    },
  },
});

const valid = (overrides = {}) => validateLightWeaponExtraAttack({
  ruleset: "2014",
  primaryWeapon: weapon({ id: "shortsword-a" }),
  extraWeapon: weapon({ id: "dagger-b" }),
  attackActionTakenThisTurn: true,
  extraAttackAlreadyUsedThisTurn: false,
  bonusActionAvailable: true,
  extraWeaponAvailable: true,
  extraWeaponHeldInOtherHand: true,
  extraAttackMode: "melee",
  ...overrides,
});

test("2014 Light extra attack requires two different Light melee weapons in different hands", () => {
  const result = valid();
  assert.equal(result.canMakeExtraAttack, true);
  assert.equal(result.timing, "bonus-action");
  assert.equal(result.abilityModifierDamageMode, "negative-only");
  assert.deepEqual(result.issues, []);
});

test("2014 rejects ranged Light weapons for Two-Weapon Fighting", () => {
  const result = valid({
    primaryWeapon: weapon({ id: "hand-crossbow-a", weaponType: "ranged" }),
    extraWeapon: weapon({ id: "hand-crossbow-b", weaponType: "ranged" }),
    extraAttackHeldInOtherHand: true,
    extraAttackMode: "ranged",
  });
  assert.equal(result.canMakeExtraAttack, false);
  assert.ok(result.issues.some((issue) => issue.code === "2014-requires-melee-weapons"));
});

test("2014 requires the extra Light melee weapon in the other hand", () => {
  const result = valid({ extraWeaponHeldInOtherHand: false });
  assert.equal(result.canMakeExtraAttack, false);
  assert.ok(result.issues.some((issue) => issue.code === "2014-requires-other-hand"));
});

test("2024 Light can use a different Light ranged weapon", () => {
  const result = valid({
    ruleset: "2024",
    primaryWeapon: weapon({ id: "scimitar", ruleset: "2024" }),
    extraWeapon: weapon({
      id: "hand-crossbow",
      ruleset: "2024",
      weaponType: "ranged",
      properties: ["light", "ammunition", "loading"],
    }),
    extraWeaponHeldInOtherHand: undefined,
    extraAttackMode: "ranged",
  });
  assert.equal(result.canMakeExtraAttack, true);
  assert.equal(result.timing, "bonus-action");
});

test("2024 Light accepts a Thrown attack with a different Light thrown weapon", () => {
  const result = valid({
    ruleset: "2024",
    primaryWeapon: weapon({ id: "club", ruleset: "2024" }),
    extraWeapon: weapon({
      id: "handaxe",
      ruleset: "2024",
      properties: ["light", "thrown"],
    }),
    extraWeaponHeldInOtherHand: undefined,
    extraAttackMode: "thrown",
  });
  assert.equal(result.canMakeExtraAttack, true);
});

test("2024 Nick moves the Light extra attack into the Attack action", () => {
  const result = valid({
    ruleset: "2024",
    primaryWeapon: weapon({ id: "scimitar", ruleset: "2024" }),
    extraWeapon: weapon({ id: "dagger", ruleset: "2024" }),
    extraWeaponHeldInOtherHand: undefined,
    nickMasteryAvailableForExtraWeapon: true,
    bonusActionAvailable: false,
  });
  assert.equal(result.canMakeExtraAttack, true);
  assert.equal(result.timing, "attack-action");
  assert.equal(result.abilityModifierDamageMode, "negative-only");
});

test("2024 Nick still requires the Attack action trigger and can be used only once per turn", () => {
  const noAttackAction = valid({
    ruleset: "2024",
    primaryWeapon: weapon({ id: "scimitar", ruleset: "2024" }),
    extraWeapon: weapon({ id: "dagger", ruleset: "2024" }),
    extraWeaponHeldInOtherHand: undefined,
    nickMasteryAvailableForExtraWeapon: true,
    attackActionTakenThisTurn: false,
    bonusActionAvailable: false,
  });
  const alreadyUsed = valid({
    ruleset: "2024",
    primaryWeapon: weapon({ id: "scimitar", ruleset: "2024" }),
    extraWeapon: weapon({ id: "dagger", ruleset: "2024" }),
    extraWeaponHeldInOtherHand: undefined,
    nickMasteryAvailableForExtraWeapon: true,
    extraAttackAlreadyUsedThisTurn: true,
    bonusActionAvailable: false,
  });
  assert.equal(noAttackAction.canMakeExtraAttack, false);
  assert.ok(noAttackAction.issues.some((issue) => issue.code === "attack-action-not-taken"));
  assert.equal(alreadyUsed.canMakeExtraAttack, false);
  assert.ok(alreadyUsed.issues.some((issue) => issue.code === "extra-attack-already-used"));
});

test("Nick cannot be passed for the 2014 ruleset", () => {
  assert.throws(() => valid({
    nickMasteryAvailableForExtraWeapon: true,
  }), /Nick mastery is only available in the 2024 ruleset/);
});

test("the same weapon instance cannot trigger the extra attack", () => {
  const same = weapon({ id: "dagger" });
  const result = valid({ primaryWeapon: same, extraWeapon: same });
  assert.equal(result.canMakeExtraAttack, false);
  assert.ok(result.issues.some((issue) => issue.code === "same-weapon-instance"));
});

test("both the triggering and extra weapons must have Light", () => {
  const primaryNotLight = valid({
    primaryWeapon: weapon({ id: "longsword", properties: [] }),
  });
  const extraNotLight = valid({
    extraWeapon: weapon({ id: "longsword", properties: [] }),
  });
  assert.ok(primaryNotLight.issues.some((issue) => issue.code === "primary-weapon-not-light"));
  assert.ok(extraNotLight.issues.some((issue) => issue.code === "extra-weapon-not-light"));
});

test("the extra weapon must be available and support the selected attack mode", () => {
  const unavailable = valid({ extraWeaponAvailable: false });
  const invalidMode = valid({ extraAttackMode: "ranged" });
  assert.ok(unavailable.issues.some((issue) => issue.code === "extra-weapon-unavailable"));
  assert.ok(invalidMode.issues.some((issue) => issue.code === "extra-weapon-mode-not-supported"));
});

test("2014 and 2024 reject ruleset-incompatible weapons", () => {
  const result = valid({
    ruleset: "2024",
    primaryWeapon: weapon({ id: "old-sword", ruleset: "2014" }),
    extraWeapon: weapon({ id: "new-dagger", ruleset: "2024" }),
    extraWeaponHeldInOtherHand: undefined,
  });
  assert.equal(result.canMakeExtraAttack, false);
  assert.ok(result.issues.some((issue) => issue.code === "incompatible-ruleset-item"));
});

test("Bonus Action is required unless 2024 Nick applies", () => {
  const noBonusAction = valid({ bonusActionAvailable: false });
  assert.equal(noBonusAction.canMakeExtraAttack, false);
  assert.ok(noBonusAction.issues.some((issue) => issue.code === "bonus-action-unavailable"));
});

test("malformed state flags and attack modes are rejected", () => {
  assert.throws(() => valid({ attackActionTakenThisTurn: "yes" }), /Attack-action state must be boolean/);
  assert.throws(() => valid({ extraWeaponHeldInOtherHand: "no" }), /Other-hand state must be boolean/);
  assert.throws(() => valid({ extraAttackMode: "spell" }), /Unknown Light extra-attack mode/);
});

test("the primary weapon must have been available for its triggering attack", () => {
  const primaryUnavailable = {
    ...weapon({ id: "dagger-primary" }),
    equipped: false,
  };
  const result = valid({ primaryWeapon: primaryUnavailable });
  assert.equal(result.canMakeExtraAttack, false);
  assert.ok(result.issues.some((issue) => issue.code === "primary-weapon-unavailable"));
});

test("caller-resolved availability permits drawing the extra weapon for the attack", () => {
  const extraWeapon = {
    ...weapon({ id: "dagger-drawn" }),
    equipped: false,
  };
  const result = valid({
    ruleset: "2024",
    primaryWeapon: weapon({ id: "scimitar", ruleset: "2024" }),
    extraWeapon,
    extraWeaponHeldInOtherHand: undefined,
    extraWeaponAvailable: true,
  });
  assert.equal(result.canMakeExtraAttack, true);
  assert.equal(result.timing, "bonus-action");
});
