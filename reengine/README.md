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
- ROADMAP.md — reverse-engineering and implementation order.
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

- RE-001: complete as a read-only audit baseline.
- RE-002: TypeScript check and Node test harness established.
- RE-003: weapon property lock rules ported with exhaustive parity tests (2,048 kind/property combinations).
- RE-004: core engine corrections and schema/type alignment completed for this slice, with regression tests added.
- RE-005: content registry integrity checks extended for unique mechanics, assignment/selection links, prerequisite option references, ruleset compatibility, and progression table references. The canonical content folders remain intentionally unpopulated; content ingestion is a later phase.
- The new engine is not yet wired into the current application. No runtime import from reengine is added to src/main.tsx or src/App.tsx.
