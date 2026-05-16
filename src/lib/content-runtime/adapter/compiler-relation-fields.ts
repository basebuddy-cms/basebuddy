import type {
  ContentCustomRelationFieldMapping,
  ContentEntityMapping,
  ContentProjectMapping,
  ContentRelationMapping,
} from "@/lib/content-runtime/mapping";
import type { ContentFieldSemanticRole } from "@/lib/content-runtime/field-contract";

import type {
  ContentAdapterEditabilityState,
  ContentAdapterRelationMode,
  ContentAdapterStoragePrimitive,
} from "./contracts";
import type {
  ContentCompiledCustomRelationFieldInstruction,
  ContentCompiledRelationFieldInstruction,
  ContentCompiledRelationFieldKey,
} from "./compiler";
import { resolveContentCompiledBaseEditabilityState } from "./compiler-storage-contract";

const relationFieldSemanticRoles: Record<
  ContentCompiledRelationFieldKey,
  ContentFieldSemanticRole
> = {
  author: "author",
  categories: "categories",
  parentPage: "parentPage",
  tags: "tags",
};

export const contentCompiledRelationFieldKeyMap: Partial<Record<keyof ContentProjectMapping["mappingConfig"]["entities"]["posts"]["relations"], ContentCompiledRelationFieldKey>> = {
  authors: "author",
  categories: "categories",
  posts: "parentPage",
  tags: "tags",
};

const resolveRelationStoragePrimitive = (
  relation: ContentRelationMapping,
): ContentAdapterStoragePrimitive | null => {
  switch (relation.strategy) {
    case "foreign_key":
      return "foreign_key";
    case "related_row_by_post_id":
      return "related_row_by_post_id";
    case "join_row":
      return "join_row";
    case "join_table":
      return "join_table";
    case "polymorphic_join":
      return "polymorphic_join";
    case "value_match_relation":
      return "value_match_relation";
    case "array":
      return "array_value";
    case "json_array":
    case "json_object":
      return "json_path";
    case "inline_fields":
      return "direct_column";
    case "derived_distinct":
      return "derived_read_only";
    default:
      return relation.storagePrimitive ?? null;
  }
};

const resolveEffectiveRelationMultiple = ({
  relation,
  relationKey,
}: {
  relation: ContentRelationMapping;
  relationKey?: ContentCompiledRelationFieldKey;
}) => {
  if (
    (relationKey === "categories" || relationKey === "tags") &&
    (relation.strategy === "foreign_key" ||
      relation.strategy === "related_row_by_post_id" ||
      relation.strategy === "join_row")
  ) {
    return false;
  }

  return relation.multiple;
};

const resolveRelationMode = ({
  multiple,
  relation,
}: {
  multiple: boolean;
  relation: ContentRelationMapping;
}): ContentAdapterRelationMode => {
  if (relation.strategy === "inline_fields") {
    return "inline";
  }

  if (relation.strategy === "value_match_relation") {
    return multiple ? "value_match_multi" : "value_match_single";
  }

  return multiple ? "managed_multi" : "managed_single";
};

const resolveRelationEditabilityState = ({
  entity,
  multiple,
  relationKey,
  relation,
  storagePrimitive,
}: {
  entity: ContentEntityMapping;
  multiple: boolean;
  relationKey?: ContentCompiledRelationFieldKey;
  relation: ContentRelationMapping;
  storagePrimitive: ContentAdapterStoragePrimitive;
}): ContentAdapterEditabilityState => {
  const baseState = resolveContentCompiledBaseEditabilityState({ entity, storagePrimitive });

  if (baseState === "read_only") {
    return baseState;
  }

  if (relation.strategy === "inline_fields" || relation.strategy === "json_object") {
    return "read_only";
  }

  if (relation.strategy === "foreign_key" && multiple) {
    return "unsupported";
  }

  if (
    !multiple &&
    (relation.strategy === "join_table" ||
      relation.strategy === "array" ||
      relation.strategy === "json_array")
  ) {
    return "unsupported";
  }

  if (
    relation.strategy === "polymorphic_join" &&
    (!relation.discriminatorColumn?.trim() || !relation.discriminatorValue?.trim())
  ) {
    return "unsupported";
  }

  if (
    multiple &&
    (relation.strategy === "related_row_by_post_id" || relation.strategy === "join_row")
  ) {
    return "unsupported";
  }

  if (relationKey === "parentPage" && multiple) {
    return "unsupported";
  }

  return baseState;
};

