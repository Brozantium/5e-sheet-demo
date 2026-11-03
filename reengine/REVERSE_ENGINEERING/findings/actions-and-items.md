# Findings: Actions, Items, and Combat

## Legacy Magic Item action limitation

The inspected Homebrew Editor model exposes a singular action field on a Magic Item. The runtime checks item.action and adds one profile to the Actions list. This is not a multi-action or event-trigger system.

The inspected action profile separates:
- activation: action, bonus, reaction, other;
- hit mode: none, attack, save;
- ability, proficiency, and flat bonus;
- damage components and optional ability modifier on first damage component.

The inspected runtime calculates an ability-based save DC. A fixed DC is not represented by that profile. A mode=attack profile does not also request a target save. A second item record with an action is a separate action, not an automatic follow-up to a hit.

## New model requirement

Use separate collections:
- actions[] for intentionally activated actions;
- triggers[] for event-driven reactions to events such as weapon.hit or spell.cast;
- effects[] for passive/statistical changes;
- properties for item identity and base weapon/armor characteristics.

A trigger condition must be able to inspect the natural d20 result separately from the total modified attack roll. For example, Baleful Talon needs naturalRoll 19–20 AND a confirmed hit, then a fixed DC 15 Constitution save and 6d6 Necrotic damage, half on success.

## Item architecture requirement

Magic Weapon and Magic Armor should reference a base mundane item definition and override only changed properties. They must retain the base weapon/armor profile, category, and properties. Gear and consumables also need structured effects; prose alone is not enough for automation.

## Important boundary

This file records behavior verified in the inspected legacy editor/runtime. It does not claim that no other future or hidden module could add similar behavior. The new system should be defined from canonical contracts and acceptance tests, not copied from legacy internals.
