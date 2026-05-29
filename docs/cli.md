# CLI

Run BaseBuddy CLI commands from the app root. The CLI reads and writes:

```text
process.cwd()/basebuddy-data/basebuddy.config.json
```

Use CLI commands instead of hand-editing the config file. Env secrets still belong in `.env` or the production host.

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
