import type { Recovery } from "../domain/types";

export interface ResourceState {
  maximum: number;
  current: number;
  recovery: Recovery;
}

export function spendResource(
  resource: ResourceState,
  amount: number,
): { ok: true; resource: ResourceState } | { ok: false; reason: string } {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, reason: "Spend amount must be positive." };
  }
  if (resource.current < amount) {
    return { ok: false, reason: "Not enough resource remaining." };
  }
  return { ok: true, resource: { ...resource, current: resource.current - amount } };
}

function recoversOn(resourceRecovery: Recovery, event: Recovery): boolean {
  if (resourceRecovery === event) return true;

  // A long rest restores both long-rest and short-rest resources.
  return resourceRecovery === "short-rest" && event === "long-rest";
}

export function recoverResource(
  resource: ResourceState,
  event: Recovery,
  amount?: number,
): ResourceState {
  if (!recoversOn(resource.recovery, event)) return resource;

  const recovered = amount === undefined ? resource.maximum : amount;
  if (!Number.isFinite(recovered) || recovered < 0) return resource;

  return {
    ...resource,
    current: Math.min(resource.maximum, resource.current + recovered),
  };
}

export function resizeResource(resource: ResourceState, maximum: number): ResourceState {
  const nextMaximum = Number.isFinite(maximum) ? Math.max(0, Math.trunc(maximum)) : 0;
  return { ...resource, maximum: nextMaximum, current: Math.min(resource.current, nextMaximum) };
}
