const test = require("node:test");
const assert = require("node:assert/strict");

const {
  calculateArmorTrainingConsequences,
} = require("../../.test-dist/engines/armor-training-consequence-engine.js");

const armor = (category = "light", ruleset = "2014") => ({
  id: "armor:" + category,
  name: category + " Armor",
  ruleset,
  category: "armor",
  armorProfile: {
    armorCategory: category,
    baseAC: category === "light" ? 11 : category === "medium" ? 14 : 16,
    dexterity: category === "light" ? "full" : category === "medium" ? "capped" : "none",
    ...(category === "medium" ? { maxDexterityModifier: 2 } : {}),
    stealthDisadvantage: false,
  },
});

const shield = (ruleset = "2014") => ({
  id: "armor:shield",
  name: "Shield",
  ruleset,
  category: "shield",
  armorProfile: {
    armorCategory: "shield",
    baseAC: 2,
    dexterity: "none",
    stealthDisadvantage: false,
  },
});

const equipped = (definition, instanceId = definition.id, isEquipped = true) => ({
  instanceId,
  definition,
  equipped: isEquipped,
});

const evaluate = (overrides = {}) => calculateArmorTrainingConsequences({
  ruleset: "2014",
  equipment: [],
  armorTraining: [],
  shieldTraining: false,
  ...overrides,
});

test("unarmored characters have no armor training consequences", () => {
  const result = evaluate();
  assert.deepEqual(result.untrainedArmorInstanceIds, []);
  assert.deepEqual(result.untrainedShieldInstanceIds, []);
  assert.equal(result.disadvantageOnStrengthDexterityD20Tests, false);
  assert.equal(result.cannotCastSpells, false);
  assert.equal(result.shieldACBenefitDenied, false);
  assert.deepEqual(result.issues, []);
});

test("2014 untrained light, medium, and heavy armor penalize STR/DEX d20 rolls and block spellcasting", () => {
  for (const category of ["light", "medium", "heavy"]) {
    const result = evaluate({
      equipment: [equipped(armor(category))],
    });
    assert.deepEqual(result.untrainedArmorCategories, [category]);
    assert.equal(result.disadvantageOnStrengthDexterityD20Tests, true);
    assert.equal(result.cannotCastSpells, true);
    assert.equal(result.shieldACBenefitDenied, false);
    assert.ok(result.issues.some((issue) => issue.code === "armor-not-proficient"));
  }
});

test("2014 trained armor has no armor training consequences", () => {
  const result = evaluate({
    equipment: [equipped(armor("medium"))],
    armorTraining: ["medium"],
  });
  assert.equal(result.disadvantageOnStrengthDexterityD20Tests, false);
  assert.equal(result.cannotCastSpells, false);
  assert.deepEqual(result.issues, []);
});

test("2014 untrained shield imposes STR/DEX disadvantage and blocks spellcasting", () => {
  const result = evaluate({
    equipment: [equipped(shield())],
    shieldTraining: false,
  });
  assert.deepEqual(result.untrainedShieldInstanceIds, ["armor:shield"]);
  assert.equal(result.disadvantageOnStrengthDexterityD20Tests, true);
  assert.equal(result.cannotCastSpells, true);
  assert.equal(result.shieldACBenefitDenied, false);
  assert.ok(result.issues.some((issue) => issue.code === "shield-not-proficient"));
});

test("2014 untrained armor and shield produce one combined consequence state", () => {
  const result = evaluate({
    equipment: [equipped(armor("light")), equipped(shield(), "shield-instance")],
    armorTraining: [],
    shieldTraining: false,
  });
  assert.equal(result.disadvantageOnStrengthDexterityD20Tests, true);
  assert.equal(result.cannotCastSpells, true);
  assert.equal(result.issues.filter((issue) => issue.code === "armor-not-proficient").length, 1);
  assert.equal(result.issues.filter((issue) => issue.code === "shield-not-proficient").length, 1);
});

test("2024 untrained armor penalizes STR/DEX D20 Tests and blocks spellcasting", () => {
  const result = evaluate({
    ruleset: "2024",
    equipment: [equipped(armor("heavy", "2024"))],
  });
  assert.equal(result.disadvantageOnStrengthDexterityD20Tests, true);
  assert.equal(result.cannotCastSpells, true);
  assert.equal(result.shieldACBenefitDenied, false);
  assert.ok(result.issues.some((issue) => issue.code === "armor-not-proficient"));
});

