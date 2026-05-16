import { describe, expect, it } from "vitest";

import {
  buildContentFilesLibrary,
  buildContentMediaLibrary,
  CONTENT_MEDIA_FOLDER_MARKER,
  normalizeContentMediaPath,
} from "@/lib/content-runtime/media-library";

describe("content media library", () => {
  it("normalizes folder paths", () => {
    expect(normalizeContentMediaPath("/campaigns//summer/")).toBe("campaigns/summer");
    expect(normalizeContentMediaPath("")).toBe("");
  });

  it("builds folders and images for the current path", () => {
    const library = buildContentMediaLibrary({
      bucketName: "demo-media",
      canManage: true,
      currentPath: "",
      publicUrlForPath: (path) => `https://cdn.example.com/${path}`,
      records: [
        {
          createdAt: "2026-03-10T10:00:00.000Z",
          id: "folder-marker",
          metadata: null,
          objectPath: `campaigns/${CONTENT_MEDIA_FOLDER_MARKER}`,
          updatedAt: null,
        },
        {
          createdAt: "2026-03-10T10:05:00.000Z",
          id: "image-1",
          metadata: { mimetype: "image/png", size: 2048 },
          objectPath: "campaigns/hero.png",
          updatedAt: null,
        },
        {
          createdAt: "2026-03-10T11:00:00.000Z",
          id: "image-2",
          metadata: { mimetype: "image/jpeg", size: 1024 },
          objectPath: "cover.jpg",
          updatedAt: null,
        },
      ],
      search: "",
      urlExpiresAt: "2026-03-10T11:00:00.000Z",
    });

    expect(library.folders).toHaveLength(1);
    expect(library.folders[0]?.path).toBe("campaigns");
    expect(library.images).toHaveLength(1);
    expect(library.images[0]?.objectPath).toBe("cover.jpg");
  });

  it("searches images within the current folder scope", () => {
    const library = buildContentMediaLibrary({
      bucketName: "demo-media",
      canManage: false,
      currentPath: "campaigns",
      publicUrlForPath: (path) => `https://cdn.example.com/${path}`,
      records: [
        {
          createdAt: "2026-03-10T10:05:00.000Z",
          id: "image-1",
          metadata: { mimetype: "image/png", size: 2048 },
          objectPath: "campaigns/hero.png",
          updatedAt: null,
        },
        {
          createdAt: "2026-03-10T11:00:00.000Z",
          id: "image-2",
          metadata: { mimetype: "image/jpeg", size: 1024 },
          objectPath: "campaigns/archive/hero-old.jpg",
          updatedAt: null,
        },
        {
          createdAt: "2026-03-10T12:00:00.000Z",
          id: "image-3",
          metadata: { mimetype: "image/jpeg", size: 1024 },
          objectPath: "outside-folder.jpg",
          updatedAt: null,
        },
      ],
      search: "hero",
      urlExpiresAt: "2026-03-10T13:00:00.000Z",
    });

    expect(library.folders).toEqual([]);
    expect(library.images.map((image) => image.objectPath)).toEqual([
      "campaigns/archive/hero-old.jpg",
      "campaigns/hero.png",
    ]);
  });

  it("builds folders and files without mixing in images", () => {
    const library = buildContentFilesLibrary({
      bucketName: "demo-assets",
      canManage: true,
      currentPath: "",
      publicUrlForPath: (path) => `https://cdn.example.com/${path}`,
      records: [
        {
          createdAt: "2026-03-10T10:00:00.000Z",
          id: "folder-marker",
          metadata: null,
          objectPath: `documents/${CONTENT_MEDIA_FOLDER_MARKER}`,
          updatedAt: null,
        },
        {
          createdAt: "2026-03-10T10:05:00.000Z",
          id: "doc-1",
          metadata: { mimetype: "application/pdf", size: 4096 },
          objectPath: "documents/spec.pdf",
          updatedAt: null,
        },
        {
          createdAt: "2026-03-10T11:00:00.000Z",
          id: "image-1",
          metadata: { mimetype: "image/png", size: 1024 },
          objectPath: "documents/diagram.png",
          updatedAt: null,
        },
      ],
      search: "",
      urlExpiresAt: "2026-03-10T12:00:00.000Z",
    });

    expect(library.folders).toHaveLength(1);
    expect(library.folders[0]?.path).toBe("documents");
    expect(library.files).toHaveLength(0);

    const documentsLibrary = buildContentFilesLibrary({
      bucketName: "demo-assets",
      canManage: true,
      currentPath: "documents",
      publicUrlForPath: (path) => `https://cdn.example.com/${path}`,
      records: [
        {
          createdAt: "2026-03-10T10:05:00.000Z",
          id: "doc-1",
          metadata: { mimetype: "application/pdf", size: 4096 },
          objectPath: "documents/spec.pdf",
          updatedAt: null,
        },
        {
          createdAt: "2026-03-10T11:00:00.000Z",
          id: "image-1",
          metadata: { mimetype: "image/png", size: 1024 },
          objectPath: "documents/diagram.png",
          updatedAt: null,
        },
      ],
      search: "",
      urlExpiresAt: "2026-03-10T12:00:00.000Z",
    });

    expect(documentsLibrary.files.map((file) => file.objectPath)).toEqual(["documents/spec.pdf"]);
  });

  it("treats legacy folder markers as folders", () => {
    const library = buildContentMediaLibrary({
      bucketName: "demo-media",
      canManage: true,
      currentPath: "",
      publicUrlForPath: (path) => `https://cdn.example.com/${path}`,
      records: [
        {
          createdAt: "2026-03-10T10:00:00.000Z",
          id: "legacy-folder-marker",
          metadata: null,
          objectPath: "campaigns/.supapress-folder",
          updatedAt: null,
        },
      ],
      search: "",
      urlExpiresAt: "2026-03-10T11:00:00.000Z",
    });

    expect(library.folders).toHaveLength(1);
    expect(library.folders[0]?.path).toBe("campaigns");
    expect(library.images).toEqual([]);
  });

  it("can omit folder options from media/files list payloads", () => {
    const mediaLibrary = buildContentMediaLibrary({
      bucketName: "demo-media",
      canManage: true,
      currentPath: "",
      includeFolderOptions: false,
      publicUrlForPath: (path) => `https://cdn.example.com/${path}`,
      records: [
        {
          createdAt: "2026-03-10T10:00:00.000Z",
          id: "folder-marker",
          metadata: null,
          objectPath: `campaigns/${CONTENT_MEDIA_FOLDER_MARKER}`,
          updatedAt: null,
        },
      ],
      search: "",
      urlExpiresAt: "2026-03-10T11:00:00.000Z",
    });
    const filesLibrary = buildContentFilesLibrary({
      bucketName: "demo-assets",
      canManage: true,
      currentPath: "",
      includeFolderOptions: false,
      publicUrlForPath: (path) => `https://cdn.example.com/${path}`,
      records: [
        {
          createdAt: "2026-03-10T10:00:00.000Z",
          id: "folder-marker",
          metadata: null,
          objectPath: `documents/${CONTENT_MEDIA_FOLDER_MARKER}`,
          updatedAt: null,
        },
      ],
      search: "",
      urlExpiresAt: "2026-03-10T11:00:00.000Z",
    });

    expect(mediaLibrary.folderOptions).toEqual([]);
    expect(filesLibrary.folderOptions).toEqual([]);
  });
});
