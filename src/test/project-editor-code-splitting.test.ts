import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = process.cwd();
const REACT_LOADABLE_MANIFEST_PATH = path.join(REPO_ROOT, ".next", "react-loadable-manifest.json");

const loadReactLoadableManifestKeys = () => {
  const manifest = JSON.parse(
    readFileSync(REACT_LOADABLE_MANIFEST_PATH, "utf8"),
  ) as Record<string, unknown>;

  return Object.keys(manifest);
};

describe("project editor code splitting", () => {
  it("builds secondary editor surfaces as lazy chunks instead of bundling them into the main shell", () => {
    const manifestKeys = loadReactLoadableManifestKeys();

    expect(manifestKeys.some((key) => key.includes("project-authors-manager"))).toBe(true);
    expect(manifestKeys.some((key) => key.includes("dialogs"))).toBe(true);
    expect(manifestKeys.some((key) => key.includes("project-media-manager"))).toBe(true);
    expect(manifestKeys.some((key) => key.includes("project-files-manager"))).toBe(true);
    expect(manifestKeys.some((key) => key.includes("settings-view"))).toBe(true);
    expect(manifestKeys.some((key) => key.includes("post-side-panel"))).toBe(true);
    expect(manifestKeys.some((key) => key.includes("taxonomy-ui"))).toBe(true);
    expect(manifestKeys.some((key) => key.includes("posts-mapping-workspace"))).toBe(true);
  });
});
