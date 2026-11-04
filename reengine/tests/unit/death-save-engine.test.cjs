const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createDeathSaveState,
  applyDamageWithDeathSaveState,
  makeDeathSavingThrow,
  stabilizeCharacter,
  recoverStableCharacter,
  applyHealingWithDeathSaveState,
} = require("../../.test-dist/engines/death-save-engine.js");

const hp = (overrides = {}) => ({
  currentHitPoints: 0,
  maximumHitPoints: 20,
  temporaryHitPoints: 0,
  ...overrides,
});
const death = (overrides = {}) => ({
  status: "active",
  successes: 0,
  failures: 0,
  ...overrides,
});

test("new Death Save state starts active with empty tallies", () => {
  assert.deepEqual(createDeathSaveState(), {
    status: "active",
    successes: 0,
    failures: 0,
  });
});

test("Death Saving Throws use DC 10 and keep success/failure tallies non-consecutive", () => {
  const first = makeDeathSavingThrow({ hitPoints: hp(), deathSaveState: death(), roll: 10 });
  const second = makeDeathSavingThrow({ hitPoints: hp(), deathSaveState: first.deathSaveState, roll: 4 });
  const third = makeDeathSavingThrow({ hitPoints: hp(), deathSaveState: second.deathSaveState, roll: 15 });

  assert.equal(first.outcome, "success");
  assert.equal(second.outcome, "failure");
  assert.deepEqual(second.deathSaveState, { status: "active", successes: 1, failures: 1 });
  assert.deepEqual(third.deathSaveState, { status: "active", successes: 2, failures: 1 });
});

test("three successful Death Saves make the character Stable and reset both tallies", () => {
  const first = makeDeathSavingThrow({ hitPoints: hp(), deathSaveState: death(), roll: 10 });
  const second = makeDeathSavingThrow({ hitPoints: hp(), deathSaveState: first.deathSaveState, roll: 20 });
  // A natural 20 restores 1 HP, so use three ordinary successes for stabilization.
  assert.equal(second.outcome, "regained-1-hit-point");

  const a = makeDeathSavingThrow({ hitPoints: hp(), deathSaveState: death(), roll: 10 });
  const b = makeDeathSavingThrow({ hitPoints: hp(), deathSaveState: a.deathSaveState, roll: 12 });
  const c = makeDeathSavingThrow({ hitPoints: hp(), deathSaveState: b.deathSaveState, roll: 19 });
  assert.equal(c.outcome, "stable");
  assert.deepEqual(c.deathSaveState, { status: "stable", successes: 0, failures: 0 });
});

test("three failed Death Saves cause death", () => {
  const first = makeDeathSavingThrow({ hitPoints: hp(), deathSaveState: death(), roll: 9 });
  const second = makeDeathSavingThrow({ hitPoints: hp(), deathSaveState: first.deathSaveState, roll: 2 });
  const third = makeDeathSavingThrow({ hitPoints: hp(), deathSaveState: second.deathSaveState, roll: 8 });

  assert.equal(second.deathSaveState.failures, 2);
  assert.equal(third.outcome, "dead");
  assert.equal(third.deathSaveState.status, "dead");
  assert.equal(third.deathSaveState.failures, 3);
});

test("a natural 1 counts as two failures and can immediately cause death", () => {
  const result = makeDeathSavingThrow({
    hitPoints: hp(),
    deathSaveState: death({ failures: 1, successes: 2 }),
    roll: 1,
  });
  assert.equal(result.outcome, "dead");
  assert.deepEqual(result.deathSaveState, { status: "dead", successes: 2, failures: 3 });
});

test("a natural 20 restores 1 HP and clears both Death Save tallies", () => {
  const result = makeDeathSavingThrow({
    hitPoints: hp({ temporaryHitPoints: 4 }),
    deathSaveState: death({ successes: 1, failures: 2 }),
    roll: 20,
  });

  assert.equal(result.outcome, "regained-1-hit-point");
  assert.equal(result.hitPoints.currentHitPoints, 1);
  assert.equal(result.hitPoints.temporaryHitPoints, 4);
  assert.deepEqual(result.deathSaveState, { status: "active", successes: 0, failures: 0 });
});

