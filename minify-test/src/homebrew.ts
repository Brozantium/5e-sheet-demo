import "../style.css"
import "../homebrew.css"

type CategoryKey = "races" | "backgrounds" | "feats" | "spells" | "actions" | "items" | "magicitems" | "creatures" | "classes" | "subclasses"
type Edition = "shared" | "2014" | "2024"
type FieldSpec = { key: string; label: string; kind?: "text" | "number" | "list" | "select"; options?: string[]; hint?: string }
type HBItem = { id: string; name: string; source: "Homebrew"; kind: string; edition: Edition; description?: string; effects?: unknown[]; createdAt?: string; updatedAt?: string; [key: string]: unknown }
type Category = { key: CategoryKey; label: string; singular: string; kind: string }

const STORE = "brozantium.homebrew.drafts.v1"
const CATEGORIES: Category[] = [
  { key: "races", label: "Races", singular: "Race", kind: "race" },
  { key: "backgrounds", label: "Backgrounds", singular: "Background", kind: "background" },
  { key: "feats", label: "Feats", singular: "Feat", kind: "feat" },
  { key: "spells", label: "Spells", singular: "Spell", kind: "spell" },
  { key: "actions", label: "Actions", singular: "Action", kind: "action" },
  { key: "items", label: "Weapons & gear", singular: "Item", kind: "item" },
  { key: "magicitems", label: "Magic items", singular: "Magic item", kind: "magic" },
  { key: "creatures", label: "Creatures", singular: "Creature", kind: "creature" },
  { key: "classes", label: "Classes", singular: "Class", kind: "class" },
  { key: "subclasses", label: "Subclasses", singular: "Subclass", kind: "subclass" },
]
const FIELDS: Record<CategoryKey, FieldSpec[]> = {
  races: [
    { key: "size", label: "Size", kind: "select", options: ["Small", "Medium", "Small or Medium", "Large", "Varies"] },
    { key: "speed", label: "Walking speed (ft.)", kind: "number" },
    { key: "languages", label: "Languages", kind: "list", hint: "Comma-separated" },
  ],
  backgrounds: [
    { key: "skillProficiencies", label: "Skill proficiencies", kind: "list", hint: "Insight, Religion" },
    { key: "toolProficiencies", label: "Tool proficiencies", kind: "list", hint: "Comma-separated" },
    { key: "featureName", label: "Background feature", kind: "text" },
  ],
  feats: [
    { key: "prerequisites", label: "Prerequisites", kind: "text" },
    { key: "featType", label: "Feat type", kind: "select", options: ["Origin", "General", "Fighting Style", "Epic Boon", "Other"] },
  ],
  spells: [
    { key: "level", label: "Spell level (0–9)", kind: "number" },
    { key: "school", label: "School", kind: "select", options: ["Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation"] },
    { key: "castingTime", label: "Casting time", kind: "text" },
    { key: "range", label: "Range", kind: "text" },
    { key: "duration", label: "Duration", kind: "text" },
  ],
  actions: [
    { key: "actionType", label: "Action type", kind: "select", options: ["Action", "Bonus Action", "Reaction", "Free", "Other"] },
    { key: "activation", label: "Activation requirement", kind: "text" },
  ],
  items: [
    { key: "itemType", label: "Item type", kind: "select", options: ["Weapon", "Armor", "Shield", "Gear", "Tool", "Ammunition", "Consumable"] },
    { key: "rarity", label: "Rarity", kind: "select", options: ["Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact"] },
    { key: "weight", label: "Weight", kind: "text" },
  ],
  magicitems: [
    { key: "itemType", label: "Item type", kind: "text", hint: "Weapon, Wondrous Item..." },
    { key: "rarity", label: "Rarity", kind: "select", options: ["Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact"] },
    { key: "attunement", label: "Attunement", kind: "select", options: ["None", "Required", "Optional", "Required by a specific class"] },
  ],
  creatures: [
    { key: "creatureType", label: "Creature type", kind: "text" },
    { key: "size", label: "Size", kind: "select", options: ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"] },
    { key: "challenge", label: "Challenge rating", kind: "text" },
  ],
  classes: [
    { key: "hitDie", label: "Hit die", kind: "select", options: ["d6", "d8", "d10", "d12"] },
    { key: "subclassLevel", label: "Subclass level", kind: "number" },
  ],
  subclasses: [
    { key: "parentClass", label: "Parent class", kind: "text" },
    { key: "subclassLevel", label: "Subclass level", kind: "number" },
  ],
}

const app = document.querySelector<HTMLElement>("#app")
if (!app) throw new Error("Missing #app mount element")
let active: CategoryKey = "races"
let search = ""
let editingId: string | null = null

function categoryForKind(kind: unknown): CategoryKey | null {
  const k = String(kind ?? "").toLowerCase()
  if (["race", "species"].includes(k)) return "races"
  if (k === "background") return "backgrounds"
  if (k === "feat") return "feats"
  if (k === "spell") return "spells"
  if (k === "action") return "actions"
  if (["item", "weapon", "armor", "shield", "gear", "tool", "ammunition", "consumable"].includes(k)) return "items"
  if (["magic", "magic-item", "magicitem"].includes(k)) return "magicitems"
  if (["creature", "monster"].includes(k)) return "creatures"
  if (k === "class") return "classes"
  if (k === "subclass") return "subclasses"
  return null
}

function readStored(): HBItem[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORE) ?? "[]")
    if (!Array.isArray(value)) return []
    return value.filter((item): item is HBItem => Boolean(item && typeof item === "object"
      && typeof (item as HBItem).id === "string" && typeof (item as HBItem).name === "string"
      && typeof (item as HBItem).kind === "string"))
  } catch { return [] }
}
let items: HBItem[] = readStored()

