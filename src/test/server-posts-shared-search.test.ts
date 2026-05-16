import { describe, expect, it, vi } from "vitest";

vi.mock("react", () => ({
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

import { buildContentPostsFilter } from "@/lib/content-runtime/server-posts-shared";

describe("buildContentPostsFilter", () => {
  it("uses the shared search expression instead of broad column-by-column scans", () => {
    const filter = buildContentPostsFilter({
      accessibleAuthorIds: null,
      search: "Hello World",
      status: "all",
    });

    expect(filter.clause).toContain("concat_ws(' '");
    expect(filter.clause).not.toContain("p.title ilike");
    expect(filter.clause).not.toContain("p.slug ilike");
    expect(filter.clause).not.toContain("coalesce(p.excerpt, '') ilike");
    expect(filter.params).toEqual(["%hello world%"]);
  });
});
