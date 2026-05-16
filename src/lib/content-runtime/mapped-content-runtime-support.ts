import { randomUUID } from "node:crypto";

import type { Client } from "pg";

import {
  readContentArrayIndexValue,
  readContentJsonPathValue,
} from "./adapter/read-helpers";
import {
  getContentAvailableColumns,
  getContentColumnMetadata,
  getContentForeignKeyTarget,
  getContentTableMetadata,
  type ContentColumnMetadata,
  type ContentResolvedTable,
} from "./adapter/catalog";
import { normalizeContentRuntimeContent } from "./content-conversion";
import {
  quoteContentIdentifier,
  quoteContentQualifiedIdentifier,
} from "./adapter/sql";
import {
  buildContentNextNumericPrimaryKeyValueQuery,
  buildContentPostsOrderClause,
  buildContentPostsWhereClause,
  getContentMappedFieldComparableExpression,
  getContentMappedFieldTextExpression,
} from "./adapter/query-expressions";
import {
  type ContentPagination,
  type ContentPost,
} from "./shared";
import type {
  ContentEntityMapping,
  ContentMappingConfig,
  ContentProjectMapping,
  ContentRelationMapping,
} from "./mapping";

export type ContentDatabaseClient = Pick<Client, "query">;

export type MappedContentRuntime = {
  authors: ContentEntityMapping;
  categories: ContentEntityMapping;
  files: ContentEntityMapping;
  media: ContentEntityMapping;
  posts: ContentEntityMapping;
  tags: ContentEntityMapping;
};

export type MappedContentBasePostRow = Record<string, unknown>;

export type MappedContentColumnMetadata = ContentColumnMetadata;

export type MappedContentResolvedTable = ContentResolvedTable;

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const TIMESTAMP_CANDIDATES = ["created_at", "createdAt", "inserted_at", "updated_at", "updatedAt"] as const;
const mappedContentTableMetadataPromises = new Map<string, Promise<MappedContentResolvedTable | null>>();
const mappedContentForeignKeyTargetPromises = new Map<
  string,
  Promise<{ column: string | null; schema: string; table: string } | null>
>();
const mappedContentColumnMetadataPromises = new Map<string, Promise<MappedContentColumnMetadata | null>>();
const mappedContentTableColumnsPromises = new Map<string, Promise<Map<string, string>>>();
const mappedContentRuntimeByRevision = new Map<string, MappedContentRuntime>();
const mappedContentResolvedEntitySourcePromises = new Map<string, Promise<MappedContentResolvedTable | null>>();
const mappedContentResolvedEntityPromises = new Map<string, Promise<ContentEntityMapping>>();
const mappedContentResolvedRelationTargetColumnPromises = new Map<string, Promise<string | null>>();
const mappedContentRelationTargetTableNamePromises = new Map<string, Promise<string | null>>();
const MAPPED_CONTENT_RESOLUTION_NAMESPACE = Symbol("mappedContentResolutionNamespace");

const getCachedMappedContentPromise = async <T>(
  cache: Map<string, Promise<T>>,
  key: string,
  load: () => Promise<T>,
) => {
  const existingPromise = cache.get(key);

  if (existingPromise) {
    return existingPromise;
  }

  const nextPromise = load();
  cache.set(key, nextPromise);

  try {
    return await nextPromise;
  } catch (error) {
    cache.delete(key);
    throw error;
  }
};

export const quoteIdentifier = quoteContentIdentifier;

export const quoteQualifiedTable = (schema: string, table: string) =>
  quoteContentQualifiedIdentifier(schema, table);

export const toRuntime = (mappingConfig: ContentMappingConfig): MappedContentRuntime => ({
  authors: mappingConfig.entities.authors,
  categories: mappingConfig.entities.categories,
  files: mappingConfig.entities.files,
  media: mappingConfig.entities.media,
  posts: mappingConfig.entities.posts,
  tags: mappingConfig.entities.tags,
});

export const getContentMappingRevisionCacheKey = (
  mapping: Pick<ContentProjectMapping, "bindingId" | "revisionId" | "revisionVersion">,
) => `${mapping.bindingId || "binding"}:${mapping.revisionId ?? "none"}:${mapping.revisionVersion ?? 0}`;

