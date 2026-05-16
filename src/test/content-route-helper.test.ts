import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getContentRuntimeRequestMetricsSnapshot,
  getContentRuntimeRequestServerTimingHeader,
  logSlowContentRuntimeRequest,
  measureContentRuntimeRequestSpan,
  pushContentRuntimeRequestSpan,
  requireAuthenticatedProjectApiUser,
  runWithContentRuntimeRequestMetrics,
  setContentRuntimeRequestMetric,
} = vi.hoisted(() => ({
  getContentRuntimeRequestMetricsSnapshot: vi.fn(),
  getContentRuntimeRequestServerTimingHeader: vi.fn(),
  logSlowContentRuntimeRequest: vi.fn(),
  measureContentRuntimeRequestSpan: vi.fn(async (_name: string, work: () => Promise<unknown>) => work()),
  pushContentRuntimeRequestSpan: vi.fn(),
  requireAuthenticatedProjectApiUser: vi.fn(),
  runWithContentRuntimeRequestMetrics: vi.fn(async ({ work }: { work: () => Promise<Response> }) => work()),
  setContentRuntimeRequestMetric: vi.fn(),
}));

vi.mock("@/lib/api/project-api-auth", () => ({
  requireAuthenticatedProjectApiUser,
}));

vi.mock("@/lib/content-runtime/request-observability", () => ({
  getContentRuntimeRequestMetricsSnapshot,
  getContentRuntimeRequestServerTimingHeader,
  logSlowContentRuntimeRequest,
  measureContentRuntimeRequestSpan,
  pushContentRuntimeRequestSpan,
  runWithContentRuntimeRequestMetrics,
  setContentRuntimeRequestMetric,
}));

describe("content route helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getContentRuntimeRequestServerTimingHeader).mockReturnValue("auth;dur=1,handler;dur=2,total;dur=3");
    vi.mocked(getContentRuntimeRequestMetricsSnapshot).mockReturnValue({
      metadata: {
        cacheState: "fresh",
        scopeKey: "content.workspace",
      },
      spans: [],
      totalDurationMs: 3,
    } as never);
  });

  it("can return a timed content response from an already-authenticated route context without calling the auth helper again", async () => {
    const { runTimedAuthenticatedContentGetRoute } = await import(
      "@/app/api/projects/[projectId]/content/shared"
    );

    const response = await runTimedAuthenticatedContentGetRoute({
      endpoint: "content.workspace",
      handler: async () => ({ ok: true }),
      projectId: "project-1",
    });

    expect(requireAuthenticatedProjectApiUser).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.headers.get("Server-Timing")).toContain("auth;dur=");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("preserves plain-object error messages instead of collapsing them into the generic fallback", async () => {
    const { runTimedAuthenticatedContentGetRoute } = await import(
      "@/app/api/projects/[projectId]/content/shared"
    );

    const response = await runTimedAuthenticatedContentGetRoute({
      endpoint: "content.posts_page",
      handler: async () => {
        throw {
          code: "42P01",
          message: 'relation "private.basebuddy_project_content_post_previews" does not exist',
        };
      },
      projectId: "project-1",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "This project's content setup is out of date. Review the setup and try again.",
    });
  });

  it("replaces raw session-pooler capacity errors with production-ready copy", async () => {
    const { runTimedAuthenticatedContentGetRoute } = await import(
      "@/app/api/projects/[projectId]/content/shared"
    );

    const response = await runTimedAuthenticatedContentGetRoute({
      endpoint: "content.posts_page",
      handler: async () => {
        throw new Error("MaxClientsInSessionMode: max clients reached");
      },
      projectId: "project-1",
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "BaseBuddy is busy right now. Try again in a few seconds.",
    });
  });

  it("does not expose raw connection credential language in JSON errors", async () => {
    const { runTimedAuthenticatedContentGetRoute } = await import(
      "@/app/api/projects/[projectId]/content/shared"
    );

    const response = await runTimedAuthenticatedContentGetRoute({
      endpoint: "content.posts_page",
      handler: async () => {
        throw new Error('password authentication failed for user "postgres"');
      },
      projectId: "project-1",
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "The app connection is no longer valid. Update setup and try again.",
    });
  });
});
