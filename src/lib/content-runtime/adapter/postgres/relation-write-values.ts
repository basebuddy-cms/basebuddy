import type { ContentAdapterFieldSpec } from "../contracts";
import { createContentAdapterValidationError } from "../error-mapping";

const isWritableEditabilityState = (
  editabilityState: ContentAdapterFieldSpec["editabilityState"] | undefined,
) => editabilityState === "editable" || editabilityState === "coercible";

export const sanitizeAdapterSingleRelationValue = (input: {
  editabilityState: ContentAdapterFieldSpec["editabilityState"] | undefined;
  label: string;
  value: unknown;
}) => {
  const { editabilityState, value } = input;

  if (value === undefined || !isWritableEditabilityState(editabilityState)) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalizedValue = String(value).trim();
  return normalizedValue ? normalizedValue : null;
};

export const sanitizeAdapterMultiRelationValue = (input: {
  editabilityState: ContentAdapterFieldSpec["editabilityState"] | undefined;
  fieldKey: string;
  label: string;
  value: unknown;
}) => {
  const { editabilityState, fieldKey, label, value } = input;

  if (value === undefined || !isWritableEditabilityState(editabilityState)) {
    return undefined;
  }

  if (value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw createContentAdapterValidationError({
      code: "invalid_array",
      fieldKey,
      message: `Invalid value for "${label}". Value must be an array.`,
    });
  }

  const seenValues = new Set<string>();
  const normalizedValues: string[] = [];

  for (const entry of value) {
    const normalizedEntry = String(entry ?? "").trim();

    if (!normalizedEntry || seenValues.has(normalizedEntry)) {
      continue;
    }

    seenValues.add(normalizedEntry);
    normalizedValues.push(normalizedEntry);
  }

  return normalizedValues;
};

export const sanitizeAdapterBuiltInRelationIdsValue = ({
  editabilityState,
  fieldKey,
  label,
  multiple,
  value,
}: {
  editabilityState: ContentAdapterFieldSpec["editabilityState"] | undefined;
  fieldKey: string;
  label: string;
  multiple: boolean;
  value: unknown;
}) => {
  const normalizedValues = sanitizeAdapterMultiRelationValue({
    editabilityState,
    fieldKey,
    label,
    value,
  });

  if (normalizedValues === undefined || multiple) {
    return normalizedValues;
  }

  if (normalizedValues.length > 1) {
    throw createContentAdapterValidationError({
      code: "invalid_value",
      fieldKey,
      message: `Invalid value for "${label}". This mapped field only supports one selection.`,
    });
  }

  return normalizedValues;
};
