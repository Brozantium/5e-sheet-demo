const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveConditionEffects,
  conditionRollModifierApplies,
  resolveConditionRollMode,
  combineConditionRollModes,
} = require("../../.test-dist/engines/condition-engine.js");
const { CONDITION_TYPES } = require("../../.test-dist/domain/conditions.js");

const AFFECTED = "creature:pc";
const SOURCE = "creature:source";
const OTHER = "creature:other";

const condition = (overrides = {}) => ({
  id: "condition:one",
  type: "poisoned",
  affectedCreatureId: AFFECTED,
  source: { kind: "manual", label: "Manual" },
  expiresOn: [{ kind: "manual" }],
  ...overrides,
});

const resolve = (conditions, ruleset = "2014") =>
  resolveConditionEffects({
    ruleset,
    affectedCreatureId: AFFECTED,
    conditions,
  });

const sourceCondition = (type, overrides = {}) =>
  condition({
    type,
    source: {
      kind: "creature",
      id: SOURCE,
      creatureId: SOURCE,
      label: "Source creature",
    },
    ...overrides,
  });

const mode = (result, context, additionalModes) =>
  resolveConditionRollMode({
    modifiers: result.effects.rollModifiers,
    context,
    additionalModes,
  });

const selfContext = (roll, overrides = {}) => ({
  roll,
  perspective: "self",
  affectedCreatureId: AFFECTED,
  actorCreatureId: AFFECTED,
  ...overrides,
});

const incomingContext = (roll, overrides = {}) => ({
  roll,
  perspective: "against-subject",
  affectedCreatureId: AFFECTED,
  actorCreatureId: OTHER,
  targetCreatureId: AFFECTED,
  distanceFeet: 10,
  visibleCreatureIds: [AFFECTED],
  ...overrides,
});

test("condition catalog defines all fourteen non-Exhaustion conditions", () => {
  assert.equal(CONDITION_TYPES.length, 14);
  assert.deepEqual([...CONDITION_TYPES].sort(), [
    "blinded", "charmed", "deafened", "frightened", "grappled",
    "incapacitated", "invisible", "paralyzed", "petrified", "poisoned",
    "prone", "restrained", "stunned", "unconscious",
  ]);
});

test("multiple instances preserve independent IDs and expiry while their effects do not stack", () => {
  const first = condition({
    id: "condition:first",
    expiresOn: [{ kind: "turn", creatureId: AFFECTED, boundary: "end", afterTurns: 1 }],
  });
  const second = condition({
    id: "condition:second",
    expiresOn: [{ kind: "rest", rest: "short" }],
  });
  const result = resolve([first, second], "2024");

  assert.equal(result.valid, true);
  assert.deepEqual(result.effects.activeTypes, ["poisoned"]);
  assert.equal(result.effects.rollModifiers.length, 2);
  assert.equal(
    mode(result, selfContext("attack")),
    "disadvantage",
    "two instances of one condition still yield only one Disadvantage",
  );
  assert.deepEqual(first.expiresOn, [
    { kind: "turn", creatureId: AFFECTED, boundary: "end", afterTurns: 1 },
  ]);
  assert.deepEqual(second.expiresOn, [{ kind: "rest", rest: "short" }]);
});

test("duplicate instance IDs are reported and the duplicate record is ignored", () => {
  const result = resolve([
    condition({ id: "same", type: "poisoned" }),
    condition({ id: "same", type: "prone" }),
  ]);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "duplicate-condition-instance-id"));
  assert.deepEqual(result.effects.activeTypes, ["poisoned"]);
});

test("resolver rejects invalid rulesets, mismatched affected creature IDs, and invalid condition types", () => {
  assert.throws(() => resolveConditionEffects({
    ruleset: "2014",
    affectedCreatureId: AFFECTED,
    conditions: [condition({ affectedCreatureId: OTHER })],
  }), /must belong to the affected creature/);

  assert.throws(() => resolveConditionEffects({
    ruleset: "2014",
    affectedCreatureId: AFFECTED,
    conditions: [condition({ type: "exhaustion" })],
  }), /Unknown condition type/);

  assert.throws(() => resolveConditionEffects({
    ruleset: "2015",
    affectedCreatureId: AFFECTED,
    conditions: [],
  }), /ruleset must be 2014 or 2024/);
});

test("Blinded applies outgoing Disadvantage, incoming Advantage, and sight-check auto-failure", () => {
  const result = resolve([condition({ type: "blinded" })], "2024");
  assert.equal(mode(result, selfContext("attack")), "disadvantage");
  assert.equal(mode(result, incomingContext("attack")), "advantage");
  assert.deepEqual(result.effects.automaticAbilityCheckFailures, ["sight"]);
  assert.equal(result.effects.canSee, false);
});

