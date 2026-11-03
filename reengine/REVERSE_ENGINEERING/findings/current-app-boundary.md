# Findings: Current App Boundary

## Existing application

- src/App.tsx is approximately 618 KB and contains a large monolithic React application.
- The root source imports src/spell-rules.ts and src/combat-rules.ts.
- It defines its own InventoryItem union, Feature, FeatureEffects, CombatMechanicalEffect, ActiveEffect, and ContentEntry types.
- Its ContentType currently includes feat, background, race, subrace, class, subclass, item, spell, selection, invocation, and pact-boon; it does not include a dedicated magicitem content type in the inspected type declaration.
- Current feature effect shapes are not the same as the legacy reference application's Action and Effect structures.

## Reengineering decision

The reengine domain is a new contract, not an attempt to move App.tsx line-by-line. Do not import current App.tsx types into reengine/src. Introduce explicit adapters or migrations only after the new contracts and tests are stable.

The existing application remains untouched by this bootstrap commit. No runtime import from reengine is added to src/main.tsx or src/App.tsx.
