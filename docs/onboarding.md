# Onboarding

`/onboarding` is the first-run setup screen. It creates `process.cwd()/basebuddy-data/basebuddy.config.json` from UI input after required secrets are present in env.

Onboarding asks for:

- required env values for auth signing and database access;
- owner name, email, and password;
- setup checks that run automatically.

The setup flow is:

1. **Connect to the database**
2. **Create account on BaseBuddy**
3. **Let's check the setup now**

Onboarding shows the required env keys for auth signing and content database access. It does not collect database URLs or service keys into the config file. The checks verify the config file, owner account, env values, and database connection.

It does not ask users to choose custom paths, run BaseBuddy app-state migrations, or configure an external auth provider.

## Ready State

Setup is ready when the config file exists, validates, has at least one owner user, required env values are present, and the content database connection succeeds.

Use:

```sh
pnpm setup:check
pnpm basebuddy doctor
```

## After Onboarding

Sign in, create a project, save a mapping, then reload to confirm the saved mapping remains the runtime truth.
