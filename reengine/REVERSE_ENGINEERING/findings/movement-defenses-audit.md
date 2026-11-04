# RE-006F Audit — Movement & Derived Defenses

> **Audit date:** 2026-11-04 (Asia/Jakarta)  
> **Source branch:** `feat/re-006e3-condition-lifecycle`  
> **Status:** reengine movement and derived-defense contracts audited; no RE-006F runtime implementation has been added by this audit.

## Executive summary

The clean-room reengine has useful inputs from RE-006B/C and RE-006E, but it does not yet have a unified movement resolver or a derived-defense aggregator.

Existing pieces:

- Armor Class (B1) returns AC and an armor Strength-requirement Speed penalty.
- Armor training (C1/C2) returns STR/DEX D20-test disadvantage, spellcasting restrictions, and shield AC handling.
- Condition Engine (E1) returns Speed 0 constraints, crawl/stand/prone/approach/grapple movement facts, and condition-sourced defenses.
- Exhaustion Engine (E2) returns edition-specific Speed effects.
- Canonical Feature/Option effects already have structured resistance, immunity, and vulnerability declarations.

Missing pieces:

- A single pure movement resolver that accepts explicit movement modes and composes armor, Exhaustion, conditions, and other structured modifiers.
- A defense resolver that merges provenance-aware damage resistances, vulnerabilities, damage immunities, and condition immunities without multiplying non-stacking benefits.
- A shared defense application contract for downstream damage resolution. RE-006F should return the normalized defense outcome/order; RE-008 owns action/effect execution.

## Evidence inspected

### Existing clean-room contracts

1. `reengine/src/domain/equipment.ts`
   - `ArmorClassResult` returns `speedPenalty`, `stealthDisadvantage`, AC components, and issues.
   - `ArmorTrainingConsequenceResult` returns STR/DEX D20 Test disadvantage, `cannotCastSpells`, and shield handling.
2. `reengine/src/engines/armor-class-engine.ts`
   - A Strength requirement not met by the character sets `speedPenalty = 10`.
   - This result is presently isolated in the Armor Class calculation; no unified movement calculation consumes it.
3. `reengine/src/domain/conditions.ts` / `condition-engine.ts`
   - E1 supplies `speedIsZero`, `speedCannotIncrease`, `crawlAllowed`, stand-up cost, forbidden voluntary approach targets, and Grappled drag rules.
   - E1 returns `damageResistances`, `damageImmunities`, and `conditionImmunities` for effects such as Petrified.
   - E1 does not calculate the final speed for a movement mode, movement budget, difficult terrain, crawling cost, or falling while flying.
4. `reengine/src/domain/exhaustion.ts` / `exhaustion-engine.ts`
   - E2 returns 2014 half/zero Speed and 2024 flat Speed reduction by 5 feet per level.
   - `baseSpeed` is currently a single optional input described as walking Speed; E2 does not resolve all movement modes together.
5. `reengine/src/domain/types.ts`
   - Structured `EffectDefinition` already supports `kind: "defense"` with `resistance | immunity | vulnerability` plus a damage/condition value.
   - The record shape is a declaration, not a normalized source-aware defense aggregation result.
6. `reengine/src/domain/character.ts`
   - Core character calculation input does not currently contain movement mode profiles.
7. Legacy `src/combat-rules.ts`
   - Contains `StructuredDefense` and `mergeDefenses()`, which deduplicates textual resistances, vulnerabilities, immunities, and condition immunities and sums non-negative AC bonuses.
   - This legacy helper is a behavior reference only. It is not a clean-room implementation to copy.
8. Legacy `src/App.tsx`
   - Character Speed and the E1-style condition summary are surfaced in the sheet, but there is no complete clean-room movement calculation contract in the reengine.

## RE-006F1 — Movement Modes & Speed Resolution

### Movement mode model

Support these independent character movement modes:

- `walk` — the ordinary walking Speed. A creature with no ground locomotion may have walking Speed 0.
- `climb` — special Climb Speed.
- `swim` — special Swim Speed.
- `fly` — special Fly Speed, with an explicit `canHover` capability.
- `burrow` — special Burrow Speed.

