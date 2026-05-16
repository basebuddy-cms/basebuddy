export type PostgresContentColumnTypeMetadata = {
  dataType: string;
  udtName: string | null;
};

export const normalizePostgresContentComparableType = (
  metadata: PostgresContentColumnTypeMetadata | null,
) => {
  const normalizedUdtName = metadata?.udtName?.trim().toLowerCase() ?? "";

  if (normalizedUdtName === "varchar" || normalizedUdtName === "bpchar" || normalizedUdtName === "text") {
    return "text";
  }

  if (normalizedUdtName) {
    return normalizedUdtName;
  }

  const normalizedDataType = metadata?.dataType?.trim().toLowerCase() ?? "";

  if (
    normalizedDataType === "character varying" ||
    normalizedDataType === "character" ||
    normalizedDataType === "text"
  ) {
    return "text";
  }

  return normalizedDataType || null;
};

export const getPostgresContentTypedArrayCastSuffix = (
  metadata: PostgresContentColumnTypeMetadata | null,
) => {
  const normalizedType = normalizePostgresContentComparableType(metadata);

  switch (normalizedType) {
    case "bool":
    case "boolean":
      return "::boolean[]";
    case "date":
      return "::date[]";
    case "float4":
    case "real":
      return "::real[]";
    case "float8":
    case "double precision":
      return "::double precision[]";
    case "int2":
    case "smallint":
      return "::smallint[]";
    case "int4":
    case "integer":
      return "::integer[]";
    case "int8":
    case "bigint":
      return "::bigint[]";
    case "numeric":
      return "::numeric[]";
    case "text":
      return "::text[]";
    case "timestamp":
    case "timestamp without time zone":
      return "::timestamp[]";
    case "timestamptz":
    case "timestamp with time zone":
      return "::timestamptz[]";
    case "uuid":
      return "::uuid[]";
    default:
      return null;
  }
};

export const buildPostgresContentArrayPredicate = ({
  columnExpression,
  columnMetadata,
  paramIndex,
}: {
  columnExpression: string;
  columnMetadata: PostgresContentColumnTypeMetadata | null;
  paramIndex: number;
}) => {
  const arrayCastSuffix = getPostgresContentTypedArrayCastSuffix(columnMetadata);

  if (arrayCastSuffix) {
    return `${columnExpression} = any($${paramIndex}${arrayCastSuffix})`;
  }

  return `${columnExpression}::text = any($${paramIndex}::text[])`;
};

export const arePostgresContentColumnsTypeCompatible = ({
  left,
  right,
}: {
  left: PostgresContentColumnTypeMetadata | null;
  right: PostgresContentColumnTypeMetadata | null;
}) => {
  const leftType = normalizePostgresContentComparableType(left);
  const rightType = normalizePostgresContentComparableType(right);

  return Boolean(leftType && rightType && leftType === rightType);
};
