import { describe, expect, it } from "vitest";

import {
  compileContentProjectMappingToAdapterInstructions,
} from "@/lib/content-runtime/adapter/compiler";
import {
  createContentRuntimeAdapter,
} from "@/lib/content-runtime/adapter/factory";
import { sanitizeAdapterSavePostRequest } from "@/lib/content-runtime/adapter/postgres/save-post-request";
import {
  type ContentCustomRelationFieldMapping,
  normalizeContentProjectMapping,
} from "@/lib/content-runtime/mapping";
import {
  getContentPostFieldAvailabilityFromFieldSpecs,
  getContentVisibleCollectionsFromRuntimeSummary,
} from "@/lib/content-runtime/shared";

const createMappedProjectMapping = ({
  customFields,
  customRelationFields = [],
  fieldOverrides,
}: {
  customFields?: Array<Record<string, unknown>>;
  customRelationFields?: ContentCustomRelationFieldMapping[];
  fieldOverrides?: Record<string, unknown>;
} = {}) =>
  normalizeContentProjectMapping({
    bindingId: "binding-1",
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
        media: {
          source: { kind: "table", primaryKey: "id", schema: "public", table: "media" },
          status: "mapped",
        },
        files: {
          source: { kind: "table", primaryKey: "id", schema: "public", table: "files" },
          status: "mapped",
        },
        posts: {
          customRelationFields,
          customFields:
            customFields ??
            [
              {
                allowedValues: null,
                column: "reading_time_minutes",
                dataType: "integer",
                defaultValue: null,
                enabled: true,
                isNullable: true,
                kind: "number",
                label: "Reading time",
                sampleValues: ["5", "10"],
              },
            ],
          editorFields: [
            {
              column: "body_html",
              id: "content",
              kind: "rich_text",
              label: "Content",
              placeholder: null,
              required: false,
              visible: true,
            },
          ],
          fields: {
            createdAt: { column: "created_at", kind: "datetime", label: "Created At" },
            excerpt: { column: "summary", kind: "plain_text", label: "Excerpt" },
            focusKeyword: { column: "seo_blob", kind: "text", label: "Focus Keyword", path: "keyword" },
            publishedAt: { column: "published_at", kind: "datetime", label: "Published At" },
            seoDescription: {
              column: "seo_blob",
              kind: "plain_text",
              label: "SEO Description",
              path: "description",
            },
            seoTitle: { column: "seo_blob", kind: "text", label: "SEO Title", path: "title" },
            slug: { column: "route_payload", kind: "slug", label: "Slug", path: "slug.current" },
            status: { column: "publication_state", kind: "text", label: "Status" },
            title: { column: "headline", kind: "text", label: "Title", required: true },
            updatedAt: { column: "updated_at", kind: "datetime", label: "Updated At" },
            ...(fieldOverrides ?? {}),
          },
          relations: {
            authors: {
              fieldMap: { name: "name" },
              junctionSourceColumn: null,
              junctionTable: null,
              junctionTargetColumn: null,
              multiple: false,
              sourceColumn: "author_id",
              status: "mapped",
              strategy: "foreign_key",
              targetColumn: "id",
              targetEntity: "authors",
              targetTable: null,
              valueColumn: null,
            },
            categories: {
              fieldMap: { name: "name" },
              junctionSourceColumn: "post_id",
              junctionTable: "post_categories",
              junctionTargetColumn: "category_id",
              multiple: true,
              sourceColumn: null,
              status: "mapped",
              strategy: "join_table",
              targetColumn: "id",
              targetEntity: "categories",
              targetTable: null,
              valueColumn: null,
            },
            tags: {
              fieldMap: { name: "name" },
              junctionSourceColumn: null,
              junctionTable: null,
              junctionTargetColumn: null,
              multiple: true,
              sourceColumn: "tag_ids",
              status: "mapped",
              strategy: "array",
              targetColumn: "id",
              targetEntity: "tags",
              targetTable: null,
              valueColumn: null,
            },
          },
          source: { kind: "table", primaryKey: "id", schema: "public", table: "posts" },
          status: "mapped",
          workflow: {
            archivedValues: ["archived"],
            customValues: [],
            draftValues: ["draft"],
            mode: "status",
            publishedAtColumn: "published_at",
            publishedFlagColumn: null,
            publishedValues: ["published"],
            statusColumn: "publication_state",
          },
        },
        tags: {
          source: { kind: "table", primaryKey: "id", schema: "public", table: "tags" },
          status: "mapped",
        },
      },
      mediaStorage: {
        bucketName: "cms-media",
        endpoint: null,
        provider: "supabase_bucket",
        publicUrlBase: null,
        region: null,
      },
      version: 1,
    },
    revisionId: "revision-1",
    revisionVersion: 1,
  });

