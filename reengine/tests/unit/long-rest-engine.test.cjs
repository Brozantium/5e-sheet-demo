const test = require("node:test");
const assert = require("node:assert/strict");
const { completeLongRest } = require("../../.test-dist/engines/long-rest-engine.js");

const hitDicePools = () => [
  { classId: "fighter", hitDie: 10, total: 3, spent: 2 },
  { classId: "rogue", hitDie: 8, total: 1, spent: 1 },
];

const resources = () => [
  { id: "second-wind", maximum: 3, current: 0, recovery: "short-rest" },
  { id: "action-surge", maximum: 1, current: 0, recovery: "short-rest" },
  { id: "spell-slots", maximum: 4, current: 1, recovery: "long-rest" },
  { id: "daily-charge", maximum: 2, current: 0, recovery: "dawn" },
  { id: "manual-resource", maximum: 5, current: 2, recovery: "manual" },
];

const input = (overrides = {}) => ({
  ruleset: "2024",
  hitPointsAtStart: 5,
  hitPoints: {
    currentHitPoints: 5,
    maximumHitPoints: 20,
    temporaryHitPoints: 4,
  },
  hitDicePools: hitDicePools(),
  resources: resources(),
  exhaustionLevel: 2,
  startedAtMinute: 10000,
  completedAtMinute: 10480,
  sleepMinutes: 360,
  lightActivityMinutes: 120,
  interruptions: [],
  hitDiceRecoveryChoices: [],
  foodAndDrinkConsumed: false,
  ...overrides,
});

test("2014 Long Rest restores all HP and player-selected Hit Dice up to half total", () => {
  const result = completeLongRest(input({
    ruleset: "2014",
    startedAtMinute: 2000,
    completedAtMinute: 2480,
    lastLongRestCompletedAtMinute: 500,
    hitDiceRecoveryChoices: [
      { classId: "fighter", count: 1 },
      { classId: "rogue", count: 1 },
    ],
    foodAndDrinkConsumed: true,
  }));

  assert.equal(result.completed, true);
  assert.equal(result.hitPoints.currentHitPoints, 20);
  assert.equal(result.hitPoints.temporaryHitPoints, 4);
  assert.equal(result.hitDiceRecoveryLimit, 2);
  assert.equal(result.hitDiceRecovered, 2);
  assert.deepEqual(result.hitDicePools, [
    { classId: "fighter", hitDie: 10, total: 3, spent: 1 },
    { classId: "rogue", hitDie: 8, total: 1, spent: 0 },
  ]);
  assert.equal(result.exhaustionLevel, 1);
});

test("2014 Long Rest restores at least one Hit Die when the character has spent any and total HD is odd", () => {
  const result = completeLongRest(input({
    ruleset: "2014",
    startedAtMinute: 3000,
    completedAtMinute: 3480,
    lastLongRestCompletedAtMinute: 1000,
    hitDicePools: [
      { classId: "wizard", hitDie: 6, total: 1, spent: 1 },
    ],
    hitDiceRecoveryChoices: [{ classId: "wizard", count: 1 }],
  }));

  assert.equal(result.completed, true);
  assert.equal(result.hitDiceRecoveryLimit, 1);
  assert.equal(result.hitDiceRecovered, 1);
  assert.equal(result.hitDicePools[0].spent, 0);
});

test("2014 Long Rest restores no Exhaustion without food and drink", () => {
  const result = completeLongRest(input({
    ruleset: "2014",
    startedAtMinute: 2000,
    completedAtMinute: 2480,
    lastLongRestCompletedAtMinute: 500,
    foodAndDrinkConsumed: false,
    hitDiceRecoveryChoices: [],
  }));
  assert.equal(result.completed, true);
  assert.equal(result.exhaustionLevel, 2);
});

