import { describe, expect, it } from "vitest";

import {
  getContentCategoriesHierarchyCacheKey,
  getContentPostProjectionRefreshKey,
  getContentWorkspaceRuntimeSignature,
} from "@/lib/content-runtime/server-content-cache-keys";

const createMapping = (overrides?: Partial<{ bindingId: string; revisionId: string | null; revisionVersion: number | null }>) =>
  ({
    bindingId: "binding-1",
    revisionId: "revision-1",
    revisionVersion: 3,
    ...overrides,
  }) as never;

describe("existing DB cache keys", () => {
  it("builds the workspace runtime signature from mapping revision and storage modes", () => {
    expect(
      getContentWorkspaceRuntimeSignature({
        filesStorageMode: "s3:files-bucket",
        mapping: createMapping(),
        mediaStorageMode: "supabase:media-bucket",
      }),
    ).toBe("mapped_content:revision-1:3:supabase:media-bucket:s3:files-bucket");
  });

  it("builds the post projection refresh key from project, binding, revision, and post scope", () => {
    expect(
      getContentPostProjectionRefreshKey({
        mapping: createMapping(),
        postIds: ["post-1", "post-2"],
        projectId: "project-1",
      }),
    ).toBe("project-1:binding-1:revision-1:3:post-1:post-2");
    expect(
      getContentPostProjectionRefreshKey({
        mapping: createMapping({ revisionId: null, revisionVersion: null }),
        projectId: "project-1",
      }),
    ).toBe("project-1:binding-1:none:0:*");
  });

  it("builds the categories hierarchy cache key from project and mapping revision", () => {
    expect(
      getContentCategoriesHierarchyCacheKey({
        mapping: createMapping(),
        projectId: "project-1",
      }),
    ).toBe("mapped-content-categories-hierarchy:v1:project-1:binding-1:revision-1:3");
  });
});
