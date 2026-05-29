import "server-only";

import {
  canManageContentMedia,
  getMappedS3CompatibleFilesStorageConfig,
  getMappedS3CompatibleMediaStorageConfig,
  getMappedContentSupabaseFilesBucketName,
  getMappedContentSupabaseMediaBucketName,
} from "./server-media";
import {
  getCachedContentPostsPreviewSnapshot,
  shouldUseContentAuthorFallbackPreviewSnapshot,
} from "./server-posts-mapped-content";
import {
  countContentPostsProjection,
  getContentPostsProjectionState,
  isMissingContentProjectionStorageError,
} from "./server-content-post-projection";
import { getContentWorkspaceRuntimeSignature as buildContentWorkspaceRuntimeSignature } from "./server-content-cache-keys";
import {
  getContentAccessScopeCacheSignature,
  getContentWorkspaceCountsCacheKey,
} from "./server-runtime-cache-keys";
import {
  appendPendingContentWorkspaceSummaryCollections,
  CONTENT_WORKSPACE_SUMMARY_BACKGROUND_COLLECTIONS,
  CONTENT_WORKSPACE_SUMMARY_STALE_MS,
  createContentWorkspaceSummary,
  createPendingContentWorkspaceSummary,
  getPersistedContentWorkspaceSummary,
  getPendingContentWorkspaceSummaryCollections,
  queueContentWorkspaceSummaryBackgroundRefresh,
  savePersistedContentWorkspaceSummary,
} from "./server-runtime-summary";
import {
  createEmptyContentCounts,
  createEmptyContentRuntimeSummary,
  getNormalizedContentS3CompatibleStorageConfig,
} from "./server-support";
import {
  contentCollections,
  type ContentCollection,
  type ContentCollectionCounts,
  type ContentWorkspaceMeta,
} from "./shared";
import {
  createWorkspaceCapabilities,
  type ContentProjectContext,
  type ContentCountRow,
  type ContentDatabaseClient,
  type SnapshotResponse,
  type WorkspaceDependencies,
} from "./server-workspace-shared";
import {
  createContentRuntimeAdapter,
  getRequiredContentRuntimeAdapterMethod,
} from "./adapter/factory";
import {
  buildContentNonImageStorageObjectCountQuery,
  buildContentStorageObjectCountQuery,
} from "./adapter/query-builders";

const CONTENT_WORKSPACE_COUNTS_TTL_MS = 15_000;
const cachedContentWorkspaceCounts = new Map<
  string,
  {
    counts: ContentCollectionCounts;
    expiresAt: number;
  }
>();
const pendingContentWorkspaceCounts = new Map<string, Promise<ContentCollectionCounts>>();
const contentWorkspaceCountCacheKeysByProjectId = new Map<string, Set<string>>();

const rememberContentWorkspaceCountsCacheKey = (projectId: string, cacheKey: string) => {
  const existingKeys = contentWorkspaceCountCacheKeysByProjectId.get(projectId);

  if (existingKeys) {
    existingKeys.add(cacheKey);
    return;
  }

  contentWorkspaceCountCacheKeysByProjectId.set(projectId, new Set([cacheKey]));
};

const forgetContentWorkspaceCountsCacheKey = (projectId: string, cacheKey: string) => {
  const existingKeys = contentWorkspaceCountCacheKeysByProjectId.get(projectId);

  if (!existingKeys) {
    return;
  }

  existingKeys.delete(cacheKey);

  if (!existingKeys.size) {
    contentWorkspaceCountCacheKeysByProjectId.delete(projectId);
  }
};

const getCachedContentWorkspaceCounts = async ({
  cacheKey,
  load,
  projectId,
}: {
  cacheKey: string;
  load: () => Promise<ContentCollectionCounts>;
  projectId: string;
}) => {
  const now = Date.now();
  const cachedCounts = cachedContentWorkspaceCounts.get(cacheKey);

  if (cachedCounts && cachedCounts.expiresAt > now) {
    return cachedCounts.counts;
  }

  const pendingCounts = pendingContentWorkspaceCounts.get(cacheKey);

  if (pendingCounts) {
    return pendingCounts;
  }

  rememberContentWorkspaceCountsCacheKey(projectId, cacheKey);

  const nextCountsPromise = (async () => {
    const counts = await load();
    cachedContentWorkspaceCounts.set(cacheKey, {
      counts,
      expiresAt: Date.now() + CONTENT_WORKSPACE_COUNTS_TTL_MS,
    });
    return counts;
  })();

  pendingContentWorkspaceCounts.set(cacheKey, nextCountsPromise);

  try {
    return await nextCountsPromise;
  } finally {
    pendingContentWorkspaceCounts.delete(cacheKey);

    if (!cachedContentWorkspaceCounts.has(cacheKey)) {
      forgetContentWorkspaceCountsCacheKey(projectId, cacheKey);
    }
  }
};

