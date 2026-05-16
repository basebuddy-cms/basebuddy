import {
  buildContentApproximateTableRowEstimateQuery,
  buildContentBoundedExactCountQuery,
  buildContentEntityCountQuery,
  buildContentEntityRowsByPredicateQuery,
} from "./adapter/query-builders";
import {
  loadMappedContentAuthors,
} from "./mapped-content-collections";
import {
  getEntityIdColumn,
  getMappedContentRuntime,
  getEntityTableName,
  getResolvedEntity,
  getRowValue,
  isUsableEntitySource,
  resolvePagination,
  toText,
  type ContentDatabaseClient,
} from "./mapped-content-runtime-support";
import {
  buildMappedContentPostListSelectClause,
  getMappedRelationValuesForPosts,
  loadMappedContentPostRows,
  loadMappedContentPostRowsPage,
  mapMappedContentPostListRow,
} from "./mapped-content-post-support";
import {
  buildMappedContentPrimaryKeyPredicate,
  loadMappedContentHydratedPost,
} from "./mapped-content-post-read-detail";
import { loadMappedContentEditorTaxonomyOptions } from "./mapped-content-post-editor-taxonomy";
import {
  type ContentCollectionCounts,
  type ContentPagination,
  type ContentPost,
  type ContentPostEditorPayload,
  type ContentPostsPage,
  type ContentPostsSort,
  type ContentPostsStatusFilter,
  type ContentSnapshot,
} from "./shared";
import {
  getCachedProjectRuntimeValue,
  projectRuntimeCacheGroups,
} from "./server-runtime-cache";
import {
  getContentPostAuthorCacheKey,
} from "./server-runtime-cache-keys";
import { getContentPostProjectionAuthorId } from "./server-content-post-projection";
import type {
  ContentEntityMapping,
  ContentProjectMapping,
  ContentRelationMapping,
} from "./mapping";

const MAPPED_CONTENT_POST_AUTHOR_CACHE_TTL_MS = 5_000;
const APPROXIMATE_COUNT_ZERO_ESTIMATE_FALLBACK_LIMIT = 1_000;

const shouldCacheMappedContentPostAuthorId = ({
  projectId,
  runtime,
}: {
  projectId?: string;
  runtime: ReturnType<typeof getMappedContentRuntime>;
}) => {
  if (!projectId) {
    return false;
  }

  const authorStrategy = runtime.posts.relations.authors?.strategy;
  return (
    authorStrategy === "array" ||
    authorStrategy === "json_array" ||
    authorStrategy === "json_object" ||
    authorStrategy === "derived_distinct"
  );
};

const loadMappedContentPostPageAuthorsSafely = async ({
  accessibleAuthorIds,
  authorAssignmentsByAuthorId,
  client,
  runtime,
  visibleAuthorIds,
}: {
  accessibleAuthorIds?: string[] | null;
  authorAssignmentsByAuthorId?: Map<string, { avatar_url: string | null }> | null;
  client: ContentDatabaseClient;
  runtime: ReturnType<typeof getMappedContentRuntime>;
  visibleAuthorIds?: string[] | null;
}) => {
  try {
    return await loadMappedContentAuthors({
      accessibleAuthorIds,
      authorAssignmentsByAuthorId: authorAssignmentsByAuthorId ?? null,
      client,
      entity: runtime.authors,
      ids: visibleAuthorIds ?? undefined,
      posts: runtime.posts,
      relation: runtime.posts.relations.authors,
    });
  } catch {
    return [];
  }
};

const createMappedContentWindowPagination = ({
  hasNextPage,
  page,
  pageSize,
  totalItems,
}: {
  hasNextPage: boolean;
  page: number;
  pageSize: number;
  totalItems: number;
}): ContentPagination => ({
  hasNextPage,
  hasPreviousPage: page > 1,
  page,
  pageSize,
  totalItems,
  totalItemsExact: false,
  totalPages: Math.max(page + (hasNextPage ? 1 : 0), Math.ceil(totalItems / pageSize), 1),
});

const canApplyMappedContentAuthorScopeInSql = (runtime: ReturnType<typeof getMappedContentRuntime>) => {
  const strategy = runtime.posts.relations.authors?.strategy;

  return strategy === "foreign_key" || strategy === "join_table";
};

