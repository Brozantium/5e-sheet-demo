# Target Architecture

## Runtime boundary

The application reads canonical definitions from reengine/content through the Content Registry. It does not read legacy /assets, /data, or /data/2024. Reverse-engineering observations are documentation, not runtime inputs.

## Data flow

1. Canonical content is authored or curated under content/shared, content/2014, content/2024, or content/homebrew.
2. The Content Registry validates and indexes classes, subclasses, features, option sets, items, spells, and rules.
3. The Builder reads feature mechanics and progression definitions to decide which choices are due.
4. Engines validate choices and calculate prerequisites, capacity, resources, effects, actions, and spell modifications.
5. Character state stores player choices and mutable state separately from immutable content definitions.
6. The Character Sheet renders the resulting state and offers available actions. The UI never owns game-rule calculations.

## Core separation

- Content Definition: what a class, feature, option, item, or spell is.
- Feature Mechanics: what a feature asks the character to learn, assign, activate, spend, or modify.
- Progression: when and how many choices/resources/capacities are granted.
- Character State: what this character selected, assigned, has available, or has spent.
- Runtime Engine: validates and applies rules.
- UI: presents builder steps, feature cards, inventory, and actions.

## Feature mechanic families

- selection: choose one or more options (Pact Boon, Fighting Style, Invocations, Runes, Metamagic).
- assignment: attach a known option to a valid target (Rune inscription, Artificer infusion).
- resource-pool: points, charges, uses, and recovery.
- spell-modifier: apply a known modifier at spell-cast time (Metamagic).
- action: expose a player-activated action.
- trigger: resolve event-driven behavior after a game event.
- effect: passive or conditional changes to character/item statistics.

A feature may contain multiple mechanics. For example, Rune Carver has a selection mechanic, an assignment mechanic, and an activation/resource mechanic. Artificer Infuse Item has separate known-plan and active-item capacities.

## Canonical content model

- Content IDs are stable, namespaced identifiers.
- Ruleset is metadata on content and character build; ruleset must not be inferred from display text.
- Option definitions are reusable records in option sets.
- Requirements are structured predicates, not prose parsed during normal gameplay.
- Progression values reference a class progression table and column, not UI-specific strings.
- Descriptions are for display. They are never the sole source for a mechanical behavior.
- Source/book/page metadata should be preserved where available.

## Character state

Immutable definitions remain in content. Character state stores:
- class levels and ability scores;
- selected option IDs by selection mechanic;
- assignments from known options to inventory item IDs;
- resource pools and expended amounts;
- spellbook/known/prepared spell state;
- active effects and temporary conditions;
- migration metadata where required.

Do not persist derived values such as calculated save DC or final AC when they can be recalculated from current state.

## Edition strategy

Use one engine with ruleset-aware content and policy configuration. Do not fork the entire engine into 2014 and 2024 copies. Edition differences live in content, progression tables, and explicit rule policies.
