export type SpellProgression = "full" | "half" | "third" | "pact" | "custom"

export type SpellSlot = { max: number; used: number }
export type PactSlotPool = { max: number; used: number; level: number }

export const FULL_CASTER_SLOTS: number[][] = [
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
]

export function casterLevelForProgression(
  progression: SpellProgression,
  classLevel: number,
) {
  if (progression === "full") return classLevel
  if (progression === "half")
    return classLevel < 2 ? 0 : Math.floor(classLevel / 2)
  if (progression === "third")
    return classLevel < 3 ? 0 : Math.floor(classLevel / 3)
  return 0
}

export function slotsForCasterLevel(casterLevel: number) {
  const level = Math.max(0, Math.min(20, Math.floor(casterLevel)))
  const row = level > 0 ? FULL_CASTER_SLOTS[level - 1] : []
  return Array.from({ length: 9 }, (_, index) => row[index] ?? 0)
}

export function pactSlotsForLevel(classLevel: number): PactSlotPool {
  const level = Math.max(1, Math.min(20, Math.floor(classLevel)))
  return {
    max: level >= 17 ? 4 : level >= 11 ? 3 : level >= 2 ? 2 : 1,
    used: 0,
    level:
      level >= 9 ? 5 : level >= 7 ? 4 : level >= 5 ? 3 : level >= 3 ? 2 : 1,
  }
}

export function formulaAtLevel(
  formulas: Record<string, string>,
  level: number,
) {
  const eligible = Object.keys(formulas)
    .map(Number)
    .filter((threshold) => threshold <= level)
    .sort((a, b) => b - a)
  return eligible.length ? formulas[String(eligible[0])] : ""
}

export function consumeSpellResource(
  slots: SpellSlot[],
  pactSlots: PactSlotPool,
  spellLevel: number,
  castLevel: number,
  pact: boolean,
) {
  if (spellLevel === 0) return { ok: true, slots, pactSlots, castLevel: 0 }
  if (pact) {
    if (pactSlots.level < spellLevel || pactSlots.used >= pactSlots.max)
      return { ok: false, slots, pactSlots, castLevel }
    return {
      ok: true,
      slots,
      pactSlots: { ...pactSlots, used: pactSlots.used + 1 },
      castLevel: pactSlots.level,
    }
  }
  const index = castLevel - 1
  const slot = slots[index]
  if (!slot || castLevel < spellLevel || slot.used >= slot.max)
    return { ok: false, slots, pactSlots, castLevel }
  return {
    ok: true,
    slots: slots.map((value, slotIndex) =>
      slotIndex === index ? { ...value, used: value.used + 1 } : value,
    ),
    pactSlots,
    castLevel,
  }
}
