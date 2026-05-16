import type {
  ContentCustomRelationFieldMapping,
  ContentEntityMapping,
  ContentMappedField,
  ContentMappingEntityKey,
  ContentProjectMapping,
  ContentRelationMapping,
  ContentScalarFieldRelationSourceMapping,
} from "@/lib/content-runtime/mapping";
import type { ContentFieldSemanticRole } from "@/lib/content-runtime/field-contract";

import type {
  ContentAdapterEditabilityState,
  ContentAdapterRelationMode,
  ContentAdapterStoragePrimitive,
  ContentAdapterUiControl,
  ContentAdapterValueKind,
} from "./contracts";
import {
  resolveContentCompiledScalarUiControl,
  resolveContentCompiledScalarValueKind,
} from "./compiler-field-shape";
import { compileContentCompiledCustomScalarField } from "./compiler-custom-scalar-fields";
import {
  compileContentCompiledCustomRelationField,
  compileContentCompiledRelationField,
  contentCompiledRelationFieldKeyMap,
} from "./compiler-relation-fields";
import { compileContentCompiledWorkflowFields } from "./compiler-workflow-fields";
import {
  resolveContentCompiledScalarEditabilityState,
  resolveContentCompiledScalarRelationSource,
  resolveContentCompiledScalarStoragePrimitive,
  resolveContentCompiledStructuredFieldEditabilityState,
} from "./compiler-storage-contract";

export type ContentCompiledScalarFieldKey =
  | "title"
  | "slug"
  | "excerpt"
  | "redirects"
  | "featuredImage"
  | "seoTitle"
  | "seoDescription"
  | "focusKeyword"
  | "createdAt"
  | "publishedAt"
  | "updatedAt";

export type ContentCompiledStructuredFieldKey = "content" | "redirects";
export type ContentCompiledRelationFieldKey = "author" | "categories" | "tags" | "parentPage";
export type ContentCompiledWorkflowFieldKey = "status" | "publishedAt";

export type ContentCompiledEntitySource = {
  kind: ContentProjectMapping["mappingConfig"]["entities"][ContentMappingEntityKey]["source"]["kind"];
  primaryKey: string | null;
  schema: string | null;
  table: string | null;
};

export type ContentCompiledScalarFieldRelationSourceInstruction = {
  junctionSourceColumn: string | null;
  junctionTable: string | null;
  sourceColumn: string | null;
  strategy: ContentScalarFieldRelationSourceMapping["strategy"];
  targetColumn: string | null;
  targetTable: string | null;
  valueColumn: string | null;
};

export type ContentCompiledScalarFieldInstruction = {
  editabilityState: ContentAdapterEditabilityState;
  fieldKey: ContentCompiledScalarFieldKey;
  label: string;
  required: boolean;
  semanticRole: ContentFieldSemanticRole;
  sourceArrayIndex: number | null;
  sourceColumn: string | null;
  sourceEntity: ContentMappingEntityKey;
  sourcePath: string | null;
  sourceRelation: ContentCompiledScalarFieldRelationSourceInstruction | null;
  sourceTable: string | null;
  storagePrimitive: ContentAdapterStoragePrimitive;
  uiControl: ContentAdapterUiControl;
  valueKind: ContentAdapterValueKind;
  visible: boolean;
};

export type ContentCompiledStructuredFieldInstruction = {
  editabilityState: ContentAdapterEditabilityState;
  fieldKey: string;
  label: string;
  required: boolean;
  semanticRole: ContentFieldSemanticRole;
  sourceArrayIndex: number | null;
  sourceColumn: string | null;
  sourceEntity: ContentMappingEntityKey;
  sourcePath: string | null;
  sourceRelation: ContentCompiledScalarFieldRelationSourceInstruction | null;
  sourceTable: string | null;
  storagePrimitive: ContentAdapterStoragePrimitive;
  uiControl: ContentAdapterUiControl;
  valueKind: ContentAdapterValueKind;
  visible: boolean;
};

export type ContentCompiledRelationFieldInstruction = {
  discriminatorColumn: string | null;
  discriminatorValue: string | null;
  editabilityState: ContentAdapterEditabilityState;
  fieldKey: ContentCompiledRelationFieldKey;
  junctionSourceColumn: string | null;
  junctionTable: string | null;
  junctionTargetColumn: string | null;
  multiple: boolean;
  relationMode: ContentAdapterRelationMode;
  semanticRole: ContentFieldSemanticRole;
  sourceColumn: string | null;
  sourceEntity: "posts";
  sourceTable: string | null;
  storagePrimitive: ContentAdapterStoragePrimitive;
  targetColumn: string | null;
  targetEntity: ContentMappingEntityKey | null;
  targetTable: string | null;
  valueColumn: string | null;
};

export type ContentCompiledWorkflowFieldInstruction = {
  editabilityState: ContentAdapterEditabilityState;
  fieldKey: ContentCompiledWorkflowFieldKey;
  semanticRole: ContentFieldSemanticRole;
  sourceColumn: string | null;
  sourceEntity: "posts";
  sourceTable: string | null;
  storagePrimitive: ContentAdapterStoragePrimitive;
  valueKind: ContentAdapterValueKind;
};

