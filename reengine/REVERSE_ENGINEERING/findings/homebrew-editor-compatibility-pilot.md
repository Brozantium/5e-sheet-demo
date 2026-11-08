# Homebrew Editor Compatibility Pilot — DATA-001D

> Status: **read-only pilot completed; no official content was imported or rewritten.**
> Baseline: captured `play5e.net.zip` supplied by the repository owner, plus the captured Homebrew Editor/shared-state bundles.
> Scope: compare representative records from `/data/` and `/data/2024/` against the observed Homebrew import normalizer and Brozantium's current canonical schemas/registry.
> Ruleset-specific source records remain separate. Play5e docs pages, styles, fonts, colors, logos and visual assets are out of scope.

## 1. Pilot verdict

The captured Homebrew Editor can represent the source records for **races, backgrounds, classes, subclasses, feats, spells, items, and magic items**. The source files already use many of the editor's expected field names.

That does **not** make the captured Homebrew format a safe canonical storage format for the whole official catalog:

1. The import normalizer de-duplicates records by `id` within a category without including `edition` in the key. The 2014 and 2024 source collections share IDs in every matched category. A combined import can therefore discard one edition's version of a record.
2. The import path `xc` caps each category at **1,000 input records** before normalization. The combined magic-item source contains 1,239 records, so a single combined import is truncated before deduplication.
3. Several source records require transformations before they satisfy Brozantium's canonical model. The current canonical layer does not yet define/register every content category.
4. Descriptive prose is not a structured rules payload. The pilot does not parse descriptions into mechanics, actions, triggers, effects, or spell damage.

**Decision:** keep the 2014 and 2024 source files intact as read-only inputs. Build explicit, edition-aware adapters into Brozantium's canonical Content Registry. Treat the Homebrew Editor import shape as a compatibility/export target for user-authored Homebrew, not as the official-content registry.

## 2. Representative records examined

| Homebrew category | 2014 sample | 2024 sample | Pilot finding |
|---|---|---|---|
| `races` | `aarakocra` | `aasimar` | Field families align: traits, ASI, size, speed, languages and subraces; 2024 also uses creature type, feat grants and size options |
| `backgrounds` | `acolyte` | `acolyte` | Core fields align; 2024 adds ability-score choices and a feat grant, while equipment/feature content differs |
| `classes` | `fighter` | `fighter` | Editor shape is close to source, but class progression and feature records need explicit canonical mapping |
| `subclasses` | `fighter/champion` | `fighter/champion` | Must extract from each class and add parent `classId`; source slash IDs are not valid canonical content IDs |
| `feats` | `athlete` | `athlete` | ASI shape aligns; 2024 adds category and prerequisite level; prerequisite remains human-readable text |
| `spells` | `acid-splash` | `acid-splash` | Most metadata fields align; the same ID has ruleset-specific school/casting text/effect description |
| `items` | `longsword` | `longsword` | Homebrew item fields align, but canonical weapon profile needs property/damage/mastery normalization |
| `magicitems` | `flame-tongue` | `flame-tongue` | Name/type/rarity/attunement/description align; structured effects and action are absent from source records |
| `actions` | — | — | No top-level source dataset in either data directory |
| `creatures` | — | — | No top-level source dataset in either data directory |

The 2024 masteries file contains eight standalone records. It is not a Homebrew Editor top-level category and should remain a separate canonical weapon-mastery registry.

## 3. Actual import normalizer behavior observed

The captured shared state bundle defines a category normalizer for these exact keys:

```text
races, classes, subclasses, backgrounds, feats,
spells, items, magicitems, actions, creatures
```

The import path accepts either the root category object or the `{ kind: "dnd-homebrew", version: 1, homebrew: ... }` wrapper. The normalizer:

- processes a maximum of 1,000 input records per category on the import path;
- requires a non-empty string `id` (maximum 200 characters) and non-empty `name`;
- removes duplicate IDs within the same category, using the first occurrence;
- trims names and limits them to 100 characters;
- preserves an `edition` field only when it is exactly `"2014"` or `"2024"`;
- applies distinct field sanitizers for each category, instead of a universal schema;
- retains many additional input properties through shallow object copying, but sanitizes known fields and nested structures selectively.

The merge path can also rename a colliding imported record with a new ID and an `(imported)` suffix. That is useful for interactive user imports, but it is not a stable content migration policy because generated IDs and renamed records can break references.

This behavior is based on static inspection of the captured bundles, not a live integration test against the original site's deployed service.

## 4. Edition collision and capacity findings

ID overlap counts are measured between the 2014 and 2024 arrays of the same category:

| Category | 2014 | 2024 | IDs present in both |
|---|---:|---:|---:|
| Backgrounds | 96 | 71 | 13 |
| Classes | 13 | 13 | 13 |
| Feats | 110 | 205 | 49 |
| Items | 227 | 242 | 197 |
| Magic items | 777 | 462 | 321 |
| Races/species | 143 | 25 | 17 |
| Spells | 509 | 456 | 369 |

