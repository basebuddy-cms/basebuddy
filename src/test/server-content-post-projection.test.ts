import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { ContentProjectMapping } from "@/lib/content-runtime/mapping";
import {
  countContentPostsProjection,
  deleteStaleContentPostProjectionRows,
  getContentPostProjectionAuthorId,
  getContentPostsProjectionPage,
  getContentPostsProjectionKey,
  getContentPostsProjectionState,
  listContentPostProjectionPreviews,
  mapContentProjectedPostPreview,
  saveContentPostsProjectionState,
  upsertContentPostProjectionRows,
} from "@/lib/content-runtime/server-content-post-projection";

const createMappedContentMapping = (revisionVersion = 7): ContentProjectMapping => ({
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
  revisionVersion,
});

const createProjectionRows = (count: number, refreshedAt = "2026-03-28T13:00:00.000Z") =>
  Array.from({ length: count }, (_, index) => {
    const oneBasedIndex = index + 1;
    return {
      authorId: oneBasedIndex % 2 === 0 ? "author-even" : "author-odd",
      categoryIds: oneBasedIndex % 3 === 0 ? ["category-featured"] : [],
      createdAt: `2026-03-${String(oneBasedIndex).padStart(2, "0")}T00:00:00.000Z`,
      excerpt: oneBasedIndex % 5 === 0 ? "Launch notes" : null,
      projectId: "project-1",
      publishedAt: oneBasedIndex % 2 === 0 ? `2026-04-${String(oneBasedIndex).padStart(2, "0")}T00:00:00.000Z` : null,
      refreshedAt,
      searchText: `post ${oneBasedIndex} ${oneBasedIndex % 5 === 0 ? "launch" : "draft"}`,
      slug: `post-${oneBasedIndex}`,
      sourcePostId: `post-${String(oneBasedIndex).padStart(3, "0")}`,
      status: oneBasedIndex % 2 === 0 ? "published" : "draft",
      tagIds: oneBasedIndex % 4 === 0 ? ["tag-release"] : [],
      title: `Post ${String(oneBasedIndex).padStart(3, "0")}`,
      updatedAt: `2026-04-${String(oneBasedIndex).padStart(2, "0")}T00:00:00.000Z`,
    } as const;
  });

