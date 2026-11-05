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

  Status: merged via PR #5 (`03dba0f509e3c702a548b4397aceea8e63b09f05`). CI passed on the merged head: frozen install, typecheck, and 149 unit tests. Stateful execution and action consumption remain with RE-008.

Weapon Property/range/attack-cycle implementation (B3A–B3C2) is merged through PRs #2–#5. B4 mastery eligibility/selection is also merged; mastery effects and 2014/2024 Special effect execution remain in RE-008.

- Keep editor compatibility/normalization (RE-003) separate from the actual rules mechanics. Do not make Heavy automatically mean Two-Handed in the combat domain.

Acceptance: official 2014 and 2024 weapon lists can be represented without encoding mechanical parameters in display strings; every implemented rule has ruleset-specific regression tests.

### RE-006B4 — Weapon Mastery Eligibility & Selection

- Store the assigned 2024 mastery on each canonical weapon definition, separate from ordinary weapon properties.
- Model the eight mastery IDs (Cleave, Graze, Nick, Push, Sap, Slow, Topple, Vex).
- Model class-specific eligible weapon choices:
  - Barbarian: Simple or Martial melee weapons; starts with 2 choices and scales by class progression.
  - Fighter: Simple or Martial weapons; starts with 3 choices and scales by class progression.
  - Paladin, Ranger, Rogue: 2 proficient weapon types.
- Reuse the generic multiple SelectionMechanic; Barbarian/Fighter replace one choice after a Long Rest, while Paladin/Ranger/Rogue can change their full two-weapon selection. Resolve Barbarian/Fighter capacity from class progression.
- Validate selected weapon types and resolve whether the character owns the Weapon Mastery feature and selected the weapon before exposing that weapon's mastery to the combat/action layer.
- Keep the eight mastery effects and their triggers in RE-008.

  Status: complete. Merged via PR #6 (`7938d4b6ee72cc2279b22f5b74b1efc719569203`); its CI passed frozen install, typecheck, and 164 unit tests. Mastery effects and action triggers remain in RE-008.

### RE-006C — Armor Training Consequences

#### RE-006C1 — Consequence Resolver

- Resolve consequences from an already-normalized armor/shield training snapshot, separate from AC calculation.
- 2014: untrained armor or shield imposes Disadvantage on STR/DEX ability checks, saving throws, and attack rolls, and prevents spellcasting. An untrained shield still contributes its AC bonus.
- 2024: untrained Light/Medium/Heavy armor imposes Disadvantage on STR/DEX D20 Tests and prevents spellcasting; an untrained Shield only loses its AC benefit.
- Return deduplicated derived flags for downstream attack/check/save/spellcasting engines without mutating rolls or character state.

Status: complete. Merged via PR #7 (`4942339f56b4d51282e9225f1b32e81b12a77fb9`). CI run `41831774283` passed frozen install, typecheck, and 177 unit tests on the exact head.

#### RE-006C2 — Training Grant Resolution

- Normalize armor and shield training grants from class, subclass, species, background, feat, and other owned feature content.
- Support category grants (Light/Medium/Heavy) and Shield training without inferring proficiency from display text.
- Handle multiclass grant unions, shared content, and ruleset-incompatible sources with diagnostics.
- Retain grant provenance for builder diagnostics and auditability.

Status: complete. Merged via PR #8 (`d2210d3c961240e4e65cca7423bd7a74dc29374d`). CI runs `41835792260` and `41835787859` passed frozen install, typecheck, and 184 unit tests on the exact head.

### RE-006D — Hit Points, Hit Dice & Recovery

#### RE-006D1 — Maximum HP & HP State

- Calculate maximum HP per character level, respecting each multiclass level's Hit Die, first-level maximum, later fixed average or supplied roll, Constitution modifier, and explicit flat bonuses.
- Apply damage with Temporary HP absorbed first and healing up to maximum HP. Temporary HP never stacks; when a grant arrives while Temporary HP already exists, preserve the player's choice to keep the current amount or take the new amount, even when the new amount is lower.
- Return immutable snapshots and explicit applied/overflow amounts; death-state transitions remain D3.

