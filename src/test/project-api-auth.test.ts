import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getBaseBuddyConfigSetupStatusMock,
  getAuthenticatedApiRequestContextMock,
  getConfigProjectAccessContextMock,
  isBaseBuddyConfigSetupReadyMock,
} = vi.hoisted(() => ({
  getBaseBuddyConfigSetupStatusMock: vi.fn(),
  getAuthenticatedApiRequestContextMock: vi.fn(),
  getConfigProjectAccessContextMock: vi.fn(),
  isBaseBuddyConfigSetupReadyMock: vi.fn(),
}));

vi.mock("@/lib/control-plane/server", () => ({
  getAuthenticatedApiRequestContext: getAuthenticatedApiRequestContextMock,
}));

vi.mock("@/lib/basebuddy-config/setup", () => ({
  getBaseBuddyConfigSetupStatus: getBaseBuddyConfigSetupStatusMock,
  isBaseBuddyConfigSetupReady: isBaseBuddyConfigSetupReadyMock,
}));

vi.mock("@/lib/basebuddy-config/projects", () => ({
  getConfigProjectAccessContext: getConfigProjectAccessContextMock,
}));

import {
  requireAuthenticatedPreparedProjectApiUser,
  requireAuthenticatedProjectApiUser,
  withAuthenticatedPreparedProjectAccessRoute,
  withAuthenticatedPreparedProjectRoute,
} from "@/lib/api/project-api-auth";
import { getAuthenticatedApiRequestContext } from "@/lib/control-plane/server";

