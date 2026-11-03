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

Status: the documented F1–F8 correction slice is complete, with tests.

## RE-005 — Schema & Content Validation

Scope:

- Align TypeScript domain contracts and JSON Schema definitions.
- Define and validate stable content IDs.
- Standardize ruleset metadata for `2014`, `2024`, and `shared` content.
- Validate references between content records, mechanics, options, progression tables, and prerequisites.
- Add regression tests for invalid schemas, IDs, metadata, duplicate identifiers, and unresolved references.
- Keep the registry's in-memory validation consistent with the canonical JSON contracts.

Implemented:

- Shared JSON Schema definitions for canonical IDs, rulesets, sources, and effect records.
- Dedicated class, feature, option-set, item, and character-state schemas using JSON Schema Draft 2020-12.
- Canonical content ID grammar: lowercase kebab-case segments separated by colons, e.g. `artificer-2014:infusions-known`.
- Shared `ContentRuleset` and `ContentSource` TypeScript contracts.
- A canonical discriminated `ItemDefinition` model for weapons, armor, shields, gear, tools, ammunition, consumables, and magic items.
- Registry validation for IDs, ruleset metadata, duplicate mechanics, progression tables/columns, option references, prerequisite references, item profiles, and base-item links.
- Ajv 2020 schema tests with valid and invalid fixtures, plus TypeScript contract fixtures compiled by `typecheck:reengine`.

<badge color="success">Complete</badge> Verified on commit `07d69381d1bfc4d8297a585f31d93872693dcb13`: frozen-lockfile install passed, the isolated TypeScript check passed, and all 47 unit tests passed.

Bounded references intentionally extended by later phases:

- Spell IDs are format-validated now; spell existence and spell-record references will be resolved by the Spell Registry in RE-007.
- Action and trigger IDs are format-validated now; their target existence and event contracts will be resolved in RE-008.
- Canonical production content packs remain unpopulated. Their curation is part of the later content pilot, not bulk-importing legacy data.
- Character instance IDs and inventory instance IDs are not content IDs and intentionally use separate identity rules.

## RE-006 — Rules & Character Calculation

Scope:

- Combat and attack calculations.
- Saving throws and skills.
- Conditions, HP, death saves, rest, and exhaustion.
- Armor class and other character-derived calculations.
- Equipment interactions needed by the character sheet.

Implemented:

- RE-006A: pure calculations for ability modifiers, total multiclass level, proficiency bonus, skills, saving throws, initiative, and passive Perception.
- RE-006B1: armor class from unarmored, light/medium/heavy armor, shield, Unarmored Defense, and explicit flat bonuses; includes ruleset-aware shield proficiency behavior.

Current acceptance checks:
- Capped armor applies the Dexterity ceiling to positive modifiers while preserving negative Dexterity modifiers.
- Armor and shield are independently equippable but limited to one each.
- 2014 untrained shields still contribute AC with a training issue; 2024 shield AC requires shield training.
- Strength requirements, Stealth disadvantage, ruleset compatibility, and invalid equipment combinations are surfaced.
- Canonical item schema and TypeScript contracts require a numeric Dexterity cap for capped armor.

Implemented:

- RE-006B2: weapon attack ability selection, weapon/category proficiency, attack bonuses, damage modifiers, Versatile damage dice, and held-item hand occupancy validation.

RE-006B2 acceptance coverage:

- Melee weapons use Strength; Finesse melee weapons use the higher Strength/Dexterity modifier; ranged weapons use Dexterity.
- Thrown melee weapons retain the melee ability rule.
- Category and exact/base-item weapon proficiency are supported; non-proficient attacks omit PB without being prohibited.
- Attack and damage adjustments are explicit; the ability modifier is applied once to the primary damage component.
- Versatile weapons use their alternate primary damage formula only when wielded in two hands.
- Heavy/Two-Handed weapons require both hands; shields can occupy one hand. Physical hand occupancy is validated separately from Light-property extra-attack eligibility: 2014 requires two Light melee weapons, while 2024 requires two different Light weapons (including ranged weapons).
- Ruleset mismatches and malformed equipment states are surfaced rather than silently normalized.

Status: in progress. Armor training consequences, HP/rest/death saves, and ruleset-aware condition/exhaustion behavior remain.

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
- Descriptions are for display. They are never the sole source for a mechanical behavior.
- Do not mark a roadmap slice complete until its acceptance tests and CI checks support that status.
