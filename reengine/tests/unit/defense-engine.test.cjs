const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveDerivedDefenses } = require("../../.test-dist/engines/defense-engine.js");

const feature = { kind: "feature", id: "feature:dragon", label: "Draconic Resilience" };
const item = { kind: "equipment", id: "item:ring", label: "Ring of Resistance" };

test("unions defense grants case-insensitively and preserves all source provenance", () => {
  const result = resolveDerivedDefenses({
    grants: [
      { source: feature, resistances: ["Fire", "Cold"], immunities: ["Poison"] },
      { source: item, resistances: ["fire"], vulnerabilities: ["Radiant"] },
    ],
  });
  const fire = result.resistances.find((entry) => entry.value === "Fire");
  assert.deepEqual(fire.sources.map((entry) => entry.id), ["feature:dragon", "item:ring"]);
  assert.equal(result.resistances.length, 2);
  assert.equal(result.immunities[0].value, "Poison");
  assert.equal(result.vulnerabilities[0].value, "Radiant");
});

test("includes E1 condition-derived defenses without changing the E1 contract", () => {
  const result = resolveDerivedDefenses({
    grants: [],
    conditionEffects: {
      damageResistances: ["all damage"],
      damageImmunities: ["poison"],
      conditionImmunities: ["poisoned"],
    },
  });
  assert.equal(result.resistances[0].value, "all damage");
  assert.equal(result.immunities[0].value, "poison");
  assert.equal(result.conditionImmunities[0].value, "poisoned");
  assert.equal(result.immunities[0].sources[0].kind, "condition");
});

test("does not resolve resistance/immunity conflicts or combine them into damage outcomes", () => {
  const result = resolveDerivedDefenses({
    grants: [
      { source: feature, resistances: ["fire"] },
      { source: item, immunities: ["fire"] },
      { source: feature, vulnerabilities: ["fire"] },
    ],
  });
  assert.equal(result.resistances.length, 1);
  assert.equal(result.immunities.length, 1);
  assert.equal(result.vulnerabilities.length, 1);
});

test("preserves AC bonuses individually for the AC engine to process", () => {
  const result = resolveDerivedDefenses({
    grants: [
      { source: feature, acBonus: 2 },
      { source: item, acBonus: 1 },
    ],
  });
  assert.deepEqual(result.acBonuses.map((entry) => entry.value), [2, 1]);
  assert.deepEqual(result.acBonuses.map((entry) => entry.source.id), ["feature:dragon", "item:ring"]);
});

test("rejects invalid source and non-finite AC bonus", () => {
  assert.throws(
    () => resolveDerivedDefenses({ grants: [{ source: { ...feature, id: " " } }] }),
    /source ID and label are required/,
  );
  assert.throws(
    () => resolveDerivedDefenses({ grants: [{ source: feature, acBonus: Number.NaN }] }),
    /AC bonus must be finite/,
  );
});
