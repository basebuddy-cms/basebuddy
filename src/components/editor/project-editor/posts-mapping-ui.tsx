"use client";

import React from "react";

import { cn } from "@/lib/utils";

import {
  POSTS_MAPPING_NONE_VALUE,
  POSTS_MAPPING_NOT_IN_TABLE_VALUE,
} from "@/components/editor/project-editor/constants";
import {
  ProjectEditorPostsMappingDetailSection,
  ProjectEditorPostsMappingMiniInput,
  ProjectEditorPostsMappingMiniSelect,
  ProjectEditorPostsMappingRelatedColumnsEditor,
  ProjectEditorPostsMappingRow,
} from "@/components/editor/project-editor/posts-mapping-controls";
import { ProjectEditorPostsMappingRelationStep } from "@/components/editor/project-editor/posts-mapping-step-content";
import type {
  MappingSelectOption,
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

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FieldHelperTextArgs = {
  buildMissingOptionLabel: (label: string) => string;
  getColumnForeignKey: (
    table: ContentIntrospectedTable | null,
    columnName: string | null | undefined,
  ) => ContentIntrospectedTable["foreignKeys"][number] | null;
  getTableColumn: (
    table: ContentIntrospectedTable | null,
    columnName: string | null | undefined,
  ) => ContentIntrospectedTable["columns"][number] | null;
  isBooleanLikeColumn: (column: ContentIntrospectedColumn) => boolean;
  key: PostsMappingFieldOptionKey;
  label: string;
  postsMappingDraft: PostsMappingDraftState | null;
  postsTable: ContentIntrospectedTable | null;
  value: string;
};

type FieldExtraContentProps = {
  addPostsFieldRelatedColumn: (key: PostsMappingFieldOptionKey) => void;
  booleanStatusOptions: Array<{ label: string; value: PostsMappingBooleanStatusMode }>;
  contentKindOptions: Array<{ label: string; value: PostsMappingDraftState["contentKind"] }>;
  getColumnForeignKey: (
    table: ContentIntrospectedTable | null,
    columnName: string | null | undefined,
  ) => ContentIntrospectedTable["foreignKeys"][number] | null;
  getNormalizedSampleValues: (
    table: ContentIntrospectedTable | null,
    columnName: string | null | undefined,
  ) => string[];
  getTableByRef: (tableRef: string) => ContentIntrospectedTable | null;
  getTableColumn: (
    table: ContentIntrospectedTable | null,
    columnName: string | null | undefined,
  ) => ContentIntrospectedTable["columns"][number] | null;
  handleStatusBooleanModeChange: (mode: PostsMappingBooleanStatusMode) => void;
  isBooleanLikeColumn: (column: ContentIntrospectedColumn) => boolean;
  options?: { includeContentKind?: boolean; includeStatusControls?: boolean };
  postsMappingDraft: PostsMappingDraftState;
  postsTable: ContentIntrospectedTable;
  updatePostsDraftField: <K extends keyof PostsMappingDraftState>(
    key: K,
    value: PostsMappingDraftState[K],
  ) => void;
  updatePostsFieldOptions: (
    key: PostsMappingFieldOptionKey,
    nextOptions: Partial<PostsMappingFieldOptionDraft>,
  ) => void;
  updatePostsFieldRelatedColumns: (
    key: PostsMappingFieldOptionKey,
    index: number,
    value: string,
  ) => void;
  updatePostsValueList: (
    key: "archivedValues" | "draftValues" | "publishedValues",
    value: string,
  ) => void;
  value: string;
  fieldKey: PostsMappingFieldOptionKey;
  removePostsFieldRelatedColumn: (key: PostsMappingFieldOptionKey, index: number) => void;
};

type ContentFieldExtraContentProps = {
  getTableColumn: (
    table: ContentIntrospectedTable | null,
    columnName: string | null | undefined,
  ) => ContentIntrospectedTable["columns"][number] | null;
  index: number;
  postsMappingDraft: PostsMappingDraftState;
  postsTable: ContentIntrospectedTable;
  updatePostsContentFieldOptions: (
    index: number,
    nextOptions: Partial<PostsMappingFieldOptionDraft>,
  ) => void;
  value: string;
};

type RelationRowProps = {
  addPostsRelationDisplayColumn: (key: PostsRelationFieldKey) => void;
  applyRelationFieldMapDefaults: (
    key: PostsRelationFieldKey,
    targetTableRef: string,
    fieldMap?: Record<string, string>,
  ) => Record<string, string>;
  columnOptions: MappingSelectOption[];
  getColumnForeignKey: (
    table: ContentIntrospectedTable | null,
    columnName: string | null | undefined,
  ) => ContentIntrospectedTable["foreignKeys"][number] | null;
  getColumnSelectValue: (value: string | null | undefined) => string;
  getJoinRelationSelectionDefaults: (
    key: PostsRelationFieldKey,
    sourceTable: ContentIntrospectedTable,
    joinTableRef: string,
    currentTargetTableRef?: string,
  ) => {
    joinSourceColumn: string;
    joinTargetColumn: string;
    targetColumn: string;
    targetTableRef: string;
  };
  getLikelyTargetColumn: (targetTableRef: string, sourceColumnName?: string | null) => string;
  getRelationFieldConfig: (key: PostsRelationFieldKey) => {
    fields: Array<{ fieldKey: string; label: string }>;
    title: string;
  } | null;
  getRelationTargetTableRef: (
    key: PostsRelationFieldKey,
    relation: PostsMappingRelationDraft,
  ) => string;
  getRelatedColumnsDraft: (targetColumn: string | null | undefined) => string[];
  getTableByRef: (tableRef: string) => ContentIntrospectedTable | null;
  getTableColumn: (
    table: ContentIntrospectedTable | null,
    columnName: string | null | undefined,
  ) => ContentIntrospectedTable["columns"][number] | null;
  getTopEntityTableRef: (entity: PostsRelationEntityKey) => string;
  handleRelationColumnChange: (key: PostsRelationFieldKey, value: string) => void;
  isLikelyIdentifierArrayColumn: (column: ContentIntrospectedColumn | null) => boolean;
  joinTableSelectOptions: MappingSelectOption[];
  label: string;
  postsTable: ContentIntrospectedTable;
  relation: PostsMappingRelationDraft;
  relationEntityByKey: Record<PostsRelationFieldKey, PostsRelationEntityKey>;
  relationKey: PostsRelationFieldKey;
  relationSpecialOptions: MappingSelectOption[];
  removePostsRelationDisplayColumn: (key: PostsRelationFieldKey, index: number) => void;
  updatePostsRelationDisplayColumns: (
    key: PostsRelationFieldKey,
    index: number,
    value: string,
  ) => void;
  updatePostsRelationDraft: (
    key: PostsRelationFieldKey,
    nextRelation: Partial<PostsMappingRelationDraft>,
  ) => void;
  updatePostsRelationFieldMap: (
    key: PostsRelationFieldKey,
    fieldKey: string,
    value: string,
  ) => void;
};

const STATUS_NONE = "__none__";

const normalizeStatusOptionValues = (values: string[] | null | undefined) =>
  [...new Set((values ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean))];

export const getPostsMappingStatusSelectableValues = ({
  currentValues,
  getNormalizedSampleValues,
  postsTable,
  selectedColumn,
  value,
}: {
  currentValues?: string[];
  getNormalizedSampleValues: (
    table: ContentIntrospectedTable | null,
    columnName: string | null | undefined,
  ) => string[];
  postsTable: ContentIntrospectedTable;
  selectedColumn: ContentIntrospectedColumn;
  value: string;
}) => {
  const enumValues = normalizeStatusOptionValues(selectedColumn.enumValues);
  const fallbackSampleValues = getNormalizedSampleValues(postsTable, value);

  return [
    ...new Set([
      ...normalizeStatusOptionValues(currentValues),
      ...(enumValues.length > 0 ? enumValues : fallbackSampleValues),
    ]),
  ];
};

export function getProjectEditorPostsMappingFieldHelperText({
  buildMissingOptionLabel,
  getColumnForeignKey,
  getTableColumn,
  isBooleanLikeColumn,
  key,
  label,
  postsMappingDraft,
  postsTable,
  value,
}: FieldHelperTextArgs) {
  if (!postsTable) {
    return "";
  }

  if (value === POSTS_MAPPING_NOT_IN_TABLE_VALUE) {
    return `${label} is stored in another table.`;
  }

  if (value === POSTS_MAPPING_NONE_VALUE) {
    return buildMissingOptionLabel(label);
  }

  const selectedColumn = getTableColumn(postsTable, value);

  if (!selectedColumn) {
    return "";
  }

  const columnRef = `${postsTable.name}.${selectedColumn.name}`;
  const foreignKey = getColumnForeignKey(postsTable, value);
  const fieldOptions = postsMappingDraft?.fieldOptions[key];
  const selectedRelatedColumns = (fieldOptions?.relatedColumns ?? [])
    .filter((entry) => entry !== POSTS_MAPPING_NONE_VALUE)
    .join(", ");

  if (foreignKey) {
    return selectedRelatedColumns
      ? `FK connected to ${foreignKey.targetSchema}.${foreignKey.targetTable}. Showing ${selectedRelatedColumns}.`
      : `FK connected to ${foreignKey.targetSchema}.${foreignKey.targetTable}.`;
  }

  if (selectedColumn.isArray) {
    if (key === "redirectsColumn") {
      return `Stored as an array on ${columnRef}. BaseBuddy will use every item as a redirect path.`;
    }

    return `Stored as array values on ${columnRef}. We will use item ${fieldOptions?.arrayItemIndex || "1"}.`;
  }

  if (selectedColumn.isJson) {
    const normalizedJsonPath = fieldOptions?.jsonPath?.trim() ?? "";
    return normalizedJsonPath
      ? `Stored as JSON on ${columnRef}. We will use the "${normalizedJsonPath}" path.`
      : `Stored as JSON on ${columnRef}.`;
  }

  if (label === "Content") {
    return `Editor content comes from ${columnRef}.`;
  }

  if (label === "Status") {
    return isBooleanLikeColumn(selectedColumn)
      ? `Boolean publish state comes from ${columnRef}.`
      : `Workflow status comes from ${columnRef}.`;
  }

  if (label === "Published At") {
    return `Publish date comes from ${columnRef}.`;
  }

  if (label === "Redirects") {
    return `Redirect paths come from ${columnRef}.`;
  }

  if (label === "Created At") {
    return `Original create date comes from ${columnRef}.`;
  }

  if (label === "Updated At") {
    return `Last update date comes from ${columnRef}.`;
  }

  return `Using ${columnRef}.`;
}

export function ProjectEditorPostsMappingFieldExtraContent({
  addPostsFieldRelatedColumn,
  booleanStatusOptions,
  contentKindOptions,
  getColumnForeignKey,
  getNormalizedSampleValues,
  getTableByRef,
  getTableColumn,
  handleStatusBooleanModeChange,
  isBooleanLikeColumn,
  options,
  postsMappingDraft,
  postsTable,
  removePostsFieldRelatedColumn,
  updatePostsDraftField,
  updatePostsFieldOptions,
  updatePostsFieldRelatedColumns,
  updatePostsValueList,
  value,
  fieldKey,
}: FieldExtraContentProps) {
  if (value === POSTS_MAPPING_NONE_VALUE || value === POSTS_MAPPING_NOT_IN_TABLE_VALUE) {
    return null;
  }

  const selectedColumn = getTableColumn(postsTable, value);

  if (!selectedColumn) {
    return null;
  }

  const fieldOptions = postsMappingDraft.fieldOptions[fieldKey];
  const isRedirectsField = fieldKey === "redirectsColumn";
  const foreignKey = getColumnForeignKey(postsTable, value);
  const relatedTable = getTableByRef(fieldOptions.relatedTableRef);
  const relatedColumnOptions =
    relatedTable?.columns.map((column) => ({
      label: column.name,
      value: column.name,
    })) ?? [];
  const showArrayItemControl = selectedColumn.isArray && !isRedirectsField;
  const showBooleanStatusControl = Boolean(options?.includeStatusControls && isBooleanLikeColumn(selectedColumn));
  const showStatusValueInputs = Boolean(options?.includeStatusControls && !isBooleanLikeColumn(selectedColumn));
  const hasTopControls =
    options?.includeContentKind || showArrayItemControl || showBooleanStatusControl || showStatusValueInputs;
  const showRelatedColumnsControl = Boolean(foreignKey && relatedColumnOptions.length > 0);

  return (
    <>
      {hasTopControls ? (
        <div className="grid gap-3 pt-1 sm:grid-cols-2 lg:grid-cols-3">
          {options?.includeContentKind ? (
            <ProjectEditorPostsMappingMiniSelect
              label="Content type"
              onChange={(nextValue) =>
                updatePostsDraftField("contentKind", nextValue as PostsMappingDraftState["contentKind"])
              }
              options={contentKindOptions}
              value={postsMappingDraft.contentKind}
            />
          ) : null}
          {showBooleanStatusControl ? (
            <ProjectEditorPostsMappingMiniSelect
              label="Status behavior"
              onChange={(nextValue) =>
                handleStatusBooleanModeChange(nextValue as PostsMappingBooleanStatusMode)
              }
              options={booleanStatusOptions}
              value={postsMappingDraft.statusBooleanMode}
            />
          ) : null}
          {showArrayItemControl ? (
            <ProjectEditorPostsMappingMiniInput
              inputMode="numeric"
              label="Item number"
              min="1"
              onChange={(nextValue) =>
                updatePostsFieldOptions(fieldKey, {
                  arrayItemIndex: (() => {
                    const normalizedValue = nextValue.replace(/[^0-9]/g, "");
                    return normalizedValue && normalizedValue !== "0" ? normalizedValue : "1";
                  })(),
                })
              }
              placeholder="1"
              type="number"
              value={fieldOptions.arrayItemIndex}
            />
          ) : null}
          {showStatusValueInputs ? (
            (() => {
              const statusSelectableValues = getPostsMappingStatusSelectableValues({
                currentValues: [
                  ...postsMappingDraft.draftValues,
                  ...postsMappingDraft.publishedValues,
                  ...postsMappingDraft.archivedValues,
                ],
                getNormalizedSampleValues,
                postsTable,
                selectedColumn,
                value,
              });
              const currentDraft = postsMappingDraft.draftValues[0] ?? STATUS_NONE;
              const currentPublished = postsMappingDraft.publishedValues[0] ?? STATUS_NONE;
              const currentArchived = postsMappingDraft.archivedValues[0] ?? STATUS_NONE;
              const renderStatusSelect = (
                listKey: "draftValues" | "publishedValues" | "archivedValues",
                statusLabel: string,
                dotColor: string,
                currentValue: string,
                otherValues: string[],
              ) => {
                const usedByOthers = new Set(otherValues.filter((entry) => entry !== STATUS_NONE));
                const availableOptions = statusSelectableValues.filter((entry) => !usedByOthers.has(entry));
                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("h-3 w-3 rounded-full", dotColor)} />
                      <Label className="text-xs font-medium text-foreground">{statusLabel}</Label>
                    </div>
                    {statusSelectableValues.length > 0 ? (
                      <Select
                        value={currentValue}
                        onValueChange={(nextValue) =>
                          updatePostsDraftField(
                            listKey,
                            (nextValue === STATUS_NONE ? [] : [nextValue]) as PostsMappingDraftState[typeof listKey],
                          )
                        }
                      >
                        <SelectTrigger className="h-9 w-full border-border bg-secondary text-sm shadow-none sm:w-[240px]">
                          <SelectValue placeholder="Not assigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={STATUS_NONE}>Not assigned</SelectItem>
                          {availableOptions.map((entry) => (
                            <SelectItem key={`${listKey}-${entry}`} value={entry}>
                              {entry}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={currentValue === STATUS_NONE ? "" : currentValue}
                        onChange={(event) => updatePostsValueList(listKey, event.target.value)}
                        placeholder={`Enter ${statusLabel.toLowerCase()} value`}
                        className="h-9 border-border bg-secondary text-sm shadow-none"
                      />
                    )}
                  </div>
                );
              };

              return (
                <div className="col-span-full space-y-5 pt-2">
                  <p className="text-xs text-muted-foreground">
                    {statusSelectableValues.length > 0
                      ? selectedColumn.enumValues && selectedColumn.enumValues.length > 0
                        ? "Select the allowed status value for each post state. Each value can only belong to one state."
                        : "Select which value represents each post state. Each value can only belong to one state."
                      : "Enter the column value for each state."}
                  </p>
                  {renderStatusSelect(
                    "draftValues",
                    "Draft",
                    "bg-muted-foreground",
                    currentDraft,
                    [currentPublished, currentArchived],
                  )}
                  {renderStatusSelect(
                    "publishedValues",
                    "Published",
                    "bg-success",
                    currentPublished,
                    [currentDraft, currentArchived],
                  )}
                  {renderStatusSelect(
                    "archivedValues",
                    "Archived",
                    "bg-warning",
                    currentArchived,
                    [currentDraft, currentPublished],
                  )}
                </div>
              );
            })()
          ) : null}
        </div>
      ) : null}
      {showRelatedColumnsControl ? (
        <ProjectEditorPostsMappingRelatedColumnsEditor
          addLabel="Add display field"
          onAdd={() => addPostsFieldRelatedColumn(fieldKey)}
          onChange={(index, nextValue) => updatePostsFieldRelatedColumns(fieldKey, index, nextValue)}
          onRemove={(index) => removePostsFieldRelatedColumn(fieldKey, index)}
          options={relatedColumnOptions}
          values={fieldOptions.relatedColumns}
        />
      ) : null}
    </>
  );
}

export function ProjectEditorPostsMappingContentFieldExtraContent({
  getTableColumn,
  index,
  postsMappingDraft,
  postsTable,
  updatePostsContentFieldOptions,
  value,
}: ContentFieldExtraContentProps) {
  if (value === POSTS_MAPPING_NONE_VALUE || value === POSTS_MAPPING_NOT_IN_TABLE_VALUE) {
    return null;
  }

  const selectedColumn = getTableColumn(postsTable, value);

  if (!selectedColumn) {
    return null;
  }

  const fieldOptions = postsMappingDraft.contentFieldOptions[index] ?? {
    arrayItemIndex: "1",
    jsonPath: "",
    relatedColumns: [POSTS_MAPPING_NONE_VALUE],
    relatedTableRef: POSTS_MAPPING_NONE_VALUE,
  };
  const showJsonPathControl = selectedColumn.isJson;
  const showArrayItemControl = selectedColumn.isArray;

  if (!showJsonPathControl && !showArrayItemControl) {
    return null;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {showJsonPathControl ? (
        <ProjectEditorPostsMappingMiniInput
          label="JSON path"
          onChange={(nextValue) =>
            updatePostsContentFieldOptions(index, {
              jsonPath: nextValue.trim(),
            })
          }
          placeholder="body.main"
          value={fieldOptions.jsonPath}
        />
      ) : null}
      {showArrayItemControl ? (
        <ProjectEditorPostsMappingMiniInput
          inputMode="numeric"
          label="Item number"
          min="1"
          onChange={(nextValue) =>
            updatePostsContentFieldOptions(index, {
              arrayItemIndex: (() => {
                const normalizedValue = nextValue.replace(/[^0-9]/g, "");
                return normalizedValue && normalizedValue !== "0" ? normalizedValue : "1";
              })(),
            })
          }
          placeholder="1"
          type="number"
          value={fieldOptions.arrayItemIndex}
        />
      ) : null}
    </div>
  );
}

export function ProjectEditorPostsMappingRelationRow({
  addPostsRelationDisplayColumn,
  applyRelationFieldMapDefaults,
  columnOptions,
  getColumnForeignKey,
  getColumnSelectValue,
  getJoinRelationSelectionDefaults,
  getLikelyTargetColumn,
  getRelationFieldConfig,
  getRelationTargetTableRef,
  getRelatedColumnsDraft,
  getTableByRef,
  getTableColumn,
  getTopEntityTableRef,
  handleRelationColumnChange,
  isLikelyIdentifierArrayColumn,
  joinTableSelectOptions,
  label,
  postsTable,
  relation,
  relationEntityByKey,
  relationKey,
  relationSpecialOptions,
  removePostsRelationDisplayColumn,
  updatePostsRelationDisplayColumns,
  updatePostsRelationDraft,
  updatePostsRelationFieldMap,
}: RelationRowProps) {
  const selectedColumn = getTableColumn(postsTable, relation.column);
  const selectedForeignKey = getColumnForeignKey(postsTable, relation.column);
  const relationJoinTable = getTableByRef(relation.joinTableRef);
  const relationJoinColumnOptions =
    relationJoinTable?.columns
      .filter((column) => column.name !== relation.joinSourceColumn)
      .map((column) => ({
        label: column.name,
        value: column.name,
      })) ?? [];
  const relationTargetTable = getTableByRef(getRelationTargetTableRef(relationKey, relation));
  const relationTargetColumnOptions =
    relationTargetTable?.columns.map((column) => ({
      label: column.name,
      value: column.name,
    })) ?? [];
  const relationFieldConfig = getRelationFieldConfig(relationKey);
  const showJoinTableControls =
    relation.column === POSTS_MAPPING_NOT_IN_TABLE_VALUE && relation.strategy === "join_table";
  const showInlineFieldsNotice =
    relation.column === POSTS_MAPPING_NOT_IN_TABLE_VALUE && relation.strategy === "inline_fields";
  const showLookupArrayControls =
    Boolean(selectedColumn?.isArray) &&
    isLikelyIdentifierArrayColumn(selectedColumn) &&
    relation.column !== POSTS_MAPPING_NOT_IN_TABLE_VALUE;
  const showJsonShapeControl = Boolean(selectedColumn?.isJson);
  const showJoinRelatedColumnControl =
    showJoinTableControls &&
    relation.joinTableRef !== POSTS_MAPPING_NONE_VALUE &&
    relationJoinColumnOptions.length > 0;
  const showEntityFieldMapControls =
    Boolean(relationFieldConfig) &&
    relation.strategy !== "missing" &&
    relation.strategy !== "inline_fields" &&
    Boolean(relationTargetTable) &&
    relationTargetColumnOptions.length > 0;
  const showRelatedColumnsControl =
    !showEntityFieldMapControls &&
    relation.column !== POSTS_MAPPING_NONE_VALUE &&
    relation.strategy !== "missing" &&
    relation.strategy !== "inline_fields" &&
    relationTargetColumnOptions.length > 0 &&
    (Boolean(selectedForeignKey) || showLookupArrayControls || showJsonShapeControl);

  return (
    <ProjectEditorPostsMappingRelationStep
      columnOptions={columnOptions}
      joinTableSelectOptions={joinTableSelectOptions}
      label={label}
      onColumnChange={(value) => handleRelationColumnChange(relationKey, value)}
      onDisplayColumnAdd={() => addPostsRelationDisplayColumn(relationKey)}
      onDisplayColumnChange={(index, value) =>
        updatePostsRelationDisplayColumns(relationKey, index, value)
      }
      onDisplayColumnRemove={(index) => removePostsRelationDisplayColumn(relationKey, index)}
      onFieldMapChange={(fieldKey, value) => updatePostsRelationFieldMap(relationKey, fieldKey, value)}
      onJoinTableChange={(value) => {
        const joinSelectionDefaults =
          value !== POSTS_MAPPING_NONE_VALUE
            ? getJoinRelationSelectionDefaults(
                relationKey,
                postsTable,
                value,
                getRelationTargetTableRef(relationKey, relation),
              )
            : {
                joinSourceColumn: POSTS_MAPPING_NONE_VALUE,
                joinTargetColumn: POSTS_MAPPING_NONE_VALUE,
                targetColumn: POSTS_MAPPING_NONE_VALUE,
                targetTableRef: POSTS_MAPPING_NONE_VALUE,
              };

        updatePostsRelationDraft(relationKey, {
          displayColumns: getRelatedColumnsDraft(joinSelectionDefaults.targetColumn),
          fieldMap:
            joinSelectionDefaults.targetTableRef !== POSTS_MAPPING_NONE_VALUE
              ? applyRelationFieldMapDefaults(
                  relationKey,
                  joinSelectionDefaults.targetTableRef,
                  relation.fieldMap,
                )
              : {},
          joinSourceColumn: joinSelectionDefaults.joinSourceColumn,
          joinTableRef: value,
          joinTargetColumn: joinSelectionDefaults.joinTargetColumn,
          targetColumn: joinSelectionDefaults.targetColumn,
          targetTableRef: joinSelectionDefaults.targetTableRef,
        });
      }}
      onJoinTargetColumnChange={(value) => {
        const fallbackTargetTableRef = getTopEntityTableRef(relationEntityByKey[relationKey]);
        const selectedJoinTargetForeignKey =
          relationJoinTable && value !== POSTS_MAPPING_NONE_VALUE
            ? getColumnForeignKey(relationJoinTable, value)
            : null;
        const nextTargetTableRef = selectedJoinTargetForeignKey
          ? `${selectedJoinTargetForeignKey.targetSchema}.${selectedJoinTargetForeignKey.targetTable}`
          : fallbackTargetTableRef;
        const nextTargetColumn = selectedJoinTargetForeignKey
          ? getColumnSelectValue(selectedJoinTargetForeignKey.targetColumn)
          : getLikelyTargetColumn(nextTargetTableRef, value);

        updatePostsRelationDraft(relationKey, {
          displayColumns: getRelatedColumnsDraft(nextTargetColumn),
          fieldMap:
            nextTargetTableRef !== POSTS_MAPPING_NONE_VALUE
              ? applyRelationFieldMapDefaults(relationKey, nextTargetTableRef, relation.fieldMap)
              : {},
          joinTargetColumn: value,
          targetColumn: nextTargetColumn,
          targetTableRef: nextTargetTableRef,
        });
      }}
      onJsonShapeChange={(value) =>
        updatePostsRelationDraft(relationKey, {
          strategy: value,
        })
      }
      relation={relation}
      relationFieldConfig={relationFieldConfig}
      relationJoinColumnOptions={relationJoinColumnOptions}
      relationKey={relationKey}
      relationSpecialOptions={relationSpecialOptions}
      relationTargetColumnOptions={relationTargetColumnOptions}
      renderMappingDetailSection={ProjectEditorPostsMappingDetailSection}
      renderMiniSelect={ProjectEditorPostsMappingMiniSelect}
      renderPostsMappingRow={ProjectEditorPostsMappingRow}
      renderRelatedColumnsEditor={ProjectEditorPostsMappingRelatedColumnsEditor}
      showEntityFieldMapControls={showEntityFieldMapControls}
      showInlineFieldsNotice={showInlineFieldsNotice}
      showJoinRelatedColumnControl={showJoinRelatedColumnControl}
      showJoinTableControls={showJoinTableControls}
      showJsonShapeControl={showJsonShapeControl}
      showRelatedColumnsControl={showRelatedColumnsControl}
    />
  );
}
