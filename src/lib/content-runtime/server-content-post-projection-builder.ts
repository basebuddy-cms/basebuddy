import "server-only";

import {
  buildContentEntityCursorPageRowsQuery,
  buildContentEntityRowsQuery,
} from "./adapter/query-builders";
import {
  buildMappedContentPostListSelectClause,
  getMappedRelationValuesForPosts,
} from "./mapped-content-post-support";
import {
  getEntityIdColumn,
  getEntityTableName,
  getMappedContentRuntime,
  getFallbackTimestamp,
  getMappedFieldValue,
  getMappedPublishedAtColumn,
  getPostStatusFromRow,
  getRowValue,
  quoteIdentifier,
  toText,
  type ContentDatabaseClient,
} from "./mapped-content-runtime-support";
import type { ContentProjectMapping } from "./mapping";
import { getContentPostProjectionRefreshKey } from "./server-content-cache-keys";
import {
  countContentPostsProjection,
  deleteStaleContentPostProjectionRows,
  getContentPostsProjectionState,
  saveContentPostsProjectionState,
  type ContentPostProjectionRow,
  upsertContentPostProjectionRows,
} from "./server-content-post-projection";

const pendingContentPostProjectionRefreshes = new Map<string, Promise<{ totalItems: number }>>();
const CONTENT_POST_PROJECTION_REFRESH_BATCH_SIZE = 1000;
const CONTENT_POST_PROJECTION_REFRESH_MAX_BATCH_SIZE = 1000;

const getContentPostProjectionRefreshBatchSize = () => {
  const configuredValue = Number.parseInt(
    process.env.BASEBUDDY_PROJECTION_REFRESH_BATCH_SIZE ?? "",
    10,
  );

  if (!Number.isFinite(configuredValue) || configuredValue <= 0) {
    return CONTENT_POST_PROJECTION_REFRESH_BATCH_SIZE;
  }

  return Math.max(
    1,
    Math.min(CONTENT_POST_PROJECTION_REFRESH_MAX_BATCH_SIZE, configuredValue),
  );
};

const normalizeProjectionSearchText = (...values: Array<string | null | undefined>) =>
  values
    .flatMap((value) => (value ?? "").trim().toLowerCase().split(/\s+/))
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" ");

const normalizeProjectionPostIds = (postIds?: string[] | null) =>
  Array.from(new Set((postIds ?? []).map((value) => value.trim()).filter(Boolean)));

const getSupersedingContentPostProjectionState = async ({
  mapping,
  projectId,
  refreshedAt,
}: {
  mapping: ContentProjectMapping;
  projectId: string;
  refreshedAt: string;
}) => {
  const currentState = await getContentPostsProjectionState({
    mapping,
    projectId,
  });

  if (!currentState) {
    return null;
  }

  if (currentState.status === "stale") {
    return currentState;
  }

  if (currentState.lastRefreshedAt && currentState.lastRefreshedAt !== refreshedAt) {
    return currentState;
  }

  return null;
};

const loadContentPostRowsByIds = async ({
  client,
  mapping,
  postIds,
}: {
  client: ContentDatabaseClient;
  mapping: ContentProjectMapping;
  postIds: string[];
}) => {
  const runtime = getMappedContentRuntime(mapping);
  const idColumn = getEntityIdColumn(runtime.posts) || runtime.posts.source.primaryKey;

  if (!idColumn) {
    throw new Error("Posts setup is missing a stable ID field.");
  }

  const { rows } = await client.query<Record<string, unknown>>(
    buildContentEntityRowsQuery({
      filterByIds: true,
      idColumn,
      selectClause: buildMappedContentPostListSelectClause(runtime.posts),
      tableName: getEntityTableName(runtime.posts),
    }),
    [postIds],
  );

  return rows;
};

