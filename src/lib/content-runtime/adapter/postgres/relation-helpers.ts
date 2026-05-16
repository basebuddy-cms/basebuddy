import type { ContentAdapterRelationOption } from "../contracts";

const normalizeRelationScalarValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return null;
  }

  const normalizedValue = String(value).trim();
  return normalizedValue || null;
};

const normalizeRelationOrderValue = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  return null;
};

export const buildContentAdapterRelationOption = ({
  fallbackLabel,
  id,
  label,
  metadata,
}: {
  fallbackLabel?: string | null;
  id: string;
  label?: string | null;
  metadata?: Record<string, unknown>;
}): ContentAdapterRelationOption => ({
  id,
  label: label?.trim() || fallbackLabel?.trim() || id,
  ...(metadata ? { metadata } : {}),
});

export const dedupeContentAdapterRelationOptions = (
  options: ContentAdapterRelationOption[],
): ContentAdapterRelationOption[] => {
  const seenIds = new Set<string>();

  return options.filter((option) => {
    if (seenIds.has(option.id)) {
      return false;
    }

    seenIds.add(option.id);
    return true;
  });
};

const readContentNormalizedJoinValues = ({
  discriminatorColumn = null,
  discriminatorValue = null,
  joinRows,
  orderColumn = null,
  postId,
  sourceColumn,
  targetColumn,
}: {
  discriminatorColumn?: string | null;
  discriminatorValue?: string | null;
  joinRows: Record<string, unknown>[];
  orderColumn?: string | null;
  postId: string;
  sourceColumn: string;
  targetColumn: string;
}) => {
  const normalizedPostId = postId.trim();
  const normalizedDiscriminatorValue = discriminatorValue?.trim() || null;
  const orderedRows = joinRows
    .map((row, index) => ({
      discriminatorRowValue: discriminatorColumn
        ? normalizeRelationScalarValue(row[discriminatorColumn])
        : null,
      orderValue: orderColumn ? normalizeRelationOrderValue(row[orderColumn]) : null,
      rowIndex: index,
      sourceValue: normalizeRelationScalarValue(row[sourceColumn]),
      targetValue: normalizeRelationScalarValue(row[targetColumn]),
    }))
    .filter((row): row is typeof row & { sourceValue: string; targetValue: string } => {
      if (row.sourceValue !== normalizedPostId || !row.targetValue) {
        return false;
      }

      if (!discriminatorColumn) {
        return true;
      }

      return row.discriminatorRowValue === normalizedDiscriminatorValue;
    })
    .sort((left, right) => {
      if (left.orderValue !== null || right.orderValue !== null) {
        if (left.orderValue === null) {
          return 1;
        }

        if (right.orderValue === null) {
          return -1;
        }

        if (left.orderValue !== right.orderValue) {
          return left.orderValue - right.orderValue;
        }
      }

      const targetComparison = left.targetValue.localeCompare(right.targetValue);

      if (targetComparison !== 0) {
        return targetComparison;
      }

      return left.rowIndex - right.rowIndex;
    });
  const seenValues = new Set<string>();
  const result: string[] = [];

  for (const row of orderedRows) {
    if (seenValues.has(row.targetValue)) {
      continue;
    }

    seenValues.add(row.targetValue);
    result.push(row.targetValue);
  }

  return result;
};

export const readContentJoinTableValues = ({
  joinRows,
  orderColumn = null,
  postId,
  sourceColumn,
  targetColumn,
}: {
  joinRows: Record<string, unknown>[];
  orderColumn?: string | null;
  postId: string;
  sourceColumn: string;
  targetColumn: string;
}) =>
  readContentNormalizedJoinValues({
    joinRows,
    orderColumn,
    postId,
    sourceColumn,
    targetColumn,
  });

export const readContentPolymorphicJoinValues = ({
  discriminatorColumn,
  discriminatorValue,
  joinRows,
  orderColumn = null,
  postId,
  sourceColumn,
  targetColumn,
}: {
  discriminatorColumn: string;
  discriminatorValue: string;
  joinRows: Record<string, unknown>[];
  orderColumn?: string | null;
  postId: string;
  sourceColumn: string;
  targetColumn: string;
}) =>
  readContentNormalizedJoinValues({
    discriminatorColumn,
    discriminatorValue,
    joinRows,
    orderColumn,
    postId,
    sourceColumn,
    targetColumn,
  });

const normalizeValueMatchValues = ({
  multiple,
  sourceValue,
}: {
  multiple: boolean;
  sourceValue: unknown;
}) => {
  const rawValues = multiple ? (Array.isArray(sourceValue) ? sourceValue : []) : [sourceValue];
  const seenValues = new Set<string>();
  const normalizedValues: string[] = [];

  for (const rawValue of rawValues) {
    const normalizedValue = normalizeRelationScalarValue(rawValue);

    if (!normalizedValue || seenValues.has(normalizedValue)) {
      continue;
    }

    seenValues.add(normalizedValue);
    normalizedValues.push(normalizedValue);
  }

  return normalizedValues;
};

export const readContentValueMatchRelationOptions = ({
  multiple,
  sourceValue,
  targetFallbackLabelColumn = null,
  targetIdColumn,
  targetLabelColumn = null,
  targetMatchColumn,
  targetRows,
}: {
  multiple: boolean;
  sourceValue: unknown;
  targetFallbackLabelColumn?: string | null;
  targetIdColumn: string;
  targetLabelColumn?: string | null;
  targetMatchColumn: string;
  targetRows: Record<string, unknown>[];
}): ContentAdapterRelationOption[] => {
  const optionsByMatchValue = new Map<string, ContentAdapterRelationOption>();

  for (const row of targetRows) {
    const matchValue = normalizeRelationScalarValue(row[targetMatchColumn]);
    const id = normalizeRelationScalarValue(row[targetIdColumn]);

    if (!matchValue || !id || optionsByMatchValue.has(matchValue)) {
      continue;
    }

    const label =
      (targetLabelColumn ? normalizeRelationScalarValue(row[targetLabelColumn]) : null) ??
      (targetFallbackLabelColumn ? normalizeRelationScalarValue(row[targetFallbackLabelColumn]) : null);

    optionsByMatchValue.set(
      matchValue,
      buildContentAdapterRelationOption({
        fallbackLabel: matchValue,
        id,
        label,
        metadata: { matchValue },
      }),
    );
  }

  return normalizeValueMatchValues({ multiple, sourceValue }).map(
    (matchValue): ContentAdapterRelationOption =>
      optionsByMatchValue.get(matchValue) ??
      buildContentAdapterRelationOption({
        fallbackLabel: matchValue,
        id: matchValue,
        label: matchValue,
        metadata: { matchValue, stale: true },
      }),
  );
};
