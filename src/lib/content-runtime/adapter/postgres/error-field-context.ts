import type { ContentProjectMapping } from "@/lib/content-runtime/mapping";
import { getContentCustomFieldKey } from "@/lib/content-runtime/mapping";

import type { ContentCompiledAdapterMapping } from "../compiler";
import type { ContentAdapterErrorFieldContext } from "../error-mapping";
import { resolveCustomFieldAllowedValues } from "./custom-field-allowed-values";

export const buildContentAdapterErrorFieldContext = ({
  compiled,
  mapping,
}: {
  compiled: ContentCompiledAdapterMapping;
  mapping: ContentProjectMapping;
}): ContentAdapterErrorFieldContext => {
  const fieldKeyByColumn: Record<string, string> = {};
  const allowedValuesByFieldKey: Record<string, string[] | null | undefined> = {};

  const registerColumn = (column: string | null | undefined, fieldKey: string) => {
    const normalizedColumn = column?.trim().toLowerCase();

    if (!normalizedColumn || fieldKeyByColumn[normalizedColumn]) {
      return;
    }

    fieldKeyByColumn[normalizedColumn] = fieldKey;
  };

  for (const fieldInstruction of Object.values(compiled.scalarFields)) {
    if (!fieldInstruction) {
      continue;
    }

    registerColumn(fieldInstruction.sourceColumn, fieldInstruction.fieldKey);
    registerColumn(fieldInstruction.sourceRelation?.targetColumn, fieldInstruction.fieldKey);
    registerColumn(fieldInstruction.sourceRelation?.junctionSourceColumn, fieldInstruction.fieldKey);
    registerColumn(fieldInstruction.sourceRelation?.valueColumn, fieldInstruction.fieldKey);
  }

  for (const fieldInstruction of Object.values(compiled.structuredFields)) {
    if (!fieldInstruction) {
      continue;
    }

    registerColumn(fieldInstruction.sourceColumn, fieldInstruction.fieldKey);
    registerColumn(fieldInstruction.sourceRelation?.targetColumn, fieldInstruction.fieldKey);
    registerColumn(fieldInstruction.sourceRelation?.junctionSourceColumn, fieldInstruction.fieldKey);
    registerColumn(fieldInstruction.sourceRelation?.valueColumn, fieldInstruction.fieldKey);
  }

  for (const fieldInstruction of Object.values(compiled.workflowFields)) {
    if (!fieldInstruction) {
      continue;
    }

    registerColumn(fieldInstruction.sourceColumn, fieldInstruction.fieldKey);
  }

  for (const fieldInstruction of Object.values(compiled.relationFields)) {
    if (!fieldInstruction) {
      continue;
    }

    registerColumn(fieldInstruction.sourceColumn, fieldInstruction.fieldKey);
    registerColumn(fieldInstruction.junctionSourceColumn, fieldInstruction.fieldKey);
    registerColumn(fieldInstruction.junctionTargetColumn, fieldInstruction.fieldKey);
    registerColumn(fieldInstruction.targetColumn, fieldInstruction.fieldKey);
    registerColumn(fieldInstruction.valueColumn, fieldInstruction.fieldKey);
  }

  const enabledCustomFields = (mapping.mappingConfig.entities.posts.customFields ?? []).filter(
    (field) => field.enabled,
  );
  const enabledCustomFieldsByKey = new Map(
    enabledCustomFields.map((field) => [getContentCustomFieldKey(field), field] as const),
  );

  for (const fieldInstruction of compiled.customScalarFields) {
    registerColumn(fieldInstruction.sourceColumn, fieldInstruction.fieldKey);
    const customFieldDefinition = enabledCustomFieldsByKey.get(fieldInstruction.fieldKey);
    allowedValuesByFieldKey[fieldInstruction.fieldKey] = resolveCustomFieldAllowedValues(
      customFieldDefinition,
    );
  }

  return {
    allowedValuesByFieldKey,
    fieldKeyByColumn,
  };
};
