import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { Client as PgClient } from "pg";

import { createBaseBuddyConfigUser } from "../../src/lib/basebuddy-config/auth";
import {
  addConfigProjectMemberByEmail,
  ConfigProjectSlugConflictError,
  createConfigProject,
  getConfigProjectForUserBySlug,
  saveConfigProjectContentMappingRevision,
  updateConfigProjectMemberAccess,
  updateConfigProjectMetadata,
} from "../../src/lib/basebuddy-config/projects";
import {
  ensureBaseBuddyConfig,
  loadBaseBuddyConfig,
  writeBaseBuddyConfig,
} from "../../src/lib/basebuddy-config/store";
import {
  createDefaultContentMappingConfig,
  type ContentMappingConfig,
} from "../../src/lib/content-runtime/mapping";

import {
  PLAYWRIGHT_CACHE_DIR,
  PLAYWRIGHT_SEED_STATE_PATH,
  type PlaywrightSeedState,
  type PlaywrightSeedUserKey,
} from "../support/state";
import {
  resolvePlaywrightSeedContentSupabaseSecretKey,
  resolvePlaywrightSeedContentSupabaseUrl,
  resolvePlaywrightSeedDatabaseUrl,
  resolvePlaywrightSeedProjectName,
  resolvePlaywrightSeedProjectSlug,
  resolvePlaywrightSeedRootCertificate,
  resolvePlaywrightSeedRootCertificateFile,
  shouldUsePlaywrightSeedDatabaseSsl,
} from "../support/seed-env";

type SupabaseLikeClient = any;

type TestUserConfig = {
  email: string;
  label: string;
  password: string;
};

type SeedProjectConfig = {
  name: string;
  slug: string;
};

type SeedEnvironment = {
  contentDatabaseUrl: string;
  contentStorageServiceRoleKey: string;
  contentStorageUrl: string;
  project: SeedProjectConfig;
  rootCertificate: string | null;
  users: Record<PlaywrightSeedUserKey, TestUserConfig>;
};

const SELF_HOST_MEDIA_BUCKET = "pw-self-host-media";
// Playwright seed writes BaseBuddy users, members, and mapping to basebuddy-data/basebuddy.config.json.
const SELF_HOST_TABLE_NAMES = {
  authors: "pw_self_host_authors",
  categories: "pw_self_host_categories",
  postCategories: "pw_self_host_post_categories",
  posts: "pw_self_host_posts",
  postTags: "pw_self_host_post_tags",
  tags: "pw_self_host_tags",
} as const;

const SELF_HOST_AUTHOR_IDS = {
  assigned: "20000000-0000-0000-0000-000000000101",
  other: "20000000-0000-0000-0000-000000000102",
} as const;

const ROLE_DISPLAY_NAMES: Record<PlaywrightSeedUserKey, string> = {
  owner: "Playwright Owner",
  admin: "Playwright Admin",
  editor: "Playwright Editor",
  author: "Playwright Author",
  viewer: "Playwright Viewer",
};

const ROLE_PROJECT_ROLES: Record<PlaywrightSeedUserKey, string[]> = {
  owner: ["owner"],
  admin: ["admin"],
  editor: ["editor"],
  author: ["author"],
  viewer: ["viewer"],
};

const SEED_IMAGE_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2pL0YAAAAASUVORK5CYII=",
  "base64",
);
const SEED_TEXT_BYTES = Buffer.from("Playwright self-host file smoke seed.\n", "utf8");

const buildRichTextDocument = (text: string) => ({
  content: [
    {
      content: [{ text, type: "text" }],
      type: "paragraph",
    },
  ],
  type: "doc",
});

