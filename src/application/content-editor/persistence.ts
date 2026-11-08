import type {
  HomebrewEditorPackage,
  RulesetEdition,
} from "./model";

const DATABASE_NAME = "brozantium-content-editor";
const DATABASE_VERSION = 1;
const STORE_NAME = "edition-packs";

type StoredEdition = {
  edition: RulesetEdition;
  content: HomebrewEditorPackage;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser does not support IndexedDB."));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "edition" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local storage."));
  });
}

export async function loadEditionPackage(
  edition: RulesetEdition,
): Promise<HomebrewEditorPackage | null> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(edition);
      request.onsuccess = () => {
        const stored = request.result as StoredEdition | undefined;
        resolve(stored?.content ?? null);
      };
      request.onerror = () => reject(request.error ?? new Error("Could not read saved content."));
    });
  } finally {
    database.close();
  }
}

export async function saveEditionPackage(
  edition: RulesetEdition,
  content: HomebrewEditorPackage,
): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put({ edition, content } satisfies StoredEdition);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not save content."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Content save was aborted."));
    });
  } finally {
    database.close();
  }
}
