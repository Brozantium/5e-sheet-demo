import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
} from "react";
import {
  CONTENT_CATEGORIES,
  createBlankRecord,
  createEmptyEditorPackage,
  formatFieldLabel,
  isStructuredValue,
  parseEditorPackage,
  type ContentCategory,
  type ContentRecord,
  type HomebrewEditorPackage,
  type RulesetEdition,
} from "./model";
import { loadEditionPackage, saveEditionPackage } from "./persistence";

type ThemeName = "purple" | "blue" | "red" | "yellow" | "green";

const THEMES: Array<{ id: ThemeName; label: string; color: string }> = [
  { id: "purple", label: "Purple", color: "#7957c8" },
  { id: "blue", label: "Blue", color: "#3478df" },
  { id: "red", label: "Red", color: "#c43f4d" },
  { id: "yellow", label: "Yellow", color: "#d5a629" },
  { id: "green", label: "Green", color: "#39875b" },
];

const EMPTY_NOTICE: Partial<Record<ContentCategory, string>> = {
  actions: "The source data folders do not contain an actions dataset. Create a custom Action here or import one from a Homebrew package.",
  creatures: "The source data folders do not contain a creatures dataset. Create a custom Creature here or import one from a Homebrew package.",
};

function cloneRecord(record: ContentRecord): ContentRecord {
  return JSON.parse(JSON.stringify(record)) as ContentRecord;
}

function countRecords(pack: HomebrewEditorPackage): number {
  return CONTENT_CATEGORIES.reduce(
    (total, category) => total + pack.homebrew[category.key].length,
    0,
  );
}

function makeDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function fieldInputClass() {
  return "w-full rounded-lg border border-rule bg-paper px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-accent";
}

