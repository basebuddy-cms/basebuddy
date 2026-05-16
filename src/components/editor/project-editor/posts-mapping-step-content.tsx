"use client";

import React from "react";
import type { ReactNode } from "react";

import { POSTS_MAPPING_NONE_VALUE } from "@/components/editor/project-editor/constants";
import {
  ProjectEditorPostsMappingContentFieldsEditor,
} from "@/components/editor/project-editor/posts-mapping-controls";
import type {
  MappingSelectOption,
  PostsMappingDraftState,
  PostsMappingFieldOptionKey,
  PostsMappingRelationDraft,
  PostsMappingRelationKey,
  ProjectEditorMappingRowRenderProps,
} from "@/components/editor/project-editor/types";

type MappingRowRenderer = (props: ProjectEditorMappingRowRenderProps) => ReactNode;
type MappingFieldExtraRenderer = (
  key: PostsMappingFieldOptionKey,
  value: string,
  options?: { includeContentKind?: boolean; includeStatusControls?: boolean },
) => ReactNode;
type MappingFieldLabelBuilder = (label: string) => MappingSelectOption[];
type MappingFieldHelperTextGetter = (
  label: string,
  key: PostsMappingFieldOptionKey,
  value: string,
) => string;
type MappingMiniSelectRenderer = (props: {
  helperText?: string;
  label: string;
  onChange: (value: string) => void;
  options: MappingSelectOption[];
  selectClassName?: string;
  value: string;
}) => ReactNode;
type MappingDetailSectionRenderer = (props: {
  children: ReactNode;
  description?: string;
  title: string;
}) => ReactNode;
type RelatedColumnsEditorRenderer = (props: {
  addLabel?: string;
  onAdd: () => void;
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  options: MappingSelectOption[];
  values: string[];
}) => ReactNode;

type PostsMappingRelationFieldConfig = {
  fields: Array<{
    fieldKey: string;
    label: string;
  }>;
  title: string;
};

type ProjectEditorPostsMappingCoreFieldsStepProps = {
  buildSpecialSelectOptions: MappingFieldLabelBuilder;
  columnOptions: MappingSelectOption[];
  contentKindOptions: Array<{ label: string; value: PostsMappingDraftState["contentKind"] }>;
  getFieldHelperText: MappingFieldHelperTextGetter;
  handleContentFieldAdd: (index: number) => void;
  handleContentFieldChange: (index: number, value: string) => void;
  handleContentFieldKindChange: (index: number, value: PostsMappingDraftState["contentKind"]) => void;
  handleContentFieldMove: (index: number, direction: "down" | "up") => void;
  handleContentFieldRemove: (index: number) => void;
  handleFieldColumnChange: (key: Exclude<PostsMappingFieldOptionKey, "contentColumn">, value: string) => void;
  postsMappingDraft: PostsMappingDraftState;
  renderContentFieldExtraContent: (index: number, value: string) => ReactNode;
  renderFieldExtraContent: MappingFieldExtraRenderer;
  renderPostsMappingRow: MappingRowRenderer;
};

type ProjectEditorPostsMappingStatusStepProps = {
  buildSpecialSelectOptions: MappingFieldLabelBuilder;
  columnOptions: MappingSelectOption[];
  getFieldHelperText: MappingFieldHelperTextGetter;
  handleStatusColumnChange: (value: string) => void;
  postsMappingDraft: PostsMappingDraftState;
  renderFieldExtraContent: MappingFieldExtraRenderer;
  renderPostsMappingRow: MappingRowRenderer;
};

type ProjectEditorPostsMappingTimestampsStepProps = {
  buildSpecialSelectOptions: MappingFieldLabelBuilder;
  columnOptions: MappingSelectOption[];
  getFieldHelperText: MappingFieldHelperTextGetter;
  handleFieldColumnChange: (key: Exclude<PostsMappingFieldOptionKey, "contentColumn">, value: string) => void;
  postsMappingDraft: PostsMappingDraftState;
  renderFieldExtraContent: MappingFieldExtraRenderer;
  renderPostsMappingRow: MappingRowRenderer;
};

