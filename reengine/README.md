# Reengine Workspace

This directory is the clean-room workspace for the new 5e content model, builder, mechanics engines, and character runtime.

## Boundary rules

- The new application must not import or read the legacy /assets directory.
- The new application must not import or read /data or /data/2024 at runtime.
- Legacy bundles and legacy JSON are archaeology references only. Findings are rewritten here as documentation, schemas, tests, and newly authored canonical content.
- Do not copy minified bundle code into this workspace. Reimplement behavior from the documented contracts.
- Do not couple canonical content to a UI component or a single edition.
- 2014, 2024, and Homebrew content must be normalized into the same domain model while retaining ruleset/source metadata.

## Workspace map

- ARCHITECTURE.md — target runtime and data flow.
- REENGINE_INDEX.md — repository map and incremental-reading protocol.
- ROADMAP.md — revised implementation order from audit through integration.
- SESSION_HANDOFF.md — required continuation checkpoint for new chats/sessions; read this first, then verify live GitHub status.
- REVERSE_ENGINEERING/ — verified observations from the legacy app.
  - `REVERSE_ENGINEERING/findings/conditions-exhaustion-audit.md` — RE-006E legacy condition/exhaustion call-path audit and acceptance criteria.
  - `REVERSE_ENGINEERING/findings/movement-defenses-audit.md` — RE-006F legacy movement/defense audit and engine contract boundaries.
- SCHEMAS/ — JSON contracts for canonical content and character state.
- content/ — the only canonical content location for the new builder.
- src/domain/ — domain types with no UI dependencies.
- src/registry/ — content lookup and indexing.
- src/engines/ — choices, prerequisites, progression, resources, assignment, item, and spell modification.
- src/builder/ — builder-facing orchestration contracts.
- src/adapters/ — controlled import/migration boundaries; never runtime dependencies on legacy folders.
- src/ui/ — future builder and sheet presentation.
- tests/ — behavior fixtures and regression tests.

## Tooling and tests

The reengine is type-checked independently from the existing application:

```sh
pnpm typecheck:reengine
pnpm test:reengine
```

The unit suite uses Node's built-in test runner. JSON Schema validation uses Ajv Draft 2020-12 as a development-only dependency; it adds no runtime dependency to the production application. TypeScript fixtures under tests/contracts are included in the isolated typecheck.

## Current status

- RE-001: read-only audit baseline complete.
- RE-002: isolated TypeScript check, Node test harness, and CI workflow established.
- RE-003: weapon property locking/normalization has exhaustive parity coverage for 2,048 kind/property combinations. Armor, shield, AC, equip, and inventory work remain.
- RE-004: documented F1–F8 core engine correction slice completed with regression tests.
- RE-005: schema/content validation complete for the current canonical model. Shared schemas, option-set/item contracts, ID/ruleset metadata enforcement, reference checks, Ajv fixtures, and TypeScript contract fixtures pass CI (47/47 tests).
- RE-006D4: Long Rest and recovery implementation is merged into `main`.
- RE-006E1–E3: condition, Exhaustion, and condition-lifecycle engines are merged into `main` via PRs #20–#22 (289 / 303 / 324 tests passed respectively).
- RE-006F0–F3: movement/defense audit and engines are merged into `main` via PR #25; exact-head workflow 41969905962 passed typecheck and 338 tests with 0 failures.
- All RE-006A–F3 implementation slices are merged into `main`. The final mainline verification is being recorded on checkpoint PR #26; do not begin RE-007 until its required CI passes.
- RE-007: spellcasting engine.
- RE-008: action, trigger, and effect engine.
- RE-009+: migration, canonical content pilot, Owlbear adapter, Builder, Sheet, and final integration.

Spell-record existence checks are planned with RE-007; action/trigger target existence checks are planned with RE-008. Their IDs are already format-validated. The new engine is not yet wired into the current application. No runtime import from reengine is added to src/main.tsx or src/App.tsx.
