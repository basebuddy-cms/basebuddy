import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  applyPersistedContentWorkspaceSummaryCountDeltas,
  appendPendingContentWorkspaceSummaryCollections,
  createContentWorkspaceSummary,
  createPendingContentWorkspaceSummary,
  getPendingContentWorkspaceSummaryCollections,
  getPersistedContentWorkspaceSummary,
  markPersistedContentWorkspaceSummaryInexact,
  queueContentWorkspaceSummaryBackgroundRefresh,
  savePersistedContentWorkspaceSummary,
} from "@/lib/content-runtime/server-runtime-summary";

describe("server runtime summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when an in-memory runtime summary has not been created", async () => {
    await expect(
      getPersistedContentWorkspaceSummary({
        projectId: "project-missing",
        runtimeSignature: "mapped-runtime:missing",
      }),
    ).resolves.toBeNull();
  });

  it("stores, reads, updates, and marks runtime summaries in memory", async () => {
    await savePersistedContentWorkspaceSummary({
      projectId: "project-1",
      runtimeSignature: "mapped-runtime:demo",
      summary: createContentWorkspaceSummary({
        counts: {
          authors: 2,
          categories: 3,
          files: 4,
          media: 5,
          posts: 6,
          tags: 7,
        },
        refreshedAt: "2026-03-27T00:00:00.000Z",
      }),
    });

    await expect(
      getPersistedContentWorkspaceSummary({
        projectId: "project-1",
        runtimeSignature: "mapped-runtime:demo",
      }),
    ).resolves.toEqual({
      counts: {
        authors: 2,
        categories: 3,
        files: 4,
        media: 5,
        posts: 6,
        tags: 7,
      },
      isDerived: false,
      isExact: true,
      pendingCollections: [],
      refreshedAt: "2026-03-27T00:00:00.000Z",
    });

    await expect(
      applyPersistedContentWorkspaceSummaryCountDeltas({
        deltas: {
          authors: 1,
          posts: -2,
          tags: -99,
        },
        projectId: "project-1",
        runtimeSignature: "mapped-runtime:demo",
      }),
    ).resolves.toMatchObject({
      counts: {
        authors: 3,
        categories: 3,
        files: 4,
        media: 5,
        posts: 4,
        tags: 0,
      },
      isExact: true,
    });

    await expect(
      markPersistedContentWorkspaceSummaryInexact({
        projectId: "project-1",
        runtimeSignature: "mapped-runtime:demo",
      }),
    ).resolves.toMatchObject({
      isExact: false,
      counts: {
        posts: 4,
      },
    });
  });

  it("builds a pending summary without claiming exact counts", () => {
    expect(
      createPendingContentWorkspaceSummary({
        pendingCollections: ["posts", "media"],
      }),
    ).toEqual({
      counts: {
        authors: 0,
        categories: 0,
        files: 0,
        media: 0,
        posts: 0,
        tags: 0,
      },
      isDerived: false,
      isExact: false,
      pendingCollections: ["posts", "media"],
      refreshedAt: null,
    });
  });

  it("marks reconciled collections as pending without duplicating them", () => {
    expect(
      appendPendingContentWorkspaceSummaryCollections({
        pendingCollections: ["media", "files"],
        summary: createContentWorkspaceSummary({
          counts: {
            authors: 2,
            categories: 3,
            files: 4,
            media: 5,
            posts: 6,
            tags: 7,
          },
          isExact: true,
          pendingCollections: ["posts", "media"],
          refreshedAt: "2026-03-28T00:00:00.000Z",
        }),
      }),
    ).toEqual({
      counts: {
        authors: 2,
        categories: 3,
        files: 4,
        media: 5,
        posts: 6,
        tags: 7,
      },
      isDerived: false,
      isExact: false,
      pendingCollections: ["posts", "media", "files"],
      refreshedAt: "2026-03-28T00:00:00.000Z",
    });
  });

  it("tracks pending background summary refresh collections while a refresh is in flight", async () => {
    let resolveRefresh: (() => void) | null = null;
    const refresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRefresh = resolve;
        }),
    );

    const firstRefresh = queueContentWorkspaceSummaryBackgroundRefresh({
      pendingCollections: ["files", "media"],
      projectId: "project-1",
      refresh,
      runtimeSignature: "mapped-runtime:demo",
    });

    expect(
      getPendingContentWorkspaceSummaryCollections({
        projectId: "project-1",
        runtimeSignature: "mapped-runtime:demo",
      }),
    ).toEqual(["files", "media"]);

    const secondRefresh = queueContentWorkspaceSummaryBackgroundRefresh({
      pendingCollections: ["files"],
      projectId: "project-1",
      refresh: vi.fn(async () => undefined),
      runtimeSignature: "mapped-runtime:demo",
    });

    expect(secondRefresh).toBe(firstRefresh);
    expect(refresh).toHaveBeenCalledTimes(1);

    resolveRefresh?.();
    await firstRefresh;

    expect(
      getPendingContentWorkspaceSummaryCollections({
        projectId: "project-1",
        runtimeSignature: "mapped-runtime:demo",
      }),
    ).toEqual([]);
  });
});
