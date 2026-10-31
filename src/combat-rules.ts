export type RollMode = "normal" | "advantage" | "disadvantage"
export type RollKind = "attack" | "ability-check" | "saving-throw"

export const CONDITION_TYPES = [
  "Blinded",
  "Charmed",
  "Deafened",
  "Frightened",
  "Grappled",
  "Incapacitated",
  "Invisible",
  "Paralyzed",
  "Petrified",
  "Poisoned",
  "Prone",
  "Restrained",
  "Stunned",
  "Unconscious",
] as const

export type ConditionType = (typeof CONDITION_TYPES)[number]

export type ActiveCondition = {
  id: string
  type: ConditionType
  source: string
  sourceDetails: string
  appliedCharacter: string
  duration: string
  expiration: "manual" | "short" | "long" | "dawn"
  save: string
  notes: string
  appliedAt: number
}

export type ConditionSummary = {
  attack: RollMode
  abilityCheck: RollMode
  savingThrow: RollMode
  speed: "normal" | "half" | "zero"
  canAct: boolean
  canReact: boolean
  reminders: string[]
}

const mergeMode = (current: RollMode, next: RollMode): RollMode => {
  if (next === "normal") return current
  if (current === "normal") return next
  return current === next ? current : "normal"
}

export function conditionSummary(
  conditions: ActiveCondition[],
  exhaustionLevel: number,
): ConditionSummary {
  let attack: RollMode = "normal"
  let abilityCheck: RollMode = "normal"
  let savingThrow: RollMode = "normal"
  let speed: ConditionSummary["speed"] = "normal"
  let canAct = true
  let canReact = true
  const reminders = new Set<string>()
  const active = new Set(conditions.map((condition) => condition.type))

  if (active.has("Blinded")) {
    attack = mergeMode(attack, "disadvantage")
    reminders.add("Attacks against you have advantage; sight-dependent checks fail.")
  }
  if (active.has("Charmed"))
    reminders.add(
      "You cannot attack the charmer; the charmer has advantage on social checks against you.",
    )
  if (active.has("Deafened"))
    reminders.add("Hearing-dependent ability checks automatically fail.")
  if (active.has("Frightened")) {
    reminders.add(
      "While the source of fear is visible, attacks and ability checks have disadvantage; you cannot willingly move closer to it.",
    )
  }
  if (active.has("Grappled")) speed = "zero"
  if (active.has("Incapacitated")) {
    canAct = false
    canReact = false
  }
  if (active.has("Invisible")) {
    attack = mergeMode(attack, "advantage")
    reminders.add(
      "Attacks against you have disadvantage unless the attacker can perceive you.",
    )
  }
  if (active.has("Paralyzed")) {
    canAct = false
    canReact = false
    speed = "zero"
    reminders.add(
      "STR and DEX saves fail; attacks against you have advantage and hits within 5 feet are critical.",
    )
  }
  if (active.has("Petrified")) {
    canAct = false
    canReact = false
    speed = "zero"
    reminders.add(
      "You are unaware, resist all damage, and are immune to poison and disease while petrified.",
    )
  }
  if (active.has("Poisoned")) {
    attack = mergeMode(attack, "disadvantage")
    abilityCheck = mergeMode(abilityCheck, "disadvantage")
  }
  if (active.has("Prone")) {
    attack = mergeMode(attack, "disadvantage")
    reminders.add(
      "Attacks from within 5 feet have advantage; attacks from farther away have disadvantage.",
    )
  }
  if (active.has("Restrained")) {
    speed = "zero"
    attack = mergeMode(attack, "disadvantage")
    savingThrow = mergeMode(savingThrow, "disadvantage")
    reminders.add("Attacks against you have advantage; DEX saves have disadvantage.")
  }
  if (active.has("Stunned")) {
    canAct = false
    canReact = false
    speed = "zero"
    reminders.add("STR and DEX saves fail; attacks against you have advantage.")
  }
  if (active.has("Unconscious")) {
    canAct = false
    canReact = false
    speed = "zero"
    reminders.add(
      "You drop held items and fall prone; STR and DEX saves fail; attacks have advantage and hits within 5 feet are critical.",
    )
  }

  if (exhaustionLevel >= 1)
    abilityCheck = mergeMode(abilityCheck, "disadvantage")
  if (exhaustionLevel >= 2 && speed === "normal") speed = "half"
  if (exhaustionLevel >= 3) {
    attack = mergeMode(attack, "disadvantage")
    savingThrow = mergeMode(savingThrow, "disadvantage")
  }
  if (exhaustionLevel >= 5) speed = "zero"
  if (exhaustionLevel >= 6) {
    canAct = false
    canReact = false
    reminders.add("Exhaustion level 6: dead.")
  }

  return {
    attack,
    abilityCheck,
    savingThrow,
    speed,
    canAct,
    canReact,
    reminders: [...reminders],
  }
}

export function combineRollModes(...modes: RollMode[]) {
  return modes.reduce(mergeMode, "normal")
}

export function effectiveSpeed(
  baseSpeed: number,
  summary: ConditionSummary,
) {
  if (summary.speed === "zero") return 0
  if (summary.speed === "half") return Math.floor(baseSpeed / 2)
  return baseSpeed
}

export function effectiveMaxHp(baseMaxHp: number, exhaustionLevel: number) {
  return exhaustionLevel >= 4 ? Math.max(1, Math.floor(baseMaxHp / 2)) : baseMaxHp
}

export type StructuredDefense = {
  resistances: string[]
  vulnerabilities: string[]
  immunities: string[]
  conditionImmunities: string[]
  acBonus: number
}

const unique = (values: string[]) =>
  [...new Set(values.map((value) => value.trim()).filter(Boolean))]

export function mergeDefenses(
  defenses: Partial<StructuredDefense>[],
): StructuredDefense {
  return {
    resistances: unique(defenses.flatMap((entry) => entry.resistances ?? [])),
    vulnerabilities: unique(
      defenses.flatMap((entry) => entry.vulnerabilities ?? []),
    ),
    immunities: unique(defenses.flatMap((entry) => entry.immunities ?? [])),
    conditionImmunities: unique(
      defenses.flatMap((entry) => entry.conditionImmunities ?? []),
    ),
    acBonus: defenses.reduce(
      (total, entry) => total + Math.max(0, entry.acBonus ?? 0),
      0,
    ),
  }
}

export type ChargeResource = {
  charges: number
  maxCharges: number
  chargeCost: number
  chargeRecharge: "short" | "long" | "dawn" | "manual"
}

export function consumeCharges<T extends ChargeResource>(item: T) {
  const cost = Math.max(1, Math.floor(item.chargeCost || 1))
  if (item.maxCharges <= 0 || item.charges < cost)
    return { ok: false, item }
  return {
    ok: true,
    item: { ...item, charges: Math.max(0, item.charges - cost) },
  }
}

export function rechargeCharges<T extends ChargeResource>(
  item: T,
  events: ChargeResource["chargeRecharge"][],
) {
  if (item.maxCharges <= 0 || !events.includes(item.chargeRecharge)) return item
  return { ...item, charges: item.maxCharges }
}
