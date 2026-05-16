import type {
  ContentCustomFieldMapping,
  ContentEntityMapping,
  ContentMappedField,
} from "@/lib/content-runtime/mapping";
import { getContentCustomFieldKey } from "@/lib/content-runtime/mapping";
import { isContentCustomFieldBinaryOrExoticDataType } from "@/lib/content-runtime/custom-field-support";

import type { ContentCompiledCustomScalarFieldInstruction } from "./compiler";
import { resolveContentCompiledCustomFieldValueKind } from "./compiler-field-shape";
import {
  hasValidContentCompiledScalarRelationSource,
  resolveContentCompiledBaseEditabilityState,
  resolveContentCompiledScalarStoragePrimitive,
} from "./compiler-storage-contract";

export const compileContentCompiledCustomScalarField = ({
  entity,
  field,
}: {
  entity: ContentEntityMapping;
  field: ContentCustomFieldMapping;
}): ContentCompiledCustomScalarFieldInstruction => {
  const hasBinaryOrExoticSourceDataType = isContentCustomFieldBinaryOrExoticDataType(field);
  const syntheticField: ContentMappedField = {
    arrayIndex: field.arrayIndex ?? null,
    column: field.column,
    kind: field.kind,
    label: field.label,
    path: field.path ?? null,
    required: !field.isNullable,
    ...(field.sourceRelation ? { sourceRelation: field.sourceRelation } : {}),
    storagePrimitive: field.storagePrimitive,
    visible: true,
  };
  const storagePrimitive =
    resolveContentCompiledScalarStoragePrimitive({ entity, field: syntheticField }) ?? "direct_column";
  const editabilityState =
    hasBinaryOrExoticSourceDataType
      ? "unsupported"
      : field.sourceRelation?.strategy === "inline_fields"
        ? "read_only"
        : field.sourceRelation && !hasValidContentCompiledScalarRelationSource(syntheticField)
          ? "unsupported"
          : resolveContentCompiledBaseEditabilityState({ entity, storagePrimitive });

  return {
    dataType: field.dataType,
    editabilityState,
    fieldKey: getContentCustomFieldKey(field),
    label: field.label,
    semanticRole: field.semanticRole ?? "customField",
    sourceColumn:
      field.sourceRelation?.strategy === "inline_fields"
        ? field.sourceRelation.sourceColumn ?? field.column
        : field.sourceRelation
          ? field.sourceRelation.sourceColumn ?? null
          : field.column,
    sourceEntity: "posts",
    sourceTable: entity.source.table,
    storagePrimitive,
    valueKind: resolveContentCompiledCustomFieldValueKind(field),
  };
};