These overlaps are expected across editions; they do **not** mean the records are identical. For example, the `acid-splash` spell has different school and descriptive rules text between the two editions, and the two `longsword` records have different mastery metadata.

The combined magic-item count is **1,239**, exceeding the import normalizer's 1,000-record cap. Do not concatenate both editions into one `magicitems` array and expect a complete import.

Subclasses are stored nested under class records in the raw files: 137 in the 2014 class collection and 76 in the 2024 collection (213 total). Their source IDs use `class/subclass` form; all 213 fail the current canonical ID pattern, which permits colon-separated segments but not slashes.

## 5. Category mapping notes

### Races / Species

The editor normalizer accepts the source families `sources`, `traits`, `asi`, `asiChoice`, `speed`, `languages`, `subraces`, `sizeOptions`, `creatureType`, and `featGrants`.

- 2014 Aarakocra and 2024 Aasimar are structurally compatible with the editor's Race record shape.
- Trait entries are `name` + `text`; preserve them as source traits.
- Do not convert a trait's prose into a mechanical effect automatically.
- Brozantium currently has no dedicated canonical Race/Species schema or registry entry point. A new schema is required before canonical import.

### Backgrounds

The editor normalizer accepts skill/tool proficiency arrays and choices, languages, feature, variants, characteristics, ability scores, feat grant and equipment options.

- 2014 Acolyte has its Shelter of the Faithful feature and a language choice of two.
- 2024 Acolyte has an ability-score choice list and a Magic Initiate feat grant; its feature/characteristics content is materially different.
- Keep the string `equipment` description and structured `equipmentOptions` together; do not attempt to reconstruct one from the other.
- Brozantium currently has no dedicated canonical Background schema/registry.

### Classes

The Homebrew shape directly supports source fields such as `hitDie`, `proficiencies`, `startingEquipment`, `startingEquipmentOptions`, `subclassLabel`, `subclassLevel`, `subclassOptions`, `spellcasting`, `levelTable`, `progression`, `features`, `subclasses`, and 2024 `primaryAbility`.

Canonical mapping is not direct:

- Raw progression rows contain `level`, `profBonus`, `features[]`, `extras{}`, and `slots[]`. The current canonical `ProgressionTable` stores `values` as scalar values only; it has no direct field for feature-name arrays or the slot array.
- All 149 class features in 2014 and 174 in 2024 lack feature IDs. Subclass feature records also lack IDs (741 in 2014 and 400 in 2024).
- Feature entries contain `name`, `level`, `optional`, `text`, `tables`, and occasionally `choice`. The canonical `FeatureDefinition` requires a stable ID and typed `mechanics[]`.
- Some `choice` entries provide structured option labels/text, but those texts are not typed effects and must not be translated into mechanics by guesswork.
- 2024 `primaryAbility` is prose such as `"Strength or Dexterity"`; canonical `primaryAbilities[]` requires ability IDs. Map only with an explicit vocabulary/parser and preserve the original phrase.
- Spellcasting metadata can be mapped field-by-field only after RE-007's spellcasting contract is approved.

The current class schema can validate a deliberately reduced canonical projection, but it cannot preserve the full raw record losslessly. Retain the complete source record separately.

### Subclasses

Extract nested `classes[*].subclasses[*]` records to the editor's `subclasses` category and add the owning class's ID as `classId`.

- Preserve the nested source representation as evidence until the extracted representation passes equality/coverage checks.
- For canonical IDs, a deterministic namespace is needed, for example `edition-2014:subclass:fighter:champion`, with `sourceId: "fighter/champion"` in adapter provenance. Do not silently overwrite the source ID.
- The canonical content layer currently has no dedicated subclass definition/schema.

### Feats

The source `asi` object already uses the editor's `{ options, amount, any }` shape. The 2024 records additionally supply `category` and `prerequisiteLevel`.

- `prerequisite` is a display string, not a typed requirement tree.
- The importer can preserve the display string, but an automated canonical prerequisite conversion needs an explicit parser and tests.
- The editor normalizer can preserve optional `effects[]`; source descriptions alone are not structured effects.
- Brozantium currently has no dedicated canonical Feat schema/registry.

### Spells

The source matches the editor's principal fields: level, school, ritual, casting time, range, components, duration, concentration, description, higher-level description and class list.

- The importer creates structured `hit`/`damage` fields only when they already exist in the input. The supplied official spell records do not provide those structures as top-level fields.
- Do not parse dice, save behavior, targets, damage types or scaling from prose as part of this pilot.
- The same source ID may encode different edition-specific mechanics. Preserve both editions distinctly.
- The dedicated spell schema/registry belongs to the approved RE-007 work; it is not present in the current canonical registry.

