const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveMovement } = require("../../.test-dist/engines/movement-engine.js");

const source = { kind: "ancestry", id: "elf", label: "Elf" };
const profile = (mode, speedFeet) => ({ mode, speedFeet, sources: [source] });
const allProfiles = [
  profile("walking", 30),
  profile("climbing", 15),
  profile("swimming", 20),
  profile("flying", 0),
  profile("burrowing", 10),
];

test("preserves absent movement modes separately from an explicit zero-Speed profile", () => {
  const result = resolveMovement({
    profiles: [profile("walking", 30), profile("flying", 0)],
  });
  assert.deepEqual(result.speedByMode, { walking: 30, flying: 0 });
  assert.equal(Object.hasOwn(result.speedByMode, "climbing"), false);
});

test("supports typed movement profiles for all five initial modes", () => {
  const result = resolveMovement({ profiles: allProfiles });
  assert.deepEqual(result.speedByMode, {
    walking: 30, climbing: 15, swimming: 20, flying: 0, burrowing: 10,
  });
});

test("applies ordered modifiers and floors fractional Speed", () => {
  const result = resolveMovement({
    profiles: [profile("walking", 30)],
    modifiers: [
      { id: "slow", mode: "walking", source, order: 2, operation: "multiply", value: 0.5 },
      { id: "bonus", mode: "walking", source, order: 1, operation: "add", value: 5 },
    ],
  });
  assert.equal(result.speedByMode.walking, 17);
  assert.deepEqual(result.appliedModifierIds, ["bonus", "slow"]);
});

test("applies the existing 2014 Exhaustion halving policy to every movement mode", () => {
  const result = resolveMovement({
    profiles: [profile("walking", 30), profile("flying", 40)],
    exhaustionSpeed: { kind: "halved", multiplier: 0.5, reductionFeet: 0 },
  });
  assert.deepEqual(result.speedByMode, { walking: 15, flying: 20 });
});

test("applies the existing 2024 Exhaustion flat reduction to every movement mode", () => {
  const result = resolveMovement({
    profiles: [profile("walking", 30), profile("climbing", 10)],
    exhaustionSpeed: { kind: "reduced", multiplier: 1, reductionFeet: 10 },
  });
  assert.deepEqual(result.speedByMode, { walking: 20, climbing: 0 });
});

test("E1 Speed-zero constraint overrides bonuses and Exhaustion output", () => {
  const result = resolveMovement({
    profiles: [profile("walking", 30)],
    modifiers: [
      { id: "haste-like", mode: "walking", source, order: 1, operation: "add", value: 20 },
    ],
    exhaustionSpeed: { kind: "halved", multiplier: 0.5, reductionFeet: 0 },
    conditionMovement: {
      speedIsZero: true,
      speedCannotIncrease: true,
      crawlAllowed: false,
      standUpMovementCost: null,
      cannotStandWhenSpeedIsZero: false,
      cannotWillinglyApproachCreatureIds: [],
      grappleDragRules: [],
    },
  });
  assert.equal(result.speedByMode.walking, 0);
  assert.deepEqual(result.blockedModifierIds, ["haste-like"]);
});

test("preserves Prone, Frightened, and Grappled movement metadata", () => {
  const movement = {
    speedIsZero: true,
    speedCannotIncrease: true,
    crawlAllowed: true,
    standUpMovementCost: "half-speed",
    cannotStandWhenSpeedIsZero: true,
    cannotWillinglyApproachCreatureIds: ["creature:fear-source"],
    grappleDragRules: [{
      grapplerCreatureId: "creature:grappler",
      extraFeetPerFootMoved: 1,
      exemptWhenTargetIsTiny: true,
      exemptWhenTargetIsAtLeastTwoSizesSmaller: true,
    }],
  };
  const result = resolveMovement({
    profiles: [profile("walking", 30)],
    conditionMovement: movement,
  });
  assert.deepEqual(result.movement, movement);
});

test("rejects duplicate profiles and invalid Speed values", () => {
  assert.throws(
    () => resolveMovement({ profiles: [profile("walking", 30), profile("walking", 35)] }),
    /Duplicate base movement profile/,
  );
  assert.throws(() => resolveMovement({ profiles: [profile("walking", -1)] }), /non-negative integer/);
});

test("rejects negative movement multipliers and duplicate modifier IDs", () => {
  assert.throws(() => resolveMovement({
    profiles: [profile("walking", 30)],
    modifiers: [{ id: "bad", mode: "walking", source, order: 1, operation: "multiply", value: -1 }],
  }), /multiplier cannot be negative/);
  assert.throws(() => resolveMovement({
    profiles: [profile("walking", 30)],
    modifiers: [
      { id: "same", mode: "walking", source, order: 1, operation: "add", value: 1 },
      { id: "same", mode: "walking", source, order: 2, operation: "add", value: 1 },
    ],
  }), /Duplicate movement modifier ID/);
});
