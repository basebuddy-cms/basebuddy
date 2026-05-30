-- Recommended production pattern for the database BaseBuddy edits.
-- Run as a database owner, then use the generated role in BASEBUDDY_CONTENT_DATABASE_URL.

create role basebuddy_editor login password 'replace-with-a-strong-password';

grant usage on schema public to basebuddy_editor;

-- Repeat grants for each table BaseBuddy should read or edit.
grant select on table public.posts to basebuddy_editor;
grant insert, update, delete on table public.posts to basebuddy_editor;

-- Prefer column-level update grants when editors should change only selected fields.
revoke update on table public.posts from basebuddy_editor;
grant update (title, slug, content, status, published_at, updated_at) on table public.posts to basebuddy_editor;

-- Add related tables only when the mapping needs them.
grant select on table public.authors to basebuddy_editor;
grant select on table public.categories to basebuddy_editor;
grant select on table public.tags to basebuddy_editor;
