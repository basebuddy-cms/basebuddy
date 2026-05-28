import "server-only";

import { contentCollections, type ContentCollection, type ContentCollectionCounts, type ContentWorkspaceSummary } from "./shared";
import { createEmptyContentCounts } from "./server-support";

export type ContentWorkspaceSummaryCountDeltas = Partial<
  Record<ContentCollection, number>
>;

export const CONTENT_WORKSPACE_SUMMARY_BACKGROUND_COLLECTIONS = [
  "files",
  "media",
] as const satisfies readonly ContentCollection[];
export const CONTENT_WORKSPACE_SUMMARY_STALE_MS = 30_000;

const pendingWorkspaceSummaryRefreshCollections = new Map<string, Set<ContentCollection>>();
const pendingWorkspaceSummaryRefreshes = new Map<string, Promise<void>>();
const persistedWorkspaceSummaries = new Map<string, ContentWorkspaceSummary>();

const getWorkspaceSummaryRefreshKey = ({
  projectId,
  runtimeSignature,
}: {
  projectId: string;
  runtimeSignature: string;
}) => `${projectId}:${runtimeSignature}`;

const cloneContentWorkspaceSummary = (summary: ContentWorkspaceSummary): ContentWorkspaceSummary =>
  createContentWorkspaceSummary({
    counts: {
      ...summary.counts,
    },
    isDerived: summary.isDerived,
    isExact: summary.isExact,
    pendingCollections: summary.pendingCollections,
    refreshedAt: summary.refreshedAt,
  });

const getPendingWorkspaceSummaryRefreshCollectionSet = (key: string) => {
  const existingCollections = pendingWorkspaceSummaryRefreshCollections.get(key);

  if (existingCollections) {
    return existingCollections;
  }

  const nextCollections = new Set<ContentCollection>();
  pendingWorkspaceSummaryRefreshCollections.set(key, nextCollections);
  return nextCollections;
};

export const createContentWorkspaceSummary = ({
  counts,
  isDerived = false,
  isExact = true,
  pendingCollections = [],
  refreshedAt,
}: {
  counts: ContentCollectionCounts;
  isDerived?: boolean;
  isExact?: boolean;
  pendingCollections?: ContentCollection[];
  refreshedAt: string | null;
}): ContentWorkspaceSummary => ({
  counts,
  isDerived,
  isExact,
  pendingCollections: [...pendingCollections],
  refreshedAt,
});

export const createPendingContentWorkspaceSummary = ({
  counts = createEmptyContentCounts(),
  isDerived = false,
  pendingCollections = [...contentCollections],
}: {
  counts?: ContentCollectionCounts;
  isDerived?: boolean;
  pendingCollections?: ContentCollection[];
}): ContentWorkspaceSummary =>
  createContentWorkspaceSummary({
    counts,
    isDerived,
    isExact: false,
    pendingCollections,
    refreshedAt: null,
  });

export const appendPendingContentWorkspaceSummaryCollections = ({
  pendingCollections,
  summary,
}: {
  pendingCollections: ContentCollection[];
  summary: ContentWorkspaceSummary;
}): ContentWorkspaceSummary => {
  if (!pendingCollections.length) {
    return summary;
  }

  return createContentWorkspaceSummary({
    counts: summary.counts,
    isDerived: summary.isDerived,
    isExact: false,
    pendingCollections: Array.from(
      new Set<ContentCollection>([...summary.pendingCollections, ...pendingCollections]),
    ),
    refreshedAt: summary.refreshedAt,
  });
};

export const getPendingContentWorkspaceSummaryCollections = ({
  projectId,
  runtimeSignature,
}: {
  projectId: string;
  runtimeSignature: string;
}) =>
  Array.from(
    pendingWorkspaceSummaryRefreshCollections.get(
      getWorkspaceSummaryRefreshKey({
        projectId,
        runtimeSignature,
      }),
    ) ?? [],
  );

