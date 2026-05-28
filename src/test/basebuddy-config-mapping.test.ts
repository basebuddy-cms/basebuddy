import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getBaseBuddyConfigPath } from "@/lib/basebuddy-config/paths";
import { createDefaultBaseBuddyConfig } from "@/lib/basebuddy-config/schema";
import {
  createDefaultContentMappingConfig,
  normalizeContentProjectMapping,
} from "@/lib/content-runtime/mapping";

const fixedNow = "2026-05-28T00:00:00.000Z";
const authSecret = "local-auth-secret-value-with-32-plus-chars";

describe("config-backed content mapping helpers", () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "basebuddy-config-mapping-"));
    process.chdir(tempDir);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(fixedNow));
  });

  afterEach(async () => {
    vi.useRealTimers();
    process.chdir(originalCwd);
    await rm(tempDir, { force: true, recursive: true });
  });

  const writeProjectConfig = async () => {
    const initialMappingConfig = createDefaultContentMappingConfig();
    initialMappingConfig.entities.posts.status = "mapped";
    initialMappingConfig.entities.posts.source = {
      kind: "table",
      primaryKey: "id",
      schema: "public",
      table: "posts",
    };
    const initialMapping = normalizeContentProjectMapping({
      bindingId: "project-1",
      bindingMode: "mapped_content",
      bindingStatus: "draft",
      mappingConfig: initialMappingConfig,
      revisionId: "revision-1",
      revisionVersion: 1,
    });
    const config = createDefaultBaseBuddyConfig({
      now: fixedNow,
    });

    await writeFile(
      getBaseBuddyConfigPath(),
      JSON.stringify(
        {
          ...config,
          projects: [
            {
              createdAt: fixedNow,
              createdBy: "user-1",
              id: "project-1",
              mapping: initialMapping,
              mappingRevisions: [
                {
                  bindingStatus: "draft",
                  createdAt: "2026-05-27T00:00:00.000Z",
                  id: "revision-1",
                  mappingConfig: initialMapping.mappingConfig,
                  source: "system",
                  version: 1,
                },
              ],
              members: [
                {
                  allowPermissionKeys: [],
                  authorScopes: [],
                  denyPermissionKeys: [],
                  joinedAt: fixedNow,
                  roles: ["owner"],
                  userId: "user-1",
                },
              ],
              name: "Demo Project",
              sidebar: null,
              sidebarRevisions: [],
              slug: "demo-project",
              status: "active",
              updatedAt: fixedNow,
              websiteUrl: null,
            },
          ],
        },
        null,
        2,
      ),
      "utf8",
    );

    return initialMapping;
  };

  const readSavedConfig = async () =>
    JSON.parse(await readFile(getBaseBuddyConfigPath(), "utf8")) as ReturnType<
      typeof createDefaultBaseBuddyConfig
    >;

  it("loads the current project mapping from projects[].mapping", async () => {
    const initialMapping = await writeProjectConfig();
    const { getConfigProjectContentMapping } = await import("@/lib/basebuddy-config/projects");

    await expect(
      getConfigProjectContentMapping({
        projectId: "project-1",
      }),
    ).resolves.toEqual(initialMapping);
  });

  it("saves a new mapping revision and updates projects[].mapping", async () => {
    await writeProjectConfig();
    const nextMappingConfig = createDefaultContentMappingConfig();
    nextMappingConfig.entities.posts.status = "mapped";
    nextMappingConfig.entities.posts.source = {
      kind: "table",
      primaryKey: "id",
      schema: "content",
      table: "articles",
    };
    const {
      saveConfigProjectContentMappingRevision,
    } = await import("@/lib/basebuddy-config/projects");

    const savedMapping = await saveConfigProjectContentMappingRevision({
      bindingStatus: "ready",
      mappingConfig: nextMappingConfig,
      projectId: "project-1",
      source: "manual",
    });
    const savedConfig = await readSavedConfig();
    const savedProject = savedConfig.projects[0]!;

    expect(savedMapping).toMatchObject({
      bindingId: "project-1",
      bindingMode: "mapped_content",
      bindingStatus: "ready",
      revisionVersion: 2,
    });
    expect(savedMapping.revisionId).not.toBe("revision-1");
    expect(normalizeContentProjectMapping(savedProject.mapping)).toEqual(savedMapping);
    expect(savedProject.mappingRevisions).toEqual([
      expect.objectContaining({
        bindingStatus: "draft",
        id: "revision-1",
        source: "system",
        version: 1,
      }),
      {
        bindingStatus: "ready",
        createdAt: fixedNow,
        id: savedMapping.revisionId,
        mappingConfig: savedMapping.mappingConfig,
        source: "manual",
        version: 2,
      },
    ]);
  });

  it("returns a draft mapping when an older config project has no saved mapping yet", async () => {
    const config = createDefaultBaseBuddyConfig({
      now: fixedNow,
    });

    await writeFile(
      getBaseBuddyConfigPath(),
      JSON.stringify(
        {
          ...config,
          projects: [
            {
              createdAt: fixedNow,
              createdBy: "user-1",
              id: "project-1",
              mapping: null,
              mappingRevisions: [],
              members: [],
              name: "Demo Project",
              sidebar: null,
              sidebarRevisions: [],
              slug: "demo-project",
              status: "active",
              updatedAt: fixedNow,
              websiteUrl: null,
            },
          ],
        },
        null,
        2,
      ),
      "utf8",
    );
    const { getConfigProjectContentMapping } = await import("@/lib/basebuddy-config/projects");

    await expect(
      getConfigProjectContentMapping({
        projectId: "project-1",
      }),
    ).resolves.toMatchObject({
      bindingId: "project-1",
      bindingMode: "mapped_content",
      bindingStatus: "draft",
      revisionId: null,
      revisionVersion: null,
    });
  });
});