type ProjectEditorPostsMappingSeoStepProps = {
  buildSpecialSelectOptions: MappingFieldLabelBuilder;
  columnOptions: MappingSelectOption[];
  getFieldHelperText: MappingFieldHelperTextGetter;
  handleFieldColumnChange: (key: Exclude<PostsMappingFieldOptionKey, "contentColumn">, value: string) => void;
  postsMappingDraft: PostsMappingDraftState;
  renderFieldExtraContent: MappingFieldExtraRenderer;
  renderPostsMappingRow: MappingRowRenderer;
};

type ProjectEditorPostsMappingRelationStepProps = {
  columnOptions: MappingSelectOption[];
  joinTableSelectOptions: MappingSelectOption[];
  label: string;
  onColumnChange: (value: string) => void;
  onDisplayColumnAdd: () => void;
  onDisplayColumnChange: (index: number, value: string) => void;
  onDisplayColumnRemove: (index: number) => void;
  onFieldMapChange: (fieldKey: string, value: string) => void;
  onJoinTableChange: (value: string) => void;
  onJoinTargetColumnChange: (value: string) => void;
  onJsonShapeChange: (value: PostsMappingRelationDraft["strategy"]) => void;
  relation: PostsMappingRelationDraft;
  relationFieldConfig: PostsMappingRelationFieldConfig | null;
  relationJoinColumnOptions: MappingSelectOption[];
  relationKey: PostsMappingRelationKey;
  relationSpecialOptions: MappingSelectOption[];
  relationTargetColumnOptions: MappingSelectOption[];
  renderMappingDetailSection: MappingDetailSectionRenderer;
  renderMiniSelect: MappingMiniSelectRenderer;
  renderPostsMappingRow: MappingRowRenderer;
  renderRelatedColumnsEditor: RelatedColumnsEditorRenderer;
  showEntityFieldMapControls: boolean;
  showInlineFieldsNotice: boolean;
  showJoinRelatedColumnControl: boolean;
  showJoinTableControls: boolean;
  showJsonShapeControl: boolean;
  showRelatedColumnsControl: boolean;
};