test("Charmed blocks harmful targeting of its charmer and grants the charmer social-check Advantage", () => {
  const result = resolve([sourceCondition("charmed")], "2024");
  assert.deepEqual(result.effects.prohibitedHarmfulTargetCreatureIds, []);
  assert.deepEqual(result.effects.prohibitedDamagingTargetCreatureIds, [SOURCE]);
  assert.equal(
    mode(result, {
      roll: "ability-check",
      perspective: "source",
      affectedCreatureId: AFFECTED,
      actorCreatureId: SOURCE,
      targetCreatureId: AFFECTED,
      socialInteraction: true,
    }),
    "advantage",
  );
  assert.equal(
    mode(result, {
      roll: "ability-check",
      perspective: "source",
      affectedCreatureId: AFFECTED,
      actorCreatureId: SOURCE,
      targetCreatureId: AFFECTED,
      socialInteraction: false,
    }),
    "normal",
  );
});

test("Charmed without a charmer creature ID returns a diagnostic rather than guessing", () => {
  const result = resolve([condition({ type: "charmed" })]);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "missing-source-creature"));
  assert.deepEqual(result.effects.prohibitedHarmfulTargetCreatureIds, []);
  assert.deepEqual(result.effects.prohibitedDamagingTargetCreatureIds, []);
});

test("2014 Charmed prevents harmful abilities and magical effects against the charmer", () => {
  const result = resolve([sourceCondition("charmed")], "2014");
  assert.deepEqual(result.effects.prohibitedHarmfulTargetCreatureIds, [SOURCE]);
  assert.deepEqual(result.effects.prohibitedDamagingTargetCreatureIds, []);
});

test("Deafened makes hearing-dependent ability checks automatically fail", () => {
  const result = resolve([condition({ type: "deafened" })]);
  assert.deepEqual(result.effects.automaticAbilityCheckFailures, ["hearing"]);
  assert.equal(result.effects.canHear, false);
});

test("Frightened only penalizes rolls while its specific source is visible", () => {
  const result = resolve([sourceCondition("frightened")]);
  assert.equal(
    mode(result, selfContext("attack", { visibleCreatureIds: [SOURCE] })),
    "disadvantage",
  );
  assert.equal(
    mode(result, selfContext("ability-check", { visibleCreatureIds: [SOURCE] })),
    "disadvantage",
  );
  assert.equal(
    mode(result, selfContext("attack", { visibleCreatureIds: [OTHER] })),
    "normal",
  );
  assert.deepEqual(result.effects.movement.cannotWillinglyApproachCreatureIds, [SOURCE]);
});

test("Frightened without a source creature ID reports missing context and does not invent a target", () => {
  const result = resolve([condition({ type: "frightened" })]);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "missing-source-creature"));
  assert.deepEqual(result.effects.movement.cannotWillinglyApproachCreatureIds, []);
});

test("2014 Grappled sets Speed to 0 but does not add the 2024 attack/drag rules", () => {
  const result = resolve([sourceCondition("grappled")], "2014");
  assert.equal(result.effects.movement.speedIsZero, true);
  assert.equal(result.effects.movement.speedCannotIncrease, true);
  assert.equal(result.effects.movement.grappleDragRules.length, 0);
  assert.equal(result.effects.rollModifiers.length, 0);
});

test("2024 Grappled penalizes attacks against other targets, not the grappler, and returns drag rules", () => {
  const result = resolve([sourceCondition("grappled")], "2024");
  assert.equal(result.effects.movement.speedIsZero, true);
  assert.equal(result.effects.movement.grappleDragRules.length, 1);
  assert.equal(
    mode(result, selfContext("attack", { targetCreatureId: OTHER })),
    "disadvantage",
  );
  assert.equal(
    mode(result, selfContext("attack", { targetCreatureId: SOURCE })),
    "normal",
  );
  assert.equal(
    mode(result, selfContext("attack")),
    "normal",
    "an attack check without a selected target cannot assume the target is not the grappler",
  );
});

test("2024 Grappled with multiple grapplers exempts attacks against any active grappler", () => {
  const first = sourceCondition("grappled", { id: "grapple:first" });
  const second = sourceCondition("grappled", {
    id: "grapple:second",
    source: {
      kind: "creature",
      id: OTHER,
      creatureId: OTHER,
      label: "Other grappler",
    },
  });
  const result = resolve([first, second], "2024");
  assert.equal(
    mode(result, selfContext("attack", { targetCreatureId: SOURCE })),
    "normal",
  );
  assert.equal(
    mode(result, selfContext("attack", { targetCreatureId: OTHER })),
    "normal",
  );
  assert.equal(
    mode(result, selfContext("attack", { targetCreatureId: "creature:third" })),
    "disadvantage",
  );
  assert.equal(result.effects.movement.grappleDragRules.length, 2);
});

