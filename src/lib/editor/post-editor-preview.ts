import type { ContentPost } from "@/lib/content-runtime/shared";

import {
  getPostEditorPreviewStorageKey,
  POST_EDITOR_PREVIEW_STORAGE_PREFIX,
} from "@/lib/editor/post-editor-local-cache-keys";

const POST_PREVIEW_STORAGE_VERSION = 1;
const POST_PREVIEW_MAX_SNAPSHOTS = 10;
const POST_PREVIEW_MAX_AGE_MS = 1000 * 60 * 60 * 24;

export type StoredPostPreviewSnapshot = {
  hasUnsavedChanges: boolean;
  post: ContentPost;
  previewedAt: string;
  projectName: string;
  projectSlug: string;
  version: number;
};

type PreviewStorageLike = Pick<Storage, "getItem" | "key" | "length" | "removeItem" | "setItem">;

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isStoredPostPreviewSnapshot = (value: unknown): value is StoredPostPreviewSnapshot => {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    value.version === POST_PREVIEW_STORAGE_VERSION &&
    typeof value.previewedAt === "string" &&
    typeof value.projectName === "string" &&
    typeof value.projectSlug === "string" &&
    typeof value.hasUnsavedChanges === "boolean" &&
    isObjectRecord(value.post)
  );
};

const getStoredPreviewEntries = (storage: PreviewStorageLike) => {
  const entries: Array<{ key: string; snapshot: StoredPostPreviewSnapshot }> = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);

    if (!key?.startsWith(POST_EDITOR_PREVIEW_STORAGE_PREFIX)) {
      continue;
    }

    const rawValue = storage.getItem(key);

    if (!rawValue) {
      continue;
    }

    try {
      const parsedValue = JSON.parse(rawValue) as unknown;

      if (isStoredPostPreviewSnapshot(parsedValue)) {
        entries.push({
          key,
          snapshot: parsedValue,
        });
      } else {
        storage.removeItem(key);
      }
    } catch {
      storage.removeItem(key);
    }
  }

  return entries;
};

export const createPostEditorPreviewStorage = (storage: PreviewStorageLike) => {
  const prune = () => {
    const now = Date.now();
    const entries = getStoredPreviewEntries(storage).sort((left, right) =>
      right.snapshot.previewedAt.localeCompare(left.snapshot.previewedAt),
    );

    entries.forEach((entry, index) => {
      const previewedAt = Date.parse(entry.snapshot.previewedAt);
      const isExpired = Number.isFinite(previewedAt) && now - previewedAt > POST_PREVIEW_MAX_AGE_MS;
      const exceedsSnapshotLimit = index >= POST_PREVIEW_MAX_SNAPSHOTS;

      if (isExpired || exceedsSnapshotLimit) {
        storage.removeItem(entry.key);
      }
    });
  };

  return {
    clearSnapshot(token: string) {
      storage.removeItem(getPostEditorPreviewStorageKey(token));
    },
    createPreviewUrl(token: string) {
      return `/content-preview?token=${encodeURIComponent(token)}`;
    },
    readSnapshot(token: string) {
      const rawValue = storage.getItem(getPostEditorPreviewStorageKey(token));

      if (!rawValue) {
        return null;
      }

      try {
        const parsedValue = JSON.parse(rawValue) as unknown;
        return isStoredPostPreviewSnapshot(parsedValue) ? parsedValue : null;
      } catch {
        return null;
      }
    },
    writeSnapshot(snapshot: Omit<StoredPostPreviewSnapshot, "previewedAt" | "version">) {
      prune();

      const token = crypto.randomUUID();
      const storedSnapshot: StoredPostPreviewSnapshot = {
        ...snapshot,
        previewedAt: new Date().toISOString(),
        version: POST_PREVIEW_STORAGE_VERSION,
      };

      storage.setItem(getPostEditorPreviewStorageKey(token), JSON.stringify(storedSnapshot));
      return token;
    },
  };
};
