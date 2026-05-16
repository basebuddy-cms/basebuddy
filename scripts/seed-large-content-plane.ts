import { randomUUID } from "node:crypto";

import { Pool } from "pg";

import {
  createDefaultContentMappingConfig,
  normalizeContentMappingConfig,
  type ContentEntityMapping,
  type ContentMappedField,
  type ContentMappingConfig,
  type ContentMappingEntityKey,
  type ContentRelationMapping,
} from "../src/lib/content-runtime/mapping";

type SeedOptions = {
  authors: number;
  categories: number;
  clean: boolean;
  files: number;
  media: number;
  ownerEmail: string | null;
  posts: number;
  projectName: string;
  projectSlug: string;
  registerProject: boolean;
  schema: string;
  tables: number;
  tags: number;
};

const DEFAULT_OPTIONS: SeedOptions = {
  authors: 500_000,
  categories: 500_000,
  clean: false,
  files: 100_000,
  media: 100_000,
  ownerEmail: null,
  posts: 500_000,
  projectName: "BaseBuddy Large Load Test",
  projectSlug: "bb-large-load-test",
  registerProject: false,
  schema: "bb_load_test",
  tables: 1_000,
  tags: 500_000,
};

const INSERT_BATCH_SIZE = 25_000;

const readArgValue = (args: string[], name: string) => {
  const index = args.indexOf(name);

  if (index === -1) {
    return null;
  }

  return args[index + 1] ?? null;
};

const parseCountArg = (args: string[], name: string, fallback: number) => {
  const value = readArgValue(args, name);

  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value.replaceAll("_", ""), 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }

  return parsed;
};

const parseOptions = (): SeedOptions => {
  const args = process.argv.slice(2);
  const schema = readArgValue(args, "--schema") ?? DEFAULT_OPTIONS.schema;
  const projectSlug = readArgValue(args, "--project-slug") ?? DEFAULT_OPTIONS.projectSlug;

  if (!/^[a-z][a-z0-9_]*$/.test(schema)) {
    throw new Error("--schema must start with a letter and contain only lowercase letters, numbers, and underscores.");
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(projectSlug)) {
    throw new Error("--project-slug must use lowercase letters, numbers, and hyphens.");
  }

  return {
    authors: parseCountArg(args, "--authors", DEFAULT_OPTIONS.authors),
    categories: parseCountArg(args, "--categories", DEFAULT_OPTIONS.categories),
    clean: args.includes("--clean"),
    files: parseCountArg(args, "--files", DEFAULT_OPTIONS.files),
    media: parseCountArg(args, "--media", DEFAULT_OPTIONS.media),
    ownerEmail:
      readArgValue(args, "--owner-email") ??
      process.env.BASEBUDDY_LOAD_TEST_OWNER_EMAIL?.trim() ??
      process.env.PLAYWRIGHT_OWNER_EMAIL?.trim() ??
      DEFAULT_OPTIONS.ownerEmail,
    posts: parseCountArg(args, "--posts", DEFAULT_OPTIONS.posts),
    projectName: readArgValue(args, "--project-name") ?? DEFAULT_OPTIONS.projectName,
    projectSlug,
    registerProject: args.includes("--register-project"),
    schema,
    tables: parseCountArg(args, "--tables", DEFAULT_OPTIONS.tables),
    tags: parseCountArg(args, "--tags", DEFAULT_OPTIONS.tags),
  };
};

const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;
const tableRef = (schema: string, table: string) => `${schema}.${table}`;
const getManagedMediaBucketName = (schema: string) => `${schema}_media`;
const getManagedFilesBucketName = (schema: string) => `${schema}_files`;

const setSource = (
  entity: ContentEntityMapping,
  {
    primaryKey,
    schema,
    table,
  }: {
    primaryKey: string;
    schema: string;
    table: string;
  },
) => {
  entity.source = {
    kind: "table",
    primaryKey,
    schema,
    table,
  };
  entity.status = "mapped";
  entity.capabilities = {
    browse: true,
    create: true,
    delete: true,
    read: true,
    update: true,
  };
};

const mapField = (
  field: ContentMappedField,
  overrides: Partial<ContentMappedField>,
): ContentMappedField => ({
  ...field,
  ...overrides,
});