export const invalidateContentWorkspaceCountsCache = (projectId: string) => {
  const cacheKeys = contentWorkspaceCountCacheKeysByProjectId.get(projectId);

  if (!cacheKeys?.size) {
    return;
  }

  for (const cacheKey of Array.from(cacheKeys)) {
    cachedContentWorkspaceCounts.delete(cacheKey);
    pendingContentWorkspaceCounts.delete(cacheKey);
    forgetContentWorkspaceCountsCacheKey(projectId, cacheKey);
  }
};

type ContentWorkspaceCountsLoadContext = {
  context: ContentProjectContext;
  dependencies: WorkspaceDependencies;
  filesStorageMode: string;
  hasFilesStorageCredential: boolean;
  hasMediaStorageCredential: boolean;
  mappedFilesBucket: string | null;
  mappedS3CompatibleFilesStorage: ReturnType<typeof getMappedS3CompatibleFilesStorageConfig>;
  mappedS3CompatibleMediaStorage: ReturnType<typeof getMappedS3CompatibleMediaStorageConfig>;
  mappedSupabaseMediaBucket: string | null;
  mediaStorageMode: string;
  projectId: string;
  readyMapping: Awaited<ReturnType<WorkspaceDependencies["getReadyContentProjectMapping"]>>;
  s3CompatibleFilesCredentials: Awaited<
    ReturnType<WorkspaceDependencies["getContentS3CompatibleFilesCredentials"]>
  >;
  s3CompatibleMediaCredentials: Awaited<
    ReturnType<WorkspaceDependencies["getContentS3CompatibleMediaCredentials"]>
  >;
};

export const getContentWorkspaceRuntimeSignature = ({
  readyMapping,
}: {
  readyMapping: ContentWorkspaceCountsLoadContext["readyMapping"];
}) => {
  const mappedSupabaseMediaBucket = readyMapping ? getMappedContentSupabaseMediaBucketName(readyMapping) : null;
  const mappedSupabaseFilesBucket = readyMapping ? getMappedContentSupabaseFilesBucketName(readyMapping) : null;
  const mappedFilesBucket = mappedSupabaseFilesBucket ?? mappedSupabaseMediaBucket;
  const mappedS3CompatibleMediaStorage = readyMapping
    ? getMappedS3CompatibleMediaStorageConfig(readyMapping)
    : null;
  const mappedS3CompatibleFilesStorage = readyMapping
    ? getMappedS3CompatibleFilesStorageConfig(readyMapping)
    : null;
  const filesStorageMode = mappedS3CompatibleFilesStorage
    ? `s3:${mappedS3CompatibleFilesStorage.bucketName}`
    : mappedFilesBucket
      ? `supabase:${mappedFilesBucket}`
      : "none";
  const mediaStorageMode = mappedS3CompatibleMediaStorage
    ? `s3:${mappedS3CompatibleMediaStorage.bucketName}`
    : mappedSupabaseMediaBucket
      ? `supabase:${mappedSupabaseMediaBucket}`
      : "none";

  return buildContentWorkspaceRuntimeSignature({
    filesStorageMode,
    mapping: {
      revisionId: readyMapping?.revisionId ?? null,
      revisionVersion: readyMapping?.revisionVersion ?? null,
    },
    mediaStorageMode,
  });
};

