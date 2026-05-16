import { isContentFieldNonWritableState } from "@/lib/content-runtime/field-contract";
import type {
  ContentAdapterEditabilityState,
  ContentAdapterPatchMode,
  ContentAdapterStoragePrimitive,
} from "../contracts";
import {
  createContentAdapterArrayPatchError,
  createContentAdapterJsonPatchError,
} from "../error-mapping";

const normalizeJsonPath = (path: string) =>
  path
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const cloneJsonValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return [...value];
  }

  if (isRecord(value)) {
    return { ...value };
  }

  return {};
};

const patchJsonPath = ({
  allowCreateMissingPath,
  allowCreateParentContainers,
  path,
  target,
  value,
}: {
  allowCreateMissingPath: boolean;
  allowCreateParentContainers: boolean;
  path: string[];
  target: unknown;
  value: unknown;
}): Record<string, unknown> => {
  if (!isRecord(target) && !allowCreateParentContainers) {
    throw new Error("The selected JSON container is missing.");
  }

  const nextTarget = cloneJsonValue(target) as Record<string, unknown>;
  const [currentSegment, ...remainingSegments] = path;

  if (!currentSegment) {
    return nextTarget;
  }

  if (!remainingSegments.length) {
    if (nextTarget[currentSegment] === undefined && !allowCreateMissingPath) {
      throw new Error("The selected JSON path is missing.");
    }

    nextTarget[currentSegment] = value;
    return nextTarget;
  }

  nextTarget[currentSegment] = patchJsonPath({
    allowCreateMissingPath,
    allowCreateParentContainers,
    path: remainingSegments,
    target: nextTarget[currentSegment],
    value,
  });
  return nextTarget;
};

export const resolveContentAdapterPatchMode = ({
  editabilityState,
  storagePrimitive,
}: {
  editabilityState: ContentAdapterEditabilityState;
  storagePrimitive: ContentAdapterStoragePrimitive;
}): ContentAdapterPatchMode => {
  if (isContentFieldNonWritableState(editabilityState)) {
    return "no_write";
  }

  switch (storagePrimitive) {
    case "json_path":
      return "key_patch";
    case "array_item":
      return "index_patch";
    case "foreign_key":
    case "related_row_by_post_id":
    case "join_row":
    case "join_table":
    case "polymorphic_join":
    case "value_match_relation":
      return "link_replace";
    default:
      return "replace";
  }
};

export const applyContentJsonPathPatch = ({
  allowCreateMissingPath = false,
  allowCreateParentContainers = false,
  fieldKey,
  path,
  sourceColumn,
  target,
  value,
}: {
  allowCreateMissingPath?: boolean;
  allowCreateParentContainers?: boolean;
  fieldKey?: string;
  path: string;
  sourceColumn?: string;
  target: unknown;
  value: unknown;
}) => {
  try {
    return patchJsonPath({
      allowCreateMissingPath,
      allowCreateParentContainers,
      path: normalizeJsonPath(path),
      target,
      value,
    });
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error;
    }

    if (error.message === "The selected JSON path is missing.") {
      throw createContentAdapterJsonPatchError({
        ...(fieldKey ? { fieldKey } : {}),
        path,
        reason: "missing_path",
        ...(sourceColumn ? { sourceColumn } : {}),
      });
    }

    if (error.message === "The selected JSON container is missing.") {
      throw createContentAdapterJsonPatchError({
        ...(fieldKey ? { fieldKey } : {}),
        path,
        reason: "missing_parent_container",
        ...(sourceColumn ? { sourceColumn } : {}),
      });
    }

    throw error;
  }
};

export const applyContentJsonObjectReplacePatch = ({
  allowFullObjectReplace = false,
  fieldKey,
  path = "$",
  sourceColumn,
  value,
}: {
  allowFullObjectReplace?: boolean;
  fieldKey?: string;
  path?: string;
  sourceColumn?: string;
  target: unknown;
  value: unknown;
}) => {
  if (!allowFullObjectReplace) {
    throw createContentAdapterJsonPatchError({
      ...(fieldKey ? { fieldKey } : {}),
      path,
      reason: "full_object_replace_not_allowed",
      ...(sourceColumn ? { sourceColumn } : {}),
    });
  }

  return cloneJsonValue(value);
};