function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c] ?? c)
}
function slug(value: string): string {
  return value.toLowerCase().trim().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "homebrew"
}
function makeId(name: string): string {
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)
  return "hb-" + slug(name) + "-" + suffix
}
function currentCategory(): Category { return CATEGORIES.find(x => x.key === active) ?? CATEGORIES[0] }
function payload() { return { schemaVersion: 1, app: "Brozantium Homebrew Drafts", exportedAt: new Date().toISOString(), items } }
function save(): void {
  localStorage.setItem(STORE, JSON.stringify(items))
  render()
}
function download(): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload(), null, 2)], { type: "application/json" }))
  const a = document.createElement("a")
  a.href = url
  a.download = "brozantium-homebrew-backup.json"
  document.body.append(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
function icon(key: CategoryKey): string {
  return ({ races:"✧", backgrounds:"⌂", feats:"✦", spells:"✺", actions:"⚡", items:"⚒", magicitems:"◈", creatures:"♜", classes:"⚔", subclasses:"◇" } as Record<CategoryKey,string>)[key]
}
function description(key: CategoryKey): string {
  return ({
    races:"Size, speed, languages, traits, and effects such as ability score changes or proficiencies.",
    backgrounds:"Skill and tool proficiencies, languages, starting equipment, and background features.",
    feats:"Prerequisites, feat categories, benefits, and mechanical effects.",
    spells:"Spell level, school, casting time, range, duration, and spell effects.",
    actions:"Custom actions, activation timing, and associated effects.",
    items:"Weapons, armor, shields, gear, tools, ammunition, and consumables.",
    magicitems:"Rarity, attunement, item type, properties, and magical effects.",
    creatures:"Creature type, size, challenge rating, traits, and actions.",
    classes:"Hit die, class features, progression, and class-specific selections.",
    subclasses:"Parent class, subclass level, features, and progression details.",
  } as Record<CategoryKey,string>)[key]
}
function renderShell(): void {
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <a class="brand" href="./" aria-label="Brozantium Character Builder"><span class="brand-mark">5e</span><span class="brand-copy"><strong>BROZANTIUM</strong><small>CHARACTER TOOLS</small></span></a>
        <div class="sidebar-label">WORKSPACE</div>
        <nav class="side-nav" aria-label="Navigasi halaman">
          <a class="nav-link" href="./"><span class="nav-icon">✦</span><span>Character Builder</span></a>
          <a class="nav-link active" href="./homebrew.html"><span class="nav-icon">◇</span><span>Homebrew</span></a>
        </nav>
        <div class="sidebar-spacer"></div>
        <div class="source-card"><span class="source-orb"></span><div><strong>Local Homebrew Vault</strong><small id="sidebar-count">0 drafts on this device</small></div></div>
        <div class="sidebar-foot">Draft workspace · Not synced to character sheets</div>
      </aside>
      <div class="workspace">
        <header class="topbar"><div class="breadcrumbs"><span>WORKSPACE</span><span class="crumb-separator">/</span><strong>HOMEBREW</strong></div><span class="topbar-note"><span class="draft-dot"></span> Saved on this device</span></header>
        <main class="main-content homebrew-main">
          <div class="homebrew-heading"><div><p class="eyebrow">CREATE · CUSTOM CONTENT</p><h1>Your <em>Homebrew.</em></h1><p class="intro-copy">Buat dan kelola konten buatanmu sendiri. Draft tersimpan di browser ini dan dapat dicadangkan sebagai JSON.</p></div>
            <div class="toolbar"><button type="button" class="tool-button" id="export-file">Export file</button><button type="button" class="tool-button" id="import-file">Import file</button><button type="button" class="tool-button" id="copy-json">Copy as JSON</button><button type="button" class="tool-button" id="paste-json">Paste JSON</button><input id="file-input" type="file" accept="application/json,.json" hidden /></div>
          </div>
          <section class="risk-banner" id="risk-banner" role="status"><span class="risk-symbol">!</span><p><strong>Local drafts only.</strong> Homebrew tersimpan di browser ini. Membersihkan data situs atau pindah perangkat dapat menghapusnya. Export backup secara berkala.</p><button type="button" class="risk-dismiss" id="dismiss-risk" aria-label="Tutup peringatan">×</button></section>
          <section class="homebrew-workspace">
            <nav class="category-list category-chips" id="category-list" aria-label="Homebrew categories"></nav>
            <div class="content-column">
              <div class="content-toolbar"><div><p class="eyebrow">CUSTOM CONTENT</p><h2 id="category-title">Races</h2></div><button type="button" class="primary-button" id="new-item">＋ New race</button></div>
              <div class="list-tools"><label class="search-box"><span>⌕</span><input type="search" id="search-items" placeholder="Search your homebrew..." autocomplete="off" /></label><span class="list-count" id="list-count">0 entries</span></div>
              <div class="item-list" id="item-list"></div>
            </div>
          </section>
          <footer class="app-footer"><nav class="footer-links" aria-label="Footer navigation"><a href="./">Character Builder</a><a href="./homebrew.html" aria-current="page">Homebrew</a></nav><span>BROZANTIUM · HOMEBREW WORKSPACE</span><button type="button" class="dice-button" id="dice-button">⚄ Dice</button></footer>
        </main>
      </div>
    </div>
    <dialog class="editor-dialog" id="editor-dialog"><form id="editor-form">
      <div class="dialog-heading"><div><p class="eyebrow">HOMEBREW EDITOR</p><h2 id="editor-title">Create content</h2></div><button type="button" class="icon-button" data-close-editor aria-label="Close editor">×</button></div>
      <div class="dialog-fields">
        <label class="field full-field"><span>Name</span><input id="editor-name" required maxlength="100" placeholder="Give your creation a name" /></label>
        <label class="field"><span>Ruleset / edition</span><select id="editor-edition"><option value="shared">Shared / both</option><option value="2014">2014</option><option value="2024">2024</option></select></label>
        <label class="field"><span>Content ID</span><input id="editor-id" maxlength="120" placeholder="Generated from name" /></label>
        <div id="extra-fields" class="extra-fields full-field"></div>
        <label class="field full-field"><span>Description</span><textarea id="editor-description" rows="4" placeholder="Describe what this content does..."></textarea></label>
        <label class="field full-field"><span>Effects (JSON array)</span><textarea id="editor-effects" rows="5" spellcheck="false" placeholder='[{"type":"..."}]'></textarea><small>Opsional. Gunakan array effects sesuai format kontenmu.</small></label>
      </div>
      <p class="form-error" id="form-error" role="alert"></p><div class="dialog-actions"><button type="button" class="tool-button" data-close-editor>Cancel</button><button type="submit" class="primary-button">Save draft</button></div>
    </form></dialog>
    <dialog class="json-dialog" id="json-dialog"><div class="dialog-heading"><div><p class="eyebrow">JSON TRANSFER</p><h2 id="json-title">Paste homebrew JSON</h2></div><button type="button" class="icon-button" data-close-json aria-label="Close JSON dialog">×</button></div>
      <p class="json-help" id="json-help"></p><textarea id="json-textarea" rows="13" spellcheck="false" placeholder='{"items":[...]}'></textarea><p class="form-error" id="json-error" role="alert"></p>
      <div class="dialog-actions"><button type="button" class="tool-button" data-close-json>Close</button><button type="button" class="primary-button" id="apply-json">Import JSON</button></div></dialog>
    <dialog class="dice-dialog" id="dice-dialog"><div class="dialog-heading"><div><p class="eyebrow">QUICK ROLL</p><h2>Dice roller</h2></div><button type="button" class="icon-button" id="dice-close" aria-label="Close dice roller">×</button></div><div class="dice-controls"><label class="field"><span>Die</span><select id="dice-sides"><option value="4">d4</option><option value="6">d6</option><option value="8">d8</option><option value="10">d10</option><option value="12">d12</option><option value="20" selected>d20</option><option value="100">d100</option></select></label><label class="field"><span>Number of dice</span><input id="dice-count" type="number" min="1" max="20" value="1" /></label></div><button type="button" class="primary-button dice-roll" id="dice-roll">Roll dice</button><output class="dice-result" id="dice-result" aria-live="polite">—</output></dialog>
  `
}
function renderCategories(): void {
  const nav = document.querySelector<HTMLElement>("#category-list")
  if (!nav) return
  nav.innerHTML = CATEGORIES.map(c =>
    `<button type="button" class="category-button ${active === c.key ? "active" : ""}" data-category="${c.key}" aria-pressed="${active === c.key}"><span class="category-label">${c.label}</span></button>`
  ).join("")
  const side = document.querySelector<HTMLElement>("#sidebar-count")
  if (side) side.textContent = items.length + " drafts on this device"
}
function fieldSummary(item: HBItem): string[] {
  return FIELDS[active].flatMap(field => {
    const value = item[field.key]
    if (Array.isArray(value)) return value.length ? [field.label + ": " + value.join(", ")] : []
    return value !== undefined && value !== null && String(value).trim() ? [field.label + ": " + String(value)] : []
  }).slice(0, 3)
}
function renderList(): void {
  const list = document.querySelector<HTMLElement>("#item-list")
  const title = document.querySelector<HTMLElement>("#category-title")
  const newButton = document.querySelector<HTMLButtonElement>("#new-item")
  const count = document.querySelector<HTMLElement>("#list-count")
  const cat = currentCategory()
  if (title) title.textContent = cat.label
  if (newButton) newButton.textContent = "＋ New " + cat.singular.toLowerCase()
  if (!list) return
  const q = search.trim().toLowerCase()
  const visible = items.filter(item => categoryForKind(item.kind) === active)
    .filter(item => !q || (item.name + " " + String(item.description ?? "")).toLowerCase().includes(q))
    .sort((a,b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")))
  if (count) count.textContent = visible.length + (visible.length === 1 ? " entry" : " entries")
  if (!visible.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-emblem">${icon(active)}</div><h3>${q ? "No matching homebrew" : "Nothing here yet."}</h3><p>${q ? "Try another search term or clear the search." : "Your custom " + cat.label.toLowerCase() + " will appear here. Create your first entry to get started."}</p>${q ? "" : '<button type="button" class="primary-button" data-create-empty>＋ Create ' + cat.singular.toLowerCase() + "</button>"}</div>`
    return
  }
  list.innerHTML = visible.map(item => {
    const tags = fieldSummary(item)
    const edition = item.edition ?? "shared"
    return `<article class="homebrew-item"><div class="item-symbol">${icon(active)}</div><div class="item-body"><div class="item-title-row"><h3>${esc(item.name)}</h3><span class="edition-pill">${esc(edition === "shared" ? "SHARED" : edition)}</span></div><p class="item-description">${esc(item.description || "No description added yet.")}</p>${tags.length ? '<div class="item-tags">' + tags.map(v => "<span>" + esc(v) + "</span>").join("") + "</div>" : ""}<div class="item-meta"><span>Homebrew</span><span>·</span><code>${esc(item.id)}</code></div></div><div class="item-actions"><button type="button" class="quiet-button" data-action="edit" data-id="${esc(item.id)}">Edit</button><button type="button" class="quiet-button danger" data-action="delete" data-id="${esc(item.id)}">Delete</button></div></article>`
  }).join("")
}
function renderRisk(): void {
  const banner = document.querySelector<HTMLElement>("#risk-banner")
  try { if (banner) banner.hidden = localStorage.getItem(STORE + ".risk-dismissed") === "yes" } catch { /* leave notice visible */ }
}
function render(): void { renderCategories(); renderList(); renderRisk() }

