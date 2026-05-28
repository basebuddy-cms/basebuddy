import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  enforceRateLimitMock,
  invalidateContentProjectContextCachesMock,
  invalidateControlPlaneRuntimeCacheMock,
  parseProjectSettingsBodyMock,
  revalidatePathMock,
  routeContextMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  enforceRateLimitMock: vi.fn(() => null),
  invalidateContentProjectContextCachesMock: vi.fn(),
  invalidateControlPlaneRuntimeCacheMock: vi.fn(),
  parseProjectSettingsBodyMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  routeContextMock: {
    account: {
      avatarUrl: null,
      email: "owner@example.com",
      name: "Owner",
    },
    memberAccess: {
      authorScopes: [],
      permissions: ["project.read", "project.update", "project.delete"],
      roles: ["owner"],
    },
    project: {
      createdAt: "2026-05-27T00:00:00.000Z",
      id: "project-1",
      name: "Demo Project",
      role: "owner",
      slug: "demo-project",
      websiteUrl: null,
    },
    projectId: "project-1",
    user: {
      id: "user-1",
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/api/project-api-auth", () => ({
  withAuthenticatedPreparedProjectRoute:
    (handler: (request: Request, context: typeof routeContextMock) => Response | Promise<Response>) =>
    async (
      request: Request,
      routeContext: {
        params: Promise<{
          projectId: string;
        }>;
      },
    ) => {
      const { projectId } = await routeContext.params;

      return handler(request, {
        ...routeContextMock,
        projectId,
      });
    },
}));

vi.mock("@/lib/api/request-guards", () => ({
  enforceRateLimit: enforceRateLimitMock,
  parseJsonBody: parseProjectSettingsBodyMock,
}));

vi.mock("@/lib/control-plane/server-runtime-cache", () => ({
  invalidateControlPlaneRuntimeCache: invalidateControlPlaneRuntimeCacheMock,
}));

vi.mock("@/lib/control-plane/server", () => ({}));

vi.mock("@/lib/content-runtime/server-project-context", () => ({
  invalidateContentProjectContextCaches: invalidateContentProjectContextCachesMock,
}));


import {
  DELETE as deleteProjectSettingsRoute,
  PATCH as patchProjectSettingsRoute,
} from "@/app/api/projects/[projectId]/settings/route";
import {
  ensureBaseBuddyConfig,
  loadBaseBuddyConfig,
  writeBaseBuddyConfig,
} from "@/lib/basebuddy-config/store";

const fixedNow = "2026-05-27T00:00:00.000Z";
const authSecret = "local-auth-secret-value-with-32-plus-chars";

