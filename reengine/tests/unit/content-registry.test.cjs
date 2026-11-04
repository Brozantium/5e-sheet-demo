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
  registry.registerOptionSet(makeOptionSet("options-2024", [], "2024"));
  registry.registerFeature(makeFeature("feature-2014", [makeSelection("pick", "options-2024")], "2014"));

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
  const duplicateTableClass = makeClass("champion");
  duplicateTableClass.progression.id = "fighter-progression";
  assert.throws(() => registry.registerClass(duplicateTableClass), /Duplicate progression table id/);
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

test("class-level ruleset metadata must match nested class features", () => {
  const registry = new ContentRegistry();
  registry.registerClass({
    ...makeClass("fighter", [makeFeature("fighter:feature", [], "2024")]),
    ruleset: "2014",
  });
  assert.ok(registry.validateReferences().some((issue) =>
    issue.code === "incompatible-ruleset" && issue.subjectId === "fighter:feature",
  ));
});

test("progression tables reject non-integer and duplicate level rows", () => {
  const registry = new ContentRegistry();
  assert.throws(() => registry.registerProgressionTable({
    id: "fighter-progress",
    classId: "fighter",
    rows: [{ level: 1.5, values: { uses: 1 } }],
  }), /Invalid progression row level/);

  assert.throws(() => registry.registerProgressionTable({
    id: "fighter-progress",
    classId: "fighter",
    rows: [
      { level: 1, values: { uses: 1 } },
      { level: 1, values: { uses: 2 } },
    ],
  }), /Duplicate progression row level/);
});

test("fixed progression values and fallbacks must be non-negative integers", () => {
  const registry = new ContentRegistry();
  assert.throws(() => registry.registerFeature(makeFeature("bad-feature", [{
    kind: "selection",
    id: "bad-feature:selection",
    optionSetId: "styles",
    mode: "single",
    count: { kind: "fixed", value: 1.5 },
  }])), /non-negative integer/);
});

test("item registry validates canonical base-item references", () => {
  const registry = new ContentRegistry();
  registry.registerItem({
    id: "weapon:longsword",
    name: "Longsword",
    ruleset: "2014",
    category: "weapon",
    weaponProfile: {
      weaponCategory: "martial",
      weaponType: "melee",
      damage: [{ formula: "1d8", damageType: "slashing" }],
    },
  });
  registry.registerItem({
    id: "magic-item:flame-tongue",
    name: "Flame Tongue",
    ruleset: "2014",
    category: "magic-item",
    baseItemId: "weapon:longsword",
  });

  assert.equal(registry.getItem("weapon:longsword").name, "Longsword");
  assert.equal(registry.listItems().length, 2);
  assert.equal(registry.validateReferences().some((issue) => issue.code === "missing-base-item"), false);
});

test("item registry reports missing base items and cross-ruleset item links", () => {
  const missing = new ContentRegistry();
  missing.registerItem({
    id: "magic-item:missing-sword",
    name: "Missing Sword",
    ruleset: "2014",
    category: "magic-item",
    baseItemId: "weapon:unknown",
  });
  assert.ok(missing.validateReferences().some((issue) => issue.code === "missing-base-item"));

  const mismatch = new ContentRegistry();
  mismatch.registerItem({
    id: "weapon:base-blade",
    name: "Base Blade",
    ruleset: "2014",
    category: "weapon",
    weaponProfile: {
      weaponCategory: "martial",
      weaponType: "melee",
      damage: [{ formula: "1d8", damageType: "slashing" }],
    },
  });
  mismatch.registerItem({
    id: "magic-item:blade-2024",
    name: "2024 Blade",
    ruleset: "2024",
    category: "magic-item",
    baseItemId: "weapon:base-blade",
  });
  assert.ok(mismatch.validateReferences().some((issue) =>
    issue.code === "incompatible-ruleset" && issue.subjectId === "magic-item:blade-2024",
  ));
});

