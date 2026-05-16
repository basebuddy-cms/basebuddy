import { describe, expect, it } from "vitest";

import {
  DEFAULT_PROJECT_PERMISSION_DEFINITIONS,
  DEFAULT_PROJECT_ROLE_PERMISSION_KEYS,
} from "@/lib/control-plane/member-permissions";

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
});
