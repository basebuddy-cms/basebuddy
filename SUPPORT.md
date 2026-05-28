# Support

BaseBuddy is an open self-hosted project. This file explains where to start when something does not work and what information is useful when asking for help.

## Before Opening An Issue

Run the setup checker:

```sh
pnpm setup:check
```

If the app can boot, also open:

```text
http://localhost:8080/onboarding?diagnostics=1
```

The diagnostics view redacts secrets and is safe to summarize in an issue. Do not share database passwords, service-role keys, S3 secrets, certificates, private content data, or session cookies.

## Useful Issue Template

```text
BaseBuddy version or commit:
Deployment target:
Node version:
pnpm version:
Deployment target and writable config path:
Supabase/Postgres version if known:
Output from pnpm setup:check with secrets redacted:
What you expected:
What happened:
Steps to reproduce:
Relevant server log excerpt with secrets removed:
```

## Common First Checks

- Confirm `.env` includes `BASEBUDDY_AUTH_SECRET` and `BASEBUDDY_CONTENT_DATABASE_URL`.
- Restart the app after changing `.env`.
- Confirm `basebuddy.config.json` exists in the app root and is writable by the app process.
- Confirm the database URL can read and write the mapped schema.
- Confirm S3-compatible credentials are complete pairs when private media/files are mapped.
- Confirm the app is behind HTTPS and a proxy/WAF when exposed publicly.

## Security Reports

Please do not open public issues for vulnerabilities or secrets. Follow [SECURITY.md](./SECURITY.md).

Include enough detail to reproduce the issue, but do not include live credentials, private content, or access tokens.

## Community Support Scope

Community support can usually help with:

- setup and onboarding issues;
- local password sign-in and invite return paths;
- setup, config file, and database connection errors;
- mapping questions;
- storage and upload configuration;
- reproducible product bugs.

Community support is not a substitute for production database administration, schema design consulting, custom feature development, or managed hosting.
