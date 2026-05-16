import type { ContentPost } from "@/lib/content-runtime/shared";

import { createPostEditorAutosaveStorageKeys } from "@/lib/editor/post-editor-local-cache-keys";

export type StoredPostDraft = {
  isSlugAutoManaged?: boolean;
  isEditingPostSlug: boolean;
  persistedPost: ContentPost | null;
  post: ContentPost;
  postSlugDraft: string;
};

export type StoredPostDraftSession = {
  postId: string;
  sessionId: string | null;
  state: "active" | "recoverable";
  updatedAt: string;
};

export type StoredLostPostDraftBackup = StoredPostDraft & {
  backedUpAt: string;
};

export type PostEditorAutosavePayloadStore = {
  read: <T>(key: string) => Promise<T | null>;
  remove: (key: string) => Promise<void>;
  write: (key: string, value: unknown) => Promise<boolean>;
};

type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

type StoredPayloadPointer = {
  payloadKey: string;
  savedAt: string;
  version: 1;
};

type CreatePostEditorLocalAutosaveStorageOptions = {
  localStorage?: StorageLike | null;
  payloadStore?: PostEditorAutosavePayloadStore;
};

const AUTOSAVE_DATABASE_NAME = "content-runtime-post-editor";
const AUTOSAVE_DATABASE_STORE_NAME = "local-autosaves";
const AUTOSAVE_DATABASE_VERSION = 1;

let autosaveDatabasePromise: Promise<IDBDatabase | null> | null = null;

const getBrowserLocalStorage = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isStoredPayloadPointer = (value: unknown): value is StoredPayloadPointer =>
  isRecord(value) &&
  typeof value.payloadKey === "string" &&
  typeof value.savedAt === "string" &&
  value.version === 1;

const isStoredPostDraftSession = (value: unknown): value is StoredPostDraftSession =>
  isRecord(value) &&
  typeof value.postId === "string" &&
  (typeof value.sessionId === "string" || value.sessionId === null) &&
  (value.state === "active" || value.state === "recoverable") &&
  typeof value.updatedAt === "string";

const normalizeStoredPostDraftSession = (value: unknown): StoredPostDraftSession | null => {
  if (isStoredPostDraftSession(value)) {
    return value;
  }

  if (isRecord(value) && typeof value.postId === "string") {
    return {
      postId: value.postId,
      sessionId: null,
      state: "recoverable",
      updatedAt: "",
    };
  }

  return null;
};

const readJsonValue = <T,>(storage: StorageLike | null, key: string) => {
  if (!storage) {
    return null;
  }

  try {
    const rawValue = storage.getItem(key);
    return rawValue ? (JSON.parse(rawValue) as T) : null;
  } catch {
    return null;
  }
};

const writeJsonValue = (storage: StorageLike | null, key: string, value: unknown) => {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
};

const removeValue = (storage: StorageLike | null, key: string) => {
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(key);
  } catch {
    return;
  }
};

const openAutosaveDatabase = async () => {
  if (autosaveDatabasePromise) {
    return autosaveDatabasePromise;
  }

  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return null;
  }

  autosaveDatabasePromise = new Promise((resolve) => {
    let settled = false;
    const finish = (database: IDBDatabase | null) => {
      if (settled) {
        return;
      }

      settled = true;

      if (!database) {
        autosaveDatabasePromise = null;
      }

      resolve(database);
    };

    try {
      const request = window.indexedDB.open(AUTOSAVE_DATABASE_NAME, AUTOSAVE_DATABASE_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;

        if (!database.objectStoreNames.contains(AUTOSAVE_DATABASE_STORE_NAME)) {
          database.createObjectStore(AUTOSAVE_DATABASE_STORE_NAME);
        }
      };

      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          autosaveDatabasePromise = null;
        };
        finish(database);
      };

      request.onerror = () => {
        finish(null);
      };

      request.onblocked = () => {
        finish(null);
      };
    } catch {
      finish(null);
    }
  });

  return autosaveDatabasePromise;
};

