const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createHitDicePools,
  spendShortRestHitDie,
} = require("../../.test-dist/engines/hit-point-engine.js");

const levels = [
  { characterLevel: 1, classId: "fighter", classLevel: 1, hitDie: 10 },
  { characterLevel: 2, classId: "fighter", classLevel: 2, hitDie: 10 },
  { characterLevel: 3, classId: "rogue", classLevel: 1, hitDie: 8 },
];

const state = (overrides = {}) => ({
  currentHitPoints: 5,
  maximumHitPoints: 20,
  temporaryHitPoints: 3,
  ...overrides,
});

const pools = () => createHitDicePools(levels);

const spend = (overrides = {}) => spendShortRestHitDie({
  ruleset: "2024",
  hitPoints: state(),
  hitDicePools: pools(),
  shortRestStartedAtHitPoints: 5,
  classId: "fighter",
  roll: 6,
  constitutionScore: 14,
  ...overrides,
});

test("Hit Dice pools are grouped by class and retain each class Hit Die size", () => {
  assert.deepEqual(pools(), [
    { classId: "fighter", hitDie: 10, total: 2, spent: 0 },
    { classId: "rogue", hitDie: 8, total: 1, spent: 0 },
  ]);
});

test("Hit Dice pool creation rejects gaps, duplicate levels, and inconsistent class progression", () => {
  assert.throws(() => createHitDicePools([
    levels[0],
    { ...levels[2], characterLevel: 3 },
  ]), /without gaps/);

  assert.throws(() => createHitDicePools([
    levels[0],
    { ...levels[1], classLevel: 3 },
  ]), /consecutive/);

  assert.throws(() => createHitDicePools([
    levels[0],
    { ...levels[1], hitDie: 8 },
  ]), /Hit Die size changed/);
});

test("Hit Dice pool creation rejects invalid and over-levelled snapshots", () => {
  assert.throws(() => createHitDicePools([]), /At least one character level/);
  assert.throws(() => createHitDicePools([
    { ...levels[0], hitDie: 9 },
  ]), /Hit Die must be/);
  assert.throws(() => createHitDicePools(Array.from({ length: 21 }, (_, i) => ({
    characterLevel: i + 1,
    classId: "fighter",
    classLevel: i + 1,
    hitDie: 10,
  }))), /more than 20/);
});

test("2014 Short Rest healing has a per-die minimum of zero", () => {
  const result = spend({
    ruleset: "2014",
    hitPoints: state({ currentHitPoints: 5 }),
    shortRestStartedAtHitPoints: 5,
    roll: 1,
    constitutionScore: 6,
  });

  assert.equal(result.canSpend, true);
  assert.equal(result.healingBeforeMaximum, 0);
  assert.equal(result.hitPointsRestored, 0);
  assert.equal(result.hitPoints.currentHitPoints, 5);
  assert.equal(result.hitPoints.temporaryHitPoints, 3);
  assert.equal(result.hitDicePools[0].spent, 1);
});

test("2024 Short Rest healing has a per-die minimum of one", () => {
  const result = spend({
    ruleset: "2024",
    hitPoints: state({ currentHitPoints: 5 }),
    shortRestStartedAtHitPoints: 5,
    roll: 1,
    constitutionScore: 6,
  });

  assert.equal(result.canSpend, true);
  assert.equal(result.healingBeforeMaximum, 1);
  assert.equal(result.hitPointsRestored, 1);
  assert.equal(result.hitPoints.currentHitPoints, 6);
  assert.equal(result.hitPoints.temporaryHitPoints, 3);
  assert.equal(result.hitDicePools[0].spent, 1);
});

test("2024 Short Rest requires at least one HP at the beginning of the rest", () => {
  const result = spend({
    ruleset: "2024",
    hitPoints: state({ currentHitPoints: 0 }),
    shortRestStartedAtHitPoints: 0,
  });

  assert.equal(result.canSpend, false);
  assert.equal(result.issue.code, "short-rest-requires-positive-hit-points");
  assert.equal(result.hitPoints.currentHitPoints, 0);
  assert.equal(result.hitDicePools[0].spent, 0);
});

