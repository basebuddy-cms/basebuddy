# CLI

Run BaseBuddy CLI commands from the app root. The CLI reads and writes the selected BaseBuddy app-data backend.

By default that is:

```text
process.cwd()/basebuddy-data/basebuddy.config.json
```

If `BASEBUDDY_APP_STATE_BACKEND` is `supabase-same-project` or `supabase-split-project`, the same CLI commands read and write `basebuddy.app_state` in Postgres/Supabase instead.

Use CLI commands instead of hand-editing files or database rows. Env secrets still belong in `.env` or the production host.

Use [App Data Storage Options](./app-data-storage-options.md) before deciding which backend the CLI should write to.

## Setup

```sh
pnpm basebuddy agent:setup --json
pnpm basebuddy doctor
pnpm basebuddy doctor --json
pnpm basebuddy doctor --skip-db-check
pnpm basebuddy setup
pnpm basebuddy setup --owner-email owner@example.com --owner-name "Owner" --owner-password "strong-password"
pnpm setup:check
```

App-data backend env:

```sh
# Default: leave blank for basebuddy-data/
BASEBUDDY_APP_STATE_BACKEND=

# Use only with supabase-split-project.
BASEBUDDY_APP_STATE_DATABASE_URL=
```

`doctor` also reports broad database roles such as `postgres`. Use a restricted role for production so BaseBuddy can only read and edit the tables and columns you grant.

## Supabase/Postgres App Data Tables

These commands are only needed when `BASEBUDDY_APP_STATE_BACKEND` is `supabase-same-project` or `supabase-split-project`.

```sh
pnpm basebuddy app-data:sql
pnpm basebuddy app-data:migrate
pnpm basebuddy app-data:check
```

`app-data:migrate` creates only the BaseBuddy-owned `basebuddy.app_state` and `basebuddy.audit_events` tables. It does not touch user content tables.

Use `app-data:sql` when the BaseBuddy runtime database role cannot create schemas or tables. Copy the printed SQL into the database SQL editor with an admin role, then run `app-data:check`.

## Users

```sh
pnpm basebuddy users:list --json
pnpm basebuddy user:create --email editor@example.com --name "Editor" --password "strong-password"
pnpm basebuddy users:delete --email editor@example.com
```

User deletion is blocked when the user is the last owner of a project.

## Projects, Members, And Invites

```sh
pnpm basebuddy projects:list --actor-email owner@example.com --json
pnpm basebuddy projects:create --actor-email owner@example.com --name "Docs" --slug docs
pnpm basebuddy projects:update --project docs --name "Docs Hub" --slug docs-hub
pnpm basebuddy projects:delete --project docs

pnpm basebuddy members:list --project docs --actor-email owner@example.com --json
pnpm basebuddy members:add --project docs --actor-email owner@example.com --email editor@example.com --roles editor
pnpm basebuddy members:update --project docs --actor-email owner@example.com --user-email editor@example.com --roles editor,author --author-scopes author_123:true
pnpm basebuddy members:remove --project docs --actor-email owner@example.com --user-email editor@example.com

pnpm basebuddy invites:list --project docs --actor-email owner@example.com --json
pnpm basebuddy invites:create --project docs --actor-email owner@example.com --email viewer@example.com --roles viewer --json
pnpm basebuddy invites:revoke --project docs --actor-email owner@example.com --invitation-id invitation_id
```

## Permissions

```sh
pnpm basebuddy permissions:get --project docs --actor-email owner@example.com --json
pnpm basebuddy permissions:set --project docs --actor-email owner@example.com --user-email editor@example.com --allow mapping.write --deny project.delete
```

## Mapping, Sidebar, And Storage

```sh
pnpm basebuddy schema:inspect --schema public --json
pnpm basebuddy schema:inspect --schema public --table posts,authors,categories --json

pnpm basebuddy mapping:draft --schema public --table posts --json
pnpm basebuddy mapping:draft --schema public --table pages --hints mapping-hints.json --json
pnpm basebuddy mapping:explain --input mapping.json --json
pnpm basebuddy mapping:get --project docs --json
pnpm basebuddy mapping:validate --input mapping.json --json
pnpm basebuddy mapping:set --project docs --input mapping.json --binding-status ready --json

pnpm basebuddy sidebar:get --project docs --json
pnpm basebuddy sidebar:set --project docs --input sidebar.json --json
pnpm basebuddy sidebar:reset --project docs --json

pnpm basebuddy storage:status --json
pnpm basebuddy storage:get --project docs --library media --json
pnpm basebuddy storage:set --project docs --library media --provider supabase_bucket --bucket media
```

Storage commands save mapping metadata only. Supabase and S3 secrets stay in env.

## Agent Workflow

Agents should start with:

```sh
pnpm basebuddy agent:setup --json
```

Then use `schema:inspect`, `mapping:draft`, `mapping:explain`, and `mapping:set` instead of reading BaseBuddy source code to guess mapping JSON.

## Not Supported By CLI

The CLI does not edit content rows, upload files, delete storage objects, publish/unpublish/archive content, or manage deployment env values.