describe("server mapped-content post projection storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores projection state in memory for the current mapping revision", async () => {
    const mapping = createMappedContentMapping(101);

    await expect(
      getContentPostsProjectionState({
        mapping,
        projectId: "project-state",
      }),
    ).resolves.toBeNull();

    await saveContentPostsProjectionState({
      lastError: null,
      lastRefreshedAt: "2026-03-28T13:00:00.000Z",
      mapping,
      processedItems: 20,
      progressCursor: "post-020",
      projectId: "project-state",
      status: "building",
      totalItems: 24,
    });

    await expect(
      getContentPostsProjectionState({
        mapping,
        projectId: "project-state",
      }),
    ).resolves.toEqual({
      lastError: null,
      lastRefreshedAt: "2026-03-28T13:00:00.000Z",
      processedItems: 20,
      progressCursor: "post-020",
      status: "building",
      totalItems: 24,
    });
  });

  it("keeps projection rows in memory and supports author, taxonomy, status, and search filters", async () => {
    const mapping = createMappedContentMapping(102);

    await upsertContentPostProjectionRows({
      mapping,
      projectId: "project-1",
      rows: createProjectionRows(24),
    });

    await expect(
      getContentPostProjectionAuthorId({
        mapping,
        postId: "post-002",
        projectId: "project-1",
      }),
    ).resolves.toBe("author-even");

    await expect(
      countContentPostsProjection({
        accessibleAuthorIds: ["author-even"],
        mapping,
        projectId: "project-1",
        search: "launch",
        status: "published",
        tagIds: ["tag-release"],
      }),
    ).resolves.toBe(1);

    await expect(
      listContentPostProjectionPreviews({
        accessibleAuthorIds: ["author-even"],
        mapping,
        projectId: "project-1",
        search: "launch",
        status: "published",
      }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          authorId: "author-even",
          id: "post-020",
          status: "published",
          title: "Post 020",
        }),
      ]),
    );

    await deleteStaleContentPostProjectionRows({
      mapping,
      projectId: "project-1",
      refreshedAt: "2026-03-28T13:00:00.000Z",
      sourcePostIds: ["post-010"],
    });

    await expect(
      getContentPostProjectionAuthorId({
        mapping,
        postId: "post-010",
        projectId: "project-1",
      }),
    ).resolves.toBe("author-even");

    await deleteStaleContentPostProjectionRows({
      mapping,
      projectId: "project-1",
      refreshedAt: "2026-03-29T13:00:00.000Z",
      sourcePostIds: ["post-010"],
    });

    await expect(
      getContentPostProjectionAuthorId({
        mapping,
        postId: "post-010",
        projectId: "project-1",
      }),
    ).resolves.toBeNull();
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

  it("uses bounded window and cursor pagination for in-memory projection pages", async () => {
    const mapping = createMappedContentMapping(103);
    await upsertContentPostProjectionRows({
      mapping,
      projectId: "project-page",
      rows: createProjectionRows(50),
    });

    const windowPage = await getContentPostsProjectionPage({
      mapping,
      page: 2,
      pageSize: 20,
      projectId: "project-page",
      search: "post",
      totalItems: 50_000,
      useWindowPagination: true,
    });

    expect(windowPage.posts).toHaveLength(20);
    expect(windowPage.pagination).toEqual(
      expect.objectContaining({
        hasNextPage: true,
        hasPreviousPage: true,
        page: 2,
        pageSize: 20,
        totalItems: 50_000,
        totalItemsExact: false,
      }),
    );

    const deepPage = await getContentPostsProjectionPage({
      mapping,
      page: 500,
      pageSize: 20,
      projectId: "project-page",
      totalItems: 50_000,
    });

    expect(deepPage.posts).toHaveLength(20);
    expect(deepPage.pagination).toEqual(
      expect.objectContaining({
        hasNextPage: true,
        nextCursor: expect.any(String),
        page: 1,
        pageSize: 20,
        totalItemsExact: false,
      }),
    );

    const nextPage = await getContentPostsProjectionPage({
      cursor: deepPage.pagination.nextCursor,
      mapping,
      pageSize: 20,
      projectId: "project-page",
      totalItems: 50_000,
      useCursorPagination: true,
    });

    expect(nextPage.posts.at(0)?.id).toBe("post-030");
  });

  it.each([
    ["updated_desc", "post-024", "post-019"],
    ["updated_asc", "post-001", "post-006"],
    ["created_desc", "post-024", "post-019"],
    ["created_asc", "post-001", "post-006"],
    ["title_desc", "post-024", "post-019"],
    ["title_asc", "post-001", "post-006"],
  ] as const)(
    "uses stable cursor ordering for projection-backed %s post lists",
    async (sort, firstPostId, secondPageFirstPostId) => {
      const mapping = createMappedContentMapping(104);
      await upsertContentPostProjectionRows({
        mapping,
        projectId: `project-cursor-${sort}`,
        rows: createProjectionRows(24),
      });

      const firstPage = await getContentPostsProjectionPage({
        mapping,
        pageSize: 5,
        projectId: `project-cursor-${sort}`,
        sort,
        totalItems: 24,
        useCursorPagination: true,
      });

      expect(firstPage.posts.at(0)?.id).toBe(firstPostId);
      expect(firstPage.pagination.nextCursor).toEqual(expect.any(String));

      const nextPage = await getContentPostsProjectionPage({
        cursor: firstPage.pagination.nextCursor,
        mapping,
        pageSize: 5,
        projectId: `project-cursor-${sort}`,
        sort,
        totalItems: 24,
        useCursorPagination: true,
      });

      expect(nextPage.posts.at(0)?.id).toBe(secondPageFirstPostId);
    },
  );

  it("scopes projection rows by mapping revision key", async () => {
    const oldMapping = createMappedContentMapping(105);
    const newMapping = createMappedContentMapping(106);

    await upsertContentPostProjectionRows({
      mapping: oldMapping,
      projectId: "project-revision",
      rows: createProjectionRows(1),
    });

    await expect(
      countContentPostsProjection({
        mapping: newMapping,
        projectId: "project-revision",
      }),
    ).resolves.toBe(0);

    expect(getContentPostsProjectionKey(oldMapping)).not.toBe(
      getContentPostsProjectionKey(newMapping),
    );
  });
});
