import { useEffect, useRef, useState } from 'react'
import OBR, { buildShape, buildText, type Item } from '@owlbear-rodeo/sdk'

const ABILITIES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const
type Ab = (typeof ABILITIES)[number]

const SKILLS: [string, Ab][] = [
  ['Acrobatics', 'DEX'],
  ['Animal Handling', 'WIS'],
  ['Arcana', 'INT'],
  ['Athletics', 'STR'],
  ['Deception', 'CHA'],
  ['History', 'INT'],
  ['Insight', 'WIS'],
  ['Intimidation', 'CHA'],
  ['Investigation', 'INT'],
  ['Medicine', 'WIS'],
  ['Nature', 'INT'],
  ['Perception', 'WIS'],
  ['Performance', 'CHA'],
  ['Persuasion', 'CHA'],
  ['Religion', 'INT'],
  ['Sleight of Hand', 'DEX'],
  ['Stealth', 'DEX'],
  ['Survival', 'WIS'],
]

type Attack = { id: number; name: string; bonus: string; damage: string }
type Sheet = {
  name: string
  cls: string
  race: string
  background: string
  alignment: string
  level: number
  subclass: string
  scores: Record<Ab, number>
  saveProf: Ab[]
  skillProf: Record<string, 0 | 1 | 2>
  acBonus: number
  speed: number
  initMisc: number
  hp: number
  maxHp: number
  hpMode: 'roll' | 'avg' | 'max'
  tempHp: number
  hitDie: number
  hpDice: number[]
  hpLock: boolean[]
  hitDiceUsed: number
  deathS: number
  deathF: number
  inspiration: boolean
  conditions: string[]
  attacks: Attack[]
  slots: { max: number; used: number }[]
  spellAb: Ab
  spells: string
  features: string
  gear: string
  notes: string
  skillNotes: Record<string, string>
  defenses: string
  coins: Record<'CP' | 'SP' | 'EP' | 'GP' | 'PP', number>
}

const initial: Sheet = {
  name: 'New Character',
  cls: 'Artificer',
  subclass: 'Subclass',
  race: 'Race',
  background: 'Background',
  alignment: 'Neutral',
  level: 1,
  scores: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
  saveProf: ['CON', 'INT'],
  skillProf: {},
  acBonus: 0,
  speed: 30,
  initMisc: 0,
  hp: 8,
  maxHp: 8,
  hpMode: 'avg',
  tempHp: 0,
  hitDie: 8,
  hpDice: [],
  hpLock: [],
  hitDiceUsed: 0,
  deathS: 0,
  deathF: 0,
  inspiration: false,
  conditions: [],
  attacks: [],
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
  spellAb: 'WIS',
  spells: '',
  features: '',
  gear: '',
  notes: '',
  skillNotes: { Perception: '', Insight: '', Investigation: '', Vision: '' },
  defenses: '',
  coins: { CP: 0, SP: 0, EP: 0, GP: 0, PP: 0 },
}

const CLASS_DIE: Record<string, number> = {
  Artificer: 8,
  Barbarian: 12,
  Bard: 8,
  'Blood Hunter': 10,
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
const CLASS_NAMES = Object.keys(CLASS_DIE)

const CLASS_SAVES: Record<string, Ab[]> = {
  Artificer: ['CON', 'INT'], Barbarian: ['STR', 'CON'], Bard: ['DEX', 'CHA'], 'Blood Hunter': ['STR', 'INT'],
  Cleric: ['WIS', 'CHA'], Druid: ['INT', 'WIS'], Fighter: ['STR', 'CON'], Monk: ['STR', 'DEX'],
  Paladin: ['WIS', 'CHA'], Ranger: ['STR', 'DEX'], Rogue: ['DEX', 'INT'], Sorcerer: ['CON', 'CHA'],
  Warlock: ['WIS', 'CHA'], Wizard: ['INT', 'WIS'],
}

const ROLL_BTN = 'rounded bg-pink text-center font-mono font-semibold text-onpink transition-[filter] hover:brightness-95 active:brightness-75'
const ALL_SKILLS = SKILLS.map(([n]) => n)
const CLASS_SKILLS: Record<string, { pick: number; from: string[] }> = {
  Artificer: { pick: 2, from: ['Arcana', 'History', 'Investigation', 'Medicine', 'Nature', 'Perception', 'Sleight of Hand'] },
  Barbarian: { pick: 2, from: ['Animal Handling', 'Athletics', 'Intimidation', 'Nature', 'Perception', 'Survival'] },
  Bard: { pick: 3, from: ALL_SKILLS },
  'Blood Hunter': { pick: 2, from: ['Acrobatics', 'Athletics', 'Insight', 'Investigation', 'Perception', 'Survival'] },
  Cleric: { pick: 2, from: ['History', 'Insight', 'Medicine', 'Persuasion', 'Religion'] },
  Druid: { pick: 2, from: ['Arcana', 'Animal Handling', 'Insight', 'Medicine', 'Nature', 'Perception', 'Religion', 'Survival'] },
  Fighter: { pick: 2, from: ['Acrobatics', 'Animal Handling', 'Athletics', 'History', 'Insight', 'Intimidation', 'Perception', 'Survival'] },
  Monk: { pick: 2, from: ['Acrobatics', 'Athletics', 'History', 'Insight', 'Religion', 'Stealth'] },
  Paladin: { pick: 2, from: ['Athletics', 'Insight', 'Intimidation', 'Medicine', 'Persuasion', 'Religion'] },
  Ranger: { pick: 3, from: ['Animal Handling', 'Athletics', 'Insight', 'Investigation', 'Nature', 'Perception', 'Stealth', 'Survival'] },
  Rogue: { pick: 4, from: ['Acrobatics', 'Athletics', 'Deception', 'Insight', 'Intimidation', 'Investigation', 'Perception', 'Performance', 'Persuasion', 'Sleight of Hand', 'Stealth'] },
  Sorcerer: { pick: 2, from: ['Arcana', 'Deception', 'Insight', 'Intimidation', 'Persuasion', 'Religion'] },
  Warlock: { pick: 2, from: ['Arcana', 'Deception', 'History', 'Intimidation', 'Investigation', 'Nature', 'Religion'] },
  Wizard: { pick: 2, from: ['Arcana', 'History', 'Insight', 'Investigation', 'Medicine', 'Religion'] },
}

const DETAIL_SKILLS: [string, Ab][] = [['Perception', 'WIS'], ['Insight', 'WIS'], ['Investigation', 'INT']]

const CONDITIONS = [
  'Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled', 'Incapacitated', 'Invisible',
  'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious', 'Exhausted',
]

const mod = (s: number) => Math.floor((s - 10) / 2)
const sgn = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
const prof = (lvl: number) => Math.ceil(lvl / 4) + 1
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n))

type Roll = {
  label: string
  die: string
  face: number
  mod: number
  total: number
  id: string
  playerId: string
  playerName: string
  note?: string
}
type Tab = 'main' | 'combat' | 'spells' | 'gear' | 'log'

