# RE-006E Audit — Conditions & Exhaustion

> **Audit date:** 2026-11-04 (Asia/Jakarta)  
> **Legacy source:** `src/App.tsx` and `src/combat-rules.ts` on `feat/re-006d4-long-rest-recovery`  
> **Rules references:** official D&D Basic Rules 2014 and D&D Beyond Basic Rules 2024 (links below)  
> **Status:** legacy call path and ruleset gaps audited; E1 and E2 are implemented on stacked review branches and have passed CI, but are not yet merged.

## Executive summary

The legacy sheet already has a real condition subsystem connected to character state, roll resolution, action availability, defense aggregation, and rest handling. The first audit note was too broad when it described condition source/duration information as missing: the `ActiveCondition` record already preserves per-instance identity and descriptive provenance.

The actual gap is that the current resolver exposes only a small aggregate summary. Several condition rules remain reminder text rather than structured mechanics. The legacy app also prevents duplicate instances of the same condition in its normal application paths, even though the rules preserve each imposed instance's independent duration while not stacking its mechanical severity. Duration is mostly descriptive; only rest/dawn expiration categories are executed.

The current Exhaustion implementation is the **2014 ladder only**. The clean-room RE-006D4 Long Rest engine already owns ruleset-aware Long Rest Exhaustion recovery; RE-006E should implement Exhaustion's derived mechanical consequences and must not duplicate D4 recovery.

## Scope and inspection method

Inspected:

- `src/combat-rules.ts`: condition IDs, `ActiveCondition`, `ConditionSummary`, `conditionSummary()`, roll-mode combination, speed/maximum-HP helpers, and structured defenses.
- `src/App.tsx`: Sheet state, initialization, load normalization, condition creation, action-effect application, roll calls, movement derivation, death-state interaction, rest filtering, UI controls, and condition display.
- `reengine/src/engines/long-rest-engine.ts` and its tests: current clean-room Long Rest Exhaustion recovery contract.
- Repository search for `ActiveCondition`, `CONDITION_TYPES`, `conditionSummary`, `exhaustionLevel`, `expiration`, and related condition/rest references.

This audit is scoped to the inspected legacy sheet path and the current reengine contracts. It does not claim that every third-party/homebrew rule in content descriptions has been converted to structured effects.

## Evidence in the legacy app

### 1. Data model and persistence

- `CONDITION_TYPES` contains the 14 non-Exhaustion conditions.
- `ActiveCondition` already has per-record `id`, `type`, `source`, `sourceDetails`, `appliedCharacter`, `duration`, `expiration`, `save`, `notes`, and `appliedAt`.
- `Sheet` stores `activeConditions: ActiveCondition[]` and `exhaustionLevel: number`.
- Loading normalizes each saved condition and clamps Exhaustion to 0–6. Thus the sheet already persists a list of condition instances rather than a single boolean per condition type.
- `duration`, `source`, `save`, and `notes` are displayed in the condition UI. `appliedAt` is initialized but has no observed duration countdown use in the inspected file.

