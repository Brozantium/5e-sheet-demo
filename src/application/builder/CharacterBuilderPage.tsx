import { useState } from "react";
import type { Ruleset } from "../../../reengine/src/domain/types";

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

export default function CharacterBuilderPage() {
  const [ruleset, setRuleset] = useState<Ruleset | null>(null);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-8 sm:px-8 sm:py-12">
      <header className="flex items-center justify-between border-b border-rule pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">
            Brozantium
          </p>
          <p className="mt-1 text-sm font-semibold">5e Sheet</p>
        </div>
        <span className="rounded-full border border-rule px-3 py-1 text-xs text-muted">
          Independent application
        </span>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center py-12">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
          Character Builder
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Create a character
        </h1>
        <p className="mt-3 max-w-xl text-base leading-7 text-muted">
          Choose the ruleset first. The Builder will use that edition for its
          content, progression, and character rules.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {RULESET_OPTIONS.map((option) => {
            const selected = ruleset === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setRuleset(option.id)}
                className={[
                  "rounded-xl border p-5 text-left transition",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  selected
                    ? "border-accent bg-accent-soft"
                    : "border-rule bg-card hover:border-accent",
                ].join(" ")}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-lg font-bold">{option.label}</span>
                  <span
                    className={[
                      "grid h-5 w-5 place-items-center rounded-full border text-xs",
                      selected
                        ? "border-accent bg-accent text-onaccent"
                        : "border-rule text-transparent",
                    ].join(" ")}
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                </span>
                <span className="mt-2 block text-sm leading-6 text-muted">
                  {option.summary}
                </span>
              </button>
            );
          })}
        </div>

        {ruleset && (
          <div
            className="mt-6 rounded-xl border border-rule bg-card p-5"
            aria-live="polite"
          >
            <p className="font-semibold">
              Ruleset selected: D&D 5e {ruleset}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted">
              The application shell is now independent of the legacy Figma
              Make app. Class and background content, the remaining Builder
              steps, and character saving are being connected in separate
              modules.
            </p>
          </div>
        )}
      </section>

      <footer className="border-t border-rule pt-4 text-xs text-muted">
        Clean application shell · Ruleset-aware Reengine
      </footer>
    </main>
  );
}
