const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateWeaponAttackCycle,
  calculateAmmunitionRecovery,
} = require("../../.test-dist/engines/weapon-attack-cycle-engine.js");

const bow = (overrides = {}) => ({
  id: "weapon:longbow",
  name: "Longbow",
  ruleset: "2024",
  category: "weapon",
  properties: ["ammunition", "heavy", "two-handed"],
  weaponProfile: {
    weaponCategory: "martial",
    weaponType: "ranged",
    damage: [{ formula: "1d8", damageType: "piercing" }],
    range: { normal: 150, long: 600 },
    ammunitionType: "arrow",
  },
  ...overrides,
});

const cycle = (overrides = {}) => validateWeaponAttackCycle({
  ruleset: "2024",
  weapon: { instanceId: "bow-1", definition: bow(), equipped: true },
  attackMode: "ranged",
  actionWindow: "action",
  ammunitionAvailable: 10,
  freeHands: 0,
  ammunitionShotsAlreadyMadeWithWeaponThisAction: 0,
  ...overrides,
});

const handCrossbow = (overrides = {}) => ({
  id: "weapon:hand-crossbow",
  name: "Hand Crossbow",
  ruleset: "2024",
  category: "weapon",
  properties: ["ammunition", "light", "loading"],
  weaponProfile: {
    weaponCategory: "martial",
    weaponType: "ranged",
    damage: [{ formula: "1d6", damageType: "piercing" }],
    range: { normal: 30, long: 120 },
    ammunitionType: "bolt",
  },
  ...overrides,
});

test("Ammunition attacks consume one piece per ranged attack", () => {
  const result = cycle({ ammunitionAvailable: 3 });
  assert.equal(result.canAttack, true);
  assert.equal(result.requiresAmmunition, true);
  assert.equal(result.ammunitionType, "arrow");
  assert.equal(result.ammunitionToConsume, 1);
  assert.equal(result.requiresFreeHandToLoad, false);
});

test("Ammunition attacks fail when ammunition is unavailable and consume nothing", () => {
  const result = cycle({ ammunitionAvailable: 0 });
  assert.equal(result.canAttack, false);
  assert.equal(result.ammunitionToConsume, 0);
  assert.ok(result.issues.some((issue) => issue.code === "ammunition-required"));
});

test("one-handed Ammunition weapons require a free hand to load", () => {
  const weapon = { instanceId: "hand-crossbow", definition: handCrossbow(), equipped: true };
  const noFreeHand = cycle({
    weapon,
    ammunitionAvailable: 2,
    freeHands: 0,
  });
  const freeHand = cycle({
    weapon,
    ammunitionAvailable: 2,
    freeHands: 1,
  });

  assert.equal(noFreeHand.canAttack, false);
  assert.ok(noFreeHand.issues.some((issue) => issue.code === "no-free-hand-to-load"));
  assert.equal(freeHand.canAttack, true);
  assert.equal(freeHand.requiresFreeHandToLoad, true);
  assert.equal(freeHand.ammunitionToConsume, 1);
});

test("one-handed Ammunition weapons require the caller to provide free-hand state", () => {
  const result = cycle({
    weapon: { instanceId: "hand-crossbow", definition: handCrossbow(), equipped: true },
    ammunitionAvailable: 2,
    freeHands: undefined,
  });
  assert.equal(result.canAttack, false);
  assert.ok(result.issues.some((issue) => issue.code === "free-hand-state-required"));
});

test("Loading limits a weapon to one ammunition shot in each Action, Bonus Action, or Reaction", () => {
  const weapon = { instanceId: "hand-crossbow", definition: handCrossbow(), equipped: true };
  const secondActionShot = cycle({
    weapon,
    actionWindow: "action",
    ammunitionAvailable: 3,
    freeHands: 1,
    ammunitionShotsAlreadyMadeWithWeaponThisAction: 1,
  });
  const bonusActionShot = cycle({
    weapon,
    actionWindow: "bonus-action",
    ammunitionAvailable: 3,
    freeHands: 1,
    ammunitionShotsAlreadyMadeWithWeaponThisAction: 0,
  });
  const reactionShot = cycle({
    weapon,
    actionWindow: "reaction",
    ammunitionAvailable: 3,
    freeHands: 1,
    ammunitionShotsAlreadyMadeWithWeaponThisAction: 0,
  });

  assert.equal(secondActionShot.canAttack, false);
  assert.ok(secondActionShot.issues.some((issue) => issue.code === "loading-limit-reached"));
  assert.equal(bonusActionShot.canAttack, true);
  assert.equal(reactionShot.canAttack, true);
});

test("Ammunition without Loading can be fired more than once in the same action window", () => {
  const result = cycle({
    ammunitionShotsAlreadyMadeWithWeaponThisAction: 2,
    ammunitionAvailable: 5,
  });
  assert.equal(result.canAttack, true);
  assert.equal(result.loadingLimit, null);
  assert.equal(result.ammunitionToConsume, 1);
});

test("ranged weapons used for melee attacks are flagged for improvised-weapon handling", () => {
  for (const ruleset of ["2014", "2024"]) {
    const result = cycle({
      ruleset,
      weapon: { instanceId: "bow", definition: bow({ ruleset }), equipped: true },
      attackMode: "melee",
      ammunitionAvailable: 0,
      freeHands: 0,
    });
    assert.equal(result.canAttack, true);
    assert.equal(result.treatAsImprovisedWeapon, true);
    assert.equal(result.requiresAmmunition, false);
    assert.equal(result.ammunitionToConsume, 0);
  }
});

test("Thrown melee weapons do not consume Ammunition unless they also have that property", () => {
  const javelin = {
    id: "weapon:javelin",
    name: "Javelin",
    ruleset: "2024",
    category: "weapon",
    properties: ["thrown"],
    weaponProfile: {
      weaponCategory: "simple",
      weaponType: "melee",
      damage: [{ formula: "1d6", damageType: "piercing" }],
      thrownRange: { normal: 30, long: 120 },
    },
  };
  const result = cycle({
    weapon: { instanceId: "javelin", definition: javelin, equipped: true },
    attackMode: "thrown",
    ammunitionAvailable: 0,
    freeHands: 0,
  });
  assert.equal(result.canAttack, true);
  assert.equal(result.requiresAmmunition, false);
  assert.equal(result.ammunitionToConsume, 0);
});

test("ammunition recovery returns half the expended quantity rounded down", () => {
  assert.equal(calculateAmmunitionRecovery(0), 0);
  assert.equal(calculateAmmunitionRecovery(1), 0);
  assert.equal(calculateAmmunitionRecovery(5), 2);
  assert.equal(calculateAmmunitionRecovery(10), 5);
  assert.throws(() => calculateAmmunitionRecovery(-1), /non-negative integer/);
  assert.throws(() => calculateAmmunitionRecovery(1.5), /non-negative integer/);
});

test("invalid action-window state and incompatible equipment are rejected safely", () => {
  assert.throws(() => cycle({
    actionWindow: "free-object-interaction",
  }), /Unknown weapon attack action window/);
  assert.throws(() => cycle({
    ammunitionShotsAlreadyMadeWithWeaponThisAction: -1,
  }), /non-negative integer/);

  const incompatible = cycle({
    weapon: { instanceId: "old-bow", definition: bow({ ruleset: "2014" }), equipped: true },
  });
  assert.equal(incompatible.canAttack, false);
  assert.ok(incompatible.issues.some((issue) => issue.code === "incompatible-ruleset-item"));
});
