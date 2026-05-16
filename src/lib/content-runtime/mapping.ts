import {
  CONTENT_FIELD_SEMANTIC_ROLE_VALUES,
  CONTENT_FIELD_STORAGE_PRIMITIVE_VALUES,
  type ContentFieldSemanticRole,
  type ContentFieldStoragePrimitive,
} from "./field-contract";

export const CONTENT_MAPPING_VERSION = 1;

export const CONTENT_BINDING_MODE_VALUES = ["mapped_content"] as const;
export type ContentBindingMode = (typeof CONTENT_BINDING_MODE_VALUES)[number];

export const CONTENT_BINDING_STATUS_VALUES = ["draft", "ready", "invalid", "archived"] as const;
export type ContentBindingStatus = (typeof CONTENT_BINDING_STATUS_VALUES)[number];

export const CONTENT_BINDING_SCOPE_MODE_VALUES = [
  "database",
  "schema",
  "table_prefix",
  "row_filter",
] as const;
export type ContentBindingScopeMode = (typeof CONTENT_BINDING_SCOPE_MODE_VALUES)[number];

export const CONTENT_MAPPING_REVISION_SOURCE_VALUES = ["auto_detect", "manual", "system"] as const;
export type ContentMappingRevisionSource = (typeof CONTENT_MAPPING_REVISION_SOURCE_VALUES)[number];

export const CONTENT_MAPPING_SAVE_SCOPE_VALUES = [
  "full",
  "posts",
  "authors",
  "categories",
  "tags",
  "media",
  "files",
] as const;
export type ContentMappingSaveScope = (typeof CONTENT_MAPPING_SAVE_SCOPE_VALUES)[number];

export const CONTENT_MAPPING_ENTITY_KEYS = [
  "posts",
  "categories",
  "tags",
  "authors",
  "media",
  "files",
] as const;
export type ContentMappingEntityKey = (typeof CONTENT_MAPPING_ENTITY_KEYS)[number];

export const CONTENT_MAPPING_ENTITY_STATUS_VALUES = [
  "unmapped",
  "detecting",
  "mapped",
  "limited",
  "unsupported",
] as const;
export type ContentMappingEntityStatus = (typeof CONTENT_MAPPING_ENTITY_STATUS_VALUES)[number];

export const CONTENT_MAPPING_SOURCE_KIND_VALUES = [
  "none",
  "table",
  "view",
  "storage_bucket",
  "derived",
] as const;
export type ContentMappingSourceKind = (typeof CONTENT_MAPPING_SOURCE_KIND_VALUES)[number];

export const CONTENT_MAPPING_FIELD_KIND_VALUES = [
  "text",
  "plain_text",
  "rich_text",
  "html",
  "markdown",
  "json",
  "number",
  "boolean",
  "date",
  "datetime",
  "slug",
  "array",
  "enum",
] as const;
export type ContentMappingFieldKind = (typeof CONTENT_MAPPING_FIELD_KIND_VALUES)[number];

export const CONTENT_TIMESTAMP_SOURCE_HINT_VALUES = [
  "trigger_managed",
  "generated",
  "view_derived",
  "audit_derived",
] as const;
export type ContentTimestampSourceHint = (typeof CONTENT_TIMESTAMP_SOURCE_HINT_VALUES)[number];

export const CONTENT_MAPPING_RELATION_STRATEGY_VALUES = [
  "none",
  "foreign_key",
  "related_row_by_post_id",
  "join_row",
  "join_table",
  "polymorphic_join",
  "value_match_relation",
  "array",
  "json_array",
  "json_object",
  "inline_fields",
  "derived_distinct",
] as const;
export type ContentMappingRelationStrategy = (typeof CONTENT_MAPPING_RELATION_STRATEGY_VALUES)[number];

export const CONTENT_MAPPING_WORKFLOW_MODE_VALUES = [
  "status",
  "published_flag",
  "published_at",
  "status_with_flag",
  "custom",
] as const;
export type ContentMappingWorkflowMode = (typeof CONTENT_MAPPING_WORKFLOW_MODE_VALUES)[number];

export const CONTENT_CUSTOM_RELATION_FIELD_KIND_VALUES = [
  "single_relation",
  "multi_relation",
  "value_match_relation",
  "self_reference_single",
  "self_reference_multi",
  "media_relation_single",
  "media_relation_multi",
  "file_relation_single",
  "file_relation_multi",
] as const;
export type ContentCustomRelationFieldKind =
  (typeof CONTENT_CUSTOM_RELATION_FIELD_KIND_VALUES)[number];

export type ContentMappingCapabilities = {
  browse: boolean;
  create: boolean;
  delete: boolean;
  read: boolean;
  update: boolean;
};

export type ContentMappedField = {
  arrayIndex?: number | null;
  column: string | null;
  kind: ContentMappingFieldKind;
  label: string;
  path: string | null;
  required: boolean;
  semanticRole?: ContentFieldSemanticRole;
  sourceRelation?: ContentScalarFieldRelationSourceMapping;
  storagePrimitive?: ContentFieldStoragePrimitive;
  timestampSourceHint?: ContentTimestampSourceHint;
  visible: boolean;
};

export type ContentEditorField = {
  arrayIndex?: number | null;
  column: string | null;
  id: string;
  kind: ContentMappingFieldKind;
  label: string;
  path?: string | null;
  placeholder: string | null;
  required: boolean;
  semanticRole?: ContentFieldSemanticRole;
  sourceRelation?: ContentScalarFieldRelationSourceMapping;
  storagePrimitive?: ContentFieldStoragePrimitive;
  visible: boolean;
};

