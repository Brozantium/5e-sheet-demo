import { useMemo, useState, type CSSProperties } from "react";
import type { Ruleset } from "../../../reengine/src/domain/types";
import {
  BUILDER_STEPS,
  type BuilderStep,
} from "../../../reengine/src/builder/builder-manifest";
import {
  navigateBuilderFlow,
  resolveBuilderFlow,
  type BuilderFlowInput,
} from "../../../reengine/src/engines/builder-flow-engine";

type ThemeName = "blue" | "red" | "yellow" | "green";

const THEMES: Array<{ id: ThemeName; label: string; color: string }> = [
  { id: "blue", label: "Blue", color: "#3478df" },
  { id: "red", label: "Red", color: "#c94b50" },
  { id: "yellow", label: "Yellow", color: "#d5a629" },
  { id: "green", label: "Green", color: "#39875b" },
];

const STEP_META: Record<
  BuilderStep,
  { label: string; description: string; conditional?: boolean }
> = {
  ruleset: {
    label: "Edition",
    description: "Choose the ruleset for this character.",
  },
  modifiers: {
    label: "Game Modifiers",
    description: "Review campaign and optional rule settings.",
  },
  class: {
    label: "Class",
    description: "Choose a class and configure its levels.",
  },
  "species-or-race": {
    label: "Race / Species",
    description: "Choose the ancestry option for the selected edition.",
  },
  subclass: {
    label: "Subclass",
    description: "Choose subclass options when class progression grants them.",
    conditional: true,
  },
  "ability-scores": {
    label: "Ability Scores",
    description: "Generate and assign the six ability scores.",
  },
  background: {
    label: "Background",
    description: "Choose a background and resolve its options.",
  },
  proficiencies: {
    label: "Skills & Proficiencies",
    description: "Assign skill, tool, weapon, and language proficiencies.",
  },
  feats: {
    label: "Feats & ASI",
    description: "Resolve feats and ability score improvements when granted.",
    conditional: true,
  },
  "features-and-options": {
    label: "Features & Options",
    description: "Resolve class, species, and other feature choices.",
    conditional: true,
  },
  equipment: {
    label: "Equipment",
    description: "Choose starting equipment and manage inventory.",
  },
  spells: {
    label: "Spells",
    description: "Choose and prepare spells when spellcasting is available.",
    conditional: true,
  },
  details: {
    label: "Character Details",
    description: "Set the character name, appearance, and biography.",
  },
  review: {
    label: "Review",
    description: "Review the completed character before creating it.",
  },
};

const REQUIRED_STEPS = BUILDER_STEPS.filter(
  (step) => !STEP_META[step].conditional,
);

const RULESET_OPTIONS: Array<{
  id: Ruleset;
  label: string;
  summary: string;
}> = [
  {
    id: "2014",
    label: "D&D 5e · 2014",
    summary: "Original fifth-edition rules and character options.",
  },
  {
    id: "2024",
    label: "D&D 5e · 2024",
    summary: "Revised fifth-edition rules and updated character options.",
  },
];

function makeFlowInput(
  ruleset: Ruleset | null,
  activeStepId: BuilderStep,
  visitedStepIds: BuilderStep[],
): BuilderFlowInput {
  return {
    activeStepId,
    visitedStepIds,
    progress: BUILDER_STEPS.map((id) => ({
      id,
      available:
        id === "subclass" ||
        id === "feats" ||
        id === "features-and-options" ||
        id === "spells"
          ? false
          : true,
      // Modifiers are informational until the modifier contracts are wired.
      complete:
        id === "ruleset"
          ? ruleset !== null
          : id === "modifiers"
            ? ruleset !== null
            : false,
    })),
  };
}

function StepStatus({
  active,
  complete,
  locked,
}: {
  active: boolean;
  complete: boolean;
  locked: boolean;
}) {
  if (complete) {
    return <span className="step-status step-status-done" aria-label="Complete">✓</span>;
  }
  if (active) {
    return <span className="step-status step-status-active" aria-label="Current step">•</span>;
  }
  return (
    <span className="step-status step-status-locked" aria-label={locked ? "Locked" : "Not started"}>
      {locked ? "⌑" : "○"}
    </span>
  );
}

