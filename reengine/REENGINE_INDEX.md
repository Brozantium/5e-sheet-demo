# Reengine Repository Index

> **Purpose:** a navigation map for targeted repository reading. This file is not a substitute for source code, tests, the roadmap, or live GitHub state.
>
> **Last inspected:** 2026-11-05 (Asia/Jakarta)  
> **Repository:** [Brozantium/5e-sheet-demo](https://github.com/Brozantium/5e-sheet-demo)  
> **Inspection branch:** `docs/re-006-final-status`  
> **Source snapshot inspected:** `9346769d995f225cfeeb798448e7e00fb26fc70b` (main after PR #26 merged; RE-006 completion checkpoint is recorded).

## How to resume efficiently

Use this order at the beginning of a new chat:

1. Read [SESSION_HANDOFF.md](./SESSION_HANDOFF.md) for the durable decisions and current checkpoint.
2. Read this index to locate only the files relevant to the task.
3. Read [ROADMAP.md](./ROADMAP.md) to confirm the implementation order and completion gates.
4. Read [ARCHITECTURE.md](./ARCHITECTURE.md) only when changing data flow, boundaries, ownership, or runtime integration.
5. Verify the live branch, PR stack, reviews, and CI. A saved checkpoint is not proof of current GitHub state.
6. Compare the last verified commit with the current branch/PR head. Read changed files first, then follow only the imports, callers, contracts, and tests affected by those changes.
7. Update the handoff and this index only when the map, a durable decision, or the checkpoint changes.

## Incremental reading protocol

### Default rule

**Do not reread the whole repository by default.** Start from the task's owning module and its closest tests. Expand the read set only when evidence requires it.

- If a file's blob SHA is unchanged from the previously verified snapshot, do not fetch its full contents again unless the task depends on hidden behavior in it.
- Prefer commit comparison and PR changed-file lists over a fresh full-tree inspection.
- Use repository code search to locate symbols and call sites; then fetch the exact files on the target branch/ref. Search excerpts are discovery aids, not a replacement for reading critical code.
- Follow imports and callers outward only far enough to understand the contract being changed. Include downstream consumers when return shapes or semantics change.
- Read the paired unit tests before changing an engine. Add or update tests beside the owning engine.
- Read schema and fixture files when changing canonical records, IDs, ruleset metadata, validation, or serialization.
- Inspect UI, persistence, Owlbear adapters, and legacy files only when the task reaches those boundaries or an audited call path explicitly requires them.
- Do not read all legacy `/assets`, `/data`, or `/data/2024` as a routine step. They remain archaeology references, not new-runtime dependencies.
- Recheck CI for the exact PR head SHA. A green run on an earlier commit does not verify a later commit.

### Suggested read sets

| Task area | Start with | Expand to |
|---|---|---|
| Character calculations | `src/domain/character.ts`, `src/engines/character-calculation-engine.ts` | character calculation tests; caller supplying normalized proficiencies |
| Items / weapons | `src/domain/item.ts`, relevant weapon engine | corresponding weapon unit tests; registry/schema only if item contracts change |
| Armor / shields | `src/domain/equipment.ts`, armor class/training engines | armor unit tests; item profiles and grant inputs |
| HP / rests / death | matching domain file and HP, Long Rest, or Death Save engine | matching unit tests; resource engine and caller-owned event snapshots |
| Conditions / Exhaustion | `conditions.ts`, `condition-lifecycle.ts`, `exhaustion.ts` | condition, lifecycle, exhaustion, and Long Rest tests as relevant |
| Movement / derived defenses | `REVERSE_ENGINEERING/findings/movement-defenses-audit.md`, `domain/movement.ts`, `domain/defenses.ts` | `movement-engine.ts`, `defense-engine.ts`, and their unit tests; E1/E2 outputs are inputs, not reimplemented |
| Content validation | `domain/types.ts`, identity, `registry/content-registry.ts` | affected JSON Schema, fixtures, registry tests |
| Builder / feature grants | `builder/builder-manifest.ts`, `engines/builder-flow-engine.ts`, mechanic contracts | builder-flow and progression/choice/prerequisite/assignment/resource tests |
| Spellcasting | spell-related schemas/content and spell modifier engine | RE-007 contracts/tests; do not infer complete casting support from the modifier engine |
| Actions / triggers / effects | mechanic contracts and relevant mastery/weapon inputs | RE-008 design and tests; execution is not owned by RE-006 |
| UI / Owlbear / migration | architecture and adapter docs | `src/ui`, adapters, persistence, legacy call path; only in the approved RE-009/RE-010 scope |

## Workspace map

### Project guidance and status

| Path | Responsibility |
|---|---|
| [README.md](./README.md) | Workspace boundary rules, tooling, navigation |
| [REENGINE_INDEX.md](./REENGINE_INDEX.md) | Targeted repository map and incremental-reading protocol |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Target runtime, data flow, and separation of concerns |
| [ROADMAP.md](./ROADMAP.md) | RE-001 through RE-010 sequence, slice scope, status, completion gates |
| [SESSION_HANDOFF.md](./SESSION_HANDOFF.md) | Cross-chat checkpoint, decisions, PRs, tests, next action |
| [REVERSE_ENGINEERING/legacy/](./REVERSE_ENGINEERING/legacy/) | Archived previous app and supporting files; reference only, never imported at runtime |
| [REVERSE_ENGINEERING/findings/](./REVERSE_ENGINEERING/findings/) | Evidence-based legacy observations and bounded audits |
| `REVERSE_ENGINEERING/findings/play5e-character-builder-audit.md` | Play5e Builder step order, conditional visibility, completion gates, edition behavior, score methods, and finished-character edit draft behavior |
| `REVERSE_ENGINEERING/findings/play5e-entrypoint-asset-data-graph.md` | ZIP entry HTML → Vite asset graph → shared state/data loader → edition JSON map; initial record counts and focused audit slices |
| `REVERSE_ENGINEERING/findings/play5e-homebrew-data-compatibility-audit.md` | Complete 2014/2024 JSON dataset inventory, Homebrew Editor accepted categories/normalizers, per-category migration map, loss-aware conversion gates |
| `REVERSE_ENGINEERING/findings/homebrew-editor-compatibility-pilot.md` | DATA-001D read-only pilot using representative records; edition ID collisions, 1,000/category import cap, source→editor field maps and current canonical schema gaps |

### Canonical content and schemas

| Path | Responsibility |
|---|---|
| `content/2014/` | Edition-scoped 2014 content: backgrounds, classes, feats, items, magic items, races, spells, subclasses |
| `content/2024/` | Edition-scoped 2024 content: backgrounds, classes, feats, items, magic items, species, spells, subclasses, weapon masteries |
| `content/shared/` | Shared actions, effects, option sets, and rules |
| `content/homebrew/` | Homebrew content grouped under 2014, 2024, and shared |
| `SCHEMAS/common.schema.json` | Shared schema definitions |
| `SCHEMAS/content/` | Class, feature, item, and option-set schemas |
| `SCHEMAS/character/` | Character-state schema |

Keep canonical content definitions separate from character-selected/applied state. Preserve ruleset and source metadata. Descriptions are display text, not the sole source of mechanics.

### Source code

| Path | Responsibility / current map |
|---|---|
| `src/index.ts` | Public barrel exports for the current reengine domain and selected engines |
| `src/domain/types.ts` | Shared domain types and mechanic contracts |
| `src/domain/identity.ts` | Stable ID and ruleset/source identity helpers |
| `src/domain/character.ts` | Skills, proficiency state, and normalized character calculation inputs/outputs |
| `src/domain/item.ts` | Canonical item, weapon, armor profile and property definitions |
| `src/domain/equipment.ts` | Equipment and armor-training domain contracts |
| `src/domain/combat.ts` | Combat/weapon-related domain contracts |
| `src/domain/hit-points.ts` | HP and Hit Dice state contracts |
| `src/domain/death-saves.ts` | Death Save and stabilization contracts |
| `src/domain/long-rest.ts` | Long Rest input, event, and recovery contracts |
| `src/domain/conditions.ts` | Per-instance condition records and derived condition results |
| `src/domain/condition-lifecycle.ts` | Structured condition expiry/removal events and results |
| `src/domain/exhaustion.ts` | Numeric Exhaustion state and ruleset-aware derived effects |
| `src/domain/movement.ts` | Five canonical movement modes, normalized base profiles, provenance, ordered Speed modifiers, and resolver contracts |
| `src/domain/defenses.ts` | Source-aware defense grants/results; AC contributions stay separate |
| `src/domain/index.ts` | Domain barrel; currently re-exports conditions, lifecycle, and Exhaustion |
| `src/registry/content-registry.ts` | In-memory validation and registration of canonical content records |
| `src/builder/builder-manifest.ts` | Ruleset-neutral Builder step order and feature mechanic panel identifiers |
| `src/application/AppRoot.tsx` | Small active application composition root; mounted from `src/main.tsx` |
| `src/application/builder/CharacterBuilderPage.tsx` | Initial interactive ruleset-selection page; remaining Builder steps are pending |
| `src/engines/builder-flow-engine.ts` | Conditional step visibility, completion-aware navigation locks, visited/completed step state, and finish gate |
| `src/engines/` | Pure rule/domain engines; see the engine map below |
| `src/adapters/README.md` | Adapter boundary guidance; controlled migration/integration belongs later |
| `src/serialization/` | Serialization area; currently a placeholder |
| `src/ui/builder/`, `src/ui/components/`, `src/ui/sheet/` | UI areas; currently placeholders, not completed sheet integration |

### Engine module map

The following mapping is based on the engine directory and `src/engines/README.md` inspected on the source snapshot above.

| Engine file | Responsibility |
|---|---|
| `progression-engine.ts` | Resolve fixed progression values and class-table columns |
| `prerequisite-engine.ts` | Evaluate structured prerequisites |
| `choice-engine.ts` | Validate selections, counts, option sets, repeatability, prerequisites |
| `resource-engine.ts` | Spend, recover, and resize resource pools |
| `assignment-engine.ts` | Validate assignment of known options to eligible targets |
| `spell-modifier-engine.ts` | Validate spell modifiers and resource costs; not the full spellcasting engine |
| `item-engine.ts` | Weapon-property normalization/editor parity |
| `character-calculation-engine.ts` | Ability modifiers, level, proficiency, saves, skills, initiative, passive Perception |
| `armor-class-engine.ts` | Unarmored, armor, and shield AC |
| `armor-training-grant-engine.ts` | Resolve armor/shield training grants with provenance and ruleset filtering |
| `armor-training-consequence-engine.ts` | Resolve consequences of wearing untrained armor/shields |
| `weapon-attack-engine.ts` | Attack ability, proficiency, bonus/damage, range, reach, Heavy, Finesse, Lance rules |
| `weapon-hand-occupancy-engine.ts` | Hand occupancy, Two-Handed, mounted Lance exception, shield and Light-pair eligibility |
| `weapon-attack-cycle-engine.ts` | Ammunition and Loading preflight/consumption requirements |
| `light-weapon-extra-attack-engine.ts` | 2014 Light pair and 2024 Light/Nick extra-attack placement validation |
| `weapon-mastery-engine.ts` | 2024 mastery definitions, selection eligibility, availability |
| `hit-point-engine.ts` | Maximum HP, Hit Dice pools, Short Rest spend, damage/healing/Temporary HP |
| `death-save-engine.ts` | Damage at 0 HP, Death Saves, natural 1/20, stabilization, Stable recovery |
| `long-rest-engine.ts` | Ruleset-aware Long Rest eligibility, interruptions, and recovery |
| `condition-engine.ts` | Condition-derived roll, save/check, action, movement, and defense results |
| `exhaustion-engine.ts` | 2014 and 2024 Exhaustion penalties and level-6 death result |
| `condition-lifecycle-engine.ts` | Pure, caller-driven condition expiry/removal; no clocks or scheduler |
| `movement-engine.ts` | Resolves per-mode Speed from normalized profiles, ordered modifiers, E2 Exhaustion, and E1 constraints |
| `defense-engine.ts` | Coalesces defense facts while retaining sources and leaving damage/AC arithmetic downstream |

Engine functions are intended to remain pure. They consume normalized inputs and return decisions/results; they do not own React UI, Owlbear APIs, persistence, legacy runtime, timers, or turn scheduling.

### Tests and verification

| Path | Responsibility |
|---|---|
| `tests/unit/builder-flow-engine.test.cjs` | Builder step ordering, optional-step visibility, navigation gating, revisit behavior, and finish validation |
| `tests/unit/` | Node test-runner regression suite; files generally pair with an engine or validator |
| `tests/contracts/` | TypeScript contract fixtures included in the isolated typecheck |
| `tests/fixtures/2014/`, `2024/`, `homebrew/` | Edition/Homebrew test fixtures |
| `tests/fixtures/schema/` | Schema validation fixtures |
| `tests/integration/` | Integration-test area; currently a placeholder |
| `tsconfig.json`, `tsconfig.test.json` | Isolated source and test TypeScript configurations |

Root `package.json` exposes:

```sh
pnpm typecheck:reengine
pnpm test:reengine
```

The test command compiles test TypeScript and runs `node --test reengine/tests/unit/*.test.cjs`. CI should be checked for the exact commit under review.

## Known navigation caveats

1. **Public barrel exports need deliberate review:** `src/domain/index.ts` re-exports the Conditions, Condition Lifecycle, and Exhaustion domain contracts. At the clean feature-branch snapshot `a6314603`, `src/index.ts` re-exports the condition, condition-lifecycle, Exhaustion, movement, and defense engines. The condition, lifecycle, Exhaustion, movement, and defense exports are all merged on `main` via PRs #20–#22 and #25. Verify root-barrel exports again after merge.
2. **UI and persistence are not integrated:** the inspected UI subfolders and serialization area contain placeholders. The existence of domain engines does not mean the Owlbear sheet uses them.
3. **Movement F1–F3 are implemented and CI verified:** clean PR #25 exact-head workflow 41969537457 passed typecheck and 338 tests with 0 failures. This does not imply Owlbear/UI integration.
4. **Legacy sources remain separate:** `REVERSE_ENGINEERING/legacy/`, root `assets/`, and root `data/` are reference areas. Do not make them runtime dependencies of the active application or `reengine/`.

## Maintenance rule

Update this index when a module is added, renamed, removed, changes ownership, or gains a meaningful new dependency. Do not update it for every implementation edit. For routine changes, the commit comparison and the task-specific read set are the source of navigation.

Record the inspected branch and commit snapshot when making structural updates. Keep current implementation status and next actions in `SESSION_HANDOFF.md` and `ROADMAP.md`, not duplicated here.
