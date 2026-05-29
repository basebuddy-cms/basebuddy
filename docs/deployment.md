# Deployment

Production deployment must preserve the BaseBuddy data config file between restarts.

## Checklist

- Build with Node.js 22 and `pnpm`.
- Mount or persist `basebuddy-data/` so setup survives deploys.
- Keep `basebuddy-data/` out of git and public logs.
- Configure HTTPS and trusted proxy headers in your host.
- Run onboarding or CLI setup once.
- Run `pnpm setup:check` and `pnpm basebuddy doctor`.

BaseBuddy currently needs a persistent writable filesystem for `basebuddy-data/`. Editable deployments on Vercel, Netlify, or similar immutable serverless hosts are not supported in this release because UI changes to mappings, permissions, projects, and sidebar layout must be written back to `basebuddy-data/basebuddy.config.json`.

## Runtime

Use:

```sh
pnpm build
pnpm start
```

After deployment, sign in, open `/projects`, and verify a mapped content read.

## Related

- [Configuration](./configuration.md)
- [Operations](./operations.md)
- [Troubleshooting](./troubleshooting.md)
