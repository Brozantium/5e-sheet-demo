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

Implemented on branch `feat/re-006b2-weapon-attacks`; PR #1 is open for review.

- Default melee STR and ranged DEX, explicit Finesse STR/DEX choice.
- Weapon/category proficiency, attack adjustments, damage adjustments, and Versatile damage formulas.
- 2014 and 2024 Heavy disadvantage rules.
- Hand occupancy and Light weapon-pair prerequisite validation.

Status: implementation and tests complete for this bounded slice; pending PR review/merge. It does not complete Weapon Properties as a whole.

### RE-006B3 — Weapon Properties & Range (current priority)

Split this into small, independently testable slices:

- **B3A — Canonical property model and range contracts:** ruleset-aware 2014/2024 property definitions; normal and long range; distinct thrown range; ammunition type; Versatile damage metadata; structured Special rules; schema and registry validation.

  Status: implementation complete on `feat/re-006b3a-weapon-property-model`. Frozen install and typecheck passed; all 113 unit tests passed. Pending review/merge after the B2 dependency.

- **B3B — Property calculations:** Reach and Opportunity Attack reach; Thrown attack mode and ability selection; range-band validation and long-range Disadvantage; Two-Handed constraints including the 2024 mounted Lance exception; 2014 Lance close-range rule and Net non-damaging attack profile.

  Status: implementation complete on `feat/re-006b3b-weapon-range-reach`. Frozen install and typecheck passed; all 123 unit tests passed. Pending review/merge after the B3A dependency.
- **B3C1 — Ammunition & Loading:** ammunition availability and consumption per ranged attack; the free-hand requirement for loading one-handed weapons; Loading's one-shot limit per Action, Bonus Action, or Reaction; post-battle ammunition recovery; improvised-weapon handoff for ranged weapons used in melee.

  Status: implementation complete on `feat/re-006b3c1-ammunition-loading`. Frozen install and typecheck passed; all 133 unit tests passed. Pending review/merge after the B3B dependency.

- **B3C2 — Light extra-attack trigger contract:** 2014 two-weapon requirements versus 2024 Light trigger; negative-only ability modifier damage; Nick's action placement when the extra weapon's mastery is already unlocked and selected.

  Status: implementation complete on `feat/re-006b3c2-light-nick-trigger`. Frozen install and typecheck passed; all 149 unit tests passed. Pending review/merge after the B3C1 dependency. Stateful execution and action consumption remain with RE-008.

Weapon Property/range/attack-cycle implementation (B3A–B3C2) is covered by independent stacked PRs. B4 completes mastery selection/eligibility; mastery effects and 2014/2024 Special effect execution remain in RE-008.

Weapon Property/range/attack-cycle implementation (B3A–B3C2) is now covered by independent stacked PRs. Remaining weapon-specific RE-006 scope is B4 mastery eligibility/selection; mastery effects and 2014/2024 Special effect execution remain in RE-008.
- Keep editor compatibility/normalization (RE-003) separate from the actual rules mechanics. Do not make Heavy automatically mean Two-Handed in the combat domain.

Acceptance: official 2014 and 2024 weapon lists can be represented without encoding mechanical parameters in display strings; every implemented rule has ruleset-specific regression tests.

### RE-006B4 — Weapon Mastery Eligibility & Selection (current)

- Store the assigned 2024 mastery on each canonical weapon definition, separate from ordinary weapon properties.
- Model the eight mastery IDs (Cleave, Graze, Nick, Push, Sap, Slow, Topple, Vex).
- Model class-specific eligible weapon choices:
  - Barbarian: Simple or Martial melee weapons; starts with 2 choices and scales by class progression.
  - Fighter: Simple or Martial weapons; starts with 3 choices and scales by class progression.
  - Paladin, Ranger, Rogue: 2 proficient weapon types.
- Reuse the generic multiple SelectionMechanic with Long Rest replacement of one choice; resolve the actual number of choices from the class progression table for Barbarian/Fighter.
- Validate selected weapon types and resolve whether the character owns the Weapon Mastery feature and selected the weapon before exposing that weapon's mastery to the combat/action layer.
- Keep the eight mastery effects and their triggers in RE-008.

  Status: implementation complete on `feat/re-006b4-weapon-mastery-selection`. Frozen install and typecheck passed; all 164 unit tests passed. Pending review/merge after the B3C2 dependency. Mastery effects and action triggers remain in RE-008.

### RE-006C — Armor Training Consequences

- Resolve armor and shield training grants from character features in the builder/content layer.
- Implement ruleset-specific consequences as a pure derived result, separate from Armor Class:
  - 2014: untrained armor or shield imposes Disadvantage on STR/DEX ability checks, saving throws, and attack rolls, and prevents spellcasting. An untrained shield still grants its AC bonus.
  - 2024: untrained Light/Medium/Heavy armor imposes Disadvantage on STR/DEX D20 Tests and prevents spellcasting. An untrained shield only loses its AC benefit.
- Return a deduplicated consequence state for downstream attack/check/save/spellcasting engines; do not mutate rolls or spell state here.
- Cover worn armor, shields, magic armor/shields, mixed cases, and ruleset compatibility with regression tests.

Status: implementation in progress on `feat/re-006c-armor-training-consequences`; frozen install, typecheck, and unit-test verification pending.

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
