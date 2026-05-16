import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  buildPostsOrderClauseMock,
  buildPostsWhereClauseMock,
  getEntityAvailableColumnsMock,
  getEntityColumnMetadataMock,
  getMappedPublishedAtColumnMock,
  getMappedContentRuntimeMock,
  getPostStatusFromRowMock,
  getEntitySelectableColumnsMock,
  getRelationJunctionTableNameMock,
  getRelationTargetTableNameMock,
  getResolvedEntityMock,
  getResolvedRelationTargetColumnMock,
  normalizeMappedContentValueMock,
  toStringArrayMock,
} = vi.hoisted(() => ({
  buildPostsOrderClauseMock: vi.fn(
    (posts: {
      fields: Record<string, { column: string | null }>;
      source: { primaryKey: string };
    }) => {
      const updatedAtColumn = posts.fields.updatedAt?.column?.trim();
      const createdAtColumn = posts.fields.createdAt?.column?.trim();
      const primaryKey = posts.source.primaryKey;

      if (updatedAtColumn) {
        return `order by "${updatedAtColumn}" desc`;
      }

      if (createdAtColumn) {
        return `order by "${createdAtColumn}" desc`;
      }

      return `order by "${primaryKey}" desc`;
    },
  ),
  buildPostsWhereClauseMock: vi.fn(
    ({
      posts,
      search,
      status,
    }: {
      posts: {
        fields: Record<string, { column: string | null }>;
        workflow: { statusColumn: string | null } | null;
      };
      search: string;
      status: string;
    }) => {
      const clauses: string[] = [];
      const params: unknown[] = [];

      if (status !== "all" && posts.workflow?.statusColumn) {
        clauses.push(`"${posts.workflow.statusColumn}"::text = any($1::text[])`);
        params.push([status]);
      }

      if (search && posts.fields.title?.column) {
        clauses.push(`coalesce("${posts.fields.title.column}"::text, '') ilike $${params.length + 1}`);
        params.push(`%${search}%`);
      }

      return {
        clause: clauses.length ? `where ${clauses.map((clause) => `(${clause})`).join(" and ")}` : "",
        params,
      };
    },
  ),
  getEntityAvailableColumnsMock: vi.fn(
    async () =>
      new Map<string, string>([
        ["author_id", "author_id"],
        ["category_id", "category_id"],
        ["id", "id"],
        ["title", "title"],
        ["created_at", "created_at"],
        ["post_id", "post_id"],
        ["status", "status"],
      ]),
  ),
  getEntityColumnMetadataMock: vi.fn(async () => ({
    dataType: "uuid",
    defaultValue: null,
    isNullable: false,
    udtName: "uuid",
  })),
  getMappedPublishedAtColumnMock: vi.fn(() => null),
  getMappedContentRuntimeMock: vi.fn((mapping: unknown) => mapping),
  getPostStatusFromRowMock: vi.fn(() => "draft"),
  getEntitySelectableColumnsMock: vi.fn(
    async ({ requestedColumns }: { requestedColumns: string[] }) =>
      requestedColumns.filter((column) =>
        ["id", "title", "created_at", "status", "author_id"].includes(column.toLowerCase()),
      ),
  ),
  getRelationJunctionTableNameMock: vi.fn(() => '"public"."post_categories"'),
  getRelationTargetTableNameMock: vi.fn(async () => null),
  getResolvedEntityMock: vi.fn(async ({ entity }: { entity: unknown }) => entity),
  getResolvedRelationTargetColumnMock: vi.fn(async () => "id"),
  normalizeMappedContentValueMock: vi.fn(() => ({
    contentFormat: "html",
    contentHtml: "",
    contentJson: { content: [], type: "doc" },
    contentMarkdown: null,
  })),
  toStringArrayMock: vi.fn((value: unknown) =>
    Array.isArray(value)
      ? value.map((entry) => (entry == null ? "" : String(entry)))
      : value == null
        ? []
        : [String(value)],
  ),
}));

vi.mock("@/lib/content-runtime/mapped-content-runtime-support", () => ({
  buildPostsOrderClause: buildPostsOrderClauseMock,
  buildPostsWhereClause: buildPostsWhereClauseMock,
  getEntityAvailableColumns: getEntityAvailableColumnsMock,
  getEntityColumnMetadata: getEntityColumnMetadataMock,
  getEntityIdColumn: vi.fn((entity: { source: { primaryKey: string } }) => entity.source.primaryKey),
  getEntitySelectableColumns: getEntitySelectableColumnsMock,
  getEntityTableName: vi.fn(
    (entity: { source?: { schema?: string | null; table?: string | null } }) =>
      `"${entity.source?.schema ?? "public"}"."${entity.source?.table ?? "posts"}"`,
  ),
  getFallbackTimestamp: vi.fn(() => "2026-03-28T00:00:00.000Z"),
  getMappedFieldColumn: vi.fn(
    (entity: { fields: Record<string, { column: string | null }> }, fieldKey: string) =>
      entity.fields[fieldKey]?.column ?? null,
  ),
  getMappedFieldPath: vi.fn(
    (entity: { fields: Record<string, { path?: string | null }> }, fieldKey: string) =>
      entity.fields[fieldKey]?.path ?? null,
  ),
  getMappedFieldTextExpression: vi.fn(
    (entity: { fields: Record<string, { column: string | null; path?: string | null }> }, fieldKey: string) => {
      const field = entity.fields[fieldKey];

      if (!field?.column) {
        return null;
      }

      if (!field.path?.trim()) {
        return `"${field.column}"::text`;
      }

      const pathExpression = field.path
        .split(".")
        .map((segment) => segment.trim())
        .filter(Boolean)
        .map((segment) => `'${segment.replace(/'/g, "''")}'`)
        .join(", ");

      return `"${field.column}"#>>array[${pathExpression}]`;
    },
  ),
  getMappedFieldValue: vi.fn(
    (
      row: Record<string, unknown>,
      entity: { fields: Record<string, { column: string | null; path?: string | null }> },
      fieldKey: string,
    ) => {
      const field = entity.fields[fieldKey];

      if (!field?.column) {
        return null;
      }

      const columnValue = row[field.column];
      const path = field.path?.trim();

      if (!path) {
        return columnValue ?? null;
      }

      return path
        .split(".")
        .map((segment) => segment.trim())
        .filter(Boolean)
        .reduce<unknown>(
          (currentValue, segment) =>
            typeof currentValue === "object" && currentValue !== null
              ? (currentValue as Record<string, unknown>)[segment]
              : null,
          columnValue,
        );
    },
  ),
  getMappedPublishedAtColumn: getMappedPublishedAtColumnMock,
  getMappedContentRuntime: getMappedContentRuntimeMock,
  getPostStatusFromRow: getPostStatusFromRowMock,
  getRelationJunctionTableName: getRelationJunctionTableNameMock,
  getRelationTargetTableName: getRelationTargetTableNameMock,
  getResolvedEntity: getResolvedEntityMock,
  getResolvedRelationTargetColumn: getResolvedRelationTargetColumnMock,
  getRowValue: vi.fn((row: Record<string, unknown>, column: string | null | undefined) =>
    column ? row[column] : null,
  ),
  normalizeMappedContentValue: normalizeMappedContentValueMock,
  parseTableRef: vi.fn((value: string | null | undefined, fallbackSchema?: string | null) => {
    const normalizedValue = value?.trim();

    if (!normalizedValue) {
      return null;
    }

    const [schema, table] = normalizedValue.split(".");

    if (schema && table) {
      return {
        schema,
        table,
      };
    }

    return {
      schema: fallbackSchema ?? "public",
      table: normalizedValue,
    };
  }),
  quoteIdentifier: vi.fn((value: string) => `"${value}"`),
  quoteQualifiedTable: vi.fn((schema: string, table: string) => `"${schema}"."${table}"`),
  resolvePagination: vi.fn(
    ({
      page = 1,
      pageSize = 10,
      totalItems,
    }: {
      page?: number;
      pageSize?: number;
      totalItems: number;
    }) => ({
      hasNextPage: page * pageSize < totalItems,
      hasPreviousPage: page > 1,
      offset: (page - 1) * pageSize,
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    }),
  ),
  toStringArray: toStringArrayMock,
  toText: vi.fn((value: unknown) => (value == null ? null : String(value))),
}));

vi.mock("@/lib/content-runtime/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/content-runtime/shared")>();

  return {
    ...actual,
    createContentPostListPreview: vi.fn((input: unknown) => input),
    slugifyContentValue: vi.fn((value: string) => value.toLowerCase().replace(/\s+/g, "-")),
  };
});

import {
  applyMappedRelationWrite,
  buildMappedContentPostEditorSelectClause,
  getMappedRelationValuesForPosts,
  getUniqueSlugForMappedTable,
  loadMappedContentPostRowsPage,
  mapMappedContentPostListRow,
  lookupStoredRelationValuesForIds,
  mapMappedContentPostRow,
  searchMappedContentParentPages,
} from "@/lib/content-runtime/mapped-content-post-support";

