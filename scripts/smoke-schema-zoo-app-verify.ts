import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { Pool } from "pg";

import { loadBaseBuddyConfig } from "../src/lib/basebuddy-config/store";

type Project = {
  id: string;
  slug: string;
};

type SmokeContext = {
  baseUrl: string;
  contentPool: Pool;
  cookie: string;
  direct: Project & { postId: string; schema: string };
  filesFolder: string;
  helper: Project & { postId: string; schema: string };
  json: Project & { postId: string; schema: string };
  mediaFolder: string;
  readonly: Project & { postId: string; schema: string };
  runKey: string;
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

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const getSetCookieHeader = (response: Response) => {
  const getSetCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;

  if (typeof getSetCookie === "function") {
    return getSetCookie.call(response.headers).join("; ");
  }

  return response.headers.get("set-cookie") ?? "";
};

const getCookieHeader = (setCookieHeader: string) =>
  setCookieHeader
    .split(/,(?=\s*[^;,]+=)/)
    .map((cookie) => cookie.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");

const apiFetch = async (
  context: Pick<SmokeContext, "baseUrl" | "cookie">,
  path: string,
  init: RequestInit = {},
) => {
  const headers = new Headers(init.headers);
  headers.set("cookie", context.cookie);

  if (!["", "GET", "HEAD"].includes((init.method ?? "GET").toUpperCase())) {
    headers.set("origin", context.baseUrl);
  }

  return fetch(new URL(path, context.baseUrl), {
    ...init,
    headers,
    redirect: "manual",
  });
};

const apiJson = async <T>(
  context: Pick<SmokeContext, "baseUrl" | "cookie">,
  path: string,
  init: RequestInit = {},
) => {
  const response = await apiFetch(context, path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as T) : ({} as T);

  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} failed with ${response.status}: ${text}`);
  }

  return data;
};

const postContentAction = async (
  context: Pick<SmokeContext, "baseUrl" | "cookie">,
  projectId: string,
  body: Record<string, unknown>,
) =>
  apiJson<{ post?: unknown; success?: boolean }>(context, `/api/projects/${projectId}/content`, {
    body: JSON.stringify(body),
    method: "POST",
  });

const requireProject = async (slug: string): Promise<Project> => {
  const config = await loadBaseBuddyConfig();
  const project = config.projects.find((candidate) => candidate.slug === slug) ?? null;

  assert(project, `Missing smoke project ${slug}. Run scripts/smoke-schema-zoo.ts first.`);

  return {
    id: project.id,
    slug: project.slug,
  };
};

const loadContext = async (): Promise<SmokeContext> => {
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim() || "http://localhost:8080";
  const contentPool = createPool(getEnv("BASEBUDDY_CONTENT_DATABASE_URL"));
  const runKey = process.env.BASEBUDDY_SCHEMA_ZOO_RUN_KEY?.trim() || "20260501fix";

  try {
    const signInResponse = await fetch(
      new URL("/api/test-auth/playwright-sign-in?role=owner&next=/projects", baseUrl),
      {
        redirect: "manual",
      },
    );
    const cookie = getCookieHeader(getSetCookieHeader(signInResponse));

    assert(cookie, "Test auth did not return a session cookie.");

    const directProject = await requireProject(`bb-zoo-direct-${runKey}`);
    const jsonProject = await requireProject(`bb-zoo-json-${runKey}`);
    const helperProject = await requireProject(`bb-zoo-helper-${runKey}`);
    const readonlyProject = await requireProject(`bb-zoo-readonly-${runKey}`);

    const directSchema = `bb_zoo_direct_${runKey}`;
    const jsonSchema = `bb_zoo_json_${runKey}`;
    const helperSchema = `bb_zoo_helper_${runKey}`;
    const readonlySchema = `bb_zoo_readonly_${runKey}`;
    const directPost = await contentPool.query<{ article_id: string }>(
      `select article_id from ${quoteIdentifier(directSchema)}.articles where route_slug = 'direct-renamed-column-post' limit 1`,
    );
    const jsonPost = await contentPool.query<{ doc_id: string }>(
      `select doc_id from ${quoteIdentifier(jsonSchema)}.documents where payload #>> '{route,slug}' = 'json-path-post' limit 1`,
    );
    const helperPost = await contentPool.query<{ story_id: string }>(
      `select story_id from ${quoteIdentifier(helperSchema)}.stories where slug_text = 'helper-row-post' limit 1`,
    );
    const readonlyPost = await contentPool.query<{ post_key: string }>(
      `select post_key from ${quoteIdentifier(readonlySchema)}.source_posts where slug = 'readonly-view-post' limit 1`,
    );

    assert(directPost.rows[0], `Missing direct post in ${directSchema}.`);
    assert(jsonPost.rows[0], `Missing JSON post in ${jsonSchema}.`);
    assert(helperPost.rows[0], `Missing helper post in ${helperSchema}.`);
    assert(readonlyPost.rows[0], `Missing readonly post in ${readonlySchema}.`);

    const suffix = `${runKey}-${Date.now()}`;

    return {
      baseUrl,
      contentPool,
      cookie,
      direct: {
        ...directProject,
        postId: directPost.rows[0].article_id,
        schema: directSchema,
      },
      filesFolder: `files-smoke-${suffix}`,
      helper: {
        ...helperProject,
        postId: helperPost.rows[0].story_id,
        schema: helperSchema,
      },
      json: {
        ...jsonProject,
        postId: jsonPost.rows[0].doc_id,
        schema: jsonSchema,
      },
      mediaFolder: `media-smoke-${suffix}`,
      readonly: {
        ...readonlyProject,
        postId: readonlyPost.rows[0].post_key,
        schema: readonlySchema,
      },
      runKey,
    };
  } catch (error) {
    await contentPool.end();
    throw error;
  }
};