test("item registration rejects malformed item identifiers and malformed profiles", () => {
  const registry = new ContentRegistry();
  assert.throws(() => registry.registerItem({
    id: "Long Sword",
    name: "Long Sword",
    ruleset: "2014",
    category: "weapon",
    weaponProfile: {
      weaponCategory: "martial",
      weaponType: "melee",
      damage: [{ formula: "1d8", damageType: "slashing" }],
    },
  }), /Invalid item id/);

  assert.throws(() => registry.registerItem({
    id: "weapon:broken",
    name: "Broken",
    ruleset: "2014",
    category: "weapon",
  }), /requires a weapon profile/);
});

test("unreferenced progression tables still validate their class-level source", () => {
  const registry = new ContentRegistry();
  registry.registerProgressionTable({
    id: "subclass:rune-knight",
    classId: "subclass:rune-knight",
    levelFromClassId: "missing-class",
    rows: [{ level: 3, values: { runesKnown: 2 } }],
  });
  assert.ok(registry.validateReferences().some((issue) =>
    issue.code === "missing-progression-class" && issue.subjectId === "subclass:rune-knight",
  ));
});

test("registry rejects non-positive mechanic limits and duplicate action targets", () => {
  const registry = new ContentRegistry();
  assert.throws(() => registry.registerFeature(makeFeature("invalid-assignment-feature", [{
    kind: "assignment",
    id: "invalid-assignment-feature:assignment",
    selectionId: "some-selection",
    targetKind: "inventory-item",
    capacity: { kind: "fixed", value: 1 },
    maxPerTarget: 0,
  }])), /positive integer/);

  assert.throws(() => registry.registerFeature(makeFeature("invalid-action-feature", [{
    kind: "action",
    id: "invalid-action-feature:action",
    actionIds: ["test:action", "test:action"],
  }])), /must be unique/);

  assert.throws(() => registry.registerFeature(makeFeature("invalid-trigger-feature", [{
    kind: "trigger",
    id: "invalid-trigger-feature:trigger",
    triggerIds: [],
  }])), /at least 1 entries/);
});

test("registry rejects blank source metadata and duplicate class ability metadata", () => {
  const registry = new ContentRegistry();
  assert.throws(() => registry.registerFeature({
    ...makeFeature("feature-with-blank-source"),
    source: { book: "   " },
  }), /non-empty text/);

  assert.throws(() => registry.registerClass({
    ...makeClass("fighter"),
    primaryAbilities: ["str", "str"],
  }), /must be unique/);
});

test("item profile validation matches category-specific schema requirements", () => {
  const registry = new ContentRegistry();
  assert.throws(() => registry.registerItem({
    id: "armor:bad-mail",
    name: "Bad Mail",
    ruleset: "2014",
    category: "armor",
    weaponProfile: {
      weaponCategory: "martial",
      weaponType: "melee",
      damage: [{ formula: "1d8", damageType: "slashing" }],
    },
    armorProfile: {
      armorCategory: "shield",
      baseAC: 16,
      dexterity: "none",
      stealthDisadvantage: true,
    },
  }), /non-shield armor profile/);
});

const makeWeapon = ({
  id = "weapon:test",
  name = "Test Weapon",
  ruleset = "2014",
  properties = [],
  weaponType = "melee",
  damage = [{ formula: "1d6", damageType: "slashing" }],
  range,
  thrownRange,
  ammunitionType,
  twoHandedRule,
  specialRules,
} = {}) => ({
  id,
  name,
  ruleset,
  category: "weapon",
  properties,
  weaponProfile: {
    weaponCategory: "simple",
    weaponType,
    damage,
    ...(range ? { range } : {}),
    ...(thrownRange ? { thrownRange } : {}),
    ...(ammunitionType ? { ammunitionType } : {}),
    ...(twoHandedRule ? { twoHandedRule } : {}),
    ...(specialRules ? { specialRules } : {}),
  },
});

