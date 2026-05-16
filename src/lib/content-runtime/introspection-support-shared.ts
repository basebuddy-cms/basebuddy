import {
  createDefaultContentMappingConfig,
  type ContentEditorField,
  type ContentMappedField,
  type ContentMappingEntityKey,
  type ContentPostWorkflowMapping,
  type ContentRelationMapping,
  type ContentTimestampSourceHint,
} from "./mapping";

import type {
  ContentAutoMappingCandidate,
  ContentAutoMappingCandidatePreview,
  ContentIntrospectedColumn,
  ContentIntrospectedTable,
} from "./introspection";

export type ScoredEntityCandidate = ContentAutoMappingCandidate & {
  score: number;
  tableRef: string | null;
};

export const ENTITY_KEYS = ["posts", "categories", "tags", "authors", "media", "files"] as const;

export const toTableRef = (table: Pick<ContentIntrospectedTable, "name" | "schema">) =>
  `${table.schema}.${table.name}`;

const tokenizeIdentifier = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

export const toLabel = (value: string) =>
  tokenizeIdentifier(value)
    .map((segment) => (segment ? segment[0]?.toUpperCase() + segment.slice(1) : ""))
    .join(" ");

const unique = <T,>(values: T[]) => [...new Set(values)];

const POST_SOURCE_NAME_PATTERN = /(post|article|story|news|entry|page|blog)/;
const REVISION_LIKE_NAME_PATTERN =
  /(revision|revisions|history|histories|audit|audits|version|versions|snapshot|snapshots)/;
const AUDIT_LIKE_TIMESTAMP_COLUMN_PATTERN =
  /(^|_)(audit|logged|event|events|webhook|sync|synced|import|imported|processed|replicated|replication|refreshed|refresh|last_seen|last_login|last_active|seen|visited)(_at|_on|_date|_time)$/;
