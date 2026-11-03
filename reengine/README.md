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
- src/engines/ — choices, prerequisites, progression, resources, assignment, and spell modification.
- src/builder/ — builder-facing orchestration contracts.
- src/adapters/ — controlled import/migration boundaries; never runtime dependencies on legacy folders.
- src/ui/ — future builder and sheet presentation.
- tests/ — behavior fixtures and regression tests.

## Current status

This is an additive foundation. It is not yet wired into src/App.tsx and does not change the running application. The examples under tests/fixtures are focused mechanics fixtures, not a complete reproduction of official sourcebooks.