test("2024 untrained shield loses AC but does not penalize rolls or spellcasting", () => {
  const result = evaluate({
    ruleset: "2024",
    equipment: [equipped(shield("2024"))],
    shieldTraining: false,
  });
  assert.equal(result.disadvantageOnStrengthDexterityD20Tests, false);
  assert.equal(result.cannotCastSpells, false);
  assert.equal(result.shieldACBenefitDenied, true);
  assert.deepEqual(result.untrainedShieldInstanceIds, ["armor:shield"]);
});

test("2024 trained shield has no shield training consequences", () => {
  const result = evaluate({
    ruleset: "2024",
    equipment: [equipped(shield("2024"))],
    shieldTraining: true,
  });
  assert.equal(result.shieldACBenefitDenied, false);
  assert.equal(result.disadvantageOnStrengthDexterityD20Tests, false);
  assert.equal(result.cannotCastSpells, false);
  assert.deepEqual(result.issues, []);
});

test("a proficient armor plus untrained shield follows the edition-specific shield rule", () => {
  const armor2014 = evaluate({
    equipment: [equipped(armor("light")), equipped(shield(), "shield-1")],
    armorTraining: ["light"],
  });
  const armor2024 = evaluate({
    ruleset: "2024",
    equipment: [
      equipped(armor("light", "2024")),
      equipped(shield("2024"), "shield-1"),
    ],
    armorTraining: ["light"],
  });
  assert.equal(armor2014.cannotCastSpells, true);
  assert.equal(armor2014.disadvantageOnStrengthDexterityD20Tests, true);
  assert.equal(armor2024.cannotCastSpells, false);
  assert.equal(armor2024.disadvantageOnStrengthDexterityD20Tests, false);
  assert.equal(armor2024.shieldACBenefitDenied, true);
});

test("magic armor and magic shields use their canonical armor profiles", () => {
  const magicArmor = {
    id: "magic-item:glamoured-armor",
    name: "Glamoured Armor",
    ruleset: "shared",
    category: "magic-item",
    armorProfile: {
      armorCategory: "medium",
      baseAC: 14,
      dexterity: "capped",
      maxDexterityModifier: 2,
      stealthDisadvantage: false,
    },
  };
  const magicShield = {
    id: "magic-item:shield-plus-one",
    name: "Shield +1",
    ruleset: "shared",
    category: "magic-item",
    armorProfile: {
      armorCategory: "shield",
      baseAC: 3,
      dexterity: "none",
      stealthDisadvantage: false,
    },
  };
  const result = evaluate({
    ruleset: "2024",
    equipment: [equipped(magicArmor), equipped(magicShield)],
    armorTraining: [],
    shieldTraining: false,
  });
  assert.equal(result.disadvantageOnStrengthDexterityD20Tests, true);
  assert.equal(result.cannotCastSpells, true);
  assert.equal(result.shieldACBenefitDenied, true);
});

test("unequipped and incompatible items do not impose armor training consequences", () => {
  const result = evaluate({
    ruleset: "2024",
    equipment: [
      equipped(armor("heavy", "2024"), "unequipped", false),
      equipped(armor("light", "2014"), "incompatible"),
    ],
  });
  assert.equal(result.disadvantageOnStrengthDexterityD20Tests, false);
  assert.equal(result.cannotCastSpells, false);
  assert.ok(result.issues.some((issue) => issue.code === "incompatible-ruleset-item"));
});

test("only one armor and one shield may be equipped", () => {
  assert.throws(() => evaluate({
    equipment: [
      equipped(armor("light"), "armor-1"),
      equipped(armor("heavy"), "armor-2"),
    ],
  }), /Only one armor/);
  assert.throws(() => evaluate({
    equipment: [
      equipped(shield(), "shield-1"),
      equipped(shield(), "shield-2"),
    ],
  }), /Only one shield/);
});

test("invalid training entries, equipment IDs, and flags are rejected", () => {
  assert.throws(() => evaluate({ armorTraining: ["exotic"] }), /Unknown armor training category/);
  assert.throws(() => evaluate({ armorTraining: ["light", "light"] }), /must be unique/);
  assert.throws(() => evaluate({ shieldTraining: "yes" }), /Shield training must be boolean/);
  assert.throws(() => evaluate({
    equipment: [equipped(armor(), "duplicate"), equipped(shield(), "duplicate")],
  }), /Duplicate equipment instance ID/);
  assert.throws(() => evaluate({
    equipment: [{ instanceId: "", definition: armor(), equipped: true }],
  }), /Equipment instance ID/);
});
