# Session Handoff — 5e Sheet Reengine

> **Purpose:** durable continuation checkpoint for work across chat/session limits. This is a project handoff, not a raw chat transcript.
>
> **Last reviewed:** 2026-11-04 (Asia/Jakarta)  
> **Repository:** [Brozantium/5e-sheet-demo](https://github.com/Brozantium/5e-sheet-demo)  
> **Working branch at checkpoint:** `feat/re-006d4-long-rest-recovery`  
> **Current roadmap:** [reengine/ROADMAP.md](./ROADMAP.md)

## Start here when a chat is full

1. Read this file first.
2. Read [ROADMAP.md](./ROADMAP.md) for the current slice order and implementation status.
3. Read [ARCHITECTURE.md](./ARCHITECTURE.md) before changing boundaries or data flow.
4. Check the actual GitHub branch, PR stack, latest commits, review state, and CI. This document is a checkpoint, not a substitute for live repository state.
5. Inspect the relevant source and tests before accepting any historical audit statement as current truth.
6. Continue from **Current checkpoint** below. Do not restart earlier completed work unless a regression or new evidence requires it.

### Copy/paste prompt for a new chat

> Continue the 5e Sheet Reengine project in repository `Brozantium/5e-sheet-demo`. First read `reengine/SESSION_HANDOFF.md`, `reengine/ROADMAP.md`, and `reengine/ARCHITECTURE.md`. Verify the live GitHub branch/PR/CI state and inspect the relevant source/tests before changing anything. Preserve all recorded architecture boundaries and ruleset distinctions. The current checkpoint is RE-006E: complete the evidence-based Conditions & Exhaustion audit, document findings, then implement in small tested slices. Do not wire the clean-room engine into `src/App.tsx` or legacy runtime unless the roadmap explicitly reaches RE-009 and that integration is approved.

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
| RE-006D4 | Ruleset-aware Long Rest and recovery | Latest documented implementation checkpoint; see PR #12 and its verification record below. |
| RE-006E | Conditions & Exhaustion | **Next work. Audit only so far; no RE-006E implementation is recorded at this checkpoint.** |
| RE-006F | Movement & derived defenses | Planned after RE-006E. |
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

These findings are scoped to this file. **Before finalizing RE-006E design**, inspect all call sites, persistence/serialization, condition application/removal UI, rest handlers, and any other condition/exhaustion code. Search the repository rather than inferring the entire legacy application from one helper.

### RE-006E proposed implementation slices

These are the working plan, subject to the evidence-based audit and explicit acceptance tests:

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

At checkpoint review (2026-11-04), branch `feat/re-006d4-long-rest-recovery` was confirmed to exist and PR #12's review list returned no reviews. The PR search response did not reliably expose the current state field, so do not infer merged/open status from this note. PR #12's description records successful frozen-lockfile install, `pnpm typecheck:reengine`, and `pnpm test:reengine` with 257 tests, plus [workflow run 41779301323](https://github.com/Brozantium/5e-sheet-demo/actions/runs/41779301323). Recheck the exact head commit and CI on resume.

## Current checkpoint and next action

**Checkpoint:** latest documented rules-engine slice is RE-006D4. RE-006E has not been implemented. The immediate next task is to complete the Conditions & Exhaustion evidence audit, not to start RE-007/RE-008 and not to wire UI.

**Recommended next sequence:**

1. Re-check GitHub branch/PR status and current CI.
2. Search the whole repository for `ActiveCondition`, `conditionSummary`, `CONDITION_TYPES`, `exhaustionLevel`, and all condition application/removal/expiry handlers.
3. Trace state persistence and UI flows: creation, editing, removal, save prompts, short/long rest and dawn recovery.
4. Compare 2014/2024 rules against authoritative rule references and record each rule's source/ruleset.
5. Write a dedicated RE-006E findings/audit document with legacy evidence, mismatches, unknowns, and acceptance tests.
6. Implement E1, E2, E3 as small pure-engine slices with tests, updating this handoff and the roadmap after each completed slice.

## How to maintain this safeguard

Update this file whenever a meaningful slice or architecture decision is completed. At minimum record:

- date, branch, PR, and commit;
- what changed and what deliberately did not change;
- test/typecheck/CI result and the exact run or commit;
- decisions made, alternatives rejected, and why;
- verified legacy findings and any confidence/coverage limits;
- current next action and blockers.

Do not paste a raw conversation transcript. Keep durable decisions here and detailed forensic evidence in focused files under `REVERSE_ENGINEERING/findings/`. If a previous finding is corrected, explicitly mark the correction as this file does for the RE-006E condition model.
