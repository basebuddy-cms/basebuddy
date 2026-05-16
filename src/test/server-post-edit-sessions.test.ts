import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T) => {
      const memoized = new Map<string, ReturnType<T>>();

      return ((...args: Parameters<T>) => {
        const key = JSON.stringify(args);

        if (!memoized.has(key)) {
          memoized.set(key, fn(...args) as ReturnType<T>);
        }

        return memoized.get(key) as ReturnType<T>;
      }) as T;
    },
  };
});

const {
  canForceProjectPostTakeover,
  createSupabaseServerClient,
  invalidateProjectRuntimeCacheGroups,
  isControlPlaneSetupError,
} = vi.hoisted(() => ({
  canForceProjectPostTakeover: vi.fn(() => true),
  createSupabaseServerClient: vi.fn(),
  invalidateProjectRuntimeCacheGroups: vi.fn(),
  isControlPlaneSetupError: vi.fn(() => false),
}));

vi.mock("@/lib/control-plane/permissions", () => ({
  canForceProjectPostTakeover,
}));

vi.mock("@/lib/control-plane/server", () => ({
  APP_SETUP_REQUIRED_MESSAGE: "App setup required.",
  isControlPlaneSetupError,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createSupabaseServerClient,
}));

vi.mock("@/lib/content-runtime/server-runtime-cache", () => ({
  invalidateProjectRuntimeCacheGroups,
  projectRuntimeCacheGroups: {
    postsPresence: "posts-presence",
  },
}));

const validContext = {
  connectionString: "postgres://demo",
  memberAccess: {
    authorScopes: [],
    permissions: ["content.write.all"],
    roles: ["owner"],
  },
};

describe("server post edit sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("reuses a project-scoped snapshot while still mapping isCurrentUser per viewer", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          editor_email: "owner@example.com",
          editor_name: "Owner",
          last_heartbeat_at: "2026-03-28T00:00:00.000Z",
          post_id: "post-1",
          post_title: "Launch Post",
          user_id: "user-1",
        },
      ],
      error: null,
    });

    createSupabaseServerClient.mockResolvedValue({
      rpc,
    });

    const { getProjectPostEditSessions } = await import(
      "@/lib/content-runtime/server-post-edit-sessions"
    );

    const ownerSessions = await getProjectPostEditSessions("project-1", "user-1");
    const teammateSessions = await getProjectPostEditSessions("project-1", "user-2");

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(ownerSessions.get("post-1")?.isCurrentUser).toBe(true);
    expect(teammateSessions.get("post-1")?.isCurrentUser).toBe(false);
  });

  it("invalidates the project-scoped presence cache after successful session mutations", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: [{ acquired: true }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ active: true }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ active: true }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: null,
      });

    createSupabaseServerClient.mockResolvedValue({
      rpc,
    });

    const {
      acquireContentPostEditSessionAccess,
      assertContentPostEditSessionAccess,
      heartbeatContentPostEditSessionAccess,
      releaseContentPostEditSessionAccess,
    } = await import("@/lib/content-runtime/server-post-edit-sessions");

    await acquireContentPostEditSessionAccess({
      context: validContext,
      postId: "post-1",
      postTitle: "Launch Post",
      projectId: "project-1",
      verifyPostWriteAccess: async () => undefined,
    });

    await heartbeatContentPostEditSessionAccess({
      context: validContext,
      postId: "post-1",
      postTitle: "Launch Post",
      projectId: "project-1",
      verifyPostWriteAccess: async () => undefined,
    });

    await assertContentPostEditSessionAccess({
      context: validContext,
      postId: "post-1",
      postTitle: "Launch Post",
      projectId: "project-1",
      verifyPostWriteAccess: async () => undefined,
    });

    await releaseContentPostEditSessionAccess({
      postId: "post-1",
      projectId: "project-1",
    });

    expect(invalidateProjectRuntimeCacheGroups).toHaveBeenCalledTimes(4);
    expect(invalidateProjectRuntimeCacheGroups).toHaveBeenNthCalledWith(1, "project-1", [
      "posts-presence",
    ]);
    expect(invalidateProjectRuntimeCacheGroups).toHaveBeenNthCalledWith(2, "project-1", [
      "posts-presence",
    ]);
    expect(invalidateProjectRuntimeCacheGroups).toHaveBeenNthCalledWith(3, "project-1", [
      "posts-presence",
    ]);
    expect(invalidateProjectRuntimeCacheGroups).toHaveBeenNthCalledWith(4, "project-1", [
      "posts-presence",
    ]);
  });

});
