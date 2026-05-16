const getObjectValue = (value: unknown, key: string) =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined;

const normalizeJsonPath = (path: string) =>
  path
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);

const normalizeRelationScalarValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return null;
  }

  const normalizedValue = String(value).trim();
  return normalizedValue || null;
};

const normalizeHelperRowOrderValue = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  return null;
};

const normalizeHelperRowSortValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return String(value);
  }
};

const getContentOneToOneHelperRowMatches = ({
  helperRows,
  orderColumn = null,
  postId,
  postIdColumn,
  valueColumn,
}: {
  helperRows: Record<string, unknown>[];
  orderColumn?: string | null;
  postId: string;
  postIdColumn: string;
  valueColumn: string;
}) => {
  const normalizedPostId = postId.trim();

  return helperRows
    .map((row, index) => ({
      orderValue: orderColumn ? normalizeHelperRowOrderValue(row[orderColumn]) : null,
      rowIndex: index,
      rowValue: row[valueColumn],
      sortValue: normalizeHelperRowSortValue(row[valueColumn]),
      sourceValue: normalizeRelationScalarValue(row[postIdColumn]),
    }))
    .filter((row) => row.sourceValue === normalizedPostId && row.rowValue !== undefined)
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

      const sortComparison = left.sortValue.localeCompare(right.sortValue);

      if (sortComparison !== 0) {
        return sortComparison;
      }

      return left.rowIndex - right.rowIndex;
    });
};

export const inspectContentOneToOneHelperRowValue = ({
  helperRows,
  orderColumn = null,
  postId,
  postIdColumn,
  valueColumn,
}: {
  helperRows: Record<string, unknown>[];
  orderColumn?: string | null;
  postId: string;
  postIdColumn: string;
  valueColumn: string;
}) => {
  const matchingRows = getContentOneToOneHelperRowMatches({
    helperRows,
    orderColumn,
    postId,
    postIdColumn,
    valueColumn,
  });
  const matchedValues = Array.from(
    new Set(
      matchingRows
        .map((row) => normalizeRelationScalarValue(row.rowValue) ?? normalizeHelperRowSortValue(row.rowValue))
        .filter(Boolean),
    ),
  );

  return {
    ambiguous: matchingRows.length > 1,
    helperRowCount: matchingRows.length,
    matchedValues,
    value: matchingRows[0]?.rowValue,
  };
};

const readContentOneToOneHelperRowValue = ({
  helperRows,
  orderColumn = null,
  postId,
  postIdColumn,
  valueColumn,
}: {
  helperRows: Record<string, unknown>[];
  orderColumn?: string | null;
  postId: string;
  postIdColumn: string;
  valueColumn: string;
}) =>
  inspectContentOneToOneHelperRowValue({
    helperRows,
    orderColumn,
    postId,
    postIdColumn,
    valueColumn,
  }).value;

export const readContentDirectColumnValue = ({
  column,
  row,
}: {
  column: string;
  row: Record<string, unknown>;
}) => row[column];

export const readContentArrayValue = ({
  column,
  row,
}: {
  column: string;
  row: Record<string, unknown>;
}) => {
  const value = row[column];
  return Array.isArray(value) ? value : undefined;
};

export const readContentArrayIndexValue = ({
  column,
  index,
  row,
}: {
  column: string;
  index: number;
  row: Record<string, unknown>;
}) => {
  const value = readContentArrayValue({ column, row });
  return value?.[index];
};

export const readContentForeignKeyValue = ({
  column,
  row,
}: {
  column: string;
  row: Record<string, unknown>;
}) => normalizeRelationScalarValue(row[column]);

export const readContentForeignRowScalarValue = ({
  row,
  sourceColumn,
  targetColumn,
  targetRows,
  valueColumn,
}: {
  row: Record<string, unknown>;
  sourceColumn: string;
  targetColumn: string;
  targetRows: Record<string, unknown>[];
  valueColumn: string;
}) => {
  const lookupValue = normalizeRelationScalarValue(row[sourceColumn]);

  if (!lookupValue) {
    return null;
  }

  const targetRow = targetRows.find(
    (candidate) => normalizeRelationScalarValue(candidate[targetColumn]) === lookupValue,
  );

  return targetRow?.[valueColumn] ?? null;
};

export const readContentJsonPathValue = ({
  column,
  path,
  row,
}: {
  column: string;
  path: string;
  row: Record<string, unknown>;
}) =>
  normalizeJsonPath(path).reduce<unknown>(
    (currentValue, pathSegment) => getObjectValue(currentValue, pathSegment),
    row[column],
  );

export const readContentValueMatchScalarValue = ({
  sourceValue,
  targetColumn,
  targetRows,
  valueColumn,
}: {
  sourceValue: unknown;
  targetColumn: string;
  targetRows: Record<string, unknown>[];
  valueColumn: string;
}) => {
  const normalizedSourceValue = normalizeRelationScalarValue(sourceValue);

  if (!normalizedSourceValue) {
    return null;
  }

  const targetRow = targetRows.find(
    (candidate) => normalizeRelationScalarValue(candidate[targetColumn]) === normalizedSourceValue,
  );

  return targetRow?.[valueColumn] ?? normalizedSourceValue;
};

export const readContentRelatedRowByPostIdValue = ({
  helperRows,
  orderColumn = null,
  postId,
  postIdColumn,
  valueColumn,
}: {
  helperRows: Record<string, unknown>[];
  orderColumn?: string | null;
  postId: string;
  postIdColumn: string;
  valueColumn: string;
}) =>
  readContentOneToOneHelperRowValue({
    helperRows,
    orderColumn,
    postId,
    postIdColumn,
    valueColumn,
  });

export const readContentJoinRowValue = ({
  helperRows,
  orderColumn = null,
  postId,
  postIdColumn,
  valueColumn,
}: {
  helperRows: Record<string, unknown>[];
  orderColumn?: string | null;
  postId: string;
  postIdColumn: string;
  valueColumn: string;
}) =>
  readContentOneToOneHelperRowValue({
    helperRows,
    orderColumn,
    postId,
    postIdColumn,
    valueColumn,
  });

export const resolveContentDerivedReadOnlyValue = ({
  value,
}: {
  value: unknown;
}) => value;
