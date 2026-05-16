import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildPostsOrderClause,
  buildPostsWhereClause,
  getMappedFieldValue,
  getResolvedEntitySource,
} from "@/lib/content-runtime/mapped-content-runtime-support";

describe("existing DB runtime support", () => {
  it("reads mapped scalar values from JSON paths", () => {
    expect(
      getMappedFieldValue(
        {
          meta: {
            route: {
              slug: "hello-world",
            },
            seo: {
              title: "Hello World SEO",
            },
          },
        },
        {
          fields: {
            seoTitle: {
              column: "meta",
              kind: "text",
              label: "SEO Title",
              path: "seo.title",
              required: false,
              visible: true,
            },
            slug: {
              column: "meta",
              kind: "slug",
              label: "Slug",
              path: "route.slug",
              required: false,
              visible: true,
            },
          },
        } as never,
        "slug",
      ),
    ).toBe("hello-world");

    expect(
      getMappedFieldValue(
        {
          meta: {
            route: {
              slug: "hello-world",
            },
            seo: {
              title: "Hello World SEO",
            },
          },
        },
        {
          fields: {
            seoTitle: {
              column: "meta",
              kind: "text",
              label: "SEO Title",
              path: "seo.title",
              required: false,
              visible: true,
            },
            slug: {
              column: "meta",
              kind: "slug",
              label: "Slug",
              path: "route.slug",
              required: false,
              visible: true,
            },
          },
        } as never,
        "seoTitle",
      ),
    ).toBe("Hello World SEO");
  });

  it("reads mapped scalar values from array-item fields", () => {
    expect(
      getMappedFieldValue(
        {
          title_parts: ["ignored", "Visible title"],
        },
        {
          fields: {
            title: {
              arrayIndex: 1,
              column: "title_parts",
              kind: "text",
              label: "Title",
              required: true,
              visible: true,
            },
          },
        } as never,
        "title",
      ),
    ).toBe("Visible title");
  });

  it("builds JSON-path search and title sort expressions for mapped fields", () => {
    const posts = {
      fields: {
        excerpt: {
          column: "seo_payload",
          kind: "plain_text",
          label: "Excerpt",
          path: "description",
          required: false,
          visible: true,
        },
        slug: {
          column: "route_payload",
          kind: "slug",
          label: "Slug",
          path: "slug.current",
          required: false,
          visible: true,
        },
        title: {
          column: "content_payload",
          kind: "text",
          label: "Title",
          path: "title",
          required: true,
          visible: true,
        },
      },
      source: {
        primaryKey: "id",
      },
      workflow: null,
    } as never;

    const whereClause = buildPostsWhereClause({
      posts,
      search: "hello",
      status: "all",
    });

    expect(whereClause.clause).toContain(`"content_payload"#>>array['title']`);
    expect(whereClause.clause).toContain(`"route_payload"#>>array['slug', 'current']`);
    expect(whereClause.clause).toContain(`"seo_payload"#>>array['description']`);
    expect(whereClause.clause).toContain("ilike '%' || $1::text || '%'");
    expect(whereClause.params).toEqual(["hello"]);

    expect(buildPostsOrderClause(posts, "title_asc")).toBe(
      `order by lower("content_payload"#>>array['title']) asc`,
    );
  });

  it("builds array-item search and title sort expressions for mapped fields", () => {
    const posts = {
      fields: {
        excerpt: {
          arrayIndex: 0,
          column: "summary_parts",
          kind: "plain_text",
          label: "Excerpt",
          path: null,
          required: false,
          visible: true,
        },
        slug: {
          arrayIndex: 2,
          column: "slug_parts",
          kind: "slug",
          label: "Slug",
          path: null,
          required: false,
          visible: true,
        },
        title: {
          arrayIndex: 1,
          column: "title_parts",
          kind: "text",
          label: "Title",
          path: null,
          required: true,
          visible: true,
        },
      },
      source: {
        primaryKey: "id",
      },
      workflow: null,
    } as never;

    const whereClause = buildPostsWhereClause({
      posts,
      search: "hello",
      status: "all",
    });

    expect(whereClause.clause).toContain(`"title_parts"[2]::text`);
    expect(whereClause.clause).toContain(`"slug_parts"[3]::text`);
    expect(whereClause.clause).toContain(`"summary_parts"[1]::text`);
    expect(whereClause.clause).toContain("ilike '%' || $1::text || '%'");
    expect(whereClause.params).toEqual(["hello"]);

    expect(buildPostsOrderClause(posts, "title_asc")).toBe(
      `order by lower("title_parts"[2]::text) asc`,
    );
  });

  it("builds JSON-path timestamp order expressions when created or updated timestamps are nested", () => {
    const posts = {
      fields: {
        createdAt: {
          column: "audit_payload",
          kind: "datetime",
          label: "Created At",
          path: "created.at",
          required: false,
          visible: true,
        },
        title: {
          column: "title",
          kind: "text",
          label: "Title",
          path: null,
          required: true,
          visible: true,
        },
        updatedAt: {
          column: "audit_payload",
          kind: "datetime",
          label: "Updated At",
          path: "updated.at",
          required: false,
          visible: true,
        },
      },
      source: {
        primaryKey: "id",
      },
      workflow: null,
    } as never;

    expect(buildPostsOrderClause(posts, "updated_desc")).toBe(
      `order by "audit_payload"#>>array['updated', 'at'] desc`,
    );
    expect(buildPostsOrderClause(posts, "created_asc")).toBe(
      `order by "audit_payload"#>>array['created', 'at'] asc`,
    );
  });

  it("reuses a usable mapped entity source before foreign-key introspection when the relation target table is omitted", async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [{ table_type: "BASE TABLE" }],
        })
        .mockResolvedValueOnce({
          rows: [{ column_name: "id" }],
        }),
    };

    await expect(
      getResolvedEntitySource({
        client,
        entity: {
          fields: {
            id: { column: "id" },
          },
          source: {
            kind: "table",
            primaryKey: "id",
            schema: "public",
            table: "authors_fast_path_foreign_key",
          },
          status: "mapped",
        } as never,
        posts: {
          fields: {
            id: { column: "id" },
          },
          source: {
            kind: "table",
            primaryKey: "id",
            schema: "public",
            table: "posts_fast_path_foreign_key",
          },
          status: "mapped",
        } as never,
        relation: {
          fieldMap: {},
          junctionSourceColumn: null,
          junctionTable: null,
          junctionTargetColumn: null,
          multiple: false,
          sourceColumn: "author_id_fast_path_foreign_key",
          status: "mapped",
          strategy: "foreign_key",
          targetColumn: "slug",
          targetEntity: "authors",
          targetTable: null,
          valueColumn: null,
        },
      }),
    ).resolves.toEqual({
      kind: "table",
      primaryKey: "id",
      schema: "public",
      table: "authors_fast_path_foreign_key",
    });

    expect(client.query).toHaveBeenCalledTimes(2);
    expect(client.query.mock.calls[0]?.[1]).toEqual(["public", "authors_fast_path_foreign_key"]);
    expect(
      client.query.mock.calls.find(([, params]) => Array.isArray(params) && params.includes("author_id_fast_path_foreign_key")),
    ).toBeUndefined();
  });

  it("reuses a usable mapped entity source before join-target introspection when the relation target table is omitted", async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [{ table_type: "BASE TABLE" }],
        })
        .mockResolvedValueOnce({
          rows: [{ column_name: "id" }],
        }),
    };

    await expect(
      getResolvedEntitySource({
        client,
        entity: {
          fields: {
            id: { column: "id" },
          },
          source: {
            kind: "table",
            primaryKey: "id",
            schema: "public",
            table: "categories_fast_path_join",
          },
          status: "mapped",
        } as never,
        posts: {
          fields: {
            id: { column: "id" },
          },
          source: {
            kind: "table",
            primaryKey: "id",
            schema: "public",
            table: "posts_fast_path_join",
          },
          status: "mapped",
        } as never,
        relation: {
          fieldMap: {},
          junctionSourceColumn: "post_id_fast_path_join",
          junctionTable: "public.post_categories_fast_path_join",
          junctionTargetColumn: "category_id_fast_path_join",
          multiple: true,
          sourceColumn: null,
          status: "mapped",
          strategy: "join_table",
          targetColumn: "slug",
          targetEntity: "categories",
          targetTable: null,
          valueColumn: null,
        },
      }),
    ).resolves.toEqual({
      kind: "table",
      primaryKey: "id",
      schema: "public",
      table: "categories_fast_path_join",
    });

    expect(client.query).toHaveBeenCalledTimes(2);
    expect(client.query.mock.calls[0]?.[1]).toEqual(["public", "categories_fast_path_join"]);
    expect(
      client.query.mock.calls.find(([, params]) => Array.isArray(params) && params.includes("category_id_fast_path_join")),
    ).toBeUndefined();
  });
});
