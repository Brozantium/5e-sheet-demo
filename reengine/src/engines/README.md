# Engine Modules

Engines are pure domain functions. They must not import React, Owlbear SDK, browser storage, or legacy bundle files.

Current first-pass modules:
- progression-engine: resolves fixed values or class-table columns.
- prerequisite-engine: evaluates structured requirements.
- choice-engine: validates a selection against count, option set, repeatability, and prerequisites.
- resource-engine: spends, recovers, and resizes resource pools.
- assignment-engine: validates assigning a known option to an eligible target.
- spell-modifier-engine: validates known Metamagic-like options and computes resource cost.
- item-engine: normalizes weapon-property combinations with exhaustive legacy parity coverage.
- character-calculation-engine: calculates ability modifiers, total character level, proficiency bonus, saving throws, skills, initiative, and passive Perception.
- armor-class-engine: calculates unarmored, armor, and shield AC from canonical item profiles and character training.
- armor-training-grant-engine: unions explicit armor and shield training grants from owned feature sources, filters edition-incompatible content, and retains provenance for diagnostics.
- armor-training-consequence-engine: resolves ruleset-aware consequences of untrained worn armor and shields, separately from the AC total.
- hit-point-engine: calculates multiclass maximum HP, builds class-specific Hit Dice pools, resolves one Short Rest Hit Die spend at a time with edition-specific recovery floors/start eligibility, and applies damage, healing, and player-chosen non-stacking Temporary HP with immutable state snapshots.
- weapon-attack-engine: resolves player-selectable Finesse ability, category/item proficiency, attack bonus, damage modifier, Versatile damage dice, ruleset-specific Heavy disadvantage, attack modes (melee/ranged/thrown), melee reach, normal/long range bands, and the 2014 Lance close-target rule. Its effective-reach helper is shared with Opportunity Attack validation.
- weapon-hand-occupancy-engine: validates main/off-hand occupancy, two-handed requirements, mounted Lance exceptions, and shields; separately reports ruleset-specific Light weapon-pair eligibility; the Attack-action trigger is not evaluated here.
- weapon-attack-cycle-engine: validates Ammunition availability/consumption, the free-hand requirement for loading one-handed weapons, and the one-shot Loading limit per Action/Bonus Action/Reaction; reports when a ranged weapon used for a melee attack must be handled as an improvised weapon.
- light-weapon-extra-attack-engine: validates the 2014 Two-Weapon Fighting Light trigger and the 2024 Light extra-attack trigger; resolves Bonus Action versus Attack-action placement when the extra weapon's Nick mastery is available.
- weapon-mastery-engine: exposes the eight 2024 mastery definitions, class-specific weapon-choice eligibility, Long Rest replacement selection mechanics, and the resolver that checks feature ownership plus selected weapon type before making a weapon's mastery available.
- death-save-engine: applies damage consequences at 0 HP, resolves Death Saving Throws and natural 1/20 outcomes, stabilizes with ruleset-specific Action/Help/Utilize methods, and handles the Stable 1d4-hour recovery event.

Weapon calculations consume normalized character ability scores, proficiency grants, and item definitions. They do not read class, feat, or legacy data directly; builder/content layers resolve those grants before calling the engines.

Planned modules / extensions:
- effect-engine
- action-engine
- trigger-engine
- equipment inventory state, equip/unequip persistence, and weapon equip validation
- Hit Dice spending and death-save/stabilization resolution are present as pure state engines; rest duration/interruption orchestration, Long Rest recovery, and condition/exhaustion policies remain
- 2014 Special weapon effects (including Net target eligibility, Restrained effect, escape, and per-action attack limit), the eight 2024 Weapon Mastery effects, and stateful execution/commit of Light/Nick/Ammunition/Loading interactions (RE-008)
- spellcasting-engine
