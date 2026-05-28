import "server-only";

import {
  createContentPostListPreview,
  normalizeContentPostsSearch,
  type ContentPost,
  type ContentPostsSort,
  type ContentPostsStatusFilter,
} from "./shared";
import {
  resolveContentPagination,
  resolveContentWindowPagination,
  type ContentPaginationInput,
} from "./server-support";
import type { ContentProjectMapping } from "./mapping";
import { getContentMappingRevisionCacheKey } from "./mapped-content-runtime-support";

const CONTENT_POST_PROJECTION_SHALLOW_OFFSET_LIMIT = 1000;

export type ContentPostProjectionStateStatus = "building" | "failed" | "ready" | "stale";

export type ContentPostProjectionState = {
  lastError: string | null;
  lastRefreshedAt: string | null;
  processedItems: number;
  progressCursor: string | null;
  status: ContentPostProjectionStateStatus;
  totalItems: number;
};

export type ContentPostProjectionRow = {
  authorId: string | null;
  categoryIds: string[];
  createdAt: string;
  excerpt: string | null;
  projectId: string;
  publishedAt: string | null;
  refreshedAt: string;
  searchText: string;
  slug: string;
  sourcePostId: string;
  status: ContentPost["status"];
  tagIds: string[];
  title: string;
  updatedAt: string;
};

export type StoredContentPostProjectionRow = {
  author_id: string | null;
  category_ids: string[] | null;
  created_at: string;
  excerpt: string | null;
  project_id: string;
  published_at: string | null;
  refreshed_at: string;
  search_text: string;
  slug: string;
  source_post_id: string;
  status: ContentPost["status"];
  tag_ids: string[] | null;
  title: string;
  updated_at: string;
};

type ContentPostProjectionCursorPayload = {
  sort: ContentPostsSort;
  sourcePostId: string;
  value: string;
};

type ProjectionStoreKeyInput = {
  mapping: Pick<ContentProjectMapping, "bindingId" | "revisionId" | "revisionVersion">;
  projectId: string;
};

const contentPostProjectionStates = new Map<string, ContentPostProjectionState>();
const contentPostProjectionRows = new Map<string, Map<string, StoredContentPostProjectionRow>>();

const normalizeProjectionIds = (values?: string[] | null) =>
  Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)));

const getProjectionStoreKey = ({ mapping, projectId }: ProjectionStoreKeyInput) =>
  `${projectId}:${getContentPostsProjectionKey(mapping)}`;

const cloneContentPostProjectionState = (
  state: ContentPostProjectionState,
): ContentPostProjectionState => ({
  lastError: state.lastError,
  lastRefreshedAt: state.lastRefreshedAt,
  processedItems: state.processedItems,
  progressCursor: state.progressCursor,
  status: state.status,
  totalItems: state.totalItems,
});

const cloneStoredContentPostProjectionRow = (
  row: StoredContentPostProjectionRow,
): StoredContentPostProjectionRow => ({
  author_id: row.author_id,
  category_ids: normalizeProjectionIds(row.category_ids),
  created_at: row.created_at,
  excerpt: row.excerpt,
  project_id: row.project_id,
  published_at: row.published_at,
  refreshed_at: row.refreshed_at,
  search_text: row.search_text,
  slug: row.slug,
  source_post_id: row.source_post_id,
  status: row.status,
  tag_ids: normalizeProjectionIds(row.tag_ids),
  title: row.title,
  updated_at: row.updated_at,
});

const getProjectionSortColumn = (sort: ContentPostsSort) => {
  switch (sort) {
    case "created_asc":
    case "created_desc":
      return "created_at";
    case "title_asc":
    case "title_desc":
      return "title";
    case "updated_asc":
    case "updated_desc":
    default:
      return "updated_at";
  }
};

const isProjectionSortAscending = (sort: ContentPostsSort) =>
  sort === "created_asc" || sort === "title_asc" || sort === "updated_asc";

