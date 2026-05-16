import { describe, expect, it, vi } from "vitest";

import { loadProjectEditorReadThroughQuery } from "@/components/editor/project-editor/read-through-query";

describe("project editor read-through query loader", () => {
  it("hydrates from query cache first, then refreshes in the background", async () => {
    const latestRequestRef = { current: 0 };
    const setLoading = vi.fn();
    const setRefreshing = vi.fn();
    const setError = vi.fn();
    const applyPayload = vi.fn();

    await loadProjectEditorReadThroughQuery({
      applyPayload,
      fetchFreshPayload: vi.fn().mockResolvedValue({ id: "fresh" }),
      getCachedPayload: () => null,
      getErrorMessage: () => "nope",
      getQueryPayload: () => ({ id: "cached" }),
      latestRequestRef,
      setErrorMessage: setError,
      setLoading,
      setRefreshing,
    });

    expect(applyPayload).toHaveBeenNthCalledWith(1, { id: "cached" }, { persist: false });
    expect(applyPayload).toHaveBeenNthCalledWith(2, { id: "fresh" });
    expect(setLoading).toHaveBeenCalledWith(false);
    expect(setRefreshing).toHaveBeenCalledWith(true);
    expect(setRefreshing).toHaveBeenLastCalledWith(false);
    expect(setError).toHaveBeenCalledWith(null);
    expect(latestRequestRef.current).toBe(1);
  });

  it("falls back to the persisted cache when query cache is empty", async () => {
    const applyPayload = vi.fn();

    await loadProjectEditorReadThroughQuery({
      applyPayload,
      fetchFreshPayload: vi.fn().mockResolvedValue({ id: "fresh" }),
      getCachedPayload: () => ({ id: "persisted" }),
      getErrorMessage: () => "nope",
      getQueryPayload: () => undefined,
      latestRequestRef: { current: 0 },
      setErrorMessage: vi.fn(),
      setLoading: vi.fn(),
      setRefreshing: vi.fn(),
    });

    expect(applyPayload).toHaveBeenNthCalledWith(1, { id: "persisted" }, { persist: false });
    expect(applyPayload).toHaveBeenNthCalledWith(2, { id: "fresh" });
  });

  it("reports an error only when there was no cached payload to keep showing", async () => {
    const setError = vi.fn();

    await loadProjectEditorReadThroughQuery({
      applyPayload: vi.fn(),
      fetchFreshPayload: vi.fn().mockRejectedValue(new Error("boom")),
      getCachedPayload: () => null,
      getErrorMessage: (error) => (error instanceof Error ? error.message : "nope"),
      getQueryPayload: () => undefined,
      latestRequestRef: { current: 0 },
      setErrorMessage: setError,
      setLoading: vi.fn(),
      setRefreshing: vi.fn(),
    });

    expect(setError).toHaveBeenNthCalledWith(1, null);
    expect(setError).toHaveBeenNthCalledWith(2, "boom");
  });

  it("forces a cold loading state when the caller requests a hard refresh", async () => {
    const setLoading = vi.fn();
    const setRefreshing = vi.fn();

    await loadProjectEditorReadThroughQuery({
      applyPayload: vi.fn(),
      fetchFreshPayload: vi.fn().mockResolvedValue({ id: "fresh" }),
      force: true,
      getCachedPayload: () => ({ id: "persisted" }),
      getErrorMessage: () => "nope",
      getQueryPayload: () => ({ id: "cached" }),
      latestRequestRef: { current: 0 },
      setErrorMessage: vi.fn(),
      setLoading,
      setRefreshing,
    });

    expect(setLoading).toHaveBeenNthCalledWith(1, true);
    expect(setRefreshing).toHaveBeenNthCalledWith(1, false);
  });
});
