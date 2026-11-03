# Findings: Armor Class and Protective Equipment Audit (RE-006B1)

## Legacy behavior verified

- The current sheet stores armor records in one inventory category, with `armorMode` values `base` and `bonus`.
- One equipped base armor contributes its base AC and a Dexterity contribution determined by `full`, `max`, or `none`.
- Equipped bonus armor records are summed as flat AC bonuses. The legacy representation does not distinguish a shield from another AC bonus item in this helper.
- With no base armor equipped, the helper uses 10 + Dexterity modifier.
- The main sheet separately adds character and active-effect AC bonuses after the inventory helper.
- This is an observation of the audited application path, not proof that all armor-class features or custom content use this same representation.

## Canonical RE-006B1 model

- Item definitions remain immutable. Character equipment references them through unique instance IDs and an equipped flag.
- One armor item and one shield can be equipped simultaneously; duplicate armor or shield slots are rejected.
- Armor profiles determine base AC, Dexterity handling, Strength requirement, and Stealth disadvantage.
- Shield AC is an independent profile bonus. A 2014 untrained shield still contributes its AC bonus but surfaces a training issue; 2024 shield AC requires shield training.
- Unarmored Defense is an explicit character grant. It applies only when no armor is worn, and its rule declares whether a shield is allowed.
- Flat AC bonuses are explicit input. Content-derived effect stacking is reserved for a later effect layer.
- Incompatible ruleset equipment is ignored and reported. Shared equipment is compatible with both rulesets.

## Deferred to later RE-006 slices

- Converting class/species/background/feat features into armor and shield training grants.
- Applying the complete consequences of missing armor training to D20 tests and spellcasting.
- Selecting among multiple alternative AC formulas supplied by spells or class features.
- Attack roll, weapon proficiency, finesse, damage, weapon mastery, and hand occupancy.
- Full inventory persistence and migration. This slice accepts a resolved equipment calculation input and does not change persisted character state.
