import type { CharacterMechanicsState, Requirement, RequirementResult } from "../domain/types";

export function evaluateRequirement(
  requirement: Requirement,
  state: CharacterMechanicsState,
): RequirementResult {
  switch (requirement.kind) {
    case "class-level":
      return (state.classLevels[requirement.classId] ?? 0) >= requirement.minimum
        ? { met: true }
        : { met: false, reason: "Requires " + requirement.classId + " level " + requirement.minimum + "." };
    case "ability-score":
      return state.abilityScores[requirement.ability] >= requirement.minimum
        ? { met: true }
        : { met: false, reason: "Requires " + requirement.ability.toUpperCase() + " " + requirement.minimum + "." };
    case "known-option":
      return (state.selections[requirement.selectionId] ?? []).includes(requirement.optionId)
        ? { met: true }
        : { met: false, reason: "Requires option " + requirement.optionId + "." };
    case "spell-known":
      return state.knownSpells.includes(requirement.spellId)
        ? { met: true }
        : { met: false, reason: "Requires spell " + requirement.spellId + "." };
    case "feature-owned":
      return state.ownedFeatures.includes(requirement.featureId)
        ? { met: true }
        : { met: false, reason: "Requires feature " + requirement.featureId + "." };
    case "all": {
      const results = requirement.requirements.map((entry) => evaluateRequirement(entry, state));
      const missing = results.filter((entry) => !entry.met).map((entry) => entry.reason).filter(Boolean);
      return missing.length ? { met: false, reason: missing.join(" ") } : { met: true };
    }
    case "any": {
      const results = requirement.requirements.map((entry) => evaluateRequirement(entry, state));
      return results.some((entry) => entry.met)
        ? { met: true }
        : { met: false, reason: results.map((entry) => entry.reason).filter(Boolean).join(" OR ") };
    }
  }
}
