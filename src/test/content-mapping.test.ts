import { describe, expect, it } from "vitest";

import {
  createDefaultContentMappingConfig,
  getContentMappingDuplicateColumnIssues,
  normalizeContentMappingConfig,
  normalizeContentProjectMapping,
} from "@/lib/content-runtime/mapping";

describe("content mapping", () => {
  it("creates a default mapping config with all canonical entities", () => {
    const config = createDefaultContentMappingConfig();

    expect(config.version).toBe(1);
    expect(Object.keys(config.entities)).toEqual([
      "posts",
      "categories",
      "tags",
      "authors",
      "media",
      "files",
    ]);
    expect(config.entities.posts.status).toBe("unmapped");
    expect(config.entities.posts.editorFields).toEqual([
      expect.objectContaining({
        id: "content",
        kind: "rich_text",
        label: "Content",
      }),
    ]);
    expect(config.entities.posts.relations.authors).toEqual(
      expect.objectContaining({
        multiple: false,
        strategy: "none",
        targetEntity: "authors",
      }),
    );
    expect(config.filesStorage).toBeNull();
    expect(config.mediaStorage).toBeNull();
  });

  it("normalizes partial mapping config input and preserves canonical defaults", () => {
    const config = normalizeContentMappingConfig({
      entities: {
        posts: {
          editorFields: [
            {
              column: "intro_html",
              id: "intro",
              kind: "rich_text",
              label: "Intro",
            },
            {
              column: "outro_markdown",
              id: "outro",
              kind: "markdown",
              label: "Outro",
            },
          ],
          fields: {
            title: {
              column: "headline",
              kind: "text",
              label: "Headline",
              required: true,
            },
          },
          source: {
            kind: "table",
            primaryKey: "id",
            schema: "public",
            table: "blog_posts",
          },
          status: "mapped",
          workflow: {
            draftValues: ["draft", "review"],
            mode: "status",
            publishedValues: ["published", "live"],
            statusColumn: "publication_state",
          },
        },
      },
      version: 2,
    });

    expect(config.version).toBe(2);
    expect(config.entities.posts.status).toBe("mapped");
    expect(config.entities.posts.source).toEqual(
      expect.objectContaining({
        kind: "table",
        primaryKey: "id",
        schema: "public",
        table: "blog_posts",
      }),
    );
    expect(config.entities.posts.fields.title).toEqual(
      expect.objectContaining({
        column: "headline",
        label: "Headline",
        required: true,
      }),
    );
    expect(config.entities.posts.fields.slug).toEqual(
      expect.objectContaining({
        column: null,
        kind: "slug",
        label: "Slug",
      }),
    );
    expect(config.entities.posts.editorFields).toEqual([
      expect.objectContaining({
        column: "intro_html",
        id: "intro",
        kind: "rich_text",
      }),
      expect.objectContaining({
        column: "outro_markdown",
        id: "outro",
        kind: "markdown",
      }),
    ]);
    expect(config.entities.posts.workflow).toEqual(
      expect.objectContaining({
        draftValues: ["draft", "review"],
        publishedValues: ["published", "live"],
        statusColumn: "publication_state",
      }),
    );
    expect(config.entities.categories.fields.name.label).toBe("Name");
    expect(config.entities.media.status).toBe("unmapped");
    expect(config.entities.files.status).toBe("unmapped");
  });

  it("normalizes explicit storage placement metadata", () => {
    const config = normalizeContentMappingConfig({
      entities: {
        posts: {
          customFields: [
            {
              column: "metadata",
              dataType: "jsonb",
              enabled: true,
              kind: "json",
              label: "Summary",
              path: "summary",
            },
          ],
          fields: {
            excerpt: {
              column: "metadata",
              kind: "json",
              label: "Summary",
              path: "summary",
              semanticRole: "excerpt",
            },
          },
          relations: {
            tags: {
              fieldMap: {},
              junctionSourceColumn: null,
              junctionTable: null,
              junctionTargetColumn: null,
              multiple: true,
              semanticRole: "tags",
              sourceColumn: null,
              status: "mapped",
              strategy: "json_array",
              targetColumn: null,
              targetEntity: "tags",
              targetTable: null,
              valueColumn: null,
            },
          },
        },
      },
      version: 1,
    });

    expect(config.entities.posts.fields.excerpt.storagePrimitive).toBe("json_path");
    expect(config.entities.posts.fields.excerpt.semanticRole).toBe("excerpt");
    expect(config.entities.posts.customFields[0]?.storagePrimitive).toBe("json_path");
    expect(config.entities.posts.relations.tags?.storagePrimitive).toBe("json_path");
    expect(config.entities.posts.relations.tags?.semanticRole).toBe("tags");
  });

  it("repairs stale relation storage primitives when the relation strategy changes", () => {
    const config = normalizeContentMappingConfig({
      entities: {
        posts: {
          relations: {
            categories: {
              fieldMap: {},
              junctionSourceColumn: "post_id",
              junctionTable: "public.post_categories",
              junctionTargetColumn: "category_id",
              multiple: true,
              sourceColumn: null,
              status: "mapped",
              storagePrimitive: "derived_read_only",
              strategy: "join_table",
              targetColumn: "id",
              targetEntity: "categories",
              targetTable: "public.categories",
              valueColumn: null,
            },
            tags: {
              fieldMap: {},
              junctionSourceColumn: "post_id",
              junctionTable: "public.post_tags",
              junctionTargetColumn: "tag_id",
              multiple: true,
              sourceColumn: null,
              status: "mapped",
              storagePrimitive: "derived_read_only",
              strategy: "join_table",
              targetColumn: "id",
              targetEntity: "tags",
              targetTable: "public.tags",
              valueColumn: null,
            },
          },
        },
      },
    });

    expect(config.entities.posts.relations.categories?.storagePrimitive).toBe("join_table");
    expect(config.entities.posts.relations.tags?.storagePrimitive).toBe("join_table");
  });

  it("normalizes helper-row relation sources on editor fields", () => {
    const config = normalizeContentMappingConfig({
      entities: {
        posts: {
          editorFields: [
            {
              column: null,
              id: "content_helper",
              kind: "html",
              label: "Content",
              sourceRelation: {
                junctionSourceColumn: "post_id",
                junctionTable: "public.post_content_helper",
                sourceColumn: null,
                strategy: "related_row_by_post_id",
                targetColumn: null,
                targetTable: null,
                valueColumn: "body_html",
              },
            },
          ],
        },
      },
    });

    expect(config.entities.posts.editorFields[0]).toEqual(
      expect.objectContaining({
        column: null,
        id: "content_helper",
        sourceRelation: {
          junctionSourceColumn: "post_id",
          junctionTable: "public.post_content_helper",
          sourceColumn: null,
          strategy: "related_row_by_post_id",
          targetColumn: null,
          targetTable: null,
          valueColumn: "body_html",
        },
      }),
    );
  });

  it("normalizes custom scalar field keys and non-direct storage metadata", () => {
    const config = normalizeContentMappingConfig({
      entities: {
        posts: {
          customFields: [
            {
              column: "metadata",
              enabled: true,
              fieldKey: "card_title",
              kind: "text",
              label: "Card Title",
              path: "card.title",
            },
            {
              arrayIndex: 2,
              column: "tag_slots",
              enabled: true,
              fieldKey: "tertiary_tag",
              kind: "text",
              label: "Tertiary Tag",
            },
          ],
        },
      },
    });

    expect(config.entities.posts.customFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          arrayIndex: null,
          column: "metadata",
          fieldKey: "card_title",
          path: "card.title",
        }),
        expect.objectContaining({
          arrayIndex: 2,
          column: "tag_slots",
          fieldKey: "tertiary_tag",
          path: null,
        }),
      ]),
    );
  });

  it("preserves custom scalar relation source metadata during normalization", () => {
    const config = normalizeContentMappingConfig({
      entities: {
        posts: {
          customFields: [
            {
              column: "subtitle_lookup_id",
              dataType: "uuid",
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
              column: "helper_subtitle",
              dataType: "text",
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
          ],
        },
      },
    });

    expect(config.entities.posts.customFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "subtitle_text",
          sourceRelation: {
            junctionSourceColumn: null,
            junctionTable: null,
            sourceColumn: "subtitle_lookup_id",
            strategy: "foreign_key",
            targetColumn: "id",
            targetTable: "public.post_subtitle_rows",
            valueColumn: "subtitle_text",
          },
        }),
        expect.objectContaining({
          fieldKey: "helper_subtitle",
          sourceRelation: {
            junctionSourceColumn: "post_id",
            junctionTable: "public.post_subtitle_helper",
            sourceColumn: null,
            strategy: "related_row_by_post_id",
            targetColumn: null,
            targetTable: null,
            valueColumn: "subtitle_text",
          },
        }),
      ]),
    );
  });

  it("drops unsupported media storage providers during normalization", () => {
    const config = normalizeContentMappingConfig({
      filesStorage: {
        bucketName: "docs",
        provider: "imagekit",
      },
      mediaStorage: {
        bucketName: "demo",
        provider: "cloudinary",
      },
    });

    expect(config.filesStorage).toEqual(
      expect.objectContaining({
        bucketName: "docs",
        provider: "none",
      }),
    );
    expect(config.mediaStorage).toEqual(
      expect.objectContaining({
        bucketName: "demo",
        provider: "none",
      }),
    );
  });

  it("normalizes independent files and media storage settings", () => {
    const config = normalizeContentMappingConfig({
      filesStorage: {
        bucketName: "documents",
        endpoint: " https://example.r2.cloudflarestorage.com ",
        provider: "s3_compatible",
        publicUrlBase: " https://cdn.example.com/files ",
        region: " auto ",
      },
      mediaStorage: {
        bucketName: "images",
        provider: "supabase_bucket",
      },
    });

    expect(config.filesStorage).toEqual({
      bucketName: "documents",
      endpoint: "https://example.r2.cloudflarestorage.com",
      provider: "s3_compatible",
      publicUrlBase: "https://cdn.example.com/files",
      region: "auto",
    });
    expect(config.mediaStorage).toEqual({
      bucketName: "images",
      endpoint: null,
      provider: "supabase_bucket",
      publicUrlBase: null,
      region: null,
    });
  });

  it("normalizes project mapping rows from stored mapping payloads", () => {
    const mapping = normalizeContentProjectMapping({
      binding_id: "binding-1",
      binding_mode: "mapped_content",
      binding_status: "draft",
      canonical_schema_version: 1,
      install_config: { requested_setup_path: "mapped_content" },
      mapping_config: null,
      revision_id: null,
      revision_source: null,
      revision_version: null,
      scope_config: { schema: "public" },
      scope_mode: "database",
      storage_bucket: null,
    });

    expect(mapping.bindingId).toBe("binding-1");
    expect(mapping.bindingMode).toBe("mapped_content");
    expect(mapping.bindingStatus).toBe("draft");
    expect(mapping.mappingConfig.version).toBe(1);
    expect(mapping.mappingConfig.entities.posts.editorFields).toEqual([
      expect.objectContaining({
        id: "content",
        kind: "rich_text",
      }),
    ]);
    expect(mapping).not.toHaveProperty("scopeConfig");
  });

  it("preserves polymorphic relation discriminator metadata during normalization", () => {
    const config = normalizeContentMappingConfig({
      entities: {
        posts: {
          relations: {
            tags: {
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
            },
          },
        },
      },
    });

    expect(config.entities.posts.relations.tags).toEqual(
      expect.objectContaining({
        discriminatorColumn: "owner_type",
        discriminatorValue: "post",
        junctionSourceColumn: "owner_id",
        junctionTable: "public.post_tags",
        junctionTargetColumn: "tag_id",
        strategy: "polymorphic_join",
      }),
    );
  });

  it("preserves built-in scalar relation source metadata during normalization", () => {
    const config = normalizeContentMappingConfig({
      entities: {
        posts: {
          fields: {
            seoTitle: {
              kind: "text",
              label: "SEO Title",
              sourceRelation: {
                junctionSourceColumn: "post_id",
                junctionTable: "public.post_seo_meta",
                sourceColumn: null,
                strategy: "related_row_by_post_id",
                targetColumn: null,
                targetTable: "public.post_seo_meta",
                valueColumn: "meta_title",
              },
            },
            title: {
              kind: "text",
              label: "Title",
              sourceRelation: {
                junctionSourceColumn: null,
                junctionTable: null,
                sourceColumn: "seo_meta_id",
                strategy: "foreign_key",
                targetColumn: "id",
                targetTable: "public.seo_meta",
                valueColumn: "title_text",
              },
            },
          },
        },
      },
    });

    expect(config.entities.posts.fields.title).toEqual(
      expect.objectContaining({
        sourceRelation: {
          junctionSourceColumn: null,
          junctionTable: null,
          sourceColumn: "seo_meta_id",
          strategy: "foreign_key",
          targetColumn: "id",
          targetTable: "public.seo_meta",
          valueColumn: "title_text",
        },
      }),
    );
    expect(config.entities.posts.fields.seoTitle).toEqual(
      expect.objectContaining({
        sourceRelation: {
          junctionSourceColumn: "post_id",
          junctionTable: "public.post_seo_meta",
          sourceColumn: null,
          strategy: "related_row_by_post_id",
          targetColumn: null,
          targetTable: "public.post_seo_meta",
          valueColumn: "meta_title",
        },
      }),
    );
  });

  it("reports duplicate relation-backed scalar targets before saving a mapping", () => {
    const config = createDefaultContentMappingConfig();
    const posts = config.entities.posts;

    posts.status = "mapped";
    posts.source = {
      kind: "table",
      primaryKey: "id",
      schema: "public",
      table: "articles",
    };
    posts.fields.seoTitle = {
      ...posts.fields.seoTitle,
      column: null,
      sourceRelation: {
        junctionSourceColumn: "article_id",
        junctionTable: "public.article_meta",
        sourceColumn: null,
        strategy: "related_row_by_post_id",
        targetColumn: null,
        targetTable: null,
        valueColumn: "meta_value",
      },
    };
    posts.fields.seoDescription = {
      ...posts.fields.seoDescription,
      column: null,
      sourceRelation: {
        junctionSourceColumn: "article_id",
        junctionTable: "public.article_meta",
        sourceColumn: null,
        strategy: "related_row_by_post_id",
        targetColumn: null,
        targetTable: null,
        valueColumn: "meta_value",
      },
    };

    expect(getContentMappingDuplicateColumnIssues(config)).toEqual([
      expect.objectContaining({
        column: "meta_value",
        locations: ["Posts SEO Description", "Posts SEO Title"],
        tableRef: "public.article_meta",
      }),
    ]);
  });

  it("allows the same array column when mapped to different item positions", () => {
    const config = createDefaultContentMappingConfig();
    const posts = config.entities.posts;

    posts.status = "mapped";
    posts.source = {
      kind: "table",
      primaryKey: "id",
      schema: "public",
      table: "articles",
    };
    posts.fields.redirects = {
      ...posts.fields.redirects,
      arrayIndex: 0,
      column: "redirects",
    };
    posts.customFields = [
      {
        allowedValues: null,
        arrayIndex: 1,
        column: "redirects",
        dataType: "text[]",
        defaultValue: null,
        enabled: true,
        fieldKey: "secondary_redirect",
        isNullable: true,
        kind: "text",
        label: "Secondary Redirect",
        sampleValues: [],
        storagePrimitive: "array_item",
      },
    ];

    expect(getContentMappingDuplicateColumnIssues(config)).toEqual([]);
  });
});
