import { describe, expect, it } from "vitest";

import {
  canAccessAuthorScopedContent,
  canForceProjectPostTakeover,
  canManageProjectTaxonomy,
  getAccessibleAuthorIdsForAction,
  hasProjectContentPermission,
  hasProjectPermission,
  type ProjectMemberAccess,
} from "@/lib/control-plane/permissions";

const createAccess = (
  permissions: string[],
  authorScopes: ProjectMemberAccess["authorScopes"] = [],
  roles: ProjectMemberAccess["roles"] = [],
): ProjectMemberAccess => ({
  authorScopes,
  permissions,
  roles,
});

describe("project permissions", () => {
  it("gives owners full project and content access", () => {
    const access = createAccess([
      "project.read",
      "project.update",
      "project.delete",
      "member.manage",
      "content.read.all",
      "content.write.all",
      "content.publish.all",
    ]);

    expect(hasProjectPermission(access, "project.delete")).toBe(true);
    expect(hasProjectContentPermission(access, "read")).toBe(true);
    expect(hasProjectContentPermission(access, "write")).toBe(true);
    expect(hasProjectContentPermission(access, "publish")).toBe(true);
    expect(getAccessibleAuthorIdsForAction(access, "read")).toBeNull();
    expect(canAccessAuthorScopedContent(access, "publish", null)).toBe(true);
  });

  it("keeps admins out of delete while preserving all-content access", () => {
    const access = createAccess([
      "project.read",
      "project.update",
      "member.read",
      "member.manage",
      "content.read.all",
      "content.write.all",
      "content.publish.all",
    ]);

    expect(hasProjectPermission(access, "project.delete")).toBe(false);
    expect(hasProjectPermission(access, "member.manage")).toBe(true);
    expect(canAccessAuthorScopedContent(access, "write", "author-1")).toBe(true);
    expect(canAccessAuthorScopedContent(access, "publish", "author-2")).toBe(true);
  });

  it("lets editors work across all posts without member management", () => {
    const access = createAccess([
      "project.read",
      "content.read.all",
      "content.write.all",
      "content.publish.all",
    ]);

    expect(hasProjectPermission(access, "member.manage")).toBe(false);
    expect(canAccessAuthorScopedContent(access, "read", "author-1")).toBe(true);
    expect(canAccessAuthorScopedContent(access, "write", "author-1")).toBe(true);
    expect(canAccessAuthorScopedContent(access, "publish", "author-1")).toBe(true);
    expect(canManageProjectTaxonomy(access)).toBe(true);
  });

  it("restricts viewers to read-only access", () => {
    const access = createAccess(["project.read", "content.read.all"]);

    expect(hasProjectContentPermission(access, "read")).toBe(true);
    expect(hasProjectContentPermission(access, "write")).toBe(false);
    expect(hasProjectContentPermission(access, "publish")).toBe(false);
    expect(canAccessAuthorScopedContent(access, "read", "author-1")).toBe(true);
    expect(canAccessAuthorScopedContent(access, "write", "author-1")).toBe(false);
    expect(getAccessibleAuthorIdsForAction(access, "write")).toEqual([]);
    expect(canManageProjectTaxonomy(access)).toBe(false);
  });

  it("restricts authored permissions to assigned author scopes", () => {
    const access = createAccess(
      [
        "project.read",
        "content.read.authored",
        "content.write.authored",
        "content.publish.authored",
      ],
      [{ cmsAuthorId: "author-1", canPublish: true }, { cmsAuthorId: "author-2", canPublish: true }],
    );

    expect(getAccessibleAuthorIdsForAction(access, "read")).toEqual(["author-1", "author-2"]);
    expect(getAccessibleAuthorIdsForAction(access, "publish")).toEqual(["author-1", "author-2"]);
    expect(canAccessAuthorScopedContent(access, "read", "author-1")).toBe(true);
    expect(canAccessAuthorScopedContent(access, "write", "author-2")).toBe(true);
    expect(canAccessAuthorScopedContent(access, "write", "author-3")).toBe(false);
    expect(canAccessAuthorScopedContent(access, "publish", "author-1")).toBe(true);
    expect(canAccessAuthorScopedContent(access, "publish", "author-2")).toBe(true);
    expect(canManageProjectTaxonomy(access)).toBe(false);
  });

  it("requires the per-author publish flag for authored publish access", () => {
    const access = createAccess(
      [
        "project.read",
        "content.read.authored",
        "content.write.authored",
        "content.publish.authored",
      ],
      [
        { cmsAuthorId: "author-1", canPublish: true },
        { cmsAuthorId: "author-2", canPublish: false },
      ],
    );

    expect(getAccessibleAuthorIdsForAction(access, "read")).toEqual(["author-1", "author-2"]);
    expect(getAccessibleAuthorIdsForAction(access, "write")).toEqual(["author-1", "author-2"]);
    expect(getAccessibleAuthorIdsForAction(access, "publish")).toEqual(["author-1"]);
    expect(canAccessAuthorScopedContent(access, "publish", "author-1")).toBe(true);
    expect(canAccessAuthorScopedContent(access, "publish", "author-2")).toBe(false);
  });

  it("supports mixed-role access by taking the union of permissions", () => {
    const access = createAccess(
      [
        "project.read",
        "content.read.all",
        "content.write.authored",
        "content.publish.authored",
      ],
      [{ cmsAuthorId: "author-7" }],
    );

    expect(canAccessAuthorScopedContent(access, "read", "someone-else")).toBe(true);
    expect(canAccessAuthorScopedContent(access, "write", "someone-else")).toBe(false);
    expect(canAccessAuthorScopedContent(access, "write", "author-7")).toBe(true);
    expect(canAccessAuthorScopedContent(access, "publish", "author-7")).toBe(true);
    expect(canAccessAuthorScopedContent(access, "publish", "someone-else")).toBe(false);
    expect(canManageProjectTaxonomy(access)).toBe(false);
  });

  it("limits taxonomy management to members with full-content write permission", () => {
    expect(canManageProjectTaxonomy(createAccess(["content.write.all"]))).toBe(true);
    expect(canManageProjectTaxonomy(createAccess(["content.write.authored"]))).toBe(false);
    expect(canManageProjectTaxonomy(createAccess(["project.update"]))).toBe(false);
  });

  it("allows only owners, admins, and editors to force post takeovers", () => {
    expect(canForceProjectPostTakeover(createAccess([], [], ["owner"]))).toBe(true);
    expect(canForceProjectPostTakeover(createAccess([], [], ["admin"]))).toBe(true);
    expect(canForceProjectPostTakeover(createAccess([], [], ["editor"]))).toBe(true);
    expect(canForceProjectPostTakeover(createAccess([], [], ["author"]))).toBe(false);
    expect(canForceProjectPostTakeover(createAccess([], [], ["viewer"]))).toBe(false);
    expect(canForceProjectPostTakeover(createAccess([], [], []))).toBe(false);
  });
});
