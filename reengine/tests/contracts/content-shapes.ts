import type { CharacterMechanicsState, ClassDefinition, OptionSetDefinition } from "../../src/domain/types";
import type { ItemDefinition } from "../../src/domain/item";

export const fighter2014 = {
  id: "fighter",
  name: "Fighter",
  ruleset: "2014",
  hitDie: 10,
  source: { book: "Player's Handbook" },
  progression: {
    id: "fighter",
    classId: "fighter",
    rows: [{ level: 1, values: { proficiencyBonus: 2 } }],
  },
  features: [{
    id: "fighter:second-wind",
    name: "Second Wind",
    level: 1,
    description: "A limited-use recovery feature.",
    ruleset: "2014",
    mechanics: [{
      kind: "resource-pool",
      id: "fighter:second-wind:uses",
      resourceId: "fighter:second-wind:uses",
      maximum: { kind: "fixed", value: 1 },
      recovery: "short-rest",
    }],
  }],
} satisfies ClassDefinition;

export const fightingStyles2014 = {
  id: "fighter:fighting-styles",
  name: "Fighting Styles",
  ruleset: "2014",
  options: [{
    id: "fighter:fighting-styles:archery",
    name: "Archery",
    description: "A ranged weapon attack benefit.",
    prerequisites: [{ kind: "class-level", classId: "fighter", minimum: 1 }],
    effects: [{ kind: "modifier", target: "attack.ranged", amount: 2 }],
  }],
} satisfies OptionSetDefinition;

export const longsword2014 = {
  id: "weapon:longsword",
  name: "Longsword",
  ruleset: "2014",
  category: "weapon",
  properties: ["versatile"],
  weaponProfile: {
    weaponCategory: "martial",
    weaponType: "melee",
    damage: [{ formula: "1d8", versatileFormula: "1d10", damageType: "slashing" }],
  },
} satisfies ItemDefinition;

export const chainMail2024 = {
  id: "armor:chain-mail",
  name: "Chain Mail",
  ruleset: "2024",
  category: "armor",
  armorProfile: {
    armorCategory: "heavy",
    baseAC: 16,
    dexterity: "none",
    strengthRequirement: 13,
    stealthDisadvantage: true,
  },
} satisfies ItemDefinition;

export const halfPlate2014 = {
  id: "armor:half-plate",
  name: "Half Plate",
  ruleset: "2014",
  category: "armor",
  armorProfile: {
    armorCategory: "medium",
    baseAC: 15,
    dexterity: "capped",
    maxDexterityModifier: 2,
    stealthDisadvantage: true,
  },
} satisfies ItemDefinition;

export const shield2024 = {
  id: "armor:shield",
  name: "Shield",
  ruleset: "2024",
  category: "shield",
  armorProfile: {
    armorCategory: "shield",
    baseAC: 2,
    dexterity: "none",
    stealthDisadvantage: false,
  },
} satisfies ItemDefinition;

export const fighterCharacter2014 = {
  id: "character-1",
  ruleset: "2014",
  classLevels: { fighter: 5 },
  abilityScores: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
  selections: {
    "fighter:fighting-style": ["fighter:fighting-styles:archery"],
  },
  assignments: [],
  resources: {
    "fighter:second-wind:uses": { maximum: 1, current: 0 },
  },
  knownSpells: [],
  ownedFeatures: ["fighter:second-wind"],
  inventoryItemTags: {
    "item-instance-1": ["weapon", "martial"],
  },
} satisfies CharacterMechanicsState;