const loadAuthorFilteredMappedContentPostWindow = async ({
  accessibleAuthorIds,
  client,
  page,
  pageSize,
  runtime,
  search,
  sort,
  status,
}: {
  accessibleAuthorIds: string[];
  client: ContentDatabaseClient;
  page?: number;
  pageSize?: number;
  runtime: ReturnType<typeof getMappedContentRuntime>;
  search?: string;
  sort?: ContentPostsSort;
  status?: ContentPostsStatusFilter;
}) => {
  const requestedPagination = resolvePagination({
    page,
    pageSize,
    totalItems: Math.max(1, (page ?? 1) * (pageSize ?? 20)),
  });
  const requestedEnd = requestedPagination.offset + requestedPagination.pageSize;
  const requiredVisibleCount = requestedEnd + 1;
  const scanPageSize = Math.min(
    250,
    Math.max(requestedPagination.pageSize * 4, 50),
  );
  const postIdColumn = getEntityIdColumn(runtime.posts) || runtime.posts.source.primaryKey;
  const collectedRows: Array<{ authorId: string; row: Record<string, unknown> }> = [];
  let hasMoreSourceRows = true;
  let scanPage = 1;

  while (collectedRows.length < requiredVisibleCount && hasMoreSourceRows) {
    const scanResult = await loadMappedContentPostRowsPage({
      accessibleAuthorIds: null,
      client,
      page: scanPage,
      pageSize: scanPageSize,
      runtime,
      search,
      sort,
      status,
      totalItems: scanPage * scanPageSize + 1,
    });

    hasMoreSourceRows = scanResult.rows.length >= scanPageSize;

    const authorIdsByPostId = await getMappedRelationValuesForPosts({
      client,
      entity: runtime.authors,
      postRows: scanResult.rows,
      posts: runtime.posts,
      relation: runtime.posts.relations.authors,
    });

    for (const row of scanResult.rows) {
      const postId = toText(getRowValue(row, postIdColumn)) ?? "";
      const authorId = authorIdsByPostId.get(postId)?.[0] ?? null;

      if (authorId && accessibleAuthorIds.includes(authorId)) {
        collectedRows.push({ authorId, row });
      }
    }

    scanPage += 1;
  }

  const hasNextPage = collectedRows.length > requestedEnd || hasMoreSourceRows;
  const visibleRows = hasNextPage
    ? collectedRows.slice(requestedPagination.offset, requestedEnd)
    : collectedRows.slice(
        resolvePagination({
          page,
          pageSize,
          totalItems: collectedRows.length,
        }).offset,
        resolvePagination({
          page,
          pageSize,
          totalItems: collectedRows.length,
        }).offset + requestedPagination.pageSize,
      );
  const pagination = hasNextPage
    ? createMappedContentWindowPagination({
        hasNextPage: true,
        page: requestedPagination.page,
        pageSize: requestedPagination.pageSize,
        totalItems: Math.max(requestedEnd + 1, collectedRows.length),
      })
    : resolvePagination({
        page,
        pageSize,
        totalItems: collectedRows.length,
      });

  return {
    pagination,
    rows: visibleRows,
  };
};

