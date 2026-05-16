import {
  POSTS_MAPPING_NONE_VALUE,
  POSTS_MAPPING_NOT_IN_TABLE_VALUE,
} from "@/components/editor/project-editor/constants";
import type {
  CollectionLabel,
  PostsMappingDraftState,
  PostsMappingFieldOptionKey,
  PostsMappingRelationDraft,
  PostsRelationEntityKey,
  PostsRelationFieldKey,
} from "@/components/editor/project-editor/types";
import type { ContentIntrospectedTable } from "@/lib/content-runtime/introspection";
import { detectTimestampSourceHint, toLabel } from "@/lib/content-runtime/introspection-support-shared";
import {
  createDefaultContentMappingConfig,
  type ContentCustomFieldMapping,
  type ContentEntityMapping,
  type ContentMappingConfig,
  type ContentRelationMapping,
  type ContentTimestampSourceHint,
} from "@/lib/content-runtime/mapping";

export function buildProjectEditorMissingOptionLabel(label: string) {
  return `Skip ${label.toLowerCase()}`;
}

export function buildProjectEditorSpecialSelectOptions(
  label: string,
  options?: { includeNotInTable?: boolean },
) {
  return [
    ...(options?.includeNotInTable === false
      ? []
      : [{ label: "Stored in another table", value: POSTS_MAPPING_NOT_IN_TABLE_VALUE }]),
    { label: buildProjectEditorMissingOptionLabel(label), value: POSTS_MAPPING_NONE_VALUE },
  ];
}

const attachCustomFieldSourceType = ({
  field,
  postsTable,
}: {
  field: ContentCustomFieldMapping;
  postsTable: ContentIntrospectedTable | null;
}): ContentCustomFieldMapping => {
  if (field.sourceType) {
    return field;
  }

  const sourceColumn = postsTable?.columns.find((column) => column.name === field.column) ?? null;

  return {
    ...field,
    sourceType: {
      ...(sourceColumn?.udtName
        ? {
            adapterMetadata: {
              postgres: {
                udtName: sourceColumn.udtName,
              },
            },
          }
        : {}),
      isArray: Boolean(sourceColumn?.isArray),
      isJson: Boolean(sourceColumn?.isJson),
      nativeType: sourceColumn?.dataType ?? field.dataType,
    },
  };
};

type CreateProjectEditorPostsMappingConfigBuilderArgs = {
  baseMappingConfig: ContentMappingConfig;
  defaultMappingConfig: ContentMappingConfig;
  detectContentKindForColumn: (
    table: ContentIntrospectedTable | null,
    columnName: string | null | undefined,
  ) => PostsMappingDraftState["contentKind"];
  getBooleanStatusValueLists: (
    mode: PostsMappingDraftState["statusBooleanMode"],
  ) => {
    archivedValues: string[];
    draftValues: string[];
    publishedValues: string[];
  };
  getCustomFieldsForTable: (
    table: ContentIntrospectedTable | null,
    draft: PostsMappingDraftState,
  ) => PostsMappingDraftState["customFields"];
  getRelationDraftKeyForEntity: (entity: PostsRelationEntityKey) => PostsRelationFieldKey;
  getRelationTargetTableRef: (
    key: PostsRelationFieldKey,
    relation: PostsMappingRelationDraft,
  ) => string;
  getTableByRef: (tableRef: string) => ContentIntrospectedTable | null;
  getTableColumn: (
    table: ContentIntrospectedTable | null,
    columnName: string | null | undefined,
  ) => ContentIntrospectedTable["columns"][number] | null;
  isBooleanLikeColumn: (column: ContentIntrospectedTable["columns"][number]) => boolean;
  mappingEntryCollection: CollectionLabel;
  postsMappingDraft: PostsMappingDraftState | null;
  postsTable: ContentIntrospectedTable | null;
  relationEntityByKey: Record<PostsRelationFieldKey, PostsRelationEntityKey>;
};

