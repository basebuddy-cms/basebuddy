import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getBaseBuddyConfigPath } from "@/lib/basebuddy-config/paths";
import {
  createDefaultBaseBuddyConfig,
  type BaseBuddyConfig,
} from "@/lib/basebuddy-config/schema";
import { getConfigProjectMemberAccess } from "@/lib/basebuddy-config/projects";

vi.mock("server-only", () => ({}));
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  };
});

const {
  createClientMock,
  createContentCollectionEntryMock,
  deleteContentCollectionEntriesMock,
  getContentAuthorOptionsMock,
  getContentAuthorsPageMock,
  routeContextState,
  withAuthenticatedPreparedProjectAccessRouteMock,
  withAuthenticatedPreparedProjectRouteMock,
  withAuthenticatedProjectRouteMock,
} = vi.hoisted(() => {
  const state = {
    projectId: "project-1",
    user: { id: "user-owner" },
    account: {
      avatarUrl: null,
      email: "owner@example.com",
      name: "Owner",
    },
    memberAccess: {
      authorScopes: [],
      permissions: [
        "author.scope.manage",
        "content.publish.all",
        "content.read.all",
        "content.write.all",
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
    project: {
      createdAt: "2026-05-27T00:00:00.000Z",
      id: "project-1",
      name: "Docs Project",
      role: "owner",
      slug: "docs-project",
      websiteUrl: null,
    },
  };

  const withProjectRoute = vi.fn(
    (
      handler: (
        request: Request,
        context: typeof state,
      ) => Promise<Response>,
    ) =>
      (request: Request) =>
        handler(request, state),
  );

  return {
    createClientMock: vi.fn(() => {
      throw new Error("Supabase control-plane client should not be used by Phase 9 routes.");
    }),
    createContentCollectionEntryMock: vi.fn(),
    deleteContentCollectionEntriesMock: vi.fn(),
    getContentAuthorOptionsMock: vi.fn(),
    getContentAuthorsPageMock: vi.fn(),
    routeContextState: state,
    withAuthenticatedPreparedProjectAccessRouteMock: vi.fn(
      (
        resolveAccess: (
          request: Request,
          context: typeof state,
        ) => Promise<{ context: object | null; errorResponse: Response | null }>,
        handler: (
          request: Request,
          context: typeof state & Record<string, unknown>,
        ) => Promise<Response>,
      ) =>
        async (request: Request) => {
          const accessResult = await resolveAccess(request, state);

          if (accessResult.errorResponse) {
            return accessResult.errorResponse;
          }

          return handler(request, {
            ...state,
            ...(accessResult.context ?? {}),
          });
        },
    ),
    withAuthenticatedPreparedProjectRouteMock: withProjectRoute,
    withAuthenticatedProjectRouteMock: withProjectRoute,
  };
});


vi.mock("@/lib/api/project-api-auth", () => ({
  withAuthenticatedPreparedProjectAccessRoute: withAuthenticatedPreparedProjectAccessRouteMock,
  withAuthenticatedPreparedProjectRoute: withAuthenticatedPreparedProjectRouteMock,
  withAuthenticatedProjectRoute: withAuthenticatedProjectRouteMock,
}));

vi.mock("@/lib/content-runtime/server", () => ({
  createContentCollectionEntry: createContentCollectionEntryMock,
  deleteContentCollectionEntries: deleteContentCollectionEntriesMock,
  getContentAuthorOptions: getContentAuthorOptionsMock,
  getContentAuthorsPage: getContentAuthorsPageMock,
}));

import {
  DELETE as deleteAuthorsRoute,
  GET as getAuthorsRoute,
  PATCH as patchAuthorsRoute,
  POST as postAuthorsRoute,
} from "@/app/api/projects/[projectId]/authors/route";
import {
  DELETE as deleteMembersRoute,
  GET as getMembersRoute,
  PATCH as patchMembersRoute,
  POST as postMembersRoute,
} from "@/app/api/projects/[projectId]/members/route";
import {
  GET as getPermissionsRoute,
  PATCH as patchPermissionsRoute,
} from "@/app/api/projects/[projectId]/permissions/route";

const fixedNow = "2026-05-27T00:00:00.000Z";
const authSecret = "local-auth-secret-value-with-32-plus-chars";

const createUser = ({
  email,
  id,
  name,
}: {
  email: string;
  id: string;
  name: string;
}) => ({
  avatarUrl: null,
  createdAt: fixedNow,
  email,
  id,
  name,
  passwordHash: "hash",
  passwordHashParams: {
    keyLength: 64,
    name: "scrypt" as const,
  },
  passwordSalt: "salt",
  updatedAt: fixedNow,
});

describe("project member, permission, and author routes", () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "basebuddy-project-members-"));
    process.chdir(tempDir);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(fixedNow));
    vi.clearAllMocks();

    getContentAuthorOptionsMock.mockResolvedValue([
      { id: "author-1", name: "Author One", slug: "author-one" },
      { id: "author-2", name: "Author Two", slug: "author-two" },
    ]);
    getContentAuthorsPageMock.mockResolvedValue({
      items: [
        { id: "author-1", name: "Author One", slug: "author-one" },
        { id: "author-2", name: "Author Two", slug: "author-two" },
      ],
      pagination: {
        currentPage: 1,
        hasNextPage: false,
        hasPreviousPage: false,
        pageSize: 20,
        totalItems: 2,
        totalPages: 1,
      },
    });
    createContentCollectionEntryMock.mockResolvedValue({
      id: "author-created",
      name: "Created Author",
      slug: "created-author",
    });
    deleteContentCollectionEntriesMock.mockResolvedValue(undefined);

    await writeSeedConfig();
    setRouteUser("user-owner");
  });

  afterEach(async () => {
    vi.useRealTimers();
    process.chdir(originalCwd);
    await rm(tempDir, { force: true, recursive: true });
  });

  const writeSeedConfig = async () => {
    const config = createDefaultBaseBuddyConfig({
      now: fixedNow,
    });

    await writeFile(
      getBaseBuddyConfigPath(),
      JSON.stringify(
        {
          ...config,
          users: [
            createUser({ email: "owner@example.com", id: "user-owner", name: "Owner" }),
            createUser({ email: "admin@example.com", id: "user-admin", name: "Admin" }),
            createUser({ email: "writer@example.com", id: "user-writer", name: "Writer" }),
            createUser({ email: "viewer@example.com", id: "user-viewer", name: "Viewer" }),
            createUser({ email: "new@example.com", id: "user-new", name: "New User" }),
          ],
          projects: [
            {
              createdAt: fixedNow,
              createdBy: "user-owner",
              id: "project-1",
              mapping: null,
              mappingRevisions: [],
              members: [
                {
                  allowPermissionKeys: [],
                  authorScopes: [],
                  denyPermissionKeys: [],
                  joinedAt: fixedNow,
                  roles: ["owner"],
                  userId: "user-owner",
                },
                {
                  allowPermissionKeys: [],
                  authorScopes: [],
                  denyPermissionKeys: [],
                  joinedAt: fixedNow,
                  roles: ["admin"],
                  userId: "user-admin",
                },
                {
                  allowPermissionKeys: [],
                  authorScopes: [
                    { canPublish: false, cmsAuthorId: "author-1" },
                    { canPublish: true, cmsAuthorId: "author-2" },
                  ],
                  denyPermissionKeys: [],
                  joinedAt: fixedNow,
                  roles: ["author"],
                  userId: "user-writer",
                },
                {
                  allowPermissionKeys: [],
                  authorScopes: [],
                  denyPermissionKeys: [],
                  joinedAt: fixedNow,
                  roles: ["viewer"],
                  userId: "user-viewer",
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
        } satisfies BaseBuddyConfig,
        null,
        2,
      ),
      "utf8",
    );
  };

  const readSavedConfig = async () =>
    JSON.parse(await readFile(getBaseBuddyConfigPath(), "utf8")) as BaseBuddyConfig;

  const setRouteUser = async (userId: string) => {
    const config = await readSavedConfig();
    const project = config.projects[0]!;
    const member = project.members.find((candidate) => candidate.userId === userId)!;
    const user = config.users.find((candidate) => candidate.id === userId)!;
    const access = getConfigProjectMemberAccess(member);

    routeContextState.user = { id: userId };
    routeContextState.account = {
      avatarUrl: user.avatarUrl,
      email: user.email,
      name: user.name,
    };
    routeContextState.memberAccess = access;
    routeContextState.project = {
      createdAt: project.createdAt,
      id: project.id,
      name: project.name,
      role: access.roles.includes("owner") ? "owner" : access.roles.includes("admin") ? "admin" : access.roles[0],
      slug: project.slug,
      websiteUrl: project.websiteUrl,
    };
  };

  it("pages project members from config and preserves per-author publish access", async () => {
    const response = await getMembersRoute(
      new Request("http://localhost/api/projects/project-1/members?page=2&pageSize=2"),
      { params: Promise.resolve({ projectId: "project-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      currentUserId: "user-owner",
      hasMoreMembers: false,
      memberPage: 2,
      memberPageSize: 2,
      members: [
        {
          authorScopes: [
            { canPublish: false, cmsAuthorId: "author-1" },
            { canPublish: true, cmsAuthorId: "author-2" },
          ],
          email: "writer@example.com",
          roles: ["author"],
          userId: "user-writer",
        },
        {
          email: "viewer@example.com",
          roles: ["viewer"],
          userId: "user-viewer",
        },
      ],
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("adds, updates, and removes project members in config", async () => {
    const addResponse = await postMembersRoute(
      new Request("http://localhost/api/projects/project-1/members", {
        body: JSON.stringify({
          action: "add_member",
          authorScopes: [{ cmsAuthorId: "author-1", canPublish: false }],
          email: "new@example.com",
          roles: ["author"],
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({ projectId: "project-1" }) },
    );

    expect(addResponse.status).toBe(200);
    expect((await readSavedConfig()).projects[0]?.members).toContainEqual(
      expect.objectContaining({
        authorScopes: [{ canPublish: false, cmsAuthorId: "author-1" }],
        roles: ["author"],
        userId: "user-new",
      }),
    );

    const updateResponse = await patchMembersRoute(
      new Request("http://localhost/api/projects/project-1/members", {
        body: JSON.stringify({
          action: "update_member",
          authorScopes: [{ cmsAuthorId: "author-2", canPublish: true }],
          roles: ["editor"],
          userId: "user-new",
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      }),
      { params: Promise.resolve({ projectId: "project-1" }) },
    );

    expect(updateResponse.status).toBe(200);
    expect((await readSavedConfig()).projects[0]?.members).toContainEqual(
      expect.objectContaining({
        authorScopes: [{ canPublish: true, cmsAuthorId: "author-2" }],
        roles: ["editor"],
        userId: "user-new",
      }),
    );

    const deleteResponse = await deleteMembersRoute(
      new Request("http://localhost/api/projects/project-1/members", {
        body: JSON.stringify({ userId: "user-new" }),
        headers: { "Content-Type": "application/json" },
        method: "DELETE",
      }),
      { params: Promise.resolve({ projectId: "project-1" }) },
    );

    expect(deleteResponse.status).toBe(200);
    expect((await readSavedConfig()).projects[0]?.members.map((member) => member.userId)).not.toContain("user-new");
  });

  it("protects owner membership changes from non-owners", async () => {
    await setRouteUser("user-admin");

    const assignOwnerResponse = await patchMembersRoute(
      new Request("http://localhost/api/projects/project-1/members", {
        body: JSON.stringify({
          action: "update_member",
          authorScopes: [],
          roles: ["owner"],
          userId: "user-writer",
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      }),
      { params: Promise.resolve({ projectId: "project-1" }) },
    );
    const removeOwnerResponse = await deleteMembersRoute(
      new Request("http://localhost/api/projects/project-1/members", {
        body: JSON.stringify({ userId: "user-owner" }),
        headers: { "Content-Type": "application/json" },
        method: "DELETE",
      }),
      { params: Promise.resolve({ projectId: "project-1" }) },
    );

    expect(assignOwnerResponse.status).toBe(403);
    expect(removeOwnerResponse.status).toBe(403);
  });

  it("computes and writes permission overrides from config", async () => {
    const patchResponse = await patchPermissionsRoute(
      new Request("http://localhost/api/projects/project-1/permissions", {
        body: JSON.stringify({
          allowPermissionKeys: ["mapping.write"],
          denyPermissionKeys: ["content.read.all"],
          userId: "user-viewer",
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      }),
      { params: Promise.resolve({ projectId: "project-1" }) },
    );

    expect(patchResponse.status).toBe(200);
    expect((await readSavedConfig()).projects[0]?.members).toContainEqual(
      expect.objectContaining({
        allowPermissionKeys: ["mapping.write"],
        denyPermissionKeys: ["content.read.all"],
        userId: "user-viewer",
      }),
    );

    const getResponse = await getPermissionsRoute(
      new Request("http://localhost/api/projects/project-1/permissions"),
      { params: Promise.resolve({ projectId: "project-1" }) },
    );

    expect(getResponse.status).toBe(200);
    await expect(getResponse.json()).resolves.toMatchObject({
      members: expect.arrayContaining([
        expect.objectContaining({
          allowPermissionKeys: ["mapping.write"],
          denyPermissionKeys: ["content.read.all"],
          effectivePermissionKeys: expect.arrayContaining(["mapping.write", "project.read"]),
          userId: "user-viewer",
        }),
      ]),
    });
  });

  it("blocks admins from changing project delete permission overrides", async () => {
    await setRouteUser("user-admin");

    const response = await patchPermissionsRoute(
      new Request("http://localhost/api/projects/project-1/permissions", {
        body: JSON.stringify({
          allowPermissionKeys: ["project.delete"],
          denyPermissionKeys: [],
          userId: "user-admin",
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      }),
      { params: Promise.resolve({ projectId: "project-1" }) },
    );

    expect(response.status).toBe(403);
  });

  it("reads, writes, and clears author assignments from member scopes in config", async () => {
    const getResponse = await getAuthorsRoute(
      new Request("http://localhost/api/projects/project-1/authors?includeMeta=true"),
      { params: Promise.resolve({ projectId: "project-1" }) },
    );

    expect(getResponse.status).toBe(200);
    await expect(getResponse.json()).resolves.toMatchObject({
      assignments: [
        { canPublish: false, cmsAuthorId: "author-1", userId: "user-writer" },
        { canPublish: true, cmsAuthorId: "author-2", userId: "user-writer" },
      ],
      authorMembers: [
        {
          email: "writer@example.com",
          name: "Writer",
          userId: "user-writer",
        },
      ],
    });

    const patchResponse = await patchAuthorsRoute(
      new Request("http://localhost/api/projects/project-1/authors", {
        body: JSON.stringify({
          action: "set_author_assignment",
          canPublish: false,
          cmsAuthorId: "author-2",
          userId: "user-writer",
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      }),
      { params: Promise.resolve({ projectId: "project-1" }) },
    );

    expect(patchResponse.status).toBe(200);
    expect(
      (await readSavedConfig()).projects[0]?.members.find((member) => member.userId === "user-writer")?.authorScopes,
    ).toEqual([
      { canPublish: false, cmsAuthorId: "author-1" },
      { canPublish: false, cmsAuthorId: "author-2" },
    ]);

    const deleteResponse = await deleteAuthorsRoute(
      new Request("http://localhost/api/projects/project-1/authors", {
        body: JSON.stringify({ entryIds: ["author-2"] }),
        headers: { "Content-Type": "application/json" },
        method: "DELETE",
      }),
      { params: Promise.resolve({ projectId: "project-1" }) },
    );

    expect(deleteResponse.status).toBe(200);
    expect(
      (await readSavedConfig()).projects[0]?.members.find((member) => member.userId === "user-writer")?.authorScopes,
    ).toEqual([{ canPublish: false, cmsAuthorId: "author-1" }]);
  });

  it("adds a new content author and stores the optional user assignment in config", async () => {
    const response = await postAuthorsRoute(
      new Request("http://localhost/api/projects/project-1/authors", {
        body: JSON.stringify({
          action: "create_author",
          assignUserId: "user-writer",
          name: "Created Author",
          slug: "created-author",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({ projectId: "project-1" }) },
    );

    expect(response.status).toBe(200);
    expect(createContentCollectionEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "authors",
        name: "Created Author",
        projectId: "project-1",
        slug: "created-author",
      }),
    );
    expect(
      (await readSavedConfig()).projects[0]?.members.find((member) => member.userId === "user-writer")?.authorScopes,
    ).toContainEqual({ canPublish: true, cmsAuthorId: "author-created" });
  });
});
