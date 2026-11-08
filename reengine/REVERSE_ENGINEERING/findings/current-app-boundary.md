# Findings: Historical App Boundary

## Archived application

- The former `src/App.tsx` was approximately 618 KB and contained a large monolithic React/Owlbear application.
- It imported the former `src/spell-rules.ts`, `src/combat-rules.ts`, and `src/srd-spells.ts` files.
- It defined its own InventoryItem union, Feature, FeatureEffects, CombatMechanicalEffect, ActiveEffect, and ContentEntry types.
- Its ContentType included feat, background, race, subrace, class, subclass, item, spell, selection, invocation, and pact-boon; it did not include a dedicated magicitem content type in the inspected type declaration.
- Those historical files are preserved under `reengine/REVERSE_ENGINEERING/legacy/` for behavioral archaeology. They are not imported by the active app and must not become runtime dependencies.
- The old application was mounted from `src/main.tsx` before the application-runtime separation on 2026-11-08.

## Active application boundary

- `src/main.tsx` mounts `src/application/AppRoot.tsx`.
- `AppRoot` composes feature pages; it must remain small and must not contain character mechanics or feature workflows.
- Character Builder UI and application orchestration belong in focused modules under `src/application/`.
- Pure rule calculations belong under `reengine/src/engines/`; immutable content belongs in the canonical content model and is accessed through the Content Registry.
- The active application must not import the archived legacy folder or read old `/assets`, `/data`, or `/data/2024` directly.

## Reengineering decision

The reengine domain is a new contract, not an attempt to move the legacy application line-by-line. Do not import the archived app's local types into `reengine/src`. Introduce explicit adapters or migrations only after the new contracts and tests are stable.
