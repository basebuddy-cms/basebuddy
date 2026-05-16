import { describe, expect, it } from "vitest";

import {
  DEFAULT_CONTENT_POSTS_QUERY,
  normalizeContentPostsSearch,
  normalizeContentPostsSort,
  normalizeContentPostsStatusFilter,
} from "@/lib/content-runtime/shared";

describe("content posts query helpers", () => {
  it("normalizes search text", () => {
    expect(normalizeContentPostsSearch("  hello   world  ")).toBe("hello world");
  });

  it("falls back to the default sort for invalid values", () => {
    expect(normalizeContentPostsSort("unknown")).toBe(DEFAULT_CONTENT_POSTS_QUERY.sort);
  });

  it("falls back to the default status filter for invalid values", () => {
    expect(normalizeContentPostsStatusFilter("scheduled")).toBe(DEFAULT_CONTENT_POSTS_QUERY.status);
  });
});
