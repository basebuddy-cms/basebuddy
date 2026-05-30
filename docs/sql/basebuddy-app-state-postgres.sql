-- Optional: store BaseBuddy app data in Postgres/Supabase instead of basebuddy-data/.
-- BaseBuddy creates this automatically when the app-state database user can create schemas.

create schema if not exists basebuddy;

create table if not exists basebuddy.app_state (
  id text primary key,
  config jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists basebuddy.audit_events (
  id text primary key,
  event jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);
