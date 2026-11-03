# Findings: Character Calculation Audit (RE-006A)

## Scope

This audit defines the first calculation slice for the clean-room character engine. The existing application remains the read-only behavior reference; no legacy module is imported into `reengine/`.

## Verified legacy behavior

- Ability modifiers use floor((score - 10) / 2).
- Proficiency bonus uses total character level: 2 at levels 1–4, then increases by 1 every four levels, to 6 at levels 17–20.
- The skill list contains the 18 standard skills and maps each to its governing ability.
- Skill bonuses combine the relevant ability modifier, proficiency contribution, and applicable active ability-check effects.
- Saving throw grants are collected from feature proficiency data.
- Initiative uses the Dexterity modifier and a separate flat modifier in the current sheet.

## Canonical calculation policy in RE-006A

- The calculation engine is a pure function module and has no UI, Owlbear, browser-storage, or legacy-data dependency.
- Multiclass proficiency bonus is based on summed character level, not the level of the highest class.
- Each check has one normalized proficiency rank: none, half, proficient, or expertise. These ranks are alternatives, not independent additive flags.
- Half proficiency rounds down. Expertise doubles the proficiency bonus for the relevant skill check.
- Saving throw proficiency adds the proficiency bonus once; this slice does not model save expertise.
- Initiative adds no proficiency bonus by default. A feature-granted initiative proficiency contribution must be passed explicitly.
- Passive Perception is derived as 10 + Perception bonus + its explicit flat adjustment.

## Deferred to later RE-006 slices

- Resolving proficiency grants from class, background, species, feats, and feature choices into the normalized calculation input.
- Armor, shields, base AC formulas, unarmored defense, armor proficiency, equipment restrictions, and item-driven AC modifiers.
- Weapon ability selection, finesse, proficiency, attack bonuses, damage, weapon mastery, and conditional attack effects.
- Hit point progression, multiclass Hit Dice, hit-die spending, temporary HP, death saves, rest, and recovery.
- Condition effects and separate 2014 / 2024 Exhaustion policies.
- Full character-state persistence/schema integration. RE-006A introduces a derived calculation input and does not change the persisted CharacterMechanicsState contract.

## Ruleset boundary

The arithmetic in this slice is shared by the 2014 and 2024 rulesets. Ruleset-specific content and condition policies remain explicit; later slices must not infer ruleset from labels or descriptions.
