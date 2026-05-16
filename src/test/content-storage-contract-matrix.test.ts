import { describe, expect, it } from "vitest";

import { createContentRuntimeAdapter } from "@/lib/content-runtime/adapter/factory";
import type {
  ContentCustomFieldMapping,
  ContentCustomRelationFieldMapping,
  ContentMappingRelationStrategy,
} from "@/lib/content-runtime/mapping";
import { normalizeContentProjectMapping } from "@/lib/content-runtime/mapping";

const createMatrixMapping = ({
  customFields = [],
  customRelationFields = [],
}: {
  customFields?: ContentCustomFieldMapping[];
  customRelationFields?: ContentCustomRelationFieldMapping[];
} = {}) =>
  normalizeContentProjectMapping({
    bindingId: "binding-storage-matrix",
    bindingMode: "mapped_content",
    bindingStatus: "ready",
    mappingConfig: {
      entities: {
        authors: {
          source: { kind: "table", primaryKey: "id", schema: "public", table: "authors" },
          status: "mapped",
        },
        categories: {
          source: { kind: "table", primaryKey: "id", schema: "public", table: "categories" },
          status: "mapped",
        },
        files: {
          source: { kind: "table", primaryKey: "id", schema: "public", table: "files" },
          status: "mapped",
        },
        media: {
          source: { kind: "table", primaryKey: "id", schema: "public", table: "media" },
          status: "mapped",
        },
        posts: {
          customFields,
          customRelationFields,
          editorFields: [],
          fields: {
            title: { column: "title", kind: "text", label: "Title", required: true, visible: true },
          },
          relations: {},
          source: { kind: "table", primaryKey: "id", schema: "public", table: "posts" },
          status: "mapped",
          workflow: null,
        },
        tags: {
          source: { kind: "table", primaryKey: "id", schema: "public", table: "tags" },
          status: "mapped",
        },
      },
      mediaStorage: {
        bucketName: null,
        endpoint: null,
        provider: "none",
        publicUrlBase: null,
        region: null,
      },
      version: 1,
    },
    revisionId: "revision-storage-matrix",
    revisionVersion: 1,
  });

const createCustomField = ({
  allowedValues = null,
  arrayIndex,
  column,
  dataType,
  fieldKey,
  kind,
  path,
  sourceRelation,
  storagePrimitive,
}: Pick<ContentCustomFieldMapping, "column" | "dataType" | "kind"> &
  Partial<
    Pick<
      ContentCustomFieldMapping,
      "allowedValues" | "arrayIndex" | "fieldKey" | "path" | "sourceRelation" | "storagePrimitive"
    >
  >): ContentCustomFieldMapping => ({
  allowedValues,
  arrayIndex,
  column,
  dataType,
  defaultValue: null,
  enabled: true,
  fieldKey: fieldKey ?? column,
  isNullable: true,
  kind,
  label: fieldKey ?? column,
  path,
  sampleValues: allowedValues ?? [],
  sourceRelation,
  storagePrimitive,
});

const createRelation = ({
  discriminatorColumn = null,
  discriminatorValue = null,
  fieldKey,
  kind,
  multiple,
  sourceColumn,
  strategy,
  targetEntity,
}: {
  discriminatorColumn?: string | null;
  discriminatorValue?: string | null;
  fieldKey: string;
  kind: ContentCustomRelationFieldMapping["kind"];
  multiple: boolean;
  sourceColumn: string | null;
  strategy: ContentMappingRelationStrategy;
  targetEntity: ContentCustomRelationFieldMapping["relation"]["targetEntity"];
}): ContentCustomRelationFieldMapping => ({
  enabled: true,
  fieldKey,
  isNullable: true,
  kind,
  label: fieldKey,
  relation: {
    discriminatorColumn,
    discriminatorValue,
    fieldMap: { title: "title", name: "name" },
    junctionSourceColumn:
      strategy === "join_row" ||
      strategy === "join_table" ||
      strategy === "polymorphic_join" ||
      strategy === "related_row_by_post_id" ||
      strategy === "derived_distinct"
        ? "post_id"
        : null,
    junctionTable:
      strategy === "join_row" ||
      strategy === "join_table" ||
      strategy === "polymorphic_join" ||
      strategy === "related_row_by_post_id" ||
      strategy === "derived_distinct"
        ? `post_${fieldKey}`
        : null,
    junctionTargetColumn:
      strategy === "join_table" || strategy === "polymorphic_join" || strategy === "derived_distinct"
        ? `${targetEntity ?? "target"}_id`
        : null,
    multiple,
    sourceColumn,
    status: "mapped",
    strategy,
    targetColumn: strategy === "value_match_relation" ? "slug" : "id",
    targetEntity,
    targetTable: null,
    valueColumn:
      strategy === "join_row" || strategy === "related_row_by_post_id"
        ? `${targetEntity ?? "target"}_id`
        : null,
  },
});

