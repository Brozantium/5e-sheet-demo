const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveConditionLifecycle,
} = require("../../.test-dist/engines/condition-lifecycle-engine.js");

const AFFECTED = "creature:pc";
const SOURCE = "creature:source";

const condition = (id, expiresOn, overrides = {}) => ({
  id,
  type: "poisoned",
  affectedCreatureId: AFFECTED,
  source: { kind: "manual", label: "Manual" },
  expiresOn,
  ...overrides,
});

const event = (eventId, sequence, overrides) => ({
  eventId,
  sequence,
  ...overrides,
});

const resolve = (conditions, events) =>
  resolveConditionLifecycle({
    affectedCreatureId: AFFECTED,
    conditions,
    events,
  });

test("manual removal removes exactly the selected instance regardless of its automatic expiry", () => {
  const first = condition("condition:first", [{ kind: "rest", rest: "long" }]);
  const second = condition("condition:second", [{ kind: "manual" }]);
  const result = resolve(
    [first, second],
    [event("manual-remove:first", 1, { kind: "manual-remove", conditionId: first.id })],
  );

  assert.deepEqual(result.removedConditionIds, [first.id]);
  assert.deepEqual(result.remainingConditions.map((entry) => entry.id), [second.id]);
});

test("Short Rest expires short-rest instances only and preserves Long Rest/Dawn instances", () => {
  const short = condition("short", [{ kind: "rest", rest: "short" }]);
  const long = condition("long", [{ kind: "rest", rest: "long" }]);
  const dawn = condition("dawn", [{ kind: "rest", rest: "dawn" }]);
  const result = resolve(
    [short, long, dawn],
    [event("short-rest", 1, { kind: "rest-completed", rest: "short" })],
  );

  assert.deepEqual(result.removedConditionIds, ["short"]);
  assert.deepEqual(result.remainingConditions.map((entry) => entry.id), ["long", "dawn"]);
});

test("Long Rest expires both short and long rest instances but preserves Dawn/manual instances", () => {
  const short = condition("short", [{ kind: "rest", rest: "short" }]);
  const long = condition("long", [{ kind: "rest", rest: "long" }]);
  const dawn = condition("dawn", [{ kind: "rest", rest: "dawn" }]);
  const manual = condition("manual", [{ kind: "manual" }]);
  const result = resolve(
    [short, long, dawn, manual],
    [event("long-rest", 1, { kind: "rest-completed", rest: "long" })],
  );

  assert.deepEqual(result.removedConditionIds, ["short", "long"]);
  assert.deepEqual(result.remainingConditions.map((entry) => entry.id), ["dawn", "manual"]);
});

test("Dawn expires only Dawn instances", () => {
  const dawn = condition("dawn", [{ kind: "rest", rest: "dawn" }]);
  const long = condition("long", [{ kind: "rest", rest: "long" }]);
  const result = resolve(
    [dawn, long],
    [event("dawn", 1, { kind: "rest-completed", rest: "dawn" })],
  );
  assert.deepEqual(result.removedConditionIds, ["dawn"]);
  assert.deepEqual(result.remainingConditions.map((entry) => entry.id), ["long"]);
});

test("turn expiry honors creature identity, boundary, and turns elapsed since application", () => {
  const timed = condition(
    "turn-timed",
    [{ kind: "turn", creatureId: AFFECTED, boundary: "end", afterTurns: 1 }],
    { appliedAt: { sequence: 1, turn: 10, turnOwnerId: AFFECTED } },
  );
  const wrongCreature = event("wrong-creature", 2, {
    kind: "turn-boundary", creatureId: SOURCE, boundary: "end", turnIndex: 11,
  });
  const wrongBoundary = event("wrong-boundary", 3, {
    kind: "turn-boundary", creatureId: AFFECTED, boundary: "start", turnIndex: 11,
  });
  const matching = event("matching-turn", 4, {
    kind: "turn-boundary", creatureId: AFFECTED, boundary: "end", turnIndex: 11,
  });
  const result = resolve([timed], [wrongCreature, wrongBoundary, matching]);

  assert.deepEqual(result.removedConditionIds, ["turn-timed"]);
  assert.deepEqual(result.processedEventIds, [
    "wrong-creature", "wrong-boundary", "matching-turn",
  ]);
});

test("turn expiry does not fire on the same indexed turn as application", () => {
  const timed = condition(
    "turn-timed",
    [{ kind: "turn", creatureId: AFFECTED, boundary: "end", afterTurns: 1 }],
    { appliedAt: { sequence: 1, turn: 10 } },
  );
  const result = resolve([timed], [
    event("same-turn", 2, {
      kind: "turn-boundary", creatureId: AFFECTED, boundary: "end", turnIndex: 10,
    }),
  ]);
  assert.deepEqual(result.removedConditionIds, []);
  assert.equal(result.remainingConditions.length, 1);
});