const refreshAllContentPostProjectionRows = async ({
  client,
  initialProcessedItems = 0,
  mapping,
  projectId,
  startAfterSourcePostId = null,
  refreshedAt,
}: {
  client: ContentDatabaseClient;
  initialProcessedItems?: number;
  mapping: ContentProjectMapping;
  projectId: string;
  startAfterSourcePostId?: string | null;
  refreshedAt: string;
}) => {
  const runtime = getMappedContentRuntime(mapping);
  const batchSize = getContentPostProjectionRefreshBatchSize();
  const postIdColumn = getEntityIdColumn(runtime.posts) || runtime.posts.source.primaryKey;
  let lastSourcePostId: string | null = startAfterSourcePostId;
  let processedItems = initialProcessedItems;
  let hasMoreRows = true;

  if (!postIdColumn) {
    throw new Error("Posts setup is missing a stable ID field.");
  }

  while (hasMoreRows) {
    const cursorClause = lastSourcePostId
      ? `${quoteIdentifier(postIdColumn)} > $1`
      : null;
    const result = await client.query<Record<string, unknown>>(
      buildContentEntityCursorPageRowsQuery({
        cursorClause,
        filterClause: "",
        limitParamIndex: lastSourcePostId ? 2 : 1,
        orderClause: `order by ${quoteIdentifier(postIdColumn)} asc`,
        selectClause: buildMappedContentPostListSelectClause(runtime.posts),
        tableName: getEntityTableName(runtime.posts),
      }),
      lastSourcePostId ? [lastSourcePostId, batchSize] : [batchSize],
    );
    const sourceRows = result.rows;

    hasMoreRows = sourceRows.length >= batchSize;

    if (sourceRows.length) {
      const projectionRows = await buildContentPostProjectionRows({
        client,
        mapping,
        postRows: sourceRows,
        projectId,
        refreshedAt,
      });

      await upsertContentPostProjectionRows({
        mapping,
        projectId,
        rows: projectionRows,
      });
    }

    const nextLastSourcePostId = toText(getRowValue(sourceRows.at(-1) ?? {}, postIdColumn));

    processedItems += sourceRows.length;

    if (sourceRows.length) {
      await saveContentPostsProjectionState({
        lastError: null,
        lastRefreshedAt: refreshedAt,
        mapping,
        processedItems,
        progressCursor: nextLastSourcePostId,
        projectId,
        status: "building",
        totalItems: 0,
      });
    }

    if (!nextLastSourcePostId || nextLastSourcePostId === lastSourcePostId) {
      hasMoreRows = false;
    }

    lastSourcePostId = nextLastSourcePostId;
  }

  return {
    lastSourcePostId,
    processedItems,
  };
};

export const buildContentPostProjectionRows = async ({
  client,
  mapping,
  postRows,
  projectId,
  refreshedAt,
}: {
  client: ContentDatabaseClient;
  mapping: ContentProjectMapping;
  postRows: Record<string, unknown>[];
  projectId: string;
  refreshedAt: string;
}): Promise<ContentPostProjectionRow[]> => {
  const runtime = getMappedContentRuntime(mapping);
  const posts = runtime.posts;
  const postIdColumn = getEntityIdColumn(posts) || posts.source.primaryKey;

  if (!postIdColumn) {
    throw new Error("Posts setup is missing a stable ID field.");
  }

  const [authorIdsByPostId, categoryIdsByPostId, tagIdsByPostId] = await Promise.all([
    getMappedRelationValuesForPosts({
      client,
      entity: runtime.authors,
      postRows,
      posts,
      relation: posts.relations.authors,
    }),
    getMappedRelationValuesForPosts({
      client,
      entity: runtime.categories,
      postRows,
      posts,
      relation: posts.relations.categories,
    }),
    getMappedRelationValuesForPosts({
      client,
      entity: runtime.tags,
      postRows,
      posts,
      relation: posts.relations.tags,
    }),
  ]);

  return postRows
    .map((postRow) => {
      const sourcePostId = toText(getRowValue(postRow, postIdColumn)) ?? "";

      if (!sourcePostId) {
        return null;
      }

      const title = toText(getMappedFieldValue(postRow, posts, "title")) ?? "";
      const excerpt = toText(getMappedFieldValue(postRow, posts, "excerpt"));
      const slug = toText(getMappedFieldValue(postRow, posts, "slug")) ?? sourcePostId;
      const status = getPostStatusFromRow(postRow, posts);

      return {
        authorId: authorIdsByPostId.get(sourcePostId)?.[0] ?? null,
        categoryIds: categoryIdsByPostId.get(sourcePostId) ?? [],
        createdAt:
          toText(getMappedFieldValue(postRow, posts, "createdAt")) ??
          getFallbackTimestamp(postRow),
        excerpt,
        projectId,
        publishedAt: toText(getRowValue(postRow, getMappedPublishedAtColumn(posts))),
        refreshedAt,
        searchText: normalizeProjectionSearchText(title, slug, excerpt, status),
        slug,
        sourcePostId,
        status,
        tagIds: tagIdsByPostId.get(sourcePostId) ?? [],
        title,
        updatedAt:
          toText(getMappedFieldValue(postRow, posts, "updatedAt")) ??
          toText(getMappedFieldValue(postRow, posts, "createdAt")) ??
          getFallbackTimestamp(postRow),
      } satisfies ContentPostProjectionRow;
    })
    .filter((row): row is ContentPostProjectionRow => row !== null);
};

