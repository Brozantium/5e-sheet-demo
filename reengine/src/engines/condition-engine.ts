import type { Ruleset } from "../domain/types";
import {
  CONDITION_TYPES,
} from "../domain/conditions";
import type {
  ConditionDerivedEffects,
  ConditionInstance,
  ConditionResolutionInput,
  ConditionResolutionIssue,
  ConditionResolutionResult,
  ConditionRollContext,
  ConditionRollModifier,
  ConditionRollPredicate,
  ConditionSource,
  RollMode,
} from "../domain/conditions";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getSourceCreatureId(source: ConditionSource): string | undefined {
  if (isNonEmptyString(source.creatureId)) return source.creatureId;
  if (source.kind === "creature" && isNonEmptyString(source.id)) return source.id;
  return undefined;
}

function mergeRollMode(current: RollMode, next: RollMode): RollMode {
  if (next === "normal") return current;
  if (current === "normal") return next;
  return current === next ? current : "normal";
}

export function combineConditionRollModes(...modes: RollMode[]): RollMode {
  return modes.reduce(mergeRollMode, "normal");
}

function emptyEffects(): ConditionDerivedEffects {
  return {
    activeTypes: [],
    impliedConditions: [],
    rollModifiers: [],
    automaticSavingThrowFailures: [],
    automaticAbilityCheckFailures: [],
    prohibitedHarmfulTargetCreatureIds: [],
    prohibitedDamagingTargetCreatureIds: [],
    automaticCriticalHitWithinFeet: null,
    canSee: true,
    canHear: true,
    awareOfSurroundings: true,
    invisible: false,
    cannotBeTargetedBySightRequiredEffectsUnlessVisible: false,
    physicalProperties: {
      transformedToInanimateSubstance: false,
      weightMultiplier: 1,
      ceasesAging: false,
    },
    actions: {
      canTakeAction: true,
      canTakeBonusAction: true,
      canTakeReaction: true,
      breaksConcentration: false,
      speech: "normal",
    },
    movement: {
      speedIsZero: false,
      speedCannotIncrease: false,
      crawlAllowed: false,
      standUpMovementCost: null,
      cannotStandWhenSpeedIsZero: false,
      cannotWillinglyApproachCreatureIds: [],
      grappleDragRules: [],
    },
    mustDropHeldItems: false,
    mustFallProne: false,
    damageResistances: [],
    damageImmunities: [],
    conditionImmunities: [],
    diseaseImmunity: false,
  };
}

function addUnique<T>(values: T[], value: T): void {
  if (!values.includes(value)) values.push(value);
}

function addRollModifier(
  effects: ConditionDerivedEffects,
  instance: ConditionInstance,
  roll: ConditionRollModifier["roll"],
  perspective: ConditionRollModifier["perspective"],
  mode: Exclude<RollMode, "normal">,
  when: ConditionRollPredicate = { kind: "always" },
  sourceCreatureId?: string,
): void {
  effects.rollModifiers.push({
    conditionId: instance.id,
    conditionType: instance.type,
    affectedCreatureId: instance.affectedCreatureId,
    ...(sourceCreatureId ? { sourceCreatureId } : {}),
    roll,
    perspective,
    mode,
    when,
  });
}

function validateInput(input: ConditionResolutionInput): void {
  if (!input || typeof input !== "object") {
    throw new TypeError("Condition resolution input is required.");
  }
  if (input.ruleset !== "2014" && input.ruleset !== "2024") {
    throw new RangeError("Condition ruleset must be 2014 or 2024.");
  }
  if (!isNonEmptyString(input.affectedCreatureId)) {
    throw new TypeError("Affected creature ID is required.");
  }
  if (!Array.isArray(input.conditions)) {
    throw new TypeError("Condition instances must be an array.");
  }
  for (const condition of input.conditions) {
    if (!condition || typeof condition !== "object") {
      throw new TypeError("Every condition instance must be an object.");
    }
    if (!isNonEmptyString(condition.id)) {
      throw new TypeError("Condition instance ID is required.");
    }
    if (!(CONDITION_TYPES as readonly string[]).includes(condition.type)) {
      throw new RangeError("Unknown condition type: " + String(condition.type));
    }
    if (condition.affectedCreatureId !== input.affectedCreatureId) {
      throw new RangeError("All condition instances must belong to the affected creature.");
    }
    if (!condition.source || typeof condition.source !== "object" ||
        !isNonEmptyString(condition.source.label)) {
      throw new TypeError("Condition source and source label are required.");
    }
    if (!Array.isArray(condition.expiresOn)) {
      throw new TypeError("Condition expiry triggers must be an array.");
    }
  }
}