test("round expiry waits for the configured number of rounds", () => {
  const timed = condition(
    "round-timed",
    [{ kind: "round", boundary: "start", afterRounds: 2 }],
    { appliedAt: { sequence: 1, round: 4 } },
  );
  const first = event("round-five", 2, { kind: "round-boundary", boundary: "start", round: 5 });
  const second = event("round-six", 3, { kind: "round-boundary", boundary: "start", round: 6 });
  const result = resolve([timed], [first, second]);

  assert.deepEqual(result.removedConditionIds, ["round-timed"]);
  assert.deepEqual(result.remainingConditions, []);
});

test("elapsed-time expiry uses exact timestamp threshold", () => {
  const timed = condition(
    "minute-timed",
    [{ kind: "elapsed-time", minutes: 30 }],
    { appliedAt: { sequence: 1, timestampMs: 1_000_000 } },
  );
  const before = event("29-minutes", 2, {
    kind: "time-advanced", timestampMs: 1_000_000 + 29 * 60_000,
  });
  const atThreshold = event("30-minutes", 3, {
    kind: "time-advanced", timestampMs: 1_000_000 + 30 * 60_000,
  });
  const result = resolve([timed], [before, atThreshold]);

  assert.deepEqual(result.removedConditionIds, ["minute-timed"]);
  assert.deepEqual(result.remainingConditions, []);
});

test("successful matching saving throw expires; failed or unrelated saves do not", () => {
  const timed = condition(
    "save-timed",
    [{
      kind: "saving-throw",
      creatureId: AFFECTED,
      ability: "wis",
      dc: 15,
      timing: "end-of-turn",
      on: "success",
    }],
  );
  const otherAbility = event("wrong-ability", 1, {
    kind: "saving-throw", creatureId: AFFECTED, ability: "str", timing: "end-of-turn", total: 20,
  });
  const failure = event("failed-save", 2, {
    kind: "saving-throw", creatureId: AFFECTED, ability: "wis", timing: "end-of-turn", total: 14,
  });
  const success = event("successful-save", 3, {
    kind: "saving-throw", creatureId: AFFECTED, ability: "wis", timing: "end-of-turn", total: 15,
  });
  const result = resolve([timed], [otherAbility, failure, success]);

  assert.deepEqual(result.removedConditionIds, ["save-timed"]);
  assert.deepEqual(result.remainingConditions, []);
});

test("event-trigger expiry matches trigger ID and optional subject ID", () => {
  const targeted = condition("targeted", [{
    kind: "event", eventId: "grappler-incapacitated", subjectId: SOURCE,
  }]);
  const unrelated = event("unrelated", 1, {
    kind: "trigger", triggerId: "grappler-incapacitated", subjectId: "creature:other",
  });
  const matching = event("matching", 2, {
    kind: "trigger", triggerId: "grappler-incapacitated", subjectId: SOURCE,
  });
  const result = resolve([targeted], [unrelated, matching]);

  assert.deepEqual(result.removedConditionIds, ["targeted"]);
  assert.deepEqual(result.remainingConditions, []);
});

test("multiple instances of one type keep independent expiry and removal", () => {
  const one = condition("one", [{ kind: "rest", rest: "short" }]);
  const two = condition("two", [{ kind: "rest", rest: "long" }]);
  const three = condition("three", [{ kind: "manual" }]);
  const result = resolve(
    [one, two, three],
    [event("short-rest", 1, { kind: "rest-completed", rest: "short" })],
  );

  assert.deepEqual(result.removedConditionIds, ["one"]);
  assert.deepEqual(result.remainingConditions.map((entry) => entry.id), ["two", "three"]);
  assert.ok(result.remainingConditions.every((entry) => entry.type === "poisoned"));
});

test("any configured expiry trigger may end its condition instance", () => {
  const multi = condition("multi", [
    { kind: "rest", rest: "long" },
    { kind: "event", eventId: "magic-dispelled" },
  ]);
  const result = resolve(
    [multi],
    [event("dispel", 1, { kind: "trigger", triggerId: "magic-dispelled" })],
  );
  assert.deepEqual(result.removedConditionIds, ["multi"]);
});

test("events at or before the instance application sequence cannot expire it", () => {
  const timed = condition(
    "newer-instance",
    [{ kind: "rest", rest: "short" }],
    { appliedAt: { sequence: 5 } },
  );
  const stale = event("stale-rest", 4, { kind: "rest-completed", rest: "short" });
  const current = event("current-rest", 6, { kind: "rest-completed", rest: "short" });
  const result = resolve([timed], [stale, current]);

  assert.deepEqual(result.removedConditionIds, ["newer-instance"]);
  assert.ok(result.issues.some((issue) => issue.code === "stale-event"));
});

test("duplicate event IDs are idempotently ignored", () => {
  const timed = condition("one", [{ kind: "rest", rest: "short" }]);
  const first = event("same", 1, { kind: "rest-completed", rest: "short" });
  const duplicate = event("same", 2, { kind: "rest-completed", rest: "short" });
  const result = resolve([timed], [first, duplicate]);

  assert.deepEqual(result.removedConditionIds, ["one"]);
  assert.deepEqual(result.processedEventIds, ["same"]);
  assert.equal(result.issues.filter((issue) => issue.code === "duplicate-event-id").length, 1);
});

