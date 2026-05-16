import { getPostEditorSeoFocusKeywordStorageKey } from "@/lib/editor/post-editor-local-cache-keys";

type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

const getBrowserLocalStorage = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
};

const readValue = (storage: StorageLike | null, key: string) => {
  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const writeValue = (storage: StorageLike | null, key: string, value: string) => {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(key, value);
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

export const createPostEditorLocalSeoStorage = (
  projectId: string,
  storage: StorageLike | null = getBrowserLocalStorage(),
) => {
  return {
    clearFocusKeyword(postId: string) {
      removeValue(storage, getPostEditorSeoFocusKeywordStorageKey(projectId, postId));
    },
    readFocusKeyword(postId: string) {
      const value = readValue(storage, getPostEditorSeoFocusKeywordStorageKey(projectId, postId));
      const normalizedValue = value?.trim() ?? "";

      return normalizedValue || null;
    },
    writeFocusKeyword(postId: string, value: string | null | undefined) {
      const normalizedValue = value?.trim() ?? "";

      if (!normalizedValue) {
        removeValue(storage, getPostEditorSeoFocusKeywordStorageKey(projectId, postId));
        return;
      }

      writeValue(storage, getPostEditorSeoFocusKeywordStorageKey(projectId, postId), normalizedValue);
    },
  };
};
