# Play5e Reference Graph — Entry HTML, Assets, and Data

> Status: initial static dependency/data-flow audit.
> Source: user-provided `play5e.net.zip`, inspected 2026-11-08 (Asia/Jakarta).
> ZIP SHA-256: `b2fd929aec34a050acfa52857c9155442aafc1373dfa14cc16efc279bad356fe`.
> Scope: establish the relationships between the captured site entry point, application bundles, CSS/theme, and edition data files. This is evidence for clean-room reverse engineering, not authorization to copy minified runtime code.

## 1. Core finding

The captured `index.html`, `assets/`, and `data/` are not independent references. They form one connected application:

```text
play5e.net/index.html
  ├─ theme.js
  ├─ assets/index-LPPEBOoe.js          main application entry
  │    ├─ lazy/codeload chunk map
  │    │    ├─ Builder-DkUvAWva.js
  │    │    ├─ Sheet-DUhnSnJp.js
  │    │    ├─ Homebrew-ChRvWX4O.js
  │    │    ├─ HomebrewEditor-PHnJdPMp.js
  │    │    ├─ TableCorner-CW4fNvje.js
  │    │    ├─ SharedCharacter-BcwSm7PB.js
  │    │    ├─ ReadOnlySheet-7SRYvY-0.js
  │    │    ├─ JoinSession-BYOiNDi9.js
  │    │    └─ supporting feature/state/renderer modules
  │    ├─ assets/state-BrIavbbF.js     shared state, storage and data loading
  │    └─ assets/jsx-runtime-BeV9_fra.js
  ├─ assets/index-gCItqdUs.css         application styling
  └─ data/
       ├─ classes, races, backgrounds, feats, spells, items, magicitems
       └─ 2024/ equivalents + masteries.json
```

This graph is directly grounded in the HTML's script/modulepreload/stylesheet references, the Vite chunk dependency map inside the main bundle, and the data loader in the state bundle.

## 2. Entry HTML observations

`play5e.net/index.html`:

- Sets `data-theme="gilded-atlas"` on the root HTML element.
- Loads `theme.js`.
- Loads `assets/index-LPPEBOoe.js` as the main module.
- Preloads `assets/jsx-runtime-BeV9_fra.js` and `assets/state-BrIavbbF.js`.
- Loads `assets/index-gCItqdUs.css`.
- Contains the initial landing/prerender markup and buttons for builder, returning characters, and import flow.

The main application entry contains a Vite dependency map naming the split modules, including Builder, Sheet, Homebrew, Table Corner, read-only/shared character, print sheet, and supporting modules. Thus the file names/hashes in the ZIP describe one captured build and should be treated as a matched set.

## 3. Shared state bundle -> edition data

The captured `assets/state-BrIavbbF.js` contains a direct loader equivalent to:

```js
fetch(`/data/${edition === "2024" ? "2024/" : ""}${dataset}.json`)
```

The edition registry load requests these seven datasets together:

- `classes.json`
- `races.json`
- `backgrounds.json`
- `feats.json`
- `spells.json`
- `items.json`
- `magicitems.json`

For 2024 it additionally loads `masteries.json`. The state layer creates an edition-scoped bundle and attempts to apply stored Homebrew content to the official dataset; the observed fallback logs that it uses official content only if Homebrew application fails.

This is a key reverse-engineering path: inspect the Builder/Sheet consumers and trace each content field back to the loader and matching edition JSON. Do not assume the JSON files are self-explanatory without their consuming code.

## 4. Captured data inventory

All 15 JSON files parse successfully as arrays in this snapshot:

| Dataset | 2014 records | 2024 records |
|---|---:|---:|
| Backgrounds | 96 | 71 |
| Classes | 13 | 13 |
| Feats | 110 | 205 |
| Items | 227 | 242 |
| Magic items | 777 | 462 |
| Races / species dataset | 143 | 25 |
| Spells | 509 | 456 |
| Weapon masteries | — | 8 |

Counts are capture-specific and not a guarantee of current Play5e online contents or official completeness. The 2014 file is named `races.json`; the 2024 file is also named `races.json`, while the Builder/UI uses Species terminology for the 2024 ruleset. Preserve that edition distinction in the mapping rather than renaming based on assumptions.

## 5. Application bundle roles identified by filename and import edges

These are initial ownership hypotheses; each requires focused consumer inspection before final contract decisions.

| Module | Initial audit target |
|---|---|
| `Builder-DkUvAWva.js` | Builder step orchestration, conditional visibility, completion, class/race/species/background/ability/equipment/spell selection |
| `FeatureMechanics-DUzJ4cCz.js` | Structured feature mechanic choice panels |
| `featureUses-D8xludMG.js` | Feature-use/resource UI and state helpers |
| `SubclassStep-Du2mvEFJ.js` | Subclass selection and class progression integration |
| `Sheet-DUhnSnJp.js` | Editable character sheet and play interactions |
| `sheet-bqlS9uFu.js` | Sheet data/section helpers |
| `defenses-C_AKRFmH.js` | Defense summaries / derived state presentation |
| `state-BrIavbbF.js` | Shared state, character storage, edition data loading, mutation and event-related helpers |
| `Homebrew-ChRvWX4O.js` / `HomebrewEditor-PHnJdPMp.js` | Homebrew workflow and editor model |
| `ReadOnlySheet-7SRYvY-0.js` / `SharedCharacter-BcwSm7PB.js` / `JoinSession-BYOiNDi9.js` | Sharing, read-only character and session/join flow |
| `renderer-CYmDd6sg.js` / `TableCorner-CW4fNvje.js` | Renderer and DM table workflow |
| `ability-score-roller.js` / `point-buy-calculator.js` / `multiclass-spell-slot-calculator.js` | Standalone tools and cross-checks for related mechanics |

