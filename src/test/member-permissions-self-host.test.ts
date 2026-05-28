import { describe, expect, it } from "vitest";

import {
  DEFAULT_PROJECT_PERMISSION_DEFINITIONS,
  DEFAULT_PROJECT_ROLE_PERMISSION_KEYS,
} from "@/lib/control-plane/member-permissions";
import {
  getAccessibleAuthorIdsForAction,
  hasProjectPermission,
  type ProjectMemberAccess,
} from "@/lib/control-plane/permissions";

describe("member permission definitions", () => {
  it("removes infrastructure/runtime connection permissions from the self-host product surface", () => {
    const permissionKeys = DEFAULT_PROJECT_PERMISSION_DEFINITIONS.map(
      (permission) => permission.permissionKey,
    );

    expect(permissionKeys.some((permissionKey) => permissionKey.startsWith("datasource."))).toBe(
      false,
    );
    expect(permissionKeys).not.toContain("supabase.connect");
    expect(DEFAULT_PROJECT_ROLE_PERMISSION_KEYS.owner).not.toContain("datasource.read");
    expect(DEFAULT_PROJECT_ROLE_PERMISSION_KEYS.owner).not.toContain("datasource.write");
    expect(DEFAULT_PROJECT_ROLE_PERMISSION_KEYS.owner).not.toContain("datasource.connect");
    expect(DEFAULT_PROJECT_ROLE_PERMISSION_KEYS.owner).not.toContain("supabase.connect");
    expect(DEFAULT_PROJECT_ROLE_PERMISSION_KEYS.admin).not.toContain("datasource.read");
    expect(DEFAULT_PROJECT_ROLE_PERMISSION_KEYS.admin).not.toContain("datasource.write");
    expect(DEFAULT_PROJECT_ROLE_PERMISSION_KEYS.admin).not.toContain("datasource.connect");
    expect(DEFAULT_PROJECT_ROLE_PERMISSION_KEYS.admin).not.toContain("supabase.connect");
  });

  it("removes billing permissions from the one-time self-host product surface", () => {
    const permissionKeys = DEFAULT_PROJECT_PERMISSION_DEFINITIONS.map(
      (permission) => permission.permissionKey,
    );
    const permissionCategories = DEFAULT_PROJECT_PERMISSION_DEFINITIONS.map(
      (permission) => permission.category,
    );

    expect(permissionCategories).not.toContain("billing");
    expect(permissionKeys).not.toContain("project.billing.read");
    expect(permissionKeys).not.toContain("project.billing.write");
    expect(DEFAULT_PROJECT_ROLE_PERMISSION_KEYS.owner).not.toContain("project.billing.read");
    expect(DEFAULT_PROJECT_ROLE_PERMISSION_KEYS.owner).not.toContain("project.billing.write");
  });

  it("does not render a runtime permission category for env-owned install settings", async () => {
    const { permissionCategoryLabels } = await import(
      "@/components/editor/project-permissions-settings"
    );

    expect("runtime" in permissionCategoryLabels).toBe(false);
  });

  it("treats invite members as a first-class TypeScript permission", () => {
    const access: ProjectMemberAccess = {
      authorScopes: [],
      permissions: ["member.invite"],
      roles: ["admin"],
    };

    expect(hasProjectPermission(access, "member.invite")).toBe(true);
  });

  it("keeps author-scoped publish access limited to scopes that can publish", () => {
    const access: ProjectMemberAccess = {
      authorScopes: [
        { canPublish: false, cmsAuthorId: "author-1" },
        { canPublish: true, cmsAuthorId: "author-2" },
      ],
      permissions: [
        "content.read.authored",
        "content.write.authored",
        "content.publish.authored",
      ],
      roles: ["author"],
    };

    expect(getAccessibleAuthorIdsForAction(access, "read")).toEqual(["author-1", "author-2"]);
    expect(getAccessibleAuthorIdsForAction(access, "write")).toEqual(["author-1", "author-2"]);
    expect(getAccessibleAuthorIdsForAction(access, "publish")).toEqual(["author-2"]);
  });
});