describe("content storage contract matrix", () => {
  it("renders supported scalar type families and scalar placements from the compiled storage contract", () => {
    const mapping = createMatrixMapping({
      customFields: [
        createCustomField({ column: "plain_title", dataType: "text", kind: "text" }),
        createCustomField({ column: "body_plain", dataType: "text", kind: "plain_text" }),
        createCustomField({ column: "word_count", dataType: "integer", kind: "number" }),
        createCustomField({ column: "sku_numeric_code", dataType: "numeric", kind: "number" }),
        createCustomField({ column: "is_featured", dataType: "boolean", kind: "boolean" }),
        createCustomField({
          allowedValues: ["draft", "published"],
          column: "audience",
          dataType: "USER-DEFINED",
          kind: "enum",
        }),
        createCustomField({ column: "publish_on", dataType: "date", kind: "date" }),
        createCustomField({ column: "event_at", dataType: "timestamp with time zone", kind: "datetime" }),
        createCustomField({ column: "metadata", dataType: "jsonb", kind: "json" }),
        createCustomField({ column: "aliases", dataType: "text[]", kind: "array" }),
        createCustomField({ column: "seo_payload", dataType: "jsonb", kind: "text", path: "seo.title" }),
        createCustomField({ arrayIndex: 0, column: "title_parts", dataType: "text[]", kind: "text" }),
        createCustomField({ column: "availability", dataType: "tstzrange", kind: "text" }),
        createCustomField({ column: "windows", dataType: "tstzmultirange", kind: "plain_text" }),
        createCustomField({
          column: "helper_title",
          dataType: "text",
          kind: "text",
          sourceRelation: {
            junctionSourceColumn: "post_id",
            junctionTable: "post_titles",
            sourceColumn: null,
            strategy: "join_row",
            targetColumn: null,
            targetTable: null,
            valueColumn: "title",
          },
        }),
        createCustomField({
          column: "manual_flag",
          dataType: "boolean",
          kind: "boolean",
          storagePrimitive: "boolean_mapping",
        }),
        createCustomField({
          allowedValues: ["draft", "published"],
          column: "manual_state",
          dataType: "text",
          kind: "enum",
          storagePrimitive: "enum_mapping",
        }),
        createCustomField({
          column: "generated_label",
          dataType: "text",
          kind: "text",
          storagePrimitive: "derived_read_only",
        }),
      ],
    });

    const fieldSpecs = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    }).getCapabilitySummary().fieldSpecs;

    expect(fieldSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "plain_title",
          patchMode: "replace",
          storagePrimitive: "direct_column",
          uiControl: "text_input",
          valueKind: "text_like",
        }),
        expect.objectContaining({
          fieldKey: "body_plain",
          uiControl: "textarea",
          valueKind: "long_text",
        }),
        expect.objectContaining({
          fieldKey: "word_count",
          uiControl: "number_input",
          valueKind: "number",
        }),
        expect.objectContaining({
          fieldKey: "sku_numeric_code",
          uiControl: "text_input",
          valueKind: "text_like",
        }),
        expect.objectContaining({
          fieldKey: "is_featured",
          uiControl: "toggle",
          valueKind: "boolean",
        }),
        expect.objectContaining({
          fieldKey: "audience",
          uiControl: "dropdown",
          valueKind: "enum",
        }),
        expect.objectContaining({
          fieldKey: "publish_on",
          uiControl: "date_picker",
          valueKind: "date",
        }),
        expect.objectContaining({
          fieldKey: "event_at",
          uiControl: "datetime_picker",
          valueKind: "datetime",
        }),
        expect.objectContaining({
          fieldKey: "metadata",
          uiControl: "structured_editor",
          valueKind: "json_object",
        }),
        expect.objectContaining({
          fieldKey: "aliases",
          multiple: true,
          storagePrimitive: "array_value",
          uiControl: "token_input",
          valueKind: "array_scalar",
        }),
        expect.objectContaining({
          fieldKey: "seo_payload",
          patchMode: "key_patch",
          storagePrimitive: "json_path",
        }),
        expect.objectContaining({
          fieldKey: "title_parts",
          patchMode: "index_patch",
          storagePrimitive: "array_item",
        }),
        expect.objectContaining({
          fieldKey: "availability",
          uiControl: "range_input",
        }),
        expect.objectContaining({
          fieldKey: "windows",
          uiControl: "multirange_editor",
        }),
        expect.objectContaining({
          fieldKey: "helper_title",
          patchMode: "link_replace",
          storagePrimitive: "join_row",
        }),
        expect.objectContaining({
          fieldKey: "manual_flag",
          storagePrimitive: "boolean_mapping",
          uiControl: "toggle",
        }),
        expect.objectContaining({
          fieldKey: "manual_state",
          storagePrimitive: "enum_mapping",
          uiControl: "dropdown",
        }),
        expect.objectContaining({
          fieldKey: "generated_label",
          patchMode: "no_write",
          readOnly: true,
          storagePrimitive: "derived_read_only",
        }),
      ]),
    );
  });

  it("degrades unsupported Postgres storage types to explicit read-only fields", () => {
    const unsupportedDataTypes = [
      "bytea",
      "bit",
      "bit varying",
      "point",
      "line",
      "lseg",
      "box",
      "path",
      "polygon",
      "circle",
      "inet",
      "cidr",
      "macaddr",
      "macaddr8",
      "tsvector",
      "tsquery",
      "oid",
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
      "xid",
      "xid8",
      "cid",
      "tid",
      "pg_lsn",
      "pg_snapshot",
      "txid_snapshot",
      "aclitem",
      "refcursor",
      "int2vector",
      "oidvector",
    ];
    const mapping = createMatrixMapping({
      customFields: unsupportedDataTypes.map((dataType, index) =>
        createCustomField({
          column: `unsupported_${index}`,
          dataType,
          fieldKey: dataType.replaceAll(/[^a-z0-9]+/gi, "_").toLowerCase(),
          kind: "text",
        }),
      ),
    });

    const fieldSpecs = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    }).getCapabilitySummary().fieldSpecs;

    for (const dataType of unsupportedDataTypes) {
      const fieldKey = dataType.replaceAll(/[^a-z0-9]+/gi, "_").toLowerCase();

      expect(fieldSpecs.find((fieldSpec) => fieldSpec.fieldKey === fieldKey)).toMatchObject({
        editabilityState: "unsupported",
        patchMode: "no_write",
        readOnly: true,
        uiControl: "read_only",
        valueKind: "binary_or_exotic",
      });
    }
  });

  it("renders supported relation placements from relation storage contracts", () => {
    const mapping = createMatrixMapping({
      customRelationFields: [
        createRelation({
          fieldKey: "sponsor_id",
          kind: "single_relation",
          multiple: false,
          sourceColumn: "sponsor_id",
          strategy: "foreign_key",
          targetEntity: "authors",
        }),
        createRelation({
          fieldKey: "helper_author_id",
          kind: "single_relation",
          multiple: false,
          sourceColumn: null,
          strategy: "related_row_by_post_id",
          targetEntity: "authors",
        }),
        createRelation({
          fieldKey: "primary_tag_id",
          kind: "single_relation",
          multiple: false,
          sourceColumn: null,
          strategy: "join_row",
          targetEntity: "tags",
        }),
        createRelation({
          fieldKey: "related_post_ids",
          kind: "self_reference_multi",
          multiple: true,
          sourceColumn: null,
          strategy: "join_table",
          targetEntity: "posts",
        }),
        createRelation({
          discriminatorColumn: "owner_type",
          discriminatorValue: "post",
          fieldKey: "asset_link_ids",
          kind: "media_relation_multi",
          multiple: true,
          sourceColumn: null,
          strategy: "polymorphic_join",
          targetEntity: "media",
        }),
        createRelation({
          fieldKey: "category_slugs",
          kind: "value_match_relation",
          multiple: true,
          sourceColumn: "category_slugs",
          strategy: "value_match_relation",
          targetEntity: "categories",
        }),
        createRelation({
          fieldKey: "tag_ids",
          kind: "multi_relation",
          multiple: true,
          sourceColumn: "tag_ids",
          strategy: "array",
          targetEntity: "tags",
        }),
        createRelation({
          fieldKey: "json_tag_ids",
          kind: "multi_relation",
          multiple: true,
          sourceColumn: "meta",
          strategy: "json_array",
          targetEntity: "tags",
        }),
      ],
    });

    const fieldSpecs = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    }).getCapabilitySummary().fieldSpecs;

    expect(fieldSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "sponsor_id",
          patchMode: "link_replace",
          relationMode: "managed_single",
          storagePrimitive: "foreign_key",
          uiControl: "single_select",
        }),
        expect.objectContaining({
          fieldKey: "helper_author_id",
          patchMode: "link_replace",
          relationMode: "managed_single",
          storagePrimitive: "related_row_by_post_id",
          uiControl: "single_select",
        }),
        expect.objectContaining({
          fieldKey: "primary_tag_id",
          patchMode: "link_replace",
          relationMode: "managed_single",
          storagePrimitive: "join_row",
          uiControl: "single_select",
        }),
        expect.objectContaining({
          fieldKey: "related_post_ids",
          patchMode: "link_replace",
          relationMode: "managed_multi",
          storagePrimitive: "join_table",
          uiControl: "multi_select",
        }),
        expect.objectContaining({
          fieldKey: "asset_link_ids",
          patchMode: "link_replace",
          relationMode: "managed_multi",
          storagePrimitive: "polymorphic_join",
          uiControl: "multi_select",
        }),
        expect.objectContaining({
          fieldKey: "category_slugs",
          patchMode: "link_replace",
          relationMode: "value_match_multi",
          storagePrimitive: "value_match_relation",
          uiControl: "multi_select",
        }),
        expect.objectContaining({
          fieldKey: "tag_ids",
          patchMode: "replace",
          relationMode: "managed_multi",
          storagePrimitive: "array_value",
          uiControl: "multi_select",
        }),
        expect.objectContaining({
          fieldKey: "json_tag_ids",
          patchMode: "key_patch",
          relationMode: "managed_multi",
          storagePrimitive: "json_path",
          uiControl: "multi_select",
        }),
      ]),
    );
  });

  it("renders unsafe relation placements as inert read-only fields", () => {
    const mapping = createMatrixMapping({
      customRelationFields: [
        createRelation({
          fieldKey: "inline_tag_id",
          kind: "single_relation",
          multiple: false,
          sourceColumn: "tag_name",
          strategy: "inline_fields",
          targetEntity: "tags",
        }),
        createRelation({
          fieldKey: "json_author",
          kind: "single_relation",
          multiple: false,
          sourceColumn: "meta",
          strategy: "json_object",
          targetEntity: "authors",
        }),
        createRelation({
          fieldKey: "derived_tag_ids",
          kind: "multi_relation",
          multiple: true,
          sourceColumn: null,
          strategy: "derived_distinct",
          targetEntity: "tags",
        }),
      ],
    });

    const fieldSpecs = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    }).getCapabilitySummary().fieldSpecs;

    expect(fieldSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "inline_tag_id",
          patchMode: "no_write",
          readOnly: true,
          searchMode: "none",
          storagePrimitive: "direct_column",
          uiControl: "read_only",
        }),
        expect.objectContaining({
          fieldKey: "json_author",
          patchMode: "no_write",
          readOnly: true,
          searchMode: "none",
          storagePrimitive: "json_path",
          uiControl: "read_only",
        }),
        expect.objectContaining({
          fieldKey: "derived_tag_ids",
          patchMode: "no_write",
          readOnly: true,
          searchMode: "none",
          storagePrimitive: "derived_read_only",
          uiControl: "read_only",
        }),
      ]),
    );
  });
});
