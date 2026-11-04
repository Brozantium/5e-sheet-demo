# RE-006F0 Audit — Movement & Derived Defenses

> **Audit date:** 2026-11-04 (Asia/Jakarta)  
> **Legacy source:** `src/App.tsx` and `src/combat-rules.ts` on `feat/re-006e3-condition-lifecycle`  
> **Clean-room source:** RE-006E domain and engines on the same branch  
> **Status:** bounded source audit complete; F1 contract and rule-policy decisions remain to be finalized.

## Executive summary

The legacy sheet has a single numeric character Speed and a separate feature-grant display for movement modes. Its current sheet Speed calculation combines the character's base `s.speed`, a generic active-effect movement bonus, and the legacy condition/Exhaustion summary. Additional movement grants stored as feature `movement.mode` / `movement.distance` are presented in the UI but are not composed into that displayed Speed calculation.

The clean-room engine now has richer movement inputs from RE-006E: condition-specific movement constraints and a ruleset-aware Exhaustion speed effect. However, no dedicated movement domain contract or movement resolver exists yet. F must compose those results without reimplementing E1/E2 rules.

The legacy app also has a structured defense aggregation path for feature defenses, temporary effects, and a Petrified special case. E1 now returns structured condition-derived damage defenses and immunities, but the legacy aggregation and the clean-room resolver are not yet connected. F should define a pure aggregation contract and keep application/UI integration for RE-009.

## Scope and evidence inspected

This is a targeted audit, not a full repository or full legacy-bundle audit. Inspected:

- `src/combat-rules.ts`: `ConditionSummary`, condition-to-Speed consequences, Exhaustion Speed ladder, `effectiveSpeed()`, `StructuredDefense`, and `mergeDefenses()`.
- `src/App.tsx`: `Sheet.speed`, `FeatureEffects.movement`, movement feature editor/display, `currentSpeed` derivation, active movement bonus calculation, and structured defense aggregation.
- `reengine/src/domain/conditions.ts` and `reengine/src/engines/condition-engine.ts`: condition-derived movement constraints and condition-derived defenses.
- `reengine/src/domain/exhaustion.ts` and `reengine/src/engines/exhaustion-engine.ts`: 2014/2024 Exhaustion Speed output.
- Reengine tree and `REENGINE_INDEX.md`: confirmed there is not yet a dedicated movement domain/engine module or a defense aggregation engine.

## Findings in the legacy sheet

### 1. Character Speed is a single scalar in the active sheet model

- `Sheet.speed` is a single number, initialized to 30 feet.
- The main displayed Speed is derived from `s.speed + activeMovementBonus`, then passed to `effectiveSpeed()` with the legacy `ConditionSummary`.
- The setter for the displayed Speed writes back to `s.speed` after subtracting the active movement bonus.
- The legacy `effectiveSpeed()` only handles three states: normal, half, or zero. It does not resolve multiple movement modes or individual movement-cost rules.

### 2. Movement grants use a separate, weakly typed feature shape

- `FeatureEffects.movement` is `{ mode: string; distance: number; senses: string }`.
- The editor offers labels such as Walking, Climbing, Flying, Swimming, Burrowing, and Custom.
- The sheet displays granted movement entries separately under “Granted movement”.
- The shown `currentSpeed` calculation does not fold those `movementFeatures` records into per-mode effective speeds. The feature movement records therefore behave as displayed grants in this inspected path, not a normalized set of movement profiles.
- One built-in race path explicitly adjusts base `s.speed` for Wood Elf. Other movement trait descriptions may be display-only unless represented by a separate active mechanical effect. Trace specific feature grants during F1 before assigning them a universal policy.

### 3. Legacy condition and Exhaustion ordering is implicit

- Grappled, Paralyzed, Petrified, Restrained, Stunned, and Unconscious set the legacy condition Speed summary to zero.
- 2014 Exhaustion level 2 halves Speed only when the summary is still normal; level 5 sets Speed to zero.
- The legacy summary collapses all of this into one `normal | half | zero` state, so additive bonuses, per-mode speeds, and movement costs are not represented as separate stages.
- The legacy code does not document a general ordering/stacking policy for multiple bonuses, percentage changes, and movement impediments.

