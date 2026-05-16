import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getMappedRelationValuesForPostsMock,
  loadMappedContentEditorTaxonomyOptionsMock,
  loadMappedContentAuthorsMock,
  loadMappedContentHydratedPostMock,
  loadMappedContentPostRowsMock,
  loadMappedContentPostRowsPageMock,
  mapMappedContentPostListRowMock,
} = vi.hoisted(() => ({
  getMappedRelationValuesForPostsMock: vi.fn(),
  loadMappedContentEditorTaxonomyOptionsMock: vi.fn(),
  loadMappedContentAuthorsMock: vi.fn(),
  loadMappedContentHydratedPostMock: vi.fn(),
  loadMappedContentPostRowsMock: vi.fn(),
  loadMappedContentPostRowsPageMock: vi.fn(),
  mapMappedContentPostListRowMock: vi.fn(),
}));

vi.mock("@/lib/content-runtime/mapped-content-collections", () => ({
  loadMappedContentAuthors: loadMappedContentAuthorsMock,
}));

vi.mock("@/lib/content-runtime/mapped-content-runtime-support", () => ({
  getEntityIdColumn: vi.fn((entity: { source: { primaryKey: string } }) => entity.source.primaryKey),
  getMappedContentRuntime: vi.fn((mapping: unknown) => mapping),
  getEntityTableName: vi.fn(() => '"public"."posts"'),
  getResolvedEntity: vi.fn(async ({ entity }: { entity: unknown }) => entity),
  getRowValue: vi.fn((row: Record<string, unknown>, column: string | null | undefined) =>
    column ? row[column] : null,
  ),
  isUsableEntitySource: vi.fn(() => true),
  resolvePagination: vi.fn(
    ({
      page = 1,
      pageSize = 20,
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
      totalItemsExact: true,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    }),
  ),
  toText: vi.fn((value: unknown) => (value == null ? null : String(value))),
}));

vi.mock("@/lib/content-runtime/mapped-content-post-support", () => ({
  buildMappedContentPostListSelectClause: vi.fn(() => '"id", "title"'),
  getMappedRelationValuesForPosts: getMappedRelationValuesForPostsMock,
  loadMappedContentPostRows: loadMappedContentPostRowsMock,
  loadMappedContentPostRowsPage: loadMappedContentPostRowsPageMock,
  mapMappedContentPostListRow: mapMappedContentPostListRowMock,
}));

vi.mock("@/lib/content-runtime/mapped-content-post-read-detail", () => ({
  buildMappedContentPrimaryKeyPredicate: vi.fn(),
  loadMappedContentHydratedPost: loadMappedContentHydratedPostMock,
}));

vi.mock("@/lib/content-runtime/mapped-content-post-editor-taxonomy", () => ({
  loadMappedContentEditorTaxonomyOptions: loadMappedContentEditorTaxonomyOptionsMock,
}));

vi.mock("@/lib/content-runtime/server-content-post-projection", () => ({
  getContentPostProjectionAuthorId: vi.fn(),
}));

vi.mock("@/lib/content-runtime/server-runtime-cache", () => ({
  getCachedProjectRuntimeValue: vi.fn(async ({ load }: { load: () => Promise<unknown> }) => load()),
  projectRuntimeCacheGroups: {
    contentPostAuthorId: "contentPostAuthorId",
  },
}));

import {
  getMappedContentWorkspaceCounts,
  getMappedContentPostEditorPayload,
  getMappedContentPostsPage,
} from "@/lib/content-runtime/mapped-content-post-reads";