function showEditor(item?: HBItem): void {
  editingId = item?.id ?? null
  const dialog = document.querySelector<HTMLDialogElement>("#editor-dialog")
  const title = document.querySelector<HTMLElement>("#editor-title")
  const name = document.querySelector<HTMLInputElement>("#editor-name")
  const id = document.querySelector<HTMLInputElement>("#editor-id")
  const edition = document.querySelector<HTMLSelectElement>("#editor-edition")
  const desc = document.querySelector<HTMLTextAreaElement>("#editor-description")
  const effects = document.querySelector<HTMLTextAreaElement>("#editor-effects")
  const extra = document.querySelector<HTMLElement>("#extra-fields")
  const error = document.querySelector<HTMLElement>("#form-error")
  if (!dialog || !name || !id || !edition || !desc || !effects || !extra) return
  if (title) title.textContent = item ? "Edit " + item.name : "Create " + currentCategory().singular
  name.value = item?.name ?? ""
  id.value = item?.id ?? ""
  edition.value = item?.edition ?? "shared"
  desc.value = String(item?.description ?? "")
  effects.value = JSON.stringify(item?.effects ?? [], null, 2)
  if (error) error.textContent = ""
  extra.innerHTML = FIELDS[active].map(field => {
    const value = item?.[field.key]
    const current = Array.isArray(value) ? value.join(", ") : String(value ?? "")
    if (field.kind === "select") return `<label class="field"><span>${field.label}</span><select data-extra-key="${field.key}"><option value="">Select…</option>${(field.options ?? []).map(option => `<option value="${esc(option)}" ${current === option ? "selected" : ""}>${esc(option)}</option>`).join("")}</select></label>`
    return `<label class="field"><span>${field.label}</span><input data-extra-key="${field.key}" type="${field.kind === "number" ? "number" : "text"}" value="${esc(current)}" placeholder="${esc(field.hint ?? "")}" /></label>`
  }).join("")
  dialog.showModal()
  name.focus()
}
function closeEditor(): void { document.querySelector<HTMLDialogElement>("#editor-dialog")?.close(); editingId = null }