test("2014 does not inherit the 2024 positive-HP Short Rest start restriction", () => {
  const result = spend({
    ruleset: "2014",
    hitPoints: state({ currentHitPoints: 0 }),
    shortRestStartedAtHitPoints: 0,
    roll: 6,
    constitutionScore: 14,
  });

  assert.equal(result.canSpend, true);
  assert.equal(result.hitPoints.currentHitPoints, 8);
  assert.equal(result.hitDicePools[0].spent, 1);
});

test("spending a Hit Die changes only the selected class pool", () => {
  const result = spend({ classId: "rogue", roll: 4 });
  assert.equal(result.canSpend, true);
  assert.equal(result.hitDie, 8);
  assert.deepEqual(result.hitDicePools, [
    { classId: "fighter", hitDie: 10, total: 2, spent: 0 },
    { classId: "rogue", hitDie: 8, total: 1, spent: 1 },
  ]);
});

test("each Hit Die decision is incremental and the returned snapshot can be used for the next die", () => {
  const first = spend({ classId: "fighter", roll: 4 });
  const second = spend({
    hitPoints: first.hitPoints,
    hitDicePools: first.hitDicePools,
    classId: "fighter",
    roll: 7,
  });

  assert.equal(first.hitDicePools[0].spent, 1);
  assert.equal(second.hitDicePools[0].spent, 2);
  assert.equal(second.hitPoints.currentHitPoints, 20);
  assert.equal(second.hitPoints.temporaryHitPoints, 3);
});

test("spending from an exhausted class pool is refused without changing state", () => {
  const exhausted = pools().map((pool) =>
    pool.classId === "fighter" ? { ...pool, spent: pool.total } : pool,
  );
  const result = spend({ hitDicePools: exhausted });

  assert.equal(result.canSpend, false);
  assert.equal(result.issue.code, "no-hit-dice-remaining");
  assert.deepEqual(result.hitDicePools, exhausted);
  assert.equal(result.hitPoints.currentHitPoints, 5);
});

test("unknown class pool is reported without consuming another class Hit Die", () => {
  const result = spend({ classId: "barbarian" });

  assert.equal(result.canSpend, false);
  assert.equal(result.issue.code, "unknown-hit-die-pool");
  assert.deepEqual(result.hitDicePools, pools());
});

test("Hit Die healing is capped at maximum HP and does not change Temporary HP", () => {
  const result = spend({
    hitPoints: state({ currentHitPoints: 19 }),
    shortRestStartedAtHitPoints: 19,
    roll: 10,
  });

  assert.equal(result.healingBeforeMaximum, 12);
  assert.equal(result.hitPointsRestored, 1);
  assert.equal(result.hitPoints.currentHitPoints, 20);
  assert.equal(result.hitPoints.temporaryHitPoints, 3);
  assert.equal(result.hitDicePools[0].spent, 1);
});

test("invalid ruleset, roll, rest snapshot, pools, and class IDs are rejected", () => {
  assert.throws(() => spend({ ruleset: "2012" }), /ruleset/);
  assert.throws(() => spend({ roll: 0 }), /positive integer/);
  assert.throws(() => spend({ roll: 11 }), /from 1 to 10/);
  assert.throws(() => spend({ shortRestStartedAtHitPoints: -1 }), /non-negative integer/);
  assert.throws(() => spend({ shortRestStartedAtHitPoints: 21 }), /cannot exceed maximum/);
  assert.throws(() => spend({ classId: "" }), /class ID/);
  assert.throws(() => spend({ hitDicePools: [
    { classId: "fighter", hitDie: 10, total: 2, spent: 0 },
    { classId: "fighter", hitDie: 10, total: 1, spent: 0 },
  ] }), /Duplicate Hit Dice pool/);
  assert.throws(() => spend({ hitDicePools: [
    { classId: "fighter", hitDie: 10, total: 2, spent: 3 },
  ] }), /Spent Hit Dice/);
  assert.throws(() => spend({ hitDicePools: [
    { classId: "fighter", hitDie: 10, total: 21, spent: 0 },
  ] }), /Total Hit Dice/);
});
