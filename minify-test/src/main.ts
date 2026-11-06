import {
  getProficiencyBonus,
  getSafeLevel,
  loadRulesetContent,
  type BackgroundEntry,
  type ClassEntry,
  type RaceEntry,
  type Ruleset,
  type RulesetContent,
} from "./shared-logic"

const app = document.querySelector<HTMLElement>("#app")
if (!app) throw new Error("Missing #app mount element")

const pageVariant = document.body.dataset.page === "alternate" ? "B" : "A"
let activeRuleset: Ruleset = "2014"
let content: RulesetContent | null = null
let characterName = "Astra"
let characterLevel = 1
let selectedClassId = "fighter"
let selectedRaceId = "human"
let selectedBackgroundId = "acolyte"

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }
    return entities[character] ?? character
  })
}

function shortText(value: string | undefined, maxLength = 250): string {
  const text = (value ?? "").trim()
  if (!text) return "Belum ada deskripsi untuk konten ini."
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}…` : text
}

function abilityLabel(value: string | undefined): string {
  if (!value) return "—"
  const names: Record<string, string> = {
    str: "Strength", dex: "Dexterity", con: "Constitution",
    int: "Intelligence", wis: "Wisdom", cha: "Charisma",
  }
  return names[value.toLowerCase()] ?? value
}

function selected<T extends { id: string }>(items: T[], id: string): T | undefined {
  return items.find((item) => item.id === id)
}

function ensureSelection<T extends { id: string }>(items: T[], currentId: string, fallbackId: string): string {
  if (items.some((item) => item.id === currentId)) return currentId
  if (items.some((item) => item.id === fallbackId)) return fallbackId
  return items[0]?.id ?? ""
}

function optionsFor<T extends { id: string; name: string; source?: string }>(items: T[], currentId: string): string {
  return items.map((item) => {
    const source = item.source ? ` · ${item.source}` : ""
    return `<option value="${escapeHtml(item.id)}" ${item.id === currentId ? "selected" : ""}>${escapeHtml(item.name)}${escapeHtml(source)}</option>`
  }).join("")
}

function currentSelections(): { characterClass?: ClassEntry; race?: RaceEntry; background?: BackgroundEntry } {
  if (!content) return {}
  return {
    characterClass: selected(content.classes, selectedClassId),
    race: selected(content.races, selectedRaceId),
    background: selected(content.backgrounds, selectedBackgroundId),
  }
}

function renderShell(): void {
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <a class="brand" href="./" aria-label="Brozantium Character Builder">
          <span class="brand-mark">5e</span>
          <span class="brand-copy"><strong>BROZANTIUM</strong><small>CHARACTER TOOLS</small></span>
        </a>
        <div class="sidebar-label">WORKSPACE</div>
        <nav class="side-nav" aria-label="Navigasi halaman">
          <a class="nav-link active" href="#identity"><span class="nav-icon">✦</span><span>Character Builder</span></a>
          <a class="nav-link" href="#choices"><span class="nav-icon">◈</span><span>Build Options</span></a>
          <a class="nav-link" href="./homebrew.html"><span class="nav-icon">◇</span><span>Homebrew</span></a>
          <a class="nav-link" href="#preview"><span class="nav-icon">▤</span><span>Character Preview</span></a>
        </nav>
        <div class="sidebar-spacer"></div>
        <div class="source-card"><span class="source-orb"></span><div><strong>JSON Content Registry</strong><small>Connected to /data</small></div></div>
        <div class="sidebar-foot">Independent HTML interface · Build test ${pageVariant}</div>
      </aside>

      <div class="workspace">
        <header class="topbar">
          <div class="breadcrumbs"><span>WORKSPACE</span><span class="crumb-separator">/</span><strong>CHARACTER BUILDER</strong></div>
          <div class="ruleset-control" role="group" aria-label="Pilih ruleset">
            <span class="ruleset-caption">RULESET</span>
            <button type="button" class="ruleset-button active" data-ruleset="2014" aria-pressed="true">2014</button>
            <button type="button" class="ruleset-button" data-ruleset="2024" aria-pressed="false">2024</button>
          </div>
        </header>

        <main class="main-content">
          <section class="page-intro">
            <div>
              <p class="eyebrow">CHARACTER WORKSHOP <span>·</span> NEW ADVENTURER</p>
              <h1>Build your <em>legend.</em></h1>
              <p class="intro-copy">Rancang karakter dari sumber konten yang sesuai dengan ruleset pilihanmu.</p>
            </div>
            <div class="draft-state"><span class="draft-dot"></span><span>Draft · Session only</span></div>
          </section>

          <div class="builder-layout">
            <div class="builder-main">
              <section class="panel identity-panel" id="identity">
                <div class="panel-heading">
                  <div class="step-number">01</div>
                  <div><p class="eyebrow">THE ADVENTURER</p><h2>Identitas karakter</h2><p class="panel-subtitle">Mulai dengan nama dan level petualangmu.</p></div>
                </div>
                <div class="identity-fields">
                  <label class="field field-name"><span>Nama karakter</span><input id="character-name" type="text" maxlength="60" value="Astra" placeholder="Masukkan nama karakter" autocomplete="off" /></label>
                  <label class="field field-level"><span>Level</span><input id="character-level" type="number" min="1" max="20" value="1" inputmode="numeric" /></label>
                </div>
              </section>

              <section class="panel options-panel" id="choices">
                <div class="panel-heading">
                  <div class="step-number">02</div>
                  <div><p class="eyebrow">CHARACTER ORIGIN</p><h2>Pilih asal-usul dan kelas</h2><p class="panel-subtitle">Pilihan di bawah diambil langsung dari file JSON ruleset aktif.</p></div>
                </div>

                <div class="choice-card">
                  <div class="choice-icon race-icon">✧</div>
                  <div class="choice-content">
                    <label class="field"><span>Species / Race</span><select id="race-select" aria-label="Pilih species atau race"></select></label>
                    <p class="choice-description" id="race-description"></p>
                    <div class="choice-meta" id="race-meta"></div>
                    <div class="trait-preview" id="race-traits"></div>
                  </div>
                </div>
                <div class="choice-divider"></div>

                <div class="choice-card">
                  <div class="choice-icon class-icon">⚔</div>
                  <div class="choice-content">
                    <label class="field"><span>Class</span><select id="class-select" aria-label="Pilih class"></select></label>
                    <p class="choice-description" id="class-description"></p>
                    <div class="choice-meta" id="class-meta"></div>
                    <div class="trait-preview" id="class-traits"></div>
                  </div>
                </div>
                <div class="choice-divider"></div>

                <div class="choice-card">
                  <div class="choice-icon background-icon">⌂</div>
                  <div class="choice-content">
                    <label class="field"><span>Background</span><select id="background-select" aria-label="Pilih background"></select></label>
                    <p class="choice-description" id="background-description"></p>
                    <div class="choice-meta" id="background-meta"></div>
                    <div class="trait-preview" id="background-traits"></div>
                  </div>
                </div>
              </section>

              <div class="content-note"><span class="note-icon">i</span><p>Deskripsi dan pilihan berasal dari <code>/data/</code> atau <code>/data/2024/</code>. Pemilihan ini belum menjalankan seluruh kalkulasi rules engine.</p></div>
            </div>

            <aside class="preview-column" id="preview">
              <section class="preview-card">
                <div class="preview-topline"><span class="eyebrow">LIVE PREVIEW</span><span class="preview-mark">5e</span></div>
                <div class="portrait-placeholder"><span class="portrait-glyph">✧</span><small>CHARACTER PORTRAIT</small></div>
                <div class="preview-identity">
                  <p class="eyebrow" id="preview-ruleset">2014 RULESET</p>
                  <h2 id="preview-name">Astra</h2>
                  <p id="preview-subtitle">Fighter · Human</p>
                  <div class="preview-tags" id="preview-tags"></div>
                </div>
                <div class="preview-stats">
                  <div><span>LEVEL</span><strong id="preview-level">01</strong></div>
                  <div><span>PROF. BONUS</span><strong id="preview-prof">+2</strong></div>
                  <div><span>HIT DIE</span><strong id="preview-hitdie">d10</strong></div>
                  <div><span>SPEED</span><strong id="preview-speed">30 ft.</strong></div>
                </div>
                <div class="preview-summary">
                  <div class="summary-row"><span>Saving Throws</span><strong id="preview-saves">—</strong></div>
                  <div class="summary-row"><span>Subclass at</span><strong id="preview-subclass">—</strong></div>
                  <div class="summary-row"><span>Background feature</span><strong id="preview-feature">—</strong></div>
                </div>
                <div class="preview-footer"><span class="preview-footer-dot"></span><span>Based on selected content</span></div>
              </section>

              <section class="registry-card">
                <div class="registry-heading"><span class="registry-icon">⌘</span><span>CONTENT REGISTRY</span></div>
                <div class="registry-counts" id="registry-counts">Loading content…</div>
                <div class="registry-source" id="registry-source">/data/</div>
              </section>
            </aside>
          </div>
          <footer class="app-footer"><span>BROZANTIUM · 5E CHARACTER TOOLS</span><span>HTML + CSS + JavaScript · Production minification enabled</span></footer>
        </main>
      </div>
    </div>
  `
}

