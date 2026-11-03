import type { ClassDefinition, FeatureDefinition, OptionSetDefinition } from "../domain/types";

export class ContentRegistry {
  private readonly classes = new Map<string, ClassDefinition>();
  private readonly optionSets = new Map<string, OptionSetDefinition>();
  private readonly features = new Map<string, FeatureDefinition>();

  registerClass(definition: ClassDefinition): void {
    this.classes.set(definition.id, definition);
    for (const feature of definition.features) this.registerFeature(feature);
  }

  registerFeature(definition: FeatureDefinition): void {
    this.features.set(definition.id, definition);
  }

  registerOptionSet(definition: OptionSetDefinition): void {
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
}
