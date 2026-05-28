import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getBaseBuddyConfigPath } from "@/lib/basebuddy-config/paths";
import {
  createDefaultBaseBuddyConfig,
  type BaseBuddyConfig,
} from "@/lib/basebuddy-config/schema";
import {
  createDefaultContentPostSidebarConfig,
  normalizeContentPostSidebarConfig,
} from "@/lib/content-runtime/shared";

vi.mock("server-only", () => ({}));
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  };
});

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(() => {
    throw new Error("Supabase control-plane client should not be used for sidebar config.");
  }),
}));


const fixedNow = "2026-05-28T00:00:00.000Z";
const authSecret = "local-auth-secret-value-with-32-plus-chars";

describe("project post sidebar config server helpers", () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "basebuddy-sidebar-config-"));
    process.chdir(tempDir);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(fixedNow));
    vi.clearAllMocks();

    await writeFile(
      getBaseBuddyConfigPath(),
      JSON.stringify(createSeedConfig(), null, 2),
      "utf8",
    );
  });

  afterEach(async () => {
    vi.useRealTimers();
    process.chdir(originalCwd);
    await rm(tempDir, { force: true, recursive: true });
  });

  const createSeedConfig = (): BaseBuddyConfig => ({
    ...createDefaultBaseBuddyConfig({
      now: fixedNow,
    }),
    users: [],
    projects: [
      {
        createdAt: fixedNow,
        createdBy: "user-owner",
        id: "project-1",
        mapping: null,
        mappingRevisions: [],
        members: [],
        name: "Docs Project",
        sidebar: null,
        sidebarRevisions: [],
        slug: "docs-project",
        status: "active",
        updatedAt: fixedNow,
        websiteUrl: null,
      },
    ],
  });

  const readSavedConfig = async () =>
    JSON.parse(await readFile(getBaseBuddyConfigPath(), "utf8")) as BaseBuddyConfig;

  it("returns the default sidebar config when no config has been saved", async () => {
    const { getProjectPostSidebarConfig } = await import(
      "@/lib/control-plane/project-post-sidebar-config"
    );

    await expect(getProjectPostSidebarConfig("project-1")).resolves.toEqual(
      createDefaultContentPostSidebarConfig(),
    );
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("saves sidebar config and appends a config revision", async () => {
    const {
      getProjectPostSidebarConfig,
      saveProjectPostSidebarConfig,
    } = await import("@/lib/control-plane/project-post-sidebar-config");
    const nextSidebar = normalizeContentPostSidebarConfig({
      nodes: [
        { id: "slug", kind: "field", parentId: null, visible: true },
        { id: "custom", kind: "page", label: "Custom", parentId: null, visible: true },
        { id: "custom_field:deck", kind: "field", parentId: "custom", visible: false },
      ],
      version: 2,
    });

    await expect(
      saveProjectPostSidebarConfig({
        config: nextSidebar,
        projectId: "project-1",
        source: "manual",
      }),
    ).resolves.toEqual(nextSidebar);
    await expect(getProjectPostSidebarConfig("project-1")).resolves.toEqual(nextSidebar);

    const savedProject = (await readSavedConfig()).projects[0]!;
    expect(savedProject.sidebar).toEqual(nextSidebar);
    expect(savedProject.sidebarRevisions).toEqual([
      expect.objectContaining({
        config: nextSidebar,
        createdAt: fixedNow,
        source: "manual",
        version: 1,
      }),
    ]);
  });
});
