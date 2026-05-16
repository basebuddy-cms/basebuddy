import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getCachedProjectRuntimeValue,
  invalidateProjectRuntimeCache,
  peekCachedProjectRuntimeValue,
} from "@/lib/content-runtime/server-runtime-cache";

const PROJECT_ID = "project-runtime-cache-test";
const CACHE_KEY = "workspace:test";

describe("server runtime cache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-26T00:00:00.000Z"));
  });

  afterEach(() => {
    invalidateProjectRuntimeCache(PROJECT_ID);
    vi.useRealTimers();
  });

  it("serves stale values while a background refresh is in flight", async () => {
    let resolveSecondLoad: ((value: { version: number }) => void) | null = null;
    const load = vi.fn<() => Promise<{ version: number }>>();

    load.mockResolvedValueOnce({ version: 1 });
    load.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSecondLoad = resolve;
        }),
    );

    const cacheOptions = {
      cacheKey: CACHE_KEY,
      load,
      projectId: PROJECT_ID,
      staleWhileRevalidateMs: 5_000,
      ttlMs: 1_000,
    };

    await expect(getCachedProjectRuntimeValue(cacheOptions)).resolves.toEqual({ version: 1 });
    expect(load).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1_500);

    await expect(getCachedProjectRuntimeValue(cacheOptions)).resolves.toEqual({ version: 1 });
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(2);

    await expect(getCachedProjectRuntimeValue(cacheOptions)).resolves.toEqual({ version: 1 });
    expect(load).toHaveBeenCalledTimes(2);

    expect(resolveSecondLoad).not.toBeNull();
    resolveSecondLoad?.({ version: 2 });
    await Promise.resolve();
    await Promise.resolve();

    await expect(getCachedProjectRuntimeValue(cacheOptions)).resolves.toEqual({ version: 2 });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("can peek whether a cached value is fresh, stale, or missing without loading", async () => {
    const load = vi.fn(async () => ({ version: 1 }));
    const cacheOptions = {
      cacheKey: CACHE_KEY,
      load,
      projectId: PROJECT_ID,
      staleWhileRevalidateMs: 5_000,
      ttlMs: 1_000,
    };

    expect(peekCachedProjectRuntimeValue<{ version: number }>(CACHE_KEY)).toEqual({
      state: "missing",
    });

    await expect(getCachedProjectRuntimeValue(cacheOptions)).resolves.toEqual({ version: 1 });

    expect(peekCachedProjectRuntimeValue<{ version: number }>(CACHE_KEY)).toEqual({
      state: "fresh",
      value: { version: 1 },
    });

    vi.advanceTimersByTime(1_500);

    expect(peekCachedProjectRuntimeValue<{ version: number }>(CACHE_KEY)).toEqual({
      state: "stale",
      value: { version: 1 },
    });

    vi.advanceTimersByTime(5_500);

    expect(peekCachedProjectRuntimeValue<{ version: number }>(CACHE_KEY)).toEqual({
      state: "missing",
    });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("invalidates only the requested cache groups for a project", async () => {
    const workspaceLoad = vi.fn(async () => ({ version: "workspace" }));
    const summaryLoad = vi.fn(async () => ({ version: "summary" }));
    const postsLoad = vi.fn(async () => ({ version: "posts" }));

    await expect(
      getCachedProjectRuntimeValue({
        cacheKey: "workspace:test",
        groups: ["workspace-meta"],
        load: workspaceLoad,
        projectId: PROJECT_ID,
        ttlMs: 5_000,
      }),
    ).resolves.toEqual({ version: "workspace" });
    await expect(
      getCachedProjectRuntimeValue({
        cacheKey: "workspace-summary:test",
        groups: ["workspace-summary"],
        load: summaryLoad,
        projectId: PROJECT_ID,
        ttlMs: 5_000,
      }),
    ).resolves.toEqual({ version: "summary" });
    await expect(
      getCachedProjectRuntimeValue({
        cacheKey: "posts:test",
        groups: ["posts-page"],
        load: postsLoad,
        projectId: PROJECT_ID,
        ttlMs: 5_000,
      }),
    ).resolves.toEqual({ version: "posts" });

    invalidateProjectRuntimeCache(PROJECT_ID, {
      groups: ["workspace-summary"],
    });

    expect(peekCachedProjectRuntimeValue<{ version: string }>("workspace:test")).toEqual({
      state: "fresh",
      value: { version: "workspace" },
    });
    expect(peekCachedProjectRuntimeValue<{ version: string }>("workspace-summary:test")).toEqual({
      state: "missing",
    });
    expect(peekCachedProjectRuntimeValue<{ version: string }>("posts:test")).toEqual({
      state: "fresh",
      value: { version: "posts" },
    });
  });
});
