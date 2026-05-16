import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getMappedContentPostEditorPayloadMock,
  getMappedContentPostsPageMock,
} = vi.hoisted(() => ({
  getMappedContentPostEditorPayloadMock: vi.fn(),
  getMappedContentPostsPageMock: vi.fn(),
}));

vi.mock("@/lib/content-runtime/mapped-content-post-reads", () => ({
  getMappedContentPostAuthorId: vi.fn(),
  getMappedContentPostById: vi.fn(),
  getMappedContentPostEditorPayload: getMappedContentPostEditorPayloadMock,
  getMappedContentPostsPage: getMappedContentPostsPageMock,
  getMappedContentSnapshot: vi.fn(),
  getMappedContentWorkspaceCounts: vi.fn(),
  hasReadyContentMapping: vi.fn(),
}));

import {
  createContentRuntimeAdapter,
  getRequiredContentRuntimeAdapterMethod,
} from "@/lib/content-runtime/adapter/factory";
import { normalizeContentProjectMapping } from "@/lib/content-runtime/mapping";

const createMappedProjectMapping = () =>
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
        posts: {
          customFields: [],
          editorFields: [],
          fields: {
            title: { column: "headline", kind: "text", label: "Title", required: true },
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
          },
          source: { kind: "table", primaryKey: "id", schema: "public", table: "posts" },
          status: "mapped",
          workflow: null,
        },
        tags: {
          source: { kind: "table", primaryKey: "id", schema: "public", table: "tags" },
          status: "mapped",
        },
      },
      mediaStorage: null,
      version: 1,
    },
    revisionId: "revision-1",
    revisionVersion: 1,
  });

describe("Postgres runtime adapter read delegation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates paginated post reads through adapter loadPostsPage", async () => {
    const mapping = createMappedProjectMapping();
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const client = { query: vi.fn() };

    getMappedContentPostsPageMock.mockResolvedValue({
      authors: [],
      categories: [],
      editorOptionsState: "warm",
      pagination: {
        hasNextPage: false,
        hasPreviousPage: false,
        page: 1,
        pageSize: 10,
        totalItems: 1,
        totalItemsExact: true,
        totalPages: 1,
      },
      posts: [],
      tags: [],
    });

    await adapter.loadPostsPage?.({
      accessibleAuthorIds: ["author-1"],
      client,
      page: 1,
      pageSize: 10,
      projectId: "project-1",
      search: "hello",
      sort: "updated_desc",
      status: "all",
      totalItems: 1,
      writableAuthorIds: ["author-1"],
    });

    expect(getMappedContentPostsPageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accessibleAuthorIds: ["author-1"],
        client,
        mapping,
        page: 1,
        pageSize: 10,
        projectId: "project-1",
        search: "hello",
        sort: "updated_desc",
        status: "all",
        totalItems: 1,
        writableAuthorIds: ["author-1"],
      }),
    );
  });

  it("delegates post editor payload reads through adapter loadPostEditorPayload", async () => {
    const mapping = createMappedProjectMapping();
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const client = { query: vi.fn() };
    const authorAssignmentsByAuthorId = new Map<string, { avatar_url: string | null }>([
      ["author-1", { avatar_url: null }],
    ]);

    getMappedContentPostEditorPayloadMock.mockResolvedValue({
      authors: [],
      categories: [],
      editorOptionsState: "warm",
      post: {
        authorId: "author-1",
        categoryIds: [],
        contentFields: {},
        contentFormat: "html",
        contentHtml: "<p>Hello</p>",
        contentJson: { type: "doc" },
        contentMarkdown: null,
        createdAt: "2026-04-05T00:00:00.000Z",
        customFields: {},
        excerpt: null,
        featuredImageUrl: null,
        focusKeyword: null,
        id: "post-1",
        publishedAt: null,
        seoDescription: null,
        seoTitle: null,
        slug: "post-1",
        status: "draft",
        tagIds: [],
        title: "Post 1",
        updatedAt: "2026-04-05T01:00:00.000Z",
      },
      tags: [],
    });

    await adapter.loadPostEditorPayload?.({
      accessibleAuthorIds: ["author-1"],
      authorAssignmentsByAuthorId,
      client,
      includeEditorOptions: true,
      postId: "post-1",
      projectId: "project-1",
    });

    expect(getMappedContentPostEditorPayloadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accessibleAuthorIds: ["author-1"],
        authorAssignmentsByAuthorId,
        client,
        includeEditorOptions: true,
        mapping,
        postId: "post-1",
        projectId: "project-1",
      }),
    );
  });

  it("counts posts through the adapter SQL boundary", async () => {
    const mapping = createMappedProjectMapping();
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ count: "12" }],
      }),
    };

    await expect(
      adapter.countPosts({
        client,
        search: "hello",
        status: "draft",
      }),
    ).resolves.toBe(12);

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('from "public"."posts"'),
      expect.any(Array),
    );
  });

  it("returns adapter methods already bound to the runtime adapter instance", async () => {
    const mapping = createMappedProjectMapping();
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const client = { query: vi.fn() };
    const authorAssignmentsByAuthorId = new Map<string, { avatar_url: string | null }>([
      ["author-1", { avatar_url: null }],
    ]);

    getMappedContentPostEditorPayloadMock.mockResolvedValue({
      authors: [],
      categories: [],
      editorOptionsState: "warm",
      post: {
        authorId: "author-1",
        categoryIds: [],
        contentFields: {},
        contentFormat: "html",
        contentHtml: "<p>Hello</p>",
        contentJson: { type: "doc" },
        contentMarkdown: null,
        createdAt: "2026-04-05T00:00:00.000Z",
        customFields: {},
        excerpt: null,
        featuredImageUrl: null,
        focusKeyword: null,
        id: "post-1",
        publishedAt: null,
        seoDescription: null,
        seoTitle: null,
        slug: "post-1",
        status: "draft",
        tagIds: [],
        title: "Post 1",
        updatedAt: "2026-04-05T01:00:00.000Z",
      },
      tags: [],
    });

    const loadPostEditorPayload = getRequiredContentRuntimeAdapterMethod(
      adapter,
      "loadPostEditorPayload",
    );

    await expect(
      loadPostEditorPayload({
        accessibleAuthorIds: ["author-1"],
        authorAssignmentsByAuthorId,
        client,
        includeEditorOptions: true,
        postId: "post-1",
        projectId: "project-1",
      }),
    ).resolves.toMatchObject({
      editorOptionsState: "warm",
      post: {
        id: "post-1",
      },
    });

    expect(getMappedContentPostEditorPayloadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mapping,
        postId: "post-1",
        projectId: "project-1",
      }),
    );
  });
});
