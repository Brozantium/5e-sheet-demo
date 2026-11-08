export type RulesetEdition = "2014" | "2024";

export type ContentCategory =
  | "races"
  | "classes"
  | "subclasses"
  | "backgrounds"
  | "feats"
  | "spells"
  | "items"
  | "magicitems"
  | "actions"
  | "creatures";

export type ContentRecord = {
  id: string;
  name: string;
  edition: RulesetEdition;
  [key: string]: unknown;
};

export type HomebrewCollections = Record<ContentCategory, ContentRecord[]>;

export type HomebrewEditorPackage = {
  kind: "dnd-homebrew";
  version: 1;
  exportedAt: string;
  homebrew: HomebrewCollections;
};

export const CONTENT_CATEGORIES: Array<{
  key: ContentCategory;
  label: string;
  singular: string;
}> = [
  { key: "races", label: "Races / Species", singular: "Race / Species" },
  { key: "classes", label: "Classes", singular: "Class" },
  { key: "subclasses", label: "Subclasses", singular: "Subclass" },
  { key: "backgrounds", label: "Backgrounds", singular: "Background" },
  { key: "feats", label: "Feats", singular: "Feat" },
  { key: "spells", label: "Spells", singular: "Spell" },
  { key: "items", label: "Items", singular: "Item" },
  { key: "magicitems", label: "Magic Items", singular: "Magic Item" },
  { key: "actions", label: "Actions", singular: "Action" },
  { key: "creatures", label: "Creatures", singular: "Creature" },
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createEmptyEditorPackage(
  edition: RulesetEdition,
): HomebrewEditorPackage {
  const homebrew = Object.fromEntries(
    CONTENT_CATEGORIES.map(({ key }) => [key, []]),
  ) as HomebrewCollections;

  return {
    kind: "dnd-homebrew",
    version: 1,
    exportedAt: new Date().toISOString(),
    homebrew,
  };
}

export function createBlankRecord(
  edition: RulesetEdition,
): ContentRecord {
  return {
    id: "",
    name: "",
    source: "Homebrew",
    description: "",
    edition,
  };
}

/**
 * Read the Homebrew Editor JSON envelope without changing source IDs.
 * A package is edition-scoped at import time; mixed-edition input is rejected.
 */
export function parseEditorPackage(
  input: unknown,
  edition: RulesetEdition,
): HomebrewEditorPackage {
  if (!isObject(input)) {
    throw new Error("The selected file must contain a JSON object.");
  }

  if (input.kind !== undefined && input.kind !== "dnd-homebrew") {
    throw new Error("This is not a dnd-homebrew export package.");
  }
  if (input.version !== undefined && input.version !== 1) {
    throw new Error("Only Homebrew package version 1 is supported.");
  }

  const rawHomebrew = isObject(input.homebrew) ? input.homebrew : input;
  const result = createEmptyEditorPackage(edition);

  for (const { key, label } of CONTENT_CATEGORIES) {
    const rawRecords = rawHomebrew[key];
    if (rawRecords === undefined) continue;
    if (!Array.isArray(rawRecords)) {
      throw new Error('The "' + label + '" category must be an array.');
    }

    const seenIds = new Set<string>();
    result.homebrew[key] = rawRecords.map((rawRecord, index) => {
      if (!isObject(rawRecord)) {
        throw new Error(label + " record #" + (index + 1) + " must be an object.");
      }

      const id = rawRecord.id;
      const name = rawRecord.name;
      if (typeof id !== "string" || id.trim().length === 0) {
        throw new Error(label + " record #" + (index + 1) + " has no valid ID.");
      }
      if (id.length > 200) {
        throw new Error(label + " record ID exceeds 200 characters: " + id);
      }
      if (typeof name !== "string" || name.trim().length === 0) {
        throw new Error(label + " record #" + (index + 1) + " has no valid name.");
      }
      if (seenIds.has(id)) {
        throw new Error('Duplicate ID "' + id + '" in ' + label + ".");
      }
      seenIds.add(id);

      const sourceEdition = rawRecord.edition;
      if (
        sourceEdition !== undefined &&
        sourceEdition !== edition
      ) {
        throw new Error(
          'Edition mismatch in ' + label + ' record "' + id +
          '": expected ' + edition + ", received " + String(sourceEdition) + ".",
        );
      }

      return { ...rawRecord, edition } as ContentRecord;
    });
  }

  return result;
}

export function formatFieldLabel(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function isStructuredValue(value: unknown): boolean {
  return value === null || (typeof value === "object" && value !== null);
}