export const createIndexedDbAutosavePayloadStore = (): PostEditorAutosavePayloadStore => ({
  read: async <T,>(key: string) => {
    const database = await openAutosaveDatabase();

    if (!database) {
      return null;
    }

    return new Promise<T | null>((resolve) => {
      let settled = false;
      const finish = (value: T | null) => {
        if (settled) {
          return;
        }

        settled = true;
        resolve(value);
      };
      const transaction = database.transaction(AUTOSAVE_DATABASE_STORE_NAME, "readonly");
      const request = transaction.objectStore(AUTOSAVE_DATABASE_STORE_NAME).get(key);

      request.onsuccess = () => {
        finish((request.result as T | undefined) ?? null);
      };

      request.onerror = () => {
        finish(null);
      };

      transaction.onerror = () => {
        finish(null);
      };

      transaction.onabort = () => {
        finish(null);
      };
    });
  },
  remove: async (key: string) => {
    const database = await openAutosaveDatabase();

    if (!database) {
      return;
    }

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) {
          return;
        }

        settled = true;
        resolve();
      };
      const transaction = database.transaction(AUTOSAVE_DATABASE_STORE_NAME, "readwrite");
      const request = transaction.objectStore(AUTOSAVE_DATABASE_STORE_NAME).delete(key);

      request.onsuccess = () => {
        finish();
      };

      request.onerror = () => {
        finish();
      };

      transaction.oncomplete = () => {
        finish();
      };

      transaction.onerror = () => {
        finish();
      };

      transaction.onabort = () => {
        finish();
      };
    });
  },
  write: async (key: string, value: unknown) => {
    const database = await openAutosaveDatabase();

    if (!database) {
      return false;
    }

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (didWrite: boolean) => {
        if (settled) {
          return;
        }

        settled = true;
        resolve(didWrite);
      };
      const transaction = database.transaction(AUTOSAVE_DATABASE_STORE_NAME, "readwrite");
      const request = transaction.objectStore(AUTOSAVE_DATABASE_STORE_NAME).put(value, key);

      request.onerror = () => {
        finish(false);
      };

      transaction.oncomplete = () => {
        finish(true);
      };

      transaction.onerror = () => {
        finish(false);
      };

      transaction.onabort = () => {
        finish(false);
      };
    });
  },
});

export const createPostEditorLocalAutosaveStorage = (
  projectId: string,
  options?: CreatePostEditorLocalAutosaveStorageOptions,
) => {
  const storage = options?.localStorage ?? getBrowserLocalStorage();
  const payloadStore = options?.payloadStore ?? createIndexedDbAutosavePayloadStore();
  const storageKeys = createPostEditorAutosaveStorageKeys(projectId);

  const writePayload = async <T,>(storageKey: string, payloadKey: string, value: T) => {
    const savedAt = new Date().toISOString();
    const storedInPayloadStore = await payloadStore.write(payloadKey, value);

    if (storedInPayloadStore) {
      writeJsonValue(storage, storageKey, {
        payloadKey,
        savedAt,
        version: 1,
      } satisfies StoredPayloadPointer);
      return true;
    }

    writeJsonValue(storage, storageKey, value);
    return false;
  };

  const readPayload = async <T,>(storageKey: string, payloadKey: string) => {
    const storedValue = readJsonValue<StoredPayloadPointer | T>(storage, storageKey);

    if (!storedValue) {
      return null;
    }

    if (isStoredPayloadPointer(storedValue)) {
      const payload = await payloadStore.read<T>(storedValue.payloadKey);

      if (payload) {
        return payload;
      }

      removeValue(storage, storageKey);
      return null;
    }

    await writePayload(storageKey, payloadKey, storedValue);
    return storedValue;
  };

  const writePayloadSync = <T,>(storageKey: string, value: T) => {
    writeJsonValue(storage, storageKey, value);
  };

  const clearPayload = async (storageKey: string, payloadKey: string) => {
    removeValue(storage, storageKey);
    await payloadStore.remove(payloadKey);
  };

  return {
    clearLostPostDraftBackup: async (postId: string) =>
      clearPayload(storageKeys.lostPostDraftBackup(postId), storageKeys.lostPostDraftBackupPayload(postId)),
    clearStoredPostDraftState: async (postId?: string | null) => {
      if (postId) {
        await clearPayload(storageKeys.storedPostDraft(postId), storageKeys.storedPostDraftPayload(postId));
      }

      removeValue(storage, storageKeys.storedPostDraftSession());
    },
    readLostPostDraftBackup: async (postId: string) =>
      readPayload<StoredLostPostDraftBackup>(
        storageKeys.lostPostDraftBackup(postId),
        storageKeys.lostPostDraftBackupPayload(postId),
      ),
    readStoredPostDraft: async (postId: string) =>
      readPayload<StoredPostDraft>(
        storageKeys.storedPostDraft(postId),
        storageKeys.storedPostDraftPayload(postId),
      ),
    readStoredPostDraftSession: () => {
      const storedSession = readJsonValue<StoredPostDraftSession>(storage, storageKeys.storedPostDraftSession());
      return normalizeStoredPostDraftSession(storedSession);
    },
    writeLostPostDraftBackup: async (postId: string, value: StoredLostPostDraftBackup) =>
      writePayload(
        storageKeys.lostPostDraftBackup(postId),
        storageKeys.lostPostDraftBackupPayload(postId),
        value,
      ),
    writeStoredPostDraftSync: (postId: string, value: StoredPostDraft) =>
      writePayloadSync(storageKeys.storedPostDraft(postId), value),
    writeStoredPostDraft: async (postId: string, value: StoredPostDraft) =>
      writePayload(storageKeys.storedPostDraft(postId), storageKeys.storedPostDraftPayload(postId), value),
    writeStoredPostDraftSession: (value: StoredPostDraftSession) => {
      writeJsonValue(storage, storageKeys.storedPostDraftSession(), value);
    },
  };
};