export function ProjectEditorPostsMappingCoreFieldsStep({
  buildSpecialSelectOptions,
  columnOptions,
  contentKindOptions,
  getFieldHelperText,
  handleContentFieldAdd,
  handleContentFieldChange,
  handleContentFieldKindChange,
  handleContentFieldMove,
  handleContentFieldRemove,
  handleFieldColumnChange,
  postsMappingDraft,
  renderContentFieldExtraContent,
  renderFieldExtraContent,
  renderPostsMappingRow,
}: ProjectEditorPostsMappingCoreFieldsStepProps) {
  const primaryContentColumn = postsMappingDraft.contentColumns[0] ?? POSTS_MAPPING_NONE_VALUE;

  return (
    <>
      {renderPostsMappingRow({
        extraContent: renderFieldExtraContent("idColumn", postsMappingDraft.idColumn),
        helperText: getFieldHelperText("ID", "idColumn", postsMappingDraft.idColumn),
        label: "ID",
        onChange: (value) => handleFieldColumnChange("idColumn", value),
        options: columnOptions,
        required: true,
        specialOptions: buildSpecialSelectOptions("ID"),
        value: postsMappingDraft.idColumn,
      })}
      {renderPostsMappingRow({
        extraContent: renderFieldExtraContent("titleColumn", postsMappingDraft.titleColumn),
        helperText: getFieldHelperText("Title", "titleColumn", postsMappingDraft.titleColumn),
        label: "Title",
        onChange: (value) => handleFieldColumnChange("titleColumn", value),
        options: columnOptions,
        specialOptions: buildSpecialSelectOptions("title"),
        value: postsMappingDraft.titleColumn,
      })}
      <div className="grid gap-x-6 gap-y-2 md:grid-cols-[160px_minmax(0,1fr)]">
        <div className="pt-1.5">
          <span className="text-sm font-medium text-foreground">
            Content
            <span className="ml-0.5 text-destructive">*</span>
          </span>
        </div>
        <div className="min-w-0 space-y-3">
          <ProjectEditorPostsMappingContentFieldsEditor
            contentKindOptions={contentKindOptions}
            contentKinds={postsMappingDraft.contentColumnKinds}
            extraContents={postsMappingDraft.contentColumns.map((value, index) =>
              renderContentFieldExtraContent(index, value),
            )}
            onAdd={handleContentFieldAdd}
            onChange={handleContentFieldChange}
            onKindChange={(index, value) =>
              handleContentFieldKindChange(index, value as PostsMappingDraftState["contentKind"])
            }
            onMoveDown={(index) => handleContentFieldMove(index, "down")}
            onMoveUp={(index) => handleContentFieldMove(index, "up")}
            onRemove={handleContentFieldRemove}
            options={columnOptions}
            specialOptions={buildSpecialSelectOptions("content")}
            values={postsMappingDraft.contentColumns}
          />
          <p className="max-w-xl text-xs leading-5 text-muted-foreground">
            {getFieldHelperText("Content", "contentColumn", primaryContentColumn)}
            {" "}Each content field keeps its own format. The editor still treats the first mapped field as the primary content field.
          </p>
        </div>
      </div>
      {renderPostsMappingRow({
        extraContent: renderFieldExtraContent("slugColumn", postsMappingDraft.slugColumn),
        helperText: getFieldHelperText("Slug", "slugColumn", postsMappingDraft.slugColumn),
        label: "Slug",
        onChange: (value) => handleFieldColumnChange("slugColumn", value),
        options: columnOptions,
        specialOptions: buildSpecialSelectOptions("slug"),
        value: postsMappingDraft.slugColumn,
      })}
      {renderPostsMappingRow({
        extraContent: renderFieldExtraContent("redirectsColumn", postsMappingDraft.redirectsColumn),
        helperText: getFieldHelperText("Redirects", "redirectsColumn", postsMappingDraft.redirectsColumn),
        label: "Redirects",
        onChange: (value) => handleFieldColumnChange("redirectsColumn", value),
        options: columnOptions,
        specialOptions: buildSpecialSelectOptions("redirects"),
        value: postsMappingDraft.redirectsColumn,
      })}
      {renderPostsMappingRow({
        extraContent: renderFieldExtraContent("excerptColumn", postsMappingDraft.excerptColumn),
        helperText: getFieldHelperText("Excerpt", "excerptColumn", postsMappingDraft.excerptColumn),
        label: "Excerpt",
        onChange: (value) => handleFieldColumnChange("excerptColumn", value),
        options: columnOptions,
        specialOptions: buildSpecialSelectOptions("excerpt"),
        value: postsMappingDraft.excerptColumn,
      })}
      {renderPostsMappingRow({
        extraContent: renderFieldExtraContent("featuredImageUrlColumn", postsMappingDraft.featuredImageUrlColumn),
        helperText: getFieldHelperText(
          "Featured Image",
          "featuredImageUrlColumn",
          postsMappingDraft.featuredImageUrlColumn,
        ),
        label: "Featured Image",
        onChange: (value) => handleFieldColumnChange("featuredImageUrlColumn", value),
        options: columnOptions,
        specialOptions: buildSpecialSelectOptions("featured image"),
        value: postsMappingDraft.featuredImageUrlColumn,
      })}
    </>
  );
}

export function ProjectEditorPostsMappingStatusStep({
  buildSpecialSelectOptions,
  columnOptions,
  getFieldHelperText,
  handleStatusColumnChange,
  postsMappingDraft,
  renderFieldExtraContent,
  renderPostsMappingRow,
}: ProjectEditorPostsMappingStatusStepProps) {
  return renderPostsMappingRow({
    extraContent: renderFieldExtraContent("statusColumn", postsMappingDraft.statusColumn, {
      includeStatusControls: true,
    }),
    helperText: getFieldHelperText("Status", "statusColumn", postsMappingDraft.statusColumn),
    label: "Status",
    onChange: handleStatusColumnChange,
    options: columnOptions,
    specialOptions: buildSpecialSelectOptions("status"),
    value: postsMappingDraft.statusColumn,
  });
}