describe("Postgres adapter compiler", () => {
  it("compiles current mapping into normalized adapter instructions", () => {
    const mapping = createMappedProjectMapping();

    const compiled = compileContentProjectMappingToAdapterInstructions(mapping);

    expect(compiled.bindingMode).toBe("mapped_content");
    expect(compiled.entitySources.posts).toMatchObject({
      kind: "table",
      primaryKey: "id",
      schema: "public",
      table: "posts",
    });
    expect(compiled.scalarFields.title).toMatchObject({
      fieldKey: "title",
      semanticRole: "title",
      sourceColumn: "headline",
      storagePrimitive: "direct_column",
    });
    expect(compiled.scalarFields.slug).toMatchObject({
      fieldKey: "slug",
      semanticRole: "slug",
      sourceColumn: "route_payload",
      sourcePath: "slug.current",
      storagePrimitive: "json_path",
    });
    expect(compiled.scalarFields.seoTitle).toMatchObject({
      fieldKey: "seoTitle",
      sourceColumn: "seo_blob",
      sourcePath: "title",
      storagePrimitive: "json_path",
    });
    expect(compiled.scalarFields.createdAt).toMatchObject({
      editabilityState: "read_only",
      fieldKey: "createdAt",
      sourceColumn: "created_at",
      storagePrimitive: "direct_column",
    });
    expect(compiled.relationFields.author).toMatchObject({
      fieldKey: "author",
      multiple: false,
      semanticRole: "author",
      sourceColumn: "author_id",
      storagePrimitive: "foreign_key",
    });
    expect(compiled.relationFields.categories).toMatchObject({
      fieldKey: "categories",
      junctionTable: "post_categories",
      storagePrimitive: "join_table",
    });
    expect(compiled.relationFields.tags).toMatchObject({
      fieldKey: "tags",
      sourceColumn: "tag_ids",
      storagePrimitive: "array_value",
    });
    expect(compiled.workflowFields.status).toMatchObject({
      editabilityState: "coercible",
      fieldKey: "status",
      semanticRole: "status",
      sourceColumn: "publication_state",
      storagePrimitive: "direct_column",
    });
    expect(compiled.workflowFields.publishedAt).toMatchObject({
      editabilityState: "coercible",
      fieldKey: "publishedAt",
      sourceColumn: "published_at",
      storagePrimitive: "direct_column",
    });
    expect(compiled.customScalarFields).toEqual([
      expect.objectContaining({
        fieldKey: "reading_time_minutes",
        semanticRole: "customField",
        storagePrimitive: "direct_column",
      }),
    ]);
  });

  it("does not compile scalar fields that have no storage source", () => {
    const mapping = createMappedProjectMapping({
      fieldOverrides: {
        updatedAt: {
          column: null,
          kind: "datetime",
          label: "Updated At",
          visible: true,
        },
      },
    });

    const compiled = compileContentProjectMappingToAdapterInstructions(mapping);

    expect(compiled.scalarFields.updatedAt).toBeUndefined();
  });

  it("does not use an optimistic updatedAt token when updatedAt is unmapped", () => {
    const mapping = createMappedProjectMapping({
      fieldOverrides: {
        updatedAt: {
          column: null,
          kind: "datetime",
          label: "Updated At",
          visible: true,
        },
      },
    });
    const compiled = compileContentProjectMappingToAdapterInstructions(mapping);

    const sanitized = sanitizeAdapterSavePostRequest({
      compiled,
      mapping,
      request: {
        client: {} as never,
        postId: "post-1",
        title: "Updated title",
        updatedAt: "2026-03-30T00:00:00.000Z",
      },
    });

    expect(sanitized.expectedUpdatedAt).toBeUndefined();
    expect(sanitized.updatedAt).toBeUndefined();
  });

  it("compiles non-direct content editor fields into structured adapter instructions", () => {
    const mapping = createMappedProjectMapping();
    mapping.mappingConfig.entities.posts.editorFields = [
      {
        column: "content_payload",
        id: "content_payload__body_main",
        kind: "html",
        label: "Main content",
        path: "body.main",
        placeholder: null,
        required: true,
        visible: true,
      } as never,
      {
        arrayIndex: 1,
        column: "content_sections",
        id: "content_sections__item_2",
        kind: "markdown",
        label: "Summary",
        placeholder: null,
        required: false,
        visible: true,
      } as never,
    ];

    const compiled = compileContentProjectMappingToAdapterInstructions(mapping);

    expect(compiled.structuredFields.content_payload__body_main).toMatchObject({
      fieldKey: "content_payload__body_main",
      semanticRole: "content",
      sourceColumn: "content_payload",
      sourcePath: "body.main",
      storagePrimitive: "json_path",
    });
    expect(compiled.structuredFields.content_sections__item_2).toMatchObject({
      fieldKey: "content_sections__item_2",
      sourceArrayIndex: 1,
      sourceColumn: "content_sections",
      storagePrimitive: "array_item",
    });
  });

  it("compiles helper-row-backed content editor fields into structured adapter instructions", () => {
    const mapping = createMappedProjectMapping();
    mapping.mappingConfig.entities.posts.editorFields = [
      {
        column: null,
        id: "content_helper",
        kind: "html",
        label: "Content",
        placeholder: null,
        required: true,
        sourceRelation: {
          junctionSourceColumn: "post_id",
          junctionTable: "public.post_content_helper",
          sourceColumn: null,
          strategy: "related_row_by_post_id",
          targetColumn: null,
          targetTable: null,
          valueColumn: "body_html",
        },
        visible: true,
      } as never,
    ];

    const compiled = compileContentProjectMappingToAdapterInstructions(mapping);

    expect(compiled.structuredFields.content_helper).toMatchObject({
      editabilityState: "editable",
      fieldKey: "content_helper",
      semanticRole: "content",
      sourceColumn: null,
      sourceRelation: {
        junctionSourceColumn: "post_id",
        junctionTable: "public.post_content_helper",
        sourceColumn: null,
        strategy: "related_row_by_post_id",
        targetColumn: null,
        targetTable: null,
        valueColumn: "body_html",
      },
      storagePrimitive: "related_row_by_post_id",
    });
  });

  it("compiles helper-row and value-match relation strategies into adapter instructions and field specs", async () => {
    const mapping = createMappedProjectMapping();
    mapping.mappingConfig.entities.posts.relations.authors = {
      fieldMap: { name: "name" },
      junctionSourceColumn: "post_id",
      junctionTable: "public.post_author_helper",
      junctionTargetColumn: null,
      multiple: false,
      sourceColumn: null,
      status: "mapped",
      strategy: "related_row_by_post_id",
      targetColumn: "slug",
      targetEntity: "authors",
      targetTable: "public.authors",
      valueColumn: "author_slug",
    };
    mapping.mappingConfig.entities.posts.relations.categories = {
      fieldMap: { name: "name" },
      junctionSourceColumn: null,
      junctionTable: null,
      junctionTargetColumn: null,
      multiple: true,
      sourceColumn: "category_slugs",
      status: "mapped",
      strategy: "value_match_relation",
      targetColumn: "slug",
      targetEntity: "categories",
      targetTable: "public.categories",
      valueColumn: null,
    };
    mapping.mappingConfig.entities.posts.relations.posts = {
      fieldMap: { title: "title" },
      junctionSourceColumn: "post_id",
      junctionTable: "public.post_parent_helper",
      junctionTargetColumn: null,
      multiple: false,
      sourceColumn: null,
      status: "mapped",
      strategy: "join_row",
      targetColumn: "slug",
      targetEntity: "posts",
      targetTable: "public.posts",
      valueColumn: "parent_slug",
    };

    const compiled = compileContentProjectMappingToAdapterInstructions(mapping);
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const summary = adapter.getCapabilitySummary();

    expect(compiled.relationFields.author).toMatchObject({
      fieldKey: "author",
      junctionSourceColumn: "post_id",
      junctionTable: "public.post_author_helper",
      relationMode: "managed_single",
      storagePrimitive: "related_row_by_post_id",
      targetColumn: "slug",
      valueColumn: "author_slug",
    });
    expect(compiled.relationFields.categories).toMatchObject({
      fieldKey: "categories",
      multiple: true,
      relationMode: "value_match_multi",
      sourceColumn: "category_slugs",
      storagePrimitive: "value_match_relation",
      targetColumn: "slug",
    });
    expect(compiled.relationFields.parentPage).toMatchObject({
      fieldKey: "parentPage",
      junctionSourceColumn: "post_id",
      junctionTable: "public.post_parent_helper",
      relationMode: "managed_single",
      storagePrimitive: "join_row",
      targetColumn: "slug",
      valueColumn: "parent_slug",
    });

    expect(summary.fieldSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "author",
          patchMode: "link_replace",
          relationMode: "managed_single",
          searchMode: "remote",
          uiControl: "single_select",
        }),
        expect.objectContaining({
          fieldKey: "categories",
          multiple: true,
          patchMode: "link_replace",
          relationMode: "value_match_multi",
          searchMode: "remote",
          uiControl: "multi_select",
        }),
        expect.objectContaining({
          fieldKey: "parentPage",
          patchMode: "link_replace",
          relationMode: "managed_single",
          searchMode: "remote",
          uiControl: "single_select",
        }),
      ]),
    );
  });

  it("compiles relation strategy as the source of truth when saved storage primitives are stale", () => {
    const mapping = createMappedProjectMapping();
    mapping.mappingConfig.entities.posts.relations.categories = {
      ...mapping.mappingConfig.entities.posts.relations.categories,
      storagePrimitive: "derived_read_only",
      strategy: "join_table",
    };
    mapping.mappingConfig.entities.posts.relations.tags = {
      ...mapping.mappingConfig.entities.posts.relations.tags,
      junctionSourceColumn: "post_id",
      junctionTable: "post_tags",
      junctionTargetColumn: "tag_id",
      sourceColumn: null,
      storagePrimitive: "derived_read_only",
      strategy: "join_table",
    };

    const compiled = compileContentProjectMappingToAdapterInstructions(mapping);
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const summary = adapter.getCapabilitySummary();

    expect(compiled.relationFields.categories).toMatchObject({
      editabilityState: "editable",
      fieldKey: "categories",
      storagePrimitive: "join_table",
    });
    expect(compiled.relationFields.tags).toMatchObject({
      editabilityState: "editable",
      fieldKey: "tags",
      storagePrimitive: "join_table",
    });
    expect(summary.fieldSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "categories",
          uiControl: "multi_select",
        }),
        expect.objectContaining({
          fieldKey: "tags",
          uiControl: "multi_select",
        }),
      ]),
    );
  });

  it("compiles relation-backed scalar sources into truthful adapter instructions and field specs", async () => {
    const mapping = createMappedProjectMapping({
      fieldOverrides: {
        excerpt: {
          column: null,
          kind: "plain_text",
          label: "Excerpt",
          sourceRelation: {
            junctionSourceColumn: "post_id",
            junctionTable: "public.post_excerpt_helper",
            sourceColumn: null,
            strategy: "join_row",
            targetColumn: null,
            targetTable: "public.post_excerpt_helper",
            valueColumn: "excerpt_text",
          },
        },
        seoDescription: {
          column: null,
          kind: "plain_text",
          label: "SEO Description",
          sourceRelation: {
            junctionSourceColumn: null,
            junctionTable: null,
            sourceColumn: "seo_meta_id",
            strategy: "foreign_key",
            targetColumn: "id",
            targetTable: "public.seo_meta",
            valueColumn: null,
          },
        },
        seoTitle: {
          column: "author_meta_title",
          kind: "text",
          label: "SEO Title",
          sourceRelation: {
            junctionSourceColumn: null,
            junctionTable: null,
            sourceColumn: "author_meta_title",
            strategy: "inline_fields",
            targetColumn: null,
            targetTable: "public.posts",
            valueColumn: "author_meta_title",
          },
        },
        slug: {
          column: null,
          kind: "slug",
          label: "Slug",
          sourceRelation: {
            junctionSourceColumn: null,
            junctionTable: null,
            sourceColumn: "slug_key",
            strategy: "value_match_relation",
            targetColumn: "key",
            targetTable: "public.slug_lookup",
            valueColumn: "slug_text",
          },
        },
        title: {
          column: null,
          kind: "text",
          label: "Title",
          required: true,
          sourceRelation: {
            junctionSourceColumn: null,
            junctionTable: null,
            sourceColumn: "headline_meta_id",
            strategy: "foreign_key",
            targetColumn: "id",
            targetTable: "public.headline_meta",
            valueColumn: "title_text",
          },
        },
      },
    });

    const compiled = compileContentProjectMappingToAdapterInstructions(mapping);
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const summary = adapter.getCapabilitySummary();

    expect(compiled.scalarFields.title).toMatchObject({
      fieldKey: "title",
      sourceColumn: "headline_meta_id",
      sourceRelation: expect.objectContaining({
        sourceColumn: "headline_meta_id",
        strategy: "foreign_key",
        targetColumn: "id",
        targetTable: "public.headline_meta",
        valueColumn: "title_text",
      }),
      storagePrimitive: "foreign_key",
    });
    expect(compiled.scalarFields.slug).toMatchObject({
      fieldKey: "slug",
      sourceColumn: "slug_key",
      sourceRelation: expect.objectContaining({
        sourceColumn: "slug_key",
        strategy: "value_match_relation",
        targetColumn: "key",
        targetTable: "public.slug_lookup",
        valueColumn: "slug_text",
      }),
      storagePrimitive: "value_match_relation",
    });
    expect(compiled.scalarFields.excerpt).toMatchObject({
      fieldKey: "excerpt",
      sourceColumn: null,
      sourceRelation: expect.objectContaining({
        junctionSourceColumn: "post_id",
        junctionTable: "public.post_excerpt_helper",
        strategy: "join_row",
        valueColumn: "excerpt_text",
      }),
      storagePrimitive: "join_row",
    });
    expect(compiled.scalarFields.seoTitle).toMatchObject({
      editabilityState: "read_only",
      fieldKey: "seoTitle",
      sourceRelation: expect.objectContaining({
        sourceColumn: "author_meta_title",
        strategy: "inline_fields",
      }),
      storagePrimitive: "direct_column",
    });
    expect(compiled.scalarFields.seoDescription).toMatchObject({
      editabilityState: "unsupported",
      fieldKey: "seoDescription",
      sourceRelation: expect.objectContaining({
        sourceColumn: "seo_meta_id",
        strategy: "foreign_key",
        targetColumn: "id",
        targetTable: "public.seo_meta",
        valueColumn: null,
      }),
      storagePrimitive: "foreign_key",
    });

    expect(summary.fieldSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          editabilityState: "editable",
          fieldKey: "title",
          patchMode: "link_replace",
          uiControl: "text_input",
        }),
        expect.objectContaining({
          editabilityState: "editable",
          fieldKey: "slug",
          patchMode: "link_replace",
          uiControl: "text_input",
        }),
        expect.objectContaining({
          editabilityState: "editable",
          fieldKey: "excerpt",
          patchMode: "link_replace",
          uiControl: "textarea",
        }),
        expect.objectContaining({
          editabilityState: "read_only",
          fieldKey: "seoTitle",
          patchMode: "no_write",
          readOnly: true,
        }),
        expect.objectContaining({
          editabilityState: "unsupported",
          fieldKey: "seoDescription",
          patchMode: "no_write",
          readOnly: true,
          uiControl: "textarea",
        }),
      ]),
    );
  });

  it("compiles relation-backed custom scalar fields into truthful adapter instructions and specs", () => {
    const mapping = createMappedProjectMapping({
      customFields: [
        {
          allowedValues: null,
          column: "subtitle_lookup_id",
          dataType: "uuid",
          defaultValue: null,
          enabled: true,
          fieldKey: "subtitle_text",
          isNullable: true,
          kind: "text",
          label: "Subtitle",
          sampleValues: [],
          sourceRelation: {
            junctionSourceColumn: null,
            junctionTable: null,
            sourceColumn: "subtitle_lookup_id",
            strategy: "foreign_key",
            targetColumn: "id",
            targetTable: "public.post_subtitle_rows",
            valueColumn: "subtitle_text",
          },
        },
        {
          allowedValues: null,
          column: "helper_subtitle",
          dataType: "text",
          defaultValue: null,
          enabled: true,
          fieldKey: "helper_subtitle",
          isNullable: true,
          kind: "text",
          label: "Helper Subtitle",
          sampleValues: [],
          sourceRelation: {
            junctionSourceColumn: "post_id",
            junctionTable: "public.post_subtitle_helper",
            sourceColumn: null,
            strategy: "related_row_by_post_id",
            targetColumn: null,
            targetTable: null,
            valueColumn: "subtitle_text",
          },
        },
        {
          allowedValues: null,
          column: "inline_summary",
          dataType: "text",
          defaultValue: null,
          enabled: true,
          fieldKey: "inline_summary",
          isNullable: true,
          kind: "text",
          label: "Inline Summary",
          sampleValues: [],
          sourceRelation: {
            junctionSourceColumn: null,
            junctionTable: null,
            sourceColumn: "inline_summary",
            strategy: "inline_fields",
            targetColumn: null,
            targetTable: "public.posts",
            valueColumn: "inline_summary",
          },
        },
      ],
    });

    const compiled = compileContentProjectMappingToAdapterInstructions(mapping);
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const summary = adapter.getCapabilitySummary();

    expect(compiled.customScalarFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          editabilityState: "editable",
          fieldKey: "subtitle_text",
          sourceColumn: "subtitle_lookup_id",
          storagePrimitive: "foreign_key",
        }),
        expect.objectContaining({
          editabilityState: "editable",
          fieldKey: "helper_subtitle",
          sourceColumn: null,
          storagePrimitive: "related_row_by_post_id",
        }),
        expect.objectContaining({
          editabilityState: "read_only",
          fieldKey: "inline_summary",
          sourceColumn: "inline_summary",
          storagePrimitive: "direct_column",
        }),
      ]),
    );

    expect(summary.fieldSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "subtitle_text",
          patchMode: "link_replace",
          readOnly: false,
        }),
        expect.objectContaining({
          fieldKey: "helper_subtitle",
          patchMode: "link_replace",
          readOnly: false,
        }),
        expect.objectContaining({
          fieldKey: "inline_summary",
          patchMode: "no_write",
          readOnly: true,
        }),
      ]),
    );
  });

  it("marks exotic custom scalar source types as unsupported read-only specs", () => {
    const mapping = createMappedProjectMapping({
      customFields: [
        {
          allowedValues: null,
          column: "raw_blob",
          dataType: "bytea",
          defaultValue: null,
          enabled: true,
          fieldKey: "raw_blob",
          isNullable: true,
          kind: "text",
          label: "Raw Blob",
          sampleValues: [],
        },
        {
          allowedValues: null,
          column: "search_document",
          dataType: "tsvector",
          defaultValue: null,
          enabled: true,
          fieldKey: "search_document",
          isNullable: true,
          kind: "plain_text",
          label: "Search Document",
          sampleValues: [],
        },
        {
          allowedValues: null,
          column: "status_domain",
          dataType: "USER-DEFINED",
          defaultValue: null,
          enabled: true,
          fieldKey: "status_domain",
          isNullable: true,
          kind: "text",
          label: "Status Domain",
          sampleValues: [],
        },
        {
          allowedValues: ["draft", "published"],
          column: "visibility",
          dataType: "USER-DEFINED",
          defaultValue: null,
          enabled: true,
          fieldKey: "visibility",
          isNullable: true,
          kind: "enum",
          label: "Visibility",
          sampleValues: ["draft", "published"],
        },
      ],
    });

    const compiled = compileContentProjectMappingToAdapterInstructions(mapping);
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const summary = adapter.getCapabilitySummary();

    expect(compiled.customScalarFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          editabilityState: "unsupported",
          fieldKey: "raw_blob",
          sourceColumn: "raw_blob",
          storagePrimitive: "direct_column",
          valueKind: "binary_or_exotic",
        }),
        expect.objectContaining({
          editabilityState: "unsupported",
          fieldKey: "search_document",
          sourceColumn: "search_document",
          storagePrimitive: "direct_column",
          valueKind: "binary_or_exotic",
        }),
        expect.objectContaining({
          editabilityState: "unsupported",
          fieldKey: "status_domain",
          sourceColumn: "status_domain",
          storagePrimitive: "direct_column",
          valueKind: "binary_or_exotic",
        }),
        expect.objectContaining({
          editabilityState: "editable",
          fieldKey: "visibility",
          sourceColumn: "visibility",
          storagePrimitive: "direct_column",
          valueKind: "enum",
        }),
      ]),
    );

    expect(summary.fieldSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          editabilityState: "unsupported",
          fieldKey: "raw_blob",
          patchMode: "no_write",
          readOnly: true,
          uiControl: "read_only",
          valueKind: "binary_or_exotic",
        }),
        expect.objectContaining({
          editabilityState: "unsupported",
          fieldKey: "search_document",
          patchMode: "no_write",
          readOnly: true,
          uiControl: "read_only",
          valueKind: "binary_or_exotic",
        }),
        expect.objectContaining({
          editabilityState: "unsupported",
          fieldKey: "status_domain",
          patchMode: "no_write",
          readOnly: true,
          uiControl: "read_only",
          valueKind: "binary_or_exotic",
        }),
        expect.objectContaining({
          editabilityState: "editable",
          fieldKey: "visibility",
          patchMode: "replace",
          readOnly: false,
          uiControl: "dropdown",
          valueKind: "enum",
        }),
      ]),
    );
  });

  it("compiles polymorphic join relation strategies into adapter instructions and field specs", async () => {
    const mapping = createMappedProjectMapping();
    mapping.mappingConfig.entities.posts.relations.tags = {
      discriminatorColumn: "owner_type",
      discriminatorValue: "post",
      fieldMap: { name: "name" },
      junctionSourceColumn: "owner_id",
      junctionTable: "public.post_tags",
      junctionTargetColumn: "tag_id",
      multiple: true,
      sourceColumn: null,
      status: "mapped",
      strategy: "polymorphic_join",
      targetColumn: "id",
      targetEntity: "tags",
      targetTable: "public.tags",
      valueColumn: null,
    };

    const compiled = compileContentProjectMappingToAdapterInstructions(mapping);
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const summary = adapter.getCapabilitySummary();

    expect(compiled.relationFields.tags).toMatchObject({
      discriminatorColumn: "owner_type",
      discriminatorValue: "post",
      fieldKey: "tags",
      junctionSourceColumn: "owner_id",
      junctionTable: "public.post_tags",
      junctionTargetColumn: "tag_id",
      multiple: true,
      relationMode: "managed_multi",
      storagePrimitive: "polymorphic_join",
    });

    expect(summary.fieldSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "tags",
          patchMode: "link_replace",
          relationMode: "managed_multi",
          searchMode: "remote",
          uiControl: "multi_select",
        }),
      ]),
    );
  });

  it("keeps redirects list-only on array-backed storage", async () => {
    const mapping = createMappedProjectMapping({
      fieldOverrides: {
        redirects: { column: "redirect_history", kind: "array", label: "Redirects" },
      },
    });

    const compiled = compileContentProjectMappingToAdapterInstructions(mapping);
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const fieldSpecs = await adapter.loadFieldSpecs?.();
    const sidebarFieldSpecs = await adapter.loadSidebarFieldSpecs?.();
    const redirectsFieldSpec = fieldSpecs?.find((fieldSpec) => fieldSpec.fieldKey === "redirects");
    const redirectsSidebarFieldSpec = sidebarFieldSpecs?.find((fieldSpec) => fieldSpec.fieldKey === "redirects");

    expect(compiled.scalarFields.redirects).toMatchObject({
      fieldKey: "redirects",
      sourceColumn: "redirect_history",
      storagePrimitive: "array_value",
      uiControl: "token_input",
      valueKind: "redirects",
    });

    expect(redirectsFieldSpec).toMatchObject({
      editabilityState: "editable",
      fieldKey: "redirects",
      multiple: true,
      patchMode: "replace",
      readOnly: false,
      redirectMetadataSupport: "list_only",
      uiControl: "token_input",
      valueKind: "redirects",
      visible: true,
    });

    expect(redirectsSidebarFieldSpec).toMatchObject({
      defaultParentId: null,
      editabilityState: "editable",
      fieldKey: "redirects",
      label: "Redirects",
      multiple: true,
      patchMode: "replace",
      readOnly: false,
      relationMode: "none",
      redirectMetadataSupport: "list_only",
      searchMode: "none",
      sidebarFieldId: "redirects",
      uiControl: "token_input",
      valueKind: "redirects",
      visible: true,
    });
  });

  it("keeps redirect metadata list-only on array-item storage", async () => {
    const mapping = createMappedProjectMapping({
      fieldOverrides: {
        redirects: {
          arrayIndex: 0,
          column: "redirect_history",
          kind: "array",
          label: "Redirects",
        },
      },
    });

    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const fieldSpecs = await adapter.loadFieldSpecs?.();
    const redirectsFieldSpec = fieldSpecs?.find((fieldSpec) => fieldSpec.fieldKey === "redirects");

    expect(redirectsFieldSpec).toMatchObject({
      fieldKey: "redirects",
      redirectMetadataSupport: "list_only",
      uiControl: "token_input",
      valueKind: "redirects",
    });
  });

  it("builds image-picker specs for safe featured image mappings on json-path and array-item storage", async () => {
    const jsonPathMapping = createMappedProjectMapping({
      fieldOverrides: {
        featuredImageUrl: {
          column: "media_payload",
          kind: "text",
          label: "Featured Image",
          path: "hero.src",
        },
      },
    });
    const arrayItemMapping = createMappedProjectMapping({
      fieldOverrides: {
        featuredImageUrl: {
          arrayIndex: 1,
          column: "gallery_urls",
          kind: "array",
          label: "Featured Image",
        },
      },
    });

    const jsonPathCompiled = compileContentProjectMappingToAdapterInstructions(jsonPathMapping);
    const arrayItemCompiled = compileContentProjectMappingToAdapterInstructions(arrayItemMapping);
    const jsonPathAdapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping: jsonPathMapping,
    });
    const arrayItemAdapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping: arrayItemMapping,
    });

    const jsonPathFieldSpec = (await jsonPathAdapter.loadFieldSpecs?.())?.find(
      (fieldSpec) => fieldSpec.fieldKey === "featuredImage",
    );
    const arrayItemFieldSpec = (await arrayItemAdapter.loadFieldSpecs?.())?.find(
      (fieldSpec) => fieldSpec.fieldKey === "featuredImage",
    );

    expect(jsonPathCompiled.scalarFields.featuredImage).toMatchObject({
      editabilityState: "editable",
      storagePrimitive: "json_path",
      uiControl: "image_picker",
      valueKind: "text_like",
    });
    expect(jsonPathFieldSpec).toMatchObject({
      editabilityState: "editable",
      fieldKey: "featuredImage",
      readOnly: false,
      uiControl: "image_picker",
      valueKind: "text_like",
    });

    expect(arrayItemCompiled.scalarFields.featuredImage).toMatchObject({
      editabilityState: "editable",
      sourceArrayIndex: 1,
      storagePrimitive: "array_item",
      uiControl: "image_picker",
      valueKind: "text_like",
    });
    expect(arrayItemFieldSpec).toMatchObject({
      editabilityState: "editable",
      fieldKey: "featuredImage",
      readOnly: false,
      uiControl: "image_picker",
      valueKind: "text_like",
    });
  });

  it("marks unsafe featured image mappings as unsupported read-only specs", async () => {
    const mapping = createMappedProjectMapping({
      fieldOverrides: {
        featuredImageUrl: {
          column: "media_payload",
          kind: "json",
          label: "Featured Image",
        },
      },
    });

    const compiled = compileContentProjectMappingToAdapterInstructions(mapping);
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const fieldSpec = (await adapter.loadFieldSpecs?.())?.find(
      (entry) => entry.fieldKey === "featuredImage",
    );
    const sidebarFieldSpec = (await adapter.loadSidebarFieldSpecs?.())?.find(
      (entry) => entry.fieldKey === "featuredImage",
    );

    expect(compiled.scalarFields.featuredImage).toMatchObject({
      editabilityState: "unsupported",
      uiControl: "read_only",
      valueKind: "json_object",
    });
    expect(fieldSpec).toMatchObject({
      editabilityState: "unsupported",
      fieldKey: "featuredImage",
      readOnly: true,
      uiControl: "read_only",
      valueKind: "json_object",
    });
    expect(sidebarFieldSpec).toMatchObject({
      editabilityState: "unsupported",
      fieldKey: "featuredImage",
      readOnly: true,
      sidebarFieldId: "featured_image",
      uiControl: "read_only",
      valueKind: "json_object",
    });
  });

  it("covers every storage primitive the current compiler can emit", () => {
    const baseMapping = createMappedProjectMapping();
    const arrayItemMapping = createMappedProjectMapping({
      fieldOverrides: {
        title: {
          arrayIndex: 1,
          column: "title_parts",
          kind: "text",
          label: "Title",
          required: true,
          visible: true,
        },
      },
    });
    const inlineRelationMapping = normalizeContentProjectMapping({
      ...baseMapping,
      mappingConfig: {
        ...baseMapping.mappingConfig,
        entities: {
          ...baseMapping.mappingConfig.entities,
          posts: {
            ...baseMapping.mappingConfig.entities.posts,
            relations: {
              ...baseMapping.mappingConfig.entities.posts.relations,
              tags: {
                fieldMap: { name: "tag_name" },
                junctionSourceColumn: null,
                junctionTable: null,
                junctionTargetColumn: null,
                multiple: false,
                sourceColumn: "tag_name",
                status: "mapped",
                strategy: "inline_fields",
                targetColumn: "id",
                targetEntity: "tags",
                targetTable: null,
                valueColumn: null,
              },
            },
          },
        },
      },
    });
    const jsonRelationMapping = normalizeContentProjectMapping({
      ...baseMapping,
      mappingConfig: {
        ...baseMapping.mappingConfig,
        entities: {
          ...baseMapping.mappingConfig.entities,
          posts: {
            ...baseMapping.mappingConfig.entities.posts,
            relations: {
              ...baseMapping.mappingConfig.entities.posts.relations,
              tags: {
                fieldMap: { name: "name" },
                junctionSourceColumn: null,
                junctionTable: null,
                junctionTargetColumn: null,
                multiple: true,
                sourceColumn: "seo_blob",
                status: "mapped",
                strategy: "json_array",
                targetColumn: "id",
                targetEntity: "tags",
                targetTable: null,
                valueColumn: null,
              },
            },
          },
        },
      },
    });
    const derivedMapping = normalizeContentProjectMapping({
      ...baseMapping,
      mappingConfig: {
        ...baseMapping.mappingConfig,
        entities: {
          ...baseMapping.mappingConfig.entities,
          posts: {
            ...baseMapping.mappingConfig.entities.posts,
            source: {
              ...baseMapping.mappingConfig.entities.posts.source,
              kind: "derived",
            },
          },
        },
      },
    });
    const publishedFlagWorkflowMapping = normalizeContentProjectMapping({
      ...baseMapping,
      mappingConfig: {
        ...baseMapping.mappingConfig,
        entities: {
          ...baseMapping.mappingConfig.entities,
          posts: {
            ...baseMapping.mappingConfig.entities.posts,
            workflow: {
              ...baseMapping.mappingConfig.entities.posts.workflow,
              mode: "published_flag",
              publishedAtColumn: null,
              publishedFlagColumn: "is_published",
              publishedValues: ["true"],
              statusColumn: null,
            },
          },
        },
      },
    });

    const observedStoragePrimitives = [
      baseMapping,
      inlineRelationMapping,
      jsonRelationMapping,
      derivedMapping,
      publishedFlagWorkflowMapping,
      arrayItemMapping,
    ]
      .map((mapping) => compileContentProjectMappingToAdapterInstructions(mapping))
      .flatMap((compiled) => [
        ...Object.values(compiled.scalarFields),
        ...Object.values(compiled.structuredFields),
        ...Object.values(compiled.relationFields),
        ...Object.values(compiled.workflowFields),
        ...compiled.customScalarFields,
      ])
      .filter(Boolean)
      .map((instruction) => instruction.storagePrimitive);

    expect(new Set(observedStoragePrimitives)).toEqual(
      new Set([
        "array_item",
        "array_value",
        "boolean_mapping",
        "derived_read_only",
        "direct_column",
        "foreign_key",
        "join_table",
        "json_path",
      ]),
    );
  });

  it("compiles explicit array-index fields to array-item storage primitives", () => {
    const mapping = createMappedProjectMapping({
      fieldOverrides: {
        title: {
          arrayIndex: 1,
          column: "title_parts",
          kind: "text",
          label: "Title",
          required: true,
          visible: true,
        },
      },
    });

    const compiled = compileContentProjectMappingToAdapterInstructions(mapping);

    expect(compiled.scalarFields.title).toMatchObject({
      fieldKey: "title",
      sourceArrayIndex: 1,
      sourceColumn: "title_parts",
      storagePrimitive: "array_item",
      valueKind: "text_like",
    });

    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const titleFieldSpec = adapter
      .getCapabilitySummary()
      .fieldSpecs.find((fieldSpec) => fieldSpec.fieldKey === "title");

    expect(titleFieldSpec).toMatchObject({
      fieldKey: "title",
      patchMode: "index_patch",
      uiControl: "text_input",
      valueKind: "text_like",
    });
  });

  it("compiles custom array fields to array-value storage primitives", () => {
    const baseMapping = createMappedProjectMapping();
    const mapping = normalizeContentProjectMapping({
      ...baseMapping,
      mappingConfig: {
        ...baseMapping.mappingConfig,
        entities: {
          ...baseMapping.mappingConfig.entities,
          posts: {
            ...baseMapping.mappingConfig.entities.posts,
            customFields: [
              ...baseMapping.mappingConfig.entities.posts.customFields,
              {
                allowedValues: null,
                column: "aliases",
                dataType: "text[]",
                defaultValue: null,
                enabled: true,
                isNullable: true,
                kind: "array",
                label: "Aliases",
                sampleValues: [],
              },
            ],
          },
        },
      },
    });

    const compiled = compileContentProjectMappingToAdapterInstructions(mapping);

    expect(compiled.customScalarFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "aliases",
          storagePrimitive: "array_value",
          valueKind: "array_scalar",
        }),
      ]),
    );
  });

  it("compiles non-direct custom scalar fields with stable field keys and patch modes", () => {
    const baseMapping = createMappedProjectMapping();
    const mapping = normalizeContentProjectMapping({
      ...baseMapping,
      mappingConfig: {
        ...baseMapping.mappingConfig,
        entities: {
          ...baseMapping.mappingConfig.entities,
          posts: {
            ...baseMapping.mappingConfig.entities.posts,
            customFields: [
              {
                allowedValues: null,
                column: "metadata",
                dataType: "jsonb",
                defaultValue: null,
                enabled: true,
                fieldKey: "card_title",
                isNullable: true,
                kind: "text",
                label: "Card Title",
                path: "card.title",
                sampleValues: [],
              } as never,
              {
                allowedValues: null,
                arrayIndex: 1,
                column: "tag_slots",
                dataType: "text[]",
                defaultValue: null,
                enabled: true,
                fieldKey: "secondary_tag",
                isNullable: true,
                kind: "text",
                label: "Secondary Tag",
                sampleValues: [],
              } as never,
            ],
          },
        },
      },
    });

    const compiled = compileContentProjectMappingToAdapterInstructions(mapping);
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const summary = adapter.getCapabilitySummary();

    expect(compiled.customScalarFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "card_title",
          sourceColumn: "metadata",
          storagePrimitive: "json_path",
        }),
        expect.objectContaining({
          fieldKey: "secondary_tag",
          sourceColumn: "tag_slots",
          storagePrimitive: "array_item",
        }),
      ]),
    );
    expect(summary.fieldSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "card_title",
          patchMode: "key_patch",
        }),
        expect.objectContaining({
          fieldKey: "secondary_tag",
          patchMode: "index_patch",
        }),
      ]),
    );
  });

  it("surfaces truthful patch modes for supported custom json and array storage shapes", () => {
    const baseMapping = createMappedProjectMapping();
    const mapping = normalizeContentProjectMapping({
      ...baseMapping,
      mappingConfig: {
        ...baseMapping.mappingConfig,
        entities: {
          ...baseMapping.mappingConfig.entities,
          posts: {
            ...baseMapping.mappingConfig.entities.posts,
            customFields: [
              ...baseMapping.mappingConfig.entities.posts.customFields,
              {
                allowedValues: null,
                column: "metadata",
                dataType: "jsonb",
                defaultValue: null,
                enabled: true,
                fieldKey: "metadata_blob",
                isNullable: true,
                kind: "json",
                label: "Metadata Blob",
                sampleValues: [],
              },
              {
                allowedValues: null,
                column: "metadata",
                dataType: "jsonb",
                defaultValue: null,
                enabled: true,
                fieldKey: "card_title",
                isNullable: true,
                kind: "text",
                label: "Card Title",
                path: "card.title",
                sampleValues: [],
              },
              {
                allowedValues: null,
                column: "aliases",
                dataType: "text[]",
                defaultValue: null,
                enabled: true,
                fieldKey: "aliases_list",
                isNullable: true,
                kind: "array",
                label: "Aliases",
                sampleValues: [],
              },
              {
                allowedValues: null,
                arrayIndex: 1,
                column: "aliases",
                dataType: "text[]",
                defaultValue: null,
                enabled: true,
                fieldKey: "secondary_alias",
                isNullable: true,
                kind: "text",
                label: "Secondary Alias",
                sampleValues: [],
              },
            ],
          },
        },
      },
    });
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const summary = adapter.getCapabilitySummary();

    expect(summary.fieldSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "metadata_blob",
          patchMode: "replace",
          valueKind: "json_object",
        }),
        expect.objectContaining({
          fieldKey: "card_title",
          patchMode: "key_patch",
          valueKind: "text_like",
        }),
        expect.objectContaining({
          fieldKey: "aliases_list",
          patchMode: "replace",
          valueKind: "array_scalar",
        }),
        expect.objectContaining({
          fieldKey: "secondary_alias",
          patchMode: "index_patch",
          valueKind: "text_like",
        }),
      ]),
    );
  });
});