const loadContentWorkspaceCounts = async ({
  accessibleAuthorIds,
  approximateCounts = false,
  client,
  context,
  dependencies,
  includeManagedStorageCounts = true,
  mappedFilesBucket,
  mappedSupabaseMediaBucket,
  projectId,
  readyMapping,
  s3CompatibleFilesCredentials,
  s3CompatibleMediaCredentials,
}: ContentWorkspaceCountsLoadContext & {
  accessibleAuthorIds: string[] | null;
  approximateCounts?: boolean;
  client: ContentDatabaseClient;
  includeManagedStorageCounts?: boolean;
}) => {
  void dependencies;

  if (!readyMapping) {
    return createEmptyContentCounts();
  }

  const adapter = createContentRuntimeAdapter({
    hasFilesS3CompatibleCredentials: Boolean(s3CompatibleFilesCredentials),
    hasS3CompatibleCredentials: Boolean(s3CompatibleMediaCredentials),
    mapping: readyMapping,
  });
  let postsCountOverride: number | undefined;
  try {
    const projectionState = await getContentPostsProjectionState({
      mapping: readyMapping,
      projectId,
    });

    if (projectionState?.status === "ready") {
      if (accessibleAuthorIds === null) {
        postsCountOverride = projectionState.totalItems;
      } else if (!accessibleAuthorIds.length) {
        postsCountOverride = 0;
      } else {
        postsCountOverride = await countContentPostsProjection({
          accessibleAuthorIds,
          mapping: readyMapping,
          projectId,
        });
      }
    }
  } catch (error) {
    if (!isMissingContentProjectionStorageError(error as { code?: string | null; message?: string | null })) {
      throw error;
    }
  }

  if (postsCountOverride === undefined && accessibleAuthorIds !== null) {
    if (!accessibleAuthorIds.length) {
      postsCountOverride = 0;
    } else if (
      shouldUseContentAuthorFallbackPreviewSnapshot({
        accessibleAuthorIds,
        mapping: readyMapping,
      })
    ) {
      const snapshot = await getCachedContentPostsPreviewSnapshot({
        accessibleAuthorIds,
        adapter,
        cacheSignature: getContentAccessScopeCacheSignature(context),
        client,
        projectId,
        scopeKey: `mapped_content_author_scoped:${readyMapping.revisionId ?? "none"}:${readyMapping.revisionVersion ?? 0}`,
        search: "",
        sort: "updated_desc",
        status: "all",
      });
      postsCountOverride = snapshot.totalItems;
    }
  }

  const loadWorkspaceCounts = getRequiredContentRuntimeAdapterMethod(
    adapter,
    "loadWorkspaceCounts",
  );
  const nextCounts = await loadWorkspaceCounts({
    accessibleAuthorIds,
    approximateCounts,
    client,
    postsCountOverride,
  });

  if (includeManagedStorageCounts && mappedSupabaseMediaBucket) {
    const mediaCountResult = await client.query<ContentCountRow>(
      buildContentStorageObjectCountQuery(),
      [mappedSupabaseMediaBucket],
    );

    nextCounts.media = Number(mediaCountResult.rows[0]?.count ?? 0);
  }

  if (includeManagedStorageCounts && mappedFilesBucket) {
    const filesCountResult = await client.query<ContentCountRow>(
      buildContentNonImageStorageObjectCountQuery(),
      [mappedFilesBucket, "%/.basebuddy-folder", "%/.supapress-folder"],
    );

    nextCounts.files = Number(filesCountResult.rows[0]?.count ?? 0);
  }

  return nextCounts;
};

const shouldRefreshWorkspaceManagedStorageCounts = (summary: ContentWorkspaceMeta["workspaceSummary"]) => {
  if (summary.isExact === false) {
    return true;
  }

  const refreshedAtTimestamp = summary.refreshedAt ? Date.parse(summary.refreshedAt) : Number.NaN;

  return (
    !Number.isFinite(refreshedAtTimestamp) ||
    Date.now() - refreshedAtTimestamp > CONTENT_WORKSPACE_SUMMARY_STALE_MS
  );
};

const isContentWorkspaceSummaryStale = (summary: ContentWorkspaceMeta["workspaceSummary"]) => {
  const refreshedAtTimestamp = summary.refreshedAt ? Date.parse(summary.refreshedAt) : Number.NaN;

  return (
    !Number.isFinite(refreshedAtTimestamp) ||
    Date.now() - refreshedAtTimestamp > CONTENT_WORKSPACE_SUMMARY_STALE_MS
  );
};

const getWorkspaceSummaryWithPendingManagedStorage = ({
  projectId,
  runtimeSignature,
  summary,
}: {
  projectId: string;
  runtimeSignature: string;
  summary: ContentWorkspaceMeta["workspaceSummary"];
}) =>
  appendPendingContentWorkspaceSummaryCollections({
    pendingCollections: Array.from(
      new Set<ContentCollection>([
        ...CONTENT_WORKSPACE_SUMMARY_BACKGROUND_COLLECTIONS,
        ...getPendingContentWorkspaceSummaryCollections({
          projectId,
          runtimeSignature,
        }),
      ]),
    ),
    summary,
  });