const relation = (
  targetEntity: ContentMappingEntityKey,
  overrides: Partial<ContentRelationMapping>,
): ContentRelationMapping => ({
  discriminatorColumn: null,
  discriminatorValue: null,
  fieldMap: {},
  junctionSourceColumn: null,
  junctionTable: null,
  junctionTargetColumn: null,
  multiple: targetEntity !== "authors",
  sourceColumn: null,
  status: "mapped",
  storagePrimitive: undefined,
  strategy: "none",
  targetColumn: null,
  targetEntity,
  targetTable: null,
  valueColumn: null,
  ...overrides,
});

const mapCollectionEntity = (
  entity: ContentEntityMapping,
  {
    descriptionColumn = null,
    primaryKey,
    schema,
    table,
  }: {
    descriptionColumn?: string | null;
    primaryKey: string;
    schema: string;
    table: string;
  },
) => {
  setSource(entity, { primaryKey, schema, table });
  entity.fields.id = mapField(entity.fields.id, { column: "id", required: true, visible: false });
  entity.fields.name = mapField(entity.fields.name, { column: "name", required: true });
  entity.fields.slug = mapField(entity.fields.slug, { column: "slug" });
  entity.fields.description = mapField(entity.fields.description, {
    column: descriptionColumn,
    kind: "plain_text",
  });
};

const buildLoadTestMapping = (schema: string): ContentMappingConfig => {
  const mapping = createDefaultContentMappingConfig();
  const posts = mapping.entities.posts;
  mapping.mediaStorage = {
    bucketName: getManagedMediaBucketName(schema),
    endpoint: null,
    provider: "supabase_bucket",
    publicUrlBase: null,
    region: null,
  };
  mapping.filesStorage = {
    bucketName: getManagedFilesBucketName(schema),
    endpoint: null,
    provider: "supabase_bucket",
    publicUrlBase: null,
    region: null,
  };

  setSource(posts, { primaryKey: "id", schema, table: "posts" });
  posts.fields.id = mapField(posts.fields.id, { column: "id", required: true, visible: false });
  posts.fields.title = mapField(posts.fields.title, { column: "title", required: true });
  posts.fields.slug = mapField(posts.fields.slug, { column: "slug" });
  posts.fields.status = mapField(posts.fields.status, { column: "status", kind: "text" });
  posts.fields.featuredImageUrl = mapField(posts.fields.featuredImageUrl, {
    column: "featured_image_url",
    kind: "text",
  });
  posts.fields.createdAt = mapField(posts.fields.createdAt, {
    column: "created_at",
    kind: "datetime",
    timestampSourceHint: "trigger_managed",
  });
  posts.fields.updatedAt = mapField(posts.fields.updatedAt, {
    column: "updated_at",
    kind: "datetime",
    timestampSourceHint: "trigger_managed",
  });
  posts.fields.publishedAt = mapField(posts.fields.publishedAt, {
    column: "published_at",
    kind: "datetime",
  });
  posts.editorFields = [
    {
      column: "body",
      id: "body",
      kind: "plain_text",
      label: "Body",
      path: null,
      placeholder: null,
      required: false,
      storagePrimitive: "direct_column",
      visible: true,
    },
  ];
  posts.workflow = {
    archivedValues: ["archived"],
    customValues: [],
    draftValues: ["draft"],
    mode: "status",
    publishedAtColumn: "published_at",
    publishedFlagColumn: null,
    publishedValues: ["published"],
    statusColumn: "status",
  };

  mapCollectionEntity(mapping.entities.authors, {
    descriptionColumn: null,
    primaryKey: "id",
    schema,
    table: "authors",
  });
  mapping.entities.authors.fields.email = mapField(mapping.entities.authors.fields.email, {
    column: "email",
    kind: "text",
  });
  mapCollectionEntity(mapping.entities.categories, {
    descriptionColumn: null,
    primaryKey: "id",
    schema,
    table: "categories",
  });
  mapping.entities.categories.fields.parentId = mapField(mapping.entities.categories.fields.parentId, {
    column: "parent_id",
    kind: "text",
  });
  mapCollectionEntity(mapping.entities.tags, {
    descriptionColumn: null,
    primaryKey: "id",
    schema,
    table: "tags",
  });

  setSource(mapping.entities.media, { primaryKey: "id", schema, table: "media_objects" });
  mapping.entities.media.fields.id = mapField(mapping.entities.media.fields.id, {
    column: "id",
    required: true,
    visible: false,
  });
  mapping.entities.media.fields.objectPath = mapField(mapping.entities.media.fields.objectPath, {
    column: "object_path",
    kind: "text",
  });
  mapping.entities.media.fields.url = mapField(mapping.entities.media.fields.url, {
    column: "object_path",
    kind: "text",
  });
  mapping.entities.media.fields.title = mapField(mapping.entities.media.fields.title, {
    column: "object_path",
    kind: "text",
  });

  setSource(mapping.entities.files, { primaryKey: "id", schema, table: "file_objects" });
  mapping.entities.files.fields.id = mapField(mapping.entities.files.fields.id, {
    column: "id",
    required: true,
    visible: false,
  });
  mapping.entities.files.fields.objectPath = mapField(mapping.entities.files.fields.objectPath, {
    column: "object_path",
    kind: "text",
  });
  mapping.entities.files.fields.url = mapField(mapping.entities.files.fields.url, {
    column: "object_path",
    kind: "text",
  });
  mapping.entities.files.fields.title = mapField(mapping.entities.files.fields.title, {
    column: "object_path",
    kind: "text",
  });

  posts.relations.authors = relation("authors", {
    multiple: false,
    sourceColumn: "author_id",
    strategy: "foreign_key",
    targetColumn: "id",
    targetTable: tableRef(schema, "authors"),
  });
  posts.relations.categories = relation("categories", {
    junctionSourceColumn: "post_id",
    junctionTable: tableRef(schema, "post_categories"),
    junctionTargetColumn: "category_id",
    multiple: true,
    strategy: "join_table",
    targetColumn: "id",
    targetTable: tableRef(schema, "categories"),
  });
  posts.relations.tags = relation("tags", {
    junctionSourceColumn: "post_id",
    junctionTable: tableRef(schema, "post_tags"),
    junctionTargetColumn: "tag_id",
    multiple: true,
    strategy: "join_table",
    targetColumn: "id",
    targetTable: tableRef(schema, "tags"),
  });

  return normalizeContentMappingConfig(mapping);
};

