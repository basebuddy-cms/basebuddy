import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getContentMediaFolderPaths,
  getContentMediaObjects,
} from "@/lib/content-runtime/server-media-supabase";

describe("content Supabase storage performance", () => {
  it("lists storage objects with path, search, and limit predicates", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          created_at: "2026-03-10T10:05:00.000Z",
          id: "object-1",
          metadata: { mimetype: "image/png" },
          name: "campaigns/hero.png",
          updated_at: null,
        },
      ],
    });

    await expect(
      getContentMediaObjects({
        bucketName: "media",
        connectionString: "postgresql://content",
        currentPath: "campaigns",
        limit: 25,
        search: "hero",
        withContentDatabaseClient: vi.fn(async (_connectionString, handler) =>
          handler({ query }),
        ),
      }),
    ).resolves.toEqual([
      {
        createdAt: "2026-03-10T10:05:00.000Z",
        id: "object-1",
        metadata: { mimetype: "image/png" },
        objectPath: "campaigns/hero.png",
        updatedAt: null,
      },
    ]);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("limit $4"),
      ["media", "campaigns/", "hero", 25],
    );
    expect(query.mock.calls[0]?.[0]).toContain("name like $2::text || '%'");
    expect(query.mock.calls[0]?.[0]).toContain("lower(name) like '%' || lower($3::text) || '%'");
  });

  it("uses an object-path cursor for Supabase storage pagination", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [],
    });

    await getContentMediaObjects({
      bucketName: "media",
      connectionString: "postgresql://content",
      currentPath: "campaigns",
      cursor: "campaigns/hero.png",
      limit: 25,
      withContentDatabaseClient: vi.fn(async (_connectionString, handler) =>
        handler({ query }),
      ),
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("name > $3::text"),
      ["media", "campaigns/", "campaigns/hero.png", 25],
    );
    expect(query.mock.calls[0]?.[0]).toContain("limit $4");
  });

  it("loads immediate folder paths without selecting every storage object", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        { folder_path: "campaigns/archive" },
        { folder_path: "campaigns/launch" },
      ],
    });

    await expect(
      getContentMediaFolderPaths({
        bucketName: "media",
        connectionString: "postgresql://content",
        currentPath: "campaigns",
        limit: 25,
        withContentDatabaseClient: vi.fn(async (_connectionString, handler) =>
          handler({ query }),
        ),
      }),
    ).resolves.toEqual(["campaigns/archive", "campaigns/launch"]);

    expect(query).toHaveBeenCalledWith(expect.stringContaining("with recursive immediate_folders"), [
      "media",
      "campaigns/",
      25,
    ]);
    expect(query.mock.calls[0]?.[0]).not.toContain("select *");
    expect(query.mock.calls[0]?.[0]).toContain("select folder_path");
    expect(query.mock.calls[0]?.[0]).toContain("limit $3");
  });
});
