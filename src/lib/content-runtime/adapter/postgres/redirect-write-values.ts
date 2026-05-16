import type { ContentRedirectEntry } from "@/lib/content-runtime/shared";
import {
  normalizeContentRedirectEntries,
  contentRedirectEntriesHaveMetadata,
} from "@/lib/content-runtime/shared";

import type { ContentCompiledScalarFieldInstruction } from "../compiler";
import { createContentAdapterValidationError } from "../error-mapping";
import { resolveRedirectMetadataSupport } from "../field-ui-controls";
import { isWritableEditabilityState } from "./write-value-coercion";

export const sanitizeAdapterRedirectsWriteValue = ({
  fieldInstruction,
  value,
}: {
  fieldInstruction: ContentCompiledScalarFieldInstruction | undefined;
  value: unknown;
}): ContentRedirectEntry[] | undefined => {
  if (value === undefined || !isWritableEditabilityState(fieldInstruction?.editabilityState)) {
    return undefined;
  }

  if (value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw createContentAdapterValidationError({
      code: "invalid_array",
      fieldKey: "redirects",
      message: 'Invalid value for "Redirects". Value must be an array.',
    });
  }

  const normalizedValues = normalizeContentRedirectEntries(value);

  if (
    contentRedirectEntriesHaveMetadata(normalizedValues) &&
    resolveRedirectMetadataSupport(fieldInstruction) !== "structured"
  ) {
    throw createContentAdapterValidationError({
      code: "field_not_writable",
      fieldKey: "redirects",
      message: "Redirects can't be edited here yet. Review the field setup and try again.",
    });
  }

  return normalizedValues;
};