const createPool = (connectionString: string) => {
  const parsed = new URL(connectionString);
  const isLocal =
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "localhost" ||
    parsed.hostname === "::1";

  return new Pool({
    connectionString,
    max: 4,
    ssl: isLocal || /sslmode=disable/i.test(connectionString) ? false : { rejectUnauthorized: false },
  });
};

const requireContentDatabaseUrl = () => {
  const databaseUrl = process.env.BASEBUDDY_CONTENT_DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("Set BASEBUDDY_CONTENT_DATABASE_URL before running the large content-plane seed.");
  }

  return databaseUrl;
};

const requireControlDatabaseUrl = () => {
  const databaseUrl = process.env.BASEBUDDY_CONTROL_DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("Set BASEBUDDY_CONTROL_DATABASE_URL before registering the large load-test project.");
  }

  return databaseUrl;
};

const runBatches = async (
  total: number,
  operation: (start: number, end: number) => Promise<void>,
) => {
  for (let start = 1; start <= total; start += INSERT_BATCH_SIZE) {
    const end = Math.min(total, start + INSERT_BATCH_SIZE - 1);

    await operation(start, end);
  }
};

const setupSchema = async (pool: Pool, schema: string) => {
  const quotedSchema = quoteIdentifier(schema);

  await pool.query(`create schema if not exists ${quotedSchema}`);
  await pool.query("create extension if not exists pg_trgm");
  await pool.query(`
    create table if not exists ${quotedSchema}.authors (
      id bigint primary key,
      name text not null,
      slug text not null unique,
      email text,
      created_at timestamptz not null,
      updated_at timestamptz not null
    )
  `);
  await pool.query(`
    create table if not exists ${quotedSchema}.categories (
      id bigint primary key,
      name text not null,
      slug text not null unique,
      parent_id bigint references ${quotedSchema}.categories(id),
      created_at timestamptz not null,
      updated_at timestamptz not null
    )
  `);
  await pool.query(`
    create table if not exists ${quotedSchema}.tags (
      id bigint primary key,
      name text not null,
      slug text not null unique,
      created_at timestamptz not null,
      updated_at timestamptz not null
    )
  `);
  await pool.query(`
    create table if not exists ${quotedSchema}.posts (
      id bigint primary key,
      title text not null,
      slug text not null unique,
      body text not null,
      status text not null,
      author_id bigint references ${quotedSchema}.authors(id),
      featured_image_url text,
      created_at timestamptz not null,
      updated_at timestamptz not null,
      published_at timestamptz
    )
  `);
  await pool.query(`
    create table if not exists ${quotedSchema}.post_categories (
      post_id bigint not null references ${quotedSchema}.posts(id) on delete cascade,
      category_id bigint not null references ${quotedSchema}.categories(id) on delete cascade,
      primary key (post_id, category_id)
    )
  `);
  await pool.query(`
    create table if not exists ${quotedSchema}.post_tags (
      post_id bigint not null references ${quotedSchema}.posts(id) on delete cascade,
      tag_id bigint not null references ${quotedSchema}.tags(id) on delete cascade,
      primary key (post_id, tag_id)
    )
  `);
  await pool.query(`
    create table if not exists ${quotedSchema}.media_objects (
      id bigint primary key,
      bucket text not null,
      object_path text not null unique,
      mime_type text not null,
      size_bytes bigint not null,
      created_at timestamptz not null,
      updated_at timestamptz not null
    )
  `);
  await pool.query(`
    create table if not exists ${quotedSchema}.file_objects (
      id bigint primary key,
      bucket text not null,
      object_path text not null unique,
      mime_type text not null,
      size_bytes bigint not null,
      created_at timestamptz not null,
      updated_at timestamptz not null
    )
  `);

  await pool.query(`create index if not exists ${quoteIdentifier(`${schema}_posts_updated_idx`)} on ${quotedSchema}.posts(updated_at desc, id desc)`);
  await pool.query(`create index if not exists ${quoteIdentifier(`${schema}_posts_status_updated_idx`)} on ${quotedSchema}.posts(status, updated_at desc, id desc)`);
  await pool.query(`create index if not exists ${quoteIdentifier(`${schema}_posts_author_idx`)} on ${quotedSchema}.posts(author_id)`);
  await pool.query(`create index if not exists ${quoteIdentifier(`${schema}_posts_title_trgm_idx`)} on ${quotedSchema}.posts using gin ((coalesce(title::text, '')) gin_trgm_ops)`);
  await pool.query(`create index if not exists ${quoteIdentifier(`${schema}_posts_slug_trgm_idx`)} on ${quotedSchema}.posts using gin ((coalesce(slug::text, '')) gin_trgm_ops)`);
  await pool.query(`create index if not exists ${quoteIdentifier(`${schema}_posts_body_trgm_idx`)} on ${quotedSchema}.posts using gin ((coalesce(body::text, '')) gin_trgm_ops)`);
  await pool.query(`create index if not exists ${quoteIdentifier(`${schema}_authors_name_prefix_idx`)} on ${quotedSchema}.authors (lower(coalesce(name::text, '')) text_pattern_ops)`);
  await pool.query(`create index if not exists ${quoteIdentifier(`${schema}_authors_slug_prefix_idx`)} on ${quotedSchema}.authors (lower(coalesce(slug::text, '')) text_pattern_ops)`);
  await pool.query(`create index if not exists ${quoteIdentifier(`${schema}_authors_email_prefix_idx`)} on ${quotedSchema}.authors (lower(coalesce(email::text, '')) text_pattern_ops)`);
  await pool.query(`create index if not exists ${quoteIdentifier(`${schema}_categories_name_prefix_idx`)} on ${quotedSchema}.categories (lower(coalesce(name::text, '')) text_pattern_ops)`);
  await pool.query(`create index if not exists ${quoteIdentifier(`${schema}_categories_slug_prefix_idx`)} on ${quotedSchema}.categories (lower(coalesce(slug::text, '')) text_pattern_ops)`);
  await pool.query(`create index if not exists ${quoteIdentifier(`${schema}_tags_name_prefix_idx`)} on ${quotedSchema}.tags (lower(coalesce(name::text, '')) text_pattern_ops)`);
  await pool.query(`create index if not exists ${quoteIdentifier(`${schema}_tags_slug_prefix_idx`)} on ${quotedSchema}.tags (lower(coalesce(slug::text, '')) text_pattern_ops)`);
  await pool.query(`create index if not exists ${quoteIdentifier(`${schema}_categories_parent_idx`)} on ${quotedSchema}.categories(parent_id)`);
  await pool.query(`create index if not exists ${quoteIdentifier(`${schema}_post_categories_category_idx`)} on ${quotedSchema}.post_categories(category_id, post_id)`);
  await pool.query(`create index if not exists ${quoteIdentifier(`${schema}_post_tags_tag_idx`)} on ${quotedSchema}.post_tags(tag_id, post_id)`);
};

