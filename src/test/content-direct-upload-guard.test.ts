import { describe, expect, it } from "vitest";

import {
  assertPreparedContentUploads,
  registerPreparedContentUpload,
} from "@/lib/content-runtime/server-media-shared";

describe("content direct upload guard", () => {
  it("allows completion for object paths prepared for the same project and user", () => {
    registerPreparedContentUpload({
      kind: "media",
      objectPath: "uploads/hero.png",
      projectId: "project-1",
      userId: "user-1",
    });

    expect(() =>
      assertPreparedContentUploads({
        kind: "media",
        objectPaths: ["uploads/hero.png"],
        projectId: "project-1",
        userId: "user-1",
      }),
    ).not.toThrow();
  });

  it("rejects completion for object paths prepared by another project or user", () => {
    registerPreparedContentUpload({
      kind: "files",
      objectPath: "docs/spec.pdf",
      projectId: "project-1",
      userId: "user-1",
    });

    expect(() =>
      assertPreparedContentUploads({
        kind: "files",
        objectPaths: ["docs/spec.pdf"],
        projectId: "project-2",
        userId: "user-1",
      }),
    ).toThrow("Could not verify those uploads. Prepare the upload again and try.");

    expect(() =>
      assertPreparedContentUploads({
        kind: "files",
        objectPaths: ["docs/spec.pdf"],
        projectId: "project-1",
        userId: "user-2",
      }),
    ).toThrow("Could not verify those uploads. Prepare the upload again and try.");
  });
});
