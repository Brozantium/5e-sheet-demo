const test = require("node:test");
const assert = require("node:assert/strict");

const { resolveArmorTrainingGrants } =
  require("../../.test-dist/engines/armor-training-grant-engine.js");

const source = (sourceId, grants, ruleset = "shared") => ({ sourceId, ruleset, grants });

test("armor training grants union across class, subclass, species, background, and feat", () => {
  const result = resolveArmorTrainingGrants({
    ruleset: "2024",
    sources: [
      source("class:cleric", ["light", "medium"]),
      source("subclass:life", ["heavy"]),
      source("species:custom", ["shield"]),
      source("background:soldier", ["medium"]),
      source("feat:training", ["light", "shield"]),
    ],
  });
  assert.deepEqual(result.armorTraining, ["light", "medium", "heavy"]);
  assert.equal(result.shieldTraining, true);
  assert.deepEqual(result.sourcesByGrant.light, ["class:cleric", "feat:training"]);
  assert.deepEqual(result.sourcesByGrant.medium, ["class:cleric", "background:soldier"]);
  assert.deepEqual(result.sourcesByGrant.heavy, ["subclass:life"]);
  assert.deepEqual(result.sourcesByGrant.shield, ["species:custom", "feat:training"]);
  assert.deepEqual(result.issues, []);
});

test("multiclass grants are unioned and source provenance is retained", () => {
  const result = resolveArmorTrainingGrants({
    ruleset: "2014",
    sources: [
      source("class:barbarian", ["light", "medium"]),
      source("class:cleric", ["light", "shield"]),
    ],
  });
  assert.deepEqual(result.armorTraining, ["light", "medium"]);
  assert.equal(result.shieldTraining, true);
  assert.deepEqual(result.sourcesByGrant.light, ["class:barbarian", "class:cleric"]);
});

test("shared training sources apply in either ruleset", () => {
  for (const ruleset of ["2014", "2024"]) {
    const result = resolveArmorTrainingGrants({
      ruleset,
      sources: [source("feat:armor-training", ["medium", "shield"])],
    });
    assert.deepEqual(result.armorTraining, ["medium"]);
    assert.equal(result.shieldTraining, true);
    assert.deepEqual(result.issues, []);
  }
});

test("edition-incompatible sources are excluded and reported", () => {
  const oldRules = resolveArmorTrainingGrants({
    ruleset: "2014",
    sources: [
      source("class:barbarian-2014", ["light", "medium"], "2014"),
      source("class:artificer-2024", ["heavy", "shield"], "2024"),
    ],
  });
  const newRules = resolveArmorTrainingGrants({
    ruleset: "2024",
    sources: [
      source("class:artificer-2024", ["light", "medium"], "2024"),
      source("class:barbarian-2014", ["heavy", "shield"], "2014"),
    ],
  });
  assert.deepEqual(oldRules.armorTraining, ["light", "medium"]);
  assert.equal(oldRules.shieldTraining, false);
  assert.equal(oldRules.issues.length, 1);
  assert.deepEqual(newRules.armorTraining, ["light", "medium"]);
  assert.equal(newRules.shieldTraining, false);
  assert.equal(newRules.issues.length, 1);
});

test("empty grants leave characters without armor or shield training", () => {
  const result = resolveArmorTrainingGrants({ ruleset: "2024", sources: [] });
  assert.deepEqual(result.armorTraining, []);
  assert.equal(result.shieldTraining, false);
});

test("unknown and duplicate grants are rejected", () => {
  assert.throws(() => resolveArmorTrainingGrants({
    ruleset: "2024",
    sources: [source("class:test", ["light", "plate"])],
  }), /Unknown armor training grant/);
  assert.throws(() => resolveArmorTrainingGrants({
    ruleset: "2024",
    sources: [source("class:test", ["light", "light"])],
  }), /Duplicate armor training grant/);
  assert.throws(() => resolveArmorTrainingGrants({
    ruleset: "2024",
    sources: [source("class:test", ["light"]), source("class:test", ["heavy"])],
  }), /Duplicate armor training grant source ID/);
});

test("malformed rulesets and grant-source shapes are rejected", () => {
  assert.throws(() => resolveArmorTrainingGrants({
    ruleset: "2024",
    sources: [source("class:test", ["light"], "other")],
  }), /Unknown armor training source ruleset/);
  assert.throws(() => resolveArmorTrainingGrants({
    ruleset: "2024",
    sources: [{ sourceId: "", ruleset: "2024", grants: ["light"] }],
  }), /source ID must be non-empty/);
  assert.throws(() => resolveArmorTrainingGrants({
    ruleset: "2024",
    sources: [{ sourceId: "class:test", ruleset: "2024", grants: "light" }],
  }), /must be an array/);
});