Status: complete. Merged via PR #9 (`9a46657a65a3cc8c852f8cbaec578defa6290d8c`). CI run `41836522582` passed frozen install, typecheck, and 199 unit tests on the exact head.

#### RE-006D2 — Hit Dice Pools & Short Rest

- Build immutable per-class Hit Die pools from the validated per-level HP snapshot, preserving each class's Hit Die size and remaining/spent counts.
- Resolve one class-specific Hit Die spend per explicit player decision; pass the returned HP/pool snapshots back only if the player chooses to spend another die.
- 2014 Short Rest: regain HP per die equal to the roll plus Constitution modifier, with a minimum of 0 HP; there is no 2024-style positive-HP start restriction.
- 2024 Short Rest: the character must have at least 1 HP when the rest begins; regain HP per die equal to the roll plus Constitution modifier, with a minimum of 1 HP.
- Cap actual recovery at maximum HP, preserve Temporary HP, and never spend from another class pool or beyond its remaining count.
- The rest coordinator owns duration/interruption/completion; this pure resolver accepts a completed Short Rest and the HP snapshot from when the rest began.

Status: implementation complete. Exact-`main` verification in PR #10 passed frozen-lockfile install, `pnpm typecheck:reengine`, and all 212 unit tests.

#### RE-006D3 — Death Saves & Stabilization

- Track non-consecutive Death Save successes/failures: DC 10, three successes become Stable, three failures cause death; a natural 1 adds two failures and a natural 20 restores 1 HP.
- Reset both tallies when HP is regained or the character becomes Stable.
- Resolve damage while at 0 HP: one failure for damage, two for a Critical Hit; apply instant death when damage equals or exceeds maximum HP. Also resolve massive damage when dropping from positive HP to 0.
- 2014 stabilization: Action + DC 10 Wisdom (Medicine), or expend one Healer's Kit use as an Action without a check.
- 2024 stabilization: Help action + DC 10 Wisdom (Medicine), or expend one Healer's Kit use as a Utilize action without a check.
- A Stable character remains at 0 HP and unconscious; damage ends Stability. After the rules-defined 1d4 hours without healing, the character regains 1 HP.
- Keep shared Death Save outcomes common while retaining edition-specific stabilization action costs. Melee knockout action semantics remain a combat/action integration concern.

Status: implementation complete. Exact-`main` workflow `41888312987` passed frozen-lockfile install, `pnpm typecheck:reengine`, and all 236 unit tests. Turn orchestration, condition application, and knockout action handling remain with RE-006E/RE-008.

#### RE-006D4 — Long Rest & Recovery

- Validate a Long Rest snapshot: at least 8 hours, at least 6 hours of sleep, and no more than 2 hours of light activity; require at least 1 HP when starting under both rulesets.
- 2014: a character cannot benefit from more than one Long Rest in 24 hours; an interruption by at least 1 hour of strenuous activity requires restarting the rest. A completed rest restores all HP and up to half the total Hit Dice (minimum one, capped by spent dice), with player-selected multiclass pools.
- 2024: wait at least 16 hours after finishing a Long Rest before starting another; Initiative, a non-cantrip spell, taking damage, or at least 1 hour of physical exertion interrupts the rest. Resume immediately with one extra hour required per interruption. If at least 1 hour elapsed before interruption, grant Short Rest eligibility.
- Restore all lost HP while leaving Temporary HP unchanged. Restore resources tagged Short Rest or Long Rest through the existing resource engine.
- 2014 removes one Exhaustion level only if the character has consumed food and drink; 2024 removes one level on every completed Long Rest.
- 2014 Hit Dice recovery is a player choice, limited to half total Hit Dice (minimum one); 2024 automatically restores all expended Hit Dice.
- Keep the rest lifecycle and interruption event log explicit; do not duplicate D2 Hit Die spending or RE-006E Exhaustion effects.