export const getMappedContentWorkspaceCounts = async ({
  accessibleAuthorIds = null,
  client,
  mapping,
  postsCountOverride,
  approximateCounts = false,
}: {
  accessibleAuthorIds?: string[] | null;
  approximateCounts?: boolean;
  client: ContentDatabaseClient;
  mapping: ContentProjectMapping;
  postsCountOverride?: number;
}): Promise<ContentCollectionCounts> => {
  const runtime = getMappedContentRuntime(mapping);

  const countEntity = async (
    entity: ContentEntityMapping,
    relation?: ContentRelationMapping,
  ) => {
    const resolvedEntity = await getResolvedEntity({
      client,
      entity,
      posts: runtime.posts,
      relation,
    });

    if (!isUsableEntitySource(resolvedEntity)) {
      return 0;
    }

    if (approximateCounts && resolvedEntity.source.schema && resolvedEntity.source.table) {
      const result = await client.query<{ estimated_count: string }>(
        buildContentApproximateTableRowEstimateQuery(),
        [`${resolvedEntity.source.schema}.${resolvedEntity.source.table}`],
      );

      const estimatedCount = Number(result.rows[0]?.estimated_count ?? 0);
      if (Number.isFinite(estimatedCount) && estimatedCount > 0) {
        return estimatedCount;
      }

      const boundedResult = await client.query<{ count: string; reached_limit: boolean }>(
        buildContentBoundedExactCountQuery({
          filterClause: "",
          limitParamIndex: 1,
          tableName: getEntityTableName(resolvedEntity),
        }),
        [APPROXIMATE_COUNT_ZERO_ESTIMATE_FALLBACK_LIMIT],
      );

      return Number(boundedResult.rows[0]?.count ?? 0);
    }

    const result = await client.query<{ count: string }>(
      buildContentEntityCountQuery({
        filterClause: "",
        tableName: getEntityTableName(resolvedEntity),
      }),
    );
    return Number(result.rows[0]?.count ?? 0);
  };

  let postsCount = postsCountOverride ?? (await countEntity(runtime.posts));

  if (accessibleAuthorIds !== null && postsCountOverride === undefined) {
    const result = await loadMappedContentPostRows({
      accessibleAuthorIds,
      client,
      runtime,
    });
    if (result.authorScopeApplied) {
      postsCount = result.rows.length;
    } else {
      const postIdColumn = getEntityIdColumn(runtime.posts) || runtime.posts.source.primaryKey;
      const authorIdsByPostId = await getMappedRelationValuesForPosts({
        client,
        entity: runtime.authors,
        postRows: result.rows,
        posts: runtime.posts,
        relation: runtime.posts.relations.authors,
      });
      let accessibleCount = 0;

      for (const row of result.rows) {
        const postId = toText(getRowValue(row, postIdColumn)) ?? "";
        const authorId = authorIdsByPostId.get(postId)?.[0] ?? null;

        if (authorId && accessibleAuthorIds.includes(authorId)) {
          accessibleCount += 1;
        }
      }

      postsCount = accessibleCount;
    }
  }

  return {
    authors: await countEntity(runtime.authors, runtime.posts.relations.authors),
    categories: await countEntity(runtime.categories, runtime.posts.relations.categories),
    files: 0,
    media: await countEntity(runtime.media),
    posts: postsCount,
    tags: await countEntity(runtime.tags, runtime.posts.relations.tags),
  };
};

export const getMappedContentPostById = async ({
  client,
  mapping,
  postId,
  projectId,
}: {
  client: ContentDatabaseClient;
  mapping: ContentProjectMapping;
  postId: string;
  projectId?: string;
}): Promise<ContentPost> => {
  return loadMappedContentHydratedPost({
    client,
    mapping,
    postId,
    projectId,
  });
};

export const getMappedContentPostAuthorId = async ({
  client,
  mapping,
  postId,
  projectId,
}: {
  client: ContentDatabaseClient;
  mapping: ContentProjectMapping;
  postId: string;
  projectId?: string;
}) => {
  const runtime = getMappedContentRuntime(mapping);
  const idColumn = getEntityIdColumn(runtime.posts) || runtime.posts.source.primaryKey;

  if (!idColumn) {
    throw new Error("Posts setup is missing a stable ID field.");
  }

  const loadAuthorId = async () => {
    if (projectId) {
      const projectedAuthorId = await getContentPostProjectionAuthorId({
        mapping,
        postId,
        projectId,
      });

      if (projectedAuthorId) {
        return projectedAuthorId;
      }
    }

    const whereClause = await buildMappedContentPrimaryKeyPredicate({
      client,
      columnName: idColumn,
      entity: runtime.posts,
      paramIndex: 1,
    });
     const result = await client.query<Record<string, unknown>>(
       buildContentEntityRowsByPredicateQuery({
         predicateClause: whereClause,
         selectClause: buildMappedContentPostListSelectClause(runtime.posts),
         tableName: getEntityTableName(runtime.posts),
       }),
       [postId],
     );

    if (!result.rows.length) {
      throw new Error("Could not find that post in this project.");
    }

    const authorIdsByPostId = await getMappedRelationValuesForPosts({
      client,
      entity: runtime.authors,
      postRows: result.rows,
      posts: runtime.posts,
      relation: runtime.posts.relations.authors,
    });

    return authorIdsByPostId.get(postId)?.[0] ?? authorIdsByPostId.values().next().value?.[0] ?? null;
  };

  if (!shouldCacheMappedContentPostAuthorId({ projectId, runtime })) {
    return loadAuthorId();
  }

  return getCachedProjectRuntimeValue({
    cacheKey: getContentPostAuthorCacheKey({
      mapping,
      postId,
      projectId,
    }),
    groups: [projectRuntimeCacheGroups.postDetail],
    load: loadAuthorId,
    projectId,
    staleWhileRevalidateMs: 0,
    ttlMs: MAPPED_CONTENT_POST_AUTHOR_CACHE_TTL_MS,
  });
};