const verifyProjectReads = async (context: SmokeContext) => {
  for (const project of [context.direct, context.json, context.helper, context.readonly]) {
    const payload = await apiJson<{ posts?: unknown[] }>(
      context,
      `/api/projects/${project.id}/content?view=posts&pageSize=5`,
    );

    assert(Array.isArray(payload.posts) && payload.posts.length > 0, `${project.slug} did not return posts.`);
  }
};

const verifyHelperSiblingFields = async (context: SmokeContext) => {
  const before = await context.contentPool.query<{
    seo_description: string | null;
    seo_title: string | null;
  }>(
    `select seo_title, seo_description from ${quoteIdentifier(context.helper.schema)}.story_meta where story_id = $1`,
    [context.helper.postId],
  );
  const previousDescription = before.rows[0]?.seo_description ?? null;

  await postContentAction(context, context.helper.id, {
    action: "update_post",
    postId: context.helper.postId,
    seoTitle: "Smoke helper title kept",
  });

  const afterTitle = await context.contentPool.query<{
    seo_description: string | null;
    seo_title: string | null;
  }>(
    `select seo_title, seo_description from ${quoteIdentifier(context.helper.schema)}.story_meta where story_id = $1`,
    [context.helper.postId],
  );

  assert(afterTitle.rows[0]?.seo_title === "Smoke helper title kept", "Helper SEO title was not saved.");
  assert(
    afterTitle.rows[0]?.seo_description === previousDescription,
    "Saving helper SEO title cleared the sibling description.",
  );

  await postContentAction(context, context.helper.id, {
    action: "update_post",
    postId: context.helper.postId,
    seoDescription: "Smoke helper description kept",
  });

  const afterDescription = await context.contentPool.query<{
    seo_description: string | null;
    seo_title: string | null;
  }>(
    `select seo_title, seo_description from ${quoteIdentifier(context.helper.schema)}.story_meta where story_id = $1`,
    [context.helper.postId],
  );

  assert(
    afterDescription.rows[0]?.seo_title === "Smoke helper title kept",
    "Saving helper SEO description cleared the sibling title.",
  );
  assert(
    afterDescription.rows[0]?.seo_description === "Smoke helper description kept",
    "Helper SEO description was not saved.",
  );
};

