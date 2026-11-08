/**
 * Ordered Character Builder flow.
 *
 * The sequence is informed by the Play5e behavioral audit, then normalized to
 * this project's ruleset-neutral naming. Steps such as subclass, feats,
 * feature choices, and spells are dynamically hidden when not applicable.
 * "review" is retained as a project-level final review step.
 */
export const BUILDER_STEPS = [
  "ruleset",
  "modifiers",
  "class",
  "species-or-race",
  "subclass",
  "ability-scores",
  "background",
  "proficiencies",
  "feats",
  "features-and-options",
  "equipment",
  "spells",
  "details",
  "review",
] as const;

export const FEATURE_MECHANIC_PANELS = [
  "selection",
  "assignment",
  "resource-pool",
  "spell-modifier",
  "action",
  "trigger",
] as const;

export type BuilderStep = (typeof BUILDER_STEPS)[number];
export type FeatureMechanicPanel = (typeof FEATURE_MECHANIC_PANELS)[number];
