import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  countContentPostsProjectionMock,
  deleteStaleContentPostProjectionRowsMock,
  getMappedRelationValuesForPostsMock,
  getContentPostsProjectionStateMock,
  loadMappedContentPostRowsMock,
  loadMappedContentPostRowsPageMock,
  saveContentPostsProjectionStateMock,
  upsertContentPostProjectionRowsMock,
} = vi.hoisted(() => ({
  countContentPostsProjectionMock: vi.fn(),
  deleteStaleContentPostProjectionRowsMock: vi.fn(),
  getMappedRelationValuesForPostsMock: vi.fn(),
  getContentPostsProjectionStateMock: vi.fn(),
  loadMappedContentPostRowsMock: vi.fn(),
  loadMappedContentPostRowsPageMock: vi.fn(),
  saveContentPostsProjectionStateMock: vi.fn(),
  upsertContentPostProjectionRowsMock: vi.fn(),
}));

vi.mock("@/lib/content-runtime/mapped-content-post-support", async () => {
  const actual = await vi.importActual<typeof import("@/lib/content-runtime/mapped-content-post-support")>(
    "@/lib/content-runtime/mapped-content-post-support",
  );

  return {
    ...actual,
    getMappedRelationValuesForPosts: getMappedRelationValuesForPostsMock,
    loadMappedContentPostRows: loadMappedContentPostRowsMock,
    loadMappedContentPostRowsPage: loadMappedContentPostRowsPageMock,
  };
});

vi.mock("@/lib/content-runtime/server-content-post-projection", () => ({
  countContentPostsProjection: countContentPostsProjectionMock,
  deleteStaleContentPostProjectionRows: deleteStaleContentPostProjectionRowsMock,
  getContentPostsProjectionState: getContentPostsProjectionStateMock,
  saveContentPostsProjectionState: saveContentPostsProjectionStateMock,
  upsertContentPostProjectionRows: upsertContentPostProjectionRowsMock,
}));

import type { ContentProjectMapping } from "@/lib/content-runtime/mapping";
import {
  buildContentPostProjectionRows,
  refreshContentPostsProjection,
} from "@/lib/content-runtime/server-content-post-projection-builder";

let projectionMappingCounter = 0;

