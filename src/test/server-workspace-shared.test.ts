import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildContentAuthorFilter,
  createWorkspaceCapabilities,
} from "@/lib/content-runtime/server-workspace-shared";

describe("server workspace shared helpers", () => {
  it("builds an empty author filter when all authors are readable", () => {
    expect(
      buildContentAuthorFilter({
        accessibleAuthorIds: null,
        alias: "p",
        parameterIndex: 1,
        where: true,
      }),
    ).toEqual({
      clause: "",
      params: [],
    });
  });

  it("builds a where clause for restricted author access", () => {
    expect(
      buildContentAuthorFilter({
        accessibleAuthorIds: ["author-1", "author-2"],
        alias: "p",
        parameterIndex: 3,
        where: true,
      }),
    ).toEqual({
      clause: "where p.author_id::text = any($3::text[])",
      params: [["author-1", "author-2"]],
    });
  });

  it("derives workspace capabilities from member permissions", () => {
    expect(
      createWorkspaceCapabilities({
        apiUrl: null,
        connectionString: null,
        memberAccess: {
          authorScopes: [],
          permissions: ["author.scope.manage", "content.write.all"],
          roles: ["editor"],
        },
        projectSlug: "demo",
        schemaOptions: {
          enableRevisions: true,
          primaryContentFormat: "html",
        },
      }),
    ).toEqual({
      canManageAuthors: true,
      canManageTaxonomy: true,
    });
  });
});