const verifyHelperRelations = async (context: SmokeContext) => {
  const authorCode = `helper-author-${Date.now()}`;
  const authorSlug = `${authorCode}-slug`;
  const collectionCode = `helper-category-${Date.now()}`;

  await context.contentPool.query(
    `
      insert into ${quoteIdentifier(context.helper.schema)}.contributors
        (person_code, name_text, slug_text, email_text, bio_text)
      values ($1, 'Helper Author 2', $2, 'helper-author-2@example.com', 'Second helper author')
    `,
    [authorCode, authorSlug],
  );
  await context.contentPool.query(
    `
      insert into ${quoteIdentifier(context.helper.schema)}.collections
        (collection_code, name_text, slug_text, details)
      values ($1, 'Helper Category 2', $1, 'Second helper category')
    `,
    [collectionCode],
  );

  await postContentAction(context, context.helper.id, {
    action: "update_post",
    authorId: authorCode,
    categoryIds: [collectionCode],
    postId: context.helper.postId,
  });

  const helperRows = await context.contentPool.query<{
    author_slug: string | null;
    linked_category: string | null;
  }>(
    `
      select
        meta.author_slug,
        link.collection_code as linked_category
      from ${quoteIdentifier(context.helper.schema)}.story_meta meta
      left join ${quoteIdentifier(context.helper.schema)}.story_collection_links link
        on link.story_id = meta.story_id and link.collection_code = $2
      where meta.story_id = $1
    `,
    [context.helper.postId, collectionCode],
  );

  assert(helperRows.rows[0]?.author_slug === authorSlug, "Helper relation did not store the selected author slug.");
  assert(
    helperRows.rows[0]?.linked_category === collectionCode,
    "Helper join-table category relation was not updated.",
  );
};

const verifyJsonRelations = async (context: SmokeContext) => {
  const authorId = randomUUID();
  const tagId = randomUUID();
  const authorSlug = `json-author-${Date.now()}`;
  const tagSlug = `json-tag-${Date.now()}`;

  await context.contentPool.query(
    `
      insert into ${quoteIdentifier(context.json.schema)}.people
        (author_id, full_name, slug, email, bio)
      values ($1, 'JSON Author 2', $2, 'json-author-2@example.com', 'Second JSON author')
    `,
    [authorId, authorSlug],
  );
  await context.contentPool.query(
    `
      insert into ${quoteIdentifier(context.json.schema)}.tag_bank
        (tag_id, label, slug, notes)
      values ($1, 'JSON Tag 2', $2, 'Second JSON tag')
    `,
    [tagId, tagSlug],
  );

  await postContentAction(context, context.json.id, {
    action: "update_post",
    authorId,
    postId: context.json.postId,
    tagIds: [tagId],
  });

  const jsonRows = await context.contentPool.query<{
    primary_author_slug: string | null;
    tag_slugs: string[] | null;
  }>(
    `select primary_author_slug, tag_slugs from ${quoteIdentifier(context.json.schema)}.documents where doc_id = $1`,
    [context.json.postId],
  );

  assert(
    jsonRows.rows[0]?.primary_author_slug === authorSlug,
    "JSON value-match author relation did not store the target slug.",
  );
  assert(
    jsonRows.rows[0]?.tag_slugs?.length === 1 && jsonRows.rows[0]?.tag_slugs[0] === tagSlug,
    "JSON value-match tag relation did not replace the slug array.",
  );
};

const verifyDirectRelations = async (context: SmokeContext) => {
  const authorId = randomUUID();
  const categoryId = randomUUID();
  const tagId = randomUUID();

  await context.contentPool.query(
    `
      insert into ${quoteIdentifier(context.direct.schema)}.writers
        (writer_uuid, display_name, handle, email_address, about)
      values ($1, 'Direct Author 2', $2, 'direct-author-2@example.com', 'Second direct author')
    `,
    [authorId, `direct-author-${Date.now()}`],
  );
  await context.contentPool.query(
    `
      insert into ${quoteIdentifier(context.direct.schema)}.topic_groups
        (topic_uuid, name_text, slug_text, description_text)
      values ($1, 'Direct Category 2', $2, 'Second direct category')
    `,
    [categoryId, `direct-category-${Date.now()}`],
  );
  await context.contentPool.query(
    `
      insert into ${quoteIdentifier(context.direct.schema)}.labels
        (label_uuid, name_text, slug_text, description_text)
      values ($1, 'Direct Tag 2', $2, 'Second direct tag')
    `,
    [tagId, `direct-tag-${Date.now()}`],
  );

  await postContentAction(context, context.direct.id, {
    action: "update_post",
    authorId,
    categoryIds: [categoryId],
    postId: context.direct.postId,
    tagIds: [tagId],
  });

  const directRows = await context.contentPool.query<{
    linked_category: string | null;
    linked_tag: string | null;
    writer_uuid: string | null;
  }>(
    `
      select
        article.writer_uuid::text,
        topic.topic_uuid::text as linked_category,
        label.label_uuid::text as linked_tag
      from ${quoteIdentifier(context.direct.schema)}.articles article
      left join ${quoteIdentifier(context.direct.schema)}.article_topics topic
        on topic.article_uuid = article.article_id and topic.topic_uuid = $2
      left join ${quoteIdentifier(context.direct.schema)}.article_labels label
        on label.article_uuid = article.article_id and label.label_uuid = $3
      where article.article_id = $1
    `,
    [context.direct.postId, categoryId, tagId],
  );

  assert(directRows.rows[0]?.writer_uuid === authorId, "Direct foreign-key author relation was not updated.");
  assert(directRows.rows[0]?.linked_category === categoryId, "Direct category join relation was not updated.");
  assert(directRows.rows[0]?.linked_tag === tagId, "Direct tag join relation was not updated.");
};

