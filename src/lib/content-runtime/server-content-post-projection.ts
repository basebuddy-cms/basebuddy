import "server-only";

import { createControlPlaneAdminClient } from "@/lib/control-plane/supabase-clients";

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

const EXISTING_DB_POST_PROJECTION_STATES_TABLE = "basebuddy_project_content_post_projection_states";
const EXISTING_DB_POST_PROJECTION_PREVIEWS_TABLE = "basebuddy_project_content_post_previews";
const EXISTING_DB_POST_PROJECTION_UPSERT_BATCH_SIZE = 200;
const CONTENT_POST_PROJECTION_SHALLOW_OFFSET_LIMIT = 1000;

const isMissingContentProjectionStorageError = (error: {
  code?: string | null;
  message?: string | null;
} | null | undefined) => {
  const message = error?.message ?? "";

  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    error?.code === "PGRST204" ||
    /basebuddy_project_content_post_projection_states/i.test(message) ||
    /basebuddy_project_content_post_previews/i.test(message) ||
    /invalid schema:\s*private/i.test(message) ||
    /relation .* does not exist/i.test(message) ||
    /could not find the table/i.test(message)
  );
};

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

type StoredContentPostProjectionRow = {
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

const normalizeProjectionIds = (values?: string[] | null) =>
  Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)));

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

const escapePostgrestFilterValue = (value: string) => {
  if (/^[A-Za-z0-9_.:@+-]+$/.test(value)) {
    return value;
  }

  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
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
}) => {
  const sortColumn = getProjectionSortColumn(sort);
  const value =
    sortColumn === "created_at"
      ? row.created_at
      : sortColumn === "title"
        ? row.title
        : row.updated_at;

  return createContentPostProjectionCursorToken({
    sort,
    sourcePostId: row.source_post_id,
    value,
  });
};

const applyContentPostProjectionCursor = ({
  cursor,
  query,
  sort,
}: {
  cursor: string | null | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any;
  sort: ContentPostsSort;
}) => {
  const payload = parseContentPostProjectionCursorToken(cursor, sort);

  if (!payload) {
    return query;
  }

  const sortColumn = getProjectionSortColumn(sort);
  const sortOperator = isProjectionSortAscending(sort) ? "gt" : "lt";
  const sortValue = escapePostgrestFilterValue(payload.value);
  const sourcePostId = escapePostgrestFilterValue(payload.sourcePostId);

  return query.or(
    `${sortColumn}.${sortOperator}.${sortValue},and(${sortColumn}.eq.${sortValue},source_post_id.gt.${sourcePostId})`,
  );
};

const applyContentPostProjectionFilters = ({
  accessibleAuthorIds,
  categoryIds,
  mapping,
  projectId,
  query,
  search,
  status,
  tagIds,
}: {
  accessibleAuthorIds?: string[] | null;
  categoryIds?: string[] | null;
  mapping: ContentProjectMapping;
  projectId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any;
  search?: string;
  status?: ContentPostsStatusFilter;
  tagIds?: string[] | null;
}) => {
  const normalizedAuthorIds = normalizeProjectionIds(accessibleAuthorIds);
  const normalizedCategoryIds = normalizeProjectionIds(categoryIds);
  const normalizedTagIds = normalizeProjectionIds(tagIds);
  const normalizedSearch = normalizeContentPostsSearch(search ?? "").toLowerCase();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let nextQuery: any = query
    .eq("project_id", projectId)
    .eq("mapping_revision_key", getContentPostsProjectionKey(mapping));

  if (accessibleAuthorIds !== null && accessibleAuthorIds !== undefined) {
    if (!normalizedAuthorIds.length) {
      return nextQuery.eq("source_post_id", "__no_projection_match__");
    }

    nextQuery = nextQuery.in("author_id", normalizedAuthorIds);
  }

  if (normalizedCategoryIds.length) {
    nextQuery = nextQuery.overlaps("category_ids", normalizedCategoryIds);
  }

  if (normalizedTagIds.length) {
    nextQuery = nextQuery.overlaps("tag_ids", normalizedTagIds);
  }

  if (status && status !== "all") {
    nextQuery = nextQuery.eq("status", status);
  }

  if (normalizedSearch) {
    nextQuery = nextQuery.ilike("search_text", `%${normalizedSearch}%`);
  }

  return nextQuery;
};

