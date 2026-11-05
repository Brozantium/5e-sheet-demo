# Session Handoff — 5e Sheet Reengine

> **Purpose:** durable continuation checkpoint for work across chat/session limits. This is a project handoff, not a raw chat transcript.
>
> **Last reviewed:** 2026-11-05 (Asia/Jakarta)  
> **Repository:** [Brozantium/5e-sheet-demo](https://github.com/Brozantium/5e-sheet-demo)  
> **Working branch at checkpoint:** `docs/re-006f-movement-audit-mainline`  
> **Repository index:** [reengine/REENGINE_INDEX.md](./REENGINE_INDEX.md)  
> **Current roadmap:** [reengine/ROADMAP.md](./ROADMAP.md)

## Start here when a chat is full

1. Read this file first for durable decisions and the latest checkpoint.
2. Read [REENGINE_INDEX.md](./REENGINE_INDEX.md) for the repository map and incremental-reading protocol.
3. Read [ROADMAP.md](./ROADMAP.md) to confirm slice order, status, and completion gates.
4. Read [ARCHITECTURE.md](./ARCHITECTURE.md) when a task changes boundaries, data flow, or runtime ownership.
5. Verify the live branch, PR stack, review state, latest commit SHAs, and CI; this handoff is not a substitute for live GitHub state.
6. Compare the last verified commit with the current branch/PR head. Inspect changed files first, then only their direct imports/callers/contracts/tests that are relevant.
7. Avoid blanket repository reads. Do not reread unchanged files unless the task or changed dependencies require them.
8. Continue from **Current checkpoint** below.

### Copy/paste prompt for a new chat

> Continue the 5e Sheet Reengine project in repository `Brozantium/5e-sheet-demo`. First read `reengine/SESSION_HANDOFF.md`, `reengine/REENGINE_INDEX.md`, and `reengine/ROADMAP.md`. Verify the live GitHub branch, PR state, exact head SHAs, reviews, and CI. Follow the index's incremental-reading protocol and preserve all architecture/ruleset boundaries. RE-006D4 and E1–E3 are merged into `main`; F0–F3 are merged via PR #25 and exact-head CI passed 338 tests. Final mainline-based workflow 41970251639 on checkpoint PR #26 passed frozen-lockfile install, typecheck, and 338 tests (0 failures). RE-006 is administratively complete; RE-007 may begin. Do not wire the clean-room engine into `src/App.tsx` or legacy runtime before the approved RE-009 integration phase.

## Project purpose

Build a clean-room rules/content engine for the Owlbear 5e character sheet, supporting D&D 5e 2014, 2024, and Homebrew without making the legacy application the new runtime. The existing application and its assets/data are references for reverse engineering only.

## Non-negotiable architecture and working rules

- The new runtime must not import legacy JavaScript from `/assets` or read `/data` / `/data/2024` at runtime.
- Reverse-engineering observations belong in documentation, schemas, tests, and newly authored canonical content. Do not copy minified legacy bundle code into the new engine.
- Keep the rules engine pure and independent of UI, Owlbear APIs, browser storage, and legacy runtime.
- Separate immutable content definitions, feature mechanics, progression, mutable character state, derived calculations, and UI presentation.
- Preserve explicit ruleset/source metadata. Never infer 2014 vs 2024 from a name, label, or description.
- Descriptions are display text, never the sole source of mechanical behavior.
- Keep editor normalization/parity separate from actual combat-rule calculations.
- Preserve 2014/2024 differences as explicit policy. Prefer one ruleset-aware engine over duplicated edition-specific engines.
- Do not mark work complete based only on code existing. Record tests, typecheck, CI, review, merge, and integration separately.
- Do not integrate into `src/App.tsx` before the planned migration/integration phase (RE-009).

### Status vocabulary

Use these labels precisely in future notes:

- **Audited:** legacy behavior inspected and findings documented with evidence.
- **Implemented:** new code and regression tests exist; the required local checks pass.
- **CI verified:** the relevant CI workflow passed for the exact commit/PR.
- **Reviewed:** review completed; record the outcome and any follow-up.
- **Merged:** GitHub confirms the PR is merged.
- **Integration verified:** behavior is connected to the app/Owlbear path and verified end-to-end.

A roadmap line saying “implementation complete” does not by itself mean “merged” or “integration verified”.

## Cross-chat Homebrew/content decisions

These decisions were established in the Homebrew design discussion and should be reconciled with the current repo before implementation changes:

- Use one Content Library and a universal content model rather than separate incompatible libraries for each edition.
- Preserve ruleset identity explicitly, including 2014, 2024, shared, and custom/Homebrew content.
- Feature mechanics must be represented as structured grants/mechanics. A prose description is not a mechanical grant.
- Content-pack import/export should preserve structured content and source/ruleset metadata.
- Keep content definitions separate from the character's selected/applied content snapshot. The prior design discussion used `attachedContent` for character-attached content and `dnd5e-content-library` as a local library key; verify the current implementation before relying on those exact storage names.
- Legacy 2014 and 2024 JSON may inform curation/adapters, but should not become runtime dependencies. Spell/item conversion is generally simpler than class/subclass progression conversion; complex nested features require explicit adapters and validation.

## Reverse-engineering and implementation history

This is a compact history of the decisions and slices already recorded in the repo/previous project sessions. Use the linked audit documents and tests as evidence; do not treat this summary as a replacement for them.

| Phase | Scope / result | Continuation note |
|---|---|---|
| RE-001 | Read-only audit baseline | Legacy app is the behavior reference; new runtime is separate. |
| RE-002 | Isolated typecheck, Node test harness, and CI workflow | Reengine checks run independently from the existing app. |
| RE-003 | Weapon property editor parity / normalization | Exhaustive parity coverage recorded for 2,048 kind/property combinations. This is editor behavior, not combat mechanics. Armor/equipment calculations are separate. |
| RE-004 | Core calculation corrections F1–F8 | Completed with regression tests, per roadmap. |
| RE-005 | Canonical schema and content validation | Schemas/contracts/registry validation for currently defined canonical records; no bulk legacy import and no runtime dependency on legacy data. |
| RE-006A | Core character calculations | Ability modifiers, proficiency, skills, saves, initiative, passive Perception. See [character-calculation-audit.md](./REVERSE_ENGINEERING/findings/character-calculation-audit.md). |
| RE-006B1 | Armor Class and protective equipment | Pure AC calculation and equipment profile policy. See [armor-class-audit.md](./REVERSE_ENGINEERING/findings/armor-class-audit.md). |
| RE-006B2–B3 | Weapon attacks, damage, hand occupancy, weapon property/range/attack-cycle rules | Heavy and Two-Handed remain distinct; Finesse ability selection is explicit; Reach and Thrown range are modeled explicitly; Ammunition/Loading/Light/Nick have distinct contracts. |
| RE-006B4 | Weapon Mastery assignment/eligibility | Selection and eligibility only. Mastery effect execution remains RE-008. |
| RE-006C1–C2 | Armor training consequences and grant resolution | Resolve grants separately from the AC calculation; return derived consequences for downstream engines. |
| RE-006D1 | Maximum HP and HP state | Damage/healing/Temporary HP operations. |
| RE-006D2 | Hit Dice pools and Short Rest | Per-class multiclass pools and ruleset-aware healing. |
| RE-006D3 | Death Saves, damage at 0 HP, stabilization | Pure state resolution; turn/timer/action orchestration remains caller-owned. |
| RE-006D4 | Ruleset-aware Long Rest and recovery | Completed before RE-006E; see PR #12 and its verification record below. |
| RE-006E | Conditions & Exhaustion | Legacy audit complete. E1–E3 are merged into `main` via PRs #20–#22; exact-head CI passed 289 / 303 / 324 tests. See [conditions-exhaustion-audit.md](./REVERSE_ENGINEERING/findings/conditions-exhaustion-audit.md). |
| RE-006F | Movement & derived defenses | F0 audit and F1–F3 engines are merged into `main` via PR #25; exact-head CI passed 338 tests (0 failures). See [movement-defenses-audit.md](./REVERSE_ENGINEERING/findings/movement-defenses-audit.md). |
| RE-007 | Spellcasting engine | Planned. |
| RE-008 | Action, trigger, and effect engine | Planned; owns action execution, event triggers, reactions, mastery effects, and condition/action timing. |
| RE-009 | Migration, content, UI, Owlbear integration | Planned integration phase. |
| RE-010 | Creature, companion, mount, familiar, and vehicle layer | Intentionally future scope; does not block RE-006. |

### RE-006E legacy audit — verified evidence at this checkpoint

Source inspected: [`src/combat-rules.ts`](https://github.com/Brozantium/5e-sheet-demo/blob/feat/re-006d4-long-rest-recovery/src/combat-rules.ts) on the working branch (same observed content as commit `5349bbcbebedc85f8e9b146e52dbf8af6ca79827`).

Important correction to an earlier preliminary chat note:

- `ActiveCondition` is already an array-backed per-instance record with `id`, `type`, `source`, `sourceDetails`, `appliedCharacter`, `duration`, `expiration`, `save`, `notes`, and `appliedAt`. Do **not** claim that the legacy data model has lost source/duration information.
- `conditionSummary()` creates a `Set` of condition **types** to calculate aggregate derived state. This means the summary is type-aggregated; it does not mean the original condition instances lack IDs or provenance.
- The summary output currently contains only `attack`, `abilityCheck`, `savingThrow`, `speed`, `canAct`, `canReact`, and textual `reminders`.
- Some rule text is only represented as reminders rather than machine-readable fields in this helper: examples include Frightened's visible-source condition, Prone's incoming-attack distance rule, and the advantage/critical-hit consequences of Paralyzed, Stunned, and Unconscious.
- Petrified's resistance/immunity text is also a reminder in this helper; the output does not expose structured damage-resistance/immunity fields for that condition.
- The helper combines roll modes using advantage/disadvantage cancellation. Verify how other callers consume these modes before designing the new contract.
- The helper embeds the 2014-style Exhaustion ladder: level 1 ability-check Disadvantage; level 2 half Speed; level 3 attack-roll and saving-throw Disadvantage; level 4 half maximum HP; level 5 Speed 0; level 6 marks the character dead via reminders and action/reaction flags. It does not expose a 2024 Exhaustion policy.
- `ActiveCondition.expiration` currently allows `manual | short | long | dawn`, and each instance has `duration` / `appliedAt`; this file does not itself implement a lifecycle/expiry resolver.

The audit has now followed the inspected path through `src/App.tsx`: character state, saved-state normalization, condition UI, feature-action condition application, roll-mode consumers, speed/HP derivation, action/reaction gating, Petrified defense handling, and Short Rest/Long Rest/Dawn expiration filtering. See the dedicated findings document for exact source ranges, condition-by-condition gaps, ruleset differences, and acceptance tests. The findings remain scoped to the inspected current-app path; future newly discovered callers must be added to the audit.

### RE-006E implementation status and remaining slice

- **E1 — Condition Instances & Derived Resolver:** implemented and CI verified on clean [PR #20](https://github.com/Brozantium/5e-sheet-demo/pull/20), latest head `74b91177cb7456c98dc22b7266e6f30a597d0cec`, run 41957036163, 289 tests passed. Corrected roll-mode cancellation and Charmed attack-target restrictions.
- **E2 — Ruleset-aware Exhaustion Resolver:** implemented and CI verified on clean [PR #21](https://github.com/Brozantium/5e-sheet-demo/pull/21), latest head `49869b7bc58c7018b522380c752ce88407317ad0`, run 41957070754, 303 tests passed. 2014 and 2024 policies remain separate; D4 owns Long Rest recovery; level 6 is an explicit death outcome and does not create Death Save failures.
- **E3 — Condition Lifecycle:** implemented and CI verified on clean [PR #22](https://github.com/Brozantium/5e-sheet-demo/pull/22), latest head `75fd2a9515917721c5a2785331d42b7538272d54`, run 41957082301, 324 tests passed.

The E3 lifecycle contracts and acceptance criteria implemented in this slice are:

1. **E1 — Condition model and resolver:** structured derived effects for outgoing/incoming attacks, ability checks, saves, movement restrictions, action/reaction availability, and other required condition consequences. Preserve condition instances/provenance; define which effects are aggregate and which depend on source/target/context.
2. **E2 — Exhaustion engine:** separate 2014 and 2024 resolvers, levels 0–6, with explicit D20 Test, Speed, maximum HP, and death consequences as applicable. Coordinate Long Rest recovery with D4 without duplicating rest lifecycle.
3. **E3 — Condition lifecycle:** duration/time/turn expiry, event-based expiry, manual removal, rest-based removal, and removal of one specific instance without clearing unrelated instances.

**Boundary:** RE-006E provides state and derived calculation results. It does not execute turns, actions, triggers, or reactions; those belong to RE-008.

### Prior decisions to preserve

- **Weapon properties:** Heavy must not automatically imply Two-Handed. If a weapon has both Light and Heavy, the selected profile/validator must prevent incompatible combinations as specified by the canonical rule contract; do not reintroduce editor coercion as combat logic.
- **Finesse:** ability selection is an explicit attack input/policy, not inferred solely from a display string.
- **Thrown:** model thrown range separately from ordinary ranged range where the canonical profile requires it.
- **Weapon Mastery:** RE-006B4 models assignment/eligibility; RE-008 executes effects such as Cleave, Graze, Nick, Push, Sap, Slow, Topple, and Vex.
- **Armor:** AC calculation, training grants, and training consequences remain separate contracts.
- **Rest/recovery:** pure resolvers consume caller-supplied snapshots/events; clocks, turn orchestration, and persistence remain caller-owned until their designated integration phases.
- **Mounts/vehicles:** defer to RE-010. A vehicle uses its own stat block and speed; vehicle speed must never be added to or overwrite a character's native walking Speed. A mounted creature may provide the rider's effective tactical movement while mounted, but preserve native movement for dismounting.
- **Familiar/summoned familiar/companion:** model as a separate creature/companion entity when RE-010 is reached, not as a shortcut inside the character movement engine.

## Pull request / verification trail

The roadmap branch records a stacked implementation sequence. These PR links are useful evidence/history; re-check their live state before merging or claiming completion.

| PR | Slice | Link | Test count recorded in PR description |
|---:|---|---|---:|
| #1 | RE-006B2 weapon attacks/damage/hand occupancy | [PR #1](https://github.com/Brozantium/5e-sheet-demo/pull/1) | 104 |
| #2 | RE-006B3A weapon property model | [PR #2](https://github.com/Brozantium/5e-sheet-demo/pull/2) | 113 |
| #3 | RE-006B3B range/Reach/Thrown/Lance | [PR #3](https://github.com/Brozantium/5e-sheet-demo/pull/3) | 123 |
| #4 | RE-006B3C1 Ammunition/Loading | [PR #4](https://github.com/Brozantium/5e-sheet-demo/pull/4) | 133 |
| #5 | RE-006B3C2 Light/Nick timing | [PR #5](https://github.com/Brozantium/5e-sheet-demo/pull/5) | 149 |
| #6 | RE-006B4 Weapon Mastery selection | [PR #6](https://github.com/Brozantium/5e-sheet-demo/pull/6) | 164 |
| #7 | RE-006C1 armor-training consequences | [PR #7](https://github.com/Brozantium/5e-sheet-demo/pull/7) | 177 |
| #8 | RE-006C2 armor/shield training grants | [PR #8](https://github.com/Brozantium/5e-sheet-demo/pull/8) | 184 |
| #9 | RE-006D1 HP calculation/state | [PR #9](https://github.com/Brozantium/5e-sheet-demo/pull/9) | 199 |
| #10 | RE-006D2 Hit Dice/Short Rest | [PR #10](https://github.com/Brozantium/5e-sheet-demo/pull/10) | 212 |
| #11 | RE-006D3 Death Saves/stabilization | [PR #11](https://github.com/Brozantium/5e-sheet-demo/pull/11) | 235 |
| #12 | RE-006D4 Long Rest/recovery | [PR #12](https://github.com/Brozantium/5e-sheet-demo/pull/12) | 257 |

| #13 | RE-006E audit/docs (superseded old branch) | [PR #13](https://github.com/Brozantium/5e-sheet-demo/pull/13) | closed; replaced by #19 |
| #14 | RE-006E1 resolver (superseded old branch) | [PR #14](https://github.com/Brozantium/5e-sheet-demo/pull/14) | closed; replaced by #20 |
| #15 | RE-006E2 Exhaustion (superseded old branch) | [PR #15](https://github.com/Brozantium/5e-sheet-demo/pull/15) | closed; replaced by #21 |
| #16 | RE-006E3 lifecycle (superseded old branch) | [PR #16](https://github.com/Brozantium/5e-sheet-demo/pull/16) | closed; replaced by #22 |
| #17 | RE-006F0 audit (superseded old branch) | [PR #17](https://github.com/Brozantium/5e-sheet-demo/pull/17) | closed; replaced by #23 |
| #18 | RE-006F1–F3 engines (superseded old branch) | [PR #18](https://github.com/Brozantium/5e-sheet-demo/pull/18) | closed; replaced by #24 |
| #19 | RE-006E audit/docs mainline replacement | [PR #19](https://github.com/Brozantium/5e-sheet-demo/pull/19) | documentation only |
| #20 | RE-006E1 condition instances/resolver | [PR #20](https://github.com/Brozantium/5e-sheet-demo/pull/20) | 289; workflow 41957036163 passed |
| #21 | RE-006E2 Exhaustion resolver | [PR #21](https://github.com/Brozantium/5e-sheet-demo/pull/21) | 303; workflow 41957070754 passed |
| #22 | RE-006E3 condition lifecycle | [PR #22](https://github.com/Brozantium/5e-sheet-demo/pull/22) | 324; workflow 41957082301 passed |
| #23 | RE-006F0 movement/defense audit (superseded) | [PR #23](https://github.com/Brozantium/5e-sheet-demo/pull/23) | replaced by #25 |
| #24 | RE-006F1–F3 movement/defense engines (superseded) | [PR #24](https://github.com/Brozantium/5e-sheet-demo/pull/24) | replaced by #25; 338 tests passed on prior branch |
| #25 | RE-006F0–F3 consolidated movement/defense audit and engines | [PR #25](https://github.com/Brozantium/5e-sheet-demo/pull/25) | exact-head CI 41969537457; 338 tests passed |

The live PR statuses and exact-head CI listed above were rechecked on 2026-11-05. The older #13–#18 branches are closed as superseded; clean PRs #19–#24 form the current review/merge stack.

## Current checkpoint and next action

**Checkpoint (2026-11-05):** RE-006A–F3 implementation is merged into `main`. E1–E3 exact-head CI passed 289 / 303 / 324 tests; F0–F3 exact-head workflow 41969905962 passed frozen-lockfile install, typecheck, and 338 tests (0 failures). Final mainline-based workflow 41970251639 on checkpoint PR #26 also passed frozen-lockfile install, typecheck, and the complete 338-test unit suite (0 failures). RE-006 is administratively complete. PRs #19–#22, #25, and #26 are merged; old branches #13–#18 and superseded movement PRs #23–#24 are closed. No legacy `src/App.tsx` or `src/combat-rules.ts` source was changed; there is still no Owlbear/UI integration.

- **PR #12 — RE-006D4:** merged into `main`. [PR #12](https://github.com/Brozantium/5e-sheet-demo/pull/12)
- **PRs #19–#22 — RE-006 audit/docs, conditions, Exhaustion, lifecycle:** merged into `main`. PR #19 workflow 41968985049 passed; PR #20 workflow 41957036163 passed 289 tests; PR #21 workflow 41957070754 passed 303 tests; PR #22 workflow 41957082301 passed 324 tests.
- **PR #25 — RE-006F0–F3:** merged into `main`. Exact-head workflow 41969905962 passed frozen-lockfile install, typecheck, and 338 tests (0 failures). [PR #25](https://github.com/Brozantium/5e-sheet-demo/pull/25)
- **PR #26 — final RE-006 completion checkpoint:** merged into `main`; workflow 41970251639 passed frozen-lockfile install, typecheck, and 338 tests (0 failures). [PR #26](https://github.com/Brozantium/5e-sheet-demo/pull/26)
- **PRs #13–#18, #23–#24:** closed as superseded. Their work is represented by the merged clean PRs #19–#22 and #25.

**Next phase:** RE-006 completion gate is satisfied. RE-007 — Spellcasting Engine — may begin. Keep action execution in RE-008 and UI/Owlbear/persistence integration in RE-009. Do not integrate the clean-room engine into the legacy app before the approved RE-009 phase.

**E3 contract now implemented:**

- Manual remove targets one instance ID regardless of its automatic expiry setting.
- A `short` rest expiry ends on Short Rest or Long Rest; a `long` expiry ends only on a Long Rest; Dawn is explicit.
- Turn, round, elapsed-time, save-to-end, and arbitrary source/target trigger events are structured.
- Event IDs and monotonic sequences prevent duplicate processing; stale/out-of-order events are diagnosed and ignored.
- Missing application clock/counter data is reported; the resolver preserves state rather than guessing.
- The resolver is immutable and caller-driven; it does not own clocks, timers, turn order, persistence, UI, or action execution.

**F1–F3 consumer boundaries to preserve:**

- Movement modifier order is a deterministic caller-defined extension contract, not a universal 2014/2024 D&D stacking policy. Content consumers must establish the relevant stacking policy and tests before assigning order values.
- Movement profiles and modifiers preserve source records. The current resolution result exposes effective Speed and applied/blocked modifier IDs; retain normalized inputs when consumers need full provenance.
- F3 projects E1 damage resistance, damage immunity, and condition immunity. E1 `diseaseImmunity` remains a separate result and must not be discarded by consumers.
- AC bonus arithmetic remains owned by the AC engine; resistance/immunity conflict resolution remains downstream.
- No mount, familiar, summoned creature, or vehicle entity model (RE-010); no turn/action/pathfinding/movement consumption (RE-008); no Owlbear/UI/persistence integration (RE-009).

**Immediate next task:** resolve the required-check inconsistency blocking PR #19: its exact-head `reengine` job is successful after rerun, but GitHub's merge endpoint still reports the required check as cancelled. Do not bypass branch protection. Once #19 can merge, retarget #20 to `main` and continue the #20 → #21 → #22 → #23 → #24 stack one PR at a time, checking each new base/head and exact-head CI. Do not start RE-007 until all RE-006 E/F slices are merged and the final mainline typecheck/unit suite passes.

**Recommended next sequence:**

1. Review and merge PR #19, then #20 → #21 → #22 → #23 → #24 in dependency order.
2. After the stack is merged, run the exact-main reengine typecheck and unit suite.
3. Begin RE-007 only after the RE-006 completion gate is satisfied.
4. Keep movement modifier order caller-defined until concrete consumers require ruleset-specific stacking policies and acceptance tests.
5. Keep disease immunity as E1's separate result unless a reviewed downstream contract adopts it; retain normalized inputs wherever full movement provenance is needed.

## How to maintain this safeguard

Update this file whenever a meaningful slice or architecture decision is completed. At minimum record:

- date, branch, PR, and commit;
- what changed and what deliberately did not change;
- test/typecheck/CI result and the exact run or commit;
- decisions made, alternatives rejected, and why;
- verified legacy findings and any confidence/coverage limits;
- current next action and blockers.

Do not paste a raw conversation transcript. Keep durable decisions here and detailed forensic evidence in focused files under `REVERSE_ENGINEERING/findings/`. If a previous finding is corrected, explicitly mark the correction as this file does for the RE-006E condition model.
