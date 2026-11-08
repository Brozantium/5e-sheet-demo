# Application Layer

This folder is the active React application layer. It is intentionally separate from the clean-room rules engine under `reengine/src`.

## Runtime flow

`src/main.tsx` → `AppRoot.tsx` → feature page/controller modules → `reengine` contracts and engines.

## Responsibilities

- `AppRoot.tsx`: application composition and top-level layout only.
- `builder/`: Character Builder pages, state orchestration, and UI interactions.
- Future `sheet/`, `homebrew/`, and `campaign/` modules should follow the same feature-oriented structure.

## Rules

- Do not put complete feature implementations into a single root component.
- Keep D&D calculations out of React components. Call pure functions from `reengine/src/engines`.
- Keep mutable draft/character state separate from immutable canonical content.
- Use the Content Registry for canonical content; do not load root `/assets`, `/data`, or `/data/2024` directly at runtime.
- Never import code from `reengine/REVERSE_ENGINEERING/legacy/`.
- Add focused controller and UI modules as workflows become ready; do not expose a step as usable until its data, validation, and save behavior are implemented.
