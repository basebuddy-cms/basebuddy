import {
  buildContentDeleteByPredicateQuery,
  buildContentEntityCountQuery,
  buildContentEntityPageRowsQuery,
  buildContentHelperValueConflictQuery,
  buildContentHelperRowsForPostIdQuery,
  buildContentHelperRowsForPostIdsQuery,
  buildContentInsertColumnsQuery,
  buildContentPostRowsQuery,
  buildContentRelatedValueRowsByTargetIdsQuery,
  buildContentRelationExistsPredicate,
  buildContentRelationRowsQuery,
  buildContentSingleValuePredicate,
  buildContentTargetValueConflictQuery,
  buildContentTextExpressionPredicate,
  buildContentUpdateColumnByTextIdQuery,
  buildContentUniqueValueLookupQuery,
} from "./adapter/query-builders";
import {
  buildPostsOrderClause,
  buildPostsWhereClause,
  getEntityAvailableColumns,
  getEntityColumnMetadata,
  getEntityIdColumn,
  getEntitySelectableColumns,
  getEntityTableName,
  getMappedContentRuntime,
  getFallbackTimestamp,
  getMappedFieldColumn,
  getMappedFieldPath,
  getMappedFieldTextExpression,
  getMappedFieldValue,
  getMappedPublishedAtColumn,
  getPostStatusFromRow,
  getRelationJunctionTableName,
  getRelationTargetTableName,
  getResolvedEntity,
  getResolvedRelationTargetColumn,
  getRowValue,
  normalizeMappedContentValue,
  parseTableRef,
  quoteIdentifier,
  quoteQualifiedTable,
  resolvePagination,
  toStringArray,
  toText,
  type ContentDatabaseClient,
  type MappedContentBasePostRow,
  type MappedContentRuntime,
} from "./mapped-content-runtime-support";
import {
  createContentPostListPreview,
  slugifyContentValue,
  type ContentPostFieldConflict,
  type ContentPostFieldConflicts,
  type ContentPost,
  type ContentPostsSort,
  type ContentPostsStatusFilter,
} from "./shared";
import {
  normalizeMappedRedirectValues,
} from "./mapped-content-post-redirects";
import {
  areMappedContentColumnsTypeCompatible,
  buildMappedContentArrayPredicate,
} from "./mapped-content-post-predicates";
import {
  dedupeMappedContentRelationValues,
  MAPPED_CONTENT_RELATION_ORDER_COLUMN_CANDIDATES,
  isMappedContentHelperRowRelation,
  isMappedContentJoinTableRelation,
  resolveMappedContentAvailableColumn,
} from "./mapped-content-post-relation-utils";
export {
  normalizeMappedRedirectValues,
  serializeMappedRedirectValues,
} from "./mapped-content-post-redirects";
export {
  getCustomFieldDefaultValue,
} from "./mapped-content-custom-field-defaults";
import { createContentAdapterOperationError } from "./adapter/error-mapping";
import type {
  ContentCustomRelationFieldMapping,
  ContentEntityMapping,
  ContentMappedField,
  ContentRelationMapping,
} from "./mapping";
import { getContentCustomFieldKey } from "./mapping";
import { readContentJoinTableValues } from "./adapter/relation-helpers";
import {
  readContentArrayIndexValue,
  inspectContentOneToOneHelperRowValue,
  readContentForeignRowScalarValue,
  readContentJsonPathValue,
  readContentValueMatchScalarValue,
} from "./adapter/read-helpers";
import {
  buildContentForeignRowScalarWrite,
  buildContentJoinRowUpsertWrite,
  buildContentJoinTableReplaceWrite,
  buildContentPolymorphicJoinReplaceWrite,
  buildContentRelatedRowByPostIdUpsertWrite,
  buildContentValueMatchScalarWrite,
} from "./adapter/write-helpers";

type MappedContentResolvedRelationContext = {
  entityIdColumn: string | null;
  relation: ContentRelationMapping;
  resolvedEntity: ContentEntityMapping;
  targetColumn: string | null;
  targetTableName: string | null;
};

type MappedContentPostRowsLoadResult = {
  authorScopeApplied: boolean;
  rows: Record<string, unknown>[];
};

type MappedContentPostRelations = {
  authorIds: string[];
  categoryIds: string[];
  fieldConflicts: ContentPostFieldConflicts;
  parentPageIds: string[];
  tagIds: string[];
};

type MappedContentRelationValuesResult = {
  conflictsByPostId: Map<string, ContentPostFieldConflict>;
  valuesByPostId: Map<string, string[]>;
};

type MappedContentCustomFieldValuesResult = {
  fieldConflicts: ContentPostFieldConflicts;
  values: Record<string, unknown>;
};

type MappedContentScalarFieldValuesResult = {
  conflictsByPostId: Map<string, ContentPostFieldConflict>;
  valuesByPostId: Map<string, unknown>;
};

type MappedContentQueryablePostsResult = {
  availableColumns: Map<string, string>;
  posts: ContentEntityMapping;
};

const getMappedContentRelationOrderColumn = async ({
  client,
  posts,
  relation,
}: {
  client: ContentDatabaseClient;
  posts: ContentEntityMapping;
  relation: ContentRelationMapping;
}) => {
  if (!relation.junctionTable) {
    return null;
  }

  const parsedJoinTable = parseTableRef(relation.junctionTable, posts.source.schema);

  if (!parsedJoinTable) {
    return null;
  }

  const joinTableEntity = {
    source: {
      primaryKey: relation.junctionSourceColumn?.trim() || null,
      schema: parsedJoinTable.schema,
      table: parsedJoinTable.table,
    },
  } as ContentEntityMapping;
  const availableColumns = await getEntityAvailableColumns({
    client,
    entity: joinTableEntity,
  });
  const reservedColumns = new Set(
    [relation.junctionSourceColumn, relation.junctionTargetColumn]
      .map((columnName) => columnName?.trim().toLowerCase())
      .filter(Boolean),
  );

  for (const candidate of MAPPED_CONTENT_RELATION_ORDER_COLUMN_CANDIDATES) {
    const resolvedColumn = resolveMappedContentAvailableColumn(availableColumns, candidate);

    if (!resolvedColumn || reservedColumns.has(resolvedColumn.toLowerCase())) {
      continue;
    }

    return resolvedColumn;
  }

  return null;
};

const getMappedContentQueryableRelation = (
  availableColumns: Map<string, string>,
  relation: ContentRelationMapping | undefined,
) => {
  if (!relation) {
    return relation;
  }

  return {
    ...relation,
    sourceColumn:
      isMappedContentJoinTableRelation(relation)
        ? relation.sourceColumn
        : resolveMappedContentAvailableColumn(availableColumns, relation.sourceColumn),
  } satisfies ContentRelationMapping;
};

const getMappedContentQueryablePosts = async ({
  client,
  runtime,
}: {
  client: ContentDatabaseClient;
  runtime: MappedContentRuntime;
}): Promise<MappedContentQueryablePostsResult> => {
  const availableColumns = await getEntityAvailableColumns({
    client,
    entity: runtime.posts,
  });
  const queryablePosts = {
    ...runtime.posts,
    fields: Object.fromEntries(
      Object.entries(runtime.posts.fields).map(([fieldKey, field]) => [
        fieldKey,
        {
          ...field,
          column: resolveMappedContentAvailableColumn(availableColumns, field.column),
          sourceRelation: field.sourceRelation
            ? {
                ...field.sourceRelation,
                sourceColumn: resolveMappedContentAvailableColumn(
                  availableColumns,
                  field.sourceRelation.sourceColumn,
                ),
              }
            : field.sourceRelation,
        },
      ]),
    ),
    relations: {
      ...runtime.posts.relations,
      authors: getMappedContentQueryableRelation(availableColumns, runtime.posts.relations.authors),
      categories: getMappedContentQueryableRelation(availableColumns, runtime.posts.relations.categories),
      tags: getMappedContentQueryableRelation(availableColumns, runtime.posts.relations.tags),
    },
    workflow: runtime.posts.workflow
      ? {
          ...runtime.posts.workflow,
          publishedAtColumn: resolveMappedContentAvailableColumn(
            availableColumns,
            runtime.posts.workflow.publishedAtColumn,
          ),
          publishedFlagColumn: resolveMappedContentAvailableColumn(
            availableColumns,
            runtime.posts.workflow.publishedFlagColumn,
          ),
          statusColumn: resolveMappedContentAvailableColumn(
            availableColumns,
            runtime.posts.workflow.statusColumn,
          ),
        }
      : null,
  } satisfies ContentEntityMapping;

  return {
    availableColumns,
    posts: queryablePosts,
  };
};

const buildMappedContentSingleValuePredicate = async ({
  client,
  columnName,
  entity,
  operator,
  paramIndex,
}: {
  client: ContentDatabaseClient;
  columnName: string;
  entity: ContentEntityMapping;
  operator: "=" | "<>";
  paramIndex: number;
}) => {
  const metadata = await getEntityColumnMetadata({
    client,
    columnName,
    entity,
  }).catch(() => null);

  return buildContentSingleValuePredicate({
    columnName,
    operator,
    paramIndex,
    usesNativeComparison: Boolean(metadata),
  });
};