describe("mapped content post reads performance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadMappedContentAuthorsMock.mockResolvedValue([]);
    loadMappedContentEditorTaxonomyOptionsMock.mockResolvedValue({
      categories: [],
      tags: [],
    });
    loadMappedContentHydratedPostMock.mockResolvedValue({
      authorId: null,
      categoryIds: [],
      contentHtml: "",
      contentJson: {},
      createdAt: "2026-03-28T00:00:00.000Z",
      id: "post-1",
      publishedAt: null,
      slug: "post-1",
      status: "draft",
      tagIds: [],
      title: "Post 1",
      updatedAt: "2026-03-28T00:00:00.000Z",
    });
    mapMappedContentPostListRowMock.mockImplementation(
      async ({ authorId, postRow }: { authorId: string | null; postRow: { id: string } }) => ({
        authorId,
        categoryIds: [],
        createdAt: "2026-03-28T00:00:00.000Z",
        id: postRow.id,
        publishedAt: null,
        slug: postRow.id,
        status: "draft",
        tagIds: [],
        title: postRow.id,
        updatedAt: "2026-03-28T00:00:00.000Z",
      }),
    );
  });

  it("keeps author-scoped live fallback bounded when author filtering cannot run in SQL", async () => {
    loadMappedContentPostRowsPageMock.mockResolvedValueOnce({
      authorScopeApplied: false,
      pagination: {
        hasNextPage: false,
        hasPreviousPage: false,
        offset: 0,
        page: 1,
        pageSize: 50,
        totalItems: 2,
        totalItemsExact: true,
        totalPages: 1,
      },
      rows: [{ id: "post-1" }, { id: "post-2" }],
    });
    getMappedRelationValuesForPostsMock.mockResolvedValueOnce(
      new Map([
        ["post-1", ["other-author"]],
        ["post-2", ["author-1"]],
      ]),
    );

    const page = await getMappedContentPostsPage({
      accessibleAuthorIds: ["author-1"],
      client: { query: vi.fn() } as never,
      mapping: {
        authors: { source: { primaryKey: "id" } },
        posts: {
          relations: { authors: {} },
          source: { primaryKey: "id" },
        },
      } as never,
      page: 1,
      pageSize: 1,
      search: "",
      sort: "updated_desc",
      status: "all",
    });

    expect(loadMappedContentPostRowsMock).not.toHaveBeenCalled();
    expect(loadMappedContentPostRowsPageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accessibleAuthorIds: null,
        page: 1,
        pageSize: 50,
        totalItems: 51,
      }),
    );
    expect(page.pagination).toMatchObject({
      hasNextPage: false,
      page: 1,
      pageSize: 1,
      totalItems: 1,
      totalItemsExact: true,
      totalPages: 1,
    });
    expect(page.posts.map((post) => post.id)).toEqual(["post-2"]);
  });

  it("loads editor taxonomy options through the shared bounded loader", async () => {
    await expect(
      getMappedContentPostEditorPayload({
        client: { query: vi.fn() } as never,
        includeEditorOptions: true,
        mapping: {
          authors: { source: { primaryKey: "id" } },
          categories: { source: { primaryKey: "id" } },
          posts: {
            relations: { authors: {}, categories: {}, tags: {} },
            source: { primaryKey: "id" },
          },
          tags: { source: { primaryKey: "id" } },
        } as never,
        postId: "post-1",
      }),
    ).resolves.toMatchObject({
      categories: [],
      editorOptionsState: "full",
      post: {
        id: "post-1",
      },
      tags: [],
    });

    expect(loadMappedContentEditorTaxonomyOptionsMock).toHaveBeenCalledTimes(1);
    expect(loadMappedContentEditorTaxonomyOptionsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client: expect.any(Object),
        projectId: undefined,
      }),
    );
  });

  it("hydrates only the selected author for mapped post editor options", async () => {
    loadMappedContentHydratedPostMock.mockResolvedValueOnce({
      authorId: "author-500000",
      categoryIds: [],
      contentHtml: "",
      contentJson: {},
      createdAt: "2026-03-28T00:00:00.000Z",
      id: "post-1",
      publishedAt: null,
      slug: "post-1",
      status: "draft",
      tagIds: [],
      title: "Post 1",
      updatedAt: "2026-03-28T00:00:00.000Z",
    });

    await getMappedContentPostEditorPayload({
      client: { query: vi.fn() } as never,
      includeEditorOptions: true,
      mapping: {
        authors: { source: { primaryKey: "id" } },
        posts: {
          relations: { authors: {} },
          source: { primaryKey: "id" },
        },
      } as never,
      postId: "post-1",
    });

    expect(loadMappedContentAuthorsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ids: ["author-500000"],
      }),
    );
  });

  it("can use approximate row estimates for workspace counts", async () => {
    const query = vi.fn(async (_sql: string) => ({
      rows: [{ estimated_count: "500000" }],
    })) as ReturnType<typeof vi.fn<(sql: string) => Promise<{ rows: Array<{ estimated_count: string }> }>>>;

    await expect(
      getMappedContentWorkspaceCounts({
        approximateCounts: true,
        client: { query } as never,
        mapping: {
          authors: { source: { primaryKey: "id", schema: "public", table: "authors" } },
          categories: { source: { primaryKey: "id", schema: "public", table: "categories" } },
          media: { source: { primaryKey: "id", schema: "public", table: "media" } },
          posts: {
            relations: { authors: {}, categories: {}, tags: {} },
            source: { primaryKey: "id", schema: "public", table: "posts" },
          },
          tags: { source: { primaryKey: "id", schema: "public", table: "tags" } },
        } as never,
      } as never),
    ).resolves.toMatchObject({
      authors: 500_000,
      categories: 500_000,
      media: 500_000,
      posts: 500_000,
      tags: 500_000,
    });

    expect(query).toHaveBeenCalled();
    expect(query.mock.calls.every((call) => String(call[0]).includes("to_regclass"))).toBe(true);
    expect(query.mock.calls.some((call) => String(call[0]).includes("count(*)"))).toBe(false);
  });

  it("clamps unknown negative approximate row estimates for workspace counts", async () => {
    const query = vi.fn(async (_sql: string) => ({
      rows: [{ estimated_count: "-1" }],
    })) as ReturnType<typeof vi.fn<(sql: string) => Promise<{ rows: Array<{ estimated_count: string }> }>>>;

    await expect(
      getMappedContentWorkspaceCounts({
        approximateCounts: true,
        client: { query } as never,
        mapping: {
          authors: { source: { primaryKey: "id", schema: "public", table: "authors" } },
          categories: { source: { primaryKey: "id", schema: "public", table: "categories" } },
          media: { source: { primaryKey: "id", schema: "public", table: "media" } },
          posts: {
            relations: { authors: {}, categories: {}, tags: {} },
            source: { primaryKey: "id", schema: "public", table: "posts" },
          },
          tags: { source: { primaryKey: "id", schema: "public", table: "tags" } },
        } as never,
      } as never),
    ).resolves.toMatchObject({
      authors: 0,
      categories: 0,
      media: 0,
      posts: 0,
      tags: 0,
    });
  });
});
