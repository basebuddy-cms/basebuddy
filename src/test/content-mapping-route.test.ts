import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getContentPostRelationOptionsMock,
  getContentPostsPageMock,
  getContentProjectFilesStorageCredentialStatusMock,
  getContentProjectMappingDetectionMock,
  getContentProjectMappingTablesMock,
  getContentProjectMediaStorageCredentialStatusMock,
  getContentProjectSupabaseStorageBucketsMock,
  getStoredContentProjectMappingMock,
  withAuthenticatedProjectRouteMock,
} = vi.hoisted(() => ({
  getContentPostRelationOptionsMock: vi.fn(),
  getContentPostsPageMock: vi.fn(),
  getContentProjectFilesStorageCredentialStatusMock: vi.fn(),
  getContentProjectMappingDetectionMock: vi.fn(),
  getContentProjectMappingTablesMock: vi.fn(),
  getContentProjectMediaStorageCredentialStatusMock: vi.fn(),
  getContentProjectSupabaseStorageBucketsMock: vi.fn(),
  getStoredContentProjectMappingMock: vi.fn(),
  withAuthenticatedProjectRouteMock: vi.fn(
    (
      handler: (
        request: Request,
        context: { projectId: string; user: { id: string } },
      ) => Promise<Response>,
    ) =>
      (request: Request, _routeContext: { params: Promise<{ projectId: string }> }) =>
        handler(request, {
          projectId: "project-1",
          user: { id: "user-1" },
        }),
  ),
}));

vi.mock("@/lib/api/project-api-auth", () => ({
  withAuthenticatedProjectRoute: withAuthenticatedProjectRouteMock,
}));

vi.mock("@/lib/content-runtime/server", () => ({
  acquireContentPostEditSession: vi.fn(),
  createContentCollectionEntry: vi.fn(),
  createContentPost: vi.fn(),
  deleteContentCollectionEntries: vi.fn(),
  deleteContentPosts: vi.fn(),
  discardContentPost: vi.fn(),
  getContentAuthorsPage: vi.fn(),
  getContentCategoriesPage: vi.fn(),
  getContentMediaPage: vi.fn(),
  getContentPostEditorPayload: vi.fn(),
  getContentPostRelationOptions: getContentPostRelationOptionsMock,
  getContentPostRevisions: vi.fn(),
  getContentPostsPage: getContentPostsPageMock,
  getContentPostsPresence: vi.fn(),
  getContentProjectFilesStorageCredentialStatus:
    getContentProjectFilesStorageCredentialStatusMock,
  getContentProjectMapping: vi.fn(),
  getContentProjectMappingDetection: getContentProjectMappingDetectionMock,
  getContentProjectMappingTables: getContentProjectMappingTablesMock,
  getContentProjectMediaStorageCredentialStatus:
    getContentProjectMediaStorageCredentialStatusMock,
  getContentProjectSupabaseStorageBuckets: getContentProjectSupabaseStorageBucketsMock,
  getContentTagsPage: vi.fn(),
  getContentWorkspaceMeta: vi.fn(),
  getContentWorkspaceSummary: vi.fn(),
  getStoredContentProjectMapping: getStoredContentProjectMappingMock,
  heartbeatContentPostEditSession: vi.fn(),
  releaseContentPostEditSession: vi.fn(),
  restoreContentPostRevision: vi.fn(),
  saveContentMappingRevision: vi.fn(),
  updateContentCollectionEntry: vi.fn(),
  updateContentPost: vi.fn(),
}));

import { GET as getContentRoute } from "@/app/api/projects/[projectId]/content/route";
import { createDefaultContentMappingConfig } from "@/lib/content-runtime/mapping";

const createMapping = () => ({
  bindingId: "binding-1",
  bindingMode: "mapped_content" as const,
  bindingStatus: "ready" as const,
  mappingConfig: createDefaultContentMappingConfig(),
  revisionId: "revision-1",
  revisionVersion: 1,
});

