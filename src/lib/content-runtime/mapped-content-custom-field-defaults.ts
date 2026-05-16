import type { ContentCustomFieldMapping } from "./mapping";

export const getCustomFieldDefaultValue = (cf: ContentCustomFieldMapping): unknown => {
  const kind = cf.kind;
  if (kind === "boolean") return false;
  if (kind === "number") return 0;
  if (kind === "json") return cf.dataType.toLowerCase().includes("array") || cf.column.endsWith("s") ? "[]" : "{}";
  if (kind === "array") return "{}";
  if (kind === "date" || kind === "datetime") return new Date().toISOString();
  return "";
};