const createMappedContentMapping = (): ContentProjectMapping => {
  projectionMappingCounter += 1;

  return {
  bindingId: "binding-1",
  bindingMode: "mapped_content",
  bindingStatus: "ready",
  mappingConfig: {
    entities: {
      authors: {
        capabilities: { browse: true, create: false, delete: false, read: true, update: false },
        companionContentColumns: [],
        customFields: [],
        editorFields: [],
        fields: {
          id: { column: "id", kind: "text", label: "ID", path: null, required: true, visible: false },
          name: { column: "name", kind: "text", label: "Name", path: null, required: true, visible: true },
          slug: { column: "slug", kind: "slug", label: "Slug", path: null, required: false, visible: true },
        },
        notes: [],
        relations: {},
        source: { kind: "table", primaryKey: "id", schema: "public", table: "authors" },
        status: "mapped",
        workflow: null,
      },
      categories: {
        capabilities: { browse: true, create: false, delete: false, read: true, update: false },
        companionContentColumns: [],
        customFields: [],
        editorFields: [],
        fields: {
          id: { column: "id", kind: "text", label: "ID", path: null, required: true, visible: false },
          name: { column: "name", kind: "text", label: "Name", path: null, required: true, visible: true },
          slug: { column: "slug", kind: "slug", label: "Slug", path: null, required: false, visible: true },
        },
        notes: [],
        relations: {},
        source: { kind: "table", primaryKey: "id", schema: "public", table: "categories" },
        status: "mapped",
        workflow: null,
      },
      files: {
        capabilities: { browse: true, create: false, delete: false, read: true, update: false },
        companionContentColumns: [],
        customFields: [],
        editorFields: [],
        fields: {
          id: { column: "id", kind: "text", label: "ID", path: null, required: true, visible: false },
        },
        notes: [],
        relations: {},
        source: { kind: "table", primaryKey: "id", schema: "public", table: "files" },
        status: "mapped",
        workflow: null,
      },
      media: {
        capabilities: { browse: true, create: false, delete: false, read: true, update: false },
        companionContentColumns: [],
        customFields: [],
        editorFields: [],
        fields: {
          id: { column: "id", kind: "text", label: "ID", path: null, required: true, visible: false },
        },
        notes: [],
        relations: {},
        source: { kind: "table", primaryKey: "id", schema: "public", table: "media" },
        status: "mapped",
        workflow: null,
      },
      posts: {
        capabilities: { browse: true, create: true, delete: true, read: true, update: true },
        companionContentColumns: [],
        customFields: [],
        editorFields: [],
        fields: {
          createdAt: {
            column: "created_at",
            kind: "datetime",
            label: "Created At",
            path: null,
            required: false,
            visible: true,
          },
          excerpt: {
            column: "excerpt",
            kind: "plain_text",
            label: "Excerpt",
            path: null,
            required: false,
            visible: true,
          },
          id: { column: "id", kind: "text", label: "ID", path: null, required: true, visible: false },
          publishedAt: {
            column: "published_at",
            kind: "datetime",
            label: "Published At",
            path: null,
            required: false,
            visible: true,
          },
          slug: { column: "slug", kind: "slug", label: "Slug", path: null, required: false, visible: true },
          status: { column: "status", kind: "text", label: "Status", path: null, required: false, visible: true },
          title: { column: "title", kind: "text", label: "Title", path: null, required: true, visible: true },
          updatedAt: {
            column: "updated_at",
            kind: "datetime",
            label: "Updated At",
            path: null,
            required: false,
            visible: true,
          },
        },
        notes: [],
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
            fieldMap: {},
            junctionSourceColumn: "post_id",
            junctionTable: "post_tags",
            junctionTargetColumn: "tag_id",
            multiple: true,
            sourceColumn: null,
            status: "mapped",
            strategy: "join_table",
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
          statusColumn: "status",
        },
      },
      tags: {
        capabilities: { browse: true, create: false, delete: false, read: true, update: false },
        companionContentColumns: [],
        customFields: [],
        editorFields: [],
        fields: {
          id: { column: "id", kind: "text", label: "ID", path: null, required: true, visible: false },
          name: { column: "name", kind: "text", label: "Name", path: null, required: true, visible: true },
          slug: { column: "slug", kind: "slug", label: "Slug", path: null, required: false, visible: true },
        },
        notes: [],
        relations: {},
        source: { kind: "table", primaryKey: "id", schema: "public", table: "tags" },
        status: "mapped",
        workflow: null,
      },
    },
    filesStorage: null,
    mediaStorage: null,
    version: 1,
  },
  revisionId: `revision-${projectionMappingCounter}`,
  revisionVersion: projectionMappingCounter,
  };
};