describe("Postgres runtime adapter", () => {
  it("builds mapped-content capability summary from compiled adapter instructions", () => {
    const mapping = createMappedProjectMapping();

    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });

    expect(adapter.kind).toBe("postgres_content");
    expect(adapter.compiled.scalarFields.title?.storagePrimitive).toBe("direct_column");

    const summary = adapter.getCapabilitySummary();
    const mappedPostFields = getContentPostFieldAvailabilityFromFieldSpecs({
      customFields: summary.customFields,
      fieldSpecs: summary.fieldSpecs ?? [],
    });

    expect(summary.customFields).toHaveLength(1);
    expect(summary.editorFields).toEqual([
      expect.objectContaining({
        id: "content",
        label: "Content",
      }),
    ]);
    expect(mappedPostFields.title).toBe(true);
    expect(mappedPostFields.slug).toBe(true);
    expect(mappedPostFields.excerpt).toBe(true);
    expect(mappedPostFields.seo).toBe(true);
    expect(mappedPostFields.seoTitle).toBe(true);
    expect(mappedPostFields.seoDescription).toBe(true);
    expect(mappedPostFields.focusKeyword).toBe(true);
    expect(mappedPostFields.author).toBe(true);
    expect(mappedPostFields.categories).toBe(true);
    expect(mappedPostFields.tags).toBe(true);
    expect(mappedPostFields.status).toBe(true);
    expect(mappedPostFields.publishedAt).toBe(true);
    expect(mappedPostFields.updatedAt).toBe(true);
    expect(getContentVisibleCollectionsFromRuntimeSummary({ runtime: summary }).authors).toBe(true);
    expect(getContentVisibleCollectionsFromRuntimeSummary({ runtime: summary }).categories).toBe(true);
    expect(getContentVisibleCollectionsFromRuntimeSummary({ runtime: summary }).tags).toBe(true);
    expect(summary.mediaStorage).toEqual(
      expect.objectContaining({
        bucketName: "cms-media",
        provider: "supabase_bucket",
        supportsLibrary: true,
      }),
    );
  });

  it("builds adapter-driven sidebar field specs with ui and editability metadata", async () => {
    const mapping = createMappedProjectMapping();

    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });

    const sidebarFieldSpecs = await adapter.loadSidebarFieldSpecs?.();

    expect(sidebarFieldSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          allowedValues: null,
          defaultParentId: null,
          description: "Edit the URL slug for this post.",
          editabilityState: "editable",
          fieldKey: "slug",
          label: "URL Slug",
          multiple: false,
          nullable: true,
          patchMode: "key_patch",
          readOnly: false,
          relationMode: "none",
          required: false,
          searchMode: "none",
          sidebarFieldId: "slug",
          uiControl: "text_input",
          valueKind: "text_like",
          visible: true,
        }),
        expect.objectContaining({
          defaultParentId: null,
          editabilityState: "coercible",
          fieldKey: "publishedAt",
          readOnly: false,
          sidebarFieldId: "published_at",
          uiControl: "datetime_picker",
        }),
        expect.objectContaining({
          defaultParentId: "meta-fields",
          fieldKey: "seoTitle",
          patchMode: "key_patch",
          sidebarFieldId: "meta_title",
        }),
        expect.objectContaining({
          defaultParentId: "custom-fields",
          fieldKey: "reading_time_minutes",
          nullable: true,
          required: false,
          sidebarFieldId: "custom_field:reading_time_minutes",
          uiControl: "number_input",
          valueKind: "number",
        }),
      ]),
    );

    expect(adapter.getCapabilitySummary()).toEqual(
      expect.objectContaining({
        fieldSpecs: expect.arrayContaining([
          expect.objectContaining({
            editabilityState: "read_only",
            fieldKey: "createdAt",
            readOnly: true,
            uiControl: "datetime_picker",
            valueKind: "datetime",
          }),
          expect.objectContaining({
            contentFormat: null,
            editabilityState: "editable",
            fieldKey: "title",
            label: "Title",
            patchMode: "replace",
            readOnly: false,
            uiControl: "text_input",
            valueKind: "text_like",
          }),
          expect.objectContaining({
            contentFormat: "html",
            editabilityState: "editable",
            fieldKey: "content",
            isCustomField: false,
            label: "Content",
            uiControl: "content_editor",
            valueKind: "content",
          }),
          expect.objectContaining({
            editabilityState: "coercible",
            fieldKey: "status",
            label: "Status",
            readOnly: false,
            uiControl: "text_input",
            valueKind: "text_like",
          }),
        expect.objectContaining({
          editabilityState: "editable",
          fieldKey: "updatedAt",
          isCustomField: false,
          readOnly: false,
          uiControl: "datetime_picker",
          valueKind: "datetime",
        }),
          expect.objectContaining({
            editabilityState: "editable",
            fieldKey: "reading_time_minutes",
            isCustomField: true,
            label: "Reading time",
            uiControl: "number_input",
            valueKind: "number",
          }),
        ]),
        sidebarFieldSpecs: expect.arrayContaining([
          expect.objectContaining({
            fieldKey: "slug",
            sidebarFieldId: "slug",
          }),
          expect.objectContaining({
            fieldKey: "reading_time_minutes",
            isCustomField: true,
            sidebarFieldId: "custom_field:reading_time_minutes",
          }),
        ]),
      }),
    );
  });

  it("covers editable, coercible, read-only, and unsupported adapter field states", () => {
    const baseMapping = createMappedProjectMapping();
    const mapping = normalizeContentProjectMapping({
      ...baseMapping,
      mappingConfig: {
        ...baseMapping.mappingConfig,
        entities: {
          ...baseMapping.mappingConfig.entities,
          posts: {
            ...baseMapping.mappingConfig.entities.posts,
            relations: {
              ...baseMapping.mappingConfig.entities.posts.relations,
              authors: {
                ...baseMapping.mappingConfig.entities.posts.relations.authors!,
                multiple: true,
              },
            },
          },
        },
      },
    });

    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const summary = adapter.getCapabilitySummary();

    expect(summary.fieldSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          editabilityState: "editable",
          fieldKey: "title",
          patchMode: "replace",
          readOnly: false,
        }),
        expect.objectContaining({
          editabilityState: "coercible",
          fieldKey: "status",
          patchMode: "replace",
          readOnly: false,
        }),
        expect.objectContaining({
          editabilityState: "read_only",
          fieldKey: "createdAt",
          patchMode: "no_write",
          readOnly: true,
        }),
        expect.objectContaining({
          editabilityState: "unsupported",
          fieldKey: "author",
          patchMode: "no_write",
          readOnly: true,
          searchMode: "none",
          uiControl: "read_only",
        }),
      ]),
    );

    expect(summary.sidebarFieldSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          editabilityState: "editable",
          fieldKey: "slug",
          readOnly: false,
          sidebarFieldId: "slug",
        }),
        expect.objectContaining({
          editabilityState: "editable",
          fieldKey: "updatedAt",
          readOnly: false,
          sidebarFieldId: "updated_at",
        }),
        expect.objectContaining({
          editabilityState: "unsupported",
          fieldKey: "author",
          readOnly: true,
          sidebarFieldId: "author",
          uiControl: "read_only",
        }),
      ]),
    );
  });

  it("derives mapped-content post field availability from visible adapter field specs", () => {
    const mapping = normalizeContentProjectMapping({
      ...createMappedProjectMapping(),
      mappingConfig: {
        ...createMappedProjectMapping().mappingConfig,
        entities: {
          ...createMappedProjectMapping().mappingConfig.entities,
          posts: {
            ...createMappedProjectMapping().mappingConfig.entities.posts,
            fields: {
              ...createMappedProjectMapping().mappingConfig.entities.posts.fields,
              excerpt: {
                ...createMappedProjectMapping().mappingConfig.entities.posts.fields.excerpt,
                visible: false,
              },
            },
          },
        },
      },
    });

    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });

    const summary = adapter.getCapabilitySummary();
    const mappedPostFields = getContentPostFieldAvailabilityFromFieldSpecs({
      fieldSpecs: summary.fieldSpecs ?? [],
    });

    expect(summary.fieldSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "excerpt",
          visible: false,
        }),
      ]),
    );
    expect(mappedPostFields.excerpt).toBe(false);
    expect(mappedPostFields.title).toBe(true);
  });

  it("builds adapter-driven specs for supported custom scalar field kinds", () => {
    const baseMapping = createMappedProjectMapping();
    const mapping = normalizeContentProjectMapping({
      ...baseMapping,
      mappingConfig: {
        ...baseMapping.mappingConfig,
        entities: {
          ...baseMapping.mappingConfig.entities,
          posts: {
            ...baseMapping.mappingConfig.entities.posts,
            customFields: [
              {
                allowedValues: null,
                column: "subtitle",
                dataType: "text",
                defaultValue: null,
                enabled: true,
                isNullable: true,
                kind: "text",
                label: "Subtitle",
                sampleValues: [],
              },
              {
                allowedValues: null,
                column: "notes",
                dataType: "text",
                defaultValue: null,
                enabled: true,
                isNullable: true,
                kind: "plain_text",
                label: "Notes",
                sampleValues: [],
              },
              {
                allowedValues: null,
                column: "is_featured",
                dataType: "boolean",
                defaultValue: null,
                enabled: true,
                isNullable: true,
                kind: "boolean",
                label: "Featured",
                sampleValues: [],
              },
              {
                allowedValues: null,
                column: "publish_on",
                dataType: "date",
                defaultValue: null,
                enabled: true,
                isNullable: true,
                kind: "date",
                label: "Publish On",
                sampleValues: [],
              },
              {
                allowedValues: null,
                column: "event_at",
                dataType: "timestamp with time zone",
                defaultValue: null,
                enabled: true,
                isNullable: true,
                kind: "datetime",
                label: "Event At",
                sampleValues: [],
              },
              {
                allowedValues: ["everyone", "members"],
                column: "audience",
                dataType: "text",
                defaultValue: null,
                enabled: true,
                isNullable: false,
                kind: "enum",
                label: "Audience",
                sampleValues: [],
              },
              {
                allowedValues: null,
                column: "metadata",
                dataType: "jsonb",
                defaultValue: null,
                enabled: true,
                isNullable: true,
                kind: "json",
                label: "Metadata",
                sampleValues: [],
              },
              {
                allowedValues: null,
                column: "aliases",
                dataType: "text[]",
                defaultValue: null,
                enabled: true,
                isNullable: true,
                kind: "array",
                label: "Aliases",
                sampleValues: [],
              },
            ],
          },
        },
      },
    });

    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });

    const customFieldSpecs = adapter
      .getCapabilitySummary()
      .fieldSpecs.filter((fieldSpec) => fieldSpec.isCustomField);

    expect(customFieldSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "subtitle",
          uiControl: "text_input",
          valueKind: "text_like",
        }),
        expect.objectContaining({
          fieldKey: "notes",
          uiControl: "textarea",
          valueKind: "long_text",
        }),
        expect.objectContaining({
          fieldKey: "is_featured",
          uiControl: "toggle",
          valueKind: "boolean",
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
          allowedValues: ["everyone", "members"],
          fieldKey: "audience",
          required: true,
          uiControl: "dropdown",
          valueKind: "enum",
        }),
        expect.objectContaining({
          fieldKey: "metadata",
          contentFormat: "json",
          uiControl: "structured_editor",
          valueKind: "json_object",
        }),
        expect.objectContaining({
          fieldKey: "aliases",
          multiple: true,
          uiControl: "token_input",
          valueKind: "array_scalar",
        }),
      ]),
    );

    const customSidebarFieldSpecs = adapter
      .getCapabilitySummary()
      .sidebarFieldSpecs.filter((fieldSpec) => fieldSpec.isCustomField);

    expect(customSidebarFieldSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "aliases",
          multiple: true,
          sidebarFieldId: "custom_field:aliases",
          uiControl: "token_input",
          valueKind: "array_scalar",
        }),
      ]),
    );
  });

  it("marks explicit array-backed scalar fields as multi-value adapter specs", () => {
    const baseMapping = createMappedProjectMapping();
    const mapping = normalizeContentProjectMapping({
      ...baseMapping,
      mappingConfig: {
        ...baseMapping.mappingConfig,
        entities: {
          ...baseMapping.mappingConfig.entities,
          posts: {
            ...baseMapping.mappingConfig.entities.posts,
            fields: {
              ...baseMapping.mappingConfig.entities.posts.fields,
              excerpt: {
                column: "summary_tokens",
                kind: "array",
                label: "Excerpt",
                path: null,
                required: false,
                visible: true,
              },
            },
          },
        },
      },
    });

    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const summary = adapter.getCapabilitySummary();

    expect(summary.fieldSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "excerpt",
          multiple: true,
          uiControl: "token_input",
          valueKind: "array_scalar",
        }),
      ]),
    );

    expect(summary.sidebarFieldSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "excerpt",
          multiple: true,
          sidebarFieldId: "excerpt",
          uiControl: "token_input",
          valueKind: "array_scalar",
        }),
      ]),
    );
  });

  it("builds adapter-driven specs for supported custom relation field kinds", () => {
    const mapping = createMappedProjectMapping({
      customRelationFields: [
        {
          enabled: true,
          fieldKey: "sponsor_author_id",
          isNullable: true,
          kind: "single_relation",
          label: "Sponsor Author",
          relation: {
            fieldMap: { name: "name" },
            junctionSourceColumn: null,
            junctionTable: null,
            junctionTargetColumn: null,
            multiple: false,
            sourceColumn: "sponsor_author_id",
            status: "mapped",
            strategy: "foreign_key",
            targetColumn: "id",
            targetEntity: "authors",
            targetTable: null,
            valueColumn: null,
          },
        },
        {
          enabled: true,
          fieldKey: "related_post_ids",
          isNullable: true,
          kind: "self_reference_multi",
          label: "Related Posts",
          relation: {
            fieldMap: { title: "title" },
            junctionSourceColumn: "post_id",
            junctionTable: "post_related_posts",
            junctionTargetColumn: "related_post_id",
            multiple: true,
            sourceColumn: null,
            status: "mapped",
            strategy: "join_table",
            targetColumn: "id",
            targetEntity: "posts",
            targetTable: null,
            valueColumn: null,
          },
        },
        {
          enabled: true,
          fieldKey: "featured_category_slugs",
          isNullable: true,
          kind: "value_match_relation",
          label: "Featured Categories",
          relation: {
            fieldMap: { name: "name" },
            junctionSourceColumn: null,
            junctionTable: null,
            junctionTargetColumn: null,
            multiple: true,
            sourceColumn: "featured_category_slugs",
            status: "mapped",
            strategy: "value_match_relation",
            targetColumn: "slug",
            targetEntity: "categories",
            targetTable: null,
            valueColumn: null,
          },
        },
        {
          enabled: true,
          fieldKey: "hero_media_id",
          isNullable: true,
          kind: "media_relation_single",
          label: "Hero Media",
          relation: {
            fieldMap: { title: "title" },
            junctionSourceColumn: null,
            junctionTable: null,
            junctionTargetColumn: null,
            multiple: false,
            sourceColumn: "hero_media_id",
            status: "mapped",
            strategy: "foreign_key",
            targetColumn: "id",
            targetEntity: "media",
            targetTable: null,
            valueColumn: null,
          },
        },
        {
          enabled: true,
          fieldKey: "gallery_media_ids",
          isNullable: true,
          kind: "media_relation_multi",
          label: "Gallery Media",
          relation: {
            fieldMap: { title: "title" },
            junctionSourceColumn: "post_id",
            junctionTable: "post_media",
            junctionTargetColumn: "media_id",
            multiple: true,
            sourceColumn: null,
            status: "mapped",
            strategy: "join_table",
            targetColumn: "id",
            targetEntity: "media",
            targetTable: null,
            valueColumn: null,
          },
        },
        {
          enabled: true,
          fieldKey: "attachment_file_id",
          isNullable: true,
          kind: "file_relation_single",
          label: "Attachment File",
          relation: {
            fieldMap: { title: "title" },
            junctionSourceColumn: null,
            junctionTable: null,
            junctionTargetColumn: null,
            multiple: false,
            sourceColumn: "attachment_file_id",
            status: "mapped",
            strategy: "foreign_key",
            targetColumn: "id",
            targetEntity: "files",
            targetTable: null,
            valueColumn: null,
          },
        },
        {
          enabled: true,
          fieldKey: "reference_file_ids",
          isNullable: true,
          kind: "file_relation_multi",
          label: "Reference Files",
          relation: {
            fieldMap: { title: "title" },
            junctionSourceColumn: "post_id",
            junctionTable: "post_files",
            junctionTargetColumn: "file_id",
            multiple: true,
            sourceColumn: null,
            status: "mapped",
            strategy: "join_table",
            targetColumn: "id",
            targetEntity: "files",
            targetTable: null,
            valueColumn: null,
          },
        },
      ],
    });

    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });

    const summary = adapter.getCapabilitySummary();

    expect(summary.fieldSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "sponsor_author_id",
          isCustomField: true,
          label: "Sponsor Author",
          multiple: false,
          relationMode: "managed_single",
          relationTargetEntity: "authors",
          searchMode: "remote",
          uiControl: "single_select",
          valueKind: "relation_id_or_key",
        }),
        expect.objectContaining({
          fieldKey: "related_post_ids",
          isCustomField: true,
          label: "Related Posts",
          multiple: true,
          relationMode: "managed_multi",
          relationTargetEntity: "posts",
          searchMode: "remote",
          uiControl: "multi_select",
          valueKind: "relation_id_or_key",
        }),
        expect.objectContaining({
          fieldKey: "featured_category_slugs",
          isCustomField: true,
          label: "Featured Categories",
          multiple: true,
          relationMode: "value_match_multi",
          relationTargetEntity: "categories",
          searchMode: "remote",
          uiControl: "multi_select",
          valueKind: "relation_id_or_key",
        }),
        expect.objectContaining({
          fieldKey: "hero_media_id",
          isCustomField: true,
          label: "Hero Media",
          multiple: false,
          relationMode: "managed_single",
          relationTargetEntity: "media",
          searchMode: "remote",
          uiControl: "single_select",
          valueKind: "relation_id_or_key",
        }),
        expect.objectContaining({
          fieldKey: "gallery_media_ids",
          isCustomField: true,
          label: "Gallery Media",
          multiple: true,
          relationMode: "managed_multi",
          relationTargetEntity: "media",
          searchMode: "remote",
          uiControl: "multi_select",
          valueKind: "relation_id_or_key",
        }),
        expect.objectContaining({
          fieldKey: "attachment_file_id",
          isCustomField: true,
          label: "Attachment File",
          multiple: false,
          relationMode: "managed_single",
          relationTargetEntity: "files",
          searchMode: "remote",
          uiControl: "single_select",
          valueKind: "relation_id_or_key",
        }),
        expect.objectContaining({
          fieldKey: "reference_file_ids",
          isCustomField: true,
          label: "Reference Files",
          multiple: true,
          relationMode: "managed_multi",
          relationTargetEntity: "files",
          searchMode: "remote",
          uiControl: "multi_select",
          valueKind: "relation_id_or_key",
        }),
      ]),
    );
    expect(summary.sidebarFieldSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sidebarFieldId: "custom_field:sponsor_author_id",
          relationTargetEntity: "authors",
          uiControl: "single_select",
        }),
        expect.objectContaining({
          sidebarFieldId: "custom_field:related_post_ids",
          relationTargetEntity: "posts",
          uiControl: "multi_select",
        }),
        expect.objectContaining({
          sidebarFieldId: "custom_field:hero_media_id",
          relationTargetEntity: "media",
          uiControl: "single_select",
        }),
        expect.objectContaining({
          sidebarFieldId: "custom_field:gallery_media_ids",
          relationTargetEntity: "media",
          uiControl: "multi_select",
        }),
        expect.objectContaining({
          sidebarFieldId: "custom_field:attachment_file_id",
          relationTargetEntity: "files",
          uiControl: "single_select",
        }),
        expect.objectContaining({
          sidebarFieldId: "custom_field:reference_file_ids",
          relationTargetEntity: "files",
          uiControl: "multi_select",
        }),
      ]),
    );
  });

  it("builds enum-list specs for allowed-value custom array fields", () => {
    const baseMapping = createMappedProjectMapping();
    const mapping = normalizeContentProjectMapping({
      ...baseMapping,
      mappingConfig: {
        ...baseMapping.mappingConfig,
        entities: {
          ...baseMapping.mappingConfig.entities,
          posts: {
            ...baseMapping.mappingConfig.entities.posts,
            customFields: [
              ...baseMapping.mappingConfig.entities.posts.customFields,
              {
                allowedValues: ["everyone", "members"],
                column: "audience_segments",
                dataType: "text[]",
                defaultValue: null,
                enabled: true,
                isNullable: true,
                kind: "array",
                label: "Audience Segments",
                sampleValues: [],
              },
            ],
          },
        },
      },
    });

    const compiled = compileContentProjectMappingToAdapterInstructions(mapping);
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const summary = adapter.getCapabilitySummary();
    const customFieldSpec = summary.fieldSpecs?.find((fieldSpec) => fieldSpec.fieldKey === "audience_segments");
    const sidebarFieldSpec = summary.sidebarFieldSpecs?.find(
      (fieldSpec) => fieldSpec.fieldKey === "audience_segments",
    );

    expect(compiled.customScalarFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "audience_segments",
          storagePrimitive: "array_value",
          valueKind: "enum_list",
        }),
      ]),
    );
    expect(customFieldSpec).toMatchObject({
      allowedValues: ["everyone", "members"],
      fieldKey: "audience_segments",
      multiple: true,
      uiControl: "token_input",
      valueKind: "enum_list",
    });
    expect(sidebarFieldSpec).toMatchObject({
      allowedValues: ["everyone", "members"],
      fieldKey: "audience_segments",
      multiple: true,
      uiControl: "token_input",
      valueKind: "enum_list",
    });
  });

  it("builds editable xml field specs as structured editors instead of exotic read-only fields", () => {
    const baseMapping = createMappedProjectMapping();
    const mapping = normalizeContentProjectMapping({
      ...baseMapping,
      mappingConfig: {
        ...baseMapping.mappingConfig,
        entities: {
          ...baseMapping.mappingConfig.entities,
          posts: {
            ...baseMapping.mappingConfig.entities.posts,
            customFields: [
              ...baseMapping.mappingConfig.entities.posts.customFields,
              {
                allowedValues: null,
                column: "rss_payload",
                dataType: "xml",
                defaultValue: null,
                enabled: true,
                isNullable: true,
                kind: "plain_text",
                label: "RSS Payload",
                sampleValues: [],
              },
            ],
          },
        },
      },
    });

    const compiled = compileContentProjectMappingToAdapterInstructions(mapping);
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const customFieldSpec = adapter
      .getCapabilitySummary()
      .fieldSpecs.find((fieldSpec) => fieldSpec.fieldKey === "rss_payload");

    expect(compiled.customScalarFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          editabilityState: "editable",
          fieldKey: "rss_payload",
          valueKind: "long_text",
        }),
      ]),
    );
    expect(customFieldSpec).toMatchObject({
      contentFormat: "xml",
      editabilityState: "editable",
      fieldKey: "rss_payload",
      readOnly: false,
      uiControl: "structured_editor",
      valueKind: "long_text",
    });
  });

  it("builds range and multirange field specs as editable literal controls", () => {
    const baseMapping = createMappedProjectMapping();
    const mapping = normalizeContentProjectMapping({
      ...baseMapping,
      mappingConfig: {
        ...baseMapping.mappingConfig,
        entities: {
          ...baseMapping.mappingConfig.entities,
          posts: {
            ...baseMapping.mappingConfig.entities.posts,
            customFields: [
              ...baseMapping.mappingConfig.entities.posts.customFields,
              {
                allowedValues: null,
                column: "availability_window",
                dataType: "int4range",
                defaultValue: null,
                enabled: true,
                isNullable: true,
                kind: "number",
                label: "Availability Window",
                sampleValues: [],
              },
              {
                allowedValues: null,
                column: "season_windows",
                dataType: "tstzmultirange",
                defaultValue: null,
                enabled: true,
                isNullable: true,
                kind: "plain_text",
                label: "Season Windows",
                sampleValues: [],
              },
            ],
          },
        },
      },
    });

    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const summary = adapter.getCapabilitySummary();

    expect(summary.fieldSpecs?.find((fieldSpec) => fieldSpec.fieldKey === "availability_window")).toMatchObject({
      editabilityState: "editable",
      fieldKey: "availability_window",
      readOnly: false,
      uiControl: "range_input",
      valueKind: "text_like",
    });
    expect(summary.fieldSpecs?.find((fieldSpec) => fieldSpec.fieldKey === "season_windows")).toMatchObject({
      editabilityState: "editable",
      fieldKey: "season_windows",
      readOnly: false,
      uiControl: "multirange_editor",
      valueKind: "long_text",
    });
  });

  it("builds parent-page relation specs from self-referential post mappings", () => {
    const baseMapping = createMappedProjectMapping();
    const mapping = normalizeContentProjectMapping({
      ...baseMapping,
      mappingConfig: {
        ...baseMapping.mappingConfig,
        entities: {
          ...baseMapping.mappingConfig.entities,
          posts: {
            ...baseMapping.mappingConfig.entities.posts,
            relations: {
              ...baseMapping.mappingConfig.entities.posts.relations,
              posts: {
                fieldMap: { title: "title" },
                junctionSourceColumn: null,
                junctionTable: null,
                junctionTargetColumn: null,
                multiple: false,
                sourceColumn: "parent_post_id",
                status: "mapped",
                strategy: "foreign_key",
                targetColumn: "id",
                targetEntity: "posts",
                targetTable: null,
                valueColumn: null,
              },
            },
          },
        },
      },
    });

    const compiled = compileContentProjectMappingToAdapterInstructions(mapping);

    expect(compiled.relationFields.parentPage).toMatchObject({
      fieldKey: "parentPage",
      sourceColumn: "parent_post_id",
      storagePrimitive: "foreign_key",
      targetEntity: "posts",
    });

    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const summary = adapter.getCapabilitySummary();

    expect(summary.fieldSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "parentPage",
          relationMode: "managed_single",
          searchMode: "remote",
          uiControl: "single_select",
          valueKind: "relation_id_or_key",
        }),
      ]),
    );

    expect(summary.sidebarFieldSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "parentPage",
          label: "Parent Page",
          sidebarFieldId: "parent_page",
        }),
      ]),
    );
  });

  it("builds single-select taxonomy specs from single-value relation storage", () => {
    const baseMapping = createMappedProjectMapping();
    const mapping = normalizeContentProjectMapping({
      ...baseMapping,
      mappingConfig: {
        ...baseMapping.mappingConfig,
        entities: {
          ...baseMapping.mappingConfig.entities,
          posts: {
            ...baseMapping.mappingConfig.entities.posts,
            relations: {
              ...baseMapping.mappingConfig.entities.posts.relations,
              categories: {
                fieldMap: { name: "name" },
                junctionSourceColumn: null,
                junctionTable: null,
                junctionTargetColumn: null,
                multiple: true,
                sourceColumn: "category_id",
                status: "mapped",
                strategy: "foreign_key",
                targetColumn: "id",
                targetEntity: "categories",
                targetTable: null,
                valueColumn: null,
              },
              tags: {
                fieldMap: { name: "name" },
                junctionSourceColumn: "post_id",
                junctionTable: "public.post_tag_helper",
                junctionTargetColumn: null,
                multiple: true,
                sourceColumn: null,
                status: "mapped",
                strategy: "join_row",
                targetColumn: "id",
                targetEntity: "tags",
                targetTable: null,
                valueColumn: "tag_id",
              },
            },
          },
        },
      },
    });

    const compiled = compileContentProjectMappingToAdapterInstructions(mapping);
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const summary = adapter.getCapabilitySummary();

    expect(compiled.relationFields.categories).toMatchObject({
      editabilityState: "editable",
      fieldKey: "categories",
      multiple: false,
      relationMode: "managed_single",
      sourceColumn: "category_id",
      storagePrimitive: "foreign_key",
    });
    expect(compiled.relationFields.tags).toMatchObject({
      editabilityState: "editable",
      fieldKey: "tags",
      junctionSourceColumn: "post_id",
      junctionTable: "public.post_tag_helper",
      multiple: false,
      relationMode: "managed_single",
      storagePrimitive: "join_row",
      valueColumn: "tag_id",
    });

    expect(summary.fieldSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          editabilityState: "editable",
          fieldKey: "categories",
          multiple: false,
          patchMode: "link_replace",
          relationMode: "managed_single",
          searchMode: "remote",
          uiControl: "single_select",
        }),
        expect.objectContaining({
          editabilityState: "editable",
          fieldKey: "tags",
          multiple: false,
          patchMode: "link_replace",
          relationMode: "managed_single",
          searchMode: "remote",
          uiControl: "single_select",
        }),
      ]),
    );
  });

  it("marks invalid or inline relation mappings as honest non-selector field specs", () => {
    const baseMapping = createMappedProjectMapping();
    const mapping = normalizeContentProjectMapping({
      ...baseMapping,
      mappingConfig: {
        ...baseMapping.mappingConfig,
        entities: {
          ...baseMapping.mappingConfig.entities,
          posts: {
            ...baseMapping.mappingConfig.entities.posts,
            relations: {
              authors: {
                fieldMap: { name: "name" },
                junctionSourceColumn: null,
                junctionTable: null,
                junctionTargetColumn: null,
                multiple: true,
                sourceColumn: "author_id",
                status: "mapped",
                strategy: "foreign_key",
                targetColumn: "id",
                targetEntity: "authors",
                targetTable: null,
                valueColumn: null,
              },
              categories: {
                fieldMap: { name: "name" },
                junctionSourceColumn: "post_id",
                junctionTable: "post_categories",
                junctionTargetColumn: "category_id",
                multiple: false,
                sourceColumn: null,
                status: "mapped",
                strategy: "join_table",
                targetColumn: "id",
                targetEntity: "categories",
                targetTable: null,
                valueColumn: null,
              },
              tags: {
                fieldMap: { name: "tag_name" },
                junctionSourceColumn: null,
                junctionTable: null,
                junctionTargetColumn: null,
                multiple: false,
                sourceColumn: "tag_name",
                status: "mapped",
                strategy: "inline_fields",
                targetColumn: "id",
                targetEntity: "tags",
                targetTable: null,
                valueColumn: null,
              },
            },
          },
        },
      },
    });

    const compiled = compileContentProjectMappingToAdapterInstructions(mapping);

    expect(compiled.relationFields.author).toMatchObject({
      editabilityState: "unsupported",
      fieldKey: "author",
      multiple: true,
      storagePrimitive: "foreign_key",
    });
    expect(compiled.relationFields.categories).toMatchObject({
      editabilityState: "unsupported",
      fieldKey: "categories",
      multiple: false,
      storagePrimitive: "join_table",
    });
    expect(compiled.relationFields.tags).toMatchObject({
      editabilityState: "read_only",
      fieldKey: "tags",
      relationMode: "inline",
      storagePrimitive: "direct_column",
    });

    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const summary = adapter.getCapabilitySummary();

    expect(summary.fieldSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          editabilityState: "unsupported",
          fieldKey: "author",
          patchMode: "no_write",
          readOnly: true,
          searchMode: "none",
          uiControl: "read_only",
        }),
        expect.objectContaining({
          editabilityState: "unsupported",
          fieldKey: "categories",
          patchMode: "no_write",
          readOnly: true,
          searchMode: "none",
          uiControl: "read_only",
        }),
        expect.objectContaining({
          editabilityState: "read_only",
          fieldKey: "tags",
          patchMode: "no_write",
          readOnly: true,
          relationMode: "inline",
          searchMode: "none",
          uiControl: "read_only",
        }),
      ]),
    );
  });

  it("degrades unsafe workflow mappings to read-only workflow field specs", () => {
    const baseMapping = createMappedProjectMapping();
    const mapping = normalizeContentProjectMapping({
      ...baseMapping,
      mappingConfig: {
        ...baseMapping.mappingConfig,
        entities: {
          ...baseMapping.mappingConfig.entities,
          posts: {
            ...baseMapping.mappingConfig.entities.posts,
            workflow: {
              ...baseMapping.mappingConfig.entities.posts.workflow,
              draftValues: [],
              publishedValues: [],
            },
          },
        },
      },
    });

    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });

    const summary = adapter.getCapabilitySummary();
    const mappedPostFields = getContentPostFieldAvailabilityFromFieldSpecs({
      customFields: summary.customFields,
      fieldSpecs: summary.fieldSpecs ?? [],
    });
    const statusFieldSpec = summary.fieldSpecs?.find((fieldSpec) => fieldSpec.fieldKey === "status");
    const publishedAtFieldSpec = summary.fieldSpecs?.find((fieldSpec) => fieldSpec.fieldKey === "publishedAt");

    expect(statusFieldSpec).toMatchObject({
      editabilityState: "read_only",
      readOnly: true,
    });
    expect(publishedAtFieldSpec).toMatchObject({
      editabilityState: "read_only",
      readOnly: true,
    });
    expect(mappedPostFields.status).toBe(false);
    expect(mappedPostFields.publishedAt).toBe(true);
  });

  it("keeps unsafe createdAt and updatedAt mappings read-only", () => {
    const mapping = createMappedProjectMapping({
      fieldOverrides: {
        createdAt: { column: "created_epoch", kind: "number", label: "Created At" },
        updatedAt: { column: "audit_log", kind: "array", label: "Updated At" },
      },
    });

    const compiled = compileContentProjectMappingToAdapterInstructions(mapping);
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const summary = adapter.getCapabilitySummary();
    const createdAtFieldSpec = summary.fieldSpecs?.find((fieldSpec) => fieldSpec.fieldKey === "createdAt");
    const updatedAtFieldSpec = summary.fieldSpecs?.find((fieldSpec) => fieldSpec.fieldKey === "updatedAt");

    expect(compiled.scalarFields.createdAt).toMatchObject({
      editabilityState: "read_only",
      sourceColumn: "created_epoch",
      valueKind: "number",
    });
    expect(compiled.scalarFields.updatedAt).toMatchObject({
      editabilityState: "read_only",
      sourceColumn: "audit_log",
      storagePrimitive: "array_value",
      valueKind: "array_scalar",
    });
    expect(createdAtFieldSpec).toMatchObject({
      editabilityState: "read_only",
      fieldKey: "createdAt",
      readOnly: true,
      valueKind: "number",
    });
    expect(updatedAtFieldSpec).toMatchObject({
      editabilityState: "read_only",
      fieldKey: "updatedAt",
      readOnly: true,
      valueKind: "array_scalar",
    });
  });

  it("keeps writable updatedAt timestamp mappings editable", () => {
    const mapping = createMappedProjectMapping({
      fieldOverrides: {
        updatedAt: { column: "updated_at", kind: "datetime", label: "Updated At" },
      },
    });

    const compiled = compileContentProjectMappingToAdapterInstructions(mapping);
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const summary = adapter.getCapabilitySummary();
    const updatedAtFieldSpec = summary.fieldSpecs?.find((fieldSpec) => fieldSpec.fieldKey === "updatedAt");
    const updatedAtSidebarFieldSpec = summary.sidebarFieldSpecs?.find(
      (fieldSpec) => fieldSpec.sidebarFieldId === "updated_at",
    );

    expect(compiled.scalarFields.updatedAt).toMatchObject({
      editabilityState: "editable",
      fieldKey: "updatedAt",
      sourceColumn: "updated_at",
      storagePrimitive: "direct_column",
      valueKind: "datetime",
    });
    expect(updatedAtFieldSpec).toMatchObject({
      editabilityState: "editable",
      readOnly: false,
      uiControl: "datetime_picker",
    });
    expect(updatedAtSidebarFieldSpec).toMatchObject({
      editabilityState: "editable",
      readOnly: false,
      sidebarFieldId: "updated_at",
      uiControl: "datetime_picker",
    });
  });

  it("keeps trigger-managed publishedAt workflow mappings read-only", () => {
    const mapping = createMappedProjectMapping({
      fieldOverrides: {
        publishedAt: {
          column: "published_at",
          kind: "datetime",
          label: "Published At",
          timestampSourceHint: "trigger_managed",
        },
      },
    });

    const compiled = compileContentProjectMappingToAdapterInstructions(mapping);
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const summary = adapter.getCapabilitySummary();
    const publishedAtFieldSpec = summary.fieldSpecs?.find((fieldSpec) => fieldSpec.fieldKey === "publishedAt");

    expect(compiled.scalarFields.publishedAt).toMatchObject({
      editabilityState: "read_only",
      sourceColumn: "published_at",
    });
    expect(compiled.workflowFields.publishedAt).toMatchObject({
      editabilityState: "read_only",
      sourceColumn: "published_at",
    });
    expect(publishedAtFieldSpec).toMatchObject({
      editabilityState: "read_only",
      fieldKey: "publishedAt",
      readOnly: true,
    });
  });

  it("treats view-backed mappings as read-only adapter fields", () => {
    const baseMapping = createMappedProjectMapping();
    const mapping = normalizeContentProjectMapping({
      ...baseMapping,
      mappingConfig: {
        ...baseMapping.mappingConfig,
        entities: {
          ...baseMapping.mappingConfig.entities,
          posts: {
            ...baseMapping.mappingConfig.entities.posts,
            source: {
              ...baseMapping.mappingConfig.entities.posts.source,
              kind: "view",
            },
          },
        },
      },
    });

    const compiled = compileContentProjectMappingToAdapterInstructions(mapping);

    expect(compiled.scalarFields.title).toMatchObject({
      editabilityState: "read_only",
      sourceColumn: "headline",
    });
    expect(compiled.workflowFields.status).toMatchObject({
      editabilityState: "read_only",
      sourceColumn: "publication_state",
    });
    expect(compiled.workflowFields.publishedAt).toMatchObject({
      editabilityState: "read_only",
      sourceColumn: "published_at",
    });
  });

  it("treats view-backed structured fields as read-only adapter specs", () => {
    const baseMapping = createMappedProjectMapping();
    const mapping = normalizeContentProjectMapping({
      ...baseMapping,
      mappingConfig: {
        ...baseMapping.mappingConfig,
        entities: {
          ...baseMapping.mappingConfig.entities,
          posts: {
            ...baseMapping.mappingConfig.entities.posts,
            source: {
              ...baseMapping.mappingConfig.entities.posts.source,
              kind: "view",
            },
          },
        },
      },
    });

    const compiled = compileContentProjectMappingToAdapterInstructions(mapping);
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const contentFieldSpec = adapter
      .getCapabilitySummary()
      .fieldSpecs.find((fieldSpec) => fieldSpec.fieldKey === "content");

    expect(compiled.structuredFields.content).toMatchObject({
      editabilityState: "read_only",
      fieldKey: "content",
      storagePrimitive: "direct_column",
    });
    expect(contentFieldSpec).toMatchObject({
      editabilityState: "read_only",
      fieldKey: "content",
      patchMode: "no_write",
      readOnly: true,
    });
  });
});
