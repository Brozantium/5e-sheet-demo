const test = require("node:test");
const assert = require("node:assert/strict");

const { calculateArmorClass } = require("../../.test-dist/engines/armor-class-engine.js");

const armor = (overrides = {}) => ({
  id: "armor:leather",
  name: "Leather Armor",
  ruleset: "2014",
  category: "armor",
  armorProfile: {
    armorCategory: "light",
    baseAC: 11,
    dexterity: "full",
    stealthDisadvantage: false,
  },
  ...overrides,
});

const shield = (overrides = {}) => ({
  id: "armor:shield",
  name: "Shield",
  ruleset: "2014",
  category: "shield",
  armorProfile: {
    armorCategory: "shield",
    baseAC: 2,
    dexterity: "none",
    stealthDisadvantage: false,
  },
  ...overrides,
});

const input = (overrides = {}) => ({
  ruleset: "2014",
  abilityScores: { str: 10, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
  equipment: [],
  armorTraining: [],
  shieldTraining: false,
  ...overrides,
});

const equipped = (definition, instanceId = "item-instance-1", isEquipped = true) => ({
  instanceId,
  definition,
  equipped: isEquipped,
});

test("unarmored AC is 10 plus Dexterity modifier", () => {
  const result = calculateArmorClass(input());
  assert.equal(result.total, 12);
  assert.equal(result.baseAC, 12);
  assert.equal(result.defenseMode, "unarmored");
  assert.equal(result.dexterityContribution, 2);
});

test("light armor adds the full Dexterity modifier", () => {
  const result = calculateArmorClass(input({
    equipment: [equipped(armor())],
    armorTraining: ["light"],
  }));
  assert.equal(result.total, 13);
  assert.equal(result.baseAC, 13);
  assert.equal(result.armorProficient, true);
  assert.equal(result.armorInstanceId, "item-instance-1");
});

test("medium armor caps only positive Dexterity modifiers", () => {
  const medium = armor({
    id: "armor:half-plate",
    name: "Half Plate",
    armorProfile: {
      armorCategory: "medium",
      baseAC: 15,
      dexterity: "capped",
      maxDexterityModifier: 2,
      stealthDisadvantage: true,
    },
  });
  const positive = calculateArmorClass(input({
    abilityScores: { str: 10, dex: 18, con: 10, int: 10, wis: 10, cha: 10 },
    equipment: [equipped(medium)],
    armorTraining: ["medium"],
  }));
  assert.equal(positive.total, 17);
  assert.equal(positive.dexterityContribution, 2);
  assert.equal(positive.stealthDisadvantage, true);

  const negative = calculateArmorClass(input({
    abilityScores: { str: 10, dex: 8, con: 10, int: 10, wis: 10, cha: 10 },
    equipment: [equipped(medium)],
    armorTraining: ["medium"],
  }));
  assert.equal(negative.total, 14);
  assert.equal(negative.dexterityContribution, -1);
});

test("heavy armor ignores Dexterity and applies Strength speed requirement", () => {
  const chainMail = armor({
    id: "armor:chain-mail",
    name: "Chain Mail",
    armorProfile: {
      armorCategory: "heavy",
      baseAC: 16,
      dexterity: "none",
      strengthRequirement: 13,
      stealthDisadvantage: true,
    },
  });
  const result = calculateArmorClass(input({
    abilityScores: { str: 10, dex: 20, con: 10, int: 10, wis: 10, cha: 10 },
    equipment: [equipped(chainMail)],
    armorTraining: ["heavy"],
  }));
  assert.equal(result.total, 16);
  assert.equal(result.dexterityContribution, 0);
  assert.equal(result.speedPenalty, 10);
  assert.equal(result.stealthDisadvantage, true);
});

test("a proficient shield adds its profile AC bonus on top of armor", () => {
  const result = calculateArmorClass(input({
    equipment: [equipped(armor()), equipped(shield(), "shield-instance")],
    armorTraining: ["light"],
    shieldTraining: true,
  }));
  assert.equal(result.total, 15);
  assert.equal(result.shieldBonus, 2);
  assert.equal(result.shieldProficient, true);
  assert.equal(result.shieldInstanceId, "shield-instance");
});

test("2014 untrained shield still adds AC but reports the training issue", () => {
  const result = calculateArmorClass(input({
    equipment: [equipped(shield())],
  }));
  assert.equal(result.total, 14);
  assert.equal(result.shieldBonus, 2);
  assert.equal(result.issues[0].code, "shield-not-proficient");
});

test("2024 untrained shield does not grant its AC bonus", () => {
  const result = calculateArmorClass(input({
    ruleset: "2024",
    equipment: [equipped(shield({ ruleset: "2024" }))],
  }));
  assert.equal(result.total, 12);
  assert.equal(result.shieldBonus, 0);
  assert.equal(result.shieldProficient, false);
  assert.equal(result.issues[0].code, "shield-not-proficient");
});

test("shared armor content is compatible with both rulesets", () => {
  const sharedArmor = armor({ ruleset: "shared" });
  const result = calculateArmorClass(input({
    ruleset: "2024",
    equipment: [equipped(sharedArmor)],
    armorTraining: ["light"],
  }));
  assert.equal(result.total, 13);
  assert.equal(result.issues.length, 0);
});

test("incompatible ruleset equipment is ignored and reported", () => {
  const result = calculateArmorClass(input({
    ruleset: "2024",
    equipment: [equipped(armor({ ruleset: "2014" }))],
  }));
  assert.equal(result.total, 12);
  assert.equal(result.issues[0].code, "incompatible-ruleset-item");
});

test("Barbarian-style Unarmored Defense can be combined with a shield", () => {
  const result = calculateArmorClass(input({
    equipment: [equipped(shield())],
    unarmoredDefense: { ability: "con", allowsShield: true },
  }));
  assert.equal(result.total, 16);
  assert.equal(result.baseAC, 14);
  assert.equal(result.defenseMode, "unarmored-defense");
});

test("Monk-style Unarmored Defense is disabled while wielding a shield", () => {
  const result = calculateArmorClass(input({
    equipment: [equipped(shield())],
    unarmoredDefense: { ability: "wis", allowsShield: false },
  }));
  assert.equal(result.total, 14);
  assert.equal(result.baseAC, 12);
  assert.equal(result.defenseMode, "unarmored");
  assert.ok(result.issues.some((issue) => issue.code === "unarmored-defense-requires-no-shield"));
});

test("Unarmored Defense is ignored while armor is worn", () => {
  const result = calculateArmorClass(input({
    equipment: [equipped(armor())],
    armorTraining: ["light"],
    unarmoredDefense: { ability: "con", allowsShield: true },
  }));
  assert.equal(result.total, 13);
  assert.equal(result.defenseMode, "armor");
});

test("magic armor uses its complete canonical armor profile", () => {
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
  const result = calculateArmorClass(input({
    equipment: [equipped(magicArmor)],
    armorTraining: ["medium"],
  }));
  assert.equal(result.total, 16);
});

test("magic shield profile is resolved as a shield", () => {
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
  const result = calculateArmorClass(input({
    equipment: [equipped(magicShield)],
    shieldTraining: true,
  }));
  assert.equal(result.total, 15);
  assert.equal(result.shieldBonus, 3);
});

test("only one armor and one shield may be equipped", () => {
  assert.throws(() => calculateArmorClass(input({
    equipment: [equipped(armor(), "armor-1"), equipped(armor(), "armor-2")],
  })), /Only one armor/);
  assert.throws(() => calculateArmorClass(input({
    equipment: [equipped(shield(), "shield-1"), equipped(shield(), "shield-2")],
  })), /Only one shield/);
});

test("unequipped items do not affect AC", () => {
  const result = calculateArmorClass(input({
    equipment: [equipped(armor(), "armor-1", false), equipped(shield(), "shield-1", false)],
  }));
  assert.equal(result.total, 12);
  assert.equal(result.shieldBonus, 0);
});

test("invalid capped Dexterity profile is rejected", () => {
  const malformed = armor({
    armorProfile: {
      armorCategory: "medium",
      baseAC: 14,
      dexterity: "capped",
      stealthDisadvantage: false,
    },
  });
  assert.throws(() => calculateArmorClass(input({
    equipment: [equipped(malformed)],
  })), /requires a non-negative integer cap/);
});

test("duplicate equipment instance IDs and invalid AC bonuses are rejected", () => {
  assert.throws(() => calculateArmorClass(input({
    equipment: [equipped(armor(), "duplicate"), equipped(shield(), "duplicate")],
  })), /Duplicate equipment instance ID/);
  assert.throws(() => calculateArmorClass(input({ otherBonus: 1.5 })), /Other Armor Class bonus/);
});
