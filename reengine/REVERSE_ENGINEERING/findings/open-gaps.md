# Reverse-Engineering Gaps and Confidence

## Verified
- Generic feature.choice options are rendered by a shared radio-choice component.
- Eldritch Invocation, Rune, and Elemental Discipline selectors are dedicated components.
- Legacy character state has explicit invocations, disciplines, and runes collections.
- Rune options and usage are derived from feature descriptions/progression in the inspected bundle.
- The inspected Homebrew Magic Item editor/runtime supports one action profile per item.
- 2014 and 2024 Warlock, Artificer, and Sorcerer progression/feature text differs in meaningful ways.

## Not found in the inspected bundle set
- A dedicated Artificer Infusion/Replicate Magic Item selection and assignment editor.
- A Metamagic selection state or spell-casting modifier pipeline.
- A generic Rune-to-inventory-item inscription assignment flow.
- A generic event trigger system for item actions.

"Not found" is intentionally scoped to the inspected files and searches. It is not proof that no experimental implementation exists elsewhere.

## Next archaeology targets
- Trace the complete legacy content registry and all content normalization paths.
- Inspect all feature parser helpers for option extraction patterns and edge cases.
- Map character serialization, import/export, and migration behavior.
- Trace the complete Action tab runtime before implementing the new action/trigger engine.
- Identify every place where progression table values are read and displayed.
