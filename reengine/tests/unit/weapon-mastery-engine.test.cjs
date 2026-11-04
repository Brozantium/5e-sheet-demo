const test = require("node:test");
const assert = require("node:assert/strict");

const {
  WEAPON_MASTERY_CLASS_POLICIES,
  getWeaponMasteryClassPolicy,
  createWeaponMasterySelectionMechanic,
  getEligibleWeaponMasteryWeapons,
  validateWeaponMasterySelection,
  resolveWeaponMasteryAvailability,
} = require("../../.test-dist/engines/weapon-mastery-engine.js");

const weapon = ({
  id,
  name = id,
  category = "simple",
  weaponType = "melee",
  mastery,
  ruleset = "2024",
  baseItemId,
} = {}) => ({
  id: "weapon:" + id,
  name,
  ruleset,
  category: "weapon",
  ...(baseItemId ? { baseItemId } : {}),
  weaponProfile: {
    weaponCategory: category,
    weaponType,
    damage: [{ formula: "1d6", damageType: "slashing" }],
    ...(mastery ? { mastery } : {}),
  },
});

const weapons = [
  weapon({ id: "dagger", category: "simple", weaponType: "melee", mastery: "nick" }),
  weapon({ id: "longsword", category: "martial", weaponType: "melee", mastery: "sap" }),
  weapon({ id: "longbow", category: "martial", weaponType: "ranged", mastery: "slow" }),
  weapon({ id: "club", category: "simple", weaponType: "melee", mastery: "slow" }),
  weapon({ id: "unmastered", mastery: undefined }),
  weapon({ id: "old-rapier", ruleset: "2014", category: "martial", mastery: "vex" }),
];

test("Weapon Mastery catalog and class policies cover the five 2024 classes", () => {
  assert.deepEqual(Object.keys(WEAPON_MASTERY_CLASS_POLICIES).sort(), [
    "barbarian", "fighter", "paladin", "ranger", "rogue",
  ]);
  assert.equal(getWeaponMasteryClassPolicy("barbarian").initialChoices, 2);
  assert.equal(getWeaponMasteryClassPolicy("fighter").initialChoices, 3);
  assert.equal(getWeaponMasteryClassPolicy("paladin").initialChoices, 2);
  assert.equal(getWeaponMasteryClassPolicy("ranger").initialChoices, 2);
  assert.equal(getWeaponMasteryClassPolicy("rogue").initialChoices, 2);
  assert.equal(getWeaponMasteryClassPolicy("monk"), undefined);
});

test("Barbarian choices are melee weapons; Fighter choices include Simple and Martial ranged weapons", () => {
  const barbarian = getEligibleWeaponMasteryWeapons({
    ruleset: "2024",
    classId: "barbarian",
    weapons,
  }).map((entry) => entry.id);
  const fighter = getEligibleWeaponMasteryWeapons({
    ruleset: "2024",
    classId: "fighter",
    weapons,
  }).map((entry) => entry.id);

  assert.ok(barbarian.includes("weapon:dagger"));
  assert.ok(barbarian.includes("weapon:longsword"));
  assert.ok(!barbarian.includes("weapon:longbow"));
  assert.ok(fighter.includes("weapon:longbow"));
  assert.ok(!fighter.includes("weapon:unmastered"));
  assert.ok(!fighter.includes("weapon:old-rapier"));
});

test("Paladin, Ranger, and Rogue choices require category or exact weapon proficiency", () => {
  const paladin = getEligibleWeaponMasteryWeapons({
    ruleset: "2024",
    classId: "paladin",
    weapons,
    weaponProficiencies: [{ kind: "category", category: "martial" }],
  }).map((entry) => entry.id);
  const rogue = getEligibleWeaponMasteryWeapons({
    ruleset: "2024",
    classId: "rogue",
    weapons,
    weaponProficiencies: [{ kind: "weapon", weaponId: "weapon:longsword" }],
  }).map((entry) => entry.id);
  assert.ok(paladin.includes("weapon:longsword"));
  assert.ok(paladin.includes("weapon:longbow"));
  assert.ok(!paladin.includes("weapon:dagger"));
  assert.deepEqual(rogue, ["weapon:longsword"]);
});

test("2014 characters do not receive Weapon Mastery choice options", () => {
  const result = getEligibleWeaponMasteryWeapons({
    ruleset: "2014",
    classId: "fighter",
    weapons,
  });
  assert.deepEqual(result, []);
});

test("generic SelectionMechanic models Long Rest replacement and class progression capacity", () => {
  const barbarian = createWeaponMasterySelectionMechanic({
    classId: "barbarian",
    id: "barbarian:weapon-mastery",
    optionSetId: "weapon-mastery:barbarian",
    classProgressionCount: {
      kind: "class-table",
      tableId: "barbarian",
      column: "weaponMastery",
    },
  });
  const paladin = createWeaponMasterySelectionMechanic({
    classId: "paladin",
    id: "paladin:weapon-mastery",
    optionSetId: "weapon-mastery:paladin",
  });
  assert.equal(barbarian.mode, "multiple");
  assert.equal(barbarian.count.kind, "class-table");
  assert.deepEqual(barbarian.replacement, { when: "long-rest", count: 1 });
  assert.deepEqual(paladin.count, { kind: "fixed", value: 2 });
  assert.deepEqual(paladin.replacement, { when: "long-rest", count: 1 });
  assert.throws(() => createWeaponMasterySelectionMechanic({
    classId: "fighter",
    id: "fighter:weapon-mastery",
    optionSetId: "weapon-mastery:fighter",
  }), /requires its class-progression count/);
});

