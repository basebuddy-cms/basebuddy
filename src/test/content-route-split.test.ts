import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getContentAuthorsPage,
  getContentCategoriesPage,
  getAuthenticatedApiRequestContext,
  getContentPostEditorPayload,
  getContentPostRevisions,
  getContentPostsPage,
  getContentTagsPage,
  getContentRuntimeRequestMetricsSnapshot,
  getContentRuntimeRequestServerTimingHeader,
  getContentWorkspaceMeta,
  getContentProjectContext,
  getBaseBuddyConfigSetupStatus,
  logSlowContentRuntimeRequest,
  measureContentRuntimeRequestSpan,
  pushContentRuntimeRequestSpan,
  runWithContentRuntimeRequestMetrics,
  setContentRuntimeRequestMetric,
  isBaseBuddyConfigSetupReady,
} = vi.hoisted(() => ({
  getContentAuthorsPage: vi.fn(),
  getContentCategoriesPage: vi.fn(),
  getAuthenticatedApiRequestContext: vi.fn(),
  getContentPostEditorPayload: vi.fn(),
  getContentPostRevisions: vi.fn(),
  getContentPostsPage: vi.fn(),
  getContentTagsPage: vi.fn(),
  getContentRuntimeRequestMetricsSnapshot: vi.fn(),
  getContentRuntimeRequestServerTimingHeader: vi.fn(),
  getContentWorkspaceMeta: vi.fn(),
  getContentProjectContext: vi.fn(),
  getBaseBuddyConfigSetupStatus: vi.fn(),
  logSlowContentRuntimeRequest: vi.fn(),
  measureContentRuntimeRequestSpan: vi.fn(async (_name: string, work: () => Promise<unknown>) => work()),
  pushContentRuntimeRequestSpan: vi.fn(),
  runWithContentRuntimeRequestMetrics: vi.fn(async ({ work }: { work: () => Promise<Response> }) => work()),
  setContentRuntimeRequestMetric: vi.fn(),
  isBaseBuddyConfigSetupReady: vi.fn(),
}));

vi.mock("@/lib/control-plane/server", () => ({
  getAuthenticatedApiRequestContext,
}));

vi.mock("@/lib/basebuddy-config/setup", () => ({
  getBaseBuddyConfigSetupStatus,
  isBaseBuddyConfigSetupReady,
}));

vi.mock("@/lib/content-runtime/server", () => ({
  getContentAuthorsPage,
  getContentCategoriesPage,
  getContentPostEditorPayload,
  getContentPostRevisions,
  getContentPostsPage,
  getContentTagsPage,
  getContentWorkspaceMeta,
}));

vi.mock("@/lib/content-runtime/server-project-context", () => ({
  getContentProjectContext,
}));

vi.mock("@/lib/content-runtime/request-observability", () => ({
  getContentRuntimeRequestMetricsSnapshot,
  getContentRuntimeRequestServerTimingHeader,
  logSlowContentRuntimeRequest,
  measureContentRuntimeRequestSpan,
  pushContentRuntimeRequestSpan,
  runWithContentRuntimeRequestMetrics,
  setContentRuntimeRequestMetric,
}));

import { GET as getContentAuthorsRoute } from "@/app/api/projects/[projectId]/content/authors/route";
import { GET as getContentCategoriesRoute } from "@/app/api/projects/[projectId]/content/categories/route";
import { GET as getContentPostRoute } from "@/app/api/projects/[projectId]/content/posts/[postId]/route";
import { GET as getContentPostsRoute } from "@/app/api/projects/[projectId]/content/posts/route";
import { GET as getContentTagsRoute } from "@/app/api/projects/[projectId]/content/tags/route";
import { GET as getContentWorkspaceRoute } from "@/app/api/projects/[projectId]/content/workspace/route";