const SLOTS = 5
const CHANNEL = 'dnd5e.sheet.share'
const ROLL_CHANNEL = 'dnd5e.roll.share'
const ROLL_STORAGE = 'dnd5e-roll-log'
const HP_META = 'dnd5e.sheet.hp-bar'
const HP_LABEL_META = 'dnd5e.sheet.hp-label'
type Store = { active: number; slots: (Sheet | null)[] }
type Person = { id: string; name: string }
type ShareMsg = { to: string; fromName: string; sheet: Sheet }
type HpBarMeta = {
  kind: 'background' | 'fill'
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

function normalize(saved: Partial<Sheet> & Record<string, any>): Sheet {
  const cls = CLASS_NAMES.find((c) => String(saved.cls ?? '').startsWith(c)) ?? initial.cls
  const pl = CLASS_SKILLS[cls]
  const skillProf: Record<string, 0 | 1 | 2> = {}
  const sp: Record<string, number> = saved.skillProf ?? {}
  Object.keys(sp)
    .filter((n) => sp[n] > 0 && pl.from.includes(n))
    .slice(0, pl.pick)
    .forEach((n) => (skillProf[n] = 1))
  return { ...initial, ...saved, cls, skillProf, hitDie: CLASS_DIE[cls], saveProf: CLASS_SAVES[cls], skillNotes: { ...initial.skillNotes, ...saved.skillNotes } }
}

function loadStore(): Store {
  try {
    const raw = localStorage.getItem('dnd5e-chars')
    if (raw) {
      const p = JSON.parse(raw)
      const slots = Array.from({ length: SLOTS }, (_, i) => (p.slots?.[i] ? normalize(p.slots[i]) : null))
      const active = slots[p.active] ? p.active : slots.findIndex(Boolean)
      if (active >= 0) return { active, slots }
    }
    const legacy = localStorage.getItem('dnd5e-sheet')
    if (legacy) return { active: 0, slots: [normalize(JSON.parse(legacy)), ...Array(SLOTS - 1).fill(null)] }
  } catch {
    /* fall through */
  }
  return { active: 0, slots: [initial, ...Array(SLOTS - 1).fill(null)] }
}

function loadRolls(): Roll[] {
  try {
    const saved = JSON.parse(localStorage.getItem(ROLL_STORAGE) ?? '[]')
    return Array.isArray(saved) ? saved.slice(0, 40) : []
  } catch {
    return []
  }
}

function hpColor(hp: number, maxHp: number) {
  const pct = maxHp > 0 ? hp / maxHp : 0
  if (pct <= 0.25) return '#ef4444'
  if (pct <= 0.5) return '#fbbf24'
  return '#22c55e'
}

function rollExpr(roll: Roll) {
  const modifier = roll.mod >= 0 ? `+ ${roll.mod}` : `− ${Math.abs(roll.mod)}`
  return `1${roll.die} (${roll.face}) ${modifier} =`
}

function rollFormula(roll: Roll) {
  return `${rollExpr(roll)} ${roll.total}`
}

function getHpMeta(item: Item): HpBarMeta | null {
  const value = item.metadata[HP_META]
  if (!value || typeof value !== 'object') return null
  const meta = value as Partial<HpBarMeta>
  if (
    (meta.kind !== 'background' && meta.kind !== 'fill') ||
    typeof meta.ownerId !== 'string' ||
    typeof meta.slot !== 'number' ||
    typeof meta.tokenId !== 'string' ||
    typeof meta.hp !== 'number' ||
    typeof meta.maxHp !== 'number' ||
    typeof meta.width !== 'number' ||
    typeof meta.height !== 'number' ||
    typeof meta.centerX !== 'number' ||
    typeof meta.centerY !== 'number' ||
    typeof meta.rotation !== 'number'
  ) return null
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
  if (oldLabels.length) await OBR.scene.local.deleteItems(oldLabels.map((item) => item.id))

  const labels = shared.flatMap((item) => {
    const meta = getHpMeta(item)
    if (!meta || meta.kind !== 'fill' || (role !== 'GM' && meta.ownerId !== playerId)) return []
    const fontSize = Math.max(9, meta.height * 0.78)
    return [
      buildText()
        .name('D&D 5e HP')
        .plainText(`${meta.hp}/${meta.maxHp}`)
        .width(meta.width)
        .height(Math.max(18, meta.height * 3))
        .fontSize(fontSize)
        .fontWeight(700)
        .textAlign('CENTER')
        .textAlignVertical('MIDDLE')
        .fillColor('#ffffff')
        .strokeColor('#111827')
        .strokeWidth(Math.max(1, fontSize * 0.12))
        .position({ x: meta.centerX, y: meta.centerY })
        .rotation(meta.rotation)
        .layer('ATTACHMENT')
        .attachedTo(meta.tokenId)
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
  hpLabelRefresh = hpLabelRefresh.then(refreshHpLabels, refreshHpLabels).catch(() => undefined)
  return hpLabelRefresh
}

function useDismiss(open: boolean, close: () => void, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [open])
}

export default function App() {
  const [store, setStore] = useState<Store>(loadStore)
  const s = store.slots[store.active] as Sheet
  const setS = (f: (p: Sheet) => Sheet) =>
    setStore((st) => ({ ...st, slots: st.slots.map((x, i) => (i === st.active && x ? f(x) : x)) }))
  const [tab, setTab] = useState<Tab>('main')
  const [rolls, setRolls] = useState<Roll[]>(loadRolls)
  const [amount, setAmount] = useState('')
  const [open, setOpen] = useState(false)
  const [hpOpen, setHpOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dark, setDark] = useState(() => localStorage.getItem('dnd5e-theme') !== 'light')
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    localStorage.setItem('dnd5e-chars', JSON.stringify(store))
  }, [store])

  useEffect(() => {
    localStorage.setItem(ROLL_STORAGE, JSON.stringify(rolls))
  }, [rolls])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('dnd5e-theme', dark ? 'dark' : 'light')
  }, [dark])

  const [restOpen, setRestOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [role, setRole] = useState<'GM' | 'PLAYER'>(() => (localStorage.getItem('dnd5e-role') === 'GM' ? 'GM' : 'PLAYER'))
  const [players, setPlayers] = useState<Person[]>([])
  const [inbox, setInbox] = useState<ShareMsg | null>(null)
  const [overwriteSlot, setOverwriteSlot] = useState<number | null>(null)
  const restRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const noticeTimer = useRef<number>(0)
  const playerIdRef = useRef('local')
  const playerNameRef = useRef('You')
  useDismiss(menuOpen, () => setMenuOpen(false), menuRef)
  useDismiss(restOpen, () => setRestOpen(false), restRef)

  const flash = (msg: string) => {
    setNotice(msg)
    window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(''), 2600)
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
      playerNameRef.current = playerName || 'Player'
      const toPeople = (ps: { id: string; name: string }[]) => setPlayers(ps.map((p) => ({ id: p.id, name: p.name || 'Player' })))
      toPeople(await OBR.party.getPlayers())
      off.push(OBR.party.onChange(toPeople))
      off.push(
        OBR.broadcast.onMessage(CHANNEL, async (ev) => {
          const d = ev.data as ShareMsg
          const me = await OBR.player.getRole()
          if (d.to === OBR.player.id || (d.to === 'GM' && me === 'GM')) setInbox(d)
        }),
      )
      off.push(
        OBR.broadcast.onMessage(ROLL_CHANNEL, (ev) => {
          const d = ev.data as Partial<Roll>
          if (
            typeof d.label === 'string' &&
            typeof d.die === 'string' &&
            typeof d.face === 'number' &&
            typeof d.mod === 'number' &&
            typeof d.total === 'number' &&
            typeof d.id === 'string' &&
            typeof d.playerId === 'string' &&
            typeof d.playerName === 'string'
          ) {
            setRolls((current) => current.some((roll) => roll.id === d.id) ? current : [d as Roll, ...current].slice(0, 40))
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

  const demoPlayers: Person[] = [{ id: 'demo-1', name: 'Aria (demo)' }, { id: 'demo-2', name: 'Bram (demo)' }]
  const shareTargets = inObr ? players : demoPlayers

  const sendSheet = async (to: string, label: string) => {
    setShareOpen(false)
    setMenuOpen(false)
    if (!inObr) return flash(`Shared to ${label} (demo, not inside Owlbear)`)
    try {
      await OBR.broadcast.sendMessage(CHANNEL, { to, fromName: await OBR.player.getName(), sheet: s } satisfies ShareMsg, { destination: 'REMOTE' })
      flash(`Shared to ${label}`)
    } catch {
      flash('Could not share')
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
      setAttached(items.some((item) => {
        const meta = getHpMeta(item)
        return !!meta && meta.ownerId === ownerId && meta.slot === store.active
      }))
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
      if (bars.length) await OBR.scene.items.deleteItems(bars.map((item) => item.id))
      await queueHpLabelRefresh()
      flash(`Removed ${s.name || 'sheet'} from token`)
    } catch {
      flash('Could not remove sheet from token')
    }
  }

  const attachCharacterToToken = async () => {
    setMenuOpen(false)
    if (!inObr) return flash('Attach to token is only available inside Owlbear')
    try {
      if (!(await OBR.scene.isReady())) return flash('Open a scene first')
      const selection = await OBR.player.getSelection()
      if (!selection || selection.length !== 1) return flash('Select exactly one character token first')
      const [token] = await OBR.scene.items.getItems(selection)
      if (!token || (token.layer !== 'CHARACTER' && token.layer !== 'MOUNT')) {
        return flash('Select a character or mount token')
      }

      const [bounds, ownerId, items] = await Promise.all([
        OBR.scene.items.getItemBounds([token.id]),
        OBR.player.getId(),
        OBR.scene.items.getItems(),
      ])
      const width = bounds.width
      const height = clamp(width * 0.14, 12, 40)
      const centerX = bounds.center.x
      const centerY = bounds.max.y - height * 0.9
      const pct = s.maxHp > 0 ? clamp(s.hp / s.maxHp, 0, 1) : 0
      const fillWidth = Math.max(0.1, width * pct)
      const rotation = token.rotation
      const shift = (fillWidth - width) / 2
      const radians = rotation * Math.PI / 180
      const fillPosition = {
        x: centerX + shift * Math.cos(radians),
        y: centerY + shift * Math.sin(radians),
      }
      const baseMeta: Omit<HpBarMeta, 'kind'> = {
        ownerId,
        slot: store.active,
        tokenId: token.id,
        hp: s.hp,
        maxHp: s.maxHp,
        width,
        height,
        centerX,
        centerY,
        rotation,
      }
      const taken = items.some((item) => {
        const meta = getHpMeta(item)
        return !!meta && meta.tokenId === token.id && !(meta.ownerId === ownerId && meta.slot === store.active)
      })
      if (taken) return flash('This token already has a sheet attached. Remove it first.')
      const oldBars = items.filter((item) => {
        const meta = getHpMeta(item)
        return !!meta && (meta.tokenId === token.id || (meta.ownerId === ownerId && meta.slot === store.active))
      })
      if (oldBars.length) await OBR.scene.items.deleteItems(oldBars.map((item) => item.id))

      const background = buildShape()
        .name(`${s.name} HP background`)
        .shapeType('RECTANGLE')
        .width(width)
        .height(height)
        .fillColor('#111827')
        .fillOpacity(0.85)
        .strokeColor('#ffffff')
        .strokeOpacity(0.55)
        .strokeWidth(Math.max(1, height * 0.12))
        .position({ x: centerX, y: centerY })
        .rotation(rotation)
        .layer('ATTACHMENT')
        .attachedTo(token.id)
        .locked(true)
        .disableHit(true)
        .metadata({ [HP_META]: { ...baseMeta, kind: 'background' } satisfies HpBarMeta })
        .build()
      const fill = buildShape()
        .name(`${s.name} HP`)
        .shapeType('RECTANGLE')
        .width(fillWidth)
        .height(height)
        .fillColor(hpColor(s.hp, s.maxHp))
        .fillOpacity(pct > 0 ? 1 : 0)
        .strokeOpacity(0)
        .position(fillPosition)
        .rotation(rotation)
        .layer('ATTACHMENT')
        .attachedTo(token.id)
        .locked(true)
        .disableHit(true)
        .metadata({ [HP_META]: { ...baseMeta, kind: 'fill' } satisfies HpBarMeta })
        .build()
      await OBR.scene.items.addItems([background, fill])
      await queueHpLabelRefresh()
      flash(`Attached ${s.name || 'character'} to token`)
    } catch {
      flash('Could not attach character to token')
    }
  }

  const freeSlot = () => store.slots.findIndex((x) => !x)
  const addCharacter = (sheet: Sheet) => {
    const i = freeSlot()
    if (i < 0) return false
    setStore((st) => ({ active: i, slots: st.slots.map((x, k) => (k === i ? sheet : x)) }))
    setTab('main')
    return true
  }
  const switchSlot = (i: number) => {
    if (store.slots[i]) setStore((st) => ({ ...st, active: i }))
    else {
      setStore((st) => ({ active: i, slots: st.slots.map((x, k) => (k === i ? initial : x)) }))
      setTab('main')
    }
    setMenuOpen(false)
  }
  const saveIncoming = (i: number) => {
    if (!inbox) return
    const sheet = normalize(inbox.sheet)
    setStore((st) => ({ active: i, slots: st.slots.map((x, k) => (k === i ? sheet : x)) }))
    setTab('main')
    setInbox(null)
    setOverwriteSlot(null)
    flash(`Saved ${sheet.name || 'character'} to slot ${i + 1}`)
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
      return active < 0 ? { active: 0, slots: [initial, ...Array(SLOTS - 1).fill(null)] } : { active, slots }
    })
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ app: 'dnd5e-sheet', version: 1, sheet: s }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(s.name || 'character').replace(/[^\w-]+/g, '_')}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    setMenuOpen(false)
  }
  const importJson = async (file: File) => {
    try {
      const data = JSON.parse(await file.text())
      const raw = data.sheet ?? data
      if (typeof raw !== 'object' || !raw || !raw.scores) throw new Error('bad')
      const sheet = normalize(raw)
      if (!addCharacter(sheet)) {
        if (!confirm('All 5 slots are used. Replace the current character?')) return
        setS(() => sheet)
      }
      flash(`Imported ${sheet.name}`)
      setMenuOpen(false)
    } catch {
      flash('That file is not a valid character')
    }
  }

  const hpMode = s.hpMode
  const setHpMode = (v: Sheet['hpMode']) => setS((p) => ({ ...p, hpMode: v }))
  const set = <K extends keyof Sheet>(k: K, v: Sheet[K]) => setS((p) => ({ ...p, [k]: v }))
  const pb = prof(s.level)
  const m = (a: Ab) => mod(s.scores[a])

  const pushRoll = (r: Pick<Roll, 'label' | 'die' | 'face' | 'mod' | 'total' | 'note'>) => {
    const entry: Roll = {
      ...r,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      playerId: playerIdRef.current,
      playerName: s.name.trim() || playerNameRef.current,
    }
    setRolls((current) => [entry, ...current].slice(0, 40))
    if (inObr && OBR.isReady) {
      OBR.broadcast.sendMessage(ROLL_CHANNEL, entry, { destination: 'REMOTE' }).catch(() => flash('Roll saved locally, but could not be shared'))
    }
  }

  const roll = (label: string, bonus: number) => {
    const d20 = 1 + Math.floor(Math.random() * 20)
    pushRoll({ label, die: 'd20', face: d20, mod: bonus, total: d20 + bonus })
  }

  useEffect(() => {
    if (!inObr) return
    let cancelled = false
    const updateAttachedBar = async () => {
      if (!(await OBR.scene.isReady())) return
      const ownerId = await OBR.player.getId()
      const fills = (await OBR.scene.items.getItems()).filter((item) => {
        const meta = getHpMeta(item)
        return meta?.kind === 'fill' && meta.ownerId === ownerId && meta.slot === store.active
      })
      if (!fills.length || cancelled) return
      await OBR.scene.items.updateItems(fills, (drafts) => {
        for (const draft of drafts) {
          const meta = getHpMeta(draft as unknown as Item)
          if (!meta || draft.type !== 'SHAPE') continue
          const pct = s.maxHp > 0 ? clamp(s.hp / s.maxHp, 0, 1) : 0
          const fillWidth = Math.max(0.1, meta.width * pct)
          const shift = (fillWidth - meta.width) / 2
          const radians = meta.rotation * Math.PI / 180
          draft.width = fillWidth
          draft.position = {
            x: meta.centerX + shift * Math.cos(radians),
            y: meta.centerY + shift * Math.sin(radians),
          }
          draft.style.fillColor = hpColor(s.hp, s.maxHp)
          draft.style.fillOpacity = pct > 0 ? 1 : 0
          draft.metadata[HP_META] = { ...meta, hp: s.hp, maxHp: s.maxHp }
        }
      })
      if (!cancelled) await queueHpLabelRefresh()
    }
    if (OBR.isReady) void updateAttachedBar()
    else OBR.onReady(() => void updateAttachedBar())
    return () => {
      cancelled = true
    }
  }, [inObr, s.hp, s.maxHp, store.active])

  const skillBonus = (name: string, ab: Ab) => m(ab) + (s.skillProf[name] ?? 0) * pb
  const pool = CLASS_SKILLS[s.cls]
  const poolUsed = ALL_SKILLS.filter((n) => (s.skillProf[n] ?? 0) > 0).length
  const canAddSkill = (n: string) => pool.from.includes(n) && poolUsed < pool.pick

  const applyHp = (kind: 'dmg' | 'heal' | 'temp') => {
    const n = parseInt(amount)
    if (!n || n < 0) return
    setS((p) => {
      if (kind === 'temp') return { ...p, tempHp: Math.max(p.tempHp, n) }
      if (kind === 'heal') return { ...p, hp: clamp(p.hp + n, 0, p.maxHp), deathS: 0, deathF: 0 }
      const absorbed = Math.min(p.tempHp, n)
      return { ...p, tempHp: p.tempHp - absorbed, hp: clamp(p.hp - (n - absorbed), 0, p.maxHp) }
    })
    setAmount('')
  }

  const longRest = () =>
    setS((p) => ({
      ...p,
      hp: p.maxHp,
      tempHp: 0,
      deathS: 0,
      deathF: 0,
      hitDiceUsed: Math.max(0, p.hitDiceUsed - Math.max(1, Math.floor(p.level / 2))),
      slots: p.slots.map((x) => ({ ...x, used: 0 })),
    }))

  const shortRest = () => {
    if (s.cls === 'Warlock') setS((p) => ({ ...p, slots: p.slots.map((x) => ({ ...x, used: 0 })) }))
    flash(s.cls === 'Warlock' ? 'Short rest: pact slots restored' : 'Short rest: spend hit dice in the Combat tab')
  }
  const dawn = () => flash('Dawn: daily features recharged')

  const upAttack = (id: number, patch: Partial<Attack>) =>
    set('attacks', s.attacks.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  const upSlot = (i: number, patch: Partial<{ max: number; used: number }>) =>
    set('slots', s.slots.map((x, k) => (k === i ? { ...x, ...patch } : x)))

  // Level 1 = full hit die. Levels 2+ = rolled / average / max hit die. CON mod applies every level (min 1 HP per level).
  const conMod = mod(s.scores.CON)
  const avgDie = Math.floor(s.hitDie / 2) + 1
  // Roll mode: a level only counts once its rolled die is locked (approved).
  const hpPerLevel: (number | null)[] = Array.from({ length: s.level }, (_, i) => {
    if (i === 0) return Math.max(1, s.hitDie + conMod)
    let die: number
    if (hpMode === 'max') die = s.hitDie
    else if (hpMode === 'avg') die = avgDie
    else if (s.hpLock[i - 1] && (s.hpDice[i - 1] ?? 0) > 0) die = s.hpDice[i - 1]
    else return null
    return Math.max(1, die + conMod)
  })
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
    setHpMode('roll')
    setS((p) => ({
      ...p,
      hpDice: Array.from({ length: p.level - 1 }, (_, i) =>
        p.hpLock[i] && p.hpDice[i] > 0 ? p.hpDice[i] : 1 + Math.floor(Math.random() * p.hitDie),
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
    setS((p) => ({ ...p, hpLock: Array.from({ length: p.level - 1 }, (_, k) => v && (p.hpDice[k] ?? 0) > 0) }))

  const changeClass = (c: string) =>
    setS((p) => ({ ...p, cls: c, hitDie: CLASS_DIE[c], saveProf: CLASS_SAVES[c], skillProf: {}, hpDice: [], hpLock: [] }))

  const barScale = Math.max(s.maxHp, s.hp + s.tempHp)
  const hpPct = s.maxHp ? clamp((s.hp / s.maxHp) * 100, 0, 100) : 0
  const lastRoll = rolls[0]
  const TABS: [Tab, string][] = [['main', 'Ability'], ['combat', 'Combat'], ['spells', 'Spells'], ['gear', 'Gear'], ['log', 'Log']]

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
              <span className={`h-0.5 rounded bg-white transition-transform ${menuOpen ? 'translate-y-[6px] rotate-45' : ''}`} />
              <span className={`h-0.5 rounded bg-white transition-opacity ${menuOpen ? 'opacity-0' : ''}`} />
              <span className={`h-0.5 rounded bg-white transition-transform ${menuOpen ? '-translate-y-[6px] -rotate-45' : ''}`} />
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
                <span className={`relative h-5 w-9 rounded-full transition-colors ${dark ? 'bg-pink' : 'bg-rule'}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${dark ? 'left-[18px]' : 'left-0.5'}`} />
                </span>
              </button>
              <Label>Characters</Label>
              {store.slots.map((c, i) => (
                <div key={i} className={`flex items-center rounded ${i === store.active ? 'bg-accent-soft' : 'hover:bg-accent-soft'}`}>
                  <button onClick={() => switchSlot(i)} className="min-w-0 flex-1 px-2 py-1.5 text-left text-sm">
                    <span className="mr-1.5 font-mono text-[10px] text-muted">{i + 1}</span>
                    {c ? (
                      <>
                        {c.name || 'Unnamed'}
                        <span className="ml-1 text-[11px] text-muted">{c.cls} {c.level}</span>
                      </>
                    ) : (
                      <span className="text-muted">+ Empty slot</span>
                    )}
                  </button>
                  {c && store.slots.filter(Boolean).length > 1 && (
                    <button onClick={() => deleteSlot(i)} aria-label={`Delete ${c.name}`} className="px-2 text-muted hover:text-danger">×</button>
                  )}
                </div>
              ))}
              <div className="my-1 border-t border-rule/70" />
              <MenuItem onClick={exportJson}>Export character (JSON)</MenuItem>
              <MenuItem onClick={() => fileRef.current?.click()}>Import character (JSON)</MenuItem>
              <MenuItem onClick={() => { setShareOpen(true); setMenuOpen(false) }}>
                {role === 'GM' ? 'Share to player' : 'Share to DM'}
              </MenuItem>
              <MenuItem onClick={attached ? removeSheetFromToken : attachCharacterToToken}>
                {attached ? 'Remove sheet from token' : 'Attach sheet to selected token'}
              </MenuItem>
              {!inObr && (
                <MenuItem onClick={() => { const r = role === 'GM' ? 'PLAYER' : 'GM'; setRole(r); localStorage.setItem('dnd5e-role', r) }}>
                  Demo view: {role === 'GM' ? 'GM' : 'Player'} (tap to switch)
                </MenuItem>
              )}
              <div className="my-1 border-t border-rule/70" />
              <MenuItem onClick={() => { setRolls([]); setMenuOpen(false) }}>Clear roll log</MenuItem>
              <MenuItem
                danger
                onClick={() => {
                  if (confirm('Reset sheet to defaults?')) setS(() => initial)
                  setMenuOpen(false)
                }}
              >
                Reset sheet
              </MenuItem>
            </div>
          )}
        </div>
        <h1 className="min-w-0 flex-1 truncate text-lg font-medium">D&amp;D 5e</h1>
        <div ref={restRef}>
          <button
            onClick={() => setRestOpen((o) => !o)}
            aria-label="Rest"
            aria-expanded={restOpen}
            title="Rest"
            className={`grid h-8 w-8 place-items-center rounded-full transition-colors ${restOpen ? 'bg-white/25' : 'hover:bg-white/20'}`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 4 3 20h18L12 4Z" />
              <path d="M12 11l-3 9M12 11l3 9" />
            </svg>
          </button>
          {restOpen && (
            <div role="dialog" aria-label="Rest" className="absolute right-2 top-11 z-30 w-44 rounded-lg border border-white/25 bg-card/60 p-2 text-ink shadow-[0_12px_40px_-8px_rgba(0,0,0,0.6)] backdrop-blur-md">
              <MenuItem onClick={() => { longRest(); flash('Long rest: HP, slots and hit dice restored'); setRestOpen(false) }}>Long rest</MenuItem>
              <MenuItem onClick={() => { shortRest(); setRestOpen(false) }}>Short rest</MenuItem>
              <MenuItem onClick={() => { dawn(); setRestOpen(false) }}>Dawn</MenuItem>
            </div>
          )}
        </div>
      </header>

      {notice && (
        <div className="pointer-events-none absolute left-0 right-0 top-14 z-40 flex justify-center px-3">
          <div className="rounded-full bg-card px-4 py-1.5 text-xs text-ink shadow-lg ring-1 ring-rule">{notice}</div>
        </div>
      )}
      {shareOpen && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black/40 p-4" onMouseDown={() => setShareOpen(false)}>
          <div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-xs rounded-lg border border-rule bg-card p-3 shadow-xl">
            <Label>{role === 'GM' ? 'Share to player' : 'Share to DM'}</Label>
            <p className="mt-1 text-[11px] text-muted">Sends a copy of {s.name || 'this character'}. They choose whether to save it.</p>
            {role === 'GM' ? (
              <div className="mt-2 space-y-1">
                {shareTargets.length === 0 && <p className="text-xs text-muted">No other players in the room.</p>}
                {shareTargets.map((p) => (
                  <button key={p.id} onClick={() => sendSheet(p.id, p.name)} className="block w-full rounded border border-rule px-2 py-2 text-left text-sm hover:bg-accent-soft">
                    {p.name}
                  </button>
                ))}
              </div>
            ) : (
              <Btn tone="green" onClick={() => sendSheet('GM', 'DM')}>Send to DM</Btn>
            )}
            <button onClick={() => setShareOpen(false)} className="mt-2 text-xs text-muted hover:text-ink">Cancel</button>
          </div>
        </div>
      )}
      {inbox && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div
            role={overwriteSlot === null ? 'dialog' : 'alertdialog'}
            aria-label={overwriteSlot === null ? 'Choose character slot' : 'Confirm overwrite'}
            className="w-full max-w-xs rounded-lg border border-rule bg-card p-3 shadow-xl"
          >
            {overwriteSlot === null ? (
              <>
                <Label>Incoming character</Label>
                <p className="mt-1 text-sm">
                  {inbox.fromName} shared <b>{inbox.sheet.name}</b> ({inbox.sheet.cls} {inbox.sheet.level}).
                </p>
                <p className="mt-2 text-[11px] text-muted">Choose a slot to save this character.</p>
                <div className="mt-2 space-y-1">
                  {store.slots.map((character, i) => (
                    <button
                      key={i}
                      onClick={() => chooseIncomingSlot(i)}
                      className="flex w-full items-center rounded border border-rule px-2 py-2 text-left hover:bg-accent-soft"
                    >
                      <span className="mr-2 font-mono text-[10px] text-muted">{i + 1}</span>
                      {character ? (
                        <span className="min-w-0">
                          <span className="block truncate text-sm">{character.name || 'Unnamed'}</span>
                          <span className="block text-[10px] text-muted">{character.cls} {character.level} · overwrite</span>
                        </span>
                      ) : (
                        <span className="text-sm text-muted">Empty slot</span>
                      )}
                    </button>
                  ))}
                </div>
                <button onClick={() => setInbox(null)} className="mt-2 text-xs text-muted hover:text-ink">Dismiss</button>
              </>
            ) : (
              <>
                <Label>Overwrite slot {overwriteSlot + 1}?</Label>
                <p className="mt-1 text-sm">
                  <b>{store.slots[overwriteSlot]?.name || 'Unnamed'}</b> will be replaced by <b>{inbox.sheet.name || 'the incoming character'}</b>.
                </p>
                <p className="mt-1 text-[11px] text-danger">This cannot be undone.</p>
                <div className="mt-3 flex gap-2">
                  <Btn tone="red" onClick={() => saveIncoming(overwriteSlot)}>Overwrite</Btn>
                  <Btn tone="plain" onClick={() => setOverwriteSlot(null)}>Cancel</Btn>
                </div>
              </>
            )}
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
              <span className="block truncate text-2xl font-medium leading-tight">{s.name}</span>
              <span className="block truncate text-xs text-muted">
                {[[s.subclass, s.cls].filter(Boolean).join(' '), s.race, s.alignment].filter(Boolean).join(' · ')} · Lv {s.level}
              </span>
            </span>
            <svg viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {open && (
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 @3xl:grid-cols-3">
              <Field label="Name" v={s.name} on={(v) => set('name', v)} />
              <label className="block border-b border-rule focus-within:border-accent">
                <span className="block text-[10px] text-muted">Class</span>
                <select value={s.cls} onChange={(e) => changeClass(e.target.value)} className="w-full pb-0.5 text-sm">
                  {CLASS_NAMES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <Field label="Subclass" v={s.subclass} on={(v) => set('subclass', v)} placeholder="e.g. Wildfire" />
              <Field label="Race" v={s.race} on={(v) => set('race', v)} />
              <Field label="Background" v={s.background} on={(v) => set('background', v)} />
              <Field label="Alignment" v={s.alignment} on={(v) => set('alignment', v)} />
              <div className="border-b border-rule">
                <span className="block text-[10px] text-muted">Level</span>
                <div className="flex items-center gap-1 pb-0.5">
                  <button onClick={() => set('level', clamp(s.level - 1, 1, 20))} disabled={s.level <= 1} aria-label="Level down" className="grid h-6 w-6 place-items-center rounded bg-pink text-onpink transition-[filter] hover:brightness-95 active:brightness-75 disabled:opacity-40">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M6 12h12" /></svg>
                  </button>
                  <span className="w-8 text-center font-mono text-sm">{s.level}</span>
                  <button onClick={() => set('level', clamp(s.level + 1, 1, 20))} disabled={s.level >= 20} aria-label="Level up" className="grid h-6 w-6 place-items-center rounded bg-pink text-onpink transition-[filter] hover:brightness-95 active:brightness-75 disabled:opacity-40">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M6 12h12M12 6v12" /></svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Vitals */}
        <section className="mt-3 border-y border-rule px-3 py-3 @3xl:grid @3xl:grid-cols-2 @3xl:items-start @3xl:gap-8 @3xl:px-6">
          <div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHpOpen((o) => !o)}
              aria-expanded={hpOpen}
              title="Set max HP"
              className={`rounded border-2 border-pink bg-pink px-1.5 py-0.5 text-xs font-bold text-onpink transition-all duration-200 hover:brightness-90 active:scale-95 active:brightness-75 ${hpOpen ? 'brightness-75' : ''}`}
            >
              HP
            </button>
            <div className="relative flex h-8 flex-1 items-center justify-center overflow-hidden rounded bg-pink/35">
              <div
                className={`absolute inset-y-0 left-0 transition-all ${hpPct <= 25 ? 'bg-red-500' : hpPct <= 50 ? 'bg-amber-400' : 'bg-green-500'}`}
                style={{ width: `${barScale ? clamp((s.hp / barScale) * 100, 0, 100) : 0}%` }}
              />
              {s.tempHp > 0 && (
                <div
                  className="absolute inset-y-0 bg-white transition-all"
                  style={{
                    left: `${barScale ? clamp((s.hp / barScale) * 100, 0, 100) : 0}%`,
                    width: `${barScale ? clamp((s.tempHp / barScale) * 100, 0, 100) : 0}%`,
                  }}
                />
              )}
              <span className="relative flex items-center rounded bg-card/85 px-1.5 font-mono text-sm font-medium text-ink">
                <NumIn v={s.hp} on={(v) => set('hp', clamp(v, 0, s.maxHp))} className="w-9 text-right" />
                <span className="px-0.5 opacity-70">/</span>
                <span className="w-9 text-left" title="Follows class, level and CON">{s.maxHp}</span>
                {s.tempHp > 0 && <span className="pl-1 text-xs font-semibold" title="Temporary HP">+{s.tempHp}</span>}
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
                  <Padlock locked className="h-3 w-3" />
                  d{s.hitDie} · {s.cls}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted">
                Level {s.level} · d{s.hitDie} · CON {sgn(conMod)} per level. Level 1 always takes the full die.
              </p>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                <button
                  onClick={rollHpDice}
                  aria-pressed={hpMode === 'roll'}
                  className={`flex items-center justify-center gap-1 rounded py-1.5 text-xs font-semibold transition-all active:scale-95 ${hpMode === 'roll' ? 'bg-pink text-onpink' : 'border border-rule hover:bg-accent-soft'}`}
                >
                  <D20 className="h-3.5 w-3.5" /> Roll
                </button>
                {([['avg', 'Average'], ['max', 'Max']] as const).map(([k, l]) => (
                  <button
                    key={k}
                    onClick={() => setHpMode(k)}
                    aria-pressed={hpMode === k}
                    className={`rounded py-1.5 text-xs font-semibold transition-all active:scale-95 ${hpMode === k ? 'bg-pink text-onpink' : 'border border-rule hover:bg-accent-soft'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {hpMode === 'roll' && s.level > 1 && (
                <div className="mt-2">
                  <div className="flex items-center justify-between">
                    <Label>Tap a rolled level to lock it</Label>
                    <button
                      onClick={() => setAllHpLocks(!Array.from({ length: s.level - 1 }).every((_, i) => s.hpLock[i]))}
                      className="text-[11px] font-medium text-accent hover:underline"
                    >
                      {Array.from({ length: s.level - 1 }).every((_, i) => s.hpLock[i]) ? 'Unlock all' : 'Lock all'}
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
                          title={locked ? 'Locked: Roll will keep this' : 'Unlocked: Roll will re-roll this'}
                          className={`flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px] transition-colors disabled:opacity-50 ${locked ? 'border-transparent bg-pink text-onpink' : 'border-rule text-muted hover:border-accent hover:text-ink'}`}
                        >
                          <Padlock locked={locked} className="h-3 w-3" />
                          L{i + 2}: {s.hpDice[i] > 0 ? s.hpDice[i] : '—'}
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
                  {hpPerLevel.map((x) => x ?? '?').join(' + ')}
                  {pendingLevels > 0 && ` · ${pendingLevels} level${pendingLevels > 1 ? 's' : ''} waiting for a lock`}
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
              onKeyDown={(e) => e.key === 'Enter' && applyHp('dmg')}
              className="h-8 min-w-0 flex-1 border-b border-rule px-1 font-mono"
              aria-label="HP amount"
            />
            <Btn onClick={() => applyHp('dmg')} tone="red">Damage</Btn>
            <Btn onClick={() => applyHp('heal')} tone="green">Heal</Btn>
            <Btn onClick={() => applyHp('temp')} tone="plain">Temp</Btn>
          </div>

          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 @3xl:mt-0">
            <Stat label="AC">
              <span className="font-mono text-lg" title="10 + DEX modifier + bonuses">{10 + m('DEX') + s.acBonus}</span>
            </Stat>
            <Stat label="Init" onClick={() => roll('Initiative', m('DEX') + s.initMisc)}>
              <span className="font-mono text-lg">{sgn(m('DEX') + s.initMisc)}</span>
            </Stat>
            <Stat label="Speed">
              <NumIn v={s.speed} on={(v) => set('speed', v)} className="w-full text-lg" />
            </Stat>
            <Stat label="Prof">
              <span className="font-mono text-lg">{sgn(pb)}</span>
            </Stat>
          </div>
        </section>

        {/* Abilities */}
        <section className="grid grid-cols-3 gap-2 px-3 py-3 @2xl:grid-cols-6 @3xl:px-6">
          {ABILITIES.map((a) => (
            <div key={a} className="rounded-md border border-rule bg-card p-1.5 text-center">
              <button
                onClick={() => roll(`${a} check`, m(a))}
                className="group w-full"
                title={`Roll ${a} check`}
              >
                <span className="block text-base font-semibold">{a}</span>
                <span className="block font-mono text-2xl leading-tight">{sgn(m(a))}</span>
              </button>
              <div className="mx-auto mt-0.5 w-fit rounded-full bg-paper px-2 py-px">
                <NumIn
                  v={s.scores[a]}
                  on={(v) => set('scores', { ...s.scores, [a]: clamp(v, 1, 30) })}
                  className="w-7 text-xs text-muted"
                />
              </div>
            </div>
          ))}
        </section>

        {/* Tabs */}
        <nav className="sticky top-0 z-10 flex border-b border-rule bg-paper" role="tablist">
          {TABS.map(([t, label]) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`relative flex-1 py-3 text-xs font-medium uppercase tracking-wide transition-colors ${tab === t ? 'text-accent' : 'text-muted hover:text-ink'}`}
            >
              {label}
              {tab === t && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" />}
            </button>
          ))}
        </nav>

        <div className="space-y-4 px-3 pb-20 pt-3 @3xl:px-6">
          {tab === 'main' && (
            <>
              <div className="grid items-start gap-4 @2xl:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]">
                <div className="@2xl:col-start-1 @2xl:row-start-1">
                  <Heading>Saving throws</Heading>
                  <ul className="grid grid-cols-3 gap-2">
                    {ABILITIES.map((a) => {
                      const p = s.saveProf.includes(a)
                      const b = m(a) + (p ? pb : 0)
                      return (
                        <li key={a} className="flex min-w-0 items-center gap-2 rounded-md border border-rule bg-card px-2 py-2">
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${p ? 'bg-accent' : 'bg-muted/30'}`} title={p ? `${s.cls} proficiency` : undefined} />
                          <span className="text-sm font-semibold">{a}</span>
                          <button
                            onClick={() => roll(`${a} save`, b)}
                            className={ROLL_BTN + ' ml-auto w-11 py-1.5 text-sm'}
                            title="Roll"
                          >
                            {sgn(b)}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                  <p className="mt-1 text-[9px] text-muted">{s.cls} proficiencies are locked.</p>
                </div>
                <div className="@2xl:col-start-1 @2xl:row-start-2">
                  <Heading>Resistances &amp; immunities</Heading>
                  <p className="min-h-12 whitespace-pre-wrap rounded-md border border-dashed border-rule p-2 text-[12.5px] leading-snug">
                    {s.defenses || <span className="text-muted">Damage, condition and spell immunities will show here.</span>}
                  </p>
                </div>
                <div className="@2xl:col-start-2 @2xl:row-span-2 @2xl:row-start-1">
                  <Heading>Senses</Heading>
                  <div className="space-y-1.5">
                    {DETAIL_SKILLS.map(([n, a]) => {
                      const b = skillBonus(n, a)
                      const st = s.skillProf[n] ?? 0
                      return (
                        <div key={n} className="rounded-md border border-rule bg-card px-2 py-1.5">
                          <div className="flex min-w-0 items-baseline gap-1">
                            <span className="truncate text-[11px] font-medium">Passive {n}</span>
                            <span className="shrink-0 text-[9px] uppercase text-muted">({a})</span>
                            <span className="ml-auto shrink-0 font-mono text-base leading-none">{10 + b}</span>
                          </div>
                          {st > 0 && <div className="text-right text-[8px] uppercase text-muted">{st === 2 ? 'expertise' : 'proficient'}</div>}
                          {s.skillNotes[n] && <p className="mt-1 whitespace-pre-wrap text-[11px] text-muted">{s.skillNotes[n]}</p>}
                        </div>
                      )
                    })}
                    <div className="rounded-md border border-rule bg-card p-2">
                      <span className="text-[12.5px] font-medium">Vision</span>
                      <p className="mt-1 whitespace-pre-wrap text-[12px] leading-snug">
                        {s.skillNotes.Vision || <span className="text-muted">None</span>}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <Heading right={`${s.cls} · ${poolUsed}/${pool.pick} chosen`}>Skills</Heading>
                <ul className="grid grid-cols-2 gap-x-4 @2xl:grid-cols-3">
                  {SKILLS.map(([n, a]) => {
                    const st = s.skillProf[n] ?? 0
                    const b = skillBonus(n, a)
                    const locked = st === 0 && !canAddSkill(n)
                    return (
                      <Row
                        key={n}
                        state={st}
                        locked={locked}
                        inPool={pool.from.includes(n)}
                        onToggle={() => set('skillProf', { ...s.skillProf, [n]: st ? 0 : 1 })}
                        label={n}
                        sub={a}
                        bonus={b}
                        onRoll={() => roll(n, b)}
                      />
                    )
                  })}
                </ul>
                <p className="mt-2 text-[11px] text-muted">Only skills in your class pool can be chosen, up to the class limit. Tap a bonus to roll.</p>
              </div>
            </>
          )}

          {tab === 'combat' && (
            <>
              <div>
                <Heading>Attacks</Heading>
                <div className="grid gap-2 @2xl:grid-cols-2">
                  {s.attacks.map((at) => (
                    <div key={at.id} className="rounded-md border border-rule bg-card p-2">
                      <div className="flex items-center gap-2">
                        <Edit v={at.name} on={(v) => upAttack(at.id, { name: v })} className="font-medium" />
                        <div className="flex h-7 w-[72px] shrink-0 items-center rounded bg-pink/35 font-mono text-onpink">
                          <input
                            value={at.bonus}
                            onChange={(e) => upAttack(at.id, { bonus: e.target.value })}
                            className="w-full min-w-0 text-center"
                            aria-label="Attack bonus"
                          />
                          <button
                            onClick={() => {
                              const b = parseInt(at.bonus)
                              if (!isNaN(b)) roll(`${at.name} attack`, b)
                            }}
                            className="grid h-full w-7 place-items-center rounded-r bg-pink"
                            aria-label="Roll attack"
                          >
                            <D20 className="h-4 w-4" />
                          </button>
                        </div>
                        <button
                          onClick={() => set('attacks', s.attacks.filter((x) => x.id !== at.id))}
                          className="text-muted hover:text-danger"
                          aria-label="Remove attack"
                        >
                          ×
                        </button>
                      </div>
                      <Edit v={at.damage} on={(v) => upAttack(at.id, { damage: v })} className="mt-0.5 text-xs text-muted" />
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => set('attacks', [...s.attacks, { id: Date.now(), name: 'New attack', bonus: '+0', damage: '1d6' }])}
                  className="mt-2 text-xs font-medium text-accent hover:underline"
                >
                  + Add attack
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-rule bg-card p-2">
                  <Label>Death saves</Label>
                  <Pips label="Success" n={s.deathS} on={(v) => set('deathS', v)} tone="bg-moss" />
                  <Pips label="Failure" n={s.deathF} on={(v) => set('deathF', v)} tone="bg-danger" />
                </div>
                <div className="rounded-md border border-rule bg-card p-2">
                  <Label>Hit dice</Label>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="font-mono text-lg">
                      {s.level - s.hitDiceUsed}/{s.level}
                      <span className="text-xs text-muted"> d{s.hitDie}</span>
                    </span>
                    <Btn
                      tone="plain"
                      onClick={() => {
                        if (s.hitDiceUsed >= s.level) return
                        const c = mod(s.scores.CON)
                        const d = 1 + Math.floor(Math.random() * s.hitDie)
                        const heal = Math.max(0, d + c)
                        setS((p) => ({ ...p, hitDiceUsed: p.hitDiceUsed + 1, hp: clamp(p.hp + heal, 0, p.maxHp) }))
                        pushRoll({ label: 'Hit die', die: `d${s.hitDie}`, face: d, mod: c, total: heal, note: `+${heal} HP` })
                      }}
                    >
                      Spend
                    </Btn>
                  </div>
                </div>
              </div>

              <div>
                <Heading>Conditions</Heading>
                <div className="flex flex-wrap gap-1.5">
                  {CONDITIONS.map((c) => {
                    const on = s.conditions.includes(c)
                    return (
                      <button
                        key={c}
                        aria-pressed={on}
                        onClick={() => set('conditions', on ? s.conditions.filter((x) => x !== c) : [...s.conditions, c])}
                        className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${on ? 'border-transparent bg-pink text-onpink' : 'border-rule text-muted hover:border-accent hover:text-ink'}`}
                      >
                        {c}
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {tab === 'spells' && (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Ability">
                  <select
                    value={s.spellAb}
                    onChange={(e) => set('spellAb', e.target.value as Ab)}
                    className="text-center font-mono text-lg"
                  >
                    {ABILITIES.map((a) => <option key={a}>{a}</option>)}
                  </select>
                </Stat>
                <Stat label="Save DC"><span className="font-mono text-lg">{8 + pb + m(s.spellAb)}</span></Stat>
                <Stat label="Attack"><span className="font-mono text-lg">{sgn(pb + m(s.spellAb))}</span></Stat>
              </div>
              <div>
                <Heading>Spell slots</Heading>
                <div className="space-y-1.5">
                  {s.slots.map((sl, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-8 text-xs font-medium text-muted">Lv {i + 1}</span>
                      <div className="flex flex-1 flex-wrap gap-1.5">
                        {Array.from({ length: sl.max }).map((_, j) => {
                          const used = j < sl.used
                          return (
                            <button
                              key={j}
                              aria-label={`Slot ${j + 1} level ${i + 1}`}
                              aria-pressed={used}
                              onClick={() => upSlot(i, { used: used && j === sl.used - 1 ? sl.used - 1 : j + 1 })}
                              className={`h-5 w-5 rounded-full border-2 border-accent transition-colors ${used ? '' : 'bg-accent'}`}
                            />
                          )
                        })}
                        {sl.max === 0 && <span className="text-xs text-muted">—</span>}
                      </div>
                      <div className="flex items-center font-mono text-xs text-muted">
                        <button className="px-1.5 hover:text-accent" onClick={() => upSlot(i, { max: Math.max(0, sl.max - 1), used: Math.min(sl.used, Math.max(0, sl.max - 1)) })} aria-label="Fewer slots">−</button>
                        {sl.max}
                        <button className="px-1.5 hover:text-accent" onClick={() => upSlot(i, { max: Math.min(9, sl.max + 1) })} aria-label="More slots">+</button>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted">Filled = available. Tap to spend or recover.</p>
              </div>
              <Area label="Spells known / prepared" v={s.spells} on={(v) => set('spells', v)} rows={8} />
            </>
          )}

          {tab === 'gear' && (
            <>
              <div className="grid grid-cols-5 gap-1.5">
                {(Object.keys(s.coins) as (keyof Sheet['coins'])[]).map((c) => (
                  <Stat key={c} label={c}>
                    <NumIn v={s.coins[c]} on={(v) => set('coins', { ...s.coins, [c]: Math.max(0, v) })} className="w-full text-base" />
                  </Stat>
                ))}
              </div>
              <Area label="Equipment" v={s.gear} on={(v) => set('gear', v)} rows={4} />
              <Area label="Features & traits" v={s.features} on={(v) => set('features', v)} rows={6} />
              <div>
                <Heading>Skill details</Heading>
                <div className="space-y-1.5">
                  {[...DETAIL_SKILLS.map(([n]) => n), 'Vision'].map((n) => (
                    <label key={n} className="flex items-center gap-2 rounded-md border border-rule bg-card px-2 py-1">
                      <span className="w-24 shrink-0 text-xs text-muted">{n}</span>
                      <input
                        value={s.skillNotes[n] ?? ''}
                        onChange={(e) => set('skillNotes', { ...s.skillNotes, [n]: e.target.value })}
                        placeholder={n === 'Vision' ? 'e.g. Darkvision 60 ft.' : 'e.g. advantage on...'}
                        className="w-full min-w-0"
                      />
                    </label>
                  ))}
                </div>
              </div>
              <Area label="Resistances & immunities" v={s.defenses} on={(v) => set('defenses', v)} rows={3} />
              <Area label="Notes" v={s.notes} on={(v) => set('notes', v)} rows={4} />
            </>
          )}

          {tab === 'log' && (
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
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
                    </svg>
                  </button>
                }
              >
                Room rolls
              </Heading>
              {rolls.length === 0 && <p className="py-6 text-center text-muted">No rolls yet. Tap an ability, skill or attack.</p>}
              <ul>
                {rolls.map((r) => (
                  <li key={r.id} className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-rule/60 px-2 py-2 ${r.die === 'd20' && r.face === 20 ? 'bg-green-700/40' : r.die === 'd20' && r.face === 1 ? 'bg-red-700/40' : ''}`}>
                    <span className="truncate text-xs font-semibold">{r.playerName}</span>
                    <span className={`row-span-2 self-center font-mono text-xs ${r.die === 'd20' && r.face === 20 ? 'text-accent' : r.die === 'd20' && r.face === 1 ? 'text-danger' : 'text-muted'}`}>
                      {rollExpr(r)} <span className="text-xl font-bold text-ink">{r.total}</span>
                    </span>
                    <span className="truncate text-[11px] text-muted">
                      {r.label}
                      {r.note && ` · ${r.note}`}
                      {r.die === 'd20' && r.face === 20 && ' · crit'}
                      {r.die === 'd20' && r.face === 1 && ' · fumble'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) importJson(file)
            e.target.value = ''
          }}
        />

        {/* Last roll toast */}
        {lastRoll && tab !== 'log' && (
          <div className="pointer-events-none sticky bottom-3 z-10 flex justify-center px-3">
            <button
              onClick={() => setTab('log')}
              className={`pointer-events-auto flex items-center gap-3 rounded-full px-4 py-1.5 text-white shadow-lg ${lastRoll.die === 'd20' && lastRoll.face === 20 ? 'bg-green-800' : lastRoll.die === 'd20' && lastRoll.face === 1 ? 'bg-red-800' : 'bg-head'}`}
            >
              <span className="max-w-[140px] truncate text-xs">{lastRoll.playerName} · {lastRoll.label}</span>
              <span className="font-mono text-lg font-medium">{lastRoll.total}</span>
              <span className={`font-mono text-[11px] ${lastRoll.die === 'd20' && (lastRoll.face === 20 || lastRoll.face === 1) ? 'font-semibold' : 'opacity-80'}`}>
                {rollFormula(lastRoll)}
                {lastRoll.die === 'd20' && lastRoll.face === 20 && ' · CRIT'}
                {lastRoll.die === 'd20' && lastRoll.face === 1 && ' · FUMBLE'}
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

function Padlock({ locked, className = '' }: { locked: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor" stroke="none" />
      <path d={locked ? 'M8 11V8a4 4 0 0 1 8 0v3' : 'M8 11V8a4 4 0 0 1 7.5-2'} />
    </svg>
  )
}

function D20({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 1.5 21 6.75v10.5L12 22.5 3 17.25V6.75L12 1.5Z" />
      <text x="12" y="15.5" textAnchor="middle" fontSize="9" fontWeight="700" fontFamily="sans-serif" fill="var(--card)">
        20
      </text>
    </svg>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">{children}</div>
}

function Heading({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <h2 className="mb-1 flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-wider text-accent">
      {children}
      {right && <span className="font-normal normal-case tracking-normal text-muted">{right}</span>}
    </h2>
  )
}

function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`block w-full rounded px-2 py-2 text-left text-sm hover:bg-accent-soft ${danger ? 'text-danger' : ''}`}
    >
      {children}
    </button>
  )
}

function Field({ label, v, on, placeholder }: { label: string; v: string; on: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block border-b border-rule focus-within:border-accent">
      <span className="block text-[10px] text-muted">{label}</span>
      <input value={v} placeholder={placeholder} onChange={(e) => on(e.target.value)} className="w-full pb-0.5 text-sm placeholder:text-muted/60" />
    </label>
  )
}

function NumField({ label, v, on }: { label: string; v: number; on: (n: number) => void }) {
  return (
    <label className="block border-b border-rule focus-within:border-accent">
      <span className="block text-[10px] text-muted">{label}</span>
      <NumIn v={v} on={on} className="w-full pb-0.5 text-left text-sm" />
    </label>
  )
}

function NumIn({ v, on, className = '' }: { v: number; on: (n: number) => void; className?: string }) {
  return (
    <input
      type="number"
      value={Number.isNaN(v) ? '' : v}
      onChange={(e) => on(parseInt(e.target.value) || 0)}
      onFocus={(e) => e.target.select()}
      className={`bg-transparent text-center font-mono ${className}`}
    />
  )
}

function Stat({ label, children, onClick }: { label: string; children: React.ReactNode; onClick?: () => void }) {
  const cls = 'flex flex-col items-center justify-center rounded-md border border-rule bg-card px-1 py-1.5 text-center'
  const inner = (
    <>
      {children}
      <Label>{label}</Label>
    </>
  )
  return onClick ? (
    <button onClick={onClick} className={`${cls} transition-colors hover:bg-accent-soft`} title="Roll">
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  )
}

function Btn({ children, onClick, tone }: { children: React.ReactNode; onClick: () => void; tone: 'red' | 'green' | 'plain' }) {
  const t =
    tone === 'red'
      ? 'bg-danger text-onaccent hover:opacity-90'
      : tone === 'green'
        ? 'bg-moss text-onaccent hover:opacity-90'
        : 'border border-accent text-accent hover:bg-accent-soft'
  return (
    <button onClick={onClick} className={`h-8 rounded px-3 text-xs font-semibold transition-colors ${t}`}>
      {children}
    </button>
  )
}

function Row({
  state, locked, inPool, onToggle, label, sub, bonus, onRoll,
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
        title={locked ? 'Locked: not in your class pool, or class picks used up' : undefined}
        className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${locked ? 'cursor-not-allowed border-rule opacity-50' : inPool ? 'border-accent' : 'border-muted'}`}
      >
        {state > 0 && (
          <span className={`h-2 w-2 rounded-full ${state === 2 ? 'bg-pink ring-1 ring-pink ring-offset-1 ring-offset-paper' : 'bg-accent'}`} />
        )}
      </button>
      <button
        onClick={onRoll}
        className={ROLL_BTN + ' w-8 py-0.5 text-xs'}
        title="Roll"
      >
        {sgn(bonus)}
      </button>
      <span className={`truncate text-[12.5px] ${locked ? 'text-muted' : ''}`}>{label}</span>
      {sub && <span className="ml-auto text-[9px] uppercase text-muted">{sub}</span>}
    </li>
  )
}

function Pips({ label, n, on, tone }: { label: string; n: number; on: (n: number) => void; tone: string }) {
  return (
    <div className="mt-1 flex items-center justify-between">
      <span className="text-xs text-muted">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3].map((i) => (
          <button
            key={i}
            aria-label={`${label} ${i}`}
            onClick={() => on(n === i ? i - 1 : i)}
            className={`h-4 w-4 rounded-full border border-muted ${n >= i ? `${tone} border-transparent` : ''}`}
          />
        ))}
      </div>
    </div>
  )
}

function Edit({ v, on, className = '' }: { v: string; on: (v: string) => void; className?: string }) {
  return <input value={v} onChange={(e) => on(e.target.value)} className={`w-full min-w-0 ${className}`} />
}

function Area({ label, v, on, rows }: { label: string; v: string; on: (v: string) => void; rows: number }) {
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
