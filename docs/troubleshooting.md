# Troubleshooting

Start with setup diagnostics:

```sh
pnpm setup:check
pnpm basebuddy doctor
```

## Missing Config

Open `/onboarding` and complete the database env screen, owner account screen, and setup checks screen. You can also run:

```sh
pnpm basebuddy setup \
  --owner-email owner@example.com \
  --owner-name "Owner" \
  --owner-password "replace-with-a-strong-password"
```

Set `BASEBUDDY_AUTH_SECRET` and `BASEBUDDY_CONTENT_DATABASE_URL` in `.env` or your production environment before rerunning setup.

## Cannot Sign In

Confirm the owner user exists in `basebuddy-data/basebuddy.config.json`, the password is correct, and the app can read the config file.

## Content Does Not Load

Check `BASEBUDDY_CONTENT_DATABASE_URL` in env. BaseBuddy must be able to connect to that database, and the saved mapping must point at real tables and columns.

## Mapping Or Save Fails

BaseBuddy writes dirty mapped fields only. If a field is read-only or unsupported, review the storage shape and mapping instead of changing the content schema blindly.
