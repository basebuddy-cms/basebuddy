import type { ContentAdapterFieldSpec } from "../contracts";
import { createContentAdapterValidationError } from "../error-mapping";
import { coerceContentAdapterValue } from "./coercion-helpers";

export const isWritableEditabilityState = (
  editabilityState: ContentAdapterFieldSpec["editabilityState"] | undefined,
) => editabilityState === "editable" || editabilityState === "coercible";

export const coerceAdapterFieldWriteValue = ({
  allowedValues = null,
  fieldKey,
  label,
  nullable,
  value,
  valueKind,
}: {
  allowedValues?: string[] | null;
  fieldKey: string;
  label: string;
  nullable: boolean;
  value: unknown;
  valueKind: ContentAdapterFieldSpec["valueKind"];
}) => {
  if (value === null) {
    if (!nullable) {
      throw createContentAdapterValidationError({
        code: "nullability_violation",
        fieldKey,
        message: `The field "${label}" is required and cannot be empty.`,
      });
    }

    return null;
  }

  const coercionResult = coerceContentAdapterValue({
    allowedValues,
    value,
    valueKind,
  });

  if (coercionResult.ok) {
    return coercionResult.value;
  }

  const failureMessage =
    "message" in coercionResult ? coercionResult.message : "Value could not be normalized.";

  throw createContentAdapterValidationError({
    code: "invalid_value",
    fieldKey,
    message: `Invalid value for "${label}". ${failureMessage}`,
    metadata: allowedValues?.length ? { allowedValues } : undefined,
  });
};
