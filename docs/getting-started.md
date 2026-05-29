# Getting Started

This page gets BaseBuddy running locally and points you to the first setup screen.

## Requirements

- Node.js 22 recommended.
- `pnpm@10.32.1`.
- A Postgres/Supabase database that contains content you want to edit.
- A writable app working directory where BaseBuddy can create `basebuddy-data/`.

## Install

```sh
git clone git@github.com:basebuddy-cms/basebuddy.git
cd basebuddy
pnpm install
pnpm dev
```

BaseBuddy's dev script runs Next.js on port `8080`.

Add local secrets before completing setup:

```sh
cp .env.example .env
```

Then set `BASEBUDDY_AUTH_SECRET` and `BASEBUDDY_CONTENT_DATABASE_URL` in `.env`.

Open:

```text
http://localhost:8080/onboarding
```

BaseBuddy intentionally renders `/onboarding` before `basebuddy-data/basebuddy.config.json` exists. That lets the app create setup from the UI instead of requiring manual file edits first.

## First-Run Flow

1. Open `/onboarding`.
2. Complete **Connect to the database** by adding the required env values.
3. Complete **Create account on BaseBuddy**.
4. Let **Let's check the setup now** run automatically.
5. Sign in with the owner account.
6. Create a project and map your content tables.

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