const queueContentWorkspaceManagedStorageRefresh = ({
  context,
  dependencies,
  filesStorageMode,
  hasFilesStorageCredential,
  hasMediaStorageCredential,
  mappedFilesBucket,
  mappedS3CompatibleFilesStorage,
  mappedS3CompatibleMediaStorage,
  mappedSupabaseMediaBucket,
  mediaStorageMode,
  projectId,
  readyMapping,
  runtimeSignature,
  s3CompatibleFilesCredentials,
  s3CompatibleMediaCredentials,
}: ContentWorkspaceCountsLoadContext & {
  runtimeSignature: string;
}) => {
  const hasManagedStorage = Boolean(
    mappedFilesBucket ||
      mappedS3CompatibleFilesStorage ||
      mappedSupabaseMediaBucket ||
      mappedS3CompatibleMediaStorage,
  );

  if (!hasManagedStorage || !context.connectionString) {
    return;
  }

  void queueContentWorkspaceSummaryBackgroundRefresh({
    pendingCollections: [...CONTENT_WORKSPACE_SUMMARY_BACKGROUND_COLLECTIONS],
    projectId,
    refresh: async () => {
      await dependencies.withContentDatabaseClient(context.connectionString as string, async (client) => {
        const persistedSummary = await getPersistedContentWorkspaceSummary({
          projectId,
          runtimeSignature,
        });
        const baseCounts =
          persistedSummary?.counts ??
          (await loadContentWorkspaceCounts({
            accessibleAuthorIds: null,
            client,
            context,
            dependencies,
            filesStorageMode,
            hasFilesStorageCredential,
            hasMediaStorageCredential,
            mappedFilesBucket,
            mappedS3CompatibleFilesStorage,
            mappedS3CompatibleMediaStorage,
            mappedSupabaseMediaBucket,
            mediaStorageMode,
            projectId,
            readyMapping,
            s3CompatibleFilesCredentials,
            s3CompatibleMediaCredentials,
          }));

        const exactCounts = await loadContentWorkspaceCounts({
          accessibleAuthorIds: null,
          client,
          context,
          dependencies,
          filesStorageMode,
          hasFilesStorageCredential,
          hasMediaStorageCredential,
          mappedFilesBucket,
          mappedS3CompatibleFilesStorage,
          mappedS3CompatibleMediaStorage,
          mappedSupabaseMediaBucket,
          mediaStorageMode,
          projectId,
          readyMapping,
          s3CompatibleFilesCredentials,
          s3CompatibleMediaCredentials,
        });

        await savePersistedContentWorkspaceSummary({
          projectId,
          runtimeSignature,
          summary: createContentWorkspaceSummary({
            counts: {
              ...baseCounts,
              files: exactCounts.files,
              media: exactCounts.media,
            },
            refreshedAt: new Date().toISOString(),
          }),
        });
      });
    },
    runtimeSignature,
  }).catch(() => undefined);
};

const loadContentWorkspaceStorageCredentials = async ({
  dependencies,
  mappedFilesBucket,
  mappedS3CompatibleFilesStorage,
  mappedS3CompatibleMediaStorage,
  mappedSupabaseMediaBucket,
  projectId,
}: {
  dependencies: WorkspaceDependencies;
  mappedFilesBucket: string | null;
  mappedS3CompatibleFilesStorage: ReturnType<typeof getMappedS3CompatibleFilesStorageConfig>;
  mappedS3CompatibleMediaStorage: ReturnType<typeof getMappedS3CompatibleMediaStorageConfig>;
  mappedSupabaseMediaBucket: string | null;
  projectId: string;
}) => {
  const loadBestEffort = async <T>(load: () => Promise<T>) => {
    try {
      return await load();
    } catch {
      return null;
    }
  };

  const [mediaStorageServiceKey, filesStorageServiceKey, s3CompatibleMediaCredentials, s3CompatibleFilesCredentials] =
    await Promise.all([
      mappedSupabaseMediaBucket
        ? loadBestEffort(() => dependencies.getContentStorageServiceKey(projectId))
        : Promise.resolve<string | null>(null),
      mappedFilesBucket
        ? loadBestEffort(() => dependencies.getContentStorageServiceKey(projectId))
        : Promise.resolve<string | null>(null),
      mappedS3CompatibleMediaStorage
        ? loadBestEffort(() => dependencies.getContentS3CompatibleMediaCredentials(projectId))
        : Promise.resolve<Awaited<ReturnType<WorkspaceDependencies["getContentS3CompatibleMediaCredentials"]>>>(null),
      mappedS3CompatibleFilesStorage
        ? loadBestEffort(() => dependencies.getContentS3CompatibleFilesCredentials(projectId))
        : Promise.resolve<Awaited<ReturnType<WorkspaceDependencies["getContentS3CompatibleFilesCredentials"]>>>(null),
    ]);

  return {
    filesStorageServiceKey,
    mediaStorageServiceKey,
    s3CompatibleFilesCredentials,
    s3CompatibleMediaCredentials,
  };
};

