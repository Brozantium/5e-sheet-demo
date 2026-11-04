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
  creatureSize: "medium",
  weaponProficiencies: [{ kind: "category", category: "martial" }],
  ...overrides,
});

test("melee defaults to Strength and Finesse permits either ability choice", () => {
  const ordinary = calculateWeaponAttack({
    ruleset: "2014",
    weapon: { instanceId: "club", definition: rapier({ properties: [] }), equipped: true },
    abilityScores: scores(),
    proficiencyBonus: 2,
    weaponProficiencies: [{ kind: "category", category: "martial" }],
  });
  const finesseDex = attack({ abilityScores: scores({ str: 12, dex: 18 }) });
  const finesseStr = attack({
    abilityScores: scores({ str: 12, dex: 18 }),
    abilityChoice: "str",
  });

  assert.equal(ordinary.ability, "str");
  assert.equal(ordinary.attackBonus, 4);
  assert.equal(finesseDex.ability, "dex");
  assert.equal(finesseDex.abilityModifier, 4);
  assert.equal(finesseDex.attackBonus, 7);
  assert.equal(finesseDex.damage[0].displayFormula, "1d8 + 4");
  assert.equal(finesseStr.ability, "str");
  assert.equal(finesseStr.attackBonus, 4);
  assert.equal(finesseStr.damage[0].displayFormula, "1d8 + 1");
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
    creatureSize: "medium",
    weaponProficiencies: [{ kind: "category", category: "martial" }],
    grip: "two-handed",
  });

  assert.equal(tie.ability, "str");
  assert.equal(ranged.ability, "dex");
  assert.equal(ranged.attackBonus, 4);
});

