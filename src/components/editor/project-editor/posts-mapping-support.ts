import {
  defaultFilesStorageDraft,
  defaultMediaStorageDraft,
  POSTS_MAPPING_FIELD_OPTION_KEYS,
  POSTS_MAPPING_NONE_VALUE,
  POSTS_MAPPING_NOT_IN_TABLE_VALUE,
} from "@/components/editor/project-editor/constants";
import type {
  MappingDetectionPayload,
  PostsMappingBooleanStatusMode,
  PostsMappingDraftState,
  PostsMappingFieldOptionDraft,
  PostsMappingFieldOptionKey,
  PostsMappingRelationDraft,
  PostsRelationEntityKey,
  PostsRelationFieldKey,
} from "@/components/editor/project-editor/types";
import type {
  ContentIntrospectedColumn,
  ContentIntrospectedTable,
} from "@/lib/content-runtime/introspection";
import { detectContentColumns } from "@/lib/content-runtime/introspection-support-shared";
import type {
  ContentCustomFieldMapping,
  ContentEntityMapping,
  ContentMappingEntityKey,
  ContentRelationMapping,
} from "@/lib/content-runtime/mapping";

type FindColumnOptions = {
  requireArray?: boolean;
  requireBoolean?: boolean;
  requireDateLike?: boolean;
  requireJson?: boolean;
  requireTextLike?: boolean;
};

type RelationFieldConfig = {
  fields: Array<{
    fieldKey: string;
    label: string;
    patterns: RegExp[];
    requireTextLike?: boolean;
    usePrimaryKey?: boolean;
  }>;
  title: string;
};