const buildMappedContentPostsWhereClause = async ({
  accessibleAuthorIds = null,
  client,
  queryablePosts,
  runtime,
  search,
  status,
}: {
  accessibleAuthorIds?: string[] | null;
  client: ContentDatabaseClient;
  queryablePosts?: MappedContentQueryablePostsResult;
  runtime: MappedContentRuntime;
  search?: string;
  status?: ContentPostsStatusFilter;
}) => {
  const { posts } =
    queryablePosts ??
    (await getMappedContentQueryablePosts({
      client,
      runtime,
    }));
  const baseWhere = buildPostsWhereClause({
    posts,
    search: search ?? "",
    status: status ?? "all",
  });
  const normalizedAuthorIds =
    accessibleAuthorIds === null
      ? null
      : dedupeMappedContentRelationValues(accessibleAuthorIds);
  const authorRelation = posts.relations.authors;
  const authorFilterClauses: string[] = [];
  const authorFilterParams: unknown[] = [];
  let authorScopeApplied = false;

  if (
    normalizedAuthorIds !== null &&
    authorRelation &&
    authorRelation.status !== "unmapped" &&
    authorRelation.strategy !== "none"
  ) {
    if (!normalizedAuthorIds.length) {
      authorFilterClauses.push("1 = 0");
      authorScopeApplied = true;
    } else if (
      authorRelation.strategy === "foreign_key" ||
      (authorRelation.strategy === "value_match_relation" && authorRelation.sourceColumn)
    ) {
      const sourceColumn = authorRelation.sourceColumn?.trim();

      if (sourceColumn) {
        const sourceColumnMetadata = await getEntityColumnMetadata({
          client,
          columnName: sourceColumn,
          entity: posts,
        });
        const storedAuthorValues = dedupeMappedContentRelationValues(
          await lookupStoredRelationValuesForIds({
            client,
            entity: runtime.authors,
            ids: normalizedAuthorIds,
            posts,
            relation: authorRelation,
          }),
        );

        authorFilterClauses.push(
          storedAuthorValues.length
            ? buildMappedContentArrayPredicate({
                columnExpression: quoteIdentifier(sourceColumn),
                columnMetadata: sourceColumnMetadata,
                paramIndex: baseWhere.params.length + 1,
              })
            : "1 = 0",
        );

        if (storedAuthorValues.length) {
          authorFilterParams.push(storedAuthorValues);
        }

        authorScopeApplied = true;
      }
    } else if (
      isMappedContentJoinTableRelation(authorRelation) ||
      isMappedContentHelperRowRelation(authorRelation) ||
      (authorRelation.strategy === "value_match_relation" && authorRelation.junctionTable)
    ) {
      const joinTableName = getRelationJunctionTableName(authorRelation, posts.source.schema);
      const joinSourceColumn = authorRelation.junctionSourceColumn?.trim();
      const discriminatorColumn =
        authorRelation.strategy === "polymorphic_join"
          ? authorRelation.discriminatorColumn?.trim()
          : null;
      const discriminatorValue =
        authorRelation.strategy === "polymorphic_join"
          ? authorRelation.discriminatorValue?.trim()
          : null;
      const relationValueColumn =
        isMappedContentJoinTableRelation(authorRelation)
          ? authorRelation.junctionTargetColumn?.trim()
          : authorRelation.valueColumn?.trim();
      const postIdColumn = getEntityIdColumn(posts) || posts.source.primaryKey;

      if (
        joinTableName &&
        joinSourceColumn &&
        relationValueColumn &&
        postIdColumn &&
        (authorRelation.strategy !== "polymorphic_join" || (discriminatorColumn && discriminatorValue))
      ) {
        const parsedJoinTable = parseTableRef(authorRelation.junctionTable, posts.source.schema);
        const joinTableEntity = parsedJoinTable
          ? ({
              source: {
                schema: parsedJoinTable.schema,
                table: parsedJoinTable.table,
              },
            } as ContentEntityMapping)
          : null;
        const [joinSourceColumnMetadata, joinTargetColumnMetadata, postIdColumnMetadata] =
          await Promise.all([
            joinTableEntity
              ? getEntityColumnMetadata({
                  client,
                  columnName: joinSourceColumn,
                  entity: joinTableEntity,
                })
              : Promise.resolve(null),
            joinTableEntity
              ? getEntityColumnMetadata({
                  client,
                  columnName: relationValueColumn,
                  entity: joinTableEntity,
                })
              : Promise.resolve(null),
            getEntityColumnMetadata({
              client,
              columnName: postIdColumn,
              entity: posts,
            }),
          ]);
        const storedAuthorValues = dedupeMappedContentRelationValues(
          await lookupStoredRelationValuesForIds({
            client,
            entity: runtime.authors,
            ids: normalizedAuthorIds,
            posts,
            relation: authorRelation,
          }),
        );

        authorFilterClauses.push(
          storedAuthorValues.length
            ? (() => {
                const relationValueParamIndex = baseWhere.params.length + authorFilterParams.length + 1;
                const discriminatorParamIndex = relationValueParamIndex + 1;

                return buildContentRelationExistsPredicate({
                  discriminatorColumn:
                    discriminatorColumn && discriminatorValue ? discriminatorColumn : null,
                  discriminatorParamIndex:
                    discriminatorColumn && discriminatorValue ? discriminatorParamIndex : null,
                  joinSourceColumn,
                  joinTableName,
                  postIdColumn,
                  relationValuePredicate: buildMappedContentArrayPredicate({
                    columnExpression: quoteIdentifier(relationValueColumn),
                    columnMetadata: joinTargetColumnMetadata,
                    paramIndex: relationValueParamIndex,
                  }),
                  sourceUsesNativeComparison: areMappedContentColumnsTypeCompatible({
                    left: joinSourceColumnMetadata,
                    right: postIdColumnMetadata,
                  }),
                });
              })()
            : "1 = 0",
        );

        if (storedAuthorValues.length) {
          authorFilterParams.push(storedAuthorValues);

          if (discriminatorColumn && discriminatorValue) {
            authorFilterParams.push(discriminatorValue);
          }
        }

        authorScopeApplied = true;
      }
    }
  }

  const clauses = [
    baseWhere.clause.replace(/^where\s+/i, "").trim(),
    ...authorFilterClauses,
  ].filter(Boolean);

  return {
    authorScopeApplied,
    clause: clauses.length ? `where ${clauses.map((clause) => `(${clause})`).join(" and ")}` : "",
    params: [...baseWhere.params, ...authorFilterParams],
  };
};

const getMappedContentPostIdFromRow = (
  posts: ContentEntityMapping,
  postRow: MappedContentBasePostRow,
) => {
  const postIdColumn = getEntityIdColumn(posts);
  return toText(getRowValue(postRow, postIdColumn)) ?? "";
};

const getMappedContentResolvedRelationContext = async ({
  client,
  entity,
  posts,
  relation,
}: {
  client: ContentDatabaseClient;
  entity: ContentEntityMapping;
  posts: ContentEntityMapping;
  relation: ContentRelationMapping | undefined;
}): Promise<MappedContentResolvedRelationContext | null> => {
  if (!relation || relation.strategy === "none" || relation.status === "unmapped") {
    return null;
  }

  const entityIdColumnFromMapping = getEntityIdColumn(entity) || entity.source.primaryKey || null;
  const relationTargetColumn = relation.targetColumn?.trim() || null;
  const relationValueColumn = relation.valueColumn?.trim() || null;
  const relationValueColumnCanShortCircuit =
    !isMappedContentHelperRowRelation(relation) && relation.strategy !== "value_match_relation";
  const entitySourceSchema = entity.source.schema?.trim() || null;
  const entitySourceTable = entity.source.table?.trim() || null;
  const parsedRelationTargetTable = relation.targetTable?.trim()
    ? parseTableRef(relation.targetTable, entitySourceSchema || posts.source.schema)
    : null;
  const relationTargetsMappedEntity = Boolean(
    entitySourceSchema &&
      entitySourceTable &&
      (!parsedRelationTargetTable ||
        (
          parsedRelationTargetTable.schema === entitySourceSchema &&
          parsedRelationTargetTable.table === entitySourceTable
        )),
  );

  if (
    entityIdColumnFromMapping &&
    (!relationValueColumn ||
      (relationValueColumnCanShortCircuit && relationValueColumn === entityIdColumnFromMapping)) &&
    (
      !relationTargetColumn ||
      relationTargetColumn === entityIdColumnFromMapping ||
      (relationValueColumnCanShortCircuit && relationValueColumn === entityIdColumnFromMapping)
    )
  ) {
    return {
      entityIdColumn: entityIdColumnFromMapping,
      relation,
      resolvedEntity: entity,
      targetColumn: entityIdColumnFromMapping,
      targetTableName: null,
    };
  }

  if (relationTargetsMappedEntity && relationTargetColumn) {
    return {
      entityIdColumn: entityIdColumnFromMapping,
      relation,
      resolvedEntity: entity,
      targetColumn: relationTargetColumn,
      targetTableName:
        entityIdColumnFromMapping && relationTargetColumn !== entityIdColumnFromMapping
          ? getEntityTableName(entity)
          : null,
    };
  }

  const resolvedEntity = await getResolvedEntity({
    client,
    entity,
    posts,
    relation,
  });
  const entityIdColumn = getEntityIdColumn(resolvedEntity);

  if (
    entityIdColumn &&
    (!relationValueColumn ||
      (relationValueColumnCanShortCircuit && relationValueColumn === entityIdColumn)) &&
    (
      !relationTargetColumn ||
      relationTargetColumn === entityIdColumn ||
      (relationValueColumnCanShortCircuit && relationValueColumn === entityIdColumn)
    )
  ) {
    return {
      entityIdColumn,
      relation,
      resolvedEntity,
      targetColumn: entityIdColumn,
      targetTableName: null,
    };
  }

  const targetColumn = await getResolvedRelationTargetColumn({
    client,
    entity: resolvedEntity,
    posts,
    relation,
  });
  const requiresTargetLookup = Boolean(
    entityIdColumn && targetColumn && targetColumn !== entityIdColumn,
  );

  return {
    entityIdColumn,
    relation,
    resolvedEntity,
    targetColumn,
    targetTableName: requiresTargetLookup
      ? await getRelationTargetTableName({
          client,
          entity: resolvedEntity,
          posts,
          relation,
        })
      : null,
  };
};

const mapMappedContentRelationRawValuesToIds = async ({
  client,
  relationContext,
  values,
}: {
  client: ContentDatabaseClient;
  relationContext: MappedContentResolvedRelationContext;
  values: string[];
}) => {
  const normalizedValues = dedupeMappedContentRelationValues(values);

  if (!normalizedValues.length) {
    return new Map<string, string>();
  }

  const { entityIdColumn, resolvedEntity, targetColumn, targetTableName } = relationContext;

  if (!entityIdColumn || !targetColumn || targetColumn === entityIdColumn || !targetTableName) {
    return new Map(normalizedValues.map((value) => [value, value]));
  }

  const targetColumnMetadata = await getEntityColumnMetadata({
    client,
    columnName: targetColumn,
    entity: resolvedEntity,
  });
  const result = await client.query<{ id: unknown; target_value: unknown }>(
    `
      select
        ${quoteIdentifier(entityIdColumn)} as id,
        ${quoteIdentifier(targetColumn)} as target_value
      from ${targetTableName}
      where ${buildMappedContentArrayPredicate({
        columnExpression: quoteIdentifier(targetColumn),
        columnMetadata: targetColumnMetadata,
        paramIndex: 1,
      })}
    `,
    [normalizedValues],
  );

  return new Map(
    result.rows
      .map((row) => {
        const targetValue = toText(row.target_value);
        const id = toText(row.id);

        return targetValue && id ? [targetValue, id] : null;
      })
      .filter((entry): entry is [string, string] => Boolean(entry)),
  );
};

const getMappedContentRawRelationValuesFromRow = ({
  postRow,
  relationContext,
}: {
  postRow: MappedContentBasePostRow;
  relationContext: MappedContentResolvedRelationContext;
}) => {
  const { entityIdColumn, relation, targetColumn } = relationContext;

  if (relation.strategy === "foreign_key") {
    return dedupeMappedContentRelationValues([toText(getRowValue(postRow, relation.sourceColumn))]);
  }

  if (relation.strategy === "array") {
    return dedupeMappedContentRelationValues(toStringArray(getRowValue(postRow, relation.sourceColumn)));
  }

  if (relation.strategy === "json_array") {
    const rawValue = getRowValue(postRow, relation.sourceColumn);
    const valueColumn = relation.valueColumn || targetColumn || entityIdColumn || "id";

    if (!Array.isArray(rawValue)) {
      return [];
    }

    return dedupeMappedContentRelationValues(
      rawValue.flatMap((entry) =>
        typeof entry === "object" && entry
          ? toStringArray((entry as Record<string, unknown>)[valueColumn])
          : toStringArray(entry),
      ),
    );
  }

  if (relation.strategy === "json_object") {
    const rawValue = getRowValue(postRow, relation.sourceColumn);

    if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
      return [];
    }

    const valueColumn = relation.valueColumn || targetColumn || entityIdColumn || "id";
    return dedupeMappedContentRelationValues(
      toStringArray((rawValue as Record<string, unknown>)[valueColumn]),
    );
  }

  if (relation.strategy === "derived_distinct") {
    return dedupeMappedContentRelationValues(toStringArray(getRowValue(postRow, relation.sourceColumn)));
  }

  if (relation.strategy === "value_match_relation") {
    const rawValue = getRowValue(postRow, relation.sourceColumn);

    return dedupeMappedContentRelationValues(
      relation.multiple ? toStringArray(rawValue) : [toText(rawValue)],
    );
  }

  return [];
};

const collectMappedContentPostListColumns = (posts: ContentEntityMapping) => {
  const columns = new Set<string>();
  const addColumn = (column: string | null | undefined) => {
    const normalizedColumn = column?.trim();

    if (normalizedColumn) {
      columns.add(normalizedColumn);
    }
  };

  addColumn(getEntityIdColumn(posts) || posts.source.primaryKey);
  addColumn(getMappedFieldColumn(posts, "title"));
  addColumn(posts.fields.title?.sourceRelation?.sourceColumn);
  addColumn(getMappedFieldColumn(posts, "excerpt"));
  addColumn(posts.fields.excerpt?.sourceRelation?.sourceColumn);
  addColumn(getMappedFieldColumn(posts, "slug"));
  addColumn(posts.fields.slug?.sourceRelation?.sourceColumn);
  addColumn(getMappedFieldColumn(posts, "createdAt"));
  addColumn(posts.fields.createdAt?.sourceRelation?.sourceColumn);
  addColumn(getMappedFieldColumn(posts, "updatedAt"));
  addColumn(posts.fields.updatedAt?.sourceRelation?.sourceColumn);
  addColumn(getMappedPublishedAtColumn(posts));
  addColumn(posts.workflow?.statusColumn);
  addColumn(posts.workflow?.publishedFlagColumn);

  const authorRelation = posts.relations.authors;
  if (authorRelation && !isMappedContentJoinTableRelation(authorRelation)) {
    addColumn(authorRelation.sourceColumn);
  }

  return [...columns];
};

