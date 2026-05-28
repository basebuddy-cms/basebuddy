import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getBaseBuddyConfigPath } from "@/lib/basebuddy-config/paths";
import { createDefaultBaseBuddyConfig } from "@/lib/basebuddy-config/schema";
import { normalizeContentProjectMapping } from "@/lib/content-runtime/mapping";

const fixedNow = "2026-05-27T00:00:00.000Z";
const authSecret = "local-auth-secret-value-with-32-plus-chars";

describe("config-backed project access helpers", () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "basebuddy-config-projects-"));
    process.chdir(tempDir);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(fixedNow));
  });

  afterEach(async () => {
    vi.useRealTimers();
    process.chdir(originalCwd);
    await rm(tempDir, { force: true, recursive: true });
  });

  const writeSeedConfig = async (
    overrides: Partial<ReturnType<typeof createDefaultBaseBuddyConfig>> = {},
  ) => {
    const config = {
      ...createDefaultBaseBuddyConfig({
        now: fixedNow,
      }),
      ...overrides,
    };

    await writeFile(getBaseBuddyConfigPath(), JSON.stringify(config, null, 2), "utf8");

    return config;
  };

  const readSavedConfig = async () =>
    JSON.parse(await readFile(getBaseBuddyConfigPath(), "utf8")) as ReturnType<
      typeof createDefaultBaseBuddyConfig
    >;

  it("loads project member access from process.cwd()/basebuddy.config.json", async () => {
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
              createdBy: "user-owner",
              id: "project-1",
              mapping: null,
              mappingRevisions: [],
              members: [
                {
                  allowPermissionKeys: ["content.write.all"],
                  authorScopes: [
                    {
                      canPublish: false,
                      cmsAuthorId: "author-1",
                    },
                  ],
                  denyPermissionKeys: ["content.read.all"],
                  joinedAt: fixedNow,
                  roles: ["viewer"],
                  userId: "user-1",
                },
              ],
              name: "Docs Project",
              sidebar: null,
              sidebarRevisions: [],
              slug: "docs-project",
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

    const { getConfigProjectAccessContext } = await import("@/lib/basebuddy-config/projects");

    const accessContext = await getConfigProjectAccessContext({
      projectId: "project-1",
      userId: "user-1",
    });

    expect(accessContext).toMatchObject({
      memberAccess: {
        authorScopes: [
          {
            canPublish: false,
            cmsAuthorId: "author-1",
          },
        ],
        permissions: expect.arrayContaining(["content.write.all", "project.read"]),
        roles: ["viewer"],
      },
      project: {
        id: "project-1",
        name: "Docs Project",
        role: "viewer",
        slug: "docs-project",
        websiteUrl: null,
      },
    });
    expect(accessContext?.memberAccess.permissions).not.toContain("content.read.all");
  });

  it("returns null when the user has no project membership", async () => {
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
        },
        null,
        2,
      ),
      "utf8",
    );

    const { getConfigProjectAccessContext } = await import("@/lib/basebuddy-config/projects");

    await expect(
      getConfigProjectAccessContext({
        projectId: "project-1",
        userId: "user-1",
      }),
    ).resolves.toBeNull();
  });

  it("creates a config project with an owner member and default draft mapping", async () => {
    await writeSeedConfig();

    const { createConfigProject } = await import("@/lib/basebuddy-config/projects");

    const project = await createConfigProject({
      name: " Demo Project ",
      slug: "Demo Project",
      userId: "user-owner",
    });
    const savedConfig = await readSavedConfig();
    const savedProject = savedConfig.projects[0]!;
    const mapping = normalizeContentProjectMapping(savedProject.mapping);

    expect(project).toMatchObject({
      createdAt: fixedNow,
      name: "Demo Project",
      role: "owner",
      slug: "demo-project",
      websiteUrl: null,
    });
    expect(savedProject).toMatchObject({
      createdAt: fixedNow,
      createdBy: "user-owner",
      id: project.id,
      name: "Demo Project",
      slug: "demo-project",
      status: "active",
      updatedAt: fixedNow,
      websiteUrl: null,
    });
    expect(savedProject.members).toEqual([
      {
        allowPermissionKeys: [],
        authorScopes: [],
        denyPermissionKeys: [],
        joinedAt: fixedNow,
        roles: ["owner"],
        userId: "user-owner",
      },
    ]);
    expect(mapping).toMatchObject({
      bindingId: project.id,
      bindingMode: "mapped_content",
      bindingStatus: "draft",
      revisionVersion: 1,
    });
    expect(savedProject.mappingRevisions).toEqual([
      {
        bindingStatus: "draft",
        createdAt: fixedNow,
        id: mapping.revisionId,
        mappingConfig: mapping.mappingConfig,
        source: "system",
        version: 1,
      },
    ]);
  });

  it("detects normalized slug conflicts from config", async () => {
    await writeSeedConfig();

    const {
      createConfigProject,
      isConfigProjectSlugAvailable,
    } = await import("@/lib/basebuddy-config/projects");

    await createConfigProject({
      name: "Docs Project",
      slug: "Docs Project",
      userId: "user-owner",
    });

    await expect(isConfigProjectSlugAvailable("docs-project")).resolves.toBe(false);
    await expect(isConfigProjectSlugAvailable("new-project")).resolves.toBe(true);
    await expect(
      createConfigProject({
        name: "Duplicate",
        slug: "docs-project",
        userId: "user-owner",
      }),
    ).rejects.toThrow(/project address is already taken/i);
  });

  it("lists and loads only config projects where the user is a member", async () => {
    await writeSeedConfig({
      projects: [
        {
          createdAt: "2026-05-20T00:00:00.000Z",
          createdBy: "user-owner",
          id: "project-older",
          mapping: null,
          mappingRevisions: [],
          members: [
            {
              allowPermissionKeys: [],
              authorScopes: [],
              denyPermissionKeys: [],
              joinedAt: fixedNow,
              roles: ["viewer", "editor"],
              userId: "user-1",
            },
          ],
          name: "Older Project",
          sidebar: null,
          sidebarRevisions: [],
          slug: "older-project",
          status: "active",
          updatedAt: fixedNow,
          websiteUrl: null,
        },
        {
          createdAt: "2026-05-27T00:00:00.000Z",
          createdBy: "user-owner",
          id: "project-newer",
          mapping: null,
          mappingRevisions: [],
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
          name: "Newer Project",
          sidebar: null,
          sidebarRevisions: [],
          slug: "newer-project",
          status: "active",
          updatedAt: fixedNow,
          websiteUrl: "https://newer.example.com",
        },
        {
          createdAt: "2026-05-28T00:00:00.000Z",
          createdBy: "user-owner",
          id: "project-other",
          mapping: null,
          mappingRevisions: [],
          members: [
            {
              allowPermissionKeys: [],
              authorScopes: [],
              denyPermissionKeys: [],
              joinedAt: fixedNow,
              roles: ["owner"],
              userId: "user-2",
            },
          ],
          name: "Other User Project",
          sidebar: null,
          sidebarRevisions: [],
          slug: "other-user-project",
          status: "active",
          updatedAt: fixedNow,
          websiteUrl: null,
        },
      ],
    });

    const {
      getConfigProjectForUser,
      getConfigProjectForUserBySlug,
      listConfigProjectsForUser,
    } = await import("@/lib/basebuddy-config/projects");

    await expect(listConfigProjectsForUser({ userId: "user-1" })).resolves.toEqual({
      hasMoreProjects: false,
      projectSearchQuery: "",
      projects: [
        {
          createdAt: "2026-05-27T00:00:00.000Z",
          id: "project-newer",
          name: "Newer Project",
          role: "owner",
          slug: "newer-project",
          websiteUrl: "https://newer.example.com",
        },
        {
          createdAt: "2026-05-20T00:00:00.000Z",
          id: "project-older",
          name: "Older Project",
          role: "editor",
          slug: "older-project",
          websiteUrl: null,
        },
      ],
      setupRequired: false,
    });
    await expect(
      getConfigProjectForUserBySlug({
        projectSlug: "newer-project",
        userId: "user-1",
      }),
    ).resolves.toMatchObject({
      project: {
        id: "project-newer",
        role: "owner",
      },
      setupRequired: false,
    });
    await expect(
      getConfigProjectForUser({
        projectId: "project-other",
        userId: "user-1",
      }),
    ).resolves.toEqual({
      project: null,
      setupRequired: false,
    });
  });

  it("updates project metadata and rejects slug conflicts except the current project", async () => {
    await writeSeedConfig();

    const {
      createConfigProject,
      updateConfigProjectMetadata,
    } = await import("@/lib/basebuddy-config/projects");

    const firstProject = await createConfigProject({
      name: "First",
      slug: "first",
      userId: "user-owner",
    });
    const secondProject = await createConfigProject({
      name: "Second",
      slug: "second",
      userId: "user-owner",
    });

    await expect(
      updateConfigProjectMetadata({
        name: "First Renamed",
        projectId: firstProject.id,
        slug: secondProject.slug,
        websiteUrl: null,
      }),
    ).rejects.toThrow(/project address is already taken/i);

    await expect(
      updateConfigProjectMetadata({
        name: "First Renamed",
        projectId: firstProject.id,
        slug: firstProject.slug,
        websiteUrl: "https://first.example.com",
      }),
    ).resolves.toMatchObject({
      id: firstProject.id,
      name: "First Renamed",
      slug: "first",
      websiteUrl: "https://first.example.com",
    });

    const savedConfig = await readSavedConfig();

    expect(savedConfig.projects.find((project) => project.id === firstProject.id)).toMatchObject({
      name: "First Renamed",
      slug: "first",
      updatedAt: fixedNow,
      websiteUrl: "https://first.example.com",
    });
  });

  it("deletes a project and removes project-scoped invitations from config", async () => {
    await writeSeedConfig();

    const {
      createConfigProject,
      deleteConfigProject,
    } = await import("@/lib/basebuddy-config/projects");

    const firstProject = await createConfigProject({
      name: "First",
      slug: "first",
      userId: "user-owner",
    });
    const secondProject = await createConfigProject({
      name: "Second",
      slug: "second",
      userId: "user-owner",
    });

    await writeFile(
      getBaseBuddyConfigPath(),
      JSON.stringify(
        {
          ...(await readSavedConfig()),
          invitations: [
            {
              acceptedAt: null,
              acceptedBy: null,
              authorScopes: [],
              createdAt: fixedNow,
              createdBy: "user-owner",
              expiresAt: "2026-06-27T00:00:00.000Z",
              id: "invitation-first",
              invitedEmail: "first@example.com",
              projectId: firstProject.id,
              publicToken: "public-token-first",
              revokedAt: null,
              revokedBy: null,
              roles: ["viewer"],
            },
            {
              acceptedAt: null,
              acceptedBy: null,
              authorScopes: [],
              createdAt: fixedNow,
              createdBy: "user-owner",
              expiresAt: "2026-06-27T00:00:00.000Z",
              id: "invitation-second",
              invitedEmail: "second@example.com",
              projectId: secondProject.id,
              publicToken: "public-token-second",
              revokedAt: null,
              revokedBy: null,
              roles: ["viewer"],
            },
          ],
        },
        null,
        2,
      ),
      "utf8",
    );

    await expect(deleteConfigProject({ projectId: firstProject.id })).resolves.toEqual({
      deletedProject: expect.objectContaining({
        id: firstProject.id,
        slug: "first",
      }),
    });

    const savedConfig = await readSavedConfig();

    expect(savedConfig.projects.map((project) => project.id)).toEqual([secondProject.id]);
    expect(savedConfig.invitations.map((invitation) => invitation.id)).toEqual([
      "invitation-second",
    ]);
  });
});
