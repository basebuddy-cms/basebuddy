import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { Pool } from "pg";

import {
  createDefaultContentMappingConfig,
  normalizeContentMappingConfig,
  type ContentCustomFieldMapping,
  type ContentEntityMapping,
  type ContentMappedField,
  type ContentMappingConfig,
  type ContentMappingEntityKey,
  type ContentRelationMapping,
} from "../src/lib/content-runtime/mapping";

type SeededProject = {
  id: string;
  name: string;
  postId: string;
  schema: string;
  slug: string;
};

const parseDotEnvValue = (rawValue: string) => {
  const value = rawValue.trim();
  const quote = value[0];

  if ((quote === "\"" || quote === "'") && value.endsWith(quote)) {
    return value.slice(1, -1).replace(/\\n/g, "\n");
  }

  return value;
};

const loadedEnvKeys = new Set<string>();

const loadDotEnvFile = (
  filePath: string,
  options: {
    override?: boolean;
  } = {},
) => {
  const absolutePath = resolve(process.cwd(), filePath);

  if (!existsSync(absolutePath)) {
    return;
  }

  const source = readFileSync(absolutePath, "utf8");

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");

    if (equalsIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = parseDotEnvValue(trimmed.slice(equalsIndex + 1));

    if (!key) {
      continue;
    }

    if (process.env[key] === undefined || (options.override && loadedEnvKeys.has(key))) {
      process.env[key] = value;
      loadedEnvKeys.add(key);
    }
  }
};

loadDotEnvFile(".env");
loadDotEnvFile(".env.local");
loadDotEnvFile(".env.playwright", { override: true });

