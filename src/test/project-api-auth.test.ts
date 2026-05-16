import { describe, expect, it, vi } from "vitest";

const {
  getAuthenticatedApiRequestContextMock,
  validateInstallRuntimeConfigurationMock,
} = vi.hoisted(() => ({
  getAuthenticatedApiRequestContextMock: vi.fn(),
  validateInstallRuntimeConfigurationMock: vi.fn(),
}));

vi.mock("@/lib/control-plane/server", () => ({
  APP_SETUP_REQUIRED_MESSAGE: "BaseBuddy setup is incomplete.",
  getAuthenticatedApiRequestContext: getAuthenticatedApiRequestContextMock,
}));

vi.mock("@/lib/self-host/install-runtime", () => ({
  validateInstallRuntimeConfiguration: validateInstallRuntimeConfigurationMock,
}));

import {
  requireAuthenticatedPreparedProjectApiUser,
  requireAuthenticatedProjectApiUser,
  withAuthenticatedPreparedProjectAccessRoute,
  withAuthenticatedPreparedProjectRoute,
} from "@/lib/api/project-api-auth";
import { getAuthenticatedApiRequestContext } from "@/lib/control-plane/server";

describe("project api auth helper", () => {
  it("forwards the ensurePreparedProfile option and preserves the shared auth failure response shape", async () => {
    vi.mocked(getAuthenticatedApiRequestContext).mockResolvedValue({
      errorMessage: "Please sign in to continue.",
      ok: false,
      status: 401,
      supabase: {},
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

  it("returns the authenticated user and supabase client on success", async () => {
    vi.mocked(getAuthenticatedApiRequestContext).mockResolvedValue({
      ok: true,
      supabase: { kind: "supabase" },
      user: { id: "user-1" },
    } as never);

    const result = await requireAuthenticatedProjectApiUser();

    expect(result.errorResponse).toBeNull();
    expect(result.supabase).toEqual({ kind: "supabase" });
    expect(result.user).toEqual({ id: "user-1" });
  });

  it("offers a prepared-project helper that always requests profile preparation", async () => {
    vi.mocked(getAuthenticatedApiRequestContext).mockResolvedValue({
      ok: true,
      supabase: { kind: "supabase" },
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
      supabase: {},
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

  it("passes project id, user, and supabase into a wrapped prepared project route", async () => {
    vi.mocked(getAuthenticatedApiRequestContext).mockResolvedValue({
      ok: true,
      supabase: { kind: "supabase" },
      user: { id: "user-3" },
    } as never);
    const handler = vi.fn(async (_request, context) =>
      Response.json({
        projectId: context.projectId,
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
        supabase: { kind: "supabase" },
        user: { id: "user-3" },
      }),
    );
    await expect(response.json()).resolves.toEqual({
      projectId: "project-1",
      userId: "user-3",
    });
  });

  it("lets a guarded prepared project route inject extra access context", async () => {
    vi.mocked(getAuthenticatedApiRequestContext).mockResolvedValue({
      ok: true,
      supabase: { kind: "supabase" },
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
      ok: true,
      supabase: { kind: "supabase" },
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
});
