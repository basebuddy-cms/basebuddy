import { describe, expect, it } from "vitest";

import {
  getHighestProjectRole,
  getProjectSlug,
  getUserDisplayName,
  getUserInitials,
  normalizeProjectSlug,
  normalizeProjectWebsiteUrl,
} from "@/lib/control-plane/utils";

describe("control-plane utils", () => {
  it("normalizes project slugs", () => {
    expect(normalizeProjectSlug("  Marketing Blog  ")).toBe("marketing-blog");
    expect(normalizeProjectSlug("Docs & API")).toBe("docs-api");
  });

  it("prefers custom slug input when provided", () => {
    expect(getProjectSlug("Marketing Blog", "content-hub")).toBe("content-hub");
    expect(getProjectSlug("Marketing Blog", "")).toBe("marketing-blog");
  });

  it("normalizes optional project website urls", () => {
    expect(normalizeProjectWebsiteUrl("example.com")).toBe("https://example.com/");
    expect(normalizeProjectWebsiteUrl(" https://basebuddy.app/about ")).toBe("https://basebuddy.app/about");
    expect(normalizeProjectWebsiteUrl("")).toBeNull();
    expect(normalizeProjectWebsiteUrl("ftp://example.com")).toBeNull();
  });

  it("builds initials from email addresses", () => {
    expect(getUserInitials("ravi.teja@example.com")).toBe("RT");
    expect(getUserInitials(null)).toBe("SP");
  });

  it("prefers explicit profile names and falls back to email-derived names", () => {
    expect(getUserDisplayName("ravi.teja@example.com", "Ravi Teja")).toBe("Ravi Teja");
    expect(getUserDisplayName("ravi.teja@example.com", "")).toBe("Ravi Teja");
    expect(getUserDisplayName(null, null)).toBe("BaseBuddy User");
  });

  it("picks the highest project role from a multi-role assignment", () => {
    expect(getHighestProjectRole(["viewer", "author"])).toBe("author");
    expect(getHighestProjectRole(["author", "editor"])).toBe("editor");
    expect(getHighestProjectRole(["viewer", "owner"])).toBe("owner");
    expect(getHighestProjectRole(["unknown", null])).toBeNull();
  });
});