const mapContentPostProjectionState = (row: {
  last_error?: string | null;
  last_refreshed_at?: string | null;
  processed_items?: number | null;
  progress_cursor?: string | null;
  status?: ContentPostProjectionStateStatus | null;
  total_items?: number | null;
}) => ({
  lastError: row.last_error ?? null,
  lastRefreshedAt: row.last_refreshed_at ?? null,
  processedItems: Number(row.processed_items ?? 0),
  progressCursor: row.progress_cursor ?? null,
  status: (row.status ?? "stale") as ContentPostProjectionStateStatus,
  totalItems: Number(row.total_items ?? 0),
});

const mapContentPostProjectionRowForStorage = ({
  mapping,
  row,
}: {
  mapping: ContentProjectMapping;
  row: ContentPostProjectionRow;
}) => ({
  author_id: row.authorId,
  category_ids: row.categoryIds,
  created_at: row.createdAt,
  excerpt: row.excerpt,
  mapping_revision_id: mapping.revisionId,
  mapping_revision_key: getContentPostsProjectionKey(mapping),
  mapping_revision_version: mapping.revisionVersion ?? 0,
  project_id: row.projectId,
  published_at: row.publishedAt,
  refreshed_at: row.refreshedAt,
  search_text: row.searchText,
  slug: row.slug,
  source_post_id: row.sourcePostId,
  status: row.status,
  tag_ids: row.tagIds,
  title: row.title,
  updated_at: row.updatedAt,
});

export const getContentPostsProjectionKey = (
  mapping: Pick<ContentProjectMapping, "bindingId" | "revisionId" | "revisionVersion">,
) => getContentMappingRevisionCacheKey(mapping);

