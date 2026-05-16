import type { ContentProjectMapping } from "@/lib/content-runtime/mapping";
import { getContentCustomFieldKey } from "@/lib/content-runtime/mapping";
import { isContentFieldNonWritableState } from "@/lib/content-runtime/field-contract";

import type { ContentCompiledAdapterMapping } from "../compiler";
import type { ContentAdapterFieldSpec } from "../contracts";
import {
  isMultiValueFieldKind,
  resolveCustomFieldContentFormat,
  resolveCustomFieldUiControl,
  resolveRedirectMetadataSupport,
  resolveRelationSearchMode,
  resolveRelationUiControl,
  resolveUiControlForValueKind,
} from "../field-ui-controls";
import { sidebarRelationFieldDefinitions } from "../sidebar-field-definitions";
import { resolveCustomFieldAllowedValues } from "./custom-field-allowed-values";
import { resolveContentAdapterPatchMode } from "./json-array-patch-helpers";

const isReadOnlyFieldSpec = (editabilityState: ContentAdapterFieldSpec["editabilityState"]) =>
  isContentFieldNonWritableState(editabilityState);

export const buildContentAdapterFieldSpecs = ({
  compiled,
  mapping,
}: {
  compiled: ContentCompiledAdapterMapping;
  mapping: ContentProjectMapping;
}): ContentAdapterFieldSpec[] => {
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
  const fieldSpecsByKey = new Map<ContentAdapterFieldSpec["fieldKey"], ContentAdapterFieldSpec>();
  const setFieldSpec = (fieldSpec: ContentAdapterFieldSpec) => {
    if (!fieldSpecsByKey.has(fieldSpec.fieldKey)) {
      fieldSpecsByKey.set(fieldSpec.fieldKey, fieldSpec);
    }
  };

  for (const fieldInstruction of Object.values(compiled.scalarFields)) {
    if (!fieldInstruction) {
      continue;
    }

    if (fieldInstruction.fieldKey === "publishedAt" && compiled.workflowFields.publishedAt) {
      continue;
    }

    setFieldSpec({
      allowedValues: null,
      contentFormat: null,
      editabilityState: fieldInstruction.editabilityState,
      fieldKey: fieldInstruction.fieldKey,
      isCustomField: false,
      label: fieldInstruction.label,
      multiple: isMultiValueFieldKind(fieldInstruction.valueKind),
      nullable: !fieldInstruction.required,
      patchMode: resolveContentAdapterPatchMode(fieldInstruction),
      readOnly: isReadOnlyFieldSpec(fieldInstruction.editabilityState),
      redirectMetadataSupport: resolveRedirectMetadataSupport(fieldInstruction),
      relationMode: "none",
      required: fieldInstruction.required,
      searchMode: "none",
      semanticRole: fieldInstruction.semanticRole,
      storagePrimitive: fieldInstruction.storagePrimitive,
      uiControl: fieldInstruction.uiControl,
      valueKind: fieldInstruction.valueKind,
      visible: fieldInstruction.visible,
    });
  }

  for (const fieldInstruction of Object.values(compiled.structuredFields)) {
    if (!fieldInstruction) {
      continue;
    }

    const mappedEditorField = posts.editorFields.find((editorField) => editorField.id === fieldInstruction.fieldKey);
    const contentFormat =
      mappedEditorField?.kind === "markdown"
        ? "markdown"
        : mappedEditorField?.kind === "json"
          ? "json"
          : mappedEditorField?.kind === "plain_text"
            ? "plain_text"
            : "html";

    setFieldSpec({
      allowedValues: null,
      contentFormat,
      editabilityState: fieldInstruction.editabilityState,
      fieldKey: fieldInstruction.fieldKey,
      isCustomField: false,
      label: fieldInstruction.label,
      multiple: false,
      nullable: !fieldInstruction.required,
      patchMode: resolveContentAdapterPatchMode(fieldInstruction),
      readOnly: isReadOnlyFieldSpec(fieldInstruction.editabilityState),
      relationMode: "none",
      required: fieldInstruction.required,
      searchMode: "none",
      semanticRole: fieldInstruction.semanticRole,
      storagePrimitive: fieldInstruction.storagePrimitive,
      uiControl: fieldInstruction.uiControl,
      valueKind: fieldInstruction.valueKind,
      visible: fieldInstruction.visible,
    });
  }

  for (const [fieldKey, relationInstruction] of Object.entries(compiled.relationFields)) {
    const normalizedFieldKey = fieldKey as keyof ContentCompiledAdapterMapping["relationFields"];
    const sidebarDefinition = sidebarRelationFieldDefinitions[normalizedFieldKey];

    if (!relationInstruction) {
      continue;
    }

    setFieldSpec({
      allowedValues: null,
      contentFormat: null,
      editabilityState: relationInstruction.editabilityState,
      fieldKey: relationInstruction.fieldKey,
      isCustomField: false,
      label: sidebarDefinition?.label ?? relationInstruction.fieldKey,
      multiple: relationInstruction.multiple,
      nullable: true,
      patchMode: resolveContentAdapterPatchMode(relationInstruction),
      readOnly: isReadOnlyFieldSpec(relationInstruction.editabilityState),
      relationMode: relationInstruction.relationMode,
      relationTargetEntity: relationInstruction.targetEntity,
      required: false,
      searchMode: resolveRelationSearchMode(relationInstruction),
      semanticRole: relationInstruction.semanticRole,
      storagePrimitive: relationInstruction.storagePrimitive,
      uiControl: resolveRelationUiControl(relationInstruction),
      valueKind: "relation_id_or_key",
      visible: true,
    });
  }

  for (const [fieldKey, workflowInstruction] of Object.entries(compiled.workflowFields)) {
    if (!workflowInstruction) {
      continue;
    }

    const label = fieldKey === "status" ? "Status" : fieldKey === "publishedAt" ? "Published At" : fieldKey;
    setFieldSpec({
      allowedValues: null,
      contentFormat: null,
      editabilityState: workflowInstruction.editabilityState,
      fieldKey: workflowInstruction.fieldKey,
      isCustomField: false,
      label,
      multiple: false,
      nullable: true,
      patchMode: resolveContentAdapterPatchMode(workflowInstruction),
      readOnly: isReadOnlyFieldSpec(workflowInstruction.editabilityState),
      relationMode: "none",
      required: false,
      searchMode: "none",
      semanticRole: workflowInstruction.semanticRole,
      storagePrimitive: workflowInstruction.storagePrimitive,
      uiControl: resolveUiControlForValueKind(workflowInstruction.valueKind),
      valueKind: workflowInstruction.valueKind,
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

    setFieldSpec({
      allowedValues: resolvedAllowedValues,
      contentFormat: resolvedContentFormat,
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
      semanticRole: fieldInstruction.semanticRole,
      storagePrimitive: fieldInstruction.storagePrimitive,
      uiControl: resolvedUiControl,
      valueKind: fieldInstruction.valueKind,
      visible: true,
    });
  }

  for (const fieldInstruction of compiled.customRelationFields) {
    const customField = enabledCustomRelationFields.get(fieldInstruction.fieldKey);

    setFieldSpec({
      allowedValues: null,
      contentFormat: null,
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
      semanticRole: fieldInstruction.semanticRole,
      storagePrimitive: fieldInstruction.storagePrimitive,
      uiControl: resolveRelationUiControl(fieldInstruction),
      valueKind: "relation_id_or_key",
      visible: true,
    });
  }

  return Array.from(fieldSpecsByKey.values());
};
