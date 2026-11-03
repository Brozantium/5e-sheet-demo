import type {
  CharacterMechanicsState,
  EngineIssue,
  OptionDefinition,
  OptionSetDefinition,
  ProgressionTable,
  SelectionMechanic,
} from "../domain/types";
import { evaluateRequirement } from "./prerequisite-engine";
import { resolveProgression } from "./progression-engine";

export interface SelectionValidationOptions {
  /** Drafts may be incomplete; complete selections must meet the exact count. */
  mode?: "draft" | "complete";
  /** Other selections being committed in the same builder transaction. */
  stagedSelections?: Record<string, string[]>;
}

function withStagedSelections(
  state: CharacterMechanicsState,
  stagedSelections: Record<string, string[]>,
  currentSelectionId?: string,
  currentSelectedIds: string[] = [],
): CharacterMechanicsState {
  const selections: Record<string, string[]> = { ...state.selections };

  for (const [selectionId, ids] of Object.entries(stagedSelections)) {
    selections[selectionId] = [...new Set([...(selections[selectionId] ?? []), ...ids])];
  }

  if (currentSelectionId) {
    selections[currentSelectionId] = [
      ...new Set([...(selections[currentSelectionId] ?? []), ...currentSelectedIds]),
    ];
  }

  return { ...state, selections };
}

export function validateSelection(
  mechanic: SelectionMechanic,
  selectedIds: string[],
  optionSet: OptionSetDefinition,
  state: CharacterMechanicsState,
  tables: Record<string, ProgressionTable>,
  validationOptions: SelectionValidationOptions = {},
): EngineIssue[] {
  const issues: EngineIssue[] = [];
  const expected = resolveProgression(mechanic.count, state.classLevels, tables);
  const mode = validationOptions.mode ?? "complete";
  const counts = new Map<string, number>();

  for (const id of selectedIds) counts.set(id, (counts.get(id) ?? 0) + 1);

  if (selectedIds.length > expected || (mode === "complete" && selectedIds.length !== expected)) {
    issues.push({
      code: "selection-count",
      message:
        "Choose " +
        (mode === "draft" ? "up to " : "exactly ") +
        expected +
        " option(s); currently selected: " +
        selectedIds.length +
        ".",
      subjectId: mechanic.id,
    });
  }

  const evaluationState = withStagedSelections(
    state,
    validationOptions.stagedSelections ?? {},
    mechanic.id,
    selectedIds,
  );

  for (const [id, count] of counts) {
    const option = optionSet.options.find((candidate) => candidate.id === id);
    if (!option) {
      issues.push({
        code: "unknown-option",
        message: "Option " + id + " is not in " + optionSet.id + ".",
        subjectId: id,
      });
      continue;
    }
    if (!mechanic.allowDuplicates && count > 1) {
      issues.push({
        code: "duplicate-option",
        message: option.name + " cannot be selected more than once.",
        subjectId: id,
      });
    }
    if (mechanic.allowDuplicates && !option.repeatable && count > 1) {
      issues.push({
        code: "not-repeatable",
        message: option.name + " is not repeatable.",
        subjectId: id,
      });
    }
    for (const requirement of option.prerequisites ?? []) {
      const result = evaluateRequirement(requirement, evaluationState);
      if (!result.met) {
        issues.push({
          code: "prerequisite-not-met",
          message: option.name + ": " + (result.reason ?? "prerequisite not met"),
          subjectId: id,
        });
      }
    }
  }

  return issues;
}

export function getEligibleOptions(
  options: OptionDefinition[],
  state: CharacterMechanicsState,
  stagedSelections: Record<string, string[]> = {},
): OptionDefinition[] {
  const evaluationState = withStagedSelections(state, stagedSelections);
  return options.filter((option) =>
    (option.prerequisites ?? []).every(
      (requirement) => evaluateRequirement(requirement, evaluationState).met,
    ),
  );
}
