import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = process.cwd();
const DEFERRED_SURFACES_PATH = path.join(
  REPO_ROOT,
  "src",
  "components",
  "editor",
  "project-editor",
  "deferred-surfaces.tsx",
);

describe("project editor code splitting", () => {
  it("keeps secondary editor surfaces behind dynamic imports", () => {
    const source = readFileSync(DEFERRED_SURFACES_PATH, "utf8");

    expect(source).toContain('import dynamic from "next/dynamic"');
    [
      "project-authors-manager",
      "project-editor/dialogs",
      "project-media-manager",
      "project-files-manager",
      "project-editor/settings-view",
      "project-editor/post-side-panel",
      "project-editor/taxonomy-ui",
      "project-editor/posts-mapping-workspace",
    ].forEach((chunkPath) => {
      expect(source).toContain(`import("@/components/editor/${chunkPath}")`);
    });
  });
});