const collectMappedContentPostRelationSourceColumns = (posts: ContentEntityMapping) => {
  const columns = new Set<string>();
  const addColumn = (column: string | null | undefined) => {
    const normalizedColumn = column?.trim();

    if (normalizedColumn) {
      columns.add(normalizedColumn);
    }
  };

  for (const relation of [
    posts.relations.authors,
    posts.relations.categories,
    posts.relations.tags,
  ]) {
    if (!relation || relation.status === "unmapped" || relation.strategy === "none") {
      continue;
    }

    if (!isMappedContentJoinTableRelation(relation)) {
      addColumn(relation.sourceColumn);
    }
  }

  for (const relationField of posts.customRelationFields ?? []) {
    if (!relationField.enabled) {
      continue;
    }

    const relation = relationField.relation;

    if (!relation || relation.status === "unmapped" || relation.strategy === "none") {
      continue;
    }

    if (!isMappedContentJoinTableRelation(relation)) {
      addColumn(relation.sourceColumn);
    }
  }

  return [...columns];
};

const collectMappedContentPostEditorColumns = (posts: ContentEntityMapping) => {
  const columns = new Set<string>(collectMappedContentPostListColumns(posts));
  const addColumn = (column: string | null | undefined) => {
    const normalizedColumn = column?.trim();

    if (normalizedColumn) {
      columns.add(normalizedColumn);
    }
  };

  addColumn(getMappedFieldColumn(posts, "focusKeyword"));
  addColumn(posts.fields.focusKeyword?.sourceRelation?.sourceColumn);
  addColumn(getMappedFieldColumn(posts, "featuredImageUrl"));
  addColumn(posts.fields.featuredImageUrl?.sourceRelation?.sourceColumn);
  addColumn(getMappedFieldColumn(posts, "redirects"));
  addColumn(posts.fields.redirects?.sourceRelation?.sourceColumn);
  addColumn(getMappedFieldColumn(posts, "seoDescription"));
  addColumn(posts.fields.seoDescription?.sourceRelation?.sourceColumn);
  addColumn(getMappedFieldColumn(posts, "seoTitle"));
  addColumn(posts.fields.seoTitle?.sourceRelation?.sourceColumn);

  for (const editorField of posts.editorFields) {
    addColumn(editorField.column);
  }

  for (const customField of posts.customFields) {
    if (customField.enabled) {
      addColumn(customField.sourceRelation ? customField.sourceRelation.sourceColumn : customField.column);
    }
  }

  for (const relationSourceColumn of collectMappedContentPostRelationSourceColumns(posts)) {
    addColumn(relationSourceColumn);
  }

  return [...columns];
};

export const buildMappedContentPostListSelectClause = (posts: ContentEntityMapping) =>
  collectMappedContentPostListColumns(posts)
    .map((column) => quoteIdentifier(column))
    .join(", ");

export const buildMappedContentPostEditorSelectClause = (posts: ContentEntityMapping) =>
  collectMappedContentPostEditorColumns(posts)
    .map((column) => quoteIdentifier(column))
    .join(", ");

const buildMappedContentPostListSelectClauseSafely = async ({
  client,
  queryablePosts,
  runtime,
}: {
  client: ContentDatabaseClient;
  queryablePosts?: MappedContentQueryablePostsResult;
  runtime: MappedContentRuntime;
}) => {
  const queryablePostsResult =
    queryablePosts ??
    (await getMappedContentQueryablePosts({
      client,
      runtime,
    }));
  const requestedColumns = collectMappedContentPostListColumns(queryablePostsResult.posts);
  const selectableColumns = await getEntitySelectableColumns({
    client,
    entity: runtime.posts,
    requestedColumns,
  });

  return selectableColumns.length
    ? selectableColumns.map((column) => quoteIdentifier(column)).join(", ")
    : "*";
};

export const loadMappedContentPostRows = async ({
  accessibleAuthorIds = null,
  client,
  runtime,
  search,
  sort,
  status,
}: {
  accessibleAuthorIds?: string[] | null;
  client: ContentDatabaseClient;
  runtime: MappedContentRuntime;
  search?: string;
  sort?: ContentPostsSort;
  status?: ContentPostsStatusFilter;
}): Promise<MappedContentPostRowsLoadResult> => {
  const tableName = getEntityTableName(runtime.posts);
  const queryablePosts = await getMappedContentQueryablePosts({
    client,
    runtime,
  });
  const where = await buildMappedContentPostsWhereClause({
    accessibleAuthorIds,
    client,
    queryablePosts,
    runtime,
    search,
    status,
  });
  const orderClause = buildPostsOrderClause(queryablePosts.posts, sort ?? "updated_desc");
  const selectClause = await buildMappedContentPostListSelectClauseSafely({
    client,
    queryablePosts,
    runtime,
  });
  const result = await client.query<Record<string, unknown>>(
    buildContentPostRowsQuery({
      orderClause,
      selectClause,
      tableName,
      whereClause: where.clause,
    }),
    where.params,
  );

  return {
    authorScopeApplied: where.authorScopeApplied,
    rows: result.rows,
  };
};

export const searchMappedContentParentPages = async ({
  accessibleAuthorIds = null,
  client,
  limit = 100,
  mapping,
  search,
  selectedIds,
}: {
  accessibleAuthorIds?: string[] | null;
  client: ContentDatabaseClient;
  limit?: number;
  mapping: import("./mapping").ContentProjectMapping;
  search: string;
  selectedIds?: string[];
}): Promise<Array<Pick<ContentPost, "id" | "slug" | "title">>> => {
  const runtime = getMappedContentRuntime(mapping);
  const normalizedLimit = Math.max(1, limit);
  const normalizedSelectedIds = [
    ...new Set((selectedIds ?? []).map((value) => value.trim()).filter(Boolean)),
  ].slice(0, 250);
  const rows = (
    await loadMappedContentPostRowsPage({
      accessibleAuthorIds,
      client,
      page: 1,
      pageSize: normalizedLimit,
      runtime,
      search,
      sort: "title_asc",
      status: "all",
      totalItems: normalizedLimit,
    })
  ).rows;
  const idColumn = getEntityIdColumn(runtime.posts) || runtime.posts.source.primaryKey;
  const selectedRows =
    normalizedSelectedIds.length && idColumn && accessibleAuthorIds === null
      ? (
          await client.query<Record<string, unknown>>(
            `
              select ${buildMappedContentPostListSelectClause(runtime.posts)}
              from ${getEntityTableName(runtime.posts)}
              where ${quoteIdentifier(idColumn)}::text = any($1::text[])
              limit $2
            `,
            [normalizedSelectedIds, normalizedSelectedIds.length],
          )
        ).rows
      : [];
  const mergedRows = [...selectedRows, ...rows].filter((row, index, sourceRows) => {
    const postId = getMappedContentPostIdFromRow(runtime.posts, row);
    return postId && sourceRows.findIndex((sourceRow) => getMappedContentPostIdFromRow(runtime.posts, sourceRow) === postId) === index;
  });
  const [titleResult, slugResult] = await Promise.all([
    getMappedScalarFieldValuesForPosts({
      client,
      fieldKey: "title",
      postRows: mergedRows,
      posts: runtime.posts,
    }),
    getMappedScalarFieldValuesForPosts({
      client,
      fieldKey: "slug",
      postRows: mergedRows,
      posts: runtime.posts,
    }),
  ]);

  return mergedRows.map((row) => {
    const postId = getMappedContentPostIdFromRow(runtime.posts, row);
    const title = toText(getMappedScalarFieldValueFromResult({ postId, result: titleResult })) ?? "";
    const generatedSlug = slugifyContentValue(title || postId) || postId;

    return {
      id: postId,
      slug: toText(getMappedScalarFieldValueFromResult({ postId, result: slugResult })) ?? generatedSlug,
      title,
    };
  });
};

const mergeContentPostFieldConflicts = (
  ...sources: Array<ContentPostFieldConflicts | null | undefined>
) => {
  const mergedEntries = sources.flatMap((source) => Object.entries(source ?? {}));
  return mergedEntries.length ? Object.fromEntries(mergedEntries) : {};
};

