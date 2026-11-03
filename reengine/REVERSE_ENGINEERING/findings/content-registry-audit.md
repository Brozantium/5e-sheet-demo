# Findings: Content Registry and Schema Audit (RE-005 Complete)

## Scope and status

RE-005 — Schema & Content Validation is complete for the canonical record types currently defined in the reengine domain: class, feature, option set, item, and character mechanics state. The work has passed the isolated TypeScript check and all 47 unit tests in CI.

Legacy JavaScript and JSON remain archaeology references only. They are not imported by the new runtime.

## Canonical identity and metadata

- Stable canonical content IDs use lowercase kebab-case segments separated by colons, such as `artificer-2014:infusions-known` and `fighter:rune-carver:known`.
- Ruleset metadata is explicit: `2014`, `2024`, or `shared`.
- Source metadata is represented by a shared `ContentSource` interface and common JSON Schema definition.
- Character IDs and inventory instance IDs are separate runtime identities; they are not forced into the canonical content ID namespace.

## TypeScript and JSON Schema work implemented

- `ContentRuleset` and `ContentSource` are shared domain contracts.
- `OptionSetDefinition` and per-option source/effect/prerequisite metadata have a dedicated Option Set schema.
- `ItemDefinition` is a canonical discriminated domain model, separate from the RE-003 weapon editor property-control types.
- Common, class, feature, option-set, item, and character-state schemas use JSON Schema Draft 2020-12.
- The item schema constrains weapon, armor, and shield profiles by item category; it rejects combat profiles on gear/tool/ammunition/consumable records.
- TypeScript contract fixtures cover classes, option sets, weapons, armor, shields, and character state.

## Registry validation implemented

1. Duplicate mechanic IDs are rejected; class registration validates nested entries before mutating registry indexes.
2. IDs and ruleset metadata are checked on class, feature, option-set, progression, mechanic, option, prerequisite, and item registration.
3. Assignment references must resolve to a selection mechanic.
4. Selection/spell-modifier option-set references and ruleset compatibility are checked.
5. Structured prerequisites validate class, feature, selection, and option references where the relevant registry exists.
6. Progression references validate table and column existence; progression row levels, duplicate levels, and numeric value constraints are checked.
7. Item definitions are indexed separately; duplicate IDs, profile/category shape, profile bounds, and base-item references are checked.
8. Cross-ruleset links between feature/option-set and magic-item/base-item are reported unless one side is `shared`.

## Automated validation

- Ajv Draft 2020-12 unit tests compile the common, class, feature, option-set, item, and character schemas.
- Positive and negative fixtures cover malformed IDs/rulesets, missing required profiles, category/profile mismatches, unknown fields, and non-canonical references.
- Existing engine regression tests remain in the same Node test runner.
- `reengine/tests/contracts/content-shapes.ts` compiles representative records against the TypeScript contracts.
- CI: `pnpm install --frozen-lockfile`, `pnpm typecheck:reengine`, and `pnpm test:reengine` passed; test summary was 47 passed, 0 failed.

## Bounded references intentionally deferred

- Spell existence cannot be resolved until the Spell Registry/RE-007 exists; the current phase validates spell ID format.
- Action/trigger target existence belongs to RE-008; the current phase validates reference ID format.
- No complete canonical production content packs are populated yet. That is a later content pilot, not part of importing old data into runtime.

## Non-goals

- No automatic bulk conversion of `data/` or `data/2024/` into canonical content.
- No runtime reads from `/assets`, `/data`, or `/data/2024`.
- No prose-to-mechanics parsing during gameplay.
- No assertion that a reference is resolvable before the relevant content registry exists.
