create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;
grant usage on schema private to service_role;

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.basebuddy_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text check (name is null or char_length(trim(name)) between 1 and 120),
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists private.basebuddy_control_plane_schema_versions (
  schema_key text primary key check (schema_key ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  version integer not null check (version > 0),
  applied_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.basebuddy_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text not null default 'active' check (status in ('active', 'archived')),
  website_url text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint basebuddy_projects_website_url_length_check
    check (website_url is null or char_length(trim(website_url)) between 1 and 2048)
);

create table if not exists public.basebuddy_project_members (
  project_id uuid not null references public.basebuddy_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (project_id, user_id)
);

create table if not exists public.basebuddy_project_roles (
  role_key text primary key check (role_key ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  label text not null check (char_length(trim(label)) between 1 and 80),
  description text not null check (char_length(trim(description)) between 1 and 240),
  priority integer not null unique check (priority > 0)
);

create table if not exists public.basebuddy_project_permissions (
  permission_key text primary key check (permission_key ~ '^[a-z0-9]+(?:[._][a-z0-9]+)*$'),
  category text not null check (
    category in ('project', 'member', 'author', 'content', 'mapping', 'integration')
  ),
  label text not null check (char_length(trim(label)) between 1 and 80),
  description text not null check (char_length(trim(description)) between 1 and 240)
);

create table if not exists public.basebuddy_project_role_permissions (
  role_key text not null references public.basebuddy_project_roles(role_key) on delete cascade,
  permission_key text not null references public.basebuddy_project_permissions(permission_key) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (role_key, permission_key)
);

create table if not exists public.basebuddy_project_member_grants (
  project_id uuid not null,
  user_id uuid not null,
  permission_key text not null references public.basebuddy_project_permissions(permission_key) on delete cascade,
  override_mode text not null default 'allow' check (override_mode in ('allow', 'deny')),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (project_id, user_id, permission_key),
  constraint basebuddy_project_member_grants_member_fk
    foreign key (project_id, user_id)
    references public.basebuddy_project_members(project_id, user_id)
    on delete cascade
);

create table if not exists public.basebuddy_project_member_roles (
  project_id uuid not null,
  user_id uuid not null,
  role_key text not null references public.basebuddy_project_roles(role_key) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (project_id, user_id, role_key),
  constraint basebuddy_project_member_roles_project_fk
    foreign key (project_id)
    references public.basebuddy_projects(id)
    on delete cascade,
  constraint basebuddy_project_member_roles_member_fk
    foreign key (project_id, user_id)
    references public.basebuddy_project_members(project_id, user_id)
    on delete cascade
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'basebuddy_project_member_roles_project_fk'
      and conrelid = 'public.basebuddy_project_member_roles'::regclass
  ) then
    alter table public.basebuddy_project_member_roles
      add constraint basebuddy_project_member_roles_project_fk
      foreign key (project_id)
      references public.basebuddy_projects(id)
      on delete cascade;
  end if;
end;
$$;

create table if not exists public.basebuddy_project_member_author_scopes (
  project_id uuid not null,
  user_id uuid not null,
  cms_author_id text not null check (char_length(trim(cms_author_id)) between 1 and 255),
  can_publish boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (project_id, user_id, cms_author_id),
  constraint basebuddy_project_member_author_scopes_member_fk
    foreign key (project_id, user_id)
    references public.basebuddy_project_members(project_id, user_id)
    on delete cascade
);

create table if not exists public.basebuddy_project_post_edit_sessions (
  project_id uuid not null references public.basebuddy_projects(id) on delete cascade,
  post_id text not null,
  user_id uuid not null references public.basebuddy_profiles(id) on delete cascade,
  post_title text,
  editor_name text,
  editor_email text,
  last_heartbeat_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (project_id, post_id),
  constraint basebuddy_project_post_edit_sessions_user_unique unique (project_id, user_id)
);

create table if not exists private.basebuddy_project_content_mapping_revisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.basebuddy_projects(id) on delete cascade,
  binding_status text not null default 'draft' check (binding_status in ('draft', 'ready', 'invalid', 'archived')),
  version integer not null check (version > 0),
  source text not null check (source in ('auto_detect', 'manual', 'system')),
  canonical_schema_version integer not null default 1 check (canonical_schema_version > 0),
  scope_mode text not null default 'database' check (scope_mode in ('database')),
  scope_config jsonb not null default '{}'::jsonb check (jsonb_typeof(scope_config) = 'object'),
  install_config jsonb not null default '{}'::jsonb check (jsonb_typeof(install_config) = 'object'),
  storage_bucket text,
  mapping_config jsonb not null default '{}'::jsonb check (jsonb_typeof(mapping_config) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (project_id, version)
);

create table if not exists private.basebuddy_project_content_sidebar_config_revisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.basebuddy_projects(id) on delete cascade,
  version integer not null check (version > 0),
  source text not null default 'manual' check (source in ('manual', 'system')),
  sidebar_config jsonb not null default '{}'::jsonb check (jsonb_typeof(sidebar_config) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references auth.users(id) on delete set null,
  unique (project_id, version)
);

create table if not exists private.basebuddy_project_member_invitations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.basebuddy_projects(id) on delete cascade,
  invited_email text not null,
  invited_email_normalized text not null,
  role_keys text[] not null default '{}'::text[],
  author_scopes jsonb not null default '[]'::jsonb check (jsonb_typeof(author_scopes) = 'array'),
  public_token text not null,
  invited_by_user_id uuid not null references auth.users(id) on delete restrict,
  accepted_by_user_id uuid references auth.users(id) on delete set null,
  revoked_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null default timezone('utc', now()) + interval '14 days',
  accepted_at timestamptz,
  revoked_at timestamptz,
  constraint basebuddy_project_member_invitations_invited_email_check
    check (nullif(trim(invited_email), '') is not null),
  constraint basebuddy_project_member_invitations_invited_email_normalized_check
    check (nullif(trim(invited_email_normalized), '') is not null),
  constraint basebuddy_project_member_invitations_public_token_check
    check (nullif(trim(public_token), '') is not null),
  constraint basebuddy_project_member_invitations_role_keys_check
    check (coalesce(array_length(role_keys, 1), 0) > 0),
  constraint basebuddy_project_member_invitations_accept_pair_check
    check (
      (accepted_at is null and accepted_by_user_id is null)
      or
      (accepted_at is not null and accepted_by_user_id is not null)
    ),
  constraint basebuddy_project_member_invitations_revoke_pair_check
    check (
      (revoked_at is null and revoked_by_user_id is null)
      or
      (revoked_at is not null and revoked_by_user_id is not null)
    )
);

create table if not exists private.basebuddy_project_content_runtime_summaries (
  project_id uuid primary key references public.basebuddy_projects(id) on delete cascade,
  runtime_signature text not null,
  summary_counts jsonb not null default '{}'::jsonb check (jsonb_typeof(summary_counts) = 'object'),
  is_exact boolean not null default true,
  refreshed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists private.basebuddy_project_content_post_projection_states (
  project_id uuid not null references public.basebuddy_projects(id) on delete cascade,
  mapping_revision_key text not null,
  mapping_revision_id uuid null references private.basebuddy_project_content_mapping_revisions(id) on delete cascade,
  mapping_revision_version integer not null default 0,
  status text not null default 'stale' check (status in ('building', 'failed', 'ready', 'stale')),
  total_items integer not null default 0,
  processed_items integer not null default 0,
  progress_cursor text null,
  last_refreshed_at timestamptz null,
  last_error text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (project_id, mapping_revision_key)
);

create table if not exists private.basebuddy_project_content_post_previews (
  project_id uuid not null,
  mapping_revision_key text not null,
  mapping_revision_id uuid null references private.basebuddy_project_content_mapping_revisions(id) on delete cascade,
  mapping_revision_version integer not null default 0,
  source_post_id text not null,
  author_id text null,
  category_ids text[] not null default '{}'::text[],
  tag_ids text[] not null default '{}'::text[],
  title text not null default '',
  slug text not null default '',
  excerpt text null,
  status text not null default 'draft',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  published_at timestamptz null,
  search_text text not null default '',
  refreshed_at timestamptz not null default timezone('utc', now()),
  inserted_at timestamptz not null default timezone('utc', now()),
  primary key (project_id, mapping_revision_key, source_post_id),
  constraint basebuddy_project_content_post_previews_state_fkey
    foreign key (project_id, mapping_revision_key)
    references private.basebuddy_project_content_post_projection_states(project_id, mapping_revision_key)
    on delete cascade
);

create index if not exists basebuddy_projects_created_by_idx
  on public.basebuddy_projects(created_by);
create index if not exists basebuddy_project_members_user_id_idx
  on public.basebuddy_project_members(user_id);
create index if not exists basebuddy_project_member_grants_user_id_idx
  on public.basebuddy_project_member_grants(user_id);
create index if not exists basebuddy_project_member_grants_project_user_mode_idx
  on public.basebuddy_project_member_grants(project_id, user_id, override_mode);
create index if not exists basebuddy_project_member_roles_user_id_idx
  on public.basebuddy_project_member_roles(user_id);
create index if not exists basebuddy_project_member_roles_role_key_idx
  on public.basebuddy_project_member_roles(role_key);
create index if not exists basebuddy_project_member_author_scopes_user_id_idx
  on public.basebuddy_project_member_author_scopes(user_id);
create index if not exists basebuddy_project_member_author_scopes_author_id_idx
  on public.basebuddy_project_member_author_scopes(project_id, cms_author_id);
create index if not exists basebuddy_project_post_edit_sessions_project_heartbeat_idx
  on public.basebuddy_project_post_edit_sessions(project_id, last_heartbeat_at desc);
create index if not exists basebuddy_project_content_mapping_revisions_project_id_idx
  on private.basebuddy_project_content_mapping_revisions(project_id);
create index if not exists basebuddy_project_content_sidebar_config_revisions_project_id_created_at_idx
  on private.basebuddy_project_content_sidebar_config_revisions(project_id, created_at desc);
create unique index if not exists basebuddy_project_member_invitations_public_token_idx
  on private.basebuddy_project_member_invitations(public_token);
create index if not exists basebuddy_project_member_invitations_project_id_created_at_idx
  on private.basebuddy_project_member_invitations(project_id, created_at desc, id desc);
create index if not exists basebuddy_project_member_invitations_project_id_email_idx
  on private.basebuddy_project_member_invitations(project_id, invited_email_normalized);
create index if not exists basebuddy_project_content_post_previews_revision_updated_idx
  on private.basebuddy_project_content_post_previews(project_id, mapping_revision_key, updated_at desc);
create index if not exists basebuddy_project_content_post_previews_revision_created_idx
  on private.basebuddy_project_content_post_previews(project_id, mapping_revision_key, created_at desc);
create index if not exists basebuddy_project_content_post_previews_revision_status_updated_idx
  on private.basebuddy_project_content_post_previews(project_id, mapping_revision_key, status, updated_at desc);
create index if not exists basebuddy_project_content_post_previews_revision_author_updated_idx
  on private.basebuddy_project_content_post_previews(project_id, mapping_revision_key, author_id, updated_at desc);
create index if not exists basebuddy_project_content_post_previews_revision_categories_gin_idx
  on private.basebuddy_project_content_post_previews
  using gin (category_ids);
create index if not exists basebuddy_project_content_post_previews_revision_tags_gin_idx
  on private.basebuddy_project_content_post_previews
  using gin (tag_ids);
create index if not exists basebuddy_project_content_post_previews_search_trgm_idx
  on private.basebuddy_project_content_post_previews
  using gin (search_text gin_trgm_ops);

drop trigger if exists set_basebuddy_profiles_updated_at on public.basebuddy_profiles;
create trigger set_basebuddy_profiles_updated_at
before update on public.basebuddy_profiles
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists set_basebuddy_control_plane_schema_versions_updated_at
on private.basebuddy_control_plane_schema_versions;
create trigger set_basebuddy_control_plane_schema_versions_updated_at
before update on private.basebuddy_control_plane_schema_versions
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists set_basebuddy_projects_updated_at on public.basebuddy_projects;
create trigger set_basebuddy_projects_updated_at
before update on public.basebuddy_projects
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists set_basebuddy_project_member_author_scopes_updated_at on public.basebuddy_project_member_author_scopes;
create trigger set_basebuddy_project_member_author_scopes_updated_at
before update on public.basebuddy_project_member_author_scopes
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists set_basebuddy_project_post_edit_sessions_updated_at on public.basebuddy_project_post_edit_sessions;
create trigger set_basebuddy_project_post_edit_sessions_updated_at
before update on public.basebuddy_project_post_edit_sessions
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists set_basebuddy_project_content_runtime_summaries_updated_at on private.basebuddy_project_content_runtime_summaries;
create trigger set_basebuddy_project_content_runtime_summaries_updated_at
before update on private.basebuddy_project_content_runtime_summaries
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists set_basebuddy_project_content_post_projection_states_updated_at
on private.basebuddy_project_content_post_projection_states;
create trigger set_basebuddy_project_content_post_projection_states_updated_at
before update on private.basebuddy_project_content_post_projection_states
for each row
execute function public.set_current_timestamp_updated_at();

insert into public.basebuddy_project_roles (role_key, label, description, priority)
values
  ('owner', 'Owner', 'Full project access, including delete controls.', 500),
  ('admin', 'Admin', 'Manage the project, members, settings, and content except delete.', 400),
  ('editor', 'Editor', 'Read, edit, and publish content across the whole project.', 300),
  ('author', 'Author', 'Read, edit, and publish only assigned author content.', 200),
  ('viewer', 'Viewer', 'Read-only access to project content.', 100)
on conflict (role_key) do update
set
  label = excluded.label,
  description = excluded.description,
  priority = excluded.priority;

insert into private.basebuddy_control_plane_schema_versions (schema_key, version)
values ('self_host_baseline', 1)
on conflict (schema_key) do update
set
  version = excluded.version,
  updated_at = timezone('utc', now());

insert into public.basebuddy_project_permissions (permission_key, category, label, description)
values
  ('project.read', 'project', 'Read project', 'Open the project and read its core metadata.'),
  ('project.update', 'project', 'Update project', 'Update project settings and metadata.'),
  ('project.delete', 'project', 'Delete project', 'Delete the project and all of its saved workspace data.'),
  ('member.read', 'member', 'Read members', 'View the list of project members and their assigned roles.'),
  ('member.invite', 'member', 'Invite members', 'Add new members to the project.'),
  ('member.manage', 'member', 'Manage members', 'Update or remove project memberships and roles.'),
  ('author.scope.manage', 'author', 'Manage author scopes', 'Assign content author identities to members with the author role.'),
  ('content.read.all', 'content', 'Read all content', 'Read all content in the project.'),
  ('content.read.authored', 'content', 'Read authored content', 'Read content for assigned author identities only.'),
  ('content.write.all', 'content', 'Edit all content', 'Create and edit all project content.'),
  ('content.write.authored', 'content', 'Edit authored content', 'Create and edit content for assigned author identities only.'),
  ('content.publish.all', 'content', 'Publish all content', 'Publish any content in the project.'),
  ('content.publish.authored', 'content', 'Publish authored content', 'Publish content for assigned author identities.'),
  ('mapping.read', 'mapping', 'Read mapping', 'View content mapping configuration.'),
  ('mapping.write', 'mapping', 'Update mapping', 'Update content mapping configuration.')
on conflict (permission_key) do update
set
  category = excluded.category,
  label = excluded.label,
  description = excluded.description;

insert into public.basebuddy_project_role_permissions (role_key, permission_key)
values
  ('owner', 'project.read'),
  ('owner', 'project.update'),
  ('owner', 'project.delete'),
  ('owner', 'member.read'),
  ('owner', 'member.invite'),
  ('owner', 'member.manage'),
  ('owner', 'author.scope.manage'),
  ('owner', 'content.read.all'),
  ('owner', 'content.read.authored'),
  ('owner', 'content.write.all'),
  ('owner', 'content.write.authored'),
  ('owner', 'content.publish.all'),
  ('owner', 'content.publish.authored'),
  ('owner', 'mapping.read'),
  ('owner', 'mapping.write'),
  ('admin', 'project.read'),
  ('admin', 'project.update'),
  ('admin', 'member.read'),
  ('admin', 'member.invite'),
  ('admin', 'member.manage'),
  ('admin', 'author.scope.manage'),
  ('admin', 'content.read.all'),
  ('admin', 'content.write.all'),
  ('admin', 'content.publish.all'),
  ('admin', 'mapping.read'),
  ('admin', 'mapping.write'),
  ('editor', 'project.read'),
  ('editor', 'content.read.all'),
  ('editor', 'content.write.all'),
  ('editor', 'content.publish.all'),
  ('author', 'project.read'),
  ('author', 'content.read.authored'),
  ('author', 'content.write.authored'),
  ('author', 'content.publish.authored'),
  ('viewer', 'project.read'),
  ('viewer', 'content.read.all')
on conflict (role_key, permission_key) do nothing;

insert into storage.buckets (id, name, public)
values ('profile_avatars', 'profile_avatars', true)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public;

drop policy if exists "profile avatars are publicly readable" on storage.objects;
drop policy if exists "authenticated users can upload profile avatars" on storage.objects;
drop policy if exists "authenticated users can update own profile avatars" on storage.objects;
drop policy if exists "authenticated users can delete own profile avatars" on storage.objects;

create policy "profile avatars are publicly readable"
on storage.objects
for select
to public
using (bucket_id = 'profile_avatars');

create policy "authenticated users can upload profile avatars"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile_avatars'
  and split_part(name, '/', 1) = (select auth.uid()::text)
);

create policy "authenticated users can update own profile avatars"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile_avatars'
  and split_part(name, '/', 1) = (select auth.uid()::text)
)
with check (
  bucket_id = 'profile_avatars'
  and split_part(name, '/', 1) = (select auth.uid()::text)
);

