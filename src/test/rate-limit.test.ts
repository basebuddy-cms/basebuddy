import { afterEach, describe, expect, it } from "vitest";

import {
  clearFixedWindowRateLimitStore,
  createFixedWindowRateLimiter,
} from "@/lib/security/rate-limit";

describe("fixed-window rate limiter", () => {
  afterEach(() => {
    clearFixedWindowRateLimitStore();
  });

  it("blocks requests after the limit is exceeded inside the window", () => {
    const clock = { now: 1_000 };
    const limiter = createFixedWindowRateLimiter({
      now: () => clock.now,
    });

    expect(limiter.consume({ key: "route:user-1", limit: 2, windowMs: 60_000 }).allowed).toBe(true);
    expect(limiter.consume({ key: "route:user-1", limit: 2, windowMs: 60_000 }).allowed).toBe(true);

    const blocked = limiter.consume({ key: "route:user-1", limit: 2, windowMs: 60_000 });

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets the counter after the window expires", () => {
    const clock = { now: 2_000 };
    const limiter = createFixedWindowRateLimiter({
      now: () => clock.now,
    });

    limiter.consume({ key: "route:user-2", limit: 1, windowMs: 10_000 });
    expect(limiter.consume({ key: "route:user-2", limit: 1, windowMs: 10_000 }).allowed).toBe(false);

    clock.now += 10_001;

    const allowedAgain = limiter.consume({ key: "route:user-2", limit: 1, windowMs: 10_000 });

    expect(allowedAgain.allowed).toBe(true);
    expect(allowedAgain.remaining).toBe(0);
  });
});