const verifyReadonlyProtection = async (context: SmokeContext) => {
  const response = await apiFetch(context, `/api/projects/${context.readonly.id}/content`, {
    body: JSON.stringify({
      action: "update_post",
      postId: context.readonly.postId,
      title: "This should not save",
    }),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });
  const text = await response.text();

  assert(!response.ok, `Readonly project accepted an update unexpectedly: ${text}`);
};

const verifyStorageActions = async (context: SmokeContext) => {
  await apiJson(context, `/api/projects/${context.direct.id}/media?includeFolderOptions=false`);
  await apiJson(context, `/api/projects/${context.direct.id}/files?includeFolderOptions=false`);

  await apiJson(context, `/api/projects/${context.direct.id}/media`, {
    body: JSON.stringify({
      action: "create_folder",
      folderName: context.mediaFolder,
      parentPath: null,
    }),
    method: "PUT",
  });
  await apiJson(context, `/api/projects/${context.direct.id}/files`, {
    body: JSON.stringify({
      action: "create_folder",
      folderName: context.filesFolder,
      parentPath: null,
    }),
    method: "PUT",
  });

  const transparentPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64",
  );
  const mediaForm = new FormData();
  mediaForm.append("path", context.mediaFolder);
  mediaForm.append("files", new Blob([transparentPng], { type: "image/png" }), `media-${Date.now()}.png`);

  const mediaUploadResponse = await apiFetch(context, `/api/projects/${context.direct.id}/media`, {
    body: mediaForm,
    method: "POST",
  });
  const mediaUploadText = await mediaUploadResponse.text();

  assert(
    mediaUploadResponse.ok,
    `Media upload failed with ${mediaUploadResponse.status}: ${mediaUploadText}`,
  );

  const fileForm = new FormData();
  fileForm.append("path", context.filesFolder);
  fileForm.append("files", new Blob(["BaseBuddy smoke file\n"], { type: "text/plain" }), `file-${Date.now()}.txt`);

  const fileUploadResponse = await apiFetch(context, `/api/projects/${context.direct.id}/files`, {
    body: fileForm,
    method: "POST",
  });
  const fileUploadText = await fileUploadResponse.text();

  assert(fileUploadResponse.ok, `File upload failed with ${fileUploadResponse.status}: ${fileUploadText}`);

  const mediaFolderPayload = await apiJson<{ folders?: Array<{ path?: string }> }>(
    context,
    `/api/projects/${context.direct.id}/media?path=${encodeURIComponent(context.mediaFolder)}`,
  );
  const filesFolderPayload = await apiJson<{ folders?: Array<{ path?: string }>; files?: unknown[] }>(
    context,
    `/api/projects/${context.direct.id}/files?path=${encodeURIComponent(context.filesFolder)}`,
  );

  assert(
    JSON.stringify(mediaFolderPayload).includes(context.mediaFolder),
    "Media library did not reflect the smoke folder/upload.",
  );
  assert(
    JSON.stringify(filesFolderPayload).includes(context.filesFolder),
    "Files library did not reflect the smoke folder/upload.",
  );
};

const main = async () => {
  const context = await loadContext();
  const checks: Array<[string, (context: SmokeContext) => Promise<void>]> = [
    ["project reads across direct/json/helper/readonly schemas", verifyProjectReads],
    ["helper sibling scalar fields", verifyHelperSiblingFields],
    ["helper related-row author and join-table categories", verifyHelperRelations],
    ["json value-match author and tag relations", verifyJsonRelations],
    ["direct foreign-key and join-table relations", verifyDirectRelations],
    ["readonly protection", verifyReadonlyProtection],
    ["media and files library actions", verifyStorageActions],
  ];

  try {
    for (const [name, check] of checks) {
      await check(context);
      console.log(`✓ ${name}`);
    }

    console.log("Schema zoo app smoke verification passed.");
  } finally {
    await context.contentPool.end();
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