test("selection validator checks capacity, duplicates, unknown IDs, and class eligibility", () => {
  const valid = validateWeaponMasterySelection({
    ruleset: "2024",
    classId: "barbarian",
    selectedWeaponIds: ["weapon:dagger", "weapon:longsword"],
    maximumSelections: 2,
    weapons,
  });
  assert.equal(valid.valid, true);
  const duplicate = validateWeaponMasterySelection({
    ruleset: "2024",
    classId: "barbarian",
    selectedWeaponIds: ["weapon:dagger", "weapon:dagger"],
    maximumSelections: 2,
    weapons,
  });
  assert.equal(duplicate.valid, false);
  assert.ok(duplicate.issues.some((issue) => issue.code === "duplicate-weapon-mastery-choice"));
  const ineligible = validateWeaponMasterySelection({
    ruleset: "2024",
    classId: "barbarian",
    selectedWeaponIds: ["weapon:longbow"],
    maximumSelections: 1,
    weapons,
  });
  assert.ok(ineligible.issues.some((issue) => issue.code === "ineligible-weapon-mastery-choice"));
  const unknown = validateWeaponMasterySelection({
    ruleset: "2024",
    classId: "barbarian",
    selectedWeaponIds: ["weapon:unknown"],
    maximumSelections: 1,
    weapons,
  });
  assert.ok(unknown.issues.some((issue) => issue.code === "unknown-weapon-mastery-choice"));
  const countMismatch = validateWeaponMasterySelection({
    ruleset: "2024",
    classId: "barbarian",
    selectedWeaponIds: ["weapon:dagger"],
    maximumSelections: 2,
    weapons,
    mode: "complete",
  });
  assert.ok(countMismatch.issues.some((issue) => issue.code === "weapon-mastery-selection-count"));
});

test("draft Weapon Mastery selections may be incomplete while remaining under capacity", () => {
  const result = validateWeaponMasterySelection({
    ruleset: "2024",
    classId: "fighter",
    selectedWeaponIds: ["weapon:longbow"],
    maximumSelections: 3,
    weapons,
    mode: "draft",
  });
  assert.equal(result.valid, true);
});

test("Weapon Mastery is available only when feature is owned and weapon type is selected", () => {
  const longsword = weapons.find((entry) => entry.id === "weapon:longsword");
  const missingFeature = resolveWeaponMasteryAvailability({
    ruleset: "2024",
    weapon: longsword,
    ownsWeaponMasteryFeature: false,
    selectedWeaponIds: ["weapon:longsword"],
  });
  const notSelected = resolveWeaponMasteryAvailability({
    ruleset: "2024",
    weapon: longsword,
    ownsWeaponMasteryFeature: true,
    selectedWeaponIds: ["weapon:dagger"],
  });
  const available = resolveWeaponMasteryAvailability({
    ruleset: "2024",
    weapon: longsword,
    ownsWeaponMasteryFeature: true,
    selectedWeaponIds: ["weapon:longsword"],
  });
  assert.equal(missingFeature.available, false);
  assert.equal(missingFeature.reason, "missing-feature");
  assert.equal(notSelected.available, false);
  assert.equal(notSelected.reason, "weapon-not-selected");
  assert.equal(available.available, true);
  assert.equal(available.mastery, "sap");
});

test("magic weapon instances can inherit selected weapon-type mastery through baseItemId", () => {
  const magicLongsword = {
    id: "magic-item:flame-tongue",
    name: "Flame Tongue",
    ruleset: "2024",
    category: "magic-item",
    baseItemId: "weapon:longsword",
    weaponProfile: {
      weaponCategory: "martial",
      weaponType: "melee",
      damage: [{ formula: "1d8", damageType: "slashing" }],
      mastery: "sap",
    },
  };
  const result = resolveWeaponMasteryAvailability({
    ruleset: "2024",
    weapon: magicLongsword,
    ownsWeaponMasteryFeature: true,
    selectedWeaponIds: ["weapon:longsword"],
  });
  assert.equal(result.available, true);
  assert.equal(result.mastery, "sap");
});

test("Weapon Mastery does not activate for 2014 or items without a mastery", () => {
  const longsword = weapons.find((entry) => entry.id === "weapon:longsword");
  const wrongRuleset = resolveWeaponMasteryAvailability({
    ruleset: "2014",
    weapon: longsword,
    ownsWeaponMasteryFeature: true,
    selectedWeaponIds: ["weapon:longsword"],
  });
  const unmastered = resolveWeaponMasteryAvailability({
    ruleset: "2024",
    weapon: weapons.find((entry) => entry.id === "weapon:unmastered"),
    ownsWeaponMasteryFeature: true,
    selectedWeaponIds: ["weapon:unmastered"],
  });
  assert.equal(wrongRuleset.available, false);
  assert.equal(wrongRuleset.reason, "wrong-ruleset");
  assert.equal(unmastered.available, false);
  assert.equal(unmastered.reason, "weapon-has-no-mastery");
});
