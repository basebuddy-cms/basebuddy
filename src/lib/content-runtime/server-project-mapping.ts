import "server-only";

import type { Client } from "pg";

import type { ProjectPermissionKey } from "@/lib/control-plane/permissions";
import { saveConfigProjectContentMappingRevision } from "@/lib/basebuddy-config/projects";

import {
  buildContentAutoMappingResult,
  type ContentAutoMappingResult,
} from "./introspection";
import {
  getContentMappingDuplicateColumnIssues,
  normalizeContentMappingConfig,
  type ContentBindingStatus,
  type ContentMappingConfig,
  type ContentMappingSaveScope,
  type ContentMappingRevisionSource,
  type ContentProjectMapping,
} from "./mapping";
import {
  getContentSchemaTableCatalog,
  introspectContentSchema,
} from "./adapter/introspection";
import {
  buildContentStorageBucketsQuery,
} from "./adapter/query-builders";
import {
  getBootstrapContentProjectMapping as getBootstrapContentProjectMappingState,
  getReadyContentProjectMapping as getReadyContentProjectMappingState,
  loadRepairedContentProjectMapping as loadRepairedContentProjectMappingState,
  loadStoredContentProjectMapping as loadStoredContentProjectMappingState,
} from "./server-content-mapping-state";
import type { ContentProjectContext } from "./server-project-context";
import type { ContentStorageBucketOption } from "./shared";
import { getNormalizedContentS3CompatibleMediaStorageConfig } from "./server-support";

type ContentDatabaseClient = Pick<Client, "query">;
type StorageBucketRow = {
  bucket_id: string | null;
  bucket_name: string | null;
  is_public: boolean | null;
};

type WithContentDatabaseClient = <T>(
  connectionString: string,
  handler: (client: ContentDatabaseClient) => Promise<T>,
) => Promise<T>;

export type ContentProjectMappingTableCatalogEntry = {
  columnCount: number;
  kind: "table" | "view";
  primaryKey: string | null;
  rowCountEstimate: number | null;
  schema: string;
  table: string;
  tableRef: string;
};

type ContentMappingDependencies = {
  ensureProjectManagementPermission: (
    context: ContentProjectContext,
    message: string,
  ) => void;
  ensureProjectPermission: (
    context: ContentProjectContext,
    permissionKey: ProjectPermissionKey,
    message: string,
  ) => void;
  getFilesStorageCredentialStatus: (projectId: string) => Promise<{
    hasS3AccessKeyId: boolean;
    hasS3SecretAccessKey: boolean;
  }>;
  getMediaStorageCredentialStatus: (projectId: string) => Promise<{
    hasS3AccessKeyId: boolean;
    hasS3SecretAccessKey: boolean;
  }>;
  getProjectContext: (projectId: string) => Promise<ContentProjectContext | null>;
  withContentDatabaseClient: WithContentDatabaseClient;
};

const CONTENT_MAPPING_AUTO_DETECTION_TIMEOUT_MS = 25_000;
const CONTENT_MAPPING_AUTO_DETECTION_TIMEOUT_MESSAGE =
  "Auto-detection took too long for this database. Choose a table manually to continue.";
const CONTENT_MAPPING_SELECTED_TABLE_TIMEOUT_MESSAGE =
  "Field detection took too long for the selected table. Try again or map the fields manually.";
const CONTENT_MAPPING_TABLE_CATALOG_TIMEOUT_MESSAGE =
  "Could not load the available tables right now.";
const CONTENT_MAPPING_TABLE_CATALOG_CACHE_TTL_MS = 60_000;
const cachedContentSchemaTableCatalogs = new Map<
  string,
  {
    expiresAt: number;
    tables: ContentProjectMappingTableCatalogEntry[];
  }
>();
const pendingContentSchemaTableCatalogs = new Map<
  string,
  Promise<ContentProjectMappingTableCatalogEntry[]>
>();

export const getContentDatabaseCacheFingerprint = (connectionString: string) => {
  try {
    const url = new URL(connectionString);
    url.username = "";
    url.password = "";
    return url.toString().replace("//@", "//");
  } catch {
    return connectionString.replace(/:\/\/([^:@/]+)(:[^@/]+)?@/, "://");
  }
};

