# Brozantium — 5e Character Builder HTML Test

This isolated interface experiment is served by the separate repository `Brozantium/5e-sheet-minify-test`. It does not replace the main application and does not modify `src/App.tsx`.

## Current interface milestone

- A ruleset selector switches between 2014 and 2024.
- Class, race/species, and background options are loaded from the corresponding repository JSON files.
- The preview updates when the character name, level, class, race, or background changes.
- The data files remain separate static JSON assets under `/data/` and `/data/2024/`.
- Vite minifies production JavaScript with OXC and CSS with Lightning CSS.
- Both `index.html` and `alternate.html` import the shared TypeScript entry module.

## Data loading

The Vite plugin serves the repository's existing `data/` directory during development and copies JSON files to the build output without editing their contents. The browser requests only the three JSON catalogs needed for the initial builder screen.

Ruleset mapping:

- 2014: `/data/classes.json`, `/data/races.json`, `/data/backgrounds.json`
- 2024: `/data/2024/classes.json`, `/data/2024/races.json`, `/data/2024/backgrounds.json`

The remaining JSON catalogs are copied too, ready for later builder sections.

## Build

The separate Pages repository checks out this branch as its build source and runs:

```bash
pnpm --dir source install --frozen-lockfile
pnpm --dir source exec vite build --config minify-test/vite.config.ts
```

The resulting static site is written to `minify-test/dist/`.

## Scope boundary

This milestone is a data-backed interface prototype. It does not yet create persistent character records, run the canonical character-calculation engine, implement spellcasting, or replace the production React/Owlbear interface. Rules-engine calculations remain the responsibility of the dedicated engine work.

## Homebrew workspace milestone

- A separate `homebrew.html` page is linked from Character Builder.
- Category navigation covers races, backgrounds, feats, spells, actions, items, magic items, creatures, classes, and subclasses.
- Draft entries are saved in browser localStorage and support JSON import, paste, copy, and export backup.
- Drafts use a portable `id`, `name`, `source`, `kind`, `edition`, `description`, and optional `effects` representation with category-specific fields.
- This first pass is explicitly a local draft workspace. Native Content Registry mapping and final schema validation remain a later integration task.
