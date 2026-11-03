const test = require("node:test");
const assert = require("node:assert/strict");

const { calculateWeaponAttack } = require("../../.test-dist/engines/weapon-attack-engine.js");

const scores = (overrides = {}) => ({
  str: 14, dex: 12, con: 12, int: 10, wis: 10, cha: 10, ...overrides,
});

const rapier = (overrides = {}) => ({
  id: "weapon:rapier",
  name: "Rapier",
  ruleset: "shared",
  category: "weapon",
  properties: ["finesse"],
  weaponProfile: {
    weaponCategory: "martial",
    weaponType: "melee",
    damage: [{ formula: "1d8", damageType: "piercing" }],
  },
  ...overrides,
});

const attack = (overrides = {}) => calculateWeaponAttack({
  ruleset: "2014",
  weapon: { instanceId: "weapon-1", definition: rapier(), equipped: true },
  abilityScores: scores(),
  proficiencyBonus: 3,
  weaponProficiencies: [{ kind: "category", category: "martial" }],
  ...overrides,
});

test("melee defaults to Strength and Finesse selects the higher Dexterity modifier", () => {
  const ordinary = calculateWeaponAttack({
    ruleset: "2014",
    weapon: { instanceId: "club", definition: rapier({ properties: [] }), equipped: true },
    abilityScores: scores(),
    proficiencyBonus: 2,
    weaponProficiencies: [{ kind: "category", category: "martial" }],
  });
  const finesse = attack({ abilityScores: scores({ str: 12, dex: 18 }) });

  assert.equal(ordinary.ability, "str");
  assert.equal(ordinary.attackBonus, 4);
  assert.equal(finesse.ability, "dex");
  assert.equal(finesse.abilityModifier, 4);
  assert.equal(finesse.attackBonus, 7);
  assert.equal(finesse.damage[0].displayFormula, "1d8 + 4");
});

test("Finesse ties retain Strength and ranged weapons use Dexterity", () => {
  const tie = attack({ abilityScores: scores({ str: 16, dex: 16 }) });
  const bow = {
    id: "weapon:longbow",
    name: "Longbow",
    ruleset: "shared",
    category: "weapon",
    properties: ["heavy", "two-handed"],
    weaponProfile: {
      weaponCategory: "martial",
      weaponType: "ranged",
      damage: [{ formula: "1d8", damageType: "piercing" }],
    },
  };
  const ranged = calculateWeaponAttack({
    ruleset: "2014",
    weapon: { instanceId: "bow", definition: bow, equipped: true },
    abilityScores: scores({ str: 18, dex: 14 }),
    proficiencyBonus: 2,
    weaponProficiencies: [{ kind: "category", category: "martial" }],
    grip: "two-handed",
  });

  assert.equal(tie.ability, "str");
  assert.equal(ranged.ability, "dex");
  assert.equal(ranged.attackBonus, 4);
});

test("Thrown melee weapons keep the melee ability rule", () => {
  const javelin = {
    id: "weapon:javelin",
    name: "Javelin",
    ruleset: "shared",
    category: "weapon",
    properties: ["thrown"],
    weaponProfile: {
      weaponCategory: "simple",
      weaponType: "melee",
      damage: [{ formula: "1d6", damageType: "piercing" }],
    },
  };
  const result = calculateWeaponAttack({
    ruleset: "2024",
    weapon: { instanceId: "javelin-1", definition: javelin, equipped: true },
    abilityScores: scores({ str: 18, dex: 12 }),
    proficiencyBonus: 2,
    weaponProficiencies: [{ kind: "category", category: "simple" }],
  });
  assert.equal(result.ability, "str");
  assert.equal(result.attackBonus, 6);
});

test("proficiency can match category, exact weapon, or canonical base item", () => {
  const weapon = rapier({ baseItemId: "weapon:rapier-base" });
  const byBase = calculateWeaponAttack({
    ruleset: "2014",
    weapon: { instanceId: "rapier-1", definition: weapon, equipped: true },
    abilityScores: scores(),
    proficiencyBonus: 3,
    weaponProficiencies: [{ kind: "weapon", weaponId: "weapon:rapier-base" }],
  });
  const byExact = attack({
    weapon: { instanceId: "rapier-2", definition: rapier(), equipped: true },
    weaponProficiencies: [{ kind: "weapon", weaponId: "weapon:rapier" }],
  });
  assert.equal(byBase.proficient, true);
  assert.equal(byBase.proficiencyContribution, 3);
  assert.equal(byExact.proficient, true);
});