### 4. Legacy structured defenses have a separate aggregation path

- `StructuredDefense` stores resistances, vulnerabilities, immunities, condition immunities, and an AC bonus.
- `mergeDefenses()` unions the list-like defenses and adds non-negative AC bonuses.
- The sheet aggregates permanent feature defenses, temporary active-effect defenses, and a special Petrified contribution.
- This aggregation is legacy UI/runtime code. It is not a clean-room defense contract and is not currently composed with the new E1 condition-derived defense output.

## Existing clean-room contracts to reuse

### E1 — condition movement and defense outputs

`ConditionMovementRules` currently exposes:

- `speedIsZero` and `speedCannotIncrease`;
- `crawlAllowed`;
- `standUpMovementCost: "half-speed" | null` and `cannotStandWhenSpeedIsZero`;
- `cannotWillinglyApproachCreatureIds` for source-specific Frightened restrictions;
- `grappleDragRules` for 2024 Grappled movement, including source creature ID and target-size exemptions.

The E1 condition result also exposes `damageResistances`, `damageImmunities`, and `conditionImmunities`. F should consume these outputs rather than duplicate condition rules. The E1 resolver does not spend movement, perform a stand action, validate a path, or execute turn order.

### E2 — Exhaustion Speed output

- 2014 returns a Speed multiplier of 0.5 at level 2–4 and zero at level 5+.
- 2024 returns a flat Speed reduction of 5 feet per Exhaustion level, floored at zero when an optional `baseSpeed` is supplied.
- The E2 input currently accepts one optional `baseSpeed`, not a map of movement modes. F must define how to apply the existing policy consistently to each supported movement mode without duplicating or mutating E2 rules.
- D4 remains the sole owner of Long Rest Exhaustion recovery.

## Proposed RE-006F boundaries and slices

### F1 — Movement model and base profiles

Define explicit movement-mode IDs and normalized per-creature/character movement profiles. Keep a missing mode distinct from a mode with zero Speed. Preserve source/provenance for base grants and distinguish base profiles from temporary modifiers.

The initial mode catalogue should be evidence-based and extensible: walking, climbing, swimming, flying, and burrowing. A free-form display label must not be the canonical mechanical identifier.

### F2 — Effective movement resolver

Compose base profiles with typed modifiers and E1/E2 outputs. Define and test precedence before implementation. The result should expose effective Speed per mode plus movement constraints/cost metadata; it should not execute movement or spend a turn.

Do not conflate:
- Speed changes (flat or multiplicative);
- hard movement constraints (Speed zero / cannot increase);
- movement costs (standing from Prone, difficult terrain, climbing/swimming without an appropriate speed, Grappled drag);
- target/context restrictions (Frightened: cannot willingly approach a particular source).

Do not assume all bonuses stack or invent a universal order for modifiers. Verify relevant 2014/2024 rule text and define explicit stacking keys/policies in acceptance tests before locking F2 behavior.

### F3 — Derived defense aggregation

Define a pure normalized defense input/output that can combine permanent feature grants, temporary effects, equipment/armor-derived contributions where applicable, and E1 condition-derived defenses. Preserve provenance and make duplicate/overlap handling explicit. Do not wire the resolver into `src/App.tsx` in RE-006.

## Acceptance-test checklist for F1–F3

### Movement profiles
- Walking-only character with a normal base Speed.
- Additional climbing, swimming, flying, and burrowing profiles.
- Missing mode versus explicitly zero Speed.
- Multiple independent sources granting the same mode.
- Ruleset/source metadata and provenance survive normalization.
- Legacy free-form labels are not silently interpreted as canonical modes.