export default function CharacterBuilderPage() {
  const [theme, setTheme] = useState<ThemeName>("blue");
  const [ruleset, setRuleset] = useState<Ruleset | null>(null);
  const [activeStepId, setActiveStepId] = useState<BuilderStep>("ruleset");
  const [visitedStepIds, setVisitedStepIds] = useState<BuilderStep[]>(["ruleset"]);

  const flowInput = useMemo(
    () => makeFlowInput(ruleset, activeStepId, visitedStepIds),
    [ruleset, activeStepId, visitedStepIds],
  );
  const flow = useMemo(() => resolveBuilderFlow(flowInput), [flowInput]);
  const activeIndex = REQUIRED_STEPS.indexOf(activeStepId);
  const activeMeta = STEP_META[activeStepId];

  function goToStep(target: BuilderStep) {
    const next = navigateBuilderFlow(flowInput, target);
    if (!next) return;
    setActiveStepId(target);
    setVisitedStepIds(next.visitedStepIds ?? []);
  }

  function continueForward() {
    if (flow.nextStepId) goToStep(flow.nextStepId);
  }

  return (
    <div data-theme={theme} className="builder-theme min-h-screen bg-paper text-ink">
      <div className="builder-topline" />
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-4 sm:px-6 xl:px-8">
        <header className="flex min-h-[76px] items-center justify-between gap-4 border-b border-rule">
          <a className="flex items-center gap-3 no-underline" href="#" aria-label="Brozantium 5e Sheet home">
            <span className="brand-mark">5e</span>
            <span>
              <span className="block text-sm font-bold tracking-wide">BROZANTIUM</span>
              <span className="block text-[10px] uppercase tracking-[0.2em] text-muted">Character Workshop</span>
            </span>
          </a>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 sm:gap-2" aria-label="Color theme">
              <span className="mr-1 hidden text-[11px] font-semibold uppercase tracking-wider text-muted sm:inline">Theme</span>
              {THEMES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`theme-swatch ${theme === item.id ? "theme-swatch-selected" : ""}`}
                  style={{ "--swatch": item.color } as CSSProperties}
                  onClick={() => setTheme(item.id)}
                  aria-label={`${item.label} theme`}
                  aria-pressed={theme === item.id}
                  title={item.label}
                />
              ))}
            </div>
            <span className="hidden h-7 w-px bg-rule sm:block" />
            <span className="rounded-full border border-rule px-3 py-1.5 text-[11px] font-semibold text-muted">
              New character
            </span>
          </div>
        </header>

        <div className="grid flex-1 gap-6 py-6 lg:grid-cols-[238px_minmax(0,1fr)_250px] xl:gap-8">
          <aside className="builder-panel h-fit overflow-hidden">
            <div className="border-b border-rule px-4 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Character Builder</p>
              <h1 className="mt-1 text-lg font-bold">Create Character</h1>
              <p className="mt-1 text-xs text-muted">Follow each step to build your character.</p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-rule">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${(flow.completedStepIds.length / REQUIRED_STEPS.length) * 100}%` }}
                />
              </div>
              <p className="mt-1.5 text-[10px] text-muted">{`${flow.completedStepIds.length} of ${REQUIRED_STEPS.length} required steps complete`}</p>
            </div>

            <nav className="p-2" aria-label="Character creation steps">
              {REQUIRED_STEPS.map((step, index) => {
                const meta = STEP_META[step];
                const active = activeStepId === step;
                const complete = flow.completedStepIds.includes(step);
                const locked = !flow.navigableStepIds.includes(step);
                return (
                  <button
                    key={step}
                    type="button"
                    onClick={() => goToStep(step)}
                    disabled={locked}
                    aria-current={active ? "step" : undefined}
                    className={`builder-step ${active ? "builder-step-active" : ""} ${locked ? "builder-step-locked" : ""}`}
                  >
                    <span className="builder-step-number">
                      <StepStatus active={active} complete={complete} locked={locked} />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-xs font-semibold">{meta.label}</span>
                      {index === 0 && ruleset && <span className="mt-0.5 block text-[10px] text-muted">{ruleset} rules</span>}
                    </span>
                  </button>
                );
              })}
              <div className="mx-3 my-3 border-t border-dashed border-rule pt-3">
                <p className="px-1 text-[9px] font-bold uppercase tracking-[0.16em] text-muted">Shown when applicable</p>
                {BUILDER_STEPS.filter((step) => STEP_META[step].conditional).map((step) => (
                  <div key={step} className="flex items-center gap-2 px-1 py-2 text-[11px] text-muted">
                    <span className="text-accent">◇</span>
                    <span>{STEP_META[step].label}</span>
                  </div>
                ))}
              </div>
            </nav>
          </aside>

          <main className="min-w-0">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
                  Step {Math.max(activeIndex + 1, 1)} <span className="px-1 text-muted">/</span> {REQUIRED_STEPS.length}
                </p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight">{activeMeta.label}</h2>
                <p className="mt-1 text-sm text-muted">{activeMeta.description}</p>
              </div>
              <span className="rounded-full bg-accent-soft px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                {ruleset ? `5e ${ruleset}` : "Edition not selected"}
              </span>
            </div>

            <section className="builder-panel min-h-[420px]">
              <div className="border-b border-rule px-5 py-4 sm:px-7">
                <h3 className="text-sm font-bold">
                  {activeStepId === "ruleset"
                    ? "Choose your game edition"
                    : activeStepId === "modifiers"
                      ? "Game configuration"
                      : activeMeta.label}
                </h3>
                <p className="mt-1 text-xs text-muted">
                  {activeStepId === "ruleset"
                    ? "Your choice determines which character options and rules are available."
                    : activeStepId === "modifiers"
                      ? "Campaign-specific options will be configured here."
                      : "This step follows the audited Play5e Builder sequence."}
                </p>
              </div>

              <div className="p-5 sm:p-7">
                {activeStepId === "ruleset" && (
                  <div className="grid gap-4 md:grid-cols-2">
                    {RULESET_OPTIONS.map((option) => {
                      const selected = ruleset === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setRuleset(option.id)}
                          className={`ruleset-card ${selected ? "ruleset-card-selected" : ""}`}
                        >
                          <span className="flex items-center justify-between gap-3">
                            <span className="text-lg font-bold">{option.label}</span>
                            <span className={`ruleset-radio ${selected ? "ruleset-radio-selected" : ""}`}>
                              {selected ? "✓" : ""}
                            </span>
                          </span>
                          <span className="mt-3 block text-sm leading-6 text-muted">{option.summary}</span>
                          <span className="mt-5 block text-[10px] font-bold uppercase tracking-[0.15em] text-accent">
                            {selected ? "Selected" : "Select edition"}
                          </span>
                        </button>
                      );
                    })}
                    <p className="text-xs leading-5 text-muted md:col-span-2">
                      You can change the edition before finishing. Edition-dependent selections will need to be reviewed if you switch later.
                    </p>
                  </div>
                )}

                {activeStepId === "modifiers" && (
                  <div className="rounded-lg border border-rule bg-paper p-5">
                    <div className="flex items-start gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">⚙</span>
                      <div>
                        <p className="text-sm font-bold">No game modifiers selected</p>
                        <p className="mt-1 text-xs leading-5 text-muted">
                          Optional rules and campaign modifiers will be connected to the modifier engine in a later implementation step. You can continue with the standard {ruleset} rules for now.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeStepId !== "ruleset" && activeStepId !== "modifiers" && (
                  <div className="builder-placeholder">
                    <span className="placeholder-icon">◇</span>
                    <p className="mt-3 text-sm font-bold">{activeMeta.label} is not connected yet</p>
                    <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-muted">
                      The page layout and step navigation are in place. This stage will become interactive when its canonical content, validation, and character-state integration are ready.
                    </p>
                    {activeStepId === "class" && (
                      <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-accent">
                        Next implementation: class catalog and level progression
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-rule px-5 py-4 sm:px-7">
                <button
                  type="button"
                  className="builder-secondary-button"
                  onClick={() => flow.previousStepId && goToStep(flow.previousStepId)}
                  disabled={!flow.canGoBack}
                >
                  <span aria-hidden="true">←</span> Back
                </button>
                <button
                  type="button"
                  className="builder-primary-button"
                  onClick={continueForward}
                  disabled={!flow.canGoNext}
                >
                  Continue <span aria-hidden="true">→</span>
                </button>
              </div>
            </section>
            <p className="mt-3 text-center text-[10px] text-muted">
              Your character is a local draft. Nothing is saved until the full Builder flow is connected.
            </p>
          </main>

          <aside className="builder-panel h-fit">
            <div className="border-b border-rule px-4 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Character Overview</p>
              <h3 className="mt-1 text-sm font-bold">Your character</h3>
            </div>
            <div className="p-4">
              <div className="character-portrait">
                <span className="text-3xl text-accent">✧</span>
                <span className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Character portrait</span>
                <span className="text-[9px] text-muted">Not selected</span>
              </div>
              <div className="mt-4 space-y-3">
                <div className="summary-row">
                  <span>Ruleset</span>
                  <strong>{ruleset ? `D&D 5e ${ruleset}` : "—"}</strong>
                </div>
                <div className="summary-row">
                  <span>Class</span>
                  <strong>Not selected</strong>
                </div>
                <div className="summary-row">
                  <span>Race / Species</span>
                  <strong>Not selected</strong>
                </div>
                <div className="summary-row">
                  <span>Level</span>
                  <strong>1</strong>
                </div>
              </div>
              <div className="mt-5 rounded-lg bg-paper p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Build status</p>
                <p className="mt-1 text-xs font-semibold">{ruleset ? "In progress" : "Not started"}</p>
                <p className="mt-1 text-[10px] leading-5 text-muted">Complete each required step to prepare your character.</p>
              </div>
            </div>
          </aside>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-rule py-4 text-[10px] text-muted">
          <span>Brozantium 5e Sheet · Independent Character Builder</span>
          <span>Ruleset-aware · 2014 / 2024</span>
        </footer>
      </div>
    </div>
  );
}