const getProjectionSortValue = (row: StoredContentPostProjectionRow, sort: ContentPostsSort) => {
  const sortColumn = getProjectionSortColumn(sort);

  if (sortColumn === "created_at") {
    return row.created_at;
  }

  if (sortColumn === "title") {
    return row.title;
  }

  return row.updated_at;
};

const compareStoredContentPostProjectionRows =
  (sort: ContentPostsSort) =>
  (left: StoredContentPostProjectionRow, right: StoredContentPostProjectionRow) => {
    const sortDirection = isProjectionSortAscending(sort) ? 1 : -1;
    const sortComparison = getProjectionSortValue(left, sort).localeCompare(
      getProjectionSortValue(right, sort),
    );

    if (sortComparison !== 0) {
      return sortComparison * sortDirection;
    }

    return left.source_post_id.localeCompare(right.source_post_id);
  };

const createContentPostProjectionCursorToken = (payload: ContentPostProjectionCursorPayload) =>
  Buffer.from(JSON.stringify(payload)).toString("base64url");

const parseContentPostProjectionCursorToken = (
  cursor: string | null | undefined,
  sort: ContentPostsSort,
): ContentPostProjectionCursorPayload | null => {
  if (!cursor?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Partial<
      ContentPostProjectionCursorPayload
    >;

    if (
      parsed.sort !== sort ||
      typeof parsed.sourcePostId !== "string" ||
      !parsed.sourcePostId.trim() ||
      typeof parsed.value !== "string"
    ) {
      return null;
    }

    return {
      sort: parsed.sort,
      sourcePostId: parsed.sourcePostId,
      value: parsed.value,
    };
  } catch {
    return null;
  }
};

const createContentPostProjectionCursorFromRow = ({
  row,
  sort,
}: {
  row: StoredContentPostProjectionRow;
  sort: ContentPostsSort;
}) =>
  createContentPostProjectionCursorToken({
    sort,
    sourcePostId: row.source_post_id,
    value: getProjectionSortValue(row, sort),
  });

const mapContentPostProjectionRowForStorage = ({
  row,
}: {
  row: ContentPostProjectionRow;
}): StoredContentPostProjectionRow => ({
  author_id: row.authorId,
  category_ids: normalizeProjectionIds(row.categoryIds),
  created_at: row.createdAt,
  excerpt: row.excerpt,
  project_id: row.projectId,
  published_at: row.publishedAt,
  refreshed_at: row.refreshedAt,
  search_text: row.searchText,
  slug: row.slug,
  source_post_id: row.sourcePostId,
  status: row.status,
  tag_ids: normalizeProjectionIds(row.tagIds),
  title: row.title,
  updated_at: row.updatedAt,
});

const getStoredContentPostProjectionRows = ({
  mapping,
  projectId,
}: ProjectionStoreKeyInput) =>
  Array.from(
    contentPostProjectionRows.get(getProjectionStoreKey({ mapping, projectId }))?.values() ?? [],
  ).map(cloneStoredContentPostProjectionRow);