export function createProjectEditorPostsMappingSupport(
  mappingDetection: MappingDetectionPayload | null,
) {
  const statusColumnPatterns = [
    /^status$/,
    /(^|_)status$/,
    /^state$/,
    /(^|_)state$/,
    /^publication_status$/,
    /^publication_state$/,
    /^publish_status$/,
    /^publish_state$/,
    /^workflow$/,
  ];
  const publishedFlagColumnPatterns = [
    /^is_published$/,
    /^published$/,
    /^is_live$/,
    /^live$/,
    /^is_public$/,
    /^visible$/,
  ];
  const publishedAtColumnPatterns = [
    /^published_at$/,
    /^published_on$/,
    /^published_date$/,
    /^live_at$/,
    /^posted_at$/,
    /^date_published$/,
  ];
  const focusKeywordColumnPatterns = [
    /^focus_keyword$/,
    /^focus_keywords$/,
    /^focus_keyphrase$/,
    /^seo_keyword$/,
    /^seo_keywords$/,
    /^seo_keyphrase$/,
    /^meta_keyword$/,
    /^meta_keywords$/,
    /^keyword$/,
  ];
  const redirectsColumnPatterns = [
    /^redirects$/,
    /^redirect_paths$/,
    /^redirect_urls$/,
    /^old_paths$/,
    /^old_slugs$/,
    /^legacy_paths$/,
    /^aliases$/,
  ];
  const seoDescriptionColumnPatterns = [
    /^seo_description$/,
    /^meta_description$/,
    /^meta_desc$/,
    /(^|_)(seo|meta)_(description|desc)$/,
  ];
  const seoTitleColumnPatterns = [
    /^seo_title$/,
    /^meta_title$/,
    /^title_tag$/,
    /(^|_)(seo|meta)_title(_tag)?$/,
  ];
  const relationEntityByKey = {
    author: "authors",
    categories: "categories",
    tags: "tags",
  } satisfies Record<PostsRelationFieldKey, PostsRelationEntityKey>;

  const getTableRef = (table: Pick<ContentIntrospectedTable, "name" | "schema"> | null | undefined) =>
    table ? `${table.schema}.${table.name}` : POSTS_MAPPING_NONE_VALUE;

  const getColumnSelectValue = (value: string | null | undefined) => value?.trim() || POSTS_MAPPING_NONE_VALUE;

  const getTableByRef = (tableRef: string) =>
    mappingDetection?.tables.find((table) => getTableRef(table) === tableRef) ?? null;

  const getTableByName = (tableName: string | null | undefined) =>
    tableName
      ? (getTableByRef(tableName) ??
        mappingDetection?.tables.find((table) => table.name === tableName || getTableRef(table) === tableName) ??
        null)
      : null;

  const getStoredTableRef = (tableNameOrRef: string | null | undefined) => {
    const table = getTableByName(tableNameOrRef);
    return table ? getTableRef(table) : POSTS_MAPPING_NONE_VALUE;
  };

  const isTextLikeColumn = (column: ContentIntrospectedColumn) => {
    const normalizedDataType = column.dataType.toLowerCase();
    const normalizedUdtName = (column.udtName ?? "").toLowerCase();

    return (
      normalizedDataType.includes("char") ||
      normalizedDataType.includes("text") ||
      normalizedDataType.includes("uuid") ||
      normalizedDataType === "citext" ||
      normalizedUdtName.includes("char") ||
      normalizedUdtName.includes("text") ||
      Boolean(column.enumValues?.length)
    );
  };

  const isBooleanLikeColumn = (column: ContentIntrospectedColumn) =>
    column.dataType.toLowerCase() === "boolean";

  const isDateLikeColumn = (column: ContentIntrospectedColumn) => {
    const normalizedDataType = column.dataType.toLowerCase();
    const normalizedUdtName = (column.udtName ?? "").toLowerCase();

    return (
      normalizedDataType.includes("date") ||
      normalizedDataType.includes("time") ||
      normalizedUdtName.includes("date") ||
      normalizedUdtName.includes("time")
    );
  };

  const findColumnByPatterns = (
    table: ContentIntrospectedTable,
    patterns: RegExp[],
    options?: FindColumnOptions,
  ) =>
    table.columns.find((column) => {
      if (options?.requireArray && !column.isArray) {
        return false;
      }

      if (options?.requireBoolean && !isBooleanLikeColumn(column)) {
        return false;
      }

      if (options?.requireDateLike && !isDateLikeColumn(column)) {
        return false;
      }

      if (options?.requireJson && !column.isJson) {
        return false;
      }

      if (options?.requireTextLike && !isTextLikeColumn(column)) {
        return false;
      }

      return patterns.some((pattern) => pattern.test(column.name.toLowerCase()));
    }) ?? null;

  const getTableColumn = (table: ContentIntrospectedTable | null, columnName: string | null | undefined) =>
    table?.columns.find((column) => column.name === columnName) ?? null;

  const getColumnForeignKey = (
    table: ContentIntrospectedTable | null,
    columnName: string | null | undefined,
  ) => table?.foreignKeys.find((foreignKey) => foreignKey.column === columnName) ?? null;

  const findJoinTableBetween = (sourceTable: ContentIntrospectedTable, targetTableRef: string) => {
    const targetTable = getTableByRef(targetTableRef);

    if (!targetTable) {
      return null;
    }

    const sourceTableRef = getTableRef(sourceTable);

    return (
      mappingDetection?.tables.find((table) => {
        const tableRef = getTableRef(table);

        if (tableRef === sourceTableRef || tableRef === targetTableRef) {
          return false;
        }

        const hasSourceForeignKey = table.foreignKeys.some(
          (foreignKey) => `${foreignKey.targetSchema}.${foreignKey.targetTable}` === sourceTableRef,
        );
        const hasTargetForeignKey = table.foreignKeys.some(
          (foreignKey) => `${foreignKey.targetSchema}.${foreignKey.targetTable}` === targetTableRef,
        );

        return hasSourceForeignKey && hasTargetForeignKey;
      }) ?? null
    );
  };

  const getTopEntityTableRef = (entity: Exclude<ContentMappingEntityKey, "posts">) => {
    const candidate = mappingDetection?.candidates[entity].find(
      (entry) => entry.mapping.source.kind === "table" || entry.mapping.source.kind === "view",
    );
    return candidate?.mapping.source.schema && candidate.mapping.source.table
      ? `${candidate.mapping.source.schema}.${candidate.mapping.source.table}`
      : POSTS_MAPPING_NONE_VALUE;
  };

  const getNormalizedSampleValues = (
    table: ContentIntrospectedTable | null,
    columnName: string | null | undefined,
  ) => {
    const normalizedColumnName = columnName?.trim();

    if (!table || !normalizedColumnName) {
      return [];
    }

    return [
      ...new Set(
        table.sampleRows
          .map((row) => row[normalizedColumnName])
          .filter((value) => value !== null && value !== undefined)
          .map((value) => String(value).trim())
          .filter(Boolean)
          .map((value) => value.toLowerCase()),
      ),
    ];
  };

  const detectCustomFieldKind = (
    column: ContentIntrospectedColumn,
  ): ContentCustomFieldMapping["kind"] => {
    if (column.isArray) return "array";
    if (isBooleanLikeColumn(column)) return "boolean";
    if (column.isJson) return "json";
    if (isDateLikeColumn(column)) return column.dataType.toLowerCase().includes("time") ? "datetime" : "date";
    const normalizedDataType = column.dataType.toLowerCase();
    if (
      normalizedDataType.includes("int") ||
      normalizedDataType.includes("numeric") ||
      normalizedDataType.includes("decimal") ||
      normalizedDataType.includes("float") ||
      normalizedDataType.includes("double") ||
      normalizedDataType.includes("real") ||
      normalizedDataType === "money" ||
      normalizedDataType === "serial" ||
      normalizedDataType === "bigserial" ||
      normalizedDataType === "smallserial"
    ) {
      return "number";
    }
    if (column.enumValues && column.enumValues.length >= 2) {
      return "enum";
    }
    return "text";
  };

  const getCustomFieldsForTable = (
    table: ContentIntrospectedTable | null,
    draft: PostsMappingDraftState,
  ): ContentCustomFieldMapping[] => {
    if (!table) return [];

    const mappedColumnNames = new Set(
      [
        draft.idColumn,
        draft.titleColumn,
        draft.slugColumn,
        draft.excerptColumn,
        draft.featuredImageUrlColumn,
        draft.statusColumn,
        draft.createdAtColumn,
        draft.publishedAtColumn,
        draft.redirectsColumn,
        draft.updatedAtColumn,
        draft.seoTitleColumn,
        draft.seoDescriptionColumn,
        draft.focusKeywordColumn,
        ...draft.contentColumns,
        ...draft.legacyCompanionContentColumns.map((entry) => entry.column),
      ].filter((value) => value && value !== POSTS_MAPPING_NONE_VALUE && value !== POSTS_MAPPING_NOT_IN_TABLE_VALUE),
    );

    for (const rel of [draft.author, draft.categories, draft.tags]) {
      if (rel.column && rel.column !== POSTS_MAPPING_NONE_VALUE) {
        mappedColumnNames.add(rel.column);
      }
    }

    const availableCustomFields: ContentCustomFieldMapping[] = table.columns
      .filter((column) => !mappedColumnNames.has(column.name))
      .map((column) => {
        const existing = draft.customFields.find((cf) => cf.column === column.name);
        const sampleValues = getNormalizedSampleValues(table, column.name);
        const isRequired = !column.isNullable && column.defaultValue === null;

        return {
          allowedValues: column.enumValues ?? null,
          arrayIndex: existing?.arrayIndex ?? null,
          column: column.name,
          dataType: column.dataType,
          defaultValue: column.defaultValue,
          enabled: existing ? existing.enabled : isRequired,
          fieldKey: existing?.fieldKey ?? column.name,
          isNullable: column.isNullable,
          kind: existing?.kind ?? detectCustomFieldKind(column),
          label: existing?.label ?? column.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          path: existing?.path ?? null,
          sampleValues,
          ...(existing?.sourceRelation ? { sourceRelation: existing.sourceRelation } : {}),
          sourceType: existing?.sourceType ?? {
            ...(column.udtName
              ? {
                  adapterMetadata: {
                    postgres: {
                      udtName: column.udtName,
                    },
                  },
                }
              : {}),
            isArray: column.isArray,
            isJson: column.isJson,
            nativeType: column.dataType,
          },
        } satisfies ContentCustomFieldMapping;
      });

    const preservedCustomFields = draft.customFields.filter((field) => {
      const normalizedColumn = field.column?.trim();

      return Boolean(
        normalizedColumn &&
          !mappedColumnNames.has(normalizedColumn) &&
          !table.columns.some((column) => column.name === normalizedColumn),
      );
    });

    return [...availableCustomFields, ...preservedCustomFields];
  };

  const parsePostsMappingValues = (value: string) =>
    [...new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean))];

  const classifyPostsStatusValues = (table: ContentIntrospectedTable | null, columnName: string) => {
    const archivedValues: string[] = [];
    const draftValues: string[] = [];
    const publishedValues: string[] = [];
    const column = getTableColumn(table, columnName);
    const values = [
      ...new Set([
        ...getNormalizedSampleValues(table, columnName),
        ...(column?.enumValues ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean),
      ]),
    ];

    for (const value of values) {
      if (/(publish|live|active|public|visible|online)/i.test(value)) {
        publishedValues.push(value);
        continue;
      }

      if (/(draft|review|pending|idea|private|new|staged|scheduled)/i.test(value)) {
        draftValues.push(value);
        continue;
      }

      if (/(archiv|trash|delete|inactive|hidden|retired)/i.test(value)) {
        archivedValues.push(value);
      }
    }

    return {
      archivedValues,
      draftValues,
      publishedValues,
    };
  };

  const detectContentKindForColumn = (
    table: ContentIntrospectedTable | null,
    columnName: string | null | undefined,
  ): PostsMappingDraftState["contentKind"] => {
    const column = getTableColumn(table, columnName);
    const normalizedColumnName = column?.name.toLowerCase() ?? "";

    if (normalizedColumnName.includes("markdown") || normalizedColumnName.endsWith("_md")) {
      return "markdown";
    }

    if (normalizedColumnName.includes("html")) {
      return "html";
    }

    if (column?.isJson) {
      return "json";
    }

    const sampleValues = getNormalizedSampleValues(table, columnName);

    if (sampleValues.some((value) => /<([a-z][a-z0-9]*)\b[^>]*>/i.test(value))) {
      return "html";
    }

    if (sampleValues.some((value) => /(^#{1,6}\s)|(\n[-*]\s)|(\n\d+\.\s)/m.test(value))) {
      return "markdown";
    }

    return "plain_text";
  };

  const normalizeDraftContentKind = (
    kind: string | null | undefined,
    table: ContentIntrospectedTable | null,
    columnName: string | null | undefined,
  ): PostsMappingDraftState["contentKind"] => {
    if (kind === "markdown" || kind === "json" || kind === "plain_text" || kind === "html") {
      return kind;
    }

    return detectContentKindForColumn(table, columnName);
  };

  const getLikelyTargetColumn = (
    targetTableRef: string,
    sourceColumnName?: string | null,
  ) => {
    const targetTable = getTableByRef(targetTableRef);
    const normalizedSourceColumnName = sourceColumnName?.toLowerCase() ?? "";

    if (!targetTable) {
      return POSTS_MAPPING_NONE_VALUE;
    }

    if (normalizedSourceColumnName.includes("slug")) {
      return getColumnSelectValue(
        findColumnByPatterns(targetTable, [/^slug$/, /slug$/], { requireTextLike: true })?.name ??
          targetTable.primaryKey,
      );
    }

    if (
      /(^|_)(id|ids)$/.test(normalizedSourceColumnName) ||
      normalizedSourceColumnName.endsWith("_id") ||
      normalizedSourceColumnName.endsWith("_ids")
    ) {
      return getColumnSelectValue(targetTable.primaryKey);
    }

    return getColumnSelectValue(
      findColumnByPatterns(targetTable, [/^name$/, /^title$/, /^slug$/], {
        requireTextLike: true,
      })?.name ?? targetTable.primaryKey,
    );
  };

  const getJoinRelationDefaults = (
    sourceTable: ContentIntrospectedTable,
    joinTableRef: string,
    targetTableRef: string,
  ) => {
    const joinTable = getTableByRef(joinTableRef);
    const targetTable = getTableByRef(targetTableRef);

    if (!joinTable || !targetTable) {
      return {
        joinSourceColumn: POSTS_MAPPING_NONE_VALUE,
        joinTargetColumn: POSTS_MAPPING_NONE_VALUE,
        targetColumn: POSTS_MAPPING_NONE_VALUE,
      };
    }

    const sourceTableRef = getTableRef(sourceTable);
    const sourceForeignKey = joinTable.foreignKeys.find(
      (foreignKey) => `${foreignKey.targetSchema}.${foreignKey.targetTable}` === sourceTableRef,
    );
    const targetForeignKey = joinTable.foreignKeys.find(
      (foreignKey) => `${foreignKey.targetSchema}.${foreignKey.targetTable}` === targetTableRef,
    );

    return {
      joinSourceColumn: getColumnSelectValue(sourceForeignKey?.column),
      joinTargetColumn: getColumnSelectValue(targetForeignKey?.column),
      targetColumn: getColumnSelectValue(targetForeignKey?.targetColumn ?? targetTable.primaryKey),
    };
  };

  const getRelationFieldConfig = (key: PostsRelationFieldKey): RelationFieldConfig | null => {
    if (key === "author") {
      return {
        fields: [
          {
            fieldKey: "name",
            label: "Name",
            patterns: [/^name$/, /^full_name$/, /^display_name$/, /^author_name$/, /^writer_name$/, /^username$/],
            requireTextLike: true,
          },
          {
            fieldKey: "email",
            label: "Email",
            patterns: [/^email$/, /email$/, /^author_email$/, /^writer_email$/],
            requireTextLike: true,
          },
          {
            fieldKey: "bio",
            label: "Bio",
            patterns: [/^bio$/, /^about$/, /^description$/, /^summary$/],
            requireTextLike: true,
          },
          {
            fieldKey: "slug",
            label: "Slug",
            patterns: [/^slug$/, /slug$/, /^handle$/, /^username$/],
            requireTextLike: true,
          },
        ],
        title: "Author fields",
      };
    }

    if (key === "categories") {
      return {
        fields: [
          {
            fieldKey: "id",
            label: "ID",
            patterns: [/^id$/, /_id$/],
            usePrimaryKey: true,
          },
          {
            fieldKey: "name",
            label: "Name",
            patterns: [/^name$/, /^title$/, /^category_name$/],
            requireTextLike: true,
          },
          {
            fieldKey: "slug",
            label: "Slug",
            patterns: [/^slug$/, /slug$/, /^handle$/],
            requireTextLike: true,
          },
          {
            fieldKey: "description",
            label: "Description",
            patterns: [/^description$/, /^summary$/, /^excerpt$/, /^details$/],
            requireTextLike: true,
          },
          {
            fieldKey: "parentId",
            label: "Parent",
            patterns: [/^parent_category_id$/, /^parent_id$/, /^parent$/, /^parent_category$/],
          },
        ],
        title: "Category fields",
      };
    }

    if (key === "tags") {
      return {
        fields: [
          {
            fieldKey: "id",
            label: "ID",
            patterns: [/^id$/, /_id$/],
            usePrimaryKey: true,
          },
          {
            fieldKey: "name",
            label: "Name",
            patterns: [/^name$/, /^title$/, /^tag_name$/],
            requireTextLike: true,
          },
          {
            fieldKey: "slug",
            label: "Slug",
            patterns: [/^slug$/, /slug$/, /^handle$/],
            requireTextLike: true,
          },
          {
            fieldKey: "description",
            label: "Description",
            patterns: [/^description$/, /^summary$/, /^excerpt$/, /^details$/],
            requireTextLike: true,
          },
        ],
        title: "Tag fields",
      };
    }

    return null;
  };

  const getRelationFieldMapDefaults = (
    key: PostsRelationFieldKey,
    targetTableRef: string,
  ) => {
    const targetTable = getTableByRef(targetTableRef);
    const relationFieldConfig = getRelationFieldConfig(key);

    if (!targetTable || !relationFieldConfig) {
      return {} as Record<string, string>;
    }

    return Object.fromEntries(
      relationFieldConfig.fields
        .map((field) => {
          const detectedColumn = field.usePrimaryKey
            ? targetTable.primaryKey
            : findColumnByPatterns(targetTable, field.patterns, {
                requireTextLike: field.requireTextLike,
              })?.name;

          return detectedColumn
            ? [field.fieldKey, getColumnSelectValue(detectedColumn)]
            : null;
        })
        .filter((entry): entry is [string, string] => Boolean(entry)),
    );
  };

  const applyRelationFieldMapDefaults = (
    key: PostsRelationFieldKey,
    targetTableRef: string,
    fieldMap?: Record<string, string>,
  ) => {
    const detectedDefaults = getRelationFieldMapDefaults(key, targetTableRef);

    return {
      ...detectedDefaults,
      ...(fieldMap ?? {}),
    };
  };

  const getJoinRelationSelectionDefaults = (
    key: PostsRelationFieldKey,
    sourceTable: ContentIntrospectedTable,
    joinTableRef: string,
    currentTargetTableRef?: string,
  ) => {
    const joinTable = getTableByRef(joinTableRef);

    if (!joinTable) {
      return {
        joinSourceColumn: POSTS_MAPPING_NONE_VALUE,
        joinTargetColumn: POSTS_MAPPING_NONE_VALUE,
        targetColumn: POSTS_MAPPING_NONE_VALUE,
        targetTableRef: POSTS_MAPPING_NONE_VALUE,
      };
    }

    const sourceTableRef = getTableRef(sourceTable);
    const preferredTargetTableRef =
      currentTargetTableRef && currentTargetTableRef !== POSTS_MAPPING_NONE_VALUE
        ? currentTargetTableRef
        : getTopEntityTableRef(relationEntityByKey[key]);
    const sourceForeignKey =
      joinTable.foreignKeys.find(
        (foreignKey) => `${foreignKey.targetSchema}.${foreignKey.targetTable}` === sourceTableRef,
      ) ?? null;
    const preferredTargetForeignKey =
      preferredTargetTableRef !== POSTS_MAPPING_NONE_VALUE
        ? (joinTable.foreignKeys.find(
            (foreignKey) =>
              foreignKey.column !== sourceForeignKey?.column &&
              `${foreignKey.targetSchema}.${foreignKey.targetTable}` === preferredTargetTableRef,
          ) ?? null)
        : null;
    const fallbackTargetForeignKey =
      joinTable.foreignKeys.find(
        (foreignKey) =>
          foreignKey.column !== sourceForeignKey?.column &&
          `${foreignKey.targetSchema}.${foreignKey.targetTable}` !== sourceTableRef,
      ) ?? null;
    const selectedTargetForeignKey = preferredTargetForeignKey ?? fallbackTargetForeignKey;
    const resolvedTargetTableRef = selectedTargetForeignKey
      ? `${selectedTargetForeignKey.targetSchema}.${selectedTargetForeignKey.targetTable}`
      : POSTS_MAPPING_NONE_VALUE;
    const resolvedTargetColumn =
      selectedTargetForeignKey?.targetColumn ??
      (resolvedTargetTableRef !== POSTS_MAPPING_NONE_VALUE
        ? getLikelyTargetColumn(resolvedTargetTableRef, selectedTargetForeignKey?.column ?? null)
        : POSTS_MAPPING_NONE_VALUE);

    return {
      joinSourceColumn: getColumnSelectValue(sourceForeignKey?.column),
      joinTargetColumn: getColumnSelectValue(selectedTargetForeignKey?.column),
      targetColumn: getColumnSelectValue(resolvedTargetColumn),
      targetTableRef: resolvedTargetTableRef,
    };
  };

  const getRelationDraftKeyForEntity = (entity: PostsRelationEntityKey): PostsRelationFieldKey =>
    entity === "authors" ? "author" : entity;

  const createEmptyPostsFieldOptionDraft = (): PostsMappingFieldOptionDraft => ({
    arrayItemIndex: "1",
    jsonPath: "",
    relatedColumns: [POSTS_MAPPING_NONE_VALUE],
    relatedTableRef: POSTS_MAPPING_NONE_VALUE,
  });

  const createDefaultPostsFieldOptions = () =>
    POSTS_MAPPING_FIELD_OPTION_KEYS.reduce<Record<PostsMappingFieldOptionKey, PostsMappingFieldOptionDraft>>(
      (result, key) => {
        result[key] = createEmptyPostsFieldOptionDraft();
        return result;
      },
      {} as Record<PostsMappingFieldOptionKey, PostsMappingFieldOptionDraft>,
    );

  const mappedFieldKeyByOptionKey: Partial<Record<PostsMappingFieldOptionKey, keyof ContentEntityMapping["fields"]>> = {
    createdAtColumn: "createdAt",
    excerptColumn: "excerpt",
    featuredImageUrlColumn: "featuredImageUrl",
    focusKeywordColumn: "focusKeyword",
    idColumn: "id",
    publishedAtColumn: "publishedAt",
    redirectsColumn: "redirects",
    seoDescriptionColumn: "seoDescription",
    seoTitleColumn: "seoTitle",
    slugColumn: "slug",
    statusColumn: "status",
    titleColumn: "title",
    updatedAtColumn: "updatedAt",
  };

  const applyMappedFieldOptionArrayIndexes = ({
    draft,
    mapping,
  }: {
    draft: PostsMappingDraftState;
    mapping: ContentEntityMapping;
  }) => {
    for (const [optionKey, fieldKey] of Object.entries(mappedFieldKeyByOptionKey) as Array<
      [PostsMappingFieldOptionKey, keyof ContentEntityMapping["fields"]]
    >) {
      const arrayIndex = mapping.fields[fieldKey]?.arrayIndex;

      if (arrayIndex === null || arrayIndex === undefined) {
        continue;
      }

      draft.fieldOptions[optionKey] = {
        ...draft.fieldOptions[optionKey],
        arrayItemIndex: String(arrayIndex + 1),
      };
    }
  };

  const createContentFieldOptionDraft = ({
    arrayIndex,
    columnName,
    path,
    table,
  }: {
    arrayIndex?: number | null;
    columnName: string | null | undefined;
    path?: string | null;
    table: ContentIntrospectedTable | null;
  }): PostsMappingFieldOptionDraft => {
    const selectedColumn = getTableColumn(table, columnName);

    return {
      ...createEmptyPostsFieldOptionDraft(),
      arrayItemIndex:
        selectedColumn?.isArray && Number.isInteger(arrayIndex) && Number(arrayIndex) >= 0
          ? String(Number(arrayIndex) + 1)
          : "1",
      jsonPath: selectedColumn?.isJson ? path?.trim() ?? "" : "",
    };
  };

  const getRelatedColumnsDraft = (targetColumn: string | null | undefined) => {
    const normalizedTargetColumn = getColumnSelectValue(targetColumn);
    return normalizedTargetColumn === POSTS_MAPPING_NONE_VALUE
      ? [POSTS_MAPPING_NONE_VALUE]
      : [normalizedTargetColumn];
  };

  const getPrimarySelectedColumn = (values: string[]) =>
    values.find((value) => value !== POSTS_MAPPING_NONE_VALUE && value !== POSTS_MAPPING_NOT_IN_TABLE_VALUE) ??
    POSTS_MAPPING_NONE_VALUE;

  const getBooleanStatusValueLists = (mode: PostsMappingBooleanStatusMode) =>
    mode === "false_is_published"
      ? {
          archivedValues: [] as string[],
          draftValues: ["true"],
          publishedValues: ["false"],
        }
      : {
          archivedValues: [] as string[],
          draftValues: ["false"],
          publishedValues: ["true"],
        };

  const getStatusBooleanModeFromPublishedValues = (
    publishedValues: string[] | null | undefined,
  ): PostsMappingBooleanStatusMode =>
    (publishedValues ?? []).some((value) => value.toLowerCase() === "false")
      ? "false_is_published"
      : "true_is_published";

  const isLikelyIdentifierColumnName = (columnName: string | null | undefined) => {
    const normalizedColumnName = columnName?.toLowerCase().trim() ?? "";
    return (
      /(^|_)(id|ids|uuid|uuids)$/.test(normalizedColumnName) ||
      normalizedColumnName.endsWith("_id") ||
      normalizedColumnName.endsWith("_ids") ||
      normalizedColumnName.endsWith("_uuid") ||
      normalizedColumnName.endsWith("_uuids")
    );
  };

  const isLikelyIdentifierArrayColumn = (column: ContentIntrospectedColumn | null) => {
    const normalizedUdtName = (column?.udtName ?? "").toLowerCase();

    return Boolean(
      column?.isArray &&
        (isLikelyIdentifierColumnName(column.name) ||
          normalizedUdtName.includes("uuid") ||
          normalizedUdtName.includes("int") ||
          normalizedUdtName.includes("oid")),
    );
  };

  const createEmptyPostsRelationDraft = (): PostsMappingRelationDraft => ({
    column: POSTS_MAPPING_NONE_VALUE,
    displayColumns: [POSTS_MAPPING_NONE_VALUE],
    fieldMap: {},
    joinSourceColumn: POSTS_MAPPING_NONE_VALUE,
    joinTableRef: POSTS_MAPPING_NONE_VALUE,
    joinTargetColumn: POSTS_MAPPING_NONE_VALUE,
    strategy: "missing",
    targetColumn: POSTS_MAPPING_NONE_VALUE,
    targetTableRef: POSTS_MAPPING_NONE_VALUE,
    valueColumn: POSTS_MAPPING_NONE_VALUE,
  });

  const toRelationDraft = (
    relation: ContentRelationMapping | undefined,
    entity: PostsRelationEntityKey,
  ): PostsMappingRelationDraft => {
    if (!relation || relation.strategy === "none" || relation.status === "unmapped") {
      return createEmptyPostsRelationDraft();
    }

    const resolvedTargetTable =
      getStoredTableRef(relation.targetTable) !== POSTS_MAPPING_NONE_VALUE
        ? getStoredTableRef(relation.targetTable)
        : getTopEntityTableRef(entity);
    const resolvedJoinTable = getStoredTableRef(relation.junctionTable);

    if (relation.strategy === "join_table" || relation.strategy === "inline_fields") {
      return {
        column: POSTS_MAPPING_NOT_IN_TABLE_VALUE,
        displayColumns: getRelatedColumnsDraft(relation.targetColumn),
        fieldMap:
          resolvedTargetTable !== POSTS_MAPPING_NONE_VALUE
            ? applyRelationFieldMapDefaults(getRelationDraftKeyForEntity(entity), resolvedTargetTable, relation.fieldMap)
            : { ...relation.fieldMap },
        joinSourceColumn: getColumnSelectValue(relation.junctionSourceColumn),
        joinTableRef: resolvedJoinTable,
        joinTargetColumn: getColumnSelectValue(relation.junctionTargetColumn),
        strategy: relation.strategy,
        targetColumn: getColumnSelectValue(relation.targetColumn),
        targetTableRef: resolvedTargetTable,
        valueColumn: getColumnSelectValue(relation.valueColumn),
      };
    }

    return {
      column: getColumnSelectValue(relation.sourceColumn),
      displayColumns: getRelatedColumnsDraft(relation.targetColumn),
      fieldMap:
        resolvedTargetTable !== POSTS_MAPPING_NONE_VALUE
          ? applyRelationFieldMapDefaults(getRelationDraftKeyForEntity(entity), resolvedTargetTable, relation.fieldMap)
          : { ...relation.fieldMap },
      joinSourceColumn: getColumnSelectValue(relation.junctionSourceColumn),
      joinTableRef: resolvedJoinTable,
      joinTargetColumn: getColumnSelectValue(relation.junctionTargetColumn),
      strategy: relation.strategy,
      targetColumn: getColumnSelectValue(relation.targetColumn),
      targetTableRef: resolvedTargetTable,
      valueColumn: getColumnSelectValue(relation.valueColumn),
    };
  };

  const createPostsMappingDraftFromDetectedMapping = (
    mapping: ContentEntityMapping,
    savedFilesStorage?: PostsMappingDraftState["filesStorage"] | null,
    savedMediaStorage?: PostsMappingDraftState["mediaStorage"] | null,
  ): PostsMappingDraftState => {
    const tableRef =
      mapping.source.schema && mapping.source.table
        ? `${mapping.source.schema}.${mapping.source.table}`
        : POSTS_MAPPING_NONE_VALUE;
    const table = getTableByRef(tableRef);
    const statusColumn = getColumnSelectValue(mapping.workflow?.statusColumn ?? mapping.fields.status.column);
    const statusBooleanMode = getStatusBooleanModeFromPublishedValues(mapping.workflow?.publishedValues);
    const contentColumns = mapping.editorFields
      .map((field) => getColumnSelectValue(field.column))
      .filter((value) => value !== POSTS_MAPPING_NONE_VALUE);
    const detectedAuthorRelation = table ? detectRelationDraftForTable(table, "authors", [/^author$/, /^author_ids$/, /^author_id$/]) : createEmptyPostsRelationDraft();
    const detectedCategoriesRelation = table ? detectRelationDraftForTable(table, "categories", [
      /^categories$/,
      /^category_ids$/,
      /^category_names$/,
      /^category$/,
    ]) : createEmptyPostsRelationDraft();
    const detectedTagsRelation = table ? detectRelationDraftForTable(table, "tags", [/^tags$/, /^tag_ids$/, /^tag_names$/, /^keywords$/]) : createEmptyPostsRelationDraft();
    const mappedAuthorRelation = toRelationDraft(mapping.relations.authors, "authors");
    const mappedCategoriesRelation = toRelationDraft(mapping.relations.categories, "categories");
    const mappedTagsRelation = toRelationDraft(mapping.relations.tags, "tags");
    const contentColumnKinds = (contentColumns.length > 0 ? mapping.editorFields : [])
      .map((field) => normalizeDraftContentKind(field.kind, table, field.column))
      .slice(0, contentColumns.length);
    const contentFieldOptions = (contentColumns.length > 0 ? mapping.editorFields : [])
      .map((field) =>
        createContentFieldOptionDraft({
          arrayIndex: field.arrayIndex ?? null,
          columnName: field.column,
          path: field.path,
          table,
        }),
      )
      .slice(0, contentColumns.length);
    const primaryContentFieldOption = contentFieldOptions[0] ?? createEmptyPostsFieldOptionDraft();

    const draft: PostsMappingDraftState = {
      archivedValues: mapping.workflow?.archivedValues ?? [],
      author:
        mappedAuthorRelation.strategy === "missing" && detectedAuthorRelation.strategy !== "missing"
          ? detectedAuthorRelation
          : mappedAuthorRelation,
      categories:
        mappedCategoriesRelation.strategy === "missing" &&
        detectedCategoriesRelation.strategy !== "missing"
          ? detectedCategoriesRelation
          : mappedCategoriesRelation,
      contentColumns: contentColumns.length > 0 ? contentColumns : [POSTS_MAPPING_NONE_VALUE],
      contentFieldOptions:
        contentFieldOptions.length > 0 ? contentFieldOptions : [createEmptyPostsFieldOptionDraft()],
      contentColumnKinds:
        contentColumnKinds.length > 0
          ? contentColumnKinds
          : [
              normalizeDraftContentKind(
                mapping.editorFields[0]?.kind,
                table,
                contentColumns[0] ?? mapping.editorFields[0]?.column,
              ),
            ],
      contentKind:
        normalizeDraftContentKind(
          mapping.editorFields[0]?.kind,
          table,
          contentColumns[0] ?? mapping.editorFields[0]?.column,
        ),
      createdAtColumn: getColumnSelectValue(mapping.fields.createdAt?.column),
      customFields: mapping.customFields ?? [],
      draftValues: mapping.workflow?.draftValues ?? [],
      excerptColumn: getColumnSelectValue(mapping.fields.excerpt.column),
      featuredImageUrlColumn: getColumnSelectValue(mapping.fields.featuredImageUrl?.column),
      fieldOptions: {
        ...createDefaultPostsFieldOptions(),
        contentColumn: primaryContentFieldOption,
      },
      focusKeywordColumn: getColumnSelectValue(mapping.fields.focusKeyword?.column),
      filesStorage: savedFilesStorage ?? defaultFilesStorageDraft(),
      idColumn: getColumnSelectValue(mapping.fields.id.column),
      legacyCompanionContentColumns: mapping.companionContentColumns ?? [],
      mediaStorage: savedMediaStorage ?? defaultMediaStorageDraft(),
      publishedAtColumn: getColumnSelectValue(mapping.workflow?.publishedAtColumn),
      publishedValues: mapping.workflow?.publishedValues ?? [],
      redirectsColumn: getColumnSelectValue(mapping.fields.redirects?.column),
      seoDescriptionColumn: getColumnSelectValue(mapping.fields.seoDescription?.column),
      seoTitleColumn: getColumnSelectValue(mapping.fields.seoTitle?.column),
      slugColumn: getColumnSelectValue(mapping.fields.slug.column),
      statusBooleanMode,
      statusColumn,
      tableRef,
      tags:
        mappedTagsRelation.strategy === "missing" && detectedTagsRelation.strategy !== "missing"
          ? detectedTagsRelation
          : mappedTagsRelation,
      titleColumn: getColumnSelectValue(mapping.fields.title.column),
      updatedAtColumn: getColumnSelectValue(mapping.fields.updatedAt?.column),
    };

    applyMappedFieldOptionArrayIndexes({
      draft,
      mapping,
    });
    draft.customFields = getCustomFieldsForTable(table, draft);

    return draft;
  };

  const detectRelationDraftForTable = (
    table: ContentIntrospectedTable,
    entity: PostsRelationEntityKey,
    patterns: RegExp[],
  ): PostsMappingRelationDraft => {
    const topEntityTableRef = getTopEntityTableRef(entity);

    if (entity === "authors") {
      const authorForeignKey =
        table.foreignKeys.find((foreignKey) =>
          /(author|writer|user|member|profile)/.test(foreignKey.targetTable.toLowerCase()),
        ) ?? null;

      if (authorForeignKey) {
        const targetTableRef = `${authorForeignKey.targetSchema}.${authorForeignKey.targetTable}`;

        return {
          column: authorForeignKey.column,
          displayColumns: getRelatedColumnsDraft(authorForeignKey.targetColumn),
          fieldMap: applyRelationFieldMapDefaults("author", targetTableRef),
          joinSourceColumn: POSTS_MAPPING_NONE_VALUE,
          joinTableRef: POSTS_MAPPING_NONE_VALUE,
          joinTargetColumn: POSTS_MAPPING_NONE_VALUE,
          strategy: "foreign_key",
          targetColumn: getColumnSelectValue(authorForeignKey.targetColumn),
          targetTableRef,
          valueColumn: POSTS_MAPPING_NONE_VALUE,
        };
      }

      const authorNameColumn = findColumnByPatterns(table, [/^author_name$/, /^author$/, /^writer_name$/], {
        requireTextLike: true,
      });
      const authorEmailColumn = findColumnByPatterns(table, [/^author_email$/, /^writer_email$/], {
        requireTextLike: true,
      });

      if (authorNameColumn || authorEmailColumn) {
        return {
          column: POSTS_MAPPING_NOT_IN_TABLE_VALUE,
          displayColumns: [POSTS_MAPPING_NONE_VALUE],
          fieldMap: {
            ...(authorNameColumn ? { name: authorNameColumn.name } : {}),
            ...(authorEmailColumn ? { email: authorEmailColumn.name } : {}),
          },
          joinSourceColumn: POSTS_MAPPING_NONE_VALUE,
          joinTableRef: POSTS_MAPPING_NONE_VALUE,
          joinTargetColumn: POSTS_MAPPING_NONE_VALUE,
          strategy: "inline_fields",
          targetColumn: POSTS_MAPPING_NONE_VALUE,
          targetTableRef: topEntityTableRef,
          valueColumn: POSTS_MAPPING_NONE_VALUE,
        };
      }
    }

    if (topEntityTableRef !== POSTS_MAPPING_NONE_VALUE) {
      const directForeignKey = table.foreignKeys.find(
        (foreignKey) => `${foreignKey.targetSchema}.${foreignKey.targetTable}` === topEntityTableRef,
      );

      if (directForeignKey) {
        return {
          column: directForeignKey.column,
          displayColumns: getRelatedColumnsDraft(directForeignKey.targetColumn),
          fieldMap:
            topEntityTableRef !== POSTS_MAPPING_NONE_VALUE
              ? applyRelationFieldMapDefaults(getRelationDraftKeyForEntity(entity), topEntityTableRef)
              : {},
          joinSourceColumn: POSTS_MAPPING_NONE_VALUE,
          joinTableRef: POSTS_MAPPING_NONE_VALUE,
          joinTargetColumn: POSTS_MAPPING_NONE_VALUE,
          strategy: "foreign_key",
          targetColumn: getColumnSelectValue(directForeignKey.targetColumn),
          targetTableRef: topEntityTableRef,
          valueColumn: POSTS_MAPPING_NONE_VALUE,
        };
      }

      const joinTable = findJoinTableBetween(table, topEntityTableRef);

      if (joinTable) {
        const joinDefaults = getJoinRelationDefaults(table, getTableRef(joinTable), topEntityTableRef);

        return {
          column: POSTS_MAPPING_NOT_IN_TABLE_VALUE,
          displayColumns: getRelatedColumnsDraft(joinDefaults.targetColumn),
          fieldMap:
            topEntityTableRef !== POSTS_MAPPING_NONE_VALUE
              ? applyRelationFieldMapDefaults(getRelationDraftKeyForEntity(entity), topEntityTableRef)
              : {},
          joinSourceColumn: joinDefaults.joinSourceColumn,
          joinTableRef: getTableRef(joinTable),
          joinTargetColumn: joinDefaults.joinTargetColumn,
          strategy: "join_table",
          targetColumn: joinDefaults.targetColumn,
          targetTableRef: topEntityTableRef,
          valueColumn: POSTS_MAPPING_NONE_VALUE,
        };
      }
    }

    const arrayColumn = findColumnByPatterns(table, patterns, { requireArray: true });

    if (arrayColumn) {
      const authorFieldMapDefaults =
        topEntityTableRef !== POSTS_MAPPING_NONE_VALUE
          ? applyRelationFieldMapDefaults(getRelationDraftKeyForEntity(entity), topEntityTableRef)
          : {};

      return {
        column: arrayColumn.name,
        displayColumns: getRelatedColumnsDraft(
          isLikelyIdentifierArrayColumn(arrayColumn)
            ? getLikelyTargetColumn(topEntityTableRef, arrayColumn.name)
            : POSTS_MAPPING_NONE_VALUE,
        ),
        fieldMap: authorFieldMapDefaults,
        joinSourceColumn: POSTS_MAPPING_NONE_VALUE,
        joinTableRef: POSTS_MAPPING_NONE_VALUE,
        joinTargetColumn: POSTS_MAPPING_NONE_VALUE,
        strategy: "array",
        targetColumn: getLikelyTargetColumn(topEntityTableRef, arrayColumn.name),
        targetTableRef: topEntityTableRef,
        valueColumn: arrayColumn.name,
      };
    }

    const jsonColumn = findColumnByPatterns(table, patterns, { requireJson: true });

    if (jsonColumn) {
      return {
        column: jsonColumn.name,
        displayColumns: getRelatedColumnsDraft(getLikelyTargetColumn(topEntityTableRef, jsonColumn.name)),
        fieldMap:
          topEntityTableRef !== POSTS_MAPPING_NONE_VALUE
            ? applyRelationFieldMapDefaults(getRelationDraftKeyForEntity(entity), topEntityTableRef)
            : {},
        joinSourceColumn: POSTS_MAPPING_NONE_VALUE,
        joinTableRef: POSTS_MAPPING_NONE_VALUE,
        joinTargetColumn: POSTS_MAPPING_NONE_VALUE,
        strategy: "json_array",
        targetColumn: getLikelyTargetColumn(topEntityTableRef, jsonColumn.name),
        targetTableRef: topEntityTableRef,
        valueColumn: jsonColumn.name,
      };
    }

    const textColumn = findColumnByPatterns(table, patterns, { requireTextLike: true });

    if (textColumn) {
      return {
        column: textColumn.name,
        displayColumns: [POSTS_MAPPING_NONE_VALUE],
        fieldMap:
          topEntityTableRef !== POSTS_MAPPING_NONE_VALUE
            ? applyRelationFieldMapDefaults(getRelationDraftKeyForEntity(entity), topEntityTableRef)
            : {},
        joinSourceColumn: POSTS_MAPPING_NONE_VALUE,
        joinTableRef: POSTS_MAPPING_NONE_VALUE,
        joinTargetColumn: POSTS_MAPPING_NONE_VALUE,
        strategy: "derived_distinct",
        targetColumn: getLikelyTargetColumn(topEntityTableRef, textColumn.name),
        targetTableRef: topEntityTableRef,
        valueColumn: textColumn.name,
      };
    }

    return createEmptyPostsRelationDraft();
  };

  const createPostsMappingDraftFromTable = (tableRef: string) => {
    const candidate =
      mappingDetection?.candidates.posts.find((entry) => {
        const source = entry.mapping.source;
        return source.schema && source.table ? `${source.schema}.${source.table}` === tableRef : entry.label === tableRef;
      }) ?? null;

    if (candidate) {
      return createPostsMappingDraftFromDetectedMapping(candidate.mapping);
    }

    const table = getTableByRef(tableRef);

    if (!table) {
      return null;
    }

    const detectedContentFields = detectContentColumns(table);
    const contentColumns = detectedContentFields.map((field) => getColumnSelectValue(field.column));
    const contentColumnKinds = detectedContentFields.map((field) =>
      normalizeDraftContentKind(field.kind, table, field.column),
    );
    const contentFieldOptions = detectedContentFields.map((field) =>
      createContentFieldOptionDraft({
        arrayIndex: null,
        columnName: field.column,
        path: null,
        table,
      }),
    );
    const primaryContentColumn = contentColumns[0] ?? POSTS_MAPPING_NONE_VALUE;
    const statusColumn = findColumnByPatterns(
      table,
      statusColumnPatterns,
      {
        requireTextLike: true,
      },
    )?.name;
    const classifiedStatusValues = statusColumn
      ? classifyPostsStatusValues(table, statusColumn)
      : { archivedValues: [], draftValues: [], publishedValues: [] };
    const publishedFlagColumn = findColumnByPatterns(
      table,
      publishedFlagColumnPatterns,
      {
        requireBoolean: true,
      },
    )?.name;
    const resolvedStatusColumn = statusColumn ?? publishedFlagColumn ?? null;
    const initialStatusBooleanMode: PostsMappingBooleanStatusMode = "true_is_published";
    const resolvedStatusField = resolvedStatusColumn ? getTableColumn(table, resolvedStatusColumn) : null;
    const initialStatusValues =
      resolvedStatusField && isBooleanLikeColumn(resolvedStatusField)
        ? getBooleanStatusValueLists(initialStatusBooleanMode)
        : classifiedStatusValues;

    const draft: PostsMappingDraftState = {
      archivedValues: initialStatusValues.archivedValues,
      author: detectRelationDraftForTable(table, "authors", [/^author$/, /^author_ids$/, /^author_id$/]),
      categories: detectRelationDraftForTable(table, "categories", [
        /^categories$/,
        /^category_ids$/,
        /^category_names$/,
        /^category$/,
      ]),
      contentColumns: contentColumns.length > 0 ? contentColumns : [POSTS_MAPPING_NONE_VALUE],
      contentFieldOptions:
        contentFieldOptions.length > 0 ? contentFieldOptions : [createEmptyPostsFieldOptionDraft()],
      contentColumnKinds:
        contentColumnKinds.length > 0
          ? contentColumnKinds
          : [detectContentKindForColumn(table, primaryContentColumn)],
      contentKind:
        contentColumnKinds[0] ?? detectContentKindForColumn(table, primaryContentColumn),
      createdAtColumn: getColumnSelectValue(
        findColumnByPatterns(table, [/^created_at$/, /^created_on$/, /^inserted_at$/, /^date_created$/], {
          requireDateLike: true,
        })?.name,
      ),
      customFields: [],
      draftValues: initialStatusValues.draftValues,
      excerptColumn: getColumnSelectValue(
        findColumnByPatterns(table, [/^excerpt$/, /^summary$/, /^description$/, /^dek$/], {
          requireTextLike: true,
        })?.name,
      ),
      featuredImageUrlColumn: getColumnSelectValue(
        findColumnByPatterns(table, [/^featured_image_url$/, /^cover_image$/, /^image_url$/, /^thumbnail_url$/], {
          requireTextLike: true,
        })?.name,
      ),
      fieldOptions: {
        ...createDefaultPostsFieldOptions(),
        contentColumn: contentFieldOptions[0] ?? createEmptyPostsFieldOptionDraft(),
      },
      focusKeywordColumn: getColumnSelectValue(
        findColumnByPatterns(table, focusKeywordColumnPatterns, {
          requireTextLike: true,
        })?.name,
      ),
      filesStorage: defaultFilesStorageDraft(),
      idColumn: getColumnSelectValue(table.primaryKey),
      legacyCompanionContentColumns: [],
      mediaStorage: defaultMediaStorageDraft(),
      publishedAtColumn: getColumnSelectValue(
        findColumnByPatterns(table, publishedAtColumnPatterns, {
          requireDateLike: true,
        })?.name,
      ),
      publishedValues: initialStatusValues.publishedValues,
      redirectsColumn: getColumnSelectValue(
        findColumnByPatterns(table, redirectsColumnPatterns, {
          requireArray: true,
        })?.name ??
          findColumnByPatterns(table, redirectsColumnPatterns, {
            requireJson: true,
          })?.name ??
          findColumnByPatterns(table, redirectsColumnPatterns, {
            requireTextLike: true,
          })?.name,
      ),
      seoDescriptionColumn: getColumnSelectValue(
        findColumnByPatterns(table, seoDescriptionColumnPatterns, {
          requireTextLike: true,
        })?.name,
      ),
      seoTitleColumn: getColumnSelectValue(
        findColumnByPatterns(table, seoTitleColumnPatterns, {
          requireTextLike: true,
        })?.name,
      ),
      slugColumn: getColumnSelectValue(
        findColumnByPatterns(table, [/^slug$/, /slug$/, /^handle$/], {
          requireTextLike: true,
        })?.name,
      ),
      statusBooleanMode: initialStatusBooleanMode,
      statusColumn: getColumnSelectValue(resolvedStatusColumn),
      tableRef,
      tags: detectRelationDraftForTable(table, "tags", [/^tags$/, /^tag_ids$/, /^tag_names$/, /^keywords$/]),
      titleColumn: getColumnSelectValue(
        findColumnByPatterns(table, [/^title$/, /^headline$/, /^name$/, /post_title$/, /article_title$/], {
          requireTextLike: true,
        })?.name,
      ),
      updatedAtColumn: getColumnSelectValue(
        findColumnByPatterns(table, [/^updated_at$/, /^updated_on$/, /^modified_at$/, /^last_updated_at$/], {
          requireDateLike: true,
        })?.name,
      ),
    };

    draft.customFields = getCustomFieldsForTable(table, draft);

    return draft;
  };

  return {
    applyRelationFieldMapDefaults,
    classifyPostsStatusValues,
    createEmptyPostsFieldOptionDraft,
    createPostsMappingDraftFromDetectedMapping,
    createPostsMappingDraftFromTable,
    detectContentKindForColumn,
    findJoinTableBetween,
    getBooleanStatusValueLists,
    getColumnForeignKey,
    getColumnSelectValue,
    getCustomFieldsForTable,
    getNormalizedSampleValues,
    getJoinRelationSelectionDefaults,
    getLikelyTargetColumn,
    getPrimarySelectedColumn,
    getRelationDraftKeyForEntity,
    getRelationFieldConfig,
    getRelatedColumnsDraft,
    getStoredTableRef,
    getTableByRef,
    getTableColumn,
    getTableRef,
    getTopEntityTableRef,
    isBooleanLikeColumn,
    isLikelyIdentifierArrayColumn,
    parsePostsMappingValues,
    relationEntityByKey,
  };
}
