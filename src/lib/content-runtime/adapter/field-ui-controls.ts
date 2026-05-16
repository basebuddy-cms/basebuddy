import {
  isContentMultirangeDataType,
  isContentRangeDataType,
  isContentXmlDataType,
} from "@/lib/content-runtime/custom-field-support";

import type {
  ContentAdapterFieldSpec,
} from "./contracts";
import type {
  ContentCompiledRelationFieldInstruction,
  ContentCompiledScalarFieldInstruction,
} from "./compiler";

export const resolveUiControlForValueKind = (
  valueKind: ContentAdapterFieldSpec["valueKind"],
): ContentAdapterFieldSpec["uiControl"] => {
  switch (valueKind) {
    case "binary_or_exotic":
      return "read_only";
    case "long_text":
      return "textarea";
    case "number":
      return "number_input";
    case "boolean":
      return "toggle";
    case "enum":
      return "dropdown";
    case "date":
      return "date_picker";
    case "datetime":
    case "date_or_datetime":
      return "datetime_picker";
    case "json_object":
    case "json_object_inline":
    case "json_object_list":
      return "structured_editor";
    case "array_scalar":
    case "array_scalar_inline":
    case "text_like_list":
    case "number_list":
    case "boolean_list":
    case "enum_list":
      return "token_input";
    case "relation_id_or_key":
      return "single_select";
    case "content":
      return "content_editor";
    default:
      return "text_input";
  }
};

export const resolveCustomFieldContentFormat = ({
  dataType,
  uiControl,
  valueKind,
}: {
  dataType: string | null | undefined;
  uiControl: ContentAdapterFieldSpec["uiControl"];
  valueKind: ContentAdapterFieldSpec["valueKind"];
}): ContentAdapterFieldSpec["contentFormat"] => {
  if (isContentXmlDataType(dataType)) {
    return "xml";
  }

  if (
    uiControl === "structured_editor" &&
    (valueKind === "json_object" ||
      valueKind === "json_object_inline" ||
      valueKind === "json_object_list")
  ) {
    return "json";
  }

  return null;
};

export const resolveCustomFieldUiControl = ({
  dataType,
  valueKind,
}: {
  dataType: string | null | undefined;
  valueKind: ContentAdapterFieldSpec["valueKind"];
}): ContentAdapterFieldSpec["uiControl"] => {
  if (isContentXmlDataType(dataType)) {
    return "structured_editor";
  }

  if (isContentMultirangeDataType(dataType)) {
    return "multirange_editor";
  }

  if (isContentRangeDataType(dataType)) {
    return "range_input";
  }

  return resolveUiControlForValueKind(valueKind);
};

export const isMultiValueFieldKind = (valueKind: ContentAdapterFieldSpec["valueKind"]) =>
  valueKind === "array_scalar" ||
  valueKind === "array_scalar_inline" ||
  valueKind === "text_like_list" ||
  valueKind === "number_list" ||
  valueKind === "boolean_list" ||
  valueKind === "enum_list" ||
  valueKind === "json_object_list" ||
  valueKind === "redirects";

export const resolveRedirectMetadataSupport = (
  fieldInstruction: ContentCompiledScalarFieldInstruction | undefined,
): ContentAdapterFieldSpec["redirectMetadataSupport"] | undefined => {
  if (!fieldInstruction || fieldInstruction.fieldKey !== "redirects") {
    return undefined;
  }

  return fieldInstruction.uiControl === "redirect_rows_editor" ? "structured" : "list_only";
};

export const resolveRelationUiControl = ({
  editabilityState,
  multiple,
  relationMode,
}: Pick<ContentCompiledRelationFieldInstruction, "editabilityState" | "multiple" | "relationMode">):
  ContentAdapterFieldSpec["uiControl"] => {
  if (editabilityState !== "editable" || relationMode === "inline") {
    return "read_only";
  }

  return multiple ? "multi_select" : "single_select";
};

export const resolveRelationSearchMode = ({
  editabilityState,
  relationMode,
}: Pick<ContentCompiledRelationFieldInstruction, "editabilityState" | "relationMode">):
  ContentAdapterFieldSpec["searchMode"] =>
  editabilityState !== "editable" || relationMode === "inline" ? "none" : "remote";
