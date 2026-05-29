# Operations

Back up `basebuddy-data/` with care because it contains app state, audit logs, and local account password hashes. Service keys, database URLs, and storage access keys should live in env and must be backed up through your deployment secret manager.

## Before Upgrading

1. Stop background jobs if you have any.
2. Back up `basebuddy-data/`.
3. Confirm deployment env values are backed up separately.
4. Back up the content database separately.
5. Deploy the new code.
6. Run `pnpm setup:check` and `pnpm basebuddy doctor`.

## After Changes

Run diagnostics after deployment, config edits, password rotation, storage credential changes, and BaseBuddy upgrades.

Current editable installs need a persistent writable filesystem for `basebuddy-data/basebuddy.config.json` and `basebuddy-data/basebuddy.audit.jsonl`. Immutable serverless hosts such as Vercel or Netlify are not supported for production editing unless `basebuddy-data/` is backed by durable writable storage.

## Rollback

Restore the previous code and the matching `basebuddy-data/` backup together.
