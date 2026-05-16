import type { ContentProjectMapping } from "@/lib/content-runtime/mapping";
import { getContentCustomFieldKey } from "@/lib/content-runtime/mapping";

import type { ContentCompiledAdapterMapping } from "../compiler";
import type { ContentAdapterSavePostRequest } from "../contracts";
import { createContentAdapterValidationError } from "../error-mapping";
import { coerceContentAdapterArrayValue } from "./coercion-helpers";
import { resolveCustomFieldAllowedValues } from "./custom-field-allowed-values";
import {
  sanitizeAdapterMultiRelationValue,
  sanitizeAdapterSingleRelationValue,
} from "./relation-write-values";
import {
  coerceAdapterFieldWriteValue,
  isWritableEditabilityState,
} from "./write-value-coercion";

export const sanitizeAdapterCustomFieldWriteInput = ({
  customFieldValues,
  compiled,
  mapping,
  postId,
}: {
  compiled: ContentCompiledAdapterMapping;
  customFieldValues: ContentAdapterSavePostRequest["customFields"];
  mapping: ContentProjectMapping;
  postId: string;
}) => {
  if (!customFieldValues) {
    return undefined;
  }

  const writableCustomFieldInstructions = new Map(
    compiled.customScalarFields
      .filter((fieldInstruction) => isWritableEditabilityState(fieldInstruction.editabilityState))
      .map((fieldInstruction) => [fieldInstruction.fieldKey, fieldInstruction] as const),
  );
  const customFieldInstructionsByKey = new Map(
    compiled.customScalarFields.map((fieldInstruction) => [fieldInstruction.fieldKey, fieldInstruction] as const),
  );
  const customFieldDefinitionsByKey = new Map(
    (mapping.mappingConfig.entities.posts.customFields ?? [])
      .filter((field) => field.enabled)
      .map((field) => [getContentCustomFieldKey(field), field] as const),
  );
  const writableCustomRelationInstructions = new Map(
    compiled.customRelationFields
      .filter((fieldInstruction) => isWritableEditabilityState(fieldInstruction.editabilityState))
      .map((fieldInstruction) => [fieldInstruction.fieldKey, fieldInstruction] as const),
  );
  const customRelationInstructionsByKey = new Map(
    compiled.customRelationFields.map((fieldInstruction) => [fieldInstruction.fieldKey, fieldInstruction] as const),
  );
  const customRelationDefinitionsByKey = new Map(
    (mapping.mappingConfig.entities.posts.customRelationFields ?? [])
      .filter((field) => field.enabled)
      .map((field) => [field.fieldKey, field] as const),
  );
  const nextEntries = Object.entries(customFieldValues).flatMap(([fieldKey, value]) => {
    const fieldInstruction = writableCustomFieldInstructions.get(fieldKey);

    const normalizedValue = fieldInstruction
      ? (() => {
          const customFieldDefinition = customFieldDefinitionsByKey.get(fieldKey);
          return customFieldDefinition?.kind === "array"
            ? (() => {
                const coercionResult = coerceContentAdapterArrayValue({
                  allowedValues: resolveCustomFieldAllowedValues(customFieldDefinition),
                  dataType: customFieldDefinition.dataType,
                  value,
                });

                if (coercionResult.ok) {
                  return coercionResult.value;
                }

                throw createContentAdapterValidationError({
                  code: "invalid_value",
                  fieldKey,
                  message: `Invalid value for "${customFieldDefinition.label}". ${coercionResult.ok === false ? coercionResult.message : "Value could not be normalized."}`,
                });
              })()
            : coerceAdapterFieldWriteValue({
                allowedValues: resolveCustomFieldAllowedValues(customFieldDefinition),
                fieldKey,
                label: customFieldDefinition?.label ?? fieldInstruction.label,
                nullable: customFieldDefinition?.isNullable ?? true,
                value,
                valueKind: fieldInstruction.valueKind,
              });
        })()
      : (() => {
          const relationInstruction = writableCustomRelationInstructions.get(fieldKey);

          if (!relationInstruction) {
            const customFieldDefinition = customFieldDefinitionsByKey.get(fieldKey);
            const customFieldInstruction = customFieldInstructionsByKey.get(fieldKey);

            if (customFieldDefinition || customFieldInstruction) {
              throw createContentAdapterValidationError({
                code: "field_not_writable",
                fieldKey,
                message: `The field "${customFieldDefinition?.label ?? customFieldInstruction?.label ?? fieldKey}" can't be edited here yet. Review the field setup and try again.`,
              });
            }

            const relationDefinition = customRelationDefinitionsByKey.get(fieldKey);
            const knownRelationInstruction = customRelationInstructionsByKey.get(fieldKey);

            if (relationDefinition || knownRelationInstruction) {
              throw createContentAdapterValidationError({
                code: "field_not_writable",
                fieldKey,
                message: `The field "${relationDefinition?.label ?? knownRelationInstruction?.label ?? fieldKey}" can't be edited here yet. Review the field setup and try again.`,
              });
            }

            return undefined;
          }

          const relationDefinition = customRelationDefinitionsByKey.get(fieldKey);
          const relationValue = relationInstruction.multiple
            ? sanitizeAdapterMultiRelationValue({
                editabilityState: relationInstruction.editabilityState,
                fieldKey,
                label: relationDefinition?.label ?? relationInstruction.label,
                value,
              })
            : sanitizeAdapterSingleRelationValue({
                editabilityState: relationInstruction.editabilityState,
                label: relationDefinition?.label ?? relationInstruction.label,
                value,
              });

          if (relationInstruction.targetEntity === "posts") {
            if (Array.isArray(relationValue)) {
              return relationValue.filter((entry) => entry !== postId);
            }

            return relationValue === postId ? null : relationValue;
          }

          return relationValue;
        })();

    if (normalizedValue === undefined) {
      return [];
    }

    return [
      [
        fieldKey,
        normalizedValue,
      ] as const,
    ];
  });

  return nextEntries.length ? Object.fromEntries(nextEntries) : undefined;
};