const attachMappedContentResolutionNamespace = <T extends ContentEntityMapping>(
  entity: T,
  namespace: string | null,
) => {
  if (!namespace) {
    return entity;
  }

  Object.defineProperty(entity, MAPPED_CONTENT_RESOLUTION_NAMESPACE, {
    configurable: true,
    enumerable: false,
    value: namespace,
    writable: false,
  });

  return entity;
};

const getMappedContentResolutionNamespace = (...entities: Array<ContentEntityMapping | null | undefined>) => {
  for (const entity of entities) {
    const namespace = entity ? Reflect.get(entity, MAPPED_CONTENT_RESOLUTION_NAMESPACE) : null;

    if (typeof namespace === "string" && namespace.trim()) {
      return namespace;
    }
  }

  return null;
};

const serializeMappedContentEntityDescriptor = (entity: ContentEntityMapping | null | undefined) => {
  if (!entity) {
    return "none";
  }

  const fieldDescriptor = Object.entries(entity.fields)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([fieldKey, field]) => `${fieldKey}:${field.column?.trim() ?? ""}`)
    .join("|");

  return [
    entity.status,
    entity.source.kind,
    entity.source.schema?.trim() ?? "",
    entity.source.table?.trim() ?? "",
    entity.source.primaryKey?.trim() ?? "",
    fieldDescriptor,
  ].join("::");
};

const serializeMappedContentRelationDescriptor = (relation: ContentRelationMapping | undefined) => {
  if (!relation) {
    return "none";
  }

  const fieldMapDescriptor = Object.entries(relation.fieldMap)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([fieldKey, value]) => `${fieldKey}:${value}`)
    .join("|");

  return [
    relation.status,
    relation.strategy,
    relation.multiple ? "multiple" : "single",
    relation.sourceColumn?.trim() ?? "",
    relation.targetColumn?.trim() ?? "",
    relation.targetEntity ?? "",
    relation.targetTable?.trim() ?? "",
    relation.junctionTable?.trim() ?? "",
    relation.junctionSourceColumn?.trim() ?? "",
    relation.junctionTargetColumn?.trim() ?? "",
    relation.valueColumn?.trim() ?? "",
    fieldMapDescriptor,
  ].join("::");
};

const getMappedContentResolutionCacheKey = ({
  entity,
  kind,
  posts,
  relation,
}: {
  entity: ContentEntityMapping;
  kind: string;
  posts?: ContentEntityMapping | null;
  relation?: ContentRelationMapping;
}) => {
  const namespace = getMappedContentResolutionNamespace(entity, posts);

  if (!namespace) {
    return null;
  }

  return [
    namespace,
    kind,
    serializeMappedContentEntityDescriptor(entity),
    serializeMappedContentEntityDescriptor(posts ?? null),
    serializeMappedContentRelationDescriptor(relation),
  ].join("##");
};

export const getMappedContentRuntime = (mapping: ContentProjectMapping): MappedContentRuntime => {
  const cacheKey = getContentMappingRevisionCacheKey(mapping);
  const cachedRuntime = mappedContentRuntimeByRevision.get(cacheKey);

  if (cachedRuntime) {
    return cachedRuntime;
  }

  const runtime = {
    authors: attachMappedContentResolutionNamespace(
      { ...mapping.mappingConfig.entities.authors },
      cacheKey,
    ),
    categories: attachMappedContentResolutionNamespace(
      { ...mapping.mappingConfig.entities.categories },
      cacheKey,
    ),
    files: attachMappedContentResolutionNamespace(
      { ...mapping.mappingConfig.entities.files },
      cacheKey,
    ),
    media: attachMappedContentResolutionNamespace(
      { ...mapping.mappingConfig.entities.media },
      cacheKey,
    ),
    posts: attachMappedContentResolutionNamespace(
      { ...mapping.mappingConfig.entities.posts },
      cacheKey,
    ),
    tags: attachMappedContentResolutionNamespace(
      { ...mapping.mappingConfig.entities.tags },
      cacheKey,
    ),
  } satisfies MappedContentRuntime;

  mappedContentRuntimeByRevision.set(cacheKey, runtime);
  return runtime;
};

const normalizePageSize = (pageSize?: number) => {
  if (!Number.isFinite(pageSize) || !pageSize) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(pageSize)));
};

