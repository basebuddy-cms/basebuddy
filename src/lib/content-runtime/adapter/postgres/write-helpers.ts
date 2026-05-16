const normalizeJsonPath = (path: string) =>
  path
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);

const normalizeScalarValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return null;
  }

  const normalizedValue = String(value).trim();
  return normalizedValue || null;
};

export type ContentAdapterDirectColumnWrite = {
  column: string;
  kind: "direct_column";
  value: unknown;
};

export type ContentAdapterForeignKeyWrite = {
  column: string;
  kind: "foreign_key";
  value: string | null;
};

export type ContentAdapterTargetRowScalarWrite = {
  kind: "target_row_scalar";
  strategy: "foreign_key" | "value_match_relation";
  targetColumn: string;
  targetLookupValue: string;
  value: unknown;
  valueColumn: string;
};

export type ContentAdapterJsonPathWrite = {
  column: string;
  kind: "json_path";
  path: string[];
  value: unknown;
};

export type ContentAdapterArrayReplaceWrite = {
  column: string;
  kind: "array_value";
  value: unknown[];
};

export type ContentAdapterArrayIndexWrite = {
  column: string;
  index: number;
  kind: "array_item";
  value: unknown;
};

export type ContentAdapterJoinTableReplaceWrite = {
  kind: "join_table";
  orderColumn: string | null;
  postId: string;
  rows: Record<string, unknown>[];
  sourceColumn: string;
  targetColumn: string;
};

export type ContentAdapterPolymorphicJoinReplaceWrite = {
  discriminatorColumn: string;
  discriminatorValue: string;
  kind: "polymorphic_join";
  orderColumn: string | null;
  postId: string;
  rows: Record<string, unknown>[];
  sourceColumn: string;
  targetColumn: string;
};

export type ContentAdapterRelatedRowByPostIdUpsertWrite = {
  kind: "related_row_by_post_id";
  postId: string;
  postIdColumn: string;
  row: Record<string, unknown>;
  valueColumn: string;
};

export type ContentAdapterJoinRowUpsertWrite = {
  kind: "join_row";
  postId: string;
  postIdColumn: string;
  row: Record<string, unknown>;
  valueColumn: string;
};

export type ContentAdapterValueMatchRelationWrite = {
  kind: "value_match_relation";
  multiple: boolean;
  value: string | string[] | null;
};

export const buildContentDirectColumnWrite = ({
  column,
  value,
}: {
  column: string;
  value: unknown;
}): ContentAdapterDirectColumnWrite => ({
  column,
  kind: "direct_column",
  value,
});

export const buildContentForeignKeyWrite = ({
  column,
  value,
}: {
  column: string;
  value: string | null;
}): ContentAdapterForeignKeyWrite => ({
  column,
  kind: "foreign_key",
  value,
});

export const buildContentForeignRowScalarWrite = ({
  targetColumn,
  targetLookupValue,
  value,
  valueColumn,
}: {
  targetColumn: string;
  targetLookupValue: string;
  value: unknown;
  valueColumn: string;
}): ContentAdapterTargetRowScalarWrite | null => {
  const normalizedLookupValue = normalizeScalarValue(targetLookupValue);

  if (!normalizedLookupValue) {
    return null;
  }

  return {
    kind: "target_row_scalar",
    strategy: "foreign_key",
    targetColumn,
    targetLookupValue: normalizedLookupValue,
    value,
    valueColumn,
  };
};

export const buildContentRelatedRowByPostIdUpsertWrite = ({
  postId,
  postIdColumn,
  value,
  valueColumn,
}: {
  postId: string;
  postIdColumn: string;
  value: unknown;
  valueColumn: string;
}): ContentAdapterRelatedRowByPostIdUpsertWrite => ({
  kind: "related_row_by_post_id",
  postId,
  postIdColumn,
  row: {
    [postIdColumn]: postId,
    [valueColumn]: value,
  },
  valueColumn,
});

export const buildContentJoinRowUpsertWrite = ({
  postId,
  postIdColumn,
  value,
  valueColumn,
}: {
  postId: string;
  postIdColumn: string;
  value: unknown;
  valueColumn: string;
}): ContentAdapterJoinRowUpsertWrite => ({
  kind: "join_row",
  postId,
  postIdColumn,
  row: {
    [postIdColumn]: postId,
    [valueColumn]: value,
  },
  valueColumn,
});

export const buildContentJsonPathWrite = ({
  column,
  path,
  value,
}: {
  column: string;
  path: string;
  value: unknown;
}): ContentAdapterJsonPathWrite => ({
  column,
  kind: "json_path",
  path: normalizeJsonPath(path),
  value,
});

