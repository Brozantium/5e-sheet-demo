const test = require("node:test");
const assert = require("node:assert/strict");

const {
  addExhaustionLevels,
  resolveExhaustionEffects,
  validateExhaustionLevel,
} = require("../../.test-dist/engines/exhaustion-engine.js");

const resolve = (ruleset, level, extra = {}) =>
  resolveExhaustionEffects({ ruleset, level, ...extra });

test("Exhaustion levels are validated from 0 through 6 inclusive", () => {
  for (let level = 0; level <= 6; level++) {
    assert.doesNotThrow(() => validateExhaustionLevel(level));
  }
  for (const level of [-1, 7, 1.5, NaN, Infinity]) {
    assert.throws(() => validateExhaustionLevel(level), /integer from 0 to 6/);
  }
});

test("level 0 has no Exhaustion penalties in either ruleset", () => {
  for (const ruleset of ["2014", "2024"]) {
    const result = resolve(ruleset, 0, {
      baseSpeed: 30,
      baseMaximumHitPoints: 31,
    });
    assert.equal(result.isDead, false);
    assert.equal(result.d20TestModifier, 0);
    assert.equal(result.attackRollDisadvantage, false);
    assert.equal(result.abilityCheckDisadvantage, false);
    assert.equal(result.savingThrowDisadvantage, false);
    assert.deepEqual(result.speed, {
      kind: "normal",
      multiplier: 1,
      reductionFeet: 0,
      effectiveSpeed: 30,
    });
    assert.equal(result.maximumHitPointsMultiplier, 1);
    assert.equal(result.effectiveMaximumHitPoints, 31);
  }
});

test("2014 level 1 imposes Disadvantage on ability checks only", () => {
  const result = resolve("2014", 1);
  assert.equal(result.abilityCheckDisadvantage, true);
  assert.equal(result.attackRollDisadvantage, false);
  assert.equal(result.savingThrowDisadvantage, false);
  assert.equal(result.d20TestModifier, 0);
});

test("2014 Speed is halved at levels 2 through 4, rounding down", () => {
  for (const level of [2, 3, 4]) {
    const result = resolve("2014", level, { baseSpeed: 35 });
    assert.equal(result.speed.kind, "halved");
    assert.equal(result.speed.multiplier, 0.5);
    assert.equal(result.speed.effectiveSpeed, 17);
  }
});

test("2014 level 3 adds attack-roll and saving-throw Disadvantage", () => {
  const result = resolve("2014", 3);
  assert.equal(result.abilityCheckDisadvantage, true);
  assert.equal(result.attackRollDisadvantage, true);
  assert.equal(result.savingThrowDisadvantage, true);
});

test("2014 level 4 halves maximum HP and uses a minimum of 1", () => {
  const odd = resolve("2014", 4, { baseMaximumHitPoints: 31 });
  assert.equal(odd.maximumHitPointsMultiplier, 0.5);
  assert.equal(odd.effectiveMaximumHitPoints, 15);

  const one = resolve("2014", 4, { baseMaximumHitPoints: 1 });
  assert.equal(one.effectiveMaximumHitPoints, 1);
});

test("2014 level 5 reduces Speed to 0", () => {
  const result = resolve("2014", 5, {
    baseSpeed: 30,
    baseMaximumHitPoints: 20,
  });
  assert.deepEqual(result.speed, {
    kind: "zero",
    multiplier: 0,
    reductionFeet: 0,
    effectiveSpeed: 0,
  });
  assert.equal(result.maximumHitPointsMultiplier, 0.5);
  assert.equal(result.effectiveMaximumHitPoints, 10);
});

test("2024 applies a numeric -2 per level to every D20 Test without Disadvantage", () => {
  for (let level = 1; level <= 5; level++) {
    const result = resolve("2024", level);
    assert.equal(result.d20TestModifier, -2 * level);
    assert.equal(result.attackRollDisadvantage, false);
    assert.equal(result.abilityCheckDisadvantage, false);
    assert.equal(result.savingThrowDisadvantage, false);
  }
});

