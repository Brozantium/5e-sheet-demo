import {
  buildCharacterSnapshot,
  type Ruleset,
} from "./shared-logic"

const app = document.querySelector<HTMLElement>("#app")

if (!app) {
  throw new Error("Missing #app mount element")
}

const page = document.body.dataset.page === "alternate" ? "B" : "A"

app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">BROZANTIUM · BUILD EXPERIMENT</p>
        <h1>Shared JS / Separate HTML</h1>
        <p class="subtitle">One TypeScript module, two HTML entry points, one production minifier.</p>
      </div>
      <span class="page-chip" id="page-chip">HTML ${page}</span>
    </header>

    <section class="status-panel">
      <div class="status-dot"></div>
      <div>
        <strong>External module loaded</strong>
        <p><code>src/shared-logic.ts</code> was imported by this HTML page.</p>
      </div>
    </section>

    <section class="card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">FUNCTION TEST</p>
          <h2>Build a test character snapshot</h2>
        </div>
        <span class="tag">Shared function</span>
      </div>

      <form id="probe-form">
        <label>
          Character name
          <input id="character-name" name="name" value="Astra" maxlength="60" />
        </label>

        <div class="form-row">
          <label>
            Level
            <input id="character-level" name="level" type="number" min="1" max="20" value="5" required />
          </label>

          <label>
            Ruleset
            <select id="ruleset" name="ruleset">
              <option value="2014">2014</option>
              <option value="2024">2024</option>
            </select>
          </label>
        </div>

        <button type="submit">Run shared function</button>
      </form>
    </section>

    <section class="card result-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">RESULT</p>
          <h2>Function output</h2>
        </div>
        <span class="tag success">Interactive</span>
      </div>
      <pre id="result" aria-live="polite"></pre>
    </section>

    <footer>
      <span>Build minification: <strong>enabled in this test config</strong></span>
      <span>Open <code>/</code> and <code>/alternate.html</code> to compare.</span>
    </footer>
  </main>
`

const form = document.querySelector<HTMLFormElement>("#probe-form")
const nameInput = document.querySelector<HTMLInputElement>("#character-name")
const levelInput = document.querySelector<HTMLInputElement>("#character-level")
const rulesetInput = document.querySelector<HTMLSelectElement>("#ruleset")
const result = document.querySelector<HTMLElement>("#result")

if (!form || !nameInput || !levelInput || !rulesetInput || !result) {
  throw new Error("The test page is missing one or more form elements")
}

function runProbe(): void {
  const ruleset = rulesetInput.value as Ruleset
  const snapshot = buildCharacterSnapshot({
    name: nameInput.value,
    level: Number(levelInput.value),
    ruleset,
  })

  result.textContent = JSON.stringify(snapshot, null, 2)
}

form.addEventListener("submit", (event) => {
  event.preventDefault()
  runProbe()
})

runProbe()
