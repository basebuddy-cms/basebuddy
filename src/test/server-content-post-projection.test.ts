import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import type { ContentProjectMapping } from "@/lib/content-runtime/mapping";
import {
  getContentPostProjectionAuthorId,
  getContentPostsProjectionPage,
  getContentPostsProjectionKey,
  getContentPostsProjectionState,
  mapContentProjectedPostPreview,
  saveContentPostsProjectionState,
  upsertContentPostProjectionRows,
} from "@/lib/content-runtime/server-content-post-projection";
import { createAdminClient } from "@/lib/supabase/admin";

const createMappedContentMapping = (): ContentProjectMapping => ({
  bindingId: "binding-1",
  bindingMode: "mapped_content",
  bindingStatus: "ready",
  mappingConfig: {
    entities: {
      authors: { capabilities: { browse: true, create: false, delete: false, read: true, update: false }, companionContentColumns: [], customFields: [], editorFields: [], fields: {}, notes: [], relations: {}, source: { kind: "table", primaryKey: "id", schema: "public", table: "authors" }, status: "mapped", workflow: null },
      categories: { capabilities: { browse: true, create: false, delete: false, read: true, update: false }, companionContentColumns: [], customFields: [], editorFields: [], fields: {}, notes: [], relations: {}, source: { kind: "table", primaryKey: "id", schema: "public", table: "categories" }, status: "mapped", workflow: null },
      files: { capabilities: { browse: true, create: false, delete: false, read: true, update: false }, companionContentColumns: [], customFields: [], editorFields: [], fields: {}, notes: [], relations: {}, source: { kind: "table", primaryKey: "id", schema: "public", table: "files" }, status: "mapped", workflow: null },
      media: { capabilities: { browse: true, create: false, delete: false, read: true, update: false }, companionContentColumns: [], customFields: [], editorFields: [], fields: {}, notes: [], relations: {}, source: { kind: "table", primaryKey: "id", schema: "public", table: "media" }, status: "mapped", workflow: null },
      posts: { capabilities: { browse: true, create: true, delete: true, read: true, update: true }, companionContentColumns: [], customFields: [], editorFields: [], fields: {}, notes: [], relations: {}, source: { kind: "table", primaryKey: "id", schema: "public", table: "posts" }, status: "mapped", workflow: null },
      tags: { capabilities: { browse: true, create: false, delete: false, read: true, update: false }, companionContentColumns: [], customFields: [], editorFields: [], fields: {}, notes: [], relations: {}, source: { kind: "table", primaryKey: "id", schema: "public", table: "tags" }, status: "mapped", workflow: null },
    },
    filesStorage: null,
    mediaStorage: null,
    version: 1,
  },
  revisionId: "revision-1",
  revisionVersion: 7,
});

