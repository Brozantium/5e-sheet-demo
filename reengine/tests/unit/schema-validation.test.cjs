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