A missing special speed means the character does not have that special mode; it must not silently inherit walking Speed. If a feature explicitly grants a special speed equal to another speed, the caller/content adapter resolves that relationship into a concrete base value before this pure resolver is called.

Each mode retains its own base value and provenance. Do not mutate character base values when applying temporary changes.

### Speed modifier inputs

The resolver should consume structured, source-aware modifiers, rather than parse content descriptions:

- flat bonus or penalty in feet;
- multiplier/halving effects where the rule explicitly uses them;
- mode scope (all speeds or a particular mode);
- ruleset and active duration/lifecycle ownership from the caller;
- existing armor `speedPenalty`;
- E2 Exhaustion output;
- E1 condition movement output.

Do not encode a generic rule that every condition sets Speed 0. Let the condition resolver supply the actual constraint. Speed-0 effects take precedence over positive bonuses; no bonus or multiplier can make a prohibited speed positive.

### Composition requirements

- One ruleset-aware calculation must return final walking/climb/swim/fly/burrow speeds.
- A Speed change that applies to a creature's Speed must also affect special speeds where the applicable rules say so. 2024's Speed glossary explicitly requires special speeds to change by the same amount (including reductions to 0 and halving).
- For 2024 Exhaustion, apply the flat reduction of 5 feet per level to the creature's special speeds as required by the Speed rule; do not leave Fly/Climb/Swim untouched.
- 2014 Exhaustion halving/zero-Speed stages must not be converted into the 2024 flat penalty.
- Armor Strength-requirement penalty remains a distinct source and should feed the same movement composition, not be added to AC or applied twice.
- The final effective speed cannot be negative; floor at 0 after all applicable modifiers.
- Multiple bonuses/penalties must retain source provenance for debugging and explainability.
- Do not merge mount/vehicle movement into the character profile. RE-010 owns creature and vehicle stat blocks and mount/dismount movement selection.

### Movement cost and movement-state facts

The resolver or an adjacent pure helper should expose movement costs/constraints without simulating the turn:

- Climbing without a Climb Speed costs 2 feet of movement per foot traveled; difficult terrain makes it 3 feet per foot.
- Swimming without a Swim Speed costs 2 feet per foot; difficult terrain makes it 3 feet per foot.
- Crawling costs 2 feet per foot; difficult terrain makes it 3 feet per foot. The existing E1 `crawlAllowed` boolean must not be mistaken for a complete crawl-cost calculation.
- When a character has the relevant Climb/Swim Speed and uses it for that mode, the normal extra movement cost is ignored.
- Prone movement is restricted to crawling or spending half Speed (round down) to stand; standing is unavailable at Speed 0. The E1 condition state supplies the basic permission/cost fact; F should calculate the concrete amount using final effective Speed and may accept explicit feature exceptions (for example, a feature that lets the creature stand using 5 feet).
- Difficult Terrain applies its additional movement cost once per space; multiple reasons for a space being difficult do not compound it.
- Grappled 2024 drag movement is an extra movement cost supplied by E1; apply it to the movement budget once, only when its structured exemptions do not apply.
- The caller/action layer decides how far the creature actually moves, movement remaining, switching modes during a turn, and action/turn sequencing. F resolves values and costs; it does not run the turn.

### Flying and falling

Return explicit derived facts for flight safety; do not silently teleport or execute a fall:

- 2014: a flying creature falls if knocked Prone, Speed becomes 0, or it is otherwise deprived of the ability to move, unless it can hover or is held aloft by magic.
- 2024: a flying creature falls if it has Incapacitated or Prone, or its Fly Speed is reduced to 0, unless it can hover.
- Return `mustFall` / `canRemainAloft` (or equivalent) for downstream execution; fall damage/landing/prone resolution is outside this resolver.

## RE-006F2 — Derived Defenses

### Canonical defense facts

Normalize the following separately:

- damage resistance by damage type;
- damage vulnerability by damage type;
- damage immunity by damage type;
- condition immunity by condition ID.