test("2024 Long Rest restores all expended Hit Dice automatically and removes one Exhaustion level", () => {
  const result = completeLongRest(input({
    ruleset: "2024",
    startedAtMinute: 3000,
    completedAtMinute: 3480,
    lastLongRestCompletedAtMinute: 2040,
    hitDiceRecoveryChoices: [],
  }));

  assert.equal(result.completed, true);
  assert.equal(result.hitDiceRecoveryLimit, 3);
  assert.equal(result.hitDiceRecovered, 3);
  assert.deepEqual(result.hitDicePools.map(pool => pool.spent), [0, 0]);
  assert.equal(result.exhaustionLevel, 1);
});

test("Long Rest restores Short Rest and Long Rest resources through the existing resource policy", () => {
  const result = completeLongRest(input({
    startedAtMinute: 3000,
    completedAtMinute: 3480,
    lastLongRestCompletedAtMinute: 2040,
  }));
  const byId = Object.fromEntries(result.resources.map(entry => [entry.id, entry.current]));

  assert.equal(byId["second-wind"], 3);
  assert.equal(byId["action-surge"], 1);
  assert.equal(byId["spell-slots"], 4);
  assert.equal(byId["daily-charge"], 0);
  assert.equal(byId["manual-resource"], 2);
});

test("Temporary HP is not reset by completing a Long Rest", () => {
  const result = completeLongRest(input({
    hitPoints: {
      currentHitPoints: 2,
      maximumHitPoints: 20,
      temporaryHitPoints: 7,
    },
  }));
  assert.equal(result.hitPoints.currentHitPoints, 20);
  assert.equal(result.hitPoints.temporaryHitPoints, 7);
});

test("2014 cannot benefit from another Long Rest until 24 hours after the previous benefit", () => {
  const tooSoonByFinish = completeLongRest(input({
    ruleset: "2014",
    startedAtMinute: 3000,
    completedAtMinute: 3480,
    lastLongRestCompletedAtMinute: 2041,
    hitDiceRecoveryChoices: [],
  }));
  assert.equal(tooSoonByFinish.completed, false);
  assert.equal(tooSoonByFinish.issue.code, "long-rest-too-soon");

  const enoughTimeByFinish = completeLongRest(input({
    ruleset: "2014",
    startedAtMinute: 3000,
    completedAtMinute: 3480,
    lastLongRestCompletedAtMinute: 2040,
    hitDiceRecoveryChoices: [],
  }));
  assert.equal(enoughTimeByFinish.completed, true);
});

test("2024 requires 16 hours after the previous Long Rest before starting another", () => {
  const tooSoon = completeLongRest(input({
    ruleset: "2024",
    startedAtMinute: 3000,
    completedAtMinute: 3480,
    lastLongRestCompletedAtMinute: 2041,
  }));
  assert.equal(tooSoon.completed, false);
  assert.equal(tooSoon.issue.code, "long-rest-too-soon");

  const exactlyReady = completeLongRest(input({
    ruleset: "2024",
    startedAtMinute: 3001,
    completedAtMinute: 3481,
    lastLongRestCompletedAtMinute: 2041,
  }));
  assert.equal(exactlyReady.completed, true);
});

test("both rulesets require at least 1 HP at the start of a Long Rest", () => {
  for (const ruleset of ["2014", "2024"]) {
    const result = completeLongRest(input({
      ruleset,
      hitPointsAtStart: 0,
      hitPoints: { currentHitPoints: 0, maximumHitPoints: 20, temporaryHitPoints: 0 },
    }));
    assert.equal(result.completed, false);
    assert.equal(result.issue.code, "requires-positive-hit-points");
  }
});

test("2014 Long Rest must restart after at least one hour of strenuous activity", () => {
  const result = completeLongRest(input({
    ruleset: "2014",
    startedAtMinute: 3000,
    completedAtMinute: 3600,
    lastLongRestCompletedAtMinute: 2040,
    interruptions: [
      { kind: "strenuous-activity", minuteFromStart: 120, durationMinutes: 60 },
    ],
    hitDiceRecoveryChoices: [],
  }));
  assert.equal(result.completed, false);
  assert.equal(result.issue.code, "restart-required");
});