const getBootstrapContentWorkspaceSummary = async ({
  filesStorageMode,
  hasFilesStorageCredential,
  hasMediaStorageCredential,
  mediaStorageMode,
  readyMapping,
  readableAuthorIds,
  projectId,
}: {
  filesStorageMode: string;
  hasFilesStorageCredential: boolean;
  hasMediaStorageCredential: boolean;
  mediaStorageMode: string;
  projectId: string;
  readableAuthorIds: string[] | null;
  readyMapping: ContentWorkspaceCountsLoadContext["readyMapping"];
}) => {
  void hasFilesStorageCredential;
  void hasMediaStorageCredential;

  const persistedSummary = await getPersistedContentWorkspaceSummary({
    projectId,
    runtimeSignature: getContentWorkspaceRuntimeSignature({
      readyMapping,
    }),
  });

  if (!persistedSummary) {
    if (readableAuthorIds !== null && !readableAuthorIds.length) {
      return createPendingContentWorkspaceSummary({
        counts: {
          ...createEmptyContentCounts(),
          posts: 0,
        },
        isDerived: true,
        pendingCollections: ["authors", "categories", "files", "media", "tags"],
      });
    }

    return createPendingContentWorkspaceSummary({
      pendingCollections: [...contentCollections],
    });
  }

  const runtimeSignature = getContentWorkspaceRuntimeSignature({
    readyMapping,
  });
  const hasManagedStorage = mediaStorageMode !== "none" || filesStorageMode !== "none";

  if (hasManagedStorage && shouldRefreshWorkspaceManagedStorageCounts(persistedSummary)) {
    return getWorkspaceSummaryWithPendingManagedStorage({
      projectId,
      runtimeSignature,
      summary: persistedSummary,
    });
  }

  if (readableAuthorIds === null) {
    return persistedSummary;
  }

  if (!readableAuthorIds.length) {
    return createContentWorkspaceSummary({
      counts: {
        ...persistedSummary.counts,
        posts: 0,
      },
      isDerived: true,
      isExact: persistedSummary.isExact,
      refreshedAt: persistedSummary.refreshedAt,
    });
  }

  return createPendingContentWorkspaceSummary({
    counts: {
      ...persistedSummary.counts,
      posts: 0,
    },
    isDerived: true,
    pendingCollections: ["posts"],
  });
};

