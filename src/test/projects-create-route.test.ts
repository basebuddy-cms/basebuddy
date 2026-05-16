import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  enforceRateLimitMock,
  ensureContentMappingDraftMock,
  invalidateControlPlaneRuntimeCacheMock,
  revalidatePathMock,
  requireAuthenticatedApiUserMock,
  rpcMock,
} = vi.hoisted(() => ({
  enforceRateLimitMock: vi.fn(() => null),
  ensureContentMappingDraftMock: vi.fn(),
  invalidateControlPlaneRuntimeCacheMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  requireAuthenticatedApiUserMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/api/api-auth", () => ({
  requireAuthenticatedApiUser: requireAuthenticatedApiUserMock,
}));

vi.mock("@/lib/api/request-guards", () => ({
  enforceRateLimit: enforceRateLimitMock,
  enforceSameOriginRequest: vi.fn(() => null),
  parseJsonBody: vi.fn(async (request: Request) => ({
    data: await request.json(),
    errorResponse: null,
  })),
}));

vi.mock("@/lib/control-plane/server-runtime-cache", () => ({
  invalidateControlPlaneRuntimeCache: invalidateControlPlaneRuntimeCacheMock,
}));

vi.mock("@/lib/control-plane/server", () => ({
  APP_SETUP_REQUIRED_MESSAGE: "App setup required.",
  isControlPlaneSetupError: vi.fn(() => false),
  isUniqueViolationError: vi.fn((error: { code?: string } | null | undefined) => error?.code === "23505"),
}));

vi.mock("@/lib/content-runtime/server", () => ({
  ensureContentMappingDraft: ensureContentMappingDraftMock,
}));

import { POST as postCreateProjectRoute } from "@/app/api/projects/route";

describe("projects create route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireAuthenticatedApiUserMock.mockResolvedValue({
      errorResponse: null,
      supabase: {
        rpc: rpcMock,
      },
      user: {
        id: "user-1",
      },
    });
    rpcMock.mockResolvedValue({
      data: "project-1",
      error: null,
    });
    ensureContentMappingDraftMock.mockResolvedValue(undefined);
  });

  it("creates a self-host project through create_project and seeds its mapping draft", async () => {
    const response = await postCreateProjectRoute(
      new Request("http://localhost/api/projects", {
        body: JSON.stringify({
          projectName: "Demo Project",
          projectSlug: "Demo Project",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(rpcMock).toHaveBeenCalledWith("create_project", {
      p_name: "Demo Project",
      p_slug: "demo-project",
    });
    expect(ensureContentMappingDraftMock).toHaveBeenCalledWith("project-1");
    expect(invalidateControlPlaneRuntimeCacheMock).toHaveBeenCalledWith({
      groups: ["project-bootstrap", "projects-list"],
      userId: "user-1",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/projects");
    await expect(response.json()).resolves.toEqual({
      redirectTo: "/projects/demo-project",
    });
  });

  it("does not send any hosted-era database fields to the RPC", async () => {
    await postCreateProjectRoute(
      new Request("http://localhost/api/projects", {
        body: JSON.stringify({
          accessMode: "direct_connection",
          databasePassword: "secret",
          projectName: "Demo Project",
          projectRef: "demo-ref",
          projectSlug: "demo-project",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(rpcMock).toHaveBeenCalledWith("create_project", {
      p_name: "Demo Project",
      p_slug: "demo-project",
    });
  });

  it("retries mapping-draft seeding when the content runtime is transiently degraded", async () => {
    ensureContentMappingDraftMock
      .mockRejectedValueOnce(
        new Error(
          "BaseBuddy is having trouble reaching this project's content right now. Try again in a few seconds.",
        ),
      )
      .mockResolvedValueOnce(undefined);

    const response = await postCreateProjectRoute(
      new Request("http://localhost/api/projects", {
        body: JSON.stringify({
          projectName: "Retry Project",
          projectSlug: "retry-project",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(ensureContentMappingDraftMock).toHaveBeenCalledTimes(2);
    await expect(response.json()).resolves.toEqual({
      redirectTo: "/projects/retry-project",
    });
  });

  it("still redirects into the created project when draft seeding keeps failing with a transient runtime error", async () => {
    ensureContentMappingDraftMock.mockRejectedValue(
      new Error("Connection terminated due to connection timeout"),
    );

    const response = await postCreateProjectRoute(
      new Request("http://localhost/api/projects", {
        body: JSON.stringify({
          projectName: "Fallback Project",
          projectSlug: "fallback-project",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(ensureContentMappingDraftMock).toHaveBeenCalledTimes(3);
    await expect(response.json()).resolves.toEqual({
      redirectTo: "/projects/fallback-project",
    });
  });

  it("still redirects into the created project when draft seeding fails with a setup-specific error", async () => {
    ensureContentMappingDraftMock.mockRejectedValue(
      new Error("Could not save the content mapping right now."),
    );

    const response = await postCreateProjectRoute(
      new Request("http://localhost/api/projects", {
        body: JSON.stringify({
          projectName: "Draft Later Project",
          projectSlug: "draft-later-project",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(ensureContentMappingDraftMock).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({
      redirectTo: "/projects/draft-later-project",
    });
  });
});
