import type { ProgressionTable, ProgressionValue } from "../domain/types";

export function resolveProgression(
  value: ProgressionValue,
  classLevels: Record<string, number>,
  tables: Record<string, ProgressionTable>,
): number {
  if (value.kind === "fixed") return Math.max(0, value.value);

  const table = tables[value.classId];
  if (!table) return value.fallback ?? 0;

  const level = classLevels[value.classId] ?? 0;
  const row = [...table.rows]
    .filter((candidate) => candidate.level <= level)
    .sort((a, b) => b.level - a.level)[0];

  const result = row?.values[value.column];
  return typeof result === "number" ? Math.max(0, result) : value.fallback ?? 0;
}
