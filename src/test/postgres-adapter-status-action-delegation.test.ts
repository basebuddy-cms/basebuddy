import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  updateMappedContentPostMock,
} = vi.hoisted(() => ({
  updateMappedContentPostMock: vi.fn(),
}));

vi.mock("@/lib/content-runtime/mapped-content-post-writes", () => ({
  createMappedContentPost: vi.fn(),
  deleteMappedContentPosts: vi.fn(),
  discardMappedContentPost: vi.fn(),
  updateMappedContentPost: updateMappedContentPostMock,
}));

import { createContentRuntimeAdapter } from "@/lib/content-runtime/adapter/factory";
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
            excerpt: { column: "summary", kind: "plain_text", label: "Excerpt" },
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

const resolvedPost = {
  authorId: "author-1",
  categoryIds: [],
  contentFields: {},
  contentFormat: "html",
  contentHtml: "<p>Hello</p>",
  contentJson: { type: "doc" },
  contentMarkdown: null,
  createdAt: "2026-04-05T00:00:00.000Z",
  customFields: {},
  excerpt: "Excerpt",
  featuredImageUrl: null,
  focusKeyword: null,
  id: "post-1",
  publishedAt: null,
  seoDescription: null,
  seoTitle: null,
  slug: "post-1",
  status: "draft" as const,
  tagIds: [],
  title: "Hello",
  updatedAt: "2026-04-05T01:00:00.000Z",
};

describe("Postgres runtime adapter status action delegation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateMappedContentPostMock.mockResolvedValue(resolvedPost);
  });

  it("delegates publishPost through the mapped mapped-content write helper", async () => {
    const mapping = createMappedProjectMapping();
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const client = { query: vi.fn() };

    await adapter.publishPost?.({
      client,
      excerpt: "Excerpt",
      postId: "post-1",
      title: "Hello",
      updatedAt: "2026-04-05T01:00:00.000Z",
    });

    expect(updateMappedContentPostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        excerpt: "Excerpt",
        mapping,
        postId: "post-1",
        status: "published",
        title: "Hello",
      }),
    );
    expect(updateMappedContentPostMock.mock.calls[0]?.[0]?.updatedAt).toBeUndefined();
  });

  it("delegates unpublishPost through the mapped mapped-content write helper", async () => {
    const mapping = createMappedProjectMapping();
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const client = { query: vi.fn() };

    await adapter.unpublishPost?.({
      client,
      postId: "post-1",
      title: "Hello",
    });

    expect(updateMappedContentPostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        mapping,
        postId: "post-1",
        status: "draft",
        title: "Hello",
      }),
    );
  });

  it("delegates archivePost through the mapped mapped-content write helper", async () => {
    const mapping = createMappedProjectMapping();
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const client = { query: vi.fn() };

    await adapter.archivePost?.({
      client,
      postId: "post-1",
      title: "Hello",
    });

    expect(updateMappedContentPostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        mapping,
        postId: "post-1",
        status: "archived",
        title: "Hello",
      }),
    );
  });
});