const getFilteredContentPostProjectionRows = ({
  accessibleAuthorIds = null,
  categoryIds = null,
  mapping,
  projectId,
  search = "",
  sort = "updated_desc",
  status = "all",
  tagIds = null,
}: {
  accessibleAuthorIds?: string[] | null;
  categoryIds?: string[] | null;
  mapping: ContentProjectMapping;
  projectId: string;
  search?: string;
  sort?: ContentPostsSort;
  status?: ContentPostsStatusFilter;
  tagIds?: string[] | null;
}) => {
  const normalizedAuthorIds = normalizeProjectionIds(accessibleAuthorIds);
  const normalizedCategoryIds = normalizeProjectionIds(categoryIds);
  const normalizedTagIds = normalizeProjectionIds(tagIds);
  const normalizedSearch = normalizeContentPostsSearch(search ?? "").toLowerCase();

  if (accessibleAuthorIds !== null && accessibleAuthorIds !== undefined && !normalizedAuthorIds.length) {
    return [];
  }

  return getStoredContentPostProjectionRows({ mapping, projectId })
    .filter((row) => {
      if (
        accessibleAuthorIds !== null &&
        accessibleAuthorIds !== undefined &&
        (!row.author_id || !normalizedAuthorIds.includes(row.author_id))
      ) {
        return false;
      }

      if (
        normalizedCategoryIds.length &&
        !normalizeProjectionIds(row.category_ids).some((categoryId) =>
          normalizedCategoryIds.includes(categoryId),
        )
      ) {
        return false;
      }

      if (
        normalizedTagIds.length &&
        !normalizeProjectionIds(row.tag_ids).some((tagId) => normalizedTagIds.includes(tagId))
      ) {
        return false;
      }

      if (status !== "all" && row.status !== status) {
        return false;
      }

      if (
        normalizedSearch &&
        !normalizeContentPostsSearch(row.search_text).toLowerCase().includes(normalizedSearch)
      ) {
        return false;
      }

      return true;
    })
    .sort(compareStoredContentPostProjectionRows(sort));
};

export const getContentPostsProjectionKey = (
  mapping: Pick<ContentProjectMapping, "bindingId" | "revisionId" | "revisionVersion">,
) => getContentMappingRevisionCacheKey(mapping);

export const isMissingContentProjectionStorageError = (
  _error?: { code?: string | null; message?: string | null } | null,
) => false;

export const mapContentProjectedPostPreview = (
  row: Pick<
    StoredContentPostProjectionRow,
    | "author_id"
    | "category_ids"
    | "created_at"
    | "excerpt"
    | "published_at"
    | "slug"
    | "source_post_id"
    | "status"
    | "tag_ids"
    | "title"
    | "updated_at"
  >,
): ContentPost => {
  const preview = createContentPostListPreview({
    authorId: row.author_id,
    createdAt: row.created_at,
    excerpt: row.excerpt,
    id: row.source_post_id,
    publishedAt: row.published_at,
    slug: row.slug,
    status: row.status,
    title: row.title,
    updatedAt: row.updated_at,
  });

  return {
    ...preview,
    categoryIds: normalizeProjectionIds(row.category_ids),
    tagIds: normalizeProjectionIds(row.tag_ids),
  };
};

export const getContentPostsProjectionState = async ({
  mapping,
  projectId,
}: {
  mapping: ContentProjectMapping;
  projectId: string;
}): Promise<ContentPostProjectionState | null> => {
  const state = contentPostProjectionStates.get(getProjectionStoreKey({ mapping, projectId }));

  return state ? cloneContentPostProjectionState(state) : null;
};

export const getContentPostProjectionAuthorId = async ({
  mapping,
  postId,
  projectId,
}: {
  mapping: ContentProjectMapping;
  postId: string;
  projectId: string;
}): Promise<string | null> => {
  const row = contentPostProjectionRows
    .get(getProjectionStoreKey({ mapping, projectId }))
    ?.get(postId);

  return typeof row?.author_id === "string" && row.author_id.trim()
    ? row.author_id
    : null;
};

export const saveContentPostsProjectionState = async ({
  lastError,
  lastRefreshedAt,
  mapping,
  processedItems = 0,
  progressCursor = null,
  projectId,
  status,
  totalItems,
}: Partial<Pick<ContentPostProjectionState, "processedItems" | "progressCursor">> &
  Omit<ContentPostProjectionState, "processedItems" | "progressCursor"> & {
    mapping: ContentProjectMapping;
    projectId: string;
  }) => {
  contentPostProjectionStates.set(getProjectionStoreKey({ mapping, projectId }), {
    lastError,
    lastRefreshedAt,
    processedItems,
    progressCursor,
    status,
    totalItems,
  });
};

