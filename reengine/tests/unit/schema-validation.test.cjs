const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Ajv2020Module = require("ajv/dist/2020");
const Ajv2020 = Ajv2020Module.default ?? Ajv2020Module;

const schemaRoot = path.join(__dirname, "../../SCHEMAS");
const fixtureRoot = path.join(__dirname, "../fixtures/schema");
const schemaPaths = [
  "common.schema.json",
  "content/feature.schema.json",
  "content/class.schema.json",
  "content/option-set.schema.json",
  "content/item.schema.json",
  "character/character-state.schema.json",
];
const schemas = schemaPaths.map((relativePath) =>
  JSON.parse(fs.readFileSync(path.join(schemaRoot, relativePath), "utf8")),
);
const ajv = new Ajv2020({ allErrors: true, strict: false });
for (const schema of schemas) ajv.addSchema(schema);

const validators = {
  class: ajv.getSchema("https://example.invalid/reengine/schemas/class.schema.json"),
  optionSet: ajv.getSchema("https://example.invalid/reengine/schemas/option-set.schema.json"),
  item: ajv.getSchema("https://example.invalid/reengine/schemas/item.schema.json"),
  character: ajv.getSchema("https://example.invalid/reengine/schemas/character-state.schema.json"),
};

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(fixtureRoot, name), "utf8"));
}

function assertValid(validator, value, label) {
  const valid = validator(value);
  assert.equal(valid, true, label + ": " + JSON.stringify(validator.errors));
}

function assertInvalid(validator, value, label) {
  const valid = validator(value);
  assert.equal(valid, false, label + " unexpectedly passed schema validation");
}

test("Draft 2020-12 schemas compile and expose every canonical validator", () => {
  for (const [name, validator] of Object.entries(validators)) {
    assert.equal(typeof validator, "function", name + " validator should be compiled");
  }
});

test("valid class fixture satisfies the class and nested feature contracts", () => {
  assertValid(validators.class, fixture("valid-class-2014.json"), "2014 fighter");
});

test("valid option set fixture satisfies option, prerequisite, effect, and source contracts", () => {
  assertValid(validators.optionSet, fixture("valid-option-set-2014.json"), "2014 fighting styles");
});

test("valid weapon, armor, shield, and magic weapon fixtures satisfy item profiles", () => {
  assertValid(validators.item, fixture("valid-weapon.json"), "longsword");
  assertValid(validators.item, fixture("valid-armor-2024.json"), "chain mail");
  assertValid(validators.item, fixture("valid-shield-2024.json"), "shield");
  assertValid(validators.item, fixture("valid-magic-weapon.json"), "flame tongue");
});

test("valid character mechanics state uses canonical content references", () => {
  assertValid(validators.character, fixture("valid-character-state-2014.json"), "fighter state");
});

test("invalid content IDs and ruleset metadata are rejected", () => {
  assertInvalid(validators.optionSet, fixture("invalid-option-set-id.json"), "malformed option-set id");
  assertInvalid(validators.class, fixture("invalid-feature-ruleset.json"), "invalid nested feature ruleset");
});

test("weapon records cannot omit the weapon profile required by their category", () => {
  assertInvalid(validators.item, fixture("invalid-weapon-profile.json"), "weapon without weaponProfile");
});

test("schema rejects shield and non-combat records with the wrong profile shape", () => {
  assertInvalid(validators.item, fixture("invalid-shield-profile.json"), "shield with armor category heavy");
  assertInvalid(validators.item, fixture("invalid-gear-profile.json"), "gear with armor profile");
});

test("schema requires a numeric Dexterity cap for capped armor", () => {
  const value = fixture("valid-armor-2024.json");
  value.armorProfile.dexterity = "capped";
  delete value.armorProfile.maxDexterityModifier;
  assertInvalid(validators.item, value, "capped armor without maximum Dexterity modifier");
});

test("schema rejects unknown fields instead of silently accepting shape drift", () => {
  const value = fixture("valid-weapon.json");
  value.unreviewedLegacyField = true;
  assertInvalid(validators.item, value, "unknown top-level item field");
});

test("character content-reference fields reject display names instead of stable IDs", () => {
  const value = fixture("valid-character-state-2014.json");
  value.knownSpells = ["Fire Bolt"];
  assertInvalid(validators.character, value, "display name in knownSpells");
});

test("weapon schema supports distinct thrown range, ammunition type, and mounted grip exception", () => {
  const dagger = fixture("valid-weapon.json");
  dagger.properties = ["finesse", "thrown"];
  delete dagger.weaponProfile.damage[0].versatileFormula;
  dagger.weaponProfile.thrownRange = { normal: 20, long: 60 };
  assertValid(validators.item, dagger, "2014 Dagger thrown range");

  const longbow = fixture("valid-weapon.json");
  longbow.id = "weapon:longbow";
  longbow.name = "Longbow";
  longbow.ruleset = "2024";
  longbow.properties = ["ammunition", "heavy", "two-handed"];
  longbow.weaponProfile.weaponType = "ranged";
  longbow.weaponProfile.damage = [{ formula: "1d8", damageType: "piercing" }];
  longbow.weaponProfile.range = { normal: 150, long: 600 };
  longbow.weaponProfile.ammunitionType = "arrow";
  assertValid(validators.item, longbow, "2024 Longbow");

  const lance = fixture("valid-weapon.json");
  lance.id = "weapon:lance-2024";
  lance.name = "Lance";
  lance.ruleset = "2024";
  lance.properties = ["heavy", "reach", "two-handed"];
  lance.weaponProfile.damage = [{ formula: "1d10", damageType: "piercing" }];
  lance.weaponProfile.twoHandedRule = { unlessMounted: true };
  assertValid(validators.item, lance, "2024 mounted Lance exception");
});

test("weapon schema represents the 2014 Net as a structured Special weapon without ordinary damage dice", () => {
  const net = fixture("valid-weapon.json");
  net.id = "weapon:net";
  net.name = "Net";
  net.properties = ["special", "thrown"];
  net.weaponProfile.damage = [];
  delete net.weaponProfile.damage[0]?.versatileFormula;
  net.weaponProfile.thrownRange = { normal: 5, long: 15 };
  net.weaponProfile.specialRules = ["net-2014"];
  assertValid(validators.item, net, "2014 Net");
});

test("weapon range schema requires positive normal and long distances", () => {
  const value = fixture("valid-weapon.json");
  value.properties = ["thrown"];
  delete value.weaponProfile.damage[0].versatileFormula;
  value.weaponProfile.thrownRange = { normal: 0, long: 60 };
  assertInvalid(validators.item, value, "zero normal thrown range");

  value.weaponProfile.thrownRange = { normal: 20 };
  assertInvalid(validators.item, value, "thrown range missing long distance");
});
