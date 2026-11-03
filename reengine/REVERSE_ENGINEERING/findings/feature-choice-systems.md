# Findings: Feature Choices and Selection Systems

## Verified generic choice behavior

- Builder-5ZbbT5bX.js contains a Feature choices step (component Et). It mounts dedicated choice components for options such as maneuvers, disciplines, runes, invocations, feats, and spells.
- SubclassStep-CY1HvAmF.js contains component Me. It reads feature.choice.options and renders a one-choice radio group. Selected labels are stored in character.traitChoices under a feature-derived key.
- This generic choice UI is appropriate for simple choices whose options do not need an independent lifecycle.

## Eldritch Invocations

- FeatureMechanics-DJjJBO4b.js contains component Jt, titled Eldritch Invocations.
- It derives known-count and known-option list from character/content helpers.
- It uses a prerequisite check before allowing a selection; a campaign setting can waive prerequisites.
- It supports adding/removing a choice and repeatable choices through separate callbacks.
- Selected values are stored in character.invocations.
- 2014 Warlock stores the invocation list inside the Eldritch Invocations feature description. Its progression table contains Invocations Known.
- 2024 Warlock also stores option text in the feature description; the level/progression changed, and Pact of the Blade/Chain/Tome are invocation options rather than a separate Pact Boon feature.

## Pact Boon

- 2014 Warlock has a Pact Boon feature at class level 3.
- The feature has a structured choice.options array containing Blade, Chain, Tome, and Talisman.
- It is consumed by the generic feature.choice component; no Pact-Boon-specific editor was found.
- 2024 Warlock has no separate Pact Boon feature in the inspected dataset. Three pacts are part of the Eldritch Invocation option list.

## Rune Knight

- FeatureMechanics-DJjJBO4b.js contains component Xt, titled Runes.
- featureUses-B59TCn_n.js parses named Rune entries from feature text, reads the Runes Known table when present, extracts a saving-throw ability from the Rune DC sentence, and computes Rune Magic DC as 8 + proficiency bonus + the parsed ability modifier.
- Legacy state stores selected names in character.runes.
- Rune selection checks class level prerequisites.
- The legacy Sheet has a Runes card, a Choose/Change Runes dialog, displays Rune Magic DC, and points players to the Actions tab to invoke runes.
- The inspected code identifies Master of Runes by text and changes the number of invocations per rune from one to two.
- The inspected flow does not establish a general-purpose assignment model for which inventory item bears each rune. Treat inscription-to-item assignment as a new capability, not as a proven legacy feature.

## Artificer Infusions

- The inspected 2014 Artificer Infuse Item feature contains an Infusion Options list in prose.
- Progression includes both Infusions Known and Infused Items capacity.
- The inspected 2024 dataset uses Replicate Magic Item, Plans Known, and Magic Items capacity.
- No dedicated Infusion/Plan selection editor, assignment state, or Infusion-specific engine was found in the inspected bundle set.
- The new model must distinguish known plans from currently active/created items.

## Sorcerer Metamagic

- The inspected 2014 and 2024 Sorcerer Metamagic feature descriptions contain option lists in prose.
- The feature descriptions specify a number of known options and replacement when gaining Sorcerer levels.
- No Metamagic state field, selection UI, or spell-cast modifier pipeline was found in the inspected bundle set.
- The new model must distinguish learning Metamagic from applying it during a spell cast and spending Sorcery Points.

## Design conclusion

Do not build one universal "Other Options" editor with conditionals for every class. Build a shared selection engine and mechanic-specific composition:
- simple choice: one or more options;
- known-options: progression-based collection with prerequisites and replacement;
- assignment: attach known options to eligible targets;
- resource-pool: spend/recover uses, points, or charges;
- spell-modifier: apply a known modifier during casting;
- action/trigger/effect: execute the selected mechanic at the correct time.
