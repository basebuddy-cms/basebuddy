import { contentRuntimeHtmlToMarkdown } from "./content-conversion";
import {
  getMappedFieldColumn,
  getMappedFieldPath,
  stripHtmlToPlainText,
  type ContentDatabaseClient,
} from "./mapped-content-runtime-support";
import {
  buildContentSelectColumnsByTextIdQuery,
} from "./adapter/query-builders";
import {
  applyContentArrayIndexPatch,
  applyContentJsonPathPatch,
} from "./adapter/json-array-patch-helpers";
import type {
  ContentCustomFieldMapping,
  ContentEntityMapping,
  ContentMappedField,
} from "./mapping";
import { getContentCustomFieldKey } from "./mapping";

export const normalizeOptionalPostTimestamp = (value: string | null | undefined) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const parsedDate = new Date(trimmedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error("Enter a valid date and time.");
  }

  return parsedDate.toISOString();
};

export const MAPPED_CONTENT_PATCHABLE_MUTABLE_FIELD_KEYS = [
  "excerpt",
  "featuredImageUrl",
  "focusKeyword",
  "seoDescription",
  "seoTitle",
  "slug",
  "title",
  "updatedAt",
] as const;

export const getMappedFieldWriteTarget = (entity: ContentEntityMapping, fieldKey: string) => {
  const column = getMappedFieldColumn(entity, fieldKey);
  const field = entity.fields[fieldKey];

  if (!column && !field?.sourceRelation) {
    return null;
  }

  return {
    arrayIndex: field?.arrayIndex ?? null,
    column,
    field,
    fieldKey,
    path: getMappedFieldPath(entity, fieldKey),
    sourceRelation: field?.sourceRelation ?? null,
  };
};

const buildMappedFieldFromEditorField = (
  editorField: ContentEntityMapping["editorFields"][number],
): ContentMappedField => ({
  arrayIndex:
    Number.isInteger(editorField.arrayIndex) && Number(editorField.arrayIndex) >= 0
      ? Number(editorField.arrayIndex)
      : null,
  column: editorField.column?.trim() || null,
  kind: editorField.kind,
  label: editorField.label,
  path: editorField.path?.trim() || null,
  required: editorField.required,
  ...(editorField.sourceRelation ? { sourceRelation: editorField.sourceRelation } : {}),
  visible: editorField.visible,
});

const buildMappedFieldFromCustomField = (
  customField: ContentCustomFieldMapping,
): ContentMappedField => ({
  arrayIndex:
    Number.isInteger(customField.arrayIndex) && Number(customField.arrayIndex) >= 0
      ? Number(customField.arrayIndex)
      : null,
  column: customField.column?.trim() || null,
  kind: customField.kind,
  label: customField.label,
  path: customField.path?.trim() || null,
  required: !customField.isNullable,
  ...(customField.sourceRelation ? { sourceRelation: customField.sourceRelation } : {}),
  visible: customField.enabled,
});

export const getMappedEditorFieldWriteTarget = (
  editorField: ContentEntityMapping["editorFields"][number],
) => {
  const field = buildMappedFieldFromEditorField(editorField);
  const column = field.column;

  if (!column && !field.sourceRelation) {
    return null;
  }

  return {
    arrayIndex: field.arrayIndex ?? null,
    column,
    field,
    fieldKey: editorField.id,
    path: field.path ?? null,
    sourceRelation: field.sourceRelation ?? null,
  };
};

export const getMappedCustomFieldWriteTarget = (customField: ContentCustomFieldMapping) => {
  const field = buildMappedFieldFromCustomField(customField);
  const column = field.column;

  if (!column && !field.sourceRelation) {
    return null;
  }

  return {
    arrayIndex: field.arrayIndex ?? null,
    column,
    field,
    fieldKey: getContentCustomFieldKey(customField),
    path: field.path ?? null,
    sourceRelation: field.sourceRelation ?? null,
  };
};