const getMappedRelationValuesResultForPosts = async ({
  client,
  entity,
  postRows,
  posts,
  relation,
}: {
  client: ContentDatabaseClient;
  entity: ContentEntityMapping;
  postRows: MappedContentBasePostRow[];
  posts: ContentEntityMapping;
  relation: ContentRelationMapping | undefined;
}): Promise<MappedContentRelationValuesResult> => {
  const postRowsWithIds = postRows
    .map((postRow) => ({
      postId: getMappedContentPostIdFromRow(posts, postRow),
      postRow,
    }))
    .filter(({ postId }) => Boolean(postId));
  const valuesByPostId = new Map<string, string[]>(
    postRowsWithIds.map(({ postId }) => [postId, []]),
  );
  const conflictsByPostId = new Map<string, ContentPostFieldConflict>();

  if (!postRowsWithIds.length) {
    return {
      conflictsByPostId,
      valuesByPostId,
    };
  }

  const entityIdColumn = getEntityIdColumn(entity) || entity.source.primaryKey || null;
  const normalizedTargetColumn = relation?.targetColumn?.trim() || entityIdColumn;

  if (
    relation &&
    !isMappedContentJoinTableRelation(relation) &&
    !isMappedContentHelperRowRelation(relation) &&
    !(relation.strategy === "value_match_relation" && relation.junctionTable) &&
    relation.status !== "unmapped" &&
    entityIdColumn &&
    normalizedTargetColumn === entityIdColumn
  ) {
    const fastPathRelationContext: MappedContentResolvedRelationContext = {
      entityIdColumn,
      relation,
      resolvedEntity: entity,
      targetColumn: normalizedTargetColumn,
      targetTableName: null,
    };

    for (const { postId, postRow } of postRowsWithIds) {
      valuesByPostId.set(
        postId,
        getMappedContentRawRelationValuesFromRow({
          postRow,
          relationContext: fastPathRelationContext,
        }),
      );
    }

    return {
      conflictsByPostId,
      valuesByPostId,
    };
  }

  const relationContext = await getMappedContentResolvedRelationContext({
    client,
    entity,
    posts,
    relation,
  });

  if (!relationContext) {
    return {
      conflictsByPostId,
      valuesByPostId,
    };
  }

  if (
    isMappedContentJoinTableRelation(relationContext.relation) ||
    isMappedContentHelperRowRelation(relationContext.relation) ||
    (relationContext.relation.strategy === "value_match_relation" &&
      relationContext.relation.junctionTable)
  ) {
    const joinTableName = getRelationJunctionTableName(relationContext.relation, posts.source.schema);
    const joinSourceColumn = relationContext.relation.junctionSourceColumn?.trim();
    const discriminatorColumn =
      relationContext.relation.strategy === "polymorphic_join"
        ? relationContext.relation.discriminatorColumn?.trim()
        : null;
    const discriminatorValue =
      relationContext.relation.strategy === "polymorphic_join"
        ? relationContext.relation.discriminatorValue?.trim()
        : null;
    const relationValueColumn =
      isMappedContentJoinTableRelation(relationContext.relation)
        ? relationContext.relation.junctionTargetColumn?.trim()
        : relationContext.relation.valueColumn?.trim();

    if (
      !joinTableName ||
      !joinSourceColumn ||
      !relationValueColumn ||
      (relationContext.relation.strategy === "polymorphic_join" && (!discriminatorColumn || !discriminatorValue))
    ) {
      return {
        conflictsByPostId,
        valuesByPostId,
      };
    }

    const parsedJoinTable = parseTableRef(relationContext.relation.junctionTable, posts.source.schema);
    const joinTableEntity = parsedJoinTable
      ? ({
          source: {
            schema: parsedJoinTable.schema,
            table: parsedJoinTable.table,
          },
        } as ContentEntityMapping)
      : null;
    const joinSourceColumnMetadata = joinTableEntity
      ? await getEntityColumnMetadata({
          client,
          columnName: joinSourceColumn,
          entity: joinTableEntity,
        })
      : null;
    const relationOrderColumn = await getMappedContentRelationOrderColumn({
      client,
      posts,
      relation: relationContext.relation,
    });
    const postIds = postRowsWithIds.map(({ postId }) => postId);
    const joinQueryParams: unknown[] = [postIds];

    if (discriminatorColumn && discriminatorValue) {
      joinQueryParams.push(discriminatorValue);
    }
    const joinResult = await client.query<Record<string, unknown>>(
      buildContentRelationRowsQuery({
        discriminatorColumn: discriminatorColumn && discriminatorValue ? discriminatorColumn : null,
        joinSourceColumn,
        joinSourcePredicate: buildMappedContentArrayPredicate({
          columnExpression: quoteIdentifier(joinSourceColumn),
          columnMetadata: joinSourceColumnMetadata,
          paramIndex: 1,
        }),
        joinTableName,
        relationOrderColumn,
        relationValueColumn,
      }),
      joinQueryParams,
    );
    const rawValueToId = await mapMappedContentRelationRawValuesToIds({
      client,
      relationContext,
      values: joinResult.rows.map((row) => toText(row.related_value)).filter(Boolean) as string[],
    });

    for (const postId of postIds) {
      const helperRowInspection =
        !isMappedContentJoinTableRelation(relationContext.relation) &&
        !(relationContext.relation.strategy === "value_match_relation" && relationContext.relation.multiple)
          ? inspectContentOneToOneHelperRowValue({
              helperRows: joinResult.rows,
              orderColumn: relationOrderColumn,
              postId,
              postIdColumn: "post_id",
              valueColumn: "related_value",
            })
          : null;
      const rawValues =
        isMappedContentJoinTableRelation(relationContext.relation) ||
        (relationContext.relation.strategy === "value_match_relation" &&
          relationContext.relation.multiple)
          ? readContentJoinTableValues({
              joinRows: joinResult.rows,
              orderColumn: relationOrderColumn,
              postId,
              sourceColumn: "post_id",
              targetColumn: "related_value",
            }).slice(0, relationContext.relation.multiple ? undefined : 1)
          : (() => {
              const rawValue = helperRowInspection?.value;

              return rawValue === undefined || rawValue === null ? [] : [toText(rawValue) ?? ""];
            })();
      valuesByPostId.set(
        postId,
        dedupeMappedContentRelationValues(rawValues.map((value) => rawValueToId.get(value) ?? value)),
      );

      if (helperRowInspection?.ambiguous) {
        conflictsByPostId.set(postId, {
          code: "helper_row_ambiguity",
          helperRowCount: helperRowInspection.helperRowCount,
          values: dedupeMappedContentRelationValues(
            helperRowInspection.matchedValues.map((value) => rawValueToId.get(value) ?? value),
          ),
        });
      }
    }

    return {
      conflictsByPostId,
      valuesByPostId,
    };
  }

  const rawValuesByPostId = new Map<string, string[]>();

  for (const { postId, postRow } of postRowsWithIds) {
    rawValuesByPostId.set(
      postId,
      getMappedContentRawRelationValuesFromRow({
        postRow,
        relationContext,
      }),
    );
  }

  const rawValueToId = await mapMappedContentRelationRawValuesToIds({
    client,
    relationContext,
    values: [...rawValuesByPostId.values()].flat(),
  });

  for (const { postId } of postRowsWithIds) {
    const rawValues = rawValuesByPostId.get(postId) ?? [];
    valuesByPostId.set(
      postId,
      dedupeMappedContentRelationValues(rawValues.map((value) => rawValueToId.get(value) ?? value)),
    );
  }

  return {
    conflictsByPostId,
    valuesByPostId,
  };
};

export const getMappedRelationValuesForPosts = async ({
  client,
  entity,
  postRows,
  posts,
  relation,
}: {
  client: ContentDatabaseClient;
  entity: ContentEntityMapping;
  postRows: MappedContentBasePostRow[];
  posts: ContentEntityMapping;
  relation: ContentRelationMapping | undefined;
}) => {
  const result = await getMappedRelationValuesResultForPosts({
    client,
    entity,
    postRows,
    posts,
    relation,
  });

  return result.valuesByPostId;
};

const getMappedPostRelationsForRow = async ({
  client,
  postRow,
  runtime,
}: {
  client: ContentDatabaseClient;
  postRow: MappedContentBasePostRow;
  runtime: MappedContentRuntime;
}): Promise<MappedContentPostRelations> => {
  const posts = runtime.posts;
  const postIdColumn = getEntityIdColumn(posts);
  const postId = toText(getRowValue(postRow, postIdColumn)) ?? "";
  const [authorResult, categoryResult, parentPageResult, tagResult] = await Promise.all([
    getMappedRelationValuesResultForPosts({
      client,
      entity: runtime.authors,
      postRows: [postRow],
      posts,
      relation: posts.relations.authors,
    }),
    getMappedRelationValuesResultForPosts({
      client,
      entity: runtime.categories,
      postRows: [postRow],
      posts,
      relation: posts.relations.categories,
    }),
    getMappedRelationValuesResultForPosts({
      client,
      entity: runtime.posts,
      postRows: [postRow],
      posts,
      relation: posts.relations.posts,
    }),
    getMappedRelationValuesResultForPosts({
      client,
      entity: runtime.tags,
      postRows: [postRow],
      posts,
      relation: posts.relations.tags,
    }),
  ]);

  return {
    authorIds: authorResult.valuesByPostId.get(postId) ?? authorResult.valuesByPostId.values().next().value ?? [],
    categoryIds:
      categoryResult.valuesByPostId.get(postId) ?? categoryResult.valuesByPostId.values().next().value ?? [],
    fieldConflicts: mergeContentPostFieldConflicts(
      authorResult.conflictsByPostId.has(postId)
        ? { author: authorResult.conflictsByPostId.get(postId)! }
        : null,
      parentPageResult.conflictsByPostId.has(postId)
        ? { parentPage: parentPageResult.conflictsByPostId.get(postId)! }
        : null,
    ),
    parentPageIds:
      parentPageResult.valuesByPostId.get(postId) ?? parentPageResult.valuesByPostId.values().next().value ?? [],
    tagIds: tagResult.valuesByPostId.get(postId) ?? tagResult.valuesByPostId.values().next().value ?? [],
  };
};

const buildMappedContentScalarHelperRowConflict = (input: {
  fieldKey: string;
  helperRowCount: number;
  values: string[];
}): ContentPostFieldConflict => ({
  code: "helper_row_ambiguity",
  helperRowCount: input.helperRowCount,
  values: input.values,
});

const getMappedContentScalarFieldSourceRelation = (
  field: ContentMappedField | undefined,
) => field?.sourceRelation ?? null;

export const getMappedScalarFieldValuesForPosts = async ({
  client,
  field,
  fieldKey,
  postRows,
  posts,
}: {
  client: ContentDatabaseClient;
  field?: ContentMappedField;
  fieldKey: string;
  postRows: MappedContentBasePostRow[];
  posts: ContentEntityMapping;
}): Promise<MappedContentScalarFieldValuesResult> => {
  const valuesByPostId = new Map<string, unknown>();
  const conflictsByPostId = new Map<string, ContentPostFieldConflict>();
  const resolvedField = field ?? posts.fields[fieldKey];

  if (!resolvedField || !postRows.length) {
    return {
      conflictsByPostId,
      valuesByPostId,
    };
  }

  const sourceRelation = getMappedContentScalarFieldSourceRelation(resolvedField);

  if (!sourceRelation) {
    for (const postRow of postRows) {
      valuesByPostId.set(
        getMappedContentPostIdFromRow(posts, postRow),
        field
          ? resolvedField.path && resolvedField.column
            ? readContentJsonPathValue({
                column: resolvedField.column,
                path: resolvedField.path,
                row: postRow,
              })
            : resolvedField.column &&
                Number.isInteger(resolvedField.arrayIndex) &&
                Number(resolvedField.arrayIndex) >= 0
              ? readContentArrayIndexValue({
                  column: resolvedField.column,
                  index: Number(resolvedField.arrayIndex),
                  row: postRow,
                })
              : resolvedField.column
                ? getRowValue(postRow, resolvedField.column)
                : null
          : getMappedFieldValue(postRow, posts, fieldKey),
      );
    }

    return {
      conflictsByPostId,
      valuesByPostId,
    };
  }

  if (sourceRelation.strategy === "inline_fields") {
    for (const postRow of postRows) {
      valuesByPostId.set(
        getMappedContentPostIdFromRow(posts, postRow),
        field
          ? resolvedField.path && resolvedField.column
            ? readContentJsonPathValue({
                column: resolvedField.column,
                path: resolvedField.path,
                row: postRow,
              })
            : resolvedField.column &&
                Number.isInteger(resolvedField.arrayIndex) &&
                Number(resolvedField.arrayIndex) >= 0
              ? readContentArrayIndexValue({
                  column: resolvedField.column,
                  index: Number(resolvedField.arrayIndex),
                  row: postRow,
                })
              : resolvedField.column
                ? getRowValue(postRow, resolvedField.column)
                : null
          : getMappedFieldValue(postRow, posts, fieldKey),
      );
    }

    return {
      conflictsByPostId,
      valuesByPostId,
    };
  }

  if (
    sourceRelation.strategy === "foreign_key" ||
    sourceRelation.strategy === "value_match_relation"
  ) {
    const sourceColumn = sourceRelation.sourceColumn?.trim();
    const targetColumn = sourceRelation.targetColumn?.trim();
    const targetTable = sourceRelation.targetTable?.trim();
    const valueColumn = sourceRelation.valueColumn?.trim();
    const parsedTargetTable = parseTableRef(targetTable, posts.source.schema);

    if (!sourceColumn || !targetColumn || !valueColumn || !parsedTargetTable) {
      return {
        conflictsByPostId,
        valuesByPostId,
      };
    }

    const lookupValues = dedupeMappedContentRelationValues(
      postRows.map((postRow) => toText(getRowValue(postRow, sourceColumn))),
    );
    const targetRows =
      lookupValues.length > 0
        ? (
            await client.query<Record<string, unknown>>(
              buildContentRelatedValueRowsByTargetIdsQuery({
                tableName: quoteQualifiedTable(parsedTargetTable.schema, parsedTargetTable.table),
                targetColumn,
                valueColumn,
              }),
              [lookupValues],
            )
          ).rows
        : [];

    for (const postRow of postRows) {
      const postId = getMappedContentPostIdFromRow(posts, postRow);
      const value =
        sourceRelation.strategy === "foreign_key"
          ? readContentForeignRowScalarValue({
              row: postRow,
              sourceColumn,
              targetColumn,
              targetRows,
              valueColumn,
            })
          : readContentValueMatchScalarValue({
              sourceValue: getRowValue(postRow, sourceColumn),
              targetColumn,
              targetRows,
              valueColumn,
            });
      valuesByPostId.set(postId, value);
    }

    return {
      conflictsByPostId,
      valuesByPostId,
    };
  }

  if (
    sourceRelation.strategy === "related_row_by_post_id" ||
    sourceRelation.strategy === "join_row"
  ) {
    const helperPostIdColumn = sourceRelation.junctionSourceColumn?.trim();
    const helperTable = sourceRelation.junctionTable?.trim();
    const helperValueColumn = sourceRelation.valueColumn?.trim();
    const parsedHelperTable = parseTableRef(helperTable, posts.source.schema);
    const postIds = dedupeMappedContentRelationValues(
      postRows.map((postRow) => getMappedContentPostIdFromRow(posts, postRow)),
    );

    if (!helperPostIdColumn || !helperValueColumn || !parsedHelperTable || !postIds.length) {
      return {
        conflictsByPostId,
        valuesByPostId,
      };
    }

    const helperRows = (
      await client.query<Record<string, unknown>>(
        buildContentHelperRowsForPostIdsQuery({
          helperPostIdColumn,
          helperTableName: quoteQualifiedTable(parsedHelperTable.schema, parsedHelperTable.table),
          helperValueColumn,
        }),
        [postIds],
      )
    ).rows;

    for (const postId of postIds) {
      const inspection = inspectContentOneToOneHelperRowValue({
        helperRows,
        postId,
        postIdColumn: "post_id",
        valueColumn: "related_value",
      });

      valuesByPostId.set(postId, inspection.value ?? null);

      if (inspection.ambiguous) {
        conflictsByPostId.set(
          postId,
          buildMappedContentScalarHelperRowConflict({
            fieldKey,
            helperRowCount: inspection.helperRowCount,
            values: inspection.matchedValues,
          }),
        );
      }
    }

    return {
      conflictsByPostId,
      valuesByPostId,
    };
  }

  return {
    conflictsByPostId,
    valuesByPostId,
  };
};

