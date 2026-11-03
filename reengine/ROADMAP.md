# Reengineering Roadmap

## Phase 0 — Archaeology and boundaries
- Inventory legacy bundles and map their responsibilities.
- Record verified behavior and gaps in REVERSE_ENGINEERING/findings.
- Keep all legacy code/data out of the new runtime.

## Phase 1 — Domain contracts
- Finalize content, option-set, feature-mechanic, progression, item, and character-state schemas.
- Define structured prerequisite predicates.
- Define stable IDs and source metadata.

## Phase 2 — Core engines
- Content Registry and validation.
- Progression resolver.
- Prerequisite evaluator.
- Generic selection engine.
- Resource pool engine.
- Assignment engine.
- Effect, action, trigger, and spell-modifier engines.

## Phase 3 — Builder
- Ruleset selection before content loading.
- Class/subclass/background/race/feat selection.
- Feature-choice queue derived from progression.
- Dedicated panels rendered from mechanic types rather than class-name special cases.
- Replacement flows when a level is gained.

## Phase 4 — Character Sheet
- Display known options and assignments.
- Expose actions and triggers.
- Show resources and recovery behavior.
- Calculate statistics from content plus character state.

## Phase 5 — Pilot content and acceptance tests
- Warlock 2014 and 2024.
- Rune Knight 2014.
- Artificer Infuse Item 2014 and Replicate Magic Item 2024.
- Sorcerer Metamagic 2014 and 2024.
- Baleful Talon as an item/action/trigger acceptance fixture.

## Phase 6 — Migration and integration
- Add explicit migrations for characters created by the current monolithic app.
- Wire the new builder/runtime only after domain and engine tests pass.
- Retire legacy dependencies deliberately, not by silently changing old character data.
