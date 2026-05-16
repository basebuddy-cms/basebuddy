import type { ContentEntityMapping } from "@/lib/content-runtime/mapping";
import type { ContentFieldSemanticRole } from "@/lib/content-runtime/field-contract";

import type {
  ContentCompiledAdapterMapping,
  ContentCompiledWorkflowFieldKey,
} from "./compiler";
import { resolveContentCompiledBaseEditabilityState } from "./compiler-storage-contract";

const workflowFieldSemanticRoles: Record<
  ContentCompiledWorkflowFieldKey,
  ContentFieldSemanticRole
> = {
  publishedAt: "publishedAt",
  status: "status",
};

const normalizedWorkflowValues = (values: string[]) =>
  [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];

const hasSafeStatusValueMapping = (workflow: NonNullable<ContentEntityMapping["workflow"]>) => {
  if (!workflow.statusColumn || workflow.mode === "custom") {
    return false;
  }

  const valueGroups = [
    normalizedWorkflowValues(workflow.draftValues),
    normalizedWorkflowValues(workflow.publishedValues),
    normalizedWorkflowValues(workflow.archivedValues),
  ];

  if (!valueGroups[0]?.length || !valueGroups[1]?.length) {
    return false;
  }

  const seenValues = new Set<string>();

  for (const group of valueGroups) {
    for (const value of group) {
      if (seenValues.has(value)) {
        return false;
      }

      seenValues.add(value);
    }
  }

  return true;
};

const hasSafePublishedFlagMapping = (workflow: NonNullable<ContentEntityMapping["workflow"]>) => {
  if (!workflow.publishedFlagColumn || workflow.mode === "custom") {
    return false;
  }

  const publishedValues = normalizedWorkflowValues(workflow.publishedValues);
  return publishedValues.length === 1 && (publishedValues[0] === "true" || publishedValues[0] === "false");
};

export const compileContentCompiledWorkflowFields = (
  entity: ContentEntityMapping,
): ContentCompiledAdapterMapping["workflowFields"] => {
  const workflowFields: ContentCompiledAdapterMapping["workflowFields"] = {};
  const workflow = entity.workflow;

  if (!workflow) {
    return workflowFields;
  }

  const hasSafeStatusWorkflow =
    hasSafeStatusValueMapping(workflow) &&
    (!workflow.publishedFlagColumn || hasSafePublishedFlagMapping(workflow));
  const hasUnsafePublishedAtTimestampSource = Boolean(
    workflow.publishedAtColumn &&
      entity.fields.publishedAt?.column === workflow.publishedAtColumn &&
      entity.fields.publishedAt?.timestampSourceHint,
  );
  const hasSafePublishedAtWorkflow =
    Boolean(workflow.publishedAtColumn) &&
    !hasUnsafePublishedAtTimestampSource &&
    (workflow.statusColumn
      ? hasSafeStatusWorkflow
      : workflow.publishedFlagColumn
        ? hasSafePublishedFlagMapping(workflow)
        : workflow.mode !== "custom");

  if (workflow.statusColumn) {
    workflowFields.status = {
      editabilityState:
        resolveContentCompiledBaseEditabilityState({ entity, storagePrimitive: "direct_column" }) === "read_only"
          ? "read_only"
          : hasSafeStatusWorkflow
            ? "coercible"
            : "read_only",
      fieldKey: "status",
      semanticRole: workflowFieldSemanticRoles.status,
      sourceColumn: workflow.statusColumn,
      sourceEntity: "posts",
      sourceTable: entity.source.table,
      storagePrimitive: "direct_column",
      valueKind: "text_like",
    };
  } else if (workflow.publishedFlagColumn) {
    workflowFields.status = {
      editabilityState:
        resolveContentCompiledBaseEditabilityState({ entity, storagePrimitive: "boolean_mapping" }) === "read_only"
          ? "read_only"
          : hasSafePublishedFlagMapping(workflow)
            ? "coercible"
            : "read_only",
      fieldKey: "status",
      semanticRole: workflowFieldSemanticRoles.status,
      sourceColumn: workflow.publishedFlagColumn,
      sourceEntity: "posts",
      sourceTable: entity.source.table,
      storagePrimitive: "boolean_mapping",
      valueKind: "boolean",
    };
  }

  if (workflow.publishedAtColumn) {
    workflowFields.publishedAt = {
      editabilityState:
        resolveContentCompiledBaseEditabilityState({ entity, storagePrimitive: "direct_column" }) === "read_only"
          ? "read_only"
          : hasSafePublishedAtWorkflow
            ? "coercible"
            : "read_only",
      fieldKey: "publishedAt",
      semanticRole: workflowFieldSemanticRoles.publishedAt,
      sourceColumn: workflow.publishedAtColumn,
      sourceEntity: "posts",
      sourceTable: entity.source.table,
      storagePrimitive: "direct_column",
      valueKind: "datetime",
    };
  }

  return workflowFields;
};