const seedDimensionTable = async (
  pool: Pool,
  schema: string,
  tableName: "authors" | "categories" | "tags",
  total: number,
) => {
  const quotedSchema = quoteIdentifier(schema);

  await runBatches(total, async (start, end) => {
    if (tableName === "authors") {
      await pool.query(
        `
          insert into ${quotedSchema}.authors (id, name, slug, email, created_at, updated_at)
          select
            item,
            'Author ' || item,
            'author-' || item,
            'author-' || item || '@example.test',
            timezone('utc', now()) - (item || ' seconds')::interval,
            timezone('utc', now()) - (item || ' seconds')::interval
          from generate_series($1::bigint, $2::bigint) as item
          on conflict (id) do nothing
        `,
        [start, end],
      );

      return;
    }

    if (tableName === "categories") {
      await pool.query(
        `
          insert into ${quotedSchema}.categories (id, name, slug, parent_id, created_at, updated_at)
          select
            item,
            'Category ' || item,
            'category-' || item,
            case when item > 100 then ((item - 1) % 100) + 1 else null end,
            timezone('utc', now()) - (item || ' seconds')::interval,
            timezone('utc', now()) - (item || ' seconds')::interval
          from generate_series($1::bigint, $2::bigint) as item
          on conflict (id) do nothing
        `,
        [start, end],
      );

      return;
    }

    await pool.query(
      `
        insert into ${quotedSchema}.tags (id, name, slug, created_at, updated_at)
        select
          item,
          'Tag ' || item,
          'tag-' || item,
          timezone('utc', now()) - (item || ' seconds')::interval,
          timezone('utc', now()) - (item || ' seconds')::interval
        from generate_series($1::bigint, $2::bigint) as item
        on conflict (id) do nothing
      `,
      [start, end],
    );
  });
};