### Items

The Homebrew item model retains `kind`, `category`, `cost`, `costGp`, `weight`, `weightLb`, `rangeType`, `damage`, `damageType`, `properties`, `baseAc`, `strengthRequired`, `addDex`, `maxDex`, `stealthDisadvantage`, `description`, `damageRolls`, `magicBonus`, and `mastery`.

- Longsword 2014 has `properties: ["Versatile (1d10)"]`; canonical item content expects a normalized property such as `"versatile"` and stores its alternate formula separately as `versatileFormula`.
- Longsword 2024 adds `mastery: "Sap"`; canonical `WeaponMasteryId` is lowercase `"sap"`.
- `kind` maps to the canonical category family, while source `category` is a weapon/armor/gear subgroup and must not be treated as the canonical top-level category.
- Armor records require a separate conversion of `baseAc`, `addDex`, `maxDex`, `strengthRequired`, and `stealthDisadvantage` into `armorProfile`.
- The canonical ItemDefinition schema does not currently retain cost and weight. The raw source must therefore remain available until those fields are added to an explicit canonical extension or sidecar.
- A basic gear record is simpler, but the same missing cost/weight concern remains.

### Magic items

Flame Tongue 2014/2024 share the editor's descriptive fields: `itemType`, `rarity`, `attunement`, `requiresAttunement`, `source`, `description`; 2024 also includes `price` and `priceGp`.

- The editor forces `kind: "magic"` and can optionally preserve typed `effects[]` and `action`.
- The source Flame Tongue records contain descriptive prose, but do not contain structured `effects` or `action` payloads.
- Do not automatically turn the command-word activation or extra damage prose into a structured attack/action. This belongs to a separately reviewed mechanics/action mapping.
- Canonical ItemDefinition has a `magic-item` category but currently lacks rarity, attunement, item type, price, and structured magic effect fields. A canonical magic-item extension/schema is needed.

### Actions, creatures, and weapon masteries

- No source `actions.json` or `creatures.json` is present in either edition folder. Do not invent or create sample source records for those categories.
- `masteries.json` contains eight 2024 mastery records. Keep it outside the Homebrew import categories and reconcile its IDs/descriptions with Brozantium's existing eight mastery definitions.

## 6. Required identity and packaging policy

The canonical identity pattern in `common.schema.json` accepts lowercase hyphen/colon IDs, but the Homebrew importer accepts a broader raw ID string. Raw subclass IDs with slashes therefore need an explicit adapter mapping.

For any combined edition-aware import package, IDs must be collision-safe. A candidate canonical namespace is:

```text
edition-2014:class:fighter
edition-2024:class:fighter
edition-2014:subclass:fighter:champion
edition-2024:subclass:fighter:champion
edition-2014:spell:acid-splash
edition-2024:spell:acid-splash
```

This is a proposed adapter ID policy, not yet an approved change to the current Content Registry. Preserve the source ID in provenance and rewrite every reference through the same mapping table; never prefix only a record and leave its references unchanged.

For the Homebrew Editor importer specifically, either:
- keep per-edition packages separate and validate how the UI merges them, or
- generate stable edition-qualified IDs and rewrite all intra-package references.

Do not combine 2014 + 2024 magic items into a single `magicitems` array because the 1,000-record import cap would truncate the input. Do not rely on merge-generated random IDs for official content.

## 7. Canonical support gap confirmed

Current Brozantium canonical schemas cover `common`, `class`, `feature`, `item`, and `option-set`. The current ContentRegistry registers classes, features, progression tables, option sets, and items.

No dedicated canonical schema/registration path currently exists for:
- races/species;
- backgrounds;
- feats;
- spells;
- subclasses;
- magic-item metadata/effects;
- actions and creatures;
- source weapon-mastery description records.

This is a schema/registry roadmap gap, not a reason to weaken strict existing schemas or change completed RE-001–RE-006 behavior. Spellcasting structures must wait for the approved RE-007 contract; action execution remains outside this migration pilot.

## 8. Pilot exit criteria and next bounded task

The read-only pilot passes its purpose: it identifies the editor shape, representative field mappings, collision/truncation risks, and canonical gaps. It does **not** authorize bulk conversion.

Next: **DATA-001C — Loss-aware compatibility matrix**.

For each source key across all 15 JSON files, classify it as:
- direct: same semantics and compatible target;
- transform: deterministic conversion with an explicit rule;
- preserve-only: retained in raw/source payload until a canonical field exists;
- derived: generated only from a documented relationship;
- unsupported: no target in the current editor/canonical schema;
- needs-evidence: meaning or cross-reference not yet established.

After DATA-001C is reviewed, create executable adapter prototypes and tests for one category at a time. Start with items (existing schema/engine coverage) and backgrounds/races only after their canonical schemas are designed. No bulk content write to `reengine/content/` yet.