describe("content split routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getAuthenticatedApiRequestContext).mockResolvedValue({
      account: {
        avatarUrl: null,
        email: "owner@example.com",
        name: "Owner",
      },
      ok: true,
      user: {
        id: "user-1",
      },
    } as never);
    vi.mocked(getBaseBuddyConfigSetupStatus).mockResolvedValue({
      configPath: "/repo/basebuddy-data/basebuddy.config.json",
      sections: [],
      topology: "config-file",
    } as never);
    vi.mocked(isBaseBuddyConfigSetupReady).mockReturnValue(true);
    vi.mocked(getContentProjectContext).mockResolvedValue({
    } as never);
    vi.mocked(getContentRuntimeRequestServerTimingHeader).mockReturnValue("auth;dur=1,handler;dur=2,total;dur=3");
    vi.mocked(getContentRuntimeRequestMetricsSnapshot).mockReturnValue({
      metadata: {
        cacheState: "fresh",
        scopeKey: "content.workspace",
      },
      spans: [],
      totalDurationMs: 3,
    } as never);
  });

  it("serves workspace bootstrap from the dedicated workspace route", async () => {
    vi.mocked(getContentWorkspaceMeta).mockResolvedValue({
      capabilities: {
        canManageAuthors: true,
        canManageTaxonomy: true,
      },
      counts: {
        authors: 2,
        categories: 3,
        files: 4,
        media: 5,
        posts: 6,
        tags: 7,
      },
      contentRuntime: null,
      primaryContentFormat: "html",
      workspaceState: "ready",
      workspaceSummary: {
        counts: {
          authors: 2,
          categories: 3,
          files: 4,
          media: 5,
          posts: 6,
          tags: 7,
        },
        isDerived: false,
        isExact: true,
        pendingCollections: [],
        refreshedAt: "2026-03-27T12:00:00.000Z",
      },
    } as never);

    const response = await getContentWorkspaceRoute(
      new Request("http://localhost/api/projects/project-1/content/workspace"),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      workspaceState: "ready",
    });
    expect(response.headers.get("Server-Timing")).toContain("auth;dur=");
    expect(getContentWorkspaceMeta).toHaveBeenCalledWith("project-1");
  });

  it("serves posts pages from the dedicated posts route", async () => {
    vi.mocked(getContentPostsPage).mockResolvedValue({
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
    } as never);

    const response = await getContentPostsRoute(
      new Request(
        "http://localhost/api/projects/project-1/content/posts?page=1&pageSize=10&search=Draft&sort=updated_desc&status=all",
      ),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      pagination: {
        page: 1,
        pageSize: 10,
      },
    });
    expect(response.headers.get("Server-Timing")).toContain("handler;dur=");
    expect(getContentPostsPage).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      projectId: "project-1",
      search: "Draft",
      sort: "updated_desc",
      status: "all",
    });
  });

  it("serves single-post editor payloads from the dedicated post route", async () => {
    vi.mocked(getContentPostEditorPayload).mockResolvedValue({
      authors: [],
      categories: [],
      editorOptionsState: "warm",
      post: {
        authorId: null,
        categoryIds: [],
        contentFields: {},
        contentFormat: "html",
        contentHtml: "",
        contentJson: {},
        contentMarkdown: null,
        createdAt: "2026-03-27T12:00:00.000Z",
        customFields: {},
        excerpt: null,
        featuredImageUrl: null,
        focusKeyword: null,
        id: "post-1",
        publishedAt: null,
        seoDescription: null,
        seoTitle: null,
        slug: "hello-world",
        status: "draft",
        tagIds: [],
        title: "Hello world",
        updatedAt: "2026-03-27T12:00:00.000Z",
      },
      tags: [],
    } as never);

    const response = await getContentPostRoute(
      new Request("http://localhost/api/projects/project-1/content/posts/post-1?includeEditorOptions=false"),
      {
        params: Promise.resolve({ postId: "post-1", projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      post: {
        id: "post-1",
      },
    });
    expect(response.headers.get("Server-Timing")).toContain("total;dur=");
    expect(getContentPostEditorPayload).toHaveBeenCalledWith({
      includeEditorOptions: false,
      postId: "post-1",
      projectId: "project-1",
    });
  });

  it("serves categories pages from the dedicated categories route", async () => {
    vi.mocked(getContentCategoriesPage).mockResolvedValue({
      items: [],
      pagination: {
        hasNextPage: false,
        hasPreviousPage: false,
        page: 1,
        pageSize: 10,
        totalItems: 0,
        totalItemsExact: true,
        totalPages: 1,
      },
    } as never);

    const response = await getContentCategoriesRoute(
      new Request(
        "http://localhost/api/projects/project-1/content/categories?page=1&pageSize=10&includeAllCategories=false&search=Launch",
      ),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(getContentCategoriesPage).toHaveBeenCalledWith({
      includeAllCategories: false,
      page: 1,
      pageSize: 10,
      projectId: "project-1",
      search: "Launch",
    });
  });

  it("defaults dedicated categories pages to the lighter paged payload when the hierarchy flag is omitted", async () => {
    vi.mocked(getContentCategoriesPage).mockResolvedValue({
      items: [],
      pagination: {
        hasNextPage: false,
        hasPreviousPage: false,
        page: 1,
        pageSize: 10,
        totalItems: 0,
        totalItemsExact: true,
        totalPages: 1,
      },
    } as never);

    const response = await getContentCategoriesRoute(
      new Request("http://localhost/api/projects/project-1/content/categories?page=1&pageSize=10"),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(getContentCategoriesPage).toHaveBeenCalledWith({
      includeAllCategories: false,
      page: 1,
      pageSize: 10,
      projectId: "project-1",
      search: "",
    });
  });

  it("serves tags pages from the dedicated tags route", async () => {
    vi.mocked(getContentTagsPage).mockResolvedValue({
      items: [],
      pagination: {
        hasNextPage: false,
        hasPreviousPage: false,
        page: 1,
        pageSize: 10,
        totalItems: 0,
        totalItemsExact: true,
        totalPages: 1,
      },
    } as never);

    const response = await getContentTagsRoute(
      new Request("http://localhost/api/projects/project-1/content/tags?page=1&pageSize=10&search=Launch"),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(getContentTagsPage).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      projectId: "project-1",
      search: "Launch",
    });
  });

  it("serves authors pages from the dedicated authors route", async () => {
    vi.mocked(getContentAuthorsPage).mockResolvedValue({
      items: [],
      pagination: {
        hasNextPage: false,
        hasPreviousPage: false,
        page: 1,
        pageSize: 10,
        totalItems: 0,
        totalItemsExact: true,
        totalPages: 1,
      },
    } as never);

    const response = await getContentAuthorsRoute(
      new Request("http://localhost/api/projects/project-1/content/authors?page=1&pageSize=10&search=Ada"),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(getContentAuthorsPage).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      projectId: "project-1",
      search: "Ada",
    });
  });

  it("preserves the auth failure response shape on the dedicated workspace route", async () => {
    vi.mocked(getAuthenticatedApiRequestContext).mockResolvedValue({
      errorMessage: "Please sign in to continue.",
      ok: false,
      status: 401,
      user: null,
    } as never);

    const response = await getContentWorkspaceRoute(
      new Request("http://localhost/api/projects/project-1/content/workspace"),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Please sign in to continue.",
    });
    expect(response.headers.get("Server-Timing")).toContain("auth;dur=");
  });
});
