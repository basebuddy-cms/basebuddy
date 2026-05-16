import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  createMappedContentCollectionEntryMock,
  deleteMappedContentCollectionEntriesMock,
  getMappedContentAuthorOptionsMock,
  getMappedContentAuthorsPageMock,
  getMappedContentCategoriesPageMock,
  getMappedContentFilesPageMock,
  getMappedContentMediaPageMock,
  getMappedContentTagsPageMock,
  searchMappedContentAuthorsMock,
  searchMappedContentCategoriesMock,
  searchMappedContentFilesMock,
  searchMappedContentMediaMock,
  searchMappedContentParentPagesMock,
  searchMappedContentTagsMock,
  updateMappedContentCollectionEntryMock,
} = vi.hoisted(() => ({
  createMappedContentCollectionEntryMock: vi.fn(),
  deleteMappedContentCollectionEntriesMock: vi.fn(),
  getMappedContentAuthorOptionsMock: vi.fn(),
  getMappedContentAuthorsPageMock: vi.fn(),
  getMappedContentCategoriesPageMock: vi.fn(),
  getMappedContentFilesPageMock: vi.fn(),
  getMappedContentMediaPageMock: vi.fn(),
  getMappedContentTagsPageMock: vi.fn(),
  searchMappedContentAuthorsMock: vi.fn(),
  searchMappedContentCategoriesMock: vi.fn(),
  searchMappedContentFilesMock: vi.fn(),
  searchMappedContentMediaMock: vi.fn(),
  searchMappedContentParentPagesMock: vi.fn(),
  searchMappedContentTagsMock: vi.fn(),
  updateMappedContentCollectionEntryMock: vi.fn(),
}));

vi.mock("@/lib/content-runtime/mapped-content-collections", () => ({
  createMappedContentCollectionEntry: createMappedContentCollectionEntryMock,
  deleteMappedContentCollectionEntries: deleteMappedContentCollectionEntriesMock,
  getMappedContentAuthorOptions: getMappedContentAuthorOptionsMock,
  getMappedContentAuthorsPage: getMappedContentAuthorsPageMock,
  getMappedContentCategoriesPage: getMappedContentCategoriesPageMock,
  getMappedContentFilesPage: getMappedContentFilesPageMock,
  getMappedContentMediaPage: getMappedContentMediaPageMock,
  getMappedContentTagsPage: getMappedContentTagsPageMock,
  loadMappedContentAuthors: vi.fn(),
  loadMappedContentCategories: vi.fn(),
  loadMappedContentTags: vi.fn(),
  searchMappedContentAuthors: searchMappedContentAuthorsMock,
  searchMappedContentCategories: searchMappedContentCategoriesMock,
  searchMappedContentFiles: searchMappedContentFilesMock,
  searchMappedContentMedia: searchMappedContentMediaMock,
  searchMappedContentTags: searchMappedContentTagsMock,
  updateMappedContentCollectionEntry: updateMappedContentCollectionEntryMock,
}));

