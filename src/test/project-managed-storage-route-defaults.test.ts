import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getContentFilesLibraryMock,
  getContentMediaLibraryMock,
  withAuthenticatedProjectRouteMock,
} = vi.hoisted(() => ({
  getContentFilesLibraryMock: vi.fn(),
  getContentMediaLibraryMock: vi.fn(),
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
  getContentFilesLibrary: getContentFilesLibraryMock,
  getContentMediaLibrary: getContentMediaLibraryMock,
}));

import { GET as getFilesRoute } from "@/app/api/projects/[projectId]/files/route";
import { GET as getMediaRoute } from "@/app/api/projects/[projectId]/media/route";

describe("managed storage route defaults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getContentMediaLibraryMock.mockResolvedValue({
      breadcrumbs: [],
      bucketName: "bucket",
      canManage: true,
      currentPath: "",
      folderOptions: [],
      folders: [],
      images: [],
      search: "",
      urlExpiresAt: "2026-03-28T00:00:00.000Z",
    });
    getContentFilesLibraryMock.mockResolvedValue({
      breadcrumbs: [],
      bucketName: "bucket",
      canManage: true,
      currentPath: "",
      fileCount: 0,
      files: [],
      folderOptions: [],
      folders: [],
      search: "",
      urlExpiresAt: "2026-03-28T00:00:00.000Z",
    });
  });

  it("defaults media browsing to the lighter list payload", async () => {
    const response = await getMediaRoute(new Request("http://localhost/api/projects/project-1/media"), {
      params: Promise.resolve({ projectId: "project-1" }),
    });

    expect(response.status).toBe(200);
    expect(getContentMediaLibraryMock).toHaveBeenCalledWith({
      currentPath: null,
      cursor: null,
      includeFolderOptions: false,
      projectId: "project-1",
      search: null,
    });
  });

  it("defaults files browsing to the lighter list payload", async () => {
    const response = await getFilesRoute(new Request("http://localhost/api/projects/project-1/files"), {
      params: Promise.resolve({ projectId: "project-1" }),
    });

    expect(response.status).toBe(200);
    expect(getContentFilesLibraryMock).toHaveBeenCalledWith({
      currentPath: null,
      cursor: null,
      includeFolderOptions: false,
      projectId: "project-1",
      search: null,
    });
  });
});