const getMappedScalarFieldValueFromResult = ({
  postId,
  result,
}: {
  postId: string;
  result: MappedContentScalarFieldValuesResult;
}) => result.valuesByPostId.get(postId) ?? null;

const getMappedEditorFieldDirectValue = ({
  editorField,
  row,
}: {
  editorField: ContentEntityMapping["editorFields"][number];
  row: MappedContentBasePostRow;
}) => {
  if (!editorField.column) {
    return null;
  }

  if (editorField.path) {
    return readContentJsonPathValue({
      column: editorField.column,
      path: editorField.path,
      row,
    });
  }

  if (Number.isInteger(editorField.arrayIndex) && Number(editorField.arrayIndex) >= 0) {
    return readContentArrayIndexValue({
      column: editorField.column,
      index: Number(editorField.arrayIndex),
      row,
    });
  }

  return getRowValue(row, editorField.column);
};

const getMappedEditorFieldValueResult = async ({
  client,
  editorField,
  postId,
  posts,
  row,
}: {
  client: ContentDatabaseClient;
  editorField: ContentEntityMapping["editorFields"][number];
  postId: string;
  posts: ContentEntityMapping;
  row: MappedContentBasePostRow;
}) => {
  const sourceRelation = editorField.sourceRelation ?? null;

  if (!sourceRelation || sourceRelation.strategy === "inline_fields") {
    return {
      conflict: null,
      value: getMappedEditorFieldDirectValue({
        editorField,
        row,
      }),
    };
  }

  if (
    sourceRelation.strategy === "related_row_by_post_id" ||
    sourceRelation.strategy === "join_row"
  ) {
    const helperPostIdColumn = sourceRelation.junctionSourceColumn?.trim();
    const helperTable = sourceRelation.junctionTable?.trim();
    const helperValueColumn = sourceRelation.valueColumn?.trim();
    const parsedHelperTable = parseTableRef(helperTable, posts.source.schema);

    if (!helperPostIdColumn || !helperValueColumn || !parsedHelperTable) {
      return {
        conflict: null,
        value: null,
      };
    }

    const helperRowsResult = await client.query<Record<string, unknown>>(
      buildContentHelperRowsForPostIdQuery({
        helperPostIdColumn,
        helperTableName: quoteQualifiedTable(parsedHelperTable.schema, parsedHelperTable.table),
        helperValueColumn,
      }),
      [postId],
    );
    const inspection = inspectContentOneToOneHelperRowValue({
      helperRows: helperRowsResult.rows,
      postId,
      postIdColumn: "post_id",
      valueColumn: "related_value",
    });

    return {
      conflict: inspection.ambiguous
        ? buildMappedContentScalarHelperRowConflict({
            fieldKey: editorField.id,
            helperRowCount: inspection.helperRowCount,
            values: inspection.matchedValues,
          })
        : null,
      value: inspection.value ?? null,
    };
  }

  return {
    conflict: null,
    value: null,
  };
};

const buildCustomScalarFieldValues = async ({
  client,
  row,
  posts,
}: {
  client: ContentDatabaseClient;
  row: MappedContentBasePostRow;
  posts: ContentEntityMapping;
}): Promise<MappedContentCustomFieldValuesResult> => {
  const values: Record<string, unknown> = {};
  const fieldConflicts: ContentPostFieldConflicts = {};
  const postId = getMappedContentPostIdFromRow(posts, row);

  for (const cf of posts.customFields) {
    if (!cf.enabled) {
      continue;
    }

    const fieldKey = getContentCustomFieldKey(cf);
    const syntheticField: ContentMappedField = {
      arrayIndex:
        Number.isInteger(cf.arrayIndex) && Number(cf.arrayIndex) >= 0 ? Number(cf.arrayIndex) : null,
      column: cf.column?.trim() || null,
      kind: cf.kind,
      label: cf.label,
      path: cf.path?.trim() || null,
      required: !cf.isNullable,
      ...(cf.sourceRelation ? { sourceRelation: cf.sourceRelation } : {}),
      visible: cf.enabled,
    };
    const result = await getMappedScalarFieldValuesForPosts({
      client,
      field: syntheticField,
      fieldKey,
      postRows: [row],
      posts,
    });

    values[fieldKey] = getMappedScalarFieldValueFromResult({
      postId,
      result,
    });

    if (result.conflictsByPostId.has(postId)) {
      fieldConflicts[fieldKey] = result.conflictsByPostId.get(postId)!;
    }
  }

  return {
    fieldConflicts,
    values,
  };
};

const normalizeCustomRelationFieldValue = ({
  field,
  values,
}: {
  field: ContentCustomRelationFieldMapping;
  values: string[];
}) => (field.relation.multiple ? values : values[0] ?? null);

export const buildCustomFieldValues = async ({
  client,
  row,
  posts,
  runtime,
}: {
  client: ContentDatabaseClient;
  row: MappedContentBasePostRow;
  posts: ContentEntityMapping;
  runtime: MappedContentRuntime;
}): Promise<MappedContentCustomFieldValuesResult> => {
  const {
    fieldConflicts,
    values,
  } = await buildCustomScalarFieldValues({
    client,
    row,
    posts,
  });

  for (const relationField of posts.customRelationFields ?? []) {
    if (!relationField.enabled) {
      continue;
    }

    const targetEntityKey = relationField.relation.targetEntity;
    const targetEntity =
      targetEntityKey === "authors"
        ? runtime.authors
        : targetEntityKey === "categories"
          ? runtime.categories
          : targetEntityKey === "files"
            ? runtime.files
          : targetEntityKey === "tags"
            ? runtime.tags
            : targetEntityKey === "posts"
              ? runtime.posts
              : targetEntityKey === "media"
                ? runtime.media
                : null;

    if (!targetEntity) {
      continue;
    }

    const relationResult = await getMappedRelationValuesResultForPosts({
      client,
      entity: targetEntity,
      postRows: [row],
      posts,
      relation: relationField.relation,
    });
    const postId = getMappedContentPostIdFromRow(posts, row);
    const resolvedValues = relationResult.valuesByPostId.get(postId) ?? [];

    values[relationField.fieldKey] = normalizeCustomRelationFieldValue({
      field: relationField,
      values: resolvedValues,
    });

    if (!relationField.relation.multiple && relationResult.conflictsByPostId.has(postId)) {
      fieldConflicts[relationField.fieldKey] = relationResult.conflictsByPostId.get(postId)!;
    }
  }

  return {
    fieldConflicts,
    values,
  };
};

export const mapMappedContentPostRow = async ({
  client,
  postRow,
  runtime,
}: {
  client: ContentDatabaseClient;
  postRow: MappedContentBasePostRow;
  runtime: MappedContentRuntime;
}): Promise<ContentPost> => {
  const posts = runtime.posts;
  const postIdColumn = getEntityIdColumn(posts);
  const postId = toText(getRowValue(postRow, postIdColumn)) ?? "";
  const [
    createdAtResult,
    excerptResult,
    featuredImageResult,
    focusKeywordResult,
    redirectsResult,
    seoDescriptionResult,
    seoTitleResult,
    slugResult,
    titleResult,
    updatedAtResult,
  ] = await Promise.all([
    getMappedScalarFieldValuesForPosts({ client, fieldKey: "createdAt", postRows: [postRow], posts }),
    getMappedScalarFieldValuesForPosts({ client, fieldKey: "excerpt", postRows: [postRow], posts }),
    getMappedScalarFieldValuesForPosts({ client, fieldKey: "featuredImageUrl", postRows: [postRow], posts }),
    getMappedScalarFieldValuesForPosts({ client, fieldKey: "focusKeyword", postRows: [postRow], posts }),
    getMappedScalarFieldValuesForPosts({ client, fieldKey: "redirects", postRows: [postRow], posts }),
    getMappedScalarFieldValuesForPosts({ client, fieldKey: "seoDescription", postRows: [postRow], posts }),
    getMappedScalarFieldValuesForPosts({ client, fieldKey: "seoTitle", postRows: [postRow], posts }),
    getMappedScalarFieldValuesForPosts({ client, fieldKey: "slug", postRows: [postRow], posts }),
    getMappedScalarFieldValuesForPosts({ client, fieldKey: "title", postRows: [postRow], posts }),
    getMappedScalarFieldValuesForPosts({ client, fieldKey: "updatedAt", postRows: [postRow], posts }),
  ]);
  const title = toText(getMappedScalarFieldValueFromResult({ postId, result: titleResult })) ?? "";
  const excerpt = toText(getMappedScalarFieldValueFromResult({ postId, result: excerptResult }));
  const createdAt =
    toText(getMappedScalarFieldValueFromResult({ postId, result: createdAtResult })) ?? getFallbackTimestamp(postRow);
  const updatedAt =
    toText(getMappedScalarFieldValueFromResult({ postId, result: updatedAtResult })) ??
    toText(getMappedScalarFieldValueFromResult({ postId, result: createdAtResult })) ??
    getFallbackTimestamp(postRow);
  const publishedAt = toText(getRowValue(postRow, getMappedPublishedAtColumn(posts)));
  const visibleEditorFields = posts.editorFields.filter(
    (editorField) => editorField.visible && (editorField.column || editorField.sourceRelation),
  );
  const contentFieldResults = await Promise.all(
    visibleEditorFields.map(async (editorField) => [
      editorField.id,
      await getMappedEditorFieldValueResult({
        client,
        editorField,
        postId,
        posts,
        row: postRow,
      }),
    ] as const),
  );
  const contentFieldResultMap = new Map(contentFieldResults);
  const contentField = visibleEditorFields[0];
  const primaryContentValue = contentField
    ? contentFieldResultMap.get(contentField.id)?.value ?? null
    : "";
  const normalizedContent = normalizeMappedContentValue({
    kind: contentField?.kind ?? "html",
    value: primaryContentValue,
  });
  const contentFields: Record<string, { contentHtml: string; contentJson: Record<string, unknown> }> = {};
  const contentFieldConflicts: ContentPostFieldConflicts = {};
  for (const editorField of visibleEditorFields) {
    const fieldResult = contentFieldResultMap.get(editorField.id);
    const fieldContent = normalizeMappedContentValue({
      kind: editorField.kind ?? "html",
      value: fieldResult?.value ?? null,
    });
    contentFields[editorField.id] = {
      contentHtml: fieldContent.contentHtml,
      contentJson: fieldContent.contentJson,
    };
    if (fieldResult?.conflict) {
      contentFieldConflicts[editorField.id] = fieldResult.conflict;
    }
  }
  const generatedSlug = slugifyContentValue(title || postId) || postId;
  const { authorIds, categoryIds, fieldConflicts, parentPageIds, tagIds } = await getMappedPostRelationsForRow({
    client,
    postRow,
    runtime,
  });
  const customFieldValues = await buildCustomFieldValues({
    client,
    posts,
    row: postRow,
    runtime,
  });
  const scalarFieldConflicts = mergeContentPostFieldConflicts(
    excerptResult.conflictsByPostId.has(postId)
      ? { excerpt: excerptResult.conflictsByPostId.get(postId)! }
      : null,
    featuredImageResult.conflictsByPostId.has(postId)
      ? { featuredImageUrl: featuredImageResult.conflictsByPostId.get(postId)! }
      : null,
    focusKeywordResult.conflictsByPostId.has(postId)
      ? { focusKeyword: focusKeywordResult.conflictsByPostId.get(postId)! }
      : null,
    seoDescriptionResult.conflictsByPostId.has(postId)
      ? { seoDescription: seoDescriptionResult.conflictsByPostId.get(postId)! }
      : null,
    seoTitleResult.conflictsByPostId.has(postId)
      ? { seoTitle: seoTitleResult.conflictsByPostId.get(postId)! }
      : null,
    slugResult.conflictsByPostId.has(postId)
      ? { slug: slugResult.conflictsByPostId.get(postId)! }
      : null,
    titleResult.conflictsByPostId.has(postId)
      ? { title: titleResult.conflictsByPostId.get(postId)! }
      : null,
  );
  const mergedFieldConflicts = mergeContentPostFieldConflicts(
    fieldConflicts,
    scalarFieldConflicts,
    contentFieldConflicts,
    customFieldValues.fieldConflicts,
  );
  const redirects = normalizeMappedRedirectValues({
    value: getMappedScalarFieldValueFromResult({ postId, result: redirectsResult }),
  });

  return {
    authorId: authorIds[0] ?? null,
    categoryIds,
    contentFields,
    contentFormat: normalizedContent.contentFormat,
    contentHtml: normalizedContent.contentHtml,
    contentJson: normalizedContent.contentJson,
    contentMarkdown: normalizedContent.contentMarkdown,
    createdAt,
    excerpt,
    ...(Object.keys(mergedFieldConflicts).length ? { fieldConflicts: mergedFieldConflicts } : {}),
    focusKeyword: toText(getMappedScalarFieldValueFromResult({ postId, result: focusKeywordResult })),
    featuredImageUrl: toText(getMappedScalarFieldValueFromResult({ postId, result: featuredImageResult })),
    id: postId,
    parentPageId: parentPageIds[0] ?? null,
    publishedAt,
    redirects,
    seoDescription: toText(getMappedScalarFieldValueFromResult({ postId, result: seoDescriptionResult })),
    seoTitle: toText(getMappedScalarFieldValueFromResult({ postId, result: seoTitleResult })),
    slug: toText(getMappedScalarFieldValueFromResult({ postId, result: slugResult })) ?? generatedSlug,
    status: getPostStatusFromRow(postRow, posts),
    tagIds,
    title,
    updatedAt,
    customFields: customFieldValues.values,
  } satisfies ContentPost;
};

