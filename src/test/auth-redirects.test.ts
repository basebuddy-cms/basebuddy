import { describe, expect, it } from "vitest";

import { getSafeNextPath } from "@/lib/auth/redirects";

describe("auth redirect safety", () => {
  it("keeps safe in-app paths", () => {
    expect(getSafeNextPath("/projects/demo?tab=posts#editor")).toBe("/projects/demo?tab=posts#editor");
  });

  it("rejects protocol-relative and absolute redirect targets", () => {
    expect(getSafeNextPath("//evil.example")).toBe("/projects");
    expect(getSafeNextPath("https://evil.example")).toBe("/projects");
  });

  it("rejects malformed or unsafe path values", () => {
    expect(getSafeNextPath("/\\evil")).toBe("/projects");
    expect(getSafeNextPath("/projects\nSet-Cookie:x=1")).toBe("/projects");
    expect(getSafeNextPath("javascript:alert(1)")).toBe("/projects");
  });
});
