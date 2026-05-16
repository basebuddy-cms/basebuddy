import "server-only";

import type { Client } from "pg";

import { getProductionErrorMessage } from "@/lib/errors/user-facing";
import {
  APP_SETUP_REQUIRED_MESSAGE,
  isControlPlaneSetupError,
} from "@/lib/control-plane/server";
import {
  createControlPlaneAdminClient,
  createControlPlaneServerClient,
} from "@/lib/control-plane/supabase-clients";

import {
  buildContentAutoMappingResult,
  type ContentAutoMappingResult,
  type ContentSchemaIntrospection,
} from "./introspection";
import {
  createDefaultContentMappingConfig,
  hasReadyContentMapping,
  normalizeContentProjectMapping,
  type ContentProjectMapping,
} from "./mapping";
import {
  introspectContentSchema,
  repairContentMappingConfig,
} from "./adapter/introspection";

type ContentDatabaseClient = Pick<Client, "query">;

type ContentMappingContext = {
  connectionString: string | null;
};

type ProjectContentMappingRow = {
  binding_id: string;
  binding_mode: string;
  binding_status: string;
  canonical_schema_version: number;
  install_config: Record<string, unknown> | null;
  mapping_config: Record<string, unknown> | null;
  revision_created_at: string | null;
  revision_id: string | null;
  revision_source: string | null;
  revision_version: number | null;
  scope_config: Record<string, unknown> | null;
  scope_mode: string;
  storage_bucket: string | null;
};

type WithContentDatabaseClient = <T>(
  connectionString: string,
  handler: (client: ContentDatabaseClient) => Promise<T>,
) => Promise<T>;

const CONTENT_SCHEMA_CACHE_TTL_MS = 60_000;
const repairedContentProjectMappings = new Map<string, ContentProjectMapping>();
const pendingRepairedContentProjectMappings = new Map<string, Promise<ContentProjectMapping>>();
const cachedContentSchemaIntrospections = new Map<
  string,
  {
    expiresAt: number;
    schema: ContentSchemaIntrospection;
  }
>();
const pendingContentSchemaIntrospections = new Map<string, Promise<ContentSchemaIntrospection>>();

const createFallbackRuntimeProjectMapping = (projectId: string): ContentProjectMapping =>
  normalizeContentProjectMapping({
    binding_id: projectId,
    binding_mode: "mapped_content",
    binding_status: "draft",
    mapping_config: createDefaultContentMappingConfig(),
    revision_id: null,
    revision_version: null,
  });

export const loadStoredContentProjectMapping = async <TContext extends object>({
  context,
  enforceReadPermission = true,
  ensureReadAccess,
  getProjectContext,
  projectId,
}: {
  context?: TContext;
  enforceReadPermission?: boolean;
  ensureReadAccess?: (context: TContext) => void;
  getProjectContext?: (projectId: string) => Promise<TContext | null>;
  projectId: string;
}) => {
  const resolvedContext =
    context ?? (getProjectContext ? await getProjectContext(projectId) : null);

  if (!resolvedContext) {
    throw new Error("Could not load this project right now.");
  }

  if (enforceReadPermission && ensureReadAccess) {
    ensureReadAccess(resolvedContext);
  }

  const supabase = enforceReadPermission
    ? await createControlPlaneServerClient()
    : createControlPlaneAdminClient();
  const rpcName = enforceReadPermission
    ? "get_project_content_mapping"
    : "get_project_content_runtime_mapping";
  const { data, error } = await supabase.rpc(rpcName, {
    p_project_id: projectId,
  });

  if (error) {
    if (isControlPlaneSetupError(error)) {
      if (!enforceReadPermission) {
        const fallbackSupabase = await createControlPlaneServerClient();
        const { data: fallbackData, error: fallbackError } = await fallbackSupabase.rpc(
          "get_project_content_mapping",
          {
            p_project_id: projectId,
          },
        );

        if (!fallbackError) {
          const fallbackRow = ((Array.isArray(fallbackData) ? fallbackData[0] : fallbackData) ??
            null) as ProjectContentMappingRow | null;

          if (fallbackRow?.binding_id) {
            return {
              context: resolvedContext,
              mapping: normalizeContentProjectMapping({
                ...fallbackRow,
                mapping_config: fallbackRow.mapping_config ?? createDefaultContentMappingConfig(),
              }),
            };
          }
        }

        console.warn(
          "[content-runtime][mapping] Falling back to a draft runtime mapping because the runtime RPC is unavailable.",
          {
            error,
            fallbackError,
            projectId,
          },
        );
        return {
          context: resolvedContext,
          mapping: createFallbackRuntimeProjectMapping(projectId),
        };
      }

      throw new Error(APP_SETUP_REQUIRED_MESSAGE);
    }

    throw new Error(getProductionErrorMessage(error, "Could not load the content mapping right now."));
  }

  const row = ((Array.isArray(data) ? data[0] : data) ?? null) as ProjectContentMappingRow | null;

  if (!row?.binding_id) {
    throw new Error("Project content binding not found.");
  }

  return {
    context: resolvedContext,
    mapping: normalizeContentProjectMapping({
      ...row,
      mapping_config: row.mapping_config ?? createDefaultContentMappingConfig(),
    }),
  };
};

