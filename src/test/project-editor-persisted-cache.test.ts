import { beforeEach, describe, expect, it } from "vitest";

import {
  clearProjectEditorPersistedCacheEntries,
  readProjectEditorPersistedCacheEntry,
  writeProjectEditorPersistedCacheEntry,
} from "@/components/editor/project-editor/persisted-cache";

describe("project editor persisted cache helpers", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();

    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        key: (index: number) => Array.from(storage.keys())[index] ?? null,
        get length() {
          return storage.size;
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
      },
    });
  });

  it("reads and writes persisted JSON payloads", () => {
    writeProjectEditorPersistedCacheEntry({
      key: "content-runtime:demo:authors:1",
      payload: { items: [1, 2, 3] },
    });

    expect(
      readProjectEditorPersistedCacheEntry<{ items: number[] }>({
        key: "content-runtime:demo:authors:1",
      }),
    ).toEqual({ items: [1, 2, 3] });
  });

  it("drops persisted entries when the caller marks them stale", () => {
    writeProjectEditorPersistedCacheEntry({
      key: "content-runtime:demo:media:1",
      payload: { stale: true },
    });

    expect(
      readProjectEditorPersistedCacheEntry<{ stale: boolean }>({
        key: "content-runtime:demo:media:1",
        shouldDiscard: (payload) => payload.stale,
      }),
    ).toBeNull();
    expect(window.localStorage.getItem("content-runtime:demo:media:1")).toBeNull();
  });

  it("does not write oversized payloads to localStorage", () => {
    writeProjectEditorPersistedCacheEntry({
      key: "content-runtime:demo:media:large",
      maxSerializedBytes: 20,
      payload: { items: ["this payload is too large"] },
    });

    expect(window.localStorage.getItem("content-runtime:demo:media:large")).toBeNull();
  });

  it("clears only keys inside the requested prefix", () => {
    writeProjectEditorPersistedCacheEntry({
      key: "content-runtime:demo:files:1",
      payload: { ok: true },
    });
    writeProjectEditorPersistedCacheEntry({
      key: "content-runtime:demo:files:2",
      payload: { ok: true },
    });
    writeProjectEditorPersistedCacheEntry({
      key: "content-runtime:demo:media:1",
      payload: { ok: true },
    });

    clearProjectEditorPersistedCacheEntries("content-runtime:demo:files:");

    expect(window.localStorage.getItem("content-runtime:demo:files:1")).toBeNull();
    expect(window.localStorage.getItem("content-runtime:demo:files:2")).toBeNull();
    expect(window.localStorage.getItem("content-runtime:demo:media:1")).not.toBeNull();
  });
});