test("2024 Speed is reduced by 5 feet per level and never below 0", () => {
  const result = resolve("2024", 3, { baseSpeed: 30 });
  assert.deepEqual(result.speed, {
    kind: "reduced",
    multiplier: 1,
    reductionFeet: 15,
    effectiveSpeed: 15,
  });

  const floor = resolve("2024", 5, { baseSpeed: 20 });
  assert.equal(floor.speed.reductionFeet, 25);
  assert.equal(floor.speed.effectiveSpeed, 0);
});

test("2024 Exhaustion does not reduce maximum HP", () => {
  const result = resolve("2024", 5, { baseMaximumHitPoints: 31 });
  assert.equal(result.maximumHitPointsMultiplier, 1);
  assert.equal(result.effectiveMaximumHitPoints, 31);
});

test("ruleset policies never leak into each other at the same level", () => {
  const legacy = resolve("2014", 4, {
    baseSpeed: 30,
    baseMaximumHitPoints: 40,
  });
  const revised = resolve("2024", 4, {
    baseSpeed: 30,
    baseMaximumHitPoints: 40,
  });

  assert.equal(legacy.abilityCheckDisadvantage, true);
  assert.equal(legacy.attackRollDisadvantage, true);
  assert.equal(legacy.maximumHitPointsMultiplier, 0.5);
  assert.equal(legacy.speed.effectiveSpeed, 15);
  assert.equal(legacy.d20TestModifier, 0);

  assert.equal(revised.abilityCheckDisadvantage, false);
  assert.equal(revised.attackRollDisadvantage, false);
  assert.equal(revised.maximumHitPointsMultiplier, 1);
  assert.equal(revised.speed.effectiveSpeed, 10);
  assert.equal(revised.d20TestModifier, -8);
});

test("level 6 returns an explicit death result without inventing Death Save failures", () => {
  const result = resolve("2024", 6);
  assert.equal(result.isDead, true);
  assert.equal(result.d20TestModifier, -12);
  assert.equal(result.speed.reductionFeet, 30);
  assert.equal(result.maximumHitPointsMultiplier, 1);
  assert.equal("deathSaveState" in result, false);
});

test("adding Exhaustion levels is cumulative and caps at death level 6", () => {
  assert.deepEqual(addExhaustionLevels({ currentLevel: 0, amount: 1 }), {
    previousLevel: 0,
    level: 1,
    levelsAdded: 1,
    isDead: false,
  });
  assert.deepEqual(addExhaustionLevels({ currentLevel: 4, amount: 2 }), {
    previousLevel: 4,
    level: 6,
    levelsAdded: 2,
    isDead: true,
  });
  assert.deepEqual(addExhaustionLevels({ currentLevel: 6, amount: 1 }), {
    previousLevel: 6,
    level: 6,
    levelsAdded: 0,
    isDead: true,
  });
  assert.deepEqual(addExhaustionLevels({ currentLevel: 2, amount: 0 }), {
    previousLevel: 2,
    level: 2,
    levelsAdded: 0,
    isDead: false,
  });
});

test("invalid Exhaustion amount and resolution inputs are rejected", () => {
  assert.throws(() => addExhaustionLevels({ currentLevel: 1, amount: -1 }), /non-negative integer/);
  assert.throws(() => addExhaustionLevels({ currentLevel: 1, amount: 1.5 }), /non-negative integer/);
  assert.throws(() => resolve("2015", 1), /ruleset must be 2014 or 2024/);
  assert.throws(() => resolve("2014", 7), /integer from 0 to 6/);
  assert.throws(() => resolve("2014", 1, { baseSpeed: -1 }), /Base Speed must be/);
  assert.throws(() => resolve("2024", 1, { baseMaximumHitPoints: 0 }), /positive integer/);
});