The main entry's Vite dependency map includes these split application chunks, and several chunks import shared state/runtime modules. This supports a dependency-first audit rather than inspecting one file in isolation.

## 6. Other captured site material

The ZIP also contains static reference pages for classes, subclasses, backgrounds, species, spells, equipment, weapons, armor, feats, conditions, monsters, magic items, and weapon masteries. Most of these HTML reference pages use `pages.css`; standalone calculators use their own JS modules. These pages are useful for terminology, content display and cross-checking, but they are not equivalent to the interactive Builder/Sheet implementation.

## 7. Reverse-engineering method going forward

For each feature:

1. Start at the user-visible entry/control in the relevant HTML or application bundle.
2. Follow the main entry's lazy chunk mapping to the owning module.
3. Trace imports into shared state, storage and helper modules.
4. Trace referenced content IDs/fields into the matching 2014/2024 `/data/*.json` file.
5. Record observed behavior, input shape, output/state changes, ruleset branches, prerequisites, and evidence limits.
6. Compare against existing `reengine/src/domain`, schemas, registry, engines and tests.
7. Classify the result as already implemented, contract gap, engine gap, content-mapping gap, or UI/integration gap.
8. Write a clean-room contract/test and implement it in the appropriate reengine phase.

Do not port bundled/minified code or make the captured website's runtime a dependency of Brozantium. Use the captured build as an interconnected behavioral and data-relationship reference.

## 8. Follow-up audit slices

Recommended order:

- ZIP-001A: complete entry/lazy-load route map from `index-LPPEBOoe.js`.
- ZIP-001B: Builder consumer-to-data mapping, starting with class and race/species.
- ZIP-001C: character state/storage model and draft/save lifecycle.
- ZIP-001D: Sheet consumer mapping, derived values, inventory, resources and play actions.
- ZIP-001E: Homebrew schema and merge/override pipeline.
- ZIP-001F: reconcile each finding against existing RE-001–RE-009 work and update roadmap only with evidence.

Keep these audits small and checkpointed. RE-001–RE-006 implementations remain authoritative where already verified; use the ZIP to identify integration contracts and gaps rather than replacing completed engines wholesale.


## 9. Explicit scope exclusions — do not carry over

The captured site is a reverse-engineering reference, not a source of UI pages or visual identity for Brozantium. The following are expressly out of scope for porting:

### 9.1 Standalone content/documentation pages

- Do not copy, migrate, recreate, or publish the captured standalone reference/documentation pages for classes, subclasses, backgrounds, species/races, spells, equipment, weapons, armor, feats, conditions, monsters, magic items, weapon masteries, or similar rules/content topics as Brozantium website pages.
- Do not reproduce their page layouts, navigation, prose presentation, screenshots, or static HTML.
- Their content may be consulted only as supporting evidence when resolving terminology, identifiers, cross-references, and discrepancies in the application data. Prefer the connected `/data/` JSON and the interactive application's consuming code for data-contract and behavior findings.
- Brozantium's deliverable is its own Character Builder, Character Sheet, content-management workflows that are explicitly in scope, and application utilities—not a copy of Play5e's rules encyclopedia/documentation site.

### 9.2 Play5e visual theme and branding

- Do not carry over Play5e's `gilded-atlas` theme, `theme.js`, theme tokens, CSS variables, colors, typography, fonts, background treatments, icons, logos, component styling, or other branded visual assets.
- Do not make the Play5e CSS or theme runtime a dependency of Brozantium.
- Use Play5e's interactive layouts and behavior only as functional/structural reference where useful; independently design and implement Brozantium's presentation.
- Brozantium's own theme system remains authoritative: Owlbear-inspired purple/lavender as the default, with the separately designed blue, red, yellow, and green alternatives. Do not import Play5e palettes or let Play5e theme metadata overwrite these choices.

### 9.3 Allowed reference use

Allowed:
- Trace interactive routes and controls from `index.html` into the application bundles.
- Inspect state transitions, storage/data loading, ruleset switching, selection validation, and module boundaries.
- Map the application's use of `/data/` and `/data/2024/` records into Brozantium's own canonical schemas and content registry.
- Consult standalone documentation content solely to clarify a data record or rules term when the application/data evidence is insufficient, recording the source and uncertainty.

Not allowed:
- Shipping Play5e HTML pages, CSS, theme scripts, logos, fonts, or branded assets in the Brozantium runtime.
- Treating the entire scraped site as a website template to reproduce.