export const resolvePagination = ({
  page,
  pageSize,
  totalItems,
}: {
  page?: number;
  pageSize?: number;
  totalItems: number;
}): ContentPagination & { offset: number } => {
  const normalizedPageSize = normalizePageSize(pageSize);
  const totalPages = Math.max(1, Math.ceil(totalItems / normalizedPageSize));
  const normalizedPage =
    !Number.isFinite(page) || !page ? 1 : Math.max(1, Math.min(totalPages, Math.floor(page)));

  return {
    hasNextPage: normalizedPage < totalPages,
    hasPreviousPage: normalizedPage > 1,
    offset: (normalizedPage - 1) * normalizedPageSize,
    page: normalizedPage,
    pageSize: normalizedPageSize,
    totalItems,
    totalItemsExact: true,
    totalPages,
  };
};

export const isUsableEntitySource = (entity: ContentEntityMapping) =>
  Boolean(entity.source.schema?.trim() && entity.source.table?.trim());

export const getEntityTableName = (entity: ContentEntityMapping) => {
  if (!entity.source.schema || !entity.source.table) {
    throw new Error("Mapped entity source is incomplete.");
  }

  return quoteQualifiedTable(entity.source.schema, entity.source.table);
};

export const parseTableRef = (tableRef: string | null | undefined, fallbackSchema?: string | null) => {
  const normalized = tableRef?.trim();

  if (!normalized) {
    return null;
  }

  const parts = normalized.split(".");

  if (parts.length >= 2) {
    return {
      schema: parts[0]!.trim() || "public",
      table: parts.slice(1).join(".").trim(),
    };
  }

  return {
    schema: fallbackSchema?.trim() || "public",
    table: normalized,
  };
};

export const getTableMetadata = async ({
  client,
  schema,
  table,
}: {
  client: ContentDatabaseClient;
  schema: string;
  table: string;
}): Promise<MappedContentResolvedTable | null> => {
  return getCachedMappedContentPromise(
    mappedContentTableMetadataPromises,
    `${schema}.${table}`,
    () => getContentTableMetadata({ client, schema, table }),
  );
};

export const getForeignKeyTarget = async ({
  client,
  column,
  schema,
  table,
}: {
  client: ContentDatabaseClient;
  column: string;
  schema: string;
  table: string;
}) => {
  return getCachedMappedContentPromise(
    mappedContentForeignKeyTargetPromises,
    `${schema}.${table}.${column}`,
    () => getContentForeignKeyTarget({ client, column, schema, table }),
  );
};

export const getResolvedEntitySource = async ({
  client,
  relation,
  entity,
  posts,
}: {
  client: ContentDatabaseClient;
  relation: ContentRelationMapping | undefined;
  entity: ContentEntityMapping;
  posts?: ContentEntityMapping | null;
}): Promise<MappedContentResolvedTable | null> => {
  const cacheKey = getMappedContentResolutionCacheKey({
    entity,
    kind: "resolved_entity_source",
    posts,
    relation,
  });
  const loadResolvedEntitySource = async () => {
    if (entity.status === "unmapped") {
      return null;
    }

    if (relation && (relation.strategy === "none" || relation.status === "unmapped")) {
      return null;
    }

    const postsSchema = posts?.source.schema?.trim() || null;
    const postsTable = posts?.source.table?.trim() || null;
    const parsedRelationTarget = parseTableRef(relation?.targetTable, postsSchema ?? entity.source.schema);
    const mappedEntitySchema = entity.source.schema?.trim() || null;
    const mappedEntityTable = entity.source.table?.trim() || null;
    const relationTargetsMappedEntity = Boolean(
      mappedEntitySchema &&
        mappedEntityTable &&
        (!parsedRelationTarget ||
          (
            parsedRelationTarget.schema === mappedEntitySchema &&
            parsedRelationTarget.table === mappedEntityTable
          )),
    );

    if (relationTargetsMappedEntity && isUsableEntitySource(entity)) {
      return getTableMetadata({
        client,
        schema: entity.source.schema!,
        table: entity.source.table!,
      });
    }

    if (
      relation?.strategy === "foreign_key" &&
      relation.sourceColumn?.trim() &&
      postsSchema &&
      postsTable
    ) {
      const directTarget = await getForeignKeyTarget({
        client,
        column: relation.sourceColumn.trim(),
        schema: postsSchema,
        table: postsTable,
      });

      if (directTarget) {
        return getTableMetadata({
          client,
          schema: directTarget.schema,
          table: directTarget.table,
        });
      }
    }

    if (
      relation?.strategy === "join_table" &&
      relation.junctionTable?.trim() &&
      relation.junctionTargetColumn?.trim()
    ) {
      const parsedJoinTable = parseTableRef(relation.junctionTable, postsSchema ?? entity.source.schema);

      if (parsedJoinTable) {
        const joinTarget = await getForeignKeyTarget({
          client,
          column: relation.junctionTargetColumn.trim(),
          schema: parsedJoinTable.schema,
          table: parsedJoinTable.table,
        });

        if (joinTarget) {
          return getTableMetadata({
            client,
            schema: joinTarget.schema,
            table: joinTarget.table,
          });
        }
      }
    }

    if (parsedRelationTarget) {
      const relationTargetTable = await getTableMetadata({
        client,
        schema: parsedRelationTarget.schema,
        table: parsedRelationTarget.table,
      });

      if (relationTargetTable) {
        return relationTargetTable;
      }
    }

    if (isUsableEntitySource(entity)) {
      return getTableMetadata({
        client,
        schema: entity.source.schema!,
        table: entity.source.table!,
      });
    }

    return null;
  };

  if (!cacheKey) {
    return loadResolvedEntitySource();
  }

  return getCachedMappedContentPromise(
    mappedContentResolvedEntitySourcePromises,
    cacheKey,
    loadResolvedEntitySource,
  );
};