test("out-of-order sequences, clocks, turns, and rounds are reported and ignored", () => {
  const first = condition("sequence", [{ kind: "manual" }]);
  const sequenceResult = resolve([first], [
    event("sequence-one", 2, { kind: "rest-completed", rest: "short" }),
    event("sequence-old", 1, { kind: "manual-remove", conditionId: "sequence" }),
  ]);
  assert.ok(sequenceResult.issues.some((issue) => issue.code === "out-of-order-event"));
  assert.equal(sequenceResult.remainingConditions.length, 1);

  const clock = condition("clock", [{ kind: "elapsed-time", minutes: 10 }], {
    appliedAt: { timestampMs: 100 },
  });
  const clockResult = resolve([clock], [
    event("time-later", 1, { kind: "time-advanced", timestampMs: 601_000 }),
    event("time-back", 2, { kind: "time-advanced", timestampMs: 500 }),
  ]);
  assert.ok(clockResult.issues.some((issue) => issue.code === "out-of-order-event"));
  assert.deepEqual(clockResult.removedConditionIds, ["clock"]);

  const turn = condition("turn", [{ kind: "turn", creatureId: AFFECTED, boundary: "end", afterTurns: 1 }], {
    appliedAt: { turn: 2 },
  });
  const turnResult = resolve([turn], [
    event("turn-four", 1, { kind: "turn-boundary", creatureId: AFFECTED, boundary: "end", turnIndex: 4 }),
    event("turn-three", 2, { kind: "turn-boundary", creatureId: AFFECTED, boundary: "end", turnIndex: 3 }),
  ]);
  assert.ok(turnResult.issues.some((issue) => issue.code === "out-of-order-event"));
  assert.deepEqual(turnResult.removedConditionIds, ["turn"]);

  const round = condition("round", [{ kind: "round", boundary: "end", afterRounds: 1 }], {
    appliedAt: { round: 1 },
  });
  const roundResult = resolve([round], [
    event("round-three", 1, { kind: "round-boundary", boundary: "end", round: 3 }),
    event("round-two", 2, { kind: "round-boundary", boundary: "end", round: 2 }),
  ]);
  assert.ok(roundResult.issues.some((issue) => issue.code === "out-of-order-event"));
  assert.deepEqual(roundResult.removedConditionIds, ["round"]);
});

test("turn, round, and elapsed-time expiry without application clock data are preserved with diagnostics", () => {
  const conditions = [
    condition("turn", [{ kind: "turn", creatureId: AFFECTED, boundary: "end", afterTurns: 1 }]),
    condition("round", [{ kind: "round", boundary: "end", afterRounds: 1 }]),
    condition("time", [{ kind: "elapsed-time", minutes: 1 }]),
  ];
  const result = resolve(conditions, [
    event("turn", 1, { kind: "turn-boundary", creatureId: AFFECTED, boundary: "end", turnIndex: 1 }),
    event("round", 2, { kind: "round-boundary", boundary: "end", round: 1 }),
    event("time", 3, { kind: "time-advanced", timestampMs: 60_000 }),
  ]);

  assert.equal(result.remainingConditions.length, 3);
  assert.equal(result.issues.filter((issue) => issue.code === "missing-application-time").length, 3);
});

test("manual removal of a non-existent ID reports a diagnostic", () => {
  const result = resolve(
    [condition("exists", [{ kind: "manual" }])],
    [event("remove-missing", 1, { kind: "manual-remove", conditionId: "missing" })],
  );
  assert.deepEqual(result.removedConditionIds, []);
  assert.ok(result.issues.some((issue) => issue.code === "condition-not-found"));
});

test("duplicate condition instance IDs are reported and only the first record is retained", () => {
  const result = resolve([
    condition("same", [{ kind: "rest", rest: "short" }]),
    condition("same", [{ kind: "rest", rest: "long" }]),
  ], []);
  assert.equal(result.remainingConditions.length, 1);
  assert.equal(result.issues.filter((issue) => issue.code === "duplicate-condition-instance-id").length, 1);
});

test("invalid event records are diagnosed without aborting later valid events", () => {
  const timed = condition("one", [{ kind: "rest", rest: "short" }]);
  const invalid = { eventId: "bad", sequence: 1, kind: "rest-completed", rest: "tomorrow" };
  const valid = event("good", 2, { kind: "rest-completed", rest: "short" });
  const result = resolve([timed], [invalid, valid]);

  assert.ok(result.issues.some((issue) => issue.code === "invalid-event"));
  assert.deepEqual(result.removedConditionIds, ["one"]);
  assert.deepEqual(result.processedEventIds, ["good"]);
});

test("lifecycle resolution does not mutate caller-owned condition or event arrays", () => {
  const original = condition("one", [{ kind: "rest", rest: "short" }], {
    source: { kind: "manual", label: "Original" },
  });
  const conditions = [original];
  const events = [event("short-rest", 1, { kind: "rest-completed", rest: "short" })];
  resolve(conditions, events);

  assert.equal(conditions.length, 1);
  assert.equal(conditions[0].source.label, "Original");
  assert.deepEqual(conditions[0].expiresOn, [{ kind: "rest", rest: "short" }]);
  assert.equal(events.length, 1);
  assert.equal(events[0].eventId, "short-rest");
});