export const markContentPostsProjectionStale = async ({
  mapping,
  projectId,
}: {
  mapping: ContentProjectMapping;
  projectId: string;
}) => {
  const existingState = await getContentPostsProjectionState({
    mapping,
    projectId,
  });

  await saveContentPostsProjectionState({
    lastError: existingState?.lastError ?? null,
    lastRefreshedAt: existingState?.lastRefreshedAt ?? null,
    mapping,
    processedItems: existingState?.processedItems ?? 0,
    progressCursor: existingState?.progressCursor ?? null,
    projectId,
    status: "stale",
    totalItems: existingState?.totalItems ?? 0,
  });
};

export const upsertContentPostProjectionRows = async ({
  mapping,
  projectId,
  rows,
}: {
  mapping: ContentProjectMapping;
  projectId: string;
  rows: ContentPostProjectionRow[];
}) => {
  if (!rows.length) {
    return;
  }

  const storeKey = getProjectionStoreKey({ mapping, projectId });
  const existingRows = contentPostProjectionRows.get(storeKey) ?? new Map<string, StoredContentPostProjectionRow>();

  for (const row of rows) {
    if (!row.sourcePostId.trim()) {
      continue;
    }

    existingRows.set(
      row.sourcePostId,
      mapContentPostProjectionRowForStorage({
        row: {
          ...row,
          projectId,
        },
      }),
    );
  }

  contentPostProjectionRows.set(storeKey, existingRows);
};

export const deleteStaleContentPostProjectionRows = async ({
  mapping,
  projectId,
  refreshedAt,
  sourcePostIds = null,
}: {
  mapping: ContentProjectMapping;
  projectId: string;
  refreshedAt: string;
  sourcePostIds?: string[] | null;
}) => {
  const store = contentPostProjectionRows.get(getProjectionStoreKey({ mapping, projectId }));

  if (!store?.size) {
    return;
  }

  const normalizedSourcePostIds = normalizeProjectionIds(sourcePostIds);

  if (sourcePostIds !== null && !normalizedSourcePostIds.length) {
    return;
  }

  for (const [sourcePostId, row] of Array.from(store.entries())) {
    if (sourcePostIds !== null && !normalizedSourcePostIds.includes(sourcePostId)) {
      continue;
    }

    if (row.refreshed_at !== refreshedAt) {
      store.delete(sourcePostId);
    }
  }
};

export const countContentPostsProjection = async ({
  accessibleAuthorIds = null,
  categoryIds = null,
  mapping,
  projectId,
  search = "",
  status = "all",
  tagIds = null,
}: {
  accessibleAuthorIds?: string[] | null;
  categoryIds?: string[] | null;
  mapping: ContentProjectMapping;
  projectId: string;
  search?: string;
  status?: ContentPostsStatusFilter;
  tagIds?: string[] | null;
}) =>
  getFilteredContentPostProjectionRows({
    accessibleAuthorIds,
    categoryIds,
    mapping,
    projectId,
    search,
    status,
    tagIds,
  }).length;

export const listContentPostProjectionPreviews = async ({
  accessibleAuthorIds = null,
  categoryIds = null,
  mapping,
  projectId,
  search = "",
  sort = "updated_desc",
  status = "all",
  tagIds = null,
}: {
  accessibleAuthorIds?: string[] | null;
  categoryIds?: string[] | null;
  mapping: ContentProjectMapping;
  projectId: string;
  search?: string;
  sort?: ContentPostsSort;
  status?: ContentPostsStatusFilter;
  tagIds?: string[] | null;
}) =>
  getFilteredContentPostProjectionRows({
    accessibleAuthorIds,
    categoryIds,
    mapping,
    projectId,
    search,
    sort,
    status,
    tagIds,
  }).map((row) => mapContentProjectedPostPreview(row));