Code evidence:
- [Condition identifiers and ActiveCondition](../../../src/combat-rules.ts#L4-L34)
- [Sheet state](../../../src/App.tsx#L280-L315)
- [Condition normalization](../../../src/App.tsx#L4823-L4845)
- [Saved character condition loading](../../../src/App.tsx#L5048-L5055)

### 2. Resolver and actual consumers

`conditionSummary(conditions, exhaustionLevel)` folds the active records into a Set of condition types and returns:

- outgoing attack roll mode;
- ability-check roll mode;
- saving-throw roll mode;
- speed state: normal, half, or zero;
- `canAct` and `canReact`;
- textual reminders.

The Set is a reasonable way to avoid multiplying the same condition's mechanical effects. However, the summary is not a complete condition contract: it does not carry target/source context, incoming attack modifiers, automatic saving-throw failure, forced movement limits, stand-up costs, or the condition's structured immunities.

Observed consumers:
- The sheet derives current speed from base speed + active movement bonus, then applies the summary.
- The general roll helper combines the summary's three roll modes with other advantage/disadvantage sources. It blocks attack rolls when `canAct` is false.
- Feature action buttons consult `canAct` or `canReact` based on the action section.
- Death Saves use the summary's saving-throw roll mode.
- UI renders reminder strings and the action/reaction availability indicators.

Code evidence:
- [ConditionSummary and resolver](../../../src/combat-rules.ts#L36-L165)
- [Summary, maximum HP, and speed calculation](../../../src/App.tsx#L5900-L5935)
- [General roll integration](../../../src/App.tsx#L6590-L6645)
- [Death Save mode integration](../../../src/App.tsx#L6888-L6925)
- [Action/reaction button gating](../../../src/App.tsx#L11905-L11942)

### 3. Condition application and instance stacking

Two observed application routes:

- Manual UI: clicking a condition pill toggles the first matching active instance. New manual instances use `expiration: "manual"`.
- Feature action effect: condition effects are applied only for a self-target in this handler, only if the condition is valid and the character is not immune, and only if no instance of that type is already present.

Implication:

- The data structure can preserve multiple instances and unique IDs.
- The normal UI and action-effect paths do not create a second instance of an already-active type. A second effect with an independent duration/source is therefore discarded rather than represented as another instance.
- The summary itself aggregates by type, so multiple instances would not make the mechanical condition stronger. This is compatible with the rules' non-stacking severity, but each instance still needs its own expiry.
- The manual pill's `find`/toggle approach is a type-level toggle, not an instance-management interface.

Code evidence:
- [Feature effect condition application](../../../src/App.tsx#L7058-L7120)
- [Condition UI toggle and instance list](../../../src/App.tsx#L12300-L12378)

### 4. Condition duration and lifecycle

`ActiveCondition` includes a free-text `duration`, a timestamp `appliedAt`, and an `expiration` enum:

`manual | short | long | dawn`

The rest handler applies the following filters:

- Short Rest removes instances whose expiration is `short`.
- Long Rest removes instances whose expiration is `short` or `long`.
- Dawn removes instances whose expiration is `dawn`.
- Manual instances remain.

No turn counter, round/turn boundary, clock deadline, save-to-end resolver, or source-ended event handler was found in the inspected condition path. The free-text duration is presented to the player but is not parsed into a timer. The timestamp is stored but is not used to calculate expiry.

Code evidence:
- [Rest expiration filtering](../../../src/App.tsx#L3815-L3850)
- [Condition normalization and metadata defaults](../../../src/App.tsx#L4823-L4845)
- [Condition source/duration/save display](../../../src/App.tsx#L12340-L12378)

### 5. Exhaustion and rest interaction in the legacy sheet

The legacy helper uses the 2014 Exhaustion ladder:

| Level | Derived legacy consequence |
|---:|---|
| 0 | None |
| 1 | Disadvantage on ability checks |
| 2 | Speed halved |
| 3 | Disadvantage on attack rolls and saving throws |
| 4 | Maximum HP halved |
| 5 | Speed becomes 0 |
| 6 | Death |

The app's current state stores only the numeric level. An effect hook moves HP to 0 and sets three Death Save failures at level 6. The Conditions panel exposes manual plus/minus controls and prints the 2014 effects.

The inspected legacy `applyRestToSheet()` does not reduce `exhaustionLevel`. This is separate from the clean-room D4 engine, which already implements ruleset-aware Long Rest recovery:

- 2014: remove one level only when `foodAndDrinkConsumed === true`.
- 2024: remove one level on every completed Long Rest.
- D4 validates a living character's input Exhaustion level as 0–5; level 6 is the death state, not a living-rest input.

**Boundary:** D4 remains the owner of Long Rest recovery. RE-006E Exhaustion should own per-level derived mechanical effects and validated level changes, not reimplement Long Rest's recovery decision.

Code evidence:
- [2014 Exhaustion calculations](../../../src/combat-rules.ts#L52-L178)
- [Legacy death transition and HP maximum clamp](../../../src/App.tsx#L5904-L5915)
- [Legacy Exhaustion controls/display](../../../src/App.tsx#L12380-L12430)
- [D4 Long Rest Exhaustion recovery](../../../reengine/src/engines/long-rest-engine.ts#L350-L380)
- [D4 Exhaustion recovery tests](../../../reengine/tests/unit/long-rest-engine.test.cjs#L80-L110)

## Condition-by-condition gap matrix

This is a comparison of the legacy resolver with the official 2014/2024 definitions. “Reminder only” means the UI displays text but the current derived result does not provide a structured mechanical flag for downstream calculations.

| Condition | Current legacy behavior | Verified gap / required context |
|---|---|---|
| Blinded | Outgoing attacks Disadvantage | Incoming attacks Advantage and sight-dependent checks automatically fail are reminders, not structured output. |
| Charmed | Reminder only | No typed charmer/target reference; cannot enforce the prohibition on harmful abilities/magical effects against the charmer or apply social-check Advantage. |
| Deafened | Reminder only | No structured “hearing-dependent check automatically fails” result. |
| Frightened | Reminder only | Needs fear-source identity and line-of-sight context for Disadvantage, plus a movement constraint preventing voluntary approach. |
| Grappled | Speed 0 | Does not expose the 2024 attack restriction against targets other than the grappler. Lifecycle must account for the grappler becoming Incapacitated or the target leaving grapple range. |
| Incapacitated | `canAct=false`, `canReact=false` | 2024 also explicitly disables Bonus Actions, breaks Concentration, prevents speech, and imposes Disadvantage on Initiative when the creature is Incapacitated at the Initiative roll. |
| Invisible | Outgoing attacks Advantage | Incoming attacks Disadvantage are reminder-only; whether an attacker can perceive the invisible creature and target visibility restrictions need context. 2024 also grants Initiative Advantage. |
| Paralyzed | Cannot act/react; speed 0 | Automatic STR/DEX save failure, incoming attack Advantage, and automatic critical hits for a hit from within 5 feet are reminders only. |
| Petrified | Cannot act/react; speed 0; App adds resistance to all damage, Poison immunity, and Poisoned condition immunity | Incoming attack Advantage and automatic STR/DEX save failure are not structured in the summary. Disease handling differs between the 2014 and 2024 wording and must not be copied blindly across rulesets. |
| Poisoned | Outgoing attacks and ability checks Disadvantage | Core roll-mode consequence is represented. |
| Prone | Outgoing attacks Disadvantage | Incoming attack Advantage/Disadvantage by distance is reminder-only. Crawl-only movement and the movement cost/eligibility to stand are not represented. |
| Restrained | Speed 0; outgoing attacks Disadvantage; DEX saves Disadvantage | Incoming attacks Advantage is reminder-only. |
| Stunned | Both: no actions/reactions, STR/DEX save failure, incoming Advantage. 2014: Speed 0 and faltering speech. 2024: no Speed 0 rule; speech is blocked through Incapacitated. | The 2014 movement restriction must not leak into 2024. The 2024 Incapacitated package also breaks Concentration and imposes Initiative Disadvantage. |
| Unconscious | Cannot act/react; speed 0 | Dropping held objects, Prone, automatic STR/DEX save failure, incoming attack Advantage, and automatic critical hits within 5 feet are not applied as structured state/effects in this helper. |

## Ruleset distinctions that must remain explicit

### Conditions generally do not stack; their instances still have separate durations

Both 2014 and 2024 rules state that multiple sources can impose the same condition, each instance has its own duration, and the condition's effects do not become more severe merely because another instance is imposed. Exhaustion is the exception.

**Design consequence:** keep per-instance records and remove/expire one instance at a time; derive the active mechanical condition by type so duplicates do not multiply effects. Do not solve “no stacking” by throwing away the second source's expiration record.

### Ruleset differences to encode

- **Grappled:** 2014 defines Speed 0 and the conditions for ending the grapple. 2024 retains Speed 0 and additionally gives Disadvantage on attacks against targets other than the grappler, plus explicit drag/carry movement rules.
- **Incapacitated:** 2014 says no actions or reactions. 2024 explicitly lists Actions, Bonus Actions, and Reactions, and adds Concentration, speech, and Initiative consequences.
- **Petrified:** 2014 includes immunity to poison and disease. 2024 specifically says immunity to the Poisoned condition; its glossary wording must not be silently replaced with the 2014 poison/disease wording.
- **Stunned:** 2014 explicitly prevents movement and allows only faltering speech. 2024 inherits Incapacitated but omits the 2014 movement restriction; Incapacitated makes the creature speechless. Keep the ruleset policy split.
- **Prone:** both rules restrict movement to crawling or standing, with standing costing half the creature's Speed/movement. 2024 explicitly says a creature with Speed 0 cannot right itself.
- **Unconscious:** both versions impose the practical Incapacitated/Prone package, but the 2024 glossary explicitly states those conditions as part of Unconscious.
- **Invisible:** 2024 adds Advantage on Initiative and more explicit target-visibility protection; preserve the normal attack-roll interactions and the exception for observers who can see the invisible creature.
- **Exhaustion:** the two rulesets use fundamentally different mechanical models (details below).

This list is the verified ruleset-sensitive minimum for this audit, not a claim that the two condition glossaries have no other wording differences.

### Exhaustion 2014

Exhaustion is cumulative and has six levels. Each level includes all lower-level effects:

| Level | Effect |
|---:|---|
| 1 | Disadvantage on ability checks |
| 2 | Speed halved |
| 3 | Disadvantage on attack rolls and saving throws |
| 4 | Hit Point maximum halved |
| 5 | Speed becomes 0 |
| 6 | Death |

A Long Rest removes one level only if the creature has ingested food and drink. Being raised from the dead also reduces the level by one. See official 2014 Basic Rules reference below.

### Exhaustion 2024

Exhaustion is a cumulative condition. Each level:

- reduces every D20 Test roll by 2 × the Exhaustion level;
- reduces Speed by 5 feet × the Exhaustion level;
- causes death at level 6.

A completed Long Rest removes one level. There is no 2014-style level 4 maximum-HP-halving step or staged Disadvantage ladder. See official 2024 Basic Rules reference below.

**Architecture consequence:** keep `exhaustionLevel` as a dedicated cumulative state (rather than treating it like an ordinary non-stacking condition). Resolve its effects with an explicit `ruleset`. Do not translate the 2024 numeric D20 penalty into Disadvantage, and do not apply 2014 effects to 2024 characters.

## Proposed RE-006E implementation slices

### E1 — Condition instances and derived resolver

- Keep unique per-instance IDs, source/provenance, target/affected-character identity, application context, and expiration metadata.
- Permit another instance of the same condition when a second effect imposes it; aggregate mechanical effects by condition type while keeping independent lifetimes.
- Return structured fields for outgoing roll modes, incoming attack modifiers, automatic save failures, action/Bonus Action/reaction availability, Concentration, movement constraints, condition immunities/defenses, and context-dependent requirements.
- Represent contextual requirements explicitly (for example, source visibility, attacker distance, identity of grappler/charmer/fear source) instead of converting them into generic reminder strings.
- Do not execute attacks, actions, reactions, turn order, or movement. Provide derived facts for the relevant downstream engine.

### E2 — Ruleset-aware Exhaustion resolver

- Accept explicit ruleset and a validated level 0–6 state.
- Return 2014 Disadvantage/Speed/maximum-HP/death consequences and 2024 numeric D20 penalty/Speed reduction/death consequences as separate policies.
- Keep death as an explicit terminal result compatible with RE-006D3. Do not fabricate three failed Death Saves merely to represent Exhaustion level 6.
- Reuse D4 for Long Rest recovery. Add the 2014 “raised from the dead” decrement only through an explicit recovery event/policy when its lifecycle owner is defined.
- Ensure derived Speed and maximum HP are composed in a documented order with RE-006A/RE-006F and RE-006D1/D4.

### E3 — Condition lifecycle resolver

- Handle explicit lifecycle events supplied by the caller: relevant turn/round boundaries, source/target lifecycle events, successful removal saves, Short Rest, Long Rest, Dawn, and manual removal.
- Remove/expire the specific instance(s) whose own expiration condition is met; never clear unrelated instances of the same type.
- Keep duration semantics structured (turn boundary, elapsed time, rest event, manual/countered) rather than parsing display strings.
- Remain pure: the caller supplies the event/time snapshot. The resolver does not own clocks, timers, event scheduling, or persistence.

## Acceptance tests required before marking RE-006E complete

### E1 condition behavior

- Every condition in both rulesets has explicit derived behavior and ruleset-specific fixtures where wording differs.
- Multiple instances of one condition preserve independent IDs, source, and expiry while producing only one condition effect.
- Applying an additional instance does not intensify a non-stacking condition.
- Removing/expiring one instance leaves other instances intact.
- Advantage and Disadvantage from multiple sources cancel correctly and do not accumulate beyond one roll mode.
- Blinded/Invisible and other incoming-attack effects are tested from the attacker/target perspective.
- Distance-sensitive Prone/Paralyzed/Unconscious interactions test exactly 5 feet versus greater than 5 feet.
- Charmed/Frightened/Grappled tests prove the resolver uses structured source/target context, not display labels.
- Automatic STR/DEX save failures, sight/hearing dependent check failures, Concentration, Bonus Action, speech, movement and immunity results are covered.
- Condition immunity prevents new application when applicable but does not silently delete an already-existing unrelated condition instance.

### E2 Exhaustion behavior

- Validate levels 0–6 and reject malformed/out-of-range inputs.
- Test every 2014 level boundary, cumulative effects, maximum HP reduction, Speed halving/zero, and death at level 6.
- Test every 2024 level boundary, numeric D20 penalty, per-level Speed reduction, and death at level 6.
- Prove 2024 penalties affect D20 Tests as numeric modifiers, not as Disadvantage.
- Prove that 2014 and 2024 effects never leak into one another.
- Verify level 6 reports death without mutating Death Save tallies as if three failed rolls occurred.
- Keep Long Rest recovery tests in D4; verify E2 output composes with D4 results without double-decrementing Exhaustion.

### E3 lifecycle behavior

- Test duration expiry at each supported turn/round boundary.
- Test Short Rest, Long Rest, and Dawn expiration semantics.
- Test manual removal and rule-driven countering.
- Test save-to-end events when the originating effect requires them.
- Test two instances of the same type with different expiry events.
- Test invalid, duplicate, stale, and out-of-order lifecycle events without corrupting the remaining active conditions.

## Explicit boundaries

- RE-006E returns condition/exhaustion state and derived calculation facts.
- RE-006D4 owns Long Rest eligibility, interruptions, and Long Rest resource/Exhaustion recovery.
- RE-006D3 owns death-save state and death/stabilization resolution. Exhaustion level 6 is a death source, not a Death Save roll.
- RE-006F owns general movement modes and final effective movement calculations; E1 supplies condition-specific movement constraints.
- RE-008 owns actions, turns, triggers, reactions, and execution of target-facing effects.
- RE-009 owns persistence migration and UI/Owlbear integration.
- Do not modify `src/App.tsx` or the legacy combat runtime as part of RE-006E clean-room implementation.

## Authoritative rules references

- [2014 D&D Basic Rules — Appendix A: Conditions and Exhaustion](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/appendix-a-conditions)
- [2024 D&D Beyond Basic Rules — Rules Glossary](https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary)
- [2024 D&D Beyond Basic Rules — Playing the Game / Conditions](https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game)

## Audit conclusion

The condition model itself is not absent. The legacy app has per-instance records, persistence normalization, a visible condition panel, and some mechanical integration. The central defect is the narrow aggregate resolver and the mismatch between per-instance duration semantics and duplicate-prevention/application behavior. Exhaustion is implemented as a 2014-only ladder in the legacy sheet; the clean-room D4 Long Rest engine already handles the rest-based recovery difference. 

**Audit status: complete for the inspected legacy sheet path. RE-006E1, RE-006E2, and RE-006E3 are implemented and CI verified on stacked PRs #14, #15, and #16; review/merge remains pending.**
