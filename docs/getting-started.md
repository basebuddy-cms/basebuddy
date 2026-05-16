# Getting Started

This page gets BaseBuddy running locally and points you to the first setup screen.

## Requirements

- Node.js 22 recommended.
- `pnpm@10.32.1`.
- A Supabase/Postgres project for BaseBuddy setup data.
- A Postgres/Supabase schema that contains content you want to edit.

## Install

```sh
git clone git@github.com:basebuddy-cms/basebuddy.git
cd basebuddy
pnpm install
pnpm dev
```

BaseBuddy's dev script runs Next.js on port `8080`.

Open:

```text
http://localhost:8080/onboarding
```

BaseBuddy intentionally renders `/onboarding` before `.env` exists. That lets the app guide you through setup instead of requiring you to read every env variable first.

## First-Run Flow

1. Open `/onboarding`.
2. Choose same-project or split-project setup.
3. Create `.env` from the generated values.
4. Restart the dev server so Next.js picks up the new env values.
5. Apply the baseline SQL, configure Auth, and run the readiness check.
6. Sign in, create a project, and map your content tables.

## Production Build

After setup is ready:

```sh
pnpm build
pnpm start
```

`pnpm start` runs the production Next.js server on port `8080` and expects a completed build.

## Where To Go Next

- [Configuration](./configuration.md)
- [Onboarding](./onboarding.md)
- [Auth](./auth.md)
- [Projects and mapping](./projects-and-mapping.md)

## License

BaseBuddy is licensed under AGPL-3.0-or-later. See [LICENSE.md](../LICENSE.md).
