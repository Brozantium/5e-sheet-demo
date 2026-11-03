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
- ROADMAP.md — revised implementation order from audit through integration.
- REVERSE_ENGINEERING/ — verified observations from the legacy app.
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

The test suite uses Node's built-in test runner and TypeScript compilation to a disposable CommonJS directory. It introduces no additional runtime dependency. Generated test output is ignored by git.

## Current status

- RE-001: read-only audit baseline complete.
- RE-002: isolated TypeScript check, Node test harness, and CI workflow established.
- RE-003: weapon property locking/normalization has exhaustive parity coverage for 2,048 kind/property combinations. Armor, shield, AC, equip, and inventory work remain.
- RE-004: documented F1–F8 core engine correction slice completed with regression tests.
- RE-005: in progress. Registry reference checks have been added, but schema/type alignment, stable ID policy, complete item contract, option-set schema, and schema validation tests remain.
- RE-006: rules and character calculation.
- RE-007: spellcasting engine.
- RE-008: action, trigger, and effect engine.
- RE-009+: migration, canonical content pilot, Owlbear adapter, Builder, Sheet, and final integration.

The new engine is not yet wired into the current application. No runtime import from reengine is added to src/main.tsx or src/App.tsx.
