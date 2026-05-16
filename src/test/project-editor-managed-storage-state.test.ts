import { describe, expect, it } from "vitest";

import { getProjectEditorManagedStorageState } from "@/components/editor/project-editor/managed-storage-state";
import type { ContentWorkspaceMeta } from "@/lib/content-runtime/shared";

const createContentRuntime = (
  overrides: Partial<NonNullable<ContentWorkspaceMeta["contentRuntime"]>> = {},
): NonNullable<ContentWorkspaceMeta["contentRuntime"]> => ({
  customFields: [],
  editorFields: [],
  fieldSpecs: [],
  filesStorage: null,
  mediaStorage: null,
  sidebarFieldSpecs: [],
  ...overrides,
});

describe("project editor managed storage state", () => {
  it("enables managed libraries only when the mapped content runtime supports them", () => {
    const result = getProjectEditorManagedStorageState({
      contentRuntime: createContentRuntime({
        filesStorage: {
          bucketName: "docs",
          canManage: false,
          provider: "supabase_bucket",
          supportsLibrary: true,
        },
        mediaStorage: {
          bucketName: "media",
          canManage: true,
          provider: "supabase_bucket",
          supportsLibrary: true,
        },
      }),
    });

    expect(result.usesManagedFilesLibrary).toBe(true);
    expect(result.usesManagedMediaLibrary).toBe(true);
    expect(result.canUploadFeaturedImage).toBe(true);
  });

  it("keeps upload and library controls disabled when mapped storage is read-only or absent", () => {
    const result = getProjectEditorManagedStorageState({
      contentRuntime: createContentRuntime({
        mediaStorage: {
          bucketName: "media",
          canManage: false,
          provider: "supabase_bucket",
          supportsLibrary: true,
        },
      }),
    });

    expect(result.usesManagedFilesLibrary).toBe(false);
    expect(result.usesManagedMediaLibrary).toBe(true);
    expect(result.canUploadFeaturedImage).toBe(false);
  });
});