describe("server mapped-content post projection storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the projection state for the current mapping revision", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        last_error: null,
        last_refreshed_at: "2026-03-28T13:00:00.000Z",
        mapping_revision_key: getContentPostsProjectionKey(createMappedContentMapping()),
        processed_items: 20,
        progress_cursor: "post-20",
        status: "ready",
        total_items: 24,
      },
      error: null,
    });
    const eqRevision = vi.fn(() => ({ maybeSingle }));
    const eqProject = vi.fn(() => ({ eq: eqRevision }));
    const select = vi.fn(() => ({ eq: eqProject }));
    const from = vi.fn(() => ({ select }));
    const schema = vi.fn(() => ({ from }));

    vi.mocked(createAdminClient).mockReturnValue({
      schema,
    } as never);

    await expect(
      getContentPostsProjectionState({
        mapping: createMappedContentMapping(),
        projectId: "project-1",
      }),
    ).resolves.toEqual({
      lastError: null,
      lastRefreshedAt: "2026-03-28T13:00:00.000Z",
      processedItems: 20,
      progressCursor: "post-20",
      status: "ready",
      totalItems: 24,
    });
  });

  it("treats missing projection storage as an unavailable optional feature", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "42P01",
        message: 'relation "private.basebuddy_project_content_post_projection_states" does not exist',
      },
    });
    const eqRevision = vi.fn(() => ({ maybeSingle }));
    const eqProject = vi.fn(() => ({ eq: eqRevision }));
    const select = vi.fn(() => ({ eq: eqProject }));
    const from = vi.fn(() => ({ select }));
    const schema = vi.fn(() => ({ from }));

    vi.mocked(createAdminClient).mockReturnValue({
      schema,
    } as never);

    await expect(
      getContentPostsProjectionState({
        mapping: createMappedContentMapping(),
        projectId: "project-1",
      }),
    ).resolves.toBeNull();

    const upsert = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "42P01",
        message: 'relation "private.basebuddy_project_content_post_projection_states" does not exist',
      },
    });
    const writeFrom = vi.fn(() => ({ upsert }));
    const writeSchema = vi.fn(() => ({ from: writeFrom }));

    vi.mocked(createAdminClient).mockReturnValue({
      schema: writeSchema,
    } as never);

    await expect(
      saveContentPostsProjectionState({
        lastError: null,
        lastRefreshedAt: null,
        mapping: createMappedContentMapping(),
        projectId: "project-1",
        status: "stale",
        totalItems: 0,
      }),
    ).resolves.toBeUndefined();
  });

  it("treats invalid private-schema access as unavailable projection storage", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message: "Invalid schema: private",
      },
    });
    const query = {
      eq: vi.fn(),
      maybeSingle,
    };
    query.eq.mockReturnValue(query);
    const select = vi.fn(() => query);
    const from = vi.fn(() => ({ select }));
    const schema = vi.fn(() => ({ from }));

    vi.mocked(createAdminClient).mockReturnValue({
      schema,
    } as never);

    await expect(
      getContentPostsProjectionState({
        mapping: createMappedContentMapping(),
        projectId: "project-1",
      }),
    ).resolves.toBeNull();

    await expect(
      getContentPostProjectionAuthorId({
        mapping: createMappedContentMapping(),
        postId: "post-1",
        projectId: "project-1",
      }),
    ).resolves.toBeNull();
  });

  it("upserts revision-scoped projection rows into the private schema", async () => {
    const upsert = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const from = vi.fn(() => ({ upsert }));
    const schema = vi.fn(() => ({ from }));

    vi.mocked(createAdminClient).mockReturnValue({
      schema,
    } as never);

    await upsertContentPostProjectionRows({
      mapping: createMappedContentMapping(),
      projectId: "project-1",
      rows: [
        {
          authorId: "author-1",
          categoryIds: ["category-1"],
          createdAt: "2026-03-27T00:00:00.000Z",
          excerpt: "Launch notes",
          projectId: "project-1",
          publishedAt: "2026-03-28T00:00:00.000Z",
          refreshedAt: "2026-03-28T13:00:00.000Z",
          searchText: "hello world",
          slug: "hello-world",
          sourcePostId: "post-1",
          status: "published",
          tagIds: ["tag-1"],
          title: "Hello World",
          updatedAt: "2026-03-28T12:00:00.000Z",
        },
      ],
    });

    expect(schema).toHaveBeenCalledWith("private");
    expect(from).toHaveBeenCalledWith("basebuddy_project_content_post_previews");
    expect(upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          mapping_revision_key: getContentPostsProjectionKey(createMappedContentMapping()),
          project_id: "project-1",
          source_post_id: "post-1",
        }),
      ],
      {
        onConflict: "project_id,mapping_revision_key,source_post_id",
      },
    );
  });

  it("maps a stored projection row into the list-preview post shape", () => {
    expect(
      mapContentProjectedPostPreview({
        author_id: "author-1",
        category_ids: ["category-1"],
        created_at: "2026-03-27T00:00:00.000Z",
        excerpt: "Launch notes",
        published_at: "2026-03-28T00:00:00.000Z",
        slug: "hello-world",
        source_post_id: "post-1",
        status: "published",
        tag_ids: ["tag-1"],
        title: "Hello World",
        updated_at: "2026-03-28T12:00:00.000Z",
      }),
    ).toEqual(
      expect.objectContaining({
        authorId: "author-1",
        categoryIds: ["category-1"],
        excerpt: "Launch notes",
        id: "post-1",
        slug: "hello-world",
        status: "published",
        tagIds: ["tag-1"],
        title: "Hello World",
      }),
    );
  });

  it("persists ready projection state totals for the current revision", async () => {
    const upsert = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const from = vi.fn(() => ({ upsert }));
    const schema = vi.fn(() => ({ from }));

    vi.mocked(createAdminClient).mockReturnValue({
      schema,
    } as never);

    await saveContentPostsProjectionState({
      lastError: null,
      lastRefreshedAt: "2026-03-28T13:00:00.000Z",
      mapping: createMappedContentMapping(),
      projectId: "project-1",
      processedItems: 24,
      progressCursor: null,
      status: "ready",
      totalItems: 24,
    });

    expect(from).toHaveBeenCalledWith("basebuddy_project_content_post_projection_states");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        last_error: null,
        mapping_revision_key: getContentPostsProjectionKey(createMappedContentMapping()),
        processed_items: 24,
        progress_cursor: null,
        project_id: "project-1",
        status: "ready",
        total_items: 24,
      }),
      {
        onConflict: "project_id,mapping_revision_key",
      },
    );
  });

  it("uses a bounded page-plus-one read for window projection pagination", async () => {
    const rows = Array.from({ length: 21 }, (_, index) => ({
      author_id: null,
      category_ids: [],
      created_at: "2026-03-27T00:00:00.000Z",
      excerpt: null,
      published_at: null,
      refreshed_at: "2026-03-28T13:00:00.000Z",
      search_text: `post ${index}`,
      slug: `post-${index}`,
      source_post_id: `post-${index}`,
      status: "draft",
      tag_ids: [],
      title: `Post ${index}`,
      updated_at: "2026-03-28T12:00:00.000Z",
    }));
    const query = {
      eq: vi.fn(),
      ilike: vi.fn(),
      order: vi.fn(),
      range: vi.fn().mockResolvedValue({
        data: rows,
        error: null,
      }),
    };
    query.eq.mockReturnValue(query);
    query.ilike.mockReturnValue(query);
    query.order.mockReturnValue(query);

    const select = vi.fn(() => query);
    const from = vi.fn(() => ({ select }));
    const schema = vi.fn(() => ({ from }));

    vi.mocked(createAdminClient).mockReturnValue({
      schema,
    } as never);

    const page = await getContentPostsProjectionPage({
      mapping: createMappedContentMapping(),
      page: 2,
      pageSize: 20,
      projectId: "project-1",
      search: "post",
      totalItems: 50_000,
      useWindowPagination: true,
    });

    expect(query.range).toHaveBeenCalledWith(20, 40);
    expect(page.posts).toHaveLength(20);
    expect(page.pagination).toEqual(
      expect.objectContaining({
        hasNextPage: true,
        hasPreviousPage: true,
        page: 2,
        pageSize: 20,
        totalItems: 50_000,
        totalItemsExact: false,
      }),
    );
  });

  it("does not use deep offset reads for projection-backed post pages without a cursor", async () => {
    const rows = Array.from({ length: 21 }, (_, index) => ({
      author_id: null,
      category_ids: [],
      created_at: "2026-03-27T00:00:00.000Z",
      excerpt: null,
      published_at: null,
      refreshed_at: "2026-03-28T13:00:00.000Z",
      search_text: `post ${index}`,
      slug: `post-${index}`,
      source_post_id: `post-${index}`,
      status: "draft",
      tag_ids: [],
      title: `Post ${index}`,
      updated_at: "2026-03-28T12:00:00.000Z",
    }));
    const query = {
      eq: vi.fn(),
      ilike: vi.fn(),
      limit: vi.fn().mockResolvedValue({
        data: rows,
        error: null,
      }),
      order: vi.fn(),
      range: vi.fn().mockResolvedValue({
        data: rows,
        error: null,
      }),
    };
    query.eq.mockReturnValue(query);
    query.ilike.mockReturnValue(query);
    query.order.mockReturnValue(query);

    const select = vi.fn(() => query);
    const from = vi.fn(() => ({ select }));
    const schema = vi.fn(() => ({ from }));

    vi.mocked(createAdminClient).mockReturnValue({
      schema,
    } as never);

    const page = await getContentPostsProjectionPage({
      mapping: createMappedContentMapping(),
      page: 500,
      pageSize: 20,
      projectId: "project-1",
      totalItems: 50_000,
    });

    expect(query.range).not.toHaveBeenCalled();
    expect(query.limit).toHaveBeenCalledWith(21);
    expect(page.pagination).toEqual(
      expect.objectContaining({
        hasNextPage: true,
        nextCursor: expect.any(String),
        page: 1,
        pageSize: 20,
        totalItemsExact: false,
      }),
    );
  });

  it.each([
    ["updated_desc", "updated_at", false, "lt"],
    ["updated_asc", "updated_at", true, "gt"],
    ["created_desc", "created_at", false, "lt"],
    ["created_asc", "created_at", true, "gt"],
    ["title_desc", "title", false, "lt"],
    ["title_asc", "title", true, "gt"],
  ] as const)(
    "uses cursor pagination for projection-backed %s post lists",
    async (sort, sortColumn, ascending, cursorOperator) => {
      const rows = Array.from({ length: 21 }, (_, index) => ({
        author_id: null,
        category_ids: [],
        created_at: `2026-03-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
        excerpt: null,
        published_at: null,
        refreshed_at: "2026-03-28T13:00:00.000Z",
        search_text: `post ${index}`,
        slug: `post-${index}`,
        source_post_id: `post-${String(index).padStart(2, "0")}`,
        status: "draft",
        tag_ids: [],
        title: `Post ${String(index).padStart(2, "0")}`,
        updated_at: `2026-04-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
      }));
      const query = {
        eq: vi.fn(),
        ilike: vi.fn(),
        limit: vi.fn().mockResolvedValue({
          data: rows,
          error: null,
        }),
        or: vi.fn(),
        order: vi.fn(),
        range: vi.fn().mockResolvedValue({
          data: rows,
          error: null,
        }),
      };
      query.eq.mockReturnValue(query);
      query.ilike.mockReturnValue(query);
      query.or.mockReturnValue(query);
      query.order.mockReturnValue(query);

      const select = vi.fn(() => query);
      const from = vi.fn(() => ({ select }));
      const schema = vi.fn(() => ({ from }));

      vi.mocked(createAdminClient).mockReturnValue({
        schema,
      } as never);

      const firstPage = await getContentPostsProjectionPage({
        mapping: createMappedContentMapping(),
        pageSize: 20,
        projectId: "project-1",
        sort,
        totalItems: 50_000,
        useCursorPagination: true,
      });

      expect(query.range).not.toHaveBeenCalled();
      expect(query.limit).toHaveBeenCalledWith(21);
      expect(query.order).toHaveBeenCalledWith(sortColumn, { ascending });
      expect(query.order).toHaveBeenCalledWith("source_post_id", { ascending: true });
      expect(firstPage.posts).toHaveLength(20);
      expect(firstPage.pagination).toEqual(
        expect.objectContaining({
          hasNextPage: true,
          nextCursor: expect.any(String),
          page: 1,
          pageSize: 20,
          totalItems: 50_000,
          totalItemsExact: false,
        }),
      );

      query.limit.mockClear();
      query.or.mockClear();
      query.order.mockClear();
      query.range.mockClear();

      await getContentPostsProjectionPage({
        cursor: firstPage.pagination.nextCursor,
        mapping: createMappedContentMapping(),
        pageSize: 20,
        projectId: "project-1",
        sort,
        totalItems: 50_000,
        useCursorPagination: true,
      });

      expect(query.or).toHaveBeenCalledWith(
        expect.stringContaining(`${sortColumn}.${cursorOperator}.`),
      );
      expect(query.or).toHaveBeenCalledWith(
        expect.stringContaining(`and(${sortColumn}.eq.`),
      );
      expect(query.or).toHaveBeenCalledWith(
        expect.stringContaining("source_post_id.gt.post-19"),
      );
      expect(query.limit).toHaveBeenCalledWith(21);
      expect(query.range).not.toHaveBeenCalled();
    },
  );
});
