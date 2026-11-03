import type { OptionDefinition, SpellModifierMechanic } from "../domain/types";

export interface SpellModifierValidation {
  valid: boolean;
  cost: number;
  issues: string[];
}

export interface SpellModifierResourceState {
  maximum: number;
  current: number;
}

export function validateSpellModifierApplication(
  mechanic: SpellModifierMechanic,
  selectedOptionIds: string[],
  knownOptionIds: string[],
  options: OptionDefinition[],
  resources: Record<string, SpellModifierResourceState> = {},
): SpellModifierValidation {
  const issues: string[] = [];
  const uniqueIds = [...new Set(selectedOptionIds)];

  if (uniqueIds.length !== selectedOptionIds.length) {
    issues.push("A spell modifier cannot be applied more than once in the same cast.");
  }
  if (uniqueIds.length > mechanic.maxPerSpell) {
    issues.push("Too many modifiers selected for this spell.");
  }

  let cost = 0;
  for (const id of uniqueIds) {
    if (!knownOptionIds.includes(id)) {
      issues.push("Modifier " + id + " has not been learned.");
      continue;
    }
    const option = options.find((candidate) => candidate.id === id);
    if (!option) {
      issues.push("Modifier " + id + " is missing from its option set.");
      continue;
    }
    if (option.resourceCost?.resourceId !== mechanic.resourceId) {
      issues.push(option.name + " does not use the configured resource pool.");
      continue;
    }
    const optionCost = option.resourceCost.amount;
    if (!Number.isFinite(optionCost) || optionCost <= 0) {
      issues.push(option.name + " has an invalid resource cost.");
      continue;
    }
    cost += optionCost;
  }

  if (cost > 0) {
    const resource = resources[mechanic.resourceId];
    if (!resource) {
      issues.push("Resource pool " + mechanic.resourceId + " is missing.");
    } else if (!Number.isFinite(resource.current) || resource.current < cost) {
      issues.push("Not enough " + mechanic.resourceId + " remaining.");
    }
  }

  return { valid: issues.length === 0, cost, issues };
}