export function ProjectEditorPostsMappingTimestampsStep({
  buildSpecialSelectOptions,
  columnOptions,
  getFieldHelperText,
  handleFieldColumnChange,
  postsMappingDraft,
  renderFieldExtraContent,
  renderPostsMappingRow,
}: ProjectEditorPostsMappingTimestampsStepProps) {
  return (
    <>
      {renderPostsMappingRow({
        extraContent: renderFieldExtraContent("createdAtColumn", postsMappingDraft.createdAtColumn),
        helperText: getFieldHelperText("Created At", "createdAtColumn", postsMappingDraft.createdAtColumn),
        label: "Created At",
        onChange: (value) => handleFieldColumnChange("createdAtColumn", value),
        options: columnOptions,
        specialOptions: buildSpecialSelectOptions("created at"),
        value: postsMappingDraft.createdAtColumn,
      })}
      {renderPostsMappingRow({
        extraContent: renderFieldExtraContent("publishedAtColumn", postsMappingDraft.publishedAtColumn),
        helperText: getFieldHelperText("Published At", "publishedAtColumn", postsMappingDraft.publishedAtColumn),
        label: "Published At",
        onChange: (value) => handleFieldColumnChange("publishedAtColumn", value),
        options: columnOptions,
        specialOptions: buildSpecialSelectOptions("published at"),
        value: postsMappingDraft.publishedAtColumn,
      })}
      {renderPostsMappingRow({
        extraContent: renderFieldExtraContent("updatedAtColumn", postsMappingDraft.updatedAtColumn),
        helperText: getFieldHelperText("Updated At", "updatedAtColumn", postsMappingDraft.updatedAtColumn),
        label: "Updated At",
        onChange: (value) => handleFieldColumnChange("updatedAtColumn", value),
        options: columnOptions,
        specialOptions: buildSpecialSelectOptions("updated at"),
        value: postsMappingDraft.updatedAtColumn,
      })}
    </>
  );
}

export function ProjectEditorPostsMappingSeoStep({
  buildSpecialSelectOptions,
  columnOptions,
  getFieldHelperText,
  handleFieldColumnChange,
  postsMappingDraft,
  renderFieldExtraContent,
  renderPostsMappingRow,
}: ProjectEditorPostsMappingSeoStepProps) {
  return (
    <>
      {renderPostsMappingRow({
        extraContent: renderFieldExtraContent("seoTitleColumn", postsMappingDraft.seoTitleColumn),
        helperText: getFieldHelperText("Meta Title", "seoTitleColumn", postsMappingDraft.seoTitleColumn),
        label: "Meta Title",
        onChange: (value) => handleFieldColumnChange("seoTitleColumn", value),
        options: columnOptions,
        specialOptions: buildSpecialSelectOptions("meta title"),
        value: postsMappingDraft.seoTitleColumn,
      })}
      {renderPostsMappingRow({
        extraContent: renderFieldExtraContent("seoDescriptionColumn", postsMappingDraft.seoDescriptionColumn),
        helperText: getFieldHelperText("Meta Description", "seoDescriptionColumn", postsMappingDraft.seoDescriptionColumn),
        label: "Meta Description",
        onChange: (value) => handleFieldColumnChange("seoDescriptionColumn", value),
        options: columnOptions,
        specialOptions: buildSpecialSelectOptions("meta description"),
        value: postsMappingDraft.seoDescriptionColumn,
      })}
      {renderPostsMappingRow({
        extraContent: renderFieldExtraContent("focusKeywordColumn", postsMappingDraft.focusKeywordColumn),
        helperText: getFieldHelperText("Focus Keyword", "focusKeywordColumn", postsMappingDraft.focusKeywordColumn),
        label: "Focus Keyword",
        onChange: (value) => handleFieldColumnChange("focusKeywordColumn", value),
        options: columnOptions,
        specialOptions: buildSpecialSelectOptions("focus keyword"),
        value: postsMappingDraft.focusKeywordColumn,
      })}
    </>
  );
}

