import "server-only";

import {
  getCachedProjectRuntimeValue,
  projectRuntimeCacheGroups,
} from "./server-runtime-cache";
import { getContentPostsCountCacheKey } from "./server-runtime-cache-keys";
import type { ContentProjectContext } from "./server-posts-shared";
import type { ContentPostsStatusFilter } from "./shared";

const CONTENT_POSTS_COUNT_CACHE_TTL_MS = 30_000;
const CONTENT_POSTS_COUNT_CACHE_STALE_WHILE_REVALIDATE_MS = 120_000;

export const getCachedContentPostsCount = async ({
  context,
  load,
  projectId,
  scopeKey,
  search = "",
  status = "all",
}: {
  context: ContentProjectContext;
  load: () => Promise<number>;
  projectId: string;
  scopeKey: string;
  search?: string;
  status?: ContentPostsStatusFilter;
}) =>
  getCachedProjectRuntimeValue({
    cacheKey: getContentPostsCountCacheKey({
      context,
      projectId,
      scopeKey,
      search,
      status,
    }),
    groups: [projectRuntimeCacheGroups.postsCount],
    load,
    projectId,
    staleWhileRevalidateMs: CONTENT_POSTS_COUNT_CACHE_STALE_WHILE_REVALIDATE_MS,
    ttlMs: CONTENT_POSTS_COUNT_CACHE_TTL_MS,
  });
