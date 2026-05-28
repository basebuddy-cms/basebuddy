import "server-only";

import type { Client } from "pg";

import {
  canAccessAuthorScopedContent,
  type ProjectContentAction,
  type ProjectMemberAccess,
} from "@/lib/control-plane/permissions";
import type { AuthenticatedApiUser } from "@/lib/control-plane/server";

import { normalizeContentRuntimeContent } from "./content-conversion";
import {
  buildGeneratedContentAuthorScopePredicate,
  buildGeneratedContentPostByIdQuery,
} from "./adapter/generated-query-builders";
import {
  createContentRuntimeAdapter,
  getRequiredContentRuntimeAdapterMethod,
} from "./adapter/factory";
import type { ContentProjectMapping } from "./mapping";
import { assertContentPostEditSessionAccess } from "./server-post-edit-sessions";
import { createEmptyContentPagination, type ContentPaginationInput } from "./server-support";
import { getGeneratedContentTables } from "./server-project-schema-support";
import {
  supportsContentFormatAwareSchema,
  type ContentPost,
  type ContentPostsPage,
  type ContentPostsSort,
  type ContentPostsStatusFilter,
  type ContentPrimaryContentFormat,
  type ContentSchemaOptions,
} from "./shared";

export type ContentDatabaseClient = Pick<Client, "query">;

export type ContentProjectContext = {
  connectionString: string | null;
  memberAccess: ProjectMemberAccess;
  projectId: string;
  projectSlug: string;
  schemaOptions: ContentSchemaOptions;
  user: AuthenticatedApiUser;
};

export type ProjectPostAuthorAssignment = {
  avatar_url: string | null;
  cms_author_id: string;
  email: string | null;
  name: string | null;
  user_id: string | null;
};

export type ContentCountRow = {
  count: string;
};

export type ContentPostsDependencies = {
  ensureContentPermission: (
    context: ContentProjectContext,
    action: ProjectContentAction,
  ) => string[] | null;
  ensureDirectConnectionForMappedRuntime: (context: ContentProjectContext) => void;
  getBootstrapContentProjectMapping?: ({
    context,
    projectId,
  }: {
    context: ContentProjectContext;
    projectId: string;
  }) => Promise<ContentProjectMapping | null>;
  getPermissionError: (action: ProjectContentAction) => string;
  getProjectContext: (projectId: string) => Promise<ContentProjectContext | null>;
  getReadyContentProjectMapping: ({
    client,
    context,
    projectId,
  }: {
    client?: ContentDatabaseClient;
    context: ContentProjectContext;
    projectId: string;
  }) => Promise<ContentProjectMapping | null>;
  withContentDatabaseClient: <T>(
    connectionString: string,
    handler: (client: ContentDatabaseClient) => Promise<T>,
  ) => Promise<T>;
};

export const createEmptyContentPostsPage = (
  input: ContentPaginationInput = {},
): ContentPostsPage => ({
  authors: [],
  categories: [],
  editorOptionsState: "warm",
  pagination: createEmptyContentPagination(input),
  posts: [],
  tags: [],
});

export const buildContentPostsFilter = ({
  accessibleAuthorIds,
  search,
  status,
}: {
  accessibleAuthorIds: string[] | null;
  search: string;
  status: ContentPostsStatusFilter;
}) => {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let parameterIndex = 1;

  if (accessibleAuthorIds !== null) {
    clauses.push(
      buildGeneratedContentAuthorScopePredicate({
        alias: "p",
        parameterIndex,
      }),
    );
    params.push(accessibleAuthorIds);
    parameterIndex += 1;
  }

  if (status !== "all") {
    clauses.push(`p.status = $${parameterIndex}`);
    params.push(status);
    parameterIndex += 1;
  }

  if (search) {
    clauses.push(`${getContentPostsSearchExpression("p")} like $${parameterIndex}`);
    params.push(`%${search.trim().toLowerCase()}%`);
    parameterIndex += 1;
  }

  return {
    clause: clauses.length ? `where ${clauses.map((clause) => `(${clause})`).join(" and ")}` : "",
    params,
  };
};

export const getContentPostsSearchExpression = (tableAlias: string | null = "p") => {
  const column = (field: "excerpt" | "slug" | "title") =>
    tableAlias?.trim() ? `${tableAlias}.${field}` : field;

  return `lower(concat_ws(' ', coalesce(${column("title")}, ''), coalesce(${column("slug")}, ''), coalesce(${column("excerpt")}, '')))`;
};

export const getContentPostsOrderClause = (sort: ContentPostsSort) => {
  switch (sort) {
    case "updated_asc":
      return "order by p.updated_at asc, p.created_at asc";
    case "created_desc":
      return "order by p.created_at desc";
    case "created_asc":
      return "order by p.created_at asc";
    case "title_asc":
      return "order by lower(p.title) asc, p.created_at desc";
    case "title_desc":
      return "order by lower(p.title) desc, p.created_at desc";
    case "updated_desc":
    default:
      return "order by p.updated_at desc, p.created_at desc";
  }
};

export const normalizeNullableContentText = (value: string | null | undefined) => {
  const trimmedValue = value?.trim() ?? "";
  return trimmedValue ? trimmedValue : null;
};

export const normalizeComparableContentIds = (values: string[]) =>
  [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right),
  );

export const areComparableContentIdsEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

