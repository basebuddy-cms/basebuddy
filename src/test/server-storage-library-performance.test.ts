import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getContentFilesLibraryContextMock,
  getContentManagedMediaFolderPathsMock,
  getContentManagedMediaObjectsMock,
  getContentManagedMediaUrlsMock,
  getContentMediaLibraryContextMock,
} = vi.hoisted(() => ({
  getContentFilesLibraryContextMock: vi.fn(),
  getContentManagedMediaFolderPathsMock: vi.fn(),
  getContentManagedMediaObjectsMock: vi.fn(),
  getContentManagedMediaUrlsMock: vi.fn(),
  getContentMediaLibraryContextMock: vi.fn(),
}));

vi.mock("@/lib/content-runtime/server-media-context", () => ({
  getContentMediaLibraryContext: getContentMediaLibraryContextMock,
}));

vi.mock("@/lib/content-runtime/server-files-context", () => ({
  getContentFilesLibraryContext: getContentFilesLibraryContextMock,
}));

vi.mock("@/lib/content-runtime/server-media-shared", () => ({
  getContentManagedMediaFolderPaths: getContentManagedMediaFolderPathsMock,
  getContentManagedMediaObjects: getContentManagedMediaObjectsMock,
  getContentManagedMediaUrls: getContentManagedMediaUrlsMock,
}));

import { getContentFilesLibrary } from "@/lib/content-runtime/server-files-library";
import { getContentMediaLibrary } from "@/lib/content-runtime/server-media-library";

const createStorageContext = () => ({
  bucketName: "assets",
  canManage: true,
  context: {
    connectionString: "postgresql://content",
  },
  provider: "supabase_bucket",
  publicObjectUrlBase: null,
  s3Storage: null,
  signedUrlExpiresAt: "2026-03-10T12:00:00.000Z",
  storage: {},
  usePublicObjectUrls: false,
});