describe("project api auth helper", () => {
  beforeEach(() => {
    getBaseBuddyConfigSetupStatusMock.mockReset();
    getAuthenticatedApiRequestContextMock.mockReset();
    getConfigProjectAccessContextMock.mockReset();
    isBaseBuddyConfigSetupReadyMock.mockReset();
    getBaseBuddyConfigSetupStatusMock.mockResolvedValue({
      configPath: "/repo/basebuddy-data/basebuddy.config.json",
      sections: [],
      topology: "config-file",
    });
    isBaseBuddyConfigSetupReadyMock.mockReturnValue(true);
    getConfigProjectAccessContextMock.mockResolvedValue({
      memberAccess: {
        authorScopes: [],
        permissions: ["project.read", "content.read.all"],
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
    });
  });

  it("forwards the ensurePreparedProfile option and preserves the shared auth failure response shape", async () => {
    vi.mocked(getAuthenticatedApiRequestContext).mockResolvedValue({
      errorMessage: "Please sign in to continue.",
      ok: false,
      status: 401,
      user: null,
    } as never);

    const result = await requireAuthenticatedProjectApiUser({
      ensurePreparedProfile: true,
    });

    expect(getAuthenticatedApiRequestContext).toHaveBeenCalledWith({
      ensurePreparedProfile: true,
    });
    expect(result.user).toBeNull();
    expect(result.errorResponse?.status).toBe(401);
  });

  it("returns the authenticated user and account on success without a Supabase client", async () => {
    vi.mocked(getAuthenticatedApiRequestContext).mockResolvedValue({
      account: {
        avatarUrl: null,
        email: "owner@example.com",
        name: "Owner",
      },
      ok: true,
      user: { id: "user-1" },
    } as never);

    const result = await requireAuthenticatedProjectApiUser();

    expect(result.errorResponse).toBeNull();
    expect(result.account).toMatchObject({ email: "owner@example.com" });
    expect(result.user).toEqual({ id: "user-1" });
    expect(result).not.toHaveProperty("supabase");
  });

  it("offers a prepared-project helper that always requests profile preparation", async () => {
    vi.mocked(getAuthenticatedApiRequestContext).mockResolvedValue({
      account: {
        avatarUrl: null,
        email: "owner@example.com",
        name: "Owner",
      },
      ok: true,
      user: { id: "user-2" },
    } as never);

    const result = await requireAuthenticatedPreparedProjectApiUser();

    expect(getAuthenticatedApiRequestContext).toHaveBeenCalledWith({
      ensurePreparedProfile: true,
    });
    expect(result.errorResponse).toBeNull();
    expect(result.user).toEqual({ id: "user-2" });
  });

  it("short-circuits a wrapped project route when prepared auth fails", async () => {
    vi.mocked(getAuthenticatedApiRequestContext).mockResolvedValue({
      errorMessage: "Please sign in to continue.",
      ok: false,
      status: 401,
      user: null,
    } as never);
    const handler = vi.fn();
    const wrappedRoute = withAuthenticatedPreparedProjectRoute(handler);

    const response = await wrappedRoute(new Request("https://example.com"), {
      params: Promise.resolve({ projectId: "project-1" }),
    });

    expect(handler).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
  });

  it("passes config-backed project access into a wrapped prepared project route", async () => {
    vi.mocked(getAuthenticatedApiRequestContext).mockResolvedValue({
      account: {
        avatarUrl: null,
        email: "owner@example.com",
        name: "Owner",
      },
      ok: true,
      user: { id: "user-3" },
    } as never);
    const handler = vi.fn(async (_request, context) =>
      Response.json({
        projectSlug: context.project.slug,
        projectId: context.projectId,
        roles: context.memberAccess.roles,
        userId: context.user.id,
      }),
    );
    const wrappedRoute = withAuthenticatedPreparedProjectRoute(handler);

    const response = await wrappedRoute(new Request("https://example.com"), {
      params: Promise.resolve({ projectId: "project-1" }),
    });

    expect(handler).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({
        projectId: "project-1",
        account: expect.objectContaining({
          email: "owner@example.com",
        }),
        memberAccess: expect.objectContaining({
          roles: ["owner"],
        }),
        project: expect.objectContaining({
          id: "project-1",
          slug: "demo-project",
        }),
        user: { id: "user-3" },
      }),
    );
    expect(handler.mock.calls[0]?.[1]).not.toHaveProperty("supabase");
    expect(getConfigProjectAccessContextMock).toHaveBeenCalledWith({
      projectId: "project-1",
      userId: "user-3",
    });
    await expect(response.json()).resolves.toEqual({
      projectId: "project-1",
      projectSlug: "demo-project",
      roles: ["owner"],
      userId: "user-3",
    });
  });

  it("lets a guarded prepared project route inject extra access context", async () => {
    vi.mocked(getAuthenticatedApiRequestContext).mockResolvedValue({
      account: {
        avatarUrl: null,
        email: "owner@example.com",
        name: "Owner",
      },
      ok: true,
      user: { id: "user-4" },
    } as never);
    const wrappedRoute = withAuthenticatedPreparedProjectAccessRoute(
      async (_request, context) => ({
        errorResponse: null,
        context: {
          role: `owner:${context.projectId}`,
        },
      }),
      async (_request, context) =>
        Response.json({
          projectId: context.projectId,
          role: context.role,
          userId: context.user.id,
        }),
    );

    const response = await wrappedRoute(new Request("https://example.com"), {
      params: Promise.resolve({ projectId: "project-2" }),
    });

    await expect(response.json()).resolves.toEqual({
      projectId: "project-2",
      role: "owner:project-2",
      userId: "user-4",
    });
  });

  it("short-circuits a guarded prepared project route when the access check fails", async () => {
    vi.mocked(getAuthenticatedApiRequestContext).mockResolvedValue({
      account: {
        avatarUrl: null,
        email: "owner@example.com",
        name: "Owner",
      },
      ok: true,
      user: { id: "user-5" },
    } as never);
    const handler = vi.fn();
    const wrappedRoute = withAuthenticatedPreparedProjectAccessRoute(
      async () => ({
        context: null,
        errorResponse: Response.json({ error: "Forbidden" }, { status: 403 }),
      }),
      handler,
    );

    const response = await wrappedRoute(new Request("https://example.com"), {
      params: Promise.resolve({ projectId: "project-3" }),
    });

    expect(handler).not.toHaveBeenCalled();
    expect(response.status).toBe(403);
  });

  it("short-circuits a wrapped project route when the config has no project membership", async () => {
    vi.mocked(getAuthenticatedApiRequestContext).mockResolvedValue({
      account: {
        avatarUrl: null,
        email: "owner@example.com",
        name: "Owner",
      },
      ok: true,
      user: { id: "user-6" },
    } as never);
    getConfigProjectAccessContextMock.mockResolvedValue(null);
    const handler = vi.fn();
    const wrappedRoute = withAuthenticatedPreparedProjectRoute(handler);

    const response = await wrappedRoute(new Request("https://example.com"), {
      params: Promise.resolve({ projectId: "project-missing" }),
    });

    expect(handler).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Could not find that project.",
    });
  });
});
