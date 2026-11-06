# Minify JS — separate HTML test

This folder is an isolated test harness. It does not replace the main app and does not modify `src/App.tsx`.

## What this test checks

- `index.html` and `alternate.html` are two separate HTML entry points.
- Both import the same external module: `src/main.ts`.
- `src/main.ts` imports the same pure function from `src/shared-logic.ts`.
- The test Vite config builds both HTML pages and minifies their production JavaScript with esbuild.

The character snapshot function is only a smoke-test example. It is not intended to become canonical 5e rules logic.

## Run in development

From the repository root:

```bash
pnpm install
pnpm exec vite --config minify-test/vite.config.ts
```

Open both pages:

- http://127.0.0.1:5173/
- http://127.0.0.1:5173/alternate.html

Use the form on each page. Both should return a JSON snapshot and identify the same source module.

## Test the minified production build

From the repository root:

```bash
pnpm exec vite build --config minify-test/vite.config.ts
pnpm exec vite preview --config minify-test/vite.config.ts
```

Open:

- http://127.0.0.1:4173/
- http://127.0.0.1:4173/alternate.html

The production build is written to `minify-test/dist/`. Inspect the generated files under `minify-test/dist/assets/` or use the browser's Network/Sources panel to confirm the HTML loads generated JavaScript bundles rather than the TypeScript source.

## What this proves about src/App.tsx

The main app already uses Vite. Its root `vite.config.ts` sets `build.minify` to `true` for production builds and disables it only in development mode.

The corresponding app pattern is to move reusable logic into a normal source module (for example, `src/utils/character-calculation.ts`) and import that module from `src/App.tsx`. Vite follows the import graph and minifies the production output automatically. Do not manually import a generated minified bundle into `App.tsx`.

This experiment deliberately stays outside the production source tree so it cannot change app behavior.
