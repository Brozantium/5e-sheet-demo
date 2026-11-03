# Findings: Content Registry Audit (RE-005 Interim)

## Scope and status

This is an interim record for RE-005 — Schema & Content Validation. The registry hardening described here is a useful subset of the phase, not completion of the whole phase.

RE-005 must align TypeScript domain contracts and JSON Schema, define and validate stable IDs and ruleset metadata, and validate cross-content references. No legacy JavaScript or JSON is imported at runtime.

## Repository inventory at the audited revision

- Legacy reference data exists in `data/` and `data/2024/`; it remains archaeology input only.
- Canonical content directories under `reengine/content/` are present but contain only `.gitkeep` placeholders.
- Schemas currently cover class, feature, item, and character mechanics state. A dedicated Option Set schema is missing.
- `reengine/src/domain/types.ts` defines class, feature, option set, progression, and character mechanics types.
- `reengine/src/domain/item.ts` currently defines weapon editor property controls, not a canonical item definition.
- The current item schema remains permissive in several areas and is not yet backed by a matching canonical TypeScript item interface.

## Registry work already implemented

1. Duplicate mechanic IDs are rejected.
2. Class registration validates nested IDs before mutating registry indexes.
3. Assignment references must resolve to a selection mechanic.
4. Selection/spell-modifier option-set references are checked.
5. Feature and option-set rulesets must match unless one side is `shared`.
6. Structured prerequisites validate class, feature, selection, and option references where the relevant registry exists.
7. Progression references validate table and column existence.
8. Class progression tables can be indexed and looked up.

These behaviors have focused unit tests in `reengine/tests/unit/content-registry.test.cjs`.

## Remaining RE-005 work

- Define an ID grammar and namespace policy based on the canonical content model, then enforce it in TypeScript-facing validation, schemas, registry registration, and fixtures.
- Add an Option Set JSON Schema matching `OptionSetDefinition` and `OptionDefinition`.
- Compare each TypeScript interface against its JSON Schema, including optionality, nullability, numeric bounds, unions, and metadata.
- Add a canonical item domain model and replace permissive item schema sections with explicit weapon, armor, shield, gear, and magic-item contracts as supported by the selected scope.
- Standardize ruleset/source metadata consistently across canonical content records.
- Add JSON Schema validation tests for valid fixtures and invalid/negative cases.
- Extend reference validation as corresponding registries/contracts become available; do not pretend spell, item, action, trigger, and effect references are resolved before those registries exist.

## Non-goals

- No automatic bulk conversion of `data/` or `data/2024/` into canonical content.
- No runtime reads from `/assets`, `/data`, or `/data/2024`.
- No prose-to-mechanics parsing during gameplay.
- No claim that RE-005 is complete until schema validation and type/schema parity tests pass.

## Acceptance criteria

RE-005 is complete only when:

- TypeScript contracts and JSON Schemas agree for every canonical record type included in this phase.
- Stable IDs and ruleset/source metadata are validated consistently.
- Registry checks reject duplicate IDs and unresolved references within the available content domains.
- Positive and negative schema fixtures pass the configured validator.
- `pnpm typecheck:reengine` and `pnpm test:reengine` pass in CI.