vi.mock("@/lib/content-runtime/mapped-content-post-support", () => ({
  searchMappedContentParentPages: searchMappedContentParentPagesMock,
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
        media: {
          source: { kind: "table", primaryKey: "id", schema: "public", table: "media" },
          status: "mapped",
        },
        files: {
          source: { kind: "table", primaryKey: "id", schema: "public", table: "files" },
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
            categories: {
              fieldMap: { name: "name" },
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
              fieldMap: { name: "name" },
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

describe("Postgres runtime adapter collection delegation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates categories page loads through the mapped-content collection helper", async () => {
    const mapping = createMappedProjectMapping();
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const client = { query: vi.fn() };

    getMappedContentCategoriesPageMock.mockResolvedValue({
      allCategories: [],
      items: [],
      pagination: {
        hasNextPage: false,
        hasPreviousPage: false,
        page: 1,
        pageSize: 10,
        totalItems: 0,
        totalPages: 1,
      },
    });

    await adapter.loadCategoriesPage?.({
      client,
      includeAllCategories: true,
      page: 1,
      pageSize: 10,
      projectId: "project-1",
    });

    expect(getMappedContentCategoriesPageMock).toHaveBeenCalledWith({
      client,
      includeAllCategories: true,
      mapping,
      page: 1,
      pageSize: 10,
      projectId: "project-1",
    });
  });

  it("delegates tags page loads through the mapped-content collection helper", async () => {
    const mapping = createMappedProjectMapping();
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const client = { query: vi.fn() };

    getMappedContentTagsPageMock.mockResolvedValue({
      items: [],
      pagination: {
        hasNextPage: false,
        hasPreviousPage: false,
        page: 1,
        pageSize: 10,
        totalItems: 0,
        totalPages: 1,
      },
    });

    await adapter.loadTagsPage?.({
      client,
      page: 1,
      pageSize: 10,
    });

    expect(getMappedContentTagsPageMock).toHaveBeenCalledWith({
      client,
      mapping,
      page: 1,
      pageSize: 10,
    });
  });

  it("delegates media page loads through the mapped-content collection helper", async () => {
    const mapping = createMappedProjectMapping();
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const client = { query: vi.fn() };

    getMappedContentMediaPageMock.mockResolvedValue({
      items: [],
      pagination: {
        hasNextPage: false,
        hasPreviousPage: false,
        page: 1,
        pageSize: 10,
        totalItems: 0,
        totalPages: 1,
      },
    });

    await adapter.loadMediaPage({
      client,
      page: 1,
      pageSize: 10,
    });

    expect(getMappedContentMediaPageMock).toHaveBeenCalledWith({
      client,
      mapping,
      page: 1,
      pageSize: 10,
    });
  });

  it("delegates authors page loads through the mapped-content collection helper", async () => {
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

    getMappedContentAuthorsPageMock.mockResolvedValue({
      items: [],
      pagination: {
        hasNextPage: false,
        hasPreviousPage: false,
        page: 1,
        pageSize: 10,
        totalItems: 0,
        totalPages: 1,
      },
    });

    await adapter.loadAuthorsPage?.({
      authorAssignmentsByAuthorId,
      client,
      page: 1,
      pageSize: 10,
    });

    expect(getMappedContentAuthorsPageMock).toHaveBeenCalledWith({
      authorAssignmentsByAuthorId,
      client,
      mapping,
      page: 1,
      pageSize: 10,
    });
  });

  it("delegates author option loads through the mapped-content collection helper", async () => {
    const mapping = createMappedProjectMapping();
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const client = { query: vi.fn() };

    getMappedContentAuthorOptionsMock.mockResolvedValue([
      { id: "author-1", name: "Author One", slug: "author-one" },
    ]);

    await adapter.loadAuthorOptions?.({
      client,
      limit: 25,
    });

    expect(getMappedContentAuthorOptionsMock).toHaveBeenCalledWith({
      client,
      limit: 25,
      mapping,
    });
  });

  it("delegates author relation search through the mapped-content collection helper", async () => {
    const mapping = createMappedProjectMapping();
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const client = { query: vi.fn() };

    searchMappedContentAuthorsMock.mockResolvedValue([
      { id: "author-1", name: "Author One", slug: "author-one" },
    ]);

    const result = await adapter.searchAuthors?.({
      accessibleAuthorIds: ["author-1"],
      client,
      limit: 25,
      search: "author",
    });

    expect(searchMappedContentAuthorsMock).toHaveBeenCalledWith({
      accessibleAuthorIds: ["author-1"],
      client,
      limit: 25,
      mapping,
      search: "author",
    });
    expect(result).toEqual([
      {
        id: "author-1",
        label: "Author One",
        metadata: {
          slug: "author-one",
        },
      },
    ]);
  });

  it("delegates category relation search through the mapped-content collection helper", async () => {
    const mapping = createMappedProjectMapping();
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const client = { query: vi.fn() };

    searchMappedContentCategoriesMock.mockResolvedValue([
      {
        depth: 1,
        hierarchyPath: "Parent / News",
        id: "category-1",
        name: "News",
        slug: "news",
      },
    ]);

    const result = await adapter.searchCategories?.({
      client,
      limit: 50,
      search: "news",
    });

    expect(searchMappedContentCategoriesMock).toHaveBeenCalledWith({
      client,
      limit: 50,
      mapping,
      search: "news",
    });
    expect(result).toEqual([
      {
        id: "category-1",
        label: "Parent / News",
        metadata: {
          depth: 1,
          hierarchyPath: "Parent / News",
          slug: "news",
        },
      },
    ]);
  });

  it("delegates tag relation search through the mapped-content collection helper", async () => {
    const mapping = createMappedProjectMapping();
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const client = { query: vi.fn() };

    searchMappedContentTagsMock.mockResolvedValue([
      { id: "tag-1", name: "Launch", slug: "launch" },
    ]);

    const result = await adapter.searchTags?.({
      client,
      limit: 30,
      search: "la",
    });

    expect(searchMappedContentTagsMock).toHaveBeenCalledWith({
      client,
      limit: 30,
      mapping,
      search: "la",
    });
    expect(result).toEqual([
      {
        id: "tag-1",
        label: "Launch",
        metadata: {
          slug: "launch",
        },
      },
    ]);
  });

  it("delegates media relation search through the mapped-content collection helper", async () => {
    const mapping = createMappedProjectMapping();
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const client = { query: vi.fn() };

    searchMappedContentMediaMock.mockResolvedValue([
      {
        fileName: "cover.png",
        id: "media-1",
        objectPath: "uploads/cover.png",
        url: "https://cdn.example.com/uploads/cover.png",
      },
    ]);

    const result = await adapter.searchMedia?.({
      client,
      limit: 20,
      search: "cover",
    });

    expect(searchMappedContentMediaMock).toHaveBeenCalledWith({
      client,
      limit: 20,
      mapping,
      search: "cover",
    });
    expect(result).toEqual([
      {
        id: "media-1",
        label: "cover.png",
        metadata: {
          objectPath: "uploads/cover.png",
          url: "https://cdn.example.com/uploads/cover.png",
        },
      },
    ]);
  });

  it("delegates file relation search through the mapped-content collection helper", async () => {
    const mapping = createMappedProjectMapping();
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const client = { query: vi.fn() };

    searchMappedContentFilesMock.mockResolvedValue([
      {
        fileName: "spec.pdf",
        id: "file-1",
        objectPath: "docs/spec.pdf",
        url: "https://files.example.com/docs/spec.pdf",
      },
    ]);

    const result = await adapter.searchFiles?.({
      client,
      limit: 20,
      search: "spec",
    });

    expect(searchMappedContentFilesMock).toHaveBeenCalledWith({
      client,
      limit: 20,
      mapping,
      search: "spec",
    });
    expect(result).toEqual([
      {
        id: "file-1",
        label: "spec.pdf",
        metadata: {
          objectPath: "docs/spec.pdf",
          url: "https://files.example.com/docs/spec.pdf",
        },
      },
    ]);
  });

  it("delegates parent-page relation search through the mapped-content post helper", async () => {
    const mapping = createMappedProjectMapping();
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const client = { query: vi.fn() };

    searchMappedContentParentPagesMock.mockResolvedValue([
      { id: "post-2", slug: "docs", title: "Docs" },
    ]);

    const result = await adapter.searchParentPages?.({
      accessibleAuthorIds: ["author-1"],
      client,
      limit: 20,
      search: "doc",
    });

    expect(searchMappedContentParentPagesMock).toHaveBeenCalledWith({
      accessibleAuthorIds: ["author-1"],
      client,
      limit: 20,
      mapping,
      search: "doc",
    });
    expect(result).toEqual([
      {
        id: "post-2",
        label: "Docs",
        metadata: {
          slug: "docs",
        },
      },
    ]);
  });

  it("delegates collection entry creation through the mapped-content collection helper", async () => {
    const mapping = createMappedProjectMapping();
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const client = { query: vi.fn() };

    createMappedContentCollectionEntryMock.mockResolvedValue({
      id: "category-1",
      name: "News",
      slug: "news",
    });

    await adapter.createCollectionEntry?.({
      client,
      collection: "categories",
      description: "News posts",
      name: "News",
    });

    expect(createMappedContentCollectionEntryMock).toHaveBeenCalledWith({
      client,
      collection: "categories",
      description: "News posts",
      mapping,
      name: "News",
    });
  });

  it("delegates collection entry updates through the mapped-content collection helper", async () => {
    const mapping = createMappedProjectMapping();
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const client = { query: vi.fn() };

    updateMappedContentCollectionEntryMock.mockResolvedValue({
      id: "tag-1",
      name: "Launch",
      slug: "launch",
    });

    await adapter.updateCollectionEntry?.({
      client,
      collection: "tags",
      entryId: "tag-1",
      name: "Launch",
      slug: "launch",
    });

    expect(updateMappedContentCollectionEntryMock).toHaveBeenCalledWith({
      client,
      collection: "tags",
      entryId: "tag-1",
      mapping,
      name: "Launch",
      slug: "launch",
    });
  });

  it("delegates collection entry deletes through the mapped-content collection helper", async () => {
    const mapping = createMappedProjectMapping();
    const adapter = createContentRuntimeAdapter({
      hasFilesS3CompatibleCredentials: false,
      hasS3CompatibleCredentials: false,
      mapping,
    });
    const client = { query: vi.fn() };

    deleteMappedContentCollectionEntriesMock.mockResolvedValue(undefined);

    await adapter.deleteCollectionEntries?.({
      client,
      collection: "authors",
      entryIds: ["author-1", "author-2"],
    });

    expect(deleteMappedContentCollectionEntriesMock).toHaveBeenCalledWith({
      client,
      collection: "authors",
      entryIds: ["author-1", "author-2"],
      mapping,
    });
  });
});
