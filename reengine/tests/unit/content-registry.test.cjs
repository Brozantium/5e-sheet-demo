const test = require("node:test");
const assert = require("node:assert/strict");

const { ContentRegistry } = require("../../.test-dist/registry/content-registry.js");

const makeFeature = (id, mechanics = [], ruleset = "2014") => ({
  id,
  name: id,
  level: 1,
  description: "",
  ruleset,
  mechanics,
});

const makeSelection = (id, optionSetId = "styles") => ({
  kind: "selection",
  id,
  optionSetId,
  mode: "multiple",
  count: { kind: "fixed", value: 1 },
});

const makeOptionSet = (id, options = [], ruleset = "2014") => ({
  id,
  name: id,
  ruleset,
  options,
});

const makeClass = (id, features = []) => ({
  id,
  name: id,
  ruleset: "2014",
  hitDie: 10,
  progression: {
    id: id + "-progression",
    classId: id,
    rows: [{ level: 1, values: { level: 1 } }],
  },
  features,
});

test("class registration is atomic when a nested feature has a duplicate mechanic id", () => {
  const registry = new ContentRegistry();
  registry.registerFeature(makeFeature("existing", [makeSelection("shared-mechanic")]));

  const classDefinition = makeClass("fighter", [
    makeFeature("feature-a", [makeSelection("new-mechanic")]),
    makeFeature("feature-b", [makeSelection("shared-mechanic")]),
  ]);

  assert.throws(() => registry.registerClass(classDefinition), /Duplicate mechanic id/);
  assert.equal(registry.getClass("fighter"), undefined);
  assert.equal(registry.getFeature("feature-a"), undefined);
  assert.equal(registry.getProgressionTable("fighter-progression"), undefined);
});

test("mechanic ids are unique across direct and nested feature registration", () => {
  const registry = new ContentRegistry();
  registry.registerFeature(makeFeature("feature-a", [makeSelection("choice-id")]));

  assert.throws(
    () => registry.registerFeature(makeFeature("feature-b", [makeSelection("choice-id")])),
    /Duplicate mechanic id/,
  );
});

test("assignment references must resolve to a selection mechanic, not merely any mechanic id", () => {
  const registry = new ContentRegistry();
  registry.registerFeature(makeFeature("feature", [
    { kind: "action", id: "not-a-selection", actionIds: ["test-action"] },
    {
      kind: "assignment",
      id: "assign",
      selectionId: "not-a-selection",
      targetKind: "inventory-item",
      capacity: { kind: "fixed", value: 1 },
      maxPerTarget: 1,
    },
  ]));

  assert.ok(registry.validateReferences().some((issue) => issue.code === "missing-selection"));
});

test("known-option prerequisites validate both the selection and selected option id", () => {
  const registry = new ContentRegistry();
  registry.registerOptionSet(makeOptionSet("styles", [
    { id: "archery", name: "Archery", description: "" },
  ]));
  registry.registerOptionSet(makeOptionSet("feats", [
    {
      id: "sharpshooter",
      name: "Sharpshooter",
      description: "",
      prerequisites: [{ kind: "known-option", selectionId: "fighting-style", optionId: "great-weapon" }],
    },
  ]));
  registry.registerFeature(makeFeature("fighter-feature", [makeSelection("fighting-style")]));

  const issues = registry.validateReferences();
  assert.ok(issues.some((issue) => issue.code === "missing-option"));
  assert.equal(issues.some((issue) => issue.code === "missing-selection"), false);
});

test("option set ruleset must match its consuming feature unless either side is shared", () => {
  const registry = new ContentRegistry();
  registry.registerOptionSet(makeOptionSet("2024-options", [], "2024"));
  registry.registerFeature(makeFeature("2014-feature", [makeSelection("pick", "2024-options")], "2014"));

  assert.ok(registry.validateReferences().some((issue) => issue.code === "incompatible-ruleset"));
});

test("progression references report missing tables and missing columns", () => {
  const missingTableRegistry = new ContentRegistry();
  missingTableRegistry.registerFeature(makeFeature("missing-table-feature", [{
    kind: "resource-pool",
    id: "resource",
    resourceId: "uses",
    maximum: { kind: "class-table", tableId: "unknown-table", column: "uses" },
    recovery: "long-rest",
  }]));
  assert.ok(missingTableRegistry.validateReferences().some((issue) => issue.code === "missing-progression-table"));

  const missingColumnRegistry = new ContentRegistry();
  missingColumnRegistry.registerProgressionTable({
    id: "fighter-runes",
    classId: "fighter-rune-knight",
    levelFromClassId: "fighter",
    rows: [{ level: 3, values: { runesKnown: 2 } }],
  });
  missingColumnRegistry.registerFeature(makeFeature("rune-feature", [{
    kind: "resource-pool",
    id: "rune-uses",
    resourceId: "rune-uses",
    maximum: { kind: "class-table", tableId: "fighter-runes", column: "usesPerRune" },
    recovery: "short-rest",
  }]));
  assert.ok(missingColumnRegistry.validateReferences().some((issue) => issue.code === "missing-progression-column"));
});

test("class registration indexes its progression table and rejects duplicate table ids atomically", () => {
  const registry = new ContentRegistry();
  registry.registerClass(makeClass("fighter"));

  assert.ok(registry.getProgressionTable("fighter-progression"));
  assert.throws(() => registry.registerClass(makeClass("champion")), /Duplicate progression table id/);
  assert.equal(registry.getClass("champion"), undefined);
});

test("nested prerequisite groups are recursively validated", () => {
  const registry = new ContentRegistry();
  registry.registerOptionSet(makeOptionSet("feats", [{
    id: "test-feat",
    name: "Test Feat",
    description: "",
    prerequisites: [{
      kind: "all",
      requirements: [
        { kind: "class-level", classId: "missing-class", minimum: 1 },
        { kind: "any", requirements: [{ kind: "feature-owned", featureId: "missing-feature" }] },
      ],
    }],
  }]));

  const codes = registry.validateReferences().map((issue) => issue.code);
  assert.ok(codes.includes("missing-class"));
  assert.ok(codes.includes("missing-feature"));
});
