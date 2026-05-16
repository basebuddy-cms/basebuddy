# Troubleshooting

Start with:

```sh
pnpm setup:check
```

If the app boots, also open:

```text
http://localhost:8080/onboarding?diagnostics=1
```

## Setup Page Shows Missing Env

Update `.env`, then restart the app. Next.js reads env at process start.

## Env Shape Is Mixed

Use either same-project env names or split-project env names, not both.

Same-project:

```text
BASEBUDDY_SUPABASE_*
BASEBUDDY_DATABASE_URL
```

Split-project:

```text
BASEBUDDY_CONTROL_*
BASEBUDDY_CONTENT_*
```

## Control-Plane Schema Fails

Reapply:

```sh
psql "$BASEBUDDY_CONTROL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20260420130000_basebuddy_self_host_baseline.sql
```

For same-project installs, use `BASEBUDDY_DATABASE_URL`.

## Local Supabase Database Connection Fails

Add `?sslmode=disable` to local database URLs.

## Auth Redirect Fails

Check Supabase Auth settings:

- Site URL is the deployed app URL.
- Redirect URLs include `/auth/callback`.
- Invite URLs include `/invite/*`.
- Enabled providers match `BASEBUDDY_AUTH_PROVIDERS`.

## Content Reads Fail

Check:

- content database URL;
- network access from the app host;
- mapped table/schema names;
- database permissions for select/update/insert/delete as needed;
- saved mapping status.

## Field Is Read-Only Or Unsupported

This usually means BaseBuddy cannot safely write the mapped shape. Check whether the field is:

- generated;
- view-derived;
- trigger-managed;
- missing a required relation contract;
- an unsafe polymorphic relation;
- an unsupported system/exotic type.

## Uploads Fail

Check:

- file type and size;
- batch count;
- request body limit at your proxy/host;
- mapped bucket name;
- S3-compatible credential pair completeness;
- project access permissions.

## Rate Limited

Wait for the `Retry-After` period. If this happens often in production, add or adjust a host-level shared rate limit.

## Safe Support Information

Share:

- BaseBuddy commit or release;
- topology: same-project or split-project;
- redacted `pnpm setup:check` output;
- route or page where the issue happens;
- safe server log excerpt;
- steps to reproduce.

Do not share secrets, service-role keys, database passwords, session cookies, S3 secrets, certificates, or private content data.