test("non-proficiency omits PB but does not prohibit the attack", () => {
  const result = attack({ weaponProficiencies: [] });
  assert.equal(result.canAttack, true);
  assert.equal(result.proficient, false);
  assert.equal(result.proficiencyContribution, 0);
  assert.equal(result.attackBonus, 2);
  assert.ok(result.issues.some((issue) => issue.code === "weapon-not-proficient"));
});

test("universal and edition-specific item compatibility is respected", () => {
  const incompatible = attack({
    ruleset: "2024",
    weapon: { instanceId: "old-weapon", definition: rapier({ ruleset: "2014" }), equipped: true },
  });
  const shared = attack();
  assert.equal(incompatible.canAttack, false);
  assert.ok(incompatible.issues.some((issue) => issue.code === "incompatible-ruleset-item"));
  assert.equal(shared.canAttack, true);
});

test("unequipped weapons and weapons that require two hands cannot be attacked with", () => {
  const unequipped = attack({
    weapon: { instanceId: "weapon-1", definition: rapier(), equipped: false },
  });
  const heavy = attack({
    weapon: {
      instanceId: "greatsword",
      definition: rapier({ name: "Greatsword", properties: ["heavy", "two-handed"] }),
      equipped: true,
    },
  });
  assert.equal(unequipped.canAttack, false);
  assert.equal(heavy.canAttack, false);
  assert.ok(heavy.issues.some((issue) => issue.code === "weapon-requires-two-hands"));
});

test("Versatile uses the alternate primary damage formula only with a two-handed grip", () => {
  const longsword = {
    id: "weapon:longsword",
    name: "Longsword",
    ruleset: "shared",
    category: "weapon",
    properties: ["versatile"],
    weaponProfile: {
      weaponCategory: "martial",
      weaponType: "melee",
      damage: [{ formula: "1d8", versatileFormula: "1d10", damageType: "slashing" }],
    },
  };
  const oneHand = attack({
    weapon: { instanceId: "longsword", definition: longsword, equipped: true },
  });
  const twoHands = attack({
    weapon: { instanceId: "longsword", definition: longsword, equipped: true },
    grip: "two-handed",
  });
  assert.equal(oneHand.damage[0].formula, "1d8");
  assert.equal(twoHands.damage[0].formula, "1d10");
  assert.equal(twoHands.damage[0].displayFormula, "1d10 + 2");
});

test("missing versatile formula is surfaced without silently increasing damage", () => {
  const result = attack({
    weapon: { instanceId: "longsword", definition: rapier({ properties: ["versatile"] }), equipped: true },
    grip: "two-handed",
  });
  assert.equal(result.damage[0].formula, "1d8");
  assert.ok(result.issues.some((issue) => issue.code === "missing-versatile-damage"));
});

test("additional attack and damage bonuses are explicit and damage modifier is applied once", () => {
  const multiDamage = rapier({
    weaponProfile: {
      weaponCategory: "martial",
      weaponType: "melee",
      damage: [
        { formula: "1d8", damageType: "piercing" },
        { formula: "1d4", damageType: "fire" },
      ],
    },
  });
  const result = attack({
    weapon: { instanceId: "flame-rapier", definition: multiDamage, equipped: true },
    attackBonus: 1,
    damageBonus: 2,
  });
  assert.equal(result.attackBonus, 6);
  assert.equal(result.damageModifier, 4);
  assert.deepEqual(result.damage.map((part) => part.modifier), [4, 0]);
  assert.deepEqual(result.damage.map((part) => part.displayFormula), ["1d8 + 4", "1d4"]);
});

test("damage can explicitly omit ability modifier while retaining a flat bonus", () => {
  const result = attack({
    includeAbilityModifierInDamage: false,
    damageBonus: 1,
  });
  assert.equal(result.damageModifier, 1);
  assert.equal(result.damage[0].displayFormula, "1d8 + 1");
});

test("invalid scores, bonuses, grip, and proficiency records are rejected", () => {
  assert.throws(() => attack({ abilityScores: scores({ str: 31 }) }), /STR score/);
  assert.throws(() => attack({ proficiencyBonus: 7 }), /Proficiency bonus/);
  assert.throws(() => attack({ attackBonus: 1.5 }), /Additional attack bonus/);
  assert.throws(() => attack({ grip: "three-hands" }), /Weapon grip/);
  assert.throws(() => attack({ weaponProficiencies: [{ kind: "category", category: "exotic" }] }), /category/);
});