export const getContentWorkspaceMetaForMappedContent = async ({
  context,
  dependencies,
  projectId,
}: {
  context: ContentProjectContext;
  dependencies: WorkspaceDependencies;
  projectId: string;
}): Promise<ContentWorkspaceMeta> => {
  const capabilities = createWorkspaceCapabilities(context);
  const postSidebarConfig = await dependencies.getProjectPostSidebarConfig(projectId);
  const readyMapping = await dependencies.getBootstrapContentProjectMapping({
    context,
    projectId,
  });

  if (!readyMapping) {
    return {
      capabilities,
      counts: createEmptyContentCounts(),
      contentRuntime: createEmptyContentRuntimeSummary(),
      message: "Finish mapping before editing this project.",
      postSidebarConfig,
      primaryContentFormat: context.schemaOptions.primaryContentFormat,
      workspaceSummary: createContentWorkspaceSummary({
        counts: createEmptyContentCounts(),
        refreshedAt: null,
      }),
      workspaceState: "mapping_draft",
    };
  }

  const mappedSupabaseMediaBucket = getMappedContentSupabaseMediaBucketName(readyMapping);
  const mappedSupabaseFilesBucket = getMappedContentSupabaseFilesBucketName(readyMapping);
  const mappedFilesBucket = mappedSupabaseFilesBucket ?? mappedSupabaseMediaBucket;
  const mappedS3CompatibleMediaStorage = getMappedS3CompatibleMediaStorageConfig(readyMapping);
  const mappedS3CompatibleFilesStorage = getMappedS3CompatibleFilesStorageConfig(readyMapping);
  const {
    filesStorageServiceKey,
    mediaStorageServiceKey,
    s3CompatibleFilesCredentials,
    s3CompatibleMediaCredentials,
  } = await loadContentWorkspaceStorageCredentials({
    dependencies,
    mappedFilesBucket,
    mappedS3CompatibleFilesStorage,
    mappedS3CompatibleMediaStorage,
    mappedSupabaseMediaBucket,
    projectId,
  });

  if (!context.connectionString) {
    throw new Error("This project needs a working database connection before you can continue.");
  }

  const readableAuthorIds = dependencies.ensureContentPermission(context, "read");
  const filesStorageMode = mappedS3CompatibleFilesStorage
    ? `s3:${mappedS3CompatibleFilesStorage.bucketName}`
    : mappedFilesBucket
      ? `supabase:${mappedFilesBucket}`
      : "none";
  const mediaStorageMode = mappedS3CompatibleMediaStorage
    ? `s3:${mappedS3CompatibleMediaStorage.bucketName}`
    : mappedSupabaseMediaBucket
      ? `supabase:${mappedSupabaseMediaBucket}`
      : "none";
  const hasFilesStorageCredential = Boolean(filesStorageServiceKey || s3CompatibleFilesCredentials);
  const hasMediaStorageCredential = Boolean(mediaStorageServiceKey || s3CompatibleMediaCredentials);
  const workspaceSummary = await getBootstrapContentWorkspaceSummary({
    filesStorageMode,
    hasFilesStorageCredential,
    hasMediaStorageCredential,
    mediaStorageMode,
    projectId,
    readableAuthorIds,
    readyMapping,
  });
  const normalizedCapabilitySummaryMapping = {
    ...readyMapping,
    mappingConfig: {
      ...readyMapping.mappingConfig,
      filesStorage: readyMapping.mappingConfig.filesStorage
        ? {
            ...readyMapping.mappingConfig.filesStorage,
            bucketName:
              readyMapping.mappingConfig.filesStorage.provider === "s3_compatible"
                ? getNormalizedContentS3CompatibleStorageConfig(
                    readyMapping.mappingConfig.filesStorage,
                  )?.bucketName ?? null
                : mappedFilesBucket,
          }
        : null,
      mediaStorage: readyMapping.mappingConfig.mediaStorage
        ? {
            ...readyMapping.mappingConfig.mediaStorage,
            bucketName:
              readyMapping.mappingConfig.mediaStorage.provider === "s3_compatible"
                ? mappedS3CompatibleMediaStorage?.bucketName ?? null
                : mappedSupabaseMediaBucket,
          }
        : null,
    },
  };
  const runtimeAdapter = createContentRuntimeAdapter({
    hasFilesS3CompatibleCredentials: Boolean(s3CompatibleFilesCredentials),
    hasS3CompatibleCredentials: Boolean(s3CompatibleMediaCredentials),
    mapping: normalizedCapabilitySummaryMapping,
  });
  if (!runtimeAdapter.loadWorkspace) {
    throw new Error("This project setup needs attention before the workspace can load.");
  }

  const contentRuntimeSummary = await runtimeAdapter.loadWorkspace();

  return {
    capabilities,
    counts: workspaceSummary.counts,
    contentRuntime: (() => {
      const canManageStorage = canManageContentMedia(context);

      return {
        ...contentRuntimeSummary,
        filesStorage: contentRuntimeSummary.filesStorage
          ? {
              ...contentRuntimeSummary.filesStorage,
              canManage: Boolean(
                (
                  (contentRuntimeSummary.filesStorage.provider === "supabase_bucket" && filesStorageServiceKey) ||
                  (contentRuntimeSummary.filesStorage.provider === "s3_compatible" && s3CompatibleFilesCredentials)
                ) && canManageStorage,
              ),
            }
          : null,
        mediaStorage: contentRuntimeSummary.mediaStorage
          ? {
              ...contentRuntimeSummary.mediaStorage,
              canManage: Boolean(
                (
                  (contentRuntimeSummary.mediaStorage.provider === "supabase_bucket" && mediaStorageServiceKey) ||
                  (contentRuntimeSummary.mediaStorage.provider === "s3_compatible" && s3CompatibleMediaCredentials)
                ) && canManageStorage,
              ),
            }
          : null,
      };
    })(),
    postSidebarConfig,
    primaryContentFormat: context.schemaOptions.primaryContentFormat,
    workspaceSummary,
    workspaceState: "ready",
  };
};