export const mapMappedContentPostListRow = async ({
  authorId,
  client,
  postRow,
  runtime,
}: {
  authorId?: string | null;
  client: ContentDatabaseClient;
  postRow: MappedContentBasePostRow;
  runtime: MappedContentRuntime;
}): Promise<ContentPost> => {
  const posts = runtime.posts;
  const postIdColumn = getEntityIdColumn(posts);
  const postId = toText(getRowValue(postRow, postIdColumn)) ?? "";
  const [createdAtResult, excerptResult, slugResult, titleResult, updatedAtResult] = await Promise.all([
    getMappedScalarFieldValuesForPosts({ client, fieldKey: "createdAt", postRows: [postRow], posts }),
    getMappedScalarFieldValuesForPosts({ client, fieldKey: "excerpt", postRows: [postRow], posts }),
    getMappedScalarFieldValuesForPosts({ client, fieldKey: "slug", postRows: [postRow], posts }),
    getMappedScalarFieldValuesForPosts({ client, fieldKey: "title", postRows: [postRow], posts }),
    getMappedScalarFieldValuesForPosts({ client, fieldKey: "updatedAt", postRows: [postRow], posts }),
  ]);
  const title = toText(getMappedScalarFieldValueFromResult({ postId, result: titleResult })) ?? "";
  const excerpt = toText(getMappedScalarFieldValueFromResult({ postId, result: excerptResult }));
  const createdAt =
    toText(getMappedScalarFieldValueFromResult({ postId, result: createdAtResult })) ?? getFallbackTimestamp(postRow);
  const updatedAt =
    toText(getMappedScalarFieldValueFromResult({ postId, result: updatedAtResult })) ??
    toText(getMappedScalarFieldValueFromResult({ postId, result: createdAtResult })) ??
    getFallbackTimestamp(postRow);
  const publishedAt = toText(getRowValue(postRow, getMappedPublishedAtColumn(posts)));
  const generatedSlug = slugifyContentValue(title || postId) || postId;
  const authorIdsByPostId =
    authorId === undefined
      ? await getMappedRelationValuesForPosts({
          client,
          entity: runtime.authors,
          postRows: [postRow],
          posts,
          relation: posts.relations.authors,
        })
      : null;
  const resolvedAuthorId =
    authorId !== undefined
      ? authorId
      : authorIdsByPostId?.get(postId)?.[0] ??
        authorIdsByPostId?.values().next().value?.[0] ??
        null;

  return createContentPostListPreview({
    authorId: resolvedAuthorId,
    createdAt,
    excerpt,
    id: postId,
    publishedAt,
    slug: toText(getMappedScalarFieldValueFromResult({ postId, result: slugResult })) ?? generatedSlug,
    status: getPostStatusFromRow(postRow, posts),
    title,
    updatedAt,
  });
};

export const loadMappedContentPostRowsPage = async ({
  accessibleAuthorIds = null,
  client,
  page,
  pageSize,
  runtime,
  search,
  status,
  sort,
  totalItems,
  useWindowPagination = false,
}: {
  accessibleAuthorIds?: string[] | null;
  client: ContentDatabaseClient;
  page?: number;
  pageSize?: number;
  runtime: MappedContentRuntime;
  search?: string;
  sort?: ContentPostsSort;
  status?: ContentPostsStatusFilter;
  totalItems?: number;
  useWindowPagination?: boolean;
}) => {
  const tableName = getEntityTableName(runtime.posts);
  const queryablePosts = await getMappedContentQueryablePosts({
    client,
    runtime,
  });
  const where = await buildMappedContentPostsWhereClause({
    accessibleAuthorIds,
    client,
    queryablePosts,
    runtime,
    search,
    status,
  });
  const pagination = useWindowPagination
    ? resolvePagination({
        page,
        pageSize,
        totalItems: Math.max(totalItems ?? 0, (page ?? 1) * (pageSize ?? 20)),
      })
    : resolvePagination({
        page,
        pageSize,
        totalItems:
          totalItems ??
          Number(
            (
              await client.query<{ count: string }>(
                buildContentEntityCountQuery({
                  filterClause: where.clause,
                  tableName,
                }),
                where.params,
              )
            ).rows[0]?.count ?? 0,
          ),
      });
  const orderClause = buildPostsOrderClause(queryablePosts.posts, sort ?? "updated_desc");
  const selectClause = await buildMappedContentPostListSelectClauseSafely({
    client,
    queryablePosts,
    runtime,
  });
  const rowsResult = await client.query<Record<string, unknown>>(
    buildContentEntityPageRowsQuery({
      filterClause: where.clause,
      filterParamCount: where.params.length,
      orderClause,
      selectClause,
      tableName,
    }),
    [
      ...where.params,
      pagination.pageSize + (useWindowPagination ? 1 : 0),
      pagination.offset,
    ],
  );
  const visibleRows = useWindowPagination
    ? rowsResult.rows.slice(0, pagination.pageSize)
    : rowsResult.rows;
  const hasNextWindowPage = useWindowPagination && rowsResult.rows.length > pagination.pageSize;
  const windowPagination = useWindowPagination
    ? {
        hasNextPage: hasNextWindowPage,
        hasPreviousPage: pagination.page > 1,
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalItems: hasNextWindowPage
          ? Math.max(totalItems ?? 0, pagination.offset + visibleRows.length + 1)
          : pagination.offset + visibleRows.length,
        totalItemsExact: !hasNextWindowPage,
        totalPages: hasNextWindowPage
          ? Math.max(
              pagination.page + 1,
              Math.ceil(Math.max(totalItems ?? 0, pagination.offset + visibleRows.length + 1) / pagination.pageSize),
              1,
            )
          : Math.max(pagination.page, 1),
      }
    : pagination;

  return {
    authorScopeApplied: where.authorScopeApplied,
    pagination: windowPagination,
    rows: visibleRows,
  };
};

export const lookupStoredRelationValuesForIds = async ({
  client,
  entity,
  ids,
  posts,
  relation,
}: {
  client: ContentDatabaseClient;
  entity: ContentEntityMapping;
  ids: string[];
  posts: ContentEntityMapping;
  relation: ContentRelationMapping;
}) => {
  const normalizedIds = [...new Set(ids.map((value) => value.trim()).filter(Boolean))];

  if (!normalizedIds.length) {
    return [];
  }

  const relationTargetColumn = relation.targetColumn?.trim();
  const entityIdColumnFromMapping = getEntityIdColumn(entity) || entity.source.primaryKey || null;

  if (
    relation.status !== "unmapped" &&
    entityIdColumnFromMapping &&
    (
      !relationTargetColumn ||
      relationTargetColumn === entityIdColumnFromMapping ||
      relation.valueColumn?.trim() === entityIdColumnFromMapping
    )
  ) {
    return normalizedIds;
  }

  const relationContext = await getMappedContentResolvedRelationContext({
    client,
    entity,
    posts,
    relation,
  });

  if (!relationContext) {
    return normalizedIds;
  }

  const { entityIdColumn, resolvedEntity, targetColumn, targetTableName } = relationContext;

  if (
    !entityIdColumn ||
    !targetColumn ||
    targetColumn === entityIdColumn ||
    relation.valueColumn?.trim() === entityIdColumn
  ) {
    return normalizedIds;
  }

  if (!targetTableName) {
    return normalizedIds;
  }

  const entityIdColumnMetadata = await getEntityColumnMetadata({
    client,
    columnName: entityIdColumn,
    entity: resolvedEntity,
  });
  const result = await client.query<{ entity_id: unknown; target_value: unknown }>(
    `
      select
        ${quoteIdentifier(entityIdColumn)} as entity_id,
        ${quoteIdentifier(targetColumn)} as target_value
      from ${targetTableName}
      where ${buildMappedContentArrayPredicate({
        columnExpression: quoteIdentifier(entityIdColumn),
        columnMetadata: entityIdColumnMetadata,
        paramIndex: 1,
      })}
    `,
    [normalizedIds],
  );
  const targetValueById = new Map(
    result.rows
      .map((row) => {
        const entityId = toText(row.entity_id);
        const targetValue = toText(row.target_value);

        return entityId && targetValue ? [entityId, targetValue] : null;
      })
      .filter((entry): entry is [string, string] => Boolean(entry)),
  );

  return normalizedIds.map((id) => targetValueById.get(id)).filter(Boolean) as string[];
};

export const getStoredStatusValue = ({
  desiredStatus,
  posts,
}: {
  desiredStatus: ContentPost["status"];
  posts: ContentEntityMapping;
}) => {
  const workflow = posts.workflow;

  if (!workflow) {
    return {
      publishedAtValue: desiredStatus === "published" ? new Date().toISOString() : null,
      publishedFlagValue: undefined as boolean | undefined,
      statusValue: undefined as string | undefined,
    };
  }

  if (workflow.statusColumn) {
    const values =
      desiredStatus === "published"
        ? workflow.publishedValues
        : desiredStatus === "archived"
          ? workflow.archivedValues
          : workflow.draftValues;

    return {
      publishedAtValue:
        getMappedPublishedAtColumn(posts) && desiredStatus === "published" ? new Date().toISOString() : null,
      publishedFlagValue: undefined,
      statusValue: values[0] ?? desiredStatus,
    };
  }

  if (workflow.publishedFlagColumn) {
    const publishedIsTrue = !(workflow.publishedValues ?? []).some((value) => value.toLowerCase() === "false");
    return {
      publishedAtValue:
        getMappedPublishedAtColumn(posts) && desiredStatus === "published" ? new Date().toISOString() : null,
      publishedFlagValue:
        desiredStatus === "published" ? publishedIsTrue : desiredStatus === "draft" ? !publishedIsTrue : false,
      statusValue: undefined,
    };
  }

  return {
    publishedAtValue:
      getMappedPublishedAtColumn(posts) && desiredStatus === "published" ? new Date().toISOString() : null,
    publishedFlagValue: undefined,
    statusValue: undefined,
  };
};

