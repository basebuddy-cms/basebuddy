import type { ContentCustomFieldMapping } from "./mapping";

const CUSTOM_FIELD_EXOTIC_TYPE_EXACT_MATCHES = new Set([
  "bit",
  "bit varying",
  "box",
  "bytea",
  "cidr",
  "circle",
  "hstore",
  "inet",
  "interval",
  "jsonpath",
  "line",
  "lseg",
  "macaddr",
  "macaddr8",
  "aclitem",
  "cid",
  "int2vector",
  "oid",
  "oidvector",
  "path",
  "pg_lsn",
  "pg_snapshot",
  "point",
  "polygon",
  "refcursor",
  "regclass",
  "regcollation",
  "regconfig",
  "regdictionary",
  "regnamespace",
  "regoper",
  "regoperator",
  "regproc",
  "regprocedure",
  "regrole",
  "regtype",
  "tid",
  "tsquery",
  "tsvector",
  "txid_snapshot",
  "user-defined",
  "xid",
  "xid8",
]);

export const normalizeContentCustomFieldDataType = (dataType: string | null | undefined) =>
  dataType?.trim().toLowerCase() ?? "";

const getCustomFieldBaseDataType = (dataType: string | null | undefined) => {
  const normalized = normalizeContentCustomFieldDataType(dataType);
  return normalized.endsWith("[]") ? normalized.slice(0, -2).trim() : normalized;
};

const getCustomFieldComparableDataType = (dataType: string | null | undefined) =>
  getCustomFieldBaseDataType(dataType).replace(/\(.+\)$/, "").trim();

const CUSTOM_FIELD_EXACT_NUMERIC_TYPE_MATCHES = new Set([
  "bigint",
  "bigserial",
  "decimal",
  "dec",
  "int8",
  "numeric",
  "serial8",
]);

export const isContentExactNumericDataType = (dataType: string | null | undefined) =>
  CUSTOM_FIELD_EXACT_NUMERIC_TYPE_MATCHES.has(getCustomFieldComparableDataType(dataType));

export const isContentXmlDataType = (dataType: string | null | undefined) =>
  getCustomFieldBaseDataType(dataType) === "xml";

export const isContentMultirangeDataType = (dataType: string | null | undefined) =>
  getCustomFieldBaseDataType(dataType).includes("multirange");

export const isContentRangeDataType = (dataType: string | null | undefined) => {
  const baseDataType = getCustomFieldBaseDataType(dataType);

  return baseDataType.endsWith("range") && !baseDataType.includes("multirange");
};

export const isContentCustomFieldBinaryOrExoticDataType = ({
  allowedValues,
  dataType,
}: Pick<ContentCustomFieldMapping, "allowedValues" | "dataType">) => {
  if (allowedValues?.length) {
    return false;
  }

  const baseDataType = getCustomFieldBaseDataType(dataType);

  if (!baseDataType) {
    return false;
  }

  if (CUSTOM_FIELD_EXOTIC_TYPE_EXACT_MATCHES.has(baseDataType)) {
    return true;
  }

  return false;
};