test("2024 interruptions add one hour each to the required Long Rest duration", () => {
  const tooShort = completeLongRest(input({
    ruleset: "2024",
    startedAtMinute: 3000,
    completedAtMinute: 3480,
    lastLongRestCompletedAtMinute: 2040,
    interruptions: [
      { kind: "initiative", minuteFromStart: 120 },
      { kind: "damage", minuteFromStart: 240 },
    ],
  }));
  assert.equal(tooShort.completed, false);
  assert.equal(tooShort.additionalHoursRequired, 2);
  assert.equal(tooShort.issue.code, "insufficient-duration");

  const enough = completeLongRest(input({
    ruleset: "2024",
    startedAtMinute: 3000,
    completedAtMinute: 3600,
    lastLongRestCompletedAtMinute: 2040,
    interruptions: [
      { kind: "initiative", minuteFromStart: 120 },
      { kind: "damage", minuteFromStart: 240 },
    ],
  }));
  assert.equal(enough.completed, true);
  assert.equal(enough.additionalHoursRequired, 2);
});

test("2024 interruption after one hour grants Short Rest eligibility even when the Long Rest is unfinished", () => {
  const result = completeLongRest(input({
    ruleset: "2024",
    startedAtMinute: 3000,
    completedAtMinute: 3300,
    lastLongRestCompletedAtMinute: 2040,
    sleepMinutes: 60,
    lightActivityMinutes: 0,
    interruptions: [{ kind: "initiative", minuteFromStart: 60 }],
  }));
  assert.equal(result.completed, false);
  assert.equal(result.shortRestEarnedFromInterruption, true);
});

test("2024 non-cantrip spell and damage interruptions count; sub-hour exertion does not", () => {
  const result = completeLongRest(input({
    ruleset: "2024",
    startedAtMinute: 3000,
    completedAtMinute: 5400,
    lastLongRestCompletedAtMinute: 2040,
    interruptions: [
      { kind: "non-cantrip-spell", minuteFromStart: 60 },
      { kind: "physical-exertion", minuteFromStart: 180, durationMinutes: 40 },
      { kind: "damage", minuteFromStart: 240 },
    ],
  }));
  assert.equal(result.completed, true);
  assert.equal(result.additionalHoursRequired, 2);
  assert.equal(result.shortRestEarnedFromInterruption, true);
});

test("Long Rest requires at least six hours of sleep and no more than two hours of light activity", () => {
  const notEnoughSleep = completeLongRest(input({ sleepMinutes: 359 }));
  assert.equal(notEnoughSleep.completed, false);
  assert.equal(notEnoughSleep.issue.code, "insufficient-sleep");

  const tooMuchLight = completeLongRest(input({
    completedAtMinute: 10540,
    lightActivityMinutes: 121,
  }));
  assert.equal(tooMuchLight.completed, false);
  assert.equal(tooMuchLight.issue.code, "too-much-light-activity");
});

test("2014 Hit Dice recovery enforces the total and per-class pool limits", () => {
  assert.throws(() => completeLongRest(input({
    ruleset: "2014",
    hitDiceRecoveryChoices: [
      { classId: "fighter", count: 2 },
      { classId: "rogue", count: 1 },
    ],
  })), /cannot exceed 2/);

  assert.throws(() => completeLongRest(input({
    ruleset: "2014",
    hitDiceRecoveryChoices: [
      { classId: "fighter", count: 1 },
      { classId: "fighter", count: 1 },
    ],
  })), /Duplicate Hit Dice recovery choice/);

  assert.throws(() => completeLongRest(input({
    ruleset: "2014",
    hitDiceRecoveryChoices: [{ classId: "fighter", count: 3 }],
  })), /Cannot recover more spent Hit Dice/);

  const noChoice = completeLongRest(input({
    ruleset: "2014",
    hitDiceRecoveryChoices: [],
  }));
  assert.equal(noChoice.completed, true);
  assert.equal(noChoice.hitDiceRecovered, 0);
});

test("2024 Long Rest rejects manually selected Hit Dice recovery", () => {
  assert.throws(() => completeLongRest(input({
    hitDiceRecoveryChoices: [{ classId: "fighter", count: 1 }],
  })), /automatically restores/);
});