export default function ContentEditorPage() {
  const [theme, setTheme] = useState<ThemeName>("purple");
  const [edition, setEdition] = useState<RulesetEdition>("2014");
  const [category, setCategory] = useState<ContentCategory>("actions");
  const [packs, setPacks] = useState<
    Partial<Record<RulesetEdition, HomebrewEditorPackage>>
  >({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<ContentRecord | null>(null);
  const [structuredText, setStructuredText] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState("");
  const [newFieldName, setNewFieldName] = useState("");
  const [notice, setNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const activePackage = useMemo(
    () => packs[edition] ?? createEmptyEditorPackage(edition),
    [edition, packs],
  );
  const records = activePackage.homebrew[category];
  const selectedCategory = CONTENT_CATEGORIES.find((item) => item.key === category)!;
  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return records.map((record, index) => ({ record, index }));
    return records
      .map((record, index) => ({ record, index }))
      .filter(({ record }) =>
        [record.name, record.id, record.source]
          .some((value) => typeof value === "string" && value.toLowerCase().includes(query)),
      );
  }, [records, search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    setNotice("");
    loadEditionPackage(edition)
      .then((saved) => {
        if (cancelled) return;
        setPacks((previous) => ({
          ...previous,
          [edition]: saved ?? createEmptyEditorPackage(edition),
        }));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Could not read local content.");
        setPacks((previous) => ({
          ...previous,
          [edition]: createEmptyEditorPackage(edition),
        }));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [edition]);

  function canDiscard(): boolean {
    return !dirty || window.confirm("Discard unsaved changes to this record?");
  }

  function resetDraft() {
    if (selectedIndex === null) {
      setDraft(null);
      setStructuredText({});
      setDirty(false);
      return;
    }

    const current = records[selectedIndex];
    if (current) {
      setDraft(cloneRecord(current));
      setStructuredText(
        Object.fromEntries(
          Object.entries(current)
            .filter(([, value]) => isStructuredValue(value))
            .map(([key, value]) => [key, JSON.stringify(value, null, 2)]),
        ),
      );
      setDirty(false);
    } else {
      setDraft(null);
      setSelectedIndex(null);
      setStructuredText({});
      setDirty(false);
    }
  }

  function selectCategory(nextCategory: ContentCategory) {
    if (nextCategory === category || !canDiscard()) return;
    setCategory(nextCategory);
    setSelectedIndex(null);
    setDraft(null);
    setStructuredText({});
    setDirty(false);
    setSearch("");
    setNotice("");
  }

  function selectEdition(nextEdition: RulesetEdition) {
    if (nextEdition === edition || !canDiscard()) return;
    setEdition(nextEdition);
    setSelectedIndex(null);
    setDraft(null);
    setStructuredText({});
    setDirty(false);
    setSearch("");
    setNotice("");
  }

  function openRecord(index: number) {
    if (!canDiscard()) return;
    const record = records[index];
    setSelectedIndex(index);
    setDraft(cloneRecord(record));
    setStructuredText(
      Object.fromEntries(
        Object.entries(record)
          .filter(([, value]) => isStructuredValue(value))
          .map(([key, value]) => [key, JSON.stringify(value, null, 2)]),
      ),
    );
    setDirty(false);
    setNotice("");
  }

  function startNewRecord() {
    if (!canDiscard()) return;
    setSelectedIndex(null);
    setDraft(createBlankRecord(edition));
    setStructuredText({});
    setDirty(true);
    setNotice("New " + selectedCategory.singular.toLowerCase() + " draft. Enter an ID and name, then save.");
  }

  function updateField(key: string, value: unknown) {
    setDraft((current) => current ? { ...current, [key]: value } : current);
    setDirty(true);
  }

  function updateStructuredField(key: string, value: string) {
    setStructuredText((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  function addField() {
    const key = newFieldName.trim();
    if (!draft || !key) return;
    if (Object.prototype.hasOwnProperty.call(draft, key)) {
      setNotice('Field "' + key + '" already exists.');
      return;
    }
    updateField(key, "");
    setNewFieldName("");
    setNotice('Added field "' + key + '".');
  }

  async function persistPackage(nextPackage: HomebrewEditorPackage) {
    setPacks((previous) => ({ ...previous, [edition]: nextPackage }));
    try {
      await saveEditionPackage(edition, nextPackage);
      setNotice("Saved locally in this browser. The " + edition + " content stays separate.");
    } catch (error) {
      setNotice(
        "Changes are active in this tab, but local persistence failed. Export JSON to keep a backup. " +
        (error instanceof Error ? error.message : ""),
      );
    }
  }

  async function saveDraft() {
    if (!draft) return;
    let prepared: ContentRecord = { ...draft };

    try {
      for (const [key, text] of Object.entries(structuredText)) {
        prepared[key] = JSON.parse(text) as unknown;
      }
    } catch (error) {
      setNotice(
        "A structured field contains invalid JSON. " +
        (error instanceof Error ? error.message : ""),
      );
      return;
    }

    const id = prepared.id.trim();
    const name = prepared.name.trim();
    if (!id || !name) {
      setNotice("ID and Name are required before saving.");
      return;
    }
    if (id.length > 200) {
      setNotice("ID must be 200 characters or fewer.");
      return;
    }

    prepared = { ...prepared, id, name, edition };
    const duplicate = records.findIndex(
      (record, index) => record.id === id && index !== selectedIndex,
    );
    if (duplicate !== -1) {
      setNotice('ID "' + id + '" already exists in this category for ' + edition + ".");
      return;
    }

    const nextRecords = [...records];
    const savedIndex = selectedIndex === null ? nextRecords.length : selectedIndex;
    if (selectedIndex === null) nextRecords.push(prepared);
    else nextRecords[selectedIndex] = prepared;

    const nextPackage: HomebrewEditorPackage = {
      ...activePackage,
      exportedAt: new Date().toISOString(),
      homebrew: { ...activePackage.homebrew, [category]: nextRecords },
    };

    await persistPackage(nextPackage);
    setSelectedIndex(savedIndex);
    setDraft(cloneRecord(prepared));
    setStructuredText(
      Object.fromEntries(
        Object.entries(prepared)
          .filter(([, value]) => isStructuredValue(value))
          .map(([key, value]) => [key, JSON.stringify(value, null, 2)]),
      ),
    );
    setDirty(false);
  }

  async function deleteRecord() {
    if (selectedIndex === null || !draft) return;
    if (!window.confirm('Delete "' + draft.name + '" from ' + selectedCategory.label + '?')) return;

    const nextRecords = records.filter((_, index) => index !== selectedIndex);
    const nextPackage: HomebrewEditorPackage = {
      ...activePackage,
      exportedAt: new Date().toISOString(),
      homebrew: { ...activePackage.homebrew, [category]: nextRecords },
    };
    await persistPackage(nextPackage);
    setDraft(null);
    setSelectedIndex(null);
    setStructuredText({});
    setDirty(false);
    setNotice("Record deleted.");
  }

  async function importPackage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!canDiscard()) return;

    try {
      const parsed: unknown = JSON.parse(await file.text());
      const nextPackage = parseEditorPackage(parsed, edition);
      const total = countRecords(nextPackage);
      if (!window.confirm(
        "Replace the current " + edition + " editor data with " + total +
        " records from " + file.name + "? The other edition will not be changed.",
      )) return;

      await persistPackage(nextPackage);
      setCategory("races");
      setSelectedIndex(null);
      setDraft(null);
      setStructuredText({});
      setDirty(false);
      setSearch("");
      setNotice("Imported " + total + " records into the " + edition + " workspace.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not import this JSON file.");
    }
  }

  function exportPackage() {
    makeDownload(
      JSON.stringify(activePackage, null, 2),
      "brozantium-homebrew-" + edition + ".json",
    );
    setNotice("Exported the " + edition + " workspace. The other edition was not included.");
  }

  const totalRecords = countRecords(activePackage);
  const selectedRecord = selectedIndex === null ? null : records[selectedIndex];

  return (
    <div data-theme={theme} className="builder-theme min-h-screen bg-paper text-ink">
      <div className="builder-topline" />
      <div className="mx-auto flex min-h-screen w-full max-w-[1680px] flex-col px-3 sm:px-5 xl:px-7">
        <header className="flex min-h-[76px] flex-wrap items-center justify-between gap-3 border-b border-rule py-3">
          <div className="flex items-center gap-3">
            <span className="brand-mark">5e</span>
            <span>
              <span className="block text-sm font-bold tracking-wide">BROZANTIUM</span>
              <span className="block text-[10px] uppercase tracking-[0.2em] text-muted">Content Workshop</span>
            </span>
            <span className="ml-2 hidden rounded-full bg-accent-soft px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-accent sm:inline-flex">
              Editor mode
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex rounded-lg border border-rule bg-card p-1" aria-label="Ruleset edition">
              {(["2014", "2024"] as RulesetEdition[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => selectEdition(item)}
                  aria-pressed={edition === item}
                  className={"rounded-md px-3 py-1.5 text-xs font-bold transition " +
                    (edition === item ? "bg-accent text-onaccent shadow-sm" : "text-muted hover:bg-paper")}
                >
                  {item}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="builder-secondary-button"
              onClick={() => fileInput.current?.click()}
              disabled={loading}
            >
              Import JSON
            </button>
            <input
              ref={fileInput}
              className="hidden"
              type="file"
              accept="application/json,.json"
              onChange={importPackage}
            />
            <button type="button" className="builder-primary-button" onClick={exportPackage} disabled={loading}>
              Export {edition}
            </button>
            <span className="mx-1 hidden h-7 w-px bg-rule lg:block" />
            <div className="flex items-center gap-1.5" aria-label="Color theme">
              {THEMES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={"theme-swatch " + (theme === item.id ? "theme-swatch-selected" : "")}
                  style={{ "--swatch": item.color } as CSSProperties}
                  onClick={() => setTheme(item.id)}
                  aria-label={item.label + " theme"}
                  aria-pressed={theme === item.id}
                  title={item.label}
                />
              ))}
            </div>
          </div>
        </header>

        <div className="grid flex-1 gap-4 py-5 xl:grid-cols-[218px_280px_minmax(0,1fr)]">
          <aside className="builder-panel h-fit">
            <div className="border-b border-rule px-4 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Workspace</p>
              <h1 className="mt-1 text-base font-bold">Content Editor</h1>
              <p className="mt-1 text-[11px] text-muted">Editing only · no character rules or calculations</p>
              <div className="mt-3 flex items-center justify-between rounded-lg bg-paper px-3 py-2">
                <span className="text-[10px] font-semibold text-muted">Active edition</span>
                <strong className="text-xs">{edition}</strong>
              </div>
            </div>
            <nav className="p-2" aria-label="Content categories">
              <p className="px-3 pb-2 pt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-muted">Categories</p>
              {CONTENT_CATEGORIES.map((item) => {
                const count = activePackage.homebrew[item.key].length;
                const active = category === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => selectCategory(item.key)}
                    aria-current={active ? "page" : undefined}
                    className={"flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left transition " +
                      (active ? "bg-accent-soft text-accent" : "text-ink hover:bg-paper")}
                  >
                    <span className="truncate text-xs font-semibold">{item.label}</span>
                    <span className={"min-w-7 rounded-full px-2 py-0.5 text-center text-[10px] font-bold " +
                      (active ? "bg-card text-accent" : "bg-paper text-muted")}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </nav>
            <div className="border-t border-rule p-3">
              <p className="text-[10px] font-semibold text-muted">Local workspace</p>
              <p className="mt-1 text-[10px] leading-5 text-muted">
                Saved separately in this browser for each edition. Export JSON for a portable backup.
              </p>
            </div>
          </aside>

          <section className="builder-panel flex min-h-[600px] flex-col">
            <div className="border-b border-rule p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted">{edition} content</p>
                  <h2 className="mt-1 text-sm font-bold">{selectedCategory.label}</h2>
                </div>
                <button type="button" className="builder-primary-button !min-h-8 !px-3 !text-[11px]" onClick={startNewRecord} disabled={loading}>
                  + Add
                </button>
              </div>
              <input
                className={fieldInputClass() + " mt-3"}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={"Search " + selectedCategory.label.toLowerCase() + "..."}
                aria-label="Search records"
              />
              <p className="mt-2 text-[10px] text-muted">{records.length} records · {filteredRecords.length} shown</p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {loading && (
                <div className="p-6 text-center text-xs text-muted">Opening local {edition} workspace…</div>
              )}
              {!loading && filteredRecords.length === 0 && (
                <div className="flex min-h-[250px] flex-col items-center justify-center px-4 text-center">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-xl text-accent">◇</span>
                  <p className="mt-3 text-xs font-bold">
                    {records.length === 0 ? "No records yet" : "No matching records"}
                  </p>
                  <p className="mt-2 max-w-[220px] text-[10px] leading-5 text-muted">
                    {records.length === 0
                      ? EMPTY_NOTICE[category] ?? "Import a JSON package or add a new content record to this category."
                      : "Try another name or ID."}
                  </p>
                  {records.length === 0 && (
                    <button type="button" className="builder-secondary-button mt-4" onClick={startNewRecord}>
                      Create {selectedCategory.singular}
                    </button>
                  )}
                </div>
              )}
              {!loading && filteredRecords.map(({ record, index }) => (
                <button
                  key={record.id + "-" + index}
                  type="button"
                  onClick={() => openRecord(index)}
                  className={"mb-1 w-full rounded-lg border px-3 py-3 text-left transition " +
                    (selectedIndex === index ? "border-accent bg-accent-soft" : "border-transparent hover:border-rule hover:bg-paper")}
                >
                  <span className="block truncate text-xs font-bold">{record.name}</span>
                  <span className="mt-1 block truncate font-mono text-[9px] text-muted">{record.id}</span>
                  <span className="mt-1 block text-[9px] text-muted">{typeof record.source === "string" ? record.source : "—"}</span>
                </button>
              ))}
            </div>
          </section>

          <main className="builder-panel min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-5 py-4">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted">{selectedCategory.label} / {edition}</p>
                <h2 className="mt-1 text-base font-bold">
                  {draft ? (selectedIndex === null ? "New " + selectedCategory.singular : draft.name || "Untitled record") : "Edit content"}
                </h2>
                <p className="mt-1 text-[10px] text-muted">
                  {draft ? "Edit fields below. Structured values are edited as JSON and kept intact." : "Choose a record or create a new one."}
                </p>
              </div>
              {draft && (
                <div className="flex flex-wrap items-center gap-2">
                  {selectedIndex !== null && (
                    <button type="button" className="builder-secondary-button !min-h-8 !px-3 !text-[11px]" onClick={deleteRecord}>
                      Delete
                    </button>
                  )}
                  <button type="button" className="builder-secondary-button !min-h-8 !px-3 !text-[11px]" onClick={resetDraft} disabled={!dirty}>
                    Discard
                  </button>
                  <button type="button" className="builder-primary-button !min-h-8 !px-3 !text-[11px]" onClick={saveDraft} disabled={!dirty}>
                    Save changes
                  </button>
                </div>
              )}
            </div>

            {loadError && (
              <div className="m-5 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-[11px] text-danger">
                Local storage could not be opened: {loadError}
              </div>
            )}

            {draft && (
              <div className="space-y-5 p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted">ID *</span>
                    <input className={fieldInputClass()} value={draft.id} onChange={(event) => updateField("id", event.target.value)} placeholder="unique-content-id" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted">Name *</span>
                    <input className={fieldInputClass()} value={draft.name} onChange={(event) => updateField("name", event.target.value)} placeholder="Content name" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted">Edition · locked</span>
                    <input className={fieldInputClass() + " cursor-not-allowed opacity-70"} value={edition} readOnly />
                  </label>
                  <div className="flex items-end">
                    <p className="pb-2 text-[10px] leading-5 text-muted">The edition is fixed by the active workspace and cannot be changed on an individual record.</p>
                  </div>
                </div>

                <div className="border-t border-rule pt-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-bold">Content fields</h3>
                      <p className="mt-1 text-[10px] text-muted">Unknown source fields are preserved. Add a field when this record needs one.</p>
                    </div>
                    <div className="flex gap-2">
                      <input
                        className={fieldInputClass() + " !w-36"}
                        value={newFieldName}
                        onChange={(event) => setNewFieldName(event.target.value)}
                        placeholder="newField"
                        aria-label="New field name"
                      />
                      <button type="button" className="builder-secondary-button !min-h-8 !px-3 !text-[10px]" onClick={addField}>
                        Add field
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {Object.entries(draft)
                      .filter(([key]) => key !== "edition" && key !== "id" && key !== "name")
                      .map(([key, value]) => {
                        const structured = isStructuredValue(value);
                        const longText = typeof value === "string" &&
                          (value.length > 140 || key.toLowerCase().includes("description") || key.toLowerCase().includes("text"));
                        return (
                          <label key={key} className="block">
                            <span className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted">
                              {formatFieldLabel(key)}
                              {structured && <span className="normal-case tracking-normal text-accent">JSON</span>}
                            </span>
                            {structured ? (
                              <textarea
                                className={fieldInputClass() + " min-h-32 resize-y font-mono text-[11px] leading-5"}
                                value={structuredText[key] ?? JSON.stringify(value, null, 2) ?? "null"}
                                onChange={(event) => updateStructuredField(key, event.target.value)}
                                spellCheck={false}
                              />
                            ) : typeof value === "boolean" ? (
                              <span className="flex items-center gap-2 rounded-lg border border-rule bg-paper px-3 py-2 text-xs">
                                <input type="checkbox" checked={value} onChange={(event) => updateField(key, event.target.checked)} />
                                {value ? "Enabled" : "Disabled"}
                              </span>
                            ) : typeof value === "number" ? (
                              <input
                                className={fieldInputClass()}
                                type="number"
                                value={value}
                                onChange={(event) => updateField(key, event.target.value === "" ? 0 : Number(event.target.value))}
                              />
                            ) : longText ? (
                              <textarea
                                className={fieldInputClass() + " min-h-28 resize-y leading-5"}
                                value={String(value ?? "")}
                                onChange={(event) => updateField(key, event.target.value)}
                              />
                            ) : (
                              <input
                                className={fieldInputClass()}
                                value={String(value ?? "")}
                                onChange={(event) => updateField(key, event.target.value)}
                              />
                            )}
                          </label>
                        );
                      })}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rule pt-4">
                  <span className="text-[10px] text-muted">{dirty ? "Unsaved changes" : "All changes saved"}</span>
                  <button type="button" className="builder-primary-button" onClick={saveDraft} disabled={!dirty}>
                    Save record
                  </button>
                </div>
              </div>
            )}

            {!draft && (
              <div className="flex min-h-[430px] flex-col items-center justify-center px-6 py-12 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-2xl text-accent">✎</span>
                <h3 className="mt-4 text-sm font-bold">Content editor</h3>
                <p className="mt-2 max-w-sm text-xs leading-6 text-muted">
                  Select a record from the list to edit it, or add a new {selectedCategory.singular.toLowerCase()}.
                  Import and export are scoped to the selected ruleset.
                </p>
                <button type="button" className="builder-primary-button mt-5" onClick={startNewRecord}>
                  + Create {selectedCategory.singular}
                </button>
              </div>
            )}
          </main>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-rule py-3 text-[10px] text-muted">
          <span>Brozantium Content Editor · Content editing only</span>
          <span>{edition} workspace · {totalRecords} records · IndexedDB local save</span>
        </footer>
      </div>

      {notice && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,620px)] -translate-x-1/2 rounded-xl border border-rule bg-card px-4 py-3 text-xs text-ink shadow-xl" role="status">
          <div className="flex items-start justify-between gap-3">
            <span>{notice}</span>
            <button type="button" className="font-bold text-muted" onClick={() => setNotice("")} aria-label="Dismiss notice">×</button>
          </div>
        </div>
      )}
    </div>
  );
}
