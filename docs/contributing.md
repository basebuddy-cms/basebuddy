# Contributing

Thanks for improving BaseBuddy.

First time contributing? Look for issues tagged `good first issue`. They should be scoped to be approachable without deep knowledge of the codebase.

## Development Setup

```sh
pnpm install
pnpm dev
```

Local app URL:

```text
http://localhost:8080
```

For first-run setup, open:

```text
http://localhost:8080/onboarding
```

## Before A Pull Request

Run:

```sh
pnpm exec tsc --noEmit
pnpm test
pnpm build
```

When setup, auth, routing, editor, or API behavior changes, also run the relevant Playwright tests:

```sh
pnpm test:e2e
```

## Development Principles

- Keep the saved mapping as the runtime source of truth.
- Do not rename or reshape user content tables.
- Keep normal save scoped to dirty fields.
- Keep publish/unpublish/archive as explicit actions.
- Prefer read-only or unsupported states over unsafe writes.
- Keep credentials in env values only.

## Docs Changes

Public docs should use neutral language:

- user;
- self-host user;
- maintainer;
- contributor;
- project;
- install.

Avoid internal release language, agent workflow language, private pricing language, and references to unpublished implementation trackers.

## Security

Do not open public issues for vulnerabilities. Follow [SECURITY.md](../SECURITY.md).