export const getUniqueSlugForMappedTable = async ({
  base,
  client,
  entity,
  excludeId,
  idColumn,
  slugColumn,
  tableName,
}: {
  base: string;
  client: ContentDatabaseClient;
  entity?: ContentEntityMapping | null;
  excludeId?: string | null;
  idColumn: string;
  slugColumn: string;
  tableName: string;
}) => {
  const normalizedBase = slugifyContentValue(base) || "untitled";
  const normalizedExcludeId = excludeId?.trim() ? excludeId.trim() : null;
  let candidate = normalizedBase;
  let suffix = 2;
  const predicateEntity =
    entity ??
    ({
      source: {
        primaryKey: idColumn,
      },
    } as ContentEntityMapping);
  const mappedSlugPath =
    entity && getMappedFieldColumn(entity, "slug") === slugColumn ? getMappedFieldPath(entity, "slug") : null;
  const mappedSlugTextExpression =
    entity && getMappedFieldColumn(entity, "slug") === slugColumn ? getMappedFieldTextExpression(entity, "slug") : null;

  while (true) {
    const slugPredicate =
      mappedSlugPath && mappedSlugTextExpression
        ? buildContentTextExpressionPredicate({
            expression: mappedSlugTextExpression,
            operator: "=",
            paramIndex: 1,
          })
        : await buildMappedContentSingleValuePredicate({
            client,
            columnName: slugColumn,
            entity: predicateEntity,
            operator: "=",
            paramIndex: 1,
          });
    const excludeIdPredicate = normalizedExcludeId
      ? await buildMappedContentSingleValuePredicate({
          client,
          columnName: idColumn,
          entity: predicateEntity,
          operator: "<>",
          paramIndex: 2,
        })
      : null;
    const result = await client.query<{ id: string }>(
      buildContentUniqueValueLookupQuery({
        excludePredicate: excludeIdPredicate,
        idColumn,
        tableName,
        valuePredicate: slugPredicate,
      }),
      normalizedExcludeId ? [candidate, normalizedExcludeId] : [candidate],
    );

    if (!result.rows.length) {
      return candidate;
    }

    candidate = `${normalizedBase}-${suffix}`;
    suffix += 1;
  }
};

const getMappedContentSingleValueHelperRowConflict = async ({
  client,
  fieldKey,
  postId,
  posts,
  relation,
}: {
  client: ContentDatabaseClient;
  fieldKey?: string;
  postId: string;
  posts: ContentEntityMapping;
  relation: ContentRelationMapping;
}) => {
  const usesSingleValueHelperRows =
    (isMappedContentHelperRowRelation(relation) ||
      (relation.strategy === "value_match_relation" && relation.junctionTable)) &&
    !relation.multiple;

  if (!usesSingleValueHelperRows) {
    return null;
  }

  const helperTableName = getRelationJunctionTableName(relation, posts.source.schema);
  const helperPostIdColumn = relation.junctionSourceColumn?.trim();
  const helperValueColumn = relation.valueColumn?.trim();

  if (!helperTableName || !helperPostIdColumn || !helperValueColumn) {
    return null;
  }

  const parsedHelperTable = parseTableRef(relation.junctionTable, posts.source.schema);
  const helperTableEntity = parsedHelperTable
    ? ({
        source: {
          primaryKey: helperPostIdColumn,
          schema: parsedHelperTable.schema,
          table: parsedHelperTable.table,
        },
      } as ContentEntityMapping)
    : ({
        source: {
          primaryKey: helperPostIdColumn,
        },
      } as ContentEntityMapping);
  const relationOrderColumn = await getMappedContentRelationOrderColumn({
    client,
    posts,
    relation,
  });
  const postIdPredicate = await buildMappedContentSingleValuePredicate({
    client,
    columnName: helperPostIdColumn,
    entity: helperTableEntity,
    operator: "=",
    paramIndex: 1,
  });
  const helperRowsResult = await client.query<Record<string, unknown>>(
    `
      select
        ${quoteIdentifier(helperPostIdColumn)} as post_id,
        ${quoteIdentifier(helperValueColumn)} as related_value
        ${
          relationOrderColumn
            ? `,\n        ${quoteIdentifier(relationOrderColumn)}`
            : ""
        }
      from ${helperTableName}
      where ${postIdPredicate}
    `,
    [postId],
  );
  const inspection = inspectContentOneToOneHelperRowValue({
    helperRows: helperRowsResult.rows,
    orderColumn: relationOrderColumn,
    postId,
    postIdColumn: "post_id",
    valueColumn: "related_value",
  });

  if (!inspection.ambiguous) {
    return null;
  }

  return {
    code: "helper_row_ambiguity",
    ...(fieldKey ? { fieldKey } : {}),
    message: "This field has duplicate source records. Ask an owner to fix the setup before editing it.",
    metadata: {
      helperRowCount: inspection.helperRowCount,
      values: inspection.matchedValues,
    },
  } as const;
};

const getMappedContentSingleValueScalarHelperRowConflict = async ({
  client,
  fieldKey,
  postId,
  posts,
  sourceRelation,
}: {
  client: ContentDatabaseClient;
  fieldKey: string;
  postId: string;
  posts: ContentEntityMapping;
  sourceRelation: NonNullable<ContentMappedField["sourceRelation"]>;
}) => {
  const helperTable = sourceRelation.junctionTable?.trim();
  const helperPostIdColumn = sourceRelation.junctionSourceColumn?.trim();
  const helperValueColumn = sourceRelation.valueColumn?.trim();
  const parsedHelperTable = parseTableRef(helperTable, posts.source.schema);

  if (!helperPostIdColumn || !helperValueColumn || !parsedHelperTable) {
    return null;
  }

  const helperRowsResult = await client.query<Record<string, unknown>>(
    buildContentHelperRowsForPostIdQuery({
      helperPostIdColumn,
      helperTableName: quoteQualifiedTable(parsedHelperTable.schema, parsedHelperTable.table),
      helperValueColumn,
    }),
    [postId],
  );
  const inspection = inspectContentOneToOneHelperRowValue({
    helperRows: helperRowsResult.rows,
    postId,
    postIdColumn: "post_id",
    valueColumn: "related_value",
  });

  if (!inspection.ambiguous) {
    return null;
  }

  return {
    code: "helper_row_ambiguity",
    fieldKey,
    message: "This field has duplicate source records. Ask an owner to fix the setup before editing it.",
    metadata: {
      helperRowCount: inspection.helperRowCount,
      values: inspection.matchedValues,
    },
  } as const;
};

export const getUniqueSlugForMappedScalarSource = async ({
  base,
  client,
  field,
  postId,
  posts,
  sourceRow,
}: {
  base: string;
  client: ContentDatabaseClient;
  field: ContentMappedField;
  postId: string;
  posts: ContentEntityMapping;
  sourceRow: Record<string, unknown>;
}) => {
  const relation = field.sourceRelation;
  const normalizedBase = slugifyContentValue(base) || "untitled";

  if (!relation) {
    return normalizedBase;
  }

  let candidate = normalizedBase;
  let suffix = 2;

  while (true) {
    let result:
      | {
          rows: Array<{ id: string }>;
        }
      | null = null;

    if (
      relation.strategy === "related_row_by_post_id" ||
      relation.strategy === "join_row"
    ) {
      const helperTable = relation.junctionTable?.trim();
      const helperPostIdColumn = relation.junctionSourceColumn?.trim();
      const helperValueColumn = relation.valueColumn?.trim();
      const parsedHelperTable = parseTableRef(helperTable, posts.source.schema);

      if (!helperPostIdColumn || !helperValueColumn || !parsedHelperTable) {
        return candidate;
      }

      result = await client.query<{ id: string }>(
        buildContentHelperValueConflictQuery({
          helperPostIdColumn,
          helperTableName: quoteQualifiedTable(parsedHelperTable.schema, parsedHelperTable.table),
          helperValueColumn,
        }),
        [candidate, postId],
      );
    } else if (
      relation.strategy === "foreign_key" ||
      relation.strategy === "value_match_relation"
    ) {
      const targetTable = relation.targetTable?.trim();
      const targetColumn = relation.targetColumn?.trim();
      const sourceColumn = relation.sourceColumn?.trim();
      const valueColumn = relation.valueColumn?.trim();
      const lookupValue = sourceColumn ? toText(getRowValue(sourceRow, sourceColumn)) : null;
      const parsedTargetTable = parseTableRef(targetTable, posts.source.schema);

      if (!targetColumn || !valueColumn || !lookupValue || !parsedTargetTable) {
        return candidate;
      }

      result = await client.query<{ id: string }>(
        buildContentTargetValueConflictQuery({
          tableName: quoteQualifiedTable(parsedTargetTable.schema, parsedTargetTable.table),
          targetColumn,
          valueColumn,
        }),
        [candidate, lookupValue],
      );
    } else {
      return candidate;
    }

    if (!result.rows.length) {
      return candidate;
    }

    candidate = `${normalizedBase}-${suffix}`;
    suffix += 1;
  }
};