const STATUS_COLUMN_PATTERNS = [
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
const PUBLISHED_FLAG_COLUMN_PATTERNS = [
  /^is_published$/,
  /^published$/,
  /^is_live$/,
  /^live$/,
  /^is_public$/,
  /^visible$/,
];
const PUBLISHED_AT_COLUMN_PATTERNS = [
  /^published_at$/,
  /^published_on$/,
  /^published_date$/,
  /^live_at$/,
  /^posted_at$/,
];
const SEO_TITLE_COLUMN_PATTERNS = [
  /^seo_title$/,
  /^meta_title$/,
  /^title_tag$/,
  /(^|_)(seo|meta)_title(_tag)?$/,
];
const SEO_DESCRIPTION_COLUMN_PATTERNS = [
  /^seo_description$/,
  /^meta_description$/,
  /^meta_desc$/,
  /(^|_)(seo|meta)_(description|desc)$/,
];
const FOCUS_KEYWORD_COLUMN_PATTERNS = [
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
const REDIRECT_COLUMN_PATTERNS = [
  /^redirects$/,
  /^redirect_paths$/,
  /^redirect_urls$/,
  /^old_paths$/,
  /^old_slugs$/,
  /^legacy_paths$/,
  /^aliases$/,
];

const stringifySampleValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const getPreviewValueMap = (
  table: ContentIntrospectedTable,
  columnNames: string[],
): Record<string, string[]> =>
  Object.fromEntries(
    columnNames.map((columnName) => [
      columnName,
      unique(
        table.sampleRows
          .map((row) => stringifySampleValue(row[columnName]))
          .filter(Boolean),
      ).slice(0, 5),
    ]),
  );

export const findColumn = (
  table: ContentIntrospectedTable,
  patterns: RegExp[],
  options?: {
    requireArray?: boolean;
    requireBoolean?: boolean;
    requireDateLike?: boolean;
    requireJson?: boolean;
    requireTextLike?: boolean;
  },
) => {
  const eligibleColumns = table.columns.filter((column) => {
    const normalizedDataType = column.dataType.toLowerCase();
    const normalizedUdtName = (column.udtName ?? "").toLowerCase();
    const isBooleanLike = normalizedDataType === "boolean";
    const isDateLike =
      normalizedDataType.includes("date") ||
      normalizedDataType.includes("time") ||
      normalizedUdtName.includes("date") ||
      normalizedUdtName.includes("time");
    const isTextLike = isTextLikeColumn(column);

    if (options?.requireArray && !column.isArray) {
      return false;
    }

    if (options?.requireBoolean && !isBooleanLike) {
      return false;
    }

    if (options?.requireDateLike && !isDateLike) {
      return false;
    }

    if (options?.requireJson && !column.isJson) {
      return false;
    }

    if (options?.requireTextLike && !isTextLike) {
      return false;
    }

    return true;
  });

  for (const pattern of patterns) {
    const match = eligibleColumns.find((column) => pattern.test(column.name.toLowerCase()));
    if (match) {
      return match;
    }
  }

  return null;
};

export const getSampleValues = (table: ContentIntrospectedTable, columnName: string | null | undefined) => {
  const normalizedColumnName = columnName?.trim();

  if (!normalizedColumnName) {
    return [];
  }

  return unique(
    table.sampleRows
      .map((row) => row[normalizedColumnName])
      .filter((value) => value !== null && value !== undefined),
  ).slice(0, 12);
};

export const isTextLikeColumn = (column: ContentIntrospectedColumn) => {
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

const classifyStatusValues = (values: unknown[]) => {
  const archivedValues: string[] = [];
  const customValues: string[] = [];
  const draftValues: string[] = [];
  const publishedValues: string[] = [];

  for (const value of values) {
    const normalizedValue = stringifySampleValue(value).toLowerCase();

    if (!normalizedValue) {
      continue;
    }

    if (/(publish|live|active|public|visible|online)/i.test(normalizedValue)) {
      publishedValues.push(normalizedValue);
      continue;
    }

    if (/(draft|review|pending|idea|private|new|staged|scheduled)/i.test(normalizedValue)) {
      draftValues.push(normalizedValue);
      continue;
    }

    if (/(archiv|trash|delete|inactive|hidden|retired)/i.test(normalizedValue)) {
      archivedValues.push(normalizedValue);
      continue;
    }

    customValues.push(normalizedValue);
  }

  return {
    archivedValues: unique(archivedValues),
    customValues: unique(customValues),
    draftValues: unique(draftValues),
    publishedValues: unique(publishedValues),
  };
};

export const detectWorkflow = (table: ContentIntrospectedTable): ContentPostWorkflowMapping => {
  const workflow = createDefaultContentMappingConfig().entities.posts.workflow as ContentPostWorkflowMapping;
  const statusColumn = getStatusColumn(table);
  const publishFlagColumn = getPublishedFlagColumn(table);
  const publishedAtColumn = getPublishedAtColumn(table);

  if (statusColumn) {
    const classifiedValues = classifyStatusValues([
      ...getSampleValues(table, statusColumn.name),
      ...(statusColumn.enumValues ?? []),
    ]);

    return {
      ...workflow,
      ...classifiedValues,
      mode: publishFlagColumn ? "status_with_flag" : "status",
      publishedAtColumn: publishedAtColumn?.name ?? null,
      publishedFlagColumn: publishFlagColumn?.name ?? null,
      statusColumn: statusColumn.name,
    };
  }

  if (publishFlagColumn) {
    return {
      ...workflow,
      mode: publishedAtColumn ? "status_with_flag" : "published_flag",
      publishedAtColumn: publishedAtColumn?.name ?? null,
      publishedFlagColumn: publishFlagColumn.name,
      publishedValues: ["true"],
    };
  }

  if (publishedAtColumn) {
    return {
      ...workflow,
      mode: "published_at",
      publishedAtColumn: publishedAtColumn.name,
    };
  }

  return workflow;
};

const isPrimaryExcerptColumnName = (value: string) => /^(excerpt|summary)$/i.test(value);

const isContentFormatColumnName = (value: string) => /(^|_)(content_)?format$/.test(value);

const isSeoMetadataColumnName = (value: string) =>
  SEO_TITLE_COLUMN_PATTERNS.some((pattern) => pattern.test(value)) ||
  SEO_DESCRIPTION_COLUMN_PATTERNS.some((pattern) => pattern.test(value)) ||
  FOCUS_KEYWORD_COLUMN_PATTERNS.some((pattern) => pattern.test(value));

const isRevisionLikeTable = (table: ContentIntrospectedTable) => {
  const tableName = table.name.toLowerCase();
  const columnNames = table.columns.map((column) => column.name.toLowerCase());
  const hasRevisionName = REVISION_LIKE_NAME_PATTERN.test(tableName);
  const hasRevisionCounter = columnNames.some((columnName) =>
    /(^revision_number$|^revision_id$|^version_number$|^version_id$|^snapshot_id$)/.test(columnName),
  );
  const hasParentPostReference = columnNames.some((columnName) =>
    /(^post_id$|_post_id$|^article_id$|_article_id$|^entry_id$|_entry_id$)/.test(columnName),
  );

  return (
    (hasRevisionName && POST_SOURCE_NAME_PATTERN.test(tableName)) ||
    (hasRevisionName && hasParentPostReference) ||
    (hasRevisionCounter && hasParentPostReference)
  );
};

const findIntrospectedColumn = (
  table: ContentIntrospectedTable,
  columnName: string | null | undefined,
) => {
  const normalizedColumnName = columnName?.trim().toLowerCase();

  if (!normalizedColumnName) {
    return null;
  }

  return table.columns.find((column) => column.name.toLowerCase() === normalizedColumnName) ?? null;
};

const triggerDefinitionMentionsColumn = (triggerDefinition: string, columnName: string) => {
  const normalizedDefinition = triggerDefinition.toLowerCase();
  const normalizedColumnName = columnName.toLowerCase();

  if (normalizedDefinition.includes(`'${normalizedColumnName}'`)) {
    return true;
  }

  if (normalizedDefinition.includes(`"${normalizedColumnName}"`)) {
    return true;
  }

  const escapedColumnName = normalizedColumnName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9_])${escapedColumnName}($|[^a-z0-9_])`).test(normalizedDefinition);
};

export const detectTimestampSourceHint = (
  table: ContentIntrospectedTable,
  columnName: string | null | undefined,
): ContentTimestampSourceHint | null => {
  const column = findIntrospectedColumn(table, columnName);

  if (!column) {
    return null;
  }

  if (table.kind === "view") {
    return "view_derived";
  }

  if (column.isGenerated) {
    return "generated";
  }

  if (
    isRevisionLikeTable(table) ||
    AUDIT_LIKE_TIMESTAMP_COLUMN_PATTERN.test(column.name.toLowerCase())
  ) {
    return "audit_derived";
  }

  if (
    (table.triggerDefinitions ?? []).some((triggerDefinition) =>
      triggerDefinitionMentionsColumn(triggerDefinition, column.name),
    )
  ) {
    return "trigger_managed";
  }

  return null;
};

const inferEditorFieldKind = (
  table: ContentIntrospectedTable,
  column: ContentIntrospectedColumn,
): ContentEditorField["kind"] => {
  const normalizedName = column.name.toLowerCase();

  if (normalizedName.includes("markdown") || normalizedName.endsWith("_md")) {
    return "markdown";
  }

  if (normalizedName.includes("html")) {
    return "html";
  }

  if (column.isJson) {
    return "rich_text";
  }

  const sampleValues = getSampleValues(table, column.name).map((value) => stringifySampleValue(value));

  if (sampleValues.some((value) => /<([a-z][a-z0-9]*)\b[^>]*>/i.test(value))) {
    return "html";
  }

  if (sampleValues.some((value) => /(^#{1,6}\s)|(\n[-*]\s)|(\n\d+\.\s)/m.test(value))) {
    return "markdown";
  }

  if (
    normalizedName.includes("intro") ||
    normalizedName.includes("summary") ||
    normalizedName.includes("excerpt") ||
    normalizedName.includes("outro") ||
    normalizedName.includes("description")
  ) {
    return "plain_text";
  }

  return "rich_text";
};

export const detectContentColumns = (table: ContentIntrospectedTable) => {
  const columnNameSet = new Set(table.columns.map((column) => column.name.toLowerCase()));
  const sampleValuesByColumn = new Map(
    table.columns.map((column) => [
      column.name.toLowerCase(),
      getSampleValues(table, column.name).map((value) => stringifySampleValue(value)).filter(Boolean),
    ]),
  );
  const weightedColumns = table.columns
    .filter((column) => {
      const normalizedDataType = column.dataType.toLowerCase();
      return column.isJson || normalizedDataType.includes("text") || normalizedDataType.includes("char");
    })
    .map((column) => {
      const normalizedName = column.name.toLowerCase();
      const sampleValues = sampleValuesByColumn.get(normalizedName) ?? [];
      const siblingMarkdownColumn =
        normalizedName.endsWith("_html") || normalizedName.endsWith("_json")
          ? normalizedName.replace(/_(html|json)$/, "_markdown")
          : null;
      const siblingHtmlColumn =
        normalizedName.endsWith("_markdown") || normalizedName.endsWith("_json")
          ? normalizedName.replace(/_(markdown|json)$/, "_html")
          : null;
      const hasReadableTextCompanionForJson =
        normalizedName.endsWith("_json") &&
        Boolean(
          (siblingMarkdownColumn && columnNameSet.has(siblingMarkdownColumn)) ||
            (siblingHtmlColumn && columnNameSet.has(siblingHtmlColumn)),
        );
      const siblingMarkdownHasValues = siblingMarkdownColumn
        ? (sampleValuesByColumn.get(siblingMarkdownColumn) ?? []).length > 0
        : false;
      const siblingHtmlHasValues = siblingHtmlColumn
        ? (sampleValuesByColumn.get(siblingHtmlColumn) ?? []).length > 0
        : false;
      let score = 0;

      if (/^content$|^body$|^post_content$|^article_body$/.test(normalizedName)) {
        score += 60;
      }

      if (/(content|body|markdown|html|intro|outro|summary|excerpt|faq|steps|description)/.test(normalizedName)) {
        score += 25;
      }

      if (column.isJson) {
        score += 10;
      }

      if (/title|name|slug|status|author|tag|category/.test(normalizedName)) {
        score -= 20;
      }

      if (isPrimaryExcerptColumnName(normalizedName)) {
        score -= 35;
      }

      if (isContentFormatColumnName(normalizedName)) {
        score -= 80;
      }

      if (isSeoMetadataColumnName(normalizedName)) {
        score -= 90;
      }

      if (hasReadableTextCompanionForJson) {
        score -= 70;
      }

      if (!sampleValues.length) {
        score -= 10;
      }

      if (normalizedName.endsWith("_html") && !sampleValues.length && siblingMarkdownHasValues) {
        score -= 25;
      }

      if (normalizedName.endsWith("_markdown") && !sampleValues.length && siblingHtmlHasValues) {
        score -= 25;
      }

      if (sampleValues.some((value) => value.length > 120)) {
        score += 15;
      }

      return {
        column,
        score,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.column.name.localeCompare(right.column.name));

  return weightedColumns.slice(0, 5).map((entry, index) => ({
    column: entry.column.name,
    id: tokenizeIdentifier(entry.column.name).join("_") || `content_${index + 1}`,
    kind: inferEditorFieldKind(table, entry.column),
    label: toLabel(entry.column.name),
    placeholder: null,
    required: index === 0,
    visible: true,
  })) satisfies ContentEditorField[];
};

export const isJoinTable = (table: ContentIntrospectedTable) =>
  table.foreignKeys.length >= 2 && table.columns.length <= 6 && !detectContentColumns(table).length;

export const getPostTitleColumn = (table: ContentIntrospectedTable) =>
  findColumn(table, [/^title$/, /^headline$/, /^name$/, /post_title$/, /article_title$/], {
    requireTextLike: true,
  });

export const getStatusColumn = (table: ContentIntrospectedTable) =>
  findColumn(table, STATUS_COLUMN_PATTERNS, {
    requireTextLike: true,
  });

export const getSlugColumn = (table: ContentIntrospectedTable) =>
  findColumn(table, [/^slug$/, /slug$/, /^permalink$/], {
    requireTextLike: true,
  });

export const getExcerptColumn = (table: ContentIntrospectedTable) =>
  findColumn(table, [/^excerpt$/, /^summary$/, /^description$/, /^intro$/], {
    requireTextLike: true,
  });

export const getRedirectsColumn = (table: ContentIntrospectedTable) =>
  findColumn(table, REDIRECT_COLUMN_PATTERNS, {
    requireArray: true,
  }) ??
  findColumn(table, REDIRECT_COLUMN_PATTERNS, {
    requireJson: true,
  }) ??
  findColumn(table, REDIRECT_COLUMN_PATTERNS, {
    requireTextLike: true,
  });

export const getFeaturedImageColumn = (table: ContentIntrospectedTable) =>
  findColumn(
    table,
    [
      /^featured_image_url$/,
      /^feature_image_url$/,
      /^featured_image$/,
      /^feature_image$/,
      /^cover_image_url$/,
      /^cover_image$/,
      /^hero_image_url$/,
      /^thumbnail_url$/,
      /^image_url$/,
      /^featured_image_url$/,
    ],
    {
      requireTextLike: true,
    },
  );

export const getSeoTitleColumn = (table: ContentIntrospectedTable) =>
  findColumn(table, SEO_TITLE_COLUMN_PATTERNS, {
    requireTextLike: true,
  });

export const getSeoDescriptionColumn = (table: ContentIntrospectedTable) =>
  findColumn(table, SEO_DESCRIPTION_COLUMN_PATTERNS, {
    requireTextLike: true,
  });

export const getFocusKeywordColumn = (table: ContentIntrospectedTable) =>
  findColumn(table, FOCUS_KEYWORD_COLUMN_PATTERNS, {
    requireTextLike: true,
  });

export const getPublishedFlagColumn = (table: ContentIntrospectedTable) =>
  findColumn(table, PUBLISHED_FLAG_COLUMN_PATTERNS, {
    requireBoolean: true,
  });

export const getPublishedAtColumn = (table: ContentIntrospectedTable) =>
  findColumn(table, PUBLISHED_AT_COLUMN_PATTERNS, {
    requireDateLike: true,
  });

export const getCreatedAtColumn = (table: ContentIntrospectedTable) =>
  findColumn(table, [/^created_at$/, /^created_on$/, /^inserted_at$/, /^date_created$/], {
    requireDateLike: true,
  });

export const getUpdatedAtColumn = (table: ContentIntrospectedTable) =>
  findColumn(table, [/^updated_at$/, /^updated_on$/, /^modified_at$/, /^last_updated_at$/], {
    requireDateLike: true,
  });

export const scorePostTable = (table: ContentIntrospectedTable) => {
  let score = 0;
  const reasons: string[] = [];
  const tableName = table.name.toLowerCase();

  if (POST_SOURCE_NAME_PATTERN.test(tableName)) {
    score += 45;
    reasons.push("table name looks like a post source");
  }

  if (getPostTitleColumn(table)) {
    score += 15;
    reasons.push("has a likely title column");
  }

  if (getSlugColumn(table)) {
    score += 8;
    reasons.push("has a likely slug column");
  }

  const contentColumns = detectContentColumns(table);

  if (contentColumns.length) {
    score += Math.min(30, 12 + contentColumns.length * 6);
    reasons.push(contentColumns.length > 1 ? "has multiple content-like columns" : "has a likely content column");
  }

  const workflow = detectWorkflow(table);

  if (workflow.statusColumn || workflow.publishedAtColumn || workflow.publishedFlagColumn) {
    score += 12;
    reasons.push("has publish workflow columns");
  }

  if (
    table.foreignKeys.some((foreignKey) =>
      /(author|writer|user|member|profile)/.test(foreignKey.targetTable.toLowerCase()),
    )
  ) {
    score += 8;
    reasons.push("has a likely author relation");
  }

  if (isRevisionLikeTable(table)) {
    score -= 85;
    reasons.push("looks like a revisions/history table rather than the primary posts source");
  }

  if (isJoinTable(table)) {
    score -= 40;
    reasons.push("looks like a join table");
  }

  return {
    reasons,
    score,
  };
};

export const scoreEntityTable = (
  table: ContentIntrospectedTable,
  entity: Exclude<ContentMappingEntityKey, "posts">,
) => {
  let score = 0;
  const reasons: string[] = [];
  const tableName = table.name.toLowerCase();
  const columnNames = table.columns.map((column) => column.name.toLowerCase());
  const postTableScore = scorePostTable(table).score;

  const addReason = (points: number, reason: string) => {
    score += points;
    reasons.push(reason);
  };

  if (entity === "categories" && /(categor|topic|section|taxonomy)/.test(tableName)) {
    addReason(45, "table name looks like categories");
  }

  if (entity === "tags" && /(tag|label|keyword)/.test(tableName)) {
    addReason(45, "table name looks like tags");
  }

  if (entity === "authors" && /(author|writer|people|person|member|profile|user)/.test(tableName)) {
    addReason(45, "table name looks like authors");
  }

  if (entity === "media" && /(media|asset|image|file|attachment|gallery)/.test(tableName)) {
    addReason(45, "table name looks like media");
  }

  if (entity === "files" && /(file|document|attachment|asset|download)/.test(tableName)) {
    addReason(45, "table name looks like files");
  }

  if (columnNames.some((columnName) => columnName === "name" || columnName.endsWith("_name"))) {
    addReason(12, "has a likely name column");
  }

  if (columnNames.some((columnName) => columnName === "slug" || columnName.endsWith("_slug"))) {
    addReason(10, "has a likely slug column");
  }

  if (entity === "categories" && columnNames.some((columnName) => /parent/.test(columnName))) {
    addReason(8, "has a likely hierarchy column");
  }

  if (entity === "authors" && columnNames.some((columnName) => /email/.test(columnName))) {
    addReason(10, "has a likely email column");
  }

  if (
    entity === "media" &&
    columnNames.some((columnName) => /(url|path|object_path|bucket|file_name|mime)/.test(columnName))
  ) {
    addReason(14, "has likely media path columns");
  }

  if (
    entity === "files" &&
    columnNames.some((columnName) => /(url|path|object_path|bucket|file_name|mime|extension)/.test(columnName))
  ) {
    addReason(14, "has likely file path columns");
  }

  if (isJoinTable(table)) {
    score -= 30;
    reasons.push("looks like a join table");
  }

  if (postTableScore >= 45) {
    score -= 24;
    reasons.push("looks more like a posts source than a standalone entity table");
  }

  return {
    reasons,
    score,
  };
};

export const buildPreview = (
  table: ContentIntrospectedTable,
  columnNames: Array<string | null | undefined>,
): ContentAutoMappingCandidatePreview => {
  const previewColumns = unique(columnNames.filter(Boolean) as string[]).slice(0, 8);

  return {
    columns: previewColumns,
    rows: table.sampleRows.slice(0, 3),
    values: getPreviewValueMap(table, previewColumns),
  };
};

export const findJoinTableCandidate = (
  tables: ContentIntrospectedTable[],
  sourceTable: ContentIntrospectedTable,
  targetTable: ContentIntrospectedTable,
) => {
  const sourceRef = toTableRef(sourceTable);
  const targetRef = toTableRef(targetTable);

  return (
    tables.find((table) => {
      if (toTableRef(table) === sourceRef || toTableRef(table) === targetRef) {
        return false;
      }

      const hasSourceFk = table.foreignKeys.some(
        (foreignKey) => `${foreignKey.targetSchema}.${foreignKey.targetTable}` === sourceRef,
      );
      const hasTargetFk = table.foreignKeys.some(
        (foreignKey) => `${foreignKey.targetSchema}.${foreignKey.targetTable}` === targetRef,
      );

      return hasSourceFk && hasTargetFk;
    }) ?? null
  );
};

export const applyDetectedRelation = (
  relation: ContentRelationMapping,
  nextValues: Partial<ContentRelationMapping>,
) => {
  relation.fieldMap = nextValues.fieldMap ?? relation.fieldMap;
  relation.junctionSourceColumn = nextValues.junctionSourceColumn ?? relation.junctionSourceColumn;
  relation.junctionTable = nextValues.junctionTable ?? relation.junctionTable;
  relation.junctionTargetColumn = nextValues.junctionTargetColumn ?? relation.junctionTargetColumn;
  relation.sourceColumn = nextValues.sourceColumn ?? relation.sourceColumn;
  relation.status = nextValues.status ?? relation.status;
  relation.strategy = nextValues.strategy ?? relation.strategy;
  relation.targetColumn = nextValues.targetColumn ?? relation.targetColumn;
  relation.targetTable = nextValues.targetTable ?? relation.targetTable;
  relation.valueColumn = nextValues.valueColumn ?? relation.valueColumn;
};

export const setMappingFieldColumn = (
  mapping: { fields: Record<string, ContentMappedField | unknown> },
  fieldKey: string,
  column: string | null,
) => {
  const field = mapping.fields[fieldKey] as ContentMappedField | undefined;

  if (field) {
    field.column = column;
  }
};