/**
 * Resolves the non-stacking mechanical state of a creature's active condition
 * instances. It retains per-instance roll rules so contextual effects can be
 * evaluated against the actual source, target, visibility, and distance.
 *
 * This function does not execute actions, movement, saves, timers, or expiry.
 */
export function resolveConditionEffects(
  input: ConditionResolutionInput,
): ConditionResolutionResult {
  validateInput(input);

  const effects = emptyEffects();
  const issues: ConditionResolutionIssue[] = [];
  const uniqueInstances: ConditionInstance[] = [];
  const seenIds = new Set<string>();

  for (const instance of input.conditions) {
    if (seenIds.has(instance.id)) {
      issues.push({
        code: "duplicate-condition-instance-id",
        conditionId: instance.id,
        message: "Condition instance IDs must be unique; duplicate ID " + instance.id + " was ignored.",
      });
      continue;
    }
    seenIds.add(instance.id);
    uniqueInstances.push(instance);
  }

  const activeTypes = new Set(uniqueInstances.map((entry) => entry.type));
  effects.activeTypes = CONDITION_TYPES.filter((type) => activeTypes.has(type));

  const incapacitated = [
    "incapacitated",
    "paralyzed",
    "petrified",
    "stunned",
    "unconscious",
  ].some((type) => activeTypes.has(type as (typeof CONDITION_TYPES)[number]));
  const speedZero = [
    "grappled",
    "paralyzed",
    "petrified",
    "restrained",
    "stunned",
    "unconscious",
  ].some((type) => activeTypes.has(type as (typeof CONDITION_TYPES)[number]));
  const prone = activeTypes.has("prone") || activeTypes.has("unconscious");

  if (["paralyzed", "petrified", "stunned", "unconscious"].some((type) => activeTypes.has(type as (typeof CONDITION_TYPES)[number]))) {
    effects.impliedConditions.push("incapacitated");
  }
  if (activeTypes.has("unconscious")) effects.impliedConditions.push("prone");

  effects.actions.canTakeAction = !incapacitated;
  effects.actions.canTakeBonusAction = !incapacitated;
  effects.actions.canTakeReaction = !incapacitated;
  effects.actions.breaksConcentration = incapacitated;
  if (input.ruleset === "2024" && incapacitated) {
    effects.actions.speech = "none";
  } else if (
    activeTypes.has("paralyzed") ||
    activeTypes.has("petrified") ||
    activeTypes.has("unconscious")
  ) {
    effects.actions.speech = "none";
  } else if (activeTypes.has("stunned") && input.ruleset === "2014") {
    effects.actions.speech = "faltering";
  }

  effects.movement.speedIsZero = speedZero;
  effects.movement.speedCannotIncrease = speedZero;
  effects.movement.crawlAllowed = prone;
  effects.movement.standUpMovementCost = prone ? "half-speed" : null;
  effects.movement.cannotStandWhenSpeedIsZero = prone;

  if (activeTypes.has("paralyzed") || activeTypes.has("petrified") ||
      activeTypes.has("stunned") || activeTypes.has("unconscious")) {
    addUnique(effects.automaticSavingThrowFailures, "str");
    addUnique(effects.automaticSavingThrowFailures, "dex");
  }
  if (activeTypes.has("blinded")) {
    effects.canSee = false;
    addUnique(effects.automaticAbilityCheckFailures, "sight");
  }
  if (activeTypes.has("deafened")) {
    effects.canHear = false;
    addUnique(effects.automaticAbilityCheckFailures, "hearing");
  }

  effects.mustDropHeldItems = activeTypes.has("unconscious");
  effects.mustFallProne = activeTypes.has("unconscious");
  effects.automaticCriticalHitWithinFeet =
    activeTypes.has("paralyzed") || activeTypes.has("unconscious") ? 5 : null;
  effects.awareOfSurroundings = !activeTypes.has("unconscious") && !activeTypes.has("petrified");

  if (activeTypes.has("invisible")) {
    effects.invisible = true;
    effects.cannotBeTargetedBySightRequiredEffectsUnlessVisible = true;
  }

  if (activeTypes.has("petrified")) {
    effects.physicalProperties.transformedToInanimateSubstance = true;
    effects.physicalProperties.weightMultiplier = 10;
    effects.physicalProperties.ceasesAging = true;
    effects.damageResistances.push("all");
    effects.conditionImmunities.push("poisoned");
    if (input.ruleset === "2014") {
      effects.damageImmunities.push("poison");
      effects.diseaseImmunity = true;
    }
  }

  for (const instance of uniqueInstances) {
    const sourceCreatureId = getSourceCreatureId(instance.source);
    switch (instance.type) {
      case "blinded":
        addRollModifier(effects, instance, "attack", "self", "disadvantage");
        addRollModifier(effects, instance, "attack", "against-subject", "advantage");
        break;
      case "charmed":
        if (sourceCreatureId) {
          if (input.ruleset === "2014") {
            addUnique(effects.prohibitedHarmfulTargetCreatureIds, sourceCreatureId);
          } else {
            addUnique(effects.prohibitedDamagingTargetCreatureIds, sourceCreatureId);
          }
          addRollModifier(
            effects,
            instance,
            "ability-check",
            "source",
            "advantage",
            { kind: "social-interaction" },
            sourceCreatureId,
          );
        } else {
          issues.push({
            code: "missing-source-creature",
            conditionId: instance.id,
            message: "Charmed requires the charmer's creature ID for target restrictions and social Advantage.",
          });
        }
        break;
      case "deafened":
        break;
      case "frightened":
        if (sourceCreatureId) {
          addRollModifier(
            effects, instance, "attack", "self", "disadvantage",
            { kind: "source-visible" }, sourceCreatureId,
          );
          addRollModifier(
            effects, instance, "ability-check", "self", "disadvantage",
            { kind: "source-visible" }, sourceCreatureId,
          );
          addUnique(effects.movement.cannotWillinglyApproachCreatureIds, sourceCreatureId);
        } else {
          issues.push({
            code: "missing-source-creature",
            conditionId: instance.id,
            message: "Frightened requires the fear source's creature ID to resolve line of sight and approach restrictions.",
          });
        }
        break;
      case "grappled":
        effects.movement.speedIsZero = true;
        effects.movement.speedCannotIncrease = true;
        if (input.ruleset === "2024") {
          if (sourceCreatureId) {
            addRollModifier(
              effects, instance, "attack", "self", "disadvantage",
              { kind: "target-is-not-source" }, sourceCreatureId,
            );
            effects.movement.grappleDragRules.push({
              grapplerCreatureId: sourceCreatureId,
              extraFeetPerFootMoved: 1,
              exemptWhenTargetIsTiny: true,
              exemptWhenTargetIsAtLeastTwoSizesSmaller: true,
            });
          } else {
            issues.push({
              code: "missing-source-creature",
              conditionId: instance.id,
              message: "2024 Grappled requires the grappler's creature ID for attack and drag rules.",
            });
          }
        }
        break;
      case "incapacitated":
        break;
      case "invisible":
        addRollModifier(
          effects, instance, "attack", "self", "advantage",
          { kind: "affected-creature-unseen" },
        );
        addRollModifier(
          effects, instance, "attack", "against-subject", "disadvantage",
          { kind: "affected-creature-unseen" },
        );
        if (input.ruleset === "2024") {
          addRollModifier(effects, instance, "initiative", "self", "advantage");
        }
        break;
      case "paralyzed":
      case "petrified":
      case "stunned":
      case "unconscious":
        addRollModifier(effects, instance, "attack", "against-subject", "advantage");
        break;
      case "poisoned":
        addRollModifier(effects, instance, "attack", "self", "disadvantage");
        addRollModifier(effects, instance, "ability-check", "self", "disadvantage");
        break;
      case "prone":
        addRollModifier(effects, instance, "attack", "self", "disadvantage");
        addRollModifier(
          effects, instance, "attack", "against-subject", "advantage",
          { kind: "within-distance", feet: 5 },
        );
        addRollModifier(
          effects, instance, "attack", "against-subject", "disadvantage",
          { kind: "beyond-distance", feet: 5 },
        );
        break;
      case "restrained":
        effects.movement.speedIsZero = true;
        effects.movement.speedCannotIncrease = true;
        addRollModifier(effects, instance, "attack", "self", "disadvantage");
        addRollModifier(effects, instance, "attack", "against-subject", "advantage");
        addRollModifier(effects, instance, "saving-throw", "self", "disadvantage");
        break;
    }
  }

  if (input.ruleset === "2024" && incapacitated) {
    addRollModifier(
      effects,
      uniqueInstances.find((entry) => [
        "incapacitated", "paralyzed", "petrified", "stunned", "unconscious",
      ].includes(entry.type))!,
      "initiative",
      "self",
      "disadvantage",
    );
  }

  const uniqueStringLists: Array<keyof ConditionDerivedEffects> = [
    "prohibitedHarmfulTargetCreatureIds",
    "prohibitedDamagingTargetCreatureIds",
    "automaticSavingThrowFailures",
    "automaticAbilityCheckFailures",
    "conditionImmunities",
    "damageResistances",
    "damageImmunities",
  ];
  for (const key of uniqueStringLists) {
    const list = effects[key];
    if (Array.isArray(list)) (effects as unknown as Record<string, unknown>)[key] = [...new Set(list)];
  }

  return {
    valid: issues.length === 0,
    effects,
    issues,
  };
}