const buildSelfHostMappingConfig = (): ContentMappingConfig => {
  const mappingConfig = createDefaultContentMappingConfig();

  mappingConfig.entities.posts.capabilities = {
    browse: true,
    create: true,
    delete: true,
    read: true,
    update: true,
  };
  mappingConfig.entities.posts.status = "mapped";
  mappingConfig.entities.posts.source = {
    kind: "table",
    primaryKey: "id",
    schema: "public",
    table: SELF_HOST_TABLE_NAMES.posts,
  };
  mappingConfig.entities.posts.fields.id.column = "id";
  mappingConfig.entities.posts.fields.title.column = "title";
  mappingConfig.entities.posts.fields.slug.column = "slug";
  mappingConfig.entities.posts.fields.status.column = "status";
  mappingConfig.entities.posts.fields.excerpt.column = "excerpt";
  mappingConfig.entities.posts.fields.seoTitle.column = "seo_title";
  mappingConfig.entities.posts.fields.seoDescription.column = "seo_description";
  mappingConfig.entities.posts.fields.focusKeyword.column = "focus_keyword";
  mappingConfig.entities.posts.fields.featuredImageUrl.column = "featured_image_url";
  mappingConfig.entities.posts.fields.redirects.column = "redirect_paths";
  mappingConfig.entities.posts.fields.redirects.kind = "array";
  mappingConfig.entities.posts.fields.publishedAt.column = "published_at";
  mappingConfig.entities.posts.fields.createdAt.column = "created_at";
  mappingConfig.entities.posts.fields.updatedAt.column = "updated_at";
  mappingConfig.entities.posts.editorFields = [
    {
      column: "content_html",
      id: "content",
      kind: "html",
      label: "Content",
      placeholder: null,
      required: false,
      visible: true,
    },
  ];
  mappingConfig.entities.posts.companionContentColumns = [{ column: "content_json", kind: "json" }];
  mappingConfig.entities.posts.workflow = {
    archivedValues: ["archived"],
    customValues: [],
    draftValues: ["draft"],
    mode: "status",
    publishedAtColumn: "published_at",
    publishedFlagColumn: null,
    publishedValues: ["published"],
    statusColumn: "status",
  };
  mappingConfig.entities.posts.relations.authors = {
    fieldMap: {},
    junctionSourceColumn: null,
    junctionTable: null,
    junctionTargetColumn: null,
    multiple: false,
    sourceColumn: "author_id",
    status: "mapped",
    strategy: "foreign_key",
    targetColumn: "id",
    targetEntity: "authors",
    targetTable: SELF_HOST_TABLE_NAMES.authors,
    valueColumn: null,
  };
  mappingConfig.entities.posts.relations.categories = {
    fieldMap: {},
    junctionSourceColumn: "post_id",
    junctionTable: SELF_HOST_TABLE_NAMES.postCategories,
    junctionTargetColumn: "category_id",
    multiple: true,
    sourceColumn: null,
    status: "mapped",
    strategy: "join_table",
    targetColumn: "id",
    targetEntity: "categories",
    targetTable: SELF_HOST_TABLE_NAMES.categories,
    valueColumn: null,
  };
  mappingConfig.entities.posts.relations.tags = {
    fieldMap: {},
    junctionSourceColumn: "post_id",
    junctionTable: SELF_HOST_TABLE_NAMES.postTags,
    junctionTargetColumn: "tag_id",
    multiple: true,
    sourceColumn: null,
    status: "mapped",
    strategy: "join_table",
    targetColumn: "id",
    targetEntity: "tags",
    targetTable: SELF_HOST_TABLE_NAMES.tags,
    valueColumn: null,
  };

  for (const [entityKey, tableName] of [
    ["authors", SELF_HOST_TABLE_NAMES.authors],
    ["categories", SELF_HOST_TABLE_NAMES.categories],
    ["tags", SELF_HOST_TABLE_NAMES.tags],
  ] as const) {
    const entity = mappingConfig.entities[entityKey];

    entity.capabilities = {
      browse: true,
      create: true,
      delete: true,
      read: true,
      update: true,
    };
    entity.status = "mapped";
    entity.source = {
      kind: "table",
      primaryKey: "id",
      schema: "public",
      table: tableName,
    };
    entity.fields.id.column = "id";
    entity.fields.name.column = "name";
    entity.fields.slug.column = "slug";
  }

  mappingConfig.entities.authors.fields.email.column = "email";
  mappingConfig.entities.authors.fields.bio.column = "bio";
  mappingConfig.entities.categories.fields.description.column = "description";
  mappingConfig.entities.categories.fields.parentId.column = "parent_category_id";
  mappingConfig.entities.tags.fields.description.column = "description";
  mappingConfig.mediaStorage = {
    bucketName: SELF_HOST_MEDIA_BUCKET,
    endpoint: null,
    provider: "supabase_bucket",
    publicUrlBase: null,
    region: null,
  };
  mappingConfig.filesStorage = {
    bucketName: SELF_HOST_MEDIA_BUCKET,
    endpoint: null,
    provider: "supabase_bucket",
    publicUrlBase: null,
    region: null,
  };

  return mappingConfig;
};

