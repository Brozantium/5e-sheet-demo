# Findings: Progression and Resources

## Warlock 2014

The Warlock progression table has an Invocations Known column:
- level 2: 2
- level 5: 3
- level 7: 4
- level 9: 5
- level 12: 6
- level 15: 7
- level 18: 8

Pact Boon is a separate feature at level 3.

## Warlock 2024

Eldritch Invocations are gained from level 1. The progression table uses an Eldritch Invocations column:
- level 1: 1
- level 2: 3
- level 5: 5
- level 7: 6
- level 9: 7
- level 12: 8
- level 15: 9
- level 18: 10

Pact options are included in the Invocation option set rather than represented by a separate Pact Boon feature.

## Artificer 2014

The Artificer progression has two independent columns:
- Infusions Known: 4 at level 2, then increases to 6, 8, 10, and 12 at higher levels.
- Infused Items: 2 at level 2, then increases to 3, 4, 5, and 6.

The new engine must not confuse how many options are learned with how many objects can be active.

## Artificer 2024

The feature is Replicate Magic Item. Progression separately tracks Plans Known and Magic Items. The same known-versus-active distinction is required, but the 2024 feature is not merely a rename of the 2014 feature; preserve its own rules and content model.

## Sorcerer 2014

Metamagic is gained at level 3 with two options; the character gains one more at levels 10 and 17. The Sorcery Points pool is a separate resource.

## Sorcerer 2024

Metamagic is gained at level 2 with two options, then two more at levels 10 and 17. Sorcery Points remain a separate resource pool.

## Rune Knight 2014

Rune Carver progression is 2 runes at level 3, 3 at level 7, 4 at level 10, and 5 at level 15. The inspected runtime uses a per-rune invocation count of one, increasing to two with Master of Runes at level 15. Rune Magic DC is 8 + proficiency bonus + Constitution modifier in the inspected Rune Knight text.

## Engine requirements

- Progression is data, not hardcoded UI logic.
- A progression table can expose multiple independent columns.
- The engine resolves each column at the character's class level.
- Resource pool capacity and known-option count are distinct concepts.
- Rest/recovery policy is explicit data and is tested independently from the builder.
