# Caps And Rate Limits

This page documents practical limits users should know before operating BaseBuddy.

## Upload Caps

| Limit | Value |
| --- | --- |
| Avatar image | 5 MB |
| Media image | 10 MB |
| File library file | 25 MB |
| Media upload batch | 10 images |
| File upload batch | 10 files |
| Media upload request body | 60 MB |
| File upload request body | 130 MB |
| Profile upload request body | 6 MB |

## API Body Caps

JSON requests default to 64 KB unless a route uses a smaller or route-specific limit. Folder create/move/delete routes use small JSON bodies, typically 16 KB. Upload prepare/complete JSON requests use 64 KB.

## App Rate Limits

BaseBuddy has a process-local fixed-window limiter. Multi-process deployments need a shared upstream limiter if strict cross-instance enforcement matters.

Common route limits:

| Area | Limit |
| --- | --- |
| Setup check | 20 requests per minute |
| Profile update | 10 requests per minute |
| Project create | 5 requests per 30 minutes |
| Project settings update | 20 requests per minute |
| Project delete | 5 requests per 10 minutes |
| Content save | 60 requests per minute |
| Publish, unpublish, archive | 20 requests per minute |
| Mapping save | 10 requests per minute |
| Edit-session heartbeat | 120 requests per minute |
| Edit-session acquire/release | 60 requests per minute |
| Media/files upload or folder create/delete | 20 requests per minute |
| Media/files move | 30 requests per minute |
| Member, invitation, permission mutations | 20 requests per minute |

Rate limit responses include `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers.

Content reads, saves, mapping updates, publish actions, media, and file operations are served through the project content route family at `/api/projects/[projectId]/content`. When tuning a proxy or WAF, treat that route family as the main editor workload and keep its upstream body and rate limits aligned with the table above.

## Collection Caps

- Bulk post delete and collection-entry delete requests accept up to 50 selected IDs.
- Media/files library pages fetch 250 objects at a time.
- Media/files folder option reads are capped at 200 folder paths.
- Relation selectors use remote search and bounded option pages instead of loading all related rows.

## Runtime Budgets

The runtime budget report uses these route targets:

| Endpoint family | Budget |
| --- | --- |
| Post payload | 1200 ms |
| Posts page | 1000 ms |
| Posts presence | 400 ms |
| Workspace | 1200 ms |
| Workspace counts | 1500 ms |
| Default content route | 750 ms |

Span budgets:

| Span | Budget |
| --- | --- |
| auth | 250 ms |
| cache-build | 400 ms |
| context | 350 ms |
| db | 600 ms |
| handler | 1000 ms |

Run:

```sh
pnpm run perf:budgets
pnpm run perf:bundles
```

## Large Database Harness

The large-load harness targets:

- 500K posts;
- 500K authors;
- 500K categories;
- 500K tags;
- 100K media objects;
- 100K file objects;
- 1000 catalog tables.

API timing warms the same authenticated routes before enforcing steady-state budgets. Use `--skip-warmup` when intentionally collecting cold-start numbers.

## Proxy Recommendations

For public deployments, configure the host, reverse proxy, or WAF to provide:

- shared rate limits across app instances;
- request body limits aligned with upload caps;
- HTTPS termination;
- trusted forwarded headers only.