describe("project settings route", () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "basebuddy-project-settings-route-"));
    process.chdir(tempDir);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(fixedNow));
    vi.clearAllMocks();

    await ensureBaseBuddyConfig({
      now: fixedNow,
    });
    await writeBaseBuddyConfig((config) => ({
      ...config,
      invitations: [
        {
          acceptedAt: null,
          acceptedBy: null,
          authorScopes: [],
          createdAt: fixedNow,
          createdBy: "user-1",
          expiresAt: "2026-06-27T00:00:00.000Z",
          id: "invitation-project-1",
          invitedEmail: "invitee@example.com",
          projectId: "project-1",
          publicToken: "public-token-project-1",
          revokedAt: null,
          revokedBy: null,
          roles: ["viewer"],
        },
        {
          acceptedAt: null,
          acceptedBy: null,
          authorScopes: [],
          createdAt: fixedNow,
          createdBy: "user-1",
          expiresAt: "2026-06-27T00:00:00.000Z",
          id: "invitation-project-2",
          invitedEmail: "other@example.com",
          projectId: "project-2",
          publicToken: "public-token-project-2",
          revokedAt: null,
          revokedBy: null,
          roles: ["viewer"],
        },
      ],
      projects: [
        {
          createdAt: fixedNow,
          createdBy: "user-1",
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
        {
          createdAt: fixedNow,
          createdBy: "user-1",
          id: "project-2",
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
          name: "Other Project",
          sidebar: null,
          sidebarRevisions: [],
          slug: "other-project",
          status: "active",
          updatedAt: fixedNow,
          websiteUrl: null,
        },
      ],
    }));
    Object.assign(routeContextMock, {
      memberAccess: {
        authorScopes: [],
        permissions: ["project.read", "project.update", "project.delete"],
        roles: ["owner"],
      },
      project: {
        createdAt: fixedNow,
        id: "project-1",
        name: "Demo Project",
        role: "owner",
        slug: "demo-project",
        websiteUrl: null,
      },
      projectId: "project-1",
      user: {
        id: "user-1",
      },
    });
    createClientMock.mockRejectedValue(new Error("Project settings must not use Supabase."));
    parseProjectSettingsBodyMock.mockImplementation(async (request: Request) => ({
      data: await request.json(),
      errorResponse: null,
    }));
  });

  afterEach(async () => {
    vi.useRealTimers();
    process.chdir(originalCwd);
    await rm(tempDir, { force: true, recursive: true });
  });

  it("updates project settings in config and preserves the response shape", async () => {
    const response = await patchProjectSettingsRoute(
      new Request("http://localhost/api/projects/project-1/settings", {
        body: JSON.stringify({
          currentSlug: "demo-project",
          name: "Renamed Project",
          slug: "Renamed Project",
          websiteUrl: "https://renamed.example.com",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      }),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );
    const body = await response.json();
    const config = await loadBaseBuddyConfig();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      project: {
        id: "project-1",
        name: "Renamed Project",
        slug: "renamed-project",
        websiteUrl: "https://renamed.example.com/",
      },
    });
    expect(config.projects.find((project) => project.id === "project-1")).toMatchObject({
      name: "Renamed Project",
      slug: "renamed-project",
      updatedAt: fixedNow,
      websiteUrl: "https://renamed.example.com/",
    });
    expect(createClientMock).not.toHaveBeenCalled();
    expect(invalidateControlPlaneRuntimeCacheMock).toHaveBeenCalledWith({
      projectId: "project-1",
    });
    expect(invalidateContentProjectContextCachesMock).toHaveBeenCalledWith("project-1");
    expect(revalidatePathMock).toHaveBeenCalledWith("/projects");
    expect(revalidatePathMock).toHaveBeenCalledWith("/projects/demo-project");
    expect(revalidatePathMock).toHaveBeenCalledWith("/projects/renamed-project");
  });

  it("rejects settings updates without project update permission", async () => {
    routeContextMock.memberAccess = {
      authorScopes: [],
      permissions: ["project.read"],
      roles: ["viewer"],
    };

    const response = await patchProjectSettingsRoute(
      new Request("http://localhost/api/projects/project-1/settings", {
        body: JSON.stringify({
          currentSlug: "demo-project",
          name: "Renamed Project",
          slug: "renamed-project",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      }),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "You do not have permission to update this project.",
    });
  });

  it("returns a conflict when settings reuse another project slug", async () => {
    const response = await patchProjectSettingsRoute(
      new Request("http://localhost/api/projects/project-1/settings", {
        body: JSON.stringify({
          currentSlug: "demo-project",
          name: "Demo Project",
          slug: "other-project",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      }),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "That project address is already taken.",
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("deletes a project and its project-scoped config state", async () => {
    const response = await deleteProjectSettingsRoute(
      new Request("http://localhost/api/projects/project-1/settings", {
        method: "DELETE",
      }),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );
    const config = await loadBaseBuddyConfig();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
    });
    expect(config.projects.map((project) => project.id)).toEqual(["project-2"]);
    expect(config.invitations.map((invitation) => invitation.id)).toEqual([
      "invitation-project-2",
    ]);
    expect(createClientMock).not.toHaveBeenCalled();
    expect(invalidateControlPlaneRuntimeCacheMock).toHaveBeenCalledWith({
      projectId: "project-1",
    });
    expect(invalidateContentProjectContextCachesMock).toHaveBeenCalledWith("project-1");
    expect(revalidatePathMock).toHaveBeenCalledWith("/projects");
  });

  it("rejects project deletion without project delete permission", async () => {
    routeContextMock.memberAccess = {
      authorScopes: [],
      permissions: ["project.read"],
      roles: ["viewer"],
    };

    const response = await deleteProjectSettingsRoute(
      new Request("http://localhost/api/projects/project-1/settings", {
        method: "DELETE",
      }),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "You do not have permission to delete this project.",
    });
    await expect(loadBaseBuddyConfig()).resolves.toEqual(
      expect.objectContaining({
        projects: expect.arrayContaining([
          expect.objectContaining({
            id: "project-1",
          }),
        ]),
      }),
    );
  });
});