export const getResolvedEntity = async ({
  client,
  entity,
  posts = null,
  relation,
}: {
  client: ContentDatabaseClient;
  entity: ContentEntityMapping;
  posts?: ContentEntityMapping | null;
  relation?: ContentRelationMapping;
}) => {
  const cacheKey = getMappedContentResolutionCacheKey({
    entity,
    kind: "resolved_entity",
    posts,
    relation,
  });
  const loadResolvedEntity = async () => {
    const resolvedSource = await getResolvedEntitySource({
      client,
      entity,
      posts,
      relation,
    });

    if (!resolvedSource) {
      return attachMappedContentResolutionNamespace(
        {
          ...entity,
          source: {
            ...entity.source,
            kind: "none",
            schema: null,
            table: null,
          },
        } satisfies ContentEntityMapping,
        getMappedContentResolutionNamespace(entity, posts),
      );
    }

    return attachMappedContentResolutionNamespace(
      {
        ...entity,
        source: {
          kind: resolvedSource.kind,
          primaryKey: entity.source.primaryKey?.trim() || resolvedSource.primaryKey,
          schema: resolvedSource.schema,
          table: resolvedSource.table,
        },
      } satisfies ContentEntityMapping,
      getMappedContentResolutionNamespace(entity, posts),
    );
  };

  if (!cacheKey) {
    return loadResolvedEntity();
  }

  return getCachedMappedContentPromise(
    mappedContentResolvedEntityPromises,
    cacheKey,
    loadResolvedEntity,
  );
};

export const getResolvedRelationTargetColumn = async ({
  client,
  relation,
  entity,
  posts = null,
}: {
  client: ContentDatabaseClient;
  relation: ContentRelationMapping;
  entity: ContentEntityMapping;
  posts?: ContentEntityMapping | null;
}) => {
  const cacheKey = getMappedContentResolutionCacheKey({
    entity,
    kind: "resolved_relation_target_column",
    posts,
    relation,
  });
  const loadResolvedRelationTargetColumn = async () => {
    const postsSchema = posts?.source.schema?.trim() || null;
    const postsTable = posts?.source.table?.trim() || null;

    if (
      relation.strategy === "foreign_key" &&
      relation.sourceColumn?.trim() &&
      postsSchema &&
      postsTable
    ) {
      const directTarget = await getForeignKeyTarget({
        client,
        column: relation.sourceColumn.trim(),
        schema: postsSchema,
        table: postsTable,
      });

      if (directTarget?.column?.trim()) {
        return directTarget.column.trim();
      }
    }

    if (
      relation.strategy === "join_table" &&
      relation.junctionTable?.trim() &&
      relation.junctionTargetColumn?.trim()
    ) {
      const parsedJoinTable = parseTableRef(relation.junctionTable, postsSchema ?? entity.source.schema);

      if (parsedJoinTable) {
        const joinTarget = await getForeignKeyTarget({
          client,
          column: relation.junctionTargetColumn.trim(),
          schema: parsedJoinTable.schema,
          table: parsedJoinTable.table,
        });

        if (joinTarget?.column?.trim()) {
          return joinTarget.column.trim();
        }
      }
    }

    return relation.targetColumn?.trim() || null;
  };

  if (!cacheKey) {
    return loadResolvedRelationTargetColumn();
  }

  return getCachedMappedContentPromise(
    mappedContentResolvedRelationTargetColumnPromises,
    cacheKey,
    loadResolvedRelationTargetColumn,
  );
};

