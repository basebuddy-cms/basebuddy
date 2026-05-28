import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  };
});

const {
  canForceProjectPostTakeover,
  invalidateProjectRuntimeCacheGroups,
} = vi.hoisted(() => ({
  canForceProjectPostTakeover: vi.fn(() => true),
  invalidateProjectRuntimeCacheGroups: vi.fn(),
}));

vi.mock("@/lib/control-plane/permissions", () => ({
  canForceProjectPostTakeover,
}));

vi.mock("@/lib/control-plane/server", () => ({}));

vi.mock("@/lib/content-runtime/server-runtime-cache", () => ({
  invalidateProjectRuntimeCacheGroups,
  projectRuntimeCacheGroups: {
    postsPresence: "posts-presence",
  },
}));

const ownerContext = {
  connectionString: "postgres://demo",
  memberAccess: {
    authorScopes: [],
    permissions: ["content.write.all"],
    roles: ["owner"],
  },
  user: {
    avatarUrl: "https://example.com/owner.png",
    email: "owner@example.com",
    id: "user-1",
    name: "Owner",
  },
};

const authorContext = {
  ...ownerContext,
  memberAccess: {
    authorScopes: [],
    permissions: ["content.write.authored"],
    roles: ["author"],
  },
  user: {
    avatarUrl: null,
    email: "author@example.com",
    id: "user-2",
    name: "Author",
  },
};

describe("server post edit sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.useRealTimers();
  });

  it("keeps post edit sessions in memory and maps current-user state per viewer", async () => {
    const {
      acquireContentPostEditSessionAccess,
      getProjectPostEditSessions,
    } = await import("@/lib/content-runtime/server-post-edit-sessions");

    await acquireContentPostEditSessionAccess({
      context: ownerContext,
      postId: "post-1",
      postTitle: "Launch Post",
      projectId: "project-1",
      verifyPostWriteAccess: async () => undefined,
    });

    const ownerSessions = await getProjectPostEditSessions("project-1", "user-1");
    const teammateSessions = await getProjectPostEditSessions("project-1", "user-2");

    expect(ownerSessions.get("post-1")).toMatchObject({
      avatarUrl: "https://example.com/owner.png",
      editorEmail: "owner@example.com",
      editorName: "Owner",
      isCurrentUser: true,
      postId: "post-1",
      postTitle: "Launch Post",
      userId: "user-1",
    });
    expect(teammateSessions.get("post-1")?.isCurrentUser).toBe(false);
  });

  it("enforces conflicts, force-takeover permission, heartbeat ownership, and release in memory", async () => {
    const {
      acquireContentPostEditSessionAccess,
      heartbeatContentPostEditSessionAccess,
      releaseContentPostEditSessionAccess,
      getProjectPostEditSessionSnapshot,
    } = await import("@/lib/content-runtime/server-post-edit-sessions");

    await expect(
      acquireContentPostEditSessionAccess({
        context: ownerContext,
        postId: "post-1",
        postTitle: "Launch Post",
        projectId: "project-1",
        verifyPostWriteAccess: async () => undefined,
      }),
    ).resolves.toEqual({
      acquired: true,
      blockingSession: null,
      takeover: false,
    });

    await expect(
      acquireContentPostEditSessionAccess({
        context: authorContext,
        postId: "post-1",
        postTitle: "Launch Post",
        projectId: "project-1",
        verifyPostWriteAccess: async () => undefined,
      }),
    ).resolves.toMatchObject({
      acquired: false,
      blockingSession: expect.objectContaining({
        editorEmail: "owner@example.com",
        postId: "post-1",
        userId: "user-1",
      }),
      takeover: false,
    });

    canForceProjectPostTakeover.mockReturnValueOnce(false);
    await expect(
      acquireContentPostEditSessionAccess({
        context: authorContext,
        force: true,
        postId: "post-1",
        postTitle: "Launch Post",
        projectId: "project-1",
        verifyPostWriteAccess: async () => undefined,
      }),
    ).rejects.toThrow("Only owners, admins, and editors can take over");

    canForceProjectPostTakeover.mockReturnValueOnce(true);
    await expect(
      acquireContentPostEditSessionAccess({
        context: authorContext,
        force: true,
        postId: "post-1",
        postTitle: "Launch Post",
        projectId: "project-1",
        verifyPostWriteAccess: async () => undefined,
      }),
    ).resolves.toMatchObject({
      acquired: true,
      takeover: true,
    });

    await expect(
      heartbeatContentPostEditSessionAccess({
        context: ownerContext,
        postId: "post-1",
        postTitle: "Launch Post",
        projectId: "project-1",
        verifyPostWriteAccess: async () => undefined,
      }),
    ).resolves.toMatchObject({
      active: false,
      blockingSession: expect.objectContaining({
        editorEmail: "author@example.com",
        userId: "user-2",
      }),
    });

    await releaseContentPostEditSessionAccess({
      context: authorContext,
      postId: "post-1",
      projectId: "project-1",
    });

    expect(await getProjectPostEditSessionSnapshot("project-1")).toEqual(new Map());
    expect(invalidateProjectRuntimeCacheGroups).toHaveBeenCalledWith("project-1", [
      "posts-presence",
    ]);
  });

  it("drops stale in-memory edit sessions before snapshot reads", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-28T00:00:00.000Z"));

    const {
      acquireContentPostEditSessionAccess,
      getProjectPostEditSessionSnapshot,
    } = await import("@/lib/content-runtime/server-post-edit-sessions");

    await acquireContentPostEditSessionAccess({
      context: ownerContext,
      postId: "post-1",
      postTitle: "Launch Post",
      projectId: "project-1",
      verifyPostWriteAccess: async () => undefined,
    });

    expect(await getProjectPostEditSessionSnapshot("project-1")).toHaveProperty("size", 1);

    vi.setSystemTime(new Date("2026-05-28T00:00:21.000Z"));

    expect(await getProjectPostEditSessionSnapshot("project-1")).toEqual(new Map());
  });
});