const requireEnv = (key: string, value: string | null = process.env[key]?.trim() || null) => {
  if (value) {
    return value;
  }

  throw new Error(`Missing required environment variable: ${key}`);
};

const loadRootCertificate = async () => {
  const inlineValue = resolvePlaywrightSeedRootCertificate(process.env)?.replace(/\\n/g, "\n").trim();

  if (inlineValue) {
    return inlineValue;
  }

  const filePath = resolvePlaywrightSeedRootCertificateFile(process.env);

  if (!filePath) {
    return null;
  }

  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  return (await readFile(resolvedPath, "utf8")).trim();
};

const loadSeedEnvironment = async (): Promise<SeedEnvironment> => {
  const contentDatabaseUrl = resolvePlaywrightSeedDatabaseUrl(process.env);
  const projectName = resolvePlaywrightSeedProjectName(process.env);
  const projectSlug = resolvePlaywrightSeedProjectSlug(process.env);

  if (!contentDatabaseUrl) {
    throw new Error("Missing required environment variable: BASEBUDDY_CONTENT_DATABASE_URL");
  }

  if (!projectName) {
    throw new Error("Missing required environment variable: PLAYWRIGHT_PROJECT_NAME");
  }

  if (!projectSlug) {
    throw new Error("Missing required environment variable: PLAYWRIGHT_PROJECT_SLUG");
  }

  return {
    contentStorageServiceRoleKey: requireEnv(
      "BASEBUDDY_SUPABASE_SECRET_KEY",
      resolvePlaywrightSeedContentSupabaseSecretKey(process.env),
    ),
    contentStorageUrl: requireEnv(
      "BASEBUDDY_SUPABASE_URL",
      resolvePlaywrightSeedContentSupabaseUrl(process.env),
    ),
    contentDatabaseUrl,
    project: {
      name: projectName,
      slug: projectSlug,
    },
    rootCertificate: await loadRootCertificate(),
    users: {
      owner: {
        email: requireEnv("PLAYWRIGHT_OWNER_EMAIL"),
        label: ROLE_DISPLAY_NAMES.owner,
        password: requireEnv("PLAYWRIGHT_OWNER_PASSWORD"),
      },
      admin: {
        email: requireEnv("PLAYWRIGHT_ADMIN_EMAIL"),
        label: ROLE_DISPLAY_NAMES.admin,
        password: requireEnv("PLAYWRIGHT_ADMIN_PASSWORD"),
      },
      editor: {
        email: requireEnv("PLAYWRIGHT_EDITOR_EMAIL"),
        label: ROLE_DISPLAY_NAMES.editor,
        password: requireEnv("PLAYWRIGHT_EDITOR_PASSWORD"),
      },
      author: {
        email: requireEnv("PLAYWRIGHT_AUTHOR_EMAIL"),
        label: ROLE_DISPLAY_NAMES.author,
        password: requireEnv("PLAYWRIGHT_AUTHOR_PASSWORD"),
      },
      viewer: {
        email: requireEnv("PLAYWRIGHT_VIEWER_EMAIL"),
        label: ROLE_DISPLAY_NAMES.viewer,
        password: requireEnv("PLAYWRIGHT_VIEWER_PASSWORD"),
      },
    },
  };
};