export const applyMappedScalarFieldWrite = async ({
  client,
  field,
  fieldKey,
  postId,
  posts,
  sourceRow,
  value,
}: {
  client: ContentDatabaseClient;
  field: ContentMappedField;
  fieldKey: string;
  postId: string;
  posts: ContentEntityMapping;
  sourceRow: Record<string, unknown>;
  value: unknown;
}) => {
  const sourceRelation = field.sourceRelation;

  if (!sourceRelation) {
    return;
  }

  if (
    sourceRelation.strategy === "related_row_by_post_id" ||
    sourceRelation.strategy === "join_row"
  ) {
    const helperRowConflict = await getMappedContentSingleValueScalarHelperRowConflict({
      client,
      fieldKey,
      postId,
      posts,
      sourceRelation,
    });

    if (helperRowConflict) {
      throw createContentAdapterOperationError([helperRowConflict]);
    }

    const helperTable = sourceRelation.junctionTable?.trim();
    const helperPostIdColumn = sourceRelation.junctionSourceColumn?.trim();
    const helperValueColumn = sourceRelation.valueColumn?.trim();
    const parsedHelperTable = parseTableRef(helperTable, posts.source.schema);

    if (!helperPostIdColumn || !helperValueColumn || !parsedHelperTable) {
      return;
    }

    if (sourceRelation.strategy === "related_row_by_post_id") {
      const updateResult = await client.query(
        buildContentUpdateColumnByTextIdQuery({
          lookupColumn: helperPostIdColumn,
          tableName: quoteQualifiedTable(parsedHelperTable.schema, parsedHelperTable.table),
          valueColumn: helperValueColumn,
        }),
        [value ?? null, postId],
      );

      if (updateResult.rowCount === 1 || value === null || value === undefined) {
        return;
      }

      const helperRow = buildContentRelatedRowByPostIdUpsertWrite({
        postId,
        postIdColumn: helperPostIdColumn,
        value,
        valueColumn: helperValueColumn,
      }).row;

      await client.query(
        buildContentInsertColumnsQuery({
          insertColumns: [helperPostIdColumn, helperValueColumn],
          tableName: quoteQualifiedTable(parsedHelperTable.schema, parsedHelperTable.table),
        }),
        [helperRow[helperPostIdColumn] ?? null, helperRow[helperValueColumn] ?? null],
      );

      return;
    }

    await client.query(
      buildContentDeleteByPredicateQuery({
        predicate: buildContentSingleValuePredicate({
          columnName: helperPostIdColumn,
          operator: "=",
          paramIndex: 1,
          usesNativeComparison: false,
        }),
        tableName: quoteQualifiedTable(parsedHelperTable.schema, parsedHelperTable.table),
      }),
      [postId],
    );

    if (value === null || value === undefined) {
      return;
    }

    const helperRow = buildContentJoinRowUpsertWrite({
      postId,
      postIdColumn: helperPostIdColumn,
      value,
      valueColumn: helperValueColumn,
    }).row;

    await client.query(
      buildContentInsertColumnsQuery({
        insertColumns: [helperPostIdColumn, helperValueColumn],
        tableName: quoteQualifiedTable(parsedHelperTable.schema, parsedHelperTable.table),
      }),
      [helperRow[helperPostIdColumn] ?? null, helperRow[helperValueColumn] ?? null],
    );

    return;
  }

  if (
    sourceRelation.strategy === "foreign_key" ||
    sourceRelation.strategy === "value_match_relation"
  ) {
    const targetTable = sourceRelation.targetTable?.trim();
    const targetColumn = sourceRelation.targetColumn?.trim();
    const valueColumn = sourceRelation.valueColumn?.trim();
    const parsedTargetTable = parseTableRef(targetTable, posts.source.schema);
    const scalarWrite =
      sourceRelation.strategy === "foreign_key"
        ? buildContentForeignRowScalarWrite({
            targetColumn: targetColumn ?? "",
            targetLookupValue: sourceRelation.sourceColumn
              ? toText(getRowValue(sourceRow, sourceRelation.sourceColumn)) ?? ""
              : "",
            value,
            valueColumn: valueColumn ?? "",
          })
        : buildContentValueMatchScalarWrite({
            targetLookupValue: sourceRelation.sourceColumn
              ? toText(getRowValue(sourceRow, sourceRelation.sourceColumn)) ?? ""
              : "",
            targetColumn: targetColumn ?? "",
            value,
            valueColumn: valueColumn ?? "",
          });

    if (!parsedTargetTable || !scalarWrite) {
      return;
    }

    const result = await client.query(
      buildContentUpdateColumnByTextIdQuery({
        lookupColumn: scalarWrite.targetColumn,
        tableName: quoteQualifiedTable(parsedTargetTable.schema, parsedTargetTable.table),
        valueColumn: scalarWrite.valueColumn,
      }),
      [scalarWrite.value, scalarWrite.targetLookupValue],
    );

    if (result.rowCount !== 1) {
      throw createContentAdapterOperationError([
        {
          code: "scalar_relation_target_conflict",
          fieldKey,
          message:
            "This mapped field no longer points to one safe related row. Refresh the post and resolve the mapping before editing it.",
          metadata: {
            matchedRowCount: result.rowCount ?? 0,
            targetLookupValue: scalarWrite.targetLookupValue,
          },
        },
      ]);
    }
  }
};

export const applyMappedRelationWrite = async ({
  client,
  entity,
  fieldKey,
  ids,
  postId,
  posts,
  relation,
}: {
  client: ContentDatabaseClient;
  entity: ContentEntityMapping;
  fieldKey?: string;
  ids: string[];
  postId: string;
  posts: ContentEntityMapping;
  relation: ContentRelationMapping | undefined;
}) => {
  if (!relation || relation.strategy === "none" || relation.status === "unmapped") {
    return;
  }

  const storedValues = await lookupStoredRelationValuesForIds({
    client,
    entity,
    ids,
    posts,
    relation,
  });

  if (isMappedContentJoinTableRelation(relation)) {
    const joinTableName = getRelationJunctionTableName(relation, posts.source.schema);
    const joinSourceColumn = relation.junctionSourceColumn?.trim();
    const joinTargetColumn = relation.junctionTargetColumn?.trim();
    const discriminatorColumn =
      relation.strategy === "polymorphic_join" ? relation.discriminatorColumn?.trim() : null;
    const discriminatorValue =
      relation.strategy === "polymorphic_join" ? relation.discriminatorValue?.trim() : null;

    if (
      !joinTableName ||
      !joinSourceColumn ||
      !joinTargetColumn ||
      (relation.strategy === "polymorphic_join" && (!discriminatorColumn || !discriminatorValue))
    ) {
      return;
    }

    const parsedJoinTable = parseTableRef(relation.junctionTable, posts.source.schema);
    const joinTableEntity = parsedJoinTable
      ? ({
          source: {
            primaryKey: joinSourceColumn,
            schema: parsedJoinTable.schema,
            table: parsedJoinTable.table,
          },
        } as ContentEntityMapping)
      : ({
          source: {
            primaryKey: joinSourceColumn,
          },
        } as ContentEntityMapping);
    const deletePredicate = await buildMappedContentSingleValuePredicate({
      client,
      columnName: joinSourceColumn,
      entity: joinTableEntity,
      operator: "=",
      paramIndex: 1,
    });
    const deleteParams: unknown[] = [postId];
    await client.query(
      buildContentDeleteByPredicateQuery({
        extraPredicate:
          discriminatorColumn && discriminatorValue
            ? buildContentSingleValuePredicate({
                columnName: discriminatorColumn,
                operator: "=",
                paramIndex: 2,
                usesNativeComparison: false,
              })
            : null,
        predicate: deletePredicate,
        tableName: joinTableName,
      }),
      discriminatorColumn && discriminatorValue
        ? [...deleteParams, discriminatorValue]
        : deleteParams,
    );
    const relationOrderColumn = await getMappedContentRelationOrderColumn({
      client,
      posts,
      relation,
    });

    const replacementWrite =
      relation.strategy === "polymorphic_join" && discriminatorColumn && discriminatorValue
        ? buildContentPolymorphicJoinReplaceWrite({
            discriminatorColumn,
            discriminatorValue,
            orderColumn: relationOrderColumn,
            postId,
            sourceColumn: joinSourceColumn,
            targetColumn: joinTargetColumn,
            values: storedValues,
          })
        : buildContentJoinTableReplaceWrite({
            orderColumn: relationOrderColumn,
            postId,
            sourceColumn: joinSourceColumn,
            targetColumn: joinTargetColumn,
            values: storedValues,
          });

    for (const row of replacementWrite.rows) {
      const insertColumns = [
        ...(discriminatorColumn && discriminatorValue ? [discriminatorColumn] : []),
        joinSourceColumn,
        joinTargetColumn,
        ...(relationOrderColumn ? [relationOrderColumn] : []),
      ];
      await client.query(
        buildContentInsertColumnsQuery({
          insertColumns,
          tableName: joinTableName,
        }),
        insertColumns.map((column) => row[column] ?? null),
      );
    }

    return;
  }

  if (
    isMappedContentHelperRowRelation(relation) ||
    (relation.strategy === "value_match_relation" && relation.junctionTable)
  ) {
    const helperRowConflict = await getMappedContentSingleValueHelperRowConflict({
      client,
      fieldKey,
      postId,
      posts,
      relation,
    });

    if (helperRowConflict) {
      throw createContentAdapterOperationError([helperRowConflict]);
    }

    const helperTableName = getRelationJunctionTableName(relation, posts.source.schema);
    const helperPostIdColumn = relation.junctionSourceColumn?.trim();
    const helperValueColumn = relation.valueColumn?.trim();

    if (!helperTableName || !helperPostIdColumn || !helperValueColumn) {
      return;
    }

    if (relation.strategy === "related_row_by_post_id") {
      const nextValue = storedValues[0] ?? null;
      const updateResult = await client.query(
        buildContentUpdateColumnByTextIdQuery({
          lookupColumn: helperPostIdColumn,
          tableName: helperTableName,
          valueColumn: helperValueColumn,
        }),
        [nextValue, postId],
      );

      if (updateResult.rowCount === 1 || nextValue === null) {
        return;
      }

      const helperRow = buildContentRelatedRowByPostIdUpsertWrite({
        postId,
        postIdColumn: helperPostIdColumn,
        value: nextValue,
        valueColumn: helperValueColumn,
      }).row;

      await client.query(
        buildContentInsertColumnsQuery({
          insertColumns: [helperPostIdColumn, helperValueColumn],
          tableName: helperTableName,
        }),
        [helperRow[helperPostIdColumn] ?? null, helperRow[helperValueColumn] ?? null],
      );

      return;
    }

    const parsedHelperTable = parseTableRef(relation.junctionTable, posts.source.schema);
    const helperTableEntity = parsedHelperTable
      ? ({
          source: {
            primaryKey: helperPostIdColumn,
            schema: parsedHelperTable.schema,
            table: parsedHelperTable.table,
          },
        } as ContentEntityMapping)
      : ({
          source: {
            primaryKey: helperPostIdColumn,
          },
        } as ContentEntityMapping);
    const deletePredicate = await buildMappedContentSingleValuePredicate({
      client,
      columnName: helperPostIdColumn,
      entity: helperTableEntity,
      operator: "=",
      paramIndex: 1,
    });
    await client.query(
      buildContentDeleteByPredicateQuery({
        predicate: deletePredicate,
        tableName: helperTableName,
      }),
      [postId],
    );

    if (!storedValues.length) {
      return;
    }

    const relationOrderColumn = await getMappedContentRelationOrderColumn({
      client,
      posts,
      relation,
    });
    const helperRows =
      relation.strategy === "join_row"
          ? [
              {
                ...buildContentJoinRowUpsertWrite({
                  postId,
                  postIdColumn: helperPostIdColumn,
                  value: storedValues[0] ?? null,
                  valueColumn: helperValueColumn,
                }).row,
                ...(relationOrderColumn ? { [relationOrderColumn]: 0 } : {}),
              },
            ]
          : storedValues.map((value, index) => ({
              [helperPostIdColumn]: postId,
              [helperValueColumn]: value,
              ...(relationOrderColumn ? { [relationOrderColumn]: index } : {}),
            }));

    for (const row of helperRows) {
      const insertColumns = [
        helperPostIdColumn,
        helperValueColumn,
        ...(relationOrderColumn ? [relationOrderColumn] : []),
      ];
      await client.query(
        buildContentInsertColumnsQuery({
          insertColumns,
          tableName: helperTableName,
        }),
        insertColumns.map((column) => row[column] ?? null),
      );
    }

    return;
  }

  if (relation.strategy === "array" && relation.sourceColumn) {
    const postIdPredicate = await buildMappedContentSingleValuePredicate({
      client,
      columnName: getEntityIdColumn(posts) || posts.source.primaryKey || "id",
      entity: posts,
      operator: "=",
      paramIndex: 1,
    });
    await client.query(
      `
        update ${getEntityTableName(posts)}
        set ${quoteIdentifier(relation.sourceColumn)} = $2
        where ${postIdPredicate}
      `,
      [postId, storedValues],
    );
    return;
  }

  if (relation.strategy === "value_match_relation" && relation.sourceColumn) {
    const postIdPredicate = await buildMappedContentSingleValuePredicate({
      client,
      columnName: getEntityIdColumn(posts) || posts.source.primaryKey || "id",
      entity: posts,
      operator: "=",
      paramIndex: 1,
    });
    await client.query(
      `
        update ${getEntityTableName(posts)}
        set ${quoteIdentifier(relation.sourceColumn)} = $2
        where ${postIdPredicate}
      `,
      [postId, relation.multiple ? storedValues : storedValues[0] ?? null],
    );
    return;
  }

  if ((relation.strategy === "json_array" || relation.strategy === "json_object") && relation.sourceColumn) {
    const nextJsonValue =
      relation.strategy === "json_array"
        ? storedValues
        : {
            [relation.valueColumn || relation.targetColumn || getEntityIdColumn(entity) || "ids"]:
              relation.multiple ? storedValues : storedValues[0] ?? null,
          };
    const postIdPredicate = await buildMappedContentSingleValuePredicate({
      client,
      columnName: getEntityIdColumn(posts) || posts.source.primaryKey || "id",
      entity: posts,
      operator: "=",
      paramIndex: 1,
    });

    await client.query(
      `
        update ${getEntityTableName(posts)}
        set ${quoteIdentifier(relation.sourceColumn)} = $2::jsonb
        where ${postIdPredicate}
      `,
      [postId, JSON.stringify(nextJsonValue)],
    );
  }
};
