import type { ContentAdapterValueKind } from "../contracts";
import { isContentExactNumericDataType } from "@/lib/content-runtime/custom-field-support";

type ContentAdapterCoercionSuccess = {
  ok: true;
  value: unknown;
};

type ContentAdapterCoercionFailure = {
  code: string;
  message: string;
  ok: false;
};

export type ContentAdapterCoercionResult =
  | ContentAdapterCoercionFailure
  | ContentAdapterCoercionSuccess;

const normalizeArrayElementDataType = (dataType: string) =>
  dataType
    .trim()
    .toLowerCase()
    .replace(/\[\]$/, "")
    .trim();

const resolveArrayElementValueKind = (dataType: string): ContentAdapterValueKind => {
  const normalizedDataType = normalizeArrayElementDataType(dataType);

  switch (normalizedDataType) {
    case "numeric":
    case "decimal":
    case "bigint":
    case "int8":
      return "text_like";
    case "smallint":
    case "integer":
    case "real":
    case "double precision":
    case "int2":
    case "int4":
    case "float4":
    case "float8":
      return "number";
    case "boolean":
    case "bool":
      return "boolean";
    case "date":
      return "date";
    case "timestamp":
    case "timestamp without time zone":
    case "timestamp with time zone":
    case "timestamptz":
    case "time":
    case "time without time zone":
    case "time with time zone":
      return "datetime";
    default:
      return "text_like";
  }
};

const parseArrayLikeValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  try {
    const parsedValue = JSON.parse(value);
    return Array.isArray(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
};

const normalizeStringValue = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const coerceBooleanValue = (value: unknown): ContentAdapterCoercionResult => {
  if (typeof value === "boolean") {
    return { ok: true, value };
  }

  if (typeof value === "number") {
    if (value === 1) {
      return { ok: true, value: true };
    }

    if (value === 0) {
      return { ok: true, value: false };
    }
  }

  const normalized = normalizeStringValue(value).toLowerCase();

  if (["true", "1", "yes", "on"].includes(normalized)) {
    return { ok: true, value: true };
  }

  if (["false", "0", "no", "off"].includes(normalized)) {
    return { ok: true, value: false };
  }

  return {
    code: "invalid_boolean",
    message: "Use true or false.",
    ok: false,
  };
};

const coerceNumberValue = (value: unknown): ContentAdapterCoercionResult => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return { ok: true, value };
  }

  if (typeof value === "string" && value.trim()) {
    const parsedValue = Number(value);

    if (Number.isFinite(parsedValue)) {
      return { ok: true, value: parsedValue };
    }
  }

  return {
    code: "invalid_number",
    message: "Enter a valid number.",
    ok: false,
  };
};

const coerceEnumValue = ({
  allowedValues,
  value,
}: {
  allowedValues?: string[] | null;
  value: unknown;
}): ContentAdapterCoercionResult => {
  const normalizedValue = typeof value === "string" ? value : String(value ?? "");

  if (allowedValues?.length && !allowedValues.includes(normalizedValue)) {
    return {
      code: "enum_value_not_allowed",
      message: `Choose one of the allowed values instead of "${normalizedValue}".`,
      ok: false,
    };
  }

  return {
    ok: true,
    value: normalizedValue,
  };
};

const coerceTemporalValue = ({
  value,
  valueKind,
}: {
  value: unknown;
  valueKind: "date" | "datetime";
}): ContentAdapterCoercionResult => {
  if (typeof value !== "string" && !(value instanceof Date)) {
    return {
      code: "invalid_temporal_value",
      message: "Enter a valid date.",
      ok: false,
    };
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return {
      code: "invalid_temporal_value",
      message: "Enter a valid date.",
      ok: false,
    };
  }

  return {
    ok: true,
    value: valueKind === "date" ? date.toISOString().slice(0, 10) : date.toISOString(),
  };
};

export const coerceContentAdapterArrayValue = ({
  allowedValues = null,
  dataType,
  value,
}: {
  allowedValues?: string[] | null;
  dataType: string;
  value: unknown;
}): ContentAdapterCoercionResult => {
  const parsedArrayValue = parseArrayLikeValue(value);

  if (!parsedArrayValue) {
    return {
      code: "invalid_array",
      message: "Value must be an array.",
      ok: false,
    };
  }

  const elementValueKind = allowedValues?.length ? "enum" : resolveArrayElementValueKind(dataType);
  const shouldPreserveExactNumberText =
    !allowedValues?.length && isContentExactNumericDataType(dataType);
  const nextValues: unknown[] = [];

  for (const [index, entry] of parsedArrayValue.entries()) {
    if (entry === null) {
      nextValues.push(null);
      continue;
    }

    const coercionResult = coerceContentAdapterValue({
      allowedValues,
      value: entry,
      valueKind: shouldPreserveExactNumberText ? "text_like" : elementValueKind,
    });

    if (coercionResult.ok === false) {
      return {
        code: coercionResult.code,
        message: `Item ${index + 1} is invalid. ${coercionResult.message}`,
        ok: false,
      };
    }

    nextValues.push(coercionResult.value);
  }

  return {
    ok: true,
    value: nextValues,
  };
};

export const coerceContentAdapterValue = ({
  allowedValues = null,
  value,
  valueKind,
}: {
  allowedValues?: string[] | null;
  value: unknown;
  valueKind: ContentAdapterValueKind;
}): ContentAdapterCoercionResult => {
  switch (valueKind) {
    case "number":
    case "number_list":
      return coerceNumberValue(value);
    case "boolean":
    case "boolean_list":
      return coerceBooleanValue(value);
    case "enum":
    case "enum_list":
      return coerceEnumValue({ allowedValues, value });
    case "date":
      return coerceTemporalValue({ value, valueKind: "date" });
    case "datetime":
    case "date_or_datetime":
      return coerceTemporalValue({ value, valueKind: "datetime" });
    case "json_object":
    case "json_object_inline":
    case "json_object_list":
      return typeof value === "object" && value !== null
        ? { ok: true, value }
        : {
            code: "invalid_json_object",
            message: "Enter a valid object value.",
            ok: false,
          };
    case "array_scalar":
    case "array_scalar_inline":
      return Array.isArray(value)
        ? { ok: true, value }
        : {
            code: "invalid_array",
            message: "Value must be an array.",
            ok: false,
          };
    case "long_text":
    case "text_like":
    case "text_like_inline":
    case "text_like_list":
    case "content":
    case "redirects":
    default:
      return {
        ok: true,
        value: value == null ? "" : String(value),
      };
  }
};
