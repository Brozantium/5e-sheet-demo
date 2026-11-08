# Brozantium 5e Sheet — Project Instructions

This repository contains an independent React + Vite application and a clean-room rules/content engine under `reengine/`.

## Application entry points

- `src/main.tsx` mounts `src/application/AppRoot.tsx`.
- `src/application/` contains application composition and feature UI.
- Do not put feature workflows, character state, rules calculations, or large UI implementations in a monolithic `App.tsx`.
- Feature pages and controllers belong in focused modules under `src/application/`.
- The previous monolithic application is archived under `reengine/REVERSE_ENGINEERING/legacy/` for read-only behavioral reference. Never import it into the active runtime.

## Architecture boundaries

- `reengine/src/domain/` contains framework-independent contracts.
- `reengine/src/registry/` validates and indexes canonical content.
- `reengine/src/engines/` contains pure rules and calculation engines.
- `reengine/src/application/` is reserved for application orchestration contracts.
- `reengine/src/ui/` contains future reusable UI components.
- Canonical content belongs under `reengine/content/`.
- The new runtime must not import legacy files or load legacy `/assets`, `/data`, or `/data/2024` directly.
- Preserve explicit 2014 / 2024 ruleset metadata. Never infer an edition from names or descriptions.
- Keep UI, application orchestration, content definitions, character state, and rules engines separate.

## Development

Use the standard Vite commands:

- `pnpm dev`
- `pnpm build`
- `pnpm preview`
- `pnpm typecheck:reengine`
- `pnpm test:reengine`

The default development host is `0.0.0.0`; the port defaults to `8443` and can be overridden with `PORT`. Use `VITE_BASE` for deployments hosted under a path prefix.

## Code quality

- Use TypeScript strict typing for new domain and application code.
- Prefer small modules with explicit responsibilities.
- Keep game-rule calculations out of React components.
- Add focused unit tests beside each new engine or controller.
- Do not mark a feature complete until tests and exact-head CI support that status.
