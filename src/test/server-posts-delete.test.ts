import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

const {
  createMappedContentPostMock,
  deleteMappedContentPostsMock,
  discardMappedContentPostMock,
  getMappedContentPostEditorPayloadMock,
  getMappedContentPostsPageMock,
  updateMappedContentPostMock,
} = vi.hoisted(() => ({
  createMappedContentPostMock: vi.fn(),
  deleteMappedContentPostsMock: vi.fn(),
  discardMappedContentPostMock: vi.fn(),
  getMappedContentPostEditorPayloadMock: vi.fn(),
  getMappedContentPostsPageMock: vi.fn(),
  updateMappedContentPostMock: vi.fn(),
}));

vi.mock("@/lib/content-runtime/server-posts-mapped-content", () => ({
  createMappedContentPost: createMappedContentPostMock,
  deleteMappedContentPosts: deleteMappedContentPostsMock,
  discardMappedContentPost: discardMappedContentPostMock,
  getMappedContentPostEditorPayload: getMappedContentPostEditorPayloadMock,
  getMappedContentPostsPage: getMappedContentPostsPageMock,
  updateMappedContentPost: updateMappedContentPostMock,
}));

import type {
  ContentProjectContext,
} from "@/lib/content-runtime/server-posts-shared";
import type {
  ContentPostsDependencies,
} from "@/lib/content-runtime/server-posts-shared";
import { deleteContentPosts } from "@/lib/content-runtime/server-posts";

const createDependencies = () =>
  {
    const context: ContentProjectContext = {
      connectionString: "postgres://example.test/db",
      memberAccess: {
        authorScopes: [],
        permissions: ["content.read.all", "content.write.all"],
        roles: ["owner"],
      },
      projectId: "project-1",
      projectSlug: "demo-project",
      schemaOptions: {
        enableRls: false,
        enableRevisions: true,
        primaryContentFormat: "html",
      },
      user: { id: "user-1" } as ContentProjectContext["user"],
    };

    return {
    ensureContentPermission: vi.fn(),
    ensureDirectConnectionForMappedRuntime: vi.fn(),
    getPermissionError: vi.fn(),
    getProjectContext: vi.fn(async (_projectId: string) => context),
    getReadyContentProjectMapping: vi.fn(),
    withContentDatabaseClient: vi.fn(),
  } as unknown as ContentPostsDependencies;
  };

describe("deleteContentPosts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes mapped-content deletes through the mapped-content implementation", async () => {
    const dependencies = createDependencies();

    await deleteContentPosts({
      dependencies,
      postIds: ["post-1", "post-2"],
      projectId: "project-1",
    });

    expect(deleteMappedContentPostsMock).toHaveBeenCalledWith({
      context: await dependencies.getProjectContext("project-1"),
      dependencies,
      postIds: ["post-1", "post-2"],
      projectId: "project-1",
    });
  });

});
