import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({
  cache: <T extends (...args: never[]) => Promise<unknown>>(fn: T) => fn,
}));

const { createAdminClientMock, createClientMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  createClientMock: vi.fn(),
}));



import { getBaseBuddyConfigPath } from "@/lib/basebuddy-config/paths";
import { createDefaultBaseBuddyConfig } from "@/lib/basebuddy-config/schema";
import {
  createDefaultContentMappingConfig,
  normalizeContentProjectMapping,
} from "@/lib/content-runtime/mapping";
import type { ContentProjectContext } from "@/lib/content-runtime/server-project-context";
import { getContentSchemaOptions } from "@/lib/content-runtime/shared";

const fixedNow = "2026-05-28T00:00:00.000Z";
const authSecret = "local-auth-secret-value-with-32-plus-chars";

describe("server project mapping access", () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    tempDir = await mkdtemp(join(tmpdir(), "basebuddy-server-project-mapping-"));
    process.chdir(tempDir);

    const mappingConfig = createDefaultContentMappingConfig();
    mappingConfig.entities.posts.status = "mapped";
    mappingConfig.entities.posts.source = {
      kind: "table",
      primaryKey: "id",
      schema: "public",
      table: "posts",
    };
    const mapping = normalizeContentProjectMapping({
      bindingId: "project-1",
      bindingMode: "mapped_content",
      bindingStatus: "ready",
      mappingConfig,
      revisionId: "revision-1",
      revisionVersion: 1,
    });

    await writeFile(
      getBaseBuddyConfigPath(),
      JSON.stringify(
        {
          ...createDefaultBaseBuddyConfig({
            now: fixedNow,
          }),
          projects: [
            {
              createdAt: fixedNow,
              createdBy: "user-1",
              id: "project-1",
              mapping,
              mappingRevisions: [
                {
                  bindingStatus: "ready",
                  createdAt: fixedNow,
                  id: "revision-1",
                  mappingConfig,
                  source: "manual",
                  version: 1,
                },
              ],
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
    createClientMock.mockRejectedValue(new Error("Mapping reads must not use the Supabase server client."));
    createAdminClientMock.mockImplementation(() => {
      throw new Error("Mapping reads must not use the Supabase admin client.");
    });
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { force: true, recursive: true });
  });

  it("uses the config mapping for runtime reads that do not need mapping-page permission", async () => {
    const { loadStoredContentProjectMapping } = await import(
      "@/lib/content-runtime/server-content-mapping-state"
    );

    await expect(
      loadStoredContentProjectMapping({
        context: {
          projectId: "project-1",
        },
        enforceReadPermission: false,
        projectId: "project-1",
      }),
    ).resolves.toMatchObject({
      mapping: {
        bindingId: "project-1",
        bindingMode: "mapped_content",
        bindingStatus: "ready",
        revisionId: "revision-1",
        revisionVersion: 1,
      },
    });
    expect(createAdminClientMock).not.toHaveBeenCalled();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("uses the config mapping after mapping read access checks pass", async () => {
    const ensureReadAccess = vi.fn();
    const { loadStoredContentProjectMapping } = await import(
      "@/lib/content-runtime/server-content-mapping-state"
    );

    await expect(
      loadStoredContentProjectMapping({
        context: {
          projectId: "project-1",
        },
        enforceReadPermission: true,
        ensureReadAccess,
        projectId: "project-1",
      }),
    ).resolves.toMatchObject({
      mapping: {
        revisionId: "revision-1",
      },
    });
    expect(ensureReadAccess).toHaveBeenCalledWith({
      projectId: "project-1",
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("falls back to a draft config mapping when no mapping revision exists yet", async () => {
    await writeFile(
      getBaseBuddyConfigPath(),
      JSON.stringify(
        {
          ...createDefaultBaseBuddyConfig({
            now: fixedNow,
          }),
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
    const { loadStoredContentProjectMapping } = await import(
      "@/lib/content-runtime/server-content-mapping-state"
    );

    await expect(
      loadStoredContentProjectMapping({
        context: {
          projectId: "project-1",
        },
        enforceReadPermission: false,
        projectId: "project-1",
      }),
    ).resolves.toMatchObject({
      mapping: {
        bindingId: "project-1",
        bindingMode: "mapped_content",
        bindingStatus: "draft",
        revisionId: null,
        revisionVersion: null,
      },
    });
  });

  it("keeps mapping settings readable when optional Supabase bucket lookup is denied", async () => {
    const { getContentProjectSupabaseStorageBuckets } = await import(
      "@/lib/content-runtime/server-project-mapping"
    );
    const context = {
      apiUrl: null,
      connectionString: "postgres://user:password@localhost:5432/postgres",
      memberAccess: {
        authorScopes: [],
        permissions: [
          "author.scope.manage",
          "content.publish.all",
          "content.publish.authored",
          "content.read.all",
          "content.read.authored",
          "content.write.all",
          "content.write.authored",
          "mapping.read",
          "mapping.write",
          "member.invite",
          "member.manage",
          "member.read",
          "project.delete",
          "project.read",
          "project.update",
        ],
        roles: ["owner"],
      },
      projectId: "project-1",
      projectSlug: "demo-project",
      publishableKey: null,
      schemaOptions: getContentSchemaOptions(null),
      user: {
        avatarUrl: null,
        email: "owner@example.com",
        id: "user-1",
        name: "Owner",
      },
    } satisfies ContentProjectContext;

    await expect(
      getContentProjectSupabaseStorageBuckets({
        dependencies: {
          ensureProjectManagementPermission: vi.fn(),
          ensureProjectPermission: vi.fn(),
          getFilesStorageCredentialStatus: vi.fn(),
          getMediaStorageCredentialStatus: vi.fn(),
          getProjectContext: vi.fn(async () => context),
          withContentDatabaseClient: vi.fn(async () => {
            throw new Error("permission denied for schema storage");
          }),
        },
        projectId: "project-1",
      }),
    ).resolves.toEqual([]);
  });
});
