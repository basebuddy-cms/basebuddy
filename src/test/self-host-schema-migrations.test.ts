import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const readMigration = (fileName: string) =>
  readFileSync(join(process.cwd(), "supabase", "migrations", fileName), "utf8");

describe("self-host schema migrations", () => {
  it("creates self-host projects directly against the BaseBuddy control tables", () => {
    const baselineSql = readMigration("20260420130000_basebuddy_self_host_baseline.sql");
    const createProjectBody = baselineSql
      .split("create or replace function public.create_project(p_name text, p_slug text)")
      .at(-1);

    expect(createProjectBody).toBeDefined();
    expect(createProjectBody).not.toContain("project_datasources");
    expect(createProjectBody).not.toContain("project_cms_bindings");
    expect(createProjectBody).toContain("insert into public.basebuddy_projects");
    expect(createProjectBody).toContain("insert into public.basebuddy_project_members");
    expect(createProjectBody).toContain("insert into public.basebuddy_project_member_roles");
  });

  it("stores mapping revisions directly by project in the fresh baseline", () => {
    const baselineSql = readMigration("20260420130000_basebuddy_self_host_baseline.sql");

    expect(baselineSql).toContain("create table if not exists private.basebuddy_project_content_mapping_revisions");
    expect(baselineSql).not.toContain("private.basebuddy_project_cms_mapping_revisions");
    expect(baselineSql).toContain("project_id uuid not null references public.basebuddy_projects(id) on delete cascade");
    expect(baselineSql).toContain("where pmr.project_id = p_project_id");
    expect(baselineSql).not.toContain("project_datasource_secrets");
    expect(baselineSql).not.toContain("project_cms_bindings");
    expect(baselineSql).not.toContain("project_datasources");
  });

  it("brands the control-plane schema with basebuddy_* tables and no compatibility views", () => {
    const baselineSql = readMigration("20260420130000_basebuddy_self_host_baseline.sql");

    expect(baselineSql).toContain("create table if not exists public.basebuddy_projects");
    expect(baselineSql).toContain("create table if not exists public.basebuddy_profiles");
    expect(baselineSql).toContain("create table if not exists private.basebuddy_project_member_invitations");
    expect(baselineSql).not.toContain("create or replace view public.projects");
    expect(baselineSql).not.toContain("create or replace view private.project_cms_mapping_revisions");
  });

  it("uses content-plane names for mapping, runtime summary, projection, and sidebar RPCs", () => {
    const baselineSql = readMigration("20260420130000_basebuddy_self_host_baseline.sql");

    expect(baselineSql).toContain("create table if not exists private.basebuddy_project_content_runtime_summaries");
    expect(baselineSql).toContain("create table if not exists private.basebuddy_project_content_post_projection_states");
    expect(baselineSql).toContain("create table if not exists private.basebuddy_project_content_post_previews");
    expect(baselineSql).toContain("create table if not exists private.basebuddy_project_content_sidebar_config_revisions");
    expect(baselineSql).toContain("create or replace function public.get_project_content_mapping");
    expect(baselineSql).toContain("create or replace function public.get_project_content_runtime_mapping");
    expect(baselineSql).toContain("create or replace function public.save_project_content_mapping_revision");
    expect(baselineSql).toContain("create or replace function public.get_project_content_runtime_summary");
    expect(baselineSql).toContain("create or replace function public.save_project_content_runtime_summary");
    expect(baselineSql).toContain("create or replace function public.get_project_content_sidebar_config");
    expect(baselineSql).toContain("create or replace function public.save_project_content_sidebar_config");
    expect(baselineSql).not.toContain(`basebuddy_project_cms_${["existing", "db"].join("_")}`);
    expect(baselineSql).not.toContain("get_project_cms_mapping");
    expect(baselineSql).not.toContain("save_project_cms_mapping_revision");
  });

  it("ships a control-plane schema marker and readiness RPC for setup diagnostics", () => {
    const baselineSql = readMigration("20260420130000_basebuddy_self_host_baseline.sql");

    expect(baselineSql).toContain("create table if not exists private.basebuddy_control_plane_schema_versions");
    expect(baselineSql).toContain("'self_host_baseline', 1");
    expect(baselineSql).toContain("create or replace function public.get_basebuddy_control_plane_readiness()");
    expect(baselineSql).toContain("private.basebuddy_control_plane_schema_versions");
    expect(baselineSql).toContain("private.basebuddy_project_content_mapping_revisions");
    expect(baselineSql).toContain("'missingSchemas', missing_schemas.items");
    expect(baselineSql).toContain("public.get_project_content_mapping(uuid)");
    expect(baselineSql).toContain("'owner'");
    expect(baselineSql).toContain("'mapping.write'");
    expect(baselineSql).toContain("'missingRoles', missing_roles.items");
    expect(baselineSql).toContain("'missingPermissions', missing_permissions.items");
    expect(baselineSql).toContain("public.save_project_content_runtime_summary(uuid, text, jsonb, boolean, timestamptz)");
    expect(baselineSql).toContain("grant execute on function public.get_basebuddy_control_plane_readiness() to service_role");
  });

  it("does not ship billing permissions in the self-host baseline", () => {
    const baselineSql = readMigration("20260420130000_basebuddy_self_host_baseline.sql");

    expect(baselineSql).not.toContain("'billing'");
    expect(baselineSql).not.toContain("project.billing.read");
    expect(baselineSql).not.toContain("project.billing.write");
    expect(baselineSql).not.toMatch(/\bbilling\b/i);
  });

  it("exposes the project membership relationship required by Supabase REST", () => {
    const baselineSql = readMigration("20260420130000_basebuddy_self_host_baseline.sql");

    expect(baselineSql).toContain("constraint basebuddy_project_member_roles_project_fk");
    expect(baselineSql).toContain("references public.basebuddy_projects(id)");
  });

  it("bounds control-plane member and invitation list RPCs for large installs", () => {
    const baselineSql = readMigration("20260420130000_basebuddy_self_host_baseline.sql");

    expect(baselineSql).toContain("create or replace function public.get_project_members(\n  p_project_id uuid,\n  p_limit integer default 100,\n  p_offset integer default 0");
    expect(baselineSql).toContain("limit greatest(1, least(coalesce(p_limit, 100), 101))");
    expect(baselineSql).toContain("offset greatest(0, coalesce(p_offset, 0))");
    expect(baselineSql).toContain("create or replace function public.get_project_member_invitations(\n  p_project_id uuid,\n  p_limit integer default 100,\n  p_offset integer default 0");
    expect(baselineSql).toContain("on private.basebuddy_project_member_invitations(project_id, created_at desc, id desc)");
  });

  it("does not unnest PL/pgSQL array variables in SQL FROM clauses", () => {
    const baselineSql = readMigration("20260420130000_basebuddy_self_host_baseline.sql");

    expect(baselineSql).not.toContain("v_input_roles");
    expect(baselineSql).not.toMatch(/from\s+unnest\(v_[^)]+\)/);
    expect(baselineSql).not.toContain("from unnest(v_input_roles)");
    expect(baselineSql).not.toContain("where input_role <> all(v_normalized_roles)");
  });

  it("enforces owner-only role and destructive permission escalation in the database", () => {
    const baselineSql = readMigration("20260420130000_basebuddy_self_host_baseline.sql");

    expect(baselineSql).toContain("create or replace function private.project_member_is_owner");
    expect(baselineSql).toContain("Only project owners can assign or remove the owner role.");
    expect(baselineSql).toContain("Only project owners can change owner members.");
    expect(baselineSql).toContain("Only project owners can grant or remove delete permission.");
    expect(baselineSql).toContain("perform private.assert_project_member_role_change_allowed(");
    expect(baselineSql).toContain("perform private.assert_project_member_permission_overrides_allowed(");
  });

  it("stores and returns per-author publish access in author scopes", () => {
    const baselineSql = readMigration("20260420130000_basebuddy_self_host_baseline.sql");

    expect(baselineSql).toContain("can_publish boolean not null default true");
    expect(baselineSql).toContain("'canPublish', pmas.can_publish");
    expect(baselineSql).toContain("coalesce((scope.value ->> 'canPublish')::boolean, true)");
    expect(baselineSql).toContain("and pmas.can_publish");
  });

  it("requires write access before authenticated users can acquire edit sessions", () => {
    const baselineSql = readMigration("20260420130000_basebuddy_self_host_baseline.sql");
    const acquireSessionBody = baselineSql
      .split("create or replace function public.acquire_project_post_edit_session")
      .at(-1)
      ?.split("create or replace function public.heartbeat_project_post_edit_session")
      .at(0);

    expect(acquireSessionBody).toBeDefined();
    expect(acquireSessionBody).toContain("content.write.all");
    expect(acquireSessionBody).toContain("content.write.authored");
  });

  it("stores post edit session source ids as text so mapped content ids do not need to be UUIDs", () => {
    const baselineSql = readMigration("20260420130000_basebuddy_self_host_baseline.sql");

    expect(baselineSql).toContain("post_id text not null");
    expect(baselineSql).toContain("p_post_id text");
    expect(baselineSql).toContain("blocking_post_id text");
    expect(baselineSql).not.toContain("post_id uuid not null");
    expect(baselineSql).not.toContain("p_post_id uuid");
    expect(baselineSql).not.toContain("blocking_post_id uuid");
  });

  it("enables RLS on every BaseBuddy-owned table", () => {
    const baselineSql = readMigration("20260420130000_basebuddy_self_host_baseline.sql");
    const tableNames = Array.from(
      baselineSql.matchAll(/create table if not exists ((?:public|private)\.basebuddy_[a-z0-9_]+)/g),
      (match) => match[1],
    );

    expect(tableNames.length).toBeGreaterThan(0);

    for (const tableName of tableNames) {
      expect(baselineSql).toContain(`alter table ${tableName} enable row level security;`);
    }
  });

  it("keeps the migration directory squashed to a single fresh-install baseline", () => {
    const migrationFiles = readdirSync(join(process.cwd(), "supabase", "migrations"));

    expect(migrationFiles).toEqual(["20260420130000_basebuddy_self_host_baseline.sql"]);
  });
});
