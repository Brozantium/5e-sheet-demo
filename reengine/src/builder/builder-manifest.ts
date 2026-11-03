export const BUILDER_STEPS = [
  "ruleset",
  "class",
  "subclass",
  "species-or-race",
  "background",
  "ability-scores",
  "proficiencies",
  "features-and-options",
  "feats",
  "spells",
  "equipment",
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
