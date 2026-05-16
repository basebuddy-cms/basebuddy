import "server-only";

import { logContentRuntimeCacheBuild } from "./request-observability";

export const projectRuntimeCacheGroups = {
  filesLibrary: "files-library",
  mediaLibrary: "media-library",
  projectAccess: "project-access",
  projectCredentials: "project-credentials",
  postDetail: "post-detail",
  postsPresence: "posts-presence",
  projectContext: "project-context",
  postsCount: "posts-count",
  postsPage: "posts-page",
  postsSnapshot: "posts-snapshot",
  taxonomyOptions: "taxonomy-options",
  workspaceMeta: "workspace-meta",
  workspaceSummary: "workspace-summary",
} as const;

export type ProjectRuntimeCacheGroup =
  (typeof projectRuntimeCacheGroups)[keyof typeof projectRuntimeCacheGroups];

type ProjectRuntimeCacheEntry = {
  expiresAt: number;
  groups: ProjectRuntimeCacheGroup[];
  projectId: string;
  staleWhileRevalidateUntil: number;
  value: unknown;
};

type PendingProjectRuntimeCacheEntry = {
  groups: ProjectRuntimeCacheGroup[];
  projectId: string;
  promise: Promise<unknown>;
};

type ProjectRuntimeCacheObservabilityInput = {
  mode?: string | null;
  scopeKey: string;
};

export type ProjectRuntimeCachePeekResult<T> =
  | { state: "fresh"; value: T }
  | { state: "missing" }
  | { state: "stale"; value: T };

const projectRuntimeCache = new Map<string, ProjectRuntimeCacheEntry>();
const pendingProjectRuntimeCache = new Map<string, PendingProjectRuntimeCacheEntry>();
const projectRuntimeCacheKeysByProjectId = new Map<string, Set<string>>();

const cloneProjectRuntimeValue = <T,>(value: T): T => structuredClone(value);

const getPendingProjectRuntimeValue = <T,>(cacheKey: string) =>
  pendingProjectRuntimeCache.get(cacheKey)?.promise as Promise<T> | undefined;

const rememberProjectRuntimeCacheKey = (projectId: string, cacheKey: string) => {
  const existingKeys = projectRuntimeCacheKeysByProjectId.get(projectId);

  if (existingKeys) {
    existingKeys.add(cacheKey);
    return;
  }

  projectRuntimeCacheKeysByProjectId.set(projectId, new Set([cacheKey]));
};

const forgetProjectRuntimeCacheKey = (projectId: string, cacheKey: string) => {
  const existingKeys = projectRuntimeCacheKeysByProjectId.get(projectId);

  if (!existingKeys) {
    return;
  }

  existingKeys.delete(cacheKey);

  if (!existingKeys.size) {
    projectRuntimeCacheKeysByProjectId.delete(projectId);
  }
};

const storeProjectRuntimeValue = <T>({
  cacheKey,
  groups,
  projectId,
  staleWhileRevalidateMs,
  ttlMs,
  value,
}: {
  cacheKey: string;
  groups: ProjectRuntimeCacheGroup[];
  projectId: string;
  staleWhileRevalidateMs: number;
  ttlMs: number;
  value: T;
}) => {
  const clonedValue = cloneProjectRuntimeValue(value);
  const now = Date.now();

  projectRuntimeCache.set(cacheKey, {
    expiresAt: now + ttlMs,
    groups,
    projectId,
    staleWhileRevalidateUntil: now + ttlMs + staleWhileRevalidateMs,
    value: clonedValue,
  });
  rememberProjectRuntimeCacheKey(projectId, cacheKey);

  return clonedValue;
};

