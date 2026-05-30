# Operations

Back up the selected BaseBuddy app-data backend with care because it contains users, session hashes, projects, permissions, mappings, sidebar layout, audit logs, and local account password hashes. Service keys, database URLs, and storage access keys should live in env and must be backed up through your deployment secret manager.

## Before Upgrading

1. Stop background jobs if you have any.
2. Back up BaseBuddy app data:
   - default install: `basebuddy-data/`;
   - Supabase/Postgres app-data install: the `basebuddy` schema tables.
3. Confirm deployment env values are backed up separately.
4. Back up the content database separately.
5. Deploy the new code.
6. Run `pnpm setup:check` and `pnpm basebuddy doctor`.

## After Changes

Run diagnostics after deployment, config edits, password rotation, storage credential changes, and BaseBuddy upgrades.

With the default `basebuddy-data` backend, editable installs need persistent writable storage for `basebuddy-data/basebuddy.config.json` and `basebuddy-data/basebuddy.audit.jsonl`. If the app may restart often, run on multiple servers, or use an immutable host, use the Supabase/Postgres app-data backend instead.

## Rollback

Restore the previous code and the matching app-data backup together. Restore the content database only if content rows were changed and need rollback.