test("Grappled requires source identity for lifecycle resolution in both rulesets", () => {
  for (const ruleset of ["2014", "2024"]) {
    const result = resolve([condition({ type: "grappled" })], ruleset);
    assert.equal(result.valid, false);
    assert.ok(result.issues.some((issue) => issue.code === "missing-source-creature"));
  }
});

test("Incapacitated blocks actions and reactions and breaks Concentration in both rulesets", () => {
  for (const ruleset of ["2014", "2024"]) {
    const result = resolve([condition({ type: "incapacitated" })], ruleset);
    assert.equal(result.effects.actions.canTakeAction, false);
    assert.equal(result.effects.actions.canTakeBonusAction, false);
    assert.equal(result.effects.actions.canTakeReaction, false);
    assert.equal(result.effects.actions.breaksConcentration, true);
  }
});

test("2024 Incapacitated is speechless and imposes Disadvantage on Initiative", () => {
  const result = resolve([condition({ type: "incapacitated" })], "2024");
  assert.equal(result.effects.actions.speech, "none");
  assert.equal(mode(result, selfContext("initiative")), "disadvantage");
});

test("2014 Incapacitated does not itself silence the creature or change Initiative", () => {
  const result = resolve([condition({ type: "incapacitated" })], "2014");
  assert.equal(result.effects.actions.speech, "normal");
  assert.equal(mode(result, selfContext("initiative")), "normal");
});

test("Invisible modifies attack rolls only while the relevant observer cannot see the creature", () => {
  const result = resolve([condition({ type: "invisible" })], "2024");
  assert.equal(
    mode(result, selfContext("attack", { targetCreatureId: OTHER, targetCanSeeAffectedCreature: false })),
    "advantage",
  );
  assert.equal(
    mode(result, selfContext("attack", { targetCreatureId: OTHER, targetCanSeeAffectedCreature: true })),
    "normal",
  );
  assert.equal(
    mode(result, incomingContext("attack", { visibleCreatureIds: [] })),
    "disadvantage",
  );
  assert.equal(
    mode(result, incomingContext("attack", { visibleCreatureIds: [AFFECTED] })),
    "normal",
  );
  assert.equal(result.effects.invisibleEquipmentConcealed, true);
});

test("Invisible grants Initiative Advantage only under the 2024 ruleset", () => {
  assert.equal(mode(resolve([condition({ type: "invisible" })], "2024"), selfContext("initiative")), "advantage");
  assert.equal(mode(resolve([condition({ type: "invisible" })], "2014"), selfContext("initiative")), "normal");
});

test("Paralyzed imposes automatic STR/DEX save failure, incoming Advantage, and implied Incapacitated", () => {
  const result = resolve([condition({ type: "paralyzed" })]);
  assert.deepEqual(result.effects.automaticSavingThrowFailures, ["str", "dex"]);
  assert.equal(mode(result, incomingContext("attack")), "advantage");
  assert.ok(result.effects.impliedConditions.includes("incapacitated"));
  assert.equal(result.effects.movement.speedIsZero, true);
  assert.equal(result.effects.automaticCriticalHitWithinFeet, 5);
  assert.equal(result.effects.actions.speech, "none");
  assert.equal(result.effects.automaticCriticalHitWithinFeet, 5);
});

test("Petrified 2014 grants all-damage resistance, poison and disease immunity", () => {
  const result = resolve([condition({ type: "petrified" })], "2014");
  assert.deepEqual(result.effects.damageResistances, ["all"]);
  assert.equal(result.effects.physicalProperties.nonmagicalWornAndCarriedEquipmentTransforms, true);
  assert.equal(result.effects.physicalProperties.weightMultiplier, 10);
  assert.equal(result.effects.awareOfSurroundings, false);
  assert.deepEqual(result.effects.damageImmunities, ["poison"]);
  assert.deepEqual(result.effects.conditionImmunities, ["poisoned"]);
  assert.equal(result.effects.diseaseImmunity, true);
  assert.deepEqual(result.effects.automaticSavingThrowFailures, ["str", "dex"]);
  assert.equal(mode(result, incomingContext("attack")), "advantage");
});

