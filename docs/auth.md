# Auth

BaseBuddy uses local email/password users stored in `basebuddy.config.json`.

The first owner is created from onboarding or `pnpm basebuddy setup`. Sign-in creates a signed HttpOnly session cookie. Raw session tokens are not written to the browser or logs.

## Setup

Create the first owner from UI:

```text
/onboarding
```

Or from CLI:

```sh
pnpm basebuddy setup \
  --owner-email owner@example.com \
  --owner-name "Owner" \
  --owner-password "replace-with-a-strong-password"
```

## Test Auth

The Playwright test-auth route is for local automated tests only. It should be unavailable unless the test-auth and Playwright runtime env flags are enabled.
