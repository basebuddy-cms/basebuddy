import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import {
  applyPersistedContentWorkspaceSummaryCountDeltas,
  appendPendingContentWorkspaceSummaryCollections,
  createContentWorkspaceSummary,
  createPendingContentWorkspaceSummary,
  getPendingContentWorkspaceSummaryCollections,
  getPersistedContentWorkspaceSummary,
  queueContentWorkspaceSummaryBackgroundRefresh,
  savePersistedContentWorkspaceSummary,
} from "@/lib/content-runtime/server-runtime-summary";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

describe("server runtime summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when the runtime-summary read RPC is not available yet", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "PGRST202",
        message:
          "Could not find the function public.get_project_content_runtime_summary(p_project_id) in the schema cache",
      },
    });

    vi.mocked(createClient).mockResolvedValue({
      rpc,
    } as never);

    await expect(
      getPersistedContentWorkspaceSummary({
        projectId: "project-1",
        runtimeSignature: "mapped-runtime:demo",
      }),
    ).resolves.toBeNull();
  });

  it("treats a missing runtime-summary save RPC as a no-op", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "PGRST202",
        message:
          "Could not find the function public.save_project_content_runtime_summary(p_project_id, p_runtime_signature, p_summary_counts, p_is_exact, p_refreshed_at) in the schema cache",
      },
    });

    vi.mocked(createAdminClient).mockReturnValue({
      rpc,
    } as never);

    await expect(
      savePersistedContentWorkspaceSummary({
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
      }),
    ).resolves.toBeUndefined();
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

  it("applies write-side count deltas onto an existing persisted summary", async () => {
    vi.mocked(createClient).mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({
        data: {
          is_exact: true,
          refreshed_at: "2026-03-28T00:00:00.000Z",
          runtime_signature: "mapped-runtime:demo",
          summary_counts: {
            authors: 2,
            categories: 3,
            files: 4,
            media: 5,
            posts: 6,
            tags: 7,
          },
        },
        error: null,
      }),
    } as never);

    const adminRpc = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    vi.mocked(createAdminClient).mockReturnValue({
      rpc: adminRpc,
    } as never);

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

    expect(adminRpc).toHaveBeenCalledWith("save_project_content_runtime_summary", {
      p_is_exact: true,
      p_project_id: "project-1",
      p_refreshed_at: expect.any(String),
      p_runtime_signature: "mapped-runtime:demo",
      p_summary_counts: {
        authors: 3,
        categories: 3,
        files: 4,
        media: 5,
        posts: 4,
        tags: 0,
      },
    });
  });
});
