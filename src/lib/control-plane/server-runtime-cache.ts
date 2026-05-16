import "server-only";

export const controlPlaneRuntimeCacheGroups = {
  profileBootstrap: "profile-bootstrap",
  projectBootstrap: "project-bootstrap",
  projectsList: "projects-list",
} as const;

export type ControlPlaneRuntimeCacheGroup =
  (typeof controlPlaneRuntimeCacheGroups)[keyof typeof controlPlaneRuntimeCacheGroups];

type ControlPlaneRuntimeCacheEntry = {
  expiresAt: number;
  groups: ControlPlaneRuntimeCacheGroup[];
  projectIds: string[];
  staleWhileRevalidateUntil: number;
  userId: string;
  value: unknown;
};

type PendingControlPlaneRuntimeCacheEntry = {
  promise: Promise<unknown>;
};

const controlPlaneRuntimeCache = new Map<string, ControlPlaneRuntimeCacheEntry>();
const pendingControlPlaneRuntimeCache = new Map<string, PendingControlPlaneRuntimeCacheEntry>();
const controlPlaneRuntimeCacheKeysByProjectId = new Map<string, Set<string>>();
const controlPlaneRuntimeCacheKeysByUserId = new Map<string, Set<string>>();

const cloneControlPlaneRuntimeValue = <T,>(value: T): T => structuredClone(value);

const rememberControlPlaneRuntimeCacheKey = (
  indexMap: Map<string, Set<string>>,
  indexKey: string,
  cacheKey: string,
) => {
  const existingKeys = indexMap.get(indexKey);

  if (existingKeys) {
    existingKeys.add(cacheKey);
    return;
  }

  indexMap.set(indexKey, new Set([cacheKey]));
};

const forgetControlPlaneRuntimeCacheKey = (
  indexMap: Map<string, Set<string>>,
  indexKey: string,
  cacheKey: string,
) => {
  const existingKeys = indexMap.get(indexKey);

  if (!existingKeys) {
    return;
  }

  existingKeys.delete(cacheKey);

  if (!existingKeys.size) {
    indexMap.delete(indexKey);
  }
};

const rememberControlPlaneRuntimeEntry = (
  cacheKey: string,
  userId: string,
  projectIds: string[],
) => {
  rememberControlPlaneRuntimeCacheKey(controlPlaneRuntimeCacheKeysByUserId, userId, cacheKey);

  for (const projectId of projectIds) {
    rememberControlPlaneRuntimeCacheKey(controlPlaneRuntimeCacheKeysByProjectId, projectId, cacheKey);
  }
};

const forgetControlPlaneRuntimeEntry = (
  cacheKey: string,
  entry: Pick<ControlPlaneRuntimeCacheEntry, "projectIds" | "userId">,
) => {
  forgetControlPlaneRuntimeCacheKey(controlPlaneRuntimeCacheKeysByUserId, entry.userId, cacheKey);

  for (const projectId of entry.projectIds) {
    forgetControlPlaneRuntimeCacheKey(controlPlaneRuntimeCacheKeysByProjectId, projectId, cacheKey);
  }
};

const storeControlPlaneRuntimeValue = <T,>({
  cacheKey,
  getProjectIds,
  groups,
  staleWhileRevalidateMs,
  ttlMs,
  userId,
  value,
}: {
  cacheKey: string;
  getProjectIds?: ((value: T) => string[]) | undefined;
  groups: ControlPlaneRuntimeCacheGroup[];
  staleWhileRevalidateMs: number;
  ttlMs: number;
  userId: string;
  value: T;
}) => {
  const clonedValue = cloneControlPlaneRuntimeValue(value);
  const projectIds = Array.from(
    new Set((getProjectIds ? getProjectIds(clonedValue) : []).filter(Boolean)),
  );
  const now = Date.now();
  const existingEntry = controlPlaneRuntimeCache.get(cacheKey);

  if (existingEntry) {
    forgetControlPlaneRuntimeEntry(cacheKey, existingEntry);
  }

  controlPlaneRuntimeCache.set(cacheKey, {
    expiresAt: now + ttlMs,
    groups,
    projectIds,
    staleWhileRevalidateUntil: now + ttlMs + staleWhileRevalidateMs,
    userId,
    value: clonedValue,
  });
  rememberControlPlaneRuntimeEntry(cacheKey, userId, projectIds);

  return clonedValue;
};

