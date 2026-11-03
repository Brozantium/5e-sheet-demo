# Adapters and Migration Boundaries

Adapters are controlled, explicit conversion tools. They are not runtime content sources.

Allowed future adapter responsibilities:
- convert a supported external/content authoring format into canonical definitions;
- migrate saved character state from an older schema version;
- validate and report data loss before accepting a conversion.

Disallowed:
- importing legacy /assets JavaScript into the application;
- reading /data or /data/2024 from the new runtime;
- silently parsing feature descriptions with regular expressions to create mechanics during play;
- changing a character's ruleset without an explicit migration decision.

Any importer must write normalized output under reengine/content or a migration artifact, then pass schema and engine validation.