/** Returns true when a contextual condition rule applies to the supplied roll. */
export function conditionRollModifierApplies(
  modifier: ConditionRollModifier,
  context: ConditionRollContext,
): boolean {
  if (!modifier || !context || typeof context !== "object") {
    throw new TypeError("Condition roll modifier and context are required.");
  }
  if (
    modifier.roll !== context.roll ||
    modifier.perspective !== context.perspective ||
    modifier.affectedCreatureId !== context.affectedCreatureId
  ) {
    return false;
  }

  if (context.perspective === "self" && context.actorCreatureId !== context.affectedCreatureId) {
    return false;
  }
  if (context.perspective === "against-subject" && context.targetCreatureId !== context.affectedCreatureId) {
    return false;
  }
  if (
    context.perspective === "source" &&
    (context.actorCreatureId !== modifier.sourceCreatureId ||
      context.targetCreatureId !== context.affectedCreatureId)
  ) {
    return false;
  }

  switch (modifier.when.kind) {
    case "always":
      return true;
    case "source-visible":
      return !!modifier.sourceCreatureId &&
        (context.visibleCreatureIds ?? []).includes(modifier.sourceCreatureId);
    case "affected-creature-unseen":
      return context.perspective === "self"
        ? context.targetCanSeeAffectedCreature === false
        : !(context.visibleCreatureIds ?? []).includes(context.affectedCreatureId);
    case "target-is-source":
      return !!modifier.sourceCreatureId && context.targetCreatureId === modifier.sourceCreatureId;
    case "target-is-not-source":
      return !!modifier.sourceCreatureId && context.targetCreatureId !== modifier.sourceCreatureId;
    case "within-distance":
      return typeof context.distanceFeet === "number" &&
        context.distanceFeet >= 0 &&
        context.distanceFeet <= modifier.when.feet;
    case "beyond-distance":
      return typeof context.distanceFeet === "number" &&
        context.distanceFeet > modifier.when.feet;
    case "social-interaction":
      return context.socialInteraction === true;
  }
}

/** Resolves only the condition-derived roll modes that apply to this exact query. */
export function resolveConditionRollMode(input: {
  modifiers: readonly ConditionRollModifier[];
  context: ConditionRollContext;
  additionalModes?: readonly RollMode[];
}): RollMode {
  if (!input || !Array.isArray(input.modifiers)) {
    throw new TypeError("Condition roll-mode input is required.");
  }
  const conditionModes = input.modifiers
    .filter((modifier) => conditionRollModifierApplies(modifier, input.context))
    .map((modifier) => modifier.mode);
  return combineConditionRollModes(...conditionModes, ...(input.additionalModes ?? []));
}
