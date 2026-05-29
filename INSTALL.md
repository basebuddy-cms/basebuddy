# BaseBuddy Install Guide

BaseBuddy is a self-hosted editor for existing Postgres/Supabase schemas. Fresh installs store BaseBuddy app state in one local data folder:

```text
process.cwd()/basebuddy-data/basebuddy.config.json
```

The setup UI and CLI create that folder and file for you. Do not commit `basebuddy-data/`.

## Prerequisites

- Node.js 22 recommended.
- `pnpm@10.32.1`.
- A Postgres/Supabase database that already contains the content tables you want to edit.
- Optional Supabase Storage or S3-compatible credentials when mapped media or files need private object storage.

## 1. Clone And Install

```sh
git clone git@github.com:basebuddy-cms/basebuddy.git
cd basebuddy
pnpm install
```

Start the app:

```sh
pnpm dev
```

The dev server runs on port `8080`.

Open setup:

```text
http://localhost:8080/onboarding
```

## 2. Connect To The Database

Create `.env` for local testing, or set the same values in production:

```sh
BASEBUDDY_AUTH_SECRET=
BASEBUDDY_CONTENT_DATABASE_URL=
```

Only needed if you want images or files in BaseBuddy:

```sh
# For Supabase media bucket storage.
BASEBUDDY_SUPABASE_URL=https://your-project-ref.supabase.co
BASEBUDDY_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
BASEBUDDY_SUPABASE_SECRET_KEY=your-server-key

# For S3 bucket storage.
BASEBUDDY_S3_ACCESS_KEY_ID=your-s3-access-key
BASEBUDDY_S3_SECRET_ACCESS_KEY=your-s3-secret-key
```

For local Supabase content databases, add `?sslmode=disable` to the database URL. For hosted Supabase, prefer the direct database connection when your host supports IPv6; otherwise use the Supabase Session Pooler connection string.

## 3. Create The Owner Account

On `/onboarding`, complete **Connect to the database**, then enter:

- owner name
- owner email
- owner password

Click `Create setup`. BaseBuddy writes `basebuddy-data/basebuddy.config.json` and hashes the owner password. It does not write database URLs or service keys into the config file.

The next screen runs setup checks automatically. It verifies the env values, owner account, config-file state, and database connection before showing **Open BaseBuddy**.

BaseBuddy also writes sign-in and local user audit events to `basebuddy-data/basebuddy.audit.jsonl`. Do not commit `basebuddy-data/`.

## 4. Sign In

After setup is created:

1. Open `/login`.
2. Sign in with the owner email and password.
3. Open `/projects`.

## CLI Setup

Agents or operators can create the same BaseBuddy data config from the CLI:

```sh
pnpm basebuddy setup \
  --owner-email "owner@example.com" \
  --owner-name "Owner User" \
  --owner-password "replace-with-a-strong-password"
```

Check setup:

```sh
pnpm basebuddy doctor
pnpm setup:check
```

All CLI diagnostics redact secrets.

The CLI can also create projects, add members, create invites, adjust permission overrides, save mapping/sidebar JSON, and update non-secret storage mapping metadata. See [CLI](./docs/cli.md).

## 5. Create The First Project

1. Open `/projects`.
2. Create a project with a name and slug.
3. Open the project editor.
4. Use auto-detection if it helps, or choose manual mapping.
5. Map posts, authors, categories, tags, workflow fields, media, and files as needed.
6. Save the mapping.

The saved mapping is the runtime source of truth.

## 6. Edit Content

After mapping:

1. Open the mapped Posts collection.
2. Select or create a post.
3. Edit mapped fields.
4. Use `Save` for dirty-field writes.
5. Use `Publish`, `Unpublish`, or `Archive` only when you intend a workflow action.

BaseBuddy does not rename, reshape, or migrate your content tables during normal setup or editing.

## Production

Build and start:

```sh
pnpm build
pnpm start
```

`pnpm start` serves the app on port `8080`.

Before exposing BaseBuddy publicly:

- run `pnpm basebuddy doctor`;
- confirm required secrets are set in env, not in the repo;
- confirm `basebuddy-data/basebuddy.config.json` is present on the server and `basebuddy-data/` is ignored by git;
- confirm the server has persistent writable storage for `basebuddy-data/`;
- place the app behind HTTPS;
- set request body limits that match your upload policy;
- use a shared upstream rate limiter if you run multiple app instances.

Production responses include HSTS. Confirm HTTPS is working for the final domain before exposing the app to real users.

BaseBuddy is not currently designed for editable Vercel/Netlify-style serverless deploys unless you provide durable writable storage for `basebuddy-data/`. UI changes to projects, mappings, permissions, and sidebar layout write to `basebuddy-data/basebuddy.config.json` on the running server.

## Next Steps

- [Configuration](./docs/configuration.md)
- [Onboarding](./docs/onboarding.md)
- [Deployment](./docs/deployment.md)
- [Troubleshooting](./docs/troubleshooting.md)