const seedPosts = async (pool: Pool, options: SeedOptions) => {
  const quotedSchema = quoteIdentifier(options.schema);
  const authorModulo = Math.max(1, options.authors);

  await runBatches(options.posts, async (start, end) => {
    await pool.query(
      `
        insert into ${quotedSchema}.posts (
          id,
          title,
          slug,
          body,
          status,
          author_id,
          featured_image_url,
          created_at,
          updated_at,
          published_at
        )
        select
          item,
          'Load Test Post ' || item,
          'load-test-post-' || item,
          repeat('Body for post ' || item || '. ', 8),
          case when item % 5 = 0 then 'draft' else 'published' end,
          ((item - 1) % $3::bigint) + 1,
          '/media/load-test-' || item || '.jpg',
          timezone('utc', now()) - (item || ' seconds')::interval,
          timezone('utc', now()) - ((item / 2) || ' seconds')::interval,
          case when item % 5 = 0 then null else timezone('utc', now()) - (item || ' seconds')::interval end
        from generate_series($1::bigint, $2::bigint) as item
        on conflict (id) do nothing
      `,
      [start, end, authorModulo],
    );
  });
};

const seedJoinTables = async (pool: Pool, options: SeedOptions) => {
  const quotedSchema = quoteIdentifier(options.schema);
  const categoryModulo = Math.max(1, options.categories);
  const tagModulo = Math.max(1, options.tags);

  await runBatches(options.posts, async (start, end) => {
    await pool.query(
      `
        insert into ${quotedSchema}.post_categories (post_id, category_id)
        select item, ((item - 1) % $3::bigint) + 1
        from generate_series($1::bigint, $2::bigint) as item
        on conflict do nothing
      `,
      [start, end, categoryModulo],
    );
    await pool.query(
      `
        insert into ${quotedSchema}.post_tags (post_id, tag_id)
        select item, ((item - 1) % $3::bigint) + 1
        from generate_series($1::bigint, $2::bigint) as item
        on conflict do nothing
      `,
      [start, end, tagModulo],
    );
  });
};

