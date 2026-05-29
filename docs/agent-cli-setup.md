# Agent CLI Setup

Use this flow when an AI agent or operator needs to set up BaseBuddy against an existing Postgres/Supabase schema without digging through BaseBuddy source code.

The CLI can inspect the connected database, draft mapping JSON, explain that mapping, and save it through the same config APIs the app uses.

## Command Order

```sh
pnpm basebuddy agent:setup --json
pnpm basebuddy doctor --json
pnpm basebuddy setup --owner-email owner@example.com --owner-name "Owner" --owner-password "strong-password"
pnpm basebuddy projects:create --actor-email owner@example.com --name "Docs" --slug docs
pnpm basebuddy schema:inspect --schema public --json
pnpm basebuddy mapping:draft --schema public --table posts --json
pnpm basebuddy mapping:explain --input mapping.json --json
pnpm basebuddy mapping:set --project docs --input mapping.json --binding-status ready --json
```

Use real values for the owner, project name, slug, schema, table, and mapping file.

## Inspect First

Use schema inspection before writing mapping JSON:

```sh
pnpm basebuddy schema:inspect --schema public --json
pnpm basebuddy schema:inspect --schema public --table posts,authors,categories --json
pnpm basebuddy schema:inspect --schema public --table posts --no-samples --json
```

The output includes visible tables, columns, primary keys, foreign keys, enum values, row estimates, and sample rows when they can be read safely. It does not print the database URL.

## Draft With Hints

For common schemas:

```sh
pnpm basebuddy mapping:draft --schema public --table posts --json
```

For custom table or column names, create a hints file:

```json
{
  "postsTable": "public.pages",
  "titleColumn": "headline",
  "slugColumn": "slug",
  "excerptColumn": "summary",
  "featuredImageUrlColumn": "hero_image_url",
  "contentFields": [
    {
      "column": "body_md",
      "kind": "markdown",
      "label": "Body"
    }
  ],
  "customFields": [
    {
      "column": "faq_json",
      "kind": "json",
      "label": "FAQ"
    }
  ],
  "workflow": {
    "mode": "published_flag",
    "publishedFlagColumn": "is_published",
    "publishedAtColumn": "published_at"
  }
}
```

Then run:

```sh
pnpm basebuddy mapping:draft --schema public --table pages --hints mapping-hints.json --json
```

The draft output includes `mappingConfig`, `summary`, and `valid`. Save only `mappingConfig` as the JSON file passed to `mapping:set`.

## Explain Before Saving

```sh
pnpm basebuddy mapping:explain --input mapping.json --json
```

Confirm the source table, editor fields, custom fields, workflow fields, and storage metadata before saving.

Then save:

```sh
pnpm basebuddy mapping:validate --input mapping.json --json
pnpm basebuddy mapping:set --project docs --input mapping.json --binding-status ready --json
pnpm basebuddy mapping:get --project docs --json
```

## Rules For Agents

- Prefer CLI output and live schema inspection before reading source files.
- Do not hand-edit `basebuddy-data/basebuddy.config.json` unless the CLI cannot load it and you are repairing the file.
- Do not put database URLs, auth secrets, Supabase keys, S3 keys, or passwords into mapping files, config files, docs, screenshots, commits, or final answers.
- Remember that `mapping:set` does not rename tables, add columns, or change user content schemas.

## Related Docs

- [CLI](./cli.md)
- [Projects and Mapping](./projects-and-mapping.md)
- [Configuration](./configuration.md)
- [Storage UI Matrix](./storage-ui-matrix.md)