export function createProjectEditorPostsMappingConfigBuilder({
  baseMappingConfig,
  defaultMappingConfig,
  detectContentKindForColumn,
  getBooleanStatusValueLists,
  getCustomFieldsForTable,
  getRelationDraftKeyForEntity,
  getRelationTargetTableRef,
  getTableByRef,
  getTableColumn,
  isBooleanLikeColumn,
  mappingEntryCollection,
  postsMappingDraft,
  postsTable,
  relationEntityByKey,
}: CreateProjectEditorPostsMappingConfigBuilderArgs) {
  const toNullableMappingValue = (value: string | null | undefined) =>
    value &&
    value !== POSTS_MAPPING_NONE_VALUE &&
    value !== POSTS_MAPPING_NOT_IN_TABLE_VALUE
      ? value
      : null;

  const cloneMappingConfig = (value: ContentMappingConfig) =>
    JSON.parse(JSON.stringify(value)) as ContentMappingConfig;

  const buildContentFieldId = (
    column: string,
    index: number,
    options?: {
      arrayIndex?: number | null;
      path?: string | null;
    },
  ) => {
    const sanitizeSegment = (value: string) =>
      value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

    const baseId = sanitizeSegment(column) || `content_${index + 1}`;
    const normalizedPath = options?.path?.trim() || "";

    if (normalizedPath) {
      return `${baseId}__${sanitizeSegment(normalizedPath) || `path_${index + 1}`}`;
    }

    if (Number.isInteger(options?.arrayIndex) && Number(options?.arrayIndex) >= 0) {
      return `${baseId}__item_${Number(options?.arrayIndex) + 1}`;
    }

    return baseId;
  };

  const parseTableRef = (tableRef: string | null | undefined) => {
    const normalized = toNullableMappingValue(tableRef);

    if (!normalized) {
      return {
        schema: null,
        table: null,
      };
    }

    const parts = normalized.split(".");

    if (parts.length >= 2) {
      return {
        schema: parts[0] ?? null,
        table: parts.slice(1).join(".") || null,
      };
    }

    return {
      schema: "public",
      table: normalized,
    };
  };

  const getEntityCapabilities = (tableRef: string | null | undefined) => {
    const table = getTableByRef(tableRef ?? POSTS_MAPPING_NONE_VALUE);
    const canWrite = table?.kind === "table";

    return {
      browse: Boolean(table),
      create: canWrite,
      delete: canWrite,
      read: Boolean(table),
      update: canWrite,
    } satisfies ContentEntityMapping["capabilities"];
  };

  const getRelationStoragePrimitiveForStrategy = (
    strategy: ContentRelationMapping["strategy"],
  ): ContentRelationMapping["storagePrimitive"] => {
    switch (strategy) {
      case "foreign_key":
        return "foreign_key";
      case "related_row_by_post_id":
        return "related_row_by_post_id";
      case "join_row":
        return "join_row";
      case "join_table":
        return "join_table";
      case "polymorphic_join":
        return "polymorphic_join";
      case "value_match_relation":
        return "value_match_relation";
      case "array":
        return "array_value";
      case "json_array":
      case "json_object":
        return "json_path";
      case "inline_fields":
        return "direct_column";
      case "derived_distinct":
      case "none":
        return "derived_read_only";
    }
  };

  const applyFieldColumn = (
    entity: ContentEntityMapping,
    fieldKey: string,
    value: string | null | undefined,
    options?: {
      arrayIndex?: number | null;
      timestampSourceHint?: ContentTimestampSourceHint | null;
    },
  ) => {
    if (!entity.fields[fieldKey]) {
      return;
    }

    const nextField = {
      ...entity.fields[fieldKey],
      arrayIndex: options?.arrayIndex ?? null,
      column: toNullableMappingValue(value),
    };

    if (options?.timestampSourceHint) {
      nextField.timestampSourceHint = options.timestampSourceHint;
    } else {
      delete nextField.timestampSourceHint;
    }

    entity.fields[fieldKey] = {
      ...nextField,
    };
  };

  const getDraftArrayIndexForFieldOption = (
    optionKey: PostsMappingFieldOptionKey,
    columnName: string | null | undefined,
  ) => {
    const selectedColumn = getTableColumn(postsTable, toNullableMappingValue(columnName));

    if (!selectedColumn?.isArray) {
      return null;
    }

    const rawIndex = postsMappingDraft?.fieldOptions[optionKey]?.arrayItemIndex?.trim() ?? "1";
    const parsedIndex = Number.parseInt(rawIndex, 10);

    return Number.isFinite(parsedIndex) && parsedIndex > 0 ? parsedIndex - 1 : 0;
  };

  const getDraftContentArrayIndex = (
    columnName: string | null | undefined,
    index: number,
  ) => {
    const selectedColumn = getTableColumn(postsTable, toNullableMappingValue(columnName));

    if (!selectedColumn?.isArray) {
      return null;
    }

    const rawIndex = postsMappingDraft?.contentFieldOptions[index]?.arrayItemIndex?.trim() ?? "1";
    const parsedIndex = Number.parseInt(rawIndex, 10);

    return Number.isFinite(parsedIndex) && parsedIndex > 0 ? parsedIndex - 1 : 0;
  };

  const getDraftContentJsonPath = (
    columnName: string | null | undefined,
    index: number,
  ) => {
    const selectedColumn = getTableColumn(postsTable, toNullableMappingValue(columnName));

    if (!selectedColumn?.isJson) {
      return null;
    }

    const normalizedPath = postsMappingDraft?.contentFieldOptions[index]?.jsonPath?.trim() ?? "";
    return normalizedPath || null;
  };

  const buildMappedEntityFromRelation = (
    entityKey: PostsRelationEntityKey,
    relation: PostsMappingRelationDraft,
    baseConfig: ContentMappingConfig,
  ) => {
    if (relation.strategy === "missing") {
      return cloneMappingConfig(createDefaultContentMappingConfig()).entities[entityKey];
    }

    const entity = cloneMappingConfig(baseConfig).entities[entityKey];
    const targetTableRef = toNullableMappingValue(
      getRelationTargetTableRef(getRelationDraftKeyForEntity(entityKey), relation),
    );
    const targetTable = getTableByRef(targetTableRef ?? POSTS_MAPPING_NONE_VALUE);
    const parsedTarget = parseTableRef(targetTableRef);

    if (!targetTable || !parsedTarget.table || !parsedTarget.schema) {
      return entity;
    }

    entity.capabilities = getEntityCapabilities(targetTableRef);
    entity.notes = [];
    entity.source = {
      kind: targetTable.kind,
      primaryKey: targetTable.primaryKey,
      schema: parsedTarget.schema,
      table: parsedTarget.table,
    };
    entity.status = "mapped";
    applyFieldColumn(entity, "id", relation.fieldMap.id ?? targetTable.primaryKey);

    for (const [fieldKey, column] of Object.entries(relation.fieldMap)) {
      applyFieldColumn(entity, fieldKey, column);
    }

    if (entityKey === "categories") {
      applyFieldColumn(entity, "parentId", relation.fieldMap.parentId ?? entity.fields.parentId.column);
    }

    return entity;
  };

  const buildRelationMapping = (
    key: PostsRelationFieldKey,
    relation: PostsMappingRelationDraft,
    baseConfig: ContentMappingConfig,
  ) => {
    const entityKey = relationEntityByKey[key];
    const targetEntity = buildMappedEntityFromRelation(entityKey, relation, baseConfig);
    const baseRelation = baseConfig.entities.posts.relations[entityKey];

    if (!baseRelation) {
      return null;
    }

    if (
      relation.strategy === "missing" ||
      relation.column === POSTS_MAPPING_NONE_VALUE ||
      relation.column === ""
    ) {
      return {
        ...baseRelation,
        fieldMap: {},
        junctionSourceColumn: null,
        junctionTable: null,
        junctionTargetColumn: null,
        sourceColumn: null,
        status: "unmapped" as const,
        strategy: "none" as const,
        targetColumn: null,
        targetTable: null,
        valueColumn: null,
      };
    }

    const targetTableRef =
      toNullableMappingValue(getRelationTargetTableRef(key, relation)) ??
      (targetEntity.source.schema && targetEntity.source.table
        ? `${targetEntity.source.schema}.${targetEntity.source.table}`
        : null);

    return {
      ...baseRelation,
      fieldMap: Object.fromEntries(
        Object.entries(relation.fieldMap).filter(([, value]) => Boolean(toNullableMappingValue(value))),
      ),
      junctionSourceColumn: toNullableMappingValue(relation.joinSourceColumn),
      junctionTable:
        targetTableRef && relation.strategy === "join_table"
          ? toNullableMappingValue(relation.joinTableRef)
          : relation.strategy === "join_table"
            ? toNullableMappingValue(relation.joinTableRef)
            : null,
      junctionTargetColumn: toNullableMappingValue(relation.joinTargetColumn),
      sourceColumn:
        relation.column === POSTS_MAPPING_NOT_IN_TABLE_VALUE ? null : toNullableMappingValue(relation.column),
      status: "mapped" as const,
      storagePrimitive: getRelationStoragePrimitiveForStrategy(relation.strategy),
      strategy: relation.strategy,
      targetColumn:
        toNullableMappingValue(relation.targetColumn) ??
        targetEntity.fields.id.column ??
        targetEntity.source.primaryKey,
      targetTable: targetTableRef,
      valueColumn: toNullableMappingValue(relation.valueColumn),
    };
  };

  const applyPostsEntityMapping = (nextConfig: ContentMappingConfig) => {
    const nextPosts = nextConfig.entities.posts;
    const preservedRelationBackedContentFields = baseMappingConfig.entities.posts.editorFields.filter(
      (editorField) =>
        editorField.visible &&
        !editorField.column &&
        Boolean(editorField.sourceRelation),
    );
    const contentFieldSelections = postsMappingDraft!.contentColumns
      .map((value, index) => {
        const column = toNullableMappingValue(value);

        if (!column) {
          return null;
        }

        return {
          arrayIndex: getDraftContentArrayIndex(value, index),
          column,
          index,
          kind: postsMappingDraft!.contentColumnKinds[index] ?? detectContentKindForColumn(postsTable, column),
          path: getDraftContentJsonPath(value, index),
        };
      })
      .filter(
        (
          value,
        ): value is {
          arrayIndex: number | null;
          column: string;
          index: number;
          kind: PostsMappingDraftState["contentKind"];
          path: string | null;
        } => Boolean(value),
      );
    const contentColumns = contentFieldSelections.map((entry) => entry.column);
    const statusColumn = toNullableMappingValue(postsMappingDraft!.statusColumn);
    const selectedStatusField = statusColumn ? getTableColumn(postsTable, statusColumn) : null;
    const isBooleanStatus = Boolean(selectedStatusField && isBooleanLikeColumn(selectedStatusField));
    const getTimestampSourceHint = (columnName: string | null | undefined) =>
      postsTable ? detectTimestampSourceHint(postsTable, toNullableMappingValue(columnName)) : null;

    nextPosts.capabilities = getEntityCapabilities(postsMappingDraft!.tableRef);
    nextPosts.notes = [];
    nextPosts.source = {
      kind: postsTable!.kind,
      primaryKey: postsTable!.primaryKey,
      schema: postsTable!.schema,
      table: postsTable!.name,
    };
    nextPosts.status = "mapped";
    applyFieldColumn(nextPosts, "id", toNullableMappingValue(postsMappingDraft!.idColumn) ?? postsTable!.primaryKey, {
      arrayIndex: getDraftArrayIndexForFieldOption("idColumn", postsMappingDraft!.idColumn),
    });
    applyFieldColumn(nextPosts, "title", postsMappingDraft!.titleColumn, {
      arrayIndex: getDraftArrayIndexForFieldOption("titleColumn", postsMappingDraft!.titleColumn),
    });
    applyFieldColumn(nextPosts, "slug", postsMappingDraft!.slugColumn, {
      arrayIndex: getDraftArrayIndexForFieldOption("slugColumn", postsMappingDraft!.slugColumn),
    });
    applyFieldColumn(nextPosts, "excerpt", postsMappingDraft!.excerptColumn, {
      arrayIndex: getDraftArrayIndexForFieldOption("excerptColumn", postsMappingDraft!.excerptColumn),
    });
    applyFieldColumn(nextPosts, "featuredImageUrl", postsMappingDraft!.featuredImageUrlColumn, {
      arrayIndex: getDraftArrayIndexForFieldOption(
        "featuredImageUrlColumn",
        postsMappingDraft!.featuredImageUrlColumn,
      ),
    });
    applyFieldColumn(nextPosts, "status", postsMappingDraft!.statusColumn, {
      arrayIndex: getDraftArrayIndexForFieldOption("statusColumn", postsMappingDraft!.statusColumn),
    });
    applyFieldColumn(nextPosts, "createdAt", postsMappingDraft!.createdAtColumn, {
      arrayIndex: getDraftArrayIndexForFieldOption("createdAtColumn", postsMappingDraft!.createdAtColumn),
      timestampSourceHint: getTimestampSourceHint(postsMappingDraft!.createdAtColumn),
    });
    applyFieldColumn(nextPosts, "publishedAt", postsMappingDraft!.publishedAtColumn, {
      arrayIndex: getDraftArrayIndexForFieldOption("publishedAtColumn", postsMappingDraft!.publishedAtColumn),
      timestampSourceHint: getTimestampSourceHint(postsMappingDraft!.publishedAtColumn),
    });
    applyFieldColumn(nextPosts, "redirects", postsMappingDraft!.redirectsColumn, {
      arrayIndex: null,
    });
    applyFieldColumn(nextPosts, "updatedAt", postsMappingDraft!.updatedAtColumn, {
      arrayIndex: getDraftArrayIndexForFieldOption("updatedAtColumn", postsMappingDraft!.updatedAtColumn),
      timestampSourceHint: getTimestampSourceHint(postsMappingDraft!.updatedAtColumn),
    });
    applyFieldColumn(nextPosts, "seoTitle", postsMappingDraft!.seoTitleColumn, {
      arrayIndex: getDraftArrayIndexForFieldOption("seoTitleColumn", postsMappingDraft!.seoTitleColumn),
    });
    applyFieldColumn(nextPosts, "seoDescription", postsMappingDraft!.seoDescriptionColumn, {
      arrayIndex: getDraftArrayIndexForFieldOption(
        "seoDescriptionColumn",
        postsMappingDraft!.seoDescriptionColumn,
      ),
    });
    applyFieldColumn(nextPosts, "focusKeyword", postsMappingDraft!.focusKeywordColumn, {
      arrayIndex: getDraftArrayIndexForFieldOption(
        "focusKeywordColumn",
        postsMappingDraft!.focusKeywordColumn,
      ),
    });
    nextPosts.editorFields = [
      ...contentFieldSelections.map((selection, index) => ({
        ...(nextPosts.editorFields[index] ?? {}),
        arrayIndex: selection.arrayIndex,
        column: selection.column,
        id: buildContentFieldId(selection.column, index, {
          arrayIndex: selection.arrayIndex,
          path: selection.path,
        }),
        kind: selection.kind,
        label:
          index === 0
            ? "Content"
            : selection.path
              ? toLabel(selection.path.split(".").at(-1) ?? selection.column)
              : selection.arrayIndex !== null
                ? `${toLabel(selection.column)} ${selection.arrayIndex + 1}`
                : toLabel(selection.column),
        path: selection.path,
        placeholder: null,
        required: index === 0,
        visible: true,
      })),
      ...preservedRelationBackedContentFields.map((editorField) => ({ ...editorField })),
    ];
    nextPosts.companionContentColumns = postsMappingDraft!.legacyCompanionContentColumns.filter(
      (entry) => entry.column && !contentColumns.includes(entry.column),
    );
    nextPosts.workflow = {
      ...nextPosts.workflow!,
      archivedValues: isBooleanStatus ? [] : postsMappingDraft!.archivedValues,
      customValues: [],
      draftValues: isBooleanStatus
        ? getBooleanStatusValueLists(postsMappingDraft!.statusBooleanMode).draftValues
        : postsMappingDraft!.draftValues,
      mode:
        isBooleanStatus
          ? (toNullableMappingValue(postsMappingDraft!.publishedAtColumn) ? "status_with_flag" : "published_flag")
          : statusColumn
            ? "status"
            : toNullableMappingValue(postsMappingDraft!.publishedAtColumn)
              ? "published_at"
              : "custom",
      publishedAtColumn: toNullableMappingValue(postsMappingDraft!.publishedAtColumn),
      publishedFlagColumn: isBooleanStatus ? statusColumn : null,
      publishedValues: isBooleanStatus
        ? getBooleanStatusValueLists(postsMappingDraft!.statusBooleanMode).publishedValues
        : postsMappingDraft!.publishedValues,
      statusColumn: isBooleanStatus ? null : statusColumn,
    };
    nextPosts.customFields = (
      postsMappingDraft!.customFields.length > 0
        ? postsMappingDraft!.customFields
        : getCustomFieldsForTable(postsTable, postsMappingDraft!)
    )
      .filter((customField) => customField.enabled)
      .map((customField) => attachCustomFieldSourceType({ field: customField, postsTable }));
  };

  const applyRelationEntityMapping = (
    nextConfig: ContentMappingConfig,
    key: PostsRelationFieldKey,
  ) => {
    const entityKey = relationEntityByKey[key];
    const relation = postsMappingDraft![key];
    nextConfig.entities[entityKey] = buildMappedEntityFromRelation(entityKey, relation, nextConfig);
    nextConfig.entities.posts.relations[entityKey] =
      buildRelationMapping(key, relation, nextConfig) ?? nextConfig.entities.posts.relations[entityKey];
  };

  const applyFilesStorageMapping = (nextConfig: ContentMappingConfig) => {
    const filesStorage = postsMappingDraft!.filesStorage;
    nextConfig.filesStorage =
      filesStorage.provider !== "none"
        ? {
            bucketName: filesStorage.bucketName.trim() || null,
            endpoint: filesStorage.endpoint.trim() || null,
            provider: filesStorage.provider,
            publicUrlBase: filesStorage.publicUrlBase.trim() || null,
            region: filesStorage.region.trim() || null,
          }
        : null;
  };

  const applyMediaStorageMapping = (nextConfig: ContentMappingConfig) => {
    const mediaStorage = postsMappingDraft!.mediaStorage;
    nextConfig.mediaStorage =
      mediaStorage.provider !== "none"
        ? {
            bucketName: mediaStorage.bucketName.trim() || null,
            endpoint: mediaStorage.endpoint.trim() || null,
            provider: mediaStorage.provider,
            publicUrlBase: mediaStorage.publicUrlBase.trim() || null,
            region: mediaStorage.region.trim() || null,
          }
        : null;
  };

  const buildPostsMappingConfig = () => {
    if (!postsMappingDraft || !postsTable) {
      return null;
    }

    const nextConfig = cloneMappingConfig(baseMappingConfig ?? defaultMappingConfig);

    if (mappingEntryCollection === "Posts") {
      applyPostsEntityMapping(nextConfig);
      return nextConfig;
    }

    if (mappingEntryCollection === "Authors") {
      applyRelationEntityMapping(nextConfig, "author");
      return nextConfig;
    }

    if (mappingEntryCollection === "Categories") {
      applyRelationEntityMapping(nextConfig, "categories");
      return nextConfig;
    }

    if (mappingEntryCollection === "Tags") {
      applyRelationEntityMapping(nextConfig, "tags");
      return nextConfig;
    }

    if (mappingEntryCollection === "Media") {
      applyMediaStorageMapping(nextConfig);
      return nextConfig;
    }

    if (mappingEntryCollection === "Files") {
      applyFilesStorageMapping(nextConfig);
      return nextConfig;
    }

    return nextConfig;
  };

  return {
    buildPostsMappingConfig,
  };
}