const getEnv = (key: string) => {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

const createPool = (connectionString: string) => {
  const parsed = new URL(connectionString);
  const isLocal =
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "localhost" ||
    parsed.hostname === "::1";

  return new Pool({
    connectionString,
    ssl: isLocal || /sslmode=disable/i.test(connectionString) ? false : { rejectUnauthorized: false },
  });
};

const quoteIdentifier = (identifier: string) => `"${identifier.replaceAll("\"", "\"\"")}"`;
const tableRef = (schema: string, table: string) => `${schema}.${table}`;

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

const basicCollectionFields = ({
  descriptionColumn = "description",
  idColumn = "id",
  nameColumn = "name",
  slugColumn = "slug",
}: {
  descriptionColumn?: string;
  idColumn?: string;
  nameColumn?: string;
  slugColumn?: string;
}) => ({
  descriptionColumn,
  idColumn,
  nameColumn,
  slugColumn,
});

const mapCollectionEntity = (
  entity: ContentEntityMapping,
  {
    fields,
    primaryKey,
    schema,
    table,
  }: {
    fields: ReturnType<typeof basicCollectionFields>;
    primaryKey: string;
    schema: string;
    table: string;
  },
) => {
  setSource(entity, { primaryKey, schema, table });
  entity.fields.id = mapField(entity.fields.id, { column: fields.idColumn, required: true, visible: false });
  entity.fields.name = mapField(entity.fields.name, { column: fields.nameColumn, required: true });
  entity.fields.slug = mapField(entity.fields.slug, { column: fields.slugColumn });
  entity.fields.description = mapField(entity.fields.description, {
    column: fields.descriptionColumn,
    kind: "plain_text",
  });
};

const addCommonPostDates = (
  posts: ContentEntityMapping,
  {
    createdAt,
    publishedAt,
    updatedAt,
  }: {
    createdAt?: string;
    publishedAt?: string;
    updatedAt?: string;
  },
) => {
  if (createdAt) {
    posts.fields.createdAt = mapField(posts.fields.createdAt, {
      column: createdAt,
      kind: "datetime",
      timestampSourceHint: "trigger_managed",
    });
  }

  if (publishedAt) {
    posts.fields.publishedAt = mapField(posts.fields.publishedAt, {
      column: publishedAt,
      kind: "datetime",
    });
  }

  if (updatedAt) {
    posts.fields.updatedAt = mapField(posts.fields.updatedAt, {
      column: updatedAt,
      kind: "datetime",
      timestampSourceHint: "trigger_managed",
    });
  }
};

const buildDirectMapping = (schema: string) => {
  const mapping = createDefaultContentMappingConfig();
  const posts = mapping.entities.posts;

  mapping.mediaStorage = {
    bucketName: "pw-self-host-media",
    endpoint: null,
    provider: "supabase_bucket",
    publicUrlBase: null,
    region: null,
  };
  mapping.filesStorage = {
    bucketName: "pw-self-host-media",
    endpoint: null,
    provider: "supabase_bucket",
    publicUrlBase: null,
    region: null,
  };

  setSource(posts, { primaryKey: "article_id", schema, table: "articles" });
  posts.fields.id = mapField(posts.fields.id, { column: "article_id", required: true, visible: false });
  posts.fields.title = mapField(posts.fields.title, { column: "headline", required: true });
  posts.fields.slug = mapField(posts.fields.slug, { column: "route_slug" });
  posts.fields.excerpt = mapField(posts.fields.excerpt, { column: "summary", kind: "plain_text" });
  posts.fields.status = mapField(posts.fields.status, { column: "state", kind: "text" });
  posts.fields.featuredImageUrl = mapField(posts.fields.featuredImageUrl, { column: "hero_url", kind: "text" });
  addCommonPostDates(posts, {
    createdAt: "created_on",
    publishedAt: "published_on",
    updatedAt: "modified_on",
  });
  posts.workflow = {
    archivedValues: ["archived"],
    customValues: [],
    draftValues: ["draft"],
    mode: "status",
    publishedAtColumn: "published_on",
    publishedFlagColumn: null,
    publishedValues: ["published"],
    statusColumn: "state",
  };
  posts.editorFields = [
    {
      column: "body_md",
      id: "body_md",
      kind: "markdown",
      label: "Body",
      path: null,
      placeholder: null,
      required: false,
      storagePrimitive: "direct_column",
      visible: true,
    },
  ];

  const authors = mapping.entities.authors;
  setSource(authors, { primaryKey: "writer_uuid", schema, table: "writers" });
  authors.fields.id = mapField(authors.fields.id, { column: "writer_uuid", required: true, visible: false });
  authors.fields.name = mapField(authors.fields.name, { column: "display_name", required: true });
  authors.fields.slug = mapField(authors.fields.slug, { column: "handle" });
  authors.fields.email = mapField(authors.fields.email, { column: "email_address" });
  authors.fields.bio = mapField(authors.fields.bio, { column: "about", kind: "plain_text" });

  mapCollectionEntity(mapping.entities.categories, {
    fields: basicCollectionFields({
      descriptionColumn: "description_text",
      idColumn: "topic_uuid",
      nameColumn: "name_text",
      slugColumn: "slug_text",
    }),
    primaryKey: "topic_uuid",
    schema,
    table: "topic_groups",
  });
  mapCollectionEntity(mapping.entities.tags, {
    fields: basicCollectionFields({
      descriptionColumn: "description_text",
      idColumn: "label_uuid",
      nameColumn: "name_text",
      slugColumn: "slug_text",
    }),
    primaryKey: "label_uuid",
    schema,
    table: "labels",
  });

  posts.relations.authors = relation("authors", {
    multiple: false,
    sourceColumn: "writer_uuid",
    strategy: "foreign_key",
    targetColumn: "writer_uuid",
    targetTable: tableRef(schema, "writers"),
  });
  posts.relations.categories = relation("categories", {
    junctionSourceColumn: "article_uuid",
    junctionTable: tableRef(schema, "article_topics"),
    junctionTargetColumn: "topic_uuid",
    multiple: true,
    strategy: "join_table",
    targetColumn: "topic_uuid",
    targetTable: tableRef(schema, "topic_groups"),
  });
  posts.relations.tags = relation("tags", {
    junctionSourceColumn: "article_uuid",
    junctionTable: tableRef(schema, "article_labels"),
    junctionTargetColumn: "label_uuid",
    multiple: true,
    strategy: "join_table",
    targetColumn: "label_uuid",
    targetTable: tableRef(schema, "labels"),
  });

  return normalizeContentMappingConfig(mapping);
};

const buildJsonArrayMapping = (schema: string) => {
  const mapping = createDefaultContentMappingConfig();
  const posts = mapping.entities.posts;

  setSource(posts, { primaryKey: "doc_id", schema, table: "documents" });
  posts.fields.id = mapField(posts.fields.id, { column: "doc_id", required: true, visible: false });
  posts.fields.title = mapField(posts.fields.title, {
    column: "payload",
    path: "headline",
    required: true,
    storagePrimitive: "json_path",
  });
  posts.fields.slug = mapField(posts.fields.slug, {
    column: "payload",
    path: "route.slug",
    storagePrimitive: "json_path",
  });
  posts.fields.excerpt = mapField(posts.fields.excerpt, {
    column: "payload",
    kind: "plain_text",
    path: "summary",
    storagePrimitive: "json_path",
  });
  posts.fields.seoTitle = mapField(posts.fields.seoTitle, {
    column: "payload",
    path: "seo.title",
    storagePrimitive: "json_path",
  });
  posts.fields.seoDescription = mapField(posts.fields.seoDescription, {
    column: "payload",
    kind: "plain_text",
    path: "seo.description",
    storagePrimitive: "json_path",
  });
  posts.fields.focusKeyword = mapField(posts.fields.focusKeyword, {
    column: "payload",
    path: "seo.focus",
    storagePrimitive: "json_path",
  });
  posts.fields.publishedAt = mapField(posts.fields.publishedAt, {
    column: "payload",
    kind: "datetime",
    path: "dates.published",
    storagePrimitive: "json_path",
  });
  posts.editorFields = [
    {
      column: "content_html",
      id: "content_html",
      kind: "html",
      label: "Content",
      path: null,
      placeholder: null,
      required: false,
      storagePrimitive: "direct_column",
      visible: true,
    },
  ];
  posts.customFields = [
    {
      allowedValues: null,
      column: "payload",
      dataType: "jsonb",
      defaultValue: null,
      enabled: true,
      fieldKey: "card_title",
      isNullable: true,
      kind: "text",
      label: "Card Title",
      path: "card.title",
      sampleValues: [],
      sourceType: { isArray: false, isJson: true, nativeType: "jsonb" },
      storagePrimitive: "json_path",
    },
    {
      allowedValues: null,
      arrayIndex: 1,
      column: "title_parts",
      dataType: "text[]",
      defaultValue: null,
      enabled: true,
      fieldKey: "secondary_title_part",
      isNullable: true,
      kind: "text",
      label: "Secondary Title Part",
      sampleValues: [],
      sourceType: { isArray: true, isJson: false, nativeType: "text[]" },
      storagePrimitive: "array_item",
    },
  ] satisfies ContentCustomFieldMapping[];

  const authors = mapping.entities.authors;
  setSource(authors, { primaryKey: "author_id", schema, table: "people" });
  authors.fields.id = mapField(authors.fields.id, { column: "author_id", required: true, visible: false });
  authors.fields.name = mapField(authors.fields.name, { column: "full_name", required: true });
  authors.fields.slug = mapField(authors.fields.slug, { column: "slug" });
  authors.fields.email = mapField(authors.fields.email, { column: "email" });
  authors.fields.bio = mapField(authors.fields.bio, { column: "bio", kind: "plain_text" });

  mapCollectionEntity(mapping.entities.tags, {
    fields: basicCollectionFields({
      descriptionColumn: "notes",
      idColumn: "tag_id",
      nameColumn: "label",
      slugColumn: "slug",
    }),
    primaryKey: "tag_id",
    schema,
    table: "tag_bank",
  });

  posts.relations.authors = relation("authors", {
    multiple: false,
    sourceColumn: "primary_author_slug",
    strategy: "value_match_relation",
    targetColumn: "slug",
    targetTable: tableRef(schema, "people"),
  });
  posts.relations.tags = relation("tags", {
    multiple: true,
    sourceColumn: "tag_slugs",
    strategy: "value_match_relation",
    targetColumn: "slug",
    targetTable: tableRef(schema, "tag_bank"),
  });

  return normalizeContentMappingConfig(mapping);
};

const buildHelperMapping = (schema: string) => {
  const mapping = createDefaultContentMappingConfig();
  const posts = mapping.entities.posts;

  setSource(posts, { primaryKey: "story_id", schema, table: "stories" });
  posts.fields.id = mapField(posts.fields.id, { column: "story_id", required: true, visible: false });
  posts.fields.title = mapField(posts.fields.title, { column: "title_text", required: true });
  posts.fields.slug = mapField(posts.fields.slug, { column: "slug_text" });
  posts.fields.status = mapField(posts.fields.status, { column: "state_text" });
  posts.fields.seoTitle = mapField(posts.fields.seoTitle, {
    column: null,
    sourceRelation: {
      junctionSourceColumn: "story_id",
      junctionTable: tableRef(schema, "story_meta"),
      sourceColumn: null,
      strategy: "related_row_by_post_id",
      targetColumn: null,
      targetTable: null,
      valueColumn: "seo_title",
    },
  });
  posts.fields.seoDescription = mapField(posts.fields.seoDescription, {
    column: null,
    kind: "plain_text",
    sourceRelation: {
      junctionSourceColumn: "story_id",
      junctionTable: tableRef(schema, "story_meta"),
      sourceColumn: null,
      strategy: "related_row_by_post_id",
      targetColumn: null,
      targetTable: null,
      valueColumn: "seo_description",
    },
  });
  addCommonPostDates(posts, {
    createdAt: "created_at",
    publishedAt: "published_at",
    updatedAt: "updated_at",
  });
  posts.editorFields = [
    {
      column: null,
      id: "body_helper",
      kind: "markdown",
      label: "Body",
      path: null,
      placeholder: null,
      required: false,
      sourceRelation: {
        junctionSourceColumn: "story_id",
        junctionTable: tableRef(schema, "story_body_rows"),
        sourceColumn: null,
        strategy: "related_row_by_post_id",
        targetColumn: null,
        targetTable: null,
        valueColumn: "body_markdown",
      },
      storagePrimitive: "related_row_by_post_id",
      visible: true,
    },
  ];

  const authors = mapping.entities.authors;
  setSource(authors, { primaryKey: "person_code", schema, table: "contributors" });
  authors.fields.id = mapField(authors.fields.id, { column: "person_code", required: true, visible: false });
  authors.fields.name = mapField(authors.fields.name, { column: "name_text", required: true });
  authors.fields.slug = mapField(authors.fields.slug, { column: "slug_text" });
  authors.fields.email = mapField(authors.fields.email, { column: "email_text" });
  authors.fields.bio = mapField(authors.fields.bio, { column: "bio_text", kind: "plain_text" });

  mapCollectionEntity(mapping.entities.categories, {
    fields: basicCollectionFields({
      descriptionColumn: "details",
      idColumn: "collection_code",
      nameColumn: "name_text",
      slugColumn: "slug_text",
    }),
    primaryKey: "collection_code",
    schema,
    table: "collections",
  });

  posts.relations.authors = relation("authors", {
    junctionSourceColumn: "story_id",
    junctionTable: tableRef(schema, "story_meta"),
    multiple: false,
    strategy: "related_row_by_post_id",
    targetColumn: "slug_text",
    targetTable: tableRef(schema, "contributors"),
    valueColumn: "author_slug",
  });
  posts.relations.categories = relation("categories", {
    junctionSourceColumn: "story_id",
    junctionTable: tableRef(schema, "story_collection_links"),
    junctionTargetColumn: "collection_code",
    multiple: true,
    strategy: "join_table",
    targetColumn: "collection_code",
    targetTable: tableRef(schema, "collections"),
  });

  return normalizeContentMappingConfig(mapping);
};

const buildReadonlyMapping = (schema: string) => {
  const mapping = createDefaultContentMappingConfig();
  const posts = mapping.entities.posts;

  posts.source = {
    kind: "view",
    primaryKey: "post_key",
    schema,
    table: "readonly_posts",
  };
  posts.status = "limited";
  posts.capabilities = {
    browse: true,
    create: false,
    delete: false,
    read: true,
    update: false,
  };
  posts.fields.id = mapField(posts.fields.id, {
    column: "post_key",
    required: true,
    storagePrimitive: "derived_read_only",
    visible: false,
  });
  posts.fields.title = mapField(posts.fields.title, {
    column: "display_title",
    required: true,
    storagePrimitive: "derived_read_only",
  });
  posts.fields.slug = mapField(posts.fields.slug, {
    column: "display_slug",
    storagePrimitive: "derived_read_only",
  });
  posts.editorFields = [
    {
      column: "rendered_html",
      id: "rendered_html",
      kind: "html",
      label: "Rendered Content",
      path: null,
      placeholder: null,
      required: false,
      storagePrimitive: "derived_read_only",
      visible: true,
    },
  ];

  return normalizeContentMappingConfig(mapping);
};

const resetSchema = async (pool: Pool, schema: string) => {
  await pool.query(`drop schema if exists ${quoteIdentifier(schema)} cascade`);
  await pool.query(`create schema ${quoteIdentifier(schema)}`);
};

const seedDirectSchema = async (pool: Pool, schema: string) => {
  await resetSchema(pool, schema);
  await pool.query(`
    create table ${quoteIdentifier(schema)}.writers (
      writer_uuid uuid primary key,
      display_name text not null,
      handle text not null unique,
      email_address text,
      about text
    );

    create table ${quoteIdentifier(schema)}.topic_groups (
      topic_uuid uuid primary key,
      name_text text not null,
      slug_text text not null unique,
      description_text text
    );

    create table ${quoteIdentifier(schema)}.labels (
      label_uuid uuid primary key,
      name_text text not null,
      slug_text text not null unique,
      description_text text
    );

    create table ${quoteIdentifier(schema)}.articles (
      article_id uuid primary key,
      headline text not null,
      route_slug text not null unique,
      body_md text,
      summary text,
      state text not null default 'draft',
      published_on timestamptz,
      created_on timestamptz not null default now(),
      modified_on timestamptz not null default now(),
      writer_uuid uuid references ${quoteIdentifier(schema)}.writers(writer_uuid),
      hero_url text
    );

    create table ${quoteIdentifier(schema)}.article_topics (
      article_uuid uuid not null references ${quoteIdentifier(schema)}.articles(article_id) on delete cascade,
      topic_uuid uuid not null references ${quoteIdentifier(schema)}.topic_groups(topic_uuid) on delete cascade,
      primary key (article_uuid, topic_uuid)
    );

    create table ${quoteIdentifier(schema)}.article_labels (
      article_uuid uuid not null references ${quoteIdentifier(schema)}.articles(article_id) on delete cascade,
      label_uuid uuid not null references ${quoteIdentifier(schema)}.labels(label_uuid) on delete cascade,
      primary key (article_uuid, label_uuid)
    );
  `);

  const authorId = randomUUID();
  const topicId = randomUUID();
  const labelId = randomUUID();
  const postId = randomUUID();

  await pool.query(
    `insert into ${quoteIdentifier(schema)}.writers values ($1, 'Ada Direct', 'ada-direct', 'ada-direct@example.com', 'Direct schema author')`,
    [authorId],
  );
  await pool.query(
    `insert into ${quoteIdentifier(schema)}.topic_groups values ($1, 'Direct Category', 'direct-category', 'Renamed direct-column category')`,
    [topicId],
  );
  await pool.query(
    `insert into ${quoteIdentifier(schema)}.labels values ($1, 'Direct Tag', 'direct-tag', 'Renamed direct-column tag')`,
    [labelId],
  );
  await pool.query(
    `
      insert into ${quoteIdentifier(schema)}.articles (
        article_id, headline, route_slug, body_md, summary, state, published_on, writer_uuid, hero_url
      ) values (
        $1, 'Direct renamed-column post', 'direct-renamed-column-post', '# Direct body', 'Direct excerpt', 'draft', null, $2, 'https://example.com/direct.jpg'
      )
    `,
    [postId, authorId],
  );
  await pool.query(
    `insert into ${quoteIdentifier(schema)}.article_topics values ($1, $2)`,
    [postId, topicId],
  );
  await pool.query(
    `insert into ${quoteIdentifier(schema)}.article_labels values ($1, $2)`,
    [postId, labelId],
  );

  return postId;
};

const seedJsonArraySchema = async (pool: Pool, schema: string) => {
  await resetSchema(pool, schema);
  await pool.query(`
    create table ${quoteIdentifier(schema)}.people (
      author_id uuid primary key,
      full_name text not null,
      slug text not null unique,
      email text,
      bio text
    );

    create table ${quoteIdentifier(schema)}.tag_bank (
      tag_id uuid primary key,
      label text not null,
      slug text not null unique,
      notes text
    );

    create table ${quoteIdentifier(schema)}.documents (
      doc_id uuid primary key,
      payload jsonb not null default '{}'::jsonb,
      content_html text,
      title_parts text[] not null default '{}'::text[],
      tag_slugs text[] not null default '{}'::text[],
      primary_author_slug text,
      published boolean not null default false
    );
  `);

  const authorId = randomUUID();
  const tagId = randomUUID();
  const postId = randomUUID();

  await pool.query(
    `insert into ${quoteIdentifier(schema)}.people values ($1, 'Json Author', 'json-author', 'json-author@example.com', 'Author selected by slug value')`,
    [authorId],
  );
  await pool.query(
    `insert into ${quoteIdentifier(schema)}.tag_bank values ($1, 'JSON Tag', 'json-tag', 'Tag selected from text[] slugs')`,
    [tagId],
  );
  await pool.query(
    `
      insert into ${quoteIdentifier(schema)}.documents (
        doc_id, payload, content_html, title_parts, tag_slugs, primary_author_slug, published
      ) values (
        $1,
        $2::jsonb,
        '<p>JSON-backed body</p>',
        array['prefix', 'secondary seeded part', 'suffix'],
        array['json-tag'],
        'json-author',
        false
      )
    `,
    [
      postId,
      JSON.stringify({
        card: { title: "Seeded Card" },
        dates: { published: null },
        headline: "JSON path post",
        route: { slug: "json-path-post" },
        seo: {
          description: "JSON SEO description",
          focus: "json focus",
          title: "JSON SEO title",
        },
        summary: "JSON summary",
      }),
    ],
  );

  return postId;
};

const seedHelperSchema = async (pool: Pool, schema: string) => {
  await resetSchema(pool, schema);
  await pool.query(`
    create table ${quoteIdentifier(schema)}.contributors (
      person_code text primary key,
      name_text text not null,
      slug_text text not null unique,
      email_text text,
      bio_text text
    );

    create table ${quoteIdentifier(schema)}.collections (
      collection_code text primary key,
      name_text text not null,
      slug_text text not null unique,
      details text
    );

    create table ${quoteIdentifier(schema)}.stories (
      story_id uuid primary key,
      title_text text not null,
      slug_text text not null unique,
      state_text text not null default 'draft',
      published_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table ${quoteIdentifier(schema)}.story_meta (
      story_id uuid primary key references ${quoteIdentifier(schema)}.stories(story_id) on delete cascade,
      seo_title text,
      seo_description text,
      author_slug text
    );

    create table ${quoteIdentifier(schema)}.story_body_rows (
      story_id uuid primary key references ${quoteIdentifier(schema)}.stories(story_id) on delete cascade,
      body_markdown text
    );

    create table ${quoteIdentifier(schema)}.story_collection_links (
      story_id uuid not null references ${quoteIdentifier(schema)}.stories(story_id) on delete cascade,
      collection_code text not null references ${quoteIdentifier(schema)}.collections(collection_code) on delete cascade,
      primary key (story_id, collection_code)
    );
  `);

  const postId = randomUUID();

  await pool.query(
    `insert into ${quoteIdentifier(schema)}.contributors values ('helper-author', 'Helper Author', 'helper-author', 'helper-author@example.com', 'Author stored through helper row slug')`,
  );
  await pool.query(
    `insert into ${quoteIdentifier(schema)}.collections values ('helper-category', 'Helper Category', 'helper-category', 'Category from helper schema')`,
  );
  await pool.query(
    `insert into ${quoteIdentifier(schema)}.stories values ($1, 'Helper-row post', 'helper-row-post', 'draft', null, now(), now())`,
    [postId],
  );
  await pool.query(
    `insert into ${quoteIdentifier(schema)}.story_meta values ($1, 'Helper SEO title', 'Helper SEO description', 'helper-author')`,
    [postId],
  );
  await pool.query(
    `insert into ${quoteIdentifier(schema)}.story_body_rows values ($1, 'Helper markdown body')`,
    [postId],
  );
  await pool.query(
    `insert into ${quoteIdentifier(schema)}.story_collection_links values ($1, 'helper-category')`,
    [postId],
  );

  return postId;
};

const seedReadonlySchema = async (pool: Pool, schema: string) => {
  await resetSchema(pool, schema);
  await pool.query(`
    create table ${quoteIdentifier(schema)}.source_posts (
      post_key uuid primary key,
      title text not null,
      slug text not null unique,
      body_html text
    );

    create view ${quoteIdentifier(schema)}.readonly_posts as
      select
        post_key,
        upper(title) as display_title,
        slug as display_slug,
        body_html as rendered_html
      from ${quoteIdentifier(schema)}.source_posts;
  `);

  const postId = randomUUID();

  await pool.query(
    `
      insert into ${quoteIdentifier(schema)}.source_posts values (
        $1, 'Readonly view post', 'readonly-view-post', '<p>Readonly rendered body</p>'
      );
    `,
    [postId],
  );

  return postId;
};

const upsertProject = async (
  pool: Pool,
  {
    mappingConfig,
    name,
    postId,
    schema,
    slug,
    userId,
  }: {
    mappingConfig: ContentMappingConfig;
    name: string;
    postId: string;
    schema: string;
    slug: string;
    userId: string;
  },
): Promise<SeededProject> => {
  const id = randomUUID();

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
        returning id
      `,
      [id, name, slug, `https://smoke.local/${schema}`, userId],
    );
    const resolvedProject = await pool.query<{ id: string }>(
      `select id from public.basebuddy_projects where slug = $1`,
      [slug],
    );
    const projectId = resolvedProject.rows[0]?.id ?? id;

    await pool.query(
      `
        insert into public.basebuddy_project_members (project_id, user_id)
        values ($1, $2)
        on conflict do nothing
      `,
      [projectId, userId],
    );
    await pool.query(
      `
        insert into public.basebuddy_project_member_roles (project_id, user_id, role_key)
        values ($1, $2, 'owner')
        on conflict do nothing
      `,
      [projectId, userId],
    );
    const revisionVersionResult = await pool.query<{ next_version: number }>(
      `
        select coalesce(max(version), 0) + 1 as next_version
        from private.basebuddy_project_content_mapping_revisions
        where project_id = $1
      `,
      [projectId],
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
      [projectId, nextRevisionVersion, JSON.stringify(mappingConfig), userId],
    );
    await pool.query("commit");

    return {
      id: projectId,
      name,
      postId,
      schema,
      slug,
    };
  } catch (error) {
    await pool.query("rollback");
    throw error;
  }
};

