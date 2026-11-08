import { BUILDER_STEPS, type BuilderStep } from "../builder/builder-manifest";

export interface BuilderStepProgress {
  id: BuilderStep;
  /** Whether this step is relevant to the current character build. */
  available: boolean;
  /** Whether all required choices for this step have been resolved. */
  complete: boolean;
}

export interface BuilderFlowInput {
  progress: readonly BuilderStepProgress[];
  /** A finished character is edited in a draft transaction; all steps stay reachable. */
  mode?: "create" | "edit-finished-character";
  /** Requested active step. Falls back to the first incomplete visible step. */
  activeStepId?: BuilderStep;
  /** Steps the user has already visited in this builder session. */
  visitedStepIds?: readonly BuilderStep[];
  /** External prerequisite/content validation can prevent finalization. */
  finishAllowed?: boolean;
}

export interface BuilderFlowState {
  visibleStepIds: BuilderStep[];
  activeStepId: BuilderStep | null;
  firstIncompleteStepId: BuilderStep | null;
  previousStepId: BuilderStep | null;
  nextStepId: BuilderStep | null;
  visitedStepIds: BuilderStep[];
  completedStepIds: BuilderStep[];
  /** Completed steps that are within the user's visited range. */
  doneStepIds: BuilderStep[];
  /** Steps that may be opened without skipping an incomplete required step. */
  navigableStepIds: BuilderStep[];
  allStepsComplete: boolean;
  canGoBack: boolean;
  canGoNext: boolean;
  canFinish: boolean;
}

/**
 * Resolve the visible Builder sequence and its navigation locks.
 *
 * Availability and completion are supplied by the content/progression layer.
 * This function owns only the wizard flow; it does not decide D&D rules,
 * prerequisites, feature grants, or spellcasting validity.
 */
export function resolveBuilderFlow(input: BuilderFlowInput): BuilderFlowState {
  const progressById = new Map<BuilderStep, BuilderStepProgress>();

  for (const entry of input.progress) {
    if (progressById.has(entry.id)) {
      throw new Error("Duplicate Builder step progress: " + entry.id);
    }
    progressById.set(entry.id, entry);
  }

  const visibleStepIds = BUILDER_STEPS.filter(
    (step) => progressById.get(step)?.available === true,
  );
  const firstIncompleteIndex = visibleStepIds.findIndex(
    (step) => progressById.get(step)?.complete !== true,
  );
  const allStepsComplete = visibleStepIds.length > 0 && firstIncompleteIndex === -1;

  if (visibleStepIds.length === 0) {
    return {
      visibleStepIds,
      activeStepId: null,
      firstIncompleteStepId: null,
      previousStepId: null,
      nextStepId: null,
      visitedStepIds: [],
      completedStepIds: [],
      doneStepIds: [],
      navigableStepIds: [],
      allStepsComplete: false,
      canGoBack: false,
      canGoNext: false,
      canFinish: false,
    };
  }

  const fallbackIndex = allStepsComplete
    ? 0
    : Math.max(0, firstIncompleteIndex);
  const requestedIndex = input.activeStepId
    ? visibleStepIds.indexOf(input.activeStepId)
    : -1;
  const activeIndex = requestedIndex >= 0 ? requestedIndex : fallbackIndex;
  const activeStepId = visibleStepIds[activeIndex];

  const visited = new Set<BuilderStep>();
  for (const step of input.visitedStepIds ?? []) {
    if (visibleStepIds.includes(step)) visited.add(step);
  }
  visited.add(activeStepId);

  const highestVisitedIndex = Math.max(
    activeIndex,
    ...[...visited].map((step) => visibleStepIds.indexOf(step)),
  );
  const lastIndex = visibleStepIds.length - 1;
  const navigationLimit =
    allStepsComplete || input.mode === "edit-finished-character"
      ? lastIndex
      : Math.min(firstIncompleteIndex, highestVisitedIndex + 1);

  const navigableStepIds = visibleStepIds.filter(
    (_, index) => index <= navigationLimit,
  );
  // A requested deep link/edit step remains open, but it cannot unlock later
  // steps while an earlier required step is incomplete.
  if (!navigableStepIds.includes(activeStepId)) {
    navigableStepIds.push(activeStepId);
  }

  const previousStepId = activeIndex > 0 ? visibleStepIds[activeIndex - 1] : null;
  const nextStepId =
    activeIndex < navigationLimit && activeIndex < lastIndex
      ? visibleStepIds[activeIndex + 1]
      : null;

  const completedStepIds = visibleStepIds.filter(
    (step) => progressById.get(step)?.complete === true,
  );
  const doneStepIds = visibleStepIds.filter(
    (step, index) =>
      index <= highestVisitedIndex && progressById.get(step)?.complete === true,
  );

  return {
    visibleStepIds,
    activeStepId,
    firstIncompleteStepId:
      firstIncompleteIndex >= 0 ? visibleStepIds[firstIncompleteIndex] : null,
    previousStepId,
    nextStepId,
    visitedStepIds: visibleStepIds.filter((step) => visited.has(step)),
    completedStepIds,
    doneStepIds,
    navigableStepIds,
    allStepsComplete,
    canGoBack: previousStepId !== null,
    canGoNext: nextStepId !== null,
    canFinish: allStepsComplete && input.finishAllowed !== false,
  };
}

/**
 * Move to a visible, unlocked step. A null result means the requested
 * navigation would skip an incomplete required step or target a hidden step.
 */
export function navigateBuilderFlow(
  input: BuilderFlowInput,
  targetStepId: BuilderStep,
): BuilderFlowInput | null {
  const flow = resolveBuilderFlow(input);
  if (!flow.navigableStepIds.includes(targetStepId)) return null;

  return {
    ...input,
    activeStepId: targetStepId,
    visitedStepIds: [...new Set([...(input.visitedStepIds ?? []), targetStepId])],
  };
}
