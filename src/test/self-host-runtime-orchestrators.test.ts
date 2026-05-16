import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

const {
  mappedContentPostHandlers,
  mappedContentWorkspaceHandlers,
} = vi.hoisted(() => ({
  mappedContentPostHandlers: {
    archiveMappedContentPost: vi.fn(),
    createMappedContentPost: vi.fn(),
    deleteMappedContentPosts: vi.fn(),
    discardMappedContentPost: vi.fn(),
    getMappedContentPostEditorPayload: vi.fn(),
    getMappedContentPostsPage: vi.fn(),
    getMappedContentRelationOptions: vi.fn(),
    publishMappedContentPost: vi.fn(),
    unpublishMappedContentPost: vi.fn(),
    updateMappedContentPost: vi.fn(),
  },
  mappedContentWorkspaceHandlers: {
    getContentSnapshotForMappedContent: vi.fn(),
    getContentWorkspaceMetaForMappedContent: vi.fn(),
    getContentWorkspaceSummaryForMappedContent: vi.fn(),
  },
}));

vi.mock("@/lib/content-runtime/server-workspace-mapped-content", () => mappedContentWorkspaceHandlers);
vi.mock("@/lib/content-runtime/server-posts-mapped-content", () => mappedContentPostHandlers);

const createUnsupportedRuntimeContext = () => ({
  apiUrl: "https://install.supabase.co",
  connectionString: "postgresql://install",
  memberAccess: {
    authorScopes: [],
    permissions: ["content.read.all", "content.write.all"],
    roles: ["owner"],
  },
  projectId: "project-1",
  projectSlug: "demo",
  publishableKey: "sb_publishable_test",
  schemaOptions: {
    enableRevisions: true,
    enableRls: true,
    primaryContentFormat: "html" as const,
  },
  user: {
    id: "user-1",
  },
});

const createRevisionDependencies = () => ({
  ensureDirectConnectionForMappedRuntime: vi.fn(),
  getContentPermissionError: vi.fn(() => "Permission denied."),
  getPostById: vi.fn(),
  getProjectContext: vi.fn().mockResolvedValue(createUnsupportedRuntimeContext()),
  updatePost: vi.fn(),
  withContentDatabaseClient: vi.fn(),
});

describe("self-host runtime orchestrators", () => {
  it("keeps the supported content orchestrator free of one-click runtime signatures", () => {
    const serverSource = readFileSync(
      join(process.cwd(), "src", "lib", "content-runtime", "server.ts"),
      "utf8",
    );

    expect(serverSource).not.toContain("getOneClickWorkspaceRuntimeSignature");
    expect(serverSource).not.toContain("server-workspace-one-click");
  });

  it("does not serve or restore unsupported runtime post revisions", async () => {
    const {
      getContentPostRevisions,
      restoreContentPostRevision,
    } = await import("@/lib/content-runtime/server-post-revisions");
    const dependencies = createRevisionDependencies();
    const expectedError = "Post revisions are not supported for this project yet.";

    await expect(
      getContentPostRevisions({
        dependencies,
        postId: "post-1",
        projectId: "project-1",
      }),
    ).rejects.toThrow(expectedError);
    await expect(
      restoreContentPostRevision({
        dependencies,
        postId: "post-1",
        projectId: "project-1",
        revisionNumber: 1,
      }),
    ).rejects.toThrow(expectedError);

    expect(dependencies.ensureDirectConnectionForMappedRuntime).not.toHaveBeenCalled();
    expect(dependencies.withContentDatabaseClient).not.toHaveBeenCalled();
    expect(dependencies.updatePost).not.toHaveBeenCalled();
  });

});
