# Architecture

BaseBuddy is a self-hosted editor for existing Postgres/Supabase schemas.

## App State

BaseBuddy app state lives in one selected install-wide backend.

```text
process.cwd()/basebuddy-data/basebuddy.config.json
```

That local file backend is the default. Onboarding and CLI can also store the same validated app-data shape in Supabase/Postgres:

- `BASEBUDDY_APP_STATE_BACKEND=supabase-same-project` stores app data in the same database as your content, inside BaseBuddy-owned `basebuddy` tables.
- `BASEBUDDY_APP_STATE_BACKEND=supabase-split-project` stores app data in a separate database from `BASEBUDDY_APP_STATE_DATABASE_URL`.

App data stores users, sessions, projects, members, permissions, invitations, saved mappings, and sidebar settings. Auth signing, content database access, and optional storage credentials come from environment variables.

## Content Runtime

Content reads and writes go through the mapped runtime under `src/lib/content-runtime`. The saved mapping is the runtime truth.

## Setup

`/onboarding`, `/api/setup`, `scripts/check-self-host-setup.ts`, and `scripts/basebuddy-cli.ts` all use the same app-data store.

## User Schemas

BaseBuddy normal setup never renames, reshapes, or migrates user content tables.
