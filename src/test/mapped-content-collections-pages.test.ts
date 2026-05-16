import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getCachedProjectRuntimeValueMock,
  getEntitySelectableColumnsMock,
  getMappedContentRuntimeMock,
  getResolvedEntityMock,
  isUsableEntitySourceMock,
} = vi.hoisted(() => ({
  getCachedProjectRuntimeValueMock: vi.fn(
    async ({ load }: { load: () => Promise<unknown> }) => load(),
  ),
  getEntitySelectableColumnsMock: vi.fn(
    async ({ requestedColumns }: { requestedColumns: string[] }) => requestedColumns,
  ),
  getMappedContentRuntimeMock: vi.fn(),
  getResolvedEntityMock: vi.fn(async ({ entity }: { entity: unknown }) => entity),
  isUsableEntitySourceMock: vi.fn((entity: { source?: { schema?: string | null; table?: string | null } }) =>
    Boolean(entity.source?.schema && entity.source?.table),
  ),
}));

vi.mock("@/lib/content-runtime/server-runtime-cache", () => ({
  getCachedProjectRuntimeValue: getCachedProjectRuntimeValueMock,
  projectRuntimeCacheGroups: {
    taxonomyOptions: "taxonomy-options",
  },
}));

vi.mock("@/lib/content-runtime/mapped-content-runtime-support", () => ({
  EXISTING_DB_FALLBACK_TIMESTAMP_COLUMNS: ["created_at"],
  getEntityIdColumn: vi.fn((entity: { idColumn?: string }) => entity.idColumn ?? "id"),
  getEntitySelectableColumns: getEntitySelectableColumnsMock,
  getEntityTableName: vi.fn((entity: { tableName: string }) => entity.tableName),
  getContentMappingRevisionCacheKey: vi.fn(() => "revision-cache-key"),
  getMappedContentRuntime: getMappedContentRuntimeMock,
  getFallbackTimestamp: vi.fn((row: Record<string, unknown>) =>
    String(row.created_at ?? "2026-03-27T00:00:00.000Z"),
  ),
  getMappedFieldColumn: vi.fn(
    (entity: { fieldColumns?: Record<string, string> }, fieldKey: string) =>
      entity.fieldColumns?.[fieldKey] ?? null,
  ),
  getRequiredPrimaryKeyInsertValue: vi.fn(),
  getResolvedEntity: getResolvedEntityMock,
  getRowValue: vi.fn((row: Record<string, unknown>, column: string | null | undefined) =>
    column ? row[column] : null,
  ),
  isUsableEntitySource: isUsableEntitySourceMock,
  quoteIdentifier: vi.fn((value: string) => `"${value}"`),
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
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
      offset: (page - 1) * pageSize,
    }),
  ),
  toText: vi.fn((value: unknown) => (value == null ? null : String(value))),
}));

import {
  getMappedContentAuthorsPage,
  getMappedContentAuthorOptions,
  getMappedContentCategoriesPage,
  searchMappedContentAuthors,
  searchMappedContentCategories,
  searchMappedContentFiles,
  getMappedContentMediaPage,
  searchMappedContentMedia,
  searchMappedContentTags,
  getMappedContentTagsPage,
} from "@/lib/content-runtime/mapped-content-collections";

const createEntity = (
  tableName: string,
  fieldColumns: Record<string, string>,
) => ({
  fieldColumns,
  idColumn: "id",
  source: {
    kind: "table",
    primaryKey: "id",
    schema: "public",
    table: tableName.split(".").at(-1) ?? tableName,
  },
  tableName,
});

const runtime = {
  authors: createEntity("public.authors", {
    bio: "bio",
    email: "email",
    name: "name",
    slug: "slug",
  }),
  categories: createEntity("public.categories", {
    description: "description",
    name: "name",
    parentId: "parent_id",
    slug: "slug",
  }),
  media: createEntity("public.media", {
    altText: "alt_text",
    objectPath: "object_path",
    title: "title",
  }),
  files: createEntity("public.files", {
    objectPath: "object_path",
    title: "title",
    url: "url",
  }),
  posts: {
    relations: {
      authors: { strategy: "foreign_key" },
      categories: { strategy: "foreign_key" },
      tags: { strategy: "foreign_key" },
    },
  },
  tags: createEntity("public.tags", {
    description: "description",
    name: "name",
    slug: "slug",
  }),
};