export const deriveStoredContentValueForField = ({
  contentHtml,
  contentJson,
  contentMarkdown,
  editorField,
  preferExplicitMarkdown = false,
}: {
  contentHtml: string;
  contentJson: Record<string, unknown>;
  contentMarkdown?: string | null;
  editorField: ContentEntityMapping["editorFields"][number];
  preferExplicitMarkdown?: boolean;
}) => {
  if (editorField.kind === "markdown") {
    if (preferExplicitMarkdown && contentMarkdown !== undefined) {
      return contentMarkdown;
    }

    return contentRuntimeHtmlToMarkdown(contentHtml);
  }

  if (editorField.kind === "json" || editorField.kind === "rich_text") {
    return editorField.path || editorField.arrayIndex != null ? contentJson : JSON.stringify(contentJson);
  }

  if (editorField.kind === "plain_text") {
    return stripHtmlToPlainText(contentHtml);
  }

  return contentHtml;
};

export const applyMappedJsonPathWrite = ({
  column,
  path,
  pendingColumnValues,
  sourceRow,
  value,
}: {
  column: string;
  path: string;
  pendingColumnValues: Map<string, unknown>;
  sourceRow: Record<string, unknown>;
  value: unknown;
}) => {
  const currentTarget = pendingColumnValues.has(column) ? pendingColumnValues.get(column) : sourceRow[column];
  pendingColumnValues.set(
    column,
    applyContentJsonPathPatch({
      allowCreateMissingPath: true,
      allowCreateParentContainers: true,
      path,
      target: currentTarget,
      value,
    }),
  );
};

export const applyMappedArrayIndexWrite = ({
  column,
  index,
  pendingColumnValues,
  sourceRow,
  value,
}: {
  column: string;
  index: number;
  pendingColumnValues: Map<string, unknown>;
  sourceRow: Record<string, unknown>;
  value: unknown;
}) => {
  const currentTarget = pendingColumnValues.has(column) ? pendingColumnValues.get(column) : sourceRow[column];
  const normalizedTarget = Array.isArray(currentTarget)
    ? currentTarget
    : currentTarget === null || currentTarget === undefined
      ? []
      : currentTarget;

  pendingColumnValues.set(
    column,
    applyContentArrayIndexPatch({
      index,
      sourceColumn: column,
      target: normalizedTarget as unknown[],
      value,
    }),
  );
};

export const flushPendingColumnWrites = ({
  pendingColumnValues,
  pushValue,
}: {
  pendingColumnValues: Map<string, unknown>;
  pushValue: (column: string | null | undefined, value: unknown) => void;
}) => {
  for (const [column, value] of pendingColumnValues.entries()) {
    pushValue(column, value);
  }
};

export const loadMappedContentPatchFieldSourceRow = async ({
  additionalColumns = [],
  additionalFields = [],
  client,
  fieldKeys,
  postId,
  postIdColumn,
  posts,
  tableName,
}: {
  additionalColumns?: string[];
  additionalFields?: ContentMappedField[];
  client: ContentDatabaseClient;
  fieldKeys: readonly string[];
  postId: string;
  postIdColumn: string;
  posts: ContentEntityMapping;
  tableName: string;
}) => {
  const columns = Array.from(
    new Set(
      fieldKeys
        .map((fieldKey) => {
          const target = getMappedFieldWriteTarget(posts, fieldKey);
          return target
            ? [
                target.path || target.arrayIndex != null ? target.column : null,
                target.sourceRelation?.sourceColumn ?? null,
              ]
            : [];
        })
        .flat()
        .concat(
          additionalFields
            .map((field) => [
              field.path || field.arrayIndex != null ? field.column : null,
              field.sourceRelation?.sourceColumn ?? null,
            ])
            .flat(),
        )
        .concat(additionalColumns)
        .filter(Boolean) as string[],
    ),
  );

  if (!columns.length) {
    return {};
  }

  const result = await client.query<Record<string, unknown>>(
    buildContentSelectColumnsByTextIdQuery({
      columns,
      idColumn: postIdColumn,
      tableName,
    }),
    [postId],
  );

  return result.rows[0] ?? {};
};
