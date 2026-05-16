import { describe, expect, it, vi } from "vitest";

import { mergeProjectEditorManagedStorageFolderOptions } from "@/components/editor/project-editor/managed-storage-cache";

describe("project editor managed storage cache helpers", () => {
  it("merges upgraded folder options into an existing managed-storage payload and persists it", () => {
    const persistPayload = vi.fn();

    const merged = mergeProjectEditorManagedStorageFolderOptions({
      currentPayload: {
        currentPath: "media",
        folderOptions: [],
        images: [],
        search: "hero",
      },
      nextPayload: {
        currentPath: "media",
        folderOptions: ["", "media", "media/hero"],
        images: [],
        search: "hero",
      },
      persistPayload,
    });

    expect(merged).toEqual({
      currentPath: "media",
      folderOptions: ["", "media", "media/hero"],
      images: [],
      search: "hero",
    });
    expect(persistPayload).toHaveBeenCalledWith({
      currentPath: "media",
      folderOptions: ["", "media", "media/hero"],
      images: [],
      search: "hero",
    });
  });

  it("returns the upgraded payload directly when there is no current payload", () => {
    const persistPayload = vi.fn();

    const merged = mergeProjectEditorManagedStorageFolderOptions({
      currentPayload: null,
      nextPayload: {
        currentPath: "",
        folderOptions: [""],
        folders: [],
        search: "",
      },
      persistPayload,
    });

    expect(merged).toEqual({
      currentPath: "",
      folderOptions: [""],
      folders: [],
      search: "",
    });
    expect(persistPayload).not.toHaveBeenCalled();
  });
});
