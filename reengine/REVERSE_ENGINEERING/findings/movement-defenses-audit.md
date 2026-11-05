# RE-006F0 Audit — Movement & Derived Defenses

> **Audit date:** 2026-11-04 (Asia/Jakarta)  
> **Legacy source:** `src/App.tsx` and `src/combat-rules.ts` on `feat/re-006e3-condition-lifecycle`  
> **Clean-room source:** RE-006E domain and engines on the same branch  
> **Status:** bounded source audit complete; F0–F3 are merged into `main` via PR #25. Exact-head workflow 41969905962 passed frozen-lockfile install, typecheck, and 338 tests (0 failures). Remaining notes below are consumer/integration boundaries, not unimplemented F1–F3 work.

## Executive summary

The legacy sheet has a single numeric character Speed and a separate feature-grant display for movement modes. Its current sheet Speed calculation combines the character's base `s.speed`, a generic active-effect movement bonus, and the legacy condition/Exhaustion summary. Additional movement grants stored as feature `movement.mode` / `movement.distance` are presented in the UI but are not composed into that displayed Speed calculation.

The clean-room engine now has dedicated movement profiles and a pure resolver. F1 defines typed walking, climbing, swimming, flying, and burrowing profiles; F2 composes those profiles with caller-ordered modifiers and the existing E1/E2 derived results; F3 aggregates defense facts while preserving source provenance. The resolver's order is an explicit extension contract supplied by the caller, **not** a universal 5e stacking policy. Actual feature/spell/item consumers must define and test each relevant 2014/2024 modifier family before assigning orders.

The legacy app's structured defense path remains a reference only. F3 now provides a separate pure aggregation contract for grants and selected E1 condition-derived defenses. `diseaseImmunity` remains a separate E1 boolean and is intentionally not projected into F3; consumers must continue to read it from E1. Application/UI integration remains RE-009.

## Scope and evidence inspected

This is a targeted audit, not a full repository or full legacy-bundle audit. Inspected:

- `src/combat-rules.ts`: `ConditionSummary`, condition-to-Speed consequences, Exhaustion Speed ladder, `effectiveSpeed()`, `StructuredDefense`, and `mergeDefenses()`.
- `src/App.tsx`: `Sheet.speed`, `FeatureEffects.movement`, movement feature editor/display, `currentSpeed` derivation, active movement bonus calculation, and structured defense aggregation.
- `reengine/src/domain/conditions.ts` and `reengine/src/engines/condition-engine.ts`: condition-derived movement constraints and condition-derived defenses.
- `reengine/src/domain/exhaustion.ts` and `reengine/src/engines/exhaustion-engine.ts`: 2014/2024 Exhaustion Speed output.
- Reengine tree and `REENGINE_INDEX.md` at the time of F0 audit: confirmed there was not yet a dedicated movement domain/engine module or a defense aggregation engine. F1–F3 subsequently added those contracts and engines.

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

The E1 condition result also exposes `damageResistances`, `damageImmunities`, and `conditionImmunities`. F3 consumes these outputs rather than duplicating condition rules. `diseaseImmunity` is a separate boolean in the E1 result and is not part of the current F3 projection; do not lose it when adapting condition effects for downstream consumers. The E1 resolver does not spend movement, perform a stand action, validate a path, or execute turn order.

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

Compose base profiles with typed modifiers and E1/E2 outputs. The implemented resolver applies caller-supplied modifiers in explicit order, then E2 Exhaustion output, then E1 hard Speed-zero constraints. This is a deterministic extension contract only; define and test ruleset-specific stacking before any content consumer maps actual feature/spell/item modifiers to those orders. The result exposes effective Speed per mode plus movement constraints/cost metadata; it does not execute movement or spend a turn.

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

## Follow-ups before content consumers and integration

