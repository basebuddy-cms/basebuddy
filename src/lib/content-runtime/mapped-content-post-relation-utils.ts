import type { ContentRelationMapping } from "./mapping";

export const dedupeMappedContentRelationValues = (values: Array<string | null | undefined>) => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalizedValue = value?.trim();

    if (!normalizedValue || seen.has(normalizedValue)) {
      continue;
    }

    seen.add(normalizedValue);
    result.push(normalizedValue);
  }

  return result;
};

export const isMappedContentHelperRowRelation = (relation: ContentRelationMapping) =>
  relation.strategy === "related_row_by_post_id" || relation.strategy === "join_row";

export const isMappedContentJoinTableRelation = (relation: ContentRelationMapping) =>
  relation.strategy === "join_table" || relation.strategy === "polymorphic_join";

export const MAPPED_CONTENT_RELATION_ORDER_COLUMN_CANDIDATES = [
  "sort_order",
  "order_index",
  "display_order",
  "position",
  "sequence",
  "sort",
  "order",
] as const;

export const resolveMappedContentAvailableColumn = (
  availableColumns: Map<string, string>,
  columnName: string | null | undefined,
) => {
  const normalizedColumn = columnName?.trim();

  if (!normalizedColumn) {
    return null;
  }

  return availableColumns.get(normalizedColumn.toLowerCase()) ?? null;
};