describe("existing DB collection page loaders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMappedContentRuntimeMock.mockReturnValue(runtime);
  });

  it("does not query an entity source when a collection relation is unmapped", async () => {
    getMappedContentRuntimeMock.mockReturnValue({
      ...runtime,
      posts: {
        relations: {
          ...runtime.posts.relations,
          authors: {
            status: "unmapped",
            strategy: "none",
          },
        },
      },
    });
    getResolvedEntityMock.mockResolvedValueOnce({
      ...runtime.authors,
      source: {
        ...runtime.authors.source,
        kind: "none",
        schema: null,
        table: null,
      },
    });
    const client = {
      query: vi.fn(),
    };

    await expect(
      getMappedContentAuthorOptions({
        client,
        mapping: {} as never,
      }),
    ).resolves.toEqual([]);

    expect(client.query).not.toHaveBeenCalled();
  });

  it("pages tags from the source query instead of loading the full table", async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              created_at: "2026-03-02T00:00:00.000Z",
              description: "Second tag",
              id: "tag-2",
              name: "Tag Two",
              slug: "tag-two",
            },
            {
              created_at: "2026-03-03T00:00:00.000Z",
              description: "Third tag",
              id: "tag-3",
              name: "Tag Three",
              slug: "tag-three",
            },
          ],
        }),
    };

    await expect(
      getMappedContentTagsPage({
        client,
        mapping: {} as never,
        page: 2,
        pageSize: 1,
      }),
    ).resolves.toMatchObject({
      items: [
        {
          id: "tag-2",
          name: "Tag Two",
        },
      ],
      pagination: {
        hasNextPage: true,
        page: 2,
        pageSize: 1,
        totalItems: 3,
        totalItemsExact: false,
      },
    });

    expect(client.query).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("limit $1"),
      [2, 1],
    );
  });

  it("sorts collection pages by a selectable label when timestamp columns do not exist", async () => {
    getEntitySelectableColumnsMock.mockImplementationOnce(async () => [
      "id",
      "name",
      "slug",
      "description",
    ]);
    const client = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [
          {
            description: "Plain schema tag",
            id: "tag-1",
            name: "Alpha",
            slug: "alpha",
          },
        ],
      }),
    };

    await getMappedContentTagsPage({
      client,
      mapping: {} as never,
      page: 1,
      pageSize: 10,
    });

    const rowsQuery = client.query.mock.calls[0]?.[0] as string;

    expect(rowsQuery).toContain('order by "name" asc, "id" asc');
    expect(rowsQuery).not.toContain('"created_at"');
  });

  it("searches tags page rows on the server", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            created_at: "2026-03-01T00:00:00.000Z",
            id: "tag-1",
            name: "Launch",
            slug: "launch",
          },
        ],
      }),
    };

    await getMappedContentTagsPage({
      client,
      mapping: {} as never,
      pageSize: 10,
      search: "lau",
    });

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("limit $2"),
      ["lau", 10, 0],
    );
  });

  it("pages authors from the source query and preserves assignment avatars", async () => {
    getResolvedEntityMock.mockClear();

    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              bio: "Author bio",
              created_at: "2026-03-01T00:00:00.000Z",
              email: "author@example.com",
              id: "author-1",
              name: "Author One",
              slug: "author-one",
            },
            {
              bio: "Another author",
              created_at: "2026-03-02T00:00:00.000Z",
              email: "another@example.com",
              id: "author-2",
              name: "Author Two",
              slug: "author-two",
            },
          ],
        }),
    };

    await expect(
      getMappedContentAuthorsPage({
        authorAssignmentsByAuthorId: new Map([
          ["author-1", { avatar_url: "https://example.com/avatar.png" }],
        ]),
        client,
        mapping: {} as never,
        page: 1,
        pageSize: 1,
      }),
    ).resolves.toMatchObject({
      items: [
        {
          avatarUrl: "https://example.com/avatar.png",
          id: "author-1",
          name: "Author One",
        },
      ],
      pagination: {
        hasNextPage: true,
        page: 1,
        pageSize: 1,
        totalItems: 2,
        totalItemsExact: false,
      },
    });

    expect(client.query).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("limit $1"),
      [2, 0],
    );
    expect(getResolvedEntityMock).not.toHaveBeenCalled();
  });

  it("searches authors page rows on the server", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            created_at: "2026-03-01T00:00:00.000Z",
            id: "author-1",
            name: "Ada Lovelace",
            slug: "ada",
          },
        ],
      }),
    };

    await getMappedContentAuthorsPage({
      client,
      mapping: {} as never,
      pageSize: 10,
      search: "ada",
    });

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("limit $2"),
      ["ada", 10, 0],
    );
  });

  it("returns paged category rows while keeping the full hierarchy snapshot available", async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              created_at: "2026-03-02T00:00:00.000Z",
              description: "Child category",
              id: "cat-2",
              name: "Child",
              parent_id: "cat-1",
              slug: "child",
            },
            {
              created_at: "2026-03-03T00:00:00.000Z",
              description: "Another category",
              id: "cat-3",
              name: "Another",
              parent_id: null,
              slug: "another",
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              created_at: "2026-03-01T00:00:00.000Z",
              description: "Parent category",
              id: "cat-1",
              name: "Parent",
              parent_id: null,
              slug: "parent",
            },
            {
              created_at: "2026-03-02T00:00:00.000Z",
              description: "Child category",
              id: "cat-2",
              name: "Child",
              parent_id: "cat-1",
              slug: "child",
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ parent_id: "cat-1" }],
        }),
    };

    await expect(
      getMappedContentCategoriesPage({
        client,
        mapping: {} as never,
        page: 2,
        pageSize: 1,
        projectId: "project-1",
      }),
    ).resolves.toMatchObject({
      allCategories: [
        {
          id: "cat-1",
          name: "Parent",
        },
        {
          hierarchyPath: "Parent / Child",
          hasChildren: false,
          id: "cat-2",
          name: "Child",
        },
      ],
      items: [
        {
          hierarchyPath: "Parent / Child",
          hasChildren: false,
          id: "cat-2",
          name: "Child",
        },
      ],
      pagination: {
        hasNextPage: true,
        page: 2,
        pageSize: 1,
        totalItems: 3,
        totalItemsExact: false,
      },
    });

    expect(getCachedProjectRuntimeValueMock).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledTimes(3);
    expect(client.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("limit $1"),
      [2, 1],
    );
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("select distinct"),
      [["cat-2"], 1],
    );
  });

  it("omits the full category hierarchy when includeAllCategories is false", async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              created_at: "2026-03-02T00:00:00.000Z",
              description: "Child category",
              id: "cat-2",
              name: "Child",
              parent_id: "cat-1",
              slug: "child",
            },
            {
              created_at: "2026-03-03T00:00:00.000Z",
              description: "Another category",
              id: "cat-3",
              name: "Another",
              parent_id: null,
              slug: "another",
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              created_at: "2026-03-01T00:00:00.000Z",
              description: "Parent category",
              id: "cat-1",
              name: "Parent",
              parent_id: null,
              slug: "parent",
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ parent_id: "cat-2" }],
        }),
    };

    const page = await getMappedContentCategoriesPage({
      client,
      includeAllCategories: false,
      mapping: {} as never,
      page: 2,
      pageSize: 1,
      projectId: "project-1",
    });

    expect(page).toMatchObject({
      items: [
        {
          hierarchyPath: "Parent / Child",
          hasChildren: true,
          id: "cat-2",
          name: "Child",
        },
      ],
      pagination: {
        hasNextPage: true,
        page: 2,
        pageSize: 1,
        totalItems: 3,
        totalItemsExact: false,
      },
    });
    expect(page).not.toHaveProperty("allCategories");
    expect(client.query).toHaveBeenCalledTimes(3);
    expect(client.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("limit $1"),
      [2, 1],
    );
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      [["cat-1"]],
    );
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("select distinct"),
      [["cat-2"], 1],
    );
  });

  it("searches categories page rows on the server", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            created_at: "2026-03-01T00:00:00.000Z",
            id: "category-1",
            name: "Launch",
            parent_id: null,
            slug: "launch",
          },
        ],
      }),
    };

    await getMappedContentCategoriesPage({
      client,
      includeAllCategories: false,
      mapping: {} as never,
      pageSize: 10,
      search: "lau",
    });

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("limit $2"),
      ["lau", 10, 0],
    );
  });

  it("pages media rows from the mapped source query", async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ count: "2" }] })
        .mockResolvedValueOnce({
          rows: [
            {
              alt_text: "Cover image",
              created_at: "2026-03-01T00:00:00.000Z",
              id: "media-1",
              object_path: "uploads/cover.png",
              title: "cover.png",
            },
          ],
        }),
    };

    await expect(
      getMappedContentMediaPage({
        client,
        mapping: {} as never,
        page: 1,
        pageSize: 1,
      }),
    ).resolves.toMatchObject({
      items: [
        {
          fileName: "cover.png",
          id: "media-1",
          objectPath: "uploads/cover.png",
        },
      ],
      pagination: {
        page: 1,
        pageSize: 1,
        totalItems: 2,
      },
    });

    expect(client.query).toHaveBeenCalledTimes(2);
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("limit $1"),
      [1, 0],
    );
  });

  it("searches author rows with a bounded source query", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            created_at: "2026-03-01T00:00:00.000Z",
            id: "author-1",
            name: "Ada Lovelace",
            slug: "ada",
          },
        ],
      }),
    };

    await expect(
      searchMappedContentAuthors({
        client,
        limit: 1,
        mapping: {} as never,
        search: "ada",
      }),
    ).resolves.toEqual([
      {
        id: "author-1",
        name: "Ada Lovelace",
        slug: "ada",
      },
    ]);

    expect(client.query).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("limit $2"),
      ["ada", 1, 0],
    );
    expect(client.query.mock.calls[0]?.[0]).toContain("where");
  });

  it("searches tag rows with a bounded source query", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            created_at: "2026-03-01T00:00:00.000Z",
            id: "tag-1",
            name: "Launch",
            slug: "launch",
          },
        ],
      }),
    };

    await expect(
      searchMappedContentTags({
        client,
        limit: 1,
        mapping: {} as never,
        search: "lau",
      }),
    ).resolves.toEqual([
      {
        id: "tag-1",
        name: "Launch",
        slug: "launch",
      },
    ]);

    expect(client.query).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("limit $2"),
      ["lau", 1, 0],
    );
    expect(client.query.mock.calls[0]?.[0]).toContain("where");
  });

  it("hydrates selected tag ids with a bounded id query alongside relation search", async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              created_at: "2026-03-01T00:00:00.000Z",
              id: "tag-1",
              name: "Launch",
              slug: "launch",
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              created_at: "2026-03-01T00:00:00.000Z",
              id: "tag-99",
              name: "Archived",
              slug: "archived",
            },
          ],
        }),
    };

    await expect(
      searchMappedContentTags({
        client,
        limit: 1,
        mapping: {} as never,
        search: "lau",
        selectedIds: ["tag-99"],
      }),
    ).resolves.toEqual([
      {
        id: "tag-99",
        name: "Archived",
        slug: "archived",
      },
      {
        id: "tag-1",
        name: "Launch",
        slug: "launch",
      },
    ]);

    expect(client.query).toHaveBeenCalledTimes(2);
    expect(client.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("limit $2"),
      ["lau", 1, 0],
    );
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("limit $2"),
      [["tag-99"], 1, 0],
    );
  });

  it("searches category rows with a bounded query and hydrates only visible parent labels", async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              created_at: "2026-03-01T00:00:00.000Z",
              id: "category-2",
              name: "Child",
              parent_id: "category-1",
              slug: "child",
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              created_at: "2026-03-01T00:00:00.000Z",
              id: "category-1",
              name: "Parent",
              parent_id: null,
              slug: "parent",
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ parent_id: "category-2" }],
        }),
    };

    await expect(
      searchMappedContentCategories({
        client,
        limit: 1,
        mapping: {} as never,
        search: "chi",
      }),
    ).resolves.toEqual([
      {
        depth: 1,
        hasChildren: true,
        hierarchyPath: "Parent / Child",
        id: "category-2",
        name: "Child",
        slug: "child",
      },
    ]);

    expect(client.query).toHaveBeenCalledTimes(3);
    expect(client.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("limit $2"),
      ["chi", 1, 0],
    );
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      [["category-1"]],
    );
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("select distinct"),
      [["category-2"], 1],
    );
  });

  it("searches media rows from the mapped source query", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            alt_text: "Homepage cover",
            created_at: "2026-03-01T00:00:00.000Z",
            id: "media-1",
            object_path: "uploads/cover.png",
            title: "cover.png",
          },
        ],
      }),
    };

    await expect(
      searchMappedContentMedia({
        client,
        limit: 1,
        mapping: {} as never,
        search: "cover",
      }),
    ).resolves.toEqual([
      {
        fileName: "cover.png",
        id: "media-1",
        objectPath: "uploads/cover.png",
      },
    ]);

    expect(client.query).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("limit $2"),
      ["cover", 1, 0],
    );
    expect(client.query.mock.calls[0]?.[0]).toContain("where");
  });

  it("searches file rows from the mapped source query", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            created_at: "2026-03-01T00:00:00.000Z",
            id: "file-1",
            object_path: "docs/spec.pdf",
            title: "spec.pdf",
          },
        ],
      }),
    };

    await expect(
      searchMappedContentFiles({
        client,
        limit: 1,
        mapping: {} as never,
        search: "spec",
      }),
    ).resolves.toEqual([
      {
        fileName: "spec.pdf",
        id: "file-1",
        objectPath: "docs/spec.pdf",
      },
    ]);

    expect(client.query).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("limit $2"),
      ["spec", 1, 0],
    );
    expect(client.query.mock.calls[0]?.[0]).toContain("where");
  });
});