Status: implementation complete and exact-`main` CI verified on PR #12 head `fe1e6e403106d116118019d649b497138f4371dd`: frozen-lockfile install, `pnpm typecheck:reengine`, and all 258 unit tests passed. The caller supplies the resolved rest event log; persistence and UI orchestration remain later integration work.

### RE-006E — Conditions & Exhaustion

**Audit status:** complete for the inspected legacy sheet path. **Implementation status:** E1–E3 are implemented and CI verified on clean stacked PRs #20–#22; review/merge remains pending. See [conditions-exhaustion-audit.md](./REVERSE_ENGINEERING/findings/conditions-exhaustion-audit.md).

#### RE-006E1 — Condition Instances & Derived Resolver

- Preserve condition instances with unique identity, source/provenance, affected character/target, and independent duration/expiration.
- Allow multiple instances of the same non-stacking condition; aggregate its mechanical effect by condition type while preserving each instance's lifecycle.
- Return structured outgoing/incoming attack, check/save, action/Bonus Action/reaction, movement, automatic-failure, Concentration, and defense/immunity consequences.
- Model context-dependent requirements (source/target identity, line of sight, distance) as structured inputs/results rather than reminder-only strings.
- Do not execute attacks, actions, reactions, movement, or triggers; those remain downstream engine responsibilities.