describe("existing DB post support fallback queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRelationJunctionTableNameMock.mockReturnValue('"public"."post_categories"');
    getRelationTargetTableNameMock.mockResolvedValue(null);
    getResolvedEntityMock.mockResolvedValue(undefined);
    getResolvedEntityMock.mockImplementation(async ({ entity }: { entity: unknown }) => entity);
    getResolvedRelationTargetColumnMock.mockResolvedValue("id");
    getMappedPublishedAtColumnMock.mockReturnValue(null);
    getPostStatusFromRowMock.mockReturnValue("draft");
    normalizeMappedContentValueMock.mockImplementation(() => ({
      contentFormat: "html",
      contentHtml: "",
      contentJson: { content: [], type: "doc" },
      contentMarkdown: null,
    }));
  });

  it("drops missing mapped columns from fallback select, filter, and order clauses", async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ count: "1" }] })
        .mockResolvedValueOnce({
          rows: [
            {
              created_at: "2026-03-28T00:00:00.000Z",
              id: "post-1",
              status: "published",
              title: "Hello World",
            },
          ],
        }),
    };

    await expect(
      loadMappedContentPostRowsPage({
        client,
        page: 1,
        pageSize: 10,
        runtime: {
          posts: {
            fields: {
              createdAt: { column: "created_at" },
              excerpt: { column: "excerpt" },
              slug: { column: "slug" },
              title: { column: "title" },
              updatedAt: { column: "updated_at" },
            },
            relations: {
              authors: undefined,
              categories: undefined,
              tags: undefined,
            },
            source: {
              primaryKey: "id",
            },
            workflow: {
              archivedValues: [],
              customValues: [],
              draftValues: ["draft"],
              mode: "status",
              publishedAtColumn: null,
              publishedFlagColumn: null,
              publishedValues: ["published"],
              statusColumn: "status",
            },
          },
        } as never,
        search: "hello",
        sort: "updated_desc",
        status: "published",
      }),
    ).resolves.toMatchObject({
      pagination: {
        page: 1,
        totalItems: 1,
      },
      rows: [
        {
          id: "post-1",
          title: "Hello World",
        },
      ],
    });

    expect(client.query).toHaveBeenCalledTimes(2);

    const countQuery = client.query.mock.calls[0]?.[0] as string;
    const rowsQuery = client.query.mock.calls[1]?.[0] as string;

    expect(countQuery).toContain('"status"::text = any($1::text[])');
    expect(countQuery).toContain('coalesce("title"::text, \'\') ilike $2');
    expect(countQuery).not.toContain('"slug"');
    expect(countQuery).not.toContain('"excerpt"');

    expect(rowsQuery).toContain('select "id", "title", "created_at"');
    expect(rowsQuery).toContain('order by "created_at" desc');
    expect(rowsQuery).not.toContain('"updated_at"');
    expect(rowsQuery).not.toContain('"slug"');
    expect(rowsQuery).not.toContain('"excerpt"');
    expect(getEntityAvailableColumnsMock).toHaveBeenCalledTimes(1);
    expect(getEntitySelectableColumnsMock).toHaveBeenCalledTimes(1);
  });

  it("does not select helper-row custom field value columns from the posts table", () => {
    const selectClause = buildMappedContentPostEditorSelectClause({
      customFields: [
        {
          column: "review_flags",
          enabled: true,
          fieldKey: "review_flags",
          kind: "json",
          label: "Review flags",
          sourceRelation: {
            junctionSourceColumn: "dispatch_token",
            junctionTable: "loom_archive_oddities.dispatch_side_notes",
            sourceColumn: null,
            strategy: "related_row_by_post_id",
            targetColumn: null,
            targetTable: "loom_archive_oddities.dispatch_side_notes",
            valueColumn: "review_flags",
          },
        },
      ],
      editorFields: [],
      fields: {
        id: { column: "card_token" },
        title: { column: "Public Headline" },
      },
      relations: {},
      source: {
        primaryKey: "card_token",
      },
      workflow: null,
    } as never);

    expect(selectClause).toContain('"card_token"');
    expect(selectClause).toContain('"Public Headline"');
    expect(selectClause).not.toContain('"review_flags"');
  });

  it("uses bounded window pagination for live post search fallbacks", async () => {
    const client = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [
          {
            created_at: "2026-03-28T00:00:00.000Z",
            id: "post-1",
            title: "Hello World",
          },
          {
            created_at: "2026-03-27T00:00:00.000Z",
            id: "post-2",
            title: "Hello Again",
          },
        ],
      }),
    };

    await expect(
      loadMappedContentPostRowsPage({
        client,
        page: 1,
        pageSize: 1,
        runtime: {
          posts: {
            fields: {
              createdAt: { column: "created_at" },
              title: { column: "title" },
            },
            relations: {},
            source: {
              primaryKey: "id",
            },
            workflow: null,
          },
        } as never,
        search: "hello",
        sort: "updated_desc",
        status: "all",
        useWindowPagination: true,
      }),
    ).resolves.toMatchObject({
      pagination: {
        hasNextPage: true,
        page: 1,
        totalItemsExact: false,
      },
      rows: [
        {
          id: "post-1",
          title: "Hello World",
        },
      ],
    });

    expect(client.query).toHaveBeenCalledTimes(1);
    expect(client.query.mock.calls[0]?.[1]).toEqual(["%hello%", 2, 0]);
  });

  it("uses typed author-scope predicates instead of text-casting a foreign-key column", async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ count: "1" }] })
        .mockResolvedValueOnce({
          rows: [
            {
              author_id: "author-1",
              created_at: "2026-03-28T00:00:00.000Z",
              id: "post-1",
              title: "Hello World",
            },
          ],
        }),
    };

    await expect(
      loadMappedContentPostRowsPage({
        accessibleAuthorIds: ["author-1"],
        client,
        page: 1,
        pageSize: 10,
        runtime: {
          authors: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "authors",
            },
          },
          posts: {
            fields: {
              authorId: { column: "author_id" },
              createdAt: { column: "created_at" },
              excerpt: { column: null },
              slug: { column: null },
              title: { column: "title" },
              updatedAt: { column: null },
            },
            relations: {
              authors: {
                fieldMap: {},
                junctionSourceColumn: null,
                junctionTable: null,
                junctionTargetColumn: null,
                multiple: false,
                sourceColumn: "author_id",
                status: "mapped",
                strategy: "foreign_key",
                targetColumn: "id",
                targetEntity: "authors",
                targetTable: "public.authors",
                valueColumn: null,
              },
              categories: undefined,
              tags: undefined,
            },
            source: {
              primaryKey: "id",
              schema: "public",
              table: "posts",
            },
            workflow: null,
          },
        } as never,
      }),
    ).resolves.toMatchObject({
      pagination: {
        page: 1,
        totalItems: 1,
      },
    });

    const countQuery = client.query.mock.calls[0]?.[0] as string;
    const rowsQuery = client.query.mock.calls[1]?.[0] as string;

    expect(countQuery).toContain('"author_id" = any($1::uuid[])');
    expect(countQuery).not.toContain('"author_id"::text');
    expect(rowsQuery).toContain('"author_id" = any($1::uuid[])');
    expect(rowsQuery).not.toContain('"author_id"::text');
  });

  it("searches parent pages with a bounded page query instead of loading every post", async () => {
    const client = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [
          {
            created_at: "2026-03-28T00:00:00.000Z",
            id: "post-1",
            slug: "hello-world",
            title: "Hello World",
          },
        ],
      }),
    };

    await expect(
      searchMappedContentParentPages({
        client,
        limit: 25,
        mapping: {
          posts: {
            fields: {
              createdAt: { column: "created_at" },
              excerpt: { column: null },
              slug: { column: "slug" },
              title: { column: "title" },
              updatedAt: { column: null },
            },
            relations: {
              authors: undefined,
              categories: undefined,
              tags: undefined,
            },
            source: {
              primaryKey: "id",
              schema: "public",
              table: "posts",
            },
            workflow: null,
          },
        } as never,
        search: "hello",
      }),
    ).resolves.toEqual([
      {
        id: "post-1",
        slug: "hello-world",
        title: "Hello World",
      },
    ]);

    expect(client.query).toHaveBeenCalledTimes(1);
    const rowsQuery = client.query.mock.calls[0]?.[0] as string;
    const rowsParams = client.query.mock.calls[0]?.[1] as unknown[];

    expect(rowsQuery).toContain("limit $");
    expect(rowsQuery).toContain("offset $");
    expect(rowsParams).toEqual(["%hello%", 25, 0]);
  });

  it("hydrates selected parent page ids with a bounded id query", async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              created_at: "2026-03-28T00:00:00.000Z",
              id: "post-1",
              slug: "hello-world",
              title: "Hello World",
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              created_at: "2026-03-28T00:00:00.000Z",
              id: "post-99",
              slug: "archive-page",
              title: "Archive Page",
            },
          ],
        }),
    };

    await expect(
      searchMappedContentParentPages({
        client,
        limit: 25,
        mapping: {
          posts: {
            fields: {
              createdAt: { column: "created_at" },
              excerpt: { column: null },
              slug: { column: "slug" },
              title: { column: "title" },
              updatedAt: { column: null },
            },
            relations: {
              authors: undefined,
              categories: undefined,
              tags: undefined,
            },
            source: {
              primaryKey: "id",
              schema: "public",
              table: "posts",
            },
            workflow: null,
          },
        } as never,
        search: "hello",
        selectedIds: ["post-99"],
      }),
    ).resolves.toEqual([
      {
        id: "post-99",
        slug: "archive-page",
        title: "Archive Page",
      },
      {
        id: "post-1",
        slug: "hello-world",
        title: "Hello World",
      },
    ]);

    expect(client.query).toHaveBeenCalledTimes(2);
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("limit $2"),
      [["post-99"], 1],
    );
  });

  it("uses typed join-table relation batch lookups instead of text casts", async () => {
    getResolvedEntityMock.mockClear();
    getResolvedRelationTargetColumnMock.mockClear();

    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            post_id: "post-1",
            related_value: "category-1",
          },
        ],
      }),
    };

    await expect(
      getMappedRelationValuesForPosts({
        client,
        entity: {
          source: {
            primaryKey: "id",
            schema: "public",
            table: "categories",
          },
        } as never,
        postRows: [
          {
            id: "post-1",
          },
        ],
        posts: {
          fields: {
            id: { column: "id" },
          },
          relations: {},
          source: {
            primaryKey: "id",
            schema: "public",
            table: "posts",
          },
        } as never,
        relation: {
          fieldMap: {},
          junctionSourceColumn: "post_id",
          junctionTable: "public.post_categories",
          junctionTargetColumn: "category_id",
          multiple: true,
          sourceColumn: null,
          status: "mapped",
          strategy: "join_table",
          targetColumn: "id",
          targetEntity: "categories",
          targetTable: "public.categories",
          valueColumn: null,
        },
      }),
    ).resolves.toEqual(new Map([["post-1", ["category-1"]]]));

    const joinQuery = client.query.mock.calls[0]?.[0] as string;

    expect(joinQuery).toContain('select\n          "post_id" as post_id,\n          "category_id" as related_value');
    expect(joinQuery).toContain('where "post_id" = any($1::uuid[])');
    expect(joinQuery).not.toContain("::text");
    expect(getResolvedEntityMock).not.toHaveBeenCalled();
    expect(getResolvedRelationTargetColumnMock).not.toHaveBeenCalled();
  });

  it("short-circuits non-join-table relation rows when the raw values already match target ids", async () => {
    getResolvedRelationTargetColumnMock.mockClear();

    const client = {
      query: vi.fn(),
    };

    await expect(
      getMappedRelationValuesForPosts({
        client,
        entity: {
          source: {
            primaryKey: "id",
            schema: "public",
            table: "authors",
          },
        } as never,
        postRows: [
          {
            author_id: "author-1",
            id: "post-1",
          },
        ],
        posts: {
          fields: {
            id: { column: "id" },
          },
          relations: {},
          source: {
            primaryKey: "id",
            schema: "public",
            table: "posts",
          },
        } as never,
        relation: {
          fieldMap: {},
          junctionSourceColumn: null,
          junctionTable: null,
          junctionTargetColumn: null,
          multiple: false,
          sourceColumn: "author_id",
          status: "mapped",
          strategy: "foreign_key",
          targetColumn: "id",
          targetEntity: "authors",
          targetTable: "public.authors",
          valueColumn: null,
        },
      }),
    ).resolves.toEqual(new Map([["post-1", ["author-1"]]]));

    expect(getResolvedRelationTargetColumnMock).not.toHaveBeenCalled();
  });

  it("short-circuits relation resolution when targetColumn is omitted and values already represent ids", async () => {
    getResolvedEntityMock.mockClear();
    getResolvedRelationTargetColumnMock.mockClear();

    const client = {
      query: vi.fn(),
    };

    await expect(
      getMappedRelationValuesForPosts({
        client,
        entity: {
          source: {
            primaryKey: "id",
            schema: "public",
            table: "authors",
          },
        } as never,
        postRows: [
          {
            author_id: "author-1",
            id: "post-1",
          },
        ],
        posts: {
          fields: {
            id: { column: "id" },
          },
          relations: {},
          source: {
            primaryKey: "id",
            schema: "public",
            table: "posts",
          },
        } as never,
        relation: {
          fieldMap: {},
          junctionSourceColumn: null,
          junctionTable: null,
          junctionTargetColumn: null,
          multiple: false,
          sourceColumn: "author_id",
          status: "mapped",
          strategy: "foreign_key",
          targetColumn: null,
          targetEntity: "authors",
          targetTable: "public.authors",
          valueColumn: null,
        },
      }),
    ).resolves.toEqual(new Map([["post-1", ["author-1"]]]));

    expect(getResolvedEntityMock).not.toHaveBeenCalled();
    expect(getResolvedRelationTargetColumnMock).not.toHaveBeenCalled();
  });

  it("short-circuits join-table relation resolution when targetColumn is omitted and junction values already are ids", async () => {
    getResolvedEntityMock.mockClear();
    getResolvedRelationTargetColumnMock.mockClear();

    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            post_id: "post-1",
            related_value: "category-1",
          },
        ],
      }),
    };

    await expect(
      getMappedRelationValuesForPosts({
        client,
        entity: {
          source: {
            primaryKey: "id",
            schema: "public",
            table: "categories",
          },
        } as never,
        postRows: [
          {
            id: "post-1",
          },
        ],
        posts: {
          fields: {
            id: { column: "id" },
          },
          relations: {},
          source: {
            primaryKey: "id",
            schema: "public",
            table: "posts",
          },
        } as never,
        relation: {
          fieldMap: {},
          junctionSourceColumn: "post_id",
          junctionTable: "public.post_categories",
          junctionTargetColumn: "category_id",
          multiple: true,
          sourceColumn: null,
          status: "mapped",
          strategy: "join_table",
          targetColumn: null,
          targetEntity: "categories",
          targetTable: "public.categories",
          valueColumn: null,
        },
      }),
    ).resolves.toEqual(new Map([["post-1", ["category-1"]]]));

    expect(getResolvedEntityMock).not.toHaveBeenCalled();
    expect(getResolvedRelationTargetColumnMock).not.toHaveBeenCalled();
  });

  it("preserves orphaned foreign-key values instead of silently clearing them", async () => {
    getResolvedEntityMock.mockClear();
    getResolvedRelationTargetColumnMock.mockClear();
    getResolvedRelationTargetColumnMock.mockResolvedValue("slug");
    getRelationTargetTableNameMock.mockResolvedValue('"public"."authors"');

    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [],
      }),
    };

    await expect(
      getMappedRelationValuesForPosts({
        client,
        entity: {
          source: {
            primaryKey: "id",
            schema: "public",
            table: "authors",
          },
        } as never,
        postRows: [
          {
            author_slug: "missing-author",
            id: "post-1",
          },
        ],
        posts: {
          fields: {
            id: { column: "id" },
          },
          relations: {},
          source: {
            primaryKey: "id",
            schema: "public",
            table: "posts",
          },
        } as never,
        relation: {
          fieldMap: {},
          junctionSourceColumn: null,
          junctionTable: null,
          junctionTargetColumn: null,
          multiple: false,
          sourceColumn: "author_slug",
          status: "mapped",
          strategy: "foreign_key",
          targetColumn: "slug",
          targetEntity: "authors",
          targetTable: "public.authors",
          valueColumn: null,
        },
      }),
    ).resolves.toEqual(new Map([["post-1", ["missing-author"]]]));
  });

  it("dedupes duplicate join-table rows using deterministic fallback ordering", async () => {
    getResolvedEntityMock.mockClear();
    getResolvedRelationTargetColumnMock.mockClear();

    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            post_id: "post-1",
            related_value: "category-2",
          },
          {
            post_id: "post-1",
            related_value: "category-1",
          },
          {
            post_id: "post-1",
            related_value: "category-2",
          },
        ],
      }),
    };

    await expect(
      getMappedRelationValuesForPosts({
        client,
        entity: {
          source: {
            primaryKey: "id",
            schema: "public",
            table: "categories",
          },
        } as never,
        postRows: [
          {
            id: "post-1",
          },
        ],
        posts: {
          fields: {
            id: { column: "id" },
          },
          relations: {},
          source: {
            primaryKey: "id",
            schema: "public",
            table: "posts",
          },
        } as never,
        relation: {
          fieldMap: {},
          junctionSourceColumn: "post_id",
          junctionTable: "public.post_categories",
          junctionTargetColumn: "category_id",
          multiple: true,
          sourceColumn: null,
          status: "mapped",
          strategy: "join_table",
          targetColumn: null,
          targetEntity: "categories",
          targetTable: "public.categories",
          valueColumn: null,
        },
      }),
    ).resolves.toEqual(new Map([["post-1", ["category-1", "category-2"]]]));
  });

  it("preserves explicit join-table ordering when the junction table exposes an order column", async () => {
    getResolvedEntityMock.mockClear();
    getResolvedRelationTargetColumnMock.mockClear();
    getEntityAvailableColumnsMock.mockResolvedValueOnce(
      new Map<string, string>([
        ["category_id", "category_id"],
        ["post_id", "post_id"],
        ["sort_order", "sort_order"],
      ]),
    );

    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            post_id: "post-1",
            related_value: "category-1",
            sort_order: 2,
          },
          {
            post_id: "post-1",
            related_value: "category-2",
            sort_order: 1,
          },
          {
            post_id: "post-1",
            related_value: "category-3",
            sort_order: 3,
          },
        ],
      }),
    };

    await expect(
      getMappedRelationValuesForPosts({
        client,
        entity: {
          source: {
            primaryKey: "id",
            schema: "public",
            table: "categories",
          },
        } as never,
        postRows: [
          {
            id: "post-1",
          },
        ],
        posts: {
          fields: {
            id: { column: "id" },
          },
          relations: {},
          source: {
            primaryKey: "id",
            schema: "public",
            table: "posts",
          },
        } as never,
        relation: {
          fieldMap: {},
          junctionSourceColumn: "post_id",
          junctionTable: "public.post_categories",
          junctionTargetColumn: "category_id",
          multiple: true,
          sourceColumn: null,
          status: "mapped",
          strategy: "join_table",
          targetColumn: null,
          targetEntity: "categories",
          targetTable: "public.categories",
          valueColumn: null,
        },
      }),
    ).resolves.toEqual(new Map([["post-1", ["category-2", "category-1", "category-3"]]]));
  });

  it("short-circuits stored relation lookups when incoming ids already match the target ids", async () => {
    getResolvedRelationTargetColumnMock.mockClear();

    const client = {
      query: vi.fn(),
    };

    await expect(
      lookupStoredRelationValuesForIds({
        client,
        entity: {
          source: {
            primaryKey: "id",
            schema: "public",
            table: "authors",
          },
        } as never,
        ids: ["author-1"],
        posts: {
          fields: {
            id: { column: "id" },
          },
          relations: {},
          source: {
            primaryKey: "id",
            schema: "public",
            table: "posts",
          },
        } as never,
        relation: {
          fieldMap: {},
          junctionSourceColumn: null,
          junctionTable: null,
          junctionTargetColumn: null,
          multiple: false,
          sourceColumn: "author_id",
          status: "mapped",
          strategy: "foreign_key",
          targetColumn: "id",
          targetEntity: "authors",
          targetTable: "public.authors",
          valueColumn: null,
        },
      }),
    ).resolves.toEqual(["author-1"]);

    expect(getResolvedRelationTargetColumnMock).not.toHaveBeenCalled();
  });

  it("short-circuits relation row mapping when valueColumn already is the entity id", async () => {
    getResolvedEntityMock.mockClear();
    getResolvedRelationTargetColumnMock.mockClear();

    const client = {
      query: vi.fn(),
    };

    await expect(
      getMappedRelationValuesForPosts({
        client,
        entity: {
          source: {
            primaryKey: "id",
            schema: "public",
            table: "authors",
          },
        } as never,
        postRows: [
          {
            author_id: "author-1",
            id: "post-1",
          },
        ],
        posts: {
          fields: {
            id: { column: "id" },
          },
          relations: {},
          source: {
            primaryKey: "id",
            schema: "public",
            table: "posts",
          },
        } as never,
        relation: {
          fieldMap: {},
          junctionSourceColumn: null,
          junctionTable: null,
          junctionTargetColumn: null,
          multiple: false,
          sourceColumn: "author_id",
          status: "mapped",
          strategy: "foreign_key",
          targetColumn: "slug",
          targetEntity: "authors",
          targetTable: "public.authors",
          valueColumn: "id",
        },
      }),
    ).resolves.toEqual(new Map([["post-1", ["author-1"]]]));

    expect(getResolvedEntityMock).not.toHaveBeenCalled();
    expect(getResolvedRelationTargetColumnMock).not.toHaveBeenCalled();
  });

  it("short-circuits stored relation lookups when valueColumn already is the entity id", async () => {
    getResolvedEntityMock.mockClear();
    getResolvedRelationTargetColumnMock.mockClear();

    const client = {
      query: vi.fn(),
    };

    await expect(
      lookupStoredRelationValuesForIds({
        client,
        entity: {
          source: {
            primaryKey: "id",
            schema: "public",
            table: "authors",
          },
        } as never,
        ids: ["author-1"],
        posts: {
          fields: {
            id: { column: "id" },
          },
          relations: {},
          source: {
            primaryKey: "id",
            schema: "public",
            table: "posts",
          },
        } as never,
        relation: {
          fieldMap: {},
          junctionSourceColumn: null,
          junctionTable: null,
          junctionTargetColumn: null,
          multiple: false,
          sourceColumn: "author_id",
          status: "mapped",
          strategy: "foreign_key",
          targetColumn: "slug",
          targetEntity: "authors",
          targetTable: "public.authors",
          valueColumn: "id",
        },
      }),
    ).resolves.toEqual(["author-1"]);

    expect(getResolvedEntityMock).not.toHaveBeenCalled();
    expect(getResolvedRelationTargetColumnMock).not.toHaveBeenCalled();
  });

  it("reuses the mapped entity source when targetTable and targetColumn already point to it", async () => {
    getResolvedEntityMock.mockClear();
    getResolvedRelationTargetColumnMock.mockClear();
    getResolvedRelationTargetColumnMock.mockResolvedValue("slug");
    getRelationTargetTableNameMock.mockResolvedValue('"public"."authors"');

    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            id: "author-1",
            target_value: "hello-author",
          },
        ],
      }),
    };

    await expect(
      getMappedRelationValuesForPosts({
        client,
        entity: {
          source: {
            primaryKey: "id",
            schema: "public",
            table: "authors",
          },
        } as never,
        postRows: [
          {
            author_slug: "hello-author",
            id: "post-1",
          },
        ],
        posts: {
          fields: {
            id: { column: "id" },
          },
          relations: {},
          source: {
            primaryKey: "id",
            schema: "public",
            table: "posts",
          },
        } as never,
        relation: {
          fieldMap: {},
          junctionSourceColumn: null,
          junctionTable: null,
          junctionTargetColumn: null,
          multiple: false,
          sourceColumn: "author_slug",
          status: "mapped",
          strategy: "foreign_key",
          targetColumn: "slug",
          targetEntity: "authors",
          targetTable: "public.authors",
          valueColumn: null,
        },
      }),
    ).resolves.toEqual(new Map([["post-1", ["author-1"]]]));

    expect(getResolvedEntityMock).not.toHaveBeenCalled();
    expect(getResolvedRelationTargetColumnMock).not.toHaveBeenCalled();
  });

  it("reuses the mapped entity source for stored value lookups when targetTable and targetColumn already point to it", async () => {
    getResolvedEntityMock.mockClear();
    getResolvedRelationTargetColumnMock.mockClear();
    getResolvedRelationTargetColumnMock.mockResolvedValue("slug");
    getRelationTargetTableNameMock.mockResolvedValue('"public"."authors"');

    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            entity_id: "author-1",
            target_value: "hello-author",
          },
        ],
      }),
    };

    await expect(
      lookupStoredRelationValuesForIds({
        client,
        entity: {
          source: {
            primaryKey: "id",
            schema: "public",
            table: "authors",
          },
        } as never,
        ids: ["author-1"],
        posts: {
          fields: {
            id: { column: "id" },
          },
          relations: {},
          source: {
            primaryKey: "id",
            schema: "public",
            table: "posts",
          },
        } as never,
        relation: {
          fieldMap: {},
          junctionSourceColumn: null,
          junctionTable: null,
          junctionTargetColumn: null,
          multiple: false,
          sourceColumn: "author_slug",
          status: "mapped",
          strategy: "foreign_key",
          targetColumn: "slug",
          targetEntity: "authors",
          targetTable: "public.authors",
          valueColumn: null,
        },
      }),
    ).resolves.toEqual(["hello-author"]);

    expect(getResolvedEntityMock).not.toHaveBeenCalled();
    expect(getResolvedRelationTargetColumnMock).not.toHaveBeenCalled();
  });

  it("uses typed predicates for mapped-table slug checks when metadata is known", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [],
      }),
    };

    await expect(
      getUniqueSlugForMappedTable({
        base: "Hello World",
        client,
        excludeId: "post-1",
        idColumn: "id",
        slugColumn: "slug",
        tableName: '"public"."posts"',
      }),
    ).resolves.toBe("hello-world");

    const slugQuery = client.query.mock.calls[0]?.[0] as string;

    expect(slugQuery).toContain('where "slug" = $1');
    expect(slugQuery).toContain('and "id" <> $2');
    expect(slugQuery).not.toContain('and ($2 is null or "id" <> $2)');
    expect(slugQuery).not.toContain('"slug"::text');
    expect(slugQuery).not.toContain('and ($2::text is null or "id"::text <> $2::text)');
  });

  it("uses JSON-path slug predicates when the slug is mapped inside a JSON column", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [],
      }),
    };

    await expect(
      getUniqueSlugForMappedTable({
        base: "Hello World",
        client,
        entity: {
          fields: {
            slug: {
              column: "route_payload",
              kind: "slug",
              label: "Slug",
              path: "slug.current",
              required: false,
              visible: true,
            },
          },
          source: {
            primaryKey: "id",
          },
        } as never,
        excludeId: "post-1",
        idColumn: "id",
        slugColumn: "route_payload",
        tableName: '"public"."posts"',
      }),
    ).resolves.toBe("hello-world");

    const slugQuery = client.query.mock.calls[0]?.[0] as string;

    expect(slugQuery).toContain(`where "route_payload"#>>array['slug', 'current'] = $1::text`);
    expect(slugQuery).toContain('and "id" <> $2');
    expect(slugQuery).not.toContain('"route_payload" = $1');
  });

  it("does not allocate an ambiguous second parameter when there is no excluded id", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [],
      }),
    };

    await expect(
      getUniqueSlugForMappedTable({
        base: "Hello World",
        client,
        idColumn: "id",
        slugColumn: "slug",
        tableName: '"public"."posts"',
      }),
    ).resolves.toBe("hello-world");

    const slugQuery = client.query.mock.calls[0]?.[0] as string;
    const slugParams = client.query.mock.calls[0]?.[1];

    expect(slugQuery).toContain('where "slug" = $1');
    expect(slugQuery).not.toContain("$2");
    expect(slugParams).toEqual(["hello-world"]);
  });

  it("uses typed predicates for mapped relation writes when metadata is known", async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              id: "category-1",
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
    };

    await applyMappedRelationWrite({
      client,
      entity: {
        source: {
          primaryKey: "id",
          schema: "public",
          table: "categories",
        },
      } as never,
      ids: ["category-1"],
      postId: "post-1",
      posts: {
        fields: {},
        relations: {},
        source: {
          primaryKey: "id",
          schema: "public",
          table: "posts",
        },
      } as never,
      relation: {
        fieldMap: {},
        junctionSourceColumn: "post_id",
        junctionTable: "public.post_categories",
        junctionTargetColumn: "category_id",
        multiple: true,
        sourceColumn: null,
        status: "mapped",
        strategy: "join_table",
        targetColumn: "id",
        targetEntity: "categories",
        targetTable: "public.categories",
        valueColumn: null,
      },
    });

    const deleteQuery = client.query.mock.calls
      .map(([query]) => query as string)
      .find((query) => query.includes('delete from "public"."post_categories"'));

    expect(deleteQuery).toContain('delete from "public"."post_categories" where "post_id" = $1');
    expect(deleteQuery).not.toContain('"post_id"::text = $1');
  });

  it("writes explicit join-table order values when the junction table exposes an order column", async () => {
    getEntityAvailableColumnsMock.mockResolvedValueOnce(
      new Map<string, string>([
        ["category_id", "category_id"],
        ["post_id", "post_id"],
        ["sort_order", "sort_order"],
      ]),
    );

    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              id: "category-2",
            },
            {
              id: "category-1",
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
    };

    await applyMappedRelationWrite({
      client,
      entity: {
        source: {
          primaryKey: "id",
          schema: "public",
          table: "categories",
        },
      } as never,
      ids: ["category-2", "category-1"],
      postId: "post-1",
      posts: {
        fields: {},
        relations: {},
        source: {
          primaryKey: "id",
          schema: "public",
          table: "posts",
        },
      } as never,
      relation: {
        fieldMap: {},
        junctionSourceColumn: "post_id",
        junctionTable: "public.post_categories",
        junctionTargetColumn: "category_id",
        multiple: true,
        sourceColumn: null,
        status: "mapped",
        strategy: "join_table",
        targetColumn: "id",
        targetEntity: "categories",
        targetTable: "public.categories",
        valueColumn: null,
      },
    });

    const insertQueries = client.query.mock.calls.filter(([query]) =>
      (query as string).includes('insert into "public"."post_categories"'),
    );

    expect(insertQueries).toHaveLength(2);
    expect(insertQueries[0]?.[0]).toContain('("post_id", "category_id", "sort_order")');
    expect(insertQueries[0]?.[1]).toEqual(["post-1", "category-2", 0]);
    expect(insertQueries[1]?.[1]).toEqual(["post-1", "category-1", 1]);
  });

  it("maps related_row_by_post_id helper rows through target-column lookups", async () => {
    getRelationJunctionTableNameMock.mockReturnValueOnce('"public"."post_author_helper"');

    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              post_id: "post-1",
              related_value: "ada-lovelace",
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: "author-1",
              target_value: "ada-lovelace",
            },
          ],
        }),
    };

    const mappedValues = await getMappedRelationValuesForPosts({
      client,
      entity: {
        source: {
          primaryKey: "id",
          schema: "public",
          table: "authors",
        },
      } as never,
      postRows: [{ id: "post-1" }],
      posts: {
        fields: {},
        relations: {},
        source: {
          primaryKey: "id",
          schema: "public",
          table: "posts",
        },
      } as never,
      relation: {
        fieldMap: {},
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
      },
    });

    expect(mappedValues.get("post-1")).toEqual(["author-1"]);
    expect(client.query.mock.calls[0]?.[0]).toContain('from "public"."post_author_helper"');
  });

  it("maps join_row helper rows through target-column lookups", async () => {
    getRelationJunctionTableNameMock.mockReturnValueOnce('"public"."post_parent_helper"');

    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              post_id: "post-1",
              related_value: "docs",
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: "post-parent",
              target_value: "docs",
            },
          ],
        }),
    };

    const mappedValues = await getMappedRelationValuesForPosts({
      client,
      entity: {
        source: {
          primaryKey: "id",
          schema: "public",
          table: "posts",
        },
      } as never,
      postRows: [{ id: "post-1" }],
      posts: {
        fields: {},
        relations: {},
        source: {
          primaryKey: "id",
          schema: "public",
          table: "posts",
        },
      } as never,
      relation: {
        fieldMap: {},
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
      },
    });

    expect(mappedValues.get("post-1")).toEqual(["post-parent"]);
    expect(client.query.mock.calls[0]?.[0]).toContain('from "public"."post_parent_helper"');
  });

  it("maps polymorphic join rows through target-column lookups and discriminator filters", async () => {
    getRelationJunctionTableNameMock.mockReturnValueOnce('"public"."post_tags"');

    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              post_id: "post-1",
              related_value: "tag-2",
              sort_order: 0,
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: "tag-2",
              target_value: "tag-2",
            },
          ],
        }),
    };

    const mappedValues = await getMappedRelationValuesForPosts({
      client,
      entity: {
        source: {
          primaryKey: "id",
          schema: "public",
          table: "tags",
        },
      } as never,
      postRows: [{ id: "post-1" }],
      posts: {
        fields: {},
        relations: {},
        source: {
          primaryKey: "id",
          schema: "public",
          table: "posts",
        },
      } as never,
      relation: {
        discriminatorColumn: "owner_type",
        discriminatorValue: "post",
        fieldMap: {},
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
    });

    expect(mappedValues.get("post-1")).toEqual(["tag-2"]);
    expect(client.query.mock.calls[0]?.[0]).toContain('from "public"."post_tags"');
    expect(client.query.mock.calls[0]?.[0]).toContain('"owner_type"::text = $2::text');
    expect(client.query.mock.calls[0]?.[1]).toEqual([["post-1"], "post"]);
  });

  it("maps value_match_relation source values through the target match column", async () => {
    const client = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [
          {
            id: "category-1",
            target_value: "launch",
          },
        ],
      }),
    };

    const mappedValues = await getMappedRelationValuesForPosts({
      client,
      entity: {
        source: {
          primaryKey: "id",
          schema: "public",
          table: "categories",
        },
      } as never,
      postRows: [{ category_slugs: ["launch", "legacy"], id: "post-1" }],
      posts: {
        fields: {},
        relations: {},
        source: {
          primaryKey: "id",
          schema: "public",
          table: "posts",
        },
      } as never,
      relation: {
        fieldMap: {},
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
      },
    });

    expect(mappedValues.get("post-1")).toEqual(["category-1", "legacy"]);
  });

  it("upserts related_row_by_post_id helper rows with stored target values", async () => {
    getRelationJunctionTableNameMock
      .mockReturnValueOnce('"public"."post_author_helper"')
      .mockReturnValueOnce('"public"."post_author_helper"');

    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              entity_id: "author-1",
              target_value: "ada-lovelace",
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
    };

    await applyMappedRelationWrite({
      client,
      entity: {
        source: {
          primaryKey: "id",
          schema: "public",
          table: "authors",
        },
      } as never,
      ids: ["author-1"],
      postId: "post-1",
      posts: {
        fields: {},
        relations: {},
        source: {
          primaryKey: "id",
          schema: "public",
          table: "posts",
        },
      } as never,
      relation: {
        fieldMap: {},
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
      },
    });

    const insertCall = client.query.mock.calls.find(([query]) =>
      (query as string).includes('insert into "public"."post_author_helper"'),
    );
    const insertQuery = insertCall?.[0] as string;
    const insertParams = insertCall?.[1];

    expect(insertQuery).toContain('insert into "public"."post_author_helper"');
    expect(insertParams).toEqual(["post-1", "ada-lovelace"]);
  });

  it("patches related_row_by_post_id relation helper rows without replacing sibling columns", async () => {
    getRelationJunctionTableNameMock.mockReturnValue('"public"."post_author_helper"');

    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              entity_id: "author-1",
              target_value: "ada-lovelace",
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }),
    };

    await applyMappedRelationWrite({
      client,
      entity: {
        source: {
          primaryKey: "id",
          schema: "public",
          table: "authors",
        },
      } as never,
      ids: ["author-1"],
      postId: "post-1",
      posts: {
        fields: {},
        relations: {},
        source: {
          primaryKey: "id",
          schema: "public",
          table: "posts",
        },
      } as never,
      relation: {
        fieldMap: {},
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
      },
    });

    const updateCall = client.query.mock.calls.find(([query]) =>
      (query as string).includes('update "public"."post_author_helper"'),
    );

    expect(updateCall?.[0]).toContain('"author_slug" = $1');
    expect(updateCall?.[1]).toEqual(["ada-lovelace", "post-1"]);
    expect(
      client.query.mock.calls.some(([query]) => (query as string).includes('delete from "public"."post_author_helper"')),
    ).toBe(false);
    expect(
      client.query.mock.calls.some(([query]) => (query as string).includes('insert into "public"."post_author_helper"')),
    ).toBe(false);
  });

  it("rejects single-value helper-row writes when duplicate helper rows already exist", async () => {
    getRelationJunctionTableNameMock.mockReturnValueOnce('"public"."post_author_helper"');

    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              post_id: "post-1",
              related_value: "author-2",
            },
            {
              post_id: "post-1",
              related_value: "author-1",
            },
          ],
        }),
    };

    await expect(
      applyMappedRelationWrite({
        client,
        entity: {
          source: {
            primaryKey: "id",
            schema: "public",
            table: "authors",
          },
        } as never,
        fieldKey: "author",
        ids: ["author-1"],
        postId: "post-1",
        posts: {
          fields: {},
          relations: {},
          source: {
            primaryKey: "id",
            schema: "public",
            table: "posts",
          },
        } as never,
        relation: {
          fieldMap: {},
          junctionSourceColumn: "post_id",
          junctionTable: "public.post_author_helper",
          junctionTargetColumn: null,
          multiple: false,
          sourceColumn: null,
          status: "mapped",
          strategy: "related_row_by_post_id",
          targetColumn: "id",
          targetEntity: "authors",
          targetTable: "public.authors",
          valueColumn: "author_id",
        },
      }),
    ).rejects.toMatchObject({
      errors: [
        expect.objectContaining({
          code: "helper_row_ambiguity",
          fieldKey: "author",
          metadata: {
            helperRowCount: 2,
            values: ["author-1", "author-2"],
          },
        }),
      ],
      message:
        "This field has duplicate source records. Ask an owner to fix the setup before editing it.",
    });

    expect(
      client.query.mock.calls.some(([query]) => (query as string).includes('delete from "public"."post_author_helper"')),
    ).toBe(false);
  });

  it("replaces polymorphic join rows with discriminator metadata", async () => {
    getRelationJunctionTableNameMock.mockReturnValueOnce('"public"."post_tags"');

    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              entity_id: "tag-2",
              target_value: "tag-2",
            },
            {
              entity_id: "tag-1",
              target_value: "tag-1",
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
    };

    await applyMappedRelationWrite({
      client,
      entity: {
        source: {
          primaryKey: "id",
          schema: "public",
          table: "tags",
        },
      } as never,
      ids: ["tag-2", "tag-1"],
      postId: "post-1",
      posts: {
        fields: {},
        relations: {},
        source: {
          primaryKey: "id",
          schema: "public",
          table: "posts",
        },
      } as never,
      relation: {
        discriminatorColumn: "owner_type",
        discriminatorValue: "post",
        fieldMap: {},
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
    });

    const deleteCall = client.query.mock.calls.find(([query]) =>
      (query as string).includes('delete from "public"."post_tags"'),
    );
    const insertCalls = client.query.mock.calls.filter(([query]) =>
      (query as string).includes('insert into "public"."post_tags"'),
    );
    const deleteQuery = deleteCall?.[0] as string;
    const deleteParams = deleteCall?.[1];
    const firstInsertParams = insertCalls[0]?.[1];
    const secondInsertParams = insertCalls[1]?.[1];

    expect(deleteQuery).toContain('delete from "public"."post_tags"');
    expect(deleteQuery).toContain('"owner_type"::text = $2::text');
    expect(deleteParams).toEqual(["post-1", "post"]);
    expect(firstInsertParams).toEqual(["post", "post-1", "tag-2"]);
    expect(secondInsertParams).toEqual(["post", "post-1", "tag-1"]);
  });

  it("writes value_match_relation values back to the post row", async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              entity_id: "post-parent",
              target_value: "docs",
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }),
    };

    await applyMappedRelationWrite({
      client,
      entity: {
        source: {
          primaryKey: "id",
          schema: "public",
          table: "posts",
        },
      } as never,
      ids: ["post-parent"],
      postId: "post-1",
      posts: {
        fields: {},
        relations: {},
        source: {
          primaryKey: "id",
          schema: "public",
          table: "posts",
        },
      } as never,
      relation: {
        fieldMap: {},
        junctionSourceColumn: null,
        junctionTable: null,
        junctionTargetColumn: null,
        multiple: false,
        sourceColumn: "parent_slug",
        status: "mapped",
        strategy: "value_match_relation",
        targetColumn: "slug",
        targetEntity: "posts",
        targetTable: "public.posts",
        valueColumn: null,
      },
    });

    const updateQuery = client.query.mock.calls[1]?.[0] as string;
    const updateParams = client.query.mock.calls[1]?.[1];

    expect(updateQuery).toContain('set "parent_slug" = $2');
    expect(updateParams).toEqual(["post-1", "docs"]);
  });

  it("maps explicit post fields from JSON-path-backed columns", async () => {
    await expect(
      mapMappedContentPostRow({
        client: {
          query: vi.fn(),
        },
        postRow: {
          id: "post-1",
          route_payload: {
            slug: {
              current: "hello-world",
            },
          },
          seo_payload: {
            description: "Launch notes",
            keyword: "launch",
            title: "Hello World SEO",
          },
          summary_payload: {
            excerpt: "A JSON-backed excerpt",
          },
          title_payload: {
            value: "Hello World",
          },
        },
        runtime: {
          authors: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "authors",
            },
          },
          categories: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "categories",
            },
          },
          posts: {
            customFields: [],
            editorFields: [],
            fields: {
              createdAt: { column: "created_at", kind: "datetime", label: "Created At", path: null, required: false, visible: true },
              excerpt: {
                column: "summary_payload",
                kind: "plain_text",
                label: "Excerpt",
                path: "excerpt",
                required: false,
                visible: true,
              },
              featuredImageUrl: {
                column: "media_payload",
                kind: "text",
                label: "Featured Image",
                path: "featured.url",
                required: false,
                visible: true,
              },
              focusKeyword: {
                column: "seo_payload",
                kind: "text",
                label: "Focus Keyword",
                path: "keyword",
                required: false,
                visible: true,
              },
              seoDescription: {
                column: "seo_payload",
                kind: "text",
                label: "SEO Description",
                path: "description",
                required: false,
                visible: true,
              },
              seoTitle: {
                column: "seo_payload",
                kind: "text",
                label: "SEO Title",
                path: "title",
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
                column: "title_payload",
                kind: "text",
                label: "Title",
                path: "value",
                required: true,
                visible: true,
              },
              updatedAt: { column: "updated_at", kind: "datetime", label: "Updated At", path: null, required: false, visible: true },
            },
            relations: {
              authors: undefined,
              categories: undefined,
              tags: undefined,
            },
            source: {
              primaryKey: "id",
            },
            workflow: null,
          },
          tags: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "tags",
            },
          },
        } as never,
      }),
    ).resolves.toMatchObject({
      excerpt: "A JSON-backed excerpt",
      focusKeyword: "launch",
      seoDescription: "Launch notes",
      seoTitle: "Hello World SEO",
      slug: "hello-world",
      title: "Hello World",
    });
  });

  it("maps normalized post-list preview rows from direct-column storage", async () => {
    getMappedPublishedAtColumnMock.mockReturnValue("published_at");
    getPostStatusFromRowMock.mockReturnValue("published");

    await expect(
      mapMappedContentPostListRow({
        client: {
          query: vi.fn(),
        },
        postRow: {
          author_id: "author-1",
          created_at: "2026-04-05T00:00:00.000Z",
          headline: "Preview title",
          id: "post-1",
          published_at: "2026-04-06T08:30:00.000Z",
          slug: "preview-title",
          summary: "Preview summary",
          updated_at: "2026-04-05T01:00:00.000Z",
        },
        runtime: {
          authors: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "authors",
            },
          },
          categories: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "categories",
            },
          },
          posts: {
            customFields: [],
            editorFields: [],
            fields: {
              createdAt: { column: "created_at", kind: "datetime", label: "Created At", path: null, required: false, visible: true },
              excerpt: { column: "summary", kind: "plain_text", label: "Excerpt", path: null, required: false, visible: true },
              slug: { column: "slug", kind: "slug", label: "Slug", path: null, required: false, visible: true },
              title: { column: "headline", kind: "text", label: "Title", path: null, required: true, visible: true },
              updatedAt: { column: "updated_at", kind: "datetime", label: "Updated At", path: null, required: false, visible: true },
            },
            relations: {
              authors: {
                fieldMap: {},
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
            },
            source: {
              primaryKey: "id",
              schema: "public",
              table: "posts",
            },
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
            source: {
              primaryKey: "id",
              schema: "public",
              table: "tags",
            },
          },
        } as never,
      }),
    ).resolves.toEqual({
      authorId: "author-1",
      createdAt: "2026-04-05T00:00:00.000Z",
      excerpt: "Preview summary",
      id: "post-1",
      publishedAt: "2026-04-06T08:30:00.000Z",
      slug: "preview-title",
      status: "published",
      title: "Preview title",
      updatedAt: "2026-04-05T01:00:00.000Z",
    });
  });

  it("maps every explicit built-in field from direct-column storage", async () => {
    getMappedPublishedAtColumnMock.mockReturnValue("published_at");
    getPostStatusFromRowMock.mockReturnValue("published");

    await expect(
      mapMappedContentPostRow({
        client: {
          query: vi.fn(),
        },
        postRow: {
          author_id: "author-1",
          category_ids: ["category-1", "category-2", "category-1"],
          created_at: "2026-04-05T00:00:00.000Z",
          featured_image_url: "https://example.com/feature.png",
          focus_keyword: "launch",
          headline: "Hello from adapter",
          id: "post-1",
          parent_post_id: "post-parent",
          publication_state: "published",
          published_at: "2026-04-06T08:30:00.000Z",
          redirect_history: '["old-post","older-post","old-post",""]',
          route_slug: "hello-from-adapter",
          seo_description: "Launch notes",
          seo_title: "Hello World SEO",
          summary: "A direct-column excerpt",
          tag_ids: ["tag-1", "tag-2", "tag-1"],
          updated_at: "2026-04-05T01:00:00.000Z",
        },
        runtime: {
          authors: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "authors",
            },
          },
          categories: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "categories",
            },
          },
          posts: {
            customFields: [],
            editorFields: [],
            fields: {
              createdAt: { column: "created_at", kind: "datetime", label: "Created At", path: null, required: false, visible: true },
              excerpt: { column: "summary", kind: "plain_text", label: "Excerpt", path: null, required: false, visible: true },
              featuredImageUrl: { column: "featured_image_url", kind: "text", label: "Featured Image", path: null, required: false, visible: true },
              focusKeyword: { column: "focus_keyword", kind: "text", label: "Focus Keyword", path: null, required: false, visible: true },
              publishedAt: { column: "published_at", kind: "datetime", label: "Published At", path: null, required: false, visible: true },
              redirects: { column: "redirect_history", kind: "plain_text", label: "Redirects", path: null, required: false, visible: true },
              seoDescription: { column: "seo_description", kind: "plain_text", label: "SEO Description", path: null, required: false, visible: true },
              seoTitle: { column: "seo_title", kind: "text", label: "SEO Title", path: null, required: false, visible: true },
              slug: { column: "route_slug", kind: "slug", label: "Slug", path: null, required: false, visible: true },
              status: { column: "publication_state", kind: "text", label: "Status", path: null, required: false, visible: true },
              title: { column: "headline", kind: "text", label: "Title", path: null, required: true, visible: true },
              updatedAt: { column: "updated_at", kind: "datetime", label: "Updated At", path: null, required: false, visible: true },
            },
            relations: {
              authors: {
                fieldMap: {},
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
                fieldMap: {},
                junctionSourceColumn: null,
                junctionTable: null,
                junctionTargetColumn: null,
                multiple: true,
                sourceColumn: "category_ids",
                status: "mapped",
                strategy: "array",
                targetColumn: "id",
                targetEntity: "categories",
                targetTable: null,
                valueColumn: null,
              },
              posts: {
                fieldMap: {},
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
              tags: {
                fieldMap: {},
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
            source: {
              primaryKey: "id",
              schema: "public",
              table: "posts",
            },
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
            source: {
              primaryKey: "id",
              schema: "public",
              table: "tags",
            },
          },
        } as never,
      }),
    ).resolves.toMatchObject({
      authorId: "author-1",
      categoryIds: ["category-1", "category-2"],
      createdAt: "2026-04-05T00:00:00.000Z",
      excerpt: "A direct-column excerpt",
      featuredImageUrl: "https://example.com/feature.png",
      focusKeyword: "launch",
      parentPageId: "post-parent",
      publishedAt: "2026-04-06T08:30:00.000Z",
      redirects: [
        {
          active: null,
          locale: null,
          source: "old-post",
          statusCode: null,
        },
        {
          active: null,
          locale: null,
          source: "older-post",
          statusCode: null,
        },
      ],
      seoDescription: "Launch notes",
      seoTitle: "Hello World SEO",
      slug: "hello-from-adapter",
      status: "published",
      tagIds: ["tag-1", "tag-2"],
      title: "Hello from adapter",
      updatedAt: "2026-04-05T01:00:00.000Z",
    });
  });

  it("normalizes structured redirect rows from JSON text storage", async () => {
    await expect(
      mapMappedContentPostRow({
        client: { query: vi.fn() } as never,
        postRow: {
          created_at: "2026-04-05T00:00:00.000Z",
          headline: "Hello from adapter",
          id: "post-1",
          publication_state: "draft",
          redirect_history:
            '[{"source":"old-post","statusCode":301,"locale":"en","active":true},{"source":"older-post"}]',
          route_slug: "hello-from-adapter",
          updated_at: "2026-04-05T01:00:00.000Z",
        },
        runtime: {
          authors: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "authors",
            },
          },
          categories: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "categories",
            },
          },
          posts: {
            customFields: [],
            editorFields: [],
            fields: {
              createdAt: { column: "created_at", kind: "datetime", label: "Created At", path: null, required: false, visible: true },
              redirects: { column: "redirect_history", kind: "plain_text", label: "Redirects", path: null, required: false, visible: true },
              slug: { column: "route_slug", kind: "slug", label: "Slug", path: null, required: false, visible: true },
              status: { column: "publication_state", kind: "text", label: "Status", path: null, required: false, visible: true },
              title: { column: "headline", kind: "text", label: "Title", path: null, required: true, visible: true },
              updatedAt: { column: "updated_at", kind: "datetime", label: "Updated At", path: null, required: false, visible: true },
            },
            relations: {
              authors: {
                fieldMap: {},
                junctionSourceColumn: null,
                junctionTable: null,
                junctionTargetColumn: null,
                multiple: false,
                sourceColumn: null,
                status: "unmapped",
                strategy: "none",
                targetColumn: null,
                targetEntity: null,
                targetTable: null,
                valueColumn: null,
              },
              categories: {
                fieldMap: {},
                junctionSourceColumn: null,
                junctionTable: null,
                junctionTargetColumn: null,
                multiple: true,
                sourceColumn: null,
                status: "unmapped",
                strategy: "none",
                targetColumn: null,
                targetEntity: null,
                targetTable: null,
                valueColumn: null,
              },
              posts: {
                fieldMap: {},
                junctionSourceColumn: null,
                junctionTable: null,
                junctionTargetColumn: null,
                multiple: false,
                sourceColumn: null,
                status: "unmapped",
                strategy: "none",
                targetColumn: null,
                targetEntity: null,
                targetTable: null,
                valueColumn: null,
              },
              tags: {
                fieldMap: {},
                junctionSourceColumn: null,
                junctionTable: null,
                junctionTargetColumn: null,
                multiple: true,
                sourceColumn: null,
                status: "unmapped",
                strategy: "none",
                targetColumn: null,
                targetEntity: null,
                targetTable: null,
                valueColumn: null,
              },
            },
            source: {
              primaryKey: "id",
              schema: "public",
              table: "posts",
            },
            workflow: {
              archivedValues: ["archived"],
              customValues: [],
              draftValues: ["draft"],
              mode: "status",
              publishedAtColumn: null,
              publishedFlagColumn: null,
              publishedValues: ["published"],
              statusColumn: "publication_state",
            },
          },
          tags: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "tags",
            },
          },
        } as never,
      }),
    ).resolves.toMatchObject({
      redirects: [
        {
          active: true,
          locale: "en",
          source: "old-post",
          statusCode: 301,
        },
        {
          source: "older-post",
        },
      ],
    });
  });

  it("normalizes stringified redirect row objects from array storage", async () => {
    await expect(
      mapMappedContentPostRow({
        client: { query: vi.fn() } as never,
        postRow: {
          created_at: "2026-04-05T00:00:00.000Z",
          headline: "Hello from adapter",
          id: "post-1",
          publication_state: "draft",
          redirect_history: [
            '{"source":"old-post","statusCode":301,"locale":"en","active":true}',
            "older-post",
          ],
          route_slug: "hello-from-adapter",
          updated_at: "2026-04-05T01:00:00.000Z",
        },
        runtime: {
          authors: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "authors",
            },
          },
          categories: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "categories",
            },
          },
          posts: {
            customFields: [],
            editorFields: [],
            fields: {
              createdAt: { column: "created_at", kind: "datetime", label: "Created At", path: null, required: false, visible: true },
              redirects: { column: "redirect_history", kind: "array", label: "Redirects", path: null, required: false, visible: true },
              slug: { column: "route_slug", kind: "slug", label: "Slug", path: null, required: false, visible: true },
              status: { column: "publication_state", kind: "text", label: "Status", path: null, required: false, visible: true },
              title: { column: "headline", kind: "text", label: "Title", path: null, required: true, visible: true },
              updatedAt: { column: "updated_at", kind: "datetime", label: "Updated At", path: null, required: false, visible: true },
            },
            relations: {
              authors: {
                fieldMap: {},
                junctionSourceColumn: null,
                junctionTable: null,
                junctionTargetColumn: null,
                multiple: false,
                sourceColumn: null,
                status: "unmapped",
                strategy: "none",
                targetColumn: null,
                targetEntity: null,
                targetTable: null,
                valueColumn: null,
              },
              categories: {
                fieldMap: {},
                junctionSourceColumn: null,
                junctionTable: null,
                junctionTargetColumn: null,
                multiple: true,
                sourceColumn: null,
                status: "unmapped",
                strategy: "none",
                targetColumn: null,
                targetEntity: null,
                targetTable: null,
                valueColumn: null,
              },
              tags: {
                fieldMap: {},
                junctionSourceColumn: null,
                junctionTable: null,
                junctionTargetColumn: null,
                multiple: true,
                sourceColumn: null,
                status: "unmapped",
                strategy: "none",
                targetColumn: null,
                targetEntity: null,
                targetTable: null,
                valueColumn: null,
              },
            },
            source: {
              kind: "table",
              primaryKey: "id",
              schema: "public",
              table: "posts",
            },
          },
          tags: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "tags",
            },
          },
        } as never,
      }),
    ).resolves.toMatchObject({
      redirects: [
        {
          active: true,
          locale: "en",
          source: "old-post",
          statusCode: 301,
        },
        {
          active: null,
          locale: null,
          source: "older-post",
          statusCode: null,
        },
      ],
    });
  });

  it("includes mapped redirects columns in editor post selects", () => {
    expect(
      buildMappedContentPostEditorSelectClause({
        customFields: [],
        editorFields: [],
        fields: {
          createdAt: { column: "created_at", kind: "datetime", label: "Created At", path: null, required: false, visible: true },
          redirects: { column: "redirect_paths", kind: "array", label: "Redirects", path: null, required: false, visible: true },
          slug: { column: "slug", kind: "slug", label: "Slug", path: null, required: false, visible: true },
          title: { column: "title", kind: "text", label: "Title", path: null, required: true, visible: true },
          updatedAt: { column: "updated_at", kind: "datetime", label: "Updated At", path: null, required: false, visible: true },
        },
        relations: {
          authors: {
            fieldMap: {},
            junctionSourceColumn: null,
            junctionTable: null,
            junctionTargetColumn: null,
            multiple: false,
            sourceColumn: null,
            status: "unmapped",
            strategy: "none",
            targetColumn: null,
            targetEntity: null,
            targetTable: null,
            valueColumn: null,
          },
          categories: {
            fieldMap: {},
            junctionSourceColumn: null,
            junctionTable: null,
            junctionTargetColumn: null,
            multiple: true,
            sourceColumn: null,
            status: "unmapped",
            strategy: "none",
            targetColumn: null,
            targetEntity: null,
            targetTable: null,
            valueColumn: null,
          },
          posts: {
            fieldMap: {},
            junctionSourceColumn: null,
            junctionTable: null,
            junctionTargetColumn: null,
            multiple: false,
            sourceColumn: null,
            status: "unmapped",
            strategy: "none",
            targetColumn: null,
            targetEntity: null,
            targetTable: null,
            valueColumn: null,
          },
          tags: {
            fieldMap: {},
            junctionSourceColumn: null,
            junctionTable: null,
            junctionTargetColumn: null,
            multiple: true,
            sourceColumn: null,
            status: "unmapped",
            strategy: "none",
            targetColumn: null,
            targetEntity: null,
            targetTable: null,
            valueColumn: null,
          },
        },
        source: {
          primaryKey: "id",
          schema: "public",
          table: "posts",
        },
      } as never),
    ).toContain('"redirect_paths"');
  });

  it("maps built-in scalar fields from relation-backed and helper-row-backed sources", async () => {
    const queryMock = vi.fn(async (sql: string) => {
        if (sql.includes('from "public"."post_title_rows"')) {
          return {
            rows: [
              {
                id: "title-row-1",
                title_value: "Related title",
              },
            ],
          };
        }

        if (sql.includes('from "public"."post_route_rows"')) {
          return {
            rows: [
              {
                id: "route-row-1",
                slug_value: "related-slug",
              },
            ],
          };
        }

        if (sql.includes('from "public"."post_excerpt_helper"')) {
          return {
            rows: [
              {
                post_id: "post-1",
                related_value: "Related excerpt",
              },
            ],
          };
        }

        if (sql.includes('from "public"."post_meta_rows"')) {
          return {
            rows: [
              {
                id: "meta-row-1",
                meta_title: "Related meta title",
              },
            ],
          };
        }

        if (sql.includes('from "public"."post_meta_description_rows"')) {
          return {
            rows: [
              {
                id: "meta-description-row-1",
                meta_description: "Related meta description",
              },
            ],
          };
        }

        if (sql.includes('from "public"."post_focus_keyword_rows"')) {
          return {
            rows: [
              {
                id: "focus-row-1",
                focus_keyword: "related keyword",
              },
            ],
          };
        }

        if (sql.includes('from "public"."post_featured_image_helper"')) {
          return {
            rows: [
              {
                post_id: "post-1",
                related_value: "https://example.com/related-hero.png",
              },
            ],
          };
        }

        return {
          rows: [],
        };
      });
    const client = { query: queryMock } as never;

    await expect(
      mapMappedContentPostRow({
        client,
        postRow: {
          created_at: "2026-04-05T00:00:00.000Z",
          focus_lookup_id: "focus-row-1",
          id: "post-1",
          meta_description_lookup_id: "meta-description-row-1",
          meta_lookup_id: "meta-row-1",
          route_lookup_id: "route-row-1",
          title_lookup_id: "title-row-1",
          updated_at: "2026-04-05T01:00:00.000Z",
        },
        runtime: {
          authors: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "authors",
            },
          },
          categories: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "categories",
            },
          },
          files: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "files",
            },
          },
          media: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "media",
            },
          },
          posts: {
            customFields: [],
            editorFields: [],
            fields: {
              createdAt: { column: "created_at", kind: "datetime", label: "Created At", path: null, required: false, visible: true },
              excerpt: {
                column: null,
                kind: "plain_text",
                label: "Excerpt",
                path: null,
                required: false,
                sourceRelation: {
                  junctionSourceColumn: "post_id",
                  junctionTable: "public.post_excerpt_helper",
                  sourceColumn: null,
                  strategy: "related_row_by_post_id",
                  targetColumn: null,
                  targetTable: null,
                  valueColumn: "excerpt_text",
                },
                visible: true,
              },
              featuredImageUrl: {
                column: null,
                kind: "text",
                label: "Featured Image",
                path: null,
                required: false,
                sourceRelation: {
                  junctionSourceColumn: "post_id",
                  junctionTable: "public.post_featured_image_helper",
                  sourceColumn: null,
                  strategy: "join_row",
                  targetColumn: null,
                  targetTable: null,
                  valueColumn: "image_url",
                },
                visible: true,
              },
              focusKeyword: {
                column: null,
                kind: "text",
                label: "Focus Keyword",
                path: null,
                required: false,
                sourceRelation: {
                  junctionSourceColumn: null,
                  junctionTable: null,
                  sourceColumn: "focus_lookup_id",
                  strategy: "foreign_key",
                  targetColumn: "id",
                  targetTable: "public.post_focus_keyword_rows",
                  valueColumn: "focus_keyword",
                },
                visible: true,
              },
              seoDescription: {
                column: null,
                kind: "plain_text",
                label: "SEO Description",
                path: null,
                required: false,
                sourceRelation: {
                  junctionSourceColumn: null,
                  junctionTable: null,
                  sourceColumn: "meta_description_lookup_id",
                  strategy: "foreign_key",
                  targetColumn: "id",
                  targetTable: "public.post_meta_description_rows",
                  valueColumn: "meta_description",
                },
                visible: true,
              },
              seoTitle: {
                column: null,
                kind: "text",
                label: "SEO Title",
                path: null,
                required: false,
                sourceRelation: {
                  junctionSourceColumn: null,
                  junctionTable: null,
                  sourceColumn: "meta_lookup_id",
                  strategy: "foreign_key",
                  targetColumn: "id",
                  targetTable: "public.post_meta_rows",
                  valueColumn: "meta_title",
                },
                visible: true,
              },
              slug: {
                column: null,
                kind: "slug",
                label: "Slug",
                path: null,
                required: false,
                sourceRelation: {
                  junctionSourceColumn: null,
                  junctionTable: null,
                  sourceColumn: "route_lookup_id",
                  strategy: "value_match_relation",
                  targetColumn: "id",
                  targetTable: "public.post_route_rows",
                  valueColumn: "slug_value",
                },
                visible: true,
              },
              title: {
                column: null,
                kind: "text",
                label: "Title",
                path: null,
                required: true,
                sourceRelation: {
                  junctionSourceColumn: null,
                  junctionTable: null,
                  sourceColumn: "title_lookup_id",
                  strategy: "foreign_key",
                  targetColumn: "id",
                  targetTable: "public.post_title_rows",
                  valueColumn: "title_value",
                },
                visible: true,
              },
              updatedAt: { column: "updated_at", kind: "datetime", label: "Updated At", path: null, required: false, visible: true },
            },
            relations: {},
            source: {
              primaryKey: "id",
              schema: "public",
              table: "posts",
            },
            workflow: null,
          },
          tags: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "tags",
            },
          },
        } as never,
      }),
    ).resolves.toMatchObject({
      excerpt: "Related excerpt",
      featuredImageUrl: "https://example.com/related-hero.png",
      focusKeyword: "related keyword",
      seoDescription: "Related meta description",
      seoTitle: "Related meta title",
      slug: "related-slug",
      title: "Related title",
    });
  });

  it("maps normalized post-list preview rows from relation-backed scalar sources", async () => {
    const queryMock = vi.fn(async (sql: string) => {
        if (sql.includes('from "public"."post_title_rows"')) {
          return {
            rows: [
              {
                id: "title-row-1",
                title_value: "List title",
              },
            ],
          };
        }

        if (sql.includes('from "public"."post_route_rows"')) {
          return {
            rows: [
              {
                id: "route-row-1",
                slug_value: "list-slug",
              },
            ],
          };
        }

        if (sql.includes('from "public"."post_excerpt_helper"')) {
          return {
            rows: [
              {
                post_id: "post-1",
                related_value: "List excerpt",
              },
            ],
          };
        }

        return {
          rows: [],
        };
      });
    const client = { query: queryMock } as never;

    await expect(
      mapMappedContentPostListRow({
        authorId: null,
        client,
        postRow: {
          created_at: "2026-04-05T00:00:00.000Z",
          id: "post-1",
          route_lookup_id: "route-row-1",
          title_lookup_id: "title-row-1",
          updated_at: "2026-04-05T01:00:00.000Z",
        },
        runtime: {
          authors: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "authors",
            },
          },
          categories: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "categories",
            },
          },
          files: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "files",
            },
          },
          media: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "media",
            },
          },
          posts: {
            customFields: [],
            editorFields: [],
            fields: {
              createdAt: { column: "created_at", kind: "datetime", label: "Created At", path: null, required: false, visible: true },
              excerpt: {
                column: null,
                kind: "plain_text",
                label: "Excerpt",
                path: null,
                required: false,
                sourceRelation: {
                  junctionSourceColumn: "post_id",
                  junctionTable: "public.post_excerpt_helper",
                  sourceColumn: null,
                  strategy: "related_row_by_post_id",
                  targetColumn: null,
                  targetTable: null,
                  valueColumn: "excerpt_text",
                },
                visible: true,
              },
              slug: {
                column: null,
                kind: "slug",
                label: "Slug",
                path: null,
                required: false,
                sourceRelation: {
                  junctionSourceColumn: null,
                  junctionTable: null,
                  sourceColumn: "route_lookup_id",
                  strategy: "value_match_relation",
                  targetColumn: "id",
                  targetTable: "public.post_route_rows",
                  valueColumn: "slug_value",
                },
                visible: true,
              },
              title: {
                column: null,
                kind: "text",
                label: "Title",
                path: null,
                required: true,
                sourceRelation: {
                  junctionSourceColumn: null,
                  junctionTable: null,
                  sourceColumn: "title_lookup_id",
                  strategy: "foreign_key",
                  targetColumn: "id",
                  targetTable: "public.post_title_rows",
                  valueColumn: "title_value",
                },
                visible: true,
              },
              updatedAt: { column: "updated_at", kind: "datetime", label: "Updated At", path: null, required: false, visible: true },
            },
            relations: {},
            source: {
              primaryKey: "id",
              schema: "public",
              table: "posts",
            },
            workflow: null,
          },
          tags: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "tags",
            },
          },
        } as never,
      }),
    ).resolves.toEqual({
      authorId: null,
      createdAt: "2026-04-05T00:00:00.000Z",
      excerpt: "List excerpt",
      id: "post-1",
      publishedAt: null,
      slug: "list-slug",
      status: "draft",
      title: "List title",
      updatedAt: "2026-04-05T01:00:00.000Z",
    });
  });

  it("maps parent page ids from self-referential post relations", async () => {
    await expect(
      mapMappedContentPostRow({
        client: {
          query: vi.fn(),
        },
        postRow: {
          headline: "Child page",
          id: "post-1",
          parent_post_id: "post-parent",
        },
        runtime: {
          authors: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "authors",
            },
          },
          categories: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "categories",
            },
          },
          posts: {
            customFields: [],
            editorFields: [],
            fields: {
              createdAt: { column: "created_at", kind: "datetime", label: "Created At", path: null, required: false, visible: true },
              title: { column: "headline", kind: "text", label: "Title", path: null, required: true, visible: true },
              updatedAt: { column: "updated_at", kind: "datetime", label: "Updated At", path: null, required: false, visible: true },
            },
            relations: {
              posts: {
                fieldMap: {},
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
            source: {
              primaryKey: "id",
              schema: "public",
              table: "posts",
            },
            workflow: null,
          },
          tags: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "tags",
            },
          },
        } as never,
      }),
    ).resolves.toMatchObject({
      parentPageId: "post-parent",
      title: "Child page",
    });
  });

  it("surfaces helper-row ambiguity for single-value relations in the normalized post payload", async () => {
    getRelationJunctionTableNameMock.mockReturnValueOnce('"public"."post_author_helper"');

    const client = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [
          {
            post_id: "post-1",
            related_value: "author-2",
          },
          {
            post_id: "post-1",
            related_value: "author-1",
          },
        ],
      }),
    };

    await expect(
      mapMappedContentPostRow({
        client,
        postRow: {
          id: "post-1",
          title: "Hello world",
        },
        runtime: {
          authors: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "authors",
            },
          },
          categories: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "categories",
            },
          },
          files: null,
          media: null,
          posts: {
            customFields: [],
            customRelationFields: [],
            editorFields: [],
            fields: {
              title: {
                column: "title",
                kind: "text",
                label: "Title",
              },
            },
            relations: {
              authors: {
                fieldMap: { name: "name" },
                junctionSourceColumn: "post_id",
                junctionTable: "public.post_author_helper",
                junctionTargetColumn: null,
                multiple: false,
                sourceColumn: null,
                status: "mapped",
                strategy: "related_row_by_post_id",
                targetColumn: "id",
                targetEntity: "authors",
                targetTable: "public.authors",
                valueColumn: "author_id",
              },
            },
            source: {
              primaryKey: "id",
              schema: "public",
              table: "posts",
            },
            workflow: null,
          },
          tags: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "tags",
            },
          },
        } as never,
      }),
    ).resolves.toMatchObject({
      authorId: "author-1",
      fieldConflicts: {
        author: {
          code: "helper_row_ambiguity",
          helperRowCount: 2,
          values: ["author-1", "author-2"],
        },
      },
      title: "Hello world",
    });
  });

  it("surfaces helper-row ambiguity for single-value scalar fields in the normalized post payload", async () => {
    const client = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [
          {
            post_id: "post-1",
            related_value: "Second excerpt",
          },
          {
            post_id: "post-1",
            related_value: "First excerpt",
          },
        ],
      }),
    };

    await expect(
      mapMappedContentPostRow({
        client,
        postRow: {
          created_at: "2026-04-05T00:00:00.000Z",
          id: "post-1",
          title: "Hello world",
          updated_at: "2026-04-05T01:00:00.000Z",
        },
        runtime: {
          authors: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "authors",
            },
          },
          categories: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "categories",
            },
          },
          files: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "files",
            },
          },
          media: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "media",
            },
          },
          posts: {
            customFields: [],
            editorFields: [],
            fields: {
              createdAt: { column: "created_at", kind: "datetime", label: "Created At", path: null, required: false, visible: true },
              excerpt: {
                column: null,
                kind: "plain_text",
                label: "Excerpt",
                path: null,
                required: false,
                sourceRelation: {
                  junctionSourceColumn: "post_id",
                  junctionTable: "public.post_excerpt_helper",
                  sourceColumn: null,
                  strategy: "related_row_by_post_id",
                  targetColumn: null,
                  targetTable: null,
                  valueColumn: "excerpt_text",
                },
                visible: true,
              },
              title: { column: "title", kind: "text", label: "Title", path: null, required: true, visible: true },
              updatedAt: { column: "updated_at", kind: "datetime", label: "Updated At", path: null, required: false, visible: true },
            },
            relations: {},
            source: {
              primaryKey: "id",
              schema: "public",
              table: "posts",
            },
            workflow: null,
          },
          tags: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "tags",
            },
          },
        } as never,
      }),
    ).resolves.toMatchObject({
      excerpt: "First excerpt",
      fieldConflicts: {
        excerpt: {
          code: "helper_row_ambiguity",
          helperRowCount: 2,
          values: ["First excerpt", "Second excerpt"],
        },
      },
      title: "Hello world",
    });
  });

  it("maps custom relation fields into the normalized post payload", async () => {
    getRelationJunctionTableNameMock
      .mockReturnValueOnce('"public"."post_media"')
      .mockReturnValueOnce('"public"."post_files"')
      .mockReturnValueOnce('"public"."post_related_posts"');

    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              post_id: "post-1",
              related_value: "media-3",
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              post_id: "post-1",
              related_value: "file-3",
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              post_id: "post-1",
              related_value: "post-2",
            },
          ],
        }),
    };

    await expect(
      mapMappedContentPostRow({
        client,
        postRow: {
          attachment_file_id: "file-2",
          hero_media_id: "media-2",
          id: "post-1",
          sponsor_author_id: "author-2",
          title: "Hello world",
        },
        runtime: {
          authors: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "authors",
            },
          },
          categories: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "categories",
            },
          },
          media: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "media",
            },
          },
          files: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "files",
            },
          },
          posts: {
            customFields: [],
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
                  targetTable: "public.authors",
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
                  targetTable: "public.media",
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
                  targetTable: "public.files",
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
                  junctionTable: "public.post_media",
                  junctionTargetColumn: "media_id",
                  multiple: true,
                  sourceColumn: null,
                  status: "mapped",
                  strategy: "join_table",
                  targetColumn: "id",
                  targetEntity: "media",
                  targetTable: "public.media",
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
                  junctionTable: "public.post_files",
                  junctionTargetColumn: "file_id",
                  multiple: true,
                  sourceColumn: null,
                  status: "mapped",
                  strategy: "join_table",
                  targetColumn: "id",
                  targetEntity: "files",
                  targetTable: "public.files",
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
                  junctionTable: "public.post_related_posts",
                  junctionTargetColumn: "related_post_id",
                  multiple: true,
                  sourceColumn: null,
                  status: "mapped",
                  strategy: "join_table",
                  targetColumn: "id",
                  targetEntity: "posts",
                  targetTable: "public.posts",
                  valueColumn: null,
                },
              },
            ],
            editorFields: [],
            fields: {
              createdAt: { column: "created_at", kind: "datetime", label: "Created At", path: null, required: false, visible: true },
              title: { column: "title", kind: "text", label: "Title", path: null, required: true, visible: true },
              updatedAt: { column: "updated_at", kind: "datetime", label: "Updated At", path: null, required: false, visible: true },
            },
            relations: {
              authors: undefined,
              categories: undefined,
              posts: undefined,
              tags: undefined,
            },
            source: {
              primaryKey: "id",
              schema: "public",
              table: "posts",
            },
            workflow: null,
          },
          tags: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "tags",
            },
          },
        } as never,
      }),
    ).resolves.toMatchObject({
      customFields: {
        attachment_file_id: "file-2",
        gallery_media_ids: ["media-3"],
        hero_media_id: "media-2",
        related_post_ids: ["post-2"],
        reference_file_ids: ["file-3"],
        sponsor_author_id: "author-2",
      },
    });
  });

  it("reads non-direct custom scalar fields into normalized custom field values", async () => {
    await expect(
      mapMappedContentPostRow({
        client: {
          query: vi.fn(),
        },
        postRow: {
          created_at: "2026-04-05T00:00:00.000Z",
          id: "post-1",
          metadata: {
            card: {
              title: "Welcome card",
            },
          },
          tag_slots: ["alpha", "beta", "gamma"],
          title: "Hello",
          updated_at: "2026-04-05T01:00:00.000Z",
        },
        runtime: {
          authors: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "authors",
            },
          },
          categories: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "categories",
            },
          },
          files: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "files",
            },
          },
          media: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "media",
            },
          },
          posts: {
            companionContentColumns: [],
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
              },
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
              },
            ] as never,
            customRelationFields: [],
            editorFields: [],
            fields: {
              createdAt: { column: "created_at", kind: "datetime", label: "Created At", path: null, required: false, visible: true },
              title: { column: "title", kind: "text", label: "Title", path: null, required: true, visible: true },
              updatedAt: { column: "updated_at", kind: "datetime", label: "Updated At", path: null, required: false, visible: true },
            },
            relations: {
              authors: undefined,
              categories: undefined,
              posts: undefined,
              tags: undefined,
            },
            source: {
              primaryKey: "id",
              schema: "public",
              table: "posts",
            },
            workflow: null,
          },
          tags: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "tags",
            },
          },
        } as never,
      }),
    ).resolves.toMatchObject({
      customFields: {
        card_title: "Welcome card",
        secondary_tag: "beta",
      },
    });
  });

  it("reads relation-backed custom scalar fields and surfaces helper-row ambiguity", async () => {
    await expect(
      mapMappedContentPostRow({
        client: {
          query: vi.fn(async (sql: string) => {
            if (sql.includes('from "public"."post_subtitle_rows"')) {
              return {
                rows: [
                  {
                    id: "subtitle-row-1",
                    subtitle_text: "Related subtitle",
                  },
                ],
              };
            }

            if (sql.includes('from "public"."post_subtitle_helper"')) {
              return {
                rows: [
                  {
                    post_id: "post-1",
                    related_value: "First helper subtitle",
                  },
                  {
                    post_id: "post-1",
                    related_value: "Second helper subtitle",
                  },
                ],
              };
            }

            return {
              rows: [],
            };
          }),
        } as never,
        postRow: {
          created_at: "2026-04-05T00:00:00.000Z",
          id: "post-1",
          subtitle_lookup_id: "subtitle-row-1",
          title: "Hello",
          updated_at: "2026-04-05T01:00:00.000Z",
        },
        runtime: {
          authors: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "authors",
            },
          },
          categories: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "categories",
            },
          },
          files: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "files",
            },
          },
          media: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "media",
            },
          },
          posts: {
            companionContentColumns: [],
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
            ] as never,
            customRelationFields: [],
            editorFields: [],
            fields: {
              createdAt: { column: "created_at", kind: "datetime", label: "Created At", path: null, required: false, visible: true },
              title: { column: "title", kind: "text", label: "Title", path: null, required: true, visible: true },
              updatedAt: { column: "updated_at", kind: "datetime", label: "Updated At", path: null, required: false, visible: true },
            },
            relations: {
              authors: undefined,
              categories: undefined,
              posts: undefined,
              tags: undefined,
            },
            source: {
              primaryKey: "id",
              schema: "public",
              table: "posts",
            },
            workflow: null,
          },
          tags: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "tags",
            },
          },
        } as never,
      }),
    ).resolves.toMatchObject({
      customFields: {
        helper_subtitle: "First helper subtitle",
        subtitle_text: "Related subtitle",
      },
      fieldConflicts: {
        helper_subtitle: {
          code: "helper_row_ambiguity",
          helperRowCount: 2,
          values: ["First helper subtitle", "Second helper subtitle"],
        },
      },
    });
  });

  it("maps normalized content, workflow, and relation values into the CMS post payload", async () => {
    getMappedPublishedAtColumnMock.mockReturnValue("published_at");
    getPostStatusFromRowMock.mockReturnValue("published");
    normalizeMappedContentValueMock.mockImplementation(
      ((input?: { kind: string; value: unknown }) => {
        const { kind, value } = input ?? { kind: "html", value: null };

        if (kind === "json") {
          return {
            contentFormat: "html",
            contentHtml: "<p>Sidebar</p>",
            contentJson: {
              content: [
                {
                  content: [{ text: "Sidebar", type: "text" }],
                  type: "paragraph",
                },
              ],
              type: "doc",
            },
            contentMarkdown: "Sidebar",
          };
        }

        return {
          contentFormat: "html",
          contentHtml: typeof value === "string" ? value : "<p></p>",
          contentJson: {
            content: [
              {
                content: [{ text: "Body", type: "text" }],
                type: "paragraph",
              },
            ],
            type: "doc",
          },
          contentMarkdown: "Body",
        };
      }) as () => {
        contentFormat: string;
        contentHtml: string;
        contentJson: { content: Array<Record<string, unknown>>; type: string };
        contentMarkdown: string;
      },
    );

    await expect(
      mapMappedContentPostRow({
        client: {
          query: vi.fn(),
        },
        postRow: {
          author_id: "author-1",
          body_html: "<p>Body</p>",
          category_ids: ["category-1", "category-2", "category-1"],
          created_at: "2026-04-05T00:00:00.000Z",
          headline: "Hello from adapter",
          id: "post-1",
          publication_state: "published",
          published_at: "2026-04-06T08:30:00.000Z",
          sidebar_json: {
            content: [
              {
                content: [{ text: "Sidebar", type: "text" }],
                type: "paragraph",
              },
            ],
            type: "doc",
          },
          tag_ids: ["tag-1", "tag-2", "tag-1"],
          updated_at: "2026-04-05T01:00:00.000Z",
        },
        runtime: {
          authors: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "authors",
            },
          },
          categories: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "categories",
            },
          },
          posts: {
            customFields: [],
            editorFields: [
              {
                column: "body_html",
                id: "content",
                kind: "html",
                label: "Body",
                placeholder: null,
                required: false,
                visible: true,
              },
              {
                column: "sidebar_json",
                id: "sidebar",
                kind: "json",
                label: "Sidebar",
                placeholder: null,
                required: false,
                visible: true,
              },
            ],
            fields: {
              createdAt: { column: "created_at", kind: "datetime", label: "Created At", path: null, required: false, visible: true },
              title: { column: "headline", kind: "text", label: "Title", path: null, required: true, visible: true },
              updatedAt: { column: "updated_at", kind: "datetime", label: "Updated At", path: null, required: false, visible: true },
            },
            relations: {
              authors: {
                fieldMap: {},
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
                fieldMap: {},
                junctionSourceColumn: null,
                junctionTable: null,
                junctionTargetColumn: null,
                multiple: true,
                sourceColumn: "category_ids",
                status: "mapped",
                strategy: "array",
                targetColumn: "id",
                targetEntity: "categories",
                targetTable: null,
                valueColumn: null,
              },
              tags: {
                fieldMap: {},
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
            source: {
              primaryKey: "id",
              schema: "public",
              table: "posts",
            },
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
            source: {
              primaryKey: "id",
              schema: "public",
              table: "tags",
            },
          },
        } as never,
      }),
    ).resolves.toMatchObject({
      authorId: "author-1",
      categoryIds: ["category-1", "category-2"],
      contentFields: {
        content: {
          contentHtml: "<p>Body</p>",
          contentJson: {
            content: [
              {
                content: [{ text: "Body", type: "text" }],
                type: "paragraph",
              },
            ],
            type: "doc",
          },
        },
        sidebar: {
          contentHtml: "<p>Sidebar</p>",
          contentJson: {
            content: [
              {
                content: [{ text: "Sidebar", type: "text" }],
                type: "paragraph",
              },
            ],
            type: "doc",
          },
        },
      },
      contentHtml: "<p>Body</p>",
      contentMarkdown: "Body",
      publishedAt: "2026-04-06T08:30:00.000Z",
      status: "published",
      tagIds: ["tag-1", "tag-2"],
      title: "Hello from adapter",
    });
  });

  it("maps json-path-backed and array-index-backed content editor fields", async () => {
    normalizeMappedContentValueMock.mockImplementation(
      (({ value }: { value: unknown }) => ({
        contentFormat: "html",
        contentHtml: typeof value === "string" ? value : JSON.stringify(value),
        contentJson: { raw: value },
        contentMarkdown: null,
      })) as never,
    );

    await expect(
      mapMappedContentPostRow({
        client: {
          query: vi.fn(async () => ({ rows: [] })),
        } as never,
        postRow: {
          body_blocks: ["Intro block", "Summary block", "Tail block"],
          content_payload: {
            body: {
              main: "<p>Main body</p>",
              sidebar: "Sidebar copy",
            },
          },
          created_at: "2026-04-06T08:00:00.000Z",
          headline: "Nested content",
          id: "post-2",
          publication_state: "draft",
          updated_at: "2026-04-06T09:00:00.000Z",
        },
        runtime: {
          authors: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "authors",
            },
          },
          categories: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "categories",
            },
          },
          posts: {
            customFields: [],
            editorFields: [
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
                column: "body_blocks",
                id: "body_blocks__item_2",
                kind: "markdown",
                label: "Summary",
                placeholder: null,
                required: false,
                visible: true,
              } as never,
            ],
            fields: {
              createdAt: { column: "created_at", kind: "datetime", label: "Created At", path: null, required: false, visible: true },
              title: { column: "headline", kind: "text", label: "Title", path: null, required: true, visible: true },
              updatedAt: { column: "updated_at", kind: "datetime", label: "Updated At", path: null, required: false, visible: true },
            },
            relations: {
              authors: {
                fieldMap: {},
                junctionSourceColumn: null,
                junctionTable: null,
                junctionTargetColumn: null,
                multiple: false,
                sourceColumn: null,
                status: "unmapped",
                strategy: "none",
                targetColumn: null,
                targetEntity: "authors",
                targetTable: null,
                valueColumn: null,
              },
              categories: {
                fieldMap: {},
                junctionSourceColumn: null,
                junctionTable: null,
                junctionTargetColumn: null,
                multiple: true,
                sourceColumn: null,
                status: "unmapped",
                strategy: "none",
                targetColumn: null,
                targetEntity: "categories",
                targetTable: null,
                valueColumn: null,
              },
              tags: {
                fieldMap: {},
                junctionSourceColumn: null,
                junctionTable: null,
                junctionTargetColumn: null,
                multiple: true,
                sourceColumn: null,
                status: "unmapped",
                strategy: "none",
                targetColumn: null,
                targetEntity: "tags",
                targetTable: null,
                valueColumn: null,
              },
            },
            source: {
              primaryKey: "id",
              schema: "public",
              table: "posts",
            },
            workflow: {
              archivedValues: ["archived"],
              customValues: [],
              draftValues: ["draft"],
              mode: "status",
              publishedAtColumn: null,
              publishedFlagColumn: null,
              publishedValues: ["published"],
              statusColumn: "publication_state",
            },
          },
          tags: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "tags",
            },
          },
        } as never,
      }),
    ).resolves.toMatchObject({
      contentFields: {
        body_blocks__item_2: {
          contentHtml: "Summary block",
          contentJson: { raw: "Summary block" },
        },
        content_payload__body_main: {
          contentHtml: "<p>Main body</p>",
          contentJson: { raw: "<p>Main body</p>" },
        },
      },
      contentHtml: "<p>Main body</p>",
      title: "Nested content",
    });
  });

  it("maps helper-row-backed content editor fields into the CMS post payload", async () => {
    normalizeMappedContentValueMock.mockImplementation(
      (({ value }: { value: unknown }) => ({
        contentFormat: "html",
        contentHtml: typeof value === "string" ? value : "<p></p>",
        contentJson: { raw: value },
        contentMarkdown: null,
      })) as never,
    );

    await expect(
      mapMappedContentPostRow({
        client: {
          query: vi.fn(async () => ({
            rows: [
              {
                post_id: "post-3",
                related_value: "<p>Helper content</p>",
              },
            ],
          })),
        } as never,
        postRow: {
          created_at: "2026-04-06T08:00:00.000Z",
          headline: "Helper content post",
          id: "post-3",
          publication_state: "draft",
          updated_at: "2026-04-06T09:00:00.000Z",
        },
        runtime: {
          authors: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "authors",
            },
          },
          categories: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "categories",
            },
          },
          posts: {
            customFields: [],
            editorFields: [
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
            ],
            fields: {
              createdAt: { column: "created_at", kind: "datetime", label: "Created At", path: null, required: false, visible: true },
              title: { column: "headline", kind: "text", label: "Title", path: null, required: true, visible: true },
              updatedAt: { column: "updated_at", kind: "datetime", label: "Updated At", path: null, required: false, visible: true },
            },
            relations: {
              authors: {
                fieldMap: {},
                junctionSourceColumn: null,
                junctionTable: null,
                junctionTargetColumn: null,
                multiple: false,
                sourceColumn: null,
                status: "unmapped",
                strategy: "none",
                targetColumn: null,
                targetEntity: "authors",
                targetTable: null,
                valueColumn: null,
              },
              categories: {
                fieldMap: {},
                junctionSourceColumn: null,
                junctionTable: null,
                junctionTargetColumn: null,
                multiple: true,
                sourceColumn: null,
                status: "unmapped",
                strategy: "none",
                targetColumn: null,
                targetEntity: "categories",
                targetTable: null,
                valueColumn: null,
              },
              tags: {
                fieldMap: {},
                junctionSourceColumn: null,
                junctionTable: null,
                junctionTargetColumn: null,
                multiple: true,
                sourceColumn: null,
                status: "unmapped",
                strategy: "none",
                targetColumn: null,
                targetEntity: "tags",
                targetTable: null,
                valueColumn: null,
              },
            },
            source: {
              primaryKey: "id",
              schema: "public",
              table: "posts",
            },
            workflow: {
              archivedValues: ["archived"],
              customValues: [],
              draftValues: ["draft"],
              mode: "status",
              publishedAtColumn: null,
              publishedFlagColumn: null,
              publishedValues: ["published"],
              statusColumn: "publication_state",
            },
          },
          tags: {
            source: {
              primaryKey: "id",
              schema: "public",
              table: "tags",
            },
          },
        } as never,
      }),
    ).resolves.toMatchObject({
      contentFields: {
        content_helper: {
          contentHtml: "<p>Helper content</p>",
          contentJson: { raw: "<p>Helper content</p>" },
        },
      },
      contentHtml: "<p>Helper content</p>",
      title: "Helper content post",
    });
  });
});