test("damage while at 0 HP causes one failure even when Temporary HP absorbs it", () => {
  const result = applyDamageWithDeathSaveState({
    hitPoints: hp({ temporaryHitPoints: 3 }),
    deathSaveState: death(),
    amount: 2,
  });

  assert.equal(result.outcome, "death-save-failure");
  assert.equal(result.hitPoints.temporaryHitPoints, 1);
  assert.equal(result.deathSaveState.failures, 1);
});

test("a Critical Hit at 0 HP causes two Death Save failures", () => {
  const result = applyDamageWithDeathSaveState({
    hitPoints: hp(),
    deathSaveState: death(),
    amount: 4,
    isCritical: true,
  });

  assert.equal(result.outcome, "death-save-failure");
  assert.equal(result.deathSaveState.failures, 2);
});

test("damage at 0 HP equal to the HP maximum causes instant death", () => {
  const result = applyDamageWithDeathSaveState({
    hitPoints: hp({ temporaryHitPoints: 8 }),
    deathSaveState: death(),
    amount: 20,
  });

  assert.equal(result.outcome, "dead");
  assert.equal(result.deathSaveState.status, "dead");
  assert.equal(result.hitPoints.currentHitPoints, 0);
});

test("massive damage on the blow that drops a character to 0 HP causes instant death", () => {
  const result = applyDamageWithDeathSaveState({
    hitPoints: hp({ currentHitPoints: 3, temporaryHitPoints: 2 }),
    deathSaveState: death(),
    amount: 25,
  });

  assert.equal(result.damageResult.excessDamage, 20);
  assert.equal(result.outcome, "dead");
});

test("damage below massive-damage threshold drops a character to 0 HP and starts Death Saves", () => {
  const result = applyDamageWithDeathSaveState({
    hitPoints: hp({ currentHitPoints: 3, temporaryHitPoints: 2 }),
    deathSaveState: death(),
    amount: 24,
  });

  assert.equal(result.damageResult.excessDamage, 19);
  assert.equal(result.outcome, "unconscious");
  assert.deepEqual(result.deathSaveState, { status: "active", successes: 0, failures: 0 });
});

test("damage while Stable ends Stability and adds a Death Save failure", () => {
  const result = applyDamageWithDeathSaveState({
    hitPoints: hp({ temporaryHitPoints: 1 }),
    deathSaveState: death({ status: "stable" }),
    amount: 1,
  });

  assert.equal(result.outcome, "stability-ended");
  assert.deepEqual(result.deathSaveState, { status: "active", successes: 0, failures: 1 });
});

test("ordinary damage that leaves positive HP does not change Death Save state", () => {
  const result = applyDamageWithDeathSaveState({
    hitPoints: hp({ currentHitPoints: 5 }),
    deathSaveState: death(),
    amount: 2,
  });

  assert.equal(result.outcome, "hit-points-remain");
  assert.equal(result.hitPoints.currentHitPoints, 3);
  assert.deepEqual(result.deathSaveState, death());
});

test("2014 stabilizes with an Action and a DC 10 Medicine check", () => {
  const result = stabilizeCharacter({
    ruleset: "2014",
    hitPoints: hp(),
    deathSaveState: death({ failures: 2, successes: 1 }),
    method: "medicine-check",
    medicineCheckTotal: 10,
  });

  assert.equal(result.stabilized, true);
  assert.equal(result.actionType, "action");
  assert.deepEqual(result.deathSaveState, { status: "stable", successes: 0, failures: 0 });
});

test("2024 stabilizes with the Help action and a DC 10 Medicine check", () => {
  const result = stabilizeCharacter({
    ruleset: "2024",
    hitPoints: hp(),
    deathSaveState: death(),
    method: "medicine-check",
    medicineCheckTotal: 12,
  });

  assert.equal(result.stabilized, true);
  assert.equal(result.actionType, "help");
  assert.equal(result.deathSaveState.status, "stable");
});