export const getContentWorkspaceSummaryForMappedContent = async ({
  context,
  dependencies,
  projectId,
}: {
  context: ContentProjectContext;
  dependencies: WorkspaceDependencies;
  projectId: string;
}): Promise<ContentWorkspaceMeta["workspaceSummary"]> => {
  const readyMapping = await dependencies.getReadyContentProjectMapping({
    context,
    projectId,
  });

  if (!readyMapping) {
    return createContentWorkspaceSummary({
      counts: createEmptyContentCounts(),
      refreshedAt: null,
    });
  }

  const mappedSupabaseMediaBucket = getMappedContentSupabaseMediaBucketName(readyMapping);
  const mappedSupabaseFilesBucket = getMappedContentSupabaseFilesBucketName(readyMapping);
  const mappedFilesBucket = mappedSupabaseFilesBucket ?? mappedSupabaseMediaBucket;
  const mappedS3CompatibleMediaStorage = getMappedS3CompatibleMediaStorageConfig(readyMapping);
  const mappedS3CompatibleFilesStorage = getMappedS3CompatibleFilesStorageConfig(readyMapping);
  const {
    filesStorageServiceKey,
    mediaStorageServiceKey,
    s3CompatibleFilesCredentials,
    s3CompatibleMediaCredentials,
  } = await loadContentWorkspaceStorageCredentials({
    dependencies,
    mappedFilesBucket,
    mappedS3CompatibleFilesStorage,
    mappedS3CompatibleMediaStorage,
    mappedSupabaseMediaBucket,
    projectId,
  });

  if (!context.connectionString) {
    throw new Error("This project needs a working database connection before you can continue.");
  }

  const readableAuthorIds = dependencies.ensureContentPermission(context, "read");
  const filesStorageMode = mappedS3CompatibleFilesStorage
    ? `s3:${mappedS3CompatibleFilesStorage.bucketName}`
    : mappedFilesBucket
      ? `supabase:${mappedFilesBucket}`
      : "none";
  const mediaStorageMode = mappedS3CompatibleMediaStorage
    ? `s3:${mappedS3CompatibleMediaStorage.bucketName}`
    : mappedSupabaseMediaBucket
      ? `supabase:${mappedSupabaseMediaBucket}`
      : "none";
  const hasFilesStorageCredential = Boolean(filesStorageServiceKey || s3CompatibleFilesCredentials);
  const hasMediaStorageCredential = Boolean(mediaStorageServiceKey || s3CompatibleMediaCredentials);
  const runtimeSignature = getContentWorkspaceRuntimeSignature({
    readyMapping,
  });
  const hasManagedStorage = mediaStorageMode !== "none" || filesStorageMode !== "none";

  const applyManagedStoragePendingState = (
    summary: ContentWorkspaceMeta["workspaceSummary"],
  ): ContentWorkspaceMeta["workspaceSummary"] =>
    hasManagedStorage && shouldRefreshWorkspaceManagedStorageCounts(summary)
      ? getWorkspaceSummaryWithPendingManagedStorage({
          projectId,
          runtimeSignature,
          summary,
        })
      : summary;
  const previousPersistedSummary = await getPersistedContentWorkspaceSummary({
    projectId,
    runtimeSignature,
  });
  const mergePreviousManagedStorageCounts = (counts: ContentCollectionCounts) => {
    if (!hasManagedStorage || !previousPersistedSummary) {
      return counts;
    }

    return {
      ...counts,
      files:
        filesStorageMode !== "none" && counts.files === 0
          ? previousPersistedSummary.counts.files
          : counts.files,
      media:
        mediaStorageMode !== "none" && counts.media === 0
          ? previousPersistedSummary.counts.media
          : counts.media,
    };
  };

  if (readableAuthorIds === null) {
    const persistedSummary = previousPersistedSummary;

    if (persistedSummary && !isContentWorkspaceSummaryStale(persistedSummary)) {
      if (hasManagedStorage && shouldRefreshWorkspaceManagedStorageCounts(persistedSummary)) {
        queueContentWorkspaceManagedStorageRefresh({
          context,
          dependencies,
          filesStorageMode,
          hasFilesStorageCredential,
          hasMediaStorageCredential,
          mappedFilesBucket,
          mappedS3CompatibleFilesStorage,
          mappedS3CompatibleMediaStorage,
          mappedSupabaseMediaBucket,
          mediaStorageMode,
          projectId,
          readyMapping,
          runtimeSignature,
          s3CompatibleFilesCredentials,
          s3CompatibleMediaCredentials,
        });
      }

      return applyManagedStoragePendingState(persistedSummary);
    }
  }

  try {
    return await dependencies.withContentDatabaseClient(context.connectionString as string, async (client) => {
      const projectWideCounts = await getCachedContentWorkspaceCounts({
        cacheKey: getContentWorkspaceCountsCacheKey({
          accessibleAuthorIds: null,
          filesStorageMode,
          hasFilesStorageCredential,
          hasMediaStorageCredential,
          mappingRevisionId: readyMapping.revisionId,
          mappingRevisionVersion: readyMapping.revisionVersion,
          mediaStorageMode,
          projectId,
        }),
        projectId,
          load: () =>
            loadContentWorkspaceCounts({
              accessibleAuthorIds: null,
              approximateCounts: true,
              client,
              context,
              dependencies,
              filesStorageMode,
              hasFilesStorageCredential,
              hasMediaStorageCredential,
              includeManagedStorageCounts: false,
              mappedFilesBucket,
              mappedS3CompatibleFilesStorage,
              mappedS3CompatibleMediaStorage,
              mappedSupabaseMediaBucket,
              mediaStorageMode,
              projectId,
              readyMapping,
              s3CompatibleFilesCredentials,
              s3CompatibleMediaCredentials,
            }),
      });
      const refreshedAt = new Date().toISOString();
      const projectWideCountsWithManagedFallback =
        mergePreviousManagedStorageCounts(projectWideCounts);
      const persistedSummary = createContentWorkspaceSummary({
        counts: projectWideCountsWithManagedFallback,
        isExact: false,
        refreshedAt,
      });

      void savePersistedContentWorkspaceSummary({
        projectId,
        runtimeSignature,
        summary: persistedSummary,
      }).catch(() => undefined);

      if (hasManagedStorage) {
        queueContentWorkspaceManagedStorageRefresh({
          context,
          dependencies,
          filesStorageMode,
          hasFilesStorageCredential,
          hasMediaStorageCredential,
          mappedFilesBucket,
          mappedS3CompatibleFilesStorage,
          mappedS3CompatibleMediaStorage,
          mappedSupabaseMediaBucket,
          mediaStorageMode,
          projectId,
          readyMapping,
          runtimeSignature,
          s3CompatibleFilesCredentials,
          s3CompatibleMediaCredentials,
        });
      }

      if (readableAuthorIds === null) {
        return applyManagedStoragePendingState(persistedSummary);
      }

      if (!readableAuthorIds.length) {
        return applyManagedStoragePendingState(
          createContentWorkspaceSummary({
            counts: {
              ...projectWideCountsWithManagedFallback,
              posts: 0,
            },
            isDerived: true,
            isExact: !hasManagedStorage,
            refreshedAt,
          }),
        );
      }

      const projectionState = await getContentPostsProjectionState({
        mapping: readyMapping,
        projectId,
      }).catch((error) => {
        if (isMissingContentProjectionStorageError(error as { code?: string | null; message?: string | null })) {
          return null;
        }

        throw error;
      });

      if (projectionState?.status !== "ready") {
        return applyManagedStoragePendingState(
          createPendingContentWorkspaceSummary({
            counts: {
              ...projectWideCountsWithManagedFallback,
              posts: 0,
            },
            isDerived: true,
            pendingCollections: ["posts"],
          }),
        );
      }

      const scopedPostsCount = await countContentPostsProjection({
        accessibleAuthorIds: readableAuthorIds,
        mapping: readyMapping,
        projectId,
      });

      return applyManagedStoragePendingState(
        createContentWorkspaceSummary({
          counts: {
            ...projectWideCountsWithManagedFallback,
            posts: scopedPostsCount,
          },
          isDerived: true,
          isExact: !hasManagedStorage,
          refreshedAt,
        }),
      );
    });
  } catch {
    if (readableAuthorIds !== null && !readableAuthorIds.length) {
      return createPendingContentWorkspaceSummary({
        counts: {
          ...createEmptyContentCounts(),
          posts: 0,
        },
        isDerived: true,
        pendingCollections: [...contentCollections],
      });
    }

    return createPendingContentWorkspaceSummary({
      counts:
        readableAuthorIds === null
          ? createEmptyContentCounts()
          : {
              ...createEmptyContentCounts(),
              posts: 0,
            },
      isDerived: readableAuthorIds !== null,
      pendingCollections: [...contentCollections],
    });
  }
};