Status: implemented and CI verified on clean [PR #20](https://github.com/Brozantium/5e-sheet-demo/pull/20). Corrected roll-mode cancellation and explicit Charmed attack-target restrictions; exact head `74b91177cb7456c98dc22b7266e6f30a597d0cec`; workflow 41957036163 succeeded (289 tests, 0 failures).

#### RE-006E2 — Ruleset-aware Exhaustion Resolver

- 2014: cumulative Disadvantage ladder, Speed halving/zero, maximum-HP halving, and death at level 6.
- 2024: cumulative -2 per level to D20 Tests, -5 feet per level to Speed, and death at level 6.
- Keep a dedicated numeric Exhaustion level and explicit ruleset policy; do not translate 2024 numeric penalties into Disadvantage.
- Reuse RE-006D4 for Long Rest Exhaustion recovery. Do not duplicate D4's 2014 food/drink gate or 2024 unconditional one-level recovery.
- Return an explicit death outcome at level 6 compatible with D3; do not synthesize failed Death Saves.

Status: implemented and CI verified on clean [PR #21](https://github.com/Brozantium/5e-sheet-demo/pull/21). Exact head `49869b7bc58c7018b522380c752ce88407317ad0`; workflow 41957070754 succeeded (303 tests, 0 failures).

#### RE-006E3 — Condition Lifecycle

- Resolve structured duration/expiration events: turn/round boundaries, source/target events, successful removal saves, Short Rest, Long Rest, Dawn, and manual removal.
- Expire/remove only the matching instance(s); preserve other instances of the same condition type.
- Keep lifecycle operations pure and caller-driven. No internal timers, clocks, event scheduler, or persistence.

Status: implemented and CI verified on clean [PR #22](https://github.com/Brozantium/5e-sheet-demo/pull/22). E1's ConditionApplicationTime now declares the optional caller sequence consumed by lifecycle stale-event checks. Exact head `75fd2a9515917721c5a2785331d42b7538272d54`; workflow 41957082301 succeeded (324 tests, 0 failures).

**Audit findings that affect implementation:**

- Legacy `ActiveCondition` already stores per-instance IDs, source, duration, expiration, save text, notes, and applied timestamp. The missing piece is structured behavior and lifecycle enforcement, not the existence of per-instance data.
- Legacy resolver aggregates condition types and returns only roll modes, a coarse speed state, action/reaction flags, and reminder text. Incoming-attack context, automatic save failures, target/source context, and several movement/defense rules are not mechanically represented.
- Legacy UI/effect application paths reject a second instance of an already-active condition even though the rules preserve independent durations for multiple sources.
- Legacy `duration` and `appliedAt` do not drive timed expiry. Only Short Rest, Long Rest, Dawn, and manual persistence are observed.
- Legacy Exhaustion helper is 2014-only. The reengine D4 Long Rest resolver owns the ruleset-specific recovery decision.

### RE-006F — Movement & Derived Defenses

See [movement-defenses-audit.md](./REVERSE_ENGINEERING/findings/movement-defenses-audit.md) for legacy evidence, contract decisions, tests, and scope boundaries.

#### RE-006F0 — Movement & Defense Audit / Contract Boundaries

Status: audit complete. The legacy single-Speed path, visible movement grants, E1/E2 outputs, and defense aggregation path were inspected.

#### RE-006F1 — Movement Profiles

- Define walking, climbing, swimming, flying, and burrowing profile IDs.
- Preserve absent modes separately from explicit zero Speed.
- Retain provenance and keep base profiles separate from temporary modifiers.

Status: implemented and CI verified on clean [PR #24](https://github.com/Brozantium/5e-sheet-demo/pull/24).

#### RE-006F2 — Effective Movement Resolver

- Apply explicit caller-ordered modifiers to each mode.
- Consume the existing E2 Exhaustion speed effect per mode.
- Apply E1 hard Speed-zero / cannot-increase constraints last; preserve crawl/stand, source-approach, and Grappled drag metadata without executing movement.
- Keep movement costs and target restrictions separate from Speed values.

Status: implemented and CI verified on clean [PR #24](https://github.com/Brozantium/5e-sheet-demo/pull/24).

#### RE-006F3 — Derived Defense Aggregation

- Aggregate feature, temporary, equipment, and E1 condition-derived defense facts.
- Coalesce duplicate labels while preserving unique source provenance.
- Preserve AC bonus source records without owning AC arithmetic; leave damage conflict resolution downstream.

Status: implemented and CI verified on clean [PR #24](https://github.com/Brozantium/5e-sheet-demo/pull/24).

PR #24 carries the F1–F3 implementation on clean stacked history. Exact-head workflow 41968757492 passed frozen-lockfile install, `pnpm typecheck:reengine`, and `pnpm test:reengine` (338 tests, 0 failures). Review/merge remains pending.

**Movement/defense consumer boundaries:**

- Modifier order is a deterministic caller-defined extension contract, not a universal 2014/2024 D&D stacking policy. Content consumers must establish the relevant stacking policy and tests before assigning order values.
- Movement profiles and modifiers preserve source records. The current resolution result exposes effective Speed and applied/blocked modifier IDs; retain normalized inputs when consumers need full provenance.
- F3 projects E1 damage resistance, damage immunity, and condition immunity. E1 `diseaseImmunity` remains a separate result and must not be discarded by consumers.
- AC bonus arithmetic remains owned by the AC engine; resistance/immunity conflict resolution remains downstream.
- No mount, familiar, summoned creature, or vehicle entity model (RE-010); no turn/action/pathfinding/movement consumption (RE-008); no Owlbear/UI/persistence integration (RE-009).

### RE-006 completion gate

RE-006 implementation is present across the documented slices. E1–E3 and F1–F3 are implemented and CI verified on the current clean PR stack #20–#24. It is **not yet administratively complete**: PRs #19–#24 still require dependency-aware review/merge reconciliation. Do not begin RE-007 until all RE-006 slices are merged and the final mainline typecheck/unit suite passes. UI integration and legacy migration remain later work.

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
- Resolve ruleset-specific melee knockout choices: 2014 can leave a target at 0 HP and Stable; 2024 leaves it at 1 HP with Unconscious and starts a Short Rest, with the documented end conditions.
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
