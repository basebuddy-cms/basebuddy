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
import {
  createDefaultContentPostSidebarConfig,
  normalizeContentPostSidebarConfig,
} from "@/lib/content-runtime/shared";

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  };
});

const {
  invalidateProjectRuntimeCacheGroupsMock,
  routeContextState,
  withAuthenticatedPreparedProjectRouteMock,
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
      permissions: ["mapping.read", "mapping.write", "project.read"],
      roles: ["owner"],
    },
    project: {
      createdAt: "2026-05-28T00:00:00.000Z",
      id: "project-1",
      name: "Demo Project",
      role: "owner",
      slug: "demo-project",
      websiteUrl: null,
    },
  };

  return {
    invalidateProjectRuntimeCacheGroupsMock: vi.fn(),
    routeContextState: state,
    withAuthenticatedPreparedProjectRouteMock: vi.fn(
      (
        handler: (
          request: Request,
          context: typeof state,
        ) => Promise<Response>,
      ) =>
        (request: Request) =>
          handler(request, state),
    ),
  };
});

vi.mock("@/lib/api/project-api-auth", () => ({
  withAuthenticatedPreparedProjectRoute: withAuthenticatedPreparedProjectRouteMock,
}));

vi.mock("@/lib/content-runtime/server-runtime-cache", () => ({
  invalidateProjectRuntimeCacheGroups: invalidateProjectRuntimeCacheGroupsMock,
  projectRuntimeCacheGroups: {
    workspaceMeta: "workspace-meta",
  },
}));

const fixedNow = "2026-05-28T00:00:00.000Z";
const authSecret = "local-auth-secret-value-with-32-plus-chars";

import {
  GET as getSidebarFieldsRoute,
  PUT as putSidebarFieldsRoute,
} from "@/app/api/projects/[projectId]/settings/sidebar-fields/route";

describe("project sidebar fields route", () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "basebuddy-sidebar-route-"));
    process.chdir(tempDir);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(fixedNow));
    vi.clearAllMocks();

    await writeFile(
      getBaseBuddyConfigPath(),
      JSON.stringify(createSeedConfig(), null, 2),
      "utf8",
    );
    await setRouteUser("user-owner");
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
    users: [
      {
        avatarUrl: null,
        createdAt: fixedNow,
        email: "owner@example.com",
        id: "user-owner",
        name: "Owner",
        passwordHash: "hash",
        passwordHashParams: { keyLength: 64, name: "scrypt" },
        passwordSalt: "salt",
        updatedAt: fixedNow,
      },
      {
        avatarUrl: null,
        createdAt: fixedNow,
        email: "viewer@example.com",
        id: "user-viewer",
        name: "Viewer",
        passwordHash: "hash",
        passwordHashParams: { keyLength: 64, name: "scrypt" },
        passwordSalt: "salt",
        updatedAt: fixedNow,
      },
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
            roles: ["viewer"],
            userId: "user-viewer",
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
  });

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
  };

  it("returns the default sidebar config from config state", async () => {
    const response = await getSidebarFieldsRoute(
      new Request("http://localhost/api/projects/project-1/settings/sidebar-fields"),
      { params: Promise.resolve({ projectId: "project-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      postSidebarConfig: createDefaultContentPostSidebarConfig(),
    });
  });

  it("writes normalized sidebar config to the project config", async () => {
    const nextSidebar = normalizeContentPostSidebarConfig({
      nodes: [
        { id: "slug", kind: "field", parentId: null, visible: true },
        { id: "custom", kind: "page", label: "Custom", parentId: null, visible: true },
        { id: "custom_field:deck", kind: "field", parentId: "custom", visible: false },
      ],
      version: 2,
    });

    const response = await putSidebarFieldsRoute(
      new Request("http://localhost/api/projects/project-1/settings/sidebar-fields", {
        body: JSON.stringify({
          postSidebarConfig: nextSidebar,
          source: "manual",
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      }),
      { params: Promise.resolve({ projectId: "project-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      postSidebarConfig: nextSidebar,
    });
    expect((await readSavedConfig()).projects[0]).toMatchObject({
      sidebar: nextSidebar,
      sidebarRevisions: [
        expect.objectContaining({
          config: nextSidebar,
          source: "manual",
          version: 1,
        }),
      ],
    });
    expect(invalidateProjectRuntimeCacheGroupsMock).toHaveBeenCalledWith("project-1", ["workspace-meta"]);
  });

  it("requires mapping write permission before saving sidebar config", async () => {
    await setRouteUser("user-viewer");

    const response = await putSidebarFieldsRoute(
      new Request("http://localhost/api/projects/project-1/settings/sidebar-fields", {
        body: JSON.stringify({
          postSidebarConfig: createDefaultContentPostSidebarConfig(),
          source: "manual",
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      }),
      { params: Promise.resolve({ projectId: "project-1" }) },
    );

    expect(response.status).toBe(403);
  });
});
