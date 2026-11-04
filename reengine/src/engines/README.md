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
- weapon-attack-engine: resolves player-selectable Finesse ability, category/item proficiency, attack bonus, damage modifier, Versatile damage dice, and ruleset-specific Heavy weapon disadvantage.
- weapon-hand-occupancy-engine: validates main/off-hand occupancy, two-handed requirements, and shields; separately reports ruleset-specific Light-property extra-attack eligibility.

Weapon calculations consume normalized character ability scores, proficiency grants, and item definitions. They do not read class, feat, or legacy data directly; builder/content layers resolve those grants before calling the engines.

Planned modules / extensions:
- effect-engine
- action-engine
- trigger-engine
- equipment inventory state, equip/unequip persistence, and weapon equip validation
- character HP, death saves, rest, and condition/exhaustion policies
- spellcasting-engine