function setSelectOptions(): void {
  if (!content) return
  const raceSelect = document.querySelector<HTMLSelectElement>("#race-select")
  const classSelect = document.querySelector<HTMLSelectElement>("#class-select")
  const backgroundSelect = document.querySelector<HTMLSelectElement>("#background-select")
  if (!raceSelect || !classSelect || !backgroundSelect) return

  selectedRaceId = ensureSelection(content.races, selectedRaceId, "human")
  selectedClassId = ensureSelection(content.classes, selectedClassId, "fighter")
  selectedBackgroundId = ensureSelection(content.backgrounds, selectedBackgroundId, "acolyte")
  raceSelect.innerHTML = optionsFor(content.races, selectedRaceId)
  classSelect.innerHTML = optionsFor(content.classes, selectedClassId)
  backgroundSelect.innerHTML = optionsFor(content.backgrounds, selectedBackgroundId)
}

function renderDetails(): void {
  if (!content) return
  const { characterClass, race, background } = currentSelections()
  if (!characterClass || !race || !background) return

  const raceSelect = document.querySelector<HTMLSelectElement>("#race-select")
  const classSelect = document.querySelector<HTMLSelectElement>("#class-select")
  const backgroundSelect = document.querySelector<HTMLSelectElement>("#background-select")
  if (raceSelect) raceSelect.value = race.id
  if (classSelect) classSelect.value = characterClass.id
  if (backgroundSelect) backgroundSelect.value = background.id

  const setText = (selector: string, value: string) => {
    const element = document.querySelector<HTMLElement>(selector)
    if (element) element.textContent = value
  }
  setText("#race-description", shortText(race.description))
  setText("#class-description", shortText(characterClass.description))
  setText("#background-description", shortText(background.description))

  const setMeta = (selector: string, values: string[]) => {
    const element = document.querySelector<HTMLElement>(selector)
    if (element) element.innerHTML = values.map((value) => `<span>${escapeHtml(value)}</span>`).join("")
  }
  setMeta("#race-meta", [
    race.size ? `Size: ${race.size}` : "",
    typeof race.speed === "number" ? `Speed: ${race.speed} ft.` : "",
    race.source || "",
  ].filter(Boolean))
  setMeta("#class-meta", [
    characterClass.hitDie ? `Hit Die: d${characterClass.hitDie}` : "",
    characterClass.spellcasting?.ability ? `Spellcasting: ${abilityLabel(characterClass.spellcasting.ability)}` : "",
    characterClass.source || "",
  ].filter(Boolean))
  setMeta("#background-meta", [
    ...(background.skillProficiencies ?? []).slice(0, 3),
    background.source || "",
  ].filter(Boolean))

  const raceTraits = document.querySelector<HTMLElement>("#race-traits")
  if (raceTraits) {
    raceTraits.innerHTML = (race.traits ?? []).slice(0, 2).map((trait) =>
      `<div class="mini-trait"><strong>${escapeHtml(trait.name)}</strong><span>${escapeHtml(shortText(trait.text, 135))}</span></div>`,
    ).join("")
  }

  const classTraits = document.querySelector<HTMLElement>("#class-traits")
  if (classTraits) {
    const saves = characterClass.proficiencies?.savingThrows ?? []
    const skills = characterClass.proficiencies?.skills
    const lines = [
      saves.length ? `Saving throw proficiency: ${saves.map((save) => save.toUpperCase()).join(" · ")}` : "",
      skills?.from?.length ? `Skill choices: choose ${skills.choose ?? 1} from ${skills.from.join(", ")}` : "",
      characterClass.subclassLabel ? `${characterClass.subclassLabel} at level ${characterClass.subclassLevel ?? "—"}` : "",
    ].filter(Boolean)
    classTraits.innerHTML = lines.map((line) => `<div class="mini-trait compact-trait"><span>${escapeHtml(line)}</span></div>`).join("")
  }

  const backgroundTraits = document.querySelector<HTMLElement>("#background-traits")
  if (backgroundTraits) {
    const lines = [
      (background.skillProficiencies ?? []).length ? `Skills: ${background.skillProficiencies?.join(", ")}` : "",
      (background.toolProficiencies ?? []).length ? `Tools: ${background.toolProficiencies?.join(", ")}` : "",
      background.feature?.name ? `Feature: ${background.feature.name}` : "",
    ].filter(Boolean)
    backgroundTraits.innerHTML = lines.map((line) => `<div class="mini-trait compact-trait"><span>${escapeHtml(line)}</span></div>`).join("")
  }

  const { name, subtitle, tags } = {
    name: document.querySelector<HTMLElement>("#preview-name"),
    subtitle: document.querySelector<HTMLElement>("#preview-subtitle"),
    tags: document.querySelector<HTMLElement>("#preview-tags"),
  }
  if (name) name.textContent = characterName.trim() || "Unnamed Adventurer"
  if (subtitle) subtitle.textContent = `${characterClass.name} · ${race.name}`
  if (tags) {
    tags.innerHTML = [characterClass.name, race.name, background.name]
      .map((value) => `<span>${escapeHtml(value)}</span>`).join("")
  }

  setText("#preview-ruleset", `${activeRuleset} RULESET`)
  setText("#preview-saves", (characterClass.proficiencies?.savingThrows ?? []).map((save) => save.toUpperCase()).join(" · ") || "—")
  setText("#preview-subclass", characterClass.subclassLevel ? `Level ${characterClass.subclassLevel}` : "—")
  setText("#preview-feature", background.feature?.name || "—")
  setText("#preview-hitdie", characterClass.hitDie ? `d${characterClass.hitDie}` : "—")
  setText("#preview-speed", typeof race.speed === "number" ? `${race.speed} ft.` : "—")
  setText("#preview-level", String(characterLevel).padStart(2, "0"))
  setText("#preview-prof", `+${getProficiencyBonus(characterLevel)}`)
  setText("#registry-counts", `${content.classes.length} classes · ${content.races.length} species · ${content.backgrounds.length} backgrounds`)
  setText("#registry-source", activeRuleset === "2024" ? "/data/2024/" : "/data/")
}

