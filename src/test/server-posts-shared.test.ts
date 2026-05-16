import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  assertContentPostEditSessionAccessMock,
  createContentRuntimeAdapterMock,
  getRequiredContentRuntimeAdapterMethodMock,
  getMappedContentPostAuthorIdMock,
} = vi.hoisted(() => ({
  assertContentPostEditSessionAccessMock: vi.fn(),
  createContentRuntimeAdapterMock: vi.fn(),
  getRequiredContentRuntimeAdapterMethodMock: vi.fn((adapter: Record<string, unknown>, methodName: string) => {
    const method = adapter[methodName];

    if (typeof method !== "function") {
      throw new Error(`Mapped content adapter is missing required method "${methodName}".`);
    }

    return method;
  }),
  getMappedContentPostAuthorIdMock: vi.fn(),
}));

vi.mock("@/lib/content-runtime/adapter/factory", () => ({
  createContentRuntimeAdapter: createContentRuntimeAdapterMock,
  getRequiredContentRuntimeAdapterMethod: getRequiredContentRuntimeAdapterMethodMock,
}));

vi.mock("@/lib/content-runtime/server-post-edit-sessions", () => ({
  assertContentPostEditSessionAccess: assertContentPostEditSessionAccessMock,
}));

import { assertContentPostEditSession } from "@/lib/content-runtime/server-posts-shared";

const createMappingStub = () =>
  ({
    bindingId: "binding",
    bindingMode: "mapped_content",
    bindingStatus: "ready",
    detectedSchemaVersion: null,
    id: "mapping-1",
    installStatus: "installed",
    mappingConfig: {
      entities: {} as never,
      schema: { name: "public" },
    },
    projectId: "project-1",
    revisionId: "revision-1",
    revisionVersion: 1,
    updatedAt: "2026-03-27T00:00:00.000Z",
  }) as unknown;

describe("assertContentPostEditSession", () => {
  afterEach(() => {
    assertContentPostEditSessionAccessMock.mockReset();
    createContentRuntimeAdapterMock.mockReset();
    getRequiredContentRuntimeAdapterMethodMock.mockClear();
    getMappedContentPostAuthorIdMock.mockReset();
  });

  it("reuses a known mapped content author id without reloading author ownership", async () => {
    const client = {
      query: vi.fn(),
    };
    const context = {
      connectionString: "postgres://example",
      memberAccess: {
        authorScopes: [{ cmsAuthorId: "author-1" }],
        permissions: ["project.read", "content.write.authored"],
        roles: [],
      },
      projectId: "project-1",
      projectSlug: "project-one",
      schemaOptions: {
        enableRls: false,
        enableRevisions: true,
        primaryContentFormat: "html" as const,
      },
      user: {
        id: "user-1",
      },
    } as Parameters<typeof assertContentPostEditSession>[0]["context"];
    const dependencies = {
      ensureContentPermission: vi.fn(() => ["author-1"]),
      ensureDirectConnectionForMappedRuntime: vi.fn(),
      getPermissionError: vi.fn(() => "forbidden"),
      getProjectContext: vi.fn(),
      getReadyContentProjectMapping: vi.fn(async () => createMappingStub()),
      withContentDatabaseClient: vi.fn(),
    } as Parameters<typeof assertContentPostEditSession>[0]["dependencies"];

    assertContentPostEditSessionAccessMock.mockImplementationOnce(
      async ({ verifyPostWriteAccess }: { verifyPostWriteAccess: () => Promise<void> }) => {
        await verifyPostWriteAccess();
      },
    );
    createContentRuntimeAdapterMock.mockReturnValue({
      loadPostAuthorId: getMappedContentPostAuthorIdMock,
    });

    await expect(
      assertContentPostEditSession({
        client,
        context,
        dependencies,
        knownAuthorId: "author-1",
        postId: "post-1",
        postTitle: "Post One",
        projectId: "project-1",
      }),
    ).resolves.toBeUndefined();

    expect(assertContentPostEditSessionAccessMock).toHaveBeenCalledTimes(1);
    expect(getMappedContentPostAuthorIdMock).not.toHaveBeenCalled();
    expect(client.query).not.toHaveBeenCalled();
  });
});
