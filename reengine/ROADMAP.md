# Reengineering Roadmap

## Completed

- RE-001 — read-only audit of the current app and reengine workspace.
- RE-002 — isolated TypeScript checking and Node test harness established.
- RE-003 (weapon-property parity slice) — legacy weapon property lock/clean behavior ported with exhaustive regression tests.
- RE-004 (core engine correction slice) — sparse/subclass progression, draft and batch-aware selection validation, assignment limits, recovery hierarchy, spell-modifier resource checks, registry duplicate/reference checks, and schema/type alignment.
- RE-005 (content registry integrity slice) — unique mechanic IDs, atomic class registration, selection/assignment and prerequisite option references, ruleset compatibility, and progression table/column validation.

## Phase 0 — Archaeology and boundaries
- Inventory legacy bundles and map their responsibilities.
- Record verified behavior and gaps in REVERSE_ENGINEERING/findings.
- Keep all legacy code/data out of the new runtime.

## Phase 1 — Domain contracts and tooling
- Finalize content, option-set, feature-mechanic, progression, item, and character-state schemas.
- Define structured prerequisite predicates.
- Define stable IDs and source metadata.
- Keep reengine TypeScript checking and Node tests in CI.

## Phase 2 — Core engine corrections
- Fix progression carry-forward and subclass progression resolution.
- Add draft/complete selection validation and batch-aware prerequisite evaluation.
- Enforce assignment capacity per option and target.
- Implement rest recovery hierarchy and per-resource recovery policies.
- Validate spell-modifier resource availability.
- Make ContentRegistry reject duplicate IDs and invalid references.
- Synchronize JSON schemas and TypeScript contracts.

## Phase 3 — Preserve current app behavior
- Complete weapon, armor, shield, inventory, equipment, AC, and attack calculations.
- Port combat, conditions, exhaustion, death saves, HP, and rest rules with regression tests.
- Port spell slots, pact magic, spell preparation, and spell resource consumption.
- Preserve serialization and content-pack compatibility through explicit migrations.

## Phase 4 — New feature mechanics
- Warlock Invocations and Pact Boon.
- Rune Knight.
- Artificer Infusions (2014) and Replicate Magic Item (2024).
- Sorcerer Metamagic (2014/2024).
- Actions, triggers, passive effects, and magic item attunement.
- Maneuvers, Elemental Disciplines, and Weapon Masteries after further archaeology.

## Phase 5 — Content and application
- Populate canonical 2014, 2024, shared, and Homebrew content.
- Build Builder orchestration and UI on top of the tested engines.
- Build Character Sheet, Actions, and inventory presentation.
- Add explicit character migrations and Owlbear adapters.

## Phase 6 — Integration and retirement
- Integrate the new runtime behind a controlled feature flag.
- Verify old character data and Owlbear interactions.
- Retire legacy dependencies deliberately, not by silently changing saved characters.
