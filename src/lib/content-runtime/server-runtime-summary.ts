import "server-only";

import {
  createControlPlaneAdminClient,
  createControlPlaneServerClient,
} from "@/lib/control-plane/supabase-clients";

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

const isMissingRuntimeSummaryRpc = (error: { code?: string; message?: string } | null | undefined) =>
  error?.code === "PGRST202" && /project_content_runtime_summary/i.test(error.message ?? "");

const normalizeWorkspaceSummaryCounts = (
  counts: Partial<Record<ContentCollection, number | string | null | undefined>> | null | undefined,
): ContentCollectionCounts => ({
  authors: Number(counts?.authors ?? 0),
  categories: Number(counts?.categories ?? 0),
  files: Number(counts?.files ?? 0),
  media: Number(counts?.media ?? 0),
  posts: Number(counts?.posts ?? 0),
  tags: Number(counts?.tags ?? 0),
});

const getWorkspaceSummaryRefreshKey = ({
  projectId,
  runtimeSignature,
}: {
  projectId: string;
  runtimeSignature: string;
}) => `${projectId}:${runtimeSignature}`;

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
  const supabase = await createControlPlaneServerClient();
  const { data, error } = await supabase.rpc("get_project_content_runtime_summary", {
    p_project_id: projectId,
  });

  if (isMissingRuntimeSummaryRpc(error)) {
    return null;
  }

  if (error) {
    throw error;
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        is_exact?: boolean | null;
        refreshed_at?: string | null;
        runtime_signature?: string | null;
        summary_counts?: Partial<Record<ContentCollection, number | string | null | undefined>> | null;
      }
    | null
    | undefined;

  if (!row || row.runtime_signature !== runtimeSignature) {
    return null;
  }

  return createContentWorkspaceSummary({
    counts: normalizeWorkspaceSummaryCounts(row.summary_counts),
    isExact: row.is_exact !== false,
    refreshedAt: row.refreshed_at ?? null,
  });
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
  const supabase = createControlPlaneAdminClient();
  const { error } = await supabase.rpc("save_project_content_runtime_summary", {
    p_is_exact: summary.isExact,
    p_project_id: projectId,
    p_refreshed_at: summary.refreshedAt ?? new Date().toISOString(),
    p_runtime_signature: runtimeSignature,
    p_summary_counts: summary.counts,
  });

  if (isMissingRuntimeSummaryRpc(error)) {
    return;
  }

  if (error) {
    throw error;
  }
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
