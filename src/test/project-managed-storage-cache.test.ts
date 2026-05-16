import { beforeEach, describe, expect, it } from "vitest";

import {
  readCachedFilesPayload,
  writeCachedFilesPayload,
} from "@/components/editor/project-files-manager/support";
import {
  readCachedMediaPayload,
  writeCachedMediaPayload,
} from "@/components/editor/project-media-manager/support";
import type {
  ContentFilesLibrary,
  ContentMediaLibrary,
} from "@/lib/content-runtime/shared";

const futureExpiry = () => new Date(Date.now() + 10 * 60_000).toISOString();

const createMediaPayload = (count: number): ContentMediaLibrary => ({
  breadcrumbs: [{ label: "Home", path: "" }],
  bucketName: "cms-assets",
  canManage: true,
  currentPath: "",
  folderOptions: [""],
  folders: [],
  images: Array.from({ length: count }, (_, index) => ({
    createdAt: "2026-05-01T00:00:00.000Z",
    fileName: `hero-image-with-long-name-${index}.png`,
    folderPath: `library/${index}`,
    id: `image-${index}`,
    objectPath: `library/${index}/hero-image-with-long-name-${index}.png`,
    publicUrl: `https://cdn.example.com/library/${index}/hero-image-with-long-name-${index}.png?token=${"x".repeat(120)}`,
    sizeBytes: 128_000,
    updatedAt: "2026-05-01T00:00:00.000Z",
  })),
  search: "",
  urlExpiresAt: futureExpiry(),
});

const createFilesPayload = (count: number): ContentFilesLibrary => ({
  breadcrumbs: [{ label: "Home", path: "" }],
  bucketName: "cms-assets",
  canManage: true,
  currentPath: "",
  fileCount: count,
  files: Array.from({ length: count }, (_, index) => ({
    createdAt: "2026-05-01T00:00:00.000Z",
    fileName: `document-${index}.pdf`,
    folderPath: `library/${index}`,
    id: `file-${index}`,
    objectPath: `library/${index}/document-with-long-name-${index}.pdf`,
    publicUrl: `https://cdn.example.com/library/${index}/document-with-long-name-${index}.pdf?token=${"x".repeat(120)}`,
    sizeBytes: 512_000,
    updatedAt: "2026-05-01T00:00:00.000Z",
  })),
  folderOptions: [""],
  folders: [],
  search: "",
  urlExpiresAt: futureExpiry(),
});

describe("managed storage persisted cache", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();

    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        key: (index: number) => Array.from(storage.keys())[index] ?? null,
        get length() {
          return storage.size;
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
      },
    });
  });

  it("does not persist huge media modal payloads", () => {
    writeCachedMediaPayload("project-1", "", "", createMediaPayload(1_500));

    expect(readCachedMediaPayload("project-1", "", "")).toBeNull();
    expect(window.localStorage.length).toBe(0);
  });

  it("does not persist huge file modal payloads", () => {
    writeCachedFilesPayload("project-1", "", "", createFilesPayload(1_500));

    expect(readCachedFilesPayload("project-1", "", "")).toBeNull();
    expect(window.localStorage.length).toBe(0);
  });
});