export const getRelationTargetTableName = async ({
  client,
  relation,
  entity,
  posts,
}: {
  client: ContentDatabaseClient;
  relation: ContentRelationMapping;
  entity: ContentEntityMapping;
  posts?: ContentEntityMapping | null;
}) => {
  const cacheKey = getMappedContentResolutionCacheKey({
    entity,
    kind: "relation_target_table_name",
    posts,
    relation,
  });
  const loadRelationTargetTableName = async () => {
    const resolvedEntity = await getResolvedEntity({
      client,
      entity,
      posts,
      relation,
    });

    return isUsableEntitySource(resolvedEntity) ? getEntityTableName(resolvedEntity) : null;
  };

  if (!cacheKey) {
    return loadRelationTargetTableName();
  }

  return getCachedMappedContentPromise(
    mappedContentRelationTargetTableNamePromises,
    cacheKey,
    loadRelationTargetTableName,
  );
};

export const getRelationJunctionTableName = (
  relation: ContentRelationMapping,
  fallbackSchema?: string | null,
) => {
  const parsed = parseTableRef(relation.junctionTable, fallbackSchema);
  return parsed ? quoteQualifiedTable(parsed.schema, parsed.table) : null;
};

export const getEntityIdColumn = (entity: ContentEntityMapping) =>
  entity.fields.id?.column?.trim() || entity.source.primaryKey?.trim() || null;

export const getEntityColumnMetadata = async ({
  client,
  columnName,
  entity,
}: {
  client: ContentDatabaseClient;
  columnName: string;
  entity: ContentEntityMapping;
}): Promise<MappedContentColumnMetadata | null> => {
  if (!entity.source.schema || !entity.source.table) {
    return null;
  }

  return getCachedMappedContentPromise(
    mappedContentColumnMetadataPromises,
    `${entity.source.schema}.${entity.source.table}.${columnName}`,
    () =>
      getContentColumnMetadata({
        client,
        columnName,
        schema: entity.source.schema!,
        table: entity.source.table!,
      }),
  );
};

export const EXISTING_DB_FALLBACK_TIMESTAMP_COLUMNS = [...TIMESTAMP_CANDIDATES];

export const getEntityAvailableColumns = async ({
  client,
  entity,
}: {
  client: ContentDatabaseClient;
  entity: ContentEntityMapping;
}): Promise<Map<string, string>> => {
  if (!entity.source.schema || !entity.source.table) {
    return new Map();
  }

  return getCachedMappedContentPromise(
    mappedContentTableColumnsPromises,
    `${entity.source.schema}.${entity.source.table}`,
    () =>
      getContentAvailableColumns({
        client,
        schema: entity.source.schema!,
        table: entity.source.table!,
      }),
  );
};

export const getEntitySelectableColumns = async ({
  client,
  entity,
  requestedColumns,
}: {
  client: ContentDatabaseClient;
  entity: ContentEntityMapping;
  requestedColumns: string[];
}) => {
  const availableColumns = await getEntityAvailableColumns({
    client,
    entity,
  });
  const selectedColumns: string[] = [];
  const seenColumns = new Set<string>();

  for (const requestedColumn of requestedColumns) {
    const normalizedColumn = requestedColumn.trim();

    if (!normalizedColumn) {
      continue;
    }

    const existingColumn = availableColumns.get(normalizedColumn.toLowerCase());

    if (!existingColumn) {
      continue;
    }

    const dedupeKey = existingColumn.toLowerCase();

    if (seenColumns.has(dedupeKey)) {
      continue;
    }

    seenColumns.add(dedupeKey);
    selectedColumns.push(existingColumn);
  }

  return selectedColumns;
};