export const getMappedContentPostsPage = async ({
  accessibleAuthorIds = null,
  authorAssignmentsByAuthorId,
  client,
  includeEditorOptions = false,
  mapping,
  page,
  pageSize,
  projectId,
  search = "",
  sort = "updated_desc",
  status = "all",
  totalItems,
  useWindowPagination = false,
  writableAuthorIds = null,
}: {
  accessibleAuthorIds?: string[] | null;
  authorAssignmentsByAuthorId?: Map<string, { avatar_url: string | null }> | null;
  client: ContentDatabaseClient;
  includeEditorOptions?: boolean;
  mapping: ContentProjectMapping;
  page?: number;
  pageSize?: number;
  projectId?: string;
  search?: string;
  sort?: ContentPostsSort;
  status?: ContentPostsStatusFilter;
  totalItems?: number;
  useWindowPagination?: boolean;
  writableAuthorIds?: string[] | null;
}): Promise<ContentPostsPage> => {
  const runtime = getMappedContentRuntime(mapping);
  const posts: ContentPost[] = [];
  let pagination: ContentPagination;

  if (accessibleAuthorIds === null) {
    const result = await loadMappedContentPostRowsPage({
      client,
      page,
      pageSize,
      runtime,
      search,
      sort,
      status,
      totalItems,
      useWindowPagination,
    });

    pagination = result.pagination;
    const postIdColumn = getEntityIdColumn(runtime.posts) || runtime.posts.source.primaryKey;
    const authorIdsByPostId = await getMappedRelationValuesForPosts({
      client,
      entity: runtime.authors,
      postRows: result.rows,
      posts: runtime.posts,
      relation: runtime.posts.relations.authors,
    });

    for (const row of result.rows) {
      const postId = toText(getRowValue(row, postIdColumn)) ?? "";
      posts.push(
        await mapMappedContentPostListRow({
          authorId: authorIdsByPostId.get(postId)?.[0] ?? null,
          client,
          postRow: row,
          runtime,
        }),
      );
    }
  } else if (!accessibleAuthorIds.length) {
    pagination = resolvePagination({
      page,
      pageSize,
      totalItems: 0,
    });
  } else if (!canApplyMappedContentAuthorScopeInSql(runtime)) {
    const windowResult = await loadAuthorFilteredMappedContentPostWindow({
      accessibleAuthorIds,
      client,
      page,
      pageSize,
      runtime,
      search,
      sort,
      status,
    });

    pagination = windowResult.pagination;
    for (const { authorId, row } of windowResult.rows) {
      posts.push(
        await mapMappedContentPostListRow({
          authorId,
          client,
          postRow: row,
          runtime,
        }),
      );
    }
  } else {
    const scopedResult = await loadMappedContentPostRowsPage({
      accessibleAuthorIds,
      client,
      page,
      pageSize,
      runtime,
      search,
      sort,
      status,
      totalItems,
      useWindowPagination,
    });

    if (scopedResult.authorScopeApplied) {
      pagination = scopedResult.pagination;
      const postIdColumn = getEntityIdColumn(runtime.posts) || runtime.posts.source.primaryKey;
      const authorIdsByPostId = await getMappedRelationValuesForPosts({
        client,
        entity: runtime.authors,
        postRows: scopedResult.rows,
        posts: runtime.posts,
        relation: runtime.posts.relations.authors,
      });

      for (const row of scopedResult.rows) {
        const postId = toText(getRowValue(row, postIdColumn)) ?? "";
        posts.push(
          await mapMappedContentPostListRow({
            authorId: authorIdsByPostId.get(postId)?.[0] ?? null,
            client,
            postRow: row,
            runtime,
          }),
        );
      }
    } else {
      const windowResult = await loadAuthorFilteredMappedContentPostWindow({
        accessibleAuthorIds,
        client,
        page,
        pageSize,
        runtime,
        search,
        sort,
        status,
      });

      pagination = windowResult.pagination;
      for (const { authorId, row } of windowResult.rows) {
        posts.push(
          await mapMappedContentPostListRow({
            authorId,
            client,
            postRow: row,
            runtime,
          }),
        );
      }
    }
  }

  const visibleAuthorIds = [...new Set(posts.map((post) => post.authorId).filter(Boolean))] as string[];
  const authors = await loadMappedContentPostPageAuthorsSafely({
    authorAssignmentsByAuthorId,
    client,
    runtime,
    visibleAuthorIds,
  });

  if (!includeEditorOptions) {
    return {
      authors,
      categories: [],
      editorOptionsState: "warm",
      pagination,
      posts,
      tags: [],
    };
  }

  const taxonomyOptions = await loadMappedContentEditorTaxonomyOptions({
    client,
    mapping,
    projectId,
    runtime,
  });

  return {
    authors:
      writableAuthorIds === null
        ? authors
        : authors.filter((author) => writableAuthorIds.includes(author.id)),
    categories: taxonomyOptions.categories,
    editorOptionsState: "full",
    pagination,
    posts,
    tags: taxonomyOptions.tags,
  };
};