function showJson(mode: "paste" | "copy", text = ""): void {
  const dialog = document.querySelector<HTMLDialogElement>("#json-dialog")
  const title = document.querySelector<HTMLElement>("#json-title")
  const help = document.querySelector<HTMLElement>("#json-help")
  const area = document.querySelector<HTMLTextAreaElement>("#json-textarea")
  const apply = document.querySelector<HTMLButtonElement>("#apply-json")
  const error = document.querySelector<HTMLElement>("#json-error")
  if (!dialog || !title || !help || !area || !apply) return
  title.textContent = mode === "paste" ? "Paste homebrew JSON" : "JSON backup"
  help.textContent = mode === "paste" ? "Paste a Brozantium backup or an array of homebrew objects. Matching IDs are updated." : "Clipboard access is unavailable. Select and copy the JSON below."
  area.value = text
  area.readOnly = mode === "copy"
  apply.hidden = mode === "copy"
  if (error) error.textContent = ""
  dialog.showModal()
  if (mode === "paste") area.focus(); else area.select()
}

function mergeImported(raw: unknown): number {
  const data = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as {items?:unknown}).items) ? (raw as {items:unknown[]}).items : null
  if (!data) throw new Error("JSON harus berupa array atau object backup dengan properti items[].")
  let count = 0
  for (const value of data) {
    if (!value || typeof value !== "object") continue
    const item = value as Record<string,unknown>
    const id = typeof item.id === "string" ? item.id.trim() : ""
    const name = typeof item.name === "string" ? item.name.trim() : ""
    const mapped = categoryForKind(item.kind)
    if (!id || !name || !mapped) continue
    const editionValue = item.edition ?? item.ruleset
    const edition: Edition = editionValue === "2014" || editionValue === "2024" ? editionValue : "shared"
    const normalized = { ...item, id, name, source:"Homebrew", kind:CATEGORIES.find(c => c.key === mapped)?.kind, edition, updatedAt:new Date().toISOString() } as HBItem
    const index = items.findIndex(existing => existing.id === id)
    if (index >= 0) items[index] = normalized
    else items.push(normalized)
    count++
  }
  if (!count) throw new Error("Tidak ada item yang dikenali. Tiap item perlu memiliki id, name, dan kind yang didukung.")
  return count
}