const loadProjectRuntimeValue = async <T>({
  cacheKey,
  groups,
  load,
  observability,
  projectId,
  staleWhileRevalidateMs,
  ttlMs,
}: {
  cacheKey: string;
  groups: ProjectRuntimeCacheGroup[];
  load: () => Promise<T>;
  observability?: ProjectRuntimeCacheObservabilityInput;
  projectId: string;
  staleWhileRevalidateMs: number;
  ttlMs: number;
}) => {
  const existingPendingValue = getPendingProjectRuntimeValue<T>(cacheKey);

  if (existingPendingValue) {
    return existingPendingValue;
  }

  rememberProjectRuntimeCacheKey(projectId, cacheKey);
  const loadStartedAt = performance.now();

  const nextValuePromise = (async () => {
    const value = await load();
    return storeProjectRuntimeValue({
      cacheKey,
      groups,
      projectId,
      staleWhileRevalidateMs,
      ttlMs,
      value,
    });
  })();

  pendingProjectRuntimeCache.set(cacheKey, {
    groups,
    projectId,
    promise: nextValuePromise,
  });

  try {
    return await nextValuePromise;
  } finally {
    if (observability) {
      logContentRuntimeCacheBuild({
        durationMs: performance.now() - loadStartedAt,
        groups,
        mode: observability.mode ?? null,
        projectId,
        scopeKey: observability.scopeKey,
      });
    }

    pendingProjectRuntimeCache.delete(cacheKey);

    if (!projectRuntimeCache.has(cacheKey)) {
      forgetProjectRuntimeCacheKey(projectId, cacheKey);
    }
  }
};

export const getCachedProjectRuntimeValue = async <T>({
  cacheKey,
  groups = [],
  load,
  observability,
  projectId,
  staleWhileRevalidateMs = 0,
  ttlMs,
}: {
  cacheKey: string;
  groups?: ProjectRuntimeCacheGroup[];
  load: () => Promise<T>;
  observability?: ProjectRuntimeCacheObservabilityInput;
  projectId: string;
  staleWhileRevalidateMs?: number;
  ttlMs: number;
}): Promise<T> => {
  const now = Date.now();
  const cachedEntry = projectRuntimeCache.get(cacheKey);

  if (cachedEntry) {
    if (cachedEntry.expiresAt > now) {
      return cloneProjectRuntimeValue(cachedEntry.value as T);
    }

    if (cachedEntry.staleWhileRevalidateUntil > now) {
      void loadProjectRuntimeValue({
        cacheKey,
        groups,
        load,
        observability,
        projectId,
        staleWhileRevalidateMs,
        ttlMs,
      }).catch(() => undefined);

      return cloneProjectRuntimeValue(cachedEntry.value as T);
    }

    projectRuntimeCache.delete(cacheKey);
    forgetProjectRuntimeCacheKey(cachedEntry.projectId, cacheKey);
  }

  return cloneProjectRuntimeValue(
    await loadProjectRuntimeValue({
      cacheKey,
      groups,
      load,
      observability,
      projectId,
      staleWhileRevalidateMs,
      ttlMs,
    }),
  );
};

export const peekCachedProjectRuntimeValue = <T,>(
  cacheKey: string,
): ProjectRuntimeCachePeekResult<T> => {
  const now = Date.now();
  const cachedEntry = projectRuntimeCache.get(cacheKey);

  if (!cachedEntry) {
    return { state: "missing" };
  }

  if (cachedEntry.expiresAt > now) {
    return {
      state: "fresh",
      value: cloneProjectRuntimeValue(cachedEntry.value as T),
    };
  }

  if (cachedEntry.staleWhileRevalidateUntil > now) {
    return {
      state: "stale",
      value: cloneProjectRuntimeValue(cachedEntry.value as T),
    };
  }

  projectRuntimeCache.delete(cacheKey);
  forgetProjectRuntimeCacheKey(cachedEntry.projectId, cacheKey);

  return { state: "missing" };
};

export const invalidateProjectRuntimeCache = (
  projectId: string,
  options?: { groups?: ProjectRuntimeCacheGroup[] },
) => {
  const cacheKeys = projectRuntimeCacheKeysByProjectId.get(projectId);

  if (!cacheKeys?.size) {
    return;
  }

  const targetGroups = options?.groups?.length ? new Set(options.groups) : null;

  for (const cacheKey of Array.from(cacheKeys)) {
    const cachedEntry = projectRuntimeCache.get(cacheKey);
    const pendingEntry = pendingProjectRuntimeCache.get(cacheKey);
    const cacheGroups = cachedEntry?.groups ?? pendingEntry?.groups ?? [];

    if (targetGroups && !cacheGroups.some((group) => targetGroups.has(group))) {
      continue;
    }

    projectRuntimeCache.delete(cacheKey);
    pendingProjectRuntimeCache.delete(cacheKey);
    forgetProjectRuntimeCacheKey(projectId, cacheKey);
  }
};

export const invalidateProjectRuntimeCacheGroups = (
  projectId: string,
  groups: ProjectRuntimeCacheGroup[],
) => {
  invalidateProjectRuntimeCache(projectId, { groups });
};