export const queueContentWorkspaceSummaryBackgroundRefresh = ({
  pendingCollections,
  projectId,
  refresh,
  runtimeSignature,
}: {
  pendingCollections: ContentCollection[];
  projectId: string;
  refresh: () => Promise<void>;
  runtimeSignature: string;
}) => {
  const refreshKey = getWorkspaceSummaryRefreshKey({
    projectId,
    runtimeSignature,
  });
  const pendingCollectionsSet = getPendingWorkspaceSummaryRefreshCollectionSet(refreshKey);

  for (const collection of pendingCollections) {
    pendingCollectionsSet.add(collection);
  }

  const existingRefresh = pendingWorkspaceSummaryRefreshes.get(refreshKey);

  if (existingRefresh) {
    return existingRefresh;
  }

  const nextRefresh = refresh().finally(() => {
    pendingWorkspaceSummaryRefreshes.delete(refreshKey);
    pendingWorkspaceSummaryRefreshCollections.delete(refreshKey);
  });

  pendingWorkspaceSummaryRefreshes.set(refreshKey, nextRefresh);

  return nextRefresh;
};

export const getPersistedContentWorkspaceSummary = async ({
  projectId,
  runtimeSignature,
}: {
  projectId: string;
  runtimeSignature: string;
}): Promise<ContentWorkspaceSummary | null> => {
  const persistedSummary = persistedWorkspaceSummaries.get(
    getWorkspaceSummaryRefreshKey({ projectId, runtimeSignature }),
  );

  return persistedSummary ? cloneContentWorkspaceSummary(persistedSummary) : null;
};

export const savePersistedContentWorkspaceSummary = async ({
  projectId,
  runtimeSignature,
  summary,
}: {
  projectId: string;
  runtimeSignature: string;
  summary: ContentWorkspaceSummary;
}) => {
  persistedWorkspaceSummaries.set(
    getWorkspaceSummaryRefreshKey({ projectId, runtimeSignature }),
    cloneContentWorkspaceSummary(
      createContentWorkspaceSummary({
        counts: summary.counts,
        isDerived: summary.isDerived,
        isExact: summary.isExact,
        pendingCollections: summary.pendingCollections,
        refreshedAt: summary.refreshedAt ?? new Date().toISOString(),
      }),
    ),
  );
};

export const applyPersistedContentWorkspaceSummaryCountDeltas = async ({
  deltas,
  projectId,
  runtimeSignature,
}: {
  deltas: ContentWorkspaceSummaryCountDeltas;
  projectId: string;
  runtimeSignature: string;
}) => {
  const persistedSummary = await getPersistedContentWorkspaceSummary({
    projectId,
    runtimeSignature,
  });

  if (!persistedSummary) {
    return null;
  }

  const nextCounts = {
    ...persistedSummary.counts,
  };

  for (const [collection, delta] of Object.entries(deltas) as Array<
    [ContentCollection, number | undefined]
  >) {
    if (typeof delta !== "number" || !Number.isFinite(delta) || delta === 0) {
      continue;
    }

    nextCounts[collection] = Math.max(0, nextCounts[collection] + delta);
  }

  const nextSummary = createContentWorkspaceSummary({
    counts: nextCounts,
    isDerived: persistedSummary.isDerived,
    isExact: persistedSummary.isExact,
    refreshedAt: new Date().toISOString(),
  });

  await savePersistedContentWorkspaceSummary({
    projectId,
    runtimeSignature,
    summary: nextSummary,
  });

  return nextSummary;
};

export const markPersistedContentWorkspaceSummaryInexact = async ({
  projectId,
  runtimeSignature,
}: {
  projectId: string;
  runtimeSignature: string;
}) => {
  const persistedSummary = await getPersistedContentWorkspaceSummary({
    projectId,
    runtimeSignature,
  });

  if (!persistedSummary || persistedSummary.isExact === false) {
    return persistedSummary;
  }

  const nextSummary = createContentWorkspaceSummary({
    counts: persistedSummary.counts,
    isDerived: persistedSummary.isDerived,
    isExact: false,
    refreshedAt: persistedSummary.refreshedAt,
  });

  await savePersistedContentWorkspaceSummary({
    projectId,
    runtimeSignature,
    summary: nextSummary,
  });

  return nextSummary;
};