1. Which individual legacy movement grants should become normalized base profiles versus temporary modifiers? Resolve this per canonical record; do not infer a universal policy from the editor's display shape.
2. Which actual modifier families stack, replace, or apply in sequence under each ruleset? Verify official 2014/2024 rule wording and add focused acceptance tests before a content consumer assigns `order` values. The movement engine's caller-supplied order is not itself a 5e stacking rule.
3. F applies the existing E2 `multiplier` / `reductionFeet` result to each supplied movement mode. Keep E2 as the sole policy owner and never feed an already-modified Speed back into E2.
4. Keep equipment/armor AC contributions with the AC engine and damage conflict resolution with the downstream damage resolver; F3 only preserves normalized source facts and individual AC-bonus records.
5. F3 currently projects E1 damage resistance, damage immunity, and condition immunity. Read E1's separate `diseaseImmunity` boolean independently unless a later reviewed contract explicitly adds it to the defense projection.
6. Movement profile/modifier inputs retain their source records, while the current resolution result exposes applied/blocked modifier IDs rather than a full contribution ledger. Consumers that need diagnostics must retain the normalized inputs; add per-mode contribution output only when a concrete consumer requires it.

## Explicit non-goals

- No mount, familiar, summoned creature, or vehicle entity model; those remain RE-010.
- No Owlbear token movement, pathfinding, movement consumption, turn/action execution, or reactions; those belong to RE-008 and later integration.
- No UI/persistence wiring or direct modification of legacy `src/App.tsx`; integration belongs to RE-009.
- No claim that this bounded audit exhausts every class, feat, spell, magic item, or Homebrew movement/defense rule.

## Audit conclusion

The inspected legacy path has a usable single-Speed summary and visible movement grants, but no normalized multi-mode movement model or general composable Speed resolver. RE-006F1–F3 now provide the clean-room movement profiles, deterministic composition, and derived-defense aggregation needed by future consumers. The engine reuses E1/E2 outputs rather than reimplementing them. Before a consumer assigns modifier order, validate the relevant 2014/2024 stacking rules per modifier family. F3 intentionally leaves disease immunity as a separate E1 result, AC arithmetic with the AC engine, and damage conflicts with the downstream damage resolver.

## F1–F3 implementation checkpoint

The first implementation was developed on the original branch `feat/re-006f-movement-defenses` and reviewed on PR #18. Its focused COMMENT review found no merge-blocking correctness defect and documented the consumer boundaries above. The implementation was then transferred without source/test changes to clean branch `feat/re-006f-movement-defenses-mainline`, stacked on the clean F0 audit PR #23.

- **F1:** typed walking, climbing, swimming, flying, and burrowing profiles. An absent mode remains distinct from an explicit zero-Speed profile. Duplicate mode profiles are rejected so the builder/content layer must normalize grants and preserve their sources.
- **F2:** pure per-mode movement resolver with deterministic caller-supplied modifier order. It consumes the E2 Exhaustion speed result for each mode and applies E1 Speed-zero / cannot-increase constraints without duplicating E1/E2 policy. Prone, Frightened, and Grappled metadata is preserved, not executed.
- **F3:** pure defense aggregation for resistance, vulnerability, immunity, condition immunity, and individual AC-bonus contributions. Duplicate labels are coalesced case-insensitively while unique source provenance is retained. Resistance/immunity conflicts and AC arithmetic remain downstream responsibilities.
- Added 14 regression test cases across movement and defense engine tests.
- Original implementation CI: workflow [41806337613](https://github.com/Brozantium/5e-sheet-demo/actions/runs/41806337613) passed on the first code head (337 tests, 0 failures).
- Clean replacement CI: earlier workflow [41955241176](https://github.com/Brozantium/5e-sheet-demo/actions/runs/41955241176) passed 337 tests. After E1's shared condition-time contract was completed and the stacked history was reconciled, workflow [41957137088](https://github.com/Brozantium/5e-sheet-demo/actions/runs/41957137088) passed frozen-lockfile install, `pnpm typecheck:reengine`, and `pnpm test:reengine`: 338 tests passed, 0 failures.

**F1–F3 status: implemented and CI verified on the reconciled clean PR #24 stack; latest recorded code workflow passed 338 tests, 0 failures. Review/merge remains pending.**