export type ContentCompiledCustomScalarFieldInstruction = {
  dataType: string;
  editabilityState: ContentAdapterEditabilityState;
  fieldKey: string;
  label: string;
  semanticRole: ContentFieldSemanticRole;
  sourceColumn: string | null;
  sourceEntity: "posts";
  sourceTable: string | null;
  storagePrimitive: ContentAdapterStoragePrimitive;
  valueKind: ContentAdapterValueKind;
};

export type ContentCompiledCustomRelationFieldInstruction = {
  discriminatorColumn: string | null;
  discriminatorValue: string | null;
  editabilityState: ContentAdapterEditabilityState;
  fieldKey: string;
  junctionSourceColumn: string | null;
  junctionTable: string | null;
  junctionTargetColumn: string | null;
  kind: ContentCustomRelationFieldMapping["kind"];
  label: string;
  multiple: boolean;
  relationMode: ContentAdapterRelationMode;
  semanticRole: ContentFieldSemanticRole;
  sourceColumn: string | null;
  sourceEntity: "posts";
  sourceTable: string | null;
  storagePrimitive: ContentAdapterStoragePrimitive;
  targetColumn: string | null;
  targetEntity: ContentMappingEntityKey | null;
  targetTable: string | null;
  valueColumn: string | null;
};

export type ContentCompiledAdapterMapping = {
  bindingMode: ContentProjectMapping["bindingMode"];
  entitySources: Record<ContentMappingEntityKey, ContentCompiledEntitySource>;
  customRelationFields: ContentCompiledCustomRelationFieldInstruction[];
  customScalarFields: ContentCompiledCustomScalarFieldInstruction[];
  relationFields: Partial<Record<ContentCompiledRelationFieldKey, ContentCompiledRelationFieldInstruction>>;
  scalarFields: Partial<Record<ContentCompiledScalarFieldKey, ContentCompiledScalarFieldInstruction>>;
  structuredFields: Record<string, ContentCompiledStructuredFieldInstruction>;
  workflowFields: Partial<Record<ContentCompiledWorkflowFieldKey, ContentCompiledWorkflowFieldInstruction>>;
};

const scalarFieldMappings: Array<{
  compiledKey: ContentCompiledScalarFieldKey;
  mappingKey: keyof ContentProjectMapping["mappingConfig"]["entities"]["posts"]["fields"];
}> = [
  { compiledKey: "title", mappingKey: "title" },
  { compiledKey: "slug", mappingKey: "slug" },
  { compiledKey: "excerpt", mappingKey: "excerpt" },
  { compiledKey: "redirects", mappingKey: "redirects" },
  { compiledKey: "featuredImage", mappingKey: "featuredImageUrl" },
  { compiledKey: "seoTitle", mappingKey: "seoTitle" },
  { compiledKey: "seoDescription", mappingKey: "seoDescription" },
  { compiledKey: "focusKeyword", mappingKey: "focusKeyword" },
  { compiledKey: "createdAt", mappingKey: "createdAt" },
  { compiledKey: "publishedAt", mappingKey: "publishedAt" },
  { compiledKey: "updatedAt", mappingKey: "updatedAt" },
];

const scalarFieldSemanticRoles: Record<ContentCompiledScalarFieldKey, ContentFieldSemanticRole> = {
  createdAt: "createdAt",
  excerpt: "excerpt",
  featuredImage: "featuredImage",
  focusKeyword: "focusKeyword",
  publishedAt: "publishedAt",
  redirects: "redirects",
  seoDescription: "seoDescription",
  seoTitle: "seoTitle",
  slug: "slug",
  title: "title",
  updatedAt: "updatedAt",
};

const compileScalarField = ({
  compiledKey,
  entity,
  field,
}: {
  compiledKey: ContentCompiledScalarFieldKey;
  entity: ContentEntityMapping;
  field: ContentMappedField;
}): ContentCompiledScalarFieldInstruction | null => {
  const storagePrimitive = resolveContentCompiledScalarStoragePrimitive({ entity, field });

  if (!storagePrimitive) {
    return null;
  }

  const editabilityState = resolveContentCompiledScalarEditabilityState({
    compiledKey,
    entity,
    field,
    storagePrimitive,
  });
  const valueKind = resolveContentCompiledScalarValueKind({
    compiledKey,
    field,
    storagePrimitive,
  });

  return {
    editabilityState,
    fieldKey: compiledKey,
    label: field.label,
    required: field.required,
    semanticRole: field.semanticRole ?? scalarFieldSemanticRoles[compiledKey],
    sourceArrayIndex: field.sourceRelation ? null : field.arrayIndex ?? null,
    sourceColumn: field.sourceRelation?.sourceColumn ?? field.column,
    sourceEntity: "posts",
    sourcePath: field.sourceRelation ? null : field.path,
    sourceRelation: resolveContentCompiledScalarRelationSource(field),
    sourceTable: entity.source.table,
    storagePrimitive,
    uiControl: resolveContentCompiledScalarUiControl({
      compiledKey,
      editabilityState,
      field,
      storagePrimitive,
      valueKind,
    }),
    valueKind,
    visible: field.visible,
  };
};