const getCachedContentSchemaIntrospection = async ({
  client,
  connectionString,
}: {
  client: ContentDatabaseClient;
  connectionString: string;
}) => {
  const now = Date.now();
  const cachedSchema = cachedContentSchemaIntrospections.get(connectionString);

  if (cachedSchema && cachedSchema.expiresAt > now) {
    return cachedSchema.schema;
  }

  const pendingSchema = pendingContentSchemaIntrospections.get(connectionString);

  if (pendingSchema) {
    return pendingSchema;
  }

  const schemaPromise = (async () => {
    const schema = await introspectContentSchema(client);
    cachedContentSchemaIntrospections.set(connectionString, {
      expiresAt: Date.now() + CONTENT_SCHEMA_CACHE_TTL_MS,
      schema,
    });
    return schema;
  })();

  pendingContentSchemaIntrospections.set(connectionString, schemaPromise);

  try {
    return await schemaPromise;
  } finally {
    pendingContentSchemaIntrospections.delete(connectionString);
  }
};

const repairContentProjectMapping = async ({
  client,
  connectionString,
  mapping,
}: {
  client: ContentDatabaseClient;
  connectionString?: string | null;
  mapping: ContentProjectMapping;
}) => {
  const schema =
    connectionString
      ? await getCachedContentSchemaIntrospection({
          client,
          connectionString,
        })
      : await introspectContentSchema(client);
  const detection: ContentAutoMappingResult = buildContentAutoMappingResult(schema);

  return {
    ...mapping,
    mappingConfig: repairContentMappingConfig({
      detection,
      mappingConfig: mapping.mappingConfig,
    }),
  } satisfies ContentProjectMapping;
};

const getContentProjectMappingCacheKey = ({
  mapping,
  projectId,
}: {
  mapping: ContentProjectMapping;
  projectId: string;
}) => `${projectId}:${mapping.bindingId}:${mapping.revisionId ?? "none"}:${mapping.revisionVersion ?? 0}`;

export const loadRepairedContentProjectMapping = async <
  TContext extends ContentMappingContext,
>({
  client,
  context,
  mapping,
  projectId,
  withContentDatabaseClient,
}: {
  client?: ContentDatabaseClient;
  context: TContext;
  mapping: ContentProjectMapping;
  projectId: string;
  withContentDatabaseClient: WithContentDatabaseClient;
}) => {
  const cacheKey = getContentProjectMappingCacheKey({
    mapping,
    projectId,
  });
  const cachedMapping = repairedContentProjectMappings.get(cacheKey);

  if (cachedMapping) {
    return cachedMapping;
  }

  const pendingMapping = pendingRepairedContentProjectMappings.get(cacheKey);

  if (pendingMapping) {
    return pendingMapping;
  }

  const repairPromise = (async () => {
    if (client) {
      return repairContentProjectMapping({
        client,
        connectionString: context.connectionString,
        mapping,
      });
    }

    return withContentDatabaseClient(context.connectionString as string, async (contentDatabaseClient) =>
      repairContentProjectMapping({
        client: contentDatabaseClient,
        connectionString: context.connectionString,
        mapping,
      }),
    );
  })();

  pendingRepairedContentProjectMappings.set(cacheKey, repairPromise);

  try {
    const repairedMapping = await repairPromise;
    repairedContentProjectMappings.set(cacheKey, repairedMapping);
    return repairedMapping;
  } finally {
    pendingRepairedContentProjectMappings.delete(cacheKey);
  }
};

export const getReadyContentProjectMapping = async <
  TContext extends ContentMappingContext,
>({
  client,
  context,
  projectId,
  withContentDatabaseClient,
}: {
  client?: ContentDatabaseClient;
  context: TContext;
  projectId: string;
  withContentDatabaseClient: WithContentDatabaseClient;
}): Promise<ContentProjectMapping | null> => {

  const { mapping } = await loadStoredContentProjectMapping<TContext>({
    context,
    enforceReadPermission: false,
    projectId,
  });

  if (!hasReadyContentMapping(mapping)) {
    return null;
  }

  void client;
  void projectId;
  void withContentDatabaseClient;

  return mapping;
};

export const getBootstrapContentProjectMapping = async <
  TContext extends ContentMappingContext,
>({
  context,
  projectId,
}: {
  context: TContext;
  projectId: string;
}): Promise<ContentProjectMapping | null> => {

  const { mapping } = await loadStoredContentProjectMapping<TContext>({
    context,
    enforceReadPermission: false,
    projectId,
  });

  return hasReadyContentMapping(mapping) ? mapping : null;
};