export const getMappedContentPostEditorPayload = async ({
  accessibleAuthorIds = null,
  authorAssignmentsByAuthorId,
  client,
  includeEditorOptions = true,
  mapping,
  postId,
  projectId,
}: {
  accessibleAuthorIds?: string[] | null;
  authorAssignmentsByAuthorId?: Map<string, { avatar_url: string | null }> | null;
  client: ContentDatabaseClient;
  includeEditorOptions?: boolean;
  mapping: ContentProjectMapping;
  postId: string;
  projectId?: string;
}): Promise<ContentPostEditorPayload> => {
  const runtime = getMappedContentRuntime(mapping);
  const post = await getMappedContentPostById({
    client,
    mapping,
    postId,
    projectId,
  });

  if (!includeEditorOptions) {
    return {
      authors: [],
      categories: [],
      editorOptionsState: "warm",
      post,
      tags: [],
    };
  }

  const [authors, taxonomyOptions] = await Promise.all([
    loadMappedContentAuthors({
      accessibleAuthorIds,
      authorAssignmentsByAuthorId: authorAssignmentsByAuthorId ?? null,
      client,
      entity: runtime.authors,
      ids: post.authorId ? [post.authorId] : [],
      posts: runtime.posts,
      relation: runtime.posts.relations.authors,
    }),
    loadMappedContentEditorTaxonomyOptions({
      client,
      mapping,
      projectId,
      runtime,
    }),
  ]);

  return {
    authors,
    categories: taxonomyOptions.categories,
    editorOptionsState: "full",
    post,
    tags: taxonomyOptions.tags,
  };
};

export const getMappedContentSnapshot = async ({
  accessibleAuthorIds = null,
  authorAssignmentsByAuthorId,
  client,
  mapping,
  projectId,
}: {
  accessibleAuthorIds?: string[] | null;
  authorAssignmentsByAuthorId?: Map<string, { avatar_url: string | null }> | null;
  client: ContentDatabaseClient;
  mapping: ContentProjectMapping;
  projectId?: string;
}): Promise<ContentSnapshot> => {
  const postsPage = await getMappedContentPostsPage({
    accessibleAuthorIds,
    authorAssignmentsByAuthorId,
    client,
    includeEditorOptions: true,
    mapping,
    page: 1,
    pageSize: 20,
    projectId,
  });

  return {
    authors: postsPage.authors,
    categories: postsPage.categories,
    media: [],
    posts: postsPage.posts,
    primaryContentFormat: "html",
    tags: postsPage.tags,
    workspaceState: "ready",
  };
};