export function ProjectEditorPostsMappingRelationStep({
  columnOptions,
  joinTableSelectOptions,
  label,
  onColumnChange,
  onDisplayColumnAdd,
  onDisplayColumnChange,
  onDisplayColumnRemove,
  onFieldMapChange,
  onJoinTableChange,
  onJoinTargetColumnChange,
  onJsonShapeChange,
  relation,
  relationFieldConfig,
  relationJoinColumnOptions,
  relationKey,
  relationSpecialOptions,
  relationTargetColumnOptions,
  renderMappingDetailSection,
  renderMiniSelect,
  renderPostsMappingRow,
  renderRelatedColumnsEditor,
  showEntityFieldMapControls,
  showInlineFieldsNotice,
  showJoinRelatedColumnControl,
  showJoinTableControls,
  showJsonShapeControl,
  showRelatedColumnsControl,
}: ProjectEditorPostsMappingRelationStepProps) {
  return renderPostsMappingRow({
    extraContent:
      showInlineFieldsNotice ? null : (
        <div className="space-y-4 pt-1">
          {showJoinTableControls
            ? renderMappingDetailSection({
                title: "Connection path",
                children: (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {renderMiniSelect({
                      label: "Connection table",
                      onChange: onJoinTableChange,
                      options: joinTableSelectOptions,
                      value: relation.joinTableRef,
                    })}
                    {showJoinRelatedColumnControl
                      ? renderMiniSelect({
                          label: "Item column",
                          onChange: onJoinTargetColumnChange,
                          options: relationJoinColumnOptions,
                          value: relation.joinTargetColumn,
                        })
                      : null}
                  </div>
                ),
              })
            : null}
          {showJsonShapeControl
            ? renderMappingDetailSection({
                title: "JSON shape",
                children: renderMiniSelect({
                  label: "JSON shape",
                  onChange: (value) => onJsonShapeChange(value as PostsMappingRelationDraft["strategy"]),
                  options: [
                    { label: "JSON array", value: "json_array" },
                    { label: "JSON object", value: "json_object" },
                    { label: "Distinct values", value: "derived_distinct" },
                  ],
                  value: relation.strategy,
                }),
              })
            : null}
          {showEntityFieldMapControls && relationFieldConfig
            ? renderMappingDetailSection({
                title: relationFieldConfig.title,
                children: (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {relationFieldConfig.fields.map((field) => (
                      <div key={`${relationKey}:${field.fieldKey}`}>
                        {renderMiniSelect({
                          label: field.label,
                          onChange: (value) => onFieldMapChange(field.fieldKey, value),
                          options: [
                            ...relationTargetColumnOptions,
                            { label: `Skip ${field.label.toLowerCase()}`, value: POSTS_MAPPING_NONE_VALUE },
                          ],
                          value: relation.fieldMap[field.fieldKey] ?? POSTS_MAPPING_NONE_VALUE,
                        })}
                      </div>
                    ))}
                  </div>
                ),
              })
            : null}
          {showRelatedColumnsControl
            ? renderMappingDetailSection({
                title: "Preview fields",
                children: renderRelatedColumnsEditor({
                  addLabel: "Add display field",
                  onAdd: onDisplayColumnAdd,
                  onChange: onDisplayColumnChange,
                  onRemove: onDisplayColumnRemove,
                  options: relationTargetColumnOptions,
                  values: relation.displayColumns,
                }),
              })
            : null}
        </div>
      ),
    label,
    onChange: onColumnChange,
    options: columnOptions,
    specialOptions: relationSpecialOptions,
    value: relation.column,
  });
}