const seedObjectCatalog = async (
  pool: Pool,
  schema: string,
  tableName: "file_objects" | "media_objects",
  total: number,
) => {
  const quotedSchema = quoteIdentifier(schema);
  const bucket = tableName === "media_objects"
    ? getManagedMediaBucketName(schema)
    : getManagedFilesBucketName(schema);
  const extension = tableName === "media_objects" ? "jpg" : "pdf";
  const mimeType = tableName === "media_objects" ? "image/jpeg" : "application/pdf";

  await runBatches(total, async (start, end) => {
    await pool.query(
      `
        insert into ${quotedSchema}.${tableName} (id, bucket, object_path, mime_type, size_bytes, created_at, updated_at)
        select
          item,
          $3,
          'folder-' || lpad(((item - 1) / 1000)::text, 4, '0') || '/object-' || item || '.' || $4,
          $5,
          1024 + item,
          timezone('utc', now()) - (item || ' seconds')::interval,
          timezone('utc', now()) - (item || ' seconds')::interval
        from generate_series($1::bigint, $2::bigint) as item
        on conflict (id) do nothing
      `,
      [start, end, bucket, extension, mimeType],
    );
  });
};

const seedManagedStorageObjects = async (
  pool: Pool,
  schema: string,
  kind: "files" | "media",
  total: number,
) => {
  const bucketName = kind === "media" ? getManagedMediaBucketName(schema) : getManagedFilesBucketName(schema);
  const extension = kind === "media" ? "jpg" : "pdf";
  const mimeType = kind === "media" ? "image/jpeg" : "application/pdf";

  await pool.query(
    `
      insert into storage.buckets (id, name, public)
      values ($1, $1, true)
      on conflict (id) do update set
        name = excluded.name,
        public = excluded.public
    `,
    [bucketName],
  );

  await runBatches(total, async (start, end) => {
    await pool.query(
      `
        insert into storage.objects (
          bucket_id,
          name,
          metadata,
          created_at,
          updated_at,
          last_accessed_at
        )
        select
          $3,
          generated.object_name,
          jsonb_build_object(
            'mimetype', $5::text,
            'size', 1024 + generated.item
          ),
          timezone('utc', now()) - (generated.item || ' seconds')::interval,
          timezone('utc', now()) - (generated.item || ' seconds')::interval,
          timezone('utc', now()) - (generated.item || ' seconds')::interval
        from (
          select
            item,
            'folder-' || lpad(((item - 1) / 1000)::text, 4, '0') || '/object-' || item || '.' || $4::text as object_name
          from generate_series($1::bigint, $2::bigint) as item
        ) as generated
        on conflict (bucket_id, name) do nothing
      `,
      [start, end, bucketName, extension, mimeType],
    );
  });
};

const createFillerTables = async (pool: Pool, schema: string, total: number) => {
  const quotedSchema = quoteIdentifier(schema);

  for (let index = 1; index <= total; index += 1) {
    const tableName = quoteIdentifier(`catalog_extra_${String(index).padStart(4, "0")}`);

    await pool.query(`
      create table if not exists ${quotedSchema}.${tableName} (
        id bigint primary key,
        title text not null,
        updated_at timestamptz not null default timezone('utc', now())
      )
    `);
  }
};

const analyzeSeedSchema = async (pool: Pool, schema: string) => {
  const quotedSchema = quoteIdentifier(schema);
  const tableNames = [
    "authors",
    "categories",
    "tags",
    "posts",
    "post_categories",
    "post_tags",
    "media_objects",
    "file_objects",
  ];

  for (const tableName of tableNames) {
    await pool.query(`analyze ${quotedSchema}.${quoteIdentifier(tableName)}`);
  }

  await pool.query("analyze storage.objects");
};

