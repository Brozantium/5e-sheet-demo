import type {
  ClassDefinition,
  EngineIssue,
  FeatureDefinition,
  FeatureMechanic,
  OptionSetDefinition,
  ProgressionTable,
  ProgressionValue,
  Requirement,
  SelectionMechanic,
} from "../domain/types";

export class ContentRegistry {
  private readonly classes = new Map<string, ClassDefinition>();
  private readonly optionSets = new Map<string, OptionSetDefinition>();
  private readonly features = new Map<string, FeatureDefinition>();
  private readonly mechanics = new Map<string, FeatureMechanic>();
  private readonly progressionTables = new Map<string, ProgressionTable>();

  registerClass(definition: ClassDefinition): void {
    if (this.classes.has(definition.id)) {
      throw new Error("Duplicate class id: " + definition.id);
    }
    if (this.progressionTables.has(definition.progression.id)) {
      throw new Error("Duplicate progression table id: " + definition.progression.id);
    }

    // Validate every child before mutating any index. A failed registration is atomic.
    const featureIds = new Set<string>();
    const mechanicIds = new Set<string>();
    for (const feature of definition.features) {
      if (featureIds.has(feature.id) || this.features.has(feature.id)) {
        throw new Error("Duplicate feature id: " + feature.id);
      }
      featureIds.add(feature.id);

      for (const mechanic of feature.mechanics) {
        if (mechanicIds.has(mechanic.id) || this.mechanics.has(mechanic.id)) {
          throw new Error("Duplicate mechanic id: " + mechanic.id);
        }
        mechanicIds.add(mechanic.id);
      }
    }

    this.classes.set(definition.id, definition);
    this.progressionTables.set(definition.progression.id, definition.progression);
    for (const feature of definition.features) this.addFeature(feature);
  }

  registerFeature(definition: FeatureDefinition): void {
    this.assertFeatureCanRegister(definition);
    this.addFeature(definition);
  }