function updateCharacterPreview(): void {
  const name = document.querySelector<HTMLElement>("#preview-name")
  const level = document.querySelector<HTMLElement>("#preview-level")
  const proficiency = document.querySelector<HTMLElement>("#preview-prof")
  if (name) name.textContent = characterName.trim() || "Unnamed Adventurer"
  if (level) level.textContent = String(characterLevel).padStart(2, "0")
  if (proficiency) proficiency.textContent = `+${getProficiencyBonus(characterLevel)}`
}

function setLoading(isLoading: boolean): void {
  document.querySelectorAll<HTMLButtonElement>(".ruleset-button").forEach((button) => {
    button.disabled = isLoading
  })
  const dot = document.querySelector<HTMLElement>(".draft-dot")
  const label = document.querySelector<HTMLElement>(".draft-state span:last-child")
  if (dot) dot.classList.toggle("loading", isLoading)
  if (label) label.textContent = isLoading ? "Loading ruleset content…" : "Draft · Session only"
}

async function switchRuleset(nextRuleset: Ruleset): Promise<void> {
  if (nextRuleset === activeRuleset || !content) return
  const previousRuleset = activeRuleset
  activeRuleset = nextRuleset
  setLoading(true)
  try {
    content = await loadRulesetContent(nextRuleset)
    document.querySelectorAll<HTMLButtonElement>(".ruleset-button").forEach((button) => {
      const active = button.dataset.ruleset === nextRuleset
      button.classList.toggle("active", active)
      button.setAttribute("aria-pressed", String(active))
    })
    setSelectOptions()
    renderDetails()
  } catch (error) {
    activeRuleset = previousRuleset
    console.error(error)
    const label = document.querySelector<HTMLElement>(".draft-state span:last-child")
    if (label) label.textContent = "Gagal memuat data ruleset"
  } finally {
    setLoading(false)
  }
}