test("Petrified 2024 grants all-damage resistance and Poisoned-condition immunity, not legacy disease immunity", () => {
  const result = resolve([condition({ type: "petrified" })], "2024");
  assert.deepEqual(result.effects.damageResistances, ["all"]);
  assert.equal(result.effects.physicalProperties.nonmagicalWornAndCarriedEquipmentTransforms, true);
  assert.equal(result.effects.physicalProperties.weightMultiplier, 10);
  assert.deepEqual(result.effects.damageImmunities, []);
  assert.deepEqual(result.effects.conditionImmunities, ["poisoned"]);
  assert.equal(result.effects.diseaseImmunity, false);
});

test("Poisoned imposes Disadvantage on outgoing attacks and ability checks", () => {
  const result = resolve([condition({ type: "poisoned" })]);
  assert.equal(mode(result, selfContext("attack")), "disadvantage");
  assert.equal(mode(result, selfContext("ability-check")), "disadvantage");
});

test("Prone uses the exact 5-foot boundary for incoming attacks and returns stand/crawl constraints", () => {
  const result = resolve([condition({ type: "prone" })]);
  assert.equal(mode(result, selfContext("attack")), "disadvantage");
  assert.equal(mode(result, incomingContext("attack", { distanceFeet: 5 })), "advantage");
  assert.equal(mode(result, incomingContext("attack", { distanceFeet: 5.01 })), "disadvantage");
  assert.equal(result.effects.movement.crawlAllowed, true);
  assert.equal(result.effects.movement.standUpMovementCost, "half-speed");
  assert.equal(result.effects.movement.cannotStandWhenSpeedIsZero, true);
});

test("Restrained sets Speed 0 and resolves outgoing, incoming, and Dexterity-save modifiers", () => {
  const result = resolve([condition({ type: "restrained" })]);
  assert.equal(result.effects.movement.speedIsZero, true);
  assert.equal(result.effects.movement.speedCannotIncrease, true);
  assert.equal(mode(result, selfContext("attack")), "disadvantage");
  assert.equal(mode(result, incomingContext("attack")), "advantage");
  assert.equal(mode(result, selfContext("saving-throw")), "disadvantage");
});

test("Stunned imposes STR/DEX save failure and ruleset-specific speech behavior", () => {
  const legacy = resolve([condition({ type: "stunned" })], "2014");
  assert.deepEqual(legacy.effects.automaticSavingThrowFailures, ["str", "dex"]);
  assert.equal(legacy.effects.actions.speech, "faltering");
  assert.equal(legacy.effects.movement.speedIsZero, true);
  assert.equal(mode(legacy, incomingContext("attack")), "advantage");
  const revised = resolve([condition({ type: "stunned" })], "2024");
  assert.equal(revised.effects.actions.speech, "none");
  assert.equal(revised.effects.movement.speedIsZero, false);
  assert.equal(revised.effects.movement.speedCannotIncrease, false);
});

test("Unconscious implies Incapacitated and Prone, drops items, and applies 0 Speed", () => {
  const result = resolve([condition({ type: "unconscious" })]);
  assert.ok(result.effects.impliedConditions.includes("incapacitated"));
  assert.ok(result.effects.impliedConditions.includes("prone"));
  assert.equal(result.effects.mustDropHeldItems, true);
  assert.equal(result.effects.mustFallProne, true);
  assert.equal(result.effects.automaticCriticalHitWithinFeet, 5);
  assert.equal(result.effects.movement.speedIsZero, true);
  assert.equal(result.effects.movement.crawlAllowed, true);
  assert.deepEqual(result.effects.automaticSavingThrowFailures, ["str", "dex"]);
  assert.equal(mode(result, incomingContext("attack")), "advantage");
});

test("condition roll modifiers preserve normal Advantage/Disadvantage cancellation", () => {
  assert.equal(combineConditionRollModes("advantage", "advantage"), "advantage");
  assert.equal(combineConditionRollModes("disadvantage", "disadvantage"), "disadvantage");
  assert.equal(combineConditionRollModes("advantage", "disadvantage"), "normal");
  assert.equal(
    mode(resolve([condition({ type: "poisoned" })]), selfContext("attack"), ["advantage"]),
    "normal",
  );
});

test("conditionRollModifierApplies rejects mismatched roll, perspective, actor, and target", () => {
  const result = resolve([condition({ type: "poisoned" })]);
  const modifier = result.effects.rollModifiers[0];
  assert.equal(conditionRollModifierApplies(modifier, selfContext("ability-check")), false);
  assert.equal(conditionRollModifierApplies(modifier, {
    ...selfContext("attack"),
    actorCreatureId: OTHER,
  }), false);
  assert.equal(conditionRollModifierApplies(modifier, incomingContext("attack")), false);
});
