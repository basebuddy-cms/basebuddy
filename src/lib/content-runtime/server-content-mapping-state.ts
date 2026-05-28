import "server-only";

import type { Client } from "pg";

import { getConfigProjectContentMapping } from "@/lib/basebuddy-config/projects";

import {
  buildContentAutoMappingResult,
  type ContentAutoMappingResult,
  type ContentSchemaIntrospection,
} from "./introspection";
import {
  hasReadyContentMapping,
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

  return {
    context: resolvedContext,
    mapping: await getConfigProjectContentMapping({
      projectId,
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