create policy "authenticated users can delete own profile avatars"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile_avatars'
  and split_part(name, '/', 1) = (select auth.uid()::text)
);

create or replace function private.role_has_permission(p_role text, p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.basebuddy_project_role_permissions as prp
    where prp.role_key = p_role
      and prp.permission_key = p_permission_key
  );
$$;

create or replace function private.is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.basebuddy_project_members as pm
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid()
  );
$$;

create or replace function private.current_project_roles(p_project_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public, private
as $$
  select coalesce(
    array_agg(pmr.role_key order by pr.priority desc, pmr.role_key),
    '{}'::text[]
  )
  from public.basebuddy_project_member_roles as pmr
  inner join public.basebuddy_project_roles as pr
    on pr.role_key = pmr.role_key
  where pmr.project_id = p_project_id
    and pmr.user_id = auth.uid();
$$;

create or replace function private.current_project_role(p_project_id uuid)
returns text
language sql
stable
security definer
set search_path = public, private
as $$
  select pmr.role_key
  from public.basebuddy_project_member_roles as pmr
  inner join public.basebuddy_project_roles as pr
    on pr.role_key = pmr.role_key
  where pmr.project_id = p_project_id
    and pmr.user_id = auth.uid()
  order by pr.priority desc, pmr.role_key
  limit 1;
$$;

create or replace function private.project_member_has_permission(
  p_project_id uuid,
  p_user_id uuid,
  p_permission_key text
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select
    exists (
      select 1
      from public.basebuddy_project_members as pm
      where pm.project_id = p_project_id
        and pm.user_id = p_user_id
    )
    and not exists (
      select 1
      from public.basebuddy_project_member_grants as pmg
      where pmg.project_id = p_project_id
        and pmg.user_id = p_user_id
        and pmg.permission_key = p_permission_key
        and pmg.override_mode = 'deny'
    )
    and (
      exists (
        select 1
        from public.basebuddy_project_member_grants as pmg
        where pmg.project_id = p_project_id
          and pmg.user_id = p_user_id
          and pmg.permission_key = p_permission_key
          and pmg.override_mode = 'allow'
      )
      or exists (
        select 1
        from public.basebuddy_project_member_roles as pmr
        inner join public.basebuddy_project_role_permissions as prp
          on prp.role_key = pmr.role_key
        where pmr.project_id = p_project_id
          and pmr.user_id = p_user_id
          and prp.permission_key = p_permission_key
      )
    );
$$;

create or replace function private.has_project_permission(p_project_id uuid, p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.project_member_has_permission(p_project_id, auth.uid(), p_permission_key);
$$;

create or replace function private.project_member_is_owner(
  p_project_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.basebuddy_project_member_roles as pmr
    where pmr.project_id = p_project_id
      and pmr.user_id = p_user_id
      and pmr.role_key = 'owner'
  );
$$;

create or replace function private.has_project_author_permission(
  p_project_id uuid,
  p_cms_author_id text,
  p_action text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_author_id text := trim(coalesce(p_cms_author_id, ''));
  v_action text := trim(coalesce(p_action, ''));
begin
  if v_author_id = '' then
    return false;
  end if;

  if v_action = 'read' then
    return
      private.has_project_permission(p_project_id, 'content.read.all')
      or (
        private.has_project_permission(p_project_id, 'content.read.authored')
        and exists (
          select 1
          from public.basebuddy_project_member_author_scopes as pmas
          where pmas.project_id = p_project_id
            and pmas.user_id = auth.uid()
            and pmas.cms_author_id = v_author_id
        )
      );
  end if;

  if v_action = 'write' then
    return
      private.has_project_permission(p_project_id, 'content.write.all')
      or (
        private.has_project_permission(p_project_id, 'content.write.authored')
        and exists (
          select 1
          from public.basebuddy_project_member_author_scopes as pmas
          where pmas.project_id = p_project_id
            and pmas.user_id = auth.uid()
            and pmas.cms_author_id = v_author_id
        )
      );
  end if;

  if v_action = 'publish' then
    return
      private.has_project_permission(p_project_id, 'content.publish.all')
      or (
        private.has_project_permission(p_project_id, 'content.publish.authored')
        and exists (
          select 1
          from public.basebuddy_project_member_author_scopes as pmas
          where pmas.project_id = p_project_id
            and pmas.user_id = auth.uid()
            and pmas.cms_author_id = v_author_id
            and pmas.can_publish
        )
      );
  end if;

  return false;
end;
$$;

create or replace function private.resolve_project_member_roles(p_roles text[])
returns text[]
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_normalized_roles text[] := '{}'::text[];
  v_invalid_roles text[] := '{}'::text[];
  v_input_count integer := 0;
  v_normalized_count integer := 0;
begin
  select count(*)
  into v_input_count
  from (
    select distinct lower(trim(input_role.role_key)) as normalized_role
    from unnest(coalesce(p_roles, '{}'::text[])) as input_role(role_key)
    where trim(coalesce(input_role.role_key, '')) <> ''
  ) as normalized_input_roles;

  if v_input_count = 0 then
    raise exception 'Select at least one role.';
  end if;

  select coalesce(array_agg(pr.role_key order by pr.priority desc, pr.role_key), '{}'::text[])
  into v_normalized_roles
  from (
    select distinct lower(trim(input_role.role_key)) as role_key
    from unnest(coalesce(p_roles, '{}'::text[])) as input_role(role_key)
    where trim(coalesce(input_role.role_key, '')) <> ''
  ) as normalized_input_roles
  inner join public.basebuddy_project_roles as pr
    on pr.role_key = normalized_input_roles.role_key;

  v_normalized_count := coalesce(array_length(v_normalized_roles, 1), 0);

  if v_input_count <> v_normalized_count then
    select coalesce(array_agg(normalized_input_roles.role_key order by normalized_input_roles.role_key), '{}'::text[])
    into v_invalid_roles
    from (
      select distinct lower(trim(input_role.role_key)) as role_key
      from unnest(coalesce(p_roles, '{}'::text[])) as input_role(role_key)
      where trim(coalesce(input_role.role_key, '')) <> ''
    ) as normalized_input_roles
    left join public.basebuddy_project_roles as pr
      on pr.role_key = normalized_input_roles.role_key
    where pr.role_key is null;

    raise exception 'Invalid role selection: %', array_to_string(v_invalid_roles, ', ');
  end if;

  return v_normalized_roles;
end;
$$;

create or replace function private.assert_project_member_role_change_allowed(
  p_project_id uuid,
  p_user_id uuid,
  p_roles text[],
  p_target_is_owner boolean default false
)
returns void
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_actor_is_owner boolean := private.project_member_is_owner(p_project_id, auth.uid());
begin
  if v_actor_is_owner then
    return;
  end if;

  if coalesce(p_target_is_owner, false) then
    raise exception 'Only project owners can change owner members.';
  end if;

  if 'owner' = any(coalesce(p_roles, '{}'::text[])) then
    raise exception 'Only project owners can assign or remove the owner role.';
  end if;
end;
$$;

create or replace function private.assert_project_member_permission_overrides_allowed(
  p_project_id uuid,
  p_user_id uuid,
  p_allow_permission_keys text[],
  p_deny_permission_keys text[]
)
returns void
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_actor_is_owner boolean := private.project_member_is_owner(p_project_id, auth.uid());
  v_target_is_owner boolean := private.project_member_is_owner(p_project_id, p_user_id);
begin
  if v_actor_is_owner then
    return;
  end if;

  if v_target_is_owner then
    raise exception 'Only project owners can change owner members.';
  end if;

  if 'project.delete' = any(coalesce(p_allow_permission_keys, '{}'::text[]))
    or 'project.delete' = any(coalesce(p_deny_permission_keys, '{}'::text[])) then
    raise exception 'Only project owners can grant or remove delete permission.';
  end if;
end;
$$;

create or replace function private.apply_project_member_access(
  p_project_id uuid,
  p_user_id uuid,
  p_roles text[],
  p_author_scopes jsonb default '[]'::jsonb,
  p_require_manage_permission boolean default true
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_roles text[] := private.resolve_project_member_roles(p_roles);
  v_author_scopes jsonb := coalesce(p_author_scopes, '[]'::jsonb);
  v_has_author_role boolean := 'author' = any(v_roles);
  v_role text;
  v_target_is_owner boolean := false;
  v_remaining_owner_count integer := 0;
  v_author_scope_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_require_manage_permission and not private.has_project_permission(p_project_id, 'member.manage') then
    raise exception 'Not authorized to manage project members';
  end if;

  if not exists (
    select 1
    from public.basebuddy_project_members as pm
    where pm.project_id = p_project_id
      and pm.user_id = p_user_id
  ) then
    raise exception 'Project member not found';
  end if;

  if jsonb_typeof(v_author_scopes) <> 'array' then
    raise exception 'Author scopes must be an array.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_author_scopes) as scope(value)
    where jsonb_typeof(scope.value) <> 'object'
      or trim(coalesce(scope.value ->> 'cmsAuthorId', '')) = ''
      or (
        scope.value ? 'canPublish'
        and jsonb_typeof(scope.value -> 'canPublish') <> 'boolean'
      )
  ) then
    raise exception 'Each author scope needs a content author ID and valid publish access.';
  end if;

  select count(*)
  into v_author_scope_count
  from (
    select distinct trim(scope.value ->> 'cmsAuthorId') as cms_author_id
    from jsonb_array_elements(v_author_scopes) as scope(value)
    where trim(coalesce(scope.value ->> 'cmsAuthorId', '')) <> ''
  ) as normalized_scopes;

  if v_has_author_role and v_author_scope_count = 0 then
    raise exception 'Select at least one author scope for the author role.';
  end if;

  if not v_has_author_role and v_author_scope_count > 0 then
    raise exception 'Author scopes can only be assigned when the author role is selected.';
  end if;

  select exists (
    select 1
    from public.basebuddy_project_member_roles as pmr
    where pmr.project_id = p_project_id
      and pmr.user_id = p_user_id
      and pmr.role_key = 'owner'
  )
  into v_target_is_owner;

  if p_require_manage_permission then
    perform private.assert_project_member_role_change_allowed(
      p_project_id,
      p_user_id,
      v_roles,
      v_target_is_owner
    );
  end if;

  if v_target_is_owner and not ('owner' = any(v_roles)) then
    select count(*)
    into v_remaining_owner_count
    from public.basebuddy_project_member_roles as pmr
    where pmr.project_id = p_project_id
      and pmr.role_key = 'owner'
      and pmr.user_id <> p_user_id;

    if v_remaining_owner_count = 0 then
      raise exception 'At least one owner is required for each project.';
    end if;
  end if;

  delete from public.basebuddy_project_member_roles
  where project_id = p_project_id
    and user_id = p_user_id;

  foreach v_role in array v_roles loop
    insert into public.basebuddy_project_member_roles (project_id, user_id, role_key)
    values (p_project_id, p_user_id, v_role);
  end loop;

  delete from public.basebuddy_project_member_author_scopes
  where project_id = p_project_id
    and user_id = p_user_id;

  if v_author_scope_count > 0 then
    insert into public.basebuddy_project_member_author_scopes (project_id, user_id, cms_author_id, can_publish)
    select
      p_project_id,
      p_user_id,
      normalized_scope.cms_author_id,
      bool_or(normalized_scope.can_publish)
    from (
      select
        trim(scope.value ->> 'cmsAuthorId') as cms_author_id,
        coalesce((scope.value ->> 'canPublish')::boolean, true) as can_publish
      from jsonb_array_elements(v_author_scopes) as scope(value)
    ) as normalized_scope
    where normalized_scope.cms_author_id <> ''
    group by normalized_scope.cms_author_id;
  end if;
end;
$$;

create or replace function private.sync_project_member_access(
  p_project_id uuid,
  p_user_id uuid,
  p_roles text[],
  p_author_scopes jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  perform private.apply_project_member_access(
    p_project_id,
    p_user_id,
    p_roles,
    p_author_scopes,
    true
  );
end;
$$;

create or replace function public.is_project_slug_available(p_slug text)
returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_slug text := lower(regexp_replace(trim(coalesce(p_slug, '')), '[^a-z0-9]+', '-', 'g'));
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_slug := regexp_replace(v_slug, '(^-+|-+$)', '', 'g');

  if v_slug = '' then
    return false;
  end if;

  return not exists (
    select 1
    from public.basebuddy_projects
    where slug = v_slug
  );
end;
$$;

create or replace function public.create_project(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
  v_name text := trim(coalesce(p_name, ''));
  v_slug text := lower(regexp_replace(trim(coalesce(p_slug, '')), '[^a-z0-9]+', '-', 'g'));
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  v_slug := regexp_replace(v_slug, '(^-+|-+$)', '', 'g');

  if v_name = '' then
    raise exception 'Project name is required';
  end if;

  if v_slug = '' then
    raise exception 'Project slug is required';
  end if;

  insert into public.basebuddy_projects (name, slug, created_by)
  values (v_name, v_slug, v_user_id)
  returning id into v_project_id;

  insert into public.basebuddy_project_members (project_id, user_id)
  values (v_project_id, v_user_id);

  insert into public.basebuddy_project_member_roles (project_id, user_id, role_key)
  values (v_project_id, v_user_id, 'owner');

  return v_project_id;
end;
$$;

create or replace function public.update_project_metadata(
  p_project_id uuid,
  p_name text,
  p_slug text,
  p_website_url text default null
)
returns table (
  id uuid,
  name text,
  slug text,
  website_url text
)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
  v_slug text := lower(regexp_replace(trim(coalesce(p_slug, '')), '[^a-z0-9]+', '-', 'g'));
  v_website_url text := nullif(trim(coalesce(p_website_url, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_slug := regexp_replace(v_slug, '(^-+|-+$)', '', 'g');

  if v_name = '' then
    raise exception 'Project name is required';
  end if;

  if v_slug = '' then
    raise exception 'Project slug is required';
  end if;

  if not private.has_project_permission(p_project_id, 'project.update') then
    raise exception 'Not authorized to update this project';
  end if;

  return query
  update public.basebuddy_projects as projects
  set
    name = v_name,
    slug = v_slug,
    website_url = v_website_url
  where projects.id = p_project_id
  returning projects.id, projects.name, projects.slug, projects.website_url;
end;
$$;

create or replace function public.delete_project_for_current_user(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not private.has_project_permission(p_project_id, 'project.delete') then
    raise exception 'Not authorized to delete this project';
  end if;

  delete from public.basebuddy_projects
  where id = p_project_id;
end;
$$;

create or replace function public.get_current_project_member_access(p_project_id uuid)
returns table (
  role_keys text[],
  permission_keys text[],
  author_scopes jsonb
)
language plpgsql
stable
security definer
set search_path = public, private
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not private.has_project_permission(p_project_id, 'project.read') then
    raise exception 'Not authorized to access this project';
  end if;

  return query
  select
    coalesce(
      (
        select array_agg(pmr.role_key order by pr.priority desc, pmr.role_key)
        from public.basebuddy_project_member_roles as pmr
        inner join public.basebuddy_project_roles as pr
          on pr.role_key = pmr.role_key
        where pmr.project_id = p_project_id
          and pmr.user_id = auth.uid()
      ),
      '{}'::text[]
    ) as role_keys,
    coalesce(
      (
        select array_agg(pp.permission_key order by pp.permission_key)
        from public.basebuddy_project_permissions as pp
        where private.project_member_has_permission(p_project_id, auth.uid(), pp.permission_key)
      ),
      '{}'::text[]
    ) as permission_keys,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'cmsAuthorId', pmas.cms_author_id,
            'canPublish', pmas.can_publish
          )
          order by pmas.cms_author_id
        )
        from public.basebuddy_project_member_author_scopes as pmas
        where pmas.project_id = p_project_id
          and pmas.user_id = auth.uid()
      ),
      '[]'::jsonb
    ) as author_scopes;
end;
$$;

create or replace function public.get_project_members(
  p_project_id uuid,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  email text,
  name text,
  avatar_url text,
  joined_at timestamptz,
  role_keys text[],
  author_scopes jsonb
)
language plpgsql
stable
security definer
set search_path = public, private
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not private.has_project_permission(p_project_id, 'member.read') then
    raise exception 'Not authorized to read project members';
  end if;

  return query
  select
    pm.user_id,
    profiles.email,
    profiles.name,
    profiles.avatar_url,
    pm.created_at as joined_at,
    coalesce(
      (
        select array_agg(pmr.role_key order by pr.priority desc, pmr.role_key)
        from public.basebuddy_project_member_roles as pmr
        inner join public.basebuddy_project_roles as pr
          on pr.role_key = pmr.role_key
        where pmr.project_id = pm.project_id
          and pmr.user_id = pm.user_id
      ),
      '{}'::text[]
    ) as role_keys,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'cmsAuthorId', pmas.cms_author_id,
            'canPublish', pmas.can_publish
          )
          order by pmas.cms_author_id
        )
        from public.basebuddy_project_member_author_scopes as pmas
        where pmas.project_id = pm.project_id
          and pmas.user_id = pm.user_id
      ),
      '[]'::jsonb
    ) as author_scopes
  from public.basebuddy_project_members as pm
  left join public.basebuddy_profiles as profiles
    on profiles.id = pm.user_id
  where pm.project_id = p_project_id
  order by
    coalesce(
      (
        select max(pr.priority)
        from public.basebuddy_project_member_roles as pmr
        inner join public.basebuddy_project_roles as pr
          on pr.role_key = pmr.role_key
        where pmr.project_id = pm.project_id
          and pmr.user_id = pm.user_id
      ),
      0
    ) desc,
    coalesce(
      nullif(trim(coalesce(profiles.name, '')), ''),
      nullif(trim(coalesce(profiles.email, '')), ''),
      pm.user_id::text
    ) asc
  limit greatest(1, least(coalesce(p_limit, 100), 101))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

create or replace function public.add_project_member_by_email(
  p_project_id uuid,
  p_email text,
  p_roles text[],
  p_author_scopes jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not private.has_project_permission(p_project_id, 'member.manage') then
    raise exception 'Not authorized to manage project members';
  end if;

  if v_email = '' then
    raise exception 'Email is required.';
  end if;

  select profiles.id
  into v_user_id
  from public.basebuddy_profiles as profiles
  where lower(coalesce(profiles.email, '')) = v_email
  limit 1;

  if v_user_id is null then
    raise exception 'That person needs to sign in before you can add them.';
  end if;

  if exists (
    select 1
    from public.basebuddy_project_members as pm
    where pm.project_id = p_project_id
      and pm.user_id = v_user_id
  ) then
    raise exception 'That person is already a member of this project.';
  end if;

  insert into public.basebuddy_project_members (project_id, user_id)
  values (p_project_id, v_user_id);

  perform private.sync_project_member_access(
    p_project_id,
    v_user_id,
    p_roles,
    p_author_scopes
  );
end;
$$;

create or replace function public.update_project_member_access(
  p_project_id uuid,
  p_user_id uuid,
  p_roles text[],
  p_author_scopes jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  perform private.sync_project_member_access(
    p_project_id,
    p_user_id,
    p_roles,
    p_author_scopes
  );
end;
$$;

create or replace function public.remove_project_member(
  p_project_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_target_is_owner boolean := false;
  v_remaining_owner_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not private.has_project_permission(p_project_id, 'member.manage') then
    raise exception 'Not authorized to manage project members';
  end if;

  if not exists (
    select 1
    from public.basebuddy_project_members as pm
    where pm.project_id = p_project_id
      and pm.user_id = p_user_id
  ) then
    raise exception 'Project member not found';
  end if;

  select exists (
    select 1
    from public.basebuddy_project_member_roles as pmr
    where pmr.project_id = p_project_id
      and pmr.user_id = p_user_id
      and pmr.role_key = 'owner'
  )
  into v_target_is_owner;

  if v_target_is_owner then
    select count(*)
    into v_remaining_owner_count
    from public.basebuddy_project_member_roles as pmr
    where pmr.project_id = p_project_id
      and pmr.role_key = 'owner'
      and pmr.user_id <> p_user_id;

    if v_remaining_owner_count = 0 then
      raise exception 'At least one owner is required for each project.';
    end if;
  end if;

  delete from public.basebuddy_project_members
  where project_id = p_project_id
    and user_id = p_user_id;
end;
$$;

create or replace function public.set_project_member_permission_overrides(
  p_project_id uuid,
  p_user_id uuid,
  p_allow_permission_keys text[] default '{}'::text[],
  p_deny_permission_keys text[] default '{}'::text[]
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_allow_permission_keys text[] := '{}'::text[];
  v_deny_permission_keys text[] := '{}'::text[];
  v_invalid_permission_keys text[] := '{}'::text[];
  v_permission_key text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not private.has_project_permission(p_project_id, 'member.manage') then
    raise exception 'Not authorized to manage project permissions';
  end if;

  if not exists (
    select 1
    from public.basebuddy_project_members as pm
    where pm.project_id = p_project_id
      and pm.user_id = p_user_id
  ) then
    raise exception 'Project member not found';
  end if;

  select coalesce(array_agg(normalized_permission_key order by normalized_permission_key), '{}'::text[])
  into v_allow_permission_keys
  from (
    select distinct lower(trim(input_permission.permission_key)) as normalized_permission_key
    from unnest(coalesce(p_allow_permission_keys, '{}'::text[])) as input_permission(permission_key)
    where trim(coalesce(input_permission.permission_key, '')) <> ''
  ) as normalized_allow_permissions;

  select coalesce(array_agg(normalized_permission_key order by normalized_permission_key), '{}'::text[])
  into v_deny_permission_keys
  from (
    select distinct lower(trim(input_permission.permission_key)) as normalized_permission_key
    from unnest(coalesce(p_deny_permission_keys, '{}'::text[])) as input_permission(permission_key)
    where trim(coalesce(input_permission.permission_key, '')) <> ''
  ) as normalized_deny_permissions;

  foreach v_permission_key in array v_allow_permission_keys loop
    if v_permission_key = any(v_deny_permission_keys) then
      raise exception 'A permission cannot be both allowed and denied.';
    end if;
  end loop;

  foreach v_permission_key in array v_allow_permission_keys loop
    if not exists (
      select 1
      from public.basebuddy_project_permissions as pp
      where pp.permission_key = v_permission_key
    ) then
      v_invalid_permission_keys := array_append(v_invalid_permission_keys, v_permission_key);
    end if;
  end loop;

  foreach v_permission_key in array v_deny_permission_keys loop
    if not exists (
      select 1
      from public.basebuddy_project_permissions as pp
      where pp.permission_key = v_permission_key
    ) then
      v_invalid_permission_keys := array_append(v_invalid_permission_keys, v_permission_key);
    end if;
  end loop;

  if coalesce(array_length(v_invalid_permission_keys, 1), 0) > 0 then
    raise exception 'Invalid permission selection: %', array_to_string(v_invalid_permission_keys, ', ');
  end if;

  perform private.assert_project_member_permission_overrides_allowed(
    p_project_id,
    p_user_id,
    v_allow_permission_keys,
    v_deny_permission_keys
  );

  delete from public.basebuddy_project_member_grants
  where project_id = p_project_id
    and user_id = p_user_id;

  foreach v_permission_key in array v_allow_permission_keys loop
    insert into public.basebuddy_project_member_grants (project_id, user_id, permission_key, override_mode)
    values (p_project_id, p_user_id, v_permission_key, 'allow');
  end loop;

  foreach v_permission_key in array v_deny_permission_keys loop
    insert into public.basebuddy_project_member_grants (project_id, user_id, permission_key, override_mode)
    values (p_project_id, p_user_id, v_permission_key, 'deny');
  end loop;

  if not exists (
    select 1
    from public.basebuddy_project_members as pm
    where pm.project_id = p_project_id
      and private.project_member_has_permission(p_project_id, pm.user_id, 'member.manage')
  ) then
    raise exception 'At least one member must keep permission to manage members.';
  end if;
end;
$$;

create or replace function public.get_project_author_members(p_project_id uuid)
returns table (
  user_id uuid,
  email text,
  name text,
  avatar_url text
)
language plpgsql
stable
security definer
set search_path = public, private
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not private.has_project_permission(p_project_id, 'author.scope.manage') then
    raise exception 'Not authorized to manage author assignments for this project';
  end if;

  return query
  select
    pm.user_id,
    profiles.email,
    profiles.name,
    profiles.avatar_url
  from public.basebuddy_project_members as pm
  inner join public.basebuddy_project_member_roles as pmr
    on pmr.project_id = pm.project_id
   and pmr.user_id = pm.user_id
   and pmr.role_key = 'author'
  left join public.basebuddy_profiles as profiles
    on profiles.id = pm.user_id
  where pm.project_id = p_project_id
  order by
    coalesce(
      nullif(trim(coalesce(profiles.name, '')), ''),
      nullif(trim(coalesce(profiles.email, '')), ''),
      pm.user_id::text
    ) asc;
end;
$$;

create or replace function public.get_project_author_assignments(p_project_id uuid)
returns table (
  cms_author_id text,
  user_id uuid,
  email text,
  name text,
  avatar_url text,
  can_publish boolean
)
language plpgsql
stable
security definer
set search_path = public, private
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not private.has_project_permission(p_project_id, 'author.scope.manage') then
    raise exception 'Not authorized to manage author assignments for this project';
  end if;

  return query
  select
    pmas.cms_author_id,
    pmas.user_id,
    profiles.email,
    profiles.name,
    profiles.avatar_url,
    pmas.can_publish
  from public.basebuddy_project_member_author_scopes as pmas
  inner join public.basebuddy_project_member_roles as pmr
    on pmr.project_id = pmas.project_id
   and pmr.user_id = pmas.user_id
   and pmr.role_key = 'author'
  left join public.basebuddy_profiles as profiles
    on profiles.id = pmas.user_id
  where pmas.project_id = p_project_id
  order by pmas.cms_author_id asc;
end;
$$;

create or replace function public.set_project_author_assignment(
  p_project_id uuid,
  p_cms_author_id text,
  p_user_id uuid default null,
  p_can_publish boolean default true
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_cms_author_id text := trim(coalesce(p_cms_author_id, ''));
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not private.has_project_permission(p_project_id, 'author.scope.manage') then
    raise exception 'Not authorized to manage author assignments for this project';
  end if;

  if v_cms_author_id = '' then
    raise exception 'Select a content author first.';
  end if;

  delete from public.basebuddy_project_member_author_scopes
  where project_id = p_project_id
    and cms_author_id = v_cms_author_id;

  if p_user_id is null then
    return;
  end if;

  if not exists (
    select 1
    from public.basebuddy_project_members as pm
    where pm.project_id = p_project_id
      and pm.user_id = p_user_id
  ) then
    raise exception 'Project member not found';
  end if;

  if not exists (
    select 1
    from public.basebuddy_project_member_roles as pmr
    where pmr.project_id = p_project_id
      and pmr.user_id = p_user_id
      and pmr.role_key = 'author'
  ) then
    raise exception 'Select a project member with the author role.';
  end if;

  insert into public.basebuddy_project_member_author_scopes (
    project_id,
    user_id,
    cms_author_id,
    can_publish
  )
  values (
    p_project_id,
    p_user_id,
    v_cms_author_id,
    coalesce(p_can_publish, true)
  );
end;
$$;

create or replace function public.get_project_content_mapping(
  p_project_id uuid
)
returns table (
  binding_id uuid,
  binding_mode text,
  binding_status text,
  canonical_schema_version integer,
  scope_mode text,
  scope_config jsonb,
  install_config jsonb,
  storage_bucket text,
  revision_id uuid,
  revision_version integer,
  revision_source text,
  revision_created_at timestamptz,
  mapping_config jsonb
)
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not private.has_project_permission(p_project_id, 'mapping.read') then
    raise exception 'Not authorized to view project mapping';
  end if;

  return query
  with project_row as (
    select p.id
    from public.basebuddy_projects as p
    where p.id = p_project_id
      and p.status <> 'archived'
    limit 1
  ),
  latest_revision as (
    select
      pmr.binding_status,
      pmr.canonical_schema_version,
      pmr.scope_mode,
      pmr.scope_config,
      pmr.install_config,
      pmr.storage_bucket,
      pmr.id,
      pmr.version,
      pmr.source,
      pmr.created_at,
      pmr.mapping_config
    from private.basebuddy_project_content_mapping_revisions as pmr
    inner join project_row
      on project_row.id = pmr.project_id
    order by pmr.version desc, pmr.created_at desc
    limit 1
  )
  select
    project_row.id as binding_id,
    'mapped_content'::text as binding_mode,
    coalesce(latest_revision.binding_status, 'draft') as binding_status,
    coalesce(latest_revision.canonical_schema_version, 1) as canonical_schema_version,
    coalesce(latest_revision.scope_mode, 'database') as scope_mode,
    coalesce(latest_revision.scope_config, '{}'::jsonb) as scope_config,
    coalesce(latest_revision.install_config, '{}'::jsonb) as install_config,
    latest_revision.storage_bucket,
    latest_revision.id as revision_id,
    latest_revision.version as revision_version,
    latest_revision.source as revision_source,
    latest_revision.created_at as revision_created_at,
    coalesce(latest_revision.mapping_config, '{}'::jsonb) as mapping_config
  from project_row
  left join latest_revision on true;
end;
$$;

create or replace function public.get_project_content_runtime_mapping(
  p_project_id uuid
)
returns table (
  binding_id uuid,
  binding_mode text,
  binding_status text,
  canonical_schema_version integer,
  scope_mode text,
  scope_config jsonb,
  install_config jsonb,
  storage_bucket text,
  revision_id uuid,
  revision_version integer,
  revision_source text,
  revision_created_at timestamptz,
  mapping_config jsonb
)
language plpgsql
security definer
set search_path = public, private
as $$
begin
  return query
  with project_row as (
    select p.id
    from public.basebuddy_projects as p
    where p.id = p_project_id
      and p.status <> 'archived'
    limit 1
  ),
  latest_revision as (
    select
      pmr.binding_status,
      pmr.canonical_schema_version,
      pmr.scope_mode,
      pmr.scope_config,
      pmr.install_config,
      pmr.storage_bucket,
      pmr.id,
      pmr.version,
      pmr.source,
      pmr.created_at,
      pmr.mapping_config
    from private.basebuddy_project_content_mapping_revisions as pmr
    inner join project_row
      on project_row.id = pmr.project_id
    order by pmr.version desc, pmr.created_at desc
    limit 1
  )
  select
    project_row.id as binding_id,
    'mapped_content'::text as binding_mode,
    coalesce(latest_revision.binding_status, 'draft') as binding_status,
    coalesce(latest_revision.canonical_schema_version, 1) as canonical_schema_version,
    coalesce(latest_revision.scope_mode, 'database') as scope_mode,
    coalesce(latest_revision.scope_config, '{}'::jsonb) as scope_config,
    coalesce(latest_revision.install_config, '{}'::jsonb) as install_config,
    latest_revision.storage_bucket,
    latest_revision.id as revision_id,
    latest_revision.version as revision_version,
    latest_revision.source as revision_source,
    latest_revision.created_at as revision_created_at,
    coalesce(latest_revision.mapping_config, '{}'::jsonb) as mapping_config
  from project_row
  left join latest_revision on true;
end;
$$;

create or replace function public.save_project_content_mapping_revision(
  p_project_id uuid,
  p_source text default 'manual',
  p_mapping_config jsonb default '{}'::jsonb,
  p_binding_status text default null
)
returns table (
  binding_id uuid,
  revision_id uuid,
  revision_version integer,
  revision_source text,
  binding_status text,
  revision_created_at timestamptz
)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_next_version integer;
  v_revision_id uuid;
  v_source text := trim(coalesce(p_source, 'manual'));
  v_binding_status text := trim(coalesce(p_binding_status, ''));
  v_revision_created_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not private.has_project_permission(p_project_id, 'mapping.write') then
    raise exception 'Not authorized to update project mapping';
  end if;

  if jsonb_typeof(coalesce(p_mapping_config, '{}'::jsonb)) <> 'object' then
    raise exception 'Mapping config must be a JSON object';
  end if;

  if v_source not in ('auto_detect', 'manual', 'system') then
    raise exception 'Unsupported mapping revision source';
  end if;

  if v_binding_status <> '' and v_binding_status not in ('draft', 'ready', 'invalid', 'archived') then
    raise exception 'Unsupported binding status';
  end if;

  if not exists (
    select 1
    from public.basebuddy_projects as p
    where p.id = p_project_id
      and p.status <> 'archived'
  ) then
    raise exception 'Project not found';
  end if;

  select coalesce(max(pmr.version), 0) + 1
  into v_next_version
  from private.basebuddy_project_content_mapping_revisions as pmr
  where pmr.project_id = p_project_id;

  insert into private.basebuddy_project_content_mapping_revisions (
    project_id,
    binding_status,
    version,
    source,
    mapping_config,
    created_by
  )
  values (
    p_project_id,
    coalesce(nullif(v_binding_status, ''), 'draft'),
    v_next_version,
    v_source,
    coalesce(p_mapping_config, '{}'::jsonb),
    auth.uid()
  )
  returning id, created_at into v_revision_id, v_revision_created_at;

  return query
  select
    p_project_id as binding_id,
    v_revision_id as revision_id,
    v_next_version as revision_version,
    v_source as revision_source,
    coalesce(nullif(v_binding_status, ''), 'draft') as binding_status,
    v_revision_created_at as revision_created_at;
end;
$$;

create or replace function public.get_project_content_sidebar_config(
  p_project_id uuid
)
returns table (
  revision_id uuid,
  revision_version integer,
  revision_source text,
  revision_created_at timestamptz,
  sidebar_config jsonb
)
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not private.has_project_permission(p_project_id, 'project.read') then
    raise exception 'Not authorized to view project sidebar fields';
  end if;

  return query
  select
    revisions.id as revision_id,
    revisions.version as revision_version,
    revisions.source as revision_source,
    revisions.created_at as revision_created_at,
    revisions.sidebar_config
  from private.basebuddy_project_content_sidebar_config_revisions as revisions
  where revisions.project_id = p_project_id
  order by revisions.version desc, revisions.created_at desc
  limit 1;
end;
$$;

create or replace function public.save_project_content_sidebar_config(
  p_project_id uuid,
  p_sidebar_config jsonb default '{}'::jsonb,
  p_source text default 'manual'
)
returns table (
  revision_id uuid,
  revision_version integer,
  revision_source text,
  revision_created_at timestamptz
)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_next_version integer;
  v_normalized_source text := trim(coalesce(p_source, 'manual'));
  v_revision_id uuid;
  v_revision_created_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not private.has_project_permission(p_project_id, 'project.update') then
    raise exception 'Not authorized to update project sidebar fields';
  end if;

  if jsonb_typeof(coalesce(p_sidebar_config, '{}'::jsonb)) <> 'object' then
    raise exception 'Sidebar config must be a JSON object';
  end if;

  if v_normalized_source not in ('manual', 'system') then
    raise exception 'Unsupported sidebar config source';
  end if;

  select coalesce(max(revisions.version), 0) + 1
  into v_next_version
  from private.basebuddy_project_content_sidebar_config_revisions as revisions
  where revisions.project_id = p_project_id;

  insert into private.basebuddy_project_content_sidebar_config_revisions (
    project_id,
    version,
    source,
    sidebar_config,
    created_by
  )
  values (
    p_project_id,
    v_next_version,
    v_normalized_source,
    coalesce(p_sidebar_config, '{}'::jsonb),
    auth.uid()
  )
  returning id, created_at
  into v_revision_id, v_revision_created_at;

  return query
  select
    v_revision_id as revision_id,
    v_next_version as revision_version,
    v_normalized_source as revision_source,
    v_revision_created_at as revision_created_at;
end;
$$;

create or replace function public.get_project_content_runtime_summary(p_project_id uuid)
returns table (
  runtime_signature text,
  summary_counts jsonb,
  is_exact boolean,
  refreshed_at timestamptz
)
language sql
stable
security definer
set search_path = public, private
as $$
  select
    runtime_signature,
    summary_counts,
    is_exact,
    refreshed_at
  from private.basebuddy_project_content_runtime_summaries
  where project_id = p_project_id
    and auth.uid() is not null
    and private.has_project_permission(p_project_id, 'project.read')
  limit 1;
$$;

create or replace function public.save_project_content_runtime_summary(
  p_project_id uuid,
  p_runtime_signature text,
  p_summary_counts jsonb,
  p_is_exact boolean,
  p_refreshed_at timestamptz default timezone('utc', now())
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  insert into private.basebuddy_project_content_runtime_summaries (
    project_id,
    runtime_signature,
    summary_counts,
    is_exact,
    refreshed_at
  )
  values (
    p_project_id,
    p_runtime_signature,
    coalesce(p_summary_counts, '{}'::jsonb),
    coalesce(p_is_exact, true),
    coalesce(p_refreshed_at, timezone('utc', now()))
  )
  on conflict (project_id) do update
    set runtime_signature = excluded.runtime_signature,
        summary_counts = excluded.summary_counts,
        is_exact = excluded.is_exact,
        refreshed_at = excluded.refreshed_at;
end;
$$;

create or replace function private.cleanup_stale_project_post_edit_sessions(
  p_project_id uuid,
  p_stale_after interval default interval '20 seconds'
)
returns void
language sql
security definer
set search_path = public, private
as $$
  delete from public.basebuddy_project_post_edit_sessions
  where project_id = p_project_id
    and last_heartbeat_at < timezone('utc', now()) - p_stale_after;
$$;

create or replace function public.get_project_post_edit_sessions(p_project_id uuid)
returns table (
  post_id text,
  post_title text,
  user_id uuid,
  editor_name text,
  editor_email text,
  avatar_url text,
  last_heartbeat_at timestamptz
)
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not private.has_project_permission(p_project_id, 'project.read') then
    raise exception 'Not authorized to access this project';
  end if;

  perform private.cleanup_stale_project_post_edit_sessions(p_project_id);

  return query
  select
    session.post_id,
    session.post_title,
    session.user_id,
    session.editor_name,
    session.editor_email,
    profiles.avatar_url,
    session.last_heartbeat_at
  from public.basebuddy_project_post_edit_sessions as session
  left join public.basebuddy_profiles as profiles
    on profiles.id = session.user_id
  where session.project_id = p_project_id
  order by session.last_heartbeat_at desc;
end;
$$;

create or replace function public.acquire_project_post_edit_session(
  p_project_id uuid,
  p_post_id text,
  p_post_title text default null,
  p_force boolean default false
)
returns table (
  acquired boolean,
  takeover boolean,
  blocking_post_id text,
  blocking_post_title text,
  blocking_user_id uuid,
  blocking_name text,
  blocking_email text
)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_existing public.basebuddy_project_post_edit_sessions%rowtype;
  v_profile public.basebuddy_profiles%rowtype;
  v_took_over boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not private.has_project_permission(p_project_id, 'project.read') then
    raise exception 'Not authorized to access this project';
  end if;

  if not (
    private.has_project_permission(p_project_id, 'content.write.all')
    or private.has_project_permission(p_project_id, 'content.write.authored')
  ) then
    raise exception 'Not authorized to edit project content';
  end if;

  perform private.cleanup_stale_project_post_edit_sessions(p_project_id);

  select *
  into v_existing
  from public.basebuddy_project_post_edit_sessions
  where project_id = p_project_id
    and post_id = p_post_id
  limit 1;

  if found and v_existing.user_id <> auth.uid() and not p_force then
    return query
    select
      false,
      false,
      v_existing.post_id,
      v_existing.post_title,
      v_existing.user_id,
      v_existing.editor_name,
      v_existing.editor_email;
    return;
  end if;

  if found and v_existing.user_id <> auth.uid() then
    v_took_over := true;
  end if;

  select *
  into v_profile
  from public.basebuddy_profiles
  where id = auth.uid()
  limit 1;

  delete from public.basebuddy_project_post_edit_sessions
  where project_id = p_project_id
    and user_id = auth.uid();

  if v_took_over then
    delete from public.basebuddy_project_post_edit_sessions
    where project_id = p_project_id
      and post_id = p_post_id;
  end if;

  insert into public.basebuddy_project_post_edit_sessions (
    project_id,
    post_id,
    user_id,
    post_title,
    editor_name,
    editor_email,
    last_heartbeat_at
  )
  values (
    p_project_id,
    p_post_id,
    auth.uid(),
    nullif(trim(coalesce(p_post_title, '')), ''),
    nullif(trim(coalesce(v_profile.name, '')), ''),
    nullif(trim(coalesce(v_profile.email, '')), ''),
    timezone('utc', now())
  );

  return query
  select
    true,
    v_took_over,
    case when v_took_over then v_existing.post_id else null end,
    case when v_took_over then v_existing.post_title else null end,
    case when v_took_over then v_existing.user_id else null end,
    case when v_took_over then v_existing.editor_name else null end,
    case when v_took_over then v_existing.editor_email else null end;
end;
$$;

create or replace function public.heartbeat_project_post_edit_session(
  p_project_id uuid,
  p_post_id text,
  p_post_title text default null
)
returns table (
  active boolean,
  blocking_post_id text,
  blocking_post_title text,
  blocking_user_id uuid,
  blocking_name text,
  blocking_email text
)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_existing public.basebuddy_project_post_edit_sessions%rowtype;
  v_profile public.basebuddy_profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not private.has_project_permission(p_project_id, 'project.read') then
    raise exception 'Not authorized to access this project';
  end if;

  perform private.cleanup_stale_project_post_edit_sessions(p_project_id);

  update public.basebuddy_project_post_edit_sessions
  set
    last_heartbeat_at = timezone('utc', now()),
    post_title = coalesce(nullif(trim(coalesce(p_post_title, '')), ''), post_title)
  where project_id = p_project_id
    and post_id = p_post_id
    and user_id = auth.uid();

  if found then
    return query select true, null::text, null::text, null::uuid, null::text, null::text;
    return;
  end if;

  select *
  into v_existing
  from public.basebuddy_project_post_edit_sessions
  where project_id = p_project_id
    and post_id = p_post_id
  limit 1;

  if found then
    return query
    select false, v_existing.post_id, v_existing.post_title, v_existing.user_id, v_existing.editor_name, v_existing.editor_email;
    return;
  end if;

  select *
  into v_profile
  from public.basebuddy_profiles
  where id = auth.uid()
  limit 1;

  delete from public.basebuddy_project_post_edit_sessions
  where project_id = p_project_id
    and user_id = auth.uid();

  insert into public.basebuddy_project_post_edit_sessions (
    project_id,
    post_id,
    user_id,
    post_title,
    editor_name,
    editor_email,
    last_heartbeat_at
  )
  values (
    p_project_id,
    p_post_id,
    auth.uid(),
    nullif(trim(coalesce(p_post_title, '')), ''),
    nullif(trim(coalesce(v_profile.name, '')), ''),
    nullif(trim(coalesce(v_profile.email, '')), ''),
    timezone('utc', now())
  );

  return query select true, null::text, null::text, null::uuid, null::text, null::text;
end;
$$;

create or replace function public.release_project_post_edit_session(
  p_project_id uuid,
  p_post_id text default null
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not private.has_project_permission(p_project_id, 'project.read') then
    raise exception 'Not authorized to access this project';
  end if;

  delete from public.basebuddy_project_post_edit_sessions
  where project_id = p_project_id
    and user_id = auth.uid()
    and (p_post_id is null or post_id = p_post_id);
end;
$$;

create or replace function public.get_project_post_author_assignments(p_project_id uuid)
returns table (
  cms_author_id text,
  user_id uuid,
  name text,
  email text,
  avatar_url text
)
language plpgsql
stable
security definer
set search_path = public, private
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not private.has_project_permission(p_project_id, 'project.read') then
    raise exception 'Not authorized to access this project';
  end if;

  return query
  select
    scopes.cms_author_id,
    scopes.user_id,
    profiles.name,
    profiles.email,
    profiles.avatar_url
  from public.basebuddy_project_member_author_scopes as scopes
  inner join public.basebuddy_project_members as members
    on members.project_id = scopes.project_id
   and members.user_id = scopes.user_id
  left join public.basebuddy_profiles as profiles
    on profiles.id = scopes.user_id
  where scopes.project_id = p_project_id
  order by scopes.cms_author_id asc;
end;
$$;

create or replace function public.create_project_member_invitation(
  p_project_id uuid,
  p_email text,
  p_roles text[],
  p_author_scopes jsonb default '[]'::jsonb,
  p_public_token text default null,
  p_expires_at timestamptz default null
)
returns table (
  invitation_id uuid,
  invited_email text,
  role_keys text[],
  author_scopes jsonb,
  public_token text,
  created_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_invited_email text := trim(coalesce(p_email, ''));
  v_invited_email_normalized text := lower(v_invited_email);
  v_role_keys text[] := private.resolve_project_member_roles(p_roles);
  v_author_scopes jsonb := coalesce(p_author_scopes, '[]'::jsonb);
  v_public_token text := trim(coalesce(p_public_token, ''));
  v_has_author_role boolean := 'author' = any(v_role_keys);
  v_author_scope_count integer := 0;
  v_invitation_id uuid;
  v_created_at timestamptz;
  v_expires_at timestamptz := coalesce(p_expires_at, timezone('utc', now()) + interval '14 days');
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not private.has_project_permission(p_project_id, 'member.invite') then
    raise exception 'Not authorized to invite project members';
  end if;

  perform private.assert_project_member_role_change_allowed(
    p_project_id,
    null,
    v_role_keys,
    false
  );

  if v_invited_email_normalized = '' then
    raise exception 'Email is required.';
  end if;

  if v_public_token = '' then
    raise exception 'Invitation token is required.';
  end if;

  if v_expires_at <= timezone('utc', now()) then
    raise exception 'Invitation expiry must be in the future.';
  end if;

  if jsonb_typeof(v_author_scopes) <> 'array' then
    raise exception 'Author scopes must be an array.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_author_scopes) as scope(value)
    where jsonb_typeof(scope.value) <> 'object'
      or trim(coalesce(scope.value ->> 'cmsAuthorId', '')) = ''
      or (
        scope.value ? 'canPublish'
        and jsonb_typeof(scope.value -> 'canPublish') <> 'boolean'
      )
  ) then
    raise exception 'Each author scope needs a content author ID and valid publish access.';
  end if;

  select count(*)
  into v_author_scope_count
  from (
    select distinct trim(scope.value ->> 'cmsAuthorId') as cms_author_id
    from jsonb_array_elements(v_author_scopes) as scope(value)
    where trim(coalesce(scope.value ->> 'cmsAuthorId', '')) <> ''
  ) as normalized_scopes;

  if v_has_author_role and v_author_scope_count = 0 then
    raise exception 'Select at least one author scope for the author role.';
  end if;

  if not v_has_author_role and v_author_scope_count > 0 then
    raise exception 'Author scopes can only be assigned when the author role is selected.';
  end if;

  if exists (
    select 1
    from public.basebuddy_project_members as pm
    inner join public.basebuddy_profiles as profiles
      on profiles.id = pm.user_id
    where pm.project_id = p_project_id
      and lower(trim(coalesce(profiles.email, ''))) = v_invited_email_normalized
  ) then
    raise exception 'That person is already a member of this project.';
  end if;

  if exists (
    select 1
    from private.basebuddy_project_member_invitations as invitations
    where invitations.project_id = p_project_id
      and invitations.invited_email_normalized = v_invited_email_normalized
      and invitations.accepted_at is null
      and invitations.revoked_at is null
      and invitations.expires_at > timezone('utc', now())
  ) then
    raise exception 'That email already has a pending invitation.';
  end if;

  insert into private.basebuddy_project_member_invitations as invitations (
    project_id,
    invited_email,
    invited_email_normalized,
    role_keys,
    author_scopes,
    public_token,
    invited_by_user_id,
    expires_at
  )
  values (
    p_project_id,
    v_invited_email,
    v_invited_email_normalized,
    v_role_keys,
    v_author_scopes,
    v_public_token,
    auth.uid(),
    v_expires_at
  )
  returning invitations.id, invitations.created_at
  into v_invitation_id, v_created_at;

  return query
  select
    v_invitation_id as invitation_id,
    v_invited_email as invited_email,
    v_role_keys as role_keys,
    v_author_scopes as author_scopes,
    v_public_token as public_token,
    v_created_at as created_at,
    v_expires_at as expires_at;
end;
$$;

create or replace function public.get_project_member_invitations(
  p_project_id uuid,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  invitation_id uuid,
  invited_email text,
  role_keys text[],
  author_scopes jsonb,
  public_token text,
  created_at timestamptz,
  expires_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz
)
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not private.has_project_permission(p_project_id, 'member.invite') then
    raise exception 'Not authorized to read project invitations';
  end if;

  return query
  select
    invitations.id as invitation_id,
    invitations.invited_email,
    invitations.role_keys,
    invitations.author_scopes,
    invitations.public_token,
    invitations.created_at,
    invitations.expires_at,
    invitations.accepted_at,
    invitations.revoked_at
  from private.basebuddy_project_member_invitations as invitations
  where invitations.project_id = p_project_id
  order by invitations.created_at desc, invitations.id desc
  limit greatest(1, least(coalesce(p_limit, 100), 101))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

create or replace function public.get_project_member_invitation_preview(
  p_public_token text
)
returns table (
  project_id uuid,
  project_name text,
  project_slug text,
  invited_email text,
  role_keys text[],
  author_scopes jsonb,
  expires_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz
)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_public_token text := trim(coalesce(p_public_token, ''));
begin
  if v_public_token = '' then
    return;
  end if;

  return query
  select
    invitations.project_id,
    projects.name as project_name,
    projects.slug as project_slug,
    invitations.invited_email,
    invitations.role_keys,
    invitations.author_scopes,
    invitations.expires_at,
    invitations.accepted_at,
    invitations.revoked_at
  from private.basebuddy_project_member_invitations as invitations
  inner join public.basebuddy_projects as projects
    on projects.id = invitations.project_id
  where invitations.public_token = v_public_token
  limit 1;
end;
$$;

create or replace function public.revoke_project_member_invitation(
  p_project_id uuid,
  p_invitation_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_revoked_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not private.has_project_permission(p_project_id, 'member.invite') then
    raise exception 'Not authorized to manage project invitations';
  end if;

  update private.basebuddy_project_member_invitations as invitations
  set
    revoked_at = timezone('utc', now()),
    revoked_by_user_id = auth.uid()
  where invitations.project_id = p_project_id
    and invitations.id = p_invitation_id
    and invitations.accepted_at is null
    and invitations.revoked_at is null
    and invitations.expires_at > timezone('utc', now())
  returning invitations.revoked_at
  into v_revoked_at;

  if v_revoked_at is not null then
    return;
  end if;

  if exists (
    select 1
    from private.basebuddy_project_member_invitations as invitations
    where invitations.project_id = p_project_id
      and invitations.id = p_invitation_id
      and invitations.accepted_at is not null
  ) then
    raise exception 'This invitation has already been accepted.';
  end if;

  if exists (
    select 1
    from private.basebuddy_project_member_invitations as invitations
    where invitations.project_id = p_project_id
      and invitations.id = p_invitation_id
      and invitations.revoked_at is not null
  ) then
    raise exception 'This invitation has already been revoked.';
  end if;

  if exists (
    select 1
    from private.basebuddy_project_member_invitations as invitations
    where invitations.project_id = p_project_id
      and invitations.id = p_invitation_id
      and invitations.expires_at <= timezone('utc', now())
  ) then
    raise exception 'This invitation has already expired.';
  end if;

  raise exception 'Project invitation not found';
end;
$$;

create or replace function public.accept_project_member_invitation(
  p_public_token text
)
returns table (
  project_id uuid,
  project_name text,
  project_slug text,
  membership_status text
)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_public_token text := trim(coalesce(p_public_token, ''));
  v_invitation private.basebuddy_project_member_invitations%rowtype;
  v_project_name text;
  v_project_slug text;
  v_current_email text;
  v_membership_exists boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if v_public_token = '' then
    raise exception 'Invitation token is required.';
  end if;

  select invitations.*
  into v_invitation
  from private.basebuddy_project_member_invitations as invitations
  where invitations.public_token = v_public_token
  limit 1;

  if not found then
    raise exception 'Project invitation not found';
  end if;

  select
    projects.name,
    projects.slug
  into
    v_project_name,
    v_project_slug
  from public.basebuddy_projects as projects
  where projects.id = v_invitation.project_id
  limit 1;

  if v_invitation.accepted_at is not null then
    if v_invitation.accepted_by_user_id = auth.uid() then
      return query
      select
        v_invitation.project_id,
        v_project_name,
        v_project_slug,
        'already_member'::text;
      return;
    end if;

    raise exception 'This invitation has already been accepted.';
  end if;

  if v_invitation.revoked_at is not null then
    raise exception 'This invitation has been revoked.';
  end if;

  if v_invitation.expires_at <= timezone('utc', now()) then
    raise exception 'This invitation has expired.';
  end if;

  select lower(trim(coalesce(profiles.email, '')))
  into v_current_email
  from public.basebuddy_profiles as profiles
  where profiles.id = auth.uid()
  limit 1;

  if coalesce(v_current_email, '') = '' then
    raise exception 'Sign in with the invited email address first.';
  end if;

  if v_current_email <> v_invitation.invited_email_normalized then
    raise exception 'Sign in with the invited email address to accept this invitation.';
  end if;

  select exists (
    select 1
    from public.basebuddy_project_members as pm
    where pm.project_id = v_invitation.project_id
      and pm.user_id = auth.uid()
  )
  into v_membership_exists;

  if v_membership_exists then
    update private.basebuddy_project_member_invitations as invitations
    set
      accepted_at = timezone('utc', now()),
      accepted_by_user_id = auth.uid()
    where invitations.id = v_invitation.id
      and invitations.accepted_at is null;

    return query
    select
      v_invitation.project_id,
      v_project_name,
      v_project_slug,
      'already_member'::text;
    return;
  end if;

  insert into public.basebuddy_project_members (project_id, user_id)
  values (v_invitation.project_id, auth.uid())
  on conflict on constraint basebuddy_project_members_pkey do nothing;

  perform private.apply_project_member_access(
    v_invitation.project_id,
    auth.uid(),
    v_invitation.role_keys,
    v_invitation.author_scopes,
    false
  );

  update private.basebuddy_project_member_invitations as invitations
  set
    accepted_at = timezone('utc', now()),
    accepted_by_user_id = auth.uid()
  where invitations.id = v_invitation.id
    and invitations.accepted_at is null;

  return query
  select
    v_invitation.project_id,
    v_project_name,
    v_project_slug,
    'accepted'::text;
 end;
$$;

create or replace function public.get_basebuddy_control_plane_readiness()
returns jsonb
language sql
stable
security definer
set search_path = public, private
as $$
  with expected_tables(object_name) as (
    values
      ('private.basebuddy_control_plane_schema_versions'),
      ('public.basebuddy_profiles'),
      ('public.basebuddy_projects'),
      ('public.basebuddy_project_members'),
      ('public.basebuddy_project_roles'),
      ('public.basebuddy_project_permissions'),
      ('public.basebuddy_project_role_permissions'),
      ('public.basebuddy_project_member_grants'),
      ('public.basebuddy_project_member_roles'),
      ('public.basebuddy_project_member_author_scopes'),
      ('public.basebuddy_project_post_edit_sessions'),
      ('private.basebuddy_project_content_mapping_revisions'),
      ('private.basebuddy_project_content_sidebar_config_revisions'),
      ('private.basebuddy_project_member_invitations'),
      ('private.basebuddy_project_content_runtime_summaries'),
      ('private.basebuddy_project_content_post_projection_states'),
      ('private.basebuddy_project_content_post_previews')
  ),
  expected_schemas(object_name) as (
    values
      ('private')
  ),
  expected_roles(object_name) as (
    values
      ('owner'),
      ('admin'),
      ('editor'),
      ('author'),
      ('viewer')
  ),
  expected_permissions(object_name) as (
    values
      ('project.read'),
      ('project.update'),
      ('project.delete'),
      ('member.read'),
      ('member.invite'),
      ('member.manage'),
      ('author.scope.manage'),
      ('content.read.all'),
      ('content.read.authored'),
      ('content.write.all'),
      ('content.write.authored'),
      ('content.publish.all'),
      ('content.publish.authored'),
      ('mapping.read'),
      ('mapping.write')
  ),
  expected_rpcs(object_name) as (
    values
      ('public.create_project(text, text)'),
      ('public.get_current_project_member_access(uuid)'),
      ('public.get_project_members(uuid, integer, integer)'),
      ('public.set_project_member_permission_overrides(uuid, uuid, text[], text[])'),
      ('public.get_project_content_mapping(uuid)'),
      ('public.get_project_content_runtime_mapping(uuid)'),
      ('public.save_project_content_mapping_revision(uuid, text, jsonb, text)'),
      ('public.get_project_content_sidebar_config(uuid)'),
      ('public.save_project_content_sidebar_config(uuid, jsonb, text)'),
      ('public.get_project_content_runtime_summary(uuid)'),
      ('public.save_project_content_runtime_summary(uuid, text, jsonb, boolean, timestamptz)'),
      ('public.get_project_post_edit_sessions(uuid)'),
      ('public.acquire_project_post_edit_session(uuid, text, text, boolean)')
  ),
  current_version(version) as (
    select coalesce(
      (
        select schema_versions.version
        from private.basebuddy_control_plane_schema_versions as schema_versions
        where schema_versions.schema_key = 'self_host_baseline'
        limit 1
      ),
      0
    )
  ),
  missing_tables(items) as (
    select coalesce(jsonb_agg(expected_tables.object_name order by expected_tables.object_name), '[]'::jsonb)
    from expected_tables
    where to_regclass(expected_tables.object_name) is null
  ),
  missing_schemas(items) as (
    select coalesce(jsonb_agg(expected_schemas.object_name order by expected_schemas.object_name), '[]'::jsonb)
    from expected_schemas
    where not exists (
      select 1
      from information_schema.schemata
      where schemata.schema_name = expected_schemas.object_name
    )
  ),
  missing_roles(items) as (
    select coalesce(jsonb_agg(expected_roles.object_name order by expected_roles.object_name), '[]'::jsonb)
    from expected_roles
    where not exists (
      select 1
      from public.basebuddy_project_roles as roles
      where roles.role_key = expected_roles.object_name
    )
  ),
  missing_permissions(items) as (
    select coalesce(jsonb_agg(expected_permissions.object_name order by expected_permissions.object_name), '[]'::jsonb)
    from expected_permissions
    where not exists (
      select 1
      from public.basebuddy_project_permissions as permissions
      where permissions.permission_key = expected_permissions.object_name
    )
  ),
  missing_rpcs(items) as (
    select coalesce(jsonb_agg(expected_rpcs.object_name order by expected_rpcs.object_name), '[]'::jsonb)
    from expected_rpcs
    where to_regprocedure(expected_rpcs.object_name) is null
  )
  select jsonb_build_object(
    'schemaKey', 'self_host_baseline',
    'schemaVersion', current_version.version,
    'expectedSchemaVersion', 1,
    'ready',
      current_version.version >= 1
      and jsonb_array_length(missing_schemas.items) = 0
      and jsonb_array_length(missing_tables.items) = 0
      and jsonb_array_length(missing_roles.items) = 0
      and jsonb_array_length(missing_permissions.items) = 0
      and jsonb_array_length(missing_rpcs.items) = 0,
    'missingSchemas', missing_schemas.items,
    'missingTables', missing_tables.items,
    'missingRoles', missing_roles.items,
    'missingPermissions', missing_permissions.items,
    'missingRpcs', missing_rpcs.items
  )
  from current_version, missing_schemas, missing_tables, missing_roles, missing_permissions, missing_rpcs;
$$;

grant select, insert, update on public.basebuddy_profiles to authenticated;
grant select, update, delete on public.basebuddy_projects to authenticated;
grant select, insert, update, delete on public.basebuddy_project_members to authenticated;
grant select on public.basebuddy_project_member_grants to authenticated;
grant select on public.basebuddy_project_roles to authenticated;
grant select on public.basebuddy_project_permissions to authenticated;
grant select on public.basebuddy_project_role_permissions to authenticated;
grant select, insert, update, delete on public.basebuddy_project_member_roles to authenticated;
grant select, insert, update, delete on public.basebuddy_project_member_author_scopes to authenticated;
grant select, insert, update, delete on public.basebuddy_project_post_edit_sessions to authenticated;

alter table public.basebuddy_profiles enable row level security;
alter table private.basebuddy_control_plane_schema_versions enable row level security;
alter table public.basebuddy_projects enable row level security;
alter table public.basebuddy_project_members enable row level security;
alter table public.basebuddy_project_member_grants enable row level security;
alter table public.basebuddy_project_roles enable row level security;
alter table public.basebuddy_project_permissions enable row level security;
alter table public.basebuddy_project_role_permissions enable row level security;
alter table public.basebuddy_project_member_roles enable row level security;
alter table public.basebuddy_project_member_author_scopes enable row level security;
alter table public.basebuddy_project_post_edit_sessions enable row level security;
alter table private.basebuddy_project_content_mapping_revisions enable row level security;
alter table private.basebuddy_project_content_sidebar_config_revisions enable row level security;
alter table private.basebuddy_project_member_invitations enable row level security;
alter table private.basebuddy_project_content_runtime_summaries enable row level security;
alter table private.basebuddy_project_content_post_projection_states enable row level security;
alter table private.basebuddy_project_content_post_previews enable row level security;

drop policy if exists "users can read own profile" on public.basebuddy_profiles;
create policy "users can read own profile"
on public.basebuddy_profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "users can insert own profile" on public.basebuddy_profiles;
create policy "users can insert own profile"
on public.basebuddy_profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "users can update own profile" on public.basebuddy_profiles;
create policy "users can update own profile"
on public.basebuddy_profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "users can read projects with permission" on public.basebuddy_projects;
create policy "users can read projects with permission"
on public.basebuddy_projects
for select
to authenticated
using (private.has_project_permission(id, 'project.read'));

drop policy if exists "users can update projects with permission" on public.basebuddy_projects;
create policy "users can update projects with permission"
on public.basebuddy_projects
for update
to authenticated
using (private.has_project_permission(id, 'project.update'))
with check (private.has_project_permission(id, 'project.update'));

drop policy if exists "users can delete projects with permission" on public.basebuddy_projects;
create policy "users can delete projects with permission"
on public.basebuddy_projects
for delete
to authenticated
using (private.has_project_permission(id, 'project.delete'));

drop policy if exists "users can read visible memberships" on public.basebuddy_project_members;
create policy "users can read visible memberships"
on public.basebuddy_project_members
for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.has_project_permission(project_id, 'member.read')
);

drop policy if exists "users can manage memberships with permission" on public.basebuddy_project_members;
create policy "users can manage memberships with permission"
on public.basebuddy_project_members
for insert
to authenticated
with check (private.has_project_permission(project_id, 'member.manage'));

drop policy if exists "users can update memberships with permission" on public.basebuddy_project_members;
create policy "users can update memberships with permission"
on public.basebuddy_project_members
for update
to authenticated
using (private.has_project_permission(project_id, 'member.manage'))
with check (private.has_project_permission(project_id, 'member.manage'));

drop policy if exists "users can delete memberships with permission" on public.basebuddy_project_members;
create policy "users can delete memberships with permission"
on public.basebuddy_project_members
for delete
to authenticated
using (private.has_project_permission(project_id, 'member.manage'));

drop policy if exists "users can read grants with permission" on public.basebuddy_project_member_grants;
create policy "users can read grants with permission"
on public.basebuddy_project_member_grants
for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.has_project_permission(project_id, 'member.manage')
);

drop policy if exists "authenticated users can read project roles" on public.basebuddy_project_roles;
create policy "authenticated users can read project roles"
on public.basebuddy_project_roles
for select
to authenticated
using (true);

drop policy if exists "authenticated users can read project permissions" on public.basebuddy_project_permissions;
create policy "authenticated users can read project permissions"
on public.basebuddy_project_permissions
for select
to authenticated
using (true);

drop policy if exists "authenticated users can read project role permissions" on public.basebuddy_project_role_permissions;
create policy "authenticated users can read project role permissions"
on public.basebuddy_project_role_permissions
for select
to authenticated
using (true);

drop policy if exists "users can read visible member roles" on public.basebuddy_project_member_roles;
create policy "users can read visible member roles"
on public.basebuddy_project_member_roles
for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.has_project_permission(project_id, 'member.read')
);

drop policy if exists "users can manage member roles with permission" on public.basebuddy_project_member_roles;
create policy "users can manage member roles with permission"
on public.basebuddy_project_member_roles
for insert
to authenticated
with check (private.has_project_permission(project_id, 'member.manage'));

drop policy if exists "users can update member roles with permission" on public.basebuddy_project_member_roles;
create policy "users can update member roles with permission"
on public.basebuddy_project_member_roles
for update
to authenticated
using (private.has_project_permission(project_id, 'member.manage'))
with check (private.has_project_permission(project_id, 'member.manage'));

drop policy if exists "users can delete member roles with permission" on public.basebuddy_project_member_roles;
create policy "users can delete member roles with permission"
on public.basebuddy_project_member_roles
for delete
to authenticated
using (private.has_project_permission(project_id, 'member.manage'));

drop policy if exists "users can read visible author scopes" on public.basebuddy_project_member_author_scopes;
create policy "users can read visible author scopes"
on public.basebuddy_project_member_author_scopes
for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.has_project_permission(project_id, 'member.read')
  or private.has_project_permission(project_id, 'author.scope.manage')
);

drop policy if exists "users can manage author scopes with permission" on public.basebuddy_project_member_author_scopes;
create policy "users can manage author scopes with permission"
on public.basebuddy_project_member_author_scopes
for insert
to authenticated
with check (private.has_project_permission(project_id, 'author.scope.manage'));

drop policy if exists "users can update author scopes with permission" on public.basebuddy_project_member_author_scopes;
create policy "users can update author scopes with permission"
on public.basebuddy_project_member_author_scopes
for update
to authenticated
using (private.has_project_permission(project_id, 'author.scope.manage'))
with check (private.has_project_permission(project_id, 'author.scope.manage'));

drop policy if exists "users can delete author scopes with permission" on public.basebuddy_project_member_author_scopes;
create policy "users can delete author scopes with permission"
on public.basebuddy_project_member_author_scopes
for delete
to authenticated
using (private.has_project_permission(project_id, 'author.scope.manage'));

drop policy if exists "users can read visible post edit sessions" on public.basebuddy_project_post_edit_sessions;
create policy "users can read visible post edit sessions"
on public.basebuddy_project_post_edit_sessions
for select
to authenticated
using (private.has_project_permission(project_id, 'project.read'));

drop policy if exists "users can insert their own post edit sessions" on public.basebuddy_project_post_edit_sessions;
create policy "users can insert their own post edit sessions"
on public.basebuddy_project_post_edit_sessions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and private.has_project_permission(project_id, 'project.read')
);

drop policy if exists "users can update their own post edit sessions" on public.basebuddy_project_post_edit_sessions;
create policy "users can update their own post edit sessions"
on public.basebuddy_project_post_edit_sessions
for update
to authenticated
using (
  user_id = auth.uid()
  and private.has_project_permission(project_id, 'project.read')
)
with check (
  user_id = auth.uid()
  and private.has_project_permission(project_id, 'project.read')
);

drop policy if exists "users can delete their own post edit sessions" on public.basebuddy_project_post_edit_sessions;
create policy "users can delete their own post edit sessions"
on public.basebuddy_project_post_edit_sessions
for delete
to authenticated
using (
  user_id = auth.uid()
  and private.has_project_permission(project_id, 'project.read')
);

revoke all on function private.role_has_permission(text, text) from public;
revoke all on function private.is_project_member(uuid) from public;
revoke all on function private.current_project_roles(uuid) from public;
revoke all on function private.current_project_role(uuid) from public;
revoke all on function private.project_member_has_permission(uuid, uuid, text) from public;
revoke all on function private.has_project_permission(uuid, text) from public;
revoke all on function private.project_member_is_owner(uuid, uuid) from public;
revoke all on function private.has_project_author_permission(uuid, text, text) from public;
revoke all on function private.resolve_project_member_roles(text[]) from public;
revoke all on function private.assert_project_member_role_change_allowed(uuid, uuid, text[], boolean) from public;
revoke all on function private.assert_project_member_permission_overrides_allowed(uuid, uuid, text[], text[]) from public;
revoke all on function private.apply_project_member_access(uuid, uuid, text[], jsonb, boolean) from public;
revoke all on function private.sync_project_member_access(uuid, uuid, text[], jsonb) from public;
revoke all on function private.cleanup_stale_project_post_edit_sessions(uuid, interval) from public;

revoke all on function public.is_project_slug_available(text) from public;
revoke all on function public.create_project(text, text) from public;
revoke all on function public.update_project_metadata(uuid, text, text, text) from public;
revoke all on function public.delete_project_for_current_user(uuid) from public;
revoke all on function public.get_current_project_member_access(uuid) from public;
revoke all on function public.get_project_members(uuid, integer, integer) from public;
revoke all on function public.add_project_member_by_email(uuid, text, text[], jsonb) from public;
revoke all on function public.update_project_member_access(uuid, uuid, text[], jsonb) from public;
revoke all on function public.remove_project_member(uuid, uuid) from public;
revoke all on function public.set_project_member_permission_overrides(uuid, uuid, text[], text[]) from public;
revoke all on function public.get_project_author_members(uuid) from public;
revoke all on function public.get_project_author_assignments(uuid) from public;
revoke all on function public.set_project_author_assignment(uuid, text, uuid, boolean) from public;
revoke all on function public.get_project_content_mapping(uuid) from public;
revoke all on function public.get_project_content_runtime_mapping(uuid) from public;
revoke all on function public.save_project_content_mapping_revision(uuid, text, jsonb, text) from public;
revoke all on function public.get_project_content_sidebar_config(uuid) from public;
revoke all on function public.save_project_content_sidebar_config(uuid, jsonb, text) from public;
revoke all on function public.get_project_content_runtime_summary(uuid) from public;
revoke all on function public.get_project_content_runtime_summary(uuid) from authenticated;
revoke all on function public.save_project_content_runtime_summary(uuid, text, jsonb, boolean, timestamptz) from public;
revoke all on function public.save_project_content_runtime_summary(uuid, text, jsonb, boolean, timestamptz) from authenticated;
revoke all on function public.get_project_post_edit_sessions(uuid) from public;
revoke all on function public.acquire_project_post_edit_session(uuid, text, text, boolean) from public;
revoke all on function public.heartbeat_project_post_edit_session(uuid, text, text) from public;
revoke all on function public.release_project_post_edit_session(uuid, text) from public;
revoke all on function public.get_project_post_author_assignments(uuid) from public;
revoke all on function public.create_project_member_invitation(uuid, text, text[], jsonb, text, timestamptz) from public;
revoke all on function public.get_project_member_invitations(uuid, integer, integer) from public;
revoke all on function public.get_project_member_invitation_preview(text) from public;
revoke all on function public.revoke_project_member_invitation(uuid, uuid) from public;
revoke all on function public.accept_project_member_invitation(text) from public;
revoke all on function public.get_basebuddy_control_plane_readiness() from public;
revoke all on function public.get_basebuddy_control_plane_readiness() from authenticated;

grant execute on function private.role_has_permission(text, text) to authenticated;
grant execute on function private.is_project_member(uuid) to authenticated;
grant execute on function private.current_project_roles(uuid) to authenticated;
grant execute on function private.current_project_role(uuid) to authenticated;
grant execute on function private.project_member_has_permission(uuid, uuid, text) to authenticated;
grant execute on function private.has_project_permission(uuid, text) to authenticated;
grant execute on function private.has_project_author_permission(uuid, text, text) to authenticated;
grant execute on function public.is_project_slug_available(text) to authenticated;
grant execute on function public.create_project(text, text) to authenticated;
grant execute on function public.update_project_metadata(uuid, text, text, text) to authenticated;
grant execute on function public.delete_project_for_current_user(uuid) to authenticated;
grant execute on function public.get_current_project_member_access(uuid) to authenticated;
grant execute on function public.get_project_members(uuid, integer, integer) to authenticated;
grant execute on function public.add_project_member_by_email(uuid, text, text[], jsonb) to authenticated;
grant execute on function public.update_project_member_access(uuid, uuid, text[], jsonb) to authenticated;
grant execute on function public.remove_project_member(uuid, uuid) to authenticated;
grant execute on function public.set_project_member_permission_overrides(uuid, uuid, text[], text[]) to authenticated;
grant execute on function public.get_project_author_members(uuid) to authenticated;
grant execute on function public.get_project_author_assignments(uuid) to authenticated;
grant execute on function public.set_project_author_assignment(uuid, text, uuid, boolean) to authenticated;
grant execute on function public.get_project_content_mapping(uuid) to authenticated;
grant execute on function public.get_project_content_runtime_mapping(uuid) to service_role;
grant execute on function public.save_project_content_mapping_revision(uuid, text, jsonb, text) to authenticated;
grant execute on function public.get_project_content_sidebar_config(uuid) to authenticated;
grant execute on function public.save_project_content_sidebar_config(uuid, jsonb, text) to authenticated;
grant execute on function public.get_project_content_runtime_summary(uuid) to authenticated;
grant execute on function public.save_project_content_runtime_summary(uuid, text, jsonb, boolean, timestamptz) to service_role;
grant execute on function public.get_project_post_edit_sessions(uuid) to authenticated;
grant execute on function public.acquire_project_post_edit_session(uuid, text, text, boolean) to authenticated;
grant execute on function public.heartbeat_project_post_edit_session(uuid, text, text) to authenticated;
grant execute on function public.release_project_post_edit_session(uuid, text) to authenticated;
grant execute on function public.get_project_post_author_assignments(uuid) to authenticated;
grant execute on function public.create_project_member_invitation(uuid, text, text[], jsonb, text, timestamptz) to authenticated;
grant execute on function public.get_project_member_invitations(uuid, integer, integer) to authenticated;
grant execute on function public.get_project_member_invitation_preview(text) to anon;
grant execute on function public.get_project_member_invitation_preview(text) to authenticated;
grant execute on function public.revoke_project_member_invitation(uuid, uuid) to authenticated;
grant execute on function public.accept_project_member_invitation(text) to authenticated;
grant execute on function public.get_basebuddy_control_plane_readiness() to service_role;