export const validateContentJsonWriteValue = (
  value: unknown,
  context?: {
    fieldKey?: string;
    path?: string;
    sourceColumn?: string;
  },
) => {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    throw createContentAdapterJsonPatchError({
      ...(context?.fieldKey ? { fieldKey: context.fieldKey } : {}),
      path: context?.path ?? "$",
      reason: "malformed_json_payload",
      ...(context?.sourceColumn ? { sourceColumn: context.sourceColumn } : {}),
    });
  }
};

export const validateContentArrayWriteValue = (
  value: unknown,
  context?: {
    fieldKey?: string;
    sourceColumn?: string;
    target?: string;
  },
) => {
  const normalizedValue = validateContentJsonWriteValue(value, {
    fieldKey: context?.fieldKey,
    path: context?.target ?? "$",
    sourceColumn: context?.sourceColumn,
  });

  if (!Array.isArray(normalizedValue)) {
    throw createContentAdapterArrayPatchError({
      ...(context?.fieldKey ? { fieldKey: context.fieldKey } : {}),
      reason: "invalid_array_payload",
      ...(context?.sourceColumn ? { sourceColumn: context.sourceColumn } : {}),
      target: context?.target ?? "whole_array",
    });
  }

  return normalizedValue;
};

export const applyContentArrayReplacePatch = (input: {
  target: unknown[];
  value: unknown[];
}) => [...input.value];

export const applyContentArrayIndexPatch = ({
  fieldKey,
  index,
  sourceColumn,
  target,
  value,
}: {
  fieldKey?: string;
  index: number;
  sourceColumn?: string;
  target: unknown[];
  value: unknown;
}) => {
  if (!Array.isArray(target)) {
    throw createContentAdapterArrayPatchError({
      ...(fieldKey ? { fieldKey } : {}),
      reason: "invalid_array_target",
      ...(sourceColumn ? { sourceColumn } : {}),
      target: `index:${index}`,
    });
  }

  const nextArray = [...target];

  while (nextArray.length < index) {
    nextArray.push(null);
  }

  nextArray[index] = value;
  return nextArray;
};

export const applyContentArrayObjectPatch = ({
  fieldKey,
  identityKey,
  sourceColumn,
  target,
  value,
}: {
  fieldKey?: string;
  identityKey?: string;
  sourceColumn?: string;
  target: unknown[];
  value: unknown;
}) => {
  const normalizedIdentityKey = identityKey?.trim();

  if (!normalizedIdentityKey) {
    throw createContentAdapterArrayPatchError({
      ...(fieldKey ? { fieldKey } : {}),
      reason: "missing_stable_identity",
      ...(sourceColumn ? { sourceColumn } : {}),
      target: "object_array",
    });
  }

  if (!Array.isArray(target)) {
    throw createContentAdapterArrayPatchError({
      ...(fieldKey ? { fieldKey } : {}),
      reason: "invalid_array_target",
      ...(sourceColumn ? { sourceColumn } : {}),
      target: "object_array",
    });
  }

  if (!isRecord(value) || value[normalizedIdentityKey] === undefined) {
    throw createContentAdapterArrayPatchError({
      ...(fieldKey ? { fieldKey } : {}),
      reason: "missing_stable_identity",
      ...(sourceColumn ? { sourceColumn } : {}),
      target: "object_array",
    });
  }

  const identityValue = value[normalizedIdentityKey];
  const nextArray: unknown[] = [];
  let replaced = false;

  for (const item of target) {
    if (!isRecord(item) || item[normalizedIdentityKey] !== identityValue) {
      nextArray.push(item);
      continue;
    }

    if (!replaced) {
      nextArray.push(cloneJsonValue(value));
      replaced = true;
    }
  }

  if (!replaced) {
    nextArray.push(cloneJsonValue(value));
  }

  return nextArray;
};
