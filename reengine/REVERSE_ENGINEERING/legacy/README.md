# Archived Legacy Application Reference

This folder preserves the previous monolithic React/Owlbear application for reverse-engineering and migration reference only.

- `LegacyCharacterSheetApp.tsx` was previously mounted by `src/main.tsx`.
- The legacy app and its supporting rule/data files are deliberately no longer imported by the active runtime.
- Do not add imports from this folder to the production application or the clean-room Reengine.
- New features must be re-authored in the application modules and `reengine/src`, using the audited behavior as evidence.
- Keep this archive unchanged unless a specific reverse-engineering task requires a documented correction.

The archive is retained to avoid losing prior behavior and data while the new application is built independently.