describe("server mapped-content post projection builder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    countContentPostsProjectionMock.mockResolvedValue(0);
    deleteStaleContentPostProjectionRowsMock.mockResolvedValue(undefined);
    getContentPostsProjectionStateMock.mockResolvedValue(null);
    saveContentPostsProjectionStateMock.mockResolvedValue(undefined);
    upsertContentPostProjectionRowsMock.mockResolvedValue(undefined);
  });

  it("builds hot preview rows with author and taxonomy ids plus normalized search text", async () => {
    getMappedRelationValuesForPostsMock
      .mockResolvedValueOnce(new Map([["post-1", ["author-1"]]]))
      .mockResolvedValueOnce(new Map([["post-1", ["category-1", "category-2"]]]))
      .mockResolvedValueOnce(new Map([["post-1", ["tag-1"]]]));

    const rows = await buildContentPostProjectionRows({
      client: {
        query: vi.fn(),
      },
      mapping: createMappedContentMapping(),
      postRows: [
        {
          created_at: "2026-03-27T00:00:00.000Z",
          excerpt: "Launch notes",
          id: "post-1",
          published_at: "2026-03-28T00:00:00.000Z",
          slug: "hello-world",
          status: "published",
          title: "Hello World",
          updated_at: "2026-03-28T12:00:00.000Z",
        },
      ],
      projectId: "project-1",
      refreshedAt: "2026-03-28T13:00:00.000Z",
    });

    expect(rows).toEqual([
      expect.objectContaining({
        authorId: "author-1",
        categoryIds: ["category-1", "category-2"],
        excerpt: "Launch notes",
        projectId: "project-1",
        publishedAt: "2026-03-28T00:00:00.000Z",
        refreshedAt: "2026-03-28T13:00:00.000Z",
        searchText: "hello world hello-world launch notes published",
        slug: "hello-world",
        sourcePostId: "post-1",
        status: "published",
        tagIds: ["tag-1"],
        title: "Hello World",
      }),
    ]);
  });

  it("refreshes full projections in bounded source batches", async () => {
    vi.stubEnv("BASEBUDDY_PROJECTION_REFRESH_BATCH_SIZE", "1");
    getMappedRelationValuesForPostsMock.mockResolvedValue(new Map());
    const queryMock = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            created_at: "2026-03-27T00:00:00.000Z",
            id: "post-1",
            slug: "post-1",
            status: "draft",
            title: "Post 1",
            updated_at: "2026-03-28T00:00:00.000Z",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [],
      });
    countContentPostsProjectionMock.mockResolvedValue(1);

    await expect(
      refreshContentPostsProjection({
        client: { query: queryMock },
        mapping: createMappedContentMapping(),
        projectId: "project-1",
      }),
    ).resolves.toEqual({ totalItems: 1 });

    expect(loadMappedContentPostRowsMock).not.toHaveBeenCalled();
    expect(loadMappedContentPostRowsPageMock).not.toHaveBeenCalled();
    expect(queryMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("order by \"id\" asc"),
      [1],
    );
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("\"id\" > $1"),
      ["post-1", 1],
    );
    expect(upsertContentPostProjectionRowsMock).toHaveBeenCalledTimes(1);
    expect(saveContentPostsProjectionStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        processedItems: 1,
        progressCursor: "post-1",
        status: "building",
      }),
    );
    expect(deleteStaleContentPostProjectionRowsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        refreshedAt: expect.any(String),
        sourcePostIds: null,
      }),
    );
    expect(saveContentPostsProjectionStateMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        processedItems: 1,
        progressCursor: null,
        status: "ready",
        totalItems: 1,
      }),
    );
  });

  it("uses a configured projection rebuild batch size when provided", async () => {
    vi.stubEnv("BASEBUDDY_PROJECTION_REFRESH_BATCH_SIZE", "25");
    getMappedRelationValuesForPostsMock.mockResolvedValue(new Map());
    const queryMock = vi.fn().mockResolvedValueOnce({ rows: [] });
    countContentPostsProjectionMock.mockResolvedValue(0);

    await refreshContentPostsProjection({
      client: { query: queryMock },
      mapping: createMappedContentMapping(),
      projectId: "project-1",
    });

    expect(loadMappedContentPostRowsPageMock).not.toHaveBeenCalled();
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("limit $1"), [25]);
  });

  it("uses a large bounded default projection rebuild batch size", async () => {
    getMappedRelationValuesForPostsMock.mockResolvedValue(new Map());
    const queryMock = vi.fn().mockResolvedValueOnce({ rows: [] });
    countContentPostsProjectionMock.mockResolvedValue(0);

    await refreshContentPostsProjection({
      client: { query: queryMock },
      mapping: createMappedContentMapping(),
      projectId: "project-1",
    });

    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("limit $1"), [1000]);
  });

  it("resumes a failed full projection rebuild from the saved source cursor", async () => {
    getContentPostsProjectionStateMock.mockResolvedValueOnce({
      lastError: "connection closed",
      lastRefreshedAt: "2026-04-01T10:00:00.000Z",
      processedItems: 100,
      progressCursor: "post-100",
      status: "failed",
      totalItems: 0,
    });
    getMappedRelationValuesForPostsMock.mockResolvedValue(new Map());
    const queryMock = vi.fn().mockResolvedValueOnce({
      rows: [
        {
          created_at: "2026-03-27T00:00:00.000Z",
          id: "post-101",
          slug: "post-101",
          status: "draft",
          title: "Post 101",
          updated_at: "2026-03-28T00:00:00.000Z",
        },
      ],
    });
    countContentPostsProjectionMock.mockResolvedValue(101);

    await refreshContentPostsProjection({
      client: { query: queryMock },
      mapping: createMappedContentMapping(),
      projectId: "project-1",
    });

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("\"id\" > $1"),
      ["post-100", 1000],
    );
    expect(saveContentPostsProjectionStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        lastRefreshedAt: "2026-04-01T10:00:00.000Z",
        processedItems: 100,
        progressCursor: "post-100",
        status: "building",
      }),
    );
    expect(saveContentPostsProjectionStateMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        lastRefreshedAt: "2026-04-01T10:00:00.000Z",
        processedItems: 101,
        progressCursor: null,
        status: "ready",
      }),
    );
    expect(deleteStaleContentPostProjectionRowsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        refreshedAt: "2026-04-01T10:00:00.000Z",
      }),
    );
  });

  it("does not publish a projection rebuild that was marked stale while it was running", async () => {
    getContentPostsProjectionStateMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        lastError: null,
        lastRefreshedAt: "2026-04-01T10:00:00.000Z",
        processedItems: 1,
        progressCursor: "post-1",
        status: "stale",
        totalItems: 0,
      });
    getMappedRelationValuesForPostsMock.mockResolvedValue(new Map());
    const queryMock = vi.fn().mockResolvedValueOnce({
      rows: [
        {
          created_at: "2026-03-27T00:00:00.000Z",
          id: "post-1",
          slug: "post-1",
          status: "draft",
          title: "Post 1",
          updated_at: "2026-03-28T00:00:00.000Z",
        },
      ],
    });

    await expect(
      refreshContentPostsProjection({
        client: { query: queryMock },
        mapping: createMappedContentMapping(),
        projectId: "project-1",
      }),
    ).resolves.toEqual({ totalItems: 0 });

    expect(deleteStaleContentPostProjectionRowsMock).not.toHaveBeenCalled();
    expect(countContentPostsProjectionMock).not.toHaveBeenCalled();
    expect(saveContentPostsProjectionStateMock).not.toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "ready",
      }),
    );
  });

  it("builds hot preview rows from JSON-path-backed explicit fields", async () => {
    const mapping = createMappedContentMapping();

    mapping.mappingConfig.entities.posts.fields.title = {
      ...mapping.mappingConfig.entities.posts.fields.title,
      column: "content_payload",
      path: "title",
    };
    mapping.mappingConfig.entities.posts.fields.excerpt = {
      ...mapping.mappingConfig.entities.posts.fields.excerpt,
      column: "seo_payload",
      path: "description",
    };
    mapping.mappingConfig.entities.posts.fields.slug = {
      ...mapping.mappingConfig.entities.posts.fields.slug,
      column: "route_payload",
      path: "slug.current",
    };
    mapping.mappingConfig.entities.posts.fields.createdAt = {
      ...mapping.mappingConfig.entities.posts.fields.createdAt,
      column: "audit_payload",
      path: "created.at",
    };
    mapping.mappingConfig.entities.posts.fields.updatedAt = {
      ...mapping.mappingConfig.entities.posts.fields.updatedAt,
      column: "audit_payload",
      path: "updated.at",
    };

    getMappedRelationValuesForPostsMock
      .mockResolvedValueOnce(new Map([["post-1", []]]))
      .mockResolvedValueOnce(new Map([["post-1", []]]))
      .mockResolvedValueOnce(new Map([["post-1", []]]));

    const rows = await buildContentPostProjectionRows({
      client: {
        query: vi.fn(),
      },
      mapping,
      postRows: [
        {
          audit_payload: {
            created: { at: "2026-03-27T00:00:00.000Z" },
            updated: { at: "2026-03-28T12:00:00.000Z" },
          },
          content_payload: {
            title: "Hello World",
          },
          id: "post-1",
          published_at: "2026-03-28T00:00:00.000Z",
          route_payload: {
            slug: {
              current: "hello-world",
            },
          },
          seo_payload: {
            description: "Launch notes",
          },
          status: "published",
        },
      ],
      projectId: "project-1",
      refreshedAt: "2026-03-28T13:00:00.000Z",
    });

    expect(rows).toEqual([
      expect.objectContaining({
        createdAt: "2026-03-27T00:00:00.000Z",
        excerpt: "Launch notes",
        searchText: "hello world hello-world launch notes published",
        slug: "hello-world",
        title: "Hello World",
        updatedAt: "2026-03-28T12:00:00.000Z",
      }),
    ]);
  });
});
