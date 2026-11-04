import type {
  ClassDefinition,
  ContentSource,
  EngineIssue,
  FeatureDefinition,
  FeatureMechanic,
  OptionDefinition,
  OptionSetDefinition,
  ProgressionTable,
  ProgressionValue,
  Requirement,
  SelectionMechanic,
} from "../domain/types";
import { assertContentId, assertContentRuleset } from "../domain/identity";
import {
  getWeaponPropertyDefinitions,
  WEAPON_MASTERY_DEFINITIONS,
  WEAPON_PROPERTY_DEFINITIONS,
  type ArmorProfile,
  type ItemDefinition as CanonicalItemDefinition,
  type WeaponProfile,
  type WeaponSpecialRuleId,
  type WeaponRange,
} from "../domain/item";

export class ContentRegistry {
  private readonly classes = new Map<string, ClassDefinition>();
  private readonly optionSets = new Map<string, OptionSetDefinition>();
  private readonly features = new Map<string, FeatureDefinition>();
  private readonly mechanics = new Map<string, FeatureMechanic>();
  private readonly progressionTables = new Map<string, ProgressionTable>();
  private readonly items = new Map<string, CanonicalItemDefinition>();

  registerClass(definition: ClassDefinition): void {
    assertContentId(definition.id, "class id");
    assertContentRuleset(definition.ruleset, "class ruleset");
    this.assertNonBlank(definition.name, "class name");
    this.assertSource(definition.source, "class source");
    if (![6, 8, 10, 12].includes(definition.hitDie)) {
      throw new Error("Invalid hit die for class " + definition.id + ".");
    }
    this.assertUniqueStrings(definition.primaryAbilities, "primary abilities");
    this.assertProgressionIdentifiers(definition.progression);

    if (this.classes.has(definition.id)) {
      throw new Error("Duplicate class id: " + definition.id);
    }
    if (this.progressionTables.has(definition.progression.id)) {
      throw new Error("Duplicate progression table id: " + definition.progression.id);
    }

    const featureIds = new Set<string>();
    const mechanicIds = new Set<string>();
    for (const feature of definition.features) {
      this.assertFeatureIdentifiers(feature);
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
    this.assertFeatureIdentifiers(definition);
    this.assertFeatureCanRegister(definition);
    this.addFeature(definition);
  }

  registerProgressionTable(definition: ProgressionTable): void {
    this.assertProgressionIdentifiers(definition);
    if (this.progressionTables.has(definition.id)) {
      throw new Error("Duplicate progression table id: " + definition.id);
    }
    this.progressionTables.set(definition.id, definition);
  }

  registerOptionSet(definition: OptionSetDefinition): void {
    assertContentId(definition.id, "option set id");
    assertContentRuleset(definition.ruleset, "option set ruleset");
    this.assertNonBlank(definition.name, "option set name");
    this.assertSource(definition.source, "option set source");
    if (this.optionSets.has(definition.id)) {
      throw new Error("Duplicate option set id: " + definition.id);
    }

    const optionIds = new Set<string>();
    for (const option of definition.options) {
      this.assertOptionIdentifiers(option);
      if (optionIds.has(option.id)) {
        throw new Error("Duplicate option id " + option.id + " in option set " + definition.id);
      }
      optionIds.add(option.id);
    }

    this.optionSets.set(definition.id, definition);
  }

  registerItem(definition: CanonicalItemDefinition): void {
    assertContentId(definition.id, "item id");
    assertContentRuleset(definition.ruleset, "item ruleset");
    if (definition.baseItemId) assertContentId(definition.baseItemId, "base item reference");
    this.assertItemProfile(definition);
    if (this.items.has(definition.id)) {
      throw new Error("Duplicate item id: " + definition.id);
    }
    this.items.set(definition.id, definition);
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

  getItem(id: string): CanonicalItemDefinition | undefined {
    return this.items.get(id);
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

  listItems(): CanonicalItemDefinition[] {
    return [...this.items.values()];
  }

  validateReferences(): EngineIssue[] {
    const issues: EngineIssue[] = [];
    const selectionMechanics = new Map<string, SelectionMechanic>();
    const referencedProgressionTableIds = new Set<string>();

    for (const mechanic of this.mechanics.values()) {
      if (mechanic.kind === "selection") selectionMechanics.set(mechanic.id, mechanic);
    }

    for (const classDefinition of this.classes.values()) {
      for (const feature of classDefinition.features) {
        if (
          classDefinition.ruleset !== "shared" &&
          feature.ruleset !== "shared" &&
          classDefinition.ruleset !== feature.ruleset
        ) {
          issues.push({
            code: "incompatible-ruleset",
            message:
              "Class " + classDefinition.id + " (" + classDefinition.ruleset +
              ") contains feature " + feature.id + " (" + feature.ruleset + ").",
            subjectId: feature.id,
          });
        }
      }
    }

    for (const feature of this.features.values()) {
      for (const mechanic of feature.mechanics) {
        if (mechanic.kind === "selection" || mechanic.kind === "spell-modifier") {
          const optionSet = this.optionSets.get(mechanic.optionSetId);
          if (!optionSet) {
            issues.push({
              code: "missing-option-set",
              message:
                "Feature " + feature.id + " references missing option set " + mechanic.optionSetId + ".",
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
                "Feature " + feature.id + " (" + feature.ruleset + ") references option set " +
                optionSet.id + " (" + optionSet.ruleset + ").",
              subjectId: mechanic.id,
            });
          }
        }

        if (mechanic.kind === "assignment" && !selectionMechanics.has(mechanic.selectionId)) {
          issues.push({
            code: "missing-selection",
            message:
              "Assignment " + mechanic.id + " references missing selection mechanic " +
              mechanic.selectionId + ".",
            subjectId: mechanic.id,
          });
        }

        const progressionValues: ProgressionValue[] = [];
        if (mechanic.kind === "selection") progressionValues.push(mechanic.count);
        if (mechanic.kind === "assignment") progressionValues.push(mechanic.capacity);
        if (mechanic.kind === "resource-pool") progressionValues.push(mechanic.maximum);
        for (const value of progressionValues) {
          this.validateProgressionReference(value, mechanic.id, issues);
          if (value.kind === "class-table") referencedProgressionTableIds.add(value.tableId);
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

    for (const table of this.progressionTables.values()) {
      if (referencedProgressionTableIds.has(table.id)) continue;
      const levelSource = table.levelFromClassId ?? table.classId;
      if (!this.classes.has(levelSource)) {
        issues.push({
          code: "missing-progression-class",
          message: "Progression table " + table.id + " uses unknown class-level source " + levelSource + ".",
          subjectId: table.id,
        });
      }
    }

    for (const item of this.items.values()) {
      if (!item.baseItemId) continue;
      const baseItem = this.items.get(item.baseItemId);
      if (!baseItem) {
        issues.push({
          code: "missing-base-item",
          message: "Item " + item.id + " references missing base item " + item.baseItemId + ".",
          subjectId: item.id,
        });
        continue;
      }
      if (
        item.ruleset !== "shared" &&
        baseItem.ruleset !== "shared" &&
        item.ruleset !== baseItem.ruleset
      ) {
        issues.push({
          code: "incompatible-ruleset",
          message:
            "Item " + item.id + " (" + item.ruleset + ") references base item " +
            baseItem.id + " (" + baseItem.ruleset + ").",
          subjectId: item.id,
        });
      }
    }

    return issues;
  }

  private assertItemProfile(definition: CanonicalItemDefinition): void {
    // Read the raw profile slots separately from the discriminated union. This
    // also catches malformed parsed JSON passed through an unsafe cast.
    const profiles = definition as unknown as {
      weaponProfile?: WeaponProfile;
      armorProfile?: ArmorProfile;
    };

    this.assertNonBlank(definition.name, "item name");
    this.assertSource(definition.source, "item source");
    this.assertUniqueStrings(definition.properties, "item properties");
    this.assertUniqueStrings(definition.tags, "item tags");

    if (definition.category === "weapon") {
      if (!profiles.weaponProfile) {
        throw new Error("Weapon item " + definition.id + " requires a weapon profile.");
      }
      if (profiles.armorProfile) {
        throw new Error("Weapon item " + definition.id + " cannot define an armor profile.");
      }
    }
    if (definition.category === "armor") {
      if (!profiles.armorProfile || profiles.armorProfile.armorCategory === "shield") {
        throw new Error("Armor item " + definition.id + " requires a non-shield armor profile.");
      }
      if (profiles.weaponProfile) {
        throw new Error("Armor item " + definition.id + " cannot define a weapon profile.");
      }
    }
    if (definition.category === "shield") {
      if (profiles.armorProfile?.armorCategory !== "shield") {
        throw new Error("Shield item " + definition.id + " requires a shield armor profile.");
      }
      if (profiles.weaponProfile) {
        throw new Error("Shield item " + definition.id + " cannot define a weapon profile.");
      }
    }
    if (
      ["gear", "tool", "ammunition", "consumable"].includes(definition.category) &&
      (profiles.weaponProfile || profiles.armorProfile)
    ) {
      throw new Error("Non-combat item " + definition.id + " cannot define weapon or armor profiles.");
    }

    if (profiles.weaponProfile) {
      this.assertWeaponProfile(definition, profiles.weaponProfile);
    }

    if (profiles.armorProfile) {
      this.assertNonNegativeInteger(profiles.armorProfile.baseAC, "armor base AC");
      if (
        profiles.armorProfile.maxDexterityModifier !== undefined &&
        profiles.armorProfile.maxDexterityModifier !== null
      ) {
        this.assertNonNegativeInteger(profiles.armorProfile.maxDexterityModifier, "maximum Dexterity modifier");
      }
      if (profiles.armorProfile.strengthRequirement !== undefined) {
        this.assertNonNegativeInteger(profiles.armorProfile.strengthRequirement, "armor Strength requirement");
      }
    }
  }

  private assertWeaponProfile(
    definition: CanonicalItemDefinition,
    profile: WeaponProfile,
  ): void {
    const properties = new Set(definition.properties ?? []);
    const knownPropertyIds = new Set<string>(
      WEAPON_PROPERTY_DEFINITIONS.map((property) => property.id),
    );
    const allowedPropertyIds = new Set<string>(
      getWeaponPropertyDefinitions(definition.ruleset).map((property) => property.id),
    );

    for (const property of properties) {
      if (!knownPropertyIds.has(property)) {
        throw new Error("Weapon item " + definition.id + " has unknown property " + property + ".");
      }
      if (!allowedPropertyIds.has(property)) {
        throw new Error(
          "Weapon item " + definition.id + " uses property " + property +
          " which is not available for the " + definition.ruleset + " ruleset.",
        );
      }
    }

    if (!Array.isArray(profile.damage)) {
      throw new Error("Weapon item " + definition.id + " requires a damage component array.");
    }
    if (profile.mastery !== undefined) {
      if (!WEAPON_MASTERY_DEFINITIONS.some((mastery) => mastery.id === profile.mastery)) {
        throw new Error("Weapon item " + definition.id + " has unknown Weapon Mastery " + profile.mastery + ".");
      }
      if (definition.ruleset !== "2024") {
        throw new Error("Weapon Mastery is only available on 2024 weapon content.");
      }
    }

    const specialRules = profile.specialRules ?? [];
    this.assertUniqueStrings(specialRules, "weapon special rules");

    for (const component of profile.damage) {
      this.assertNonBlank(component.formula, "weapon damage formula");
      this.assertNonBlank(component.damageType, "weapon damage type");
      if (component.versatileFormula !== undefined) {
        this.assertNonBlank(component.versatileFormula, "versatile damage formula");
      }
    }

    const isNet = specialRules.includes("net-2014");
    if (profile.damage.length === 0 && !isNet) {
      throw new Error("Weapon item " + definition.id + " requires at least one damage component.");
    }
    if (isNet && profile.damage.length !== 0) {
      throw new Error("The 2014 Net special rule must not define ordinary weapon damage components.");
    }

    if (profile.range !== undefined) {
      this.assertWeaponRange(profile.range, "weapon range");
      if (profile.weaponType !== "ranged") {
        throw new Error("Weapon item " + definition.id + " can only define standard range for a ranged weapon.");
      }
    }

    const hasAmmunition = properties.has("ammunition");
    if (hasAmmunition) {
      if (profile.weaponType !== "ranged") {
        throw new Error("The Ammunition property requires a ranged weapon.");
      }
      if (!profile.range) {
        throw new Error("Weapon item " + definition.id + " requires range when it has Ammunition.");
      }
      if (profile.ammunitionType === undefined) {
        throw new Error("Weapon item " + definition.id + " requires ammunitionType when it has Ammunition.");
      }
      this.assertNonBlank(profile.ammunitionType, "weapon ammunition type");
    } else if (profile.ammunitionType !== undefined) {
      throw new Error("Weapon item " + definition.id + " defines ammunitionType without Ammunition.");
    }

    if (properties.has("loading") && !hasAmmunition) {
      throw new Error("The Loading property requires Ammunition.");
    }

    const hasThrown = properties.has("thrown");
    if (hasThrown) {
      if (!profile.thrownRange) {
        throw new Error("Weapon item " + definition.id + " requires thrownRange when it has Thrown.");
      }
      this.assertWeaponRange(profile.thrownRange, "weapon thrown range");
    } else if (profile.thrownRange !== undefined) {
      throw new Error("Weapon item " + definition.id + " defines thrownRange without Thrown.");
    }

    if (profile.weaponType === "ranged" && !profile.range && !profile.thrownRange) {
      throw new Error("Ranged weapon " + definition.id + " requires a standard or Thrown range.");
    }

    if (properties.has("reach") && profile.weaponType !== "melee") {
      throw new Error("The Reach property requires a melee weapon.");
    }
    if (properties.has("versatile")) {
      if (profile.weaponType !== "melee") {
        throw new Error("The Versatile property requires a melee weapon.");
      }
      if (!profile.damage[0]?.versatileFormula) {
        throw new Error("Weapon item " + definition.id + " requires a primary versatileFormula.");
      }
    } else if (profile.damage.some((component) => component.versatileFormula !== undefined)) {
      throw new Error("Weapon item " + definition.id + " defines versatileFormula without Versatile.");
    }

    if (profile.twoHandedRule !== undefined) {
      if (!properties.has("two-handed")) {
        throw new Error("Weapon item " + definition.id + " defines a twoHandedRule without Two-Handed.");
      }
      if (
        profile.twoHandedRule.unlessMounted !== undefined &&
        profile.twoHandedRule.unlessMounted !== true
      ) {
        throw new Error("Weapon item " + definition.id + " has an invalid mounted two-handed exception.");
      }
      if (
        profile.twoHandedRule.unlessMounted === true &&
        definition.ruleset !== "2024"
      ) {
        throw new Error("The unlessMounted Two-Handed exception is only supported for 2024 weapon content.");
      }
    }

    if (specialRules.length > 0 && !properties.has("special")) {
      throw new Error("Weapon item " + definition.id + " defines Special rules without the Special property.");
    }
    if (properties.has("special") && specialRules.length === 0) {
      throw new Error("Weapon item " + definition.id + " requires structured specialRules for Special.");
    }
    for (const specialRule of specialRules) {
      if (specialRule !== "lance-2014" && specialRule !== "net-2014") {
        throw new Error("Weapon item " + definition.id + " has unknown special rule " + specialRule + ".");
      }
      if (definition.ruleset !== "2014") {
        throw new Error("Weapon item " + definition.id + " uses a 2014 Special rule in non-2014 content.");
      }
      this.assert2014SpecialRuleCompatibility(definition.id, profile, properties, specialRule);
    }
  }

  private assert2014SpecialRuleCompatibility(
    itemId: string,
    profile: WeaponProfile,
    properties: Set<string>,
    specialRule: WeaponSpecialRuleId,
  ): void {
    if (specialRule === "lance-2014") {
      if (profile.weaponType !== "melee" || !properties.has("reach")) {
        throw new Error("The 2014 Lance Special rule requires a melee Reach weapon.");
      }
      return;
    }
    if (specialRule === "net-2014") {
      if (profile.weaponType !== "ranged" || !properties.has("thrown") || !profile.thrownRange) {
        throw new Error("The 2014 Net Special rule requires a ranged Thrown weapon with thrownRange.");
      }
      return;
    }
    throw new Error("Weapon item " + itemId + " has an unsupported 2014 Special rule.");
  }

  private assertWeaponRange(range: WeaponRange, field: string): void {
    this.assertPositiveInteger(range.normal, field + " normal distance");
    this.assertPositiveInteger(range.long, field + " long distance");
    if (range.long < range.normal) {
      throw new Error("Invalid " + field + ": long range cannot be shorter than normal range.");
    }
  }

  private assertNonBlank(value: string, field: string): void {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error("Invalid " + field + ": expected non-empty text.");
    }
  }

  private assertUniqueStrings(values: string[] | undefined, field: string, minItems = 0): void {
    if (!values) return;
    if (values.length < minItems) {
      throw new Error("Invalid " + field + ": expected at least " + minItems + " entries.");
    }
    for (const value of values) this.assertNonBlank(value, field + " entry");
    if (new Set(values).size !== values.length) {
      throw new Error("Invalid " + field + ": entries must be unique.");
    }
  }

  private assertSource(source: ContentSource | undefined, field: string): void {
    if (!source) return;
    if (source.book !== undefined) this.assertNonBlank(source.book, field + " book");
    if (source.publisher !== undefined) this.assertNonBlank(source.publisher, field + " publisher");
    if (source.license !== undefined) this.assertNonBlank(source.license, field + " license");
    if (typeof source.page === "number" && !Number.isFinite(source.page)) {
      throw new Error("Invalid " + field + " page: expected a finite number.");
    }
  }

  private assertPositiveInteger(value: number, field: string): void {
    if (!Number.isInteger(value) || value < 1) {
      throw new Error("Invalid " + field + ": expected a positive integer.");
    }
  }

  private assertProgressionIdentifiers(definition: ProgressionTable): void {
    assertContentId(definition.id, "progression table id");
    assertContentId(definition.classId, "progression owner class id");
    if (definition.levelFromClassId) {
      assertContentId(definition.levelFromClassId, "progression level-source class id");
    }

    const seenLevels = new Set<number>();
    for (const row of definition.rows) {
      if (!Number.isInteger(row.level) || row.level < 1 || row.level > 20) {
        throw new Error("Invalid progression row level: " + row.level);
      }
      if (seenLevels.has(row.level)) {
        throw new Error("Duplicate progression row level " + row.level + " in table " + definition.id);
      }
      seenLevels.add(row.level);
      for (const [column, value] of Object.entries(row.values)) {
        if (typeof value === "number" && !Number.isInteger(value)) {
          throw new Error(
            "Progression table " + definition.id + " column " + column + " must use integer values.",
          );
        }
      }
    }
  }

  private assertNonNegativeInteger(value: number, field: string): void {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error("Invalid " + field + ": expected a non-negative integer.");
    }
  }

  private assertFeatureIdentifiers(definition: FeatureDefinition): void {
    assertContentId(definition.id, "feature id");
    assertContentRuleset(definition.ruleset, "feature ruleset");
    this.assertNonBlank(definition.name, "feature name");
    this.assertSource(definition.source, "feature source");
    this.assertUniqueStrings(definition.tags, "feature tags");
    if (!Number.isInteger(definition.level) || definition.level < 0 || definition.level > 20) {
      throw new Error("Invalid feature level: " + definition.level);
    }

    for (const mechanic of definition.mechanics) {
      assertContentId(mechanic.id, "mechanic id");
      if (mechanic.kind === "selection" || mechanic.kind === "spell-modifier") {
        assertContentId(mechanic.optionSetId, "option set reference");
      }
      if (mechanic.kind === "assignment") {
        assertContentId(mechanic.selectionId, "selection reference");
      }
      if (mechanic.kind === "resource-pool" || mechanic.kind === "spell-modifier") {
        assertContentId(mechanic.resourceId, "resource id");
      }

      const progression =
        mechanic.kind === "selection" ? mechanic.count :
        mechanic.kind === "assignment" ? mechanic.capacity :
        mechanic.kind === "resource-pool" ? mechanic.maximum : undefined;

      if (progression?.kind === "fixed") {
        this.assertNonNegativeInteger(progression.value, "fixed progression value");
      }
      if (progression?.kind === "class-table") {
        assertContentId(progression.tableId, "progression table reference");
        if (progression.levelFromClassId) {
          assertContentId(progression.levelFromClassId, "progression level-source reference");
        }
        if (progression.fallback !== undefined) {
          this.assertNonNegativeInteger(progression.fallback, "progression fallback");
        }
      }

      if (mechanic.kind === "selection" && mechanic.replacement) {
        this.assertPositiveInteger(mechanic.replacement.count, "selection replacement count");
      }
      if (mechanic.kind === "assignment") {
        this.assertPositiveInteger(mechanic.maxPerTarget, "assignment maxPerTarget");
        if (mechanic.maxPerOption !== undefined) {
          this.assertPositiveInteger(mechanic.maxPerOption, "assignment maxPerOption");
        }
        this.assertUniqueStrings(mechanic.eligibleItemTags, "eligible item tags");
      }
      if (mechanic.kind === "spell-modifier") {
        this.assertPositiveInteger(mechanic.maxPerSpell, "spell modifier maxPerSpell");
        if (mechanic.replacement) {
          this.assertPositiveInteger(mechanic.replacement.count, "spell modifier replacement count");
        }
      }
      if (mechanic.kind === "action") {
        this.assertUniqueStrings(mechanic.actionIds, "action references", 1);
        mechanic.actionIds.forEach((id) => assertContentId(id, "action reference"));
      }
      if (mechanic.kind === "trigger") {
        this.assertUniqueStrings(mechanic.triggerIds, "trigger references", 1);
        mechanic.triggerIds.forEach((id) => assertContentId(id, "trigger reference"));
      }
    }
  }

  private assertOptionIdentifiers(option: OptionDefinition): void {
    assertContentId(option.id, "option id");
    this.assertNonBlank(option.name, "option name");
    this.assertSource(option.source, "option source");
    this.assertUniqueStrings(option.tags, "option tags");
    for (const requirement of option.prerequisites ?? []) {
      this.assertRequirementIdentifiers(requirement);
    }
    for (const effect of option.effects ?? []) {
      if (effect.kind === "modifier") this.assertNonBlank(effect.target, "effect target");
      if (effect.kind === "grant-spell") assertContentId(effect.spellId, "spell reference");
      if (effect.kind === "defense") this.assertNonBlank(effect.value, "defense value");
      if (effect.kind === "proficiency") this.assertNonBlank(effect.value, "proficiency value");
      if (effect.kind === "action-grant") assertContentId(effect.actionId, "action reference");
    }
    if (option.resourceCost) {
      assertContentId(option.resourceCost.resourceId, "resource id");
      this.assertPositiveInteger(option.resourceCost.amount, "option resource cost for " + option.id);
    }
  }

  private assertRequirementIdentifiers(requirement: Requirement): void {
    switch (requirement.kind) {
      case "class-level":
        assertContentId(requirement.classId, "class reference");
        this.assertPositiveInteger(requirement.minimum, "class-level prerequisite minimum");
        return;
      case "ability-score":
        this.assertPositiveInteger(requirement.minimum, "ability-score prerequisite minimum");
        return;
      case "known-option":
        assertContentId(requirement.selectionId, "selection reference");
        assertContentId(requirement.optionId, "option reference");
        return;
      case "spell-known":
        assertContentId(requirement.spellId, "spell reference");
        return;
      case "feature-owned":
        assertContentId(requirement.featureId, "feature reference");
        return;
      case "all":
      case "any":
        if (requirement.requirements.length === 0) {
          throw new Error("Prerequisite groups must contain at least one requirement.");
        }
        requirement.requirements.forEach((child) => this.assertRequirementIdentifiers(child));
        return;
    }
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
          "Progression table " + table.id + " does not define column " + value.column +
          " used by mechanic " + subjectId + ".",
        subjectId,
      });
    }

    const levelSource = value.levelFromClassId ?? table.levelFromClassId ?? table.classId;
    if (!this.classes.has(levelSource)) {
      issues.push({
        code: "missing-progression-class",
        message:
          "Progression table " + table.id + " uses unknown class-level source " + levelSource + ".",
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
              "Requirement references option " + requirement.optionId +
              " that is not in option set " + optionSet.id + ".",
            subjectId,
          });
        }
        return;
      }
      case "all":
      case "any":
        requirement.requirements.forEach((child) =>
          this.validateRequirementReferences(child, subjectId, selectionMechanics, issues),
        );
        return;
      case "ability-score":
      case "spell-known":
        return;
    }
  }
}
