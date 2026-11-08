# Play5e Dataset → Homebrew-Compatible Content Mapping

> Status: inventory and format-compatibility audit; no bulk conversion or canonical content import has been performed yet.
> Source archive: user-provided `play5e.net.zip`, retained in the ChatGPT Library as the original input.
> ZIP SHA-256: `b2fd929aec34a050acfa52857c9155442aafc1373dfa14cc16efc279bad356fe`.
> Inspection date: 2026-11-08 (Asia/Jakarta).
> Source assets are read-only evidence. They are not Brozantium runtime dependencies.

## 1. Current verified position

The Library copy of `play5e.net.zip` is present and readable. The archive contains 2,038 paths in this captured version. Both edition data directories are present:

- `play5e.net/data/`: 7 JSON datasets, 1,875 records.
- `play5e.net/data/2024/`: 8 JSON datasets, 1,482 records.
- Total: 15 JSON files, 3,357 records, 5,906,456 uncompressed JSON bytes.

All 15 files were successfully parsed as JSON arrays. This verifies the archive's dataset material is accessible; it does **not** mean the records have already been copied into GitHub or normalized into Brozantium's canonical model.

The current `reengine/content/2014/`, `reengine/content/2024/`, `reengine/content/shared/`, and `reengine/content/homebrew/` directories in the working branch still contain only `.gitkeep` placeholders. No production canonical content pack has been populated from this ZIP yet.

## 2. Dataset inventory

| Dataset | 2014 | 2024 | Source shape / note |
|---|---:|---:|---|
| `backgrounds.json` | 96 | 71 | Background choices, proficiencies, languages, feature, characteristics, equipment options |
| `classes.json` | 13 | 13 | Class progression and features; subclasses are nested inside each class |
| `feats.json` | 110 | 205 | Prerequisites, ASI, description; 2024 adds category/level-related fields |
| `items.json` | 227 | 242 | Equipment, weapons, armor, shields; fields vary by item kind |
| `magicitems.json` | 777 | 462 | Magic item type, rarity, attunement, description |
| `races.json` | 143 | 25 | 2024 dataset is rendered as Species in the Builder; keep source filename and ruleset identity explicit |
| `spells.json` | 509 | 456 | Spell level, school, time, range, components, duration, description, class lists |
| `masteries.json` | — | 8 | 2024 weapon mastery definitions; no matching top-level Homebrew Editor category |

Record counts are specific to this uploaded capture, not a guarantee of current live Play5e content or official completeness.

## 3. Homebrew Editor's accepted top-level format

The interactive Homebrew page and its importer expose these ten category keys:

```text
races
backgrounds
feats
spells
actions
items
magicitems
creatures
classes
subclasses
```

The import UI accepts either a root object containing those arrays or the versioned export wrapper:

```json
{
  "kind": "dnd-homebrew",
  "version": 1,
  "exportedAt": "ISO-8601 timestamp",
  "homebrew": {
    "races": [],
    "backgrounds": [],
    "feats": [],
    "spells": [],
    "actions": [],
    "items": [],
    "magicitems": [],
    "creatures": [],
    "classes": [],
    "subclasses": []
  }
}
```

The current in-app normalizer (`yc` / `xc` in the captured shared state bundle) accepts records with a non-empty `id` and `name`, deduplicates records by ID within each category, applies category-specific normalization, and preserves `edition` only when its value is exactly `2014` or `2024`. An imported file may be merged by ID; conflicts can keep the user's local copy or replace it with the imported version.

This is the Homebrew import/export compatibility contract observed in the captured application. It is not automatically the correct storage model for all official content.

## 4. Source dataset → Homebrew category mapping

| Source file | Homebrew category | Mapping action |
|---|---|---|
| `2014/races.json` | `races` | Preserve Race identity; attach explicit `edition: "2014"` |
| `2024/races.json` | `races` | Preserve source dataset name; UI terminology is Species; attach `edition: "2024"` |
| Both `backgrounds.json` | `backgrounds` | Preserve edition-specific fields, feature, proficiencies, choice sets and equipment options |
| Both `classes.json` | `classes` | Preserve progression, hit die, proficiencies, spellcasting metadata, features and starting equipment |
| `classes[*].subclasses` | `subclasses` | Extract/normalize subclass records with a stable `classId`; preserve original nested form as source evidence until parity is verified |
| Both `feats.json` | `feats` | Preserve ASI/prerequisite/repeatable; map 2024 category/level fields without dropping 2014 variants |
| Both `spells.json` | `spells` | Preserve spell metadata and class availability; do not invent structured damage/effect fields from prose |
| Both `items.json` | `items` | Normalize by `kind` while retaining weapon/armor/shield/gear-specific properties |
| Both `magicitems.json` | `magicitems` | Preserve attunement, rarity, item type and description; structured effects/actions require explicit evidence |
| 2024 `masteries.json` | No direct Homebrew category | Retain as a distinct ruleset-scoped canonical mastery registry; weapon records may reference mastery IDs |
| No matching files in these two data folders | `actions`, `creatures` | These are Homebrew Editor categories, but not supplied by the captured `/data/` datasets; source them from a separate verified reference if needed |

