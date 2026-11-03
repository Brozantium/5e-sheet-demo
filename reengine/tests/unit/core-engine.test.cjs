const test = require("node:test");
const assert = require("node:assert/strict");

const { resolveProgression } = require("../../.test-dist/engines/progression-engine.js");
const { validateSelection, getEligibleOptions } = require("../../.test-dist/engines/choice-engine.js");
const { validateAssignment } = require("../../.test-dist/engines/assignment-engine.js");
const { recoverResource } = require("../../.test-dist/engines/resource-engine.js");
const { validateSpellModifierApplication } = require("../../.test-dist/engines/spell-modifier-engine.js");
const { ContentRegistry } = require("../../.test-dist/registry/content-registry.js");

const baseState = () => ({
  id: "character-1",
  ruleset: "2014",
  classLevels: { fighter: 7 },
  abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  selections: {},
  assignments: [],
  resources: {},
  knownSpells: [],
  ownedFeatures: [],
  inventoryItemTags: {},
});

test("sparse progression rows carry the last defined value forward", () => {
  const tables = {
    "fighter-rune-knight": {
      id: "fighter-rune-knight",
      classId: "fighter-rune-knight",
      levelFromClassId: "fighter",
      rows: [
        { level: 3, values: { usesPerRune: 1, runesKnown: 2 } },
        { level: 7, values: { runesKnown: 3 } },
        { level: 10, values: { runesKnown: 4 } },
        { level: 15, values: { usesPerRune: 2, runesKnown: 5 } },
      ],
    },
  };

  assert.equal(
    resolveProgression(
      { kind: "class-table", tableId: "fighter-rune-knight", column: "usesPerRune" },
      { fighter: 7 },
      tables,
    ),
    1,
  );
  assert.equal(
    resolveProgression(
      { kind: "class-table", tableId: "fighter-rune-knight", column: "runesKnown" },
      { fighter: 7 },
      tables,
    ),
    3,
  );
  assert.equal(
    resolveProgression(
      { kind: "class-table", tableId: "fighter-rune-knight", column: "usesPerRune" },
      { fighter: 15 },
      tables,
    ),
    2,
  );
});

test("progression table identity is independent from its class-level source", () => {
  const table = {
    subclass: {
      id: "fighter-rune-knight",
      classId: "fighter-rune-knight",
      levelFromClassId: "fighter",
      rows: [
        { level: 3, values: { runesKnown: 2 } },
        { level: 7, values: { runesKnown: 3 } },
      ],
    },
  };

  assert.equal(
    resolveProgression(
      { kind: "class-table", tableId: "fighter-rune-knight", column: "runesKnown" },
      { fighter: 7, "fighter-rune-knight": 0 },
      table,
    ),
    3,
  );
});

test("draft selections may be incomplete while complete selections require exact count", () => {
  const mechanic = {
    kind: "selection",
    id: "metamagic",
    optionSetId: "metamagic-options",
    mode: "multiple",
    count: { kind: "fixed", value: 2 },
  };
  const optionSet = {
    id: "metamagic-options",
    ruleset: "2014",
    name: "Metamagic",
    options: [{ id: "careful", name: "Careful Spell", description: "" }],
  };

  assert.deepEqual(
    validateSelection(mechanic, ["careful"], optionSet, baseState(), {}),
  [],);
  assert.ok(
    validateSelection(mechanic, ["careful"], optionSet, baseState(), {}, { mode: "draft" })
      .every((issue) => issue.code !== "selection-count"),
  );
  assert.ok(
    validateSelection(mechanic, ["careful"], optionSet, baseState(), {}, { mode: "complete" })
      .some((issue) => issue.code === "selection-count"),
  );
  assert.ok(
    validateSelection(mechanic, ["careful", "careful", "careful"], optionSet, baseState(), {}, { mode: "draft" })
      .some((issue) => issue.code === "selection-count"),
  );
});

test("batch-staged selections satisfy prerequisites within the same builder transaction", () => {
  const mechanic = {
    kind: "selection",
    id: "invocations",
    optionSetId: "warlock-invocations",
    mode: "multiple",
    count: { kind: "fixed", value: 1 },
  };
  const optionSet = {
    id: "warlock-invocations",
    ruleset: "2024",
    name: "Invocations",
    options: [{
      id: "lifedrinker",
      name: "Lifedrinker",
      description: "",
      prerequisites: [{ kind: "known-option", selectionId: "pact-boon", optionId: "pact-of-the-blade" }],
    }],
  };

  const staged = { "pact-boon": ["pact-of-the-blade"] };
  assert.equal(
    validateSelection(mechanic, ["lifedrinker"], optionSet, baseState(), {}, { stagedSelections: staged })
      .filter((issue) => issue.code === "prerequisite-not-met").length,
    0,
  );
  assert.ok(
    validateSelection(mechanic, ["lifedrinker"], optionSet, baseState(), {})
      .some((issue) => issue.code === "prerequisite-not-met"),
  );
  assert.equal(
    getEligibleOptions(optionSet.options, baseState(), staged).length,
    1,
  );
});

