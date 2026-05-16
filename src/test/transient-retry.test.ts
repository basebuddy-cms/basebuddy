import { describe, expect, it, vi } from "vitest";

import {
  isContentRuntimeTransientError,
  retryContentRuntimeTransientErrors,
} from "@/lib/content-runtime/transient-retry";

describe("content runtime transient retry", () => {
  it("classifies timeout-like runtime failures as transient", () => {
    expect(
      isContentRuntimeTransientError(new Error("Connection terminated due to connection timeout")),
    ).toBe(true);
    expect(isContentRuntimeTransientError(new Error("password authentication failed"))).toBe(false);
  });

  it("retries transient failures without retrying permanent failures", async () => {
    const transientOperation = vi
      .fn()
      .mockRejectedValueOnce(new Error("canceling statement due to statement timeout"))
      .mockResolvedValueOnce("ok");

    await expect(
      retryContentRuntimeTransientErrors(transientOperation, {
        delayMs: 0,
        maxAttempts: 2,
      }),
    ).resolves.toBe("ok");
    expect(transientOperation).toHaveBeenCalledTimes(2);

    const permanentOperation = vi.fn().mockRejectedValue(new Error("permission denied"));

    await expect(
      retryContentRuntimeTransientErrors(permanentOperation, {
        delayMs: 0,
        maxAttempts: 2,
      }),
    ).rejects.toThrow("permission denied");
    expect(permanentOperation).toHaveBeenCalledTimes(1);
  });
});