const isUuidLikeColumn = (column: MappedContentColumnMetadata | null) => {
  const normalizedDataType = (column?.dataType ?? "").toLowerCase();
  const normalizedUdtName = (column?.udtName ?? "").toLowerCase();

  return normalizedDataType === "uuid" || normalizedUdtName === "uuid";
};

const isTextLikeColumn = (column: MappedContentColumnMetadata | null) => {
  const normalizedDataType = (column?.dataType ?? "").toLowerCase();
  const normalizedUdtName = (column?.udtName ?? "").toLowerCase();

  return (
    normalizedDataType.includes("char") ||
    normalizedDataType.includes("text") ||
    normalizedDataType === "citext" ||
    normalizedUdtName.includes("char") ||
    normalizedUdtName.includes("text") ||
    normalizedUdtName === "citext"
  );
};

const isNumericLikeColumn = (column: MappedContentColumnMetadata | null) => {
  const normalizedDataType = (column?.dataType ?? "").toLowerCase();
  const normalizedUdtName = (column?.udtName ?? "").toLowerCase();

  return (
    normalizedDataType === "smallint" ||
    normalizedDataType === "integer" ||
    normalizedDataType === "bigint" ||
    normalizedDataType === "numeric" ||
    normalizedUdtName === "int2" ||
    normalizedUdtName === "int4" ||
    normalizedUdtName === "int8" ||
    normalizedUdtName === "numeric"
  );
};

export const getRequiredPrimaryKeyInsertValue = async ({
  client,
  entity,
  primaryKeyColumn,
}: {
  client: ContentDatabaseClient;
  entity: ContentEntityMapping;
  primaryKeyColumn: string;
}) => {
  const metadata = await getEntityColumnMetadata({
    client,
    columnName: primaryKeyColumn,
    entity,
  });

  if (!metadata || metadata.defaultValue || metadata.isNullable) {
    return undefined;
  }

  if (isUuidLikeColumn(metadata) || isTextLikeColumn(metadata)) {
    return randomUUID();
  }

  if (isNumericLikeColumn(metadata)) {
    const result = await client.query<{ next_value: string }>(
      buildContentNextNumericPrimaryKeyValueQuery({
        primaryKeyColumn,
        tableName: getEntityTableName(entity),
      }),
    );

    return result.rows[0]?.next_value ?? "1";
  }

  throw new Error(`Mapped posts primary key column "${primaryKeyColumn}" needs a value that BaseBuddy cannot generate automatically.`);
};

export const getMappedFieldColumn = (entity: ContentEntityMapping, fieldKey: string) =>
  entity.fields[fieldKey]?.column?.trim() || null;

export const getMappedFieldPath = (entity: ContentEntityMapping, fieldKey: string) =>
  entity.fields[fieldKey]?.path?.trim() || null;

export const getMappedFieldArrayIndex = (entity: ContentEntityMapping, fieldKey: string) => {
  const arrayIndex = entity.fields[fieldKey]?.arrayIndex;
  return Number.isInteger(arrayIndex) && Number(arrayIndex) >= 0 ? Number(arrayIndex) : null;
};

export const findRowKey = (row: Record<string, unknown>, columnName: string | null | undefined) => {
  if (!columnName) {
    return null;
  }

  if (columnName in row) {
    return columnName;
  }

  const normalized = columnName.toLowerCase();
  return Object.keys(row).find((key) => key.toLowerCase() === normalized) ?? null;
};

export const getRowValue = (row: Record<string, unknown>, columnName: string | null | undefined) => {
  const resolvedKey = findRowKey(row, columnName);
  return resolvedKey ? row[resolvedKey] : null;
};

export const getMappedFieldComparableExpression = getContentMappedFieldComparableExpression;

export const getMappedFieldTextExpression = getContentMappedFieldTextExpression;