test("assignment capacity is enforced even when reusing an already assigned option", () => {
  const mechanic = {
    kind: "assignment",
    id: "infusion-assignment",
    selectionId: "infusions-known",
    targetKind: "inventory-item",
    capacity: { kind: "fixed", value: 1 },
    maxPerTarget: 1,
  };
  const state = baseState();
  state.selections["infusions-known"] = ["enhanced-defense"];
  state.assignments = [{
    mechanicId: mechanic.id,
    optionId: "enhanced-defense",
    targetId: "armor-1",
  }];

  const issues = validateAssignment(
    mechanic,
    { id: "enhanced-defense", name: "Enhanced Defense", description: "" },
    "armor-2",
    state,
    {},
  );
  assert.ok(issues.some((issue) => issue.code === "assignment-capacity"));
});

test("assignment rejects duplicates and enforces independent per-option and per-target limits", () => {
  const mechanic = {
    kind: "assignment",
    id: "infusion-assignment",
    selectionId: "infusions-known",
    targetKind: "inventory-item",
    capacity: { kind: "fixed", value: 4 },
    maxPerTarget: 1,
    maxPerOption: 2,
  };
  const state = baseState();
  state.selections["infusions-known"] = ["enhanced-defense", "replicate-item"];
  state.assignments = [
    { mechanicId: mechanic.id, optionId: "enhanced-defense", targetId: "armor-1" },
    { mechanicId: mechanic.id, optionId: "replicate-item", targetId: "armor-1" },
  ];

  const option = { id: "enhanced-defense", name: "Enhanced Defense", description: "" };
  assert.ok(
    validateAssignment(mechanic, option, "armor-1", state, {})
      .some((issue) => issue.code === "duplicate-assignment"),
  );

  state.assignments = [
    { mechanicId: mechanic.id, optionId: "enhanced-defense", targetId: "armor-1" },
    { mechanicId: mechanic.id, optionId: "enhanced-defense", targetId: "armor-2" },
  ];
  assert.ok(
    validateAssignment(mechanic, option, "armor-3", state, {})
      .some((issue) => issue.code === "option-capacity"),
  );
});

test("long rest restores short-rest resources, but short rest does not restore long-rest resources", () => {
  const shortRestResource = { maximum: 3, current: 0, recovery: "short-rest" };
  const longRestResource = { maximum: 2, current: 0, recovery: "long-rest" };

  assert.equal(recoverResource(shortRestResource, "long-rest").current, 3);
  assert.equal(recoverResource(longRestResource, "short-rest").current, 0);
  assert.equal(recoverResource(longRestResource, "long-rest").current, 2);
});

test("special and manual resource recovery only occur on their explicit event", () => {
  const special = { maximum: 2, current: 0, recovery: "special" };
  const manual = { maximum: 4, current: 0, recovery: "manual" };

  assert.equal(recoverResource(special, "short-rest").current, 0);
  assert.equal(recoverResource(special, "special").current, 2);
  assert.equal(recoverResource(manual, "long-rest").current, 0);
  assert.equal(recoverResource(manual, "manual").current, 4);
});

test("spell modifier validation checks the remaining resource pool", () => {
  const mechanic = {
    kind: "spell-modifier",
    id: "metamagic-apply",
    optionSetId: "metamagic",
    resourceId: "sorcery-points",
    timing: "spell-cast",
    maxPerSpell: 2,
  };
  const option = {
    id: "twinned",
    name: "Twinned Spell",
    description: "",
    resourceCost: { resourceId: "sorcery-points", amount: 3 },
  };

  const insufficient = validateSpellModifierApplication(
    mechanic,
    ["twinned"],
    ["twinned"],
    [option],
    { "sorcery-points": { maximum: 5, current: 2 } },
  );
  assert.equal(insufficient.valid, false);
  assert.equal(insufficient.cost, 3);
  assert.ok(insufficient.issues.some((issue) => issue.includes("Not enough")));

  const sufficient = validateSpellModifierApplication(
    mechanic,
    ["twinned"],
    ["twinned"],
    [option],
    { "sorcery-points": { maximum: 5, current: 3 } },
  );
  assert.equal(sufficient.valid, true);
});

test("content registry rejects duplicate identifiers without partially registering a class", () => {
  const registry = new ContentRegistry();
  const feature = {
    id: "feature-one",
    name: "Feature One",
    level: 1,
    description: "",
    ruleset: "2014",
    mechanics: [],
  };
  registry.registerFeature(feature);

  const classDefinition = {
    id: "fighter",
    name: "Fighter",
    ruleset: "2014",
    hitDie: 10,
    progression: { id: "fighter", classId: "fighter", rows: [] },
    features: [
      { ...feature, id: "new-feature" },
      { ...feature },
    ],
  };

  assert.throws(() => registry.registerClass(classDefinition), /Duplicate feature id/);
  assert.equal(registry.getClass("fighter"), undefined);
  assert.equal(registry.getFeature("new-feature"), undefined);
  assert.throws(() => registry.registerFeature(feature), /Duplicate feature id/);
});

test("content registry reports unresolved option-set and assignment references", () => {
  const registry = new ContentRegistry();
  registry.registerFeature({
    id: "artificer-infusions",
    name: "Infuse Item",
    level: 2,
    description: "",
    ruleset: "2014",
    mechanics: [
      {
        kind: "assignment",
        id: "infusion-assignment",
        selectionId: "infusions-known",
        targetKind: "inventory-item",
        capacity: { kind: "fixed", value: 2 },
        maxPerTarget: 1,
      },
      {
        kind: "selection",
        id: "infusions-known",
        optionSetId: "missing-infusions",
        mode: "multiple",
        count: { kind: "fixed", value: 2 },
      },
    ],
  });

  const issues = registry.validateReferences();
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "missing-option-set");
});
