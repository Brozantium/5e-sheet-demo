import type {
  DefenseEntry,
  DefenseGrant,
  DefenseSource,
  DerivedDefenseInput,
  DerivedDefenseResult,
} from "../domain/defenses";

function addEntries(
  target: Map<string, DefenseEntry>,
  values: string[] | undefined,
  source: DefenseSource,
): void {
  for (const raw of values ?? []) {
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    const existing = target.get(key);
    if (existing) {
      if (!existing.sources.some(
        (entry) => entry.kind === source.kind && entry.id === source.id,
      )) existing.sources.push({ ...source });
    } else {
      target.set(key, { value, sources: [{ ...source }] });
    }
  }
}

function validateGrant(grant: DefenseGrant): void {
  if (!grant.source.id.trim() || !grant.source.label.trim()) {
    throw new TypeError("Defense grant source ID and label are required.");
  }
  if (grant.acBonus !== undefined && !Number.isFinite(grant.acBonus)) {
    throw new RangeError("AC bonus must be finite.");
  }
}

/**
 * Aggregates defense facts and their provenance without resolving damage rules.
 * Duplicate entries are coalesced case-insensitively while retaining sources.
 * Resistance/vulnerability/immunity conflicts are intentionally left visible
 * for the downstream damage resolver. AC bonuses are returned individually;
 * AC calculation and stacking remain the AC engine's responsibility.
 */
export function resolveDerivedDefenses(
  input: DerivedDefenseInput,
): DerivedDefenseResult {
  const resistances = new Map<string, DefenseEntry>();
  const vulnerabilities = new Map<string, DefenseEntry>();
  const immunities = new Map<string, DefenseEntry>();
  const conditionImmunities = new Map<string, DefenseEntry>();
  const acBonuses: DerivedDefenseResult["acBonuses"] = [];

  const grants = [...input.grants];
  if (input.conditionEffects) {
    grants.push({
      source: {
        kind: "condition",
        id: "condition-derived",
        label: "Condition-derived defenses",
      },
      resistances: input.conditionEffects.damageResistances,
      immunities: input.conditionEffects.damageImmunities,
      conditionImmunities: input.conditionEffects.conditionImmunities,
    });
  }

  for (const grant of grants) {
    validateGrant(grant);
    addEntries(resistances, grant.resistances, grant.source);
    addEntries(vulnerabilities, grant.vulnerabilities, grant.source);
    addEntries(immunities, grant.immunities, grant.source);
    addEntries(conditionImmunities, grant.conditionImmunities, grant.source);
    if (grant.acBonus !== undefined) {
      acBonuses.push({ value: grant.acBonus, source: { ...grant.source } });
    }
  }

  const values = (entries: Map<string, DefenseEntry>) =>
    [...entries.values()].sort((a, b) =>
      a.value.localeCompare(b.value),
    );

  return {
    resistances: values(resistances),
    vulnerabilities: values(vulnerabilities),
    immunities: values(immunities),
    conditionImmunities: values(conditionImmunities),
    acBonuses,
  };
}