export const buildContentArrayReplaceWrite = ({
  column,
  value,
}: {
  column: string;
  value: unknown[];
}): ContentAdapterArrayReplaceWrite => ({
  column,
  kind: "array_value",
  value: [...value],
});

export const buildContentArrayIndexWrite = ({
  column,
  index,
  value,
}: {
  column: string;
  index: number;
  value: unknown;
}): ContentAdapterArrayIndexWrite => ({
  column,
  index,
  kind: "array_item",
  value,
});

export const buildContentJoinTableReplaceWrite = ({
  orderColumn = null,
  postId,
  sourceColumn,
  targetColumn,
  values,
}: {
  orderColumn?: string | null;
  postId: string;
  sourceColumn: string;
  targetColumn: string;
  values: string[];
}): ContentAdapterJoinTableReplaceWrite => {
  const normalizedValues = [...new Set(values.map((value) => value.trim()).filter(Boolean))];

  return {
    kind: "join_table",
    orderColumn,
    postId,
    rows: normalizedValues.map((value, index) => ({
      [sourceColumn]: postId,
      [targetColumn]: value,
      ...(orderColumn ? { [orderColumn]: index } : {}),
    })),
    sourceColumn,
    targetColumn,
  };
};

export const buildContentPolymorphicJoinReplaceWrite = ({
  discriminatorColumn,
  discriminatorValue,
  orderColumn = null,
  postId,
  sourceColumn,
  targetColumn,
  values,
}: {
  discriminatorColumn: string;
  discriminatorValue: string;
  orderColumn?: string | null;
  postId: string;
  sourceColumn: string;
  targetColumn: string;
  values: string[];
}): ContentAdapterPolymorphicJoinReplaceWrite => {
  const normalizedValues = [...new Set(values.map((value) => value.trim()).filter(Boolean))];

  return {
    discriminatorColumn,
    discriminatorValue,
    kind: "polymorphic_join",
    orderColumn,
    postId,
    rows: normalizedValues.map((value, index) => ({
      [discriminatorColumn]: discriminatorValue,
      [sourceColumn]: postId,
      [targetColumn]: value,
      ...(orderColumn ? { [orderColumn]: index } : {}),
    })),
    sourceColumn,
    targetColumn,
  };
};

export const buildContentValueMatchRelationWrite = ({
  multiple,
  selectedIds,
  targetIdColumn,
  targetMatchColumn,
  targetRows,
  unresolvedMatchValuesById = {},
}: {
  multiple: boolean;
  selectedIds: string | string[];
  targetIdColumn: string;
  targetMatchColumn: string;
  targetRows: Record<string, unknown>[];
  unresolvedMatchValuesById?: Record<string, string>;
}): ContentAdapterValueMatchRelationWrite => {
  const normalizedMatchValuesById = new Map<string, string>();

  for (const row of targetRows) {
    const id = normalizeScalarValue(row[targetIdColumn]);
    const matchValue = normalizeScalarValue(row[targetMatchColumn]);

    if (!id || !matchValue || normalizedMatchValuesById.has(id)) {
      continue;
    }

    normalizedMatchValuesById.set(id, matchValue);
  }

  const rawSelectedIds = Array.isArray(selectedIds) ? selectedIds : [selectedIds];
  const seenMatchValues = new Set<string>();
  const normalizedMatchValues: string[] = [];

  for (const selectedId of rawSelectedIds) {
    const normalizedSelectedId = normalizeScalarValue(selectedId);

    if (!normalizedSelectedId) {
      continue;
    }

    const unresolvedMatchValue = normalizeScalarValue(unresolvedMatchValuesById[normalizedSelectedId]);
    const matchValue =
      normalizedMatchValuesById.get(normalizedSelectedId) ??
      unresolvedMatchValue ??
      normalizedSelectedId;

    if (!matchValue || seenMatchValues.has(matchValue)) {
      continue;
    }

    seenMatchValues.add(matchValue);
    normalizedMatchValues.push(matchValue);
  }

  return {
    kind: "value_match_relation",
    multiple,
    value: multiple ? normalizedMatchValues : normalizedMatchValues[0] ?? null,
  };
};

export const buildContentValueMatchScalarWrite = ({
  targetColumn,
  targetLookupValue,
  value,
  valueColumn,
}: {
  targetColumn: string;
  targetLookupValue: string;
  value: unknown;
  valueColumn: string;
}): ContentAdapterTargetRowScalarWrite | null => {
  const normalizedLookupValue = normalizeScalarValue(targetLookupValue);

  if (!normalizedLookupValue) {
    return null;
  }

  return {
    kind: "target_row_scalar",
    strategy: "value_match_relation",
    targetColumn,
    targetLookupValue: normalizedLookupValue,
    value,
    valueColumn,
  };
};