const registerLoadTestProject = async (pool: Pool, options: SeedOptions) => {
  if (!options.ownerEmail) {
    throw new Error("Pass --owner-email or set BASEBUDDY_LOAD_TEST_OWNER_EMAIL before --register-project.");
  }

  const ownerResult = await pool.query<{ id: string }>(
    "select id from public.basebuddy_profiles where lower(email) = lower($1) limit 1",
    [options.ownerEmail],
  );
  const ownerId = ownerResult.rows[0]?.id;

  if (!ownerId) {
    throw new Error(`No BaseBuddy profile found for ${options.ownerEmail}. Sign in once, then rerun registration.`);
  }

  const projectId = randomUUID();
  const mappingConfig = buildLoadTestMapping(options.schema);

  await pool.query("begin");
  try {
    await pool.query(
      `
        insert into public.basebuddy_projects (id, name, slug, status, website_url, created_by)
        values ($1, $2, $3, 'active', $4, $5)
        on conflict (slug) do update set
          name = excluded.name,
          status = 'active',
          website_url = excluded.website_url
      `,
      [
        projectId,
        options.projectName,
        options.projectSlug,
        `https://load-test.local/${options.schema}`,
        ownerId,
      ],
    );
    const resolvedProject = await pool.query<{ id: string }>(
      "select id from public.basebuddy_projects where slug = $1 limit 1",
      [options.projectSlug],
    );
    const resolvedProjectId = resolvedProject.rows[0]?.id ?? projectId;

    await pool.query(
      `
        insert into public.basebuddy_project_members (project_id, user_id)
        values ($1, $2)
        on conflict do nothing
      `,
      [resolvedProjectId, ownerId],
    );
    await pool.query(
      `
        insert into public.basebuddy_project_member_roles (project_id, user_id, role_key)
        values ($1, $2, 'owner')
        on conflict do nothing
      `,
      [resolvedProjectId, ownerId],
    );

    const revisionVersionResult = await pool.query<{ next_version: number }>(
      `
        select coalesce(max(version), 0) + 1 as next_version
        from private.basebuddy_project_content_mapping_revisions
        where project_id = $1
      `,
      [resolvedProjectId],
    );
    const nextRevisionVersion = revisionVersionResult.rows[0]?.next_version ?? 1;

    await pool.query(
      `
        insert into private.basebuddy_project_content_mapping_revisions (
          project_id,
          binding_status,
          version,
          source,
          canonical_schema_version,
          scope_mode,
          scope_config,
          install_config,
          mapping_config,
          created_by
        )
        values ($1, 'ready', $2, 'manual', 1, 'database', '{}'::jsonb, '{}'::jsonb, $3::jsonb, $4)
      `,
      [resolvedProjectId, nextRevisionVersion, JSON.stringify(mappingConfig), ownerId],
    );

    await pool.query("commit");

    return {
      projectId: resolvedProjectId,
      projectSlug: options.projectSlug,
    };
  } catch (error) {
    await pool.query("rollback");
    throw error;
  }
};

const main = async () => {
  const options = parseOptions();
  const pool = createPool(requireContentDatabaseUrl());
  const quotedSchema = quoteIdentifier(options.schema);

  try {
    if (options.clean) {
      await pool.query(`drop schema if exists ${quotedSchema} cascade`);
      console.log(`Dropped ${options.schema}.`);
      return;
    }

    await setupSchema(pool, options.schema);
    await seedDimensionTable(pool, options.schema, "authors", options.authors);
    await seedDimensionTable(pool, options.schema, "categories", options.categories);
    await seedDimensionTable(pool, options.schema, "tags", options.tags);
    await seedPosts(pool, options);
    await seedJoinTables(pool, options);
    await seedObjectCatalog(pool, options.schema, "media_objects", options.media);
    await seedObjectCatalog(pool, options.schema, "file_objects", options.files);
    await seedManagedStorageObjects(pool, options.schema, "media", options.media);
    await seedManagedStorageObjects(pool, options.schema, "files", options.files);
    await createFillerTables(pool, options.schema, options.tables);
    await analyzeSeedSchema(pool, options.schema);

    const registeredProject = options.registerProject
      ? await (async () => {
          const controlPool = createPool(requireControlDatabaseUrl());

          try {
            return await registerLoadTestProject(controlPool, options);
          } finally {
            await controlPool.end();
          }
        })()
      : null;

    console.log(
      JSON.stringify(
        {
          authors: options.authors,
          categories: options.categories,
          files: options.files,
          media: options.media,
          posts: options.posts,
          schema: options.schema,
          tables: options.tables,
          tags: options.tags,
          ...(registeredProject ? { registeredProject } : {}),
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
