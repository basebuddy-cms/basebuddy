import {
  type ContentAuthor,
  type ContentCategory,
  type ContentCollectionCounts,
  type ContentRuntimeSummary,
  type ContentMedia,
  type ContentPagination,
  type ContentPostEditingSession,
  type ContentTag,
} from "./shared";
import type {
  ContentMediaStorageConfig,
} from "./mapping";
import { isS3CompatibleMediaStorageConfigUsable } from "./s3-compatible-storage";

export type ContentPaginationInput = {
  page?: number;
  pageSize?: number;
};

export type ResolvedContentPagination = ContentPagination & {
  offset: number;
};

export const CONTENT_DEFAULT_PAGE_SIZE = 20;
export const CONTENT_MAX_PAGE_SIZE = 100;

export const normalizeContentPageSize = (pageSize?: number) => {
  if (!Number.isFinite(pageSize) || !pageSize) {
    return CONTENT_DEFAULT_PAGE_SIZE;
  }

  return Math.max(1, Math.min(CONTENT_MAX_PAGE_SIZE, Math.floor(pageSize)));
};

export const resolveContentPagination = ({
  hasNextPage,
  page,
  pageSize,
  totalItems,
  totalItemsExact = true,
}: ContentPaginationInput & {
  hasNextPage?: boolean;
  totalItems: number;
  totalItemsExact?: boolean;
}): ResolvedContentPagination => {
  const normalizedPageSize = normalizeContentPageSize(pageSize);
  const totalPages = Math.max(1, Math.ceil(totalItems / normalizedPageSize));
  const normalizedPage =
    !Number.isFinite(page) || !page ? 1 : Math.max(1, Math.min(totalPages, Math.floor(page)));
  const resolvedHasPreviousPage = normalizedPage > 1;
  const resolvedHasNextPage =
    typeof hasNextPage === "boolean" ? hasNextPage : normalizedPage < totalPages;

  return {
    hasNextPage: resolvedHasNextPage,
    hasPreviousPage: resolvedHasPreviousPage,
    offset: (normalizedPage - 1) * normalizedPageSize,
    page: normalizedPage,
    pageSize: normalizedPageSize,
    totalItems,
    totalItemsExact,
    totalPages,
  };
};

export const resolveContentWindowPagination = ({
  hasNextPage,
  page,
  pageSize,
  totalItemsHint,
  visibleItemsCount,
}: ContentPaginationInput & {
  hasNextPage: boolean;
  totalItemsHint?: number;
  visibleItemsCount: number;
}): ResolvedContentPagination => {
  const normalizedPageSize = normalizeContentPageSize(pageSize);
  const normalizedPage =
    !Number.isFinite(page) || !page ? 1 : Math.max(1, Math.floor(page));
  const offset = (normalizedPage - 1) * normalizedPageSize;
  const exactTotalItems = offset + visibleItemsCount;

  if (!hasNextPage) {
    return {
      hasNextPage: false,
      hasPreviousPage: normalizedPage > 1,
      offset,
      page: normalizedPage,
      pageSize: normalizedPageSize,
      totalItems: exactTotalItems,
      totalItemsExact: true,
      totalPages: Math.max(1, normalizedPage),
    };
  }

  const minimumTotalItems = exactTotalItems + 1;
  const hintedTotalItems = Math.max(totalItemsHint ?? 0, minimumTotalItems);
  const minimumTotalPages = normalizedPage + 1;
  const hintedTotalPages = Math.max(1, Math.ceil(hintedTotalItems / normalizedPageSize));

  return {
    hasNextPage: true,
    hasPreviousPage: normalizedPage > 1,
    offset,
    page: normalizedPage,
    pageSize: normalizedPageSize,
    totalItems: hintedTotalItems,
    totalItemsExact: false,
    totalPages: Math.max(minimumTotalPages, hintedTotalPages),
  };
};

