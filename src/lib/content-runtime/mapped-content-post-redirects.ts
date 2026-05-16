import type { ContentEntityMapping } from "./mapping";
import {
  normalizeContentRedirectEntries,
  contentRedirectEntriesHaveMetadata,
  type ContentRedirectEntry,
} from "./shared";

export const normalizeMappedRedirectValues = ({
  value,
}: {
  value: unknown;
}) => {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return normalizeContentRedirectEntries(value);
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return [];
    }

    try {
      const parsedValue = JSON.parse(trimmedValue);

      if (Array.isArray(parsedValue)) {
        return normalizeContentRedirectEntries(parsedValue);
      }
    } catch {
      // Fall through to simple token splitting for legacy text blobs.
    }

    return normalizeContentRedirectEntries(trimmedValue.split(/[\n,]+/));
  }

  return normalizeContentRedirectEntries([value]);
};

export const serializeMappedRedirectValues = ({
  field,
  redirects,
}: {
  field: ContentEntityMapping["fields"][string] | undefined;
  redirects: ContentRedirectEntry[];
}) => {
  const normalizedRedirects = normalizeContentRedirectEntries(redirects);
  const shouldSerializeStructuredRows = contentRedirectEntriesHaveMetadata(normalizedRedirects);
  const serializedRows = shouldSerializeStructuredRows
    ? normalizedRedirects.map((entry) => ({
        source: entry.source,
        ...(entry.statusCode !== null ? { statusCode: entry.statusCode } : {}),
        ...(entry.active !== null ? { active: entry.active } : {}),
        ...(entry.locale !== null ? { locale: entry.locale } : {}),
      }))
    : normalizedRedirects.map((entry) => entry.source);

  if ((field?.arrayIndex ?? null) !== null) {
    if (shouldSerializeStructuredRows) {
      throw new Error("Redirects can't be edited here yet. Review the field setup and try again.");
    }

    return normalizedRedirects[0]?.source ?? null;
  }

  if (field?.kind === "array" || field?.kind === "json") {
    return serializedRows;
  }

  return JSON.stringify(serializedRows);
};