const createSupabaseAdminClient = (url: string, key: string) =>
  createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }) as SupabaseLikeClient;

const createPgClient = async ({
  connectionString,
  rootCertificate,
}: {
  connectionString: string;
  rootCertificate: string | null;
}) => {
  return (await withSeedRetry(
    "Connect seed database",
    async () => {
      const client = new PgClient({
        connectionString,
        connectionTimeoutMillis: 30_000,
        query_timeout: 120_000,
        ssl: rootCertificate
          ? {
              ca: rootCertificate,
              rejectUnauthorized: true,
            }
          : shouldUsePlaywrightSeedDatabaseSsl(process.env, connectionString)
            ? {
                rejectUnauthorized: false,
              }
            : undefined,
        statement_timeout: 120_000,
      });

      try {
        await client.connect();
        return client;
      } catch (error) {
        await client.end().catch(() => undefined);
        throw error;
      }
    },
    () => null,
  )) as PgClient;
};

const quoteIdentifier = (value: string) => `"${value.replace(/"/g, "\"\"")}"`;
const qualifyPublicTable = (tableName: string) => `public.${quoteIdentifier(tableName)}`;

const isTransientSeedError = (error: unknown) => {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");

  return /fetch failed|timeout|timed out|network|econnreset|etimedout|ECHECKOUTTIMEOUT|und_err|unexpected token|valid json/i.test(
    message,
  );
};

async function withSeedRetry(
  label: string,
  work: () => Promise<any>,
  getError: (result: any) => unknown,
) {
  let lastResult: any = null;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const timeoutMs = 30_000;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const result = await Promise.race([
        work(),
        new Promise((_resolve, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
          }, timeoutMs);
        }),
      ]).finally(() => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      });
      const resultError = getError(result);

      if (!resultError || !isTransientSeedError(resultError) || attempt === 3) {
        return result;
      }

      lastResult = result;
      lastError = resultError;
    } catch (error) {
      if (!isTransientSeedError(error) || attempt === 3) {
        throw error;
      }

      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
  }

  if (lastResult) {
    return lastResult;
  }

  throw new Error(`${label} failed after retries. ${lastError instanceof Error ? lastError.message : ""}`.trim());
}

const ensureConfigUser = async ({
  email,
  label,
  password,
}: {
  email: string;
  label: string;
  password: string;
}) => {
  const config = await loadBaseBuddyConfig();
  const existingUser = config.users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;

  if (existingUser) {
    return {
      email: existingUser.email,
      id: existingUser.id,
    };
  }

  const createdUser = await createBaseBuddyConfigUser({
    email,
    name: label,
    password,
  });

  if (!createdUser) {
    throw new Error(`Could not create config user ${email}.`);
  }

  return {
    email: createdUser.email,
    id: createdUser.id,
  };
};

const createSeedProjectWithDatabase = async ({
  name,
  ownerUserId,
  slug,
}: {
  name: string;
  ownerUserId: string;
  slug: string;
}) => {
  const existingProject = await getConfigProjectForUserBySlug({
    projectSlug: slug,
    userId: ownerUserId,
  });

  if (existingProject.project) {
    const project = await updateConfigProjectMetadata({
      name,
      projectId: existingProject.project.id,
      slug,
      websiteUrl: null,
    });
    return project.id;
  }

  const project = await createConfigProject({
    name,
    slug,
    userId: ownerUserId,
  }).catch(async (error) => {
    if (!(error instanceof ConfigProjectSlugConflictError)) {
      throw error;
    }

    const existing = await getConfigProjectForUserBySlug({
      projectSlug: slug,
      userId: ownerUserId,
    });

    if (!existing.project) {
      throw error;
    }

    return updateConfigProjectMetadata({
      name,
      projectId: existing.project.id,
      slug,
      websiteUrl: null,
    });
  });

  return project.id;
};