export const getMappedFieldValue = (
  row: Record<string, unknown>,
  entity: ContentEntityMapping,
  fieldKey: string,
) => {
  const column = getMappedFieldColumn(entity, fieldKey);

  if (!column) {
    return null;
  }

  const path = getMappedFieldPath(entity, fieldKey);

  if (path) {
    return readContentJsonPathValue({
      column,
      path,
      row,
    });
  }

  const arrayIndex = getMappedFieldArrayIndex(entity, fieldKey);

  if (arrayIndex !== null) {
    return readContentArrayIndexValue({
      column,
      index: arrayIndex,
      row,
    });
  }

  return getRowValue(row, column);
};

export const toText = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export const toIsoTimestamp = (value: unknown, fallback?: string | null) => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const normalized = toText(value);
  return normalized || fallback || new Date().toISOString();
};

export const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return [...new Set(value.map((entry) => toText(entry)).filter(Boolean) as string[])];
  }

  const normalized = toText(value);
  return normalized ? [normalized] : [];
};

export const getFallbackTimestamp = (row: Record<string, unknown>) => {
  for (const candidate of TIMESTAMP_CANDIDATES) {
    const value = getRowValue(row, candidate);

    if (value !== null && value !== undefined) {
      return toIsoTimestamp(value);
    }
  }

  return new Date().toISOString();
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const plainTextToHtml = (value: string) => {
  const normalized = value.trim();

  if (!normalized) {
    return "<p></p>";
  }

  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
};

export const stripHtmlToPlainText = (value: string) =>
  value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();

export const normalizeMappedContentValue = ({
  kind,
  value,
}: {
  kind: ContentEntityMapping["editorFields"][number]["kind"] | "plain_text" | "text";
  value: unknown;
}) => {
  if ((kind === "json" || kind === "rich_text") && value && typeof value === "object" && !Array.isArray(value)) {
    const normalized = normalizeContentRuntimeContent({
      contentJson: value as Record<string, unknown>,
      primaryContentFormat: "html",
    });

    return {
      contentFormat: "html" as const,
      ...normalized,
    };
  }

  if (kind === "markdown") {
    const normalized = normalizeContentRuntimeContent({
      contentMarkdown: toText(value) ?? "",
      primaryContentFormat: "markdown",
    });

    return {
      contentFormat: "markdown" as const,
      ...normalized,
    };
  }

  if (kind === "plain_text" || kind === "text") {
    const normalized = normalizeContentRuntimeContent({
      contentHtml: plainTextToHtml(toText(value) ?? ""),
      primaryContentFormat: "html",
    });

    return {
      contentFormat: "html" as const,
      ...normalized,
    };
  }

  const normalized = normalizeContentRuntimeContent({
    contentHtml: toText(value) ?? "",
    primaryContentFormat: "html",
  });

  return {
    contentFormat: "html" as const,
    ...normalized,
  };
};

export const getMappedPublishedAtColumn = (posts: ContentEntityMapping) =>
  posts.workflow?.publishedAtColumn?.trim() || getMappedFieldColumn(posts, "publishedAt");

const normalizeWorkflowValue = (value: unknown) => (toText(value) ?? "").toLowerCase();

export const getPostStatusFromRow = (
  row: Record<string, unknown>,
  posts: ContentEntityMapping,
): ContentPost["status"] => {
  const workflow = posts.workflow;
  const publishedAtColumn = getMappedPublishedAtColumn(posts);
  const publishedAtValue = publishedAtColumn ? getRowValue(row, publishedAtColumn) : null;

  if (workflow?.statusColumn) {
    const normalized = normalizeWorkflowValue(getRowValue(row, workflow.statusColumn));

    if ((workflow.archivedValues ?? []).some((value) => value.toLowerCase() === normalized)) {
      return "archived";
    }

    if ((workflow.publishedValues ?? []).some((value) => value.toLowerCase() === normalized)) {
      return "published";
    }

    if ((workflow.draftValues ?? []).some((value) => value.toLowerCase() === normalized)) {
      return "draft";
    }
  }

  if (workflow?.publishedFlagColumn) {
    const normalized = normalizeWorkflowValue(getRowValue(row, workflow.publishedFlagColumn));
    return (workflow.publishedValues ?? []).some((value) => value.toLowerCase() === normalized)
      ? "published"
      : "draft";
  }

  return publishedAtValue ? "published" : "draft";
};

export const buildPostsWhereClause = buildContentPostsWhereClause;

export const buildPostsOrderClause = buildContentPostsOrderClause;
