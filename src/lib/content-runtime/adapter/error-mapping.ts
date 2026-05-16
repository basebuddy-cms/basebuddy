import type { ContentAdapterError } from "./contracts";

type PostgresLikeError = {
  code?: string | null;
  column?: string | null;
  constraint?: string | null;
  detail?: string | null;
  message?: string | null;
};

type ContentAdapterPatchErrorCode = "json_patch_failure" | "array_patch_failure";

type ContentAdapterPatchErrorMetadata = Record<string, unknown>;

type ContentAdapterPatchErrorDetails = {
  code: ContentAdapterPatchErrorCode;
  fieldKey?: string;
  message: string;
  metadata: ContentAdapterPatchErrorMetadata;
};

export class ContentAdapterPatchError extends Error {
  readonly code: ContentAdapterPatchErrorCode;
  readonly fieldKey?: string;
  readonly metadata: ContentAdapterPatchErrorMetadata;

  constructor({ code, fieldKey, message, metadata }: ContentAdapterPatchErrorDetails) {
    super(message);
    this.name = "ContentAdapterPatchError";
    this.code = code;
    this.fieldKey = fieldKey;
    this.metadata = metadata;
  }
}

const isContentAdapterPatchError = (
  error: unknown,
): error is ContentAdapterPatchError =>
  error instanceof ContentAdapterPatchError ||
  Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (((error as { code?: unknown }).code === "json_patch_failure") ||
        (error as { code?: unknown }).code === "array_patch_failure") &&
      "metadata" in error &&
      typeof (error as { metadata?: unknown }).metadata === "object" &&
      (error as { metadata?: unknown }).metadata !== null,
  );

const getJsonPatchFailureMessage = (path: string) => `Could not update the JSON path "${path}".`;
const getArrayPatchFailureMessage = (target: string) => `Could not update the array target "${target}".`;

export const createContentAdapterJsonPatchError = ({
  fieldKey,
  path,
  reason,
  sourceColumn,
}: {
  fieldKey?: string;
  path: string;
  reason:
    | "full_object_replace_not_allowed"
    | "malformed_json_payload"
    | "missing_parent_container"
    | "missing_path";
  sourceColumn?: string;
}) =>
  new ContentAdapterPatchError({
    code: "json_patch_failure",
    ...(fieldKey ? { fieldKey } : {}),
    message:
      reason === "full_object_replace_not_allowed"
        ? "Full-object JSON replace is not allowed."
        : reason === "missing_path"
        ? "The selected JSON path is missing."
        : reason === "missing_parent_container"
          ? "The selected JSON container is missing."
          : "Malformed JSON payload.",
    metadata: {
      path,
      reason,
      ...(sourceColumn ? { sourceColumn } : {}),
    },
  });

export const createContentAdapterArrayPatchError = ({
  fieldKey,
  reason,
  sourceColumn,
  target,
}: {
  fieldKey?: string;
  reason: "invalid_array_payload" | "invalid_array_target" | "missing_stable_identity";
  sourceColumn?: string;
  target: string;
}) =>
  new ContentAdapterPatchError({
    code: "array_patch_failure",
    ...(fieldKey ? { fieldKey } : {}),
    message:
      reason === "invalid_array_payload"
        ? "Array payload must be an array."
        : reason === "missing_stable_identity"
          ? "Object-array patch requires a stable identity key."
          : "Array target is invalid.",
    metadata: {
      reason,
      ...(sourceColumn ? { sourceColumn } : {}),
      target,
    },
  });

export type ContentAdapterErrorFieldContext = {
  allowedValuesByFieldKey?: Record<string, string[] | null | undefined>;
  fieldKeyByColumn?: Record<string, string | undefined>;
};

const normalizeIdentifier = (value: string | null | undefined) =>
  value?.trim().replace(/^"|"$/g, "").toLowerCase() ?? "";

const getFieldKeyByColumn = ({
  column,
  context,
}: {
  column?: string | null;
  context?: ContentAdapterErrorFieldContext;
}) => {
  const normalizedColumn = normalizeIdentifier(column);

  if (!normalizedColumn) {
    return undefined;
  }

  return context?.fieldKeyByColumn?.[normalizedColumn];
};

const getFieldKeyByConstraint = ({
  constraint,
  context,
}: {
  constraint?: string | null;
  context?: ContentAdapterErrorFieldContext;
}) => {
  const normalizedConstraint = normalizeIdentifier(constraint);

  if (!normalizedConstraint) {
    return undefined;
  }

  for (const [column, fieldKey] of Object.entries(context?.fieldKeyByColumn ?? {})) {
    if (fieldKey && normalizedConstraint.includes(column)) {
      return fieldKey;
    }
  }

  return undefined;
};

const getFieldKeyFromErrorDetail = ({
  detail,
  context,
}: {
  detail?: string | null;
  context?: ContentAdapterErrorFieldContext;
}) => {
  if (!detail) {
    return undefined;
  }

  const keyMatch = /Key \(([^)]+)\)=/i.exec(detail);

  if (!keyMatch?.[1]) {
    return undefined;
  }

  const keyColumns = keyMatch[1]
    .split(",")
    .map((value) => normalizeIdentifier(value))
    .filter(Boolean);

  for (const column of keyColumns) {
    const fieldKey = context?.fieldKeyByColumn?.[column];

    if (fieldKey) {
      return fieldKey;
    }
  }

  return undefined;
};