### Movement composition
- 2014 Exhaustion halving and zero-Speed levels for every applicable mode.
- 2024 Exhaustion flat reduction per level for every applicable mode, with a zero floor.
- E1 Speed-zero / cannot-increase constraints override positive bonuses.
- Prone crawling, stand-up half-Speed cost, and inability to stand at Speed zero.
- Frightened approach restriction remains bound to the correct source creature.
- 2024 Grappled drag cost and both target-size exemptions.
- Flat bonuses, multipliers, reductions, and multiple-source stacking follow an explicitly documented policy.
- Difficult terrain and other movement costs consume more movement; they do not silently rewrite the creature's base Speed.
- A zero or invalid result never becomes a negative effective Speed.

### Derived defenses
- Feature, temporary, equipment-derived, and condition-derived sources combine without losing provenance.
- Resistance, vulnerability, immunity, and condition immunity overlap/duplicates follow explicit rules.
- AC bonuses retain the established AC engine as their calculation owner; avoid double-counting AC.
- Condition-derived Petrified defenses are not applied twice when E1 output is present.
- The defense resolver remains pure and independent from roll/damage execution.

## Open questions before F1/F2 implementation

1. Which legacy movement grants should become normalized base profiles versus temporary modifiers? Inspect concrete traits/content before migrating individual grants.
2. Which modifiers stack, replace, or apply in sequence under each ruleset? Verify official rule wording for each modifier family; do not infer from display descriptions.
3. Should E2 expose a reusable per-mode Speed effect helper, or should F apply its typed `multiplier` / `reductionFeet` result to every mode? Preserve a single policy owner and avoid passing an already-modified Speed back through E2.
4. Which equipment or condition sources contribute to derived defenses, and which values remain owned by the AC/damage engines?
5. How should defense provenance and duplicate grants be represented in the clean-room output?

## Explicit non-goals

- No mount, familiar, summoned creature, or vehicle entity model; those remain RE-010.
- No Owlbear token movement, pathfinding, movement consumption, turn/action execution, or reactions; those belong to RE-008 and later integration.
- No UI/persistence wiring or direct modification of legacy `src/App.tsx`; integration belongs to RE-009.
- No claim that this bounded audit exhausts every class, feat, spell, magic item, or Homebrew movement/defense rule.

## Audit conclusion

The legacy implementation has a usable single-Speed summary and visible movement grants, but it does not provide a normalized multi-mode movement model or a general composable Speed resolver. RE-006E supplies the structured condition and Exhaustion outputs needed for a clean-room movement layer. The next correct step is F1's typed movement profiles, followed by an evidence-based modifier/precedence contract for F2 and a separate defense aggregation contract for F3.

## F1–F3 implementation checkpoint

Implemented on `feat/re-006f-movement-defenses`:

- **F1:** typed walking, climbing, swimming, flying, and burrowing profiles. An absent mode remains distinct from an explicit zero-Speed profile. Duplicate mode profiles are rejected so the builder/content layer must normalize grants and preserve their sources.
- **F2:** pure per-mode movement resolver with deterministic caller-supplied modifier order. It consumes the E2 Exhaustion speed result for each mode and applies E1 Speed-zero / cannot-increase constraints without duplicating E1/E2 policy. Prone, Frightened, and Grappled metadata is preserved, not executed.
- **F3:** pure defense aggregation for resistance, vulnerability, immunity, condition immunity, and individual AC-bonus contributions. Duplicate labels are coalesced case-insensitively while unique source provenance is retained. Resistance/immunity conflicts and AC arithmetic remain downstream responsibilities.
- Added 14 regression test cases across movement and defense engine tests.
- GitHub Actions run [41806337613](https://github.com/Brozantium/5e-sheet-demo/actions/runs/41806337613) passed frozen-lockfile install, `pnpm typecheck:reengine`, and `pnpm test:reengine`: 337 tests passed, 0 failures. The run verified PR #18 head `acbb26b9245905a9f758cc4d923f9c949600e024`.

**F1–F3 status: implemented and CI verified on PR #18 head `acbb26b9245905a9f758cc4d923f9c949600e024`; 337 tests passed, 0 failures. Review/merge remains pending.**
