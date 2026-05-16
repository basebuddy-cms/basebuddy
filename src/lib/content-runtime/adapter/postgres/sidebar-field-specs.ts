import type { ContentProjectMapping } from "@/lib/content-runtime/mapping";
import { getContentCustomFieldKey } from "@/lib/content-runtime/mapping";
import { isContentFieldNonWritableState } from "@/lib/content-runtime/field-contract";

import type { ContentCompiledAdapterMapping } from "../compiler";
import type { ContentAdapterSidebarFieldSpec } from "../contracts";
import {
  isMultiValueFieldKind,
  resolveCustomFieldContentFormat,
  resolveCustomFieldUiControl,
  resolveRedirectMetadataSupport,
  resolveRelationSearchMode,
  resolveRelationUiControl,
} from "../field-ui-controls";
import {
  sidebarRelationFieldDefinitions,
  sidebarScalarFieldDefinitions,
} from "../sidebar-field-definitions";
import { resolveCustomFieldAllowedValues } from "./custom-field-allowed-values";
import { resolveContentAdapterPatchMode } from "./json-array-patch-helpers";

const isReadOnlyFieldSpec = (editabilityState: ContentAdapterSidebarFieldSpec["editabilityState"]) =>
  isContentFieldNonWritableState(editabilityState);