function bindInteractions(): void {
  document.querySelectorAll<HTMLButtonElement>(".ruleset-button").forEach((button) => {
    button.addEventListener("click", () => {
      const value = button.dataset.ruleset
      if (value === "2014" || value === "2024") void switchRuleset(value)
    })
  })

  const nameInput = document.querySelector<HTMLInputElement>("#character-name")
  const levelInput = document.querySelector<HTMLInputElement>("#character-level")
  const raceSelect = document.querySelector<HTMLSelectElement>("#race-select")
  const classSelect = document.querySelector<HTMLSelectElement>("#class-select")
  const backgroundSelect = document.querySelector<HTMLSelectElement>("#background-select")

  nameInput?.addEventListener("input", () => {
    characterName = nameInput.value
    updateCharacterPreview()
  })
  levelInput?.addEventListener("input", () => {
    characterLevel = getSafeLevel(Number(levelInput.value))
    updateCharacterPreview()
  })
  levelInput?.addEventListener("change", () => {
    levelInput.value = String(characterLevel)
  })
  raceSelect?.addEventListener("change", () => { selectedRaceId = raceSelect.value; renderDetails() })
  classSelect?.addEventListener("change", () => { selectedClassId = classSelect.value; renderDetails() })
  backgroundSelect?.addEventListener("change", () => { selectedBackgroundId = backgroundSelect.value; renderDetails() })
}

async function init(): Promise<void> {
  renderShell()
  try {
    content = await loadRulesetContent(activeRuleset)
    setSelectOptions()
    bindInteractions()
    renderDetails()
  } catch (error) {
    console.error(error)
    const main = document.querySelector<HTMLElement>(".main-content")
    if (main) {
      main.innerHTML = `
        <section class="error-panel">
          <p class="eyebrow">CONTENT LOAD ERROR</p>
          <h1>Data belum dapat dimuat.</h1>
          <p>Pastikan folder <code>/data/</code> ikut tersalin ke hasil build GitHub Pages, lalu muat ulang halaman.</p>
          <p class="error-detail">${escapeHtml(error instanceof Error ? error.message : "Unknown error")}</p>
        </section>
      `
    }
  }
}

void init()
