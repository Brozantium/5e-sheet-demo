# Play5e Character Builder — Behavioral Audit

> Status: **Audited (static bundle inspection)**  
> Reference: user-provided Play5e scrape, `play5e.net/assets/Builder-DkUvAWva.js`, with supporting component bundles.  
> Scope: Character Builder wizard flow and visible state behavior. This is a behavioral summary, not a copy of the reference implementation.

## 1. Observed wizard sequence

The Builder component defines the following ordered steps:

1. Edition / ruleset
2. Game modifiers
3. Class
4. Race (2014) or Species (2024)
5. Subclass
6. Ability scores
7. Background
8. Skills / proficiencies
9. Feats & ability-score increases
10. Feature choices
11. Equipment
12. Spells
13. Character details

The rendered sequence is conditional. Subclass, feats, feature choices, and spells are only shown when the selected class/build has a corresponding choice or spellcasting requirement. The race/species label and its rules differ by edition. The Builder does not simply render every step for every character.

## 2. Completion and navigation behavior

The inspected Builder uses a per-step completion predicate and a separate availability predicate.

- Edition is required before the remaining Builder is available.
- Game modifiers are informational/configuration choices and do not block progression by themselves.
- Class requires at least one class entry with a positive level.
- Race/species requires a selection and completion of its dependent trait, feat, and prerequisite choices.
- Subclass is only shown when the selected class progression makes a subclass choice due; every due subclass must be selected.
- Ability scores must satisfy the selected ability-generation method.
- Background requires a selected background plus its dependent choices.
- Skills/proficiencies are complete when all outstanding grants have been assigned.
- Feats and feature choices are conditional; when shown, their pending selections/assignments/resources must be resolved.
- Equipment requires inventory or a selected starting-equipment package.
- Spells are conditional on spellcasting availability and must satisfy the spell-step completion check.
- Character details require a non-empty name different from the default `New character`.

The navigation model allows returning to earlier steps and visiting the next unlocked step. It prevents jumping over the first incomplete required step. The final action is available only when all currently visible steps are complete and no blocking prerequisite issue remains.

## 3. Edition-specific behavior

The edition is selected before the build and becomes fixed after the character is finished. Before finishing, switching edition warns that edition-dependent choices will be cleared. The observed warning names class, race/species, background, feats, proficiencies, spells, and equipment; name, ability scores, and character details are retained.

Terminology and ability-score sources differ:

- 2014 uses **Race** and race-based ability-score increases.
- 2024 uses **Species**; ability-score increases come from the Background.
- Species also exposes creature type in its visible detail summary.

The application therefore needs explicit ruleset metadata. It must not infer edition from a label or content name.

## 4. Ability-score methods

The Builder exposes four methods:

- Standard array: assign 15, 14, 13, 12, 10, and 8 once each.
- Point buy: 27 points, starting at 8, with point costs increasing above 13 and a purchase ceiling of 15.
- Roll: six 4d6 rolls, drop the lowest die, and reroll 1s until they are no longer 1.
- Manual: enter values directly, with an override control for higher values.

The visible score summary distinguishes base scores from derived totals after race/species, background, and feat bonuses. The normal manual starting-score cap is 18; the override raises that cap (the inspected UI allows up to 30).

## 5. Class, background, and feature choices

The Class step includes more than a class name selector. The inspected UI also exposes class-level management, multiclassing when permitted, a character-level cap, level-up method, hit-point-on-level-up settings, class proficiencies, spellcasting ability, starting equipment, subclass timing, and class features/progression.

The Background step supports official backgrounds and a custom-background path. The custom path includes a name, skill choices, a two-part tool/language proficiency allocation, a feature selected from an existing background, and an equipment package.

The Feature choices step aggregates multiple feature mechanic families rather than being one static form. Separate imported modules handle feature uses, mechanic panels, and subclass selection. This matches the reengine separation between content definitions, mechanics, progression, and selected character state.

## 6. Editing a finished character

The reference Builder treats editing a completed character as a draft transaction:

- It clones the finished character into a working draft.
- Draft changes are not written to the active sheet until **Confirm changes**.
- The user can return to the sheet and discard the draft.
- Confirmation is disabled when a change leaves a previously completed required step incomplete, or when new prerequisite problems remain.
- A prerequisite-ignore/waiver control exists, and build changes are recorded in character history.

This is an important behavior to preserve in a future Builder UI. It should be implemented as an explicit transaction rather than mutating the live sheet on each input.

## 7. Reengine implementation boundary

The reference bundle is used only as behavioral evidence. The new runtime must not import this bundle or read the scraped `/data` files directly.

The current reengine plan places:
- spellcasting contracts and resolution in **RE-007**;
- action/trigger/effect execution in **RE-008**;
- canonical content migration, Builder orchestration/UI, Character Sheet UI, persistence, and Owlbear integration in **RE-009**.

The initial implementation slice therefore adds only a pure Builder flow/navigation contract. It does not claim to implement class/race/background content loading, spell selection, character persistence, or the full UI.

## 8. Evidence limits / follow-up audit

This audit is based on the scraped static bundle and visible control logic. It does not prove backend behavior, account synchronization, every data-driven class/subclass edge case, or the completeness of all spell/equipment mechanics. Before full Builder implementation, continue with focused audits of class progression, feature-choice resolution, equipment selection, and spell selection, then map them to canonical content contracts and tests.
