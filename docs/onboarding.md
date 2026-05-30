# Onboarding

`/onboarding` is the first-run setup screen. It creates the selected BaseBuddy app-data backend after required secrets are present in env.

Onboarding asks for:

- required env values for auth signing, app-data backend selection, and database access;
- owner name, email, and password;
- setup checks that run automatically.

The setup flow is:

1. **Choose where to store BaseBuddy data**
2. **Connect to your database**
3. **Create account on BaseBuddy**
4. **Let's check the setup now**

Onboarding shows the required env keys for auth signing and content database access. It does not collect database URLs or service keys into app data. The checks verify app data, owner account, env values, database role, and database connection.

It does not ask users to choose custom paths or configure an external auth provider. If users choose Supabase/Postgres app data, BaseBuddy uses only the BaseBuddy-owned `basebuddy` schema.

## Ready State

Setup is ready when app data exists, validates, has at least one owner user, required env values are present, and the content database connection succeeds.

Use:

```sh
pnpm setup:check
pnpm basebuddy doctor
```

## After Onboarding

Sign in, create a project, save a mapping, then reload to confirm the saved mapping remains the runtime truth.