const ensureSupabaseBucket = async ({
  adminClient,
  bucketName,
}: {
  adminClient: SupabaseLikeClient;
  bucketName: string;
}) => {
  const { data: buckets, error: listError } = await adminClient.storage.listBuckets();

  if (listError) {
    throw new Error(`Could not list storage buckets. ${listError.message}`);
  }

  if (buckets.some((bucket) => bucket.name === bucketName)) {
    return;
  }

  const { error } = await adminClient.storage.createBucket(bucketName, {
    public: false,
  });

  if (error && !/already exists/i.test(error.message)) {
    throw new Error(`Could not create storage bucket ${bucketName}. ${error.message}`);
  }
};

const uploadSeedImage = async ({
  adminClient,
  bucketName,
  fileName,
}: {
  adminClient: SupabaseLikeClient;
  bucketName: string;
  fileName: string;
}) => {
  const objectPath = `seed/${fileName}`;
  const { error } = await adminClient.storage.from(bucketName).upload(objectPath, SEED_IMAGE_BYTES, {
    contentType: "image/png",
    upsert: true,
  });

  if (error) {
    throw new Error(`Could not upload ${fileName} to ${bucketName}. ${error.message}`);
  }

  return objectPath;
};

const uploadSeedFile = async ({
  adminClient,
  bucketName,
  fileName,
}: {
  adminClient: SupabaseLikeClient;
  bucketName: string;
  fileName: string;
}) => {
  const objectPath = `seed/${fileName}`;
  const { error } = await adminClient.storage.from(bucketName).upload(objectPath, SEED_TEXT_BYTES, {
    contentType: "text/plain",
    upsert: true,
  });

  if (error) {
    throw new Error(`Could not upload ${fileName} to ${bucketName}. ${error.message}`);
  }

  return objectPath;
};

const resetSelfHostTables = async (pgClient: PgClient) => {
  const tables = Object.values(SELF_HOST_TABLE_NAMES).map((tableName) => qualifyPublicTable(tableName));

  await pgClient.query("begin");

  try {
    await pgClient.query(
      `drop table if exists ${tables[4]}, ${tables[2]}, ${tables[0]}, ${tables[1]}, ${tables[5]}, ${tables[3]} cascade`,
    );
    await pgClient.query(`
      create table if not exists ${qualifyPublicTable(SELF_HOST_TABLE_NAMES.authors)} (
        id uuid primary key,
        name text not null,
        slug text not null unique,
        email text,
        bio text,
        created_at timestamptz not null default timezone('utc', now()),
        updated_at timestamptz not null default timezone('utc', now())
      )
    `);
    await pgClient.query(`
      create table if not exists ${qualifyPublicTable(SELF_HOST_TABLE_NAMES.categories)} (
        id uuid primary key,
        name text not null,
        slug text not null unique,
        description text,
        parent_category_id uuid references ${qualifyPublicTable(SELF_HOST_TABLE_NAMES.categories)}(id) on delete set null,
        created_at timestamptz not null default timezone('utc', now()),
        updated_at timestamptz not null default timezone('utc', now())
      )
    `);
    await pgClient.query(`
      create table if not exists ${qualifyPublicTable(SELF_HOST_TABLE_NAMES.tags)} (
        id uuid primary key,
        name text not null,
        slug text not null unique,
        description text,
        created_at timestamptz not null default timezone('utc', now()),
        updated_at timestamptz not null default timezone('utc', now())
      )
    `);
    await pgClient.query(`
      create table if not exists ${qualifyPublicTable(SELF_HOST_TABLE_NAMES.posts)} (
        id uuid primary key,
        author_id uuid references ${qualifyPublicTable(SELF_HOST_TABLE_NAMES.authors)}(id) on delete set null,
        title text not null,
        slug text not null unique,
        status text not null check (status in ('draft', 'published', 'archived')) default 'draft',
        excerpt text,
        content_json jsonb not null,
        content_html text not null,
        seo_title text,
        seo_description text,
        focus_keyword text,
        featured_image_url text,
        redirect_paths text[] not null default '{}'::text[],
        published_at timestamptz,
        created_at timestamptz not null default timezone('utc', now()),
        updated_at timestamptz not null default timezone('utc', now())
      )
    `);
    await pgClient.query(`
      create table if not exists ${qualifyPublicTable(SELF_HOST_TABLE_NAMES.postCategories)} (
        post_id uuid not null references ${qualifyPublicTable(SELF_HOST_TABLE_NAMES.posts)}(id) on delete cascade,
        category_id uuid not null references ${qualifyPublicTable(SELF_HOST_TABLE_NAMES.categories)}(id) on delete cascade,
        created_at timestamptz not null default timezone('utc', now()),
        primary key (post_id, category_id)
      )
    `);
    await pgClient.query(`
      create table if not exists ${qualifyPublicTable(SELF_HOST_TABLE_NAMES.postTags)} (
        post_id uuid not null references ${qualifyPublicTable(SELF_HOST_TABLE_NAMES.posts)}(id) on delete cascade,
        tag_id uuid not null references ${qualifyPublicTable(SELF_HOST_TABLE_NAMES.tags)}(id) on delete cascade,
        created_at timestamptz not null default timezone('utc', now()),
        primary key (post_id, tag_id)
      )
    `);
    await pgClient.query("commit");
  } catch (error) {
    await pgClient.query("rollback");
    throw error;
  }
};

