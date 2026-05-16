export {
  ensureGeneratedContentFeaturedImageColumns as ensureGeneratedContentFeaturedImageColumns,
  getGeneratedContentTables,
  hasGeneratedContentTableColumn,
  quoteGeneratedContentIdentifier,
} from "./adapter/generated-schema";

export const normalizeGeneratedContentTimestamp = (value: Date | string | null) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
};