describe("server storage library performance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getContentManagedMediaUrlsMock.mockResolvedValue(
      new Map([
        ["campaigns/hero.png", "https://cdn.example.com/campaigns/hero.png"],
        ["docs/spec.pdf", "https://cdn.example.com/docs/spec.pdf"],
      ]),
    );
    getContentManagedMediaFolderPathsMock.mockResolvedValue([]);
  });

  it("passes path/search limits to media storage and signs only visible media", async () => {
    const mediaContext = createStorageContext();

    getContentMediaLibraryContextMock.mockResolvedValue(mediaContext);
    getContentManagedMediaObjectsMock.mockResolvedValue([
      {
        createdAt: "2026-03-10T10:00:00.000Z",
        id: "image-1",
        metadata: { mimetype: "image/png" },
        objectPath: "campaigns/hero.png",
        updatedAt: null,
      },
      {
        createdAt: "2026-03-10T10:00:00.000Z",
        id: "image-2",
        metadata: { mimetype: "image/png" },
        objectPath: "campaigns/archive/old.png",
        updatedAt: null,
      },
    ]);

    await getContentMediaLibrary({
      currentPath: "campaigns",
      dependencies: {} as never,
      projectId: "project-1",
      search: "hero",
    });

    expect(getContentManagedMediaObjectsMock).toHaveBeenCalledWith({
      currentPath: "campaigns",
      cursor: null,
      dependencies: {},
      limit: 251,
      mediaContext,
      search: "hero",
    });
    expect(getContentManagedMediaUrlsMock).toHaveBeenCalledWith({
      mediaContext,
      objectPaths: ["campaigns/hero.png"],
    });
  });

  it("returns a next cursor for paginated media storage pages", async () => {
    const mediaContext = createStorageContext();
    const records = Array.from({ length: 251 }, (_, index) => ({
      createdAt: "2026-03-10T10:00:00.000Z",
      id: `image-${index}`,
      metadata: { mimetype: "image/png" },
      objectPath: `campaigns/image-${String(index).padStart(3, "0")}.png`,
      updatedAt: null,
    }));

    getContentMediaLibraryContextMock.mockResolvedValue(mediaContext);
    getContentManagedMediaObjectsMock.mockResolvedValue(records);
    getContentManagedMediaUrlsMock.mockResolvedValue(new Map());

    const library = await getContentMediaLibrary({
      currentPath: "campaigns",
      dependencies: {} as never,
      projectId: "project-1",
    });

    expect(getContentManagedMediaObjectsMock).toHaveBeenCalledWith({
      currentPath: "campaigns",
      cursor: null,
      dependencies: {},
      limit: 251,
      mediaContext,
      search: undefined,
    });
    expect(library.images).toHaveLength(250);
    expect(library.nextCursor).toBe("campaigns/image-249.png");
    expect(getContentManagedMediaUrlsMock).toHaveBeenCalledWith({
      mediaContext,
      objectPaths: records.slice(0, 250).map((record) => record.objectPath),
    });
  });

  it("loads media folders through a folder-only strategy", async () => {
    const mediaContext = createStorageContext();

    getContentMediaLibraryContextMock.mockResolvedValue(mediaContext);
    getContentManagedMediaObjectsMock.mockResolvedValue([]);
    getContentManagedMediaFolderPathsMock.mockResolvedValue(["campaigns/launch", "campaigns/archive"]);
    getContentManagedMediaUrlsMock.mockResolvedValue(new Map());

    const library = await getContentMediaLibrary({
      currentPath: "campaigns",
      dependencies: {} as never,
      projectId: "project-1",
    });

    expect(getContentManagedMediaFolderPathsMock).toHaveBeenCalledWith({
      currentPath: "campaigns",
      dependencies: {},
      limit: 200,
      mediaContext,
    });
    expect(library.folders.map((folder) => folder.path)).toEqual([
      "campaigns/archive",
      "campaigns/launch",
    ]);
  });

  it("passes path/search limits to files storage and signs only visible files", async () => {
    const filesContext = createStorageContext();

    getContentFilesLibraryContextMock.mockResolvedValue(filesContext);
    getContentManagedMediaObjectsMock.mockResolvedValue([
      {
        createdAt: "2026-03-10T10:00:00.000Z",
        id: "file-1",
        metadata: { mimetype: "application/pdf" },
        objectPath: "docs/spec.pdf",
        updatedAt: null,
      },
      {
        createdAt: "2026-03-10T10:00:00.000Z",
        id: "image-1",
        metadata: { mimetype: "image/png" },
        objectPath: "docs/diagram.png",
        updatedAt: null,
      },
    ]);

    await getContentFilesLibrary({
      currentPath: "docs",
      dependencies: {} as never,
      projectId: "project-1",
      search: "spec",
    });

    expect(getContentManagedMediaObjectsMock).toHaveBeenCalledWith({
      currentPath: "docs",
      cursor: null,
      dependencies: {},
      limit: 251,
      mediaContext: filesContext,
      search: "spec",
    });
    expect(getContentManagedMediaUrlsMock).toHaveBeenCalledWith({
      mediaContext: filesContext,
      objectPaths: ["docs/spec.pdf"],
    });
  });

  it("returns a next cursor for paginated files storage pages", async () => {
    const filesContext = createStorageContext();
    const records = Array.from({ length: 251 }, (_, index) => ({
      createdAt: "2026-03-10T10:00:00.000Z",
      id: `file-${index}`,
      metadata: { mimetype: "application/pdf" },
      objectPath: `docs/file-${String(index).padStart(3, "0")}.pdf`,
      updatedAt: null,
    }));

    getContentFilesLibraryContextMock.mockResolvedValue(filesContext);
    getContentManagedMediaObjectsMock.mockResolvedValue(records);
    getContentManagedMediaUrlsMock.mockResolvedValue(new Map());

    const library = await getContentFilesLibrary({
      currentPath: "docs",
      dependencies: {} as never,
      projectId: "project-1",
    });

    expect(getContentManagedMediaObjectsMock).toHaveBeenCalledWith({
      currentPath: "docs",
      cursor: null,
      dependencies: {},
      limit: 251,
      mediaContext: filesContext,
      search: undefined,
    });
    expect(library.files).toHaveLength(250);
    expect(library.nextCursor).toBe("docs/file-249.pdf");
  });

  it("loads file folders through a folder-only strategy", async () => {
    const filesContext = createStorageContext();

    getContentFilesLibraryContextMock.mockResolvedValue(filesContext);
    getContentManagedMediaObjectsMock.mockResolvedValue([]);
    getContentManagedMediaFolderPathsMock.mockResolvedValue(["docs/specs", "docs/contracts"]);
    getContentManagedMediaUrlsMock.mockResolvedValue(new Map());

    const library = await getContentFilesLibrary({
      currentPath: "docs",
      dependencies: {} as never,
      projectId: "project-1",
    });

    expect(getContentManagedMediaFolderPathsMock).toHaveBeenCalledWith({
      currentPath: "docs",
      dependencies: {},
      limit: 200,
      mediaContext: filesContext,
    });
    expect(library.folders.map((folder) => folder.path)).toEqual([
      "docs/contracts",
      "docs/specs",
    ]);
  });
});