export const compileContentProjectMappingToAdapterInstructions = (
  mapping: ContentProjectMapping,
): ContentCompiledAdapterMapping => {
  const posts = mapping.mappingConfig.entities.posts;

  const scalarFields = Object.fromEntries(
    scalarFieldMappings
      .map(({ compiledKey, mappingKey }) => {
        const field = posts.fields[mappingKey];
        return [compiledKey, field ? compileScalarField({ compiledKey, entity: posts, field }) : null];
      })
      .filter((entry): entry is [ContentCompiledScalarFieldKey, ContentCompiledScalarFieldInstruction] =>
        Boolean(entry[1]),
      ),
  ) as ContentCompiledAdapterMapping["scalarFields"];

  const structuredFields = Object.fromEntries(
    (posts.editorFields ?? [])
      .filter((field) => field.visible && (field.column || field.sourceRelation))
      .map(
        (field): [string, ContentCompiledStructuredFieldInstruction] => [
          field.id,
          (() => {
            const syntheticField: ContentMappedField = {
              arrayIndex: field.arrayIndex ?? null,
              column: field.column,
              kind: field.kind,
              label: field.label,
              path: field.path,
              required: field.required,
              semanticRole: field.semanticRole,
              sourceRelation: field.sourceRelation,
              storagePrimitive: field.storagePrimitive,
              visible: field.visible,
            };
            const storagePrimitive = resolveContentCompiledScalarStoragePrimitive({
              entity: posts,
              field: syntheticField,
            }) ?? "direct_column";

            return {
              editabilityState: resolveContentCompiledStructuredFieldEditabilityState({
                entity: posts,
                field: syntheticField,
                storagePrimitive,
              }),
              fieldKey: field.id,
              label: field.label,
              required: field.required,
              semanticRole: field.semanticRole ?? "content",
              sourceArrayIndex: field.sourceRelation ? null : field.arrayIndex ?? null,
              sourceColumn: field.sourceRelation?.sourceColumn ?? field.column,
              sourceEntity: "posts",
              sourcePath: field.sourceRelation ? null : field.path,
              sourceRelation: resolveContentCompiledScalarRelationSource(syntheticField),
              sourceTable: posts.source.table,
              storagePrimitive,
              uiControl: "content_editor",
              valueKind: "content",
              visible: field.visible,
            };
          })(),
        ],
      ),
  );

  const relationFields = Object.fromEntries(
    Object.entries(posts.relations)
      .map(([relationName, relation]) => {
        const normalizedRelation = relation as ContentRelationMapping | undefined;
        const compiledKey = contentCompiledRelationFieldKeyMap[
          relationName as keyof ContentProjectMapping["mappingConfig"]["entities"]["posts"]["relations"]
        ];

        if (!compiledKey || !normalizedRelation || normalizedRelation.status === "unmapped") {
          return null;
        }

        return [
          compiledKey,
          compileContentCompiledRelationField({
            entity: posts,
            relation: normalizedRelation,
            relationKey: compiledKey,
            targetEntity: normalizedRelation.targetEntity
              ? mapping.mappingConfig.entities[normalizedRelation.targetEntity]
              : undefined,
          }),
        ] as const;
      })
      .filter(
        (
          entry,
        ): entry is readonly [ContentCompiledRelationFieldKey, ContentCompiledRelationFieldInstruction] =>
          Boolean(entry?.[1]),
      ),
  ) as ContentCompiledAdapterMapping["relationFields"];

  return {
    bindingMode: mapping.bindingMode,
    customRelationFields: (posts.customRelationFields ?? [])
      .filter((field) => field.enabled)
      .map((field) =>
        compileContentCompiledCustomRelationField({
          entity: posts,
          field,
          targetEntity: field.relation.targetEntity
            ? mapping.mappingConfig.entities[field.relation.targetEntity]
            : undefined,
        }),
      )
      .filter(
        (
          field,
        ): field is ContentCompiledCustomRelationFieldInstruction => Boolean(field),
      ),
    customScalarFields: (posts.customFields ?? [])
      .filter((field) => field.enabled)
      .map((field) => compileContentCompiledCustomScalarField({ entity: posts, field })),
    entitySources: {
      authors: { ...mapping.mappingConfig.entities.authors.source },
      categories: { ...mapping.mappingConfig.entities.categories.source },
      files: { ...mapping.mappingConfig.entities.files.source },
      media: { ...mapping.mappingConfig.entities.media.source },
      posts: { ...posts.source },
      tags: { ...mapping.mappingConfig.entities.tags.source },
    },
    relationFields,
    scalarFields,
    structuredFields,
    workflowFields: compileContentCompiledWorkflowFields(posts),
  };
};
