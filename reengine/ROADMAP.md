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

## RE-003 — Weapon & Equipment Editor Parity

- Port weapon-property locking and normalization.
- Preserve parity across the 2,048 kind/property combinations.
- Preserve legacy editor behavior unless a separately reviewed rules correction is approved.

Status: weapon-property editor parity slice complete. Rules mechanics are handled by RE-006 and must not be inferred from editor locks.

## RE-004 — Core Engine Corrections

- Fix F1–F8 findings with regression tests.
- Cover progression, selection, assignment, resources, and spell-modifier validation.

Status: complete.

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

Status: complete. Verified on commit `07d69381d1bfc4d8297a585f31d93872693dcb13`: frozen-lockfile install passed, the isolated TypeScript check passed, and all 47 unit tests passed.

Bounded references intentionally extended by later phases:

- Spell IDs are format-validated now; spell existence and spell-record references will be resolved by the Spell Registry in RE-007.
- Action and trigger IDs are format-validated now; their target existence and event contracts will be resolved in RE-008.
- Canonical production content packs remain unpopulated. Their curation is part of the later content pilot, not bulk-importing legacy data.
- Character instance IDs and inventory instance IDs are not content IDs and intentionally use separate identity rules.

## RE-006 — Rules & Character Calculation

Goal: finish the pure, ruleset-aware character and combat calculations before wiring them into the legacy application.

### RE-006A — Core Character Calculations

Implemented:

- Ability modifiers, total multiclass level, proficiency bonus.
- Skills, saving throws, initiative, and passive Perception.

Status: complete.

### RE-006B1 — Armor Class

Implemented:

- AC from unarmored, light/medium/heavy armor, shield, Unarmored Defense, and explicit flat bonuses.
- Ruleset-aware shield proficiency behavior.
- Strength requirements, Stealth disadvantage, equipment compatibility, and invalid equipment combinations.

Status: complete. Armor-training consequences beyond AC remain in the later armor-training slice.

### RE-006B2 — Weapon Attack, Damage & Hand Occupancy

Implemented and merged via PR #1 (`443c3d700a8bdfd98c6eb9f70250bb64e984dd03`).

- Default melee STR and ranged DEX, explicit Finesse STR/DEX choice.
- Weapon/category proficiency, attack adjustments, damage adjustments, and Versatile damage formulas.
- 2014 and 2024 Heavy disadvantage rules.
- Hand occupancy and Light weapon-pair prerequisite validation.

Status: complete. PR #1 is merged to `main`. This slice does not complete Weapon Properties as a whole.

### RE-006B3 — Weapon Properties & Range (current priority)

Split this into small, independently testable slices:

- **B3A — Canonical property model and range contracts:** ruleset-aware 2014/2024 property definitions; normal and long range; distinct thrown range; ammunition type; Versatile damage metadata; structured Special rules; schema and registry validation.

  Status: complete. Merged via PR #2 (`a5e6b609d48009f7d73e0a96ec092475903fe9d6`); its CI passed frozen install, typecheck, and 113 unit tests.

- **B3B — Property calculations:** Reach and Opportunity Attack reach; Thrown attack mode and ability selection; range-band validation and long-range Disadvantage; Two-Handed constraints including the 2024 mounted Lance exception; 2014 Lance close-range rule and Net non-damaging attack profile.

  Status: complete. Merged via PR #3 (`74993e5c28e81aa77928dae20fa6dbf9c16a3f14`); its CI passed frozen install, typecheck, and 123 unit tests.
- **B3C1 — Ammunition & Loading:** ammunition availability and consumption per ranged attack; the free-hand requirement for loading one-handed weapons; Loading's one-shot limit per Action, Bonus Action, or Reaction; post-battle ammunition recovery; improvised-weapon handoff for ranged weapons used in melee.

  Status: complete. Merged via PR #4 (`317c3b1f24fed68d5190cc1b45628725a8444798`); its CI passed frozen install, typecheck, and 133 unit tests.

- **B3C2 — Light extra-attack trigger contract:** 2014 two-weapon requirements versus 2024 Light trigger; negative-only ability modifier damage; Nick's action placement when the extra weapon's mastery is already unlocked and selected.

  Status: complete. Merged via PR #5 (`03dba0f509e3c702a548b4397aceea8e63b09f05`); its CI passed frozen install, typecheck, and 149 unit tests. Stateful execution and action consumption remain with RE-008.

Weapon Property/range/attack-cycle implementation (B3A–B3C2) is merged through PRs #2–#5. Mastery effects and 2014/2024 Special effect execution remain in RE-008.

Weapon Property/range/attack-cycle implementation (B3A–B3C2) is merged through PRs #2–#5. Remaining weapon-specific RE-006 scope is B4 mastery eligibility/selection; mastery effects and 2014/2024 Special effect execution remain in RE-008.
- Keep editor compatibility/normalization (RE-003) separate from the actual rules mechanics. Do not make Heavy automatically mean Two-Handed in the combat domain.

Acceptance: official 2014 and 2024 weapon lists can be represented without encoding mechanical parameters in display strings; every implemented rule has ruleset-specific regression tests.

### RE-006B4 — Weapon Mastery Eligibility & Selection

- Store the assigned 2024 mastery on each canonical weapon definition, separate from ordinary weapon properties.
- Model the eight mastery IDs (Cleave, Graze, Nick, Push, Sap, Slow, Topple, Vex).
- Model class-specific eligible weapon choices:
  - Barbarian: Simple or Martial melee weapons; starts with 2 choices and scales by class progression.
  - Fighter: Simple or Martial weapons; starts with 3 choices and scales by class progression.
  - Paladin, Ranger, Rogue: 2 proficient weapon types.