export const ensureContentPostWriteAccess = async ({
  client,
  context,
  dependencies,
  knownAuthorId,
  postId,
}: {
  client: ContentDatabaseClient;
  context: ContentProjectContext;
  dependencies: ContentPostsDependencies;
  knownAuthorId?: string | null;
  postId: string;
}) => {
  dependencies.ensureContentPermission(context, "write");

  const readyMapping = await dependencies.getReadyContentProjectMapping({
    client,
    context,
    projectId: context.projectId,
  });

  if (!readyMapping) {
    throw new Error("Finish posts setup before editing posts.");
  }

  const adapter = createContentRuntimeAdapter({
    hasFilesS3CompatibleCredentials: false,
    hasS3CompatibleCredentials: false,
    mapping: readyMapping,
  });
  const authorId =
    knownAuthorId !== undefined
      ? knownAuthorId
      : await getRequiredContentRuntimeAdapterMethod(adapter, "loadPostAuthorId")({
          client,
          postId,
          projectId: context.projectId,
        });

  if (!canAccessAuthorScopedContent(context.memberAccess, "write", authorId)) {
    throw new Error(dependencies.getPermissionError("write"));
  }
};

export const assertContentPostEditSession = async ({
  client,
  context,
  dependencies,
  knownAuthorId,
  postId,
  postTitle,
  projectId,
}: {
  client?: ContentDatabaseClient;
  context?: ContentProjectContext;
  dependencies: ContentPostsDependencies;
  knownAuthorId?: string | null;
  postId: string;
  postTitle?: string | null;
  projectId: string;
}) => {
  const resolvedContext = context ?? (await dependencies.getProjectContext(projectId));

  if (!resolvedContext) {
    throw new Error("Could not load this project right now.");
  }

  await assertContentPostEditSessionAccess({
    context: resolvedContext,
    postId,
    postTitle,
    projectId,
    verifyPostWriteAccess: async () => {
      if (client) {
        await ensureContentPostWriteAccess({
          client,
          context: resolvedContext,
          dependencies,
          knownAuthorId,
          postId,
        });
        return;
      }

      await dependencies.withContentDatabaseClient(resolvedContext.connectionString as string, async (contentDatabaseClient) => {
        await ensureContentPostWriteAccess({
          client: contentDatabaseClient,
          context: resolvedContext,
          dependencies,
          knownAuthorId,
          postId,
        });
      });
    },
  });
};

export const getContentPostById = async ({
  client,
  postId,
  projectSlug,
  schemaVersion,
}: {
  client: ContentDatabaseClient;
  postId: string;
  projectSlug: string;
  schemaVersion: number | null | undefined;
}) => {
  const tables = getGeneratedContentTables(projectSlug);
  const supportsFormatAwareSchema = supportsContentFormatAwareSchema(schemaVersion);
  const postResult = await client.query<{
    author_id: string | null;
    category_ids: string[];
    content_format?: ContentPrimaryContentFormat;
    content_html: string;
    content_json: Record<string, unknown>;
    content_markdown?: string | null;
    created_at: string;
    excerpt: string | null;
    focus_keyword: string | null;
    featured_image_url: string | null;
    id: string;
    published_at: string | null;
    seo_description: string | null;
    seo_title: string | null;
    slug: string;
    status: ContentPost["status"];
    tag_ids: string[];
    title: string;
    updated_at: string;
  }>(
    buildGeneratedContentPostByIdQuery({
      supportsFormatAwareSchema,
      tables,
    }),
    [postId],
  );

  if (!postResult.rows.length) {
    throw new Error("Could not find that post in this project.");
  }

  const post = postResult.rows[0] as {
    author_id: string | null;
    category_ids: string[];
    content_format?: ContentPrimaryContentFormat;
    content_html: string;
    content_json: Record<string, unknown>;
    content_markdown?: string | null;
    created_at: string;
    excerpt: string | null;
    focus_keyword: string | null;
    featured_image_url: string | null;
    id: string;
    published_at: string | null;
    seo_description: string | null;
    seo_title: string | null;
    slug: string;
    status: ContentPost["status"];
    tag_ids: string[];
    title: string;
    updated_at: string;
  };
  const primaryContentFormat =
    supportsFormatAwareSchema && post.content_format ? post.content_format : "html";
  const normalizedContent = normalizeContentRuntimeContent({
    contentHtml: post.content_html,
    contentJson: post.content_json,
    contentMarkdown: supportsFormatAwareSchema ? post.content_markdown ?? null : null,
    primaryContentFormat,
  });

  return {
    authorId: post.author_id,
    categoryIds: post.category_ids ?? [],
    contentFields: {},
    contentFormat: primaryContentFormat,
    contentHtml: normalizedContent.contentHtml,
    contentJson: normalizedContent.contentJson,
    contentMarkdown: normalizedContent.contentMarkdown,
    createdAt: post.created_at,
    excerpt: post.excerpt,
    focusKeyword: post.focus_keyword,
    featuredImageUrl: post.featured_image_url,
    id: post.id,
    publishedAt: post.published_at,
    redirects: [],
    seoDescription: post.seo_description,
    seoTitle: post.seo_title,
    slug: post.slug,
    status: post.status,
    tagIds: post.tag_ids ?? [],
    title: post.title,
    updatedAt: post.updated_at,
    customFields: {},
  } satisfies ContentPost;
};
