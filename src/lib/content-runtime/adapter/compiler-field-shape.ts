import type {
  ContentCustomFieldMapping,
  ContentMappedField,
} from "@/lib/content-runtime/mapping";
import {
  isContentCustomFieldBinaryOrExoticDataType,
  isContentExactNumericDataType,
  isContentMultirangeDataType,
  isContentRangeDataType,
} from "@/lib/content-runtime/custom-field-support";

import type {
  ContentAdapterEditabilityState,
  ContentAdapterStoragePrimitive,
  ContentAdapterUiControl,
  ContentAdapterValueKind,
} from "./contracts";
import type { ContentCompiledScalarFieldKey } from "./compiler";

const toValueKind = (fieldKind: ContentMappedField["kind"]): ContentAdapterValueKind => {
  switch (fieldKind) {
    case "plain_text":
      return "long_text";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "enum":
      return "enum";
    case "date":
      return "date";
    case "datetime":
      return "datetime";
    case "json":
      return "json_object";
    case "array":
      return "array_scalar";
    default:
      return "text_like";
  }
};

export const isContentRedirectFieldKindSupported = (
  fieldKind: ContentMappedField["kind"],
) =>
  fieldKind === "text" ||
  fieldKind === "plain_text" ||
  fieldKind === "rich_text" ||
  fieldKind === "html" ||
  fieldKind === "markdown" ||
  fieldKind === "json" ||
  fieldKind === "array" ||
  fieldKind === "slug";

export const supportsContentStructuredRedirectRows = ({
  field,
  storagePrimitive,
}: {
  field: ContentMappedField;
  storagePrimitive: ContentAdapterStoragePrimitive;
}) =>
  isContentRedirectFieldKindSupported(field.kind) &&
  field.kind !== "array" &&
  storagePrimitive !== "array_item" &&
  storagePrimitive !== "derived_read_only";

export const isContentFeaturedImageFieldKindSupported = ({
  field,
  storagePrimitive,
}: {
  field: ContentMappedField;
  storagePrimitive: ContentAdapterStoragePrimitive;
}) =>
  field.kind === "text" ||
  field.kind === "plain_text" ||
  field.kind === "rich_text" ||
  field.kind === "html" ||
  field.kind === "markdown" ||
  field.kind === "slug" ||
  (field.kind === "array" && storagePrimitive === "array_item");

export const resolveContentCompiledScalarValueKind = ({
  compiledKey,
  field,
  storagePrimitive,
}: {
  compiledKey: ContentCompiledScalarFieldKey;
  field: ContentMappedField;
  storagePrimitive: ContentAdapterStoragePrimitive;
}): ContentAdapterValueKind => {
  if (compiledKey === "redirects") {
    return "redirects";
  }

  if (
    compiledKey === "featuredImage" &&
    isContentFeaturedImageFieldKindSupported({ field, storagePrimitive })
  ) {
    return "text_like";
  }

  return toValueKind(field.kind);
};

const toUiControl = (valueKind: ContentAdapterValueKind): ContentAdapterUiControl => {
  switch (valueKind) {
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
      return "datetime_picker";
    case "json_object":
      return "structured_editor";
    case "array_scalar":
      return "token_input";
    default:
      return "text_input";
  }
};

export const resolveContentCompiledScalarUiControl = ({
  compiledKey,
  editabilityState,
  field,
  storagePrimitive,
  valueKind,
}: {
  compiledKey: ContentCompiledScalarFieldKey;
  editabilityState: ContentAdapterEditabilityState;
  field: ContentMappedField;
  storagePrimitive: ContentAdapterStoragePrimitive;
  valueKind: ContentAdapterValueKind;
}): ContentAdapterUiControl => {
  if (compiledKey === "redirects") {
    return supportsContentStructuredRedirectRows({ field, storagePrimitive })
      ? "redirect_rows_editor"
      : "token_input";
  }

  if (compiledKey === "featuredImage") {
    if (
      editabilityState === "unsupported" ||
      !isContentFeaturedImageFieldKindSupported({ field, storagePrimitive })
    ) {
      return "read_only";
    }

    return "image_picker";
  }

  return toUiControl(valueKind);
};

export const resolveContentCompiledCustomFieldValueKind = (
  field: ContentCustomFieldMapping,
): ContentAdapterValueKind => {
  if (isContentCustomFieldBinaryOrExoticDataType(field)) {
    return "binary_or_exotic";
  }

  if (isContentRangeDataType(field.dataType) || isContentMultirangeDataType(field.dataType)) {
    return field.kind === "plain_text" ? "long_text" : "text_like";
  }

  if (field.kind === "number" && isContentExactNumericDataType(field.dataType)) {
    return "text_like";
  }

  if (field.kind === "array" && field.allowedValues?.length) {
    return "enum_list";
  }

  return toValueKind(field.kind);
};
