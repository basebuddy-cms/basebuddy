# Configuration

BaseBuddy app state lives in one root config file:

```text
process.cwd()/basebuddy.config.json
```

Onboarding and CLI setup create and update this file. It stores install metadata, local users, sessions, projects, members, permissions, invitations, saved mappings, and sidebar settings.

Do not commit `basebuddy.config.json`.

Audit events live beside it in:

```text
process.cwd()/basebuddy.audit.jsonl
```

Do not commit the audit log. It records sign-in, sign-out, and local user changes.

## Required Env

Credentials and signing secrets belong in `.env` or deployment environment variables:

```sh
BASEBUDDY_AUTH_SECRET=
BASEBUDDY_CONTENT_DATABASE_URL=
```

Only needed if you want images or files in BaseBuddy:

```sh
# For Supabase media bucket storage.
BASEBUDDY_SUPABASE_URL=
BASEBUDDY_SUPABASE_PUBLISHABLE_KEY=
BASEBUDDY_SUPABASE_SECRET_KEY=

# For S3 bucket storage.
BASEBUDDY_S3_ACCESS_KEY_ID=
BASEBUDDY_S3_SECRET_ACCESS_KEY=
```

## Public Env

Optional public env values:

```sh
NEXT_PUBLIC_BASEBUDDY_APP_NAME=BaseBuddy
NEXT_PUBLIC_BASEBUDDY_DOCS_URL=https://basebuddycms.com/docs
NEXT_PUBLIC_BASEBUDDY_SUPPORT_URL=https://basebuddycms.com/support
NEXT_PUBLIC_SITE_INDEXABLE=false
```

## Content And Storage

The database URL and optional Supabase/S3 storage credentials are env values. They are install settings, not per-project rows or mapping rows.

BaseBuddy never changes the user content schema during normal setup.