export const getContentSnapshotForMappedContent = async ({
  context,
  dependencies,
  projectId,
}: {
  context: ContentProjectContext;
  dependencies: WorkspaceDependencies;
  projectId: string;
}): Promise<SnapshotResponse> => {
  const readyMapping = await dependencies.getReadyContentProjectMapping({
    context,
    projectId,
  });

  if (!readyMapping) {
    return {
      authors: [],
      categories: [],
      media: [],
      message: "Finish mapping before editing this project.",
      primaryContentFormat: context.schemaOptions.primaryContentFormat,
      posts: [],
      tags: [],
      workspaceState: "mapping_draft",
    };
  }

  if (!context.connectionString) {
    throw new Error("This project needs a working database connection before you can continue.");
  }

  const readableAuthorIds = dependencies.ensureContentPermission(context, "read");
  const authorAssignmentsByAuthorId = await dependencies.getProjectPostAuthorAssignments(projectId);
  const snapshot = await dependencies.withContentDatabaseClient(context.connectionString, (client) => {
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping: readyMapping,
    });
    const loadWorkspaceSnapshot = getRequiredContentRuntimeAdapterMethod(
      adapter,
      "loadWorkspaceSnapshot",
    );

    return loadWorkspaceSnapshot({
      accessibleAuthorIds: readableAuthorIds,
      authorAssignmentsByAuthorId,
      client,
      projectId,
    });
  });

  return {
    ...snapshot,
    primaryContentFormat: context.schemaOptions.primaryContentFormat,
  };
};
