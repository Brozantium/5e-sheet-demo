# Revised Reengineering Roadmap

This roadmap is the implementation order for the clean-room `reengine/` workspace. Keep the existing application stable while the new contracts and engines are developed independently.

## RE-001 — Read-only Audit Baseline

- Inventory the current app, legacy bundles, data sources, and reengine boundary.
- Record verified behavior and confidence levels.
- Keep legacy `/assets`, `/data`, and `/data/2024` as archaeology references only.

Status: complete.

## RE-002 — Testing Foundation

Priority: establish reliable verification before implementing more behavior.

- Add an isolated TypeScript configuration for `/reengine/`.
- Add a test runner and CI workflow.
- Add regression fixtures and tests for reengine behavior.

Status: complete. The isolated TypeScript check, Node test harness, and CI workflow are present.

## RE-003 — Weapon & Equipment Engine

- Port weapon-property locking and normalization.
- Preserve parity across the 2,048 kind/property combinations.
- Continue with armor, shields, AC, equip/unequip, and inventory behavior.

Status: weapon-property parity slice complete. Armor, shields, AC, equipment, and inventory remain in the later calculation/equipment scope.

## RE-004 — Core Engine Corrections

- Fix F1–F8 findings with regression tests.
- Cover progression, selection, assignment, resources, and spell-modifier validation.
- Keep the TypeScript contracts and JSON Schema synchronized as part of the correction work.

Status: the documented F1–F8 correction slice is complete, with tests. Further contract/schema alignment belongs to RE-005.

## RE-005 — Schema & Content Validation

Scope:

- Align TypeScript domain contracts and JSON Schema definitions.
- Define and validate stable content IDs.
- Standardize ruleset metadata for `2014`, `2024`, and `shared` content.
- Validate references between content records, mechanics, options, progression tables, and prerequisites.
- Add regression tests for invalid schemas, IDs, metadata, duplicate identifiers, and unresolved references.
- Keep the registry's in-memory validation consistent with the canonical JSON contracts.

Current status: in progress, not complete.

Already implemented in the initial RE-005 slice:

- Duplicate mechanic ID protection and atomic class registration.
- Assignment-to-selection reference checks.
- Option-set/ruleset compatibility checks.
- Structured prerequisite checks for class, feature, selection, and option references.
- Progression table and column reference checks.

Remaining before RE-005 can be marked complete:

- Add the missing Option Set JSON Schema.
- Define a canonical content ID policy and apply it consistently in TypeScript, schemas, registry validation, and fixtures.
- Reconcile the remaining TypeScript/schema shape differences, including progression numeric constraints and source/ruleset metadata.
- Introduce a canonical item domain contract; the current `domain/item.ts` only defines weapon editor property controls, not a full item definition.
- Tighten the item schema so it validates a real contract rather than accepting broadly permissive objects.
- Add schema-validation tests for actual canonical fixtures and negative cases.
- Verify the final schema/type/reference contract together before moving the phase to complete.

## RE-006 — Rules & Character Calculation

- Combat and attack calculations.
- Saving throws and skills.
- Conditions, HP, death saves, rest, and exhaustion.
- Armor class and other character-derived calculations.
- Equipment interactions needed by the character sheet.

## RE-007 — Spellcasting Engine

- Spell slots and pact magic.
- Spell preparation and known spells.
- Multiclass spell progression.
- Spell resource consumption and casting validation.
- Metamagic application and resource costs.

## RE-008 — Action, Trigger & Effect Engine

- Player-activated actions.
- Event-driven triggers and reactions.
- Magic item actions and effects.
- Passive and conditional effects.
- Explicit event payloads and effect application contracts.

## RE-009 and later — Migration, Content, UI, and Integration

- Character-state migration and compatibility.
- Canonical content pilot packs for 2014, 2024, shared, and Homebrew.
- Owlbear adapters and persistence integration.
- Builder orchestration and UI.
- Character Sheet and Actions presentation.
- Controlled integration behind a feature flag, regression against existing characters, and deliberate retirement of legacy dependencies.

## Non-negotiable boundaries

- The new runtime must not import legacy JavaScript from `/assets`.
- The new runtime must not read `/data` or `/data/2024` directly.
- Legacy sources are evidence for reverse engineering, not runtime dependencies.
- Preserve edition identity in metadata; never infer the ruleset from display text.
- Descriptions are display content, not the sole source of mechanical behavior.
- Do not mark a roadmap slice complete until its acceptance tests and CI checks support that status.
