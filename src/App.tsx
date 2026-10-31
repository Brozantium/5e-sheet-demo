import { useEffect, useRef, useState } from "react"
import OBR, {
  buildShape,
  buildText,
  type Item,
  type Shape,
} from "@owlbear-rodeo/sdk"
import { SRD_SPELLS } from "./srd-spells"
import {
  casterLevelForProgression,
  consumeSpellResource,
  formulaAtLevel,
  pactSlotsForLevel,
  slotsForCasterLevel,
} from "./spell-rules"
import {
  CONDITION_TYPES,
  combineRollModes,
  conditionSummary,
  consumeCharges,
  effectiveMaxHp,
  effectiveSpeed,
  mergeDefenses,
  rechargeCharges,
  type ActiveCondition,
  type RollKind,
  type RollMode,
  type StructuredDefense,
} from "./combat-rules"

const ABILITIES = ["STR", "DEX", "CON", "INT", "WIS", "CHA"] as const
type Ab = typeof ABILITIES[number]

const SKILLS: [string, Ab][] = [
  ["Acrobatics", "DEX"],
  ["Animal Handling", "WIS"],
  ["Arcana", "INT"],
  ["Athletics", "STR"],
  ["Deception", "CHA"],
  ["History", "INT"],
  ["Insight", "WIS"],
  ["Intimidation", "CHA"],
  ["Investigation", "INT"],
  ["Medicine", "WIS"],
  ["Nature", "INT"],
  ["Perception", "WIS"],
  ["Performance", "CHA"],
  ["Persuasion", "CHA"],
  ["Religion", "INT"],
  ["Sleight of Hand", "DEX"],
  ["Stealth", "DEX"],
  ["Survival", "WIS"],
]

type CustomAttack = {
  id: string
  name: string
  attackMode: "fixed" | "ability"
  attackBonus: number
  ability: Ab
  proficient: boolean
  damageFormula: string
  damageType: string
  range: string
  attackType: "melee" | "ranged" | "special"
  description: string
  source: string
  sourceType: "custom" | "feature" | "item" | "spell" | "natural"
  ownerId: string
  conditions: string
  effects: string
}
type ItemCategory = "weapon" | "armor" | "ammo" | "adventuring-gear" | "tool" | "other"
type ItemBase = {
  id: string
  category: ItemCategory
  name: string
  quantity: number
  weight: number
  value: number
  description: string
  combatFeatureId?: string
}
type WeaponClass = "simple" | "martial"
type WeaponKind = "melee" | "ranged"
type WeaponProp = "ammunition" | "finesse" | "heavy" | "light" | "loading" | "reach" | "special" | "thrown" | "two-handed" | "versatile"
type WeaponItem = ItemBase & {
  category: "weapon"
  weaponClass: WeaponClass
  weaponKind: WeaponKind
  props: WeaponProp[]
  equipped: boolean
  attackBonus: number
  damageDice: string
  versatileDice: string
  damageBonus: number
  damageType: string
  range: string
  ammoName: string
}
type ArmorItem = ItemBase & {
  category: "armor"
  armorMode: "base" | "bonus"
  baseAc: number
  dexMode: "full" | "max" | "none"
  maxDex: number
  acBonus: number
  equipped: boolean
  strengthRequirement: number
  stealthDisadvantage: boolean
}
type AmmoItem = ItemBase & {
  category: "ammo"
  ammoType: string
  compatibleWeapon: string
  recoveryNotes: string
}
type GearItem = ItemBase & {
  category: "adventuring-gear"
  consumable: boolean
  charges: number
  maxCharges: number
  chargeCost: number
  chargeRecharge: Recharge
  contents: string
  usage: string
}
type ToolItem = ItemBase & {
  category: "tool"
  linkedAbility: Ab | ""
  proficiency: 0 | 1 | 2
  miscBonus: number
  usage: string
}
type OtherItem = ItemBase & { category: "other" }
type InventoryItem = WeaponItem | ArmorItem | AmmoItem | GearItem | ToolItem | OtherItem
type FeatureCategory = "racial" | "class" | "subclass" | "custom-class" | "feat" | "other" | "invocation" | "pact-boon" | "selection"
type GrantSection = "saves" | "skills" | "training" | "resource" | "modifier" | "defense" | "movement" | "spellcasting" | "action" | "custom"
type Recharge = "short" | "long" | "dawn" | "manual"
type RechargeAmount = "all" | "one" | "fixed" | "custom"
type CombatEffectType = "healing" | "temporary-hp" | "damage" | "bonus-damage" | "armor-class" | "attack-roll" | "ability-check" | "saving-throw" | "advantage" | "disadvantage" | "movement" | "resistance" | "vulnerability" | "immunity" | "condition" | "resource-recovery" | "additional-attack" | "spellcasting" | "custom"
type CombatMechanicalEffect = {
  id: string
  type: CombatEffectType
  value: number
  formula: string
  detail: string
  damageType: string
  condition: string
  temporary: boolean
}
type ActiveEffect = {
  id: string
  sourceFeatureId: string
  sourceName: string
  sourceType: string
  name: string
  appliedAt: number
  duration: string
  endOn: Recharge | "manual"
  stacking: "stack" | "replace" | "refresh" | "non-stacking"
  effects: CombatMechanicalEffect[]
}
type FeatureSource = {
  className: string
  subclassName: string
  parentName: string
  level: number
  hitDie: number
  speed: number
  size: CharacterSize
}
type ContentType = "feat" | "background" | "race" | "subrace" | "class" | "subclass" | "item" | "spell" | "selection" | "invocation" | "pact-boon"
type ContentEntry = {
  id: string
  type: ContentType
  builtin: boolean
  feature: Feature
}
type SelectedSpell = {
  contentId: string
  sourceId: string
  prepared: boolean
}
type PactSlots = { max: number; used: number; level: number }
type FeatureEffects = {
  resource: {
    maxMode: "fixed" | "pb" | "ability" | "level" | "custom"
    max: number
    ability: Ab
    custom: string
    recharge: Recharge
    rechargeAmount: RechargeAmount
    rechargeValue: number
    rechargeCustom: string
    pool: string
    cost: number
    unlimited: boolean
  }
  modifier: { target: string; value: number; condition: string }
  defense: {
    resistances: string
    immunities: string
    conditionImmunities: string
    notes: string
  }
  movement: { mode: string; distance: number; senses: string }
  spellcasting: {
    ability: Ab | ""
    progression: "full" | "half" | "third" | "pact" | "custom"
    spellList: string
    additionalSpells: string
    notes: string
  }
  action: {
    actionType: string
    trigger: string
    target: string
    duration: string
    activationCondition: string
    endOn: Recharge | "manual"
    stacking: "stack" | "replace" | "refresh" | "non-stacking"
    ability: Ab | ""
    attackType: string
    range: string
    damageDice: string
    damageType: string
    saveAbility: Ab | ""
    notes: string
  }
  mechanical: CombatMechanicalEffect[]
  custom: { id: string; label: string; value: string }[]
}
type FeatureProficiencies = {
  sections: GrantSection[]
  saves: Ab[]
  armor: string[]
  weapons: WeaponClass[]
  specificWeapons: string
  tools: string
  languages: string
  skills: string[]
  expertise: string[]
  skillPick: number
  skillFrom: string[]
  skillChosen: string[]
  expertisePick: number
  expertiseChosen: string[]
  toolPick: number
  toolFrom: string[]
  toolChosen: string[]
}
type Feature = {
  id: string
  category: FeatureCategory
  name: string
  description: string
  proficiencies?: FeatureProficiencies
  source?: FeatureSource
  effects?: FeatureEffects
  key?: string
  used?: number
  meta?: Record<string, string>
}
type CharacterSize = "Small" | "Medium"
type AbilityMethod = "manual" | "standard" | "point-buy" | "roll"
type Sheet = {
  name: string
  cls: string
  race: string
  subrace: string
  abilityMethod: AbilityMethod
  abilityRolls: number[]
  asiChoices: Record<string, string>
  exp: number
  background: string
  alignment: string
  size: CharacterSize
  creatureType: "Humanoid"
  level: number
  subclass: string
  scores: Record<Ab, number>
  acBonus: number
  speed: number
  initMisc: number
  hp: number
  maxHp: number
  hpMode: "roll" | "avg" | "max"
  tempHp: number
  hitDie: number
  hpDice: number[]
  hpLock: boolean[]
  hitDiceUsed: number
  deathS: number
  deathF: number
  inspiration: boolean
  activeConditions: ActiveCondition[]
  exhaustionLevel: number
  customAttacks: CustomAttack[]
  slots: { max: number; used: number }[]
  pactSlots: PactSlots
  selectedSpells: SelectedSpell[]
  traits: Feature[]
  activeEffects: ActiveEffect[]
  dismissedFeatures: string[]
  inventory: InventoryItem[]
  notes: string
  skillNotes: Record<string, string>
  defenseNotes: string
  coins: Record<"CP" | "SP" | "EP" | "GP" | "PP", number>
}

function featureId() {
  return `feature-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function emptyFeatureProficiencies(): FeatureProficiencies {
  return {
    sections: [],
    saves: [],
    armor: [],
    weapons: [],
    specificWeapons: "",
    tools: "",
    languages: "",
    skills: [],
    expertise: [],
    skillPick: 0,
    skillFrom: [],
    skillChosen: [],
    expertisePick: 0,
    expertiseChosen: [],
    toolPick: 0,
    toolFrom: [],
    toolChosen: [],
  }
}

function emptyFeatureEffects(): FeatureEffects {
  return {
    resource: {
      maxMode: "fixed",
      max: 1,
      ability: "STR",
      custom: "",
      recharge: "long",
      rechargeAmount: "all",
      rechargeValue: 1,
      rechargeCustom: "",
      pool: "",
      cost: 1,
      unlimited: false,
    },
    modifier: { target: "Initiative", value: 0, condition: "" },
    defense: {
      resistances: "",
      immunities: "",
      conditionImmunities: "",
      notes: "",
    },
    movement: { mode: "Walking speed", distance: 0, senses: "" },
    spellcasting: {
      ability: "",
      progression: "custom",
      spellList: "",
      additionalSpells: "",
      notes: "",
    },
    action: {
      actionType: "Action",
      trigger: "",
      target: "Self",
      duration: "Instantaneous",
      activationCondition: "",
      endOn: "manual",
      stacking: "non-stacking",
      ability: "",
      attackType: "None",
      range: "",
      damageDice: "",
      damageType: "",
      saveAbility: "",
      notes: "",
    },
    mechanical: [],
    custom: [],
  }
}

function emptyFeatureSource(): FeatureSource {
  return {
    className: "",
    subclassName: "",
    parentName: "",
    level: 1,
    hitDie: 8,
    speed: 30,
    size: "Medium",
  }
}

function newFeature(category: FeatureCategory): Feature {
  return {
    id: featureId(),
    category,
    name: "",
    description: "",
    proficiencies: emptyFeatureProficiencies(),
    source: emptyFeatureSource(),
    effects: emptyFeatureEffects(),
  }
}

function createFeature(
  id: string,
  category: FeatureCategory,
  name: string,
  description: string,
  opts?: {
    sections?: GrantSection[]
    saves?: Ab[]
    armor?: string[]
    weapons?: WeaponClass[]
    specificWeapons?: string
    tools?: string
    languages?: string
    skills?: string[]
    level?: number
    className?: string
    subclassName?: string
    parentName?: string
    effects?: {
      resource?: Partial<FeatureEffects["resource"]>
      modifier?: Partial<FeatureEffects["modifier"]>
      defense?: Partial<FeatureEffects["defense"]>
      movement?: Partial<FeatureEffects["movement"]>
      spellcasting?: Partial<FeatureEffects["spellcasting"]>
      action?: Partial<FeatureEffects["action"]>
      mechanical?: CombatMechanicalEffect[]
    }
  },
): Feature {
  const p = emptyFeatureProficiencies()
  if (opts?.sections) p.sections = opts.sections
  if (opts?.saves) p.saves = opts.saves
  if (opts?.armor) p.armor = opts.armor
  if (opts?.weapons) p.weapons = opts.weapons
  if (opts?.specificWeapons) p.specificWeapons = opts.specificWeapons
  if (opts?.tools) p.tools = opts.tools
  if (opts?.languages) p.languages = opts.languages
  if (opts?.skills) p.skills = opts.skills

  const src = emptyFeatureSource()
  if (opts?.level) src.level = opts.level
  if (opts?.className) src.className = opts.className
  if (opts?.subclassName) src.subclassName = opts.subclassName
  if (opts?.parentName) src.parentName = opts.parentName

  const fx = emptyFeatureEffects()
  if (opts?.effects) {
    if (opts.effects.resource)
      fx.resource = { ...fx.resource, ...opts.effects.resource }
    if (opts.effects.modifier)
      fx.modifier = { ...fx.modifier, ...opts.effects.modifier }
    if (opts.effects.defense)
      fx.defense = { ...fx.defense, ...opts.effects.defense }
    if (opts.effects.movement)
      fx.movement = { ...fx.movement, ...opts.effects.movement }
    if (opts.effects.spellcasting)
      fx.spellcasting = { ...fx.spellcasting, ...opts.effects.spellcasting }
    if (opts.effects.action)
      fx.action = { ...fx.action, ...opts.effects.action }
    if (opts.effects.mechanical) fx.mechanical = opts.effects.mechanical
  }

  return {
    id,
    category,
    name,
    description,
    proficiencies: p,
    source: src,
    effects: fx,
  }
}

function detailedRaceTraits(
  raceIdOrName: string,
  name?: string,
  _parentName?: string,
): Feature[] {
  const key = (raceIdOrName || name || "").toLowerCase()

  const dwarfTraits = [
    createFeature(
      "srd-trait-dwarf-darkvision",
      "racial",
      "Darkvision",
      "Accustomed to life underground, you have superior vision in dark and dim conditions (60 ft.).",
      {
        sections: ["movement"],
        effects: {
          movement: {
            mode: "Walking speed",
            distance: 0,
            senses: "Darkvision 60 ft.",
          },
        },
      },
    ),
    createFeature(
      "srd-trait-dwarf-resilience",
      "racial",
      "Dwarven Resilience",
      "You have advantage on saving throws against poison, and you have resistance against poison damage.",
      {
        sections: ["defense"],
        effects: {
          defense: {
            resistances: "Poison",
            immunities: "",
            conditionImmunities: "",
            notes: "Advantage on saving throws against poison",
          },
        },
      },
    ),
    createFeature(
      "srd-trait-dwarf-combat-training",
      "racial",
      "Dwarven Combat Training",
      "You have proficiency with the battleaxe, handaxe, light hammer, and warhammer.",
      {
        sections: ["training"],
        specificWeapons: "battleaxe, handaxe, light hammer, warhammer",
      },
    ),
    createFeature(
      "srd-trait-dwarf-stonecunning",
      "racial",
      "Stonecunning",
      "Whenever you make an Intelligence (History) check related to the origin of stonework, you add double your proficiency bonus to the check.",
    ),
  ]

  if (key.includes("hill dwarf") || key.includes("hill-dwarf")) {
    return [
      ...dwarfTraits,
      createFeature(
        "srd-trait-hill-dwarf-toughness",
        "racial",
        "Dwarven Toughness",
        "Your hit point maximum increases by 1, and it increases by 1 every time you gain a level.",
      ),
    ]
  }
  if (key.includes("mountain dwarf") || key.includes("mountain-dwarf")) {
    return [
      ...dwarfTraits,
      createFeature(
        "srd-trait-mountain-dwarf-armor",
        "racial",
        "Dwarven Armor Training",
        "You have proficiency with light and medium armor.",
        {
          sections: ["training"],
          armor: ["Light", "Medium"],
        },
      ),
    ]
  }
  if (key.includes("dwarf")) {
    return dwarfTraits
  }

  if (key.includes("half-elf") || key.includes("half elf")) {
    return [
      createFeature(
        "srd-trait-half-elf-darkvision",
        "racial",
        "Darkvision",
        "Thanks to your elf blood, you have superior vision in dark and dim conditions (60 ft.).",
        {
          sections: ["movement"],
          effects: {
            movement: {
              mode: "Walking speed",
              distance: 0,
              senses: "Darkvision 60 ft.",
            },
          },
        },
      ),
      createFeature(
        "srd-trait-half-elf-fey-ancestry",
        "racial",
        "Fey Ancestry",
        "You have advantage on saving throws against being charmed, and magic can't put you to sleep.",
        {
          sections: ["defense"],
          effects: {
            defense: {
              resistances: "",
              immunities: "",
              conditionImmunities: "Sleep (magical)",
              notes: "Advantage on saving throws against being charmed",
            },
          },
        },
      ),
      createFeature(
        "srd-trait-half-elf-versatility",
        "racial",
        "Skill Versatility",
        "You gain proficiency in two skills of your choice.",
      ),
    ]
  }

  const elfTraits = [
    createFeature(
      "srd-trait-elf-darkvision",
      "racial",
      "Darkvision",
      "Accustomed to twilit forests and the night sky, you have superior vision in dark and dim conditions (60 ft.).",
      {
        sections: ["movement"],
        effects: {
          movement: {
            mode: "Walking speed",
            distance: 0,
            senses: "Darkvision 60 ft.",
          },
        },
      },
    ),
    createFeature(
      "srd-trait-elf-keen-senses",
      "racial",
      "Keen Senses",
      "You have proficiency in the Perception skill.",
      {
        sections: ["skills"],
        skills: ["Perception"],
      },
    ),
    createFeature(
      "srd-trait-elf-fey-ancestry",
      "racial",
      "Fey Ancestry",
      "You have advantage on saving throws against being charmed, and magic can't put you to sleep.",
      {
        sections: ["defense"],
        effects: {
          defense: {
            resistances: "",
            immunities: "",
            conditionImmunities: "Sleep (magical)",
            notes: "Advantage on saving throws against being charmed",
          },
        },
      },
    ),
    createFeature(
      "srd-trait-elf-trance",
      "racial",
      "Trance",
      "Elves don't need to sleep. Instead, they meditate deeply, remaining semiconscious, for 4 hours a day.",
    ),
  ]

  if (key.includes("high elf") || key.includes("high-elf")) {
    return [
      ...elfTraits,
      createFeature(
        "srd-trait-high-elf-weapon-training",
        "racial",
        "Elf Weapon Training",
        "You have proficiency with the longsword, shortsword, shortbow, and longbow.",
        {
          sections: ["training"],
          specificWeapons: "longsword, shortsword, shortbow, longbow",
        },
      ),
      createFeature(
        "srd-trait-high-elf-cantrip",
        "racial",
        "Cantrip",
        "You know one cantrip of your choice from the wizard spell list. Intelligence is your spellcasting ability for it.",
      ),
    ]
  }
  if (key.includes("wood elf") || key.includes("wood-elf")) {
    return [
      ...elfTraits,
      createFeature(
        "srd-trait-wood-elf-weapon-training",
        "racial",
        "Elf Weapon Training",
        "You have proficiency with the longsword, shortsword, shortbow, and longbow.",
        {
          sections: ["training"],
          specificWeapons: "longsword, shortsword, shortbow, longbow",
        },
      ),
      createFeature(
        "srd-trait-wood-elf-fleet-of-foot",
        "racial",
        "Fleet of Foot",
        "Your base walking speed increases to 35 feet.",
      ),
      createFeature(
        "srd-trait-wood-elf-mask-of-the-wild",
        "racial",
        "Mask of the Wild",
        "You can attempt to hide even when you are only lightly obscured by foliage, heavy rain, falling snow, mist, and other natural phenomena.",
      ),
    ]
  }
  if (key.includes("elf")) {
    return elfTraits
  }

  const halflingTraits = [
    createFeature(
      "srd-trait-halfling-lucky",
      "racial",
      "Lucky",
      "When you roll a 1 on the d20 for an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll.",
    ),
    createFeature(
      "srd-trait-halfling-brave",
      "racial",
      "Brave",
      "You have advantage on saving throws against being frightened.",
      {
        sections: ["defense"],
        effects: {
          defense: {
            resistances: "",
            immunities: "",
            conditionImmunities: "",
            notes: "Advantage on saving throws against being frightened",
          },
        },
      },
    ),
    createFeature(
      "srd-trait-halfling-nimbleness",
      "racial",
      "Halfling Nimbleness",
      "You can move through the space of any creature that is of a size larger than yours.",
    ),
  ]

  if (key.includes("lightfoot")) {
    return [
      ...halflingTraits,
      createFeature(
        "srd-trait-lightfoot-stealthy",
        "racial",
        "Naturally Stealthy",
        "You can attempt to hide even when you are obscured only by a creature that is at least one size larger than you.",
      ),
    ]
  }
  if (key.includes("stout")) {
    return [
      ...halflingTraits,
      createFeature(
        "srd-trait-stout-resilience",
        "racial",
        "Stout Resilience",
        "You have advantage on saving throws against poison, and you have resistance against poison damage.",
        {
          sections: ["defense"],
          effects: {
            defense: {
              resistances: "Poison",
              immunities: "",
              conditionImmunities: "",
              notes: "Advantage on saving throws against poison",
            },
          },
        },
      ),
    ]
  }
  if (key.includes("halfling")) {
    return halflingTraits
  }

  if (key.includes("human")) {
    return [
      createFeature(
        "srd-trait-human-versatility",
        "racial",
        "Human Versatility",
        "Humans are the most adaptable and ambitious people among the common races. Your ability scores each increase by 1, and you know an extra language of your choice.",
      ),
    ]
  }

  if (key.includes("dragonborn")) {
    return [
      createFeature(
        "srd-trait-dragonborn-ancestry",
        "racial",
        "Draconic Ancestry",
        "You have draconic ancestry. Choose one type of dragon to determine your breath weapon damage and resistance.",
      ),
      createFeature(
        "srd-trait-dragonborn-breath",
        "racial",
        "Breath Weapon",
        "You can use your action to exhale destructive energy. Saving throw DC = 8 + CON mod + PB. Recharges on a short or long rest.",
        {
          sections: ["resource"],
          effects: {
            resource: {
              maxMode: "fixed",
              max: 1,
              ability: "STR",
              custom: "",
              recharge: "short",
            },
          },
        },
      ),
      createFeature(
        "srd-trait-dragonborn-resistance",
        "racial",
        "Damage Resistance",
        "You have resistance to the damage type associated with your draconic ancestry.",
      ),
    ]
  }

  const gnomeTraits = [
    createFeature(
      "srd-trait-gnome-darkvision",
      "racial",
      "Darkvision",
      "Accustomed to life underground, you have superior vision in dark and dim conditions (60 ft.).",
      {
        sections: ["movement"],
        effects: {
          movement: {
            mode: "Walking speed",
            distance: 0,
            senses: "Darkvision 60 ft.",
          },
        },
      },
    ),
    createFeature(
      "srd-trait-gnome-cunning",
      "racial",
      "Gnome Cunning",
      "You have advantage on all Intelligence, Wisdom, and Charisma saving throws against magic.",
      {
        sections: ["defense"],
        effects: {
          defense: {
            resistances: "",
            immunities: "",
            conditionImmunities: "",
            notes: "Advantage on Int, Wis, and Cha saving throws against magic",
          },
        },
      },
    ),
  ]

  if (key.includes("rock gnome") || key.includes("rock-gnome")) {
    return [
      ...gnomeTraits,
      createFeature(
        "srd-trait-rock-gnome-lore",
        "racial",
        "Artificer's Lore",
        "Whenever you make an Intelligence (History) check related to magic items, alchemical objects, or technological devices, you can add twice your proficiency bonus to the check.",
      ),
      createFeature(
        "srd-trait-rock-gnome-tinker",
        "racial",
        "Tinker",
        "You have proficiency with artisan's tools (tinker's tools). You can spend 1 hour and 10 gp of materials to construct a Tiny clockwork device.",
        {
          sections: ["training"],
          tools: "Tinker's tools",
        },
      ),
    ]
  }
  if (key.includes("gnome")) {
    return gnomeTraits
  }

  if (key.includes("half-orc") || key.includes("half orc")) {
    return [
      createFeature(
        "srd-trait-half-orc-darkvision",
        "racial",
        "Darkvision",
        "Thanks to your orc blood, you have superior vision in dark and dim conditions (60 ft.).",
        {
          sections: ["movement"],
          effects: {
            movement: {
              mode: "Walking speed",
              distance: 0,
              senses: "Darkvision 60 ft.",
            },
          },
        },
      ),
      createFeature(
        "srd-trait-half-orc-menacing",
        "racial",
        "Menacing",
        "You gain proficiency in the Intimidation skill.",
        {
          sections: ["skills"],
          skills: ["Intimidation"],
        },
      ),
      createFeature(
        "srd-trait-half-orc-endurance",
        "racial",
        "Relentless Endurance",
        "When you are reduced to 0 hit points but not killed outright, you can drop to 1 hit point instead. Recharges on a long rest.",
        {
          sections: ["resource"],
          effects: {
            resource: {
              maxMode: "fixed",
              max: 1,
              ability: "STR",
              custom: "",
              recharge: "long",
            },
          },
        },
      ),
      createFeature(
        "srd-trait-half-orc-savage-attacks",
        "racial",
        "Savage Attacks",
        "When you score a critical hit with a melee weapon attack, you can roll one of the weapon's damage dice one additional time and add it to the extra damage.",
      ),
    ]
  }

  if (key.includes("tiefling")) {
    return [
      createFeature(
        "srd-trait-tiefling-darkvision",
        "racial",
        "Darkvision",
        "Thanks to your infernal heritage, you have superior vision in dark and dim conditions (60 ft.).",
        {
          sections: ["movement"],
          effects: {
            movement: {
              mode: "Walking speed",
              distance: 0,
              senses: "Darkvision 60 ft.",
            },
          },
        },
      ),
      createFeature(
        "srd-trait-tiefling-resistance",
        "racial",
        "Hellish Resistance",
        "You have resistance to fire damage.",
        {
          sections: ["defense"],
          effects: {
            defense: {
              resistances: "Fire",
              immunities: "",
              conditionImmunities: "",
              notes: "",
            },
          },
        },
      ),
      createFeature(
        "srd-trait-tiefling-infernal-legacy",
        "racial",
        "Infernal Legacy",
        "You know the Thaumaturgy cantrip. Charisma is your spellcasting ability for this trait.",
      ),
    ]
  }

  return []
}

function detailedClassTraits(classIdOrName: string, name?: string): Feature[] {
  const key = (classIdOrName || name || "").toLowerCase()

  if (key.includes("barbarian")) {
    return [
      createFeature(
        "srd-trait-barbarian-rage",
        "class",
        "Rage",
        "In battle, you fight with primal ferocity. On your turn, you can enter a rage as a bonus action. Advantage on STR checks and saves, bonus melee damage with STR, and resistance to bludgeoning, piercing, and slashing damage.",
        {
          sections: ["resource", "saves", "training", "action"],
          saves: ["STR", "CON"],
          weapons: ["simple", "martial"],
          armor: ["Light", "Medium", "Shield"],
          effects: {
            resource: {
              maxMode: "fixed",
              max: 2,
              ability: "STR",
              custom: "",
              recharge: "long",
            },
            action: {
              actionType: "Bonus Action",
              target: "Self",
              duration: "Up to 1 minute",
              activationCondition: "Not wearing heavy armor",
              endOn: "manual",
              stacking: "non-stacking",
            },
            mechanical: [
              {
                id: "rage-resistance",
                type: "resistance",
                value: 0,
                formula: "",
                detail: "Bludgeoning, piercing, and slashing",
                damageType: "",
                condition: "",
                temporary: true,
              },
              {
                id: "rage-advantage",
                type: "advantage",
                value: 0,
                formula: "",
                detail: "Strength checks and saving throws",
                damageType: "",
                condition: "",
                temporary: true,
              },
              {
                id: "rage-damage",
                type: "bonus-damage",
                value: 2,
                formula: "",
                detail: "Strength-based melee weapon attacks",
                damageType: "",
                condition: "",
                temporary: true,
              },
            ],
          },
        },
      ),
      createFeature(
        "srd-trait-barbarian-unarmored-defense",
        "class",
        "Unarmored Defense (Barbarian)",
        "While you are not wearing any armor, your Armor Class equals 10 + your Dexterity modifier + your Constitution modifier. You can use a shield and still gain this benefit.",
      ),
      createFeature(
        "srd-trait-barbarian-reckless-attack",
        "class",
        "Reckless Attack",
        "Starting at 2nd level, you can throw aside all concern for defense to attack with fierce desperation. You gain advantage on melee weapon attack rolls using Strength during this turn, but attack rolls against you have advantage until your next turn.",
        { level: 2 },
      ),
      createFeature(
        "srd-trait-barbarian-danger-sense",
        "class",
        "Danger Sense",
        "At 2nd level, you gain an uncanny sense of when things nearby aren't as they should be. You have advantage on Dexterity saving throws against effects that you can see.",
        { level: 2 },
      ),
    ]
  }

  if (key.includes("bard")) {
    return [
      createFeature(
        "srd-trait-bard-spellcasting",
        "class",
        "Spellcasting (Bard)",
        "You have learned to untangle and reshape reality in harmony with your wishes and music. Charisma is your spellcasting ability for your bard spells.",
        {
          sections: ["spellcasting", "saves", "training"],
          saves: ["DEX", "CHA"],
          weapons: ["simple"],
          specificWeapons: "hand crossbow, longsword, rapier, shortsword",
          armor: ["Light"],
          effects: {
            spellcasting: {
              ability: "CHA",
              progression: "full",
              spellList: "Bard",
              additionalSpells: "",
              notes: "",
            },
          },
        },
      ),
      createFeature(
        "srd-trait-bard-inspiration",
        "class",
        "Bardic Inspiration",
        "You can inspire others through stirring words or music. As a bonus action, choose one creature within 60 ft to receive a d6 inspiration die.",
        {
          sections: ["resource", "action"],
          effects: {
            resource: {
              maxMode: "ability",
              max: 1,
              ability: "CHA",
              custom: "",
              recharge: "long",
            },
            action: {
              actionType: "Bonus Action",
              target: "One creature other than yourself",
              range: "60 ft.",
              duration: "10 minutes",
              activationCondition: "The target can hear you",
            },
          },
        },
      ),
      createFeature(
        "srd-trait-bard-jack-of-all-trades",
        "class",
        "Jack of All Trades",
        "Starting at 2nd level, you can add half your proficiency bonus, rounded down, to any ability check you make that doesn't already include your proficiency bonus.",
        { level: 2 },
      ),
      createFeature(
        "srd-trait-bard-song-of-rest",
        "class",
        "Song of Rest",
        "Beginning at 2nd level, you can use soothing music or oration to help revitalize your wounded allies during a short rest (extra 1d6 HP).",
        { level: 2 },
      ),
    ]
  }

  if (key.includes("cleric")) {
    return [
      createFeature(
        "srd-trait-cleric-spellcasting",
        "class",
        "Spellcasting (Cleric)",
        "As a conduit for divine power, you can cast cleric spells. Wisdom is your spellcasting ability for your cleric spells.",
        {
          sections: ["spellcasting", "saves", "training"],
          saves: ["WIS", "CHA"],
          weapons: ["simple"],
          armor: ["Light", "Medium", "Shield"],
          effects: {
            spellcasting: {
              ability: "WIS",
              progression: "full",
              spellList: "Cleric",
              additionalSpells: "",
              notes: "",
            },
          },
        },
      ),
      createFeature(
        "srd-trait-cleric-divine-domain",
        "class",
        "Divine Domain",
        "Choose a domain related to your deity, such as Life Domain, which grants domain spells and features.",
      ),
      createFeature(
        "srd-trait-cleric-channel-divinity",
        "class",
        "Channel Divinity",
        "Starting at 2nd level, you gain the ability to channel divine energy directly from your deity to fuel magical effects, such as Turn Undead.",
        {
          level: 2,
          sections: ["resource"],
          effects: {
            resource: {
              maxMode: "fixed",
              max: 1,
              ability: "WIS",
              custom: "",
              recharge: "short",
            },
          },
        },
      ),
    ]
  }

  if (key.includes("druid")) {
    return [
      createFeature(
        "srd-trait-druid-druidic",
        "class",
        "Druidic",
        "You know Druidic, the secret language of druids. You can speak it and use it to leave hidden messages.",
        {
          sections: ["training"],
          languages: "Druidic",
        },
      ),
      createFeature(
        "srd-trait-druid-spellcasting",
        "class",
        "Spellcasting (Druid)",
        "Drawing on the divine essence of nature, you can cast spells to shape that essence to your will. Wisdom is your spellcasting ability.",
        {
          sections: ["spellcasting", "saves", "training"],
          saves: ["INT", "WIS"],
          specificWeapons:
            "club, dagger, dart, javelin, mace, quarterstaff, scimitar, sickle, sling, spear",
          armor: ["Light", "Medium", "Shield"],
          effects: {
            spellcasting: {
              ability: "WIS",
              progression: "full",
              spellList: "Druid",
              additionalSpells: "",
              notes: "",
            },
          },
        },
      ),
      createFeature(
        "srd-trait-druid-wild-shape",
        "class",
        "Wild Shape",
        "Starting at 2nd level, you can use your action to magically assume the shape of a beast that you have seen before.",
        {
          level: 2,
          sections: ["resource", "action"],
          effects: {
            resource: {
              maxMode: "fixed",
              max: 2,
              ability: "WIS",
              custom: "",
              recharge: "short",
            },
            action: {
              actionType: "Action",
              target: "Self",
              duration: "Up to half your druid level in hours",
              stacking: "replace",
            },
            mechanical: [
              {
                id: "wild-shape-form",
                type: "custom",
                value: 0,
                formula: "",
                detail: "Use the chosen beast's game statistics",
                damageType: "",
                condition: "Ends early if you fall unconscious or reach 0 HP",
                temporary: true,
              },
            ],
          },
        },
      ),
    ]
  }

  if (key.includes("fighter")) {
    return [
      createFeature(
        "srd-trait-fighter-fighting-style",
        "class",
        "Fighting Style",
        "You adopt a particular style of fighting as your specialty (Archery, Defense, Dueling, Great Weapon Fighting, Protection, or Two-Weapon Fighting).",
        {
          sections: ["saves", "training"],
          saves: ["STR", "CON"],
          weapons: ["simple", "martial"],
          armor: ["Light", "Medium", "Heavy", "Shield"],
        },
      ),
      createFeature(
        "srd-trait-fighter-second-wind",
        "class",
        "Second Wind",
        "You have a limited well of stamina to protect yourself. On your turn, use a bonus action to regain HP equal to 1d10 + your fighter level.",
        {
          sections: ["resource", "action"],
          effects: {
            resource: {
              maxMode: "fixed",
              max: 1,
              ability: "STR",
              custom: "",
              recharge: "short",
            },
            action: {
              actionType: "Bonus Action",
              target: "Self",
              duration: "Instantaneous",
            },
            mechanical: [
              {
                id: "second-wind-healing",
                type: "healing",
                value: 0,
                formula: "1d10 + level",
                detail: "",
                damageType: "",
                condition: "",
                temporary: false,
              },
            ],
          },
        },
      ),
      createFeature(
        "srd-trait-fighter-action-surge",
        "class",
        "Action Surge",
        "Starting at 2nd level, you can push yourself beyond normal limits. On your turn, take one additional action on top of your regular action.",
        {
          level: 2,
          sections: ["resource"],
          effects: {
            resource: {
              maxMode: "fixed",
              max: 1,
              ability: "STR",
              custom: "",
              recharge: "short",
            },
          },
        },
      ),
    ]
  }

  if (key.includes("monk")) {
    return [
      createFeature(
        "srd-trait-monk-unarmored-defense",
        "class",
        "Unarmored Defense (Monk)",
        "Beginning at 1st level, while wearing no armor and no shield, your AC equals 10 + your Dexterity modifier + your Wisdom modifier.",
        {
          sections: ["saves", "training"],
          saves: ["STR", "DEX"],
          weapons: ["simple"],
          specificWeapons: "shortsword",
        },
      ),
      createFeature(
        "srd-trait-monk-martial-arts",
        "class",
        "Martial Arts",
        "Your practice of martial arts gives you mastery of combat styles using unarmed strikes and monk weapons (d4 damage, use DEX, bonus action unarmed strike).",
      ),
      createFeature(
        "srd-trait-monk-ki",
        "class",
        "Ki",
        "Starting at 2nd level, your training allows you to harness mystic ki energy. You have ki points equal to your monk level for Flurry of Blows, Patient Defense, and Step of the Wind.",
        {
          level: 2,
          sections: ["resource"],
          effects: {
            resource: {
              maxMode: "level",
              max: 1,
              ability: "WIS",
              custom: "",
              recharge: "short",
            },
          },
        },
      ),
      createFeature(
        "srd-trait-monk-unarmored-movement",
        "class",
        "Unarmored Movement",
        "Starting at 2nd level, your speed increases by 10 feet while not wearing armor or wielding a shield.",
        { level: 2 },
      ),
    ]
  }

  if (key.includes("paladin")) {
    return [
      createFeature(
        "srd-trait-paladin-divine-sense",
        "class",
        "Divine Sense",
        "The presence of strong evil registers on your senses. As an action, detect celestial, fiend, or undead within 60 ft.",
        {
          sections: ["resource", "saves", "training"],
          saves: ["WIS", "CHA"],
          weapons: ["simple", "martial"],
          armor: ["Light", "Medium", "Heavy", "Shield"],
          effects: {
            resource: {
              maxMode: "ability",
              max: 1,
              ability: "CHA",
              custom: "",
              recharge: "long",
            },
          },
        },
      ),
      createFeature(
        "srd-trait-paladin-lay-on-hands",
        "class",
        "Lay on Hands",
        "Your blessed touch heals wounds. You have a pool of healing power equal to your paladin level × 5.",
        {
          sections: ["resource"],
          effects: {
            resource: {
              maxMode: "custom",
              max: 5,
              ability: "CHA",
              custom: "5 × Level",
              recharge: "long",
            },
          },
        },
      ),
      createFeature(
        "srd-trait-paladin-fighting-style",
        "class",
        "Fighting Style (Paladin)",
        "At 2nd level, you adopt a style of fighting as your specialty (Defense, Dueling, Great Weapon Fighting, or Protection).",
        { level: 2 },
      ),
      createFeature(
        "srd-trait-paladin-spellcasting",
        "class",
        "Spellcasting (Paladin)",
        "By 2nd level, you draw on divine magic through meditation and prayer. Charisma is your spellcasting ability.",
        {
          level: 2,
          sections: ["spellcasting"],
          effects: {
            spellcasting: {
              ability: "CHA",
              progression: "half",
              spellList: "Paladin",
              additionalSpells: "",
              notes: "",
            },
          },
        },
      ),
      createFeature(
        "srd-trait-paladin-divine-smite",
        "class",
        "Divine Smite",
        "Starting at 2nd level, when you hit with a melee weapon attack, expend a spell slot to deal extra radiant damage (2d8 for 1st-level slot, +1d8 per higher level).",
        { level: 2 },
      ),
    ]
  }

  if (key.includes("ranger")) {
    return [
      createFeature(
        "srd-trait-ranger-favored-enemy",
        "class",
        "Favored Enemy",
        "You have significant experience studying, tracking, hunting, and talking to a certain type of enemy. Advantage on Survival to track and INT to recall information.",
        {
          sections: ["saves", "training"],
          saves: ["STR", "DEX"],
          weapons: ["simple", "martial"],
          armor: ["Light", "Medium", "Shield"],
        },
      ),
      createFeature(
        "srd-trait-ranger-natural-explorer",
        "class",
        "Natural Explorer",
        "You are particularly familiar with one type of natural environment and adept at traveling and surviving in such regions.",
      ),
      createFeature(
        "srd-trait-ranger-fighting-style",
        "class",
        "Fighting Style (Ranger)",
        "At 2nd level, you adopt a fighting style specialty (Archery, Defense, Dueling, or Two-Weapon Fighting).",
        { level: 2 },
      ),
      createFeature(
        "srd-trait-ranger-spellcasting",
        "class",
        "Spellcasting (Ranger)",
        "By 2nd level, you learn to use the magical essence of nature to cast spells. Wisdom is your spellcasting ability.",
        {
          level: 2,
          sections: ["spellcasting"],
          effects: {
            spellcasting: {
              ability: "WIS",
              progression: "half",
              spellList: "Ranger",
              additionalSpells: "",
              notes: "",
            },
          },
        },
      ),
    ]
  }

  if (key.includes("rogue")) {
    return [
      createFeature(
        "srd-trait-rogue-expertise",
        "class",
        "Expertise",
        "Choose two of your skill proficiencies, or one skill proficiency and thieves' tools. Your proficiency bonus is doubled for checks using those proficiencies.",
        {
          sections: ["saves", "training"],
          saves: ["DEX", "INT"],
          weapons: ["simple"],
          specificWeapons: "hand crossbow, longsword, rapier, shortsword",
          armor: ["Light"],
          tools: "Thieves' tools",
        },
      ),
      createFeature(
        "srd-trait-rogue-sneak-attack",
        "class",
        "Sneak Attack",
        "Beginning at 1st level, you know how to strike subtly. Once per turn, deal an extra 1d6 damage to one creature hit with an attack if you have advantage or an ally within 5 ft.",
      ),
      createFeature(
        "srd-trait-rogue-thieves-cant",
        "class",
        "Thieves' Cant",
        "During training you learned thieves' cant, a secret dialect and code that hides messages in seemingly normal conversation.",
        {
          sections: ["training"],
          languages: "Thieves' Cant",
        },
      ),
      createFeature(
        "srd-trait-rogue-cunning-action",
        "class",
        "Cunning Action",
        "Starting at 2nd level, your agility allows you to take a bonus action on each turn in combat to Dash, Disengage, or Hide.",
        { level: 2 },
      ),
    ]
  }

  if (key.includes("sorcerer")) {
    return [
      createFeature(
        "srd-trait-sorcerer-spellcasting",
        "class",
        "Spellcasting (Sorcerer)",
        "An event in your past infused you with arcane magic. Charisma is your spellcasting ability for your sorcerer spells.",
        {
          sections: ["spellcasting", "saves", "training"],
          saves: ["CON", "CHA"],
          specificWeapons: "dagger, dart, sling, quarterstaff, light crossbow",
          effects: {
            spellcasting: {
              ability: "CHA",
              progression: "full",
              spellList: "Sorcerer",
              additionalSpells: "",
              notes: "",
            },
          },
        },
      ),
      createFeature(
        "srd-trait-sorcerer-origin",
        "class",
        "Sorcerous Origin",
        "Choose a sorcerous origin describing the source of your innate magical power, such as Draconic Bloodline.",
      ),
      createFeature(
        "srd-trait-sorcerer-font-of-magic",
        "class",
        "Font of Magic",
        "At 2nd level, you tap into a deep wellspring of magic, represented by sorcery points (equal to your sorcerer level).",
        {
          level: 2,
          sections: ["resource"],
          effects: {
            resource: {
              maxMode: "level",
              max: 2,
              ability: "CHA",
              custom: "",
              recharge: "long",
            },
          },
        },
      ),
      createFeature(
        "srd-trait-sorcerer-metamagic",
        "class",
        "Metamagic",
        "At 3rd level, you gain the ability to twist your spells to suit your needs, choosing two Metamagic options.",
        { level: 3 },
      ),
    ]
  }

  if (key.includes("warlock")) {
    return [
      createFeature(
        "srd-trait-warlock-patron",
        "class",
        "Otherworldly Patron",
        "You have struck a bargain with an otherworldly being of your choice, such as The Fiend.",
        {
          sections: ["saves", "training"],
          saves: ["WIS", "CHA"],
          weapons: ["simple"],
          armor: ["Light"],
        },
      ),
      createFeature(
        "srd-trait-warlock-pact-magic",
        "class",
        "Pact Magic",
        "Your arcane research and patron's gift allow you to cast spells. Charisma is your spellcasting ability.",
        {
          sections: ["spellcasting"],
          effects: {
            spellcasting: {
              ability: "CHA",
              progression: "pact",
              spellList: "Warlock",
              additionalSpells: "",
              notes: "",
            },
          },
        },
      ),
      createFeature(
        "srd-trait-warlock-eldritch-invocations",
        "class",
        "Eldritch Invocations",
        "In your study of occult lore, you have unearthed eldritch invocations that imbue you with abiding magical abilities.",
        { level: 2 },
      ),
      createFeature(
        "srd-trait-warlock-pact-boon",
        "class",
        "Pact Boon",
        "At 3rd level, your patron bestows a gift: Pact of the Blade, Pact of the Chain, or Pact of the Tome.",
        { level: 3 },
      ),
    ]
  }

  if (key.includes("wizard")) {
    return [
      createFeature(
        "srd-trait-wizard-spellcasting",
        "class",
        "Spellcasting (Wizard)",
        "As a student of arcane magic, you have a spellbook containing spells showing your power. Intelligence is your spellcasting ability.",
        {
          sections: ["spellcasting", "saves", "training"],
          saves: ["INT", "WIS"],
          specificWeapons: "dagger, dart, sling, quarterstaff, light crossbow",
          effects: {
            spellcasting: {
              ability: "INT",
              progression: "full",
              spellList: "Wizard",
              additionalSpells: "",
              notes: "",
            },
          },
        },
      ),
      createFeature(
        "srd-trait-wizard-arcane-recovery",
        "class",
        "Arcane Recovery",
        "Once per day when you finish a short rest, you can regain expended spell slots with a combined level up to half your wizard level.",
        {
          sections: ["resource"],
          effects: {
            resource: {
              maxMode: "fixed",
              max: 1,
              ability: "INT",
              custom: "",
              recharge: "long",
            },
          },
        },
      ),
      createFeature(
        "srd-trait-wizard-arcane-tradition",
        "class",
        "Arcane Tradition",
        "When you reach 2nd level, you choose an arcane tradition through one of eight schools, such as the School of Evocation.",
        { level: 2 },
      ),
    ]
  }

  return []
}

function detailedSubclassTraits(
  subclassIdOrName: string,
  name?: string,
  _className?: string,
): Feature[] {
  const key = (subclassIdOrName || name || "").toLowerCase()

  if (key.includes("berserker")) {
    return [
      createFeature(
        "srd-trait-subclass-frenzy",
        "subclass",
        "Frenzy",
        "Starting when you choose this path at 3rd level, you can go into a frenzy when you rage. Make a single melee weapon attack as a bonus action on each turn. Suffer one level of exhaustion when rage ends.",
        {
          level: 3,
          subclassName: "Path of the Berserker",
          className: "Barbarian",
        },
      ),
    ]
  }
  if (key.includes("lore")) {
    return [
      createFeature(
        "srd-trait-subclass-bonus-proficiencies-lore",
        "subclass",
        "Bonus Proficiencies (College of Lore)",
        "When you join the College of Lore at 3rd level, you gain proficiency with three skills of your choice.",
        { level: 3, subclassName: "College of Lore", className: "Bard" },
      ),
      createFeature(
        "srd-trait-subclass-cutting-words",
        "subclass",
        "Cutting Words",
        "Also at 3rd level, use your reaction and expend one Bardic Inspiration die to subtract the roll from an enemy's attack roll, ability check, or damage roll.",
        { level: 3, subclassName: "College of Lore", className: "Bard" },
      ),
    ]
  }
  if (key.includes("life")) {
    return [
      createFeature(
        "srd-trait-subclass-disciple-of-life",
        "subclass",
        "Disciple of Life",
        "Whenever you use a spell of 1st level or higher to restore hit points, the creature regains additional hit points equal to 2 + the spell's level.",
        { level: 1, subclassName: "Life Domain", className: "Cleric" },
      ),
      createFeature(
        "srd-trait-subclass-heavy-armor-life",
        "subclass",
        "Bonus Proficiency (Life Domain)",
        "When you choose this domain at 1st level, you gain proficiency with heavy armor.",
        {
          level: 1,
          subclassName: "Life Domain",
          className: "Cleric",
          sections: ["training"],
          armor: ["Heavy"],
        },
      ),
    ]
  }
  if (key.includes("land")) {
    return [
      createFeature(
        "srd-trait-subclass-bonus-cantrip-land",
        "subclass",
        "Bonus Cantrip (Circle of the Land)",
        "When you choose this circle at 2nd level, you learn one additional druid cantrip of your choice.",
        { level: 2, subclassName: "Circle of the Land", className: "Druid" },
      ),
      createFeature(
        "srd-trait-subclass-natural-recovery",
        "subclass",
        "Natural Recovery",
        "Starting at 2nd level, regain expended spell slots during a short rest once per day.",
        {
          level: 2,
          subclassName: "Circle of the Land",
          className: "Druid",
          sections: ["resource"],
          effects: {
            resource: {
              maxMode: "fixed",
              max: 1,
              ability: "WIS",
              custom: "",
              recharge: "long",
            },
          },
        },
      ),
    ]
  }
  if (key.includes("champion")) {
    return [
      createFeature(
        "srd-trait-subclass-improved-critical",
        "subclass",
        "Improved Critical",
        "Beginning when you choose this archetype at 3rd level, your weapon attacks score a critical hit on a roll of 19 or 20.",
        { level: 3, subclassName: "Champion", className: "Fighter" },
      ),
    ]
  }
  if (key.includes("open-hand") || key.includes("open hand")) {
    return [
      createFeature(
        "srd-trait-subclass-open-hand-technique",
        "subclass",
        "Open Hand Technique",
        "Starting when you choose this tradition at 3rd level, whenever you hit with an attack granted by Flurry of Blows, you can knock the target prone, push it up to 15 ft, or prevent reactions.",
        { level: 3, subclassName: "Way of the Open Hand", className: "Monk" },
      ),
    ]
  }
  if (key.includes("devotion")) {
    return [
      createFeature(
        "srd-trait-subclass-sacred-weapon",
        "subclass",
        "Channel Divinity: Sacred Weapon",
        "As an action, imbue a weapon with positive energy for 1 minute: add Charisma modifier to attack rolls and emit bright light.",
        { level: 3, subclassName: "Oath of Devotion", className: "Paladin" },
      ),
      createFeature(
        "srd-trait-subclass-turn-the-unholy",
        "subclass",
        "Channel Divinity: Turn the Unholy",
        "As an action, present your holy symbol to turn fiends and undead within 30 feet that fail a Wisdom saving throw.",
        { level: 3, subclassName: "Oath of Devotion", className: "Paladin" },
      ),
    ]
  }
  if (key.includes("hunter")) {
    return [
      createFeature(
        "srd-trait-subclass-hunters-prey",
        "subclass",
        "Hunter's Prey",
        "At 3rd level, gain Colossus Slayer (extra 1d8 damage to an injured target once per turn), Giant Killer, or Horde Breaker.",
        { level: 3, subclassName: "Hunter", className: "Ranger" },
      ),
    ]
  }
  if (key.includes("thief")) {
    return [
      createFeature(
        "srd-trait-subclass-fast-hands",
        "subclass",
        "Fast Hands",
        "Starting at 3rd level, use the bonus action from Cunning Action to make a Sleight of Hand check, use thieves' tools, or Take Use an Object action.",
        { level: 3, subclassName: "Thief", className: "Rogue" },
      ),
      createFeature(
        "srd-trait-subclass-second-story-work",
        "subclass",
        "Second-Story Work",
        "You climb faster than normal; climbing no longer costs you extra movement.",
        { level: 3, subclassName: "Thief", className: "Rogue" },
      ),
    ]
  }
  if (key.includes("draconic")) {
    return [
      createFeature(
        "srd-trait-subclass-dragon-ancestor",
        "subclass",
        "Dragon Ancestor",
        "At 1st level, choose one type of dragon as your ancestor. You can speak, read, and write Draconic.",
        {
          level: 1,
          subclassName: "Draconic Bloodline",
          className: "Sorcerer",
          sections: ["training"],
          languages: "Draconic",
        },
      ),
      createFeature(
        "srd-trait-subclass-draconic-resilience",
        "subclass",
        "Draconic Resilience",
        "Your HP maximum increases by 1 for each sorcerer level. While not wearing armor, your AC equals 13 + your Dexterity modifier.",
        { level: 1, subclassName: "Draconic Bloodline", className: "Sorcerer" },
      ),
    ]
  }
  if (key.includes("fiend")) {
    return [
      createFeature(
        "srd-trait-subclass-dark-ones-blessing",
        "subclass",
        "Dark One's Blessing",
        "Starting at 1st level, when you reduce a hostile creature to 0 HP, gain temporary HP equal to your Charisma modifier + your warlock level (minimum 1).",
        { level: 1, subclassName: "The Fiend", className: "Warlock" },
      ),
    ]
  }
  if (key.includes("evocation")) {
    return [
      createFeature(
        "srd-trait-subclass-evocation-savant",
        "subclass",
        "Evocation Savant",
        "Beginning at 2nd level, gold and time to copy an evocation spell into your spellbook is halved.",
        { level: 2, subclassName: "School of Evocation", className: "Wizard" },
      ),
      createFeature(
        "srd-trait-subclass-sculpt-spells",
        "subclass",
        "Sculpt Spells",
        "Starting at 2nd level, create pockets of safety within evocation spells. Chosen creatures automatically succeed on saving throws and take no damage.",
        { level: 2, subclassName: "School of Evocation", className: "Wizard" },
      ),
    ]
  }

  return []
}

function getBuiltinBackgroundTraits(
  bgIdOrName: string,
  name?: string,
): Feature[] {
  const key = (bgIdOrName || name || "").toLowerCase()
  if (key.includes("acolyte")) {
    return [
      createFeature(
        "srd-trait-background-shelter-of-the-faithful",
        "other",
        "Shelter of the Faithful",
        "As an acolyte, you command the respect of those who share your faith. You and your companions can receive free healing and care at temples of your faith.",
        {
          parentName: "background",
          sections: ["skills", "training"],
          skills: ["Insight", "Religion"],
          languages: "Two languages of your choice",
        },
      ),
    ]
  }
  return []
}

// Full SRD 5.1 level progression. Each row is "level|Name|Description".
// Rows already covered by the detailed features above (same base name and level) are skipped.
const CLASS_PROGRESSION: Record<string, string[]> = {
  Barbarian: [
    "3|Primal Path|Choose a path that shapes the nature of your rage.",
    "5|Extra Attack|You can attack twice, instead of once, whenever you take the Attack action.",
    "5|Fast Movement|Your speed increases by 10 feet while you are not wearing heavy armor.",
    "7|Feral Instinct|Advantage on initiative rolls. If surprised, you can act normally if you rage first.",
    "9|Brutal Critical (1 die)|Roll one additional weapon damage die when determining extra damage for a critical hit with a melee attack.",
    "11|Relentless Rage|If you drop to 0 hit points while raging, make a DC 10 CON save to drop to 1 hit point instead. The DC increases by 5 each time.",
    "13|Brutal Critical (2 dice)|Roll two additional weapon damage dice on a melee critical hit.",
    "15|Persistent Rage|Your rage ends early only if you fall unconscious or choose to end it.",
    "17|Brutal Critical (3 dice)|Roll three additional weapon damage dice on a melee critical hit.",
    "18|Indomitable Might|If your total for a Strength check is less than your Strength score, you can use that score instead.",
    "20|Primal Champion|Your Strength and Constitution scores increase by 4. Their maximum is now 24.",
  ],
  Bard: [
    "3|Bard College|Choose a bard college that shapes your techniques.",
    "3|Expertise|Choose two skill proficiencies; your proficiency bonus is doubled for them.",
    "5|Bardic Inspiration (d8)|Your Bardic Inspiration die becomes a d8.",
    "5|Font of Inspiration|You regain all expended Bardic Inspiration uses when you finish a short or long rest.",
    "6|Countercharm|As an action, start a performance that gives you and nearby friendly creatures advantage on saves against being frightened or charmed.",
    "9|Song of Rest (d8)|Song of Rest die becomes a d8.",
    "10|Bardic Inspiration (d10)|Your Bardic Inspiration die becomes a d10.",
    "10|Expertise (2nd)|Choose two more skill proficiencies to gain Expertise.",
    "10|Magical Secrets|Choose two spells from any class. They count as bard spells for you.",
    "13|Song of Rest (d10)|Song of Rest die becomes a d10.",
    "14|Magical Secrets (2nd)|Choose two more spells from any class.",
    "15|Bardic Inspiration (d12)|Your Bardic Inspiration die becomes a d12.",
    "17|Song of Rest (d12)|Song of Rest die becomes a d12.",
    "18|Magical Secrets (3rd)|Choose two more spells from any class.",
    "20|Superior Inspiration|When you roll initiative and have no uses of Bardic Inspiration left, you regain one use.",
  ],
  Cleric: [
    "2|Channel Divinity: Turn Undead|As an action, present your holy symbol; undead within 30 feet that fail a WIS save are turned for 1 minute.",
    "5|Destroy Undead (CR 1/2)|Turned undead of CR 1/2 or lower are instantly destroyed.",
    "8|Destroy Undead (CR 1)|Destroy Undead threshold becomes CR 1.",
    "10|Divine Intervention|Implore your deity for aid. Roll d100; if you roll your cleric level or lower, the deity intervenes. Usable again after 7 days on success.",
    "11|Destroy Undead (CR 2)|Destroy Undead threshold becomes CR 2.",
    "14|Destroy Undead (CR 3)|Destroy Undead threshold becomes CR 3.",
    "17|Destroy Undead (CR 4)|Destroy Undead threshold becomes CR 4.",
    "18|Channel Divinity (3 uses)|You can use Channel Divinity three times between rests.",
    "20|Divine Intervention Improvement|Your call for intervention succeeds automatically, no roll required.",
  ],
  Druid: [
    "2|Druid Circle|Choose a circle of druids.",
    "4|Wild Shape Improvement (CR 1/2)|You can transform into beasts with CR 1/2 or lower, no flying speed.",
    "8|Wild Shape Improvement (CR 1)|You can transform into beasts with CR 1 or lower, including flying speed.",
    "18|Timeless Body|The primal magic you wield causes you to age more slowly: 10 years for every 1 year.",
    "18|Beast Spells|You can cast many of your druid spells in any shape you assume using Wild Shape.",
    "20|Archdruid|You can use Wild Shape an unlimited number of times and ignore verbal and somatic components of druid spells.",
  ],
  Fighter: [
    "3|Martial Archetype|Choose an archetype that you strive to emulate in your combat styles.",
    "5|Extra Attack|You can attack twice, instead of once, whenever you take the Attack action.",
    "9|Indomitable (1 use)|You can reroll a failed saving throw. You must use the new roll. Recharges on a long rest.",
    "11|Extra Attack (2)|You can attack three times whenever you take the Attack action.",
    "13|Indomitable (2 uses)|You can use Indomitable twice between long rests.",
    "17|Action Surge (2 uses)|You can use Action Surge twice before a rest, but only once on the same turn.",
    "17|Indomitable (3 uses)|You can use Indomitable three times between long rests.",
    "20|Extra Attack (3)|You can attack four times whenever you take the Attack action.",
  ],
  Monk: [
    "3|Monastic Tradition|Choose a monastic tradition.",
    "3|Deflect Missiles|Use your reaction to reduce ranged weapon damage by 1d10 + DEX modifier + monk level; catch and throw it back for 1 ki.",
    "4|Slow Fall|Use your reaction to reduce falling damage by five times your monk level.",
    "5|Extra Attack|You can attack twice, instead of once, whenever you take the Attack action.",
    "5|Stunning Strike|When you hit with a melee weapon attack, spend 1 ki to force a CON save or be stunned until the end of your next turn.",
    "6|Ki-Empowered Strikes|Your unarmed strikes count as magical for overcoming resistance and immunity.",
    "7|Evasion|On a DEX save for half damage, you take none on success and half on failure.",
    "7|Stillness of Mind|Use your action to end one effect on yourself causing you to be charmed or frightened.",
    "10|Purity of Body|You are immune to disease and poison.",
    "13|Tongue of the Sun and Moon|You understand all spoken languages and any creature that understands a language can understand you.",
    "14|Diamond Soul|You gain proficiency in all saving throws. You can spend 1 ki to reroll a failed save.",
    "15|Timeless Body|You no longer suffer the frailty of old age and cannot be aged magically.",
    "18|Empty Body|Spend 4 ki to become invisible for 1 minute with resistance to all damage but force. Spend 8 ki to cast astral projection.",
    "20|Perfect Self|When you roll initiative and have no ki points remaining, you regain 4 ki points.",
  ],
  Paladin: [
    "3|Divine Health|The divine magic flowing through you makes you immune to disease.",
    "3|Sacred Oath|Swear the oath that binds you as a paladin forever.",
    "5|Extra Attack|You can attack twice, instead of once, whenever you take the Attack action.",
    "6|Aura of Protection|You and friendly creatures within 10 feet add your CHA modifier to saving throws (minimum +1) while you are conscious.",
    "10|Aura of Courage|You and friendly creatures within 10 feet cannot be frightened while you are conscious.",
    "11|Improved Divine Smite|Whenever you hit with a melee weapon, you deal an extra 1d8 radiant damage.",
    "14|Cleansing Touch|Use your action to end one spell on yourself or a willing creature you touch. Uses equal CHA modifier per long rest.",
    "18|Aura Improvements|The range of your auras increases to 30 feet.",
  ],
  Ranger: [
    "3|Ranger Archetype|Choose an archetype that you strive to emulate.",
    "3|Primeval Awareness|Expend a spell slot to sense whether certain creature types are within 1 mile (6 miles in favored terrain).",
    "5|Extra Attack|You can attack twice, instead of once, whenever you take the Attack action.",
    "6|Favored Enemy Improvement|Choose an additional favored enemy and language; gain another favored terrain at 6th level.",
    "8|Land's Stride|Moving through nonmagical difficult terrain costs no extra movement and you have advantage against plants that impede movement.",
    "10|Hide in Plain Sight|Spend 1 minute creating camouflage for +10 to Stealth checks while you remain still against a solid surface.",
    "14|Vanish|You can use the Hide action as a bonus action and cannot be tracked by nonmagical means.",
    "18|Feral Senses|You gain preternatural senses; no disadvantage attacking creatures you cannot see and you are aware of invisible creatures within 30 feet.",
    "20|Foe Slayer|Once per turn, add your WIS modifier to the attack or damage roll against a favored enemy.",
  ],
  Rogue: [
    "3|Roguish Archetype|Choose an archetype that you emulate in the exercise of your rogue abilities.",
    "5|Uncanny Dodge|When an attacker you can see hits you, use your reaction to halve the damage.",
    "6|Expertise (2nd)|Choose two more skill proficiencies to gain Expertise.",
    "7|Evasion|On a DEX save for half damage, you take none on success and half on failure.",
    "11|Reliable Talent|Whenever you make an ability check using a proficient skill, treat a d20 roll of 9 or lower as a 10.",
    "14|Blindsense|If you can hear, you are aware of hidden or invisible creatures within 10 feet of you.",
    "15|Slippery Mind|You gain proficiency in Wisdom saving throws.",
    "18|Elusive|No attack roll has advantage against you while you aren't incapacitated.",
    "20|Stroke of Luck|Turn a missed attack into a hit, or a failed ability check into a 20. Once per short or long rest.",
  ],
  Sorcerer: [
    "10|Metamagic (3rd option)|Learn one additional Metamagic option.",
    "17|Metamagic (4th option)|Learn one additional Metamagic option.",
    "20|Sorcerous Restoration|You regain 4 expended sorcery points whenever you finish a short rest.",
  ],
  Warlock: [
    "11|Mystic Arcanum (6th level)|Choose one 6th-level spell as an arcanum; cast it once per long rest without a slot.",
    "13|Mystic Arcanum (7th level)|Choose one 7th-level spell as an arcanum; cast it once per long rest without a slot.",
    "15|Mystic Arcanum (8th level)|Choose one 8th-level spell as an arcanum; cast it once per long rest without a slot.",
    "17|Mystic Arcanum (9th level)|Choose one 9th-level spell as an arcanum; cast it once per long rest without a slot.",
    "20|Eldritch Master|Spend 1 minute entreating your patron to regain all expended Pact Magic spell slots. Once per long rest.",
  ],
  Wizard: [
    "18|Spell Mastery|Choose a 1st-level and a 2nd-level wizard spell; cast them at their lowest level without expending a slot.",
    "20|Signature Spells|Choose two 3rd-level wizard spells as signature spells; cast each once per short or long rest without a slot.",
  ],
}
// SRD starting skill choices: how many to pick and which skills are allowed (empty = any).
const CLASS_SKILLS: Record<string, { pick: number; from: string[] }> = {
  Barbarian: {
    pick: 2,
    from: [
      "Animal Handling",
      "Athletics",
      "Intimidation",
      "Nature",
      "Perception",
      "Survival",
    ],
  },
  Bard: { pick: 3, from: [] },
  Cleric: {
    pick: 2,
    from: ["History", "Insight", "Medicine", "Persuasion", "Religion"],
  },
  Druid: {
    pick: 2,
    from: [
      "Arcana",
      "Animal Handling",
      "Insight",
      "Medicine",
      "Nature",
      "Perception",
      "Religion",
      "Survival",
    ],
  },
  Fighter: {
    pick: 2,
    from: [
      "Acrobatics",
      "Animal Handling",
      "Athletics",
      "History",
      "Insight",
      "Intimidation",
      "Perception",
      "Survival",
    ],
  },
  Monk: {
    pick: 2,
    from: [
      "Acrobatics",
      "Athletics",
      "History",
      "Insight",
      "Religion",
      "Stealth",
    ],
  },
  Paladin: {
    pick: 2,
    from: [
      "Athletics",
      "Insight",
      "Intimidation",
      "Medicine",
      "Persuasion",
      "Religion",
    ],
  },
  Ranger: {
    pick: 3,
    from: [
      "Animal Handling",
      "Athletics",
      "Insight",
      "Investigation",
      "Nature",
      "Perception",
      "Stealth",
      "Survival",
    ],
  },
  Rogue: {
    pick: 4,
    from: [
      "Acrobatics",
      "Athletics",
      "Deception",
      "Insight",
      "Intimidation",
      "Investigation",
      "Perception",
      "Performance",
      "Persuasion",
      "Sleight of Hand",
      "Stealth",
    ],
  },
  Sorcerer: {
    pick: 2,
    from: [
      "Arcana",
      "Deception",
      "Insight",
      "Intimidation",
      "Persuasion",
      "Religion",
    ],
  },
  Warlock: {
    pick: 2,
    from: [
      "Arcana",
      "Deception",
      "History",
      "Intimidation",
      "Investigation",
      "Nature",
      "Religion",
    ],
  },
  Wizard: {
    pick: 2,
    from: [
      "Arcana",
      "History",
      "Insight",
      "Investigation",
      "Medicine",
      "Religion",
    ],
  },
}
const ASI_LEVELS: Record<string, number[]> = {
  Fighter: [4, 6, 8, 12, 14, 16, 19],
  Rogue: [4, 8, 10, 12, 16, 19],
}
const DEFAULT_ASI_LEVELS = [4, 8, 12, 16, 19]

const SUBCLASS_PROGRESSION: Record<string, {
  name: string
  cls: string
  rows: string[]
}> = {
  berserker: {
    name: "Path of the Berserker",
    cls: "Barbarian",
    rows: [
      "6|Mindless Rage|You can't be charmed or frightened while raging; such effects are suspended.",
      "10|Intimidating Presence|Use your action to frighten a creature within 30 feet (WIS save DC 8 + PB + CHA).",
      "14|Retaliation|When you take damage from a creature within 5 feet, use your reaction to make a melee weapon attack against it.",
    ],
  },
  lore: {
    name: "College of Lore",
    cls: "Bard",
    rows: [
      "6|Additional Magical Secrets|Learn two spells from any class; they count as bard spells.",
      "14|Peerless Skill|When you make an ability check, expend a Bardic Inspiration die and add it to the roll.",
    ],
  },
  life: {
    name: "Life Domain",
    cls: "Cleric",
    rows: [
      "2|Channel Divinity: Preserve Life|Restore hit points equal to five times your cleric level, divided among creatures within 30 feet (up to half their maximum).",
      "6|Blessed Healer|When you cast a healing spell on another creature, you also regain 2 + spell level hit points.",
      "8|Divine Strike|Once per turn, deal an extra 1d8 radiant damage with a weapon attack (2d8 at 14th level).",
      "17|Supreme Healing|When you would roll dice to restore hit points with a spell, use the maximum number instead.",
    ],
  },
  land: {
    name: "Circle of the Land",
    cls: "Druid",
    rows: [
      "2|Natural Recovery|Once per day during a short rest, recover spell slots with combined level up to half your druid level (max 5th level slots).",
      "3|Circle Spells|Gain circle spells based on your chosen land type, always prepared.",
      "6|Land's Stride|Moving through nonmagical difficult terrain costs no extra movement.",
      "10|Nature's Ward|You can't be charmed or frightened by elementals or fey and are immune to poison and disease.",
      "14|Nature's Sanctuary|Beasts and plants must make a WIS save to attack you; on a failure they must choose a different target.",
    ],
  },
  champion: {
    name: "Champion",
    cls: "Fighter",
    rows: [
      "3|Improved Critical|Your weapon attacks score a critical hit on a roll of 19 or 20.",
      "7|Remarkable Athlete|Add half your proficiency bonus to STR, DEX, and CON checks you aren't proficient in; increase running long jump distance.",
      "10|Additional Fighting Style|You can choose a second option from the Fighting Style class feature.",
      "15|Superior Critical|Your weapon attacks score a critical hit on a roll of 18-20.",
      "18|Survivor|At the start of each turn, regain 5 + CON modifier hit points if you have no more than half your hit points and at least 1.",
    ],
  },
  "open hand": {
    name: "Way of the Open Hand",
    cls: "Monk",
    rows: [
      "3|Open Hand Technique|When you hit with Flurry of Blows, impose DEX save (knocked prone), STR save (pushed 15 ft), or no reactions.",
      "6|Wholeness of Body|As an action, regain hit points equal to three times your monk level. Once per long rest.",
      "11|Tranquility|At the end of a long rest, gain the effect of a sanctuary spell until your next long rest.",
      "17|Quivering Palm|When you hit with an unarmed strike, spend 3 ki to start imperceptible vibrations that can later reduce the target to 0 hit points or deal 10d10 necrotic damage.",
    ],
  },
  devotion: {
    name: "Oath of Devotion",
    cls: "Paladin",
    rows: [
      "3|Oath Spells|Gain oath spells at paladin levels 3, 5, 9, 13, and 17.",
      "7|Aura of Devotion|You and friendly creatures within 10 feet can't be charmed while you are conscious.",
      "15|Purity of Spirit|You are always under the effects of a protection from evil and good spell.",
      "20|Holy Nimbus|As an action, emit bright sunlight in 30 feet dealing 10 radiant damage to enemies each turn for 1 minute, with advantage on saves against fiend and undead spells. Once per long rest.",
    ],
  },
  hunter: {
    name: "Hunter",
    cls: "Ranger",
    rows: [
      "7|Defensive Tactics|Choose Escape the Horde, Multiattack Defense, or Steel Will.",
      "11|Hunter Multiattack|Choose Volley or Whirlwind Attack.",
      "15|Superior Hunter's Defense|Choose Evasion, Stand Against the Tide, or Uncanny Dodge.",
    ],
  },
  thief: {
    name: "Thief",
    cls: "Rogue",
    rows: [
      "9|Supreme Sneak|You have advantage on a Stealth check if you move no more than half your speed on the same turn.",
      "13|Use Magic Device|You ignore all class, race, and level requirements on the use of magic items.",
      "17|Thief's Reflexes|You can take two turns during the first round of any combat: at your initiative and at your initiative minus 10.",
    ],
  },
  draconic: {
    name: "Draconic Bloodline",
    cls: "Sorcerer",
    rows: [
      "6|Elemental Affinity|Add your CHA modifier to damage of spells matching your dragon ancestry; spend 1 sorcery point for resistance to that type for 1 hour.",
      "14|Dragon Wings|Sprout dragon wings as a bonus action, gaining a flying speed equal to your current speed.",
      "18|Draconic Presence|Spend 5 sorcery points to exude an aura of awe or fear in 60 feet for up to 1 minute.",
    ],
  },
  fiend: {
    name: "The Fiend",
    cls: "Warlock",
    rows: [
      "6|Dark One's Own Luck|When you make an ability check or saving throw, add a d10 to the roll. Once per short or long rest.",
      "10|Fiendish Resilience|Choose one damage type after each short or long rest to gain resistance to it.",
      "14|Hurl Through Hell|When you hit a creature with an attack, banish it through the lower planes; it takes 10d10 psychic damage if not a fiend. Once per long rest.",
    ],
  },
  evocation: {
    name: "School of Evocation",
    cls: "Wizard",
    rows: [
      "6|Potent Cantrip|When a creature succeeds on a save against your cantrip, it takes half damage but suffers no additional effect.",
      "10|Empowered Evocation|Add your INT modifier to the damage of any wizard evocation spell you cast.",
      "14|Overchannel|When you cast a wizard spell of 1st-5th level that deals damage, deal maximum damage. Later uses cause necrotic damage to you.",
    ],
  },
}

const slugify = (v: string) =>
  v.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
const baseName = (v: string) =>
  v.replace(/\s*\(.*\)\s*/g, "")
    .trim()
    .toLowerCase()

function rowsToFeatures(
  rows: string[],
  category: "class" | "subclass",
  prefix: string,
  existing: Feature[],
  opts: { className: string; subclassName?: string },
): Feature[] {
  const out: Feature[] = []
  for (const row of rows) {
    const [lv, name, ...rest] = row.split("|")
    const level = Number(lv)
    if (
      existing.some(
        (f) =>
          baseName(f.name) === baseName(name) &&
          (f.source?.level ?? 1) === level,
      )
    )
      continue
    out.push(
      createFeature(
        `srd-trait-${prefix}-${slugify(name)}-${level}`,
        category,
        name,
        rest.join("|"),
        { level, className: opts.className, subclassName: opts.subclassName },
      ),
    )
  }
  return out
}

// SRD racial ability score increases, keyed by lowercase race/subrace name ("STR:2,CON:1").
const RACE_ASI: Record<string, string> = {
  dwarf: "CON:2",
  "hill dwarf": "WIS:1",
  "mountain dwarf": "STR:2",
  elf: "DEX:2",
  "high elf": "INT:1",
  "wood elf": "WIS:1",
  halfling: "DEX:2",
  "lightfoot halfling": "CHA:1",
  "stout halfling": "CON:1",
  human: "STR:1,DEX:1,CON:1,INT:1,WIS:1,CHA:1",
  dragonborn: "STR:2,CHA:1",
  gnome: "INT:2",
  "rock gnome": "CON:1",
  "half-elf": "CHA:2",
  "half-orc": "STR:2,CON:1",
  tiefling: "INT:1,CHA:2",
}

// Parses "STR:2,DEX:-1" into per-ability bonuses.
function parseAsi(value: string | undefined): Partial<Record<Ab, number>> {
  const out: Partial<Record<Ab, number>> = {}
  for (const part of (value ?? "").split(",")) {
    const [ab, n] = part.split(":").map((x) => x.trim())
    const num = Number(n)
    if (
      (ABILITIES as readonly string[]).includes(ab) &&
      Number.isFinite(num) &&
      num !== 0
    )
      out[(ab as Ab)] = (out[(ab as Ab)] ?? 0) + num
  }
  return out
}
const formatAsi = (bonus: Partial<Record<Ab, number>>) =>
  ABILITIES.filter((a) => bonus[a])
    .map((a) => `${a}:${bonus[a]}`)
    .join(",")

const isAsiFeature = (f: Feature) =>
  f.meta?.kind === "asi" ||
  f.name.trim().toLowerCase() === "ability score improvement"

// Base scores plus every ability bonus granted by traits (race, subrace, feat, background, custom).
function effectiveScores(sheet: Sheet): Record<Ab, number> {
  const out = { ...sheet.scores }
  for (const f of sheet.traits) {
    const bonus = parseAsi(f.meta?.asi)
    for (const a of ABILITIES)
      if (bonus[a]) out[a] = Math.min(30, (out[a] + bonus[a]) as number)
  }
  // Class Ability Score Improvements: chosen per feature, capped at 20 like the SRD.
  for (const f of sheet.traits) {
    if (!isAsiFeature(f)) continue
    const pick = parseAsi(sheet.asiChoices?.[f.id])
    for (const a of ABILITIES)
      if (pick[a])
        out[a] = Math.max(out[a], Math.min(20, (out[a] + pick[a]) as number))
  }
  return out
}

function getBuiltinRaceTraits(
  raceIdOrName: string,
  name?: string,
  parentName?: string,
): Feature[] {
  const traits = detailedRaceTraits(raceIdOrName, name, parentName)
  const names = new Set(
    [parentName, name].filter(Boolean).map((n) => (n as string).toLowerCase()),
  )
  const total: Partial<Record<Ab, number>> = {}
  names.forEach((n) => {
    const bonus = parseAsi(RACE_ASI[n])
    for (const a of ABILITIES)
      if (bonus[a]) total[a] = (((total[a] ?? 0) + bonus[a]) as number)
  })
  const asi = formatAsi(total)
  if (!asi || traits.some((f) => f.meta?.asi)) return traits
  const label = name ?? raceIdOrName
  return [
    {
      ...createFeature(
        `srd-trait-asi-${slugify(label)}`,
        "racial",
        "Ability Score Increase",
        `Your ability scores increase (${asi.replace(/:/g, " +").replace(/,/g, ", ")}).`,
      ),
      meta: { asi },
    },
    ...traits,
  ]
}

function getBuiltinClassTraits(
  classIdOrName: string,
  name?: string,
): Feature[] {
  const detailed = detailedClassTraits(classIdOrName, name)
  const key = (classIdOrName || name || "").toLowerCase()
  const cls = Object.keys(CLASS_PROGRESSION).find((c) =>
    key.includes(c.toLowerCase()),
  )
  if (!cls) return detailed
  const asi = (ASI_LEVELS[cls] ?? DEFAULT_ASI_LEVELS).map(
    (l) =>
      `${l}|Ability Score Improvement|Increase one ability score by 2, or two scores by 1 each, or take a feat. Maximum 20.`,
  )
  const rows = [...CLASS_PROGRESSION[cls], ...asi]
  const extras = rowsToFeatures(rows, "class", cls.toLowerCase(), detailed, {
    className: cls,
  }).map((f) => (isAsiFeature(f) ? { ...f, meta: { kind: "asi" } } : f))
  const sk = CLASS_SKILLS[cls]
  const skills =
    sk && !detailed.some((f) => f.id.endsWith("-class-skills"))
      ? [
          createFeature(
            `srd-trait-${cls.toLowerCase()}-class-skills`,
            "class",
            "Class Skills",
            `Choose ${sk.pick} skill proficiencies from the ${cls} list${
              sk.from.length ? `: ${sk.from.join(", ")}` : " (any skills)"
            }.`,
            { sections: ["skills"], level: 1, className: cls },
          ),
        ]
      : []
  skills.forEach((f) => {
    f.proficiencies!.skillPick = sk.pick
    f.proficiencies!.skillFrom = sk.from
  })
  return [...skills, ...detailed, ...extras].sort(
    (a, b) => (a.source?.level ?? 1) - (b.source?.level ?? 1),
  )
}

function getBuiltinSubclassTraits(
  subclassIdOrName: string,
  name?: string,
  className?: string,
): Feature[] {
  const detailed = detailedSubclassTraits(subclassIdOrName, name, className)
  const key = (subclassIdOrName || name || "").toLowerCase()
  const k = Object.keys(SUBCLASS_PROGRESSION).find((c) => key.includes(c))
  if (!k) return detailed
  const info = SUBCLASS_PROGRESSION[k]
  const extras = rowsToFeatures(
    info.rows,
    "subclass",
    `subclass-${k.replace(/\s+/g, "-")}`,
    detailed,
    { className: info.cls, subclassName: info.name },
  )
  return [...detailed, ...extras].sort(
    (a, b) => (a.source?.level ?? 1) - (b.source?.level ?? 1),
  )
}

const RAGE_USES = [2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 99]
const XP_THRESHOLDS = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000,
  120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
]
const levelForXp = (xp: number) => {
  let lv = 1
  XP_THRESHOLDS.forEach((t, i) => {
    if (xp >= t) lv = i + 1
  })
  return Math.min(lv, 20)
}

function scaleFeatureForLevel(f: Feature, level: number): Feature {
  const r = f.effects?.resource
  if (!r || r.maxMode !== "fixed") return f
  if (f.id === "srd-trait-barbarian-rage") {
    const rageDamage = level >= 16 ? 4 : level >= 9 ? 3 : 2
    return {
      ...f,
      effects: {
        ...f.effects!,
        resource:
          level >= 20
            ? { ...r, max: 0, unlimited: true }
            : { ...r, max: RAGE_USES[level - 1], unlimited: false },
        mechanical: f.effects!.mechanical.map((effect) =>
          effect.id === "rage-damage"
            ? { ...effect, value: rageDamage }
            : effect,
        ),
      },
    }
  }
  let max: number | undefined
  if (f.id === "srd-trait-cleric-channel-divinity")
    max = level >= 18 ? 3 : level >= 6 ? 2 : 1
  else if (f.id === "srd-trait-fighter-action-surge") max = level >= 17 ? 2 : 1
  else if (f.id === "srd-trait-paladin-lay-on-hands") max = 5 * level
  if (max === undefined || max === r.max) return f
  return { ...f, effects: { ...f.effects!, resource: { ...r, max } } }
}

// Rebuilds automatic SRD class/subclass traits for the current level, keeping manual traits and use counts.
function syncLevelTraits(sheet: Sheet): Sheet {
  const isAutoClass = (f: Feature) =>
    f.id.startsWith("srd-trait-") &&
    (f.category === "class" || f.category === "subclass")
  const dismissed = new Set(sheet.dismissedFeatures)
  const atLevel = (list: Feature[]) =>
    list
      .filter(
        (f) => (f.source?.level ?? 1) <= sheet.level && !dismissed.has(f.id),
      )
      .map((f) => scaleFeatureForLevel(f, sheet.level))
  const hasCustomClass = sheet.traits.some((f) => f.category === "custom-class")
  const hasCustomSub = sheet.traits.some(
    (f) => f.category === "subclass" && !f.id.startsWith("srd-trait-"),
  )
  const classTraits =
    CLASS_DIE[sheet.cls] && !hasCustomClass
      ? atLevel(
          getBuiltinClassTraits(`class-${sheet.cls.toLowerCase()}`, sheet.cls),
        )
      : []
  const subTraits =
    sheet.subclass &&
    sheet.subclass !== "Subclass" &&
    !hasCustomSub &&
    !hasCustomClass
      ? atLevel(
          getBuiltinSubclassTraits(sheet.subclass, sheet.subclass, sheet.cls),
        )
      : []
  const wanted = [...classTraits, ...subTraits]
  const current = sheet.traits.filter(isAutoClass)
  const same =
    wanted.length === current.length &&
    wanted.every((f) => {
      const c = current.find((x) => x.id === f.id)
      return (
        c &&
        c.effects?.resource.max === f.effects?.resource.max &&
        c.effects?.resource.unlimited === f.effects?.resource.unlimited &&
        JSON.stringify(c.effects?.mechanical) ===
          JSON.stringify(f.effects?.mechanical) &&
        c.proficiencies?.sections.join("|") ===
          f.proficiencies?.sections.join("|")
      )
    })
  if (same || (!classTraits.length && !subTraits.length && !current.length))
    return sheet
  const merged = wanted.map((f) => {
    const old = current.find((x) => x.id === f.id)
    if (!old) return f
    // Keep the player's picks (chosen skills) and use counts across level changes.
    return {
      ...f,
      ...(old.used !== undefined ? { used: old.used } : {}),
      proficiencies:
        f.proficiencies && old.proficiencies
          ? {
              ...f.proficiencies,
              skillChosen: old.proficiencies.skillChosen,
              expertiseChosen: old.proficiencies.expertiseChosen,
              toolChosen: old.proficiencies.toolChosen,
            }
          : f.proficiencies,
    }
  })
  const traits = [...sheet.traits.filter((f) => !isAutoClass(f)), ...merged]
  const traitIds = new Set(traits.map((feature) => feature.id))
  return {
    ...sheet,
    traits,
    activeEffects: sheet.activeEffects.filter((effect) =>
      traitIds.has(effect.sourceFeatureId),
    ),
  }
}

const initial: Sheet = {
  name: "New Character",
  cls: "Barbarian",
  subclass: "Subclass",
  race: "Race",
  subrace: "Subrace",
  abilityMethod: "manual",
  abilityRolls: [],
  asiChoices: {},
  exp: 0,
  background: "Background",
  alignment: "Neutral",
  size: "Medium",
  creatureType: "Humanoid",
  level: 1,
  scores: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
  acBonus: 0,
  speed: 30,
  initMisc: 0,
  hp: 12,
  maxHp: 12,
  hpMode: "avg",
  tempHp: 0,
  hitDie: 12,
  hpDice: [],
  hpLock: [],
  hitDiceUsed: 0,
  deathS: 0,
  deathF: 0,
  inspiration: false,
  activeConditions: [],
  exhaustionLevel: 0,
  customAttacks: [],
  slots: [
    { max: 0, used: 0 },
    { max: 0, used: 0 },
    { max: 0, used: 0 },
    { max: 0, used: 0 },
    { max: 0, used: 0 },
    { max: 0, used: 0 },
    { max: 0, used: 0 },
    { max: 0, used: 0 },
    { max: 0, used: 0 },
  ],
  pactSlots: { max: 0, used: 0, level: 0 },
  selectedSpells: [],
  traits: getBuiltinClassTraits("class-barbarian", "Barbarian").filter(
    (f) => (f.source?.level ?? 1) <= 1,
  ),
  activeEffects: [],
  dismissedFeatures: [],
  inventory: [],
  notes: "",
  skillNotes: { Perception: "", Insight: "", Investigation: "", Vision: "" },
  defenseNotes: "",
  coins: { CP: 0, SP: 0, EP: 0, GP: 0, PP: 0 },
}

const CLASS_DIE: Record<string, number> = {
  Barbarian: 12,
  Bard: 8,
  Cleric: 8,
  Druid: 8,
  Fighter: 10,
  Monk: 8,
  Paladin: 10,
  Ranger: 10,
  Rogue: 8,
  Sorcerer: 6,
  Warlock: 8,
  Wizard: 6,
}

type SpellcastingSource = {
  id: string
  name: string
  ability: Ab
  progression: FeatureEffects["spellcasting"]["progression"]
  spellList: string
  level: number
  mode: "known" | "prepared" | "spellbook" | "granted"
  grantedSpells: string[]
}

function spellcastingSources(sheet: Sheet): SpellcastingSource[] {
  return sheet.traits.flatMap((feature) => {
    if (
      !feature.effects ||
      !feature.proficiencies?.sections.includes("spellcasting") ||
      !feature.effects.spellcasting.ability
    )
      return []
    const spellcasting = feature.effects.spellcasting
    const list = spellcasting.spellList || featureSourceLabel(feature)
    const mode: SpellcastingSource["mode"] =
      list === "Cleric" || list === "Druid" || list === "Paladin"
        ? "prepared"
        : list === "Wizard"
          ? "spellbook"
          : spellcasting.progression === "custom"
            ? "granted"
            : "known"
    return [
      {
        id: feature.id,
        name: feature.name,
        ability: spellcasting.ability as Ab,
        progression: spellcasting.progression,
        spellList: list,
        level:
          feature.category === "class" ||
          feature.category === "subclass" ||
          feature.category === "custom-class"
            ? sheet.level
            : (feature.source?.level ?? 1),
        mode,
        grantedSpells: spellcasting.additionalSpells
          .split(/[,;\n]/)
          .map((spell) => spell.trim())
          .filter(Boolean),
      },
    ]
  })
}

function standardCasterLevel(sources: SpellcastingSource[]) {
  const standard = sources.filter(
    (source) =>
      source.progression === "full" ||
      source.progression === "half" ||
      source.progression === "third",
  )
  if (!standard.length) return 0
  // This sheet has one class level track. A subclass progression supplements,
  // rather than double-counts, its parent class.
  return Math.max(
    ...standard.map((source) =>
      casterLevelForProgression(source.progression, source.level),
    ),
  )
}

function automaticSpellSlots(sheet: Sheet) {
  return slotsForCasterLevel(standardCasterLevel(spellcastingSources(sheet)))
}

function automaticPactSlots(sheet: Sheet): PactSlots {
  const pact = spellcastingSources(sheet).find(
    (source) => source.progression === "pact",
  )
  if (!pact) return { max: 0, used: 0, level: 0 }
  return pactSlotsForLevel(pact.level)
}

function maxSpellLevel(sheet: Sheet, source: SpellcastingSource) {
  if (source.progression === "pact") return automaticPactSlots(sheet).level
  if (
    source.progression === "full" ||
    source.progression === "half" ||
    source.progression === "third"
  ) {
    const slots = automaticSpellSlots(sheet)
    let highest = 0
    slots.forEach((maximum, index) => {
      if (maximum > 0) highest = index + 1
    })
    return highest
  }
  return 9
}

const SPELLS_KNOWN: Record<string, number[]> = {
  Bard: [
    4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22,
  ],
  Sorcerer: [
    2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15,
  ],
  Warlock: [
    2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15,
  ],
  Ranger: [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11],
}
const CANTRIPS_KNOWN: Record<string, number[]> = {
  Bard: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  Cleric: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  Druid: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  Sorcerer: [4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
  Warlock: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  Wizard: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
}
const THIRD_CASTER_SPELLS_KNOWN = [
  0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13,
]

function spellSelectionLimits(sheet: Sheet, source: SpellcastingSource) {
  const level = clamp(source.level, 1, 20)
  const ability = mod(effectiveScores(sheet)[source.ability])
  const cantrips =
    source.progression === "third"
      ? level >= 10
        ? 3
        : level >= 3
          ? 2
          : 0
      : (CANTRIPS_KNOWN[source.spellList]?.[level - 1] ?? 0)
  if (source.mode === "prepared") {
    const classLevels =
      source.spellList === "Paladin" ? Math.floor(level / 2) : level
    return {
      cantrips,
      known: Number.POSITIVE_INFINITY,
      prepared: Math.max(1, classLevels + ability),
    }
  }
  if (source.mode === "spellbook") {
    return {
      cantrips,
      known: 6 + Math.max(0, level - 1) * 2,
      prepared: Math.max(1, level + ability),
    }
  }
  return {
    cantrips,
    known:
      SPELLS_KNOWN[source.spellList]?.[level - 1] ??
      (source.progression === "third"
        ? THIRD_CASTER_SPELLS_KNOWN[level - 1]
        : Number.POSITIVE_INFINITY),
    prepared: Number.POSITIVE_INFINITY,
  }
}

function scaledSpellFormula(
  entry: ContentEntry,
  source: SpellcastingSource,
  sheet: Sheet,
  slotLevel: number,
  healing = false,
  damageIndex = 0,
) {
  const meta = entry.feature.meta ?? {}
  const baseLevel = Number(meta.level) || 0
  const parseFormulaMap = (value: string | undefined) => {
    if (!value) return {} as Record<string, string>
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === "object"
        ? parsed as Record<string, string>
        : {}
    } catch {
      return {}
    }
  }
  const damageParts = (() => {
    try {
      const parsed = JSON.parse(meta.damageParts || "[]")
      return Array.isArray(parsed)
        ? parsed as {
            bySlot?: Record<string, string>
            byCharacterLevel?: Record<string, string>
          }[]
        : []
    } catch {
      return []
    }
  })()
  const damagePart = damageParts[damageIndex]
  let formula = healing
    ? formulaAtLevel(parseFormulaMap(meta.healingBySlot), slotLevel)
    : baseLevel === 0
      ? formulaAtLevel(damagePart?.byCharacterLevel ?? {}, sheet.level)
      : formulaAtLevel(damagePart?.bySlot ?? {}, slotLevel)
  formula ||= healing ? meta.healingFormula || "" : meta.damageFormula || ""
  if (baseLevel === 0 && meta.cantripScaling === "true") {
    const dice =
      sheet.level >= 17 ? 4 : sheet.level >= 11 ? 3 : sheet.level >= 5 ? 2 : 1
    formula = formula.replace(/\b\d*d(\d+)\b/i, `${dice}d$1`)
  }
  const upcast = Math.max(0, slotLevel - baseLevel)
  if (upcast > 0 && meta.upcastDice) {
    const match = meta.upcastDice.match(/(\d*)d(\d+)/i)
    const base = formula.match(/(\d*)d(\d+)/i)
    if (match && base && match[2] === base[2]) {
      const count = Number(base[1] || 1) + upcast * Number(match[1] || 1)
      formula = formula.replace(base[0], `${count}d${base[2]}`)
    }
  }
  const flat = upcast * (Number(meta.upcastFlat) || 0)
  formula = formula.replace(
    /\bMOD\b/g,
    String(mod(effectiveScores(sheet)[source.ability])),
  )
  return flat ? `${formula} + ${flat}` : formula
}

function spellFormulaParts(formula: string) {
  const dice = formula.match(/(\d*)d(\d+)/i)
  if (!dice) return { dice: "", bonus: Number(formula) || 0 }
  const remainder = formula.replace(dice[0], "")
  const bonus =
    remainder
      .match(/[+-]\s*\d+/g)
      ?.reduce((sum, value) => sum + Number(value.replace(/\s/g, "")), 0) ?? 0
  return { dice: `${dice[1] || 1}d${dice[2]}`, bonus }
}
const CLASS_NAMES = Object.keys(CLASS_DIE)

const ROLL_BTN =
  "rounded bg-pink text-center font-mono font-semibold text-onpink transition-[filter] hover:brightness-95 active:brightness-75"
const ALL_SKILLS = SKILLS.map(([n]) => n)
const DETAIL_SKILLS: [string, Ab][] = [
  ["Perception", "WIS"],
  ["Insight", "WIS"],
  ["Investigation", "INT"],
]

const ITEM_CATEGORIES: { value: ItemCategory; label: string }[] = [
  { value: "weapon", label: "Weapon" },
  { value: "armor", label: "Armor" },
  { value: "ammo", label: "Ammo" },
  { value: "adventuring-gear", label: "Adventuring gear" },
  { value: "tool", label: "Tool" },
  { value: "other", label: "Other" },
]

const ITEM_CATEGORY_HINTS: Record<ItemCategory, string> = {
  weapon: "Attacks, damage and properties",
  armor: "Base armor, shields and AC bonuses",
  ammo: "Arrows, bolts and other ammunition",
  "adventuring-gear": "Packs, potions and charged items",
  tool: "Tools with an ability and proficiency",
  other: "Anything else you carry",
}

const FEATURE_CATEGORIES: {
  value: FeatureCategory
  label: string
  hint: string
}[] = [
  {
    value: "racial",
    label: "Racial Trait",
    hint: "Ancestry, lineage, or species trait",
  },
  {
    value: "class",
    label: "Class Feature",
    hint: "A feature granted by a class",
  },
  {
    value: "subclass",
    label: "Subclass Feature",
    hint: "A custom subclass feature at a chosen level",
  },
  {
    value: "custom-class",
    label: "Custom Class",
    hint: "Define a class name, hit die, and starting grants",
  },
  { value: "feat", label: "Feat", hint: "A feat approved by the DM" },
  {
    value: "other",
    label: "Other",
    hint: "Background, boon, or another feature",
  },
  {
    value: "invocation",
    label: "Eldritch Invocation",
    hint: "A warlock invocation",
  },
  { value: "pact-boon", label: "Pact Boon", hint: "A warlock pact boon" },
  {
    value: "selection",
    label: "Selection",
    hint: "A list of options to choose from",
  },
]
const CONTENT_BUILDERS: { type: ContentType; label: string; hint: string }[] = [
  {
    type: "feat",
    label: "Feat Builder",
    hint: "Build reusable feats and their grants",
  },
  {
    type: "background",
    label: "Background Builder",
    hint: "Skills, tools, languages, and features",
  },
  {
    type: "race",
    label: "Race Builder",
    hint: "Size, speed, traits, and senses",
  },
  {
    type: "subrace",
    label: "Subrace Builder",
    hint: "Extend a parent race with new traits",
  },
  {
    type: "class",
    label: "Class Builder",
    hint: "Hit die, proficiencies, and class structure",
  },
  {
    type: "subclass",
    label: "Subclass Builder",
    hint: "Parent class, unlock level, and features",
  },
  {
    type: "item",
    label: "Item Builder",
    hint: "Weapons, armor, gear, and tools added to Gear",
  },
  {
    type: "spell",
    label: "Spell Builder",
    hint: "Level, school, casting details, and text",
  },
  {
    type: "selection",
    label: "Selection Builder",
    hint: "A named list of options to pick from",
  },
  {
    type: "invocation",
    label: "Eldritch Invocation Builder",
    hint: "Warlock invocations with prerequisites",
  },
  {
    type: "pact-boon",
    label: "Pact Boon Builder",
    hint: "Warlock pact boon options",
  },
]
const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  race: "Races",
  subrace: "Subraces",
  class: "Classes",
  subclass: "Subclasses",
  background: "Backgrounds",
  feat: "Feats",
  item: "Items",
  spell: "Spells",
  selection: "Selections",
  invocation: "Eldritch Invocations",
  "pact-boon": "Pact Boons",
}
const CONTENT_TYPE_ORDER: ContentType[] = [
  "race",
  "subrace",
  "class",
  "subclass",
  "background",
  "feat",
  "item",
  "spell",
  "selection",
  "invocation",
  "pact-boon",
]
function contentCategory(type: ContentType): FeatureCategory {
  return type === "feat"
    ? "feat"
    : type === "class"
      ? "custom-class"
      : type === "subclass"
        ? "subclass"
        : type === "race" || type === "subrace"
          ? "racial"
          : type === "invocation"
            ? "invocation"
            : type === "pact-boon"
              ? "pact-boon"
              : type === "selection"
                ? "selection"
                : "other"
}
const SUBCLASS_LEVELS: Record<string, number[]> = {
  Barbarian: [3, 6, 10, 14],
  Bard: [3, 6, 14],
  Cleric: [1, 2, 6, 8, 17],
  Druid: [2, 6, 10, 14],
  Fighter: [3, 7, 10, 15, 18],
  Monk: [3, 6, 11, 17],
  Paladin: [3, 7, 15, 20],
  Ranger: [3, 7, 11, 15],
  Rogue: [3, 9, 13, 17],
  Sorcerer: [1, 6, 14, 18],
  Warlock: [1, 6, 10, 14],
  Wizard: [2, 6, 10, 14],
}

const mod = (s: number) => Math.floor((s - 10) / 2)
const sgn = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
const prof = (lvl: number) => Math.ceil(lvl / 4) + 1
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n))

function hasSpellcasting(sheet: Sheet) {
  return sheet.traits.some((feature) =>
    feature.proficiencies?.sections.includes("spellcasting"),
  )
}

type Roll = {
  label: string
  die: string
  face: number
  mod: number
  total: number
  id: string
  playerId: string
  playerName: string
  characterName?: string
  faces?: number[]
  note?: string
}
type Tab = "main" | "combat" | "spells" | "gear" | "traits" | "content" | "log"

const SLOTS = 5
const CHARACTER_SCHEMA_VERSION = 3
const CONTENT_PACK_SCHEMA_VERSION = 1
const MAX_IMPORT_BYTES = 2 * 1024 * 1024
const NAME_MAX = 30
const CHANNEL = "dnd5e.sheet.share"
const ROLL_CHANNEL = "dnd5e.roll.share"
const ROLL_STORAGE = "dnd5e-roll-log"
const HP_META = "dnd5e.sheet.hp-bar"
const HP_LABEL_META = "dnd5e.sheet.hp-label"
type Store = { active: number; slots: (Sheet | null)[] }
type Person = { id: string; name: string }
type ShareMsg = { to: string; fromName: string; sheet: Sheet }
type HpBarMeta = {
  kind: "background" | "fill"
  ownerId: string
  slot: number
  tokenId: string
  hp: number
  maxHp: number
  width: number
  height: number
  centerX: number
  centerY: number
  rotation: number
}

const WEAPON_PROPS: { id: WeaponProp; label: string; hint: string }[] = [
  {
    id: "ammunition",
    label: "Ammunition",
    hint: "Needs ammo; ranged weapons only",
  },
  { id: "finesse", label: "Finesse", hint: "Use the better of STR or DEX" },
  { id: "heavy", label: "Heavy", hint: "Always two-handed" },
  { id: "light", label: "Light", hint: "Can be dual wielded" },
  { id: "loading", label: "Loading", hint: "Always has Ammunition" },
  { id: "reach", label: "Reach", hint: "+5 ft. reach; melee only" },
  { id: "special", label: "Special", hint: "Has special rules" },
  { id: "thrown", label: "Thrown", hint: "Can be thrown" },
  { id: "two-handed", label: "Two-Handed", hint: "Needs both hands" },
  { id: "versatile", label: "Versatile", hint: "One or two hands; melee only" },
]

function lockedWeaponProps(kind: WeaponKind, props: WeaponProp[]) {
  const on = new Set(props)
  const forced = new Set<WeaponProp>()
  if (on.has("heavy")) forced.add("two-handed")
  if (on.has("loading")) forced.add("ammunition")
  const blocked = new Set<WeaponProp>()
  if (on.has("versatile")) {
    blocked.add("two-handed")
    blocked.add("heavy")
    blocked.add("finesse")
  }
  if (on.has("finesse")) blocked.add("versatile")
  if (on.has("heavy")) blocked.add("versatile")
  if (on.has("two-handed")) blocked.add("versatile")
  if (kind === "ranged") blocked.add("versatile")
  if (kind === "ranged") blocked.add("reach")
  if (kind === "melee") {
    blocked.add("ammunition")
    blocked.add("loading")
  }
  if (on.has("light")) {
    blocked.add("heavy")
    blocked.add("two-handed")
  }
  if (on.has("two-handed")) blocked.add("light")
  if (on.has("heavy")) blocked.add("light")
  return { forced, blocked }
}

function cleanWeaponProps(kind: WeaponKind, props: WeaponProp[]) {
  const { forced, blocked } = lockedWeaponProps(kind, props)
  const next = new Set<WeaponProp>([...props, ...forced])
  blocked.forEach((p) => {
    if (!forced.has(p)) next.delete(p)
  })
  if (next.has("heavy") && next.has("light")) next.delete("light")
  if (kind === "ranged") {
    next.delete("versatile")
    next.delete("reach")
  }
  if (kind === "melee") {
    next.delete("ammunition")
    next.delete("loading")
  }
  return WEAPON_PROPS.map((p) => p.id).filter((id) => next.has(id))
}

const DAMAGE_DICE = ["1d4", "1d6", "1d8", "1d10", "1d12", "2d6"]
const DAMAGE_TYPES = [
  "acid",
  "bludgeoning",
  "cold",
  "fire",
  "force",
  "lightning",
  "necrotic",
  "piercing",
  "poison",
  "psychic",
  "radiant",
  "slashing",
  "thunder",
]

function weaponRange(w: WeaponItem) {
  return w.weaponKind === "melee"
    ? w.props.includes("reach")
      ? "10 ft."
      : "5 ft."
    : w.range
}

const splitList = (text: string) =>
  text
    .split(/[,;\n]/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)

function featureWeaponTraining(sheet: Sheet) {
  const groups = new Set<WeaponClass>()
  const specific: string[] = []
  sheet.traits.forEach((feature) => {
    feature.proficiencies?.weapons.forEach((group) => groups.add(group))
    specific.push(...splitList(feature.proficiencies?.specificWeapons ?? ""))
  })
  return { groups, specific }
}

function grantedSkillLevels(sheet: Sheet, excludeFeatureId?: string) {
  const out = new Map<string, 1 | 2>()
  sheet.traits.forEach((f) => {
    if (f.id === excludeFeatureId) return
    const p = f.proficiencies
    if (!p) return
    p.skills.forEach((n) => out.set(n, Math.max(out.get(n) ?? 0, 1) as 1 | 2))
    p.skillChosen
      .slice(0, p.skillPick)
      .forEach((n) => n && out.set(n, Math.max(out.get(n) ?? 0, 1) as 1 | 2))
    p.expertise.forEach((n) => out.set(n, 2))
    p.expertiseChosen
      .slice(0, p.expertisePick)
      .forEach((n) => n && out.set(n, 2))
  })
  return out
}

function skillLevel(sheet: Sheet, name: string): 0 | 1 | 2 {
  return (grantedSkillLevels(sheet).get(name) ?? 0) as 0 | 1 | 2
}

function skillLevelWithoutFeature(
  sheet: Sheet,
  name: string,
  featureId: string,
): 0 | 1 | 2 {
  return (grantedSkillLevels(sheet, featureId).get(name) ?? 0) as 0 | 1 | 2
}

function grantedSavingThrows(sheet: Sheet) {
  return new Set(
    sheet.traits.flatMap((feature) => feature.proficiencies?.saves ?? []),
  )
}

function weaponProficient(sheet: Sheet, w: WeaponItem) {
  const granted = featureWeaponTraining(sheet)
  if (granted.groups.has(w.weaponClass)) return true
  const name = w.name.toLowerCase()
  return granted.specific.some((entry) =>
    new RegExp(
      `(^|[^a-z])${entry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?($|[^a-z])`,
    ).test(name),
  )
}

function weaponStats(
  w: WeaponItem,
  scores: Record<Ab, number>,
  pb: number,
  forced: Ab | undefined,
  proficient: boolean,
  activeBonus = 0,
) {
  const str = mod(scores.STR)
  const dex = mod(scores.DEX)
  const ability: Ab = forced ?? (w.weaponKind === "ranged" ? "DEX" : "STR")
  const abilityMod = ability === "DEX" ? dex : str
  return {
    ability,
    attack: abilityMod + (proficient ? pb : 0) + w.attackBonus + activeBonus,
    damageMod: abilityMod + w.damageBonus,
  }
}

function equipWeapon(inventory: InventoryItem[], id: string) {
  const target = inventory.find(
    (i): i is WeaponItem => i.id === id && i.category === "weapon",
  )
  if (!target) return { inventory, replaced: false }
  const isLight = (w: WeaponItem) => w.props.includes("light")
  const isTwo = (w: WeaponItem) => w.props.includes("two-handed")
  const others = inventory.filter(
    (i): i is WeaponItem =>
      i.category === "weapon" && i.equipped && i.id !== id,
  )
  let keep = others.filter((w) => !isTwo(w))
  if (
    isTwo(target) ||
    keep.some((w) => !isLight(w)) ||
    (keep.length > 0 && !isLight(target))
  )
    keep = []
  keep = keep.slice(-1)
  const keepIds = new Set([id, ...keep.map((w) => w.id)])
  const next = inventory.map((i) =>
    i.category === "weapon" ? { ...i, equipped: keepIds.has(i.id) } : i,
  )
  return { inventory: next, replaced: keep.length < others.length }
}

function itemId() {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function proficiencyTraining(sheet: Sheet) {
  const granted = sheet.traits.flatMap((feature) =>
    feature.proficiencies ? [feature.proficiencies] : [],
  )
  const armor = [...new Set(granted.flatMap((p) => p.armor))]
  const specificWeapons = [
    ...new Set([
      ...granted.flatMap((p) =>
        p.specificWeapons
          .split(/[,;\n]/)
          .map((entry) => entry.trim())
          .filter(Boolean),
      ),
    ]),
  ]
  const tools = [
    ...new Set([
      ...granted.flatMap((p) =>
        p.tools
          .split(/[,;\n]/)
          .map((entry) => entry.trim())
          .filter(Boolean),
      ),
      ...granted.flatMap((p) =>
        p.toolChosen
          .slice(0, p.toolPick || p.toolChosen.length)
          .filter(Boolean),
      ),
    ]),
  ]
  const languages = [
    ...new Set(
      granted.flatMap((p) =>
        p.languages
          .split(/[,;\n]/)
          .map((entry) => entry.trim())
          .filter(Boolean),
      ),
    ),
  ]
  return {
    armor,
    simple: granted.some((p) => p.weapons.includes("simple")),
    martial: granted.some((p) => p.weapons.includes("martial")),
    specificWeapons,
    tools,
    languages,
  }
}

function featureResource(
  _cls: string,
  level: number,
  feature: Feature,
  scores: Sheet["scores"],
) {
  if (!feature.proficiencies?.sections.includes("resource") || !feature.effects)
    return null
  const resource = feature.effects.resource
  if (resource.unlimited) {
    return {
      max: Number.POSITIVE_INFINITY,
      used: 0,
      recharge: resource.recharge,
    }
  }
  const max =
    resource.maxMode === "pb"
      ? prof(level)
      : resource.maxMode === "ability"
        ? Math.max(1, mod(scores[resource.ability]))
        : resource.maxMode === "level"
          ? level
          : resource.maxMode === "custom"
            ? evaluateCombatFormula(resource.custom, {
                ...initial,
                level,
                scores,
              })
            : Math.max(0, resource.max)
  if (max <= 0) return null
  return {
    max,
    used: Math.min(max, feature.used ?? 0),
    recharge: resource.recharge,
  }
}

function evaluateCombatFormula(formula: string, sheet: Sheet) {
  if (!formula.trim()) return 0
  const scores = effectiveScores(sheet)
  const vars: Record<string, number> = {
    level: sheet.level,
    pb: prof(sheet.level),
    STR: mod(scores.STR),
    DEX: mod(scores.DEX),
    CON: mod(scores.CON),
    INT: mod(scores.INT),
    WIS: mod(scores.WIS),
    CHA: mod(scores.CHA),
  }
  let expression = formula
  Object.entries(vars).forEach(([key, value]) => {
    expression = expression.replace(
      new RegExp(`\\b${key}\\b`, "gi"),
      String(value),
    )
  })
  if (!/^[\d+\-*/().\s]+$/.test(expression)) return 0
  try {
    const value = Function(`"use strict"; return (${expression})`)()
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
  } catch {
    return 0
  }
}

function combatEffectValue(effect: CombatMechanicalEffect, sheet: Sheet) {
  return effect.formula.trim()
    ? evaluateCombatFormula(effect.formula, sheet)
    : effect.value
}

function rollCombatEffectValue(effect: CombatMechanicalEffect, sheet: Sheet) {
  if (!effect.formula.trim()) return effect.value
  const rolled = effect.formula.replace(
    /\b(\d+)d(\d+)\b/gi,
    (_match, countText, sidesText) => {
      const count = clamp(Number(countText) || 0, 0, 100)
      const sides = clamp(Number(sidesText) || 0, 1, 1000)
      return String(
        Array.from({ length: count }).reduce<number>(
          (sum) => sum + 1 + Math.floor(Math.random() * sides),
          0,
        ),
      )
    },
  )
  return evaluateCombatFormula(rolled, sheet)
}

function activeEffectBonus(sheet: Sheet, type: CombatEffectType, detail = "") {
  return sheet.activeEffects.reduce((total, active) => {
    return (
      total +
      active.effects
        .filter(
          (effect) =>
            effect.type === type &&
            (!effect.detail ||
              effect.detail.toLowerCase() === "all" ||
              (detail && effect.detail.toLowerCase() === detail.toLowerCase())),
        )
        .reduce((sum, effect) => sum + combatEffectValue(effect, sheet), 0)
    )
  }, 0)
}

function conditionImmune(sheet: Sheet, condition: string) {
  const wanted = condition.toLowerCase()
  return sheet.traits.some((feature) =>
    splitList(feature.effects?.defense.conditionImmunities ?? "").includes(
      wanted,
    ),
  )
}

function isCombatFeature(feature: Feature) {
  const sections = feature.proficiencies?.sections ?? []
  return (
    sections.includes("action") ||
    sections.includes("resource") ||
    feature.effects?.mechanical.some((effect) => effect.type) ||
    (feature.effects &&
      (sections.includes("defense") ||
        sections.includes("modifier") ||
        sections.includes("movement")))
  )
}

type CombatSection = "Action" | "Bonus Action" | "Reaction" | "Free / Special" | "Passive Effects"

function combatSection(feature: Feature): CombatSection {
  const hasAction = feature.proficiencies?.sections.includes("action")
  if (!hasAction) {
    return feature.proficiencies?.sections.includes("resource")
      ? "Free / Special"
      : "Passive Effects"
  }
  const type = feature.effects?.action.actionType
  if (type === "Action" || type === "Bonus Action" || type === "Reaction")
    return type
  if (type === "Passive") return "Passive Effects"
  return "Free / Special"
}

function featureSourceLabel(feature: Feature) {
  if (feature.source?.subclassName) return feature.source.subclassName
  if (feature.source?.className) return feature.source.className
  if (feature.source?.parentName) return feature.source.parentName
  const labels: Record<FeatureCategory, string> = {
    racial: "Race / species",
    class: "Class",
    subclass: "Subclass",
    "custom-class": "Custom class",
    feat: "Feat",
    other: "Feature",
    invocation: "Invocation",
    "pact-boon": "Pact boon",
    selection: "Selection",
  }
  return labels[feature.category]
}

function restoreUses(sheet: Sheet, recharges: Recharge[]): Feature[] {
  return sheet.traits.map((f) => {
    if (!f.used) return f
    const res = featureResource(
      sheet.cls,
      sheet.level,
      f,
      effectiveScores(sheet),
    )
    if (!res || !recharges.includes(res.recharge)) return f
    const policy = f.effects?.resource.rechargeAmount ?? "all"
    const configured =
      policy === "one"
        ? 1
        : policy === "fixed"
          ? Math.max(0, f.effects?.resource.rechargeValue ?? 0)
          : policy === "custom"
            ? evaluateCombatFormula(
                f.effects?.resource.rechargeCustom ?? "",
                sheet,
              )
            : res.max
    return { ...f, used: Math.max(0, (f.used ?? 0) - configured) }
  })
}

function restoreInventoryCharges(
  inventory: InventoryItem[],
  recharges: Recharge[],
) {
  return inventory.map((item) =>
    item.category === "adventuring-gear"
      ? rechargeCharges(item, recharges)
      : item,
  )
}

const COMBAT_EFFECT_TYPES: CombatEffectType[] = [
  "healing",
  "temporary-hp",
  "damage",
  "bonus-damage",
  "armor-class",
  "attack-roll",
  "ability-check",
  "saving-throw",
  "advantage",
  "disadvantage",
  "movement",
  "resistance",
  "vulnerability",
  "immunity",
  "condition",
  "resource-recovery",
  "additional-attack",
  "spellcasting",
  "custom",
]

function normalizeMechanicalEffect(
  value: unknown,
): CombatMechanicalEffect | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<CombatMechanicalEffect>
  if (!raw.type || !COMBAT_EFFECT_TYPES.includes(raw.type)) return null
  return {
    id: typeof raw.id === "string" ? raw.id : featureId(),
    type: raw.type,
    value: typeof raw.value === "number" ? raw.value : 0,
    formula: typeof raw.formula === "string" ? raw.formula : "",
    detail: typeof raw.detail === "string" ? raw.detail : "",
    damageType: typeof raw.damageType === "string" ? raw.damageType : "",
    condition: typeof raw.condition === "string" ? raw.condition : "",
    temporary: !!raw.temporary,
  }
}

function normalizeActiveEffect(value: unknown): ActiveEffect | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<ActiveEffect>
  if (!Array.isArray(raw.effects)) return null
  const effects = raw.effects
    .map(normalizeMechanicalEffect)
    .filter((effect): effect is CombatMechanicalEffect => !!effect)
  if (!effects.length) return null
  return {
    id: typeof raw.id === "string" ? raw.id : featureId(),
    sourceFeatureId:
      typeof raw.sourceFeatureId === "string" ? raw.sourceFeatureId : "",
    sourceName: typeof raw.sourceName === "string" ? raw.sourceName : "",
    sourceType: typeof raw.sourceType === "string" ? raw.sourceType : "Feature",
    name: typeof raw.name === "string" ? raw.name : "Active effect",
    appliedAt: typeof raw.appliedAt === "number" ? raw.appliedAt : Date.now(),
    duration: typeof raw.duration === "string" ? raw.duration : "Manual",
    endOn:
      raw.endOn === "short" || raw.endOn === "long" || raw.endOn === "dawn"
        ? raw.endOn
        : "manual",
    stacking:
      raw.stacking === "stack" ||
      raw.stacking === "replace" ||
      raw.stacking === "refresh"
        ? raw.stacking
        : "non-stacking",
    effects,
  }
}

function normalizeFeature(value: unknown): Feature | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<Feature>
  if (
    raw.category !== "racial" &&
    raw.category !== "class" &&
    raw.category !== "subclass" &&
    raw.category !== "custom-class" &&
    raw.category !== "feat" &&
    raw.category !== "other" &&
    raw.category !== "invocation" &&
    raw.category !== "pact-boon" &&
    raw.category !== "selection"
  )
    return null
  const p = raw.proficiencies
  const proficiencies =
    p && typeof p === "object"
      ? {
          sections: Array.isArray(p.sections)
            ? p.sections.filter((section): section is GrantSection =>
                [
                  "saves",
                  "skills",
                  "training",
                  "resource",
                  "modifier",
                  "defense",
                  "movement",
                  "spellcasting",
                  "action",
                  "custom",
                ].includes(section),
              )
            : [
                ...(Array.isArray(p.saves) && p.saves.length
                  ? ["saves" as const]
                  : []),
                ...((Array.isArray(p.skills) && p.skills.length) ||
                (Array.isArray(p.expertise) && p.expertise.length)
                  ? ["skills" as const]
                  : []),
                ...((Array.isArray(p.armor) && p.armor.length) ||
                (Array.isArray(p.weapons) && p.weapons.length) ||
                p.specificWeapons ||
                p.tools
                  ? ["training" as const]
                  : []),
              ],
          saves: Array.isArray(p.saves)
            ? p.saves.filter((save): save is Ab => ABILITIES.includes(save))
            : [],
          armor: Array.isArray(p.armor)
            ? p.armor.filter(
                (entry): entry is string => typeof entry === "string",
              )
            : [],
          weapons: Array.isArray(p.weapons)
            ? p.weapons.filter(
                (entry): entry is WeaponClass =>
                  entry === "simple" || entry === "martial",
              )
            : [],
          specificWeapons:
            typeof p.specificWeapons === "string" ? p.specificWeapons : "",
          tools: typeof p.tools === "string" ? p.tools : "",
          languages: typeof p.languages === "string" ? p.languages : "",
          skills: Array.isArray(p.skills)
            ? p.skills.filter((n): n is string => ALL_SKILLS.includes(n))
            : [],
          expertise: Array.isArray(p.expertise)
            ? p.expertise.filter((n): n is string => ALL_SKILLS.includes(n))
            : [],
          skillPick:
            typeof p.skillPick === "number"
              ? Math.max(0, Math.min(6, Math.floor(p.skillPick)))
              : 0,
          skillFrom: Array.isArray(p.skillFrom)
            ? p.skillFrom.filter((n): n is string => ALL_SKILLS.includes(n))
            : [],
          skillChosen: Array.isArray(p.skillChosen)
            ? p.skillChosen.filter((n): n is string => typeof n === "string")
            : [],
          expertisePick:
            typeof p.expertisePick === "number"
              ? Math.max(0, Math.min(4, Math.floor(p.expertisePick)))
              : 0,
          expertiseChosen: Array.isArray(p.expertiseChosen)
            ? p.expertiseChosen.filter((n): n is string =>
                ALL_SKILLS.includes(n),
              )
            : [],
          toolPick:
            typeof p.toolPick === "number"
              ? Math.max(0, Math.min(4, Math.floor(p.toolPick)))
              : 0,
          toolFrom: Array.isArray(p.toolFrom)
            ? p.toolFrom.filter((n): n is string => typeof n === "string")
            : [],
          toolChosen: Array.isArray(p.toolChosen)
            ? p.toolChosen.filter((n): n is string => typeof n === "string")
            : [],
        }
      : undefined
  const source =
    raw.source && typeof raw.source === "object"
      ? {
          className:
            typeof raw.source.className === "string"
              ? raw.source.className
              : "",
          subclassName:
            typeof raw.source.subclassName === "string"
              ? raw.source.subclassName
              : "",
          parentName:
            typeof raw.source.parentName === "string"
              ? raw.source.parentName
              : "",
          level:
            typeof raw.source.level === "number"
              ? clamp(Math.floor(raw.source.level), 1, 20)
              : 1,
          hitDie: [6, 8, 10, 12].includes(raw.source.hitDie)
            ? raw.source.hitDie
            : 8,
          speed:
            typeof raw.source.speed === "number"
              ? clamp(Math.floor(raw.source.speed), 0, 200)
              : 30,
          size:
            raw.source.size === "Small" ? "Small" as const : "Medium" as const,
        }
      : undefined
  const defaults = emptyFeatureEffects()
  const effects =
    raw.effects && typeof raw.effects === "object"
      ? {
          resource: { ...defaults.resource, ...(raw.effects.resource ?? {}) },
          modifier: { ...defaults.modifier, ...(raw.effects.modifier ?? {}) },
          defense: { ...defaults.defense, ...(raw.effects.defense ?? {}) },
          movement: { ...defaults.movement, ...(raw.effects.movement ?? {}) },
          spellcasting: {
            ...defaults.spellcasting,
            ...(raw.effects.spellcasting ?? {}),
          },
          action: { ...defaults.action, ...(raw.effects.action ?? {}) },
          mechanical: Array.isArray(raw.effects.mechanical)
            ? raw.effects.mechanical
                .map(normalizeMechanicalEffect)
                .filter((entry): entry is CombatMechanicalEffect => !!entry)
            : [],
          custom: Array.isArray(raw.effects.custom)
            ? raw.effects.custom.filter(
                (entry) =>
                  entry &&
                  typeof entry.id === "string" &&
                  typeof entry.label === "string" &&
                  typeof entry.value === "string",
              )
            : [],
        }
      : undefined
  return {
    id: typeof raw.id === "string" ? raw.id : featureId(),
    category: raw.category,
    name: typeof raw.name === "string" ? raw.name : "",
    description: typeof raw.description === "string" ? raw.description : "",
    ...(proficiencies ? { proficiencies } : {}),
    ...(source ? { source } : {}),
    ...(effects ? { effects } : {}),
    ...(typeof raw.key === "string" ? { key: raw.key } : {}),
    ...(typeof raw.used === "number" && raw.used > 0
      ? { used: Math.floor(raw.used) }
      : {}),
    ...(raw.meta && typeof raw.meta === "object"
      ? {
          meta: Object.fromEntries(
            Object.entries(raw.meta).filter(([, v]) => typeof v === "string"),
          ) as Record<string, string>,
        }
      : {}),
  }
}

function builtinContent(
  id: string,
  type: ContentType,
  name: string,
  source: Partial<FeatureSource> = {},
  extra: { description?: string; meta?: Record<string, string> } = {},
): ContentEntry {
  const category = contentCategory(type)
  return {
    id,
    type,
    builtin: true,
    feature: {
      ...newFeature(category),
      id: `srd-${id}`,
      name,
      description: extra.description ?? `SRD 5.1 ${type} option.`,
      source: { ...emptyFeatureSource(), ...source },
      ...(extra.meta ? { meta: extra.meta } : {}),
    },
  }
}

const BUILTIN_CONTENT: ContentEntry[] = [
  ...Object.entries(CLASS_DIE).map(([name, hitDie]) =>
    builtinContent(`class-${name.toLowerCase()}`, "class", name, {
      className: name,
      hitDie,
    }),
  ),
  ...[
    ["race-dwarf", "Dwarf", 25, "Medium"],
    ["race-elf", "Elf", 30, "Medium"],
    ["race-halfling", "Halfling", 25, "Small"],
    ["race-human", "Human", 30, "Medium"],
    ["race-dragonborn", "Dragonborn", 30, "Medium"],
    ["race-gnome", "Gnome", 25, "Small"],
    ["race-half-elf", "Half-Elf", 30, "Medium"],
    ["race-half-orc", "Half-Orc", 30, "Medium"],
    ["race-tiefling", "Tiefling", 30, "Medium"],
  ].map(([id, name, speed, size]) =>
    builtinContent(String(id), "race", String(name), {
      parentName: String(name),
      speed: Number(speed),
      size: size === "Small" ? "Small" : "Medium",
    }),
  ),
  ...[
    ["subrace-hill-dwarf", "Hill Dwarf", "Dwarf"],
    ["subrace-mountain-dwarf", "Mountain Dwarf", "Dwarf"],
    ["subrace-high-elf", "High Elf", "Elf"],
    ["subrace-wood-elf", "Wood Elf", "Elf"],
    ["subrace-lightfoot", "Lightfoot Halfling", "Halfling"],
    ["subrace-stout", "Stout Halfling", "Halfling"],
    ["subrace-rock-gnome", "Rock Gnome", "Gnome"],
  ].map(([id, name, parentName]) =>
    builtinContent(id, "subrace", name, { parentName }),
  ),
  builtinContent("background-acolyte", "background", "Acolyte"),
  builtinContent("feat-grappler", "feat", "Grappler"),
  ...[
    ["subclass-berserker", "Path of the Berserker", "Barbarian", 3],
    ["subclass-lore", "College of Lore", "Bard", 3],
    ["subclass-life", "Life Domain", "Cleric", 1],
    ["subclass-land", "Circle of the Land", "Druid", 2],
    ["subclass-champion", "Champion", "Fighter", 3],
    ["subclass-open-hand", "Way of the Open Hand", "Monk", 3],
    ["subclass-devotion", "Oath of Devotion", "Paladin", 3],
    ["subclass-hunter", "Hunter", "Ranger", 3],
    ["subclass-thief", "Thief", "Rogue", 3],
    ["subclass-draconic", "Draconic Bloodline", "Sorcerer", 1],
    ["subclass-fiend", "The Fiend", "Warlock", 1],
    ["subclass-evocation", "School of Evocation", "Wizard", 2],
  ].map(([id, name, className, level]) =>
    builtinContent(String(id), "subclass", String(name), {
      className: String(className),
      subclassName: String(name),
      level: Number(level),
    }),
  ),
  ...([
    [
      "item-longsword",
      "Longsword",
      "weapon",
      3,
      15,
      "1d8",
      "slashing",
      "melee",
      "martial",
      0,
    ],
    [
      "item-shortsword",
      "Shortsword",
      "weapon",
      2,
      10,
      "1d6",
      "piercing",
      "melee",
      "martial",
      0,
    ],
    [
      "item-dagger",
      "Dagger",
      "weapon",
      1,
      2,
      "1d4",
      "piercing",
      "melee",
      "simple",
      0,
    ],
    [
      "item-quarterstaff",
      "Quarterstaff",
      "weapon",
      4,
      0.2,
      "1d6",
      "bludgeoning",
      "melee",
      "simple",
      0,
    ],
    [
      "item-longbow",
      "Longbow",
      "weapon",
      2,
      50,
      "1d8",
      "piercing",
      "ranged",
      "martial",
      0,
    ],
    [
      "item-light-crossbow",
      "Light Crossbow",
      "weapon",
      5,
      25,
      "1d8",
      "piercing",
      "ranged",
      "simple",
      0,
    ],
    [
      "item-leather-armor",
      "Leather Armor",
      "armor",
      10,
      10,
      "",
      "",
      "",
      "",
      11,
    ],
    ["item-chain-mail", "Chain Mail", "armor", 55, 75, "", "", "", "", 16],
    ["item-shield", "Shield", "armor", 6, 10, "", "", "", "", 2],
    ["item-thieves-tools", "Thieves' Tools", "tool", 1, 25, "", "", "", "", 0],
    [
      "item-healing-potion",
      "Potion of Healing",
      "adventuring-gear",
      0.5,
      50,
      "",
      "",
      "",
      "",
      0,
    ],
  ] as [string, string, string, number, number, string, string, string, string, number][]).map(
    ([
      id,
      name,
      category,
      weight,
      value,
      damageDice,
      damageType,
      weaponKind,
      weaponClass,
      baseAc,
    ]) =>
      builtinContent(id, "item", name, {}, {
        description: `SRD 5.1 ${category}. Weight ${weight} lb, value ${value} gp.${
          damageDice ? ` Damage ${damageDice} ${damageType}.` : ""
        }${
          baseAc
            ? category === "armor" && name === "Shield"
              ? " +2 AC."
              : ` Base AC ${baseAc}.`
            : ""
        }`,
        meta: {
          itemCategory: category,
          weight: String(weight),
          value: String(value),
          quantity: "1",
          damageDice,
          damageType,
          weaponKind,
          weaponClass,
          baseAc: String(baseAc),
          armorMode: name === "Shield" ? "bonus" : "base",
        },
      }),
  ),
  ...SRD_SPELLS.map((spell) => {
    const damageParts = spell.damage.map((part) => ({
      type: part.type,
      bySlot: part.bySlot,
      byCharacterLevel: part.byCharacterLevel,
    }))
    const primaryDamage = damageParts[0]
    const baseDamage =
      primaryDamage?.bySlot[String(spell.level)] ??
      primaryDamage?.byCharacterLevel["1"] ??
      ""
    const baseHealing = spell.healingBySlot[String(spell.level)] ?? ""
    const rulesText = [spell.description, spell.higherLevel]
      .filter(Boolean)
      .join("\n\n")
    return builtinContent(spell.id, "spell", spell.name, {}, {
      description: `${
        spell.level === 0 ? "Cantrip" : `Level ${spell.level}`
      } ${spell.school}. ${spell.castingTime}, ${spell.range}, ${spell.components}, ${spell.duration}. ${rulesText}`,
      meta: {
        level: String(spell.level),
        school: spell.school,
        castingTime: spell.castingTime,
        range: spell.range,
        components: spell.components,
        material: spell.material,
        duration: spell.duration,
        text: spell.description,
        higherLevel: spell.higherLevel,
        classes: spell.classes.join(","),
        concentration: String(spell.concentration),
        ritual: String(spell.ritual),
        damageFormula: baseDamage,
        healingFormula: baseHealing,
        damageType: spell.damage
          .map((part) => part.type)
          .filter(Boolean)
          .join(", "),
        damageParts: JSON.stringify(damageParts),
        healingBySlot: JSON.stringify(spell.healingBySlot),
        saveAbility: spell.saveAbility,
        saveSuccess: spell.saveSuccess,
        spellAttack: String(!!spell.attackType),
        attackType: spell.attackType,
        area: spell.area,
        target: spell.area || spell.range,
        upcastDice: "",
        upcastFlat: "0",
        cantripScaling: String(
          !!primaryDamage &&
            Object.keys(primaryDamage.byCharacterLevel).length > 1,
        ),
        effectType: spell.id === "spell-shield" ? "armor-class:5" : "",
      },
    })
  }),
  ...([
    [
      "selection-fighting-style",
      "Fighting Style",
      1,
      [
        "Archery",
        "Defense",
        "Dueling",
        "Great Weapon Fighting",
        "Protection",
        "Two-Weapon Fighting",
      ],
    ],
    [
      "selection-draconic-ancestry",
      "Draconic Ancestry",
      1,
      [
        "Black (acid)",
        "Blue (lightning)",
        "Brass (fire)",
        "Bronze (lightning)",
        "Copper (acid)",
        "Gold (fire)",
        "Green (poison)",
        "Red (fire)",
        "Silver (cold)",
        "White (cold)",
      ],
    ],
    [
      "selection-metamagic",
      "Metamagic",
      2,
      [
        "Careful Spell",
        "Distant Spell",
        "Empowered Spell",
        "Extended Spell",
        "Heightened Spell",
        "Quickened Spell",
        "Subtle Spell",
        "Twinned Spell",
      ],
    ],
    [
      "selection-favored-enemy",
      "Favored Enemy",
      1,
      [
        "Aberrations",
        "Beasts",
        "Celestials",
        "Constructs",
        "Dragons",
        "Elementals",
        "Fey",
        "Fiends",
        "Giants",
        "Monstrosities",
        "Oozes",
        "Plants",
        "Undead",
        "Two humanoid races",
      ],
    ],
    [
      "selection-natural-explorer",
      "Natural Explorer Terrain",
      1,
      [
        "Arctic",
        "Coast",
        "Desert",
        "Forest",
        "Grassland",
        "Mountain",
        "Swamp",
        "Underdark",
      ],
    ],
    [
      "selection-hunters-prey",
      "Hunter's Prey",
      1,
      ["Colossus Slayer", "Giant Killer", "Horde Breaker"],
    ],
    [
      "selection-dragon-ancestor",
      "Dragon Ancestor",
      1,
      [
        "Black",
        "Blue",
        "Brass",
        "Bronze",
        "Copper",
        "Gold",
        "Green",
        "Red",
        "Silver",
        "White",
      ],
    ],
  ] as [string, string, number, string[]][]).map(([id, name, pick, options]) =>
    builtinContent(id, "selection", name, {}, {
      description: `Choose ${pick} of: ${options.join(", ")}.`,
      meta: { pick: String(pick), options: options.join("\n") },
    }),
  ),
  ...([
    [
      "invocation-agonizing-blast",
      "Agonizing Blast",
      "Requires the eldritch blast cantrip.",
      "Add your Charisma modifier to the damage of each eldritch blast beam.",
    ],
    [
      "invocation-armor-of-shadows",
      "Armor of Shadows",
      "",
      "You can cast mage armor on yourself at will, without expending a spell slot or material components.",
    ],
    [
      "invocation-devils-sight",
      "Devil's Sight",
      "",
      "You can see normally in darkness, both magical and nonmagical, to a distance of 120 feet.",
    ],
    [
      "invocation-eldritch-sight",
      "Eldritch Sight",
      "",
      "You can cast detect magic at will, without expending a spell slot.",
    ],
    [
      "invocation-fiendish-vigor",
      "Fiendish Vigor",
      "",
      "You can cast false life on yourself at will as a 1st-level spell, without expending a spell slot or material components.",
    ],
    [
      "invocation-mask-of-many-faces",
      "Mask of Many Faces",
      "",
      "You can cast disguise self at will, without expending a spell slot.",
    ],
    [
      "invocation-misty-visions",
      "Misty Visions",
      "",
      "You can cast silent image at will, without expending a spell slot or material components.",
    ],
    [
      "invocation-repelling-blast",
      "Repelling Blast",
      "Requires the eldritch blast cantrip.",
      "When you hit a creature with eldritch blast, you can push it up to 10 feet away from you in a straight line.",
    ],
    [
      "invocation-thirsting-blade",
      "Thirsting Blade",
      "Requires 5th level and the Pact of the Blade boon.",
      "You can attack with your pact weapon twice, instead of once, whenever you take the Attack action.",
    ],
    [
      "invocation-book-of-ancient-secrets",
      "Book of Ancient Secrets",
      "Requires the Pact of the Tome boon.",
      "You can inscribe magical rituals in your Book of Shadows. Choose two 1st-level spells that have the ritual tag.",
    ],
    [
      "invocation-one-with-shadows",
      "One with Shadows",
      "Requires 5th level.",
      "While in an area of dim light or darkness, you can become invisible until you move or take an action or reaction.",
    ],
  ] as [string, string, string, string][]).map(
    ([id, name, prerequisite, text]) =>
      builtinContent(id, "invocation", name, {}, {
        description: `${prerequisite ? `${prerequisite} ` : ""}${text}`,
        meta: { prerequisite, text },
      }),
  ),
  ...([
    [
      "pact-boon-blade",
      "Pact of the Blade",
      "You can use your action to create a pact weapon in your empty hand. You are proficient with it while you wield it.",
    ],
    [
      "pact-boon-chain",
      "Pact of the Chain",
      "You learn the find familiar spell and can cast it as a ritual. Your familiar can take special forms: imp, pseudodragon, quasit, or sprite.",
    ],
    [
      "pact-boon-tome",
      "Pact of the Tome",
      "Your patron gives you a Book of Shadows. Choose three cantrips from any class spell list; you can cast them while the book is on your person.",
    ],
  ] as [string, string, string][]).map(([id, name, text]) =>
    builtinContent(id, "pact-boon", name, {}, {
      description: text,
      meta: { text },
    }),
  ),
]

function loadCustomContent(): ContentEntry[] {
  try {
    const raw = JSON.parse(
      localStorage.getItem("dnd5e-content-library") ?? "[]",
    )
    if (!Array.isArray(raw)) return []
    return raw.flatMap((entry): ContentEntry[] => {
      if (!entry || !(CONTENT_TYPE_ORDER as string[]).includes(entry.type))
        return []
      const feature = normalizeFeature(entry.feature)
      return feature
        ? [
            {
              id: typeof entry.id === "string" ? entry.id : feature.id,
              type: entry.type,
              builtin: false,
              feature,
            },
          ]
        : []
    })
  } catch {
    return []
  }
}

function newInventoryItem(
  category: ItemCategory = "weapon",
  id = itemId(),
): InventoryItem {
  const base = {
    id,
    category,
    name: "",
    quantity: 1,
    weight: 0,
    value: 0,
    description: "",
  }
  if (category === "weapon")
    return {
      ...base,
      category,
      weaponClass: "simple",
      weaponKind: "melee",
      props: [],
      equipped: false,
      attackBonus: 0,
      damageDice: "",
      versatileDice: "",
      damageBonus: 0,
      damageType: "",
      range: "",
      ammoName: "",
    }
  if (category === "armor")
    return {
      ...base,
      category,
      armorMode: "base",
      baseAc: 10,
      dexMode: "full",
      maxDex: 2,
      acBonus: 0,
      equipped: false,
      strengthRequirement: 0,
      stealthDisadvantage: false,
    }
  if (category === "ammo")
    return {
      ...base,
      category,
      ammoType: "",
      compatibleWeapon: "",
      recoveryNotes: "",
    }
  if (category === "adventuring-gear")
    return {
      ...base,
      category,
      consumable: false,
      charges: 0,
      maxCharges: 0,
      chargeCost: 1,
      chargeRecharge: "manual",
      contents: "",
      usage: "",
    }
  if (category === "tool")
    return {
      ...base,
      category,
      linkedAbility: "",
      proficiency: 0,
      miscBonus: 0,
      usage: "",
    }
  return { ...base, category }
}

function normalizeItem(value: unknown): InventoryItem | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<InventoryItem>
  if (!ITEM_CATEGORIES.some((category) => category.value === raw.category))
    return null
  const fallback = newInventoryItem(
    raw.category,
    typeof raw.id === "string" ? raw.id : itemId(),
  )
  const weaponFix: Partial<WeaponItem> = {}
  if (fallback.category === "weapon") {
    const w = raw as Partial<WeaponItem>
    const kind: WeaponKind = w.weaponKind === "ranged" ? "ranged" : "melee"
    weaponFix.weaponKind = kind
    weaponFix.weaponClass = w.weaponClass === "martial" ? "martial" : "simple"
    weaponFix.equipped = !!w.equipped
    weaponFix.props = cleanWeaponProps(
      kind,
      Array.isArray(w.props)
        ? w.props.filter((x) => WEAPON_PROPS.some((p) => p.id === x))
        : [],
    )
  }
  return {
    ...fallback,
    ...raw,
    ...weaponFix,
    id: typeof raw.id === "string" ? raw.id : fallback.id,
    name: typeof raw.name === "string" ? raw.name : "",
    quantity: typeof raw.quantity === "number" ? Math.max(0, raw.quantity) : 1,
    weight:
      typeof raw.weight === "number" ? Math.max(0, Math.round(raw.weight)) : 0,
    value:
      typeof raw.value === "number" ? Math.max(0, Math.round(raw.value)) : 0,
    description: typeof raw.description === "string" ? raw.description : "",
    ...(fallback.category === "adventuring-gear"
      ? {
          charges: clamp(Number((raw as Partial<GearItem>).charges) || 0, 0, Math.max(0, Number((raw as Partial<GearItem>).maxCharges) || 0)),
          maxCharges: Math.max(
            0,
            Number((raw as Partial<GearItem>).maxCharges) || 0,
          ),
          chargeCost: Math.max(
            1,
            Number((raw as Partial<GearItem>).chargeCost) || 1,
          ),
          chargeRecharge: (["short", "long", "dawn", "manual"] as const).includes(
            (raw as Partial<GearItem>).chargeRecharge as Recharge,
          )
            ? (raw as Partial<GearItem>).chargeRecharge
            : "manual",
        }
      : {}),
  } as InventoryItem
}

function normalizeCondition(value: unknown): ActiveCondition | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<ActiveCondition>
  if (!CONDITION_TYPES.includes(raw.type as ActiveCondition["type"]))
    return null
  return {
    id: typeof raw.id === "string" ? raw.id : featureId(),
    type: raw.type as ActiveCondition["type"],
    source: typeof raw.source === "string" ? raw.source : "Manual",
    sourceDetails:
      typeof raw.sourceDetails === "string" ? raw.sourceDetails : "",
    appliedCharacter:
      typeof raw.appliedCharacter === "string" ? raw.appliedCharacter : "",
    duration: typeof raw.duration === "string" ? raw.duration : "Until removed",
    expiration:
      raw.expiration === "short" ||
      raw.expiration === "long" ||
      raw.expiration === "dawn"
        ? raw.expiration
        : "manual",
    save: typeof raw.save === "string" ? raw.save : "",
    notes: typeof raw.notes === "string" ? raw.notes : "",
    appliedAt: typeof raw.appliedAt === "number" ? raw.appliedAt : Date.now(),
  }
}

function normalizeCustomAttack(value: unknown): CustomAttack | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<CustomAttack> & {
    bonus?: string
    damage?: string
  }
  if (typeof raw.name !== "string") return null
  return {
    id: typeof raw.id === "string" ? raw.id : featureId(),
    name: raw.name,
    attackMode: raw.attackMode === "ability" ? "ability" : "fixed",
    attackBonus: Number(raw.attackBonus ?? parseInt(raw.bonus ?? "")) || 0,
    ability: ABILITIES.includes(raw.ability as Ab) ? raw.ability as Ab : "STR",
    proficient: !!raw.proficient,
    damageFormula:
      typeof raw.damageFormula === "string"
        ? raw.damageFormula
        : typeof raw.damage === "string"
          ? raw.damage
          : "",
    damageType: typeof raw.damageType === "string" ? raw.damageType : "",
    range: typeof raw.range === "string" ? raw.range : "",
    attackType:
      raw.attackType === "ranged" || raw.attackType === "special"
        ? raw.attackType
        : "melee",
    description: typeof raw.description === "string" ? raw.description : "",
    source: typeof raw.source === "string" ? raw.source : "Custom",
    sourceType:
      raw.sourceType === "feature" ||
      raw.sourceType === "item" ||
      raw.sourceType === "spell" ||
      raw.sourceType === "natural"
        ? raw.sourceType
        : "custom",
    ownerId: typeof raw.ownerId === "string" ? raw.ownerId : "character",
    conditions: typeof raw.conditions === "string" ? raw.conditions : "",
    effects: typeof raw.effects === "string" ? raw.effects : "",
  }
}

function normalize(saved: Partial<Sheet> & Record<string, any>): Sheet {
  const savedClass =
    typeof saved.cls === "string" ? saved.cls.trim().slice(0, 40) : ""
  const cls =
    CLASS_NAMES.find((c) => savedClass.startsWith(c)) ??
    (savedClass || initial.cls)
  const inventory = Array.isArray(saved.inventory)
    ? saved.inventory
        .map(normalizeItem)
        .filter((item): item is InventoryItem => !!item)
    : []
  const activeEffects = Array.isArray(saved.activeEffects)
    ? saved.activeEffects
        .map(normalizeActiveEffect)
        .filter((effect): effect is ActiveEffect => !!effect)
    : []
  const selectedSpells = Array.isArray(saved.selectedSpells)
    ? saved.selectedSpells.filter(
        (spell): spell is SelectedSpell =>
          !!spell &&
          typeof spell.contentId === "string" &&
          typeof spell.sourceId === "string" &&
          typeof spell.prepared === "boolean",
      )
    : []
  const pactSlots: PactSlots = {
    max:
      typeof saved.pactSlots?.max === "number"
        ? Math.max(0, saved.pactSlots.max)
        : 0,
    used:
      typeof saved.pactSlots?.used === "number"
        ? Math.max(0, saved.pactSlots.used)
        : 0,
    level:
      typeof saved.pactSlots?.level === "number"
        ? clamp(saved.pactSlots.level, 0, 5)
        : 0,
  }
  const normalizedTraits = Array.isArray(saved.traits)
    ? saved.traits
        .map(normalizeFeature)
        .filter((feature): feature is Feature => !!feature && !feature.key)
    : []
  let traits = normalizedTraits
  const dismissedFeatures = Array.isArray(saved.dismissedFeatures)
    ? saved.dismissedFeatures.filter((k): k is string => typeof k === "string")
    : []
  const size: CharacterSize = saved.size === "Small" ? "Small" : "Medium"
  const hitDie =
    CLASS_DIE[cls] ??
    ([6, 8, 10, 12].includes(saved.hitDie ?? 0) ? saved.hitDie : 8)
  if (
    cls &&
    CLASS_DIE[cls] &&
    !traits.some((f) => f.category === "class" || f.category === "custom-class")
  ) {
    traits = [
      ...traits,
      ...getBuiltinClassTraits(`class-${cls.toLowerCase()}`, cls),
    ]
  }
  let race = typeof saved.race === "string" ? saved.race : initial.race
  let subrace =
    typeof saved.subrace === "string" && saved.subrace
      ? saved.subrace
      : initial.subrace
  if (race.includes(" · ")) {
    const [parentRace, childRace] = race.split(" · ")
    race = parentRace
    subrace = childRace
  }
  const level = clamp(Math.round(Number(saved.level)) || 1, 1, 20)
  const exp =
    Number.isFinite(saved.exp) && saved.exp as number >= 0
      ? Math.floor(saved.exp as number)
      : XP_THRESHOLDS[level - 1]
  if (race !== "Race" && !traits.some((f) => f.category === "racial")) {
    const raceName = subrace !== "Subrace" ? subrace : race
    traits = [...traits, ...getBuiltinRaceTraits(raceName, raceName)]
  }
  if (
    saved.subclass &&
    typeof saved.subclass === "string" &&
    saved.subclass !== "Subclass" &&
    !traits.some((f) => f.category === "subclass")
  ) {
    traits = [
      ...traits,
      ...getBuiltinSubclassTraits(saved.subclass, saved.subclass, cls),
    ]
  }
  if (
    saved.background &&
    typeof saved.background === "string" &&
    saved.background !== "Background" &&
    !traits.some((f) => f.source?.parentName === "background")
  ) {
    traits = [
      ...traits,
      ...getBuiltinBackgroundTraits(saved.background, saved.background),
    ]
  }
  return syncLevelTraits({
    ...initial,
    subclass:
      typeof saved.subclass === "string" ? saved.subclass : initial.subclass,
    background:
      typeof saved.background === "string"
        ? saved.background
        : initial.background,
    alignment:
      typeof saved.alignment === "string" ? saved.alignment : initial.alignment,
    scores:
      saved.scores && typeof saved.scores === "object"
        ? Object.fromEntries(
            ABILITIES.map((ability) => [
              ability,
              clamp(Number(saved.scores?.[ability]) || 10, 1, 30),
            ]),
          ) as Record<Ab, number>
        : initial.scores,
    acBonus: Number(saved.acBonus) || 0,
    speed: Math.max(0, Number(saved.speed) || initial.speed),
    initMisc: Number(saved.initMisc) || 0,
    hp: Math.max(0, Number(saved.hp) || 0),
    maxHp: Math.max(1, Number(saved.maxHp) || initial.maxHp),
    hpMode:
      saved.hpMode === "roll" ||
      saved.hpMode === "max" ||
      saved.hpMode === "avg"
        ? saved.hpMode
        : initial.hpMode,
    tempHp: Math.max(0, Number(saved.tempHp) || 0),
    hpDice: Array.isArray(saved.hpDice)
      ? saved.hpDice.filter((value): value is number => typeof value === "number")
      : [],
    hpLock: Array.isArray(saved.hpLock)
      ? saved.hpLock.map((value) => !!value)
      : [],
    hitDiceUsed: Math.max(0, Number(saved.hitDiceUsed) || 0),
    deathS: clamp(Number(saved.deathS) || 0, 0, 3),
    deathF: clamp(Number(saved.deathF) || 0, 0, 3),
    inspiration: saved.inspiration === true,
    slots: Array.from({ length: 9 }, (_, index) => ({
      max: Math.max(0, Number(saved.slots?.[index]?.max) || 0),
      used: Math.max(0, Number(saved.slots?.[index]?.used) || 0),
    })),
    notes: typeof saved.notes === "string" ? saved.notes : "",
    coins: Object.fromEntries(
      (["CP", "SP", "EP", "GP", "PP"] as const).map((coin) => [
        coin,
        Math.max(0, Number(saved.coins?.[coin]) || 0),
      ]),
    ) as Sheet["coins"],
    race,
    subrace,
    activeEffects,
    activeConditions: Array.isArray(saved.activeConditions)
      ? saved.activeConditions
          .map(normalizeCondition)
          .filter((entry): entry is ActiveCondition => !!entry)
      : [],
    exhaustionLevel: clamp(Number(saved.exhaustionLevel) || 0, 0, 6),
    customAttacks: Array.isArray(saved.customAttacks)
      ? saved.customAttacks
          .map(normalizeCustomAttack)
          .filter((entry): entry is CustomAttack => !!entry)
      : [],
    selectedSpells,
    pactSlots,
    level,
    abilityMethod: ([
      "manual",
      "standard",
      "point-buy",
      "roll",
    ] as const).includes(saved.abilityMethod as AbilityMethod)
      ? saved.abilityMethod as AbilityMethod
      : "manual",
    abilityRolls: Array.isArray(saved.abilityRolls)
      ? saved.abilityRolls
          .filter((n): n is number => typeof n === "number")
          .slice(0, 6)
      : [],
    asiChoices:
      saved.asiChoices && typeof saved.asiChoices === "object"
        ? Object.fromEntries(
            Object.entries(saved.asiChoices).filter(
              ([, v]) => typeof v === "string",
            ),
          )
        : {},
    exp: Math.max(exp, XP_THRESHOLDS[level - 1]),
    name:
      typeof saved.name === "string"
        ? saved.name.slice(0, NAME_MAX)
        : initial.name,
    cls,
    size,
    creatureType: "Humanoid",
    traits,
    dismissedFeatures,
    inventory,
    hitDie,
    defenseNotes:
      typeof saved.defenseNotes === "string" ? saved.defenseNotes : "",
    skillNotes: { ...initial.skillNotes, ...saved.skillNotes },
  })
}

function loadStore(): Store {
  try {
    const raw = localStorage.getItem("dnd5e-chars")
    if (raw) {
      const p = JSON.parse(raw)
      const slots = Array.from({ length: SLOTS }, (_, i) =>
        p.slots?.[i] ? normalize(p.slots[i]) : null,
      )
      const active = slots[p.active] ? p.active : slots.findIndex(Boolean)
      if (active >= 0) return { active, slots }
    }
  } catch {
    /* fall through */
  }
  return { active: 0, slots: [initial, ...Array(SLOTS - 1).fill(null)] }
}

function loadRolls(): Roll[] {
  try {
    const saved = JSON.parse(localStorage.getItem(ROLL_STORAGE) ?? "[]")
    return Array.isArray(saved) ? saved.slice(0, 40) : []
  } catch {
    return []
  }
}

function inventoryAcInfo(dexMod: number, inventory: InventoryItem[]) {
  const equipped = inventory.filter(
    (item): item is ArmorItem => item.category === "armor" && item.equipped,
  )
  const baseArmor = equipped.find((item) => item.armorMode === "base")
  const bonusArmor = equipped.filter((item) => item.armorMode === "bonus")
  const bonus = bonusArmor.reduce((sum, item) => sum + item.acBonus, 0)
  if (!baseArmor) {
    return {
      ac: 10 + dexMod + bonus,
      detail: `10 + DEX mod (${sgn(dexMod)})${
        bonus ? ` + ${bonus} custom bonus` : ""
      }`,
      name: [
        "Unarmored",
        ...bonusArmor.map((item) => item.name || "Custom armor"),
      ].join(" + "),
    }
  }
  const dexPart =
    baseArmor.dexMode === "full"
      ? dexMod
      : baseArmor.dexMode === "max"
        ? Math.min(dexMod, baseArmor.maxDex)
        : 0
  const dexText =
    baseArmor.dexMode === "full"
      ? ` + DEX mod (${sgn(dexMod)})`
      : baseArmor.dexMode === "max"
        ? ` + DEX mod, max ${sgn(baseArmor.maxDex)} (${sgn(dexPart)})`
        : ""
  return {
    ac: baseArmor.baseAc + dexPart + bonus,
    detail: `${baseArmor.baseAc}${dexText}${
      bonus ? ` + ${bonus} custom bonus` : ""
    }`,
    name: [
      baseArmor.name || "Custom armor",
      ...bonusArmor.map((item) => item.name || "Custom bonus"),
    ].join(" + "),
  }
}

function hpColor(hp: number, maxHp: number) {
  const pct = maxHp > 0 ? hp / maxHp : 0
  if (pct <= 0.25) return "#ef4444"
  if (pct <= 0.5) return "#fbbf24"
  return "#22c55e"
}

function rollExpr(roll: Roll) {
  const modifier = roll.mod >= 0 ? `+ ${roll.mod}` : `− ${Math.abs(roll.mod)}`
  if (roll.faces)
    return `${roll.faces.length}${roll.die} (${roll.faces.join(" + ")})${
      roll.mod ? ` ${modifier}` : ""
    } =`
  return `1${roll.die} (${roll.face}) ${modifier} =`
}

function rollFormula(roll: Roll) {
  return `${rollExpr(roll)} ${roll.total}`
}

function getHpMeta(item: Item): HpBarMeta | null {
  const value = item.metadata[HP_META]
  if (!value || typeof value !== "object") return null
  const meta = value as Partial<HpBarMeta>
  if (
    (meta.kind !== "background" && meta.kind !== "fill") ||
    typeof meta.ownerId !== "string" ||
    typeof meta.slot !== "number" ||
    typeof meta.tokenId !== "string" ||
    typeof meta.hp !== "number" ||
    typeof meta.maxHp !== "number" ||
    typeof meta.width !== "number" ||
    typeof meta.height !== "number" ||
    typeof meta.centerX !== "number" ||
    typeof meta.centerY !== "number" ||
    typeof meta.rotation !== "number"
  )
    return null
  return meta as HpBarMeta
}

async function refreshHpLabels() {
  if (!OBR.isAvailable || !(await OBR.scene.isReady())) return
  const [role, playerId, shared, local] = await Promise.all([
    OBR.player.getRole(),
    OBR.player.getId(),
    OBR.scene.items.getItems(),
    OBR.scene.local.getItems(),
  ])
  const oldLabels = local.filter((item) => item.metadata[HP_LABEL_META])
  if (oldLabels.length)
    await OBR.scene.local.deleteItems(oldLabels.map((item) => item.id))

  const labels = shared.flatMap((item) => {
    const meta = getHpMeta(item)
    if (
      !meta ||
      meta.kind !== "fill" ||
      (role !== "GM" && meta.ownerId !== playerId)
    )
      return []
    const fontSize = Math.max(9, meta.height * 0.78)
    const bg = shared.find((x) => {
      const m = getHpMeta(x)
      return (
        m?.kind === "background" &&
        m.tokenId === meta.tokenId &&
        m.ownerId === meta.ownerId &&
        m.slot === meta.slot
      )
    })
    if (!bg) return []
    return [
      buildText()
        .name("D&D 5e HP")
        .plainText(`${meta.hp}/${meta.maxHp}`)
        .width(bg.type === "SHAPE" ? (bg as Shape).width : meta.width)
        .height(meta.height)
        .fontSize(fontSize)
        .fontWeight(700)
        .textAlign("CENTER")
        .textAlignVertical("MIDDLE")
        .fillColor("#ffffff")
        .strokeColor("#111827")
        .strokeWidth(Math.max(1, fontSize * 0.12))
        .position({ ...bg.position })
        .rotation(0)
        .layer("ATTACHMENT")
        .attachedTo(meta.tokenId)
        .disableAttachmentBehavior(["SCALE", "ROTATION"])
        .locked(true)
        .disableHit(true)
        .metadata({ [HP_LABEL_META]: item.id })
        .build(),
    ]
  })
  if (labels.length) await OBR.scene.local.addItems(labels)
}

let hpLabelRefresh = Promise.resolve()
function queueHpLabelRefresh() {
  hpLabelRefresh = hpLabelRefresh
    .then(refreshHpLabels, refreshHpLabels)
    .catch(() => undefined)
  return hpLabelRefresh
}

function useDismiss(
  open: boolean,
  close: () => void,
  ref: React.RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close()
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("mousedown", onDown)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("mousedown", onDown)
    }
  }, [open])
}

export default function App() {
  const [store, setStore] = useState<Store>(loadStore)
  const s = store.slots[store.active] as Sheet
  const setS = (f: (p: Sheet) => Sheet) =>
    setStore((st) => ({
      ...st,
      slots: st.slots.map((x, i) => (i === st.active && x ? f(x) : x)),
    }))
  const [tab, setTab] = useState<Tab>("main")
  const [abilityOpen, setAbilityOpen] = useState(false)
  // Keep automatic class/subclass traits in step with level, class, and subclass.
  useEffect(() => {
    setStore((st) => {
      const slots = st.slots.map((x) => (x ? syncLevelTraits(x) : x))
      return slots.every((x, i) => x === st.slots[i]) ? st : { ...st, slots }
    })
  }, [s.level, s.cls, s.subclass, store.active])
  useEffect(() => {
    setS((sheet) => {
      const maximums = automaticSpellSlots(sheet)
      const slots = sheet.slots.map((slot, index) => ({
        max: maximums[index],
        used: Math.min(slot.used, maximums[index]),
      }))
      const pactMaximum = automaticPactSlots(sheet)
      const pactSlots = {
        ...pactMaximum,
        used: Math.min(sheet.pactSlots.used, pactMaximum.max),
      }
      const sameSlots = slots.every(
        (slot, index) =>
          slot.max === sheet.slots[index].max &&
          slot.used === sheet.slots[index].used,
      )
      const samePact =
        pactSlots.max === sheet.pactSlots.max &&
        pactSlots.used === sheet.pactSlots.used &&
        pactSlots.level === sheet.pactSlots.level
      return sameSlots && samePact ? sheet : { ...sheet, slots, pactSlots }
    })
  }, [s.level, s.cls, s.subclass, s.traits, store.active])
  const [tabMenuOpen, setTabMenuOpen] = useState(false)
  const [itemPickOpen, setItemPickOpen] = useState(false)
  const [coinDraft, setCoinDraft] = useState<Sheet["coins"] | null>(null)
  const [rolls, setRolls] = useState<Roll[]>(loadRolls)
  const [amount, setAmount] = useState("")
  const [open, setOpen] = useState(false)
  const [hpOpen, setHpOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [itemDraft, setItemDraft] = useState<InventoryItem | null>(null)
  const [featureDraft, setFeatureDraft] = useState<Feature | null>(null)
  const [featureGrantMenuOpen, setFeatureGrantMenuOpen] = useState(false)
  const [inspirationArmed, setInspirationArmed] = useState(false)
  const [customContent, setCustomContent] =
    useState<ContentEntry[]>(loadCustomContent)
  const [contentDraftType, setContentDraftType] = useState<ContentType | null>(
    null,
  )
  const [contentDraftId, setContentDraftId] = useState<string | null>(null)
  const [spellCastLevels, setSpellCastLevels] =
    useState<Record<string, number>>({})
  const [spellSearch, setSpellSearch] = useState("")
  const [spellLevelOpen, setSpellLevelOpen] = useState<Record<string, boolean>>(
    {},
  )
  const [legalOpen, setLegalOpen] = useState(false)
  const [dark, setDark] = useState(
    () => localStorage.getItem("dnd5e-theme") !== "light",
  )
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    localStorage.setItem("dnd5e-chars", JSON.stringify(store))
  }, [store])

  useEffect(() => {
    localStorage.setItem("dnd5e-content-library", JSON.stringify(customContent))
  }, [customContent])

  useEffect(() => {
    localStorage.setItem(ROLL_STORAGE, JSON.stringify(rolls))
  }, [rolls])

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
    localStorage.setItem("dnd5e-theme", dark ? "dark" : "light")
  }, [dark])

  useEffect(() => {
    if (!tabMenuOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTabMenuOpen(false)
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [tabMenuOpen])

  const [restOpen, setRestOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [notice, setNotice] = useState("")
  const [role, setRole] = useState<"GM" | "PLAYER">(() =>
    localStorage.getItem("dnd5e-role") === "GM" ? "GM" : "PLAYER",
  )
  const [players, setPlayers] = useState<Person[]>([])
  const [inbox, setInbox] = useState<ShareMsg | null>(null)
  const [overwriteSlot, setOverwriteSlot] = useState<number | null>(null)
  const restRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const contentFileRef = useRef<HTMLInputElement>(null)
  const noticeTimer = useRef<number>(0)
  const playerIdRef = useRef("local")
  const playerNameRef = useRef("You")
  useDismiss(menuOpen, () => setMenuOpen(false), menuRef)
  useDismiss(restOpen, () => setRestOpen(false), restRef)

  const flash = (msg: string) => {
    setNotice(msg)
    window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(""), 2600)
  }

  const inObr = OBR.isAvailable
  useEffect(() => {
    if (!inObr) return
    const off: (() => void)[] = []
    OBR.onReady(async () => {
      const [currentRole, playerId, playerName] = await Promise.all([
        OBR.player.getRole(),
        OBR.player.getId(),
        OBR.player.getName(),
      ])
      setRole(currentRole)
      playerIdRef.current = playerId
      playerNameRef.current = playerName || "Player"
      const toPeople = (ps: { id: string; name: string }[]) =>
        setPlayers(ps.map((p) => ({ id: p.id, name: p.name || "Player" })))
      toPeople(await OBR.party.getPlayers())
      off.push(OBR.party.onChange(toPeople))
      off.push(
        OBR.broadcast.onMessage(CHANNEL, async (ev) => {
          const d = ev.data as ShareMsg
          const me = await OBR.player.getRole()
          if (d.to === OBR.player.id || (d.to === "GM" && me === "GM"))
            setInbox(d)
        }),
      )
      off.push(
        OBR.broadcast.onMessage(ROLL_CHANNEL, (ev) => {
          const d = ev.data as Partial<Roll>
          if (
            typeof d.label === "string" &&
            typeof d.die === "string" &&
            typeof d.face === "number" &&
            typeof d.mod === "number" &&
            typeof d.total === "number" &&
            typeof d.id === "string" &&
            typeof d.playerId === "string" &&
            typeof d.playerName === "string"
          ) {
            setRolls((current) =>
              current.some((roll) => roll.id === d.id)
                ? current
                : [d as Roll, ...current].slice(0, 40),
            )
          }
        }),
      )
      const syncLabels = () => void queueHpLabelRefresh()
      if (await OBR.scene.isReady()) syncLabels()
      off.push(OBR.scene.items.onChange(syncLabels))
      off.push(OBR.scene.onReadyChange((ready) => ready && syncLabels()))
    })
    return () => off.forEach((f) => f())
  }, [])

  const demoPlayers: Person[] = [
    { id: "demo-1", name: "Aria (demo)" },
    { id: "demo-2", name: "Bram (demo)" },
  ]
  const shareTargets = inObr ? players : demoPlayers

  const sendSheet = async (to: string, label: string) => {
    setShareOpen(false)
    setMenuOpen(false)
    if (!inObr) return flash(`Shared to ${label} (demo, not inside Owlbear)`)
    try {
      await OBR.broadcast.sendMessage(
        CHANNEL,
        {
          to,
          fromName: await OBR.player.getName(),
          sheet: s,
        } satisfies ShareMsg,
        { destination: "REMOTE" },
      )
      flash(`Shared to ${label}`)
    } catch {
      flash("Could not share")
    }
  }

  const [attached, setAttached] = useState(false)
  useEffect(() => {
    if (!inObr) return
    let cancelled = false
    let unsub: (() => void) | undefined
    const check = async () => {
      if (!(await OBR.scene.isReady())) return setAttached(false)
      const ownerId = await OBR.player.getId()
      const items = await OBR.scene.items.getItems()
      if (cancelled) return
      setAttached(
        items.some((item) => {
          const meta = getHpMeta(item)
          return (
            !!meta && meta.ownerId === ownerId && meta.slot === store.active
          )
        }),
      )
    }
    const start = () => {
      void check()
      unsub = OBR.scene.items.onChange(() => void check())
    }
    if (OBR.isReady) start()
    else OBR.onReady(start)
    return () => {
      cancelled = true
      unsub?.()
    }
  }, [inObr, store.active])

  const removeSheetFromToken = async () => {
    setMenuOpen(false)
    try {
      const ownerId = await OBR.player.getId()
      const items = await OBR.scene.items.getItems()
      const bars = items.filter((item) => {
        const meta = getHpMeta(item)
        return !!meta && meta.ownerId === ownerId && meta.slot === store.active
      })
      if (bars.length)
        await OBR.scene.items.deleteItems(bars.map((item) => item.id))
      await queueHpLabelRefresh()
      flash(`Removed ${s.name || "sheet"} from token`)
    } catch {
      flash("Could not remove sheet from token")
    }
  }

  const attachCharacterToToken = async () => {
    setMenuOpen(false)
    if (!inObr) return flash("Attach to token is only available inside Owlbear")
    try {
      if (!(await OBR.scene.isReady())) return flash("Open a scene first")
      const selection = await OBR.player.getSelection()
      if (!selection || selection.length !== 1)
        return flash("Select exactly one character token first")
      const [token] = await OBR.scene.items.getItems(selection)
      if (!token || (token.layer !== "CHARACTER" && token.layer !== "MOUNT")) {
        return flash("Select a character or mount token")
      }

      const [bounds, ownerId, items] = await Promise.all([
        OBR.scene.items.getItemBounds([token.id]),
        OBR.player.getId(),
        OBR.scene.items.getItems(),
      ])
      const width = bounds.width
      const height = clamp(width * 0.12, 10, 32)
      const centerX = bounds.min.x
      const centerY = bounds.max.y - height * 1.1
      const displayedMaxHp = effectiveMaxHp(s.maxHp, s.exhaustionLevel)
      const pct = displayedMaxHp > 0 ? clamp(s.hp / displayedMaxHp, 0, 1) : 0
      const fillWidth = Math.max(0.1, width * pct)
      const rotation = 0
      const fillPosition = { x: centerX, y: centerY }
      const baseMeta: Omit<HpBarMeta, "kind"> = {
        ownerId,
        slot: store.active,
        tokenId: token.id,
        hp: s.hp,
        maxHp: displayedMaxHp,
        width,
        height,
        centerX,
        centerY,
        rotation,
      }
      const taken = items.some((item) => {
        const meta = getHpMeta(item)
        return (
          !!meta &&
          meta.tokenId === token.id &&
          !(meta.ownerId === ownerId && meta.slot === store.active)
        )
      })
      if (taken)
        return flash(
          "This token already has a sheet attached. Remove it first.",
        )
      const oldBars = items.filter((item) => {
        const meta = getHpMeta(item)
        return (
          !!meta &&
          (meta.tokenId === token.id ||
            (meta.ownerId === ownerId && meta.slot === store.active))
        )
      })
      if (oldBars.length)
        await OBR.scene.items.deleteItems(oldBars.map((item) => item.id))

      const background = buildShape()
        .name(`${s.name} HP background`)
        .shapeType("RECTANGLE")
        .width(width)
        .height(height)
        .fillColor("#111827")
        .fillOpacity(0.85)
        .strokeColor("#ffffff")
        .strokeOpacity(0.55)
        .strokeWidth(Math.max(1, height * 0.12))
        .position({ x: centerX, y: centerY })
        .rotation(rotation)
        .layer("ATTACHMENT")
        .attachedTo(token.id)
        .disableAttachmentBehavior(["SCALE", "ROTATION"])
        .locked(true)
        .disableHit(true)
        .metadata({
          [HP_META]: { ...baseMeta, kind: "background" } satisfies HpBarMeta,
        })
        .build()
      const fill = buildShape()
        .name(`${s.name} HP`)
        .shapeType("RECTANGLE")
        .width(fillWidth)
        .height(height)
        .fillColor(hpColor(s.hp, displayedMaxHp))
        .fillOpacity(pct > 0 ? 1 : 0)
        .strokeOpacity(0)
        .position(fillPosition)
        .rotation(rotation)
        .layer("ATTACHMENT")
        .attachedTo(token.id)
        .disableAttachmentBehavior(["SCALE", "ROTATION"])
        .locked(true)
        .disableHit(true)
        .metadata({
          [HP_META]: { ...baseMeta, kind: "fill" } satisfies HpBarMeta,
        })
        .build()
      await OBR.scene.items.addItems([background, fill])
      await queueHpLabelRefresh()
      flash(`Attached ${s.name || "character"} to token`)
    } catch {
      flash("Could not attach character to token")
    }
  }

  const freeSlot = () => store.slots.findIndex((x) => !x)
  const addCharacter = (sheet: Sheet) => {
    const i = freeSlot()
    if (i < 0) return false
    setStore((st) => ({
      active: i,
      slots: st.slots.map((x, k) => (k === i ? sheet : x)),
    }))
    setTab("main")
    return true
  }
  const switchSlot = (i: number) => {
    if (store.slots[i]) setStore((st) => ({ ...st, active: i }))
    else {
      setStore((st) => ({
        active: i,
        slots: st.slots.map((x, k) => (k === i ? initial : x)),
      }))
      setTab("main")
    }
    setMenuOpen(false)
  }
  const saveIncoming = (i: number) => {
    if (!inbox) return
    const sheet = normalize(inbox.sheet)
    setStore((st) => ({
      active: i,
      slots: st.slots.map((x, k) => (k === i ? sheet : x)),
    }))
    setTab("main")
    setInbox(null)
    setOverwriteSlot(null)
    flash(`Saved ${sheet.name || "character"} to slot ${i + 1}`)
  }
  const chooseIncomingSlot = (i: number) => {
    if (store.slots[i]) setOverwriteSlot(i)
    else saveIncoming(i)
  }
  const deleteSlot = (i: number) => {
    const name = store.slots[i]?.name
    if (!confirm(`Delete ${name}?`)) return
    setStore((st) => {
      const slots = st.slots.map((x, k) => (k === i ? null : x))
      const active = slots[st.active] ? st.active : slots.findIndex(Boolean)
      return active < 0
        ? { active: 0, slots: [initial, ...Array(SLOTS - 1).fill(null)] }
        : { active, slots }
    })
  }

  const downloadJson = (value: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(value, null, 2)], {
      type: "application/json",
    })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const exportJson = () => {
    downloadJson(
      {
        schemaVersion: CHARACTER_SCHEMA_VERSION,
        kind: "character",
        app: "5e-sheet",
        exportedAt: new Date().toISOString(),
        contentDependencies: [],
        character: s,
      },
      `${(s.name || "character").replace(/[^\w-]+/g, "_")}.character.json`,
    )
    setMenuOpen(false)
  }
  const importJson = async (file: File) => {
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error("large")
      const data = JSON.parse(await file.text())
      if (
        data.kind !== "character" ||
        data.schemaVersion !== CHARACTER_SCHEMA_VERSION
      )
        throw new Error("schema")
      const raw = data.character
      if (typeof raw !== "object" || !raw || !raw.scores) throw new Error("bad")
      const sheet = normalize(raw)
      if (!addCharacter(sheet)) {
        if (!confirm("All 5 slots are used. Replace the current character?"))
          return
        setS(() => sheet)
      }
      flash(`Imported ${sheet.name}`)
      setMenuOpen(false)
    } catch {
      flash("That file is not a valid character")
    }
  }
  const exportContentPack = () => {
    if (customContent.length === 0)
      return flash("Your Content Library has no custom content to export")
    const slug = "custom-content"
    downloadJson(
      {
        schemaVersion: CONTENT_PACK_SCHEMA_VERSION,
        kind: "content-pack",
        manifest: {
          id: `${slug}-pack`,
          name: "Custom Content Library",
          version: "1.0.0",
          author: "Local user",
          license: "user-supplied",
          notice:
            "The importing user is responsible for having permission to use this content.",
        },
        content: { entries: customContent },
      },
      `${slug}.content-pack.json`,
    )
    setMenuOpen(false)
  }
  const importContentPack = async (file: File) => {
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error("large")
      const data = JSON.parse(await file.text())
      if (
        data.kind !== "content-pack" ||
        data.schemaVersion !== CONTENT_PACK_SCHEMA_VERSION ||
        !Array.isArray(data.content?.entries)
      )
        throw new Error("bad")
      if (data.content.entries.length > 200) throw new Error("large")
      if (
        !confirm(
          "Only import content you created or have permission to use. Continue?",
        )
      )
        return
      const imported = data.content.entries.flatMap(
        (entry: Partial<ContentEntry>): ContentEntry[] => {
          if (!entry || !entry.type || !CONTENT_TYPE_ORDER.includes(entry.type))
            return []
          const feature = normalizeFeature(entry.feature)
          if (!feature) return []
          const { key: _key, ...safe } = feature
          return [
            {
              id: typeof entry.id === "string" ? entry.id : safe.id,
              type: entry.type,
              builtin: false,
              feature: safe,
            },
          ]
        },
      )
      if (imported.length === 0) throw new Error("empty")
      setCustomContent((content) => {
        const incomingIds = new Set(
          imported.map((entry: ContentEntry) => entry.id),
        )
        return [
          ...content.filter((entry) => !incomingIds.has(entry.id)),
          ...imported,
        ]
      })
      flash(
        `Imported ${imported.length} custom content entr${
          imported.length === 1 ? "y" : "ies"
        }`,
      )
      setMenuOpen(false)
    } catch {
      flash("That file is not a valid content pack")
    }
  }

  const hpMode = s.hpMode
  const setHpMode = (v: Sheet["hpMode"]) => setS((p) => ({ ...p, hpMode: v }))
  const set = <K extends keyof Sheet>(k: K, v: Sheet[K]) =>
    setS((p) => ({ ...p, [k]: v }))
  const pb = prof(s.level)
  const scores = effectiveScores(s)
  const currentConditionSummary = conditionSummary(
    s.activeConditions,
    s.exhaustionLevel,
  )
  const currentMaxHp = effectiveMaxHp(s.maxHp, s.exhaustionLevel)
  useEffect(() => {
    if (s.exhaustionLevel >= 6 && (s.hp > 0 || s.deathF < 3))
      setS((sheet) => ({ ...sheet, hp: 0, deathF: 3 }))
    else if (s.hp > currentMaxHp)
      setS((sheet) => ({ ...sheet, hp: Math.min(sheet.hp, currentMaxHp) }))
  }, [s.hp, s.deathF, s.exhaustionLevel, currentMaxHp])
  const activeAcBonus = activeEffectBonus(s, "armor-class")
  const activeAttackBonus = activeEffectBonus(s, "attack-roll")
  const activeDamageBonus = activeEffectBonus(s, "bonus-damage")
  const activeCheckBonus = activeEffectBonus(s, "ability-check")
  const activeMovementBonus = activeEffectBonus(s, "movement")
  const currentSpeed = effectiveSpeed(
    s.speed + activeMovementBonus,
    currentConditionSummary,
  )
  const pendingChoices =
    s.traits.reduce((n, f) => {
      const p = f.proficiencies
      return (
        n +
        (p &&
        p.skillPick > 0 &&
        p.skillChosen.slice(0, p.skillPick).filter(Boolean).length < p.skillPick
          ? 1
          : 0)
      )
    }, 0) +
    s.traits.filter((f) => isAsiFeature(f) && !s.asiChoices[f.id]).length
  const armorAc = inventoryAcInfo(mod(scores.DEX), s.inventory)
  const m = (a: Ab) => mod(scores[a])

  const saveInventoryItem = () => {
    if (role !== "GM") return flash("Only the GM can change inventory items")
    if (!itemDraft || !itemDraft.name.trim())
      return flash("Give the item a name")
    setS((sheet) => {
      let inventory = sheet.inventory.map((item) =>
        item.id === itemDraft.id ? itemDraft : item,
      )
      if (!inventory.some((item) => item.id === itemDraft.id))
        inventory = [...inventory, itemDraft]
      if (
        itemDraft.category === "armor" &&
        itemDraft.armorMode === "base" &&
        itemDraft.equipped
      ) {
        inventory = inventory.map((item) =>
          item.category === "armor" &&
          item.armorMode === "base" &&
          item.id !== itemDraft.id
            ? { ...item, equipped: false }
            : item,
        )
      }
      return { ...sheet, inventory }
    })
    setItemDraft(null)
  }

  const applyCoins = (sign: 1 | -1) => {
    if (!coinDraft) return
    setS((sheet) => ({
      ...sheet,
      coins: Object.fromEntries(
        (Object.keys(sheet.coins) as (keyof Sheet["coins"])[]).map((c) => [
          c,
          Math.max(0, sheet.coins[c] + sign * coinDraft[c]),
        ]),
      ) as Sheet["coins"],
    }))
    setCoinDraft(null)
  }

  const startContentBuilder = (type: ContentType, entry?: ContentEntry) => {
    if (entry?.builtin) return
    const category = contentCategory(type)
    const feature = entry ? { ...entry.feature } : newFeature(category)
    if (!entry) {
      feature.source = {
        ...emptyFeatureSource(),
        className: s.cls,
        subclassName: s.subclass === "Subclass" ? "" : s.subclass,
        speed: s.speed,
        size: s.size,
      }
      if (type === "class" && feature.proficiencies) {
        // Custom classes start with a skill choice (2 from any skill) that the builder can tune.
        feature.proficiencies = {
          ...feature.proficiencies,
          sections: [...feature.proficiencies.sections, "skills"],
          skillPick: 2,
        }
      }
    }
    setContentDraftType(type)
    setContentDraftId(entry?.id ?? null)
    setFeatureDraft(feature)
  }
  const contentName = (entry: ContentEntry) =>
    entry.type === "class"
      ? entry.feature.source?.className || entry.feature.name
      : entry.type === "subclass"
        ? entry.feature.source?.subclassName || entry.feature.name
        : entry.feature.name
  const contentFeatures = (entry: ContentEntry): Feature[] =>
    !entry.builtin
      ? []
      : entry.type === "race" || entry.type === "subrace"
        ? getBuiltinRaceTraits(
            entry.id,
            entry.feature.name,
            entry.feature.source?.parentName,
          )
        : entry.type === "class"
          ? getBuiltinClassTraits(entry.id, contentName(entry))
          : entry.type === "subclass"
            ? getBuiltinSubclassTraits(
                entry.id,
                contentName(entry),
                entry.feature.source?.className,
              )
            : entry.type === "background"
              ? getBuiltinBackgroundTraits(entry.id, entry.feature.name)
              : []
  const applyContent = (entry: ContentEntry) => {
    const name = contentName(entry)
    setS((sheet) => {
      let nextTraits = [...sheet.traits]
      let nextCls = sheet.cls
      let nextSubclass = sheet.subclass
      let nextRace = sheet.race
      let nextSubrace = sheet.subrace
      let nextBackground = sheet.background
      let nextHitDie = sheet.hitDie
      let nextSpeed = sheet.speed
      let nextSize = sheet.size
      let nextHpDice = sheet.hpDice
      let nextHpLock = sheet.hpLock
      let nextInventory = sheet.inventory
      let nextSelectedSpells = sheet.selectedSpells

      if (entry.type === "race" || entry.type === "subrace") {
        nextTraits = nextTraits.filter((f) => f.category !== "racial")
        const parentName =
          entry.type === "subrace"
            ? (entry.feature.source?.parentName ?? "")
            : ""
        const parentEntry =
          entry.type === "subrace"
            ? contentEntries.find(
                (e) =>
                  e.type === "race" &&
                  e.feature.name.toLowerCase() === parentName.toLowerCase(),
              )
            : undefined
        if (entry.type === "subrace") {
          // A subrace keeps its parent race's traits and adds its own on top.
          if (parentEntry && !parentEntry.builtin)
            nextTraits.push({
              ...parentEntry.feature,
              id: `applied-${parentEntry.id}`,
              category: "racial",
            })
          if (parentName) nextRace = parentEntry?.feature.name ?? parentName
          nextSubrace = name
        } else {
          nextRace = name
          nextSubrace = "Subrace"
        }
        if (entry.builtin) {
          nextTraits.push(
            ...getBuiltinRaceTraits(
              entry.id,
              entry.feature.name,
              entry.feature.source?.parentName,
            ),
          )
        } else {
          nextTraits.push({
            ...entry.feature,
            id: `applied-${entry.id}`,
            category: "racial",
          })
        }
        const parent = entry.type === "subrace" ? parentEntry : undefined
        nextSpeed =
          (parent?.feature.source?.speed ?? entry.feature.source?.speed ?? 30) +
          (entry.builtin && name === "Wood Elf" ? 5 : 0)
        nextSize =
          parent?.feature.source?.size ?? entry.feature.source?.size ?? "Medium"
      } else if (entry.type === "class") {
        nextTraits = nextTraits.filter(
          (f) =>
            f.category !== "class" &&
            f.category !== "custom-class" &&
            f.category !== "subclass" &&
            f.category !== "invocation" &&
            f.category !== "pact-boon",
        )
        nextSubclass = "Subclass"
        nextCls = name
        nextHitDie =
          entry.feature.source?.hitDie ?? CLASS_DIE[name] ?? sheet.hitDie
        nextHpDice = []
        nextHpLock = []
        if (entry.builtin) {
          const allTraits = getBuiltinClassTraits(entry.id, name)
          nextTraits.push(
            ...allTraits.filter((f) => (f.source?.level ?? 1) <= sheet.level),
          )
        } else {
          const applied: Feature = {
            ...entry.feature,
            id: `applied-${entry.id}`,
            category: "custom-class",
          }
          nextTraits.push(applied)
        }
      } else if (entry.type === "subclass") {
        nextTraits = nextTraits.filter((f) => f.category !== "subclass")
        nextSubclass = name
        if (entry.builtin) {
          nextTraits.push(
            ...getBuiltinSubclassTraits(
              entry.id,
              name,
              entry.feature.source?.className,
            ).filter((f) => (f.source?.level ?? 1) <= sheet.level),
          )
        } else {
          const applied: Feature = {
            ...entry.feature,
            id: `applied-${entry.id}`,
            category: "subclass",
          }
          nextTraits.push(applied)
        }
      } else if (entry.type === "background") {
        nextTraits = nextTraits.filter(
          (f) => f.source?.parentName !== "background",
        )
        nextBackground = name
        if (entry.builtin) {
          const traits = getBuiltinBackgroundTraits(entry.id, name)
          nextTraits.push(...traits)
        } else {
          const applied: Feature = {
            ...entry.feature,
            id: `applied-${entry.id}`,
            category: "other",
            source: { ...emptyFeatureSource(), parentName: "background" },
          }
          nextTraits.push(applied)
        }
      } else if (entry.type === "feat") {
        const applied: Feature = {
          ...entry.feature,
          id: `applied-${entry.id}`,
          category: "feat",
        }
        nextTraits = [...nextTraits.filter((f) => f.id !== applied.id), applied]
      } else if (
        entry.type === "selection" ||
        entry.type === "invocation" ||
        entry.type === "pact-boon"
      ) {
        const m = entry.feature.meta ?? {}
        const options = (m.options ?? "")
          .split("\n")
          .map((o) => o.trim())
          .filter(Boolean)
        const description =
          entry.type === "selection" &&
          options.length &&
          entry.builtin === false
            ? `${entry.feature.description}\n\nChoose ${m.pick || 1} of: ${options.join(", ")}.`.trim()
            : entry.feature.description
        const category = contentCategory(entry.type)
        const applied: Feature = {
          ...entry.feature,
          id: `applied-${entry.id}`,
          category,
          description,
        }
        if (entry.type === "pact-boon")
          nextTraits = nextTraits.filter((f) => f.category !== "pact-boon")
        nextTraits = [...nextTraits.filter((f) => f.id !== applied.id), applied]
      } else if (entry.type === "item") {
        const m = entry.feature.meta ?? {}
        const category: ItemCategory = ITEM_CATEGORIES.some(
          (c) => c.value === m.itemCategory,
        )
          ? m.itemCategory as ItemCategory
          : "other"
        const base = newInventoryItem(category, itemId())
        const extra: Record<string, unknown> = {}
        if (category === "weapon") {
          const kind: WeaponKind =
            m.weaponKind === "ranged" ? "ranged" : "melee"
          Object.assign(extra, {
            weaponKind: kind,
            weaponClass: m.weaponClass === "martial" ? "martial" : "simple",
            damageDice: m.damageDice ?? "",
            damageType: m.damageType ?? "",
          })
        }
        if (category === "armor") {
          Object.assign(extra, {
            armorMode: m.armorMode === "bonus" ? "bonus" : "base",
            baseAc: Number(m.baseAc) || 10,
            acBonus: m.armorMode === "bonus" ? Number(m.baseAc) || 0 : 0,
          })
        }
        const item = {
          ...base,
          ...extra,
          ...(isCombatFeature(entry.feature)
            ? { combatFeatureId: `applied-${entry.id}-${base.id}` }
            : {}),
          name: entry.feature.name,
          description: entry.feature.description,
          quantity: Math.max(1, Math.round(Number(m.quantity) || 1)),
          weight: Math.max(0, Math.round(Number(m.weight) || 0)),
          value: Math.max(0, Math.round((Number(m.value) || 0) * 100)),
        } as InventoryItem
        nextInventory = [...nextInventory, item]
        if (isCombatFeature(entry.feature)) {
          const linked: Feature = {
            ...entry.feature,
            id: `applied-${entry.id}-${base.id}`,
            category: "other",
            source: {
              ...emptyFeatureSource(),
              parentName: `Item: ${entry.feature.name}`,
            },
          }
          nextTraits = [
            ...nextTraits.filter((feature) => feature.id !== linked.id),
            linked,
          ]
        }
      } else if (entry.type === "spell") {
        const classes = (entry.feature.meta?.classes ?? "")
          .split(",")
          .map((className) => className.trim())
          .filter(Boolean)
        const source = spellcastingSources(sheet).find(
          (candidate) =>
            classes.includes(candidate.spellList) ||
            (!entry.builtin && classes.length === 0),
        )
        if (
          source &&
          !nextSelectedSpells.some(
            (spell) =>
              spell.contentId === entry.id && spell.sourceId === source.id,
          )
        ) {
          const level = Number(entry.feature.meta?.level) || 0
          nextSelectedSpells = [
            ...nextSelectedSpells,
            {
              contentId: entry.id,
              sourceId: source.id,
              prepared:
                level === 0 ||
                source.mode === "known" ||
                source.mode === "granted",
            },
          ]
        }
        if (isCombatFeature(entry.feature)) {
          const linked: Feature = {
            ...entry.feature,
            id: `applied-${entry.id}`,
            category: "other",
            source: {
              ...emptyFeatureSource(),
              parentName: `Spell: ${entry.feature.name}`,
            },
          }
          nextTraits = [
            ...nextTraits.filter((feature) => feature.id !== linked.id),
            linked,
          ]
        }
      }

      return {
        ...sheet,
        cls: nextCls,
        subclass: nextSubclass,
        race: nextRace,
        subrace: nextSubrace,
        background: nextBackground,
        hitDie: nextHitDie,
        speed: nextSpeed,
        size: nextSize,
        hpDice: nextHpDice,
        hpLock: nextHpLock,
        inventory: nextInventory,
        selectedSpells: nextSelectedSpells,
        traits: nextTraits,
        activeEffects: sheet.activeEffects.filter((effect) =>
          nextTraits.some((feature) => feature.id === effect.sourceFeatureId),
        ),
      }
    })
    flash(`Applied ${name}`)
  }
  const deleteContent = (entry: ContentEntry) => {
    if (
      entry.builtin ||
      !confirm(`Delete ${contentName(entry)} from your Content Library?`)
    )
      return
    setCustomContent((content) =>
      content.filter((item) => item.id !== entry.id),
    )
    const prefix = `applied-${entry.id}`
    setS((sheet) => {
      const removed = new Set(
        sheet.traits
          .filter(
            (feature) =>
              feature.id === prefix || feature.id.startsWith(`${prefix}-`),
          )
          .map((feature) => feature.id),
      )
      return {
        ...sheet,
        selectedSpells: sheet.selectedSpells.filter(
          (spell) =>
            spell.contentId !== entry.id && !removed.has(spell.sourceId),
        ),
        traits: sheet.traits.filter((feature) => !removed.has(feature.id)),
        activeEffects: sheet.activeEffects.filter(
          (effect) => !removed.has(effect.sourceFeatureId),
        ),
      }
    })
  }

  const saveFeature = () => {
    if (!featureDraft) return
    if (role !== "GM" && !contentDraftType)
      return flash("Only the GM can approve traits and features")
    if (featureDraft.key)
      return flash("Automatic class features cannot be edited")
    const source = featureDraft.source ?? emptyFeatureSource()
    if (featureDraft.category === "custom-class" && !source.className.trim())
      return flash("Give the custom class a name")
    if (featureDraft.category === "subclass" && !source.subclassName.trim())
      return flash("Give the subclass a name")
    if (
      featureDraft.category !== "custom-class" &&
      featureDraft.category !== "subclass" &&
      !featureDraft.name.trim()
    )
      return flash("Give the content a name")
    if (contentDraftType === "subrace" && !source.parentName.trim())
      return flash("Choose a parent race")
    const savedFeature = {
      ...featureDraft,
      name:
        featureDraft.name.trim() ||
        source.subclassName.trim() ||
        `${source.className.trim()} Foundation`,
      source,
      effects: featureDraft.effects ?? emptyFeatureEffects(),
      proficiencies: featureDraft.proficiencies ?? emptyFeatureProficiencies(),
    }
    if (contentDraftType) {
      const id =
        contentDraftId ??
        `content-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const entry: ContentEntry = {
        id,
        type: contentDraftType,
        builtin: false,
        feature: { ...savedFeature, id },
      }
      setCustomContent((content) =>
        content.some((item) => item.id === id)
          ? content.map((item) => (item.id === id ? entry : item))
          : [...content, entry],
      )
      setS((sheet) => ({
        ...sheet,
        traits: sheet.traits.map((current) => {
          const linked =
            current.id === `applied-${id}` ||
            current.id.startsWith(`applied-${id}-`)
          if (!linked) return current
          return {
            ...savedFeature,
            id: current.id,
            category: current.category,
            source: current.source,
            used: current.used,
          }
        }),
      }))
      setFeatureDraft(null)
      setContentDraftType(null)
      setContentDraftId(null)
      setFeatureGrantMenuOpen(false)
      flash(`Saved ${savedFeature.name} to Content Library`)
      return
    }
    setS((sheet) => {
      const exists = sheet.traits.some(
        (feature) => feature.id === savedFeature.id,
      )
      return {
        ...sheet,
        ...(savedFeature.category === "custom-class"
          ? {
              cls: savedFeature.source.className.trim(),
              hitDie: savedFeature.source.hitDie,
            }
          : {}),
        ...(savedFeature.category === "subclass"
          ? { subclass: savedFeature.source.subclassName.trim() }
          : {}),
        traits: exists
          ? sheet.traits.map((feature) =>
              feature.id === savedFeature.id ? savedFeature : feature,
            )
          : [...sheet.traits, savedFeature],
      }
    })
    setFeatureDraft(null)
    setFeatureGrantMenuOpen(false)
  }

  const deleteFeature = (feature: Feature) => {
    if (role !== "GM")
      return flash("Only the GM can remove traits and features")
    if (feature.key) return flash("Automatic class features cannot be removed")
    if (!confirm(`Delete ${feature.name || "this feature"}?`)) return
    setS((sheet) => ({
      ...sheet,
      selectedSpells: sheet.selectedSpells.filter(
        (spell) => spell.sourceId !== feature.id,
      ),
      traits: sheet.traits.filter((entry) => entry.id !== feature.id),
      activeEffects: sheet.activeEffects.filter(
        (effect) => effect.sourceFeatureId !== feature.id,
      ),
      dismissedFeatures:
        feature.id.startsWith("srd-trait-") &&
        !sheet.dismissedFeatures.includes(feature.id)
          ? [...sheet.dismissedFeatures, feature.id]
          : sheet.dismissedFeatures,
    }))
  }

  const deleteInventoryItem = (item: InventoryItem) => {
    if (role !== "GM") return flash("Only the GM can remove inventory items")
    if (!confirm(`Delete ${item.name || "this item"}?`)) return
    setS((sheet) => ({
      ...sheet,
      inventory: sheet.inventory.filter((entry) => entry.id !== item.id),
      traits: item.combatFeatureId
        ? sheet.traits.filter((feature) => feature.id !== item.combatFeatureId)
        : sheet.traits,
      activeEffects: item.combatFeatureId
        ? sheet.activeEffects.filter(
            (effect) => effect.sourceFeatureId !== item.combatFeatureId,
          )
        : sheet.activeEffects,
    }))
  }

  const consumeInventoryItem = (item: InventoryItem) => {
    const canConsume =
      item.category === "ammo" ||
      (item.category === "adventuring-gear" && item.consumable)
    if (!canConsume || item.quantity <= 0) return
    setS((sheet) => ({
      ...sheet,
      inventory: sheet.inventory.map((entry) =>
        entry.id === item.id
          ? { ...entry, quantity: Math.max(0, entry.quantity - 1) }
          : entry,
      ),
    }))
    flash(
      `${
        item.category === "ammo" ? "Consumed" : "Used"
      } 1 ${item.name || "item"}`,
    )
  }

  const useItemCharge = (item: GearItem) => {
    const result = consumeCharges(item)
    if (!result.ok) {
      flash(`Not enough charges for ${item.name || "item"}`)
      return
    }
    setS((sheet) => ({
      ...sheet,
      inventory: sheet.inventory.map((entry) =>
        entry.id === item.id ? result.item : entry,
      ),
    }))
    flash(
      `${item.name || "Item"} used ${Math.max(1, item.chargeCost)} charge${
        Math.max(1, item.chargeCost) === 1 ? "" : "s"
      }`,
    )
  }

  const pushRoll = (
    r: Pick<Roll, "label" | "die" | "face" | "mod" | "total" | "note" | "faces">,
  ) => {
    const entry: Roll = {
      ...r,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      playerId: playerIdRef.current,
      playerName: playerNameRef.current,
      characterName: s.name.trim(),
    }
    setRolls((current) => [entry, ...current].slice(0, 40))
    if (inObr && OBR.isReady) {
      OBR.broadcast
        .sendMessage(ROLL_CHANNEL, entry, { destination: "REMOTE" })
        .catch(() => flash("Roll saved locally, but could not be shared"))
    }
  }

  const rollDamage = (label: string, dice: string, bonus: number) => {
    const match = dice.match(/(\d*)\s*d\s*(\d+)/i)
    if (!match) {
      if (bonus)
        pushRoll({ label, die: "d0", face: 0, mod: bonus, total: bonus })
      return
    }
    const count = clamp(parseInt(match[1] || "1"), 1, 50)
    const sides = Math.max(1, parseInt(match[2]))
    const faces = Array.from(
      { length: count },
      () => 1 + Math.floor(Math.random() * sides),
    )
    pushRoll({
      label,
      die: `d${sides}`,
      face: 0,
      mod: bonus,
      total: Math.max(0, faces.reduce((x, y) => x + y, 0) + bonus),
      faces,
    })
  }

  const roll = (label: string, bonus: number, explicitKind?: RollKind) => {
    const kind: RollKind =
      explicitKind ??
      (/attack/i.test(label)
        ? "attack"
        : /save/i.test(label)
          ? "saving-throw"
          : "ability-check")
    const summary = conditionSummary(s.activeConditions, s.exhaustionLevel)
    if (kind === "attack" && !summary.canAct) {
      flash("Current conditions prevent attacks")
      return
    }
    const conditionMode =
      kind === "attack"
        ? summary.attack
        : kind === "saving-throw"
          ? summary.savingThrow
          : summary.abilityCheck
    const activeModes = s.activeEffects.flatMap((active) =>
      active.effects
        .filter(
          (effect) =>
            (effect.type === "advantage" ||
              effect.type === "disadvantage") &&
            (!effect.detail ||
              effect.detail.toLowerCase() === "all" ||
              effect.detail.toLowerCase().includes(kind.replace("-", " "))),
        )
        .map((effect): RollMode => effect.type as RollMode),
    )
    const spendInspiration = inspirationArmed && s.inspiration
    const mode = combineRollModes(
      conditionMode,
      ...activeModes,
      spendInspiration ? "advantage" : "normal",
    )
    const faces =
      mode === "normal"
        ? [1 + Math.floor(Math.random() * 20)]
        : [
            1 + Math.floor(Math.random() * 20),
            1 + Math.floor(Math.random() * 20),
          ]
    const d20 =
      mode === "advantage"
        ? Math.max(...faces)
        : mode === "disadvantage"
          ? Math.min(...faces)
          : faces[0]
    if (spendInspiration) {
      setS((sheet) => ({ ...sheet, inspiration: false }))
      setInspirationArmed(false)
    }
    pushRoll({
      label,
      die: "d20",
      face: d20,
      mod: bonus,
      total: d20 + bonus,
      ...(faces.length > 1 ? { faces } : {}),
      note: [
        mode !== "normal" ? mode : "",
        spendInspiration ? "Inspiration spent" : "",
      ]
        .filter(Boolean)
        .join(" · "),
    })
  }

  const hpRef = useRef({ hp: s.hp, maxHp: currentMaxHp })
  hpRef.current = { hp: s.hp, maxHp: currentMaxHp }
  const syncBarsRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    if (!inObr) return
    let cancelled = false
    let busy = false
    let again = false
    let unsub: (() => void) | undefined
    const sync = async () => {
      if (busy) {
        again = true
        return
      }
      busy = true
      try {
        if (!(await OBR.scene.isReady())) return
        const ownerId = await OBR.player.getId()
        const all = await OBR.scene.items.getItems()
        const bars = all.filter((item) => {
          const meta = getHpMeta(item)
          return (
            !!meta && meta.ownerId === ownerId && meta.slot === store.active
          )
        })
        if (!bars.length || cancelled) return
        const { hp, maxHp } = hpRef.current
        const pct = maxHp > 0 ? clamp(hp / maxHp, 0, 1) : 0
        const target = new Map<string, { x: number; y: number; width: number }>()
        for (const item of bars) {
          const meta = getHpMeta(item)!
          if (meta.kind !== "background" || target.has(meta.tokenId)) continue
          const token = all.find((x) => x.id === meta.tokenId)
          if (!token) continue
          const b = await OBR.scene.items.getItemBounds([token.id])
          target.set(meta.tokenId, {
            x: b.min.x,
            y: b.max.y - meta.height * 1.1,
            width: b.width,
          })
        }
        const differs = (item: Item) => {
          const meta = getHpMeta(item)!
          const tg = target.get(meta.tokenId)
          if (!tg || item.type !== "SHAPE") return false
          const shape = item as Shape
          const w =
            meta.kind === "fill" ? Math.max(0.1, tg.width * pct) : tg.width
          return (
            Math.abs(shape.width - w) > 0.5 ||
            Math.abs(shape.height - meta.height) > 0.5 ||
            Math.abs(item.position.x - tg.x) > 0.5 ||
            Math.abs(item.position.y - tg.y) > 0.5 ||
            (meta.kind === "fill" && (meta.hp !== hp || meta.maxHp !== maxHp))
          )
        }
        const changed = bars.filter(differs)
        if (!changed.length || cancelled) return
        await OBR.scene.items.updateItems(changed, (drafts) => {
          for (const draft of drafts) {
            const meta = getHpMeta(draft as unknown as Item)
            const tg = meta && target.get(meta.tokenId)
            if (!meta || !tg || draft.type !== "SHAPE") continue
            const shape = draft as unknown as Shape
            draft.position = { x: tg.x, y: tg.y }
            draft.rotation = 0
            shape.height = meta.height
            if (meta.kind === "background") shape.width = tg.width
            else {
              shape.width = Math.max(0.1, tg.width * pct)
              shape.style.fillColor = hpColor(hp, maxHp)
              shape.style.fillOpacity = pct > 0 ? 1 : 0
              draft.metadata[HP_META] = { ...meta, hp, maxHp }
            }
          }
        })
        if (!cancelled) await queueHpLabelRefresh()
      } finally {
        busy = false
        if (again && !cancelled) {
          again = false
          void sync()
        }
      }
    }
    syncBarsRef.current = sync
    const start = () => {
      void sync()
      unsub = OBR.scene.items.onChange(() => void sync())
    }
    if (OBR.isReady) start()
    else OBR.onReady(start)
    return () => {
      cancelled = true
      unsub?.()
    }
  }, [inObr, store.active])

  useEffect(() => {
    void syncBarsRef.current()
  }, [s.hp, currentMaxHp])

  const skillBonus = (name: string, ab: Ab) =>
    m(ab) +
    skillLevel(s, name) * pb +
    activeEffectBonus(s, "ability-check", name)

  const equippedWeapons = s.inventory.filter(
    (i): i is WeaponItem => i.category === "weapon" && i.equipped,
  )
  const weaponUsesTwoHands = (weapon: WeaponItem) =>
    weapon.props.includes("heavy") || weapon.props.includes("two-handed")
  const hasFreeHand =
    equippedWeapons.length === 0 ||
    (equippedWeapons.length === 1 && !weaponUsesTwoHands(equippedWeapons[0]))
  const unarmedDamage = Math.max(0, 1 + m("STR") + activeDamageBonus)
  const canCast = hasSpellcasting(s)
  const spellcastingFeatures = s.traits.filter(
    (feature) =>
      feature.proficiencies?.sections.includes("spellcasting") &&
      feature.effects,
  )
  const combatFeatures = s.traits.filter(isCombatFeature)
  const combatSections: [CombatSection, Feature[]][] = ([
    "Action",
    "Bonus Action",
    "Reaction",
    "Free / Special",
    "Passive Effects",
  ] as CombatSection[])
    .map(
      (section) =>
        [
          section,
          combatFeatures.filter(
            (feature) => combatSection(feature) === section,
          ),
        ] as [CombatSection, Feature[]],
    )
    .filter(([, features]) => features.length > 0)
  const movementFeatures = s.traits.filter(
    (feature) =>
      feature.proficiencies?.sections.includes("movement") && feature.effects,
  )
  const defenseValues = (value: string) =>
    value
      .split(/[,;\n]/)
      .map((entry) => entry.trim())
      .filter(Boolean)
  const featureDefenses: StructuredDefense[] = s.traits.flatMap((feature) => {
    if (!feature.effects) return []
    const defense = feature.effects.defense
    const mechanical = feature.effects.mechanical.filter(
      (effect) => !effect.temporary,
    )
    return [
      {
        resistances: [
          ...defenseValues(defense.resistances),
          ...mechanical
            .filter((effect) => effect.type === "resistance")
            .map((effect) => effect.detail || effect.damageType),
        ],
        vulnerabilities: mechanical
          .filter((effect) => effect.type === "vulnerability")
          .map((effect) => effect.detail || effect.damageType),
        immunities: [
          ...defenseValues(defense.immunities),
          ...mechanical
            .filter((effect) => effect.type === "immunity")
            .map((effect) => effect.detail || effect.damageType),
        ],
        conditionImmunities: defenseValues(defense.conditionImmunities),
        acBonus: mechanical
          .filter((effect) => effect.type === "armor-class")
          .reduce(
            (total, effect) => total + combatEffectValue(effect, s),
            0,
          ),
      },
    ]
  })
  const temporaryDefenses: StructuredDefense[] = s.activeEffects.map(
    (active) => ({
      resistances: active.effects
        .filter((effect) => effect.type === "resistance")
        .map((effect) => effect.detail || effect.damageType),
      vulnerabilities: active.effects
        .filter((effect) => effect.type === "vulnerability")
        .map((effect) => effect.detail || effect.damageType),
      immunities: active.effects
        .filter((effect) => effect.type === "immunity")
        .map((effect) => effect.detail || effect.damageType),
      conditionImmunities: active.effects
        .filter((effect) => effect.type === "condition")
        .map((effect) => effect.condition),
      acBonus: active.effects
        .filter((effect) => effect.type === "armor-class")
        .reduce((total, effect) => total + combatEffectValue(effect, s), 0),
    }),
  )
  const structuredDefenses = mergeDefenses([
    ...featureDefenses,
    ...temporaryDefenses,
    ...(s.activeConditions.some((condition) => condition.type === "Petrified")
      ? [
          {
            resistances: ["all damage"],
            vulnerabilities: [],
            immunities: ["poison"],
            conditionImmunities: ["Poisoned"],
            acBonus: 0,
          },
        ]
      : []),
  ])
  const permanentAcBonus = mergeDefenses(featureDefenses).acBonus

  const deathStatus: "alive" | "dying" | "stable" | "dead" =
    s.hp > 0
      ? "alive"
      : s.deathF >= 3
        ? "dead"
        : s.deathS >= 3
          ? "stable"
          : "dying"

  useEffect(() => {
    if (s.hp > 0 && (s.deathS > 0 || s.deathF > 0))
      setS((p) => ({ ...p, deathS: 0, deathF: 0 }))
  }, [s.hp, s.deathS, s.deathF])

  const rollDeathSave = () => {
    if (deathStatus !== "dying") return
    const spendInspiration = inspirationArmed && s.inspiration
    const mode = combineRollModes(
      currentConditionSummary.savingThrow,
      spendInspiration ? "advantage" : "normal",
    )
    const faces =
      mode === "normal"
        ? [1 + Math.floor(Math.random() * 20)]
        : [
            1 + Math.floor(Math.random() * 20),
            1 + Math.floor(Math.random() * 20),
          ]
    const d20 =
      mode === "advantage"
        ? Math.max(...faces)
        : mode === "disadvantage"
          ? Math.min(...faces)
          : faces[0]
    const note =
      d20 === 20
        ? "Back up with 1 HP"
        : d20 === 1
          ? "2 failures"
          : d20 >= 10
            ? "Success"
            : "Failure"
    setS((p) => {
      const inspiration = spendInspiration ? false : p.inspiration
      if (d20 === 20)
        return { ...p, inspiration, hp: 1, deathS: 0, deathF: 0 }
      if (d20 === 1)
        return {
          ...p,
          inspiration,
          deathF: Math.min(3, p.deathF + 2),
        }
      if (d20 >= 10)
        return {
          ...p,
          inspiration,
          deathS: Math.min(3, p.deathS + 1),
        }
      return {
        ...p,
        inspiration,
        deathF: Math.min(3, p.deathF + 1),
      }
    })
    if (spendInspiration) setInspirationArmed(false)
    pushRoll({
      label: "Death save",
      die: "d20",
      face: d20,
      mod: 0,
      total: d20,
      faces,
      note: [note, mode !== "normal" ? mode : "", spendInspiration ? "Inspiration spent" : ""]
        .filter(Boolean)
        .join(" · "),
    })
  }

  const toggleWeaponEquipped = (id: string) => {
    const w = s.inventory.find((i) => i.id === id)
    if (!w || w.category !== "weapon") return
    if (w.equipped) {
      setS((p) => ({
        ...p,
        inventory: p.inventory.map((i) =>
          i.id === id && i.category === "weapon"
            ? { ...i, equipped: false }
            : i,
        ),
      }))
      return
    }
    const result = equipWeapon(s.inventory, id)
    setS((p) => ({ ...p, inventory: equipWeapon(p.inventory, id).inventory }))
    if (result.replaced)
      flash(
        "Hands full: other weapon unequipped (two weapons need both to be Light)",
      )
  }

  const applyHp = (kind: "dmg" | "heal" | "temp") => {
    const n = parseInt(amount)
    if (!n || n < 0) return
    setS((p) => {
      if (kind === "temp") return { ...p, tempHp: Math.max(p.tempHp, n) }
      if (kind === "heal")
        return {
          ...p,
          hp: clamp(
            p.hp + n,
            0,
            effectiveMaxHp(p.maxHp, p.exhaustionLevel),
          ),
          deathS: 0,
          deathF: 0,
        }
      const absorbed = Math.min(p.tempHp, n)
      return {
        ...p,
        tempHp: p.tempHp - absorbed,
        hp: clamp(p.hp - (n - absorbed), 0, p.maxHp),
      }
    })
    setAmount("")
  }

  const activateCombatAbility = (feature: Feature) => {
    let outcome = ""
    setS((sheet) => {
      const current = sheet.traits.find((entry) => entry.id === feature.id)
      if (!current || !current.effects || !isCombatFeature(current)) {
        outcome = "Ability is no longer available"
        return sheet
      }
      const action = current.effects.action
      if (action.actionType === "Passive") {
        outcome = "Passive effects are always active"
        return sheet
      }
      const alreadyActive = sheet.activeEffects.some(
        (effect) => effect.sourceFeatureId === current.id,
      )
      if (alreadyActive && action.stacking === "non-stacking") {
        outcome = `${current.name} is already active`
        return sheet
      }
      const resource = featureResource(
        sheet.cls,
        sheet.level,
        current,
        effectiveScores(sheet),
      )
      const cost = Math.max(0, current.effects.resource.cost ?? 1)
      const pool = current.effects.resource.pool.trim()
      const poolMembers = pool
        ? sheet.traits.filter(
            (entry) => entry.effects?.resource.pool.trim() === pool,
          )
        : [current]
      const used = Math.max(...poolMembers.map((entry) => entry.used ?? 0), 0)
      if (
        resource &&
        Number.isFinite(resource.max) &&
        used + cost > resource.max
      ) {
        outcome = `No ${pool || current.name} uses remaining`
        return sheet
      }
      const linkedItem = sheet.inventory.find(
        (item): item is GearItem =>
          item.category === "adventuring-gear" &&
          item.combatFeatureId === current.id &&
          item.maxCharges > 0,
      )
      const chargeResult = linkedItem ? consumeCharges(linkedItem) : null
      if (chargeResult && !chargeResult.ok) {
        outcome = `Not enough charges for ${linkedItem?.name || current.name}`
        return sheet
      }

      let hp = sheet.hp
      let tempHp = sheet.tempHp
      let activeConditions = [...sheet.activeConditions]
      let traits = sheet.traits
      let inventory = sheet.inventory
      if (linkedItem && chargeResult?.ok) {
        inventory = inventory.map((item) =>
          item.id === linkedItem.id ? chargeResult.item : item,
        )
      }
      if (resource && Number.isFinite(resource.max) && cost > 0) {
        const poolIds = new Set(poolMembers.map((entry) => entry.id))
        traits = traits.map((entry) =>
          poolIds.has(entry.id) ? { ...entry, used: used + cost } : entry,
        )
      }

      const persistent: CombatMechanicalEffect[] = []
      current.effects.mechanical.forEach((effect) => {
        const value = rollCombatEffectValue(effect, sheet)
        const selfTarget = !action.target || /self/i.test(action.target)
        if (effect.temporary) {
          persistent.push(effect)
        } else if (effect.type === "healing" && selfTarget) {
          hp = clamp(
            hp + value,
            0,
            effectiveMaxHp(sheet.maxHp, sheet.exhaustionLevel),
          )
        } else if (effect.type === "temporary-hp" && selfTarget) {
          tempHp = Math.max(tempHp, value)
        } else if (effect.type === "damage" && selfTarget) {
          const absorbed = Math.min(tempHp, value)
          tempHp -= absorbed
          hp = clamp(hp - (value - absorbed), 0, sheet.maxHp)
        } else if (
          effect.type === "condition" &&
          selfTarget &&
          CONDITION_TYPES.includes(
            effect.condition as ActiveCondition["type"],
          ) &&
          !conditionImmune(sheet, effect.condition) &&
          !activeConditions.some(
            (condition) => condition.type === effect.condition,
          )
        ) {
          activeConditions.push({
            id: `condition-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: effect.condition as ActiveCondition["type"],
            source: current.name,
            sourceDetails: featureSourceLabel(current),
            appliedCharacter: sheet.name,
            duration: action.duration || "Until removed",
            expiration: action.endOn,
            save: "",
            notes: effect.detail,
            appliedAt: Date.now(),
          })
        } else if (effect.type === "resource-recovery") {
          const resourcePool = effect.detail.trim()
          traits = traits.map((entry) => {
            if (
              resourcePool &&
              entry.effects?.resource.pool !== resourcePool &&
              entry.name !== resourcePool
            )
              return entry
            return { ...entry, used: Math.max(0, (entry.used ?? 0) - value) }
          })
        } else if (
          !["healing", "temporary-hp", "damage"].includes(effect.type)
        ) {
          persistent.push(effect)
        }
      })

      let activeEffects = [...sheet.activeEffects]
      if (persistent.length) {
        const active: ActiveEffect = {
          id: `active-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          sourceFeatureId: current.id,
          sourceName: current.name,
          sourceType: featureSourceLabel(current),
          name: current.name,
          appliedAt: Date.now(),
          duration: action.duration || "Until manually ended",
          endOn: action.endOn,
          stacking: action.stacking,
          effects: persistent,
        }
        if (action.stacking !== "stack") {
          activeEffects = activeEffects.filter(
            (entry) => entry.sourceFeatureId !== current.id,
          )
        }
        activeEffects.push(active)
      }
      outcome = persistent.length
        ? `${current.name} activated`
        : `${current.name} used`
      return {
        ...sheet,
        hp,
        tempHp,
        activeConditions,
        traits,
        inventory,
        activeEffects,
      }
    })
    queueMicrotask(() => outcome && flash(outcome))
  }

  const longRest = () =>
    setS((p) => ({
      ...p,
      hp: effectiveMaxHp(p.maxHp, p.exhaustionLevel),
      tempHp: 0,
      deathS: 0,
      deathF: 0,
      hitDiceUsed: Math.max(
        0,
        p.hitDiceUsed - Math.max(1, Math.floor(p.level / 2)),
      ),
      slots: p.slots.map((x) => ({ ...x, used: 0 })),
      pactSlots: { ...p.pactSlots, used: 0 },
      traits: restoreUses(p, ["short", "long"]),
      inventory: restoreInventoryCharges(p.inventory, ["short", "long"]),
      activeConditions: p.activeConditions.filter(
        (condition) =>
          condition.expiration !== "short" &&
          condition.expiration !== "long",
      ),
      activeEffects: p.activeEffects.filter(
        (effect) => effect.endOn !== "short" && effect.endOn !== "long",
      ),
    }))

  const shortRest = () => {
    setS((p) => ({
      ...p,
      pactSlots: { ...p.pactSlots, used: 0 },
      traits: restoreUses(p, ["short"]),
      inventory: restoreInventoryCharges(p.inventory, ["short"]),
      activeConditions: p.activeConditions.filter(
        (condition) => condition.expiration !== "short",
      ),
      activeEffects: p.activeEffects.filter(
        (effect) => effect.endOn !== "short",
      ),
    }))
    flash(
      s.pactSlots.max > 0
        ? "Short rest: pact slots restored"
        : "Short rest: spend hit dice in the Combat tab",
    )
  }
  const dawn = () => {
    setS((p) => ({
      ...p,
      traits: restoreUses(p, ["dawn"]),
      inventory: restoreInventoryCharges(p.inventory, ["dawn"]),
      activeConditions: p.activeConditions.filter(
        (condition) => condition.expiration !== "dawn",
      ),
      activeEffects: p.activeEffects.filter(
        (effect) => effect.endOn !== "dawn",
      ),
    }))
    flash("Dawn: daily features recharged")
  }

  const upAttack = (id: string, patch: Partial<CustomAttack>) =>
    set(
      "customAttacks",
      s.customAttacks.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    )
  // Level 1 = full hit die. Levels 2+ = rolled / average / max hit die. CON mod applies every level (min 1 HP per level).
  const conMod = mod(scores.CON)
  const avgDie = Math.floor(s.hitDie / 2) + 1
  // Roll mode: a level only counts once its rolled die is locked (approved).
  const hpPerLevel: (number | null)[] = Array.from(
    { length: s.level },
    (_, i) => {
      if (i === 0) return Math.max(1, s.hitDie + conMod)
      let die: number
      if (hpMode === "max") die = s.hitDie
      else if (hpMode === "avg") die = avgDie
      else if (s.hpLock[i - 1] && (s.hpDice[i - 1] ?? 0) > 0)
        die = s.hpDice[i - 1]
      else return null
      return Math.max(1, die + conMod)
    },
  )
  const derivedMax = hpPerLevel.reduce<number>((a, b) => a + (b ?? 0), 0)
  const pendingLevels = hpPerLevel.filter((x) => x === null).length

  const lastActive = useRef(store.active)
  useEffect(() => {
    const switched = lastActive.current !== store.active
    lastActive.current = store.active
    setS((p) => {
      if (p.maxHp === derivedMax) return p
      const hp = switched ? p.hp : p.hp + (derivedMax - p.maxHp)
      return { ...p, maxHp: derivedMax, hp: clamp(hp, 0, derivedMax) }
    })
  }, [derivedMax, store.active])

  // Locked levels keep their rolled die; only unlocked levels are re-rolled.
  const rollHpDice = () => {
    setHpMode("roll")
    setS((p) => ({
      ...p,
      hpDice: Array.from({ length: p.level - 1 }, (_, i) =>
        p.hpLock[i] && p.hpDice[i] > 0
          ? p.hpDice[i]
          : 1 + Math.floor(Math.random() * p.hitDie),
      ),
    }))
  }

  const toggleHpLock = (i: number) =>
    setS((p) => {
      const lock = Array.from({ length: p.level - 1 }, (_, k) => !!p.hpLock[k])
      lock[i] = !lock[i]
      return { ...p, hpLock: lock }
    })

  const setAllHpLocks = (v: boolean) =>
    setS((p) => ({
      ...p,
      hpLock: Array.from(
        { length: p.level - 1 },
        (_, k) => v && (p.hpDice[k] ?? 0) > 0,
      ),
    }))

  const changeClass = (c: string) =>
    setS((p) => ({
      ...p,
      cls: c,
      hitDie: CLASS_DIE[c],
      hpDice: [],
      hpLock: [],
    }))

  const barScale = Math.max(s.maxHp, s.hp + s.tempHp)
  const hpPct = s.maxHp ? clamp((s.hp / s.maxHp) * 100, 0, 100) : 0
  const lastRoll = rolls[0]
  const [hiddenRollId, setHiddenRollId] = useState<string | undefined>(
    () => rolls[0]?.id,
  )
  useEffect(() => {
    const id = lastRoll?.id
    if (!id || id === hiddenRollId) return
    const t = window.setTimeout(() => setHiddenRollId(id), 10000)
    return () => window.clearTimeout(t)
  }, [lastRoll?.id, hiddenRollId])
  const TABS: [Tab, string][] = [
    ["main", "Ability"],
    ["combat", "Combat"],
    ["spells", "Spells"],
    ["gear", "Gear"],
    ["traits", "Traits"],
    ["content", "Content"],
    ["log", "Log"],
  ]
  const TAB_DETAILS: Record<Tab, string> = {
    main: "Saves, skills & senses",
    combat: "Weapons, attacks & conditions",
    spells: "Slots & prepared spells",
    gear: "Inventory, coins & notes",
    traits: "Racial & class features",
    content: "SRD options & custom builders",
    log: "Shared room rolls",
  }
  const contentEntries = [...BUILTIN_CONTENT, ...customContent]
  const spellSources = spellcastingSources(s)
  const spellEntries = contentEntries.filter((entry) => entry.type === "spell")
  const selectedSpellEntries = s.selectedSpells.flatMap((selected) => {
    const entry = spellEntries.find((spell) => spell.id === selected.contentId)
    const source = spellSources.find(
      (candidate) => candidate.id === selected.sourceId,
    )
    return entry && source ? [{ selected, entry, source }] : []
  })
  spellSources.forEach((source) => {
    source.grantedSpells.forEach((name) => {
      const entry = spellEntries.find(
        (spell) => spell.feature.name.toLowerCase() === name.toLowerCase(),
      )
      if (
        entry &&
        !selectedSpellEntries.some(
          (record) =>
            record.entry.id === entry.id && record.source.id === source.id,
        )
      ) {
        selectedSpellEntries.push({
          selected: {
            contentId: entry.id,
            sourceId: source.id,
            prepared: true,
          },
          entry,
          source,
        })
      }
    })
  })
  const spellsForSource = (source: SpellcastingSource) =>
    spellEntries.filter((entry) => {
      const level = Number(entry.feature.meta?.level) || 0
      if (level > maxSpellLevel(s, source)) return false
      const classes = (entry.feature.meta?.classes ?? "")
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean)
      return (
        classes.includes(source.spellList) ||
        (!entry.builtin && classes.length === 0) ||
        source.spellList === "Custom"
      )
    })
  const toggleSelectedSpell = (
    entry: ContentEntry,
    source: SpellcastingSource,
  ) => {
    const existing = s.selectedSpells.find(
      (spell) => spell.contentId === entry.id && spell.sourceId === source.id,
    )
    if (existing) {
      set(
        "selectedSpells",
        s.selectedSpells.filter((spell) => spell !== existing),
      )
      return
    }
    const level = Number(entry.feature.meta?.level) || 0
    const limits = spellSelectionLimits(s, source)
    const sourceSelections = s.selectedSpells.filter(
      (spell) => spell.sourceId === source.id,
    )
    const current = sourceSelections.filter((spell) => {
      const selectedEntry = spellEntries.find(
        (candidate) => candidate.id === spell.contentId,
      )
      const selectedLevel = Number(selectedEntry?.feature.meta?.level) || 0
      return (selectedLevel === 0) === (level === 0)
    }).length
    const maximum = level === 0 ? limits.cantrips : limits.known
    if (Number.isFinite(maximum) && current >= maximum) {
      flash(`Maximum ${level === 0 ? "cantrips" : "spells known"} reached`)
      return
    }
    set("selectedSpells", [
      ...s.selectedSpells,
      {
        contentId: entry.id,
        sourceId: source.id,
        prepared:
          level === 0 || source.mode === "known" || source.mode === "granted",
      },
    ])
  }
  const togglePreparedSpell = (selected: SelectedSpell) => {
    const source = spellSources.find(
      (candidate) => candidate.id === selected.sourceId,
    )
    if (!source) return
    if (!selected.prepared) {
      const prepared = s.selectedSpells.filter(
        (spell) =>
          spell.sourceId === source.id &&
          spell.prepared &&
          Number(
            spellEntries.find((entry) => entry.id === spell.contentId)?.feature
              .meta?.level,
          ) > 0,
      ).length
      if (prepared >= spellSelectionLimits(s, source).prepared) {
        flash("Maximum prepared spells reached")
        return
      }
    }
    set(
      "selectedSpells",
      s.selectedSpells.map((spell) =>
        spell === selected ? { ...spell, prepared: !spell.prepared } : spell,
      ),
    )
  }
  const castSpell = (
    entry: ContentEntry,
    selected: SelectedSpell,
    source: SpellcastingSource,
    castLevel: number,
  ) => {
    let outcome = ""
    setS((sheet) => {
      const current = sheet.selectedSpells.find(
        (spell) =>
          spell.contentId === selected.contentId &&
          spell.sourceId === selected.sourceId,
      )
      if (!current || !current.prepared) {
        outcome = "Spell is not prepared"
        return sheet
      }
      const spellLevel = Number(entry.feature.meta?.level) || 0
      let slots = sheet.slots
      let pactSlots = sheet.pactSlots
      if (spellLevel > 0 && source.progression !== "custom") {
        const consumed = consumeSpellResource(
          slots,
          pactSlots,
          spellLevel,
          castLevel,
          source.progression === "pact",
        )
        if (!consumed.ok) {
          outcome =
            source.progression === "pact"
              ? "No eligible Pact Magic slot remains"
              : "No eligible spell slot remains"
          return sheet
        }
        slots = consumed.slots
        pactSlots = consumed.pactSlots
        castLevel = consumed.castLevel
      }
      const meta = entry.feature.meta ?? {}
      const concentration = meta.concentration === "true"
      const duration = meta.duration || "Instantaneous"
      const tracked =
        concentration ||
        !!meta.effectType ||
        !/instantaneous/i.test(duration)
      let activeEffects = sheet.activeEffects
      if (tracked) {
        if (concentration) {
          activeEffects = activeEffects.filter(
            (effect) => effect.sourceType !== "Concentration spell",
          )
        }
        const mechanical: CombatMechanicalEffect[] = []
        if (meta.effectType?.startsWith("armor-class:")) {
          mechanical.push({
            id: `spell-effect-${entry.id}`,
            type: "armor-class",
            value: Number(meta.effectType.split(":")[1]) || 0,
            formula: "",
            detail: "",
            damageType: "",
            condition: "",
            temporary: true,
          })
        } else {
          mechanical.push({
            id: `spell-effect-${entry.id}`,
            type: "spellcasting",
            value: 0,
            formula: "",
            detail: meta.text || entry.feature.description,
            damageType: "",
            condition: concentration ? "Concentration" : "",
            temporary: true,
          })
        }
        const active: ActiveEffect = {
          id: `spell-active-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          sourceFeatureId: `spell:${entry.id}:${source.id}`,
          sourceName: entry.feature.name,
          sourceType: concentration
            ? "Concentration spell"
            : `Spell · ${source.spellList}`,
          name: entry.feature.name,
          appliedAt: Date.now(),
          duration,
          endOn: "manual",
          stacking: "replace",
          effects: mechanical,
        }
        activeEffects = activeEffects.filter(
          (effect) => effect.sourceFeatureId !== active.sourceFeatureId,
        )
        activeEffects.push(active)
      }
      outcome = `${entry.feature.name} cast at level ${castLevel || 0}`
      return { ...sheet, slots, pactSlots, activeEffects }
    })
    queueMicrotask(() => outcome && flash(outcome))
  }
  const useSpellFormula = (
    entry: ContentEntry,
    source: SpellcastingSource,
    castLevel: number,
    healing: boolean,
    damageIndex = 0,
  ) => {
    const formula = scaledSpellFormula(
      entry,
      source,
      s,
      castLevel,
      healing,
      damageIndex,
    )
    const parts = spellFormulaParts(formula)
    if (!healing) {
      rollDamage(`${entry.feature.name} damage`, parts.dice, parts.bonus)
      return
    }
    const match = parts.dice.match(/(\d+)d(\d+)/i)
    const rolled = match
      ? Array.from({ length: Number(match[1]) }).reduce<number>(
          (sum, _value) =>
            sum + 1 + Math.floor(Math.random() * Number(match[2])),
          0,
        )
      : 0
    const total = Math.max(0, rolled + parts.bonus)
    setS((sheet) => ({
      ...sheet,
      hp: clamp(
        sheet.hp + total,
        0,
        effectiveMaxHp(sheet.maxHp, sheet.exhaustionLevel),
      ),
    }))
    pushRoll({
      label: `${entry.feature.name} healing`,
      die: parts.dice || "d0",
      face: 0,
      mod: parts.bonus,
      total,
    })
  }
  const visibleContent = contentEntries
  const subraceOptions = contentEntries.filter(
    (entry) =>
      entry.type === "subrace" &&
      (entry.feature.source?.parentName ?? "").toLowerCase() ===
        s.race.toLowerCase(),
  )
  const setLevel = (next: number) =>
    setS((p) => {
      const level = clamp(next, 1, 20)
      if (level === p.level) return p
      const floor = XP_THRESHOLDS[level - 1]
      const exp =
        level > p.level
          ? Math.max(p.exp, floor)
          : level < 20 && p.exp >= XP_THRESHOLDS[level]
            ? floor
            : p.exp
      return { ...p, level, exp }
    })
  const setExp = (value: number) =>
    setS((p) => {
      const exp = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0))
      return { ...p, exp, level: Math.max(p.level, levelForXp(exp)) }
    })
  const activeTabLabel = TABS.find(([value]) => value === tab)?.[1] ?? "Ability"

  return (
    <div className="@container h-dvh w-full bg-paper">
      <div className="relative flex h-full w-full flex-col">
        {/* App bar */}
        <header className="relative z-20 flex h-12 shrink-0 items-center gap-3 bg-head px-3 text-white shadow-md @3xl:px-6">
          <div ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Menu"
              aria-expanded={menuOpen}
              className="grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-white/20"
            >
              <span className="flex w-[18px] flex-col gap-[4px]">
                <span
                  className={`h-0.5 rounded bg-white transition-transform ${
                    menuOpen ? "translate-y-[6px] rotate-45" : ""
                  }`}
                />
                <span
                  className={`h-0.5 rounded bg-white transition-opacity ${
                    menuOpen ? "opacity-0" : ""
                  }`}
                />
                <span
                  className={`h-0.5 rounded bg-white transition-transform ${
                    menuOpen ? "-translate-y-[6px] -rotate-45" : ""
                  }`}
                />
              </span>
            </button>
            {menuOpen && (
              <div
                role="dialog"
                aria-label="Settings"
                className="absolute left-2 top-11 z-30 max-h-[80dvh] w-64 overflow-y-auto rounded-lg border border-white/25 bg-card/60 p-2 text-ink shadow-[0_12px_40px_-8px_rgba(0,0,0,0.6)] backdrop-blur-md"
              >
                <button
                  role="switch"
                  aria-checked={dark}
                  onClick={() => setDark((d) => !d)}
                  className="flex w-full items-center justify-between rounded px-2 py-2 text-left hover:bg-accent-soft"
                >
                  <span className="text-sm font-medium">Night mode</span>
                  <span
                    className={`relative h-5 w-9 rounded-full transition-colors ${
                      dark ? "bg-pink" : "bg-rule"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                        dark ? "left-[18px]" : "left-0.5"
                      }`}
                    />
                  </span>
                </button>
                <Label>Characters</Label>
                {store.slots.map((c, i) => (
                  <div
                    key={i}
                    className={`flex items-center rounded ${
                      i === store.active
                        ? "bg-accent-soft"
                        : "hover:bg-accent-soft"
                    }`}
                  >
                    <button
                      onClick={() => switchSlot(i)}
                      className="min-w-0 flex-1 px-2 py-1.5 text-left text-sm"
                    >
                      <span className="mr-1.5 font-mono text-[10px] text-muted">
                        {i + 1}
                      </span>
                      {c ? (
                        <>
                          {c.name || "Unnamed"}
                          <span className="ml-1 text-[11px] text-muted">
                            {c.cls} {c.level}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted">+ Empty slot</span>
                      )}
                    </button>
                    {c && store.slots.filter(Boolean).length > 1 && (
                      <button
                        onClick={() => deleteSlot(i)}
                        aria-label={`Delete ${c.name}`}
                        className="px-2 text-muted hover:text-danger"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <div className="my-1 border-t border-rule/70" />
                <MenuItem onClick={exportJson}>
                  Export character (JSON)
                </MenuItem>
                <MenuItem onClick={() => fileRef.current?.click()}>
                  Import character (JSON)
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setLegalOpen(true)
                    setMenuOpen(false)
                  }}
                >
                  SRD 5.1 license &amp; content policy
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setShareOpen(true)
                    setMenuOpen(false)
                  }}
                >
                  {role === "GM" ? "Share to player" : "Share to DM"}
                </MenuItem>
                <MenuItem
                  onClick={
                    attached ? removeSheetFromToken : attachCharacterToToken
                  }
                >
                  {attached
                    ? "Remove sheet from token"
                    : "Attach sheet to selected token"}
                </MenuItem>
                {!inObr && (
                  <MenuItem
                    onClick={() => {
                      const r = role === "GM" ? "PLAYER" : "GM"
                      setRole(r)
                      localStorage.setItem("dnd5e-role", r)
                    }}
                  >
                    Demo view: {role === "GM" ? "GM" : "Player"} (tap to switch)
                  </MenuItem>
                )}
                <div className="my-1 border-t border-rule/70" />
                <MenuItem
                  onClick={() => {
                    setRolls([])
                    setMenuOpen(false)
                  }}
                >
                  Clear roll log
                </MenuItem>
                <MenuItem
                  danger
                  onClick={() => {
                    if (confirm("Reset sheet to defaults?")) setS(() => initial)
                    setMenuOpen(false)
                  }}
                >
                  Reset sheet
                </MenuItem>
              </div>
            )}
          </div>
          <h1 className="min-w-0 flex-1 truncate text-lg font-medium">
            D&amp;D 5e
          </h1>
          {role === "GM" && (
            <div ref={restRef}>
              <button
                onClick={() => setRestOpen((o) => !o)}
                aria-label="DM tools"
                aria-expanded={restOpen}
                title="DM tools: rest"
                className={`grid h-8 w-8 place-items-center rounded-full transition-colors ${
                  restOpen ? "bg-white/25" : "hover:bg-white/20"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M12 2.5 20.5 7.5v9L12 21.5 3.5 16.5v-9L12 2.5Z" />
                  <path d="M12 2.5 8 15h8L12 2.5ZM3.5 7.5 8 15l-4.5 1.5M20.5 7.5 16 15l4.5 1.5M8 15l4 6.5 4-6.5" />
                </svg>
              </button>
              {restOpen && (
                <div
                  role="dialog"
                  aria-label="DM tools"
                  className="absolute right-2 top-11 z-30 w-44 rounded-lg border border-white/25 bg-card/60 p-2 text-ink shadow-[0_12px_40px_-8px_rgba(0,0,0,0.6)] backdrop-blur-md"
                >
                  <MenuItem
                    onClick={() => {
                      longRest()
                      flash("Long rest: HP, slots and hit dice restored")
                      setRestOpen(false)
                    }}
                  >
                    Long rest
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      shortRest()
                      setRestOpen(false)
                    }}
                  >
                    Short rest
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      dawn()
                      setRestOpen(false)
                    }}
                  >
                    Dawn
                  </MenuItem>
                </div>
              )}
            </div>
          )}
        </header>

        {notice && (
          <div className="pointer-events-none absolute left-0 right-0 top-14 z-40 flex justify-center px-3">
            <div className="rounded-full bg-card px-4 py-1.5 text-xs text-ink shadow-lg ring-1 ring-rule">
              {notice}
            </div>
          </div>
        )}
        {shareOpen && (
          <div
            className="absolute inset-0 z-40 grid place-items-center bg-black/40 p-4"
            onMouseDown={() => setShareOpen(false)}
          >
            <div
              onMouseDown={(e) => e.stopPropagation()}
              className="w-full max-w-xs rounded-lg border border-rule bg-card p-3 shadow-xl"
            >
              <Label>{role === "GM" ? "Share to player" : "Share to DM"}</Label>
              <p className="mt-1 text-[11px] text-muted">
                Sends a copy of {s.name || "this character"}. They choose
                whether to save it.
              </p>
              {role === "GM" ? (
                <div className="mt-2 space-y-1">
                  {shareTargets.length === 0 && (
                    <p className="text-xs text-muted">
                      No other players in the room.
                    </p>
                  )}
                  {shareTargets.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => sendSheet(p.id, p.name)}
                      className="block w-full rounded border border-rule px-2 py-2 text-left text-sm hover:bg-accent-soft"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              ) : (
                <Btn tone="green" onClick={() => sendSheet("GM", "DM")}>
                  Send to DM
                </Btn>
              )}
              <button
                onClick={() => setShareOpen(false)}
                className="mt-2 text-xs text-muted hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {inbox && (
          <div className="absolute inset-0 z-50 grid place-items-center bg-black/40 p-4">
            <div
              role={overwriteSlot === null ? "dialog" : "alertdialog"}
              aria-label={
                overwriteSlot === null
                  ? "Choose character slot"
                  : "Confirm overwrite"
              }
              className="w-full max-w-xs rounded-lg border border-rule bg-card p-3 shadow-xl"
            >
              {overwriteSlot === null ? (
                <>
                  <Label>Incoming character</Label>
                  <p className="mt-1 text-sm">
                    {inbox.fromName} shared <b>{inbox.sheet.name}</b> (
                    {inbox.sheet.cls} {inbox.sheet.level}).
                  </p>
                  <p className="mt-2 text-[11px] text-muted">
                    Choose a slot to save this character.
                  </p>
                  <div className="mt-2 space-y-1">
                    {store.slots.map((character, i) => (
                      <button
                        key={i}
                        onClick={() => chooseIncomingSlot(i)}
                        className="flex w-full items-center rounded border border-rule px-2 py-2 text-left hover:bg-accent-soft"
                      >
                        <span className="mr-2 font-mono text-[10px] text-muted">
                          {i + 1}
                        </span>
                        {character ? (
                          <span className="min-w-0">
                            <span className="block truncate text-sm">
                              {character.name || "Unnamed"}
                            </span>
                            <span className="block text-[10px] text-muted">
                              {character.cls} {character.level} · overwrite
                            </span>
                          </span>
                        ) : (
                          <span className="text-sm text-muted">Empty slot</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setInbox(null)}
                    className="mt-2 text-xs text-muted hover:text-ink"
                  >
                    Dismiss
                  </button>
                </>
              ) : (
                <>
                  <Label>Overwrite slot {overwriteSlot + 1}?</Label>
                  <p className="mt-1 text-sm">
                    <b>{store.slots[overwriteSlot]?.name || "Unnamed"}</b> will
                    be replaced by{" "}
                    <b>{inbox.sheet.name || "the incoming character"}</b>.
                  </p>
                  <p className="mt-1 text-[11px] text-danger">
                    This cannot be undone.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Btn tone="red" onClick={() => saveIncoming(overwriteSlot)}>
                      Overwrite
                    </Btn>
                    <Btn tone="plain" onClick={() => setOverwriteSlot(null)}>
                      Cancel
                    </Btn>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        {itemDraft &&
          (() => {
            const editing = s.inventory.some((item) => item.id === itemDraft.id)
            const typeLabel =
              ITEM_CATEGORIES.find((c) => c.value === itemDraft.category)
                ?.label ?? "item"
            const back = () => {
              setItemDraft(null)
              if (!editing) setItemPickOpen(true)
            }
            return (
              <div
                role="dialog"
                aria-modal="true"
                aria-label={editing ? "Edit item" : "Add item"}
                className="absolute inset-0 z-50 flex flex-col bg-paper"
              >
                <div className="flex h-12 shrink-0 items-center gap-3 bg-head px-3 text-white shadow-md @3xl:px-6">
                  <button
                    onClick={back}
                    aria-label={
                      editing ? "Close item editor" : "Back to item types"
                    }
                    className="grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-white/20"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      aria-hidden
                    >
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  </button>
                  <div>
                    <div className="text-base font-semibold leading-tight">
                      {editing ? "Edit" : "Add"} {typeLabel.toLowerCase()}
                    </div>
                    <div className="text-[10px] text-white/75">
                      All names and statistics are entered by you.
                    </div>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-3 @3xl:p-6">
                  <div className="mx-auto max-w-lg">
                    <ItemEditor item={itemDraft} onChange={setItemDraft} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 border-t border-rule p-3">
                  <Btn tone="plain" onClick={back}>
                    {editing ? "Cancel" : "Back"}
                  </Btn>
                  <Btn tone="green" onClick={saveInventoryItem}>
                    Save item
                  </Btn>
                </div>
              </div>
            )
          })()}
        {coinDraft && (
          <div
            className="absolute inset-0 z-50 grid place-items-center bg-black/50 p-4"
            onMouseDown={() => setCoinDraft(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Add coin"
              onMouseDown={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-xl border border-rule bg-card p-3 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Add coin</div>
                <button
                  onClick={() => setCoinDraft(null)}
                  aria-label="Close"
                  className="grid h-8 w-8 place-items-center rounded-full text-xl text-muted hover:bg-accent-soft hover:text-ink"
                >
                  ×
                </button>
              </div>
              <p className="text-[11px] text-muted">
                Enter amounts, then Add or Remove from the purse.
              </p>
              <div className="mt-2 grid grid-cols-5 gap-1.5">
                {(Object.keys(coinDraft) as (keyof Sheet["coins"])[]).map((c) => (
                  <Stat key={c} label={c}>
                    <IntInput
                      value={coinDraft[c]}
                      min={0}
                      onChange={(n) => setCoinDraft({ ...coinDraft, [c]: n })}
                      className="w-full text-center font-mono text-base"
                    />
                  </Stat>
                ))}
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Btn tone="red" onClick={() => applyCoins(-1)}>
                  Remove
                </Btn>
                <Btn tone="green" onClick={() => applyCoins(1)}>
                  Add
                </Btn>
              </div>
            </div>
          </div>
        )}
        {featureDraft &&
          (() => {
            const editing = s.traits.some(
              (feature) => feature.id === featureDraft.id,
            )
            const proficiencies =
              featureDraft.proficiencies ?? emptyFeatureProficiencies()
            const source = featureDraft.source ?? emptyFeatureSource()
            const effects = featureDraft.effects ?? emptyFeatureEffects()
            const setProficiencies = (patch: Partial<FeatureProficiencies>) =>
              setFeatureDraft({
                ...featureDraft,
                proficiencies: { ...proficiencies, ...patch },
              })
            const setSource = (patch: Partial<FeatureSource>) =>
              setFeatureDraft({
                ...featureDraft,
                source: { ...source, ...patch },
              })
            const setEffects = <K extends keyof FeatureEffects,>(
              key: K,
              patch: Partial<FeatureEffects[K]>,
            ) =>
              setFeatureDraft({
                ...featureDraft,
                effects: { ...effects, [key]: { ...effects[key], ...patch } },
              })
            const meta = featureDraft.meta ?? {}
            const setMeta = (patch: Record<string, string>) =>
              setFeatureDraft({ ...featureDraft, meta: { ...meta, ...patch } })
            const back = () => {
              setFeatureDraft(null)
              setFeatureGrantMenuOpen(false)
              if (contentDraftType) {
                setContentDraftType(null)
                setContentDraftId(null)
              }
            }
            return (
              <div
                role="dialog"
                aria-modal="true"
                aria-label={editing ? "Edit feature" : "Add feature"}
                className="absolute inset-0 z-50 flex flex-col bg-paper"
              >
                <div className="flex h-12 shrink-0 items-center gap-3 bg-head px-3 text-white shadow-md @3xl:px-6">
                  <button
                    onClick={back}
                    aria-label={
                      editing ? "Close feature editor" : "Back to feature types"
                    }
                    className="grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-white/20"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      aria-hidden
                    >
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  </button>
                  <div>
                    <div className="text-base font-semibold leading-tight">
                      {contentDraftType
                        ? CONTENT_BUILDERS.find(
                            (builder) => builder.type === contentDraftType,
                          )?.label
                        : `${
                            editing ? "Edit" : "Add"
                          } ${FEATURE_CATEGORIES.find((entry) => entry.value === featureDraft.category)?.label.toLowerCase()}`}
                    </div>
                    <div className="text-[10px] text-white/75">
                      {contentDraftType
                        ? "Reusable content stored in your local library"
                        : "Applied content from your library"}
                    </div>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-3 @3xl:p-6">
                  <div className="mx-auto max-w-lg space-y-4">
                    {featureDraft.category === "custom-class" && (
                      <div>
                        <Heading>Custom class structure</Heading>
                        <div className="grid grid-cols-[1fr_auto] gap-3 rounded-md border border-rule bg-card p-3">
                          <label className="block">
                            <span className="block text-[10px] text-muted">
                              Class name
                            </span>
                            <input
                              value={source.className}
                              onChange={(event) =>
                                setSource({ className: event.target.value })
                              }
                              placeholder="e.g. Warden"
                              className="w-full border-b border-rule pb-1 text-sm focus:border-accent"
                            />
                          </label>
                          <label className="block">
                            <span className="block text-[10px] text-muted">
                              Hit die
                            </span>
                            <select
                              value={source.hitDie}
                              onChange={(event) =>
                                setSource({
                                  hitDie: Number(event.target.value),
                                })
                              }
                              className="border-b border-rule pb-1 text-sm focus:border-accent"
                            >
                              {[6, 8, 10, 12].map((die) => (
                                <option key={die} value={die}>
                                  d{die}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    )}
                    {contentDraftType === "race" && (
                      <div>
                        <Heading>Race structure</Heading>
                        <div className="grid grid-cols-2 gap-3 rounded-md border border-rule bg-card p-3">
                          <label className="block">
                            <span className="block text-[10px] text-muted">
                              Size
                            </span>
                            <select
                              value={source.size}
                              onChange={(event) =>
                                setSource({
                                  size: event.target.value as CharacterSize,
                                })
                              }
                              className="w-full border-b border-rule pb-1 text-sm"
                            >
                              <option>Small</option>
                              <option>Medium</option>
                            </select>
                          </label>
                          <label className="block">
                            <span className="block text-[10px] text-muted">
                              Speed
                            </span>
                            <IntInput
                              value={source.speed}
                              min={0}
                              onChange={(speed) => setSource({ speed })}
                              className="w-full border-b border-rule pb-1 text-left"
                            />
                          </label>
                        </div>
                      </div>
                    )}
                    {(["racial", "feat"].includes(featureDraft.category) ||
                      contentDraftType === "background") && (
                      <div>
                        <Heading>Ability score increases</Heading>
                        <div className="grid grid-cols-6 gap-2 rounded-md border border-rule bg-card p-3">
                          {ABILITIES.map((a) => {
                            const bonus = parseAsi(meta.asi)
                            return (
                              <label key={a} className="block text-center">
                                <span className="block text-[10px] text-muted">
                                  {a}
                                </span>
                                <IntInput
                                  value={bonus[a] ?? 0}
                                  min={-4}
                                  onChange={(n) =>
                                    setMeta({
                                      asi: formatAsi({ ...bonus, [a]: n }),
                                    })
                                  }
                                  className="w-full border-b border-rule pb-1 text-center"
                                />
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    {contentDraftType === "subrace" && (
                      <div>
                        <Heading>Subrace structure</Heading>
                        <label className="block rounded-md border border-rule bg-card p-3">
                          <span className="block text-[10px] text-muted">
                            Parent race
                          </span>
                          <input
                            value={source.parentName}
                            onChange={(event) =>
                              setSource({ parentName: event.target.value })
                            }
                            placeholder="e.g. Elf"
                            className="w-full border-b border-rule pb-1 text-sm"
                          />
                        </label>
                      </div>
                    )}
                    {(featureDraft.category === "class" ||
                      featureDraft.category === "subclass") && (
                      <div>
                        <Heading>
                          {featureDraft.category === "subclass"
                            ? "Subclass source"
                            : "Class source"}
                        </Heading>
                        <div className="grid grid-cols-2 gap-3 rounded-md border border-rule bg-card p-3">
                          <label className="block">
                            <span className="block text-[10px] text-muted">
                              Required class
                            </span>
                            <input
                              value={source.className}
                              onChange={(event) =>
                                setSource({ className: event.target.value })
                              }
                              placeholder={s.cls}
                              className="w-full border-b border-rule pb-1 text-sm focus:border-accent"
                            />
                          </label>
                          <label className="block">
                            <span className="block text-[10px] text-muted">
                              Unlock level
                            </span>
                            <select
                              value={source.level}
                              onChange={(event) =>
                                setSource({ level: Number(event.target.value) })
                              }
                              className="w-full border-b border-rule pb-1 text-sm focus:border-accent"
                            >
                              {Array.from({ length: 20 }, (_, i) => i + 1).map(
                                (level) => (
                                  <option key={level} value={level}>
                                    {level}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>
                          {featureDraft.category === "subclass" && (
                            <label className="col-span-2 block">
                              <span className="block text-[10px] text-muted">
                                Subclass name
                              </span>
                              <input
                                value={source.subclassName}
                                onChange={(event) =>
                                  setSource({
                                    subclassName: event.target.value,
                                  })
                                }
                                placeholder="e.g. Path of the Storm"
                                className="w-full border-b border-rule pb-1 text-sm focus:border-accent"
                              />
                              {SUBCLASS_LEVELS[source.className || s.cls] && (
                                <span className="mt-1 block text-[10px] text-muted">
                                  Suggested levels:{" "}
                                  {SUBCLASS_LEVELS[
                                    source.className || s.cls
                                  ].join(", ")}
                                  . Any level remains allowed.
                                </span>
                              )}
                            </label>
                          )}
                        </div>
                      </div>
                    )}
                    {contentDraftType === "item" && (
                      <div>
                        <Heading>Item details</Heading>
                        <div className="grid grid-cols-2 gap-3 rounded-md border border-rule bg-card p-3">
                          <label className="col-span-2 block">
                            <span className="block text-[10px] text-muted">
                              Item type
                            </span>
                            <select
                              value={meta.itemCategory ?? "other"}
                              onChange={(event) =>
                                setMeta({ itemCategory: event.target.value })
                              }
                              className="w-full border-b border-rule pb-1 text-sm"
                            >
                              {ITEM_CATEGORIES.map((c) => (
                                <option key={c.value} value={c.value}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="block text-[10px] text-muted">
                              Quantity
                            </span>
                            <input
                              type="number"
                              min={1}
                              value={meta.quantity ?? "1"}
                              onChange={(event) =>
                                setMeta({ quantity: event.target.value })
                              }
                              className="w-full border-b border-rule pb-1 text-sm"
                            />
                          </label>
                          <label className="block">
                            <span className="block text-[10px] text-muted">
                              Weight (lb)
                            </span>
                            <input
                              type="number"
                              min={0}
                              value={meta.weight ?? "0"}
                              onChange={(event) =>
                                setMeta({ weight: event.target.value })
                              }
                              className="w-full border-b border-rule pb-1 text-sm"
                            />
                          </label>
                          <label className="col-span-2 block">
                            <span className="block text-[10px] text-muted">
                              Value (gp)
                            </span>
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={meta.value ?? "0"}
                              onChange={(event) =>
                                setMeta({ value: event.target.value })
                              }
                              className="w-full border-b border-rule pb-1 text-sm"
                            />
                          </label>
                          {meta.itemCategory === "weapon" && (
                            <>
                              <label className="block">
                                <span className="block text-[10px] text-muted">
                                  Weapon kind
                                </span>
                                <select
                                  value={meta.weaponKind ?? "melee"}
                                  onChange={(event) =>
                                    setMeta({ weaponKind: event.target.value })
                                  }
                                  className="w-full border-b border-rule pb-1 text-sm"
                                >
                                  <option value="melee">Melee</option>
                                  <option value="ranged">Ranged</option>
                                </select>
                              </label>
                              <label className="block">
                                <span className="block text-[10px] text-muted">
                                  Weapon group
                                </span>
                                <select
                                  value={meta.weaponClass ?? "simple"}
                                  onChange={(event) =>
                                    setMeta({ weaponClass: event.target.value })
                                  }
                                  className="w-full border-b border-rule pb-1 text-sm"
                                >
                                  <option value="simple">Simple</option>
                                  <option value="martial">Martial</option>
                                </select>
                              </label>
                              <label className="block">
                                <span className="block text-[10px] text-muted">
                                  Damage dice
                                </span>
                                <input
                                  value={meta.damageDice ?? ""}
                                  onChange={(event) =>
                                    setMeta({ damageDice: event.target.value })
                                  }
                                  placeholder="e.g. 1d8"
                                  className="w-full border-b border-rule pb-1 text-sm"
                                />
                              </label>
                              <label className="block">
                                <span className="block text-[10px] text-muted">
                                  Damage type
                                </span>
                                <input
                                  value={meta.damageType ?? ""}
                                  onChange={(event) =>
                                    setMeta({ damageType: event.target.value })
                                  }
                                  placeholder="e.g. slashing"
                                  className="w-full border-b border-rule pb-1 text-sm"
                                />
                              </label>
                            </>
                          )}
                          {meta.itemCategory === "armor" && (
                            <>
                              <label className="block">
                                <span className="block text-[10px] text-muted">
                                  Armor mode
                                </span>
                                <select
                                  value={meta.armorMode ?? "base"}
                                  onChange={(event) =>
                                    setMeta({ armorMode: event.target.value })
                                  }
                                  className="w-full border-b border-rule pb-1 text-sm"
                                >
                                  <option value="base">Base AC</option>
                                  <option value="bonus">
                                    AC bonus (shield)
                                  </option>
                                </select>
                              </label>
                              <label className="block">
                                <span className="block text-[10px] text-muted">
                                  {meta.armorMode === "bonus"
                                    ? "AC bonus"
                                    : "Base AC"}
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  value={meta.baseAc ?? "10"}
                                  onChange={(event) =>
                                    setMeta({ baseAc: event.target.value })
                                  }
                                  className="w-full border-b border-rule pb-1 text-sm"
                                />
                              </label>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    {contentDraftType === "spell" && (
                      <div>
                        <Heading>Spell details</Heading>
                        <div className="grid grid-cols-2 gap-3 rounded-md border border-rule bg-card p-3">
                          <label className="block">
                            <span className="block text-[10px] text-muted">
                              Level
                            </span>
                            <select
                              value={meta.level ?? "0"}
                              onChange={(event) =>
                                setMeta({ level: event.target.value })
                              }
                              className="w-full border-b border-rule pb-1 text-sm"
                            >
                              {Array.from({ length: 10 }, (_, i) => (
                                <option key={i} value={String(i)}>
                                  {i === 0 ? "Cantrip" : `Level ${i}`}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="block text-[10px] text-muted">
                              School
                            </span>
                            <select
                              value={meta.school ?? "Evocation"}
                              onChange={(event) =>
                                setMeta({ school: event.target.value })
                              }
                              className="w-full border-b border-rule pb-1 text-sm"
                            >
                              {[
                                "Abjuration",
                                "Conjuration",
                                "Divination",
                                "Enchantment",
                                "Evocation",
                                "Illusion",
                                "Necromancy",
                                "Transmutation",
                              ].map((school) => (
                                <option key={school}>{school}</option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="block text-[10px] text-muted">
                              Casting time
                            </span>
                            <input
                              value={meta.castingTime ?? ""}
                              onChange={(event) =>
                                setMeta({ castingTime: event.target.value })
                              }
                              placeholder="1 action"
                              className="w-full border-b border-rule pb-1 text-sm"
                            />
                          </label>
                          <label className="block">
                            <span className="block text-[10px] text-muted">
                              Range
                            </span>
                            <input
                              value={meta.range ?? ""}
                              onChange={(event) =>
                                setMeta({ range: event.target.value })
                              }
                              placeholder="60 feet"
                              className="w-full border-b border-rule pb-1 text-sm"
                            />
                          </label>
                          <label className="block">
                            <span className="block text-[10px] text-muted">
                              Components
                            </span>
                            <input
                              value={meta.components ?? ""}
                              onChange={(event) =>
                                setMeta({ components: event.target.value })
                              }
                              placeholder="V, S, M"
                              className="w-full border-b border-rule pb-1 text-sm"
                            />
                          </label>
                          <label className="block">
                            <span className="block text-[10px] text-muted">
                              Duration
                            </span>
                            <input
                              value={meta.duration ?? ""}
                              onChange={(event) =>
                                setMeta({ duration: event.target.value })
                              }
                              placeholder="Instantaneous"
                              className="w-full border-b border-rule pb-1 text-sm"
                            />
                          </label>
                          <label className="col-span-2 block">
                            <span className="block text-[10px] text-muted">
                              Class lists
                            </span>
                            <input
                              value={meta.classes ?? ""}
                              onChange={(event) =>
                                setMeta({ classes: event.target.value })
                              }
                              placeholder="Wizard,Sorcerer or leave blank for custom sources"
                              className="w-full border-b border-rule pb-1 text-sm"
                            />
                          </label>
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={meta.concentration === "true"}
                              onChange={(event) =>
                                setMeta({
                                  concentration: String(event.target.checked),
                                })
                              }
                            />
                            Concentration
                          </label>
                          <label className="block">
                            <span className="block text-[10px] text-muted">
                              Save ability
                            </span>
                            <select
                              value={meta.saveAbility ?? ""}
                              onChange={(event) =>
                                setMeta({ saveAbility: event.target.value })
                              }
                              className="w-full border-b border-rule pb-1 text-sm"
                            >
                              <option value="">None</option>
                              {ABILITIES.map((ability) => (
                                <option key={ability}>{ability}</option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="block text-[10px] text-muted">
                              Damage formula
                            </span>
                            <input
                              value={meta.damageFormula ?? ""}
                              onChange={(event) =>
                                setMeta({ damageFormula: event.target.value })
                              }
                              placeholder="e.g. 8d6"
                              className="w-full border-b border-rule pb-1 text-sm"
                            />
                          </label>
                          <label className="block">
                            <span className="block text-[10px] text-muted">
                              Healing formula
                            </span>
                            <input
                              value={meta.healingFormula ?? ""}
                              onChange={(event) =>
                                setMeta({ healingFormula: event.target.value })
                              }
                              placeholder="e.g. 1d8 + MOD"
                              className="w-full border-b border-rule pb-1 text-sm"
                            />
                          </label>
                          <label className="block">
                            <span className="block text-[10px] text-muted">
                              Damage type
                            </span>
                            <input
                              value={meta.damageType ?? ""}
                              onChange={(event) =>
                                setMeta({ damageType: event.target.value })
                              }
                              className="w-full border-b border-rule pb-1 text-sm"
                            />
                          </label>
                          <label className="block">
                            <span className="block text-[10px] text-muted">
                              Upcast dice per level
                            </span>
                            <input
                              value={meta.upcastDice ?? ""}
                              onChange={(event) =>
                                setMeta({ upcastDice: event.target.value })
                              }
                              placeholder="e.g. 1d6"
                              className="w-full border-b border-rule pb-1 text-sm"
                            />
                          </label>
                          <label className="block">
                            <span className="block text-[10px] text-muted">
                              Upcast flat bonus per level
                            </span>
                            <input
                              type="number"
                              value={meta.upcastFlat ?? "0"}
                              onChange={(event) =>
                                setMeta({ upcastFlat: event.target.value })
                              }
                              className="w-full border-b border-rule pb-1 text-sm"
                            />
                          </label>
                        </div>
                      </div>
                    )}
                    {contentDraftType === "selection" && (
                      <div>
                        <Heading>Selection options</Heading>
                        <div className="space-y-3 rounded-md border border-rule bg-card p-3">
                          <label className="block">
                            <span className="block text-[10px] text-muted">
                              Number of choices
                            </span>
                            <input
                              type="number"
                              min={1}
                              value={meta.pick ?? "1"}
                              onChange={(event) =>
                                setMeta({ pick: event.target.value })
                              }
                              className="w-24 border-b border-rule pb-1 text-sm"
                            />
                          </label>
                          <label className="block">
                            <span className="block text-[10px] text-muted">
                              Options (one per line)
                            </span>
                            <textarea
                              value={meta.options ?? ""}
                              rows={5}
                              onChange={(event) =>
                                setMeta({ options: event.target.value })
                              }
                              className="w-full resize-y rounded border border-rule p-2 text-sm"
                            />
                          </label>
                        </div>
                      </div>
                    )}
                    {contentDraftType === "invocation" && (
                      <div>
                        <Heading>Invocation prerequisite</Heading>
                        <label className="block rounded-md border border-rule bg-card p-3">
                          <span className="block text-[10px] text-muted">
                            Prerequisite (optional)
                          </span>
                          <input
                            value={meta.prerequisite ?? ""}
                            onChange={(event) =>
                              setMeta({ prerequisite: event.target.value })
                            }
                            placeholder="e.g. Requires 5th level and Pact of the Blade"
                            className="w-full border-b border-rule pb-1 text-sm"
                          />
                        </label>
                      </div>
                    )}
                    <label className="block">
                      <span className="block text-[10px] text-muted">
                        {featureDraft.category === "custom-class"
                          ? "Class foundation trait name (optional)"
                          : featureDraft.category === "subclass"
                            ? "Primary feature name (optional)"
                            : "Content name"}
                      </span>
                      <input
                        autoFocus
                        value={featureDraft.name}
                        onChange={(event) =>
                          setFeatureDraft({
                            ...featureDraft,
                            name: event.target.value,
                          })
                        }
                        placeholder="e.g. Weapon Training"
                        className="w-full border-b border-rule pb-1 text-sm focus:border-accent"
                      />
                    </label>
                    <label className="block">
                      <span className="block text-[10px] text-muted">
                        Description / rules
                      </span>
                      <textarea
                        value={featureDraft.description}
                        rows={6}
                        onChange={(event) =>
                          setFeatureDraft({
                            ...featureDraft,
                            description: event.target.value,
                          })
                        }
                        className="w-full resize-y rounded-md border border-rule bg-card p-2 text-sm leading-relaxed focus:border-accent"
                      />
                    </label>
                    {
                      <div>
                        <Heading>Granted by this trait</Heading>
                        <div className="space-y-2">
                          {proficiencies.sections.includes("saves") && (
                            <div className="rounded-md border border-rule bg-card p-3">
                              <div className="mb-2 flex items-center justify-between">
                                <Label>Saving throws</Label>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setProficiencies({
                                      sections: proficiencies.sections.filter(
                                        (section) => section !== "saves",
                                      ),
                                      saves: [],
                                    })
                                  }
                                  className="text-[11px] text-muted hover:text-danger"
                                >
                                  Remove
                                </button>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                {ABILITIES.map((ability) => {
                                  const on =
                                    proficiencies.saves.includes(ability)
                                  return (
                                    <button
                                      key={ability}
                                      type="button"
                                      aria-pressed={on}
                                      onClick={() =>
                                        setProficiencies({
                                          saves: on
                                            ? proficiencies.saves.filter(
                                                (entry) => entry !== ability,
                                              )
                                            : [...proficiencies.saves, ability],
                                        })
                                      }
                                      className="flex items-center gap-2 text-sm"
                                    >
                                      <span
                                        className={`grid h-4 w-4 place-items-center rounded-full border ${
                                          on
                                            ? "border-accent"
                                            : "border-muted bg-muted/40"
                                        }`}
                                      >
                                        {on && (
                                          <span className="h-2 w-2 rounded-full bg-accent" />
                                        )}
                                      </span>
                                      {ability}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                          {proficiencies.sections.includes("skills") && (
                            <div className="rounded-md border border-rule bg-card p-3">
                              <div className="mb-2 flex items-center justify-between">
                                <Label>Skills</Label>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setProficiencies({
                                      sections: proficiencies.sections.filter(
                                        (section) => section !== "skills",
                                      ),
                                      skills: [],
                                      expertise: [],
                                      skillPick: 0,
                                      skillFrom: [],
                                      skillChosen: [],
                                    })
                                  }
                                  className="text-[11px] text-muted hover:text-danger"
                                >
                                  Remove
                                </button>
                              </div>
                              <p className="mb-1 text-[11px] text-muted">
                                Tap to cycle: none → proficient → expertise.
                              </p>
                              <div className="grid grid-cols-2 gap-x-3">
                                {ALL_SKILLS.map((skill) => {
                                  const level =
                                    proficiencies.expertise.includes(skill)
                                      ? 2
                                      : proficiencies.skills.includes(skill)
                                        ? 1
                                        : 0
                                  const setLevel = () =>
                                    setProficiencies(
                                      level === 0
                                        ? {
                                            skills: [
                                              ...proficiencies.skills,
                                              skill,
                                            ],
                                          }
                                        : level === 1
                                          ? {
                                              skills:
                                                proficiencies.skills.filter(
                                                  (entry) => entry !== skill,
                                                ),
                                              expertise: [
                                                ...proficiencies.expertise,
                                                skill,
                                              ],
                                            }
                                          : {
                                              expertise:
                                                proficiencies.expertise.filter(
                                                  (entry) => entry !== skill,
                                                ),
                                            },
                                    )
                                  return (
                                    <button
                                      key={skill}
                                      type="button"
                                      onClick={setLevel}
                                      className="flex min-w-0 items-center gap-2 border-b border-rule/60 py-1 text-left"
                                    >
                                      <span
                                        className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                                          level === 2
                                            ? "border-pink"
                                            : level === 1
                                              ? "border-accent"
                                              : "border-accent"
                                        }`}
                                      >
                                        {level > 0 && (
                                          <span
                                            className={`h-2 w-2 rounded-full ${
                                              level === 2
                                                ? "bg-pink"
                                                : "bg-accent"
                                            }`}
                                          />
                                        )}
                                      </span>
                                      <span className="truncate text-xs">
                                        {skill}
                                      </span>
                                    </button>
                                  )
                                })}
                              </div>
                              <div className="mt-3 border-t border-rule pt-2">
                                <Label>Skill choices</Label>
                                <label className="mt-1 flex items-center justify-between gap-3 text-[11px] text-muted">
                                  Skills the player chooses
                                  <IntInput
                                    value={proficiencies.skillPick}
                                    min={0}
                                    onChange={(n) =>
                                      setProficiencies({
                                        skillPick: clamp(n, 0, 6),
                                      })
                                    }
                                    className="w-12 border-b border-rule pb-1 text-center"
                                  />
                                </label>
                                <p className="mt-2 mb-1 text-[11px] text-muted">
                                  Skills they can choose from (none selected =
                                  any skill).
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {ALL_SKILLS.map((skill) => {
                                    const on =
                                      proficiencies.skillFrom.includes(skill)
                                    return (
                                      <button
                                        key={skill}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() =>
                                          setProficiencies({
                                            skillFrom: on
                                              ? proficiencies.skillFrom.filter(
                                                  (n) => n !== skill,
                                                )
                                              : [
                                                  ...proficiencies.skillFrom,
                                                  skill,
                                                ],
                                          })
                                        }
                                        className={`rounded-full border px-2 py-0.5 text-[11px] ${
                                          on
                                            ? "border-accent bg-accent-soft text-accent"
                                            : "border-rule text-muted"
                                        }`}
                                      >
                                        {skill}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                          {proficiencies.sections.includes("training") && (
                            <div className="space-y-3 rounded-md border border-rule bg-card p-3">
                              <div className="flex items-center justify-between">
                                <Label>Proficiencies &amp; training</Label>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setProficiencies({
                                      sections: proficiencies.sections.filter(
                                        (section) => section !== "training",
                                      ),
                                      armor: [],
                                      weapons: [],
                                      specificWeapons: "",
                                      tools: "",
                                      languages: "",
                                    })
                                  }
                                  className="text-[11px] text-muted hover:text-danger"
                                >
                                  Remove
                                </button>
                              </div>
                              <div>
                                <Label>Armor</Label>
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                  {["Light", "Medium", "Heavy", "Shields"].map(
                                    (armor) => {
                                      const on =
                                        proficiencies.armor.includes(armor)
                                      return (
                                        <button
                                          key={armor}
                                          type="button"
                                          aria-pressed={on}
                                          onClick={() =>
                                            setProficiencies({
                                              armor: on
                                                ? proficiencies.armor.filter(
                                                    (entry) => entry !== armor,
                                                  )
                                                : [
                                                    ...proficiencies.armor,
                                                    armor,
                                                  ],
                                            })
                                          }
                                          className={`rounded-full border px-2.5 py-1 text-[11px] ${
                                            on
                                              ? "border-accent bg-accent-soft text-accent"
                                              : "border-rule text-muted hover:border-accent"
                                          }`}
                                        >
                                          {armor}
                                        </button>
                                      )
                                    },
                                  )}
                                </div>
                              </div>
                              <div>
                                <Label>Weapon groups</Label>
                                <div className="mt-1 flex gap-1.5">
                                  {(["simple", "martial"] as WeaponClass[]).map(
                                    (group) => {
                                      const on =
                                        proficiencies.weapons.includes(group)
                                      return (
                                        <button
                                          key={group}
                                          type="button"
                                          aria-pressed={on}
                                          onClick={() =>
                                            setProficiencies({
                                              weapons: on
                                                ? proficiencies.weapons.filter(
                                                    (entry) => entry !== group,
                                                  )
                                                : [
                                                    ...proficiencies.weapons,
                                                    group,
                                                  ],
                                            })
                                          }
                                          className={`rounded-full border px-2.5 py-1 text-[11px] capitalize ${
                                            on
                                              ? "border-accent bg-accent-soft text-accent"
                                              : "border-rule text-muted hover:border-accent"
                                          }`}
                                        >
                                          {group} weapons
                                        </button>
                                      )
                                    },
                                  )}
                                </div>
                              </div>
                              <label className="block">
                                <span className="block text-[10px] text-muted">
                                  Other weapons
                                </span>
                                <input
                                  value={proficiencies.specificWeapons}
                                  onChange={(event) =>
                                    setProficiencies({
                                      specificWeapons: event.target.value,
                                    })
                                  }
                                  placeholder="e.g. Sickle, Longsword"
                                  className="w-full border-b border-rule pb-1 text-sm focus:border-accent"
                                />
                              </label>
                              <label className="block">
                                <span className="block text-[10px] text-muted">
                                  Tools &amp; others
                                </span>
                                <input
                                  value={proficiencies.tools}
                                  onChange={(event) =>
                                    setProficiencies({
                                      tools: event.target.value,
                                    })
                                  }
                                  placeholder="e.g. Thieves' tools, vehicles"
                                  className="w-full border-b border-rule pb-1 text-sm focus:border-accent"
                                />
                              </label>
                              <label className="block">
                                <span className="block text-[10px] text-muted">
                                  Languages
                                </span>
                                <input
                                  value={proficiencies.languages}
                                  onChange={(event) =>
                                    setProficiencies({
                                      languages: event.target.value,
                                    })
                                  }
                                  placeholder="e.g. Common, Elvish"
                                  className="w-full border-b border-rule pb-1 text-sm focus:border-accent"
                                />
                              </label>
                            </div>
                          )}
                          {proficiencies.sections.includes("resource") && (
                            <div className="space-y-3 rounded-md border border-rule bg-card p-3">
                              <div className="flex items-center justify-between">
                                <Label>Resource / uses</Label>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setProficiencies({
                                      sections: proficiencies.sections.filter(
                                        (section) => section !== "resource",
                                      ),
                                    })
                                  }
                                  className="text-[11px] text-muted hover:text-danger"
                                >
                                  Remove
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <label className="block">
                                  <span className="block text-[10px] text-muted">
                                    Maximum uses
                                  </span>
                                  <select
                                    value={effects.resource.maxMode}
                                    onChange={(event) =>
                                      setEffects("resource", {
                                        maxMode: event.target
                                          .value as FeatureEffects["resource"]["maxMode"],
                                      })
                                    }
                                    className="w-full border-b border-rule pb-1 text-sm"
                                  >
                                    <option value="fixed">Fixed number</option>
                                    <option value="pb">
                                      Proficiency bonus
                                    </option>
                                    <option value="ability">
                                      Ability modifier
                                    </option>
                                    <option value="level">
                                      Character level
                                    </option>
                                    <option value="custom">
                                      Custom / manual
                                    </option>
                                  </select>
                                </label>
                                <label className="block">
                                  <span className="block text-[10px] text-muted">
                                    Recharge
                                  </span>
                                  <select
                                    value={effects.resource.recharge}
                                    onChange={(event) =>
                                      setEffects("resource", {
                                        recharge: event.target
                                          .value as Recharge,
                                      })
                                    }
                                    className="w-full border-b border-rule pb-1 text-sm"
                                  >
                                    <option value="short">
                                      Short or long rest
                                    </option>
                                    <option value="long">Long rest</option>
                                    <option value="dawn">Dawn</option>
                                    <option value="manual">Manual</option>
                                  </select>
                                </label>
                                {effects.resource.maxMode === "fixed" && (
                                  <label className="block">
                                    <span className="block text-[10px] text-muted">
                                      Uses
                                    </span>
                                    <IntInput
                                      value={effects.resource.max}
                                      min={0}
                                      onChange={(max) =>
                                        setEffects("resource", { max })
                                      }
                                      className="w-full border-b border-rule pb-1 text-left"
                                    />
                                  </label>
                                )}
                                {effects.resource.maxMode === "ability" && (
                                  <label className="block">
                                    <span className="block text-[10px] text-muted">
                                      Ability
                                    </span>
                                    <select
                                      value={effects.resource.ability}
                                      onChange={(event) =>
                                        setEffects("resource", {
                                          ability: event.target.value as Ab,
                                        })
                                      }
                                      className="w-full border-b border-rule pb-1 text-sm"
                                    >
                                      {ABILITIES.map((ability) => (
                                        <option key={ability}>{ability}</option>
                                      ))}
                                    </select>
                                  </label>
                                )}
                                {effects.resource.maxMode === "custom" && (
                                  <label className="col-span-2 block">
                                    <span className="block text-[10px] text-muted">
                                      Custom rule
                                    </span>
                                    <input
                                      value={effects.resource.custom}
                                      onChange={(event) =>
                                        setEffects("resource", {
                                          custom: event.target.value,
                                        })
                                      }
                                      placeholder="e.g. PB, level / 2, WIS + 1"
                                      className="w-full border-b border-rule pb-1 text-sm"
                                    />
                                  </label>
                                )}
                                <label className="flex items-center gap-2 text-xs">
                                  <input
                                    type="checkbox"
                                    checked={effects.resource.unlimited}
                                    onChange={(event) =>
                                      setEffects("resource", {
                                        unlimited: event.target.checked,
                                      })
                                    }
                                  />
                                  Unlimited uses
                                </label>
                                <label className="block">
                                  <span className="block text-[10px] text-muted">
                                    Cost per activation
                                  </span>
                                  <IntInput
                                    value={effects.resource.cost}
                                    min={0}
                                    onChange={(cost) =>
                                      setEffects("resource", { cost })
                                    }
                                    className="w-full border-b border-rule pb-1 text-left"
                                  />
                                </label>
                                <label className="block">
                                  <span className="block text-[10px] text-muted">
                                    Shared pool key
                                  </span>
                                  <input
                                    value={effects.resource.pool}
                                    onChange={(event) =>
                                      setEffects("resource", {
                                        pool: event.target.value,
                                      })
                                    }
                                    placeholder="Blank = individual"
                                    className="w-full border-b border-rule pb-1 text-sm"
                                  />
                                </label>
                                <label className="block">
                                  <span className="block text-[10px] text-muted">
                                    Recharge amount
                                  </span>
                                  <select
                                    value={effects.resource.rechargeAmount}
                                    onChange={(event) =>
                                      setEffects("resource", {
                                        rechargeAmount: event.target
                                          .value as RechargeAmount,
                                      })
                                    }
                                    className="w-full border-b border-rule pb-1 text-sm"
                                  >
                                    <option value="all">All uses</option>
                                    <option value="one">One use</option>
                                    <option value="fixed">Fixed amount</option>
                                    <option value="custom">Formula</option>
                                  </select>
                                </label>
                                {effects.resource.rechargeAmount ===
                                  "fixed" && (
                                  <label className="block">
                                    <span className="block text-[10px] text-muted">
                                      Uses restored
                                    </span>
                                    <IntInput
                                      value={effects.resource.rechargeValue}
                                      min={0}
                                      onChange={(rechargeValue) =>
                                        setEffects("resource", {
                                          rechargeValue,
                                        })
                                      }
                                      className="w-full border-b border-rule pb-1 text-left"
                                    />
                                  </label>
                                )}
                                {effects.resource.rechargeAmount ===
                                  "custom" && (
                                  <label className="col-span-2 block">
                                    <span className="block text-[10px] text-muted">
                                      Recharge formula
                                    </span>
                                    <input
                                      value={effects.resource.rechargeCustom}
                                      onChange={(event) =>
                                        setEffects("resource", {
                                          rechargeCustom: event.target.value,
                                        })
                                      }
                                      placeholder="e.g. PB, level / 2, WIS"
                                      className="w-full border-b border-rule pb-1 text-sm"
                                    />
                                  </label>
                                )}
                              </div>
                            </div>
                          )}
                          {proficiencies.sections.includes("modifier") && (
                            <div className="space-y-3 rounded-md border border-rule bg-card p-3">
                              <div className="flex items-center justify-between">
                                <Label>Ability modifier</Label>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setProficiencies({
                                      sections: proficiencies.sections.filter(
                                        (section) => section !== "modifier",
                                      ),
                                    })
                                  }
                                  className="text-[11px] text-muted hover:text-danger"
                                >
                                  Remove
                                </button>
                              </div>
                              <div className="grid grid-cols-[1fr_auto] gap-3">
                                <label className="block">
                                  <span className="block text-[10px] text-muted">
                                    Target
                                  </span>
                                  <select
                                    value={effects.modifier.target}
                                    onChange={(event) =>
                                      setEffects("modifier", {
                                        target: event.target.value,
                                      })
                                    }
                                    className="w-full border-b border-rule pb-1 text-sm"
                                  >
                                    {[
                                      "Initiative",
                                      "Armor Class",
                                      "Speed",
                                      "Maximum HP",
                                      "Passive Perception",
                                      "Spell save DC",
                                      "Spell attack",
                                      "Custom",
                                    ].map((target) => (
                                      <option key={target}>{target}</option>
                                    ))}
                                  </select>
                                </label>
                                <label className="block">
                                  <span className="block text-[10px] text-muted">
                                    Value
                                  </span>
                                  <IntInput
                                    value={effects.modifier.value}
                                    onChange={(value) =>
                                      setEffects("modifier", { value })
                                    }
                                    className="w-16 border-b border-rule pb-1"
                                  />
                                </label>
                                <label className="col-span-2 block">
                                  <span className="block text-[10px] text-muted">
                                    Condition / note
                                  </span>
                                  <input
                                    value={effects.modifier.condition}
                                    onChange={(event) =>
                                      setEffects("modifier", {
                                        condition: event.target.value,
                                      })
                                    }
                                    className="w-full border-b border-rule pb-1 text-sm"
                                  />
                                </label>
                              </div>
                            </div>
                          )}
                          {proficiencies.sections.includes("defense") && (
                            <div className="space-y-2 rounded-md border border-rule bg-card p-3">
                              <div className="flex items-center justify-between">
                                <Label>Defense</Label>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setProficiencies({
                                      sections: proficiencies.sections.filter(
                                        (section) => section !== "defense",
                                      ),
                                    })
                                  }
                                  className="text-[11px] text-muted hover:text-danger"
                                >
                                  Remove
                                </button>
                              </div>
                              <label className="block">
                                <span className="block text-[10px] text-muted">
                                  Damage resistances
                                </span>
                                <input
                                  value={effects.defense.resistances}
                                  onChange={(event) =>
                                    setEffects("defense", {
                                      resistances: event.target.value,
                                    })
                                  }
                                  className="w-full border-b border-rule pb-1 text-sm"
                                />
                              </label>
                              <label className="block">
                                <span className="block text-[10px] text-muted">
                                  Damage immunities
                                </span>
                                <input
                                  value={effects.defense.immunities}
                                  onChange={(event) =>
                                    setEffects("defense", {
                                      immunities: event.target.value,
                                    })
                                  }
                                  className="w-full border-b border-rule pb-1 text-sm"
                                />
                              </label>
                              <label className="block">
                                <span className="block text-[10px] text-muted">
                                  Condition immunities
                                </span>
                                <input
                                  value={effects.defense.conditionImmunities}
                                  onChange={(event) =>
                                    setEffects("defense", {
                                      conditionImmunities: event.target.value,
                                    })
                                  }
                                  className="w-full border-b border-rule pb-1 text-sm"
                                />
                              </label>
                              <label className="block">
                                <span className="block text-[10px] text-muted">
                                  Notes
                                </span>
                                <input
                                  value={effects.defense.notes}
                                  onChange={(event) =>
                                    setEffects("defense", {
                                      notes: event.target.value,
                                    })
                                  }
                                  className="w-full border-b border-rule pb-1 text-sm"
                                />
                              </label>
                            </div>
                          )}
                          {proficiencies.sections.includes("movement") && (
                            <div className="space-y-3 rounded-md border border-rule bg-card p-3">
                              <div className="flex items-center justify-between">
                                <Label>Movement &amp; senses</Label>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setProficiencies({
                                      sections: proficiencies.sections.filter(
                                        (section) => section !== "movement",
                                      ),
                                    })
                                  }
                                  className="text-[11px] text-muted hover:text-danger"
                                >
                                  Remove
                                </button>
                              </div>
                              <div className="grid grid-cols-[1fr_auto] gap-3">
                                <label className="block">
                                  <span className="block text-[10px] text-muted">
                                    Movement mode
                                  </span>
                                  <select
                                    value={effects.movement.mode}
                                    onChange={(event) =>
                                      setEffects("movement", {
                                        mode: event.target.value,
                                      })
                                    }
                                    className="w-full border-b border-rule pb-1 text-sm"
                                  >
                                    {[
                                      "Walking speed",
                                      "Climbing speed",
                                      "Flying speed",
                                      "Swimming speed",
                                      "Burrowing speed",
                                      "Custom",
                                    ].map((mode) => (
                                      <option key={mode}>{mode}</option>
                                    ))}
                                  </select>
                                </label>
                                <label className="block">
                                  <span className="block text-[10px] text-muted">
                                    Distance
                                  </span>
                                  <IntInput
                                    value={effects.movement.distance}
                                    min={0}
                                    onChange={(distance) =>
                                      setEffects("movement", { distance })
                                    }
                                    className="w-16 border-b border-rule pb-1"
                                  />
                                </label>
                                <label className="col-span-2 block">
                                  <span className="block text-[10px] text-muted">
                                    Senses
                                  </span>
                                  <input
                                    value={effects.movement.senses}
                                    onChange={(event) =>
                                      setEffects("movement", {
                                        senses: event.target.value,
                                      })
                                    }
                                    placeholder="e.g. Darkvision 60 ft."
                                    className="w-full border-b border-rule pb-1 text-sm"
                                  />
                                </label>
                              </div>
                            </div>
                          )}
                          {proficiencies.sections.includes("spellcasting") && (
                            <div className="space-y-3 rounded-md border border-rule bg-card p-3">
                              <div className="flex items-center justify-between">
                                <Label>Spellcasting</Label>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setProficiencies({
                                      sections: proficiencies.sections.filter(
                                        (section) => section !== "spellcasting",
                                      ),
                                    })
                                  }
                                  className="text-[11px] text-muted hover:text-danger"
                                >
                                  Remove
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <label className="block">
                                  <span className="block text-[10px] text-muted">
                                    Spellcasting ability
                                  </span>
                                  <select
                                    value={effects.spellcasting.ability}
                                    onChange={(event) =>
                                      setEffects("spellcasting", {
                                        ability: event.target.value as Ab | "",
                                      })
                                    }
                                    className="w-full border-b border-rule pb-1 text-sm"
                                  >
                                    <option value="">None</option>
                                    {ABILITIES.map((ability) => (
                                      <option key={ability}>{ability}</option>
                                    ))}
                                  </select>
                                </label>
                                <label className="block">
                                  <span className="block text-[10px] text-muted">
                                    Progression
                                  </span>
                                  <select
                                    value={effects.spellcasting.progression}
                                    onChange={(event) =>
                                      setEffects("spellcasting", {
                                        progression: event.target
                                          .value as FeatureEffects["spellcasting"]["progression"],
                                      })
                                    }
                                    className="w-full border-b border-rule pb-1 text-sm"
                                  >
                                    <option value="full">Full caster</option>
                                    <option value="half">Half caster</option>
                                    <option value="third">Third caster</option>
                                    <option value="pact">Pact Magic</option>
                                    <option value="custom">
                                      Custom / manual
                                    </option>
                                  </select>
                                </label>
                                <label className="col-span-2 block">
                                  <span className="block text-[10px] text-muted">
                                    Spell source / list
                                  </span>
                                  <input
                                    value={effects.spellcasting.spellList}
                                    onChange={(event) =>
                                      setEffects("spellcasting", {
                                        spellList: event.target.value,
                                      })
                                    }
                                    className="w-full border-b border-rule pb-1 text-sm"
                                  />
                                </label>
                                <label className="col-span-2 block">
                                  <span className="block text-[10px] text-muted">
                                    Additional spells
                                  </span>
                                  <textarea
                                    value={
                                      effects.spellcasting.additionalSpells
                                    }
                                    onChange={(event) =>
                                      setEffects("spellcasting", {
                                        additionalSpells: event.target.value,
                                      })
                                    }
                                    rows={2}
                                    className="w-full rounded border border-rule p-2 text-sm"
                                  />
                                </label>
                                <label className="col-span-2 block">
                                  <span className="block text-[10px] text-muted">
                                    Notes
                                  </span>
                                  <input
                                    value={effects.spellcasting.notes}
                                    onChange={(event) =>
                                      setEffects("spellcasting", {
                                        notes: event.target.value,
                                      })
                                    }
                                    className="w-full border-b border-rule pb-1 text-sm"
                                  />
                                </label>
                              </div>
                            </div>
                          )}
                          {proficiencies.sections.includes("action") && (
                            <div className="space-y-3 rounded-md border border-rule bg-card p-3">
                              <div className="flex items-center justify-between">
                                <Label>Combat ability</Label>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setProficiencies({
                                      sections: proficiencies.sections.filter(
                                        (section) => section !== "action",
                                      ),
                                    })
                                  }
                                  className="text-[11px] text-muted hover:text-danger"
                                >
                                  Remove
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <label className="block">
                                  <span className="block text-[10px] text-muted">
                                    Action type
                                  </span>
                                  <select
                                    value={effects.action.actionType}
                                    onChange={(event) =>
                                      setEffects("action", {
                                        actionType: event.target.value,
                                      })
                                    }
                                    className="w-full border-b border-rule pb-1 text-sm"
                                  >
                                    {[
                                      "Action",
                                      "Bonus Action",
                                      "Reaction",
                                      "Passive",
                                      "Special",
                                    ].map((type) => (
                                      <option key={type}>{type}</option>
                                    ))}
                                  </select>
                                </label>
                                <label className="block">
                                  <span className="block text-[10px] text-muted">
                                    Attack type
                                  </span>
                                  <select
                                    value={effects.action.attackType}
                                    onChange={(event) =>
                                      setEffects("action", {
                                        attackType: event.target.value,
                                      })
                                    }
                                    className="w-full border-b border-rule pb-1 text-sm"
                                  >
                                    {[
                                      "None",
                                      "Melee",
                                      "Ranged",
                                      "Spell",
                                      "Saving throw",
                                    ].map((type) => (
                                      <option key={type}>{type}</option>
                                    ))}
                                  </select>
                                </label>
                                <label className="col-span-2 block">
                                  <span className="block text-[10px] text-muted">
                                    Reaction trigger / activation timing
                                  </span>
                                  <input
                                    value={effects.action.trigger}
                                    onChange={(event) =>
                                      setEffects("action", {
                                        trigger: event.target.value,
                                      })
                                    }
                                    placeholder="e.g. When an ally within 30 ft. is attacked"
                                    className="w-full border-b border-rule pb-1 text-sm"
                                  />
                                </label>
                                <label className="block">
                                  <span className="block text-[10px] text-muted">
                                    Target
                                  </span>
                                  <input
                                    value={effects.action.target}
                                    onChange={(event) =>
                                      setEffects("action", {
                                        target: event.target.value,
                                      })
                                    }
                                    placeholder="Self, creature, area"
                                    className="w-full border-b border-rule pb-1 text-sm"
                                  />
                                </label>
                                <label className="block">
                                  <span className="block text-[10px] text-muted">
                                    Duration
                                  </span>
                                  <input
                                    value={effects.action.duration}
                                    onChange={(event) =>
                                      setEffects("action", {
                                        duration: event.target.value,
                                      })
                                    }
                                    placeholder="1 minute, until manually ended"
                                    className="w-full border-b border-rule pb-1 text-sm"
                                  />
                                </label>
                                <label className="col-span-2 block">
                                  <span className="block text-[10px] text-muted">
                                    Activation requirements
                                  </span>
                                  <input
                                    value={effects.action.activationCondition}
                                    onChange={(event) =>
                                      setEffects("action", {
                                        activationCondition: event.target.value,
                                      })
                                    }
                                    placeholder="Shown before use; manual validation when needed"
                                    className="w-full border-b border-rule pb-1 text-sm"
                                  />
                                </label>
                                <label className="block">
                                  <span className="block text-[10px] text-muted">
                                    Effect ends on
                                  </span>
                                  <select
                                    value={effects.action.endOn}
                                    onChange={(event) =>
                                      setEffects("action", {
                                        endOn: event.target.value as Recharge,
                                      })
                                    }
                                    className="w-full border-b border-rule pb-1 text-sm"
                                  >
                                    <option value="manual">Manual</option>
                                    <option value="short">Short rest</option>
                                    <option value="long">Long rest</option>
                                    <option value="dawn">Dawn</option>
                                  </select>
                                </label>
                                <label className="block">
                                  <span className="block text-[10px] text-muted">
                                    Stacking
                                  </span>
                                  <select
                                    value={effects.action.stacking}
                                    onChange={(event) =>
                                      setEffects("action", {
                                        stacking: event.target
                                          .value as FeatureEffects["action"]["stacking"],
                                      })
                                    }
                                    className="w-full border-b border-rule pb-1 text-sm"
                                  >
                                    <option value="non-stacking">
                                      Do not stack
                                    </option>
                                    <option value="replace">
                                      Replace existing
                                    </option>
                                    <option value="refresh">
                                      Refresh duration
                                    </option>
                                    <option value="stack">Stack</option>
                                  </select>
                                </label>
                                <label className="block">
                                  <span className="block text-[10px] text-muted">
                                    Ability
                                  </span>
                                  <select
                                    value={effects.action.ability}
                                    onChange={(event) =>
                                      setEffects("action", {
                                        ability: event.target.value as Ab | "",
                                      })
                                    }
                                    className="w-full border-b border-rule pb-1 text-sm"
                                  >
                                    <option value="">None</option>
                                    {ABILITIES.map((ability) => (
                                      <option key={ability}>{ability}</option>
                                    ))}
                                  </select>
                                </label>
                                <label className="block">
                                  <span className="block text-[10px] text-muted">
                                    Range
                                  </span>
                                  <input
                                    value={effects.action.range}
                                    onChange={(event) =>
                                      setEffects("action", {
                                        range: event.target.value,
                                      })
                                    }
                                    className="w-full border-b border-rule pb-1 text-sm"
                                  />
                                </label>
                                <label className="block">
                                  <span className="block text-[10px] text-muted">
                                    Damage dice
                                  </span>
                                  <input
                                    value={effects.action.damageDice}
                                    onChange={(event) =>
                                      setEffects("action", {
                                        damageDice: event.target.value,
                                      })
                                    }
                                    placeholder="e.g. 2d6"
                                    className="w-full border-b border-rule pb-1 text-sm"
                                  />
                                </label>
                                <label className="block">
                                  <span className="block text-[10px] text-muted">
                                    Damage type
                                  </span>
                                  <input
                                    value={effects.action.damageType}
                                    onChange={(event) =>
                                      setEffects("action", {
                                        damageType: event.target.value,
                                      })
                                    }
                                    className="w-full border-b border-rule pb-1 text-sm"
                                  />
                                </label>
                                <label className="block">
                                  <span className="block text-[10px] text-muted">
                                    Save ability
                                  </span>
                                  <select
                                    value={effects.action.saveAbility}
                                    onChange={(event) =>
                                      setEffects("action", {
                                        saveAbility: event.target
                                          .value as Ab | "",
                                      })
                                    }
                                    className="w-full border-b border-rule pb-1 text-sm"
                                  >
                                    <option value="">None</option>
                                    {ABILITIES.map((ability) => (
                                      <option key={ability}>{ability}</option>
                                    ))}
                                  </select>
                                </label>
                                <label className="col-span-2 block">
                                  <span className="block text-[10px] text-muted">
                                    Rules
                                  </span>
                                  <textarea
                                    value={effects.action.notes}
                                    onChange={(event) =>
                                      setEffects("action", {
                                        notes: event.target.value,
                                      })
                                    }
                                    rows={2}
                                    className="w-full rounded border border-rule p-2 text-sm"
                                  />
                                </label>
                              </div>
                              <div className="border-t border-rule pt-3">
                                <div className="mb-2 flex items-center justify-between">
                                  <Label>Mechanical effects</Label>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const effect: CombatMechanicalEffect = {
                                        id: featureId(),
                                        type: "custom",
                                        value: 0,
                                        formula: "",
                                        detail: "",
                                        damageType: "",
                                        condition: "",
                                        temporary: false,
                                      }
                                      setFeatureDraft({
                                        ...featureDraft,
                                        effects: {
                                          ...effects,
                                          mechanical: [
                                            ...effects.mechanical,
                                            effect,
                                          ],
                                        },
                                      })
                                    }}
                                    className="text-xs font-semibold text-accent"
                                  >
                                    + Add effect
                                  </button>
                                </div>
                                <div className="space-y-2">
                                  {effects.mechanical.map((effect) => {
                                    const update = (
                                      patch: Partial<CombatMechanicalEffect>,
                                    ) =>
                                      setFeatureDraft({
                                        ...featureDraft,
                                        effects: {
                                          ...effects,
                                          mechanical: effects.mechanical.map(
                                            (entry) =>
                                              entry.id === effect.id
                                                ? { ...entry, ...patch }
                                                : entry,
                                          ),
                                        },
                                      })
                                    return (
                                      <div
                                        key={effect.id}
                                        className="grid grid-cols-2 gap-2 rounded border border-rule p-2"
                                      >
                                        <select
                                          value={effect.type}
                                          onChange={(event) =>
                                            update({
                                              type: event.target
                                                .value as CombatEffectType,
                                            })
                                          }
                                          className="border-b border-rule pb-1 text-xs"
                                        >
                                          {COMBAT_EFFECT_TYPES.map((type) => (
                                            <option key={type} value={type}>
                                              {type.replace(/-/g, " ")}
                                            </option>
                                          ))}
                                        </select>
                                        <input
                                          value={effect.detail}
                                          onChange={(event) =>
                                            update({
                                              detail: event.target.value,
                                            })
                                          }
                                          placeholder="Target/detail"
                                          className="border-b border-rule pb-1 text-xs"
                                        />
                                        <IntInput
                                          value={effect.value}
                                          onChange={(value) =>
                                            update({ value })
                                          }
                                          className="border-b border-rule pb-1 text-left"
                                        />
                                        <input
                                          value={effect.formula}
                                          onChange={(event) =>
                                            update({
                                              formula: event.target.value,
                                            })
                                          }
                                          placeholder="Formula: PB, level, WIS..."
                                          className="border-b border-rule pb-1 text-xs"
                                        />
                                        <input
                                          value={effect.damageType}
                                          onChange={(event) =>
                                            update({
                                              damageType: event.target.value,
                                            })
                                          }
                                          placeholder="Damage type"
                                          className="border-b border-rule pb-1 text-xs"
                                        />
                                        <input
                                          value={effect.condition}
                                          onChange={(event) =>
                                            update({
                                              condition: event.target.value,
                                            })
                                          }
                                          placeholder="Condition / instruction"
                                          className="border-b border-rule pb-1 text-xs"
                                        />
                                        <label className="flex items-center gap-2 text-[11px] text-muted">
                                          <input
                                            type="checkbox"
                                            checked={effect.temporary}
                                            onChange={(event) =>
                                              update({
                                                temporary: event.target.checked,
                                              })
                                            }
                                          />
                                          Track as active effect
                                        </label>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setFeatureDraft({
                                              ...featureDraft,
                                              effects: {
                                                ...effects,
                                                mechanical:
                                                  effects.mechanical.filter(
                                                    (entry) =>
                                                      entry.id !== effect.id,
                                                  ),
                                              },
                                            })
                                          }
                                          className="text-right text-[11px] text-danger"
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                          {proficiencies.sections.includes("custom") && (
                            <div className="space-y-2 rounded-md border border-rule bg-card p-3">
                              <div className="flex items-center justify-between">
                                <Label>Custom notes</Label>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setProficiencies({
                                      sections: proficiencies.sections.filter(
                                        (section) => section !== "custom",
                                      ),
                                    })
                                  }
                                  className="text-[11px] text-muted hover:text-danger"
                                >
                                  Remove
                                </button>
                              </div>
                              {effects.custom.map((entry, index) => (
                                <div
                                  key={entry.id}
                                  className="grid grid-cols-[1fr_auto] gap-2 rounded border border-rule p-2"
                                >
                                  <input
                                    value={entry.label}
                                    onChange={(event) => {
                                      const custom = effects.custom.map(
                                        (item, i) =>
                                          i === index
                                            ? {
                                                ...item,
                                                label: event.target.value,
                                              }
                                            : item,
                                      )
                                      setFeatureDraft({
                                        ...featureDraft,
                                        effects: { ...effects, custom },
                                      })
                                    }}
                                    placeholder="Section label"
                                    className="border-b border-rule pb-1 text-sm"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setFeatureDraft({
                                        ...featureDraft,
                                        effects: {
                                          ...effects,
                                          custom: effects.custom.filter(
                                            (_, i) => i !== index,
                                          ),
                                        },
                                      })
                                    }
                                    className="text-xs text-muted hover:text-danger"
                                  >
                                    Remove
                                  </button>
                                  <textarea
                                    value={entry.value}
                                    onChange={(event) => {
                                      const custom = effects.custom.map(
                                        (item, i) =>
                                          i === index
                                            ? {
                                                ...item,
                                                value: event.target.value,
                                              }
                                            : item,
                                      )
                                      setFeatureDraft({
                                        ...featureDraft,
                                        effects: { ...effects, custom },
                                      })
                                    }}
                                    rows={2}
                                    placeholder="Rules or value"
                                    className="col-span-2 rounded border border-rule p-2 text-sm"
                                  />
                                </div>
                              ))}
                              <button
                                type="button"
                                onClick={() =>
                                  setFeatureDraft({
                                    ...featureDraft,
                                    effects: {
                                      ...effects,
                                      custom: [
                                        ...effects.custom,
                                        {
                                          id: featureId(),
                                          label: "",
                                          value: "",
                                        },
                                      ],
                                    },
                                  })
                                }
                                className="rounded border border-accent px-2 py-1 text-xs text-accent"
                              >
                                + Add note
                              </button>
                            </div>
                          )}
                          <div>
                            <button
                              type="button"
                              onClick={() =>
                                setFeatureGrantMenuOpen((open) => !open)
                              }
                              className="rounded border border-accent px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent-soft"
                            >
                              + Add more
                            </button>
                            {featureGrantMenuOpen && (
                              <div className="mt-2 grid gap-1 rounded-md border border-rule bg-card p-2">
                                {([
                                  ["saves", "Saving throws"],
                                  ["skills", "Skills"],
                                  ["training", "Proficiencies & training"],
                                  ["resource", "Resource / uses"],
                                  ["modifier", "Ability modifier"],
                                  ["defense", "Defense"],
                                  ["movement", "Movement & senses"],
                                  ["spellcasting", "Spellcasting"],
                                  ["action", "Combat ability / action"],
                                  ["custom", "Custom notes"],
                                ] as [GrantSection, string][])
                                  .filter(
                                    ([section]) =>
                                      !proficiencies.sections.includes(section),
                                  )
                                  .map(([section, label]) => (
                                    <button
                                      key={section}
                                      type="button"
                                      onClick={() => {
                                        setProficiencies({
                                          sections: [
                                            ...proficiencies.sections,
                                            section,
                                          ],
                                        })
                                        setFeatureGrantMenuOpen(false)
                                      }}
                                      className="rounded px-2 py-1.5 text-left text-sm hover:bg-accent-soft"
                                    >
                                      {label}
                                    </button>
                                  ))}
                                {proficiencies.sections.length === 10 && (
                                  <p className="px-2 py-1 text-xs text-muted">
                                    All grant types have been added.
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    }
                  </div>
                </div>
                <div className="flex justify-end gap-2 border-t border-rule p-3">
                  <Btn tone="plain" onClick={back}>
                    {editing ? "Cancel" : "Back"}
                  </Btn>
                  <Btn tone="green" onClick={saveFeature}>
                    {contentDraftType ? "Save to library" : "Save feature"}
                  </Btn>
                </div>
              </div>
            )
          })()}
        {itemPickOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Choose item type"
            className="absolute inset-0 z-50 flex flex-col bg-paper"
          >
            <div className="flex h-12 shrink-0 items-center gap-3 bg-head px-3 text-white shadow-md @3xl:px-6">
              <button
                onClick={() => setItemPickOpen(false)}
                aria-label="Close item type menu"
                className="grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-white/20"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <div>
                <div className="text-base font-semibold leading-tight">
                  Add item
                </div>
                <div className="text-[10px] text-white/75">
                  Choose an item type
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 @3xl:p-6">
              <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-3">
                {ITEM_CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => {
                      setItemDraft(newInventoryItem(c.value))
                      setItemPickOpen(false)
                    }}
                    className="flex min-h-24 flex-col items-start justify-end rounded-lg border border-rule bg-card p-3 text-left transition-colors hover:border-accent hover:bg-accent-soft"
                  >
                    <span className="block text-base font-semibold text-ink">
                      {c.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-muted">
                      {ITEM_CATEGORY_HINTS[c.value]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {tabMenuOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Choose character sheet section"
            className="absolute inset-0 z-50 flex flex-col bg-paper"
          >
            <div className="flex h-12 shrink-0 items-center gap-3 bg-head px-3 text-white shadow-md @3xl:px-6">
              <button
                onClick={() => setTabMenuOpen(false)}
                aria-label="Close section menu"
                className="grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-white/20"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <div>
                <div className="text-base font-semibold leading-tight">
                  Character sheet
                </div>
                <div className="text-[10px] text-white/75">
                  Choose a section
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 @3xl:p-6">
              <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-3">
                {TABS.map(([value, label]) => {
                  const active = value === tab
                  return (
                    <button
                      key={value}
                      onClick={() => {
                        setTab(value)
                        setTabMenuOpen(false)
                      }}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-28 flex-col items-start justify-between rounded-lg border p-3 text-left transition-colors ${
                        active
                          ? "border-accent bg-accent-soft text-accent"
                          : "border-rule bg-card hover:border-accent hover:bg-accent-soft"
                      }`}
                    >
                      <SectionIcon tab={value} className="h-7 w-7" />
                      <span>
                        <span className="block text-base font-semibold text-ink">
                          {label}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-muted">
                          {TAB_DETAILS[value]}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Scroll body */}
        <div className="relative min-h-0 flex-1 overflow-y-auto">
          {/* Character */}
          <section className="px-3 pt-3 @3xl:px-6">
            <button
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="min-w-0">
                <span className="block truncate text-2xl font-medium leading-tight">
                  {s.name}
                </span>
                <span className="mt-0.5 block truncate text-sm font-medium text-ink">
                  Lv {s.level} · {[s.subclass, s.cls].filter(Boolean).join(" ")}
                </span>
                <span className="block truncate text-xs text-muted">
                  {s.size}, {s.creatureType}, {s.alignment}
                </span>
              </span>
              <svg
                viewBox="0 0 24 24"
                className={`h-5 w-5 shrink-0 text-muted transition-transform ${
                  open ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {open && (
              <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-2">
                <Field
                  label="Name"
                  v={s.name}
                  on={(v) => set("name", v)}
                  maxLength={NAME_MAX}
                />
                <label className="block border-b border-rule focus-within:border-accent">
                  <span className="block text-[10px] text-muted">Race</span>
                  <select
                    value=""
                    onChange={(event) => {
                      const entry = contentEntries.find(
                        (item) => item.id === event.target.value,
                      )
                      if (entry) applyContent(entry)
                    }}
                    className="w-full pb-0.5 text-sm"
                  >
                    <option value="">{s.race}</option>
                    {contentEntries
                      .filter((entry) => entry.type === "race")
                      .map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {contentName(entry)}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="block border-b border-rule focus-within:border-accent">
                  <span className="block text-[10px] text-muted">Subrace</span>
                  <select
                    value=""
                    disabled={subraceOptions.length === 0}
                    onChange={(event) => {
                      const entry = contentEntries.find(
                        (item) => item.id === event.target.value,
                      )
                      if (entry) applyContent(entry)
                    }}
                    className="w-full pb-0.5 text-sm disabled:opacity-50"
                  >
                    <option value="">{s.subrace}</option>
                    {subraceOptions.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {contentName(entry)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block border-b border-rule focus-within:border-accent">
                  <span className="block text-[10px] text-muted">
                    Background
                  </span>
                  <select
                    value=""
                    onChange={(event) => {
                      const entry = contentEntries.find(
                        (item) => item.id === event.target.value,
                      )
                      if (entry) applyContent(entry)
                    }}
                    className="w-full pb-0.5 text-sm"
                  >
                    <option value="">{s.background}</option>
                    {contentEntries
                      .filter((entry) => entry.type === "background")
                      .map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {contentName(entry)}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="block border-b border-rule focus-within:border-accent">
                  <span className="block text-[10px] text-muted">Class</span>
                  <select
                    value=""
                    onChange={(event) => {
                      const entry = contentEntries.find(
                        (item) => item.id === event.target.value,
                      )
                      if (entry) applyContent(entry)
                    }}
                    className="w-full pb-0.5 text-sm"
                  >
                    <option value="">{s.cls}</option>
                    {contentEntries
                      .filter((entry) => entry.type === "class")
                      .map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {contentName(entry)}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="block border-b border-rule focus-within:border-accent">
                  <span className="block text-[10px] text-muted">Subclass</span>
                  <select
                    value=""
                    onChange={(event) => {
                      const entry = contentEntries.find(
                        (item) => item.id === event.target.value,
                      )
                      if (entry) applyContent(entry)
                    }}
                    className="w-full pb-0.5 text-sm"
                  >
                    <option value="">{s.subclass}</option>
                    {contentEntries
                      .filter(
                        (entry) =>
                          entry.type === "subclass" &&
                          (!entry.feature.source?.className ||
                            entry.feature.source.className === s.cls),
                      )
                      .map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {contentName(entry)}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="border-b border-rule">
                  <span className="block text-[10px] text-muted">Level</span>
                  <div className="flex items-center gap-1 pb-0.5">
                    <button
                      onClick={() => setLevel(s.level - 1)}
                      disabled={s.level <= 1}
                      aria-label="Level down"
                      className="grid h-6 w-6 place-items-center rounded bg-pink text-onpink transition-[filter] hover:brightness-95 active:brightness-75 disabled:opacity-40"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        aria-hidden
                      >
                        <path d="M6 12h12" />
                      </svg>
                    </button>
                    <span className="w-8 text-center font-mono text-sm">
                      {s.level}
                    </span>
                    <button
                      onClick={() => setLevel(s.level + 1)}
                      disabled={s.level >= 20}
                      aria-label="Level up"
                      className="grid h-6 w-6 place-items-center rounded bg-pink text-onpink transition-[filter] hover:brightness-95 active:brightness-75 disabled:opacity-40"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        aria-hidden
                      >
                        <path d="M6 12h12M12 6v12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <label className="block border-b border-rule focus-within:border-accent">
                  <span className="block text-[10px] text-muted">
                    EXP
                    {s.level < 20
                      ? ` (next ${XP_THRESHOLDS[s.level].toLocaleString()})`
                      : " (max level)"}
                  </span>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={s.exp}
                    onChange={(e) => setExp(Number(e.target.value))}
                    className="w-full pb-0.5 font-mono text-sm"
                  />
                </label>
                <label className="block border-b border-rule focus-within:border-accent">
                  <span className="block text-[10px] text-muted">Size</span>
                  <select
                    value={s.size}
                    onChange={(e) =>
                      set("size", e.target.value as CharacterSize)
                    }
                    className="w-full pb-0.5 text-sm"
                  >
                    <option value="Small">Small</option>
                    <option value="Medium">Medium</option>
                  </select>
                </label>
                <div className="border-b border-rule">
                  <span className="block text-[10px] text-muted">
                    Creature Type
                  </span>
                  <span className="flex items-center gap-1 pb-0.5 text-sm">
                    <Padlock locked className="h-3 w-3 text-muted" />
                    {s.creatureType}
                  </span>
                </div>
                <Field
                  label="Alignment"
                  v={s.alignment}
                  on={(v) => set("alignment", v)}
                />
              </div>
            )}
          </section>

          {/* Vitals */}
          <section className="mt-3 flex flex-col gap-3 border-y border-rule px-3 py-3 @3xl:grid @3xl:grid-cols-2 @3xl:items-start @3xl:gap-x-8 @3xl:px-6">
            <div className="contents @3xl:flex @3xl:flex-col @3xl:gap-3">
              <div className="order-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setHpOpen((o) => !o)}
                    aria-expanded={hpOpen}
                    title="Set max HP"
                    className={`rounded border-2 border-pink bg-pink px-1.5 py-0.5 text-xs font-bold text-onpink transition-all duration-200 hover:brightness-90 active:scale-95 active:brightness-75 ${
                      hpOpen ? "brightness-75" : ""
                    }`}
                  >
                    HP
                  </button>
                  <div className="relative flex h-8 flex-1 items-center justify-center overflow-hidden rounded bg-pink/35">
                    <div
                      className={`absolute inset-y-0 left-0 transition-all ${
                        hpPct <= 25
                          ? "bg-red-500"
                          : hpPct <= 50
                            ? "bg-amber-400"
                            : "bg-green-500"
                      }`}
                      style={{
                        width: `${
                          barScale ? clamp((s.hp / barScale) * 100, 0, 100) : 0
                        }%`,
                      }}
                    />
                    {s.tempHp > 0 && (
                      <div
                        className="absolute inset-y-0 bg-white transition-all"
                        style={{
                          left: `${
                            barScale
                              ? clamp((s.hp / barScale) * 100, 0, 100)
                              : 0
                          }%`,
                          width: `${
                            barScale
                              ? clamp((s.tempHp / barScale) * 100, 0, 100)
                              : 0
                          }%`,
                        }}
                      />
                    )}
                    <span className="relative flex items-center rounded bg-card/85 px-1.5 font-mono text-sm font-medium text-ink">
                      <NumIn
                        v={s.hp}
                        on={(v) => set("hp", clamp(v, 0, currentMaxHp))}
                        className="w-9 text-right"
                      />
                      <span className="px-0.5 opacity-70">/</span>
                      <span
                        className="w-9 text-left"
                        title="Follows class, level and CON"
                      >
                        {currentMaxHp}
                      </span>
                      {s.tempHp > 0 && (
                        <span
                          className="pl-1 text-xs font-semibold"
                          title="Temporary HP"
                        >
                          +{s.tempHp}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
                {hpOpen && (
                  <div className="mt-2 rounded-md border border-pink/60 bg-card p-2.5">
                    <div className="flex items-center justify-between">
                      <Label>Max HP calculator</Label>
                      <span
                        className="flex items-center gap-1 rounded bg-paper px-1.5 py-0.5 font-mono text-[11px] text-muted"
                        title="Hit die is set by your class"
                      >
                        <Padlock locked className="h-3 w-3" />d{s.hitDie} ·{" "}
                        {s.cls}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted">
                      Level {s.level} · d{s.hitDie} · CON {sgn(conMod)} per
                      level. Level 1 always takes the full die.
                    </p>
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      <button
                        onClick={rollHpDice}
                        aria-pressed={hpMode === "roll"}
                        className={`rounded py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                          hpMode === "roll"
                            ? "bg-pink text-onpink"
                            : "border border-rule hover:bg-accent-soft"
                        }`}
                      >
                        Roll
                      </button>
                      {([
                        ["avg", "Average"],
                        ["max", "Max"],
                      ] as const).map(([k, l]) => (
                        <button
                          key={k}
                          onClick={() => setHpMode(k)}
                          aria-pressed={hpMode === k}
                          className={`rounded py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                            hpMode === k
                              ? "bg-pink text-onpink"
                              : "border border-rule hover:bg-accent-soft"
                          }`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                    {hpMode === "roll" && s.level > 1 && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between">
                          <Label>Tap a rolled level to lock it</Label>
                          <button
                            onClick={() =>
                              setAllHpLocks(
                                !Array.from({ length: s.level - 1 }).every(
                                  (_, i) => s.hpLock[i],
                                ),
                              )
                            }
                            className="text-[11px] font-medium text-accent hover:underline"
                          >
                            {Array.from({ length: s.level - 1 }).every(
                              (_, i) => s.hpLock[i],
                            )
                              ? "Unlock all"
                              : "Lock all"}
                          </button>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {Array.from({ length: s.level - 1 }).map((_, i) => {
                            const locked = !!s.hpLock[i]
                            return (
                              <button
                                key={i}
                                onClick={() => toggleHpLock(i)}
                                disabled={!(s.hpDice[i] > 0)}
                                aria-pressed={locked}
                                title={
                                  locked
                                    ? "Locked: Roll will keep this"
                                    : "Unlocked: Roll will re-roll this"
                                }
                                className={`flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px] transition-colors disabled:opacity-50 ${
                                  locked
                                    ? "border-transparent bg-pink text-onpink"
                                    : "border-rule text-muted hover:border-accent hover:text-ink"
                                }`}
                              >
                                <Padlock locked={locked} className="h-3 w-3" />L
                                {i + 2}: {s.hpDice[i] > 0 ? s.hpDice[i] : "—"}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    <div className="mt-2">
                      <div className="font-mono text-xl font-medium">
                        {derivedMax}
                        <span className="text-xs text-muted"> max HP</span>
                      </div>
                      <div className="truncate font-mono text-[10px] text-muted">
                        {hpPerLevel.map((x) => x ?? "?").join(" + ")}
                        {pendingLevels > 0 &&
                          ` · ${pendingLevels} level${
                            pendingLevels > 1 ? "s" : ""
                          } waiting for a lock`}
                      </div>
                    </div>
                  </div>
                )}
                <div className="mt-2 flex gap-1.5">
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="Amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && applyHp("dmg")}
                    className="h-8 min-w-0 flex-1 border-b border-rule px-1 font-mono"
                    aria-label="HP amount"
                  />
                  <Btn onClick={() => applyHp("dmg")} tone="red">
                    Damage
                  </Btn>
                  <Btn onClick={() => applyHp("heal")} tone="green">
                    Heal
                  </Btn>
                  <Btn onClick={() => applyHp("temp")} tone="plain">
                    Temp
                  </Btn>
                </div>
              </div>
              <div className="order-3">
                <Heading>Death saves</Heading>
                <div className="flex items-center gap-2 rounded-md border border-rule bg-card p-2">
                  {deathStatus === "dying" ? (
                    <button
                      onClick={rollDeathSave}
                      className={`${ROLL_BTN} flex h-9 flex-1 items-center justify-center px-2 text-sm`}
                    >
                      Death Saving Throw
                    </button>
                  ) : (
                    <div
                      role="status"
                      className={`grid h-9 flex-1 place-items-center rounded font-mono text-sm font-semibold ${
                        deathStatus === "dead"
                          ? "border border-white/25 bg-black text-white"
                          : deathStatus === "stable"
                            ? "bg-moss text-onaccent"
                            : "bg-pink text-onpink"
                      }`}
                    >
                      {deathStatus === "dead"
                        ? "Dead"
                        : deathStatus === "stable"
                          ? "Stable"
                          : "Alive!"}
                    </div>
                  )}
                  <div className="w-[116px] shrink-0">
                    <Pips label="Success" n={s.deathS} tone="bg-moss" />
                    <Pips label="Failure" n={s.deathF} tone="bg-danger" />
                  </div>
                </div>
              </div>
            </div>
            <div className="contents @3xl:flex @3xl:flex-col @3xl:gap-3">
              <div className="order-2">
                <Heading>Hit dice</Heading>
                <div className="flex items-center justify-between rounded-md border border-rule bg-card p-2">
                  <span className="font-mono text-xl">
                    {s.level - s.hitDiceUsed}/{s.level} d{s.hitDie}
                  </span>
                  <Btn
                    tone="green"
                    onClick={() => {
                      if (s.hitDiceUsed >= s.level) return
                      const c = mod(scores.CON)
                      const d = 1 + Math.floor(Math.random() * s.hitDie)
                      const heal = Math.max(0, d + c)
                      setS((p) => ({
                        ...p,
                        hitDiceUsed: p.hitDiceUsed + 1,
                        hp: clamp(
                          p.hp + heal,
                          0,
                          effectiveMaxHp(p.maxHp, p.exhaustionLevel),
                        ),
                      }))
                      pushRoll({
                        label: "Hit die",
                        die: `d${s.hitDie}`,
                        face: d,
                        mod: c,
                        total: heal,
                        note: `+${heal} HP`,
                      })
                    }}
                  >
                    Spend
                  </Btn>
                </div>
              </div>
              <div className="order-4">
                <Heading>Core stats</Heading>
                <div className="grid grid-cols-4 gap-2">
                  <Stat label="AC">
                    <span
                      className="font-mono text-lg"
                      title={`${armorAc.detail} + bonuses`}
                    >
                      {armorAc.ac +
                        s.acBonus +
                        permanentAcBonus +
                        activeAcBonus}
                    </span>
                  </Stat>
                  <Stat
                    label="Init"
                    onClick={() => roll("Initiative", m("DEX") + s.initMisc)}
                  >
                    <span className="font-mono text-lg">
                      {sgn(m("DEX") + s.initMisc)}
                    </span>
                  </Stat>
                  <Stat label="Speed">
                    <NumIn
                      v={currentSpeed}
                      on={(v) => set("speed", v - activeMovementBonus)}
                      className="w-full text-lg"
                    />
                  </Stat>
                  <Stat label="Prof">
                    <span className="font-mono text-lg">{sgn(pb)}</span>
                  </Stat>
                </div>
                <div className="mt-2 flex items-center gap-2 rounded-md border border-rule bg-card p-2">
                  <span
                    className={`h-4 w-4 rounded-full border-2 ${
                      s.inspiration
                        ? "border-pink bg-pink"
                        : "border-muted bg-paper"
                    }`}
                  />
                  <span className="min-w-0 flex-1 text-xs">
                    <span className="font-semibold">Inspiration</span>
                    <span className="block text-[10px] text-muted">
                      Standard Inspiration, separate from Bardic Inspiration
                    </span>
                  </span>
                  {s.inspiration && (
                    <button
                      type="button"
                      aria-pressed={inspirationArmed}
                      onClick={() => setInspirationArmed((armed) => !armed)}
                      className={`rounded px-2 py-1 text-[10px] font-semibold ${
                        inspirationArmed
                          ? "bg-pink text-onpink"
                          : "border border-accent text-accent"
                      }`}
                    >
                      {inspirationArmed ? "Next roll: advantage" : "Spend"}
                    </button>
                  )}
                  {role === "GM" && (
                    <button
                      type="button"
                      onClick={() => {
                        set("inspiration", !s.inspiration)
                        if (s.inspiration) setInspirationArmed(false)
                      }}
                      className="rounded border border-rule px-2 py-1 text-[10px] font-semibold"
                    >
                      {s.inspiration ? "Remove" : "Award"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Abilities */}
          <section className="grid grid-cols-3 gap-2 px-3 py-3 @2xl:grid-cols-6 @3xl:px-6">
            {ABILITIES.map((a) => (
              <div
                key={a}
                className="rounded-md border border-rule bg-card p-1.5 text-center"
              >
                <button
                  onClick={() =>
                    roll(
                      `${a} check`,
                      m(a) +
                        activeCheckBonus +
                        activeEffectBonus(s, "ability-check", a),
                    )
                  }
                  className="group w-full"
                  title={`Roll ${a} check`}
                >
                  <span className="block text-base font-semibold">{a}</span>
                  <span className="block font-mono text-2xl leading-tight">
                    {sgn(m(a))}
                  </span>
                </button>
                <div className="mx-auto mt-0.5 w-fit rounded-full bg-paper px-2 py-px">
                  {s.abilityMethod !== "manual" ? (
                    <span className="inline-block w-7 text-center font-mono text-xs text-muted">
                      {scores[a]}
                    </span>
                  ) : (
                    <NumIn
                      v={scores[a]}
                      on={(v) =>
                        set("scores", {
                          ...s.scores,
                          [a]: clamp(v - (scores[a] - s.scores[a]), 1, 30),
                        })
                      }
                      className="w-7 text-xs text-muted"
                    />
                  )}
                </div>
              </div>
            ))}
          </section>
          <div className="px-3 @3xl:px-6">
            <button
              type="button"
              aria-expanded={abilityOpen}
              onClick={() => setAbilityOpen((o) => !o)}
              className="flex w-full items-center justify-between rounded-md border border-rule bg-card px-3 py-1.5 text-left text-xs transition-colors hover:border-accent hover:bg-accent-soft"
            >
              <span className="font-semibold">
                Ability scores, skills and improvements
              </span>
              {pendingChoices > 0 && (
                <span className="rounded-full bg-pink px-2 py-0.5 text-[10px] font-semibold text-onpink">
                  {pendingChoices} to choose
                </span>
              )}
            </button>
            {abilityOpen && (
              <div className="mt-2">
                <AbilitySetup s={s} update={setS} />
              </div>
            )}
          </div>

          {/* Section picker */}
          <div className="sticky top-0 z-10 border-b border-rule bg-paper px-3 py-2 @3xl:px-6">
            <button
              onClick={() => setTabMenuOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={tabMenuOpen}
              className="flex w-full items-center justify-between rounded-md border border-rule bg-card px-3 py-2 text-left transition-colors hover:border-accent hover:bg-accent-soft"
            >
              <span className="flex min-w-0 items-center gap-2">
                <SectionIcon
                  tab={tab}
                  className="h-5 w-5 shrink-0 text-accent"
                />
                <span>
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Section
                  </span>
                  <span className="block text-sm font-semibold leading-tight">
                    {activeTabLabel}
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-1 text-[11px] font-medium text-accent">
                Change
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </span>
            </button>
          </div>

          <div className="space-y-4 px-3 pb-20 pt-3 @3xl:px-6">
            {tab === "main" && (
              <>
                <div className="grid items-start gap-4 @2xl:grid-cols-2 @2xl:items-stretch @3xl:gap-x-8">
                  <div className="@2xl:col-start-1 @2xl:row-start-1">
                    <Heading>Saving throws</Heading>
                    <ul className="grid grid-cols-3 gap-2">
                      {ABILITIES.map((a) => {
                        const p = grantedSavingThrows(s).has(a)
                        const b =
                          m(a) +
                          (p ? pb : 0) +
                          activeEffectBonus(s, "saving-throw", a)
                        return (
                          <li
                            key={a}
                            className="flex min-w-0 items-center gap-2 rounded-md border border-rule bg-card px-2 py-2"
                          >
                            <span
                              className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                                p ? "border-accent" : "border-muted bg-muted/40"
                              }`}
                              title={p ? "Granted by a trait" : undefined}
                            >
                              {p && (
                                <span className="h-2 w-2 rounded-full bg-accent" />
                              )}
                            </span>
                            <span className="text-sm">{a}</span>
                            <button
                              onClick={() => roll(`${a} save`, b)}
                              className={
                                ROLL_BTN + " ml-auto w-10 py-0.5 text-sm"
                              }
                              title="Roll"
                            >
                              {sgn(b)}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                  <div className="flex flex-col @2xl:col-start-1 @2xl:row-start-2">
                    <Heading>Structured defenses</Heading>
                    <div className="min-h-12 flex-1 space-y-1 rounded-md border border-rule bg-card p-2 text-sm leading-snug">
                      {([
                        ["Resistances", structuredDefenses.resistances],
                        ["Vulnerabilities", structuredDefenses.vulnerabilities],
                        ["Damage immunities", structuredDefenses.immunities],
                        [
                          "Condition immunities",
                          structuredDefenses.conditionImmunities,
                        ],
                      ] as [string, string[]][]).map(
                        ([label, values]) =>
                          values.length > 0 && (
                            <p key={label}>
                              <span className="font-semibold">{label}:</span>{" "}
                              <span className="capitalize">
                                {values.join(", ")}
                              </span>
                            </p>
                          ),
                      )}
                      {structuredDefenses.acBonus > 0 && (
                        <p>
                          <span className="font-semibold">Granted AC:</span> +
                          {structuredDefenses.acBonus}
                        </p>
                      )}
                      {!structuredDefenses.resistances.length &&
                        !structuredDefenses.vulnerabilities.length &&
                        !structuredDefenses.immunities.length &&
                        !structuredDefenses.conditionImmunities.length &&
                        !structuredDefenses.acBonus && (
                          <p className="text-muted">
                            No structured defenses granted.
                          </p>
                        )}
                      {s.defenseNotes && (
                        <p className="border-t border-rule pt-1 text-muted">
                          <span className="font-semibold">Notes:</span>{" "}
                          {s.defenseNotes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="@2xl:col-start-2 @2xl:row-span-2 @2xl:row-start-1">
                    <Heading>Senses</Heading>
                    <div className="space-y-1.5">
                      {DETAIL_SKILLS.map(([n, a]) => {
                        const b = skillBonus(n, a)
                        const st = skillLevel(s, n)
                        return (
                          <div
                            key={n}
                            className="rounded-md border border-rule bg-card px-2 py-1.5"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                                  st > 0
                                    ? "border-accent"
                                    : "border-muted bg-muted/40"
                                }`}
                                title={
                                  st === 2
                                    ? "Expertise"
                                    : st === 1
                                      ? "Proficient"
                                      : undefined
                                }
                              >
                                {st > 0 && (
                                  <span
                                    className={`h-2 w-2 rounded-full ${
                                      st === 2
                                        ? "bg-pink ring-1 ring-pink ring-offset-1 ring-offset-paper"
                                        : "bg-accent"
                                    }`}
                                  />
                                )}
                              </span>
                              <span className="truncate text-sm font-medium">
                                Passive {n}
                              </span>
                              <span className="shrink-0 text-[11px] uppercase text-muted">
                                ({a})
                              </span>
                              <span className="ml-auto shrink-0 font-mono text-lg leading-none">
                                {10 + b}
                              </span>
                            </div>
                            {s.skillNotes[n] && (
                              <p className="mt-1 whitespace-pre-wrap text-[13px] text-muted">
                                {s.skillNotes[n]}
                              </p>
                            )}
                          </div>
                        )
                      })}
                      <div className="rounded-md border border-rule bg-card p-2">
                        <span className="text-sm font-medium">
                          Other Senses
                        </span>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-snug">
                          {[
                            s.skillNotes.Vision,
                            ...movementFeatures
                              .map(
                                (feature) => feature.effects?.movement.senses,
                              )
                              .filter(Boolean),
                          ]
                            .filter(Boolean)
                            .join("\n") || (
                            <span className="text-muted">None</span>
                          )}
                        </p>
                      </div>
                      {movementFeatures.length > 0 && (
                        <div className="rounded-md border border-rule bg-card p-2">
                          <span className="text-sm font-medium">
                            Granted movement
                          </span>
                          {movementFeatures.map((feature) => (
                            <p
                              key={feature.id}
                              className="mt-1 text-sm text-muted"
                            >
                              {feature.name}: {feature.effects!.movement.mode}{" "}
                              {feature.effects!.movement.distance || "—"} ft.
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <Heading right="Managed in Traits">Skills</Heading>
                  <ul className="grid grid-cols-2 gap-x-4 @2xl:grid-cols-3">
                    {SKILLS.map(([n, a]) => {
                      const st = skillLevel(s, n)
                      const b = skillBonus(n, a)
                      return (
                        <Row
                          key={n}
                          state={st}
                          locked
                          inPool={false}
                          onToggle={() => undefined}
                          label={n}
                          sub={a}
                          bonus={b}
                          onRoll={() => roll(n, b)}
                        />
                      )
                    })}
                  </ul>
                  <p className="mt-2 text-[11px] text-muted">
                    Skill proficiency and expertise are assigned from their
                    source cards on the Traits tab. Tap a bonus to roll.
                  </p>
                </div>
                <div>
                  <Heading>Proficiencies &amp; training</Heading>
                  {(() => {
                    const training = proficiencyTraining(s)
                    return (
                      <div className="grid gap-2 @2xl:grid-cols-2">
                        <TrainingBox
                          title="Armor"
                          marks={["Light", "Medium", "Heavy", "Shields"].map(
                            (label) => ({
                              label,
                              on: training.armor.includes(label),
                            }),
                          )}
                        />
                        <TrainingBox
                          title="Weapons"
                          marks={[
                            { label: "Simple", on: training.simple },
                            { label: "Martial", on: training.martial },
                          ]}
                          fixed={training.specificWeapons}
                        />
                        <TrainingBox
                          title="Tools & others"
                          fixed={training.tools}
                          empty="No tool training"
                        />
                        <TrainingBox
                          title="Languages"
                          text={
                            training.languages.length
                              ? training.languages.join(", ")
                              : "No languages known"
                          }
                        />
                      </div>
                    )
                  })()}
                </div>
              </>
            )}

            {tab === "combat" && (
              <>
                <div>
                  <Heading>Attacks</Heading>
                  <div className="grid gap-2 @2xl:grid-cols-2">
                    {hasFreeHand && (
                      <div className="rounded-md border border-rule bg-card p-2">
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">
                              Unarmed Strike (STR)
                            </div>
                            <div className="truncate text-xs text-muted">
                              Core rules · 1 ({sgn(m("STR"))}) bludgeoning
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              roll("Unarmed Strike attack", m("STR") + pb)
                            }
                            className={`${ROLL_BTN} flex h-7 w-[72px] shrink-0 items-center justify-center gap-1`}
                            aria-label="Roll unarmed strike attack"
                          >
                            {sgn(m("STR") + pb)}
                          </button>
                          <span
                            className="grid h-7 min-w-12 shrink-0 place-items-center rounded border border-rule bg-paper px-2 font-mono text-xs font-semibold"
                            title="Unarmed strike damage"
                          >
                            DMG {unarmedDamage}
                          </span>
                        </div>
                      </div>
                    )}
                    {equippedWeapons.map((weapon) => {
                      const name = weapon.name || "Weapon"
                      const props = weapon.props
                        .map((x) => WEAPON_PROPS.find((p) => p.id === x)?.label)
                        .filter(Boolean)
                        .join(", ")
                      const finesse = weapon.props.includes("finesse")
                      const isProf = weaponProficient(s, weapon)
                      const variants: (Ab | undefined)[] = finesse
                        ? ["STR", "DEX"]
                        : [undefined]
                      const dmgBtn =
                        "grid h-7 shrink-0 place-items-center rounded border border-rule bg-paper px-2 font-mono text-xs font-semibold hover:border-accent hover:bg-accent-soft"
                      return (
                        <div
                          key={weapon.id}
                          className="rounded-md border border-rule bg-card p-2"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-medium">{name}</div>
                            <div className="truncate text-xs text-muted">
                              {[
                                weaponRange(weapon),
                                "Inventory",
                                weaponUsesTwoHands(weapon)
                                  ? "Both hands"
                                  : "One hand",
                                isProf ? "Proficient" : "",
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          </div>
                          <div className="mt-1.5 space-y-1.5">
                            {variants.map((v) => {
                              const stats = weaponStats(
                                weapon,
                                scores,
                                pb,
                                v,
                                isProf,
                                activeAttackBonus,
                              )
                              const tag = finesse ? ` (${stats.ability})` : ""
                              return (
                                <div
                                  key={v ?? "base"}
                                  className="flex items-center gap-2"
                                >
                                  {finesse && (
                                    <span className="w-8 shrink-0 text-[10px] font-semibold uppercase text-muted">
                                      {stats.ability}
                                    </span>
                                  )}
                                  <button
                                    onClick={() =>
                                      roll(`${name}${tag} attack`, stats.attack)
                                    }
                                    className={`${ROLL_BTN} flex h-7 min-w-0 flex-1 items-center justify-center gap-1`}
                                    aria-label={`Roll ${name}${tag} attack`}
                                  >
                                    Hit {sgn(stats.attack)}
                                  </button>
                                  <button
                                    onClick={() =>
                                      rollDamage(
                                        `${name}${tag} damage`,
                                        weapon.damageDice,
                                        stats.damageMod + activeDamageBonus,
                                      )
                                    }
                                    className={`${dmgBtn} min-w-0 flex-1`}
                                    aria-label={`Roll ${name}${tag} damage`}
                                    title="Roll damage"
                                  >
                                    DMG {weapon.damageDice || "0"}
                                    {stats.damageMod + activeDamageBonus
                                      ? sgn(
                                          stats.damageMod + activeDamageBonus,
                                        )
                                      : ""}
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                          {(weapon.damageType ||
                            props ||
                            (weapon.props.includes("versatile") &&
                              weapon.versatileDice)) && (
                            <div className="mt-1.5 flex items-center gap-2 text-xs text-muted">
                              <span className="min-w-0 flex-1 truncate capitalize">
                                {[weapon.damageType, props]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                              {weapon.props.includes("versatile") &&
                                weapon.versatileDice && (
                                  <button
                                    onClick={() =>
                                      rollDamage(
                                        `${name} damage (two-handed)`,
                                        weapon.versatileDice,
                                        weaponStats(
                                          weapon,
                                          scores,
                                          pb,
                                          undefined,
                                          isProf,
                                          activeAttackBonus,
                                        ).damageMod + activeDamageBonus,
                                      )
                                    }
                                    className={dmgBtn}
                                    title="Roll two-handed damage"
                                  >
                                    2H {weapon.versatileDice}
                                  </button>
                                )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {s.customAttacks.map((at) => {
                      const attackBonus =
                        at.attackMode === "ability"
                          ? m(at.ability) +
                            (at.proficient ? pb : 0) +
                            at.attackBonus +
                            activeAttackBonus
                          : at.attackBonus + activeAttackBonus
                      const damage = spellFormulaParts(at.damageFormula)
                      return (
                      <div
                        key={at.id}
                        className="rounded-md border border-rule bg-card p-2"
                      >
                        <div className="flex items-center gap-2">
                          <Edit
                            v={at.name}
                            on={(v) => upAttack(at.id, { name: v })}
                            className="font-medium"
                          />
                          <button
                            onClick={() =>
                              roll(`${at.name} attack`, attackBonus, "attack")
                            }
                            className={`${ROLL_BTN} h-7 shrink-0 px-3 text-xs`}
                            aria-label={`Roll ${at.name} attack`}
                          >
                            Hit {sgn(attackBonus)}
                          </button>
                          <button
                            onClick={() =>
                              rollDamage(
                                `${at.name} damage`,
                                damage.dice,
                                damage.bonus + activeDamageBonus,
                              )
                            }
                            className="h-7 shrink-0 rounded border border-rule bg-paper px-2 font-mono text-xs font-semibold hover:border-accent"
                            aria-label={`Roll ${at.name} damage`}
                          >
                            DMG {at.damageFormula || "0"}
                          </button>
                          <button
                            onClick={() =>
                              set(
                                "customAttacks",
                                s.customAttacks.filter((x) => x.id !== at.id),
                              )
                            }
                            className="text-muted hover:text-danger"
                            aria-label="Remove attack"
                          >
                            ×
                          </button>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          <select
                            value={at.attackMode}
                            onChange={(event) =>
                              upAttack(at.id, {
                                attackMode: event.target
                                  .value as CustomAttack["attackMode"],
                              })
                            }
                            className="border-b border-rule"
                          >
                            <option value="fixed">Fixed attack bonus</option>
                            <option value="ability">Ability calculation</option>
                          </select>
                          {at.attackMode === "ability" ? (
                            <div className="flex gap-2">
                              <select
                                value={at.ability}
                                onChange={(event) =>
                                  upAttack(at.id, {
                                    ability: event.target.value as Ab,
                                  })
                                }
                                className="flex-1 border-b border-rule"
                              >
                                {ABILITIES.map((ability) => (
                                  <option key={ability}>{ability}</option>
                                ))}
                              </select>
                              <label className="flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={at.proficient}
                                  onChange={(event) =>
                                    upAttack(at.id, {
                                      proficient: event.target.checked,
                                    })
                                  }
                                />
                                Prof.
                              </label>
                            </div>
                          ) : (
                            <IntInput
                              value={at.attackBonus}
                              onChange={(attackBonus) =>
                                upAttack(at.id, { attackBonus })
                              }
                              className="border-b border-rule text-left"
                            />
                          )}
                          <select
                            value={at.attackType}
                            onChange={(event) =>
                              upAttack(at.id, {
                                attackType: event.target
                                  .value as CustomAttack["attackType"],
                              })
                            }
                            className="border-b border-rule"
                          >
                            <option value="melee">Melee attack</option>
                            <option value="ranged">Ranged attack</option>
                            <option value="special">Special attack</option>
                          </select>
                          {at.attackMode === "ability" && (
                            <input
                              value={String(at.attackBonus)}
                              onChange={(event) =>
                                upAttack(at.id, {
                                  attackBonus:
                                    parseInt(event.target.value, 10) || 0,
                                })
                              }
                              placeholder="Misc attack bonus"
                              className="border-b border-rule"
                            />
                          )}
                          <input
                            value={at.damageFormula}
                            onChange={(event) =>
                              upAttack(at.id, {
                                damageFormula: event.target.value,
                              })
                            }
                            placeholder="Damage, e.g. 1d8 + 3"
                            className="border-b border-rule"
                          />
                          <input
                            value={at.damageType}
                            onChange={(event) =>
                              upAttack(at.id, {
                                damageType: event.target.value,
                              })
                            }
                            placeholder="Damage type"
                            className="border-b border-rule"
                          />
                          <input
                            value={at.range}
                            onChange={(event) =>
                              upAttack(at.id, { range: event.target.value })
                            }
                            placeholder="Range"
                            className="border-b border-rule"
                          />
                          <input
                            value={at.source}
                            onChange={(event) =>
                              upAttack(at.id, { source: event.target.value })
                            }
                            placeholder="Source"
                            className="border-b border-rule"
                          />
                          <input
                            value={at.conditions}
                            onChange={(event) =>
                              upAttack(at.id, {
                                conditions: event.target.value,
                              })
                            }
                            placeholder="Conditions"
                            className="border-b border-rule"
                          />
                          <input
                            value={at.description}
                            onChange={(event) =>
                              upAttack(at.id, {
                                description: event.target.value,
                              })
                            }
                            placeholder="Description / effects"
                            className="border-b border-rule"
                          />
                          <input
                            value={at.effects}
                            onChange={(event) =>
                              upAttack(at.id, { effects: event.target.value })
                            }
                            placeholder="Mechanical or situational effects"
                            className="border-b border-rule"
                          />
                        </div>
                        <p className="mt-1 text-[10px] text-muted">
                          {[at.source || "Custom", at.attackType, at.range, at.damageType]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    )})}
                  </div>
                  <button
                    onClick={() =>
                      set("customAttacks", [
                        ...s.customAttacks,
                        {
                          id: featureId(),
                          name: "New attack",
                          attackMode: "fixed",
                          attackBonus: 0,
                          ability: "STR",
                          proficient: false,
                          damageFormula: "1d6",
                          damageType: "",
                          range: "5 ft.",
                          attackType: "melee",
                          description: "",
                          source: "Custom",
                          sourceType: "custom",
                          ownerId: s.name || "character",
                          conditions: "",
                          effects: "",
                        },
                      ])
                    }
                    className="mt-2 text-xs font-medium text-accent hover:underline"
                  >
                    + Add attack
                  </button>
                </div>

                {combatSections.map(([section, features]) => (
                  <div key={section}>
                    <Heading>{section}</Heading>
                    <div className="grid gap-2 @2xl:grid-cols-2">
                      {features.map((feature) => {
                        const action = feature.effects!.action
                        const resource = featureResource(
                          s.cls,
                          s.level,
                          feature,
                          scores,
                        )
                        const pool = feature.effects!.resource.pool.trim()
                        const poolMembers = pool
                          ? s.traits.filter(
                              (entry) =>
                                entry.effects?.resource.pool.trim() === pool,
                            )
                          : [feature]
                        const used = Math.max(
                          ...poolMembers.map((entry) => entry.used ?? 0),
                          0,
                        )
                        const remaining =
                          resource && Number.isFinite(resource.max)
                            ? Math.max(0, resource.max - used)
                            : Number.POSITIVE_INFINITY
                        const passive = section === "Passive Effects"
                        const active = s.activeEffects.some(
                          (effect) => effect.sourceFeatureId === feature.id,
                        )
                        const linkedChargeItem = s.inventory.find(
                          (item): item is GearItem =>
                            item.category === "adventuring-gear" &&
                            item.combatFeatureId === feature.id &&
                            item.maxCharges > 0,
                        )
                        const canRoll =
                          !!action.ability &&
                          action.attackType !== "None" &&
                          action.attackType !== "Saving throw"
                        const attackBonus = action.ability
                          ? m(action.ability) + pb + activeAttackBonus
                          : 0
                        return (
                          <div
                            key={feature.id}
                            className="min-w-0 rounded-md border border-accent/40 bg-card p-2"
                          >
                            <div className="flex min-w-0 flex-wrap items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold">
                                  {feature.name}
                                </div>
                                <div className="truncate text-[10px] text-muted">
                                  {featureSourceLabel(feature)}
                                </div>
                              </div>
                              {active && (
                                <span className="rounded bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase text-onaccent">
                                  Active
                                </span>
                              )}
                              {resource &&
                                (Number.isFinite(resource.max) ? (
                                  <div
                                    className="flex shrink-0 items-center gap-1"
                                    aria-label={`${remaining} of ${resource.max} uses remaining`}
                                  >
                                    {resource.max <= 8 ? (
                                      Array.from({
                                        length: resource.max,
                                      }).map((_, i) => (
                                        <span
                                          key={i}
                                          className={`h-3 w-3 rounded-full border ${
                                            i < remaining
                                              ? "border-accent bg-accent"
                                              : "border-muted bg-muted/40"
                                          }`}
                                        />
                                      ))
                                    ) : (
                                      <span className="rounded bg-paper px-2 py-0.5 font-mono text-[10px]">
                                        {remaining}/{resource.max}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="rounded bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase text-accent">
                                    Unlimited
                                  </span>
                                ))}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted">
                              {action.range && <span>{action.range}</span>}
                              {action.target && <span>{action.target}</span>}
                              {action.duration && (
                                <span>{action.duration}</span>
                              )}
                              {(action.damageDice || action.damageType) && (
                                <span>
                                  {[action.damageDice, action.damageType]
                                    .filter(Boolean)
                                    .join(" ")}
                                </span>
                              )}
                              {resource && (
                                <span>
                                  Cost {feature.effects!.resource.cost ?? 1} ·{" "}
                                  {resource.recharge === "short"
                                    ? "Short/long rest"
                                    : resource.recharge === "long"
                                      ? "Long rest"
                                      : resource.recharge === "dawn"
                                        ? "Dawn"
                                        : "Manual recharge"}
                                </span>
                              )}
                              {linkedChargeItem && (
                                <span>
                                  Item charges {linkedChargeItem.charges}/
                                  {linkedChargeItem.maxCharges} · cost{" "}
                                  {Math.max(1, linkedChargeItem.chargeCost)}
                                </span>
                              )}
                            </div>
                            {section === "Reaction" && action.trigger && (
                              <p className="mt-1 rounded bg-accent-soft px-2 py-1 text-[11px] text-accent">
                                Trigger: {action.trigger}
                              </p>
                            )}
                            {action.activationCondition && (
                              <p className="mt-1 text-[11px] text-muted">
                                Requires: {action.activationCondition}
                              </p>
                            )}
                            {(feature.description || action.notes) && (
                              <details className="mt-1 text-[11px] text-muted">
                                <summary className="cursor-pointer font-medium text-accent">
                                  Details
                                </summary>
                                <p className="mt-1 whitespace-pre-wrap">
                                  {[feature.description, action.notes]
                                    .filter(Boolean)
                                    .join("\n")}
                                </p>
                              </details>
                            )}
                            {!passive && (
                              <div className="mt-2 flex gap-2">
                                <button
                                  type="button"
                                  disabled={
                                    (section === "Reaction"
                                      ? !currentConditionSummary.canReact
                                      : !currentConditionSummary.canAct) ||
                                    (active &&
                                      action.stacking === "non-stacking") ||
                                    (!!linkedChargeItem &&
                                      linkedChargeItem.charges <
                                        Math.max(
                                          1,
                                          linkedChargeItem.chargeCost,
                                        )) ||
                                    (Number.isFinite(remaining) &&
                                      remaining <
                                        Math.max(
                                          0,
                                          feature.effects!.resource.cost ?? 1,
                                        ))
                                  }
                                  onClick={() => activateCombatAbility(feature)}
                                  className="min-w-0 flex-1 rounded bg-pink px-3 py-1.5 text-xs font-semibold text-onpink hover:brightness-95 disabled:opacity-40"
                                >
                                  Use
                                </button>
                                {canRoll && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      roll(
                                        `${feature.name} attack`,
                                        attackBonus,
                                      )
                                    }
                                    className={`${ROLL_BTN} shrink-0 px-3 text-xs`}
                                  >
                                    Roll {sgn(attackBonus)}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {selectedSpellEntries.length > 0 && (
                  <div>
                    <Heading>Spells</Heading>
                    <div className="grid gap-2 @2xl:grid-cols-2">
                      {selectedSpellEntries.map(
                        ({ selected, entry, source }) => {
                          const meta = entry.feature.meta ?? {}
                          const spellLevel = Number(meta.level) || 0
                          const damageParts = (() => {
                            try {
                              const parsed = JSON.parse(
                                meta.damageParts || "[]",
                              )
                              if (Array.isArray(parsed) && parsed.length)
                                return parsed as { type?: string }[]
                            } catch {
                              // Older custom spell records use damageFormula.
                            }
                            return meta.damageFormula
                              ? [{ type: meta.damageType }]
                              : []
                          })()
                          const eligibleLevels =
                            spellLevel === 0
                              ? [0]
                              : source.progression === "pact"
                                ? s.pactSlots.level >= spellLevel &&
                                  s.pactSlots.used < s.pactSlots.max
                                  ? [s.pactSlots.level]
                                  : []
                                : source.progression === "custom"
                                  ? [spellLevel]
                                  : s.slots.flatMap((slot, index) =>
                                      index + 1 >= spellLevel &&
                                      slot.used < slot.max
                                        ? [index + 1]
                                        : [],
                                    )
                          const castLevel =
                            spellCastLevels[`${entry.id}:${source.id}`] ??
                            eligibleLevels[0] ??
                            spellLevel
                          const damageFormulas = damageParts.map(
                            (_part, index) =>
                              scaledSpellFormula(
                                entry,
                                source,
                                s,
                                castLevel,
                                false,
                                index,
                              ),
                          )
                          const healingFormula = scaledSpellFormula(
                            entry,
                            source,
                            s,
                            castLevel,
                            true,
                          )
                          const canCastSpell =
                            selected.prepared &&
                            (spellLevel === 0 ||
                              eligibleLevels.includes(castLevel))
                          const castingAbility = mod(scores[source.ability])
                          return (
                            <div
                              key={`${entry.id}:${source.id}`}
                              className="min-w-0 rounded-md border border-accent/40 bg-card p-2"
                            >
                              <div className="flex items-start gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-semibold">
                                    {entry.feature.name}
                                  </div>
                                  <div className="truncate text-[10px] text-muted">
                                    {source.spellList} ·{" "}
                                    {spellLevel === 0
                                      ? "Cantrip"
                                      : `Level ${spellLevel}`}{" "}
                                    · DC {8 + pb + castingAbility} · attack{" "}
                                    {sgn(pb + castingAbility)}
                                  </div>
                                </div>
                                {meta.concentration === "true" && (
                                  <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[9px] font-semibold uppercase text-accent">
                                    Concentration
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-x-2 text-[10px] text-muted">
                                <span>{meta.castingTime}</span>
                                <span>{meta.range}</span>
                                <span>{meta.components}</span>
                                <span>{meta.duration}</span>
                                {meta.ritual === "true" && <span>Ritual</span>}
                                {meta.area && <span>Area: {meta.area}</span>}
                              </div>
                              <details className="mt-1 text-[11px] text-muted">
                                <summary className="cursor-pointer font-medium text-accent">
                                  Details
                                </summary>
                                <p className="mt-1 whitespace-pre-wrap">
                                  {meta.text || entry.feature.description}
                                </p>
                                {meta.higherLevel && (
                                  <p className="mt-1 whitespace-pre-wrap">
                                    <span className="font-semibold">
                                      At higher levels:
                                    </span>{" "}
                                    {meta.higherLevel}
                                  </p>
                                )}
                                {meta.attackType && (
                                  <p className="mt-1 capitalize">
                                    {meta.attackType} spell attack{" "}
                                    {sgn(pb + castingAbility)}
                                  </p>
                                )}
                                {meta.saveAbility && (
                                  <p className="mt-1">
                                    {meta.saveAbility} save against DC{" "}
                                    {8 + pb + castingAbility}
                                    {meta.saveSuccess
                                      ? ` · success: ${meta.saveSuccess}`
                                      : ""}
                                  </p>
                                )}
                              </details>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {spellLevel > 0 && (
                                  <select
                                    value={castLevel}
                                    onChange={(event) =>
                                      setSpellCastLevels((levels) => ({
                                        ...levels,
                                        [`${entry.id}:${source.id}`]: Number(
                                          event.target.value,
                                        ),
                                      }))
                                    }
                                    className="rounded border border-rule bg-paper px-2 py-1 text-xs"
                                    aria-label={`Casting level for ${entry.feature.name}`}
                                  >
                                    {(eligibleLevels.length
                                      ? eligibleLevels
                                      : [spellLevel]
                                    ).map((level) => (
                                      <option key={level} value={level}>
                                        {level > spellLevel
                                          ? `Upcast L${level}`
                                          : `Slot L${level}`}
                                      </option>
                                    ))}
                                  </select>
                                )}
                                <button
                                  type="button"
                                  disabled={!canCastSpell}
                                  onClick={() =>
                                    castSpell(
                                      entry,
                                      selected,
                                      source,
                                      castLevel,
                                    )
                                  }
                                  className="rounded bg-pink px-3 py-1 text-xs font-semibold text-onpink hover:brightness-95 disabled:opacity-40"
                                >
                                  Cast
                                </button>
                                {damageFormulas.map((formula, index) =>
                                  formula ? (
                                    <button
                                      key={`${formula}-${index}`}
                                      type="button"
                                      disabled={!selected.prepared}
                                      onClick={() =>
                                        useSpellFormula(
                                          entry,
                                          source,
                                          castLevel,
                                          false,
                                          index,
                                        )
                                      }
                                      className={
                                        ROLL_BTN +
                                        " px-3 text-xs disabled:opacity-40"
                                      }
                                    >
                                      Damage {formula}
                                      {damageParts[index]?.type
                                        ? ` ${damageParts[index].type}`
                                        : ""}
                                    </button>
                                  ) : null,
                                )}
                                {healingFormula && (
                                  <button
                                    type="button"
                                    disabled={!selected.prepared}
                                    onClick={() =>
                                      useSpellFormula(
                                        entry,
                                        source,
                                        castLevel,
                                        true,
                                      )
                                    }
                                    className="rounded bg-moss px-3 py-1 text-xs font-semibold text-onaccent disabled:opacity-40"
                                  >
                                    Heal {healingFormula}
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        },
                      )}
                    </div>
                  </div>
                )}

                {s.activeEffects.length > 0 && (
                  <div>
                    <Heading>Active Effects</Heading>
                    <div className="grid gap-2 @2xl:grid-cols-2">
                      {s.activeEffects.map((active) => (
                        <div
                          key={active.id}
                          className="rounded-md border border-accent bg-accent-soft p-2"
                        >
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold">
                                {active.name}
                              </div>
                              <div className="text-[10px] text-muted">
                                {active.sourceType} · {active.duration}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setS((sheet) => ({
                                  ...sheet,
                                  activeEffects: sheet.activeEffects.filter(
                                    (effect) => effect.id !== active.id,
                                  ),
                                }))
                              }
                              className="shrink-0 rounded border border-rule px-2 py-1 text-[10px] font-semibold text-danger"
                            >
                              End effect
                            </button>
                          </div>
                          <div className="mt-1 space-y-0.5 text-[11px]">
                            {active.effects.map((effect) => (
                              <div key={effect.id}>
                                {effect.type.replace(/-/g, " ")}
                                {combatEffectValue(effect, s)
                                  ? ` ${sgn(combatEffectValue(effect, s))}`
                                  : ""}
                                {effect.detail ? ` · ${effect.detail}` : ""}
                                {effect.damageType
                                  ? ` · ${effect.damageType}`
                                  : ""}
                                {effect.condition
                                  ? ` · ${effect.condition}`
                                  : ""}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <Heading>Conditions</Heading>
                  <div className="flex flex-wrap gap-1.5">
                    {CONDITION_TYPES.map((c) => {
                      const active = s.activeConditions.find(
                        (condition) => condition.type === c,
                      )
                      return (
                        <button
                          key={c}
                          aria-pressed={!!active}
                          title={
                            active
                              ? `${active.source} · ${active.duration}${
                                  active.notes ? ` · ${active.notes}` : ""
                                }`
                              : `Apply ${c}`
                          }
                          onClick={() => {
                            if (!active && conditionImmune(s, c)) {
                              flash(`${s.name} is immune to ${c}`)
                              return
                            }
                            set(
                              "activeConditions",
                              active
                                ? s.activeConditions.filter(
                                    (condition) => condition.id !== active.id,
                                  )
                                : [
                                    ...s.activeConditions,
                                    {
                                      id: `condition-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                                      type: c,
                                      source: "Manual",
                                      sourceDetails: "Combat condition control",
                                      appliedCharacter: s.name,
                                      duration: "Until removed",
                                      expiration: "manual",
                                      save: "",
                                      notes: "",
                                      appliedAt: Date.now(),
                                    },
                                  ],
                            )
                          }}
                          className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                            active
                              ? "border-transparent bg-pink text-onpink"
                              : "border-rule text-muted hover:border-accent hover:text-ink"
                          }`}
                        >
                          {c}
                        </button>
                      )
                    })}
                  </div>
                  {s.activeConditions.length > 0 && (
                    <div className="mt-2 grid gap-1 @2xl:grid-cols-2">
                      {s.activeConditions.map((condition) => (
                        <div
                          key={condition.id}
                          className="rounded border border-rule bg-card px-2 py-1 text-[11px]"
                        >
                          <div className="font-semibold">{condition.type}</div>
                          <div className="text-muted">
                            {condition.source} · {condition.duration}
                            {condition.save ? ` · ${condition.save}` : ""}
                          </div>
                          {(condition.sourceDetails || condition.notes) && (
                            <div className="text-muted">
                              {[condition.sourceDetails, condition.notes]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 rounded-md border border-rule bg-card p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">Exhaustion</span>
                      <div className="ml-auto flex items-center gap-1">
                        <button
                          type="button"
                          disabled={s.exhaustionLevel <= 0}
                          onClick={() =>
                            set(
                              "exhaustionLevel",
                              Math.max(0, s.exhaustionLevel - 1),
                            )
                          }
                          className="grid h-6 w-6 place-items-center rounded border border-rule disabled:opacity-40"
                        >
                          −
                        </button>
                        <span className="w-14 text-center font-mono text-xs">
                          Level {s.exhaustionLevel}
                        </span>
                        <button
                          type="button"
                          disabled={s.exhaustionLevel >= 6}
                          onClick={() =>
                            set(
                              "exhaustionLevel",
                              Math.min(6, s.exhaustionLevel + 1),
                            )
                          }
                          className="grid h-6 w-6 place-items-center rounded border border-rule disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    {s.exhaustionLevel > 0 && (
                      <p className="mt-1 text-[11px] text-muted">
                        {[
                          s.exhaustionLevel >= 1
                            ? "Disadvantage on ability checks"
                            : "",
                          s.exhaustionLevel >= 2 ? "Speed halved" : "",
                          s.exhaustionLevel >= 3
                            ? "Disadvantage on attacks and saves"
                            : "",
                          s.exhaustionLevel >= 4 ? "Maximum HP halved" : "",
                          s.exhaustionLevel >= 5 ? "Speed 0" : "",
                          s.exhaustionLevel >= 6 ? "Dead" : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    {currentConditionSummary.reminders.length > 0 && (
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-muted">
                        {currentConditionSummary.reminders.map((reminder) => (
                          <li key={reminder}>{reminder}</li>
                        ))}
                      </ul>
                    )}
                    {(!currentConditionSummary.canAct ||
                      !currentConditionSummary.canReact) && (
                      <p className="mt-1 font-semibold text-danger">
                        {!currentConditionSummary.canAct &&
                          "Actions unavailable. "}
                        {!currentConditionSummary.canReact &&
                          "Reactions unavailable."}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}

            {tab === "spells" && (
              <>
                {!canCast && (
                  <p className="text-center text-sm font-semibold text-muted">
                    Add Spellcasting to a trait or feature to enable casting for{" "}
                    {s.name || "this character"}.
                  </p>
                )}
                {spellSources.length > 0 && (
                  <div className="grid gap-2 @2xl:grid-cols-2">
                    {spellSources.map((source) => (
                      <div
                        key={source.id}
                        className="grid grid-cols-3 gap-2 rounded-md border border-rule bg-card p-2 text-center"
                      >
                        <Stat label={source.spellList}>
                          <span className="font-mono text-lg">
                            {source.ability}
                          </span>
                        </Stat>
                        <Stat label="Save DC">
                          <span className="font-mono text-lg">
                            {8 + pb + m(source.ability)}
                          </span>
                        </Stat>
                        <Stat label="Attack">
                          <span className="font-mono text-lg">
                            {sgn(pb + m(source.ability))}
                          </span>
                        </Stat>
                      </div>
                    ))}
                  </div>
                )}
                <div>
                  <Heading>Spell slots</Heading>
                  <div className="space-y-1.5">
                    {s.slots.map((sl, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-8 text-xs font-medium text-muted">
                          Lv {i + 1}
                        </span>
                        <div className="flex flex-1 flex-wrap gap-1.5">
                          {Array.from({ length: sl.max }).map((_, j) => {
                            const used = j < sl.used
                            return (
                              <span
                                key={j}
                                aria-label={`Slot ${j + 1} level ${i + 1}`}
                                className={`h-5 w-5 rounded-full border-2 border-accent transition-colors ${
                                  used ? "" : "bg-accent"
                                }`}
                              />
                            )
                          })}
                          {sl.max === 0 && (
                            <span className="text-xs text-muted">—</span>
                          )}
                        </div>
                        <span className="font-mono text-xs text-muted">
                          {sl.max - sl.used}/{sl.max}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-muted">
                    Slots are generated automatically from 2014 class
                    progression. Filled = available.
                  </p>
                </div>
                {s.pactSlots.max > 0 && (
                  <div>
                    <Heading>Pact Magic</Heading>
                    <div className="flex items-center gap-2 rounded-md border border-rule bg-card p-2">
                      <span className="text-xs font-semibold">
                        Level {s.pactSlots.level}
                      </span>
                      <div className="flex flex-1 gap-1.5">
                        {Array.from({ length: s.pactSlots.max }).map(
                          (_, index) => (
                            <span
                              key={index}
                              className={`h-5 w-5 rounded-full border-2 border-accent ${
                                index < s.pactSlots.used ? "" : "bg-accent"
                              }`}
                            />
                          ),
                        )}
                      </div>
                      <span className="font-mono text-xs text-muted">
                        {s.pactSlots.max - s.pactSlots.used}/{s.pactSlots.max}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted">
                      Recovers on a short or long rest.
                    </p>
                  </div>
                )}
                {spellcastingFeatures.length > 0 && (
                  <div>
                    <Heading>Granted spellcasting</Heading>
                    <div className="space-y-1.5">
                      {spellcastingFeatures.map((feature) => {
                        const spellcasting = feature.effects!.spellcasting
                        return (
                          <div
                            key={feature.id}
                            className="rounded-md border border-rule bg-card p-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">
                                {feature.name}
                              </span>
                              <span className="text-[10px] uppercase text-muted">
                                {spellcasting.progression}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-muted">
                              {[
                                spellcasting.ability &&
                                  `${spellcasting.ability} casting`,
                                spellcasting.spellList,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            {spellcasting.additionalSpells && (
                              <p className="mt-1 whitespace-pre-wrap text-sm">
                                {spellcasting.additionalSpells}
                              </p>
                            )}
                            {spellcasting.notes && (
                              <p className="mt-1 whitespace-pre-wrap text-xs text-muted">
                                {spellcasting.notes}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {spellSources.map((source) => {
                  const available = spellsForSource(source)
                  const selectedForSource = s.selectedSpells.filter(
                    (spell) => spell.sourceId === source.id,
                  )
                  const limits = spellSelectionLimits(s, source)
                  const prepared = selectedForSource.filter(
                    (spell) =>
                      spell.prepared &&
                      Number(
                        spellEntries.find(
                          (entry) => entry.id === spell.contentId,
                        )?.feature.meta?.level,
                      ) > 0,
                  ).length
                  const leveledKnown = selectedForSource.filter(
                    (spell) =>
                      Number(
                        spellEntries.find(
                          (entry) => entry.id === spell.contentId,
                        )?.feature.meta?.level,
                      ) > 0,
                  ).length
                  return (
                    <div key={source.id}>
                      <Heading>{source.spellList} spell selection</Heading>
                      <div className="rounded-md border border-rule bg-card p-2">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
                          <span>
                            {source.mode === "prepared"
                              ? `Prepare up to ${limits.prepared}`
                              : source.mode === "spellbook"
                                ? `Spellbook ${leveledKnown}/${limits.known} · prepare up to ${limits.prepared}`
                                : Number.isFinite(limits.known)
                                  ? `Know up to ${limits.known} spells`
                                  : "Granted/custom spell source"}
                          </span>
                          {(source.mode === "prepared" ||
                            source.mode === "spellbook") && (
                            <span>
                              {prepared}/{limits.prepared} prepared
                            </span>
                          )}
                        </div>
                        <input
                          type="search"
                          value={spellSearch}
                          onChange={(event) =>
                            setSpellSearch(event.target.value)
                          }
                          placeholder={`Search ${source.spellList} spells`}
                          aria-label={`Search ${source.spellList} spells`}
                          className="mb-2 w-full rounded border border-rule bg-paper px-2 py-1.5 text-xs focus:border-accent"
                        />
                        <div className="space-y-2">
                          {Array.from({ length: 10 }, (_, level) => level).map(
                            (level) => {
                            const entries = available
                              .filter(
                                (entry) =>
                                  Number(entry.feature.meta?.level) === level &&
                                  entry.feature.name
                                    .toLowerCase()
                                    .includes(spellSearch.trim().toLowerCase()),
                              )
                              .sort((a, b) =>
                                a.feature.name.localeCompare(b.feature.name),
                              )
                            if (!entries.length) return null
                            const labels = [
                              "Cantrips",
                              "1st-Level Spells",
                              "2nd-Level Spells",
                              "3rd-Level Spells",
                              "4th-Level Spells",
                              "5th-Level Spells",
                              "6th-Level Spells",
                              "7th-Level Spells",
                              "8th-Level Spells",
                              "9th-Level Spells",
                            ]
                            return (
                              <details
                                key={level}
                                open={
                                  spellLevelOpen[`${source.id}:${level}`] ??
                                  level <= 1
                                }
                                onToggle={(event) => {
                                  const isOpen = event.currentTarget.open
                                  setSpellLevelOpen((current) => {
                                    const key = `${source.id}:${level}`
                                    return current[key] === isOpen
                                      ? current
                                      : {
                                          ...current,
                                          [key]: isOpen,
                                        }
                                  })
                                }}
                                className="group overflow-hidden rounded border border-rule bg-paper/30"
                              >
                                <summary className="flex cursor-pointer list-none items-center gap-2 px-2 py-1.5">
                                  <svg
                                    viewBox="0 0 24 24"
                                    className="h-3.5 w-3.5 text-muted transition-transform group-open:rotate-90"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.2"
                                    aria-hidden
                                  >
                                    <path d="m9 6 6 6-6 6" />
                                  </svg>
                                  <span className="flex-1 text-[10px] font-semibold uppercase text-muted">
                                    {labels[level]}
                                  </span>
                                  <span className="rounded bg-card px-1.5 py-0.5 text-[10px] text-muted">
                                    {entries.length}
                                  </span>
                                </summary>
                                <div className="flex flex-wrap gap-1 border-t border-rule p-2">
                                  {entries.map((entry) => {
                                    const selected = selectedForSource.find(
                                      (spell) => spell.contentId === entry.id,
                                    )
                                    return (
                                      <div
                                        key={entry.id}
                                        className="flex items-center rounded-full border border-rule"
                                      >
                                        <button
                                          type="button"
                                          aria-pressed={!!selected}
                                          onClick={() =>
                                            toggleSelectedSpell(entry, source)
                                          }
                                          className={`rounded-full px-2 py-1 text-[11px] ${
                                            selected
                                              ? "bg-accent-soft text-accent"
                                              : "text-muted"
                                          }`}
                                        >
                                          {entry.feature.name}
                                          {Number(entry.feature.meta?.level)
                                            ? ` · L${entry.feature.meta?.level}`
                                            : ""}
                                        </button>
                                        {selected &&
                                          Number(entry.feature.meta?.level) >
                                            0 &&
                                          (source.mode === "prepared" ||
                                            source.mode === "spellbook") && (
                                            <button
                                              type="button"
                                              aria-label={`${
                                                selected.prepared
                                                  ? "Unprepare"
                                                  : "Prepare"
                                              } ${entry.feature.name}`}
                                              onClick={() =>
                                                togglePreparedSpell(selected)
                                              }
                                              className={`mr-1 h-4 w-4 rounded-full border ${
                                                selected.prepared
                                                  ? "border-accent bg-accent"
                                                  : "border-muted"
                                              }`}
                                            />
                                          )}
                                      </div>
                                    )
                                  })}
                                </div>
                              </details>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </>
            )}

            {tab === "gear" && (
              <>
                <div>
                  <Heading
                    right={
                      role === "GM" ? (
                        <button
                          onClick={() =>
                            setCoinDraft({ CP: 0, SP: 0, EP: 0, GP: 0, PP: 0 })
                          }
                          className="rounded bg-pink px-2 py-1 text-[11px] font-semibold text-onpink transition-[filter] hover:brightness-95"
                        >
                          + Add coin
                        </button>
                      ) : undefined
                    }
                  >
                    Coin purse
                  </Heading>
                  <div className="grid grid-cols-5 gap-1.5">
                    {(Object.keys(s.coins) as (keyof Sheet["coins"])[]).map(
                      (c) => (
                        <Stat key={c} label={c}>
                          <span className="font-mono text-base">
                            {s.coins[c]}
                          </span>
                        </Stat>
                      ),
                    )}
                  </div>
                </div>
                <div>
                  <Heading>Armor</Heading>
                  <div className="flex items-center justify-between gap-3 rounded-md border border-rule bg-card px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {armorAc.name}
                      </div>
                      <div className="text-[11px] text-muted">
                        {armorAc.detail}
                      </div>
                    </div>
                    <div className="text-right">
                      <Label>AC</Label>
                      <div className="font-mono text-xl">
                        {armorAc.ac + s.acBonus + activeAcBonus}
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <Heading>Weapons in hand</Heading>
                  <div className="grid gap-2 @2xl:grid-cols-2">
                    {equippedWeapons.map((weapon) => {
                      return (
                        <div
                          key={weapon.id}
                          className="flex items-center gap-2 rounded-md border border-rule bg-card p-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">
                              {weapon.name || "Unnamed weapon"}
                            </div>
                            <div className="truncate text-xs text-muted">
                              {weaponUsesTwoHands(weapon)
                                ? "Both hands in use"
                                : "One hand in use"}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {hasFreeHand && (
                      <div className="rounded-md border border-dashed border-rule bg-card p-2">
                        <div className="truncate font-medium">Unarmed</div>
                        <div className="truncate text-xs text-muted">
                          {equippedWeapons.length === 0
                            ? "Both hands free"
                            : "One hand free"}
                        </div>
                      </div>
                    )}
                  </div>
                  {equippedWeapons.length === 0 && (
                    <p className="mt-1.5 text-[11px] text-muted">
                      Equip weapons from the inventory below.
                    </p>
                  )}
                </div>
                <div>
                  <Heading
                    right={
                      role === "GM" ? (
                        <button
                          onClick={() => setItemPickOpen(true)}
                          className="rounded bg-pink px-2 py-1 text-[11px] font-semibold text-onpink transition-[filter] hover:brightness-95"
                        >
                          + Add item
                        </button>
                      ) : undefined
                    }
                  >
                    Inventory
                  </Heading>
                  {s.inventory.length === 0 ? (
                    <div className="rounded-md border border-dashed border-rule bg-card px-3 py-5 text-center">
                      <div className="text-sm font-medium">No items yet</div>
                      <p className="mt-1 text-[11px] text-muted">
                        {role === "GM"
                          ? "Add a weapon, armor, ammo, gear, tool, or other item."
                          : "Your DM adds items to your sheet."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {s.inventory.map((item) => (
                        <InventoryCard
                          key={item.id}
                          item={item}
                          onEdit={
                            role === "GM"
                              ? () => setItemDraft({ ...item })
                              : undefined
                          }
                          onToggleEquip={() => toggleWeaponEquipped(item.id)}
                          onDelete={
                            role === "GM"
                              ? () => deleteInventoryItem(item)
                              : undefined
                          }
                          onConsume={() => consumeInventoryItem(item)}
                          onUseCharge={
                            item.category === "adventuring-gear"
                              ? () => useItemCharge(item)
                              : undefined
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <Heading>Skill details</Heading>
                  <div className="space-y-1.5">
                    {[...DETAIL_SKILLS.map(([n]) => n), "Vision"].map((n) => (
                      <label
                        key={n}
                        className="flex items-center gap-2 rounded-md border border-rule bg-card px-2 py-1"
                      >
                        <span className="w-24 shrink-0 text-xs text-muted">
                          {n === "Vision" ? "Other Senses" : n}
                        </span>
                        <input
                          value={s.skillNotes[n] ?? ""}
                          onChange={(e) =>
                            set("skillNotes", {
                              ...s.skillNotes,
                              [n]: e.target.value,
                            })
                          }
                          placeholder={
                            n === "Vision"
                              ? "e.g. Darkvision 60 ft., Sunlight Sensitivity"
                              : "e.g. advantage on..."
                          }
                          className="w-full min-w-0"
                        />
                      </label>
                    ))}
                  </div>
                </div>
                <Area
                  label="Defense notes"
                  v={s.defenseNotes}
                  on={(v) => set("defenseNotes", v)}
                  rows={3}
                />
                <Area
                  label="Notes"
                  v={s.notes}
                  on={(v) => set("notes", v)}
                  rows={4}
                />
              </>
            )}

            {tab === "traits" && (
              <div className="space-y-4">
                <div className="rounded-lg border border-rule bg-card p-3">
                  <div className="text-sm font-semibold">
                    Traits &amp; Features
                  </div>
                  <p className="text-[11px] text-muted">
                    Saving throws, skills, and training are automatically
                    updated when you choose your Race, Background, Class, and
                    Subclass.
                  </p>
                </div>
                <div className="grid items-start gap-4 @3xl:grid-cols-2">
                  {([
                    ["racial", "Racial Traits"],
                    ["class", "Class Features"],
                    ["subclass", "Subclass Features"],
                    ["custom-class", "Custom Class Structure"],
                    ["feat", "Feats"],
                    ["invocation", "Eldritch Invocations"],
                    ["pact-boon", "Pact Boon"],
                    ["selection", "Selections"],
                    ["other", "Other"],
                  ] as const).map(([category, label]) => {
                    const features = s.traits
                      .filter((feature) => feature.category === category)
                      .sort(
                        (a, b) =>
                          (a.source?.level ?? 0) - (b.source?.level ?? 0),
                      )
                    return (
                      <section key={category}>
                        <Heading>{label}</Heading>
                        {features.length > 0 ? (
                          <div className="space-y-1.5">
                            {features.map((feature) => (
                              <FeatureCard
                                key={feature.id}
                                feature={feature}
                                uses={(() => {
                                  const res = featureResource(
                                    s.cls,
                                    s.level,
                                    feature,
                                    scores,
                                  )
                                  if (!res) return undefined
                                  return res
                                })()}
                                onDelete={
                                  role === "GM" && !feature.key
                                    ? () => deleteFeature(feature)
                                    : undefined
                                }
                                choices={
                                  (feature.proficiencies?.skillPick ?? 0) >
                                  0 ? (
                                    <SkillChoices
                                      feature={feature}
                                      taken={grantedSkillLevels(s, feature.id)}
                                      onChange={(skillChosen) =>
                                        setS((sheet) => ({
                                          ...sheet,
                                          traits: sheet.traits.map((f) =>
                                            f.id === feature.id &&
                                            f.proficiencies
                                              ? {
                                                  ...f,
                                                  proficiencies: {
                                                    ...f.proficiencies,
                                                    skillChosen,
                                                  },
                                                }
                                              : f,
                                          ),
                                        }))
                                      }
                                    />
                                  ) : undefined
                                }
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-md border border-dashed border-rule bg-card px-3 py-4 text-center text-[11px] text-muted">
                            No {label.toLowerCase()} yet.
                          </div>
                        )}
                      </section>
                    )
                  })}
                </div>
              </div>
            )}

            {tab === "content" && (
              <div className="space-y-4">
                <section className="rounded-xl border border-rule bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold">
                        Content Library
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted">
                        Build reusable homebrew here, then apply it from the
                        character sheet.
                      </p>
                    </div>
                    <span className="rounded bg-accent-soft px-2 py-1 text-[10px] font-semibold uppercase text-accent">
                      {customContent.length} custom
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-rule pt-3">
                    <button
                      type="button"
                      onClick={() => contentFileRef.current?.click()}
                      className="min-w-0 flex-1 rounded border border-accent px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent-soft"
                    >
                      Import Homebrew
                    </button>
                    <button
                      type="button"
                      onClick={exportContentPack}
                      className="min-w-0 flex-1 rounded bg-pink px-3 py-1.5 text-xs font-semibold text-onpink hover:brightness-95"
                    >
                      Export Homebrew
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 @3xl:grid-cols-3">
                    {CONTENT_BUILDERS.map((builder) => (
                      <button
                        key={builder.type}
                        onClick={() => startContentBuilder(builder.type)}
                        className="flex min-h-20 flex-col items-start justify-end rounded-lg border border-rule bg-paper/40 p-2.5 text-left transition-colors hover:border-accent hover:bg-accent-soft"
                      >
                        <span className="text-sm font-semibold">
                          {builder.label}
                        </span>
                        <span className="mt-0.5 text-[10px] leading-snug text-muted">
                          {builder.hint}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
                <section>
                  <Heading>Browse content</Heading>
                  <div className="space-y-2">
                    {([
                      [
                        "SRD 5.1",
                        visibleContent.filter((entry) => entry.builtin),
                      ],
                      [
                        "Custom Content",
                        visibleContent.filter((entry) => !entry.builtin),
                      ],
                    ] as [string, ContentEntry[]][])
                      .filter(([, entries]) => entries.length > 0)
                      .map(([source, entries]) => (
                        <details
                          key={source}
                          className="group overflow-hidden rounded-md border border-rule bg-card"
                        >
                          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2">
                            <svg
                              viewBox="0 0 24 24"
                              className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-90"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              aria-hidden
                            >
                              <path d="m9 6 6 6-6 6" />
                            </svg>
                            <span className="min-w-0 flex-1 text-sm font-semibold">
                              {source}
                            </span>
                            <span className="rounded bg-paper px-1.5 py-0.5 text-[10px] text-muted">
                              {entries.length}
                            </span>
                          </summary>
                          <div className="space-y-1.5 border-t border-rule p-2">
                            {CONTENT_TYPE_ORDER.map((type) => ({
                              type,
                              group: entries.filter(
                                (entry) => entry.type === type,
                              ),
                            }))
                              .filter(({ group }) => group.length > 0)
                              .map(({ type, group }) => (
                                <details
                                  key={type}
                                  className="group/type overflow-hidden rounded-md border border-rule bg-paper/30"
                                >
                                  <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-2">
                                    <svg
                                      viewBox="0 0 24 24"
                                      className="h-3.5 w-3.5 shrink-0 text-muted transition-transform group-open/type:rotate-90"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2.2"
                                      strokeLinecap="round"
                                      aria-hidden
                                    >
                                      <path d="m9 6 6 6-6 6" />
                                    </svg>
                                    <span className="min-w-0 flex-1 text-sm font-semibold">
                                      {CONTENT_TYPE_LABELS[type]}
                                    </span>
                                    <span className="rounded bg-paper px-1.5 py-0.5 text-[10px] text-muted">
                                      {group.length}
                                    </span>
                                  </summary>
                                  <div className="space-y-1.5 border-t border-rule p-2">
                                    {group.map((entry) => {
                                      const features = contentFeatures(entry)
                                      return (
                                        <details
                                          key={`${
                                            entry.builtin ? "builtin" : "custom"
                                          }-${entry.id}`}
                                          className="group/item overflow-hidden rounded-md border border-rule bg-card"
                                        >
                                          <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-2">
                                            <svg
                                              viewBox="0 0 24 24"
                                              className="h-3.5 w-3.5 shrink-0 text-muted transition-transform group-open/item:rotate-90"
                                              fill="none"
                                              stroke="currentColor"
                                              strokeWidth="2.2"
                                              strokeLinecap="round"
                                              aria-hidden
                                            >
                                              <path d="m9 6 6 6-6 6" />
                                            </svg>
                                            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                                              {contentName(entry)}
                                            </span>
                                            {entry.type === "subrace" &&
                                              entry.feature.source
                                                ?.parentName && (
                                                <span className="shrink-0 text-[10px] text-muted">
                                                  {
                                                    entry.feature.source
                                                      .parentName
                                                  }
                                                </span>
                                              )}
                                            {entry.type === "subclass" &&
                                              entry.feature.source
                                                ?.className && (
                                                <span className="shrink-0 text-[10px] text-muted">
                                                  {
                                                    entry.feature.source
                                                      .className
                                                  }
                                                </span>
                                              )}
                                          </summary>
                                          <div className="space-y-2 border-t border-rule p-2.5">
                                            {entry.feature.description && (
                                              <p className="whitespace-pre-wrap text-xs text-muted">
                                                {entry.feature.description}
                                              </p>
                                            )}
                                            {features.length > 0 && (
                                              <div className="space-y-1">
                                                <div className="text-[10px] font-semibold uppercase text-muted">
                                                  Includes {features.length}{" "}
                                                  {features.length === 1
                                                    ? "feature"
                                                    : "features"}
                                                </div>
                                                {features.map((feature) => (
                                                  <details
                                                    key={feature.id}
                                                    className="group/feat rounded border border-rule/70 bg-paper/40"
                                                  >
                                                    <summary className="flex cursor-pointer list-none items-center gap-2 px-2 py-1.5">
                                                      <svg
                                                        viewBox="0 0 24 24"
                                                        className="h-3 w-3 shrink-0 text-muted transition-transform group-open/feat:rotate-90"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2.2"
                                                        strokeLinecap="round"
                                                        aria-hidden
                                                      >
                                                        <path d="m9 6 6 6-6 6" />
                                                      </svg>
                                                      <span className="min-w-0 flex-1 truncate text-xs font-medium">
                                                        {feature.name}
                                                      </span>
                                                      {(feature.source?.level ??
                                                        1) > 1 && (
                                                        <span className="shrink-0 text-[10px] text-muted">
                                                          Lv{" "}
                                                          {
                                                            feature.source
                                                              ?.level
                                                          }
                                                        </span>
                                                      )}
                                                    </summary>
                                                    <p className="border-t border-rule/70 px-2 py-1.5 text-[11px] leading-relaxed text-muted">
                                                      {feature.description}
                                                    </p>
                                                  </details>
                                                ))}
                                              </div>
                                            )}
                                            {entry.type === "selection" &&
                                              entry.feature.meta?.options && (
                                                <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-muted">
                                                  {entry.feature.meta.options
                                                    .split("\n")
                                                    .filter(Boolean)
                                                    .map((option) => (
                                                      <li key={option}>
                                                        {option}
                                                      </li>
                                                    ))}
                                                </ul>
                                              )}
                                            <div className="grid gap-1.5">
                                              <button
                                                onClick={() =>
                                                  applyContent(entry)
                                                }
                                                className="w-full rounded bg-pink px-3 py-1.5 text-xs font-semibold text-onpink"
                                              >
                                                {entry.type === "item"
                                                  ? "Add to inventory"
                                                  : entry.type === "spell"
                                                    ? "Add to spell list"
                                                    : "Apply to character"}
                                              </button>
                                              {!entry.builtin && (
                                                <button
                                                  onClick={() =>
                                                    startContentBuilder(
                                                      entry.type,
                                                      entry,
                                                    )
                                                  }
                                                  className="w-full rounded border border-accent px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent-soft"
                                                >
                                                  Edit content
                                                </button>
                                              )}
                                              {!entry.builtin && (
                                                <button
                                                  onClick={() =>
                                                    deleteContent(entry)
                                                  }
                                                  className="w-full rounded px-3 py-1.5 text-xs text-muted hover:bg-accent-soft hover:text-danger"
                                                >
                                                  Delete content
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        </details>
                                      )
                                    })}
                                  </div>
                                </details>
                              ))}
                          </div>
                        </details>
                      ))}
                  </div>
                </section>
              </div>
            )}

            {tab === "log" && (
              <div>
                <Heading
                  right={
                    <button
                      onClick={() => setRolls([])}
                      disabled={rolls.length === 0}
                      aria-label="Clear roll log"
                      title="Clear roll log on this device"
                      className="text-muted transition-colors hover:text-danger disabled:opacity-40"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
                      </svg>
                    </button>
                  }
                >
                  Room rolls
                </Heading>
                {rolls.length === 0 && (
                  <p className="py-6 text-center text-muted">
                    No rolls yet. Tap an ability, skill or attack.
                  </p>
                )}
                <ul>
                  {rolls.map((r) => (
                    <li
                      key={r.id}
                      className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-rule/60 px-2 py-2 ${
                        r.die === "d20" && r.face === 20
                          ? "bg-green-700/40"
                          : r.die === "d20" && r.face === 1
                            ? "bg-red-700/40"
                            : ""
                      }`}
                    >
                      <span className="truncate text-xs font-semibold">
                        {r.characterName || r.playerName}
                      </span>
                      <span
                        className={`row-span-2 self-center font-mono text-xs ${
                          r.die === "d20" && r.face === 20
                            ? "text-accent"
                            : r.die === "d20" && r.face === 1
                              ? "text-danger"
                              : "text-muted"
                        }`}
                      >
                        {rollExpr(r)}{" "}
                        <span className="text-xl font-bold text-ink">
                          {r.total}
                        </span>
                      </span>
                      <span className="truncate text-[11px] text-muted">
                        {r.label}
                        {r.note && ` · ${r.note}`}
                        {r.die === "d20" && r.face === 20 && " · crit"}
                        {r.die === "d20" && r.face === 1 && " · fumble"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {legalOpen && (
            <div
              className="absolute inset-0 z-50 grid place-items-center bg-black/50 p-4"
              onMouseDown={() => setLegalOpen(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="SRD 5.1 license and content policy"
                onMouseDown={(event) => event.stopPropagation()}
                className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border border-rule bg-card p-4 shadow-xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold">
                      SRD 5.1 &amp; custom content
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      Built-in data is limited to SRD-compatible mechanics.
                      Homebrew and other material must be supplied by the user.
                    </p>
                  </div>
                  <button
                    onClick={() => setLegalOpen(false)}
                    aria-label="Close license notice"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xl text-muted hover:bg-accent-soft"
                  >
                    ×
                  </button>
                </div>
                <div className="mt-3 space-y-3 text-sm leading-relaxed">
                  <p>
                    This work includes material from the System Reference
                    Document 5.1 (“SRD 5.1”) by Wizards of the Coast LLC,
                    available at
                    dnd.wizards.com/resources/systems-reference-document. The
                    SRD 5.1 is licensed under Creative Commons Attribution 4.0
                    International.
                  </p>
                  <p>License: creativecommons.org/licenses/by/4.0/</p>
                  <p>
                    Dungeons &amp; Dragons and related trademarks are property
                    of Wizards of the Coast LLC. This application is not
                    affiliated with or endorsed by Wizards of the Coast.
                  </p>
                  <div className="rounded-md border border-rule bg-paper/40 p-3">
                    <div className="font-semibold">Content pack policy</div>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted">
                      <li>
                        Only import or share content you created or have
                        permission to use.
                      </li>
                      <li>
                        The application does not provide a catalog of non-SRD
                        classes, subclasses, spells, or items.
                      </li>
                      <li>
                        Imported content remains local unless you explicitly
                        export or share it.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) importJson(file)
              e.target.value = ""
            }}
          />
          <input
            ref={contentFileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void importContentPack(file)
              event.target.value = ""
            }}
          />

          {/* Last roll toast */}
          {lastRoll && lastRoll.id !== hiddenRollId && tab !== "log" && (
            <div className="pointer-events-none sticky bottom-3 z-10 flex justify-center px-3">
              <button
                onClick={() => setTab("log")}
                className={`pointer-events-auto w-full max-w-md rounded-xl px-4 py-2 text-white shadow-lg ${
                  lastRoll.die === "d20" && lastRoll.face === 20
                    ? "bg-green-800"
                    : lastRoll.die === "d20" && lastRoll.face === 1
                      ? "bg-red-800"
                      : "bg-head"
                }`}
              >
                {lastRoll.characterName && (
                  <span className="block truncate text-left text-[10px] leading-tight opacity-70">
                    {lastRoll.playerName}
                  </span>
                )}
                <span className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 text-left text-xs font-bold uppercase leading-snug [overflow-wrap:anywhere]">
                    {lastRoll.characterName || lastRoll.playerName}{" "}
                    <span className="font-medium opacity-75">rolled</span>{" "}
                    <span className="text-pink">{lastRoll.label}</span>
                    {lastRoll.die === "d20" && lastRoll.face === 20 && (
                      <span className="ml-1.5 rounded bg-white/20 px-1 text-[10px]">
                        Crit
                      </span>
                    )}
                    {lastRoll.die === "d20" && lastRoll.face === 1 && (
                      <span className="ml-1.5 rounded bg-white/20 px-1 text-[10px]">
                        Fumble
                      </span>
                    )}
                  </span>
                  <span aria-hidden className="h-8 w-px shrink-0 bg-white/30" />
                  <span className="min-w-[2ch] text-center font-mono text-3xl font-bold leading-none">
                    {lastRoll.total}
                  </span>
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------- small parts ---------- */

function InventoryCard({
  item,
  onEdit,
  onDelete,
  onToggleEquip,
  onConsume,
  onUseCharge,
}: {
  item: InventoryItem
  onToggleEquip: () => void
  onEdit?: () => void
  onDelete?: () => void
  onConsume: () => void
  onUseCharge?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const category =
    ITEM_CATEGORIES.find((entry) => entry.value === item.category)?.label ??
    "Item"
  let detail = ""
  const consumable =
    item.category === "ammo" ||
    (item.category === "adventuring-gear" && item.consumable)
  if (item.category === "weapon") {
    detail = [
      item.damageDice &&
        `${item.damageDice}${
          item.damageBonus ? ` ${sgn(item.damageBonus)}` : ""
        }`,
      item.damageType,
      weaponRange(item),
      item.props
        .map((p) => WEAPON_PROPS.find((x) => x.id === p)?.label)
        .join(", "),
    ]
      .filter(Boolean)
      .join(" · ")
  } else if (item.category === "armor") {
    detail =
      item.armorMode === "base"
        ? `AC ${item.baseAc}${
            item.dexMode === "full"
              ? " + DEX"
              : item.dexMode === "max"
                ? ` + DEX (max ${sgn(item.maxDex)})`
                : ""
          }`
        : `${sgn(item.acBonus)} AC bonus`
  } else if (item.category === "ammo") {
    detail = [
      item.ammoType,
      item.compatibleWeapon && `for ${item.compatibleWeapon}`,
    ]
      .filter(Boolean)
      .join(" · ")
  } else if (item.category === "adventuring-gear") {
    detail =
      item.maxCharges > 0
        ? `${item.charges}/${item.maxCharges} charges · cost ${Math.max(
            1,
            item.chargeCost,
          )} · ${
            item.chargeRecharge === "manual"
              ? "manual recharge"
              : `${item.chargeRecharge} recharge`
          }`
        : item.usage
  } else if (item.category === "tool") {
    const proficiency =
      item.proficiency === 2
        ? "Expertise"
        : item.proficiency === 1
          ? "Proficient"
          : ""
    detail = [
      item.linkedAbility,
      proficiency,
      item.miscBonus ? sgn(item.miscBonus) : "",
    ]
      .filter(Boolean)
      .join(" · ")
  }

  return (
    <div className="rounded-md border border-rule bg-card p-2">
      <div className="flex min-w-0 items-start gap-2">
        <button
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className="min-w-0 flex-1 text-left"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-semibold">
              {item.name || "Unnamed item"}
            </span>
            {item.category === "weapon" && (
              <span className="shrink-0 rounded border border-rule px-1.5 py-0.5 text-[9px] font-semibold uppercase text-muted">
                {item.weaponClass} {item.weaponKind}
              </span>
            )}
            {(item.category === "armor" || item.category === "weapon") &&
              item.equipped && (
                <span className="shrink-0 rounded bg-accent-soft px-1.5 py-0.5 text-[9px] font-semibold uppercase text-accent">
                  Equipped
                </span>
              )}
          </span>
          <span className="mt-0.5 block truncate text-[10px] uppercase tracking-wide text-muted">
            {category} · Qty {item.quantity}
            {item.weight ? ` · ${item.weight} weight each` : ""}
            {item.value ? ` · ${item.value} CP` : ""}
          </span>
          {detail && !expanded && (
            <span className="mt-1 block truncate text-xs text-muted">
              {detail}
            </span>
          )}
        </button>
        <div className="flex shrink-0 items-center">
          {item.category === "adventuring-gear" &&
            item.maxCharges > 0 &&
            onUseCharge && (
              <button
                onClick={onUseCharge}
                disabled={item.charges < Math.max(1, item.chargeCost)}
                className="mr-1 h-7 rounded border border-accent px-2 text-[11px] font-semibold text-accent hover:bg-accent-soft disabled:cursor-not-allowed disabled:border-rule disabled:text-muted"
              >
                Use {Math.max(1, item.chargeCost)} charge
                {Math.max(1, item.chargeCost) === 1 ? "" : "s"}
              </button>
            )}
          {consumable && (
            <button
              onClick={onConsume}
              disabled={item.quantity <= 0}
              className="mr-1 h-7 rounded border border-accent px-2 text-[11px] font-semibold text-accent hover:bg-accent-soft disabled:cursor-not-allowed disabled:border-rule disabled:text-muted"
            >
              {item.category === "ammo" ? "Consume" : "Use"}
            </button>
          )}
          {item.category === "weapon" && (
            <button
              onClick={onToggleEquip}
              aria-pressed={item.equipped}
              className={`mr-1 h-7 rounded px-2 text-[11px] font-semibold ${
                item.equipped
                  ? "bg-pink text-onpink"
                  : "border border-accent text-accent hover:bg-accent-soft"
              }`}
            >
              {item.equipped ? "Unequip" : "Equip"}
            </button>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              aria-label={`Edit ${item.name}`}
              title="Edit"
              className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-accent-soft hover:text-ink"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              aria-label={`Delete ${item.name}`}
              title="Delete"
              className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-accent-soft hover:text-danger"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" />
              </svg>
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="mt-2 space-y-1 border-t border-rule pt-2">
          {detail && <p className="text-xs text-muted">{detail}</p>}
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {item.description || (
              <span className="text-muted">No description or notes.</span>
            )}
          </p>
        </div>
      )}
    </div>
  )
}

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]
const POINT_BUY_COST: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
}
const POINT_BUY_TOTAL = 27
const ABILITY_METHODS: { id: AbilityMethod; label: string }[] = [
  { id: "manual", label: "Manual" },
  { id: "standard", label: "Standard array" },
  { id: "point-buy", label: "Point buy" },
  { id: "roll", label: "4d6 roll" },
]

// Roll 4d6 and drop the lowest die.
function roll4d6DropLowest() {
  const dice = Array.from(
    { length: 4 },
    () => 1 + Math.floor(Math.random() * 6),
  ).sort((a, b) => a - b)
  return dice[1] + dice[2] + dice[3]
}

function SkillChoices({
  feature,
  taken,
  onChange,
}: {
  feature: Feature
  taken: Map<string, 1 | 2>
  onChange: (chosen: string[]) => void
}) {
  const p = feature.proficiencies
  if (!p || p.skillPick <= 0) return null
  const pool = p.skillFrom.length ? p.skillFrom : ALL_SKILLS
  const chosen = p.skillChosen.slice(0, p.skillPick).filter(Boolean)
  const full = chosen.length >= p.skillPick
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="font-semibold">
          Choose {p.skillPick} skill{p.skillPick === 1 ? "" : "s"}
        </span>
        <span
          className={chosen.length < p.skillPick ? "text-danger" : "text-muted"}
        >
          {chosen.length}/{p.skillPick}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {pool.map((skill) => {
          const on = chosen.includes(skill)
          const blocked = !on && (full || taken.has(skill))
          return (
            <button
              key={skill}
              type="button"
              disabled={blocked}
              aria-pressed={on}
              title={
                !on && taken.has(skill)
                  ? "Already proficient from another source"
                  : undefined
              }
              onClick={() =>
                onChange(
                  on ? chosen.filter((n) => n !== skill) : [...chosen, skill],
                )
              }
              className={`rounded-full border px-2 py-0.5 text-[11px] ${
                on
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-rule text-muted"
              } disabled:opacity-40`}
            >
              {skill}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function AbilitySetup({
  s,
  update,
}: {
  s: Sheet
  update: (f: (p: Sheet) => Sheet) => void
}) {
  const method = s.abilityMethod
  const setScores = (scores: Sheet["scores"], extra: Partial<Sheet> = {}) =>
    update((p) => ({ ...p, scores, ...extra }))
  const fromList = (values: number[]) =>
    Object.fromEntries(
      ABILITIES.map((a, i) => [a, values[i] ?? 10]),
    ) as Sheet["scores"]
  const rollAll = () => {
    const rolls = Array.from({ length: 6 }, roll4d6DropLowest)
    setScores(fromList(rolls), { abilityMethod: "roll", abilityRolls: rolls })
  }
  const chooseMethod = (m: AbilityMethod) => {
    if (m === "standard")
      setScores(fromList(STANDARD_ARRAY), { abilityMethod: m })
    else if (m === "point-buy")
      setScores(fromList([8, 8, 8, 8, 8, 8]), { abilityMethod: m })
    else if (m === "roll") {
      if (s.abilityRolls.length === 6)
        setScores(fromList(s.abilityRolls), { abilityMethod: m })
      else rollAll()
    } else update((p) => ({ ...p, abilityMethod: m }))
  }
  // Swap the chosen value with whichever ability currently holds it, like OrcPub's swap controls.
  const assign = (a: Ab, value: number) => {
    const other = ABILITIES.find((x) => x !== a && s.scores[x] === value)
    const next = { ...s.scores, [a]: value }
    if (other) next[other] = s.scores[a]
    setScores(next)
  }
  const pool = method === "standard" ? STANDARD_ARRAY : s.abilityRolls
  const used = ABILITIES.reduce(
    (sum, a) => sum + (POINT_BUY_COST[s.scores[a]] ?? 0),
    0,
  )
  const remaining = POINT_BUY_TOTAL - used
  const asiFeatures = s.traits
    .filter(isAsiFeature)
    .sort((a, b) => (a.source?.level ?? 1) - (b.source?.level ?? 1))
  const skillFeatures = s.traits.filter(
    (f) => (f.proficiencies?.skillPick ?? 0) > 0,
  )
  const setAsi = (id: string, value: string) =>
    update((p) => ({ ...p, asiChoices: { ...p.asiChoices, [id]: value } }))
  const setChosen = (id: string, skillChosen: string[]) =>
    update((p) => ({
      ...p,
      traits: p.traits.map((f) =>
        f.id === id && f.proficiencies
          ? { ...f, proficiencies: { ...f.proficiencies, skillChosen } }
          : f,
      ),
    }))
  const abSelect = (value: Ab, onChange: (a: Ab) => void) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Ab)}
      className="rounded border border-rule bg-card px-1 py-0.5 text-xs"
    >
      {ABILITIES.map((a) => (
        <option key={a}>{a}</option>
      ))}
    </select>
  )
  return (
    <div className="space-y-4 rounded-xl border border-rule bg-card p-3">
      <div>
        <Heading>Ability score method</Heading>
        <div className="flex flex-wrap gap-1">
          {ABILITY_METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={method === m.id}
              onClick={() => chooseMethod(m.id)}
              className={`rounded-full border px-2.5 py-1 text-[11px] ${
                method === m.id
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-rule text-muted"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {(method === "standard" || method === "roll") && (
          <div className="mt-2">
            <div className="grid grid-cols-3 gap-2 @2xl:grid-cols-6">
              {ABILITIES.map((a) => (
                <label
                  key={a}
                  className="block border-b border-rule text-center"
                >
                  <span className="block text-[10px] text-muted">{a}</span>
                  <select
                    value={s.scores[a]}
                    onChange={(e) => assign(a, Number(e.target.value))}
                    className="w-full bg-transparent text-center font-mono text-sm"
                  >
                    {[...new Set(pool)]
                      .sort((x, y) => y - x)
                      .map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                  </select>
                </label>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-muted">
              Pick a value for an ability; the ability that held it takes the
              old value.
            </p>
            {method === "roll" && (
              <button
                type="button"
                onClick={rollAll}
                className="mt-2 rounded bg-pink px-3 py-1 text-xs text-onpink hover:brightness-95"
              >
                Reroll all (4d6, drop lowest)
              </button>
            )}
          </div>
        )}
        {method === "point-buy" && (
          <div className="mt-2">
            <div className="mb-1 flex justify-between text-[11px]">
              <span className="text-muted">Points remaining</span>
              <span
                className={
                  remaining < 0 ? "font-semibold text-danger" : "font-semibold"
                }
              >
                {remaining} / {POINT_BUY_TOTAL}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 @2xl:grid-cols-6">
              {ABILITIES.map((a) => {
                const v = s.scores[a]
                const canUp =
                  v < 15 &&
                  (POINT_BUY_COST[v + 1] ?? 99) - (POINT_BUY_COST[v] ?? 0) <=
                    remaining
                return (
                  <div key={a} className="text-center">
                    <span className="block text-[10px] text-muted">{a}</span>
                    <span className="block font-mono text-sm">{v}</span>
                    <span className="block text-[10px] text-muted">
                      {POINT_BUY_COST[v] ?? 0} pts
                    </span>
                    <div className="mt-0.5 flex justify-center gap-1">
                      <button
                        type="button"
                        disabled={v <= 8}
                        aria-label={`Lower ${a}`}
                        onClick={() => setScores({ ...s.scores, [a]: v - 1 })}
                        className="h-6 w-6 rounded bg-pink text-onpink disabled:opacity-40"
                      >
                        -
                      </button>
                      <button
                        type="button"
                        disabled={!canUp}
                        aria-label={`Raise ${a}`}
                        onClick={() => setScores({ ...s.scores, [a]: v + 1 })}
                        className="h-6 w-6 rounded bg-pink text-onpink disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {method === "manual" && (
          <p className="text-[11px] text-muted">
            Edit the small score under each ability directly.
          </p>
        )}
      </div>

      {skillFeatures.length > 0 && (
        <div>
          <Heading>Skill choices</Heading>
          <div className="space-y-3">
            {skillFeatures.map((f) => (
              <div key={f.id} className="rounded-md border border-rule p-2">
                <div className="mb-1 text-xs font-semibold">{f.name}</div>
                <SkillChoices
                  feature={f}
                  taken={grantedSkillLevels(s, f.id)}
                  onChange={(c) => setChosen(f.id, c)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {asiFeatures.length > 0 && (
        <div>
          <Heading>Ability Score Improvements</Heading>
          <div className="space-y-2">
            {asiFeatures.map((f) => {
              const choice = s.asiChoices[f.id] ?? ""
              const picked = ABILITIES.filter((a) => parseAsi(choice)[a])
              const mode =
                choice === "feat"
                  ? "feat"
                  : picked.length === 1
                    ? "+2"
                    : picked.length === 2
                      ? "+1/+1"
                      : ""
              return (
                <div
                  key={f.id}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-rule p-2 text-xs"
                >
                  <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[9px] font-semibold uppercase text-accent">
                    Lv {f.source?.level ?? 1}
                  </span>
                  <select
                    value={mode}
                    onChange={(e) => {
                      const m = e.target.value
                      setAsi(
                        f.id,
                        m === "+2"
                          ? "STR:2"
                          : m === "+1/+1"
                            ? "STR:1,DEX:1"
                            : m === "feat"
                              ? "feat"
                              : "",
                      )
                    }}
                    className="rounded border border-rule bg-card px-1 py-0.5"
                  >
                    <option value="">Not chosen</option>
                    <option value="+2">+2 to one score</option>
                    <option value="+1/+1">+1 to two scores</option>
                    <option value="feat">Take a feat</option>
                  </select>
                  {mode === "+2" &&
                    abSelect(picked[0], (a) => setAsi(f.id, `${a}:2`))}
                  {mode === "+1/+1" && (
                    <>
                      {abSelect(picked[0], (a) =>
                        setAsi(
                          f.id,
                          formatAsi(
                            a === picked[1]
                              ? { [a]: 2 }
                              : { [a]: 1, [picked[1]]: 1 },
                          ),
                        ),
                      )}
                      {abSelect(picked[1], (a) =>
                        setAsi(
                          f.id,
                          formatAsi(
                            a === picked[0]
                              ? { [a]: 2 }
                              : { [picked[0]]: 1, [a]: 1 },
                          ),
                        ),
                      )}
                    </>
                  )}
                  {mode === "feat" && (
                    <span className="text-muted">
                      Add the feat from Browse content.
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          <p className="mt-1 text-[11px] text-muted">
            Scores from improvements stop at 20.
          </p>
        </div>
      )}
    </div>
  )
}

function FeatureCard({
  feature,
  uses,
  onEdit,
  onDelete,
  choices,
}: {
  feature: Feature
  uses?: {
    max: number
    used: number
    recharge: Recharge
  }
  onEdit?: () => void
  onDelete?: () => void
  choices?: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  const granted = feature.proficiencies
    ? [
        feature.proficiencies.saves.length
          ? `Saving throws: ${feature.proficiencies.saves.join(", ")}`
          : "",
        feature.proficiencies.armor.length
          ? `Armor: ${feature.proficiencies.armor.join(", ")}`
          : "",
        feature.proficiencies.weapons.length
          ? `Weapons: ${feature.proficiencies.weapons.map((group) => `${group} weapons`).join(", ")}`
          : "",
        feature.proficiencies.specificWeapons
          ? `Specific weapons: ${feature.proficiencies.specificWeapons}`
          : "",
        [
          ...feature.proficiencies.tools
            .split(/[,;\n]/)
            .map((entry) => entry.trim())
            .filter(Boolean),
          ...feature.proficiencies.toolChosen
            .slice(
              0,
              feature.proficiencies.toolPick ||
                feature.proficiencies.toolChosen.length,
            )
            .filter(Boolean),
        ].length
          ? `Tools: ${[
              ...feature.proficiencies.tools
                .split(/[,;\n]/)
                .map((entry) => entry.trim())
                .filter(Boolean),
              ...feature.proficiencies.toolChosen
                .slice(
                  0,
                  feature.proficiencies.toolPick ||
                    feature.proficiencies.toolChosen.length,
                )
                .filter(Boolean),
            ].join(", ")}`
          : "",
        feature.proficiencies.languages
          ? `Languages: ${feature.proficiencies.languages}`
          : "",
        [
          ...feature.proficiencies.skills,
          ...feature.proficiencies.skillChosen
            .slice(0, feature.proficiencies.skillPick)
            .filter(Boolean),
        ].length
          ? `Skills: ${[...feature.proficiencies.skills, ...feature.proficiencies.skillChosen.slice(0, feature.proficiencies.skillPick).filter(Boolean)].join(", ")}`
          : "",
        [
          ...feature.proficiencies.expertise,
          ...feature.proficiencies.expertiseChosen
            .slice(0, feature.proficiencies.expertisePick)
            .filter(Boolean),
        ].length
          ? `Expertise: ${[...feature.proficiencies.expertise, ...feature.proficiencies.expertiseChosen.slice(0, feature.proficiencies.expertisePick).filter(Boolean)].join(", ")}`
          : "",
      ].filter(Boolean)
    : []
  const effectLines =
    feature.effects && feature.proficiencies
      ? [
          feature.proficiencies.sections.includes("modifier")
            ? `${feature.effects.modifier.target}: ${sgn(feature.effects.modifier.value)}${
                feature.effects.modifier.condition
                  ? ` · ${feature.effects.modifier.condition}`
                  : ""
              }`
            : "",
          feature.proficiencies.sections.includes("defense")
            ? `Defense: ${[feature.effects.defense.resistances && `resist ${feature.effects.defense.resistances}`, feature.effects.defense.immunities && `immune ${feature.effects.defense.immunities}`, feature.effects.defense.conditionImmunities && `condition immune ${feature.effects.defense.conditionImmunities}`, feature.effects.defense.notes].filter(Boolean).join(" · ")}`
            : "",
          feature.proficiencies.sections.includes("movement")
            ? `${feature.effects.movement.mode}: ${feature.effects.movement.distance || "—"} ft.${
                feature.effects.movement.senses
                  ? ` · ${feature.effects.movement.senses}`
                  : ""
              }`
            : "",
          feature.proficiencies.sections.includes("spellcasting")
            ? `Spellcasting: ${feature.effects.spellcasting.ability || "custom"} · ${feature.effects.spellcasting.progression}`
            : "",
          feature.proficiencies.sections.includes("action")
            ? `${feature.effects.action.actionType}: ${[feature.effects.action.attackType, feature.effects.action.damageDice, feature.effects.action.damageType, feature.effects.action.range].filter((value) => value && value !== "None").join(" · ")}`
            : "",
          ...feature.effects.custom.map((entry) =>
            entry.label ? `${entry.label}: ${entry.value}` : entry.value,
          ),
        ].filter(Boolean)
      : []
  return (
    <div className="rounded-md border border-rule bg-card">
      <div className="flex min-w-0 flex-wrap items-center gap-1 p-2">
        <button
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <svg
            viewBox="0 0 24 24"
            className={`h-4 w-4 shrink-0 text-muted transition-transform ${
              expanded ? "rotate-90" : ""
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="m9 6 6 6-6 6" />
          </svg>
          <span className="truncate text-sm font-semibold">
            {feature.name || "Unnamed feature"}
          </span>
        </button>
        {uses && !Number.isFinite(uses.max) && (
          <span className="shrink-0 rounded bg-accent-soft px-2 py-0.5 text-[11px] font-semibold uppercase text-accent">
            Unlimited
          </span>
        )}
        {uses && Number.isFinite(uses.max) && uses.max > 8 && (
          <div
            className="flex shrink-0 items-center"
            aria-label={`${feature.name} uses`}
          >
            <span className="rounded bg-paper px-2 py-0.5 text-center font-mono text-xs">
              {uses.max - uses.used}/{uses.max}
            </span>
          </div>
        )}
        {uses && Number.isFinite(uses.max) && uses.max <= 8 && (
          <div
            className="flex shrink-0 items-center gap-1"
            role="group"
            aria-label={`${feature.name} uses`}
          >
            {Array.from({ length: uses.max }).map((_, i) => {
              const available = i < uses.max - uses.used
              return (
                <span
                  key={i}
                  aria-label={available ? "Available use" : "Expended use"}
                  className={`h-4 w-4 rounded-full border transition-colors ${
                    available
                      ? "border-accent bg-accent"
                      : "border-muted bg-muted/40"
                  }`}
                />
              )
            })}
          </div>
        )}
        {feature.source &&
          (feature.category === "class" || feature.category === "subclass") && (
            <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[9px] font-semibold uppercase text-accent">
              Lv {feature.source.level}
            </span>
          )}
        {feature.category === "subclass" && (
          <span className="rounded border border-rule px-1.5 py-0.5 text-[9px] font-semibold uppercase text-muted">
            Subclass
          </span>
        )}
        {feature.category === "custom-class" && (
          <span className="rounded border border-rule px-1.5 py-0.5 text-[9px] font-semibold uppercase text-muted">
            d{feature.source?.hitDie ?? 8}
          </span>
        )}
        {feature.key && (
          <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[9px] font-semibold uppercase text-accent">
            Class
          </span>
        )}
        {onEdit && (
          <button
            onClick={onEdit}
            aria-label={`Edit ${feature.name}`}
            title="Edit"
            className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-accent-soft hover:text-ink"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
            </svg>
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            aria-label={`Delete ${feature.name}`}
            title="Delete"
            className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-accent-soft hover:text-danger"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" />
            </svg>
          </button>
        )}
      </div>
      {choices && <div className="border-t border-rule p-2">{choices}</div>}
      {expanded && (
        <div className="border-t border-rule px-3 py-2">
          {uses && (
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
              {!Number.isFinite(uses.max)
                ? "Unlimited uses"
                : `${uses.max - uses.used}/${uses.max} left`}{" "}
              ·{" "}
              {uses.recharge === "manual"
                ? "manual reset"
                : `resets on ${
                    uses.recharge === "short"
                      ? "short or long rest"
                      : uses.recharge === "long"
                        ? "long rest"
                        : "dawn"
                  }`}
            </div>
          )}
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {feature.description || (
              <span className="text-muted">No description.</span>
            )}
          </p>
          {feature.source &&
            (feature.source.className || feature.source.subclassName) && (
              <p className="mt-1 text-[11px] text-muted">
                {[
                  feature.source.className,
                  feature.source.subclassName,
                  feature.category !== "custom-class" &&
                    `Level ${feature.source.level}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          {granted.length > 0 && (
            <div className="mt-2 rounded border border-accent/40 bg-accent-soft p-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-accent">
                Granted proficiencies
              </div>
              {granted.map((line) => (
                <div key={line} className="mt-0.5 text-xs">
                  {line}
                </div>
              ))}
            </div>
          )}
          {effectLines.length > 0 && (
            <div className="mt-2 rounded border border-rule bg-paper/40 p-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                Feature effects
              </div>
              {effectLines.map((line) => (
                <div key={line} className="mt-0.5 whitespace-pre-wrap text-xs">
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ItemEditor({
  item,
  onChange,
}: {
  item: InventoryItem
  onChange: (item: InventoryItem) => void
}) {
  const setCommon = (values: Partial<ItemBase>) =>
    onChange({ ...item, ...values } as InventoryItem)
  const numberValue = (value: string) => Number(value) || 0
  const inputClass =
    "w-full border-b border-rule pb-1 text-sm focus:border-accent"
  const selectClass =
    "w-full border-b border-rule pb-1 text-sm focus:border-accent"

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2 block">
          <span className="block text-[10px] text-muted">Custom item name</span>
          <input
            autoFocus
            value={item.name}
            onChange={(event) => setCommon({ name: event.target.value })}
            placeholder="e.g. your own item name"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="block text-[10px] text-muted">Quantity</span>
          <IntInput
            value={item.quantity}
            min={0}
            onChange={(n) => setCommon({ quantity: n })}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="block text-[10px] text-muted">
            Weight each (whole numbers)
          </span>
          <IntInput
            value={item.weight}
            min={0}
            onChange={(n) => setCommon({ weight: n })}
            className={inputClass}
          />
        </label>
        <label className="col-span-2 block">
          <span className="block text-[10px] text-muted">
            Value (in CP, copper base)
          </span>
          <IntInput
            value={item.value}
            min={0}
            onChange={(n) => setCommon({ value: n })}
            className={inputClass}
          />
          <span className="mt-0.5 block text-[10px] text-muted">
            1 SP = 10 CP · 1 GP = 100 CP · 1 PP = 1000 CP
          </span>
        </label>
      </div>

      {item.category === "weapon" && (
        <WeaponEditor item={item} onChange={onChange} inputClass={inputClass} />
      )}

      {item.category === "armor" && (
        <div>
          <Heading>Armor statistics</Heading>
          <div className="grid grid-cols-2 gap-3 rounded-md border border-rule bg-paper/40 p-3">
            <label className="col-span-2 block">
              <span className="block text-[10px] text-muted">AC behavior</span>
              <select
                value={item.armorMode}
                onChange={(event) =>
                  onChange({
                    ...item,
                    armorMode: event.target.value as ArmorItem["armorMode"],
                  })
                }
                className={selectClass}
              >
                <option value="base">
                  Base armor — replaces unarmored AC (10 + DEX)
                </option>
                <option value="bonus">AC bonus — stacks with base armor</option>
              </select>
            </label>
            {item.armorMode === "base" ? (
              <>
                <ItemNumberField
                  label="Base AC"
                  value={item.baseAc}
                  onChange={(value) => onChange({ ...item, baseAc: value })}
                />
                <label className="block">
                  <span className="block text-[10px] text-muted">
                    DEX contribution
                  </span>
                  <select
                    value={item.dexMode}
                    onChange={(event) =>
                      onChange({
                        ...item,
                        dexMode: event.target.value as ArmorItem["dexMode"],
                      })
                    }
                    className={selectClass}
                  >
                    <option value="full">Full DEX modifier</option>
                    <option value="max">DEX modifier with custom max</option>
                    <option value="none">No DEX modifier</option>
                  </select>
                </label>
                {item.dexMode === "max" && (
                  <ItemNumberField
                    label="Maximum DEX bonus"
                    value={item.maxDex}
                    onChange={(value) => onChange({ ...item, maxDex: value })}
                  />
                )}
              </>
            ) : (
              <ItemNumberField
                label="AC bonus"
                value={item.acBonus}
                onChange={(value) => onChange({ ...item, acBonus: value })}
              />
            )}
            <ItemNumberField
              label="STR requirement"
              value={item.strengthRequirement}
              min={0}
              onChange={(value) =>
                onChange({ ...item, strengthRequirement: value })
              }
            />
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={item.equipped}
                onChange={(event) =>
                  onChange({ ...item, equipped: event.target.checked })
                }
              />
              Equipped (affects AC)
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={item.stealthDisadvantage}
                onChange={(event) =>
                  onChange({
                    ...item,
                    stealthDisadvantage: event.target.checked,
                  })
                }
              />
              Stealth disadvantage
            </label>
          </div>
        </div>
      )}

      {item.category === "ammo" && (
        <div>
          <Heading>Ammo details</Heading>
          <div className="grid grid-cols-2 gap-3 rounded-md border border-rule bg-paper/40 p-3">
            <label className="block">
              <span className="block text-[10px] text-muted">Ammo type</span>
              <input
                value={item.ammoType}
                onChange={(event) =>
                  onChange({ ...item, ammoType: event.target.value })
                }
                placeholder="Custom type"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="block text-[10px] text-muted">
                Compatible weapon
              </span>
              <input
                value={item.compatibleWeapon}
                onChange={(event) =>
                  onChange({ ...item, compatibleWeapon: event.target.value })
                }
                placeholder="Custom weapon name"
                className={inputClass}
              />
            </label>
            <label className="col-span-2 block">
              <span className="block text-[10px] text-muted">
                Recovery / usage notes
              </span>
              <input
                value={item.recoveryNotes}
                onChange={(event) =>
                  onChange({ ...item, recoveryNotes: event.target.value })
                }
                className={inputClass}
              />
            </label>
          </div>
        </div>
      )}

      {item.category === "adventuring-gear" && (
        <div>
          <Heading>Gear details</Heading>
          <div className="grid grid-cols-2 gap-3 rounded-md border border-rule bg-paper/40 p-3">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={item.consumable}
                onChange={(event) =>
                  onChange({ ...item, consumable: event.target.checked })
                }
              />
              Consumable
            </label>
            <div />
            <ItemNumberField
              label="Current charges"
              value={item.charges}
              min={0}
              onChange={(value) => onChange({ ...item, charges: value })}
            />
            <ItemNumberField
              label="Maximum charges"
              value={item.maxCharges}
              min={0}
              onChange={(value) =>
                onChange({
                  ...item,
                  maxCharges: value,
                  charges: Math.min(item.charges, value),
                })
              }
            />
            <ItemNumberField
              label="Charges per activation"
              value={item.chargeCost}
              min={1}
              onChange={(value) =>
                onChange({ ...item, chargeCost: Math.max(1, value) })
              }
            />
            <label className="block">
              <span className="block text-[10px] text-muted">
                Charge recharge
              </span>
              <select
                value={item.chargeRecharge}
                onChange={(event) =>
                  onChange({
                    ...item,
                    chargeRecharge: event.target.value as Recharge,
                  })
                }
                className={selectClass}
              >
                <option value="manual">Manual</option>
                <option value="short">Short Rest</option>
                <option value="long">Long Rest</option>
                <option value="dawn">Dawn</option>
              </select>
            </label>
            <label className="col-span-2 block">
              <span className="block text-[10px] text-muted">Contents</span>
              <input
                value={item.contents}
                onChange={(event) =>
                  onChange({ ...item, contents: event.target.value })
                }
                placeholder="Optional container contents"
                className={inputClass}
              />
            </label>
            <label className="col-span-2 block">
              <span className="block text-[10px] text-muted">Usage</span>
              <input
                value={item.usage}
                onChange={(event) =>
                  onChange({ ...item, usage: event.target.value })
                }
                className={inputClass}
              />
            </label>
          </div>
        </div>
      )}

      {item.category === "tool" && (
        <div>
          <Heading>Tool details</Heading>
          <div className="grid grid-cols-2 gap-3 rounded-md border border-rule bg-paper/40 p-3">
            <label className="block">
              <span className="block text-[10px] text-muted">
                Linked ability
              </span>
              <select
                value={item.linkedAbility}
                onChange={(event) =>
                  onChange({
                    ...item,
                    linkedAbility: event.target.value as Ab | "",
                  })
                }
                className={selectClass}
              >
                <option value="">None / situational</option>
                {ABILITIES.map((ability) => (
                  <option key={ability} value={ability}>
                    {ability}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-[10px] text-muted">Proficiency</span>
              <select
                value={item.proficiency}
                onChange={(event) =>
                  onChange({
                    ...item,
                    proficiency: Number(event.target.value) as 0 | 1 | 2,
                  })
                }
                className={selectClass}
              >
                <option value={0}>None</option>
                <option value={1}>Proficient</option>
                <option value={2}>Expertise</option>
              </select>
            </label>
            <ItemNumberField
              label="Misc. bonus"
              value={item.miscBonus}
              onChange={(value) => onChange({ ...item, miscBonus: value })}
            />
            <label className="col-span-2 block">
              <span className="block text-[10px] text-muted">Usage</span>
              <input
                value={item.usage}
                onChange={(event) =>
                  onChange({ ...item, usage: event.target.value })
                }
                className={inputClass}
              />
            </label>
          </div>
        </div>
      )}

      <label className="block">
        <span className="block text-[10px] text-muted">
          Description / notes
        </span>
        <textarea
          value={item.description}
          rows={4}
          onChange={(event) => setCommon({ description: event.target.value })}
          className="w-full resize-y rounded-md border border-rule bg-paper/40 p-2 text-sm leading-relaxed focus:border-accent"
        />
      </label>
    </div>
  )
}

function DropSelect({
  value,
  options,
  onChange,
  className,
}: {
  value: string
  options: string[]
  onChange: (v: string) => void
  className: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      <option value="">Choose…</option>
      {value && !options.includes(value) && (
        <option value={value}>{value}</option>
      )}
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  )
}

function WeaponEditor({
  item,
  onChange,
  inputClass,
}: {
  item: WeaponItem
  onChange: (item: InventoryItem) => void
  inputClass: string
}) {
  const { forced, blocked } = lockedWeaponProps(item.weaponKind, item.props)
  const setKind = (weaponKind: WeaponKind) =>
    onChange({
      ...item,
      weaponKind,
      props: cleanWeaponProps(weaponKind, item.props),
    })
  const toggleProp = (id: WeaponProp) => {
    if (forced.has(id) || blocked.has(id)) return
    const props = item.props.includes(id)
      ? item.props.filter((p) => p !== id)
      : [...item.props, id]
    onChange({ ...item, props: cleanWeaponProps(item.weaponKind, props) })
  }
  const seg = (active: boolean) =>
    `rounded py-1.5 text-xs font-semibold transition-colors ${
      active ? "bg-pink text-onpink" : "border border-rule hover:bg-accent-soft"
    }`
  const lockReason = (id: WeaponProp) =>
    forced.has(id)
      ? "Required by another property"
      : blocked.has(id)
        ? "Not available with the current type or properties"
        : WEAPON_PROPS.find((p) => p.id === id)?.hint

  return (
    <div>
      <Heading>Weapon statistics</Heading>
      <div className="grid grid-cols-2 gap-3 rounded-md border border-rule bg-paper/40 p-3">
        <div>
          <span className="block text-[10px] text-muted">Training</span>
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            {(["simple", "martial"] as const).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={item.weaponClass === c}
                onClick={() => onChange({ ...item, weaponClass: c })}
                className={seg(item.weaponClass === c)}
              >
                {c === "simple" ? "Simple" : "Martial"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="block text-[10px] text-muted">
            Type · uses{" "}
            {item.weaponKind === "ranged"
              ? "DEX"
              : item.props.includes("finesse")
                ? "STR or DEX"
                : "STR"}
          </span>
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            {(["melee", "ranged"] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={item.weaponKind === k}
                onClick={() => setKind(k)}
                className={seg(item.weaponKind === k)}
              >
                {k === "melee" ? "Melee" : "Ranged"}
              </button>
            ))}
          </div>
        </div>
        <p className="col-span-2 text-[11px] text-muted">
          Proficiency comes from Proficiencies &amp; training on the Ability
          tab, matched by weapon name.
        </p>
        <div className="col-span-2">
          <span className="block text-[10px] text-muted">Properties</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {WEAPON_PROPS.map((p) => {
              const on = item.props.includes(p.id)
              const isForced = forced.has(p.id)
              const isBlocked = blocked.has(p.id) && !isForced
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  disabled={isForced || isBlocked}
                  title={lockReason(p.id)}
                  onClick={() => toggleProp(p.id)}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                    on
                      ? "border-transparent bg-pink text-onpink"
                      : "border-rule text-muted hover:border-accent hover:text-ink"
                  } ${isBlocked ? "cursor-not-allowed opacity-40" : ""} ${
                    isForced ? "cursor-not-allowed" : ""
                  }`}
                >
                  {(isForced || isBlocked) && (
                    <Padlock locked className="h-3 w-3" />
                  )}
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>
        <label className="block">
          <span className="block text-[10px] text-muted">Damage dice</span>
          <DropSelect
            value={item.damageDice}
            options={DAMAGE_DICE}
            onChange={(v) => onChange({ ...item, damageDice: v })}
            className={inputClass}
          />
        </label>
        {item.props.includes("versatile") && (
          <label className="block">
            <span className="block text-[10px] text-muted">
              Versatile dice (two hands)
            </span>
            <DropSelect
              value={item.versatileDice}
              options={DAMAGE_DICE}
              onChange={(v) => onChange({ ...item, versatileDice: v })}
              className={inputClass}
            />
          </label>
        )}
        <label className="block">
          <span className="block text-[10px] text-muted">Damage type</span>
          <DropSelect
            value={item.damageType}
            options={DAMAGE_TYPES}
            onChange={(v) => onChange({ ...item, damageType: v })}
            className={`${inputClass} capitalize`}
          />
        </label>
        {item.weaponKind === "melee" ? (
          <div>
            <span className="block text-[10px] text-muted">Range</span>
            <div
              className="flex items-center gap-1 border-b border-rule pb-1 text-sm text-muted"
              title="Melee range follows the Reach property"
            >
              <Padlock locked className="h-3 w-3" />
              {weaponRange(item)}
            </div>
          </div>
        ) : (
          <label className="block">
            <span className="block text-[10px] text-muted">Range</span>
            <input
              value={item.range}
              onChange={(event) =>
                onChange({ ...item, range: event.target.value })
              }
              placeholder="e.g. 80/320"
              className={inputClass}
            />
          </label>
        )}
        <div className="col-span-2">
          <span className="block text-[10px] text-muted">
            Magic bonus (attack and damage)
          </span>
          <div className="mt-1 grid grid-cols-4 gap-1.5">
            {[0, 1, 2, 3].map((n) => {
              const active = item.attackBonus === n && item.damageBonus === n
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    onChange({ ...item, attackBonus: n, damageBonus: n })
                  }
                  className={seg(active)}
                >
                  +{n}
                </button>
              )
            })}
          </div>
        </div>
        {item.props.includes("ammunition") && (
          <label className="col-span-2 block">
            <span className="block text-[10px] text-muted">Ammo name</span>
            <input
              value={item.ammoName}
              onChange={(event) =>
                onChange({ ...item, ammoName: event.target.value })
              }
              placeholder="Optional link by name"
              className={inputClass}
            />
          </label>
        )}
      </div>
    </div>
  )
}

function IntInput({
  value,
  onChange,
  min,
  className = "",
}: {
  value: number
  onChange: (n: number) => void
  min?: number
  className?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const signed = (min ?? -Infinity) < 0
  return (
    <input
      type="text"
      inputMode={signed ? "text" : "numeric"}
      value={draft ?? String(value)}
      onFocus={(e) => e.target.select()}
      onBlur={() => setDraft(null)}
      onChange={(e) => {
        const raw = e.target.value
        if (!(signed ? /^-?\d*$/ : /^\d*$/).test(raw)) return
        const clean = raw.replace(/^(-?)0+(?=\d)/, "$1")
        setDraft(clean)
        onChange(Math.max(min ?? -Infinity, parseInt(clean, 10) || 0))
      }}
      className={className}
    />
  )
}

function ItemNumberField({
  label,
  value,
  onChange,
  min,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
}) {
  return (
    <label className="block">
      <span className="block text-[10px] text-muted">{label}</span>
      <IntInput
        value={value}
        min={min}
        onChange={onChange}
        className="w-full border-b border-rule bg-transparent pb-1 text-left font-mono text-sm focus:border-accent"
      />
    </label>
  )
}

function Padlock({
  locked,
  className = "",
}: {
  locked: boolean
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden
    >
      <rect
        x="5"
        y="11"
        width="14"
        height="10"
        rx="2"
        fill="currentColor"
        stroke="none"
      />
      <path
        d={locked ? "M8 11V8a4 4 0 0 1 8 0v3" : "M8 11V8a4 4 0 0 1 7.5-2"}
      />
    </svg>
  )
}

function SectionIcon({ tab, className = "" }: { tab: Tab; className?: string }) {
  const paths: Record<Tab, React.ReactNode> = {
    content: <path d="M5 4h10l4 4v12H5zM14 4v5h5M8 13h8M8 17h6" />,
    main: (
      <>
        <circle cx="7" cy="7" r="2" />
        <circle cx="17" cy="7" r="2" />
        <circle cx="7" cy="17" r="2" />
        <circle cx="17" cy="17" r="2" />
      </>
    ),
    combat: (
      <>
        <path d="m5 19 4-4M4 20l3-1-2-2-1 3ZM14 4l6 6-4 1-3-3 1-4Z" />
        <path d="m19 19-6-6M5 5l4 1 3 3" />
      </>
    ),
    spells: (
      <>
        <path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Z" />
        <path d="m18 14 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z" />
      </>
    ),
    gear: (
      <>
        <path d="M7 8V6a5 5 0 0 1 10 0v2" />
        <rect x="4" y="8" width="16" height="12" rx="2" />
        <path d="M9 12h6M12 12v4" />
      </>
    ),
    traits: (
      <>
        <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H12v18H7.5A3.5 3.5 0 0 0 4 23V5.5Z" />
        <path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H12v18h4.5A3.5 3.5 0 0 1 20 23V5.5Z" />
      </>
    ),
    log: (
      <>
        <path d="M8 6h11M8 12h11M8 18h11" />
        <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
        <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
      </>
    ),
  }
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths[tab]}
    </svg>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
      {children}
    </div>
  )
}

function Heading({
  children,
  right,
}: {
  children: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <h2 className="mb-1 flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-wider text-accent">
      {children}
      {right && (
        <span className="font-normal normal-case tracking-normal text-muted">
          {right}
        </span>
      )}
    </h2>
  )
}

function MenuItem({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`block w-full rounded px-2 py-2 text-left text-sm hover:bg-accent-soft ${
        danger ? "text-danger" : ""
      }`}
    >
      {children}
    </button>
  )
}

function Field({
  label,
  v,
  on,
  placeholder,
  maxLength,
}: {
  label: string
  v: string
  on: (v: string) => void
  placeholder?: string
  maxLength?: number
}) {
  return (
    <label className="block border-b border-rule focus-within:border-accent">
      <span className="block text-[10px] text-muted">{label}</span>
      <input
        value={v}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => on(e.target.value)}
        className="w-full pb-0.5 text-sm placeholder:text-muted/60"
      />
    </label>
  )
}

function NumField({
  label,
  v,
  on,
}: {
  label: string
  v: number
  on: (n: number) => void
}) {
  return (
    <label className="block border-b border-rule focus-within:border-accent">
      <span className="block text-[10px] text-muted">{label}</span>
      <NumIn v={v} on={on} className="w-full pb-0.5 text-left text-sm" />
    </label>
  )
}

function NumIn({
  v,
  on,
  className = "",
}: {
  v: number
  on: (n: number) => void
  className?: string
}) {
  return (
    <input
      type="number"
      value={Number.isNaN(v) ? "" : v}
      onChange={(e) => on(parseInt(e.target.value) || 0)}
      onFocus={(e) => e.target.select()}
      className={`bg-transparent text-center font-mono ${className}`}
    />
  )
}

function Stat({
  label,
  children,
  onClick,
}: {
  label: string
  children: React.ReactNode
  onClick?: () => void
}) {
  const cls =
    "flex flex-col items-center justify-center rounded-md border border-rule bg-card px-1 py-1.5 text-center"
  const inner = (
    <>
      {children}
      <Label>{label}</Label>
    </>
  )
  return onClick ? (
    <button
      onClick={onClick}
      className={`${cls} transition-colors hover:bg-accent-soft`}
      title="Roll"
    >
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  )
}

function Btn({
  children,
  onClick,
  tone,
}: {
  children: React.ReactNode
  onClick: () => void
  tone: "red" | "green" | "plain"
}) {
  const t =
    tone === "red"
      ? "bg-danger text-onaccent hover:opacity-90"
      : tone === "green"
        ? "bg-moss text-onaccent hover:opacity-90"
        : "border border-accent text-accent hover:bg-accent-soft"
  return (
    <button
      onClick={onClick}
      className={`h-8 rounded px-3 text-xs font-semibold transition-colors ${t}`}
    >
      {children}
    </button>
  )
}

function Row({
  state,
  locked,
  inPool,
  onToggle,
  label,
  sub,
  bonus,
  onRoll,
}: {
  state: 0 | 1 | 2
  locked: boolean
  inPool: boolean
  onToggle: () => void
  label: string
  sub?: string
  bonus: number
  onRoll: () => void
}) {
  return (
    <li className="flex items-center gap-2 border-b border-rule/60 py-1">
      <button
        onClick={onToggle}
        disabled={locked}
        aria-label={`Toggle proficiency ${label}`}
        title={locked ? "Managed from the Traits tab" : undefined}
        className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
          locked
            ? state === 2
              ? "cursor-not-allowed border-pink"
              : state === 1
                ? "cursor-not-allowed border-accent"
                : "cursor-not-allowed border-muted bg-muted/40"
            : inPool
              ? "border-accent"
              : "border-muted"
        }`}
      >
        {state > 0 && (
          <span
            className={`h-2 w-2 rounded-full ${
              state === 2
                ? "bg-pink ring-1 ring-pink ring-offset-1 ring-offset-paper"
                : "bg-accent"
            }`}
          />
        )}
      </button>
      <button
        onClick={onRoll}
        className={ROLL_BTN + " w-10 shrink-0 py-0.5 text-sm"}
        title="Roll"
      >
        {sgn(bonus)}
      </button>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="text-sm">{label}</span>
        {sub && <span className="text-[10px] uppercase text-muted">{sub}</span>}
      </span>
    </li>
  )
}

function TrainingBox({
  title,
  marks = [],
  fixed = [],
  note,
  value,
  onChange,
  empty,
  text,
}: {
  title: string
  marks?: { label: string; on: boolean }[]
  fixed?: string[]
  note?: string
  value?: string
  onChange?: (value: string) => void
  empty?: string
  text?: string
}) {
  return (
    <div className="rounded-md border border-rule bg-card p-2">
      <Label>{title}</Label>
      {marks.length > 0 && (
        <ul className="mt-1 grid grid-cols-2 gap-x-3">
          {marks.map((mark) => (
            <li key={mark.label} className="flex items-center gap-2 py-0.5">
              <span
                aria-hidden
                className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                  mark.on ? "border-accent" : "border-muted bg-muted/40"
                }`}
              >
                {mark.on && <span className="h-2 w-2 rounded-full bg-accent" />}
              </span>
              <span className={`text-sm ${mark.on ? "" : "text-muted"}`}>
                {mark.label}
              </span>
            </li>
          ))}
        </ul>
      )}
      {fixed.length > 0 && (
        <p className="mt-1 text-xs capitalize text-muted">
          <span className="font-semibold normal-case">From traits:</span>{" "}
          {fixed.join(", ")}
        </p>
      )}
      {fixed.length === 0 && marks.length === 0 && !onChange && (
        <p className="mt-1 text-sm text-muted">{text ?? empty ?? "None"}</p>
      )}
      {onChange && (
        <textarea
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          rows={2}
          placeholder={note}
          aria-label={title}
          className="mt-1.5 w-full resize-y rounded border border-dashed border-rule bg-transparent p-1.5 text-sm focus:border-accent"
        />
      )}
    </div>
  )
}

function Pips({ label, n, tone }: { label: string; n: number; tone: string }) {
  return (
    <div
      className="flex items-center justify-between py-0.5"
      role="img"
      aria-label={`${label}: ${n} of 3`}
    >
      <span className="text-xs text-muted">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full border border-muted ${
              n >= i ? `${tone} border-transparent` : ""
            }`}
          />
        ))}
      </div>
    </div>
  )
}

function Edit({
  v,
  on,
  className = "",
}: {
  v: string
  on: (v: string) => void
  className?: string
}) {
  return (
    <input
      value={v}
      onChange={(e) => on(e.target.value)}
      className={`w-full min-w-0 ${className}`}
    />
  )
}

function Area({
  label,
  v,
  on,
  rows,
}: {
  label: string
  v: string
  on: (v: string) => void
  rows: number
}) {
  return (
    <div>
      <Heading>{label}</Heading>
      <textarea
        value={v}
        rows={rows}
        onChange={(e) => on(e.target.value)}
        className="w-full resize-y rounded-md border border-rule bg-card p-2 leading-relaxed focus:border-accent"
      />
    </div>
  )
}