const seedSelfHostProjectData = async ({
  pgClient,
  storageAdminClient,
}: {
  pgClient: PgClient;
  storageAdminClient: SupabaseLikeClient;
}) => {
  await resetSelfHostTables(pgClient);
  await ensureSupabaseBucket({
    adminClient: storageAdminClient,
    bucketName: SELF_HOST_MEDIA_BUCKET,
  });
  await uploadSeedImage({
    adminClient: storageAdminClient,
    bucketName: SELF_HOST_MEDIA_BUCKET,
    fileName: "self-host-seed.png",
  });
  await uploadSeedFile({
    adminClient: storageAdminClient,
    bucketName: SELF_HOST_MEDIA_BUCKET,
    fileName: "self-host-seed.txt",
  });

  await pgClient.query(
    `
      insert into ${qualifyPublicTable(SELF_HOST_TABLE_NAMES.authors)} (id, name, slug, email, bio)
      values
        ($1, $2, $3, $4, $5),
        ($6, $7, $8, $9, $10)
    `,
    [
      SELF_HOST_AUTHOR_IDS.assigned,
      "Self Host Assigned Author",
      "self-host-assigned-author",
      "assigned-self-host@author.test",
      "Assigned author for self-host tests.",
      SELF_HOST_AUTHOR_IDS.other,
      "Self Host Other Author",
      "self-host-other-author",
      "other-self-host@author.test",
      "Secondary self-host author.",
    ],
  );

  await pgClient.query(
    `
      insert into ${qualifyPublicTable(SELF_HOST_TABLE_NAMES.categories)} (id, name, slug, description)
      values
        ($1, $2, $3, $4),
        ($5, $6, $7, $8)
    `,
    [
      "20000000-0000-0000-0000-000000000201",
      "Self Host News",
      "self-host-news",
      "Seed category for self-host tests.",
      "20000000-0000-0000-0000-000000000202",
      "Self Host Features",
      "self-host-features",
      "Secondary self-host category.",
    ],
  );

  await pgClient.query(
    `
      insert into ${qualifyPublicTable(SELF_HOST_TABLE_NAMES.tags)} (id, name, slug, description)
      values
        ($1, $2, $3, $4),
        ($5, $6, $7, $8)
    `,
    [
      "20000000-0000-0000-0000-000000000301",
      "Self Host Tag",
      "self-host-tag",
      "Seed tag for self-host tests.",
      "20000000-0000-0000-0000-000000000302",
      "Ops",
      "ops",
      "Secondary self-host tag.",
    ],
  );

  await pgClient.query(
    `
      insert into ${qualifyPublicTable(SELF_HOST_TABLE_NAMES.posts)} (
        id,
        author_id,
        title,
        slug,
        status,
        excerpt,
        content_json,
        content_html,
        seo_title,
        seo_description,
        focus_keyword,
        redirect_paths,
        published_at
      )
      values
        ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12::text[], null),
        ($13, $14, $15, $16, $17, $18, $19::jsonb, $20, $21, $22, $23, $24::text[], timezone('utc', now())),
        ($25, $26, $27, $28, $29, $30, $31::jsonb, $32, $33, $34, $35, $36::text[], null)
    `,
    [
      "20000000-0000-0000-0000-000000000501",
      SELF_HOST_AUTHOR_IDS.assigned,
      "Self Host Assigned Draft",
      "self-host-assigned-draft",
      "draft",
      "Draft assigned to the self-host author test account.",
      JSON.stringify(buildRichTextDocument("Self-host assigned draft body.")),
      "<p>Self-host assigned draft body.</p>",
      "Self Host Assigned Draft",
      "Draft assigned to the self-host author test account.",
      "self host draft",
      ["legacy-self-host-draft", "older-self-host-draft"],
      "20000000-0000-0000-0000-000000000502",
      SELF_HOST_AUTHOR_IDS.other,
      "Self Host Other Published",
      "self-host-other-published",
      "published",
      "Published post owned by the secondary self-host author.",
      JSON.stringify(buildRichTextDocument("Self-host published body.")),
      "<p>Self-host published body.</p>",
      "Self Host Other Published",
      "Published post owned by the secondary self-host author.",
      "self host published",
      [],
      "20000000-0000-0000-0000-000000000503",
      SELF_HOST_AUTHOR_IDS.other,
      "Self Host Archived Story",
      "self-host-archived-story",
      "archived",
      "Archived self-host story for status coverage.",
      JSON.stringify(buildRichTextDocument("Self-host archived body.")),
      "<p>Self-host archived body.</p>",
      "Self Host Archived Story",
      "Archived self-host story for status coverage.",
      "self host archived",
      [],
    ],
  );

  await pgClient.query(
    `
      insert into ${qualifyPublicTable(SELF_HOST_TABLE_NAMES.postCategories)} (post_id, category_id)
      values
        ($1, $2),
        ($3, $4)
    `,
    [
      "20000000-0000-0000-0000-000000000501",
      "20000000-0000-0000-0000-000000000201",
      "20000000-0000-0000-0000-000000000502",
      "20000000-0000-0000-0000-000000000202",
    ],
  );

  await pgClient.query(
    `
      insert into ${qualifyPublicTable(SELF_HOST_TABLE_NAMES.postTags)} (post_id, tag_id)
      values
        ($1, $2),
        ($3, $4)
    `,
    [
      "20000000-0000-0000-0000-000000000501",
      "20000000-0000-0000-0000-000000000301",
      "20000000-0000-0000-0000-000000000502",
      "20000000-0000-0000-0000-000000000302",
    ],
  );

  return {
    assignedAuthorId: SELF_HOST_AUTHOR_IDS.assigned,
    mediaBucket: SELF_HOST_MEDIA_BUCKET,
  };
};