describe("content mapping route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getContentProjectFilesStorageCredentialStatusMock.mockResolvedValue({
      hasS3AccessKeyId: false,
      hasS3SecretAccessKey: false,
    });
    getContentProjectMediaStorageCredentialStatusMock.mockResolvedValue({
      hasS3AccessKeyId: false,
      hasS3SecretAccessKey: false,
    });
    getContentProjectSupabaseStorageBucketsMock.mockResolvedValue([]);
  });

  it("returns the saved mapping rather than repaired auto-detected relations", async () => {
    const storedMapping = createMapping();
    storedMapping.mappingConfig.entities.posts.status = "mapped";
    storedMapping.mappingConfig.entities.posts.source = {
      kind: "table",
      primaryKey: "id",
      schema: "public",
      table: "posts",
    };
    storedMapping.mappingConfig.entities.posts.fields.id.column = "id";
    storedMapping.mappingConfig.entities.posts.fields.title.column = "title";

    getStoredContentProjectMappingMock.mockResolvedValue(storedMapping);

    const response = await getContentRoute(
      new Request("http://localhost/api/projects/project-1/content?view=mapping"),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(200);

    const payload = await response.json();

    expect(getStoredContentProjectMappingMock).toHaveBeenCalledWith("project-1");
    expect(payload.mappingConfig.entities.categories.status).toBe("unmapped");
    expect(payload.mappingConfig.entities.posts.relations.categories.status).toBe("unmapped");
  });

  it("routes relation option reads through the dedicated relation options server action", async () => {
    getContentPostRelationOptionsMock.mockResolvedValue([
      { id: "tag-1", label: "Launch" },
    ]);

    const response = await getContentRoute(
      new Request(
        "http://localhost/api/projects/project-1/content?view=relation_options&fieldKey=tags&search=lau&limit=25",
      ),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(getContentPostRelationOptionsMock).toHaveBeenCalledWith({
      fieldKey: "tags",
      limit: 25,
      projectId: "project-1",
      search: "lau",
      selectedIds: [],
    });
    await expect(response.json()).resolves.toEqual([
      { id: "tag-1", label: "Launch" },
    ]);
  });

  it("accepts custom relation field keys for relation option reads", async () => {
    getContentPostRelationOptionsMock.mockResolvedValue([
      { id: "author-2", label: "Sponsor Author" },
    ]);

    const response = await getContentRoute(
      new Request(
        "http://localhost/api/projects/project-1/content?view=relation_options&fieldKey=custom_field:sponsor_author_id&search=sponsor&limit=25",
      ),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(getContentPostRelationOptionsMock).toHaveBeenCalledWith({
      fieldKey: "custom_field:sponsor_author_id",
      limit: 25,
      projectId: "project-1",
      search: "sponsor",
      selectedIds: [],
    });
    await expect(response.json()).resolves.toEqual([
      { id: "author-2", label: "Sponsor Author" },
    ]);
  });

  it("passes selected table refs through to mapping detection", async () => {
    getContentProjectMappingDetectionMock.mockResolvedValue({
      candidates: {
        authors: [],
        categories: [],
        files: [],
        media: [],
        posts: [],
        tags: [],
      },
      generatedAt: "2026-04-21T00:00:00.000Z",
      suggestedMappingConfig: {
        entities: createDefaultContentMappingConfig().entities,
      },
      tables: [],
    });

    const response = await getContentRoute(
      new Request(
        "http://localhost/api/projects/project-1/content?view=mapping_detection&tableRef=public.posts",
      ),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(getContentProjectMappingDetectionMock).toHaveBeenCalledWith("project-1", {
      tableRef: "public.posts",
    });
  });

  it("routes mapping table catalog reads through the dedicated server action", async () => {
    getContentProjectMappingTablesMock.mockResolvedValue([
      {
        columnCount: 12,
        kind: "table",
        primaryKey: "id",
        rowCountEstimate: 42,
        schema: "public",
        table: "posts",
        tableRef: "public.posts",
      },
    ]);

    const response = await getContentRoute(
      new Request("http://localhost/api/projects/project-1/content?view=mapping_tables"),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(getContentProjectMappingTablesMock).toHaveBeenCalledWith("project-1", {
      refresh: false,
    });
    await expect(response.json()).resolves.toEqual({
      tables: [
        {
          columnCount: 12,
          kind: "table",
          primaryKey: "id",
          rowCountEstimate: 42,
          schema: "public",
          table: "posts",
          tableRef: "public.posts",
        },
      ],
    });
  });

  it("allows users to explicitly refresh the mapping table catalog cache", async () => {
    getContentProjectMappingTablesMock.mockResolvedValue([]);

    const response = await getContentRoute(
      new Request("http://localhost/api/projects/project-1/content?view=mapping_tables&refresh=true"),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(getContentProjectMappingTablesMock).toHaveBeenCalledWith("project-1", {
      refresh: true,
    });
  });

  it("passes projection cursor tokens through posts page reads", async () => {
    getContentPostsPageMock.mockResolvedValue({
      authors: [],
      categories: [],
      editorOptionsState: "warm",
      pagination: {
        hasNextPage: false,
        nextCursor: null,
        page: 3,
        pageSize: 20,
        totalItems: 50_000,
        totalItemsExact: false,
        totalPages: 3,
      },
      posts: [],
      tags: [],
    });

    const response = await getContentRoute(
      new Request(
        "http://localhost/api/projects/project-1/content?view=posts&page=3&pageSize=20&cursor=cursor-token&sort=title_asc",
      ),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(getContentPostsPageMock).toHaveBeenCalledWith({
      cursor: "cursor-token",
      page: 3,
      pageSize: 20,
      projectId: "project-1",
      search: "",
      sort: "title_asc",
      status: "all",
    });
  });
});
