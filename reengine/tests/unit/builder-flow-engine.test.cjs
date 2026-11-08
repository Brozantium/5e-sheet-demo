const test = require("node:test");
const assert = require("node:assert/strict");

const {
  navigateBuilderFlow,
  resolveBuilderFlow,
} = require("../../.test-dist/engines/builder-flow-engine.js");
const { BUILDER_STEPS } = require("../../.test-dist/builder/builder-manifest.js");

function progress(overrides = {}) {
  return BUILDER_STEPS.map((id) => ({
    id,
    available: overrides[id]?.available ?? true,
    complete: overrides[id]?.complete ?? false,
  }));
}

test("Builder flow follows manifest order and hides steps that do not apply", () => {
  const entries = progress({
    ruleset: { complete: true },
    modifiers: { complete: true },
    class: { complete: true },
    "species-or-race": { complete: true },
    subclass: { available: false },
    "ability-scores": { complete: false },
    feats: { available: false },
    "features-and-options": { available: false },
    spells: { available: false },
  });

  const flow = resolveBuilderFlow({ progress: entries });

  assert.deepEqual(flow.visibleStepIds, [
    "ruleset",
    "modifiers",
    "class",
    "species-or-race",
    "ability-scores",
    "background",
    "proficiencies",
    "equipment",
    "details",
    "review",
  ]);
  assert.equal(flow.activeStepId, "ability-scores");
  assert.equal(flow.firstIncompleteStepId, "ability-scores");
  assert.equal(flow.canGoNext, false);
  assert.equal(flow.canFinish, false);
});

test("the first incomplete required step blocks jumping ahead", () => {
  const entries = progress({
    ruleset: { complete: true },
    modifiers: { complete: true },
    class: { complete: false },
  });
  const input = { progress: entries, activeStepId: "class" };

  const flow = resolveBuilderFlow(input);
  assert.equal(flow.nextStepId, null);
  assert.equal(flow.navigableStepIds.includes("species-or-race"), false);
  assert.equal(navigateBuilderFlow(input, "species-or-race"), null);
});

test("a completed step unlocks only the next applicable step", () => {
  const entries = progress({
    ruleset: { complete: true },
    modifiers: { complete: true },
    class: { complete: true },
  });
  const input = {
    progress: entries,
    activeStepId: "class",
    visitedStepIds: ["ruleset", "modifiers"],
  };

  const flow = resolveBuilderFlow(input);
  assert.equal(flow.nextStepId, "species-or-race");
  assert.equal(flow.canGoNext, true);

  const next = navigateBuilderFlow(input, "species-or-race");
  assert.ok(next);
  assert.equal(next.activeStepId, "species-or-race");
  assert.ok(next.visitedStepIds.includes("species-or-race"));

  const nextFlow = resolveBuilderFlow(next);
  assert.equal(nextFlow.nextStepId, null);
});

test("users can revisit earlier visible steps without unlocking later steps", () => {
  const entries = progress({
    ruleset: { complete: true },
    modifiers: { complete: true },
    class: { complete: true },
    "species-or-race": { complete: true },
  });
  const input = {
    progress: entries,
    activeStepId: "species-or-race",
    visitedStepIds: ["ruleset", "modifiers", "class"],
  };

  const back = navigateBuilderFlow(input, "class");
  assert.ok(back);
  assert.equal(back.activeStepId, "class");
  assert.equal(resolveBuilderFlow(back).nextStepId, "species-or-race");
});

test("finish requires every visible step and external validation approval", () => {
  const entries = progress(
    Object.fromEntries(BUILDER_STEPS.map((id) => [id, { complete: true }])),
  );
  const blocked = resolveBuilderFlow({
    progress: entries,
    finishAllowed: false,
  });
  assert.equal(blocked.allStepsComplete, true);
  assert.equal(blocked.canFinish, false);

  const allowed = resolveBuilderFlow({ progress: entries });
  assert.equal(allowed.allStepsComplete, true);
  assert.equal(allowed.canFinish, true);
});

test("an empty applicable step list cannot be finished", () => {
  const entries = progress(
    Object.fromEntries(BUILDER_STEPS.map((id) => [id, { available: false }])),
  );
  const flow = resolveBuilderFlow({ progress: entries });

  assert.deepEqual(flow.visibleStepIds, []);
  assert.equal(flow.activeStepId, null);
  assert.equal(flow.allStepsComplete, false);
  assert.equal(flow.canFinish, false);
});

test("duplicate step progress is rejected instead of resolved ambiguously", () => {
  assert.throws(
    () =>
      resolveBuilderFlow({
        progress: [
          { id: "ruleset", available: true, complete: true },
          { id: "ruleset", available: true, complete: false },
        ],
      }),
    /Duplicate Builder step progress/,
  );
});