test("weapon registry accepts ruleset-specific thrown, ammunition, and mounted Lance profiles", () => {
  const registry = new ContentRegistry();
  registry.registerItem(makeWeapon({
    id: "weapon:dagger",
    name: "Dagger",
    properties: ["finesse", "light", "thrown"],
    thrownRange: { normal: 20, long: 60 },
  }));
  registry.registerItem(makeWeapon({
    id: "weapon:longbow",
    name: "Longbow",
    ruleset: "2024",
    properties: ["ammunition", "heavy", "two-handed"],
    weaponType: "ranged",
    range: { normal: 150, long: 600 },
    ammunitionType: "arrow",
  }));
  registry.registerItem(makeWeapon({
    id: "weapon:lance-2014",
    name: "Lance",
    properties: ["reach", "special"],
    specialRules: ["lance-2014"],
  }));
  registry.registerItem(makeWeapon({
    id: "weapon:lance-2024",
    name: "Lance",
    ruleset: "2024",
    properties: ["heavy", "reach", "two-handed"],
    twoHandedRule: { unlessMounted: true },
  }));

  assert.equal(registry.listItems().length, 4);
});

test("weapon registry rejects 2014 Special in 2024 or shared content", () => {
  const registry = new ContentRegistry();
  assert.throws(() => registry.registerItem(makeWeapon({
    id: "weapon:bad-special-2024",
    ruleset: "2024",
    properties: ["special"],
    specialRules: ["lance-2014"],
  })), /not available for the 2024 ruleset/);

  assert.throws(() => registry.registerItem(makeWeapon({
    id: "weapon:bad-special-shared",
    ruleset: "shared",
    properties: ["special"],
    specialRules: ["lance-2014"],
  })), /not available for the shared ruleset/);
});

test("Thrown and Ammunition require their own structured range data", () => {
  const registry = new ContentRegistry();
  assert.throws(() => registry.registerItem(makeWeapon({
    properties: ["thrown"],
  })), /requires thrownRange/);

  assert.throws(() => registry.registerItem(makeWeapon({
    id: "weapon:bad-ammo",
    ruleset: "2024",
    properties: ["ammunition"],
    weaponType: "ranged",
    range: { normal: 30, long: 120 },
  })), /requires ammunitionType/);

  assert.throws(() => registry.registerItem(makeWeapon({
    id: "weapon:orphan-thrown-range",
    thrownRange: { normal: 20, long: 60 },
  })), /without Thrown/);
});

test("weapon range validation requires positive distances and long range not below normal range", () => {
  const registry = new ContentRegistry();
  assert.throws(() => registry.registerItem(makeWeapon({
    properties: ["thrown"],
    thrownRange: { normal: 0, long: 60 },
  })), /positive integer/);

  assert.throws(() => registry.registerItem(makeWeapon({
    id: "weapon:bad-range-order",
    ruleset: "2024",
    properties: ["ammunition"],
    weaponType: "ranged",
    range: { normal: 120, long: 60 },
    ammunitionType: "bolt",
  })), /long range cannot be shorter/);
});

test("weapon registry validates property semantics and Versatile damage metadata", () => {
  const registry = new ContentRegistry();
  assert.throws(() => registry.registerItem(makeWeapon({
    properties: ["reach"],
    weaponType: "ranged",
  })), /Reach property requires a melee weapon/);

  assert.throws(() => registry.registerItem(makeWeapon({
    properties: ["versatile"],
  })), /requires a primary versatileFormula/);

  assert.throws(() => registry.registerItem(makeWeapon({
    properties: ["loading"],
  })), /Loading property requires Ammunition/);
});

test("2014 Special profiles are structured and permit the non-damaging Net exception", () => {
  const registry = new ContentRegistry();
  registry.registerItem(makeWeapon({
    id: "weapon:net",
    name: "Net",
    properties: ["special", "thrown"],
    weaponType: "ranged",
    damage: [],
    thrownRange: { normal: 5, long: 15 },
    specialRules: ["net-2014"],
  }));
  assert.equal(registry.getItem("weapon:net").weaponProfile.damage.length, 0);

  assert.throws(() => registry.registerItem(makeWeapon({
    id: "weapon:unmodeled-special",
    properties: ["special"],
  })), /requires structured specialRules/);
});