const loadControlPlaneRuntimeValue = async <T,>({
  cacheKey,
  getProjectIds,
  groups,
  load,
  staleWhileRevalidateMs,
  ttlMs,
  userId,
}: {
  cacheKey: string;
  getProjectIds?: ((value: T) => string[]) | undefined;
  groups: ControlPlaneRuntimeCacheGroup[];
  load: () => Promise<T>;
  staleWhileRevalidateMs: number;
  ttlMs: number;
  userId: string;
}) => {
  const existingPendingEntry = pendingControlPlaneRuntimeCache.get(cacheKey)?.promise as Promise<T> | undefined;

  if (existingPendingEntry) {
    return existingPendingEntry;
  }

  const nextValuePromise = (async () => {
    const value = await load();

    return storeControlPlaneRuntimeValue({
      cacheKey,
      getProjectIds,
      groups,
      staleWhileRevalidateMs,
      ttlMs,
      userId,
      value,
    });
  })();

  pendingControlPlaneRuntimeCache.set(cacheKey, {
    promise: nextValuePromise,
  });

  try {
    return await nextValuePromise;
  } finally {
    pendingControlPlaneRuntimeCache.delete(cacheKey);
  }
};

export const getCachedControlPlaneRuntimeValue = async <T,>({
  cacheKey,
  getProjectIds,
  groups = [],
  load,
  staleWhileRevalidateMs = 0,
  ttlMs,
  userId,
}: {
  cacheKey: string;
  getProjectIds?: ((value: T) => string[]) | undefined;
  groups?: ControlPlaneRuntimeCacheGroup[];
  load: () => Promise<T>;
  staleWhileRevalidateMs?: number;
  ttlMs: number;
  userId: string;
}): Promise<T> => {
  const now = Date.now();
  const cachedEntry = controlPlaneRuntimeCache.get(cacheKey);

  if (cachedEntry) {
    if (cachedEntry.expiresAt > now) {
      return cloneControlPlaneRuntimeValue(cachedEntry.value as T);
    }

    if (cachedEntry.staleWhileRevalidateUntil > now) {
      void loadControlPlaneRuntimeValue({
        cacheKey,
        getProjectIds,
        groups,
        load,
        staleWhileRevalidateMs,
        ttlMs,
        userId,
      }).catch(() => undefined);

      return cloneControlPlaneRuntimeValue(cachedEntry.value as T);
    }

    controlPlaneRuntimeCache.delete(cacheKey);
    forgetControlPlaneRuntimeEntry(cacheKey, cachedEntry);
  }

  return cloneControlPlaneRuntimeValue(
    await loadControlPlaneRuntimeValue({
      cacheKey,
      getProjectIds,
      groups,
      load,
      staleWhileRevalidateMs,
      ttlMs,
      userId,
    }),
  );
};

export const invalidateControlPlaneRuntimeCache = ({
  groups,
  projectId,
  userId,
}: {
  groups?: ControlPlaneRuntimeCacheGroup[];
  projectId?: string;
  userId?: string;
} = {}) => {
  const candidateKeys = new Set<string>();

  if (projectId) {
    for (const cacheKey of controlPlaneRuntimeCacheKeysByProjectId.get(projectId) ?? []) {
      candidateKeys.add(cacheKey);
    }
  }

  if (userId) {
    for (const cacheKey of controlPlaneRuntimeCacheKeysByUserId.get(userId) ?? []) {
      candidateKeys.add(cacheKey);
    }
  }

  if (!candidateKeys.size) {
    for (const cacheKey of controlPlaneRuntimeCache.keys()) {
      candidateKeys.add(cacheKey);
    }
  }

  for (const cacheKey of candidateKeys) {
    const cachedEntry = controlPlaneRuntimeCache.get(cacheKey);

    if (!cachedEntry) {
      continue;
    }

    if (groups?.length && !groups.some((group) => cachedEntry.groups.includes(group))) {
      continue;
    }

    controlPlaneRuntimeCache.delete(cacheKey);
    forgetControlPlaneRuntimeEntry(cacheKey, cachedEntry);
  }
};