function saveEditor(event: SubmitEvent): void {
  event.preventDefault()
  const nameInput = document.querySelector<HTMLInputElement>("#editor-name")
  const idInput = document.querySelector<HTMLInputElement>("#editor-id")
  const editionInput = document.querySelector<HTMLSelectElement>("#editor-edition")
  const descInput = document.querySelector<HTMLTextAreaElement>("#editor-description")
  const effectsInput = document.querySelector<HTMLTextAreaElement>("#editor-effects")
  const error = document.querySelector<HTMLElement>("#form-error")
  if (!nameInput || !idInput || !editionInput || !descInput || !effectsInput) return
  const name = nameInput.value.trim()
  if (!name) { if (error) error.textContent = "Name is required."; return }
  let effects: unknown[] = []
  if (effectsInput.value.trim()) {
    try { const parsed: unknown = JSON.parse(effectsInput.value); if (!Array.isArray(parsed)) throw new Error("Effects must be a JSON array."); effects = parsed }
    catch (issue) { if (error) error.textContent = issue instanceof Error ? issue.message : "Invalid effects JSON."; return }
  }
  const existing = editingId ? items.find(item => item.id === editingId) : undefined
  const id = idInput.value.trim() || existing?.id || makeId(name)
  const next: HBItem = { ...(existing ?? {}), id, name, source:"Homebrew", kind:currentCategory().kind, edition:editionInput.value as Edition, description:descInput.value.trim(), effects, createdAt:existing?.createdAt ?? new Date().toISOString(), updatedAt:new Date().toISOString() }
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-extra-key]").forEach(input => {
    const key = input.dataset.extraKey
    if (!key) return
    const spec = FIELDS[active].find(field => field.key === key)
    const value = input.value.trim()
    if (!value) delete next[key]
    else if (spec?.kind === "number") { const n = Number(value); if (Number.isFinite(n)) next[key] = n }
    else if (spec?.kind === "list") next[key] = value.split(",").map(part => part.trim()).filter(Boolean)
    else next[key] = value
  })
  if (items.some(item => item.id === id && item.id !== editingId)) { if (error) error.textContent = "ID already exists. Choose a different content ID."; return }
  if (editingId) items = items.map(item => item.id === editingId ? next : item)
  else items.push(next)
  try { localStorage.setItem(STORE, JSON.stringify(items)); closeEditor(); render() }
  catch { if (error) error.textContent = "Browser storage is full or unavailable. Export a backup and remove some drafts." }
}