export const getContentPostsProjectionPage = async ({
  accessibleAuthorIds = null,
  categoryIds = null,
  cursor = null,
  mapping,
  page,
  pageSize,
  projectId,
  search = "",
  sort = "updated_desc",
  status = "all",
  tagIds = null,
  totalItems,
  useCursorPagination = false,
  useWindowPagination = false,
}: ContentPaginationInput & {
  accessibleAuthorIds?: string[] | null;
  categoryIds?: string[] | null;
  cursor?: string | null;
  mapping: ContentProjectMapping;
  projectId: string;
  search?: string;
  sort?: ContentPostsSort;
  status?: ContentPostsStatusFilter;
  tagIds?: string[] | null;
  totalItems?: number;
  useCursorPagination?: boolean;
  useWindowPagination?: boolean;
}) => {
  const filteredRows = getFilteredContentPostProjectionRows({
    accessibleAuthorIds,
    categoryIds,
    mapping,
    projectId,
    search,
    sort,
    status,
    tagIds,
  });
  const normalizedProjectionPageSize =
    Number.isFinite(pageSize) && pageSize ? Math.max(1, Math.min(100, Math.floor(pageSize))) : 20;
  const requestedProjectionPage =
    Number.isFinite(page) && page ? Math.max(1, Math.floor(page)) : 1;
  const requestedProjectionOffset = (requestedProjectionPage - 1) * normalizedProjectionPageSize;
  const hasCursor = Boolean(cursor?.trim());
  const shouldUseCursorPagination =
    useCursorPagination ||
    requestedProjectionOffset > CONTENT_POST_PROJECTION_SHALLOW_OFFSET_LIMIT;
  const resolvedPage = shouldUseCursorPagination && !hasCursor ? 1 : page;
  const resolvedTotalItems =
    useWindowPagination || shouldUseCursorPagination
      ? (totalItems ?? filteredRows.length)
      : (totalItems ?? filteredRows.length);
  const pagination =
    useWindowPagination || shouldUseCursorPagination
      ? resolveContentWindowPagination({
          hasNextPage: false,
          page: resolvedPage,
          pageSize,
          totalItemsHint: resolvedTotalItems,
          visibleItemsCount: 0,
        })
      : resolveContentPagination({
          page,
          pageSize,
          totalItems: resolvedTotalItems,
        });

  const cursorPayload = shouldUseCursorPagination
    ? parseContentPostProjectionCursorToken(cursor, sort)
    : null;
  const cursorRowIndex = cursorPayload
    ? filteredRows.findIndex((row) => row.source_post_id === cursorPayload.sourcePostId)
    : -1;
  const from = shouldUseCursorPagination
    ? Math.max(0, cursorRowIndex + 1)
    : pagination.offset;
  const requestedRows = filteredRows.slice(
    from,
    from + pagination.pageSize + (useWindowPagination || shouldUseCursorPagination ? 1 : 0),
  );
  const hasNextPage =
    (useWindowPagination || shouldUseCursorPagination) && requestedRows.length > pagination.pageSize;
  const visibleRows =
    useWindowPagination || shouldUseCursorPagination
      ? requestedRows.slice(0, pagination.pageSize)
      : requestedRows;
  const windowPagination =
    useWindowPagination || shouldUseCursorPagination
      ? resolveContentWindowPagination({
          hasNextPage,
          page: resolvedPage,
          pageSize,
          totalItemsHint: resolvedTotalItems,
          visibleItemsCount: visibleRows.length,
        })
      : pagination;
  const nextCursor =
    shouldUseCursorPagination && hasNextPage && visibleRows.length
      ? createContentPostProjectionCursorFromRow({
          row: visibleRows[visibleRows.length - 1] as StoredContentPostProjectionRow,
          sort,
        })
      : null;

  return {
    pagination: {
      ...windowPagination,
      hasPreviousPage: shouldUseCursorPagination ? hasCursor : windowPagination.hasPreviousPage,
      nextCursor,
    },
    posts: visibleRows.map((row) => mapContentProjectedPostPreview(row)),
  };
};
