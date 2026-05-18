drop function if exists public.get_project_post_edit_sessions(uuid);
drop function if exists public.acquire_project_post_edit_session(uuid, uuid, text, boolean);
drop function if exists public.acquire_project_post_edit_session(uuid, text, text, boolean);
drop function if exists public.heartbeat_project_post_edit_session(uuid, uuid, text);
drop function if exists public.heartbeat_project_post_edit_session(uuid, text, text);
drop function if exists public.release_project_post_edit_session(uuid, uuid);
drop function if exists public.release_project_post_edit_session(uuid, text);

alter table if exists public.basebuddy_project_post_edit_sessions
  alter column post_id type text using post_id::text;

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
      ('public.acquire_project_post_edit_session(uuid, text, text, boolean)'),
      ('public.heartbeat_project_post_edit_session(uuid, text, text)'),
      ('public.release_project_post_edit_session(uuid, text)')
  ),
  expected_columns(table_name, column_name, udt_name) as (
    values
      ('basebuddy_project_post_edit_sessions', 'post_id', 'text')
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
  ),
  mismatched_columns(items) as (
    select coalesce(
      jsonb_agg(format('%s.%s expected %s', expected_columns.table_name, expected_columns.column_name, expected_columns.udt_name) order by expected_columns.table_name, expected_columns.column_name),
      '[]'::jsonb
    )
    from expected_columns
    where not exists (
      select 1
      from information_schema.columns
      where columns.table_schema = 'public'
        and columns.table_name = expected_columns.table_name
        and columns.column_name = expected_columns.column_name
        and columns.udt_name = expected_columns.udt_name
    )
  )
  select jsonb_build_object(
    'schemaKey', 'self_host_baseline',
    'schemaVersion', current_version.version,
    'expectedSchemaVersion', 2,
    'ready',
      current_version.version >= 2
      and jsonb_array_length(missing_schemas.items) = 0
      and jsonb_array_length(missing_tables.items) = 0
      and jsonb_array_length(missing_roles.items) = 0
      and jsonb_array_length(missing_permissions.items) = 0
      and jsonb_array_length(missing_rpcs.items) = 0
      and jsonb_array_length(mismatched_columns.items) = 0,
    'missingSchemas', missing_schemas.items,
    'missingTables', missing_tables.items,
    'missingRoles', missing_roles.items,
    'missingPermissions', missing_permissions.items,
    'missingRpcs', missing_rpcs.items,
    'mismatchedColumns', mismatched_columns.items
  )
  from current_version, missing_schemas, missing_tables, missing_roles, missing_permissions, missing_rpcs, mismatched_columns;
$$;

grant execute on function public.get_project_post_edit_sessions(uuid) to authenticated;
grant execute on function public.acquire_project_post_edit_session(uuid, text, text, boolean) to authenticated;
grant execute on function public.heartbeat_project_post_edit_session(uuid, text, text) to authenticated;
grant execute on function public.release_project_post_edit_session(uuid, text) to authenticated;
grant execute on function public.get_basebuddy_control_plane_readiness() to authenticated;

insert into private.basebuddy_control_plane_schema_versions (schema_key, version)
values ('self_host_baseline', 2)
on conflict (schema_key) do update
set
  version = greatest(private.basebuddy_control_plane_schema_versions.version, excluded.version),
  updated_at = timezone('utc', now());
