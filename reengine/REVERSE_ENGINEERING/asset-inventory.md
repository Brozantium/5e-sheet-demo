# Legacy Asset Inventory

Inspection target: Brozantium/5e-sheet-demo, default branch main. These files are inspected as compiled reference artifacts only.

| Legacy file | Observed responsibility |
| --- | --- |
| assets/Builder-5ZbbT5bX.js | Builder steps, including the Feature choices page and level-up orchestration. |
| assets/FeatureMechanics-DJjJBO4b.js | Feature mechanics UI: Eldritch Invocation, Elemental Discipline, Rune, generic mechanics summary, prerequisite evaluation and shared option selector. |
| assets/SubclassStep-CY1HvAmF.js | Subclass selection and generic feature.choice radio selection. |
| assets/featureUses-B59TCn_n.js | Progression-derived uses/resources, Rune option extraction, Rune DC, Rune use tracking, other resource recognition. |
| assets/Sheet-lbYmHrw9.js | Level-up UI sections for choices, Runes, Invocations and other feature choices. |
| assets/sheet-hfyoL_me.js | Character Sheet cards for Runes and Eldritch Invocations; Rune descriptions and action-tab links. |
| assets/state-D2M4XFy8.js | State normalization/validation. The inspected legacy character shape has separate invocations, disciplines, and runes fields. |
| assets/HomebrewEditor-DPN7_hbU.js | Homebrew content editor; generic feature effects and one action field for Magic Item. |
| assets/Sheet-lbYmHrw9.js | Magic Item action profile runtime and inventory-to-actions mapping. |
| assets/index-DAlrLfCJ.js | App shell and compiled UI, includes dated feedback notes describing fixes for Invocation and Rune selection. |

## Current project boundary

src/App.tsx is a separate large React application component (approximately 618 KB at inspection time). It has its own types and data model. The new reengine workspace is not imported by that file yet. Do not assume that behavior observed in the reference bundles is already implemented in src/App.tsx.

Relevant current App.tsx types include InventoryItem unions, Feature/FeatureEffects, CombatMechanicalEffect, and ContentEntry. They are useful for compatibility planning, not a schema to copy wholesale.
