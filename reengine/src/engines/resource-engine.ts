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
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, reason: "Spend amount must be positive." };
  if (resource.current < amount) return { ok: false, reason: "Not enough resource remaining." };
  return { ok: true, resource: { ...resource, current: resource.current - amount } };
}

export function recoverResource(
  resource: ResourceState,
  event: Recovery,
  amount?: number,
): ResourceState {
  if (resource.recovery !== event && resource.recovery !== "special") return resource;
  const recovered = amount === undefined ? resource.maximum : Math.max(0, amount);
  return { ...resource, current: Math.min(resource.maximum, resource.current + recovered) };
}

export function resizeResource(resource: ResourceState, maximum: number): ResourceState {
  const nextMaximum = Math.max(0, Math.trunc(maximum));
  return { ...resource, maximum: nextMaximum, current: Math.min(resource.current, nextMaximum) };
}