test("Finesse ranged weapons such as Darts allow Strength or Dexterity", () => {
  const dart = {
    id: "weapon:dart",
    name: "Dart",
    ruleset: "shared",
    category: "weapon",
    properties: ["finesse", "thrown"],
    weaponProfile: {
      weaponCategory: "simple",
      weaponType: "ranged",
      damage: [{ formula: "1d4", damageType: "piercing" }],
    },
  };
  const result = calculateWeaponAttack({
    ruleset: "2024",
    weapon: { instanceId: "dart-1", definition: dart, equipped: true },
    abilityScores: scores({ str: 18, dex: 12 }),
    proficiencyBonus: 2,
    abilityChoice: "str",
    weaponProficiencies: [{ kind: "category", category: "simple" }],
  });
  assert.equal(result.ability, "str");
  assert.equal(result.attackBonus, 6);
  assert.equal(result.damage[0].displayFormula, "1d4 + 4");
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

test("only Two-Handed, not Heavy by itself, requires a two-handed grip", () => {
  const heavyOneHanded = attack({
    weapon: {
      instanceId: "heavy-one-handed",
      definition: rapier({ properties: ["heavy"] }),
      equipped: true,
    },
    ruleset: "2014",
    creatureSize: "medium",
  });
  assert.equal(heavyOneHanded.canAttack, true);
  assert.equal(heavyOneHanded.hasHeavyWeaponDisadvantage, false);
});

test("Heavy weapon disadvantage follows the 2014 size and 2024 ability-score rules", () => {
  const heavyMelee = {
    instanceId: "heavy-melee",
    definition: rapier({ properties: ["heavy"] }),
    equipped: true,
  };
  const small2014 = attack({ weapon: heavyMelee, ruleset: "2014", creatureSize: "small" });
  const medium2014 = attack({ weapon: heavyMelee, ruleset: "2014", creatureSize: "medium" });
  const lowStrength2024 = attack({
    weapon: heavyMelee,
    ruleset: "2024",
    abilityScores: scores({ str: 12 }),
  });
  const enoughStrength2024 = attack({
    weapon: heavyMelee,
    ruleset: "2024",
    abilityScores: scores({ str: 13 }),
  });
  const heavyRanged = {
    instanceId: "heavy-ranged",
    definition: rapier({
      properties: ["heavy"],
      weaponProfile: {
        weaponCategory: "martial",
        weaponType: "ranged",
        damage: [{ formula: "1d8", damageType: "piercing" }],
      },
    }),
    equipped: true,
  };
  const lowDexterity2024 = attack({
    weapon: heavyRanged,
    ruleset: "2024",
    abilityScores: scores({ dex: 12 }),
  });

  assert.equal(small2014.hasHeavyWeaponDisadvantage, true);
  assert.deepEqual(small2014.heavyWeaponDisadvantageReasons, ["heavy-weapon-size"]);
  assert.equal(medium2014.hasHeavyWeaponDisadvantage, false);
  assert.equal(lowStrength2024.hasHeavyWeaponDisadvantage, true);
  assert.deepEqual(lowStrength2024.heavyWeaponDisadvantageReasons, ["heavy-weapon-ability-score"]);
  assert.equal(enoughStrength2024.hasHeavyWeaponDisadvantage, false);
  assert.equal(lowDexterity2024.hasHeavyWeaponDisadvantage, true);
  assert.throws(() => attack({
    weapon: heavyMelee,
    ruleset: "2014",
    creatureSize: undefined,
  }), /Creature size/);
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

test("Versatile is rejected for ranged weapon profiles", () => {
  const rangedVersatile = rapier({
    properties: ["versatile"],
    weaponProfile: {
      weaponCategory: "martial",
      weaponType: "ranged",
      damage: [{ formula: "1d8", versatileFormula: "1d10", damageType: "piercing" }],
    },
  });
  assert.throws(() => attack({
    weapon: { instanceId: "ranged-versatile", definition: rangedVersatile, equipped: true },
    grip: "two-handed",
  }), /Versatile property requires a melee weapon/);
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

test("damage modifier modes support normal, omitted, and negative-only ability modifiers", () => {
  const omitted = attack({
    abilityModifierDamageMode: "none",
    damageBonus: 1,
  });
  const negativeOnly = attack({
    abilityScores: scores({ str: 8, dex: 12 }),
    abilityChoice: "str",
    abilityModifierDamageMode: "negative-only",
  });
  const positiveOnly = attack({
    abilityScores: scores({ str: 16, dex: 12 }),
    abilityModifierDamageMode: "negative-only",
  });

  assert.equal(omitted.damageModifier, 1);
  assert.equal(omitted.damage[0].displayFormula, "1d8 + 1");
  assert.equal(negativeOnly.damageModifier, -1);
  assert.equal(negativeOnly.damage[0].displayFormula, "1d8 - 1");
  assert.equal(positiveOnly.damageModifier, 0);
  assert.equal(positiveOnly.damage[0].displayFormula, "1d8");
});

test("invalid scores, bonuses, grip, finesse choices, and proficiency records are rejected", () => {
  assert.throws(() => attack({ abilityScores: scores({ str: 31 }) }), /STR score/);
  assert.throws(() => attack({ proficiencyBonus: 7 }), /Proficiency bonus/);
  assert.throws(() => attack({ attackBonus: 1.5 }), /Additional attack bonus/);
  assert.throws(() => attack({ grip: "three-hands" }), /Weapon grip/);
  assert.throws(() => attack({ abilityChoice: "con" }), /Finesse ability choice/);
  assert.throws(() => attack({ abilityChoice: "dex", weapon: { instanceId: "club", definition: rapier({ properties: [] }), equipped: true } }), /only valid for a Finesse/);
  assert.throws(() => attack({ abilityModifierDamageMode: "sometimes" }), /damage mode/);
  assert.throws(() => attack({ weaponProficiencies: [{ kind: "category", category: "exotic" }] }), /category/);
});

const lance2014 = () => ({
  id: "weapon:lance",
  name: "Lance",
  ruleset: "2014",
  category: "weapon",
  properties: ["reach", "special"],
  weaponProfile: {
    weaponCategory: "martial",
    weaponType: "melee",
    damage: [{ formula: "1d12", damageType: "piercing" }],
    specialRules: ["lance-2014"],
  },
});

const lance2024 = () => ({
  id: "weapon:lance-2024",
  name: "Lance",
  ruleset: "2024",
  category: "weapon",
  properties: ["heavy", "reach", "two-handed"],
  weaponProfile: {
    weaponCategory: "martial",
    weaponType: "melee",
    damage: [{ formula: "1d10", damageType: "piercing" }],
    twoHandedRule: { unlessMounted: true },
  },
});

test("Reach adds five feet to base reach and is reusable for Opportunity Attack reach", () => {
  const { calculateWeaponReach } = require("../../.test-dist/engines/weapon-attack-engine.js");
  assert.equal(calculateWeaponReach(), 5);
  assert.equal(calculateWeaponReach(5, true), 10);
  assert.equal(calculateWeaponReach(10, true), 15);

  const withReach = attack({
    weapon: { instanceId: "whip", definition: rapier({ properties: ["reach"] }), equipped: true },
    targetDistanceFeet: 10,
  });
  const outOfReach = attack({
    weapon: { instanceId: "whip", definition: rapier({ properties: ["reach"] }), equipped: true },
    targetDistanceFeet: 11,
  });
  assert.equal(withReach.effectiveReachFeet, 10);
  assert.equal(withReach.rangeBand, "melee");
  assert.equal(withReach.canAttack, true);
  assert.equal(outOfReach.canAttack, false);
  assert.ok(outOfReach.issues.some((issue) => issue.code === "target-out-of-reach"));
});

test("standard ranged attacks use normal/long range bands and reject targets beyond long range", () => {
  const bow = {
    id: "weapon:longbow",
    name: "Longbow",
    ruleset: "2024",
    category: "weapon",
    properties: ["ammunition", "heavy", "two-handed"],
    weaponProfile: {
      weaponCategory: "martial",
      weaponType: "ranged",
      damage: [{ formula: "1d8", damageType: "piercing" }],
      range: { normal: 150, long: 600 },
      ammunitionType: "arrow",
    },
  };
  const normal = attack({
    ruleset: "2024",
    weapon: { instanceId: "bow", definition: bow, equipped: true },
    attackMode: "ranged",
    targetDistanceFeet: 150,
    grip: "two-handed",
  });
  const long = attack({
    ruleset: "2024",
    weapon: { instanceId: "bow", definition: bow, equipped: true },
    attackMode: "ranged",
    targetDistanceFeet: 300,
    grip: "two-handed",
  });
  const tooFar = attack({
    ruleset: "2024",
    weapon: { instanceId: "bow", definition: bow, equipped: true },
    attackMode: "ranged",
    targetDistanceFeet: 601,
    grip: "two-handed",
  });
  assert.equal(normal.rangeBand, "normal");
  assert.equal(normal.hasRangeDisadvantage, false);
  assert.equal(long.rangeBand, "long");
  assert.equal(long.hasRangeDisadvantage, true);
  assert.deepEqual(long.rangeDisadvantageReasons, ["long-range"]);
  assert.equal(long.hasDisadvantage, true);
  assert.equal(tooFar.canAttack, false);
  assert.ok(tooFar.issues.some((issue) => issue.code === "target-out-of-range"));
});

test("Thrown mode uses thrownRange and preserves the weapon's melee ability rule", () => {
  const javelin = {
    id: "weapon:javelin",
    name: "Javelin",
    ruleset: "2024",
    category: "weapon",
    properties: ["thrown"],
    weaponProfile: {
      weaponCategory: "simple",
      weaponType: "melee",
      damage: [{ formula: "1d6", damageType: "piercing" }],
      thrownRange: { normal: 30, long: 120 },
    },
  };
  const result = attack({
    ruleset: "2024",
    weapon: { instanceId: "javelin", definition: javelin, equipped: true },
    attackMode: "thrown",
    targetDistanceFeet: 90,
    abilityScores: scores({ str: 18, dex: 12 }),
  });
  assert.equal(result.attackMode, "thrown");
  assert.equal(result.ability, "str");
  assert.equal(result.rangeBand, "long");
  assert.equal(result.hasRangeDisadvantage, true);
});

test("Thrown ranged weapons such as Darts use their thrown range and ranged ability rule", () => {
  const dart = {
    id: "weapon:dart",
    name: "Dart",
    ruleset: "2024",
    category: "weapon",
    properties: ["finesse", "thrown"],
    weaponProfile: {
      weaponCategory: "simple",
      weaponType: "ranged",
      damage: [{ formula: "1d4", damageType: "piercing" }],
      thrownRange: { normal: 20, long: 60 },
    },
  };
  const result = attack({
    ruleset: "2024",
    weapon: { instanceId: "dart", definition: dart, equipped: true },
    abilityScores: scores({ str: 12, dex: 18 }),
    targetDistanceFeet: 30,
  });
  assert.equal(result.attackMode, "thrown");
  assert.equal(result.ability, "dex");
  assert.equal(result.rangeBand, "long");
  assert.equal(result.hasDisadvantage, true);
});

test("2014 Lance has close-target disadvantage and requires two hands only while unmounted", () => {
  const close = attack({
    weapon: { instanceId: "lance", definition: lance2014(), equipped: true },
    targetDistanceFeet: 5,
    grip: "two-handed",
  });
  const atReach = attack({
    weapon: { instanceId: "lance", definition: lance2014(), equipped: true },
    targetDistanceFeet: 10,
    grip: "two-handed",
  });
  const mountedClose = attack({
    weapon: { instanceId: "lance", definition: lance2014(), equipped: true },
    targetDistanceFeet: 5,
    grip: "one-handed",
    isMounted: true,
  });
  const unmountedOneHanded = attack({
    weapon: { instanceId: "lance", definition: lance2014(), equipped: true },
    grip: "one-handed",
  });

  assert.equal(close.hasRangeDisadvantage, true);
  assert.deepEqual(close.rangeDisadvantageReasons, ["lance-close-range-2014"]);
  assert.equal(atReach.hasRangeDisadvantage, false);
  assert.equal(mountedClose.canAttack, true);
  assert.equal(mountedClose.hasRangeDisadvantage, true);
  assert.equal(unmountedOneHanded.canAttack, false);
  assert.ok(unmountedOneHanded.issues.some((issue) => issue.code === "weapon-requires-two-hands"));
});

test("2024 Lance uses one hand while mounted, but Heavy still checks Strength", () => {
  const mounted = attack({
    ruleset: "2024",
    weapon: { instanceId: "lance", definition: lance2024(), equipped: true },
    abilityScores: scores({ str: 12 }),
    grip: "one-handed",
    isMounted: true,
  });
  const unmounted = attack({
    ruleset: "2024",
    weapon: { instanceId: "lance", definition: lance2024(), equipped: true },
    grip: "one-handed",
    isMounted: false,
  });
  assert.equal(mounted.canAttack, true);
  assert.equal(mounted.hasHeavyWeaponDisadvantage, true);
  assert.equal(unmounted.canAttack, false);
  assert.ok(unmounted.issues.some((issue) => issue.code === "weapon-requires-two-hands"));
});

test("2014 Net can resolve a thrown attack without adding ordinary damage", () => {
  const net = {
    id: "weapon:net",
    name: "Net",
    ruleset: "2014",
    category: "weapon",
    properties: ["special", "thrown"],
    weaponProfile: {
      weaponCategory: "martial",
      weaponType: "ranged",
      damage: [],
      thrownRange: { normal: 5, long: 15 },
      specialRules: ["net-2014"],
    },
  };
  const result = attack({
    weapon: { instanceId: "net", definition: net, equipped: true },
    targetDistanceFeet: 10,
  });
  assert.equal(result.attackMode, "thrown");
  assert.equal(result.canAttack, true);
  assert.equal(result.damage.length, 0);
  assert.deepEqual(result.specialRules, ["net-2014"]);
  assert.equal(result.hasRangeDisadvantage, true);
});

test("unsupported attack modes, missing ranges, and invalid distances are handled explicitly", () => {
  const unsupported = attack({ attackMode: "ranged" });
  assert.equal(unsupported.canAttack, false);
  assert.ok(unsupported.issues.some((issue) => issue.code === "weapon-mode-not-supported"));

  const missingRange = attack({
    weapon: {
      instanceId: "bow",
      definition: {
        id: "weapon:bow",
        name: "Bow",
        ruleset: "shared",
        category: "weapon",
        properties: [],
        weaponProfile: {
          weaponCategory: "martial",
          weaponType: "ranged",
          damage: [{ formula: "1d8", damageType: "piercing" }],
        },
      },
      equipped: true,
    },
    targetDistanceFeet: 30,
  });
  assert.equal(missingRange.canAttack, false);
  assert.ok(missingRange.issues.some((issue) => issue.code === "missing-weapon-range"));
  assert.throws(() => attack({ targetDistanceFeet: -1 }), /non-negative integer/);
});
