import "server-only";

import {
  getCachedProjectRuntimeValue,
  projectRuntimeCacheGroups,
} from "./server-runtime-cache";
import { getContentPostsQuerySnapshotCacheKey } from "./server-runtime-cache-keys";
import type { ContentPost, ContentPostsSort, ContentPostsStatusFilter } from "./shared";

const CONTENT_POSTS_QUERY_SNAPSHOT_CACHE_TTL_MS = 30_000;
const CONTENT_POSTS_QUERY_SNAPSHOT_CACHE_STALE_WHILE_REVALIDATE_MS = 120_000;

export const CONTENT_POSTS_QUERY_SNAPSHOT_MAX_ITEMS = 500;

type ContentPostsQuerySnapshot = {
  posts: ContentPost[];
  totalItems: number;
};

export const getCachedContentPostsQuerySnapshot = async ({
  cacheSignature,
  load,
  projectId,
  scopeKey,
  search,
  sort,
  status,
}: {
  cacheSignature: string;
  load: () => Promise<ContentPostsQuerySnapshot>;
  projectId: string;
  scopeKey: string;
  search: string;
  sort: ContentPostsSort;
  status: ContentPostsStatusFilter;
}) =>
  getCachedProjectRuntimeValue({
    cacheKey: getContentPostsQuerySnapshotCacheKey({
      cacheSignature,
      projectId,
      scopeKey,
      search,
      sort,
      status,
    }),
    groups: [projectRuntimeCacheGroups.postsSnapshot],
    load,
    projectId,
    staleWhileRevalidateMs: CONTENT_POSTS_QUERY_SNAPSHOT_CACHE_STALE_WHILE_REVALIDATE_MS,
    ttlMs: CONTENT_POSTS_QUERY_SNAPSHOT_CACHE_TTL_MS,
  });
