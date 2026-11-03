import type {
  AssignmentMechanic,
  CharacterMechanicsState,
  EngineIssue,
  OptionDefinition,
  ProgressionTable,
} from "../domain/types";
import { resolveProgression } from "./progression-engine";

export function validateAssignment(
  mechanic: AssignmentMechanic,
  option: OptionDefinition,
  targetId: string,
  state: CharacterMechanicsState,
  tables: Record<string, ProgressionTable>,
): EngineIssue[] {
  const issues: EngineIssue[] = [];
  const known = state.selections[mechanic.selectionId] ?? [];
  if (!known.includes(option.id)) {
    issues.push({
      code: "option-not-known",
      message: option.name + " has not been learned.",
      subjectId: option.id,
    });
  }

  const current = state.assignments.filter((entry) => entry.mechanicId === mechanic.id);
  const duplicate = current.some(
    (entry) => entry.optionId === option.id && entry.targetId === targetId,
  );

  if (duplicate) {
    issues.push({
      code: "duplicate-assignment",
      message: option.name + " is already assigned to this target.",
      subjectId: targetId,
    });
  } else {
    const capacity = resolveProgression(mechanic.capacity, state.classLevels, tables);
    if (current.length >= capacity) {
      issues.push({
        code: "assignment-capacity",
        message: "Assignment capacity of " + capacity + " has been reached.",
        subjectId: mechanic.id,
      });
    }

    if (mechanic.maxPerOption !== undefined) {
      const optionAssignments = current.filter((entry) => entry.optionId === option.id);
      if (optionAssignments.length >= mechanic.maxPerOption) {
        issues.push({
          code: "option-capacity",
          message:
            option.name +
            " has reached its assignment limit of " +
            mechanic.maxPerOption +
            ".",
          subjectId: option.id,
        });
      }
    }

    const targetAssignments = current.filter((entry) => entry.targetId === targetId);
    if (targetAssignments.length >= mechanic.maxPerTarget) {
      issues.push({
        code: "target-capacity",
        message: "This target cannot receive another assignment from this mechanic.",
        subjectId: targetId,
      });
    }
  }

  if (mechanic.targetKind === "inventory-item" && mechanic.eligibleItemTags?.length) {
    const tags = state.inventoryItemTags[targetId] ?? [];
    if (!mechanic.eligibleItemTags.some((tag) => tags.includes(tag))) {
      issues.push({
        code: "invalid-target",
        message: "This item is not eligible for this assignment.",
        subjectId: targetId,
      });
    }
  }

  return issues;
}
