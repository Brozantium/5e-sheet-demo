export type Ruleset = "2014" | "2024"

export type ClassEntry = {
  id: string
  name: string
  source?: string
  description?: string
  hitDie?: number
  proficiencies?: {
    savingThrows?: string[]
    armor?: string[]
    weapons?: string[]
    skills?: { choose?: number; from?: string[] }
  }
  spellcasting?: { ability?: string; preparesSpells?: boolean; cantrips?: boolean; pactMagic?: boolean }
  subclassLabel?: string
  subclassLevel?: number
  subclassOptions?: Array<{ name: string; source?: string }>
}

export type RaceEntry = {
  id: string
  name: string
  source?: string
  description?: string
  size?: string
  speed?: number
  traits?: Array<{ name: string; text?: string }>
}

export type BackgroundEntry = {
  id: string
  name: string
  source?: string
  description?: string
  skillProficiencies?: string[]
  toolProficiencies?: string[]
  languages?: { fixed?: string[]; choose?: number }
  feature?: { name?: string; text?: string }
}

export type RulesetContent = {
  classes: ClassEntry[]
  races: RaceEntry[]
  backgrounds: BackgroundEntry[]
}

const contentCache = new Map<Ruleset, Promise<RulesetContent>>()

async function readJson<T>(path: string): Promise<T> {
  const url = new URL(path, document.baseURI)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Content request failed: ${path} (${response.status})`)
  }
  return response.json() as Promise<T>
}

/** Load the original repository JSON files without embedding them in the JS bundle. */
export function loadRulesetContent(ruleset: Ruleset): Promise<RulesetContent> {
  const cached = contentCache.get(ruleset)
  if (cached) return cached

  const folder = ruleset === "2024" ? "2024/" : ""
  const request = Promise.all([
    readJson<ClassEntry[]>(`data/${folder}classes.json`),
    readJson<RaceEntry[]>(`data/${folder}races.json`),
    readJson<BackgroundEntry[]>(`data/${folder}backgrounds.json`),
  ]).then(([classes, races, backgrounds]) => ({ classes, races, backgrounds }))

  contentCache.set(ruleset, request)
  return request
}

export function getProficiencyBonus(level: number): number {
  const safeLevel = Math.min(20, Math.max(1, Math.trunc(Number(level) || 1)))
  return 2 + Math.floor((safeLevel - 1) / 4)
}

export function getSafeLevel(value: number): number {
  return Math.min(20, Math.max(1, Math.trunc(Number(value) || 1)))
}
