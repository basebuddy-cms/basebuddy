import type { ContentMappingEntityKey } from "./mapping";

export const CONTENT_FIELD_EDITABILITY_STATE_VALUES = [
  "editable",
  "coercible",
  "read_only",
  "unsupported",
] as const;
export type ContentFieldEditabilityState =
  (typeof CONTENT_FIELD_EDITABILITY_STATE_VALUES)[number];

export const CONTENT_FIELD_NON_WRITABLE_EDITABILITY_STATES = [
  "read_only",
  "unsupported",
] as const satisfies ContentFieldEditabilityState[];
export type ContentFieldNonWritableEditabilityState =
  (typeof CONTENT_FIELD_NON_WRITABLE_EDITABILITY_STATES)[number];

export const CONTENT_FIELD_PATCH_MODE_VALUES = [
  "replace",
  "key_patch",
  "index_patch",
  "link_replace",
  "no_write",
] as const;
export type ContentFieldPatchMode = (typeof CONTENT_FIELD_PATCH_MODE_VALUES)[number];

export const CONTENT_FIELD_UI_CONTROL_VALUES = [
  "text_input",
  "textarea",
  "number_input",
  "toggle",
  "dropdown",
  "searchable_dropdown",
  "single_select",
  "multi_select",
  "token_input",
  "range_input",
  "multirange_editor",
  "date_picker",
  "datetime_picker",
  "content_editor",
  "image_picker",
  "structured_editor",
  "redirect_rows_editor",
  "read_only",
] as const;
export type ContentFieldUiControl = (typeof CONTENT_FIELD_UI_CONTROL_VALUES)[number];

export const CONTENT_FIELD_VALUE_KIND_VALUES = [
  "text_like",
  "long_text",
  "number",
  "boolean",
  "enum",
  "date",
  "datetime",
  "json_scalar",
  "json_object",
  "array_scalar",
  "binary_or_exotic",
  "relation_id_or_key",
  "text_like_inline",
  "text_like_list",
  "number_list",
  "boolean_list",
  "enum_list",
  "json_object_list",
  "array_scalar_inline",
  "date_or_datetime",
  "json_object_inline",
  "content",
  "redirects",
] as const;
export type ContentFieldValueKind = (typeof CONTENT_FIELD_VALUE_KIND_VALUES)[number];

export const CONTENT_FIELD_RELATION_MODE_VALUES = [
  "none",
  "inline",
  "managed_single",
  "managed_multi",
  "value_match_single",
  "value_match_multi",
] as const;
export type ContentFieldRelationMode = (typeof CONTENT_FIELD_RELATION_MODE_VALUES)[number];

export const CONTENT_FIELD_STORAGE_PRIMITIVE_VALUES = [
  "direct_column",
  "json_path",
  "foreign_key",
  "related_row_by_post_id",
  "join_row",
  "join_table",
  "polymorphic_join",
  "value_match_relation",
  "array_value",
  "array_item",
  "enum_mapping",
  "boolean_mapping",
  "derived_read_only",
] as const;
export type ContentFieldStoragePrimitive =
  (typeof CONTENT_FIELD_STORAGE_PRIMITIVE_VALUES)[number];

export const CONTENT_FIELD_SEMANTIC_ROLE_VALUES = [
  "none",
  "title",
  "slug",
  "excerpt",
  "content",
  "redirects",
  "featuredImage",
  "seoTitle",
  "seoDescription",
  "focusKeyword",
  "createdAt",
  "publishedAt",
  "updatedAt",
  "status",
  "author",
  "categories",
  "tags",
  "parentPage",
  "customField",
  "customRelation",
] as const;
export type ContentFieldSemanticRole = (typeof CONTENT_FIELD_SEMANTIC_ROLE_VALUES)[number];

export type ContentFieldContractBase<TFieldKey extends string = string> = {
  editabilityState: ContentFieldEditabilityState;
  fieldKey: TFieldKey;
  label: string;
  required: boolean;
  semanticRole: ContentFieldSemanticRole;
  storagePrimitive: ContentFieldStoragePrimitive;
  valueKind: ContentFieldValueKind;
};

export type ContentRelationFieldContract<
  TFieldKey extends string = string,
  TTargetEntity extends ContentMappingEntityKey | null = ContentMappingEntityKey | null,
> = ContentFieldContractBase<TFieldKey> & {
  multiple: boolean;
  relationMode: ContentFieldRelationMode;
  targetEntity: TTargetEntity;
};

export const isContentFieldNonWritableState = (
  editabilityState: ContentFieldEditabilityState,
): editabilityState is ContentFieldNonWritableEditabilityState =>
  CONTENT_FIELD_NON_WRITABLE_EDITABILITY_STATES.includes(
    editabilityState as ContentFieldNonWritableEditabilityState,
  );