- Reuse the generic multiple SelectionMechanic. Barbarian/Fighter replace one weapon-type choice after a Long Rest; Paladin/Ranger/Rogue can change both of their two choices. Resolve Barbarian/Fighter capacity from class progression.
- Validate selected weapon types and resolve whether the character owns the Weapon Mastery feature and selected the weapon before exposing that weapon's mastery to the combat/action layer.
- Keep the eight mastery effects and their triggers in RE-008.

  Status: complete. Merged via PR #6 (`7938d4b6ee72cc2279b22f5b74b1efc719569203`); its CI passed frozen install, typecheck, and 164 unit tests. Mastery effects and action triggers remain in RE-008.

### RE-006C — Armor Training Consequences

#### RE-006C1 — Consequence Resolver

- Resolve consequences from an already-normalized armor/shield training snapshot, separate from AC calculation.
- 2014: untrained armor or shield imposes Disadvantage on STR/DEX ability checks, saving throws, and attack rolls, and prevents spellcasting. An untrained shield still contributes its AC bonus.
- 2024: untrained Light/Medium/Heavy armor imposes Disadvantage on STR/DEX D20 Tests and prevents spellcasting; an untrained Shield only loses its AC benefit.
- Return deduplicated derived flags for downstream attack/check/save/spellcasting engines without mutating rolls or character state.

Status: complete. Merged via PR #7 (`4942339f56b4d51282e9225f1b32e81b12a77fb9`). CI run `41831774283` passed frozen install, typecheck, and 177 unit tests on its exact head.

#### RE-006C2 — Training Grant Resolution

- Normalize armor and shield training grants from class, subclass, species, background, feat, and other owned feature content.
- Support category grants (Light/Medium/Heavy) and Shield training without inferring proficiency from display text.
- Handle multiclass grant unions, shared content, and ruleset-incompatible sources with diagnostics.
- Retain grant provenance for builder diagnostics and auditability.

Status: implementation complete on `feat/re-006c2-armor-training-grants`. The previous-base CI passed frozen install, typecheck, and 184 unit tests; final verification is rerun after retargeting this PR to `main`.

### RE-006D — Hit Points, Hit Dice & Recovery

- Maximum/current/temporary HP and damage/healing application.
- Hit Dice pools and spending.
- Death saves and stabilization.
- Short Rest, Long Rest, and other recovery boundaries, including resource restoration.

### RE-006E — Conditions & Exhaustion

- Condition state and derived attack/check/save/movement restrictions.
- Separate 2014 and 2024 Exhaustion behavior.
- Duration, expiration, stacking, and removal rules with tests.

### RE-006F — Movement & Derived Defenses

- Walking, climbing, swimming, flying, and other movement modes.
- Speed bonuses/penalties and condition interactions.
- Derived combat values that depend on movement or character state.
- Do not fold mount or vehicle stat blocks into the character's base Speed.

### RE-006 completion gate

RE-006 is complete only when all slices above have explicit acceptance tests, clean-room typecheck and unit tests pass, and the derived calculations are documented. UI integration and legacy migration remain later work.

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
- Implement weapon mastery effects (Cleave, Graze, Nick, Push, Sap, Slow, Topple, Vex), Light/Loading/Ammunition action-cycle interactions, and their turn/Reaction/expiration semantics.
- Resolve cross-feature interactions without duplicating the rules already calculated by RE-006.

## RE-009 — Migration, Content, UI & Integration

- Character-state migration and compatibility.
- Canonical content pilot packs for 2014, 2024, shared, and Homebrew.
- Owlbear adapters and persistence integration.
- Builder orchestration and UI.
- Character Sheet and Actions presentation.
- Controlled integration behind a feature flag, regression against existing characters, and deliberate retirement of legacy dependencies.

## RE-010 — Creature, Companion & Transportation Layer (future)

Keep these as stat-block-driven entities instead of treating every creature or vehicle as character equipment.

- **Creature entities:** reusable stat blocks, size, creature type, AC, HP, abilities, senses, movement modes, and actions.
- **Mounts:** Mount/Dismount state, rider-to-mount relation, controlled/independent behavior, carrying capacity, mounted movement, falling, and Mounted Combat rules.
- **Familiars and summoned familiars:** ownership/summoner link, creature stat block, summon duration, command/control, dismissal, and re-summoning lifecycle.
- **Other companions and summons:** reusable creature links without forcing them into the character's inventory or base Speed.
- **Vehicles:** separate vehicle stat blocks with their own tactical movement (when defined), travel speed/units (such as mph), AC, HP, crew, passengers, cargo, and operator/driver roles.
- **Owlbear integration:** optional token linking for creature/companion/vehicle entities and their independent HP/movement state.

Vehicle speed must come from the vehicle's own stat block and must never be added to or overwrite the character's walking Speed. A mounted creature may supply the rider's effective tactical movement while mounted, but the character's native movement remains preserved.

RE-010 is intentionally after the core rules engines. It can reuse the action, condition, movement, and effect contracts without blocking completion of RE-006.

## Non-negotiable boundaries

- The new runtime must not import legacy JavaScript from `/assets`.
- The new runtime must not read `/data` or `/data/2024` directly.
- Legacy sources are evidence for reverse engineering, not runtime dependencies.
- Preserve edition identity in metadata; never infer the ruleset from display text.
- Descriptions are for display. They are never the sole source for a mechanical behavior.
- Do not mark a roadmap slice complete until its acceptance tests and CI checks support that status.