export const buildContentAdapterSidebarFieldSpecs = ({
  compiled,
  mapping,
}: {
  compiled: ContentCompiledAdapterMapping;
  mapping: ContentProjectMapping;
}): ContentAdapterSidebarFieldSpec[] => {
  const posts = mapping.mappingConfig.entities.posts;
  const enabledCustomFields = new Map(
    (posts.customFields ?? [])
      .filter((field) => field.enabled)
      .map((field) => [getContentCustomFieldKey(field), field] as const),
  );
  const enabledCustomRelationFields = new Map(
    (posts.customRelationFields ?? [])
      .filter((field) => field.enabled)
      .map((field) => [field.fieldKey, field] as const),
  );
  const sidebarFieldSpecsById = new Map<
    ContentAdapterSidebarFieldSpec["sidebarFieldId"],
    ContentAdapterSidebarFieldSpec
  >();
  const setSidebarFieldSpec = (fieldSpec: ContentAdapterSidebarFieldSpec) => {
    if (!sidebarFieldSpecsById.has(fieldSpec.sidebarFieldId)) {
      sidebarFieldSpecsById.set(fieldSpec.sidebarFieldId, fieldSpec);
    }
  };

  for (const [fieldKey, fieldInstruction] of Object.entries(compiled.scalarFields)) {
    const normalizedFieldKey = fieldKey as keyof ContentCompiledAdapterMapping["scalarFields"];
    const sidebarDefinition = sidebarScalarFieldDefinitions[normalizedFieldKey];

    if (!fieldInstruction || !sidebarDefinition) {
      continue;
    }

    if (fieldInstruction.fieldKey === "publishedAt" && compiled.workflowFields.publishedAt) {
      continue;
    }

    setSidebarFieldSpec({
      allowedValues: null,
      contentFormat: null,
      defaultParentId: sidebarDefinition.defaultParentId,
      description: sidebarDefinition.description,
      editabilityState: fieldInstruction.editabilityState,
      fieldKey: fieldInstruction.fieldKey,
      isCustomField: false,
      label: sidebarDefinition.label,
      multiple: isMultiValueFieldKind(fieldInstruction.valueKind),
      nullable: !fieldInstruction.required,
      patchMode: resolveContentAdapterPatchMode(fieldInstruction),
      readOnly: isReadOnlyFieldSpec(fieldInstruction.editabilityState),
      redirectMetadataSupport: resolveRedirectMetadataSupport(fieldInstruction),
      relationMode: "none",
      required: fieldInstruction.required,
      searchMode: "none",
      sidebarFieldId: sidebarDefinition.sidebarFieldId,
      semanticRole: fieldInstruction.semanticRole,
      storagePrimitive: fieldInstruction.storagePrimitive,
      uiControl: fieldInstruction.uiControl,
      valueKind: fieldInstruction.valueKind,
      visible: fieldInstruction.visible,
    });
  }

  if (compiled.workflowFields.publishedAt) {
    const workflowFieldInstruction = compiled.workflowFields.publishedAt;
    const sidebarDefinition = sidebarScalarFieldDefinitions.publishedAt;

    if (workflowFieldInstruction && sidebarDefinition) {
      setSidebarFieldSpec({
        allowedValues: null,
        contentFormat: null,
        defaultParentId: sidebarDefinition.defaultParentId,
        description: sidebarDefinition.description,
        editabilityState: workflowFieldInstruction.editabilityState,
        fieldKey: workflowFieldInstruction.fieldKey,
        isCustomField: false,
        label: sidebarDefinition.label,
        multiple: false,
        nullable: true,
        patchMode: resolveContentAdapterPatchMode(workflowFieldInstruction),
        readOnly: isReadOnlyFieldSpec(workflowFieldInstruction.editabilityState),
        relationMode: "none",
        required: false,
        searchMode: "none",
        sidebarFieldId: sidebarDefinition.sidebarFieldId,
        semanticRole: workflowFieldInstruction.semanticRole,
        storagePrimitive: workflowFieldInstruction.storagePrimitive,
        uiControl: "datetime_picker",
        valueKind: workflowFieldInstruction.valueKind,
        visible: true,
      });
    }
  }

  for (const [fieldKey, relationInstruction] of Object.entries(compiled.relationFields)) {
    const normalizedFieldKey = fieldKey as keyof ContentCompiledAdapterMapping["relationFields"];
    const sidebarDefinition = sidebarRelationFieldDefinitions[normalizedFieldKey];

    if (!relationInstruction || !sidebarDefinition) {
      continue;
    }

    setSidebarFieldSpec({
      allowedValues: null,
      contentFormat: null,
      defaultParentId: sidebarDefinition.defaultParentId,
      description: sidebarDefinition.description,
      editabilityState: relationInstruction.editabilityState,
      fieldKey: relationInstruction.fieldKey,
      isCustomField: false,
      label: sidebarDefinition.label,
      multiple: relationInstruction.multiple,
      nullable: true,
      patchMode: resolveContentAdapterPatchMode(relationInstruction),
      readOnly: isReadOnlyFieldSpec(relationInstruction.editabilityState),
      relationMode: relationInstruction.relationMode,
      relationTargetEntity: relationInstruction.targetEntity,
      required: false,
      searchMode: resolveRelationSearchMode(relationInstruction),
      sidebarFieldId: sidebarDefinition.sidebarFieldId,
      semanticRole: relationInstruction.semanticRole,
      storagePrimitive: relationInstruction.storagePrimitive,
      uiControl: resolveRelationUiControl(relationInstruction),
      valueKind: "relation_id_or_key",
      visible: true,
    });
  }

  for (const fieldInstruction of compiled.customScalarFields) {
    const customField = enabledCustomFields.get(fieldInstruction.fieldKey);
    const resolvedAllowedValues = resolveCustomFieldAllowedValues(customField);
    const isMultiValueCustomField = customField?.kind === "array";
    const resolvedUiControl = resolveCustomFieldUiControl({
      dataType: customField?.dataType,
      valueKind: fieldInstruction.valueKind,
    });
    const resolvedContentFormat = resolveCustomFieldContentFormat({
      dataType: customField?.dataType,
      uiControl: resolvedUiControl,
      valueKind: fieldInstruction.valueKind,
    });

    setSidebarFieldSpec({
      allowedValues: resolvedAllowedValues,
      contentFormat: resolvedContentFormat,
      defaultParentId: "custom-fields",
      description: `Edit the mapped "${fieldInstruction.label}" field.`,
      editabilityState: fieldInstruction.editabilityState,
      fieldKey: fieldInstruction.fieldKey,
      isCustomField: true,
      label: fieldInstruction.label,
      multiple: isMultiValueCustomField,
      nullable: customField?.isNullable ?? true,
      patchMode: resolveContentAdapterPatchMode(fieldInstruction),
      readOnly: isReadOnlyFieldSpec(fieldInstruction.editabilityState),
      relationMode: "none",
      required: !(customField?.isNullable ?? true),
      searchMode: "none",
      sidebarFieldId: `custom_field:${fieldInstruction.fieldKey}`,
      semanticRole: fieldInstruction.semanticRole,
      storagePrimitive: fieldInstruction.storagePrimitive,
      uiControl: resolvedUiControl,
      valueKind: fieldInstruction.valueKind,
      visible: true,
    });
  }

  for (const fieldInstruction of compiled.customRelationFields) {
    const customField = enabledCustomRelationFields.get(fieldInstruction.fieldKey);

    setSidebarFieldSpec({
      allowedValues: null,
      contentFormat: null,
      defaultParentId: "custom-fields",
      description: `Edit the mapped "${fieldInstruction.label}" field.`,
      editabilityState: fieldInstruction.editabilityState,
      fieldKey: fieldInstruction.fieldKey,
      isCustomField: true,
      label: fieldInstruction.label,
      multiple: fieldInstruction.multiple,
      nullable: customField?.isNullable ?? true,
      patchMode: resolveContentAdapterPatchMode(fieldInstruction),
      readOnly: isReadOnlyFieldSpec(fieldInstruction.editabilityState),
      relationMode: fieldInstruction.relationMode,
      relationTargetEntity: fieldInstruction.targetEntity,
      required: !(customField?.isNullable ?? true),
      searchMode: resolveRelationSearchMode(fieldInstruction),
      sidebarFieldId: `custom_field:${fieldInstruction.fieldKey}`,
      semanticRole: fieldInstruction.semanticRole,
      storagePrimitive: fieldInstruction.storagePrimitive,
      uiControl: resolveRelationUiControl(fieldInstruction),
      valueKind: "relation_id_or_key",
      visible: true,
    });
  }

  return Array.from(sidebarFieldSpecsById.values());
};