Retain source IDs and source labels/provenance. Sources may include structured feature/option effects, condition-derived effects, and future creature/stat-block sources. Do not merge an Armor Class bonus into a damage defense category: AC remains owned by the Armor Class engine.

### No-stacking and resolution semantics

- Duplicate resistance sources for the same damage type count as one resistance, not repeated halving.
- Duplicate vulnerability sources for the same damage type count as one vulnerability, not repeated doubling.
- Damage immunity means no damage of that type; condition immunity means the condition does not affect that creature.
- The normalized profile should preserve both Resistance and Vulnerability when both exist for the same type; return their source provenance and explicit application order for the later damage resolver.
- Damage modifiers are applied first, Resistance second, Vulnerability third, following the 2024 rules. Resistance is applied only once per damage instance; Vulnerability is applied only once per damage instance.
- The F2 defense profile may report whether a damage type is immune/resistant/vulnerable and which sources grant it; RE-008 remains responsible for applying actual attack/spell/item damage in a full effect pipeline.
- Condition immunity is separate from damage immunity and must be consumed by condition application/validation; merely displaying the condition immunity does not prevent the condition.

## Proposed implementation slices

1. **F1 — Movement Profiles & Speed Resolver**
   - Domain contracts for mode-specific base speeds, provenance-bearing modifiers, condition/Exhaustion/armor inputs, movement costs, and flight safety.
   - Pure resolver with an explicit, documented composition order and tests.
2. **F2 — Defense Profile Resolver**
   - Source-aware resistance/vulnerability/damage immunity/condition immunity aggregation.
   - No-stacking, mixed resistance/vulnerability ordering, and tests.
   - Keep Armor Class in B1 and damage execution in RE-008.

## Acceptance tests

### F1 movement
- Missing special speed is unavailable and never silently copies walking Speed.
- Explicit special speed equal to walking Speed remains a separate usable mode.
- Multiple speed modes can be switched in one movement budget using remaining movement according to the caller's current move state.
- 2024 Speed reductions/bonuses propagate to special speeds as required.
- 2014 Exhaustion applies halving/zero stages, not 2024 numeric reductions.
- 2024 Exhaustion applies `-5 × level` to every affected speed, floored at 0.
- Armor strength speed penalty is included exactly once.
- Condition Speed 0 cannot be overridden by bonuses, exhaustion policy, or armor.
- Final speeds never become negative.
- Climbing/swimming/crawling and difficult terrain costs are correct (1/2/3 movement per foot in the relevant combinations).
- Climb/Swim Speed removes the relevant extra movement cost only for that mode.
- Prone stand-up cost uses half final Speed rounded down; Speed 0 blocks standing; explicit feature exception can override when valid.
- Grappled drag rules are applied once and size exemptions are respected.
- Flight fall conditions differ correctly between 2014 and 2024 and honor Hover/magical suspension.
- No mount or vehicle speed is added to the character movement profile.

### F2 defenses
- Duplicate resistance and duplicate vulnerability sources do not stack.
- Mixed resistance and vulnerability retain both sources and the correct application order.
- Damage immunity takes precedence over damage reduction/multiplication.
- Condition immunity stays separate from damage immunity.
- Petrified-derived defenses enter the same normalized profile without being duplicated.
- AC and armor training remain outside the defense aggregator.
- Provenance survives aggregation for diagnostics/UI.

## Official rules references

- [2014 Basic Rules — Combat: Movement and Position](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/combat)
- [2014 Basic Rules — Monsters: Speed and Special Movement](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/monsters)
- [2014 Basic Rules — Adventuring: Climbing, Swimming, Crawling](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/adventuring)
- [2024 Basic Rules — Playing the Game](https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game)
- [2024 Basic Rules — Rules Glossary](https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary)

## Audit conclusion

The reengine already has isolated movement and defense inputs from B1/C1/C2/E1/E2, but not their unified resolvers. RE-006F should be split into F1 Movement Profiles & Speed Resolution and F2 Derived Defense Profile. It must not duplicate AC, condition resolution, Exhaustion recovery, damage execution, turn scheduling, mount/vehicle stat blocks, or Owlbear integration.