const withContentMappingTimeout = async <T>(
  load: () => Promise<T>,
  message: string,
  timeoutMs = CONTENT_MAPPING_AUTO_DETECTION_TIMEOUT_MS,
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      load(),
      new Promise<T>((_resolve, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(message));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const ensureContentMappingReadAccess = ({
  context,
  dependencies,
}: {
  context: ContentProjectContext;
  dependencies: ContentMappingDependencies;
}) => {
  const message = "You do not have permission to view content mapping in this project.";

  dependencies.ensureProjectManagementPermission(context, message);
  dependencies.ensureProjectPermission(context, "mapping.read", message);
};

const getMergedContentMappingConfig = ({
  currentConfig,
  nextConfig,
  scope,
}: {
  currentConfig: ContentMappingConfig;
  nextConfig: ContentMappingConfig;
  scope: ContentMappingSaveScope;
}) => {
  if (scope === "full") {
    return normalizeContentMappingConfig(nextConfig);
  }

  const mergedConfig = normalizeContentMappingConfig(currentConfig);

  if (scope === "posts") {
    mergedConfig.entities.posts = {
      ...nextConfig.entities.posts,
      relations: mergedConfig.entities.posts.relations,
    };
    return normalizeContentMappingConfig(mergedConfig);
  }

  if (scope === "authors") {
    mergedConfig.entities.authors = nextConfig.entities.authors;
    mergedConfig.entities.posts.relations.authors = nextConfig.entities.posts.relations.authors;
    return normalizeContentMappingConfig(mergedConfig);
  }

  if (scope === "categories") {
    mergedConfig.entities.categories = nextConfig.entities.categories;
    mergedConfig.entities.posts.relations.categories = nextConfig.entities.posts.relations.categories;
    return normalizeContentMappingConfig(mergedConfig);
  }

  if (scope === "tags") {
    mergedConfig.entities.tags = nextConfig.entities.tags;
    mergedConfig.entities.posts.relations.tags = nextConfig.entities.posts.relations.tags;
    return normalizeContentMappingConfig(mergedConfig);
  }

  if (scope === "media") {
    mergedConfig.mediaStorage = nextConfig.mediaStorage;
    return normalizeContentMappingConfig(mergedConfig);
  }

  mergedConfig.filesStorage = nextConfig.filesStorage;
  return normalizeContentMappingConfig(mergedConfig);
};

export const loadStoredContentProjectMapping = ({
  context,
  dependencies,
  enforceReadPermission = true,
  projectId,
}: {
  context?: ContentProjectContext;
  dependencies: ContentMappingDependencies;
  enforceReadPermission?: boolean;
  projectId: string;
}) =>
  loadStoredContentProjectMappingState({
    context,
    enforceReadPermission,
    ensureReadAccess: (resolvedContext) =>
      ensureContentMappingReadAccess({
        context: resolvedContext,
        dependencies,
      }),
    getProjectContext: dependencies.getProjectContext,
    projectId,
  });

export const loadRepairedContentProjectMapping = ({
  client,
  context,
  dependencies,
  mapping,
  projectId,
}: {
  client?: ContentDatabaseClient;
  context: ContentProjectContext;
  dependencies: ContentMappingDependencies;
  mapping: ContentProjectMapping;
  projectId: string;
}) =>
  loadRepairedContentProjectMappingState({
    client,
    context,
    mapping,
    projectId,
    withContentDatabaseClient: dependencies.withContentDatabaseClient,
  });

export const getReadyContentProjectMapping = ({
  client,
  context,
  dependencies,
  projectId,
}: {
  client?: ContentDatabaseClient;
  context: ContentProjectContext;
  dependencies: ContentMappingDependencies;
  projectId: string;
}) =>
  getReadyContentProjectMappingState({
    client,
    context,
    projectId,
    withContentDatabaseClient: dependencies.withContentDatabaseClient,
  });

export const getBootstrapContentProjectMapping = ({
  context,
  projectId,
}: {
  context: ContentProjectContext;
  projectId: string;
}) =>
  getBootstrapContentProjectMappingState({
    context,
    projectId,
  });

export const getContentProjectMapping = async ({
  dependencies,
  projectId,
}: {
  dependencies: ContentMappingDependencies;
  projectId: string;
}): Promise<ContentProjectMapping> => {
  const { context, mapping } = await loadStoredContentProjectMapping({
    dependencies,
    projectId,
  });

  if (
    mapping.bindingMode === "mapped_content" &&
    context.connectionString
  ) {
    return loadRepairedContentProjectMapping({
      context,
      dependencies,
      mapping,
      projectId,
    });
  }

  return mapping;
};

export const getContentProjectMediaStorageCredentialStatus = async ({
  dependencies,
  projectId,
}: {
  dependencies: ContentMappingDependencies;
  projectId: string;
}) => {
  await loadStoredContentProjectMapping({
    dependencies,
    projectId,
  });
  return dependencies.getMediaStorageCredentialStatus(projectId);
};

export const getContentProjectFilesStorageCredentialStatus = async ({
  dependencies,
  projectId,
}: {
  dependencies: ContentMappingDependencies;
  projectId: string;
}) => {
  await loadStoredContentProjectMapping({
    dependencies,
    projectId,
  });
  return dependencies.getFilesStorageCredentialStatus(projectId);
};

export const getContentProjectSupabaseStorageBuckets = async ({
  dependencies,
  projectId,
}: {
  dependencies: ContentMappingDependencies;
  projectId: string;
}): Promise<ContentStorageBucketOption[]> => {
  const { context } = await loadStoredContentProjectMapping({
    dependencies,
    projectId,
  });

  if (!context.connectionString) {
    return [];
  }

  try {
    return await dependencies.withContentDatabaseClient(context.connectionString, async (client) => {
      const result = await client.query<StorageBucketRow>(
        buildContentStorageBucketsQuery(),
      );

      return result.rows
        .map((row) => ({
          id: row.bucket_id?.trim() || "",
          isPublic: row.is_public === true,
          name: row.bucket_name?.trim() || row.bucket_id?.trim() || "",
        }))
        .filter((bucket) => bucket.id);
    });
  } catch (error) {
    console.warn(
      error instanceof Error
        ? `Could not load Supabase storage buckets for project ${projectId}: ${error.message}`
        : `Could not load Supabase storage buckets for project ${projectId}.`,
    );

    return [];
  }
};

export const getContentProjectMappingDetection = async ({
  dependencies,
  projectId,
  tableRef,
}: {
  dependencies: ContentMappingDependencies;
  projectId: string;
  tableRef?: string | null;
}): Promise<ContentAutoMappingResult> => {
  const context = await dependencies.getProjectContext(projectId);

  if (!context) {
    throw new Error("Could not load this project right now.");
  }

  dependencies.ensureProjectManagementPermission(
    context,
    "You do not have permission to inspect content mapping in this project.",
  );
  dependencies.ensureProjectPermission(
    context,
    "mapping.read",
    "You do not have permission to inspect content mapping in this project.",
  );

  if (!context.connectionString) {
    throw new Error("This project needs a working database connection before you can continue.");
  }

  return dependencies.withContentDatabaseClient(context.connectionString, async (client) => {
    const normalizedTableRef = tableRef?.trim() || null;
    const schema = await withContentMappingTimeout(
      () =>
        introspectContentSchema(
          client,
          normalizedTableRef
            ? {
                focusTableRefs: [normalizedTableRef],
                includeSampleRows: "focused",
                maxSampleTables: 1,
                restrictToTableRefs: [normalizedTableRef],
              }
            : {
                includeSampleRows: "focused",
                maxSampleTables: 12,
              },
        ),
      normalizedTableRef
        ? CONTENT_MAPPING_SELECTED_TABLE_TIMEOUT_MESSAGE
        : CONTENT_MAPPING_AUTO_DETECTION_TIMEOUT_MESSAGE,
    );
    return buildContentAutoMappingResult(schema);
  });
};

export const getContentProjectMappingTables = async ({
  dependencies,
  projectId,
}: {
  dependencies: ContentMappingDependencies;
  projectId: string;
}): Promise<ContentProjectMappingTableCatalogEntry[]> => {
  const context = await dependencies.getProjectContext(projectId);

  if (!context) {
    throw new Error("Could not load this project right now.");
  }

  dependencies.ensureProjectManagementPermission(
    context,
    "You do not have permission to inspect content mapping in this project.",
  );
  dependencies.ensureProjectPermission(
    context,
    "mapping.read",
    "You do not have permission to inspect content mapping in this project.",
  );

  if (!context.connectionString) {
    throw new Error("This project needs a working database connection before you can continue.");
  }

  return dependencies.withContentDatabaseClient(context.connectionString, async (client) => {
    const cacheKey = getContentDatabaseCacheFingerprint(context.connectionString as string);
    const now = Date.now();
    const cachedCatalog = cachedContentSchemaTableCatalogs.get(cacheKey);

    if (cachedCatalog && cachedCatalog.expiresAt > now) {
      return cachedCatalog.tables;
    }

    const pendingCatalog = pendingContentSchemaTableCatalogs.get(cacheKey);

    if (pendingCatalog) {
      return pendingCatalog;
    }

    const catalogPromise = withContentMappingTimeout(
      () => getContentSchemaTableCatalog(client),
      CONTENT_MAPPING_TABLE_CATALOG_TIMEOUT_MESSAGE,
      15_000,
    ).then((tables) => {
      cachedContentSchemaTableCatalogs.set(cacheKey, {
        expiresAt: Date.now() + CONTENT_MAPPING_TABLE_CATALOG_CACHE_TTL_MS,
        tables,
      });
      return tables;
    });

    pendingContentSchemaTableCatalogs.set(cacheKey, catalogPromise);

    try {
      return await catalogPromise;
    } finally {
      pendingContentSchemaTableCatalogs.delete(cacheKey);
    }
  });
};

export const refreshContentProjectMappingTables = async ({
  dependencies,
  projectId,
}: {
  dependencies: ContentMappingDependencies;
  projectId: string;
}) => {
  const context = await dependencies.getProjectContext(projectId);

  if (!context?.connectionString) {
    return [];
  }

  cachedContentSchemaTableCatalogs.delete(getContentDatabaseCacheFingerprint(context.connectionString));

  return getContentProjectMappingTables({
    dependencies,
    projectId,
  });
};

export const saveContentMappingRevision = async ({
  bindingStatus,
  dependencies,
  mappingConfig,
  mappingScope = "full",
  projectId,
  source = "manual",
}: {
  bindingStatus?: ContentBindingStatus | null;
  dependencies: ContentMappingDependencies;
  mappingConfig: ContentMappingConfig;
  mappingScope?: ContentMappingSaveScope;
  projectId: string;
  source?: ContentMappingRevisionSource;
}): Promise<ContentProjectMapping> => {
  const context = await dependencies.getProjectContext(projectId);

  if (!context) {
    throw new Error("Could not load this project right now.");
  }

  dependencies.ensureProjectManagementPermission(
    context,
    "You do not have permission to update content mapping in this project.",
  );
  dependencies.ensureProjectPermission(
    context,
    "mapping.write",
    "You do not have permission to update content mapping in this project.",
  );

  const normalizedIncomingMappingConfig = normalizeContentMappingConfig(mappingConfig);
  const normalizedMappingConfig =
    mappingScope === "full"
      ? normalizedIncomingMappingConfig
      : getMergedContentMappingConfig({
          currentConfig:
            (
              await loadStoredContentProjectMapping({
                context,
                dependencies,
                enforceReadPermission: false,
                projectId,
              })
            ).mapping.mappingConfig,
          nextConfig: normalizedIncomingMappingConfig,
          scope: mappingScope,
        });
  const duplicateColumnIssues = getContentMappingDuplicateColumnIssues(normalizedMappingConfig);

  if (duplicateColumnIssues.length > 0) {
    throw new Error(duplicateColumnIssues[0]!.message);
  }

  const isSavingS3CompatibleFilesStorage =
    (mappingScope === "full" || mappingScope === "files") &&
    normalizedMappingConfig.filesStorage?.provider === "s3_compatible";
  const isSavingS3CompatibleMediaStorage =
    (mappingScope === "full" || mappingScope === "media") &&
    normalizedMappingConfig.mediaStorage?.provider === "s3_compatible";

  if (isSavingS3CompatibleFilesStorage) {
    if (
      !getNormalizedContentS3CompatibleMediaStorageConfig(
        normalizedMappingConfig.filesStorage,
      )
    ) {
      throw new Error(
        "Add a bucket name and endpoint or region for files storage before saving this mapping.",
      );
    }

    const credentialStatus = await dependencies.getFilesStorageCredentialStatus(projectId);
    const hasS3CompatibleCredentials =
      credentialStatus.hasS3AccessKeyId && credentialStatus.hasS3SecretAccessKey;

    if (!hasS3CompatibleCredentials) {
      throw new Error(
        "Add files storage keys in environment values before saving this mapping.",
      );
    }
  }

  if (isSavingS3CompatibleMediaStorage) {
    if (
      !getNormalizedContentS3CompatibleMediaStorageConfig(
        normalizedMappingConfig.mediaStorage,
      )
    ) {
      throw new Error(
        "Add a bucket name and endpoint or region for media storage before saving this mapping.",
      );
    }

    const credentialStatus = await dependencies.getMediaStorageCredentialStatus(projectId);
    const hasS3CompatibleCredentials =
      credentialStatus.hasS3AccessKeyId && credentialStatus.hasS3SecretAccessKey;

    if (!hasS3CompatibleCredentials) {
      throw new Error(
        "Add media storage keys in environment values before saving this mapping.",
      );
    }
  }

  await saveConfigProjectContentMappingRevision({
    bindingStatus,
    mappingConfig: normalizedMappingConfig,
    projectId,
    source,
  });

  return getContentProjectMapping({
    dependencies,
    projectId,
  });
};

export const ensureContentMappingDraft = async ({
  dependencies,
  projectId,
}: {
  dependencies: ContentMappingDependencies;
  projectId: string;
}): Promise<ContentProjectMapping> => {
  const mapping = await getContentProjectMapping({
    dependencies,
    projectId,
  });

  if (mapping.revisionId) {
    return mapping;
  }

  return saveContentMappingRevision({
    bindingStatus: "draft",
    dependencies,
    mappingConfig: mapping.mappingConfig,
    projectId,
    source: "system",
  });
};
