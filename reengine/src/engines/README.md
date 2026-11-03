# Engine Modules

Engines are pure domain functions. They must not import React, Owlbear SDK, browser storage, or legacy bundle files.

Current first-pass modules:
- progression-engine: resolves fixed values or class-table columns.
- prerequisite-engine: evaluates structured requirements.
- choice-engine: validates a selection against count, option set, repeatability, and prerequisites.
- resource-engine: spend, recover, and resize resource pools.
- assignment-engine: validates assigning a known option to an eligible target.
- spell-modifier-engine: validates known Metamagic-like options and computes resource cost.

Planned modules:
- effect-engine
- action-engine
- trigger-engine
- item-engine
- spellcasting-engine
- character-calculation-engine