test("a failed Medicine check does not stabilize or reset the tallies", () => {
  const result = stabilizeCharacter({
    ruleset: "2024",
    hitPoints: hp(),
    deathSaveState: death({ failures: 2, successes: 1 }),
    method: "medicine-check",
    medicineCheckTotal: 9,
  });

  assert.equal(result.stabilized, false);
  assert.equal(result.actionType, "help");
  assert.equal(result.issue.code, "medicine-check-failed");
  assert.deepEqual(result.deathSaveState, death({ failures: 2, successes: 1 }));
});

test("Healer's Kit stabilization uses an Action in 2014 and Utilize in 2024", () => {
  const oldRules = stabilizeCharacter({
    ruleset: "2014",
    hitPoints: hp(),
    deathSaveState: death(),
    method: "healer-kit",
    healerKitUsesRemaining: 2,
  });
  const newRules = stabilizeCharacter({
    ruleset: "2024",
    hitPoints: hp(),
    deathSaveState: death(),
    method: "healer-kit",
    healerKitUsesRemaining: 2,
  });

  assert.equal(oldRules.actionType, "action");
  assert.equal(newRules.actionType, "utilize");
  assert.equal(oldRules.healerKitUsesRemaining, 1);
  assert.equal(newRules.healerKitUsesRemaining, 1);
  assert.equal(oldRules.stabilized, true);
  assert.equal(newRules.stabilized, true);
});

test("a Healer's Kit with no uses cannot stabilize", () => {
  const result = stabilizeCharacter({
    ruleset: "2024",
    hitPoints: hp(),
    deathSaveState: death(),
    method: "healer-kit",
    healerKitUsesRemaining: 0,
  });
  assert.equal(result.stabilized, false);
  assert.equal(result.issue.code, "no-healer-kit-uses");
  assert.equal(result.healerKitUsesRemaining, 0);
});

test("a Stable character regains 1 HP after the caller's 1d4-hour recovery event", () => {
  const result = recoverStableCharacter(
    hp(),
    death({ status: "stable" }),
  );
  assert.equal(result.recovered, true);
  assert.equal(result.hitPoints.currentHitPoints, 1);
  assert.deepEqual(result.deathSaveState, death());
});

test("healing any HP clears Death Save tallies and ends Stability", () => {
  const result = applyHealingWithDeathSaveState(
    hp(),
    death({ successes: 1, failures: 2 }),
    3,
  );
  assert.equal(result.hitPoints.currentHitPoints, 3);
  assert.equal(result.revived, true);
  assert.deepEqual(result.deathSaveState, death());

  const stable = applyHealingWithDeathSaveState(
    hp(),
    death({ status: "stable" }),
    1,
  );
  assert.equal(stable.hitPoints.currentHitPoints, 1);
  assert.equal(stable.deathSaveState.status, "active");
});

test("Death Save operations reject invalid rolls, states, and dead-character transitions", () => {
  assert.throws(() => makeDeathSavingThrow({
    hitPoints: hp(),
    deathSaveState: death(),
    roll: 21,
  }), /1 to 20/);

  assert.throws(() => makeDeathSavingThrow({
    hitPoints: hp({ currentHitPoints: 1 }),
    deathSaveState: death(),
    roll: 10,
  }), /Death Save tallies reset/);

  assert.throws(() => stabilizeCharacter({
    ruleset: "2014",
    hitPoints: hp(),
    deathSaveState: death(),
    method: "medicine-check",
  }), /Medicine.*total/);

  assert.throws(() => applyDamageWithDeathSaveState({
    hitPoints: hp(),
    deathSaveState: death(),
    amount: 1,
    isCritical: "yes",
  }), /Critical-hit flag/);

  assert.throws(() => applyHealingWithDeathSaveState(
    hp(),
    death({ status: "dead", failures: 3 }),
    5,
  ), /dead character/);
});
