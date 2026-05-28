# Architecture

BaseBuddy is a self-hosted editor for existing Postgres/Supabase schemas.

## App State

BaseBuddy app state lives in:

```text
process.cwd()/basebuddy.config.json
```

The config file stores users, sessions, projects, members, permissions, invitations, saved mappings, and sidebar settings. Auth signing, content database access, and optional storage credentials come from environment variables.

## Content Runtime

Content reads and writes go through the mapped runtime under `src/lib/content-runtime`. The saved mapping is the runtime truth.

## Setup

`/onboarding`, `/api/setup`, `scripts/check-self-host-setup.ts`, and `scripts/basebuddy-cli.ts` all use the same config store.

## User Schemas

BaseBuddy normal setup never renames, reshapes, or migrates user content tables.