const main = async () => {
  const controlDatabaseUrl = getEnv("BASEBUDDY_CONTROL_DATABASE_URL");
  const contentDatabaseUrl = getEnv("BASEBUDDY_CONTENT_DATABASE_URL");
  const smokeUserEmail =
    process.env.BASEBUDDY_SMOKE_USER_EMAIL?.trim() ||
    process.env.PLAYWRIGHT_OWNER_EMAIL?.trim() ||
    "tejapragna2125@gmail.com";
  const runKey =
    process.env.BASEBUDDY_SCHEMA_ZOO_RUN_KEY?.trim() ||
    new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");

  const contentPool = createPool(contentDatabaseUrl);
  const controlPool = createPool(controlDatabaseUrl);
  const seeded: SeededProject[] = [];

  try {
    const userResult = await controlPool.query<{ id: string }>(
      `select id from public.basebuddy_profiles where lower(email) = lower($1) limit 1`,
      [smokeUserEmail],
    );
    const userId = userResult.rows[0]?.id;

    if (!userId) {
      throw new Error(`No BaseBuddy profile found for ${smokeUserEmail}`);
    }

    const directSchema = `bb_zoo_direct_${runKey}`;
    const jsonSchema = `bb_zoo_json_${runKey}`;
    const helperSchema = `bb_zoo_helper_${runKey}`;
    const readonlySchema = `bb_zoo_readonly_${runKey}`;

    const directPostId = await seedDirectSchema(contentPool, directSchema);
    const jsonPostId = await seedJsonArraySchema(contentPool, jsonSchema);
    const helperPostId = await seedHelperSchema(contentPool, helperSchema);
    const readonlyPostId = await seedReadonlySchema(contentPool, readonlySchema);

    seeded.push(
      await upsertProject(controlPool, {
        mappingConfig: buildDirectMapping(directSchema),
        name: `Schema Zoo Direct ${runKey}`,
        postId: directPostId,
        schema: directSchema,
        slug: `bb-zoo-direct-${runKey}`,
        userId,
      }),
      await upsertProject(controlPool, {
        mappingConfig: buildJsonArrayMapping(jsonSchema),
        name: `Schema Zoo JSON ${runKey}`,
        postId: jsonPostId,
        schema: jsonSchema,
        slug: `bb-zoo-json-${runKey}`,
        userId,
      }),
      await upsertProject(controlPool, {
        mappingConfig: buildHelperMapping(helperSchema),
        name: `Schema Zoo Helper ${runKey}`,
        postId: helperPostId,
        schema: helperSchema,
        slug: `bb-zoo-helper-${runKey}`,
        userId,
      }),
      await upsertProject(controlPool, {
        mappingConfig: buildReadonlyMapping(readonlySchema),
        name: `Schema Zoo Readonly ${runKey}`,
        postId: readonlyPostId,
        schema: readonlySchema,
        slug: `bb-zoo-readonly-${runKey}`,
        userId,
      }),
    );
  } finally {
    await contentPool.end();
    await controlPool.end();
  }

  console.log(JSON.stringify({ projects: seeded }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