export type ContentRelationMapping = {
  discriminatorColumn?: string | null;
  discriminatorValue?: string | null;
  fieldMap: Record<string, string>;
  junctionSourceColumn: string | null;
  junctionTable: string | null;
  junctionTargetColumn: string | null;
  multiple: boolean;
  semanticRole?: ContentFieldSemanticRole;
  sourceColumn: string | null;
  status: ContentMappingEntityStatus;
  storagePrimitive?: ContentFieldStoragePrimitive;
  strategy: ContentMappingRelationStrategy;
  targetColumn: string | null;
  targetEntity: ContentMappingEntityKey | null;
  targetTable: string | null;
  valueColumn: string | null;
};

export const CONTENT_SCALAR_FIELD_RELATION_SOURCE_STRATEGY_VALUES = [
  "foreign_key",
  "related_row_by_post_id",
  "join_row",
  "value_match_relation",
  "inline_fields",
] as const;
export type ContentScalarFieldRelationSourceStrategy =
  (typeof CONTENT_SCALAR_FIELD_RELATION_SOURCE_STRATEGY_VALUES)[number];

export type ContentScalarFieldRelationSourceMapping = {
  junctionSourceColumn: string | null;
  junctionTable: string | null;
  sourceColumn: string | null;
  strategy: ContentScalarFieldRelationSourceStrategy;
  targetColumn: string | null;
  targetTable: string | null;
  valueColumn: string | null;
};

export type ContentEntitySource = {
  kind: ContentMappingSourceKind;
  primaryKey: string | null;
  schema: string | null;
  table: string | null;
};

export type ContentPostWorkflowMapping = {
  archivedValues: string[];
  customValues: string[];
  draftValues: string[];
  mode: ContentMappingWorkflowMode;
  publishedAtColumn: string | null;
  publishedFlagColumn: string | null;
  publishedValues: string[];
  statusColumn: string | null;
};

export const CONTENT_MEDIA_STORAGE_PROVIDER_VALUES = [
  "none",
  "supabase_bucket",
  "s3_compatible",
] as const;
export type ContentMediaStorageProvider = (typeof CONTENT_MEDIA_STORAGE_PROVIDER_VALUES)[number];

export type ContentMediaStorageConfig = {
  bucketName: string | null;
  endpoint: string | null;
  provider: ContentMediaStorageProvider;
  publicUrlBase: string | null;
  region: string | null;
};

export type ContentCustomFieldSourceType = {
  adapterMetadata?: Record<string, unknown>;
  isArray: boolean;
  isJson: boolean;
  nativeType: string;
};

export type ContentCustomFieldMapping = {
  allowedValues: string[] | null;
  arrayIndex?: number | null;
  column: string;
  dataType: string;
  defaultValue: string | null;
  enabled: boolean;
  fieldKey?: string;
  isNullable: boolean;
  kind: ContentMappingFieldKind;
  label: string;
  path?: string | null;
  sampleValues: string[];
  semanticRole?: ContentFieldSemanticRole;
  sourceRelation?: ContentScalarFieldRelationSourceMapping;
  sourceType?: ContentCustomFieldSourceType;
  storagePrimitive?: ContentFieldStoragePrimitive;
};

export type ContentCustomRelationFieldMapping = {
  enabled: boolean;
  fieldKey: string;
  isNullable: boolean;
  kind: ContentCustomRelationFieldKind;
  label: string;
  relation: ContentRelationMapping;
};

export type ContentCompanionContentColumn = {
  column: string;
  kind: "html" | "markdown" | "json";
};

export type ContentEntityMapping = {
  capabilities: ContentMappingCapabilities;
  companionContentColumns: ContentCompanionContentColumn[];
  customFields: ContentCustomFieldMapping[];
  customRelationFields?: ContentCustomRelationFieldMapping[];
  editorFields: ContentEditorField[];
  fields: Record<string, ContentMappedField>;
  notes: string[];
  relations: Partial<Record<ContentMappingEntityKey, ContentRelationMapping>>;
  source: ContentEntitySource;
  status: ContentMappingEntityStatus;
  workflow: ContentPostWorkflowMapping | null;
};

export type ContentMappingConfig = {
  entities: Record<ContentMappingEntityKey, ContentEntityMapping>;
  filesStorage: ContentMediaStorageConfig | null;
  mediaStorage: ContentMediaStorageConfig | null;
  version: number;
};

export type ContentProjectMapping = {
  bindingId: string;
  bindingMode: ContentBindingMode;
  bindingStatus: ContentBindingStatus;
  mappingConfig: ContentMappingConfig;
  revisionId: string | null;
  revisionVersion: number | null;
};

export type ContentMappingDuplicateColumnIssue = {
  column: string;
  locations: string[];
  message: string;
  tableRef: string;
};

export type ContentMappingUnmapTarget = "all" | ContentMappingSaveScope;

const defaultCapabilities = (): ContentMappingCapabilities => ({
  browse: false,
  create: false,
  delete: false,
  read: false,
  update: false,
});

const defaultSource = (): ContentEntitySource => ({
  kind: "none",
  primaryKey: null,
  schema: null,
  table: null,
});

const defaultField = (
  label: string,
  kind: ContentMappingFieldKind,
  options: Partial<ContentMappedField> = {},
): ContentMappedField => ({
  arrayIndex: null,
  column: null,
  kind,
  label,
  path: null,
  required: false,
  visible: true,
  ...options,
});

