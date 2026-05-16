import type {
  ContentEntityMapping,
  ContentMappedField,
} from "@/lib/content-runtime/mapping";

import type {
  ContentAdapterEditabilityState,
  ContentAdapterStoragePrimitive,
} from "./contracts";
import type {
  ContentCompiledScalarFieldKey,
  ContentCompiledScalarFieldRelationSourceInstruction,
} from "./compiler";
import {
  isContentFeaturedImageFieldKindSupported,
  isContentRedirectFieldKindSupported,
} from "./compiler-field-shape";

export const resolveContentCompiledScalarRelationSource = (
  field: ContentMappedField,
): ContentCompiledScalarFieldRelationSourceInstruction | null => {
  const relation = field.sourceRelation;

  if (!relation) {
    return null;
  }

  return {
    junctionSourceColumn: relation.junctionSourceColumn,
    junctionTable: relation.junctionTable,
    sourceColumn: relation.sourceColumn,
    strategy: relation.strategy,
    targetColumn: relation.targetColumn,
    targetTable: relation.targetTable,
    valueColumn: relation.valueColumn,
  };
};

export const hasValidContentCompiledScalarRelationSource = (
  field: ContentMappedField,
): boolean => {
  const relation = field.sourceRelation;

  if (!relation) {
    return false;
  }

  switch (relation.strategy) {
    case "foreign_key":
    case "value_match_relation":
      return Boolean(
        relation.sourceColumn?.trim() &&
          relation.targetColumn?.trim() &&
          relation.targetTable?.trim() &&
          relation.valueColumn?.trim(),
      );
    case "related_row_by_post_id":
    case "join_row":
      return Boolean(
        relation.junctionSourceColumn?.trim() &&
          relation.junctionTable?.trim() &&
          relation.valueColumn?.trim(),
      );
    case "inline_fields":
      return Boolean(field.column?.trim() || relation.sourceColumn?.trim() || relation.valueColumn?.trim());
    default:
      return false;
  }
};

export const resolveContentCompiledScalarStoragePrimitive = ({
  entity,
  field,
}: {
  entity: ContentEntityMapping;
  field: ContentMappedField;
}): ContentAdapterStoragePrimitive | null => {
  if (entity.source.kind === "derived") {
    return "derived_read_only";
  }

  if (field.storagePrimitive) {
    switch (field.storagePrimitive) {
      case "direct_column":
      case "enum_mapping":
      case "boolean_mapping":
      case "derived_read_only":
        return field.column ? field.storagePrimitive : null;
      case "json_path":
        return field.column && field.path ? "json_path" : null;
      case "array_item":
        return field.column && field.arrayIndex !== null && field.arrayIndex !== undefined
          ? "array_item"
          : null;
      case "array_value":
        return field.column ? "array_value" : null;
      case "foreign_key":
      case "related_row_by_post_id":
      case "join_row":
      case "value_match_relation":
        return field.sourceRelation ? field.storagePrimitive : null;
      case "join_table":
      case "polymorphic_join":
        return null;
      default:
        return null;
    }
  }

  if (field.sourceRelation) {
    switch (field.sourceRelation.strategy) {
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
        return null;
    }
  }

  if (field.arrayIndex !== null && field.arrayIndex !== undefined && field.column && !field.path) {
    return "array_item";
  }

  if (field.kind === "array" && field.column) {
    return "array_value";
  }

  if (field.path) {
    return "json_path";
  }

  if (field.column) {
    return "direct_column";
  }

  return null;
};

export const resolveContentCompiledBaseEditabilityState = ({
  entity,
  storagePrimitive,
}: {
  entity: ContentEntityMapping;
  storagePrimitive: ContentAdapterStoragePrimitive;
}): ContentAdapterEditabilityState =>
  entity.source.kind === "derived" ||
  entity.source.kind === "view" ||
  storagePrimitive === "derived_read_only"
    ? "read_only"
    : "editable";

export const resolveContentCompiledScalarEditabilityState = ({
  compiledKey,
  entity,
  field,
  storagePrimitive,
}: {
  compiledKey: ContentCompiledScalarFieldKey;
  entity: ContentEntityMapping;
  field: ContentMappedField;
  storagePrimitive: ContentAdapterStoragePrimitive;
}): ContentAdapterEditabilityState => {
  if (
    compiledKey === "featuredImage" &&
    !isContentFeaturedImageFieldKindSupported({ field, storagePrimitive })
  ) {
    return "unsupported";
  }

  const baseState = resolveContentCompiledBaseEditabilityState({ entity, storagePrimitive });

  if (baseState === "read_only") {
    return baseState;
  }

  if (field.sourceRelation?.strategy === "inline_fields") {
    return "read_only";
  }

  if (field.sourceRelation && !hasValidContentCompiledScalarRelationSource(field)) {
    return "unsupported";
  }

  if (compiledKey === "createdAt") {
    return "read_only";
  }

  if (compiledKey === "updatedAt" && field.kind !== "date" && field.kind !== "datetime") {
    return "read_only";
  }

  if (compiledKey === "publishedAt") {
    if (field.timestampSourceHint) {
      return "read_only";
    }

    return "coercible";
  }

  if (compiledKey === "redirects" && !isContentRedirectFieldKindSupported(field.kind)) {
    return "unsupported";
  }

  return baseState;
};

const hasValidStructuredFieldRelationSource = (
  field: ContentMappedField,
): boolean => {
  const relation = field.sourceRelation;

  if (!relation) {
    return false;
  }

  switch (relation.strategy) {
    case "related_row_by_post_id":
    case "join_row":
      return Boolean(
        relation.junctionSourceColumn?.trim() &&
          relation.junctionTable?.trim() &&
          relation.valueColumn?.trim(),
      );
    case "inline_fields":
      return Boolean(field.column?.trim() || relation.sourceColumn?.trim() || relation.valueColumn?.trim());
    default:
      return false;
  }
};

export const resolveContentCompiledStructuredFieldEditabilityState = ({
  entity,
  field,
  storagePrimitive,
}: {
  entity: ContentEntityMapping;
  field: ContentMappedField;
  storagePrimitive: ContentAdapterStoragePrimitive;
}): ContentAdapterEditabilityState => {
  const baseState = resolveContentCompiledBaseEditabilityState({ entity, storagePrimitive });

  if (baseState === "read_only") {
    return baseState;
  }

  if (field.sourceRelation?.strategy === "inline_fields") {
    return "read_only";
  }

  if (field.sourceRelation && !hasValidStructuredFieldRelationSource(field)) {
    return "unsupported";
  }

  return baseState;
};
