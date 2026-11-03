import type { ProgressionTable, ProgressionValue } from "../domain/types";

export function resolveProgression(
  value: ProgressionValue,
  classLevels: Record<string, number>,
  tables: Record<string, ProgressionTable>,
): number {
  if (value.kind === "fixed") {
    return Number.isFinite(value.value) ? Math.max(0, value.value) : 0;
  }

  const table = tables[value.tableId];
  if (!table) return value.fallback ?? 0;

  const levelSource = value.levelFromClassId ?? table.levelFromClassId ?? table.classId;
  const level = classLevels[levelSource] ?? 0;

  // Progression rows are sparse: a value remains in force until a later row
  // explicitly supplies a new value for that column.
  const row = [...table.rows]
    .filter(
      (candidate) =>
        candidate.level <= level &&
        Object.prototype.hasOwnProperty.call(candidate.values, value.column),
    )
    .sort((a, b) => b.level - a.level)[0];

  const result = row?.values[value.column];
  return typeof result === "number" && Number.isFinite(result)
    ? Math.max(0, result)
    : value.fallback ?? 0;
}