function bind(): void {
  const diceDialog = document.querySelector<HTMLDialogElement>("#dice-dialog")
  document.querySelector<HTMLButtonElement>("#dice-button")?.addEventListener("click", () => diceDialog?.showModal())
  document.querySelector<HTMLButtonElement>("#dice-close")?.addEventListener("click", () => diceDialog?.close())
  document.querySelector<HTMLButtonElement>("#dice-roll")?.addEventListener("click", () => {
    const sides = Number(document.querySelector<HTMLSelectElement>("#dice-sides")?.value ?? 20)
    const countInput = document.querySelector<HTMLInputElement>("#dice-count")
    const count = Math.max(1, Math.min(20, Math.floor(Number(countInput?.value ?? 1) || 1)))
    if (countInput) countInput.value = String(count)
    const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1)
    const total = rolls.reduce((sum, value) => sum + value, 0)
    const result = document.querySelector<HTMLOutputElement>("#dice-result")
    if (result) result.textContent = count === 1 ? `d${sides}: ${total}` : `${count}d${sides}: ${rolls.join(" + ")} = ${total}`
  })
  document.querySelector<HTMLElement>("#category-list")?.addEventListener("click", event => {
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    const button = target.closest<HTMLButtonElement>("[data-category]")
    const value = button?.dataset.category as CategoryKey | undefined
    if (!value || !CATEGORIES.some(c => c.key === value)) return
    active = value
    renderCategories()
    renderList()
  })
  document.querySelector<HTMLButtonElement>("#new-item")?.addEventListener("click", () => showEditor())
  document.querySelector<HTMLElement>("#item-list")?.addEventListener("click", event => {
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    const button = target.closest<HTMLButtonElement>("button")
    if (!button) return
    if (button.hasAttribute("data-create-empty")) { showEditor(); return }
    const id = button.dataset.id
    const item = items.find(entry => entry.id === id)
    if (!item) return
    if (button.dataset.action === "edit") {
      const mapped = categoryForKind(item.kind)
      if (mapped) active = mapped
      renderCategories(); renderList(); showEditor(item)
    }
    if (button.dataset.action === "delete" && window.confirm("Delete " + item.name + "? This cannot be undone unless you have a backup.")) {
      items = items.filter(entry => entry.id !== id)
      save()
    }
  })
  document.querySelector<HTMLInputElement>("#search-items")?.addEventListener("input", event => { search = (event.currentTarget as HTMLInputElement).value; renderList() })
  document.querySelector<HTMLFormElement>("#editor-form")?.addEventListener("submit", saveEditor)
  document.querySelectorAll<HTMLElement>("[data-close-editor]").forEach(button => button.addEventListener("click", closeEditor))
  document.querySelector<HTMLButtonElement>("#export-file")?.addEventListener("click", download)
  document.querySelector<HTMLButtonElement>("#import-file")?.addEventListener("click", () => document.querySelector<HTMLInputElement>("#file-input")?.click())
  document.querySelector<HTMLInputElement>("#file-input")?.addEventListener("change", async event => {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    try {
      const count = mergeImported(JSON.parse(await file.text()) as unknown)
      localStorage.setItem(STORE, JSON.stringify(items)); render()
      window.alert("Imported " + count + " homebrew entr" + (count === 1 ? "y." : "ies."))
    } catch (issue) { window.alert(issue instanceof Error ? issue.message : "Could not import this file.") }
    finally { input.value = "" }
  })
  document.querySelector<HTMLButtonElement>("#copy-json")?.addEventListener("click", async () => {
    const json = JSON.stringify(payload(), null, 2)
    try { await navigator.clipboard.writeText(json); window.alert("Homebrew JSON copied.") }
    catch { showJson("copy", json) }
  })
  document.querySelector<HTMLButtonElement>("#paste-json")?.addEventListener("click", () => showJson("paste"))
  document.querySelector<HTMLDialogElement>("#json-dialog")?.querySelectorAll<HTMLElement>("[data-close-json]").forEach(button => button.addEventListener("click", () => document.querySelector<HTMLDialogElement>("#json-dialog")?.close()))
  document.querySelector<HTMLButtonElement>("#apply-json")?.addEventListener("click", () => {
    const area = document.querySelector<HTMLTextAreaElement>("#json-textarea")
    const error = document.querySelector<HTMLElement>("#json-error")
    if (!area) return
    try {
      const count = mergeImported(JSON.parse(area.value) as unknown)
      localStorage.setItem(STORE, JSON.stringify(items))
      document.querySelector<HTMLDialogElement>("#json-dialog")?.close()
      render()
      window.alert("Imported " + count + " homebrew entr" + (count === 1 ? "y." : "ies."))
    } catch (issue) { if (error) error.textContent = issue instanceof Error ? issue.message : "Invalid JSON." }
  })
  document.querySelector<HTMLButtonElement>("#dismiss-risk")?.addEventListener("click", () => {
    localStorage.setItem(STORE + ".risk-dismissed", "yes")
    renderRisk()
  })
}

renderShell()
render()
bind()