The source JSON does not consistently carry a top-level edition field. Edition must be assigned from the source directory, never inferred from a name or description.

## 5. Category-specific normalization observed in the Homebrew editor

The Homebrew Editor has per-category normalization, not one universal flat record schema. The captured shared state bundle applies the following field families (optional properties are retained only after validation/sanitization):

- **Races / Species** — identity/source, sources, description, traits, ASI and ASI choice, speed, languages, subraces, size options, creature type, feat grants and effects.
- **Classes** — hit die, class proficiencies, starting equipment/packages, starting wealth, subclass label/level/options, spellcasting metadata, level table, per-level progression, features, nested subclasses, primary ability, optional maximum level and spell-list restrictions.
- **Subclasses** — the class-subclass definition plus explicit parent `classId`.
- **Backgrounds** — skills/tools and their choice sets, language grants, feature, variants, characteristics, ASI, feat, equipment options and effects.
- **Feats** — prerequisite, ASI options/amount, category, prerequisite level, repeatability and effects.
- **Spells** — level 0–9, school, ritual, casting time, range, components/materials, duration, concentration, description, higher-level text, class list, and optional structured hit/damage/modifier data.
- **Items** — kind constrained to weapon/armor/shield/gear, category, cost and weight, properties, range type, damage and damage type, AC fields, Strength requirement, Dexterity contribution/cap, Stealth disadvantage, description, damage rolls, magic bonus and mastery.
- **Magic items** — item type, rarity, attunement, requires-attunement flag, description, optional price, structured effects and optional action.
- **Actions** — activation, range, structured hit/damage, modifier behavior, source and optional edition.
- **Creatures** — a separate creature/stat-block normalizer; not represented in the supplied 15 JSON datasets.

The Homebrew editor's use of structured `effects`, `hit`, `damage`, `action`, and progression objects is important: ordinary descriptions in the official source data must not be mechanically parsed by guesswork and treated as validated grants.

## 6. Important distinctions before conversion

1. **Homebrew export format is not identical to the canonical content registry.** Do not put every official 2014/2024 record into a user's Homebrew collection. Official content must retain official source provenance and remain distinguishable from custom content.
2. **Use the Homebrew editor as a compatibility target for authorable fields**, while the Brozantium canonical model remains governed by `reengine/SCHEMAS/`, `domain/types.ts`, and the Content Registry.
3. Preserve the original source JSON as read-only input. The user's uploaded ZIP remains the original snapshot; this document does not claim those 15 JSON files have been copied into the repository.
4. Build loss-aware adapters per category. Record fields that map directly, fields that need transformation, fields unsupported by the current schema, and any information that would be lost.
5. Keep 2014 and 2024 as explicit editions even where records share IDs or names. A shared ID must not silently overwrite across editions.
6. Extract subclasses from class records only after checking class editor/import expectations; avoid generating duplicates between nested and top-level representations.
7. Keep 2024 weapon masteries as their own canonical data set. Do not fabricate a Homebrew Editor `masteries` array that the observed importer does not accept.
8. Never use the captured HTML documentation pages, Play5e CSS/theme, fonts, color palette, or branded assets as Brozantium deliverables. They remain outside the migration scope.

## 7. Next bounded work slices

- **DATA-001A — Raw source manifest:** record per-file byte count, JSON hash, record count and root shape for all 15 files.
- **DATA-001B — Homebrew format contract:** complete field-level mapping for the ten editor categories, including feature/effect/option normalization and class/subclass relations.
- **DATA-001C — Compatibility matrix:** map every source key to canonical schema and Homebrew editor key; mark direct, transform, unsupported, derived, or needs-evidence.
- **DATA-001D — Pilot migration:** normalize one representative record per category (where source data exists) and validate round-trip/semantic parity before bulk conversion.
- **DATA-001E — Edition-wide migration:** migrate all records only after the pilot demonstrates lossless or explicitly documented transformation.

No RE-001–RE-006 engine should be replaced merely to make raw records fit the Homebrew Editor. Any schema/domain change must have its own compatibility tests and review.