test("Long Rest rejects malformed times, resource snapshots, and Hit Dice pools", () => {
  assert.throws(() => completeLongRest(input({
    completedAtMinute: 9999,
    startedAtMinute: 10000,
  })), /cannot precede/);
  assert.throws(() => completeLongRest(input({
    hitPointsAtStart: -1,
  })), /starting Hit Points/);
  assert.throws(() => completeLongRest(input({
    sleepMinutes: -1,
  })), /non-negative integer/);
  assert.throws(() => completeLongRest(input({
    resources: [
      { id: "same", maximum: 2, current: 1, recovery: "long-rest" },
      { id: "same", maximum: 2, current: 1, recovery: "long-rest" },
    ],
  })), /Duplicate Long Rest resource/);
  assert.throws(() => completeLongRest(input({
    hitDicePools: [
      { classId: "fighter", hitDie: 10, total: 2, spent: 3 },
    ],
  })), /Spent Hit Dice/);
});


test("2024 Long Rest restores a reduced HP maximum when its normal maximum is supplied", () => {
  const result = completeLongRest(input({
    ruleset: "2024",
    hitPoints: {
      currentHitPoints: 15,
      maximumHitPoints: 20,
      temporaryHitPoints: 2,
    },
    restorableMaximumHitPoints: 25,
  }));

  assert.equal(result.restoresReducedHitPointMaximum, true);
  assert.equal(result.hitPoints.maximumHitPoints, 25);
  assert.equal(result.hitPoints.currentHitPoints, 25);
  assert.equal(result.hitPoints.temporaryHitPoints, 2);
});

test("2014 Long Rest does not apply the 2024 maximum HP restoration rule", () => {
  const result = completeLongRest(input({
    ruleset: "2014",
    startedAtMinute: 3000,
    completedAtMinute: 3480,
    lastLongRestCompletedAtMinute: 2040,
    hitPoints: {
      currentHitPoints: 15,
      maximumHitPoints: 20,
      temporaryHitPoints: 2,
    },
    restorableMaximumHitPoints: 25,
    hitDiceRecoveryChoices: [],
  }));

  assert.equal(result.restoresReducedHitPointMaximum, false);
  assert.equal(result.hitPoints.maximumHitPoints, 20);
  assert.equal(result.hitPoints.currentHitPoints, 20);
});

test("2024 Long Rest restores supplied reduced ability scores to their normal values", () => {
  const scores = { str: 10, dex: 12, con: 14, int: 8, wis: 9, cha: 16 };
  const result = completeLongRest(input({
    abilityScores: scores,
    restorableAbilityScores: { int: 12, wis: 12 },
  }));

  assert.equal(result.restoresReducedAbilityScores, true);
  assert.deepEqual(result.abilityScores, {
    str: 10, dex: 12, con: 14, int: 12, wis: 12, cha: 16,
  });
});

test("2014 Long Rest does not apply the 2024 ability score restoration rule", () => {
  const scores = { str: 10, dex: 12, con: 14, int: 8, wis: 9, cha: 16 };
  const result = completeLongRest(input({
    ruleset: "2014",
    startedAtMinute: 3000,
    completedAtMinute: 3480,
    lastLongRestCompletedAtMinute: 2040,
    abilityScores: scores,
    restorableAbilityScores: { int: 12, wis: 12 },
    hitDiceRecoveryChoices: [],
  }));

  assert.equal(result.restoresReducedAbilityScores, false);
  assert.deepEqual(result.abilityScores, scores);
});

test("Long Rest rejects invalid normal HP maxima and ability restoration values", () => {
  assert.throws(() => completeLongRest(input({
    restorableMaximumHitPoints: 19,
  })), /no lower than the current maximum/);

  assert.throws(() => completeLongRest(input({
    abilityScores: { str: 10, dex: 12, con: 14, int: 8, wis: 9, cha: 16 },
    restorableAbilityScores: { wis: 7 },
  })), /cannot be lower than its current score/);

  assert.throws(() => completeLongRest(input({
    abilityScores: { str: 10, dex: 12, con: 14, int: 8, wis: 9, cha: 16 },
    restorableAbilityScores: { luck: 12 },
  })), /ability IDs/);
});
