import { describe, expect, it } from "vitest";

import {
  CONTENT_RUNTIME_REQUEST_SPAN_BUDGETS_MS,
  CONTENT_RUNTIME_ROUTE_BUDGETS_MS,
  getContentRuntimeCacheBuildSlowThresholdMs,
  getContentRuntimeRouteBudgetMs,
} from "@/lib/content-runtime/performance-budgets";

describe("content runtime performance budgets", () => {
  it("exposes explicit hot-route budgets for the main content read families", () => {
    expect(CONTENT_RUNTIME_ROUTE_BUDGETS_MS["content.workspace"]).toBeGreaterThan(0);
    expect(CONTENT_RUNTIME_ROUTE_BUDGETS_MS["content.workspace_counts"]).toBeGreaterThan(0);
    expect(CONTENT_RUNTIME_ROUTE_BUDGETS_MS["content.posts_page"]).toBeGreaterThan(0);
    expect(CONTENT_RUNTIME_ROUTE_BUDGETS_MS["content.post_payload"]).toBeGreaterThan(0);
    expect(CONTENT_RUNTIME_ROUTE_BUDGETS_MS["content.posts_presence"]).toBeGreaterThan(0);
  });

  it("returns a route budget for known routes and falls back for unknown ones", () => {
    expect(getContentRuntimeRouteBudgetMs("content.workspace")).toBe(
      CONTENT_RUNTIME_ROUTE_BUDGETS_MS["content.workspace"],
    );
    expect(getContentRuntimeRouteBudgetMs("cms.unknown")).toBe(CONTENT_RUNTIME_ROUTE_BUDGETS_MS.default);
  });

  it("defines explicit span and cache-build budgets", () => {
    expect(CONTENT_RUNTIME_REQUEST_SPAN_BUDGETS_MS.auth).toBeGreaterThan(0);
    expect(CONTENT_RUNTIME_REQUEST_SPAN_BUDGETS_MS.context).toBeGreaterThan(0);
    expect(CONTENT_RUNTIME_REQUEST_SPAN_BUDGETS_MS.db).toBeGreaterThan(0);
    expect(CONTENT_RUNTIME_REQUEST_SPAN_BUDGETS_MS.handler).toBeGreaterThan(0);
    expect(getContentRuntimeCacheBuildSlowThresholdMs()).toBeGreaterThan(0);
  });
});
