# Security Policy

BaseBuddy is a self-hosted app that can connect to user-owned databases and storage. Please report security issues privately so maintainers can investigate before details become public.

## Report A Vulnerability

Do not open a public GitHub issue for vulnerabilities.

Use GitHub Security Advisories when available:

```text
Repository -> Security -> Advisories -> Report a vulnerability
```

If advisories are not enabled, contact the maintainers through the security contact listed in the repository profile or project website. Before publishing a public repo, configure either GitHub Security Advisories or a monitored security contact.

## Response Expectations

Maintainers aim to:

- acknowledge valid private reports within 48 hours;
- triage severity and affected versions as soon as enough detail is available;
- coordinate disclosure timing with the reporter when the issue is confirmed;
- publish a fix, mitigation, or advisory for confirmed vulnerabilities.

## What To Include

Include enough detail to reproduce the issue:

- affected BaseBuddy version or commit;
- deployment shape if relevant;
- deployment target and whether the app has a writable filesystem for `basebuddy.config.json`;
- affected route, feature, or API;
- steps to reproduce;
- expected impact;
- any safe proof of concept;
- relevant logs with secrets removed.

## Do Not Include Secrets

Do not send:

- database passwords;
- Supabase secret/service-role keys;
- S3-compatible access keys or secret keys;
- private certificates;
- session cookies;
- access tokens;
- private content data;
- complete `.env` files.

Use redacted `pnpm setup:check` output when setup context is needed.

## Supported Versions

Security fixes are made against the active development branch and current release line. If the repository publishes release tags, use the latest patch release for your version line.

## Security Model Notes

BaseBuddy includes:

- authentication and project-access checks on internal API routes;
- same-origin checks for cookie-backed state-changing requests;
- process-local fixed-window rate limits;
- upload validation and file-size caps;
- production security headers;
- setup diagnostics that redact sensitive values.

Production deployments should still use host-level protections:

- HTTPS termination;
- reverse proxy or platform request body limits;
- trusted forwarded headers only;
- shared rate limits for multi-instance deployments;
- regular database backups;
- private handling of environment variables and certificates.

See [docs/deployment.md](./docs/deployment.md), [docs/caps-and-rate-limits.md](./docs/caps-and-rate-limits.md), and [SUPPORT.md](./SUPPORT.md).
