import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { logSlowContentRuntimeRequest } from "@/lib/content-runtime/request-observability";

describe("content runtime request observability", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not log requests that are still within the route budget", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logSlowContentRuntimeRequest({
      durationMs: 900,
      endpoint: "content.posts_page",
      mode: "mapped_content",
      projectId: "project-1",
      scopeKey: "posts-page",
      status: 200,
    });

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("logs slow requests with redacted route and scope labels", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logSlowContentRuntimeRequest({
      cacheState: "stale",
      durationMs: 1_250,
      endpoint: "content.posts_page",
      mode: "mapped_content",
      projectId: "project-1",
      scopeKey: "posts-page",
      spans: [
        {
          durationMs: 900,
          name: "db",
        },
      ],
      status: 200,
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);

    const [, rawPayload] = warnSpy.mock.calls[0] ?? [];
    const payload = JSON.parse(String(rawPayload)) as {
      endpoint: string;
      projectId: string;
      scopeKey: string;
      spans: Array<{ name: string }>;
    };

    expect(payload).toMatchObject({
      endpoint: "content.posts_page",
      projectId: "project-1",
      scopeKey: "posts-page",
      spans: [{ name: "db" }],
    });
    expect(String(rawPayload)).not.toContain("select ");
    expect(String(rawPayload)).not.toContain("author_id=");
  });
});