  registerProgressionTable(definition: ProgressionTable): void {
    if (this.progressionTables.has(definition.id)) {
      throw new Error("Duplicate progression table id: " + definition.id);
    }
    this.progressionTables.set(definition.id, definition);
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

  getProgressionTable(id: string): ProgressionTable | undefined {
    return this.progressionTables.get(id);
  }

  listClasses(): ClassDefinition[] {
    return [...this.classes.values()];
  }

  listFeatures(): FeatureDefinition[] {
    return [...this.features.values()];
  }

  listOptionSets(): OptionSetDefinition[] {
    return [...this.optionSets.values()];
  }

  validateReferences(): EngineIssue[] {
    const issues: EngineIssue[] = [];
    const selectionMechanics = new Map<string, SelectionMechanic>();

    for (const mechanic of this.mechanics.values()) {
      if (mechanic.kind === "selection") selectionMechanics.set(mechanic.id, mechanic);
    }

    for (const feature of this.features.values()) {
      for (const mechanic of feature.mechanics) {
        if (mechanic.kind === "selection" || mechanic.kind === "spell-modifier") {
          const optionSet = this.optionSets.get(mechanic.optionSetId);
          if (!optionSet) {
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
          } else if (
            feature.ruleset !== "shared" &&
            optionSet.ruleset !== "shared" &&
            feature.ruleset !== optionSet.ruleset
          ) {
            issues.push({
              code: "incompatible-ruleset",
              message:
                "Feature " +
                feature.id +
                " (" +
                feature.ruleset +
                ") references option set " +
                optionSet.id +
                " (" +
                optionSet.ruleset +
                ").",
              subjectId: mechanic.id,
            });
          }
        }

        if (mechanic.kind === "assignment" && !selectionMechanics.has(mechanic.selectionId)) {
          issues.push({
            code: "missing-selection",
            message:
              "Assignment " +
              mechanic.id +
              " references missing selection mechanic " +
              mechanic.selectionId +
              ".",
            subjectId: mechanic.id,
          });
        }

        const progressionValues: ProgressionValue[] = [];
        if (mechanic.kind === "selection") progressionValues.push(mechanic.count);
        if (mechanic.kind === "assignment") progressionValues.push(mechanic.capacity);
        if (mechanic.kind === "resource-pool") progressionValues.push(mechanic.maximum);
        for (const value of progressionValues) {
          this.validateProgressionReference(value, mechanic.id, issues);
        }
      }
    }

    for (const optionSet of this.optionSets.values()) {
      for (const option of optionSet.options) {
        for (const requirement of option.prerequisites ?? []) {
          this.validateRequirementReferences(requirement, option.id, selectionMechanics, issues);
        }
      }
    }

    return issues;
  }

  private assertFeatureCanRegister(definition: FeatureDefinition): void {
    if (this.features.has(definition.id)) {
      throw new Error("Duplicate feature id: " + definition.id);
    }

    const incomingMechanicIds = new Set<string>();
    for (const mechanic of definition.mechanics) {
      if (incomingMechanicIds.has(mechanic.id) || this.mechanics.has(mechanic.id)) {
        throw new Error("Duplicate mechanic id: " + mechanic.id);
      }
      incomingMechanicIds.add(mechanic.id);
    }
  }

  private addFeature(definition: FeatureDefinition): void {
    this.features.set(definition.id, definition);
    for (const mechanic of definition.mechanics) this.mechanics.set(mechanic.id, mechanic);
  }

  private validateProgressionReference(
    value: ProgressionValue,
    subjectId: string,
    issues: EngineIssue[],
  ): void {
    if (value.kind !== "class-table") return;

    const table = this.progressionTables.get(value.tableId);
    if (!table) {
      issues.push({
        code: "missing-progression-table",
        message: "Mechanic " + subjectId + " references missing progression table " + value.tableId + ".",
        subjectId,
      });
      return;
    }

    if (!table.rows.some((row) => Object.prototype.hasOwnProperty.call(row.values, value.column))) {
      issues.push({
        code: "missing-progression-column",
        message:
          "Progression table " +
          table.id +
          " does not define column " +
          value.column +
          " used by mechanic " +
          subjectId +
          ".",
        subjectId,
      });
    }

    const levelSource = value.levelFromClassId ?? table.levelFromClassId;
    if (levelSource && !this.classes.has(levelSource)) {
      issues.push({
        code: "missing-progression-class",
        message:
          "Progression table " +
          table.id +
          " uses unknown class-level source " +
          levelSource +
          ".",
        subjectId,
      });
    }
  }

  private validateRequirementReferences(
    requirement: Requirement,
    subjectId: string,
    selectionMechanics: Map<string, SelectionMechanic>,
    issues: EngineIssue[],
  ): void {
    switch (requirement.kind) {
      case "class-level":
        if (!this.classes.has(requirement.classId)) {
          issues.push({
            code: "missing-class",
            message: "Requirement references missing class " + requirement.classId + ".",
            subjectId,
          });
        }
        return;
      case "feature-owned":
        if (!this.features.has(requirement.featureId)) {
          issues.push({
            code: "missing-feature",
            message: "Requirement references missing feature " + requirement.featureId + ".",
            subjectId,
          });
        }
        return;
      case "known-option": {
        const selection = selectionMechanics.get(requirement.selectionId);
        if (!selection) {
          issues.push({
            code: "missing-selection",
            message: "Requirement references missing selection mechanic " + requirement.selectionId + ".",
            subjectId,
          });
          return;
        }

        const optionSet = this.optionSets.get(selection.optionSetId);
        if (optionSet && !optionSet.options.some((option) => option.id === requirement.optionId)) {
          issues.push({
            code: "missing-option",
            message:
              "Requirement references option " +
              requirement.optionId +
              " that is not in option set " +
              optionSet.id +
              ".",
            subjectId,
          });
        }
        return;
      }
      case "all":
      case "any":
        for (const child of requirement.requirements) {
          this.validateRequirementReferences(child, subjectId, selectionMechanics, issues);
        }
        return;
      case "ability-score":
      case "spell-known":
        // Spell references need a spell registry, which is deliberately not part of this slice.
        return;
    }
  }
}
