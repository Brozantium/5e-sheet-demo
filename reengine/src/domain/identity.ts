import type { ContentRuleset } from "./types";

/**
 * Stable canonical IDs use lowercase kebab-case segments.
 * A colon separates namespace segments, e.g. artificer-2014:infusions-known.
 * Human-readable names and display labels are never used as IDs.
 */
export const CONTENT_ID_PATTERN =
  /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?::[a-z][a-z0-9]*(?:-[a-z0-9]+)*)*$/;

export function isValidContentId(value: unknown): value is string {
  return typeof value === "string" && CONTENT_ID_PATTERN.test(value);
}

export function assertContentId(value: unknown, field = "content id"): asserts value is string {
  if (!isValidContentId(value)) {
    throw new Error(
      "Invalid " + field + ' "' + String(value) +
      '". Expected lowercase kebab-case segments separated by colons.',
    );
  }
}

export function isContentRuleset(value: unknown): value is ContentRuleset {
  return value === "2014" || value === "2024" || value === "shared";
}

export function assertContentRuleset(value: unknown, field = "ruleset"): asserts value is ContentRuleset {
  if (!isContentRuleset(value)) {
    throw new Error('Invalid ' + field + ' "' + String(value) + '". Expected 2014, 2024, or shared.');
  }
}
