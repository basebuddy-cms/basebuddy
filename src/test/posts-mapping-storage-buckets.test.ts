import { describe, expect, it } from "vitest";

import {
  getSuggestedPostsMappingStorageBucket,
  getPostsMappingSupabaseBucketOptionLabel,
  getPostsMappingSupabaseBucketOptions,
} from "@/components/editor/project-editor/posts-mapping-wizard";
import type { ProjectEditorStorageBucketOption } from "@/components/editor/project-editor/types";

const createBucket = (
  overrides: Partial<ProjectEditorStorageBucketOption> = {},
): ProjectEditorStorageBucketOption => ({
  id: "media",
  isPublic: false,
  name: "media",
  ...overrides,
});

describe("posts mapping storage buckets", () => {
  it("formats Supabase bucket labels with visibility", () => {
    expect(getPostsMappingSupabaseBucketOptionLabel(createBucket())).toBe("media (Private)");

    expect(
      getPostsMappingSupabaseBucketOptionLabel(
        createBucket({
          id: "post-assets",
          isPublic: true,
          name: "Post Assets",
        }),
      ),
    ).toBe("Post Assets (post-assets, Public)");
  });

  it("builds select options from the available install buckets", () => {
    expect(
      getPostsMappingSupabaseBucketOptions({
        availableSupabaseBuckets: [
          createBucket({ id: "files", name: "Files" }),
          createBucket({ id: "media", isPublic: true, name: "media" }),
        ],
        currentBucketName: "",
      }),
    ).toEqual([
      { label: "Files (files, Private)", value: "files" },
      { label: "media (Public)", value: "media" },
    ]);
  });

  it("keeps a saved bucket visible when it is missing from the live bucket list", () => {
    expect(
      getPostsMappingSupabaseBucketOptions({
        availableSupabaseBuckets: [createBucket({ id: "media", isPublic: true, name: "media" })],
        currentBucketName: "legacy-assets",
      }),
    ).toEqual([
      { label: "legacy-assets (Current selection)", value: "legacy-assets" },
      { label: "media (Public)", value: "media" },
    ]);
  });

  it("suggests likely media and files buckets from the available install buckets", () => {
    const availableSupabaseBuckets = [
      createBucket({ id: "uploads", name: "Uploads" }),
      createBucket({ id: "post-images", name: "Post Images" }),
      createBucket({ id: "project-files", name: "Project Files" }),
    ];

    expect(
      getSuggestedPostsMappingStorageBucket({
        availableSupabaseBuckets,
        kind: "media",
      }),
    ).toBe("post-images");

    expect(
      getSuggestedPostsMappingStorageBucket({
        availableSupabaseBuckets,
        kind: "files",
      }),
    ).toBe("project-files");
  });
});
