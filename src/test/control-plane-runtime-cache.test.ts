import { beforeEach, describe, expect, it, vi } from "vitest";

describe("control-plane runtime cache", () => {
  beforeEach(async () => {
    vi.resetModules();
  });

  it("reuses the cached value for repeated control-plane bootstraps", async () => {
    const { getCachedControlPlaneRuntimeValue } = await import("@/lib/control-plane/server-runtime-cache");
    const load = vi.fn(async () => ({
      projects: [{ id: "project-1" }],
    }));

    await expect(
      getCachedControlPlaneRuntimeValue({
        cacheKey: "projects:user-1",
        getProjectIds: (value) => value.projects.map((project) => project.id),
        groups: ["projects-list"],
        load,
        staleWhileRevalidateMs: 0,
        ttlMs: 5_000,
        userId: "user-1",
      }),
    ).resolves.toEqual({
      projects: [{ id: "project-1" }],
    });

    await expect(
      getCachedControlPlaneRuntimeValue({
        cacheKey: "projects:user-1",
        getProjectIds: (value) => value.projects.map((project) => project.id),
        groups: ["projects-list"],
        load,
        staleWhileRevalidateMs: 0,
        ttlMs: 5_000,
        userId: "user-1",
      }),
    ).resolves.toEqual({
      projects: [{ id: "project-1" }],
    });

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("invalidates cached list entries by project id", async () => {
    const {
      getCachedControlPlaneRuntimeValue,
      invalidateControlPlaneRuntimeCache,
    } = await import("@/lib/control-plane/server-runtime-cache");
    const load = vi.fn(async () => ({
      projects: [{ id: "project-1" }],
    }));

    await getCachedControlPlaneRuntimeValue({
      cacheKey: "projects:user-1",
      getProjectIds: (value) => value.projects.map((project) => project.id),
      groups: ["projects-list"],
      load,
      staleWhileRevalidateMs: 0,
      ttlMs: 5_000,
      userId: "user-1",
    });

    invalidateControlPlaneRuntimeCache({
      projectId: "project-1",
    });

    await getCachedControlPlaneRuntimeValue({
      cacheKey: "projects:user-1",
      getProjectIds: (value) => value.projects.map((project) => project.id),
      groups: ["projects-list"],
      load,
      staleWhileRevalidateMs: 0,
      ttlMs: 5_000,
      userId: "user-1",
    });

    expect(load).toHaveBeenCalledTimes(2);
  });
});
