# Findings: Content Registry Audit (RE-005)

## Scope

RE-005 hardens the clean-room content registry and checks cross-references that can be verified with the domain types currently implemented. It does not import legacy JavaScript or JSON at runtime and does not bulk-copy the legacy datasets into canonical content.

## Repository inventory at the audited revision

- Legacy reference data exists in data/ and data/2024/; it remains archaeology input only.
- Canonical content directories under reengine/content/ are present but contain only .gitkeep placeholders. No complete canonical class, spell, item, feat, background, race/species, subclass, or option-set packs have been populated yet.
- Schemas currently cover class, feature, item, and character mechanics state. There is no dedicated option-set schema in this revision.
- The TypeScript registry stores classes, features, and option sets. Progression tables are embedded in class definitions; subclass-owned progression tables need an explicit registration path.
- The current domain registry does not yet index spells, items, subclasses, backgrounds, races/species, actions, effects, or triggers. Those are separate model/registry slices, not silently treated as validated by RE-005.

## Gaps addressed

1. Mechanic IDs were not checked for uniqueness. Assignment references could accidentally resolve to a non-selection mechanic with the same ID.
2. known-option prerequisites were not checked against the option set belonging to the referenced selection mechanic.
3. Ruleset mismatches between a feature and its option set were not reported.
4. Progression table references and requested columns were not checked.
5. Class progression tables were not exposed through a registry lookup, and subclass-owned progression tables had no registration path.
6. Registry lookup APIs exposed classes only, despite features and option sets being first-class registry entries.

## Validation contract after RE-005

- Registration rejects duplicate class, feature, option-set, progression-table, option, and mechanic identifiers within their respective namespaces.
- Registering a class is atomic: duplicate nested feature/mechanic IDs or a progression-table collision do not leave partial records behind.
- An assignment must reference an actual selection mechanic.
- A selection or spell-modifier mechanic must reference an existing option set.
- Feature and option-set rulesets must agree unless one side is marked shared.
- A structured known-option prerequisite must reference an existing selection mechanic and an option ID present in that mechanic's option set.
- Class-level and feature-owned prerequisites are checked against registered classes and features.
- Class-table progression references are checked for table existence and column existence. An explicit level-source class is checked when supplied.
- spell-known prerequisites are intentionally not resolved yet because a spell registry does not exist in this slice.

## Deliberate non-goals

- No legacy-to-canonical importer or runtime read of /assets, /data, or /data/2024.
- No automatic conversion of descriptive prose into mechanics.
- No claim that all content references are validated: spell, item, action, trigger, and effect registries still need their own contracts.
- No canonical content population. That should follow stable schemas and a source-by-source curation plan.

## Acceptance

The new unit tests cover atomic registration, duplicate mechanic IDs, assignment target kinds, prerequisite option IDs, ruleset compatibility, progression-table/column references, and nested prerequisite groups. CI remains the execution authority for the repository test scripts.