const seedProjectMappingRevision = async ({
  projectId,
}: {
  projectId: string;
}) => {
  await saveConfigProjectContentMappingRevision({
    bindingStatus: "ready",
    mappingConfig: buildSelfHostMappingConfig(),
    projectId,
    source: "system",
  });
};

const seedProjectMembers = async ({
  authorScopeId,
  projectId,
  users,
}: {
  authorScopeId: string;
  projectId: string;
  users: PlaywrightSeedState["users"];
}) => {
  const userEntries = Object.entries(users) as Array<
    [PlaywrightSeedUserKey, PlaywrightSeedState["users"][PlaywrightSeedUserKey]]
  >;

  for (const [roleKey, user] of userEntries) {
    const memberAccessInput = {
      actorUserId: users.owner.userId,
      authorScopes:
        roleKey === "author"
          ? [
              {
                canPublish: true,
                cmsAuthorId: authorScopeId,
              },
            ]
          : [],
      projectId,
      roles: ROLE_PROJECT_ROLES[roleKey],
      userId: user.userId,
    };

    await updateConfigProjectMemberAccess(memberAccessInput).catch(async (error) => {
      if (!(error instanceof Error) || !/Project member not found/i.test(error.message)) {
        throw error;
      }

      await addConfigProjectMemberByEmail({
        actorUserId: memberAccessInput.actorUserId,
        authorScopes: memberAccessInput.authorScopes,
        email: user.email,
        projectId: memberAccessInput.projectId,
        roles: memberAccessInput.roles,
      });
    });
  }
};

