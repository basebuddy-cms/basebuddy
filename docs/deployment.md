# Deployment

Production deployment must preserve the selected BaseBuddy app-data backend between restarts.

## Checklist

- Build with Node.js 22 and `pnpm`.
- Use `basebuddy-data/` for simple single-server installs, or set `BASEBUDDY_APP_STATE_BACKEND=supabase-same-project` / `supabase-split-project` for DB-backed app data.
- If you use `basebuddy-data/`, mount or persist it so setup survives deploys.
- Keep `basebuddy-data/` and app-data exports out of git and public logs.
- Configure HTTPS and trusted proxy headers in your host.
- Use a restricted database role for `BASEBUDDY_CONTENT_DATABASE_URL`.
- Use TLS verification for hosted Supabase/Postgres. Do not use `sslmode=no-verify`.
- Run onboarding or CLI setup once.
- Run `pnpm setup:check` and `pnpm basebuddy doctor`.

With the default `basebuddy-data` backend, BaseBuddy needs a persistent writable filesystem. Editable deployments on Vercel, Netlify, or similar immutable serverless hosts are not supported with that default backend because UI changes to mappings, permissions, projects, and sidebar layout must be written back to app data. Use a Supabase/Postgres app-data backend when the host can restart or scale the app across instances.

Use [App Data Storage Options](./app-data-storage-options.md) to choose the right backend for your host before deploying.

## Runtime

Use:

```sh
pnpm build
pnpm start
```

After deployment, sign in, open `/projects`, and verify a mapped content read.

## Related

- [Configuration](./configuration.md)
- [App Data Storage Options](./app-data-storage-options.md)
- [Operations](./operations.md)
- [Troubleshooting](./troubleshooting.md)
