const test = require("node:test");
const assert = require("node:assert/strict");

const {
  calculateAbilityCheckBonus,
  calculateAbilityModifier,
  calculateCharacterCore,
  calculatePassiveScore,
  calculateProficiencyBonus,
  calculateProficiencyContribution,
  calculateSavingThrowBonus,
  calculateSkillBonus,
  calculateTotalLevel,
} = require("../../.test-dist/engines/character-calculation-engine.js");

const scores = () => ({
  str: 16,
  dex: 14,
  con: 12,
  int: 10,
  wis: 15,
  cha: 8,
});

test("ability modifiers use floor for odd scores and support the full 1-30 range", () => {
  assert.equal(calculateAbilityModifier(1), -5);
  assert.equal(calculateAbilityModifier(8), -1);
  assert.equal(calculateAbilityModifier(9), -1);
  assert.equal(calculateAbilityModifier(10), 0);
  assert.equal(calculateAbilityModifier(11), 0);
  assert.equal(calculateAbilityModifier(12), 1);
  assert.equal(calculateAbilityModifier(20), 5);
  assert.equal(calculateAbilityModifier(30), 10);
});

test("ability modifiers reject non-integers and scores outside the rules range", () => {
  assert.throws(() => calculateAbilityModifier(0), /Ability score/);
  assert.throws(() => calculateAbilityModifier(31), /Ability score/);
  assert.throws(() => calculateAbilityModifier(10.5), /Ability score/);
});

test("total level sums multiclass levels and permits a level-zero draft", () => {
  assert.equal(calculateTotalLevel({}), 0);
  assert.equal(calculateTotalLevel({ fighter: 3, rogue: 2 }), 5);
});

test("total level rejects invalid class levels and totals above 20", () => {
  assert.throws(() => calculateTotalLevel({ fighter: -1 }), /Class level/);
  assert.throws(() => calculateTotalLevel({ fighter: 1.5 }), /Class level/);
  assert.throws(() => calculateTotalLevel({ fighter: 21 }), /Class level/);
  assert.throws(
    () => calculateTotalLevel({ fighter: 12, rogue: 9 }),
    /Total character level/,
  );
});

test("proficiency bonus follows total character level breakpoints", () => {
  for (const level of [1, 2, 3, 4]) assert.equal(calculateProficiencyBonus(level), 2);
  for (const level of [5, 6, 7, 8]) assert.equal(calculateProficiencyBonus(level), 3);
  for (const level of [9, 10, 11, 12]) assert.equal(calculateProficiencyBonus(level), 4);
  for (const level of [13, 14, 15, 16]) assert.equal(calculateProficiencyBonus(level), 5);
  for (const level of [17, 18, 19, 20]) assert.equal(calculateProficiencyBonus(level), 6);
  assert.equal(calculateProficiencyBonus(0), 0);
});

test("proficiency bonus rejects levels beyond the supported range", () => {
  assert.throws(() => calculateProficiencyBonus(-1), /Total character level/);
  assert.throws(() => calculateProficiencyBonus(21), /Total character level/);
});

test("proficiency ranks are alternatives; half is rounded down and expertise doubles once", () => {
  assert.equal(calculateProficiencyContribution(3, "none"), 0);
  assert.equal(calculateProficiencyContribution(3, "half"), 1);
  assert.equal(calculateProficiencyContribution(5, "half"), 2);
  assert.equal(calculateProficiencyContribution(3, "proficient"), 3);
  assert.equal(calculateProficiencyContribution(3, "expertise"), 6);
  assert.equal(calculateAbilityCheckBonus(10, 3, "expertise"), 6);
});

test("saving throw proficiency adds PB only to the selected save", () => {
  assert.equal(calculateSavingThrowBonus(14, 3, true), 5);
  assert.equal(calculateSavingThrowBonus(14, 3, false), 2);
});

test("skill bonuses use the canonical skill-to-ability mapping", () => {
  assert.equal(calculateSkillBonus("athletics", scores(), 3, "proficient"), 6);
  assert.equal(calculateSkillBonus("stealth", scores(), 3, "expertise"), 8);
  assert.equal(calculateSkillBonus("perception", scores(), 3, "half"), 3);
  assert.equal(calculateSkillBonus("arcana", scores(), 3), 0);
  assert.throws(() => calculateSkillBonus("not-a-skill", scores(), 3), /Unknown skill/);
});

test("passive scores are derived from the check bonus and a flat adjustment", () => {
  assert.equal(calculatePassiveScore(5), 15);
  assert.equal(calculatePassiveScore(5, 2), 17);
  assert.equal(calculatePassiveScore(-1), 9);
});

test("character core uses total multiclass level, proficiency grants, and derived scores", () => {
  const result = calculateCharacterCore({
    classLevels: { fighter: 3, rogue: 2 },
    abilityScores: scores(),
    proficiencies: {
      savingThrows: ["str", "con"],
      skills: {
        athletics: "proficient",
        stealth: "expertise",
        perception: "half",
      },
      initiative: "half",
    },
    initiativeBonus: 1,
    passivePerceptionBonus: 2,
  });

  assert.equal(result.totalLevel, 5);
  assert.equal(result.proficiencyBonus, 3);
  assert.deepEqual(result.abilityModifiers, {
    str: 3,
    dex: 2,
    con: 1,
    int: 0,
    wis: 2,
    cha: -1,
  });
  assert.deepEqual(result.savingThrows, {
    str: 6,
    dex: 2,
    con: 4,
    int: 0,
    wis: 2,
    cha: -1,
  });
  assert.equal(result.skills.athletics, 6);
  assert.equal(result.skills.stealth, 8);
  assert.equal(result.skills.perception, 3);
  assert.equal(result.initiative, 4);
  assert.equal(result.passivePerception, 15);
});

test("ordinary initiative does not add PB unless an explicit grant is provided", () => {
  const ordinary = calculateCharacterCore({
    classLevels: { fighter: 5 },
    abilityScores: scores(),
  });
  const granted = calculateCharacterCore({
    classLevels: { fighter: 5 },
    abilityScores: scores(),
    proficiencies: { initiative: "half" },
  });

  assert.equal(ordinary.initiative, 2);
  assert.equal(granted.initiative, 3);
});

test("character core rejects unknown proficiency references and invalid flat bonuses", () => {
  assert.throws(
    () =>
      calculateCharacterCore({
        classLevels: { fighter: 1 },
        abilityScores: scores(),
        proficiencies: { skills: { unknown: "proficient" } },
      }),
    /Unknown skill/,
  );
  assert.throws(
    () =>
      calculateCharacterCore({
        classLevels: { fighter: 1 },
        abilityScores: scores(),
        proficiencies: { savingThrows: ["luck"] },
      }),
    /Unknown saving throw ability/,
  );
  assert.throws(
    () =>
      calculateCharacterCore({
        classLevels: { fighter: 1 },
        abilityScores: scores(),
        initiativeBonus: 1.5,
      }),
    /Initiative bonus/,
  );
});