export const createEmptyContentCounts = (): ContentCollectionCounts => ({
  authors: 0,
  categories: 0,
  files: 0,
  media: 0,
  posts: 0,
  tags: 0,
});

export const createEmptyContentRuntimeSummary = (): ContentRuntimeSummary => ({
  customFields: [],
  editorFields: [],
  fieldSpecs: [],
  filesStorage: null,
  mediaStorage: null,
  sidebarFieldSpecs: [],
});

export const getNormalizedContentS3CompatibleStorageConfig = (
  mediaStorage: ContentMediaStorageConfig | null | undefined,
) => {
  if (mediaStorage?.provider !== "s3_compatible") {
    return null;
  }

  const bucketName = mediaStorage.bucketName?.trim() || null;
  const endpoint = mediaStorage.endpoint?.trim() || null;

  if (!isS3CompatibleMediaStorageConfigUsable({ bucketName, endpoint, region: mediaStorage.region })) {
    return null;
  }

  return {
    bucketName,
    endpoint,
    publicUrlBase: mediaStorage.publicUrlBase?.trim() || null,
    region: mediaStorage.region?.trim() || null,
  };
};

export const getNormalizedContentS3CompatibleMediaStorageConfig = (
  mediaStorage: ContentMediaStorageConfig | null | undefined,
) => getNormalizedContentS3CompatibleStorageConfig(mediaStorage);

export const createEmptyContentPagination = (
  input: ContentPaginationInput = {},
): ContentPagination =>
  resolveContentPagination({
    page: input.page,
    pageSize: input.pageSize,
    totalItems: 0,
  });

export const mapContentAuthor = (author: {
  avatar_url?: string | null;
  bio: string | null;
  created_at: string;
  email: string | null;
  id: string;
  name: string;
  slug: string;
}) =>
  ({
    avatarUrl: author.avatar_url ?? null,
    bio: author.bio,
    createdAt: author.created_at,
    email: author.email,
    id: author.id,
    name: author.name,
    slug: author.slug,
  }) satisfies ContentAuthor;

export const mapContentCategory = (category: {
  created_at: string;
  depth: number;
  description: string | null;
  hierarchy_path: string;
  id: string;
  name: string;
  parent_category_id: string | null;
  slug: string;
}) =>
  ({
    createdAt: category.created_at,
    depth: category.depth,
    description: category.description,
    hierarchyPath: category.hierarchy_path,
    id: category.id,
    name: category.name,
    parentCategoryId: category.parent_category_id,
    slug: category.slug,
  }) satisfies ContentCategory;

export const mapContentTag = (tag: {
  created_at: string;
  description: string | null;
  id: string;
  name: string;
  slug: string;
}) =>
  ({
    createdAt: tag.created_at,
    description: tag.description,
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
  }) satisfies ContentTag;

export const mapContentMedia = (item: {
  alt_text: string | null;
  bucket_name: string;
  created_at: string;
  file_name: string;
  id: string;
  object_path: string;
}) =>
  ({
    altText: item.alt_text,
    bucketName: item.bucket_name,
    createdAt: item.created_at,
    fileName: item.file_name,
    id: item.id,
    objectPath: item.object_path,
  }) satisfies ContentMedia;

export const mapContentPostEditingSession = (
  session: {
    avatar_url?: string | null;
    editor_email?: string | null;
    editor_name?: string | null;
    last_heartbeat_at?: string;
    post_id?: string;
    post_title?: string | null;
    user_id?: string;
  },
  currentUserId: string,
) =>
  ({
    avatarUrl: session.avatar_url ?? null,
    editorEmail: session.editor_email ?? null,
    editorName: session.editor_name ?? null,
    isCurrentUser: (session.user_id ?? "") === currentUserId,
    lastHeartbeatAt: session.last_heartbeat_at ?? new Date().toISOString(),
    postId: session.post_id ?? "",
    postTitle: session.post_title ?? null,
    userId: session.user_id ?? "",
  }) satisfies ContentPostEditingSession;