export { isMissingContentProjectionStorageError };

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
  const supabase = createControlPlaneAdminClient();
  const { data, error } = await supabase
    .schema("private")
    .from(EXISTING_DB_POST_PROJECTION_STATES_TABLE)
    .select("status,total_items,processed_items,progress_cursor,last_refreshed_at,last_error,mapping_revision_key")
    .eq("project_id", projectId)
    .eq("mapping_revision_key", getContentPostsProjectionKey(mapping))
    .maybeSingle();

  if (error) {
    if (isMissingContentProjectionStorageError(error)) {
      return null;
    }

    throw error;
  }

  if (!data) {
    return null;
  }

  return mapContentPostProjectionState(data);
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
  const supabase = createControlPlaneAdminClient();
  const { data, error } = await supabase
    .schema("private")
    .from(EXISTING_DB_POST_PROJECTION_PREVIEWS_TABLE)
    .select("author_id")
    .eq("project_id", projectId)
    .eq("mapping_revision_key", getContentPostsProjectionKey(mapping))
    .eq("source_post_id", postId)
    .maybeSingle();

  if (error) {
    if (isMissingContentProjectionStorageError(error)) {
      return null;
    }

    throw error;
  }

  return typeof data?.author_id === "string" && data.author_id.trim()
    ? data.author_id
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
  const supabase = createControlPlaneAdminClient();
  const { error } = await supabase
    .schema("private")
    .from(EXISTING_DB_POST_PROJECTION_STATES_TABLE)
    .upsert(
      {
        last_error: lastError,
        last_refreshed_at: lastRefreshedAt,
        mapping_revision_id: mapping.revisionId,
        mapping_revision_key: getContentPostsProjectionKey(mapping),
        mapping_revision_version: mapping.revisionVersion ?? 0,
        processed_items: processedItems,
        progress_cursor: progressCursor,
        project_id: projectId,
        status,
        total_items: totalItems,
      },
      {
        onConflict: "project_id,mapping_revision_key",
      },
    );

  if (error) {
    if (isMissingContentProjectionStorageError(error)) {
      return;
    }

    throw error;
  }
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

  const supabase = createControlPlaneAdminClient();

  for (let index = 0; index < rows.length; index += EXISTING_DB_POST_PROJECTION_UPSERT_BATCH_SIZE) {
    const nextBatch = rows
      .slice(index, index + EXISTING_DB_POST_PROJECTION_UPSERT_BATCH_SIZE)
      .map((row) => mapContentPostProjectionRowForStorage({ mapping, row: { ...row, projectId } }));

    const { error } = await supabase
      .schema("private")
      .from(EXISTING_DB_POST_PROJECTION_PREVIEWS_TABLE)
      .upsert(nextBatch, {
        onConflict: "project_id,mapping_revision_key,source_post_id",
      });

    if (error) {
      if (isMissingContentProjectionStorageError(error)) {
        return;
      }

      throw error;
    }
  }
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
  const normalizedSourcePostIds = normalizeProjectionIds(sourcePostIds);
  let query = createControlPlaneAdminClient()
    .schema("private")
    .from(EXISTING_DB_POST_PROJECTION_PREVIEWS_TABLE)
    .delete()
    .eq("project_id", projectId)
    .eq("mapping_revision_key", getContentPostsProjectionKey(mapping))
    .neq("refreshed_at", refreshedAt);

  if (sourcePostIds !== null) {
    if (!normalizedSourcePostIds.length) {
      return;
    }

    query = query.in("source_post_id", normalizedSourcePostIds);
  }

  const { error } = await query;

  if (error) {
    if (isMissingContentProjectionStorageError(error)) {
      return;
    }

    throw error;
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
}) => {
  const supabase = createControlPlaneAdminClient();
  const query = applyContentPostProjectionFilters({
    accessibleAuthorIds,
    categoryIds,
    mapping,
    projectId,
    query: supabase
      .schema("private")
      .from(EXISTING_DB_POST_PROJECTION_PREVIEWS_TABLE)
      .select("source_post_id", { count: "exact", head: true }),
    search,
    status,
    tagIds,
  });
  const { count, error } = await query;

  if (error) {
    throw error;
  }

  return Number(count ?? 0);
};

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
}) => {
  const supabase = createControlPlaneAdminClient();
  const query = applyContentPostProjectionFilters({
    accessibleAuthorIds,
    categoryIds,
    mapping,
    projectId,
    query: supabase
      .schema("private")
      .from(EXISTING_DB_POST_PROJECTION_PREVIEWS_TABLE)
      .select(
        "source_post_id,title,slug,excerpt,status,created_at,updated_at,published_at,author_id,category_ids,tag_ids",
      ),
    search,
    status,
    tagIds,
  })
    .order(getProjectionSortColumn(sort), { ascending: isProjectionSortAscending(sort) })
    .order("source_post_id", { ascending: true });
  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return ((data ?? []) as StoredContentPostProjectionRow[]).map((row) =>
    mapContentProjectedPostPreview(row),
  );
};

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
      ? (totalItems ?? 0)
      : totalItems ??
        (await countContentPostsProjection({
          accessibleAuthorIds,
          categoryIds,
          mapping,
          projectId,
          search,
          status,
          tagIds,
        }));
  const pagination = useWindowPagination || shouldUseCursorPagination
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
  const from = pagination.offset;
  const to = Math.max(
    from,
    from + pagination.pageSize - 1 + (useWindowPagination && !shouldUseCursorPagination ? 1 : 0),
  );

  const supabase = createControlPlaneAdminClient();
  let query = applyContentPostProjectionFilters({
    accessibleAuthorIds,
    categoryIds,
    mapping,
    projectId,
    query: supabase
      .schema("private")
      .from(EXISTING_DB_POST_PROJECTION_PREVIEWS_TABLE)
      .select(
        "source_post_id,title,slug,excerpt,status,created_at,updated_at,published_at,author_id,category_ids,tag_ids",
      ),
    search,
    status,
    tagIds,
  })
    .order(getProjectionSortColumn(sort), { ascending: isProjectionSortAscending(sort) })
    .order("source_post_id", { ascending: true });

  if (shouldUseCursorPagination) {
    query = applyContentPostProjectionCursor({
      cursor,
      query,
      sort,
    }).limit(pagination.pageSize + 1);
  } else {
    query = query.range(from, to);
  }
  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as StoredContentPostProjectionRow[];
  const hasNextPage =
    (useWindowPagination || shouldUseCursorPagination) && rows.length > pagination.pageSize;
  const visibleRows = useWindowPagination || shouldUseCursorPagination
    ? rows.slice(0, pagination.pageSize)
    : rows;
  const windowPagination = useWindowPagination || shouldUseCursorPagination
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
    posts: visibleRows.map((row) =>
      mapContentProjectedPostPreview(row),
    ),
  };
};
