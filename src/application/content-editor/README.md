# Content-only Homebrew Editor prototype

This feature is intentionally limited to editing content records.

## Opening behavior

The active application entry point opens `ContentEditorPage` directly. It does not open the Character Builder, character sheet, or a rules/calculation screen.

## Edition separation

The top-level edition switch selects two independent workspaces:
- 2014
- 2024

Each edition has its own category collections and its own IndexedDB key. Switching editions never appends one edition's records to the other. Source IDs are retained as supplied, including IDs such as `longsword` that occur in both editions.

## Categories

The editor exposes the ten observed Homebrew Editor categories:
`races`, `classes`, `subclasses`, `backgrounds`, `feats`, `spells`, `items`, `magicitems`, `actions`, and `creatures`.

The audited official data folders do not contain Actions or Creatures datasets. Their editor categories therefore start empty and allow the user to create custom records. The editor does not invent official entries or imply that the source contained them.

## Editing behavior

- Search and select category records.
- Create, edit, save, discard, and delete records.
- Edit primitive fields using text, number, and boolean controls.
- Edit arrays and nested objects as JSON, preserving unrecognized fields.
- Add new fields to a record.
- Require a non-empty ID and Name; IDs must be unique inside the current category and edition.
- Lock each record's edition to the selected workspace.

## Import/export and storage

Import accepts a `dnd-homebrew` version 1 package or the equivalent category object. It validates the package against the active edition and replaces only that edition after confirmation. Export includes only the active edition.

Save writes to browser IndexedDB, scoped by edition. This is local browser storage, not cloud synchronization. Export JSON to preserve or transfer changes. If IndexedDB is unavailable, the editor keeps changes in the current tab and warns the user to export a backup.

## Explicit exclusions

This prototype does not author or execute game mechanics, calculate characters, implement Builder workflows, run spell/action effects, or modify canonical official content. It is an authoring surface for content records only.