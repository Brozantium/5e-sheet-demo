import type {
  ClassDefinition,
  EngineIssue,
  FeatureDefinition,
  OptionSetDefinition,
} from "../domain/types";

export class ContentRegistry {
  private readonly classes = new Map<string, ClassDefinition>();
  private readonly optionSets = new Map<string, OptionSetDefinition>();
  private readonly features = new Map<string, FeatureDefinition>();

  registerClass(definition: ClassDefinition): void {
    if (this.classes.has(definition.id)) {
      throw new Error("Duplicate class id: " + definition.id);
    }

    const incomingFeatureIds = new Set<string>();
    for (const feature of definition.features) {
      if (incomingFeatureIds.has(feature.id) || this.features.has(feature.id)) {
        throw new Error("Duplicate feature id: " + feature.id);
      }
      incomingFeatureIds.add(feature.id);
    }

    // Validate the full class before mutating the registry.
    this.classes.set(definition.id, definition);
    for (const feature of definition.features) this.features.set(feature.id, feature);
  }

  registerFeature(definition: FeatureDefinition): void {
    if (this.features.has(definition.id)) {
      throw new Error("Duplicate feature id: " + definition.id);
    }
    this.features.set(definition.id, definition);
  }

  registerOptionSet(definition: OptionSetDefinition): void {
    if (this.optionSets.has(definition.id)) {
      throw new Error("Duplicate option set id: " + definition.id);
    }

    const optionIds = new Set<string>();
    for (const option of definition.options) {
      if (optionIds.has(option.id)) {
        throw new Error("Duplicate option id " + option.id + " in option set " + definition.id);
      }
      optionIds.add(option.id);
    }

    this.optionSets.set(definition.id, definition);
  }

  getClass(id: string): ClassDefinition | undefined {
    return this.classes.get(id);
  }

  getFeature(id: string): FeatureDefinition | undefined {
    return this.features.get(id);
  }

  getOptionSet(id: string): OptionSetDefinition | undefined {
    return this.optionSets.get(id);
  }

  listClasses(): ClassDefinition[] {
    return [...this.classes.values()];
  }

  validateReferences(): EngineIssue[] {
    const issues: EngineIssue[] = [];
    const selectionIds = new Set<string>();

    for (const feature of this.features.values()) {
      for (const mechanic of feature.mechanics) {
        if (mechanic.kind === "selection") selectionIds.add(mechanic.id);
      }
    }

    for (const feature of this.features.values()) {
      for (const mechanic of feature.mechanics) {
        if (
          (mechanic.kind === "selection" || mechanic.kind === "spell-modifier") &&
          !this.optionSets.has(mechanic.optionSetId)
        ) {
          issues.push({
            code: "missing-option-set",
            message:
              "Feature " +
              feature.id +
              " references missing option set " +
              mechanic.optionSetId +
              ".",
            subjectId: mechanic.id,
          });
        }

        if (mechanic.kind === "assignment" && !selectionIds.has(mechanic.selectionId)) {
          issues.push({
            code: "missing-selection",
            message:
              "Assignment " +
              mechanic.id +
              " references missing selection " +
              mechanic.selectionId +
              ".",
            subjectId: mechanic.id,
          });
        }
      }
    }

    return issues;
  }
}