const inferScalarFieldStoragePrimitive = ({
  arrayIndex,
  column,
  kind,
  path,
  sourceRelation,
}: {
  arrayIndex?: number | null;
  column?: string | null;
  kind: ContentMappingFieldKind;
  path?: string | null;
  sourceRelation?: ContentScalarFieldRelationSourceMapping;
}): ContentFieldStoragePrimitive | undefined => {
  if (sourceRelation) {
    switch (sourceRelation.strategy) {
      case "foreign_key":
        return "foreign_key";
      case "related_row_by_post_id":
        return "related_row_by_post_id";
      case "join_row":
        return "join_row";
      case "value_match_relation":
        return "value_match_relation";
      case "inline_fields":
        return "direct_column";
      default:
        return undefined;
    }
  }

  if (arrayIndex !== null && arrayIndex !== undefined && column && !path) {
    return "array_item";
  }

  if (kind === "array" && column) {
    return "array_value";
  }

  if (path) {
    return "json_path";
  }

  if (column) {
    return "direct_column";
  }

  return undefined;
};

const inferRelationStoragePrimitive = (
  strategy: ContentMappingRelationStrategy,
): ContentFieldStoragePrimitive | undefined => {
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
      return "derived_read_only";
    default:
      return undefined;
  }
};

const normalizeRelationStoragePrimitive = ({
  fallback,
  input,
  strategy,
}: {
  fallback: ContentRelationMapping;
  input: unknown;
  strategy: ContentMappingRelationStrategy;
}) => {
  const inferredStoragePrimitive = inferRelationStoragePrimitive(strategy);
  const normalizedStoragePrimitive = normalizeEnumValue(
    input,
    CONTENT_FIELD_STORAGE_PRIMITIVE_VALUES,
    fallback.storagePrimitive ?? inferredStoragePrimitive ?? "derived_read_only",
  );

  return inferredStoragePrimitive ?? normalizedStoragePrimitive;
};

const defaultPostWorkflow = (): ContentPostWorkflowMapping => ({
  archivedValues: [],
  customValues: [],
  draftValues: [],
  mode: "status",
  publishedAtColumn: null,
  publishedFlagColumn: null,
  publishedValues: [],
  statusColumn: null,
});

const defaultRelation = (
  targetEntity: ContentMappingEntityKey,
  multiple: boolean,
): ContentRelationMapping => ({
  discriminatorColumn: null,
  discriminatorValue: null,
  fieldMap: {},
  junctionSourceColumn: null,
  junctionTable: null,
  junctionTargetColumn: null,
  multiple,
  sourceColumn: null,
  status: "unmapped",
  strategy: "none",
  targetColumn: null,
  targetEntity,
  targetTable: null,
  valueColumn: null,
});

const entityFieldTemplates: Record<ContentMappingEntityKey, Record<string, ContentMappedField>> = {
  authors: {
    bio: defaultField("Bio", "plain_text"),
    email: defaultField("Email", "text"),
    id: defaultField("ID", "text", { required: true, visible: false }),
    name: defaultField("Name", "text", { required: true }),
    slug: defaultField("Slug", "slug"),
  },
  categories: {
    description: defaultField("Description", "plain_text"),
    id: defaultField("ID", "text", { required: true, visible: false }),
    name: defaultField("Name", "text", { required: true }),
    parentId: defaultField("Parent Category", "text"),
    slug: defaultField("Slug", "slug"),
  },
  media: {
    altText: defaultField("Alt Text", "plain_text"),
    id: defaultField("ID", "text", { required: true, visible: false }),
    objectPath: defaultField("Object Path", "text"),
    title: defaultField("Title", "text"),
    url: defaultField("URL", "text"),
  },
  files: {
    id: defaultField("ID", "text", { required: true, visible: false }),
    objectPath: defaultField("Object Path", "text"),
    title: defaultField("Title", "text"),
    url: defaultField("URL", "text"),
  },
  posts: {
    createdAt: defaultField("Created At", "datetime"),
    excerpt: defaultField("Excerpt", "plain_text"),
    focusKeyword: defaultField("Focus Keyword", "text"),
    featuredImageUrl: defaultField("Featured Image", "text"),
    id: defaultField("ID", "text", { required: true, visible: false }),
    publishedAt: defaultField("Published At", "datetime"),
    redirects: defaultField("Redirects", "array"),
    seoDescription: defaultField("SEO Description", "plain_text"),
    seoTitle: defaultField("SEO Title", "text"),
    slug: defaultField("Slug", "slug"),
    status: defaultField("Status", "text"),
    title: defaultField("Title", "text", { required: true }),
    updatedAt: defaultField("Updated At", "datetime"),
  },
  tags: {
    description: defaultField("Description", "plain_text"),
    id: defaultField("ID", "text", { required: true, visible: false }),
    name: defaultField("Name", "text", { required: true }),
    slug: defaultField("Slug", "slug"),
  },
};

const entityEditorFieldTemplates: Record<ContentMappingEntityKey, ContentEditorField[]> = {
  authors: [],
  categories: [],
  media: [],
  files: [],
  posts: [
    {
      arrayIndex: null,
      column: null,
      id: "content",
      kind: "rich_text",
      label: "Content",
      path: null,
      placeholder: null,
      required: false,
      visible: true,
    },
  ],
  tags: [],
};

const entityRelationTemplates: Record<
  ContentMappingEntityKey,
  Partial<Record<ContentMappingEntityKey, ContentRelationMapping>>
> = {
  authors: {},
  categories: {},
  media: {},
  files: {},
  posts: {
    authors: defaultRelation("authors", false),
    categories: defaultRelation("categories", true),
    media: defaultRelation("media", true),
    tags: defaultRelation("tags", true),
  },
  tags: {},
};

const toRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const toAdapterMetadataRecord = (value: unknown) => {
  const record = toRecord(value);

  if (!record) {
    return undefined;
  }

  const entries = Object.entries(record).filter(([, entryValue]) => {
    return entryValue !== undefined && entryValue !== null;
  });

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const toTrimmedString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const toNullableString = (value: unknown) => {
  const normalized = toTrimmedString(value);
  return normalized || null;
};

const toBoolean = (value: unknown, fallback = false) => (typeof value === "boolean" ? value : fallback);

const toStringList = (value: unknown) =>
  Array.isArray(value)
    ? value.map((entry) => toTrimmedString(entry)).filter(Boolean)
    : [];

const toPositiveInteger = (value: unknown, fallback: number) => {
  const normalized =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;
  return Number.isFinite(normalized) && normalized > 0 ? Math.floor(normalized) : fallback;
};

const toNonNegativeIntegerOrNull = (value: unknown) => {
  const normalized =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  return Number.isFinite(normalized) && normalized >= 0 ? Math.floor(normalized) : null;
};

export const getContentCustomFieldKey = (field: Pick<ContentCustomFieldMapping, "column" | "fieldKey">) =>
  toTrimmedString(field.fieldKey) || toTrimmedString(field.column);

const normalizeEnumValue = <T extends readonly string[]>(
  value: unknown,
  values: T,
  fallback: T[number],
) =>
  values.includes((value ?? "") as T[number]) ? ((value ?? "") as T[number]) : fallback;

const cloneFieldTemplates = (key: ContentMappingEntityKey) =>
  Object.fromEntries(
    Object.entries(entityFieldTemplates[key]).map(([fieldKey, fieldValue]) => [fieldKey, { ...fieldValue }]),
  ) as Record<string, ContentMappedField>;

const cloneEditorFieldTemplates = (key: ContentMappingEntityKey) =>
  entityEditorFieldTemplates[key].map((field) => ({ ...field }));

const cloneRelationTemplates = (key: ContentMappingEntityKey) =>
  Object.fromEntries(
    Object.entries(entityRelationTemplates[key]).map(([relationKey, relationValue]) => [
      relationKey,
      { ...relationValue, fieldMap: { ...relationValue.fieldMap } },
    ]),
  ) as Partial<Record<ContentMappingEntityKey, ContentRelationMapping>>;

const defaultEntityMapping = (key: ContentMappingEntityKey): ContentEntityMapping => ({
  capabilities: defaultCapabilities(),
  companionContentColumns: [],
  customFields: [],
  customRelationFields: [],
  editorFields: cloneEditorFieldTemplates(key),
  fields: cloneFieldTemplates(key),
  notes: [],
  relations: cloneRelationTemplates(key),
  source: defaultSource(),
  status: "unmapped",
  workflow: key === "posts" ? defaultPostWorkflow() : null,
});

const cloneMappingConfig = (mappingConfig: ContentMappingConfig): ContentMappingConfig =>
  JSON.parse(JSON.stringify(mappingConfig)) as ContentMappingConfig;

const normalizeMappedField = (
  fieldKey: string,
  input: unknown,
  fallback: ContentMappedField,
): ContentMappedField => {
  const record = toRecord(input);

  if (!record) {
    return { ...fallback };
  }

  const timestampSourceHint = CONTENT_TIMESTAMP_SOURCE_HINT_VALUES.includes(
    record.timestampSourceHint as ContentTimestampSourceHint,
  )
    ? (record.timestampSourceHint as ContentTimestampSourceHint)
    : fallback.timestampSourceHint;
  const sourceRelation = normalizeScalarFieldRelationSource(record.sourceRelation);
  const arrayIndex = toNonNegativeIntegerOrNull(record.arrayIndex);
  const column = toNullableString(record.column);
  const kind = normalizeEnumValue(record.kind, CONTENT_MAPPING_FIELD_KIND_VALUES, fallback.kind);
  const path = toNullableString(record.path);
  const inferredStoragePrimitive = inferScalarFieldStoragePrimitive({
    arrayIndex,
    column,
    kind,
    path,
    sourceRelation,
  });
  const semanticRole = normalizeEnumValue(
    record.semanticRole,
    CONTENT_FIELD_SEMANTIC_ROLE_VALUES,
    fallback.semanticRole ?? "none",
  );

  return {
    arrayIndex,
    column,
    kind,
    label: toTrimmedString(record.label) || fallback.label || fieldKey,
    path,
    required: toBoolean(record.required, fallback.required),
    ...(semanticRole !== "none" ? { semanticRole } : {}),
    ...(sourceRelation ? { sourceRelation } : {}),
    storagePrimitive: normalizeEnumValue(
      record.storagePrimitive,
      CONTENT_FIELD_STORAGE_PRIMITIVE_VALUES,
      fallback.storagePrimitive ?? inferredStoragePrimitive ?? "direct_column",
    ),
    ...(timestampSourceHint ? { timestampSourceHint } : {}),
    visible: toBoolean(record.visible, fallback.visible),
  };
};

const normalizeEditorField = (
  input: unknown,
  fallback: ContentEditorField,
): ContentEditorField => {
  const record = toRecord(input);

  if (!record) {
    return { ...fallback };
  }

  const sourceRelation = normalizeScalarFieldRelationSource(record.sourceRelation);
  const arrayIndex = toNonNegativeIntegerOrNull(record.arrayIndex);
  const column = toNullableString(record.column);
  const kind = normalizeEnumValue(record.kind, CONTENT_MAPPING_FIELD_KIND_VALUES, fallback.kind);
  const path = toNullableString(record.path);
  const inferredStoragePrimitive = inferScalarFieldStoragePrimitive({
    arrayIndex,
    column,
    kind,
    path,
    sourceRelation,
  });
  const semanticRole = normalizeEnumValue(
    record.semanticRole,
    CONTENT_FIELD_SEMANTIC_ROLE_VALUES,
    fallback.semanticRole ?? "none",
  );

  return {
    arrayIndex,
    column,
    id: toTrimmedString(record.id) || fallback.id,
    kind,
    label: toTrimmedString(record.label) || fallback.label,
    path,
    placeholder: toNullableString(record.placeholder),
    required: toBoolean(record.required, fallback.required),
    ...(semanticRole !== "none" ? { semanticRole } : {}),
    ...(sourceRelation ? { sourceRelation } : {}),
    storagePrimitive: normalizeEnumValue(
      record.storagePrimitive,
      CONTENT_FIELD_STORAGE_PRIMITIVE_VALUES,
      fallback.storagePrimitive ?? inferredStoragePrimitive ?? "direct_column",
    ),
    visible: toBoolean(record.visible, fallback.visible),
  };
};

const normalizeRelationMapping = (
  input: unknown,
  fallback: ContentRelationMapping,
): ContentRelationMapping => {
  const record = toRecord(input);

  if (!record) {
    return {
      ...fallback,
      fieldMap: { ...fallback.fieldMap },
    };
  }

  const fieldMap = toRecord(record.fieldMap);
  const strategy = normalizeEnumValue(
    record.strategy,
    CONTENT_MAPPING_RELATION_STRATEGY_VALUES,
    fallback.strategy,
  );
  const semanticRole = normalizeEnumValue(
    record.semanticRole,
    CONTENT_FIELD_SEMANTIC_ROLE_VALUES,
    fallback.semanticRole ?? "none",
  );

  return {
    discriminatorColumn: toNullableString(record.discriminatorColumn),
    discriminatorValue: toNullableString(record.discriminatorValue),
    fieldMap: Object.fromEntries(
      Object.entries(fieldMap ?? {})
        .map(([key, value]) => [key.trim(), toTrimmedString(value)])
        .filter(([key, value]) => Boolean(key) && Boolean(value)),
    ),
    junctionSourceColumn: toNullableString(record.junctionSourceColumn),
    junctionTable: toNullableString(record.junctionTable),
    junctionTargetColumn: toNullableString(record.junctionTargetColumn),
    multiple: toBoolean(record.multiple, fallback.multiple),
    ...(semanticRole !== "none" ? { semanticRole } : {}),
    sourceColumn: toNullableString(record.sourceColumn),
    status: normalizeEnumValue(record.status, CONTENT_MAPPING_ENTITY_STATUS_VALUES, fallback.status),
    storagePrimitive: normalizeRelationStoragePrimitive({
      fallback,
      input: record.storagePrimitive,
      strategy,
    }),
    strategy,
    targetColumn: toNullableString(record.targetColumn),
    targetEntity: normalizeEnumValue(
      record.targetEntity,
      CONTENT_MAPPING_ENTITY_KEYS,
      fallback.targetEntity ?? "posts",
    ),
    targetTable: toNullableString(record.targetTable),
    valueColumn: toNullableString(record.valueColumn),
  };
};

const normalizeScalarFieldRelationSource = (
  input: unknown,
): ContentScalarFieldRelationSourceMapping | undefined => {
  const record = toRecord(input);

  if (!record) {
    return undefined;
  }

  return {
    junctionSourceColumn: toNullableString(record.junctionSourceColumn),
    junctionTable: toNullableString(record.junctionTable),
    sourceColumn: toNullableString(record.sourceColumn),
    strategy: normalizeEnumValue(
      record.strategy,
      CONTENT_SCALAR_FIELD_RELATION_SOURCE_STRATEGY_VALUES,
      "foreign_key",
    ),
    targetColumn: toNullableString(record.targetColumn),
    targetTable: toNullableString(record.targetTable),
    valueColumn: toNullableString(record.valueColumn),
  };
};

const normalizePostWorkflow = (input: unknown, fallback: ContentPostWorkflowMapping) => {
  const record = toRecord(input);

  if (!record) {
    return { ...fallback };
  }

  return {
    archivedValues: toStringList(record.archivedValues),
    customValues: toStringList(record.customValues),
    draftValues: toStringList(record.draftValues),
    mode: normalizeEnumValue(record.mode, CONTENT_MAPPING_WORKFLOW_MODE_VALUES, fallback.mode),
    publishedAtColumn: toNullableString(record.publishedAtColumn),
    publishedFlagColumn: toNullableString(record.publishedFlagColumn),
    publishedValues: toStringList(record.publishedValues),
    statusColumn: toNullableString(record.statusColumn),
  };
};

const normalizeEntitySource = (input: unknown, fallback: ContentEntitySource): ContentEntitySource => {
  const record = toRecord(input);

  if (!record) {
    return { ...fallback };
  }

  return {
    kind: normalizeEnumValue(record.kind, CONTENT_MAPPING_SOURCE_KIND_VALUES, fallback.kind),
    primaryKey: toNullableString(record.primaryKey),
    schema: toNullableString(record.schema),
    table: toNullableString(record.table),
  };
};

const normalizeEntityMapping = (
  key: ContentMappingEntityKey,
  input: unknown,
): ContentEntityMapping => {
  const fallback = defaultEntityMapping(key);
  const record = toRecord(input);

  if (!record) {
    return fallback;
  }

  const providedFields = toRecord(record.fields);
  const normalizedFields = Object.fromEntries(
    [...new Set([...Object.keys(fallback.fields), ...Object.keys(providedFields ?? {})])].map((fieldKey) => [
      fieldKey,
      normalizeMappedField(
        fieldKey,
        providedFields?.[fieldKey],
        fallback.fields[fieldKey] ?? defaultField(fieldKey, "text"),
      ),
    ]),
  ) as Record<string, ContentMappedField>;

  const fallbackEditorFields = fallback.editorFields.length
    ? fallback.editorFields
    : [
        {
          arrayIndex: null,
          column: null,
          id: `${key}-field-1`,
          kind: "text" as const,
          label: "Field 1",
          path: null,
          placeholder: null,
          required: false,
          visible: true,
        },
      ];

  const normalizedEditorFields =
    Array.isArray(record.editorFields) && record.editorFields.length
      ? record.editorFields.map((field, index) =>
          normalizeEditorField(field, fallbackEditorFields[Math.min(index, fallbackEditorFields.length - 1)] ?? fallbackEditorFields[0]),
        )
      : fallback.editorFields;

  const providedRelations = toRecord(record.relations);
  const normalizedRelations = Object.fromEntries(
    CONTENT_MAPPING_ENTITY_KEYS.filter((relationKey) => {
      return Boolean(fallback.relations[relationKey] || providedRelations?.[relationKey]);
    }).map((relationKey) => [
      relationKey,
      normalizeRelationMapping(
        providedRelations?.[relationKey],
        fallback.relations[relationKey] ?? defaultRelation(relationKey, relationKey !== "authors"),
      ),
    ]),
  ) as Partial<Record<ContentMappingEntityKey, ContentRelationMapping>>;

  const capabilitiesInput = toRecord(record.capabilities);

  const normalizedCustomFields: ContentCustomFieldMapping[] = Array.isArray(record.customFields)
    ? record.customFields
        .map<ContentCustomFieldMapping | null>((entry: unknown) => {
          const cf = toRecord(entry);
          if (!cf || !toTrimmedString(cf.column)) return null;
          const rawAllowedValues = Array.isArray(cf.allowedValues) ? toStringList(cf.allowedValues) : null;
          const sourceRelation = normalizeScalarFieldRelationSource(cf.sourceRelation);
          const arrayIndex = toNonNegativeIntegerOrNull(cf.arrayIndex);
          const column = toTrimmedString(cf.column);
          const kind = normalizeEnumValue(cf.kind, CONTENT_MAPPING_FIELD_KIND_VALUES, "text");
          const path = toNullableString(cf.path);
          const sourceTypeInput = toRecord(cf.sourceType);
          const sourceNativeType =
            toTrimmedString(sourceTypeInput?.nativeType) || toTrimmedString(cf.dataType) || "text";
          const sourceType: ContentCustomFieldSourceType = {
            ...(toAdapterMetadataRecord(sourceTypeInput?.adapterMetadata)
              ? { adapterMetadata: toAdapterMetadataRecord(sourceTypeInput?.adapterMetadata) }
              : {}),
            isArray: toBoolean(sourceTypeInput?.isArray, false),
            isJson: toBoolean(sourceTypeInput?.isJson, false),
            nativeType: sourceNativeType,
          };
          const semanticRole = normalizeEnumValue(
            cf.semanticRole,
            CONTENT_FIELD_SEMANTIC_ROLE_VALUES,
            "none",
          );
          return {
            allowedValues: rawAllowedValues?.length ? rawAllowedValues : null,
            arrayIndex,
            column,
            dataType: toTrimmedString(cf.dataType) || "text",
            defaultValue: toNullableString(cf.defaultValue),
            enabled: toBoolean(cf.enabled, true),
            fieldKey: getContentCustomFieldKey({
              column,
              fieldKey: toTrimmedString(cf.fieldKey),
            }),
            isNullable: toBoolean(cf.isNullable, true),
            kind,
            label: toTrimmedString(cf.label) || column,
            path,
            sampleValues: toStringList(cf.sampleValues),
            ...(semanticRole !== "none" ? { semanticRole } : {}),
            ...(sourceRelation ? { sourceRelation } : {}),
            sourceType,
            storagePrimitive: normalizeEnumValue(
              cf.storagePrimitive,
              CONTENT_FIELD_STORAGE_PRIMITIVE_VALUES,
              inferScalarFieldStoragePrimitive({
                arrayIndex,
                column,
                kind,
                path,
                sourceRelation,
              }) ?? "direct_column",
            ),
          } satisfies ContentCustomFieldMapping;
        })
        .filter((entry): entry is ContentCustomFieldMapping => entry !== null)
    : [];
  const normalizedCustomRelationFields: ContentCustomRelationFieldMapping[] = Array.isArray(
    record.customRelationFields,
  )
    ? record.customRelationFields
        .map((entry: unknown) => {
          const relationField = toRecord(entry);
          const fieldKey =
            toTrimmedString(relationField?.fieldKey) || toTrimmedString(relationField?.column);

          if (!relationField || !fieldKey) {
            return null;
          }

          return {
            enabled: toBoolean(relationField.enabled, true),
            fieldKey,
            isNullable: toBoolean(relationField.isNullable, true),
            kind: normalizeEnumValue(
              relationField.kind,
              CONTENT_CUSTOM_RELATION_FIELD_KIND_VALUES,
              "single_relation",
            ),
            label: toTrimmedString(relationField.label) || fieldKey,
            relation: normalizeRelationMapping(
              relationField.relation,
              defaultRelation("authors", false),
            ),
          } satisfies ContentCustomRelationFieldMapping;
        })
        .filter((entry): entry is ContentCustomRelationFieldMapping => entry !== null)
    : [];

  const COMPANION_CONTENT_KINDS = ["html", "markdown", "json"] as const;
  const normalizedCompanionContentColumns: ContentCompanionContentColumn[] = Array.isArray(record.companionContentColumns)
    ? record.companionContentColumns
        .map((entry: unknown) => {
          const cc = toRecord(entry);
          if (!cc || !toTrimmedString(cc.column)) return null;
          const kind = COMPANION_CONTENT_KINDS.includes(cc.kind as typeof COMPANION_CONTENT_KINDS[number])
            ? (cc.kind as ContentCompanionContentColumn["kind"])
            : null;
          if (!kind) return null;
          return { column: toTrimmedString(cc.column), kind } satisfies ContentCompanionContentColumn;
        })
        .filter((entry): entry is ContentCompanionContentColumn => entry !== null)
    : [];

  return {
    capabilities: {
      browse: toBoolean(capabilitiesInput?.browse, fallback.capabilities.browse),
      create: toBoolean(capabilitiesInput?.create, fallback.capabilities.create),
      delete: toBoolean(capabilitiesInput?.delete, fallback.capabilities.delete),
      read: toBoolean(capabilitiesInput?.read, fallback.capabilities.read),
      update: toBoolean(capabilitiesInput?.update, fallback.capabilities.update),
    },
    companionContentColumns: normalizedCompanionContentColumns,
    customFields: normalizedCustomFields,
    customRelationFields: normalizedCustomRelationFields,
    editorFields: normalizedEditorFields,
    fields: normalizedFields,
    notes: toStringList(record.notes),
    relations: normalizedRelations,
    source: normalizeEntitySource(record.source, fallback.source),
    status: normalizeEnumValue(record.status, CONTENT_MAPPING_ENTITY_STATUS_VALUES, fallback.status),
    workflow:
      key === "posts"
        ? normalizePostWorkflow(record.workflow, fallback.workflow ?? defaultPostWorkflow())
        : null,
  };
};

export const createDefaultContentMappingConfig = (): ContentMappingConfig => ({
  entities: Object.fromEntries(
    CONTENT_MAPPING_ENTITY_KEYS.map((key) => [key, defaultEntityMapping(key)]),
  ) as Record<ContentMappingEntityKey, ContentEntityMapping>,
  filesStorage: null,
  mediaStorage: null,
  version: CONTENT_MAPPING_VERSION,
});

export const hasReadyContentMapping = (mapping: ContentProjectMapping) =>
  mapping.bindingMode === "mapped_content" &&
  mapping.bindingStatus === "ready" &&
  Boolean(
    mapping.mappingConfig.entities.posts.source.schema?.trim() &&
      mapping.mappingConfig.entities.posts.source.table?.trim(),
  );

export const createUnmappedContentMappingConfig = ({
  mappingConfig,
  target,
}: {
  mappingConfig: ContentMappingConfig;
  target: ContentMappingUnmapTarget;
}): ContentMappingConfig => {
  if (target === "all") {
    return createDefaultContentMappingConfig();
  }

  const nextConfig = normalizeContentMappingConfig(cloneMappingConfig(mappingConfig));

  if (target === "posts") {
    nextConfig.entities.posts = defaultEntityMapping("posts");
    nextConfig.entities.authors = defaultEntityMapping("authors");
    nextConfig.entities.categories = defaultEntityMapping("categories");
    nextConfig.entities.tags = defaultEntityMapping("tags");
    return nextConfig;
  }

  if (target === "authors") {
    nextConfig.entities.authors = defaultEntityMapping("authors");
    nextConfig.entities.posts.relations.authors = defaultRelation("authors", false);
    return nextConfig;
  }

  if (target === "categories") {
    nextConfig.entities.categories = defaultEntityMapping("categories");
    nextConfig.entities.posts.relations.categories = defaultRelation("categories", true);
    return nextConfig;
  }

  if (target === "tags") {
    nextConfig.entities.tags = defaultEntityMapping("tags");
    nextConfig.entities.posts.relations.tags = defaultRelation("tags", true);
    return nextConfig;
  }

  if (target === "media") {
    nextConfig.mediaStorage = null;
    return nextConfig;
  }

  nextConfig.filesStorage = null;
  return nextConfig;
};

export const normalizeContentMappingConfig = (input: unknown): ContentMappingConfig => {
  const record = toRecord(input);
  const entities = toRecord(record?.entities);

  const rawFilesStorage = toRecord(record?.filesStorage);
  const rawMediaStorage = toRecord(record?.mediaStorage);

  return {
    entities: Object.fromEntries(
      CONTENT_MAPPING_ENTITY_KEYS.map((key) => [key, normalizeEntityMapping(key, entities?.[key])]),
    ) as Record<ContentMappingEntityKey, ContentEntityMapping>,
    filesStorage: rawFilesStorage
      ? {
          bucketName: toTrimmedString(rawFilesStorage.bucketName) || null,
          endpoint: toTrimmedString(rawFilesStorage.endpoint) || null,
          provider: CONTENT_MEDIA_STORAGE_PROVIDER_VALUES.includes(
            rawFilesStorage.provider as ContentMediaStorageProvider,
          )
            ? (rawFilesStorage.provider as ContentMediaStorageProvider)
            : "none",
          publicUrlBase: toTrimmedString(rawFilesStorage.publicUrlBase) || null,
          region: toTrimmedString(rawFilesStorage.region) || null,
        }
      : null,
    mediaStorage: rawMediaStorage
      ? {
          bucketName: toTrimmedString(rawMediaStorage.bucketName) || null,
          endpoint: toTrimmedString(rawMediaStorage.endpoint) || null,
          provider: CONTENT_MEDIA_STORAGE_PROVIDER_VALUES.includes(
            rawMediaStorage.provider as ContentMediaStorageProvider,
          )
            ? (rawMediaStorage.provider as ContentMediaStorageProvider)
            : "none",
          publicUrlBase: toTrimmedString(rawMediaStorage.publicUrlBase) || null,
          region: toTrimmedString(rawMediaStorage.region) || null,
        }
      : null,
    version: toPositiveInteger(record?.version, CONTENT_MAPPING_VERSION),
  };
};

export const normalizeContentProjectMapping = (input: unknown): ContentProjectMapping => {
  const record = toRecord(input);

  return {
    bindingId: toTrimmedString(record?.bindingId) || toTrimmedString(record?.binding_id),
    bindingMode: normalizeEnumValue(
      record?.bindingMode ?? record?.binding_mode,
      CONTENT_BINDING_MODE_VALUES,
      "mapped_content",
    ),
    bindingStatus: normalizeEnumValue(
      record?.bindingStatus ?? record?.binding_status,
      CONTENT_BINDING_STATUS_VALUES,
      "draft",
    ),
    mappingConfig: normalizeContentMappingConfig(record?.mappingConfig ?? record?.mapping_config),
    revisionId: toNullableString(record?.revisionId ?? record?.revision_id),
    revisionVersion: (() => {
      const value = record?.revisionVersion ?? record?.revision_version;
      const normalized =
        typeof value === "number"
          ? value
          : typeof value === "string"
            ? Number.parseInt(value, 10)
            : Number.NaN;
      return Number.isFinite(normalized) && normalized > 0 ? Math.floor(normalized) : null;
    })(),
  };
};

const getContentEntityLabel = (key: ContentMappingEntityKey) => {
  if (key === "posts") {
    return "Posts";
  }

  if (key === "authors") {
    return "Authors";
  }

  if (key === "categories") {
    return "Categories";
  }

  if (key === "tags") {
    return "Tags";
  }

  if (key === "files") {
    return "Files";
  }

  return "Media";
};

const getContentEntityTableRef = (entity: ContentEntityMapping) => {
  if (
    (entity.source.kind !== "table" && entity.source.kind !== "view") ||
    !entity.source.schema?.trim() ||
    !entity.source.table?.trim()
  ) {
    return null;
  }

  return `${entity.source.schema.trim()}.${entity.source.table.trim()}`;
};

const getContentScalarRelationTableRef = (
  entityTableRef: string,
  sourceRelation: ContentScalarFieldRelationSourceMapping | null | undefined,
) => {
  if (!sourceRelation) {
    return null;
  }

  if (
    sourceRelation.strategy === "related_row_by_post_id" ||
    sourceRelation.strategy === "join_row"
  ) {
    return sourceRelation.junctionTable?.trim() || sourceRelation.targetTable?.trim() || null;
  }

  if (
    sourceRelation.strategy === "foreign_key" ||
    sourceRelation.strategy === "value_match_relation"
  ) {
    return sourceRelation.targetTable?.trim() || null;
  }

  if (sourceRelation.strategy === "inline_fields") {
    return entityTableRef;
  }

  return null;
};

export const getContentMappingDuplicateColumnIssues = (
  mappingConfig: ContentMappingConfig,
): ContentMappingDuplicateColumnIssue[] => {
  const assignments = new Map<
    string,
    {
      column: string;
      descriptor: string | null;
      locations: string[];
      tableRef: string;
    }
  >();

  const addAssignment = (
    tableRef: string | null,
    column: string | null | undefined,
    location: string,
    options?: {
      arrayIndex?: number | null;
      path?: string | null;
    },
  ) => {
    const normalizedTableRef = tableRef?.trim();
    const normalizedColumn = column?.trim();
    const normalizedPath = options?.path?.trim() || null;
    const normalizedArrayIndex =
      Number.isInteger(options?.arrayIndex) && Number(options?.arrayIndex) >= 0
        ? Number(options?.arrayIndex)
        : null;

    if (!normalizedTableRef || !normalizedColumn) {
      return;
    }

    const descriptor =
      normalizedPath
        ? `json_path:${normalizedPath}`
        : normalizedArrayIndex !== null
          ? `array_item:${normalizedArrayIndex}`
          : null;
    const key = `${normalizedTableRef}:${normalizedColumn}:${descriptor ?? "whole_value"}`;
    const current = assignments.get(key);

    if (current) {
      current.locations.push(location);
      return;
    }

    assignments.set(key, {
      column: normalizedColumn,
      descriptor,
      locations: [location],
      tableRef: normalizedTableRef,
    });
  };

  const addScalarFieldAssignment = (
    tableRef: string,
    field: {
      arrayIndex?: number | null;
      column?: string | null;
      path?: string | null;
      sourceRelation?: ContentScalarFieldRelationSourceMapping | null;
    },
    location: string,
  ) => {
    addAssignment(tableRef, field.column, location, {
      arrayIndex: field.arrayIndex,
      path: field.path,
    });

    if (!field.sourceRelation?.valueColumn?.trim()) {
      return;
    }

    addAssignment(
      getContentScalarRelationTableRef(tableRef, field.sourceRelation),
      field.sourceRelation.valueColumn,
      location,
      {
        arrayIndex: field.arrayIndex,
        path: field.path,
      },
    );
  };

  for (const key of CONTENT_MAPPING_ENTITY_KEYS) {
    const entity = mappingConfig.entities[key];
    const entityLabel = getContentEntityLabel(key);
    const tableRef = getContentEntityTableRef(entity);

    if (!tableRef) {
      continue;
    }

    for (const field of Object.values(entity.fields)) {
      addScalarFieldAssignment(tableRef, field, `${entityLabel} ${field.label}`);
    }

    entity.editorFields.forEach((field, index) => {
      addScalarFieldAssignment(
        tableRef,
        field,
        `${entityLabel} ${field.label?.trim() || `Content Field ${index + 1}`}`,
      );
    });

    entity.companionContentColumns.forEach((field, index) => {
      addAssignment(tableRef, field.column, `${entityLabel} Companion Content ${index + 1}`);
    });

    entity.customFields
      .filter((field) => field.enabled)
      .forEach((field) => {
        addScalarFieldAssignment(tableRef, field, `${entityLabel} ${field.label}`);
      });
  }

  return Array.from(assignments.values())
    .filter((entry) => entry.locations.length > 1)
    .map((entry) => ({
      ...entry,
      message: `${entry.tableRef}.${entry.column}${
        entry.descriptor ? ` (${entry.descriptor})` : ""
      } is mapped more than once. Keep each database source mapped to only one field.`,
    }));
};