const resolveMappedFieldKey = ({
  context,
  postgresError,
}: {
  context?: ContentAdapterErrorFieldContext;
  postgresError: PostgresLikeError;
}) =>
  getFieldKeyByColumn({
    column: postgresError.column,
    context,
  }) ??
  getFieldKeyFromErrorDetail({
    detail: postgresError.detail,
    context,
  }) ??
  getFieldKeyByConstraint({
    constraint: postgresError.constraint,
    context,
  });

const buildMappedError = ({
  code,
  constraint,
  detail,
  fieldKey,
  normalizedCode,
  normalizedMessage,
  allowedValues,
}: {
  allowedValues?: string[] | null;
  code?: string | null;
  constraint?: string | null;
  detail?: string | null;
  fieldKey?: string;
  normalizedCode: string;
  normalizedMessage: string;
}): ContentAdapterError => ({
  code: normalizedCode,
  ...(fieldKey ? { fieldKey } : {}),
  message: normalizedMessage,
  metadata: {
    ...(constraint ? { constraint } : {}),
    ...(detail ? { detail } : {}),
    ...(allowedValues?.length ? { allowedValues } : {}),
    ...(code ? { postgresCode: code } : {}),
  },
});

const getAllowedValuesForFieldKey = ({
  context,
  fieldKey,
}: {
  context?: ContentAdapterErrorFieldContext;
  fieldKey?: string;
}) => (fieldKey ? context?.allowedValuesByFieldKey?.[fieldKey] ?? null : null);

export class ContentAdapterOperationError extends Error {
  readonly errors: ContentAdapterError[];
  readonly status: number;

  constructor(errors: ContentAdapterError[], status = getContentAdapterOperationErrorStatus(errors)) {
    super(errors[0]?.message ?? "Could not complete the requested content operation.");
    this.name = "ContentAdapterOperationError";
    this.errors = errors;
    this.status = status;
  }
}

export const createContentAdapterOperationError = (
  errors: ContentAdapterError[],
  status?: number,
) => new ContentAdapterOperationError(errors, status);

export const isContentAdapterOperationError = (
  error: unknown,
): error is ContentAdapterOperationError =>
  error instanceof ContentAdapterOperationError ||
  Boolean(
    error &&
      typeof error === "object" &&
      "errors" in error &&
      Array.isArray((error as { errors?: unknown }).errors),
  );

export const getContentAdapterOperationErrorStatus = (
  errors: ContentAdapterError[],
) =>
  errors.some(
    (error) =>
      error.code === "helper_row_ambiguity" ||
      error.code === "uniqueness_violation" ||
      error.code === "stale_row_conflict",
  )
    ? 409
    : 400;

export const createContentAdapterValidationError = ({
  code = "validation_error",
  fieldKey,
  message,
  metadata,
}: ContentAdapterError) =>
  createContentAdapterOperationError([
    {
      code,
      ...(fieldKey ? { fieldKey } : {}),
      ...(metadata ? { metadata } : {}),
      message,
    },
  ]);

export const mapContentProviderErrorToAdapterError = (
  error: unknown,
  context?: ContentAdapterErrorFieldContext,
): ContentAdapterError => {
  if (isContentAdapterPatchError(error)) {
    const path = typeof error.metadata.path === "string" ? error.metadata.path : null;
    const target = typeof error.metadata.target === "string" ? error.metadata.target : null;

    return {
      code: error.code,
      ...(error.fieldKey ? { fieldKey: error.fieldKey } : {}),
      message:
        error.code === "json_patch_failure" && path
          ? getJsonPatchFailureMessage(path)
          : error.code === "array_patch_failure" && target
            ? getArrayPatchFailureMessage(target)
            : error.message,
      metadata: error.metadata,
    };
  }

  if (!error || typeof error !== "object") {
    return {
      code: "unknown_error",
      message: "An unknown error occurred.",
    };
  }

  const postgresError = error as PostgresLikeError;
  const fieldKey = resolveMappedFieldKey({
    context,
    postgresError,
  });
  const allowedValues = getAllowedValuesForFieldKey({
    context,
    fieldKey,
  });

  switch (postgresError.code) {
    case "23505":
      return buildMappedError({
        ...postgresError,
        fieldKey,
        normalizedCode: "uniqueness_violation",
        normalizedMessage: "A unique value is already in use.",
      });
    case "23502":
      return buildMappedError({
        ...postgresError,
        fieldKey,
        normalizedCode: "nullability_violation",
        normalizedMessage: "A required value is missing.",
      });
    case "23503":
      return buildMappedError({
        ...postgresError,
        fieldKey,
        normalizedCode: "foreign_key_violation",
        normalizedMessage: "The selected related record is invalid.",
      });
    case "23514":
      return buildMappedError({
        ...postgresError,
        allowedValues,
        fieldKey,
        normalizedCode: "check_constraint_violation",
        normalizedMessage: "The value does not satisfy a database rule.",
      });
    case "22P02":
    case "22003":
    case "22007":
      return buildMappedError({
        ...postgresError,
        allowedValues,
        fieldKey,
        normalizedCode: "invalid_value",
        normalizedMessage: "One or more fields have invalid values.",
      });
    case "22001":
      return buildMappedError({
        ...postgresError,
        fieldKey,
        normalizedCode: "value_too_long",
        normalizedMessage: "One or more fields are too long.",
      });
    default:
      return {
        code: "unknown_error",
        ...(fieldKey ? { fieldKey } : {}),
        message: postgresError.message || "An unknown error occurred.",
      };
  }
};