export const refreshContentPostsProjection = async ({
  client,
  mapping,
  postIds = null,
  projectId,
}: {
  client: ContentDatabaseClient;
  mapping: ContentProjectMapping;
  postIds?: string[] | null;
  projectId: string;
}) => {
  const normalizedPostIds = normalizeProjectionPostIds(postIds);
  const refreshKey = getContentPostProjectionRefreshKey({
    mapping,
    postIds: postIds === null ? null : normalizedPostIds,
    projectId,
  });
  const existingRefresh = pendingContentPostProjectionRefreshes.get(refreshKey);

  if (existingRefresh) {
    return existingRefresh;
  }

  const refreshPromise = (async () => {
    const existingProjectionState =
      postIds === null
        ? await getContentPostsProjectionState({
            mapping,
            projectId,
          })
        : null;
    const canResumeFullRefresh = Boolean(
      postIds === null &&
        existingProjectionState?.status === "failed" &&
        existingProjectionState.progressCursor &&
        existingProjectionState.lastRefreshedAt,
    );
    const resumeProgressCursor = canResumeFullRefresh
      ? existingProjectionState?.progressCursor ?? null
      : null;
    let processedItems = canResumeFullRefresh
      ? existingProjectionState?.processedItems ?? 0
      : 0;
    let progressCursor = resumeProgressCursor;
    const refreshedAt = canResumeFullRefresh
      ? existingProjectionState?.lastRefreshedAt ?? new Date().toISOString()
      : new Date().toISOString();

    await saveContentPostsProjectionState({
      lastError: null,
      lastRefreshedAt: refreshedAt,
      mapping,
      processedItems,
      progressCursor,
      projectId,
      status: "building",
      totalItems: 0,
    });

    try {
      if (postIds === null) {
        const refreshProgress = await refreshAllContentPostProjectionRows({
          client,
          initialProcessedItems: processedItems,
          mapping,
          projectId,
          refreshedAt,
          startAfterSourcePostId: progressCursor,
        });
        processedItems = refreshProgress.processedItems;
        progressCursor = refreshProgress.lastSourcePostId;
      } else {
        const sourceRows = await loadContentPostRowsByIds({
          client,
          mapping,
          postIds: normalizedPostIds,
        });
        const projectionRows = await buildContentPostProjectionRows({
          client,
          mapping,
          postRows: sourceRows,
          projectId,
          refreshedAt,
        });

        await upsertContentPostProjectionRows({
          mapping,
          projectId,
          rows: projectionRows,
        });
      }

      const supersedingState = await getSupersedingContentPostProjectionState({
        mapping,
        projectId,
        refreshedAt,
      });

      if (supersedingState) {
        return { totalItems: supersedingState.totalItems };
      }

      await deleteStaleContentPostProjectionRows({
        mapping,
        projectId,
        refreshedAt,
        sourcePostIds: postIds === null ? null : normalizedPostIds,
      });

      const totalItems = await countContentPostsProjection({
        mapping,
        projectId,
      });

      await saveContentPostsProjectionState({
        lastError: null,
        lastRefreshedAt: refreshedAt,
        mapping,
        processedItems: totalItems,
        progressCursor: null,
        projectId,
        status: "ready",
        totalItems,
      });

      return { totalItems };
    } catch (error) {
      await saveContentPostsProjectionState({
        lastError: error instanceof Error ? error.message : "Could not refresh mapped content post projection.",
        lastRefreshedAt: refreshedAt,
        mapping,
        processedItems,
        progressCursor,
        projectId,
        status: "failed",
        totalItems: 0,
      });
      throw error;
    }
  })().finally(() => {
    pendingContentPostProjectionRefreshes.delete(refreshKey);
  });

  pendingContentPostProjectionRefreshes.set(refreshKey, refreshPromise);
  return refreshPromise;
};
