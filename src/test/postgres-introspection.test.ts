import { describe, expect, it } from "vitest";

import { buildContentAutoMappingResult } from "@/lib/content-runtime/introspection";

describe("Postgres introspection", () => {
  it("detects a conventional post schema with workflow and join-table relations", () => {
    const result = buildContentAutoMappingResult({
      tables: [
        {
          columns: [
            { dataType: "uuid", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "id", udtName: "uuid" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "title", udtName: "text" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "slug", udtName: "text" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "body", udtName: "text" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "excerpt", udtName: "text" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "status", udtName: "text" },
            { dataType: "timestamp with time zone", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "published_at", udtName: "timestamptz" },
            { dataType: "uuid", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "author_id", udtName: "uuid" },
          ],
          foreignKeys: [
            { column: "author_id", targetColumn: "id", targetSchema: "public", targetTable: "authors" },
          ],
          kind: "table",
          name: "blog_posts",
          primaryKey: "id",
          rowCountEstimate: 120,
          sampleRows: [
            {
              author_id: "author-1",
              body: "<p>Hello world</p>",
              excerpt: "Hello world",
              id: "post-1",
              published_at: "2026-03-10T00:00:00Z",
              slug: "hello-world",
              status: "published",
              title: "Hello World",
            },
            {
              author_id: "author-2",
              body: "<p>Draft text</p>",
              excerpt: "Draft text",
              id: "post-2",
              published_at: null,
              slug: "draft-post",
              status: "draft",
              title: "Draft Post",
            },
          ],
          schema: "public",
        },
        {
          columns: [
            { dataType: "uuid", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "id", udtName: "uuid" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "name", udtName: "text" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "email", udtName: "text" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "slug", udtName: "text" },
          ],
          foreignKeys: [],
          kind: "table",
          name: "authors",
          primaryKey: "id",
          rowCountEstimate: 5,
          sampleRows: [{ email: "a@example.com", id: "author-1", name: "Author A", slug: "author-a" }],
          schema: "public",
        },
        {
          columns: [
            { dataType: "uuid", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "id", udtName: "uuid" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "name", udtName: "text" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "slug", udtName: "text" },
            { dataType: "uuid", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "parent_id", udtName: "uuid" },
          ],
          foreignKeys: [],
          kind: "table",
          name: "categories",
          primaryKey: "id",
          rowCountEstimate: 8,
          sampleRows: [{ id: "cat-1", name: "News", parent_id: null, slug: "news" }],
          schema: "public",
        },
        {
          columns: [
            { dataType: "uuid", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "id", udtName: "uuid" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "name", udtName: "text" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "slug", udtName: "text" },
          ],
          foreignKeys: [],
          kind: "table",
          name: "tags",
          primaryKey: "id",
          rowCountEstimate: 20,
          sampleRows: [{ id: "tag-1", name: "Launch", slug: "launch" }],
          schema: "public",
        },
        {
          columns: [
            { dataType: "uuid", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "post_id", udtName: "uuid" },
            { dataType: "uuid", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "category_id", udtName: "uuid" },
          ],
          foreignKeys: [
            { column: "post_id", targetColumn: "id", targetSchema: "public", targetTable: "blog_posts" },
            { column: "category_id", targetColumn: "id", targetSchema: "public", targetTable: "categories" },
          ],
          kind: "table",
          name: "post_categories",
          primaryKey: null,
          rowCountEstimate: 80,
          sampleRows: [],
          schema: "public",
        },
        {
          columns: [
            { dataType: "uuid", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "post_id", udtName: "uuid" },
            { dataType: "uuid", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "tag_id", udtName: "uuid" },
          ],
          foreignKeys: [
            { column: "post_id", targetColumn: "id", targetSchema: "public", targetTable: "blog_posts" },
            { column: "tag_id", targetColumn: "id", targetSchema: "public", targetTable: "tags" },
          ],
          kind: "table",
          name: "post_tags",
          primaryKey: null,
          rowCountEstimate: 140,
          sampleRows: [],
          schema: "public",
        },
      ],
    });

    const postsCandidate = result.candidates.posts[0];

    expect(postsCandidate.mapping.source.table).toBe("blog_posts");
    expect(postsCandidate.mapping.fields.title.column).toBe("title");
    expect(postsCandidate.mapping.editorFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          column: "body",
          kind: "html",
        }),
      ]),
    );
    expect(postsCandidate.mapping.workflow).toEqual(
      expect.objectContaining({
        mode: "status",
        publishedAtColumn: "published_at",
        publishedValues: ["published"],
        draftValues: ["draft"],
        statusColumn: "status",
      }),
    );
    expect(postsCandidate.mapping.relations.authors).toEqual(
      expect.objectContaining({
        sourceColumn: "author_id",
        strategy: "foreign_key",
        targetTable: "authors",
      }),
    );
    expect(postsCandidate.mapping.relations.categories).toEqual(
      expect.objectContaining({
        junctionTable: "post_categories",
        strategy: "join_table",
        targetTable: "categories",
      }),
    );
    expect(postsCandidate.mapping.relations.tags).toEqual(
      expect.objectContaining({
        junctionTable: "post_tags",
        strategy: "join_table",
        targetTable: "tags",
      }),
    );
    expect(result.suggestedMappingConfig.entities.categories.source.table).toBe("categories");
    expect(result.suggestedMappingConfig.entities.tags.source.table).toBe("tags");
  });

  it("detects multi-field content, publish flags, inline authors, and array-backed tags", () => {
    const result = buildContentAutoMappingResult({
      tables: [
        {
          columns: [
            { dataType: "uuid", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "id", udtName: "uuid" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "title", udtName: "text" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "slug", udtName: "text" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "intro", udtName: "text" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "steps_markdown", udtName: "text" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "outro", udtName: "text" },
            { dataType: "boolean", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "is_published", udtName: "bool" },
            { dataType: "text[]", defaultValue: null, enumValues: null, isArray: true, isJson: false, isNullable: true, name: "tags", udtName: "_text" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "author_name", udtName: "text" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "author_email", udtName: "text" },
          ],
          foreignKeys: [],
          kind: "table",
          name: "articles",
          primaryKey: "id",
          rowCountEstimate: 30,
          sampleRows: [
            {
              author_email: "jane@example.com",
              author_name: "Jane Writer",
              id: "article-1",
              intro: "Short intro",
              is_published: true,
              outro: "Final thought",
              slug: "how-to-map",
              steps_markdown: "## Step 1\n- Do thing",
              tags: ["guide", "mapping"],
              title: "How To Map",
            },
          ],
          schema: "public",
        },
      ],
    });

    const postsCandidate = result.candidates.posts[0];

    expect(postsCandidate.mapping.source.table).toBe("articles");
    expect(postsCandidate.mapping.editorFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ column: "intro", kind: "plain_text" }),
        expect.objectContaining({ column: "steps_markdown", kind: "markdown" }),
        expect.objectContaining({ column: "outro", kind: "plain_text" }),
      ]),
    );
    expect(postsCandidate.mapping.workflow).toEqual(
      expect.objectContaining({
        mode: "published_flag",
        publishedFlagColumn: "is_published",
      }),
    );
    expect(postsCandidate.mapping.relations.authors).toEqual(
      expect.objectContaining({
        fieldMap: {
          email: "author_email",
          name: "author_name",
        },
        strategy: "inline_fields",
        status: "limited",
      }),
    );
    expect(postsCandidate.mapping.relations.tags).toEqual(
      expect.objectContaining({
        sourceColumn: "tags",
        strategy: "array",
        status: "limited",
      }),
    );
    expect(result.candidates.authors[0].mapping.source.kind).toBe("derived");
    expect(result.candidates.authors[0].mapping.fields.name.column).toBe("author_name");
    expect(result.candidates.tags[0].mapping.source.kind).toBe("derived");
    expect(result.candidates.tags[0].mapping.fields.name.column).toBe("tags");
  });

  it("detects redirect columns in suggested post mappings for fresh projects", () => {
    const result = buildContentAutoMappingResult({
      tables: [
        {
          columns: [
            { dataType: "uuid", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "id", udtName: "uuid" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "title", udtName: "text" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "slug", udtName: "text" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "content_html", udtName: "text" },
            { dataType: "text[]", defaultValue: null, enumValues: null, isArray: true, isJson: false, isNullable: true, name: "redirect_paths", udtName: "_text" },
          ],
          foreignKeys: [],
          kind: "table",
          name: "posts",
          primaryKey: "id",
          rowCountEstimate: 5,
          sampleRows: [
            {
              content_html: "<p>Hello world</p>",
              id: "post-1",
              redirect_paths: ["/old-path", "/older-path"],
              slug: "hello-world",
              title: "Hello World",
            },
          ],
          schema: "public",
        },
      ],
    });

    expect(result.candidates.posts[0]?.mapping.fields.redirects?.column).toBe("redirect_paths");
    expect(result.suggestedMappingConfig.entities.posts.fields.redirects?.column).toBe("redirect_paths");
  });

  it("detects enum-backed status and SEO fields on post candidates", () => {
    const result = buildContentAutoMappingResult({
      tables: [
        {
          columns: [
            { dataType: "uuid", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "id", udtName: "uuid" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "title", udtName: "text" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "body", udtName: "text" },
            {
              dataType: "USER-DEFINED",
              defaultValue: null,
              enumValues: ["draft", "review", "published"],
              isArray: false,
              isJson: false,
              isNullable: false,
              name: "publication_status",
              udtName: "post_status",
            },
            { dataType: "timestamp with time zone", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "published_at", udtName: "timestamptz" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "meta_title", udtName: "text" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "meta_desc", udtName: "text" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "focus_keyphrase", udtName: "text" },
          ],
          foreignKeys: [],
          kind: "table",
          name: "articles",
          primaryKey: "id",
          rowCountEstimate: 18,
          sampleRows: [
            {
              body: "<p>Hello</p>",
              focus_keyphrase: "headless cms",
              id: "article-1",
              meta_desc: "A practical guide",
              meta_title: "Mapping Guide",
              publication_status: "published",
              published_at: "2026-03-10T00:00:00Z",
              title: "Mapping Guide",
            },
          ],
          schema: "public",
        },
      ],
    });

    const postsCandidate = result.candidates.posts[0];

    expect(postsCandidate.mapping.fields.focusKeyword.column).toBe("focus_keyphrase");
    expect(postsCandidate.mapping.fields.seoDescription.column).toBe("meta_desc");
    expect(postsCandidate.mapping.fields.seoTitle.column).toBe("meta_title");
    expect(postsCandidate.mapping.workflow).toEqual(
      expect.objectContaining({
        draftValues: ["draft", "review"],
        publishedAtColumn: "published_at",
        publishedValues: ["published"],
        statusColumn: "publication_status",
      }),
    );
  });

  it("detects a direct media table without assuming name or slug fields exist", () => {
    const result = buildContentAutoMappingResult({
      tables: [
        {
          columns: [
            { dataType: "uuid", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "id", udtName: "uuid" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "file_name", udtName: "text" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "object_path", udtName: "text" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "alt_text", udtName: "text" },
          ],
          foreignKeys: [],
          kind: "table",
          name: "media_assets",
          primaryKey: "id",
          rowCountEstimate: 42,
          sampleRows: [
            {
              alt_text: "Homepage hero",
              file_name: "hero.png",
              id: "asset-1",
              object_path: "hero/hero.png",
            },
          ],
          schema: "public",
        },
      ],
    });

    expect(result.candidates.media[0].mapping.source.table).toBe("media_assets");
    expect(result.candidates.media[0].mapping.fields.objectPath.column).toBe("object_path");
    expect(result.candidates.media[0].mapping.fields.title.column).toBe("file_name");
    expect(result.candidates.media[0].mapping.fields.altText.column).toBe("alt_text");
  });

  it("prefers the primary posts table over a revisions table and ignores support content columns", () => {
    const result = buildContentAutoMappingResult({
      tables: [
        {
          columns: [
            { dataType: "uuid", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "id", udtName: "uuid" },
            { dataType: "uuid", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "author_id", udtName: "uuid" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "title", udtName: "text" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "slug", udtName: "text" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "status", udtName: "text" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "excerpt", udtName: "text" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "content_format", udtName: "text" },
            { dataType: "jsonb", defaultValue: null, enumValues: null, isArray: false, isJson: true, isNullable: false, name: "content_json", udtName: "jsonb" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "content_markdown", udtName: "text" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "content_html", udtName: "text" },
            { dataType: "timestamp with time zone", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "published_at", udtName: "timestamptz" },
          ],
          foreignKeys: [
            { column: "author_id", targetColumn: "id", targetSchema: "public", targetTable: "mapped_authors" },
          ],
          kind: "table",
          name: "mapped_posts",
          primaryKey: "id",
          rowCountEstimate: 12,
          sampleRows: [
            {
              author_id: "author-1",
              content_format: "markdown",
              content_html: null,
              content_json: { content: [{ type: "paragraph", content: [{ type: "text", text: "Hello world" }] }], type: "doc" },
              content_markdown: "# Hello world",
              excerpt: "Short excerpt",
              id: "post-1",
              published_at: "2026-03-12T00:00:00Z",
              slug: "hello-world",
              status: "published",
              title: "Hello World",
            },
          ],
          schema: "public",
        },
        {
          columns: [
            { dataType: "uuid", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "id", udtName: "uuid" },
            { dataType: "uuid", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "post_id", udtName: "uuid" },
            { dataType: "integer", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "revision_number", udtName: "int4" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "title", udtName: "text" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "slug", udtName: "text" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "status", udtName: "text" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "excerpt", udtName: "text" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "content_format", udtName: "text" },
            { dataType: "jsonb", defaultValue: null, enumValues: null, isArray: false, isJson: true, isNullable: false, name: "content_json", udtName: "jsonb" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "content_markdown", udtName: "text" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "content_html", udtName: "text" },
            { dataType: "timestamp with time zone", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "published_at", udtName: "timestamptz" },
          ],
          foreignKeys: [
            { column: "post_id", targetColumn: "id", targetSchema: "public", targetTable: "mapped_posts" },
          ],
          kind: "table",
          name: "mapped_post_revisions",
          primaryKey: "id",
          rowCountEstimate: 48,
          sampleRows: [
            {
              content_format: "markdown",
              content_html: null,
              content_json: { content: [{ type: "paragraph", content: [{ type: "text", text: "Hello world revision" }] }], type: "doc" },
              content_markdown: "# Hello world revision",
              excerpt: "Short excerpt",
              id: "revision-1",
              post_id: "post-1",
              published_at: "2026-03-12T00:00:00Z",
              revision_number: 2,
              slug: "hello-world",
              status: "published",
              title: "Hello World",
            },
          ],
          schema: "public",
        },
      ],
    });

    const postsCandidate = result.candidates.posts[0];
    const editorColumns = postsCandidate.mapping.editorFields.map((field) => field.column);

    expect(postsCandidate.mapping.source.table).toBe("mapped_posts");
    expect(editorColumns).toContain("content_markdown");
    expect(editorColumns).not.toContain("content_format");
    expect(editorColumns).not.toContain("content_json");
    expect(editorColumns).not.toContain("excerpt");
  });

  it("marks generated and trigger-managed timestamps on auto-detected post mappings", () => {
    const result = buildContentAutoMappingResult({
      tables: [
        {
          columns: [
            { dataType: "uuid", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "id", udtName: "uuid" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "title", udtName: "text" },
            { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "body", udtName: "text" },
            {
              dataType: "timestamp with time zone",
              defaultValue: null,
              enumValues: null,
              isArray: false,
              isGenerated: true,
              isJson: false,
              isNullable: false,
              name: "created_at",
              udtName: "timestamptz",
            },
            { dataType: "timestamp with time zone", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "updated_at", udtName: "timestamptz" },
          ],
          foreignKeys: [],
          kind: "table",
          name: "posts",
          primaryKey: "id",
          rowCountEstimate: 5,
          sampleRows: [
            {
              body: "<p>Hello world</p>",
              created_at: "2026-03-10T00:00:00Z",
              id: "post-1",
              title: "Hello World",
              updated_at: "2026-03-11T00:00:00Z",
            },
          ],
          schema: "public",
          triggerDefinitions: [
            "CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at')",
          ],
        },
      ],
    });

    const postsCandidate = result.candidates.posts[0];

    expect(postsCandidate.mapping.fields.createdAt).toEqual(
      expect.objectContaining({
        column: "created_at",
        timestampSourceHint: "generated",
      }),
    );
    expect(postsCandidate.mapping.fields.updatedAt).toEqual(
      expect.objectContaining({
        column: "updated_at",
        timestampSourceHint: "trigger_managed",
      }),
    );
  });
});