const writeSeedState = async (seedState: PlaywrightSeedState) => {
  await mkdir(PLAYWRIGHT_CACHE_DIR, { recursive: true });
  await writeFile(PLAYWRIGHT_SEED_STATE_PATH, `${JSON.stringify(seedState, null, 2)}\n`, "utf8");
};

const loadCachedSeedUsers = async (env: SeedEnvironment) => {
  try {
    const cachedSeedState = JSON.parse(
      await readFile(PLAYWRIGHT_SEED_STATE_PATH, "utf8"),
    ) as PlaywrightSeedState;

    if (cachedSeedState.contentDatabaseUrl !== env.contentDatabaseUrl) {
      return null;
    }

    for (const [key, userConfig] of Object.entries(env.users) as Array<[PlaywrightSeedUserKey, TestUserConfig]>) {
      const cachedUser = cachedSeedState.users[key];

      if (!cachedUser?.userId || cachedUser.email !== userConfig.email) {
        return null;
      }
    }

    return cachedSeedState.users;
  } catch {
    return null;
  }
};

export const seedPlaywrightEnvironment = async (): Promise<PlaywrightSeedState> => {
  const env = await loadSeedEnvironment();
  await ensureBaseBuddyConfig({
    content: {
      provider: "postgres",
    },
  });
  await writeBaseBuddyConfig((config) => ({
    ...config,
    install: {
      ...config.install,
      content: {
        ...config.install.content,
        provider: "postgres",
      },
      updatedAt: new Date().toISOString(),
    },
  }));

  const storageAdminClient = createSupabaseAdminClient(
    env.contentStorageUrl,
    env.contentStorageServiceRoleKey,
  );
  const cachedSeedUsers = await loadCachedSeedUsers(env);
  const seededUsers = cachedSeedUsers ?? ({} as PlaywrightSeedState["users"]);

  if (!Object.keys(seededUsers).length) {
    for (const [key, userConfig] of Object.entries(env.users) as Array<[PlaywrightSeedUserKey, TestUserConfig]>) {
      const user = await ensureConfigUser({
        email: userConfig.email,
        label: userConfig.label,
        password: userConfig.password,
      });
      seededUsers[key] = {
        email: userConfig.email,
        userId: user.id,
      };
    }
  }

  const contentPgClient = await createPgClient({
    connectionString: env.contentDatabaseUrl,
    rootCertificate: env.rootCertificate,
  });

  try {
    const projectId = await createSeedProjectWithDatabase({
      name: env.project.name,
      ownerUserId: seededUsers.owner.userId,
      slug: env.project.slug,
    });
    const seedData = await seedSelfHostProjectData({
      pgClient: contentPgClient,
      storageAdminClient,
    });
    await seedProjectMappingRevision({
      projectId,
    });

    const seedState: PlaywrightSeedState = {
      contentDatabaseUrl: env.contentDatabaseUrl,
      generatedAt: new Date().toISOString(),
      projects: {
        project: {
          assignedAuthorId: seedData.assignedAuthorId,
          id: projectId,
          mediaBucket: seedData.mediaBucket,
          name: env.project.name,
          slug: env.project.slug,
        },
      },
      users: seededUsers,
    };

    await seedProjectMembers({
      authorScopeId: seedData.assignedAuthorId,
      projectId,
      users: seedState.users,
    });

    await writeSeedState(seedState);
    return seedState;
  } finally {
    await contentPgClient.end();
  }
};
