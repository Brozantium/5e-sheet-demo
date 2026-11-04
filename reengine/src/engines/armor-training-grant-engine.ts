import type { Ruleset } from "../domain/types";
import type {
  ArmorTrainingCategory,
  ArmorTrainingGrant,
  ArmorTrainingGrantResolution,
  ArmorTrainingGrantSource,
} from "../domain/equipment";

const ARMOR_CATEGORIES: readonly ArmorTrainingCategory[] = ["light", "medium", "heavy"];

function isGrant(value: unknown): value is ArmorTrainingGrant {
  return value === "light" || value === "medium" || value === "heavy" || value === "shield";
}

/**
 * Unions explicit grants from owned class/subclass/species/background/feat
 * sources. Shared sources apply to both rulesets; edition-incompatible sources
 * are excluded and returned as diagnostics. No display text is parsed.
 */
export function resolveArmorTrainingGrants(input: {
  ruleset: Ruleset;
  sources: readonly ArmorTrainingGrantSource[];
}): ArmorTrainingGrantResolution {
  if (!input || typeof input !== "object") {
    throw new TypeError("Armor training grant input is required.");
  }
  if (input.ruleset !== "2014" && input.ruleset !== "2024") {
    throw new RangeError("Armor training ruleset must be 2014 or 2024.");
  }
  if (!Array.isArray(input.sources)) {
    throw new TypeError("Armor training grant sources must be an array.");
  }

  const sourcesByGrant: Record<ArmorTrainingGrant, string[]> = {
    light: [], medium: [], heavy: [], shield: [],
  };
  const seenSources = new Set<string>();
  const issues: ArmorTrainingGrantResolution["issues"] = [];

  for (const source of input.sources) {
    if (!source || typeof source !== "object") {
      throw new TypeError("Armor training grant source entries must be objects.");
    }
    if (typeof source.sourceId !== "string" || !source.sourceId.trim()) {
      throw new TypeError("Armor training source ID must be non-empty.");
    }
    if (seenSources.has(source.sourceId)) {
      throw new RangeError("Duplicate armor training grant source ID: " + source.sourceId);
    }
    seenSources.add(source.sourceId);
    if (
      source.ruleset !== "2014" &&
      source.ruleset !== "2024" &&
      source.ruleset !== "shared"
    ) {
      throw new RangeError("Unknown armor training source ruleset.");
    }
    if (!Array.isArray(source.grants)) {
      throw new TypeError("Armor training grants for " + source.sourceId + " must be an array.");
    }
    const local = new Set<ArmorTrainingGrant>();
    for (const grant of source.grants) {
      if (!isGrant(grant)) {
        throw new RangeError("Unknown armor training grant: " + String(grant));
      }
      if (local.has(grant)) {
        throw new RangeError("Duplicate armor training grant " + grant + " in source " + source.sourceId + ".");
      }
      local.add(grant);
    }

    if (source.ruleset !== "shared" && source.ruleset !== input.ruleset) {
      issues.push({
        code: "incompatible-ruleset-source",
        sourceId: source.sourceId,
        message:
          "Armor training source " + source.sourceId + " is " + source.ruleset +
          " content and is ignored for a " + input.ruleset + " character.",
      });
      continue;
    }
    for (const grant of local) sourcesByGrant[grant].push(source.sourceId);
  }

  return {
    armorTraining: ARMOR_CATEGORIES.filter((category) => sourcesByGrant[category].length > 0),
    shieldTraining: sourcesByGrant.shield.length > 0,
    sourcesByGrant,
    issues,
  };
}