export const compileContentCompiledRelationField = ({
  entity,
  relation,
  relationKey,
  targetEntity,
}: {
  entity: ContentEntityMapping;
  relation: ContentRelationMapping;
  relationKey: ContentCompiledRelationFieldKey;
  targetEntity: ContentEntityMapping | undefined;
}): ContentCompiledRelationFieldInstruction | null => {
  const storagePrimitive = resolveRelationStoragePrimitive(relation);
  const multiple = resolveEffectiveRelationMultiple({ relation, relationKey });

  if (!storagePrimitive) {
    return null;
  }

  return {
    discriminatorColumn: relation.discriminatorColumn,
    discriminatorValue: relation.discriminatorValue,
    editabilityState: resolveRelationEditabilityState({ entity, multiple, relation, relationKey, storagePrimitive }),
    fieldKey: relationKey,
    junctionSourceColumn: relation.junctionSourceColumn,
    junctionTable: relation.junctionTable,
    junctionTargetColumn: relation.junctionTargetColumn,
    multiple,
    relationMode: resolveRelationMode({ multiple, relation }),
    semanticRole: relation.semanticRole ?? relationFieldSemanticRoles[relationKey],
    sourceColumn: relation.sourceColumn,
    sourceEntity: "posts",
    sourceTable: entity.source.table,
    storagePrimitive,
    targetColumn: relation.targetColumn,
    targetEntity: relation.targetEntity,
    targetTable: relation.targetTable ?? targetEntity?.source.table ?? null,
    valueColumn: relation.valueColumn,
  };
};

export const compileContentCompiledCustomRelationField = ({
  entity,
  field,
  targetEntity,
}: {
  entity: ContentEntityMapping;
  field: ContentCustomRelationFieldMapping;
  targetEntity: ContentEntityMapping | undefined;
}): ContentCompiledCustomRelationFieldInstruction | null => {
  const relation = field.relation;
  const storagePrimitive = resolveRelationStoragePrimitive(relation);
  const multiple = relation.multiple;

  if (!storagePrimitive) {
    return null;
  }

  const relationRequiresSelfTarget =
    field.kind === "self_reference_single" || field.kind === "self_reference_multi";
  const relationRequiresMultiple =
    field.kind === "multi_relation" ||
    field.kind === "self_reference_multi" ||
    field.kind === "media_relation_multi";
  const relationForbidsMultiple =
    field.kind === "single_relation" ||
    field.kind === "self_reference_single" ||
    field.kind === "media_relation_single";
  const relationRequiresMediaTarget =
    field.kind === "media_relation_single" || field.kind === "media_relation_multi";
  const relationRequiresFileTarget =
    field.kind === "file_relation_single" || field.kind === "file_relation_multi";
  const hasKindMismatch =
    (field.kind === "value_match_relation" && relation.strategy !== "value_match_relation") ||
    (field.kind !== "value_match_relation" && relation.strategy === "value_match_relation") ||
    (relationRequiresSelfTarget && relation.targetEntity !== "posts") ||
    (relationRequiresMediaTarget && relation.targetEntity !== "media") ||
    (relationRequiresFileTarget && relation.targetEntity !== "files") ||
    (relationRequiresMultiple && !relation.multiple) ||
    (relationForbidsMultiple && relation.multiple);
  const editabilityState = hasKindMismatch
    ? "unsupported"
    : resolveRelationEditabilityState({
        entity,
        multiple,
        relation,
        storagePrimitive,
      });

  return {
    discriminatorColumn: relation.discriminatorColumn ?? null,
    discriminatorValue: relation.discriminatorValue ?? null,
    editabilityState,
    fieldKey: field.fieldKey,
    junctionSourceColumn: relation.junctionSourceColumn ?? null,
    junctionTable: relation.junctionTable ?? null,
    junctionTargetColumn: relation.junctionTargetColumn ?? null,
    kind: field.kind,
    label: field.label,
    multiple,
    relationMode: resolveRelationMode({ multiple, relation }),
    semanticRole: field.relation.semanticRole ?? "customRelation",
    sourceColumn: relation.sourceColumn ?? null,
    sourceEntity: "posts",
    sourceTable: entity.source.table,
    storagePrimitive,
    targetColumn: relation.targetColumn ?? null,
    targetEntity: relation.targetEntity,
    targetTable: relation.targetTable ?? targetEntity?.source.table ?? null,
    valueColumn: relation.valueColumn ?? null,
  };
};
