export type Ruleset = "2014" | "2024"

export type CharacterProbeInput = {
  name: string
  level: number
  ruleset: Ruleset
}

export type CharacterProbeResult = {
  name: string
  level: number
  ruleset: Ruleset
  proficiencyBonus: number
  sourceModule: string
}

/**
 * Small pure function used only to prove that separate HTML entry points
 * can import and execute the same external TypeScript module.
 */
export function buildCharacterSnapshot(
  input: CharacterProbeInput,
): CharacterProbeResult {
  const level = Math.min(20, Math.max(1, Math.trunc(Number(input.level) || 1)))
  const name = input.name.trim() || "Unnamed Adventurer"

  return {
    name,
    level,
    ruleset: input.ruleset,
    proficiencyBonus: Math.floor((level - 1) / 4) + 2,
    sourceModule: "src/shared-logic.ts",
  }
}
