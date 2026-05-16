import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getContentMediaUrls,
  getContentStorageBucketIsPublic,
} from "@/lib/content-runtime/server-media-supabase";

describe("Supabase media URL generation", () => {
  it("caches bucket visibility checks briefly per content database and bucket", async () => {
    const withContentDatabaseClient = vi.fn(async (_connectionString, handler) =>
      handler({
        query: vi.fn(async () => ({
          rows: [{ public: true }],
        })),
      }),
    );

    const input = {
      bucketName: "cached-public-assets",
      connectionString: "postgresql://content/cache-test",
      withContentDatabaseClient,
    };

    await expect(getContentStorageBucketIsPublic(input)).resolves.toBe(true);
    await expect(getContentStorageBucketIsPublic(input)).resolves.toBe(true);

    expect(withContentDatabaseClient).toHaveBeenCalledTimes(1);
  });

  it("uses public object URLs for public buckets even when a storage client is available", async () => {
    const storage = {
      storage: {
        from: vi.fn(() => ({
          createSignedUrls: vi.fn(() => {
            throw new Error("signed URLs should not be requested for public browsing");
          }),
        })),
      },
    } as never;

    const urls = await getContentMediaUrls({
      apiUrl: "https://example.supabase.co",
      bucketName: "content-media",
      objectPaths: ["hero image.png"],
      storage,
      usePublicObjectUrls: true,
    });

    expect(urls.get("hero image.png")).toBe(
      "https://example.supabase.co/storage/v1/object/public/content-media/hero%20image.png",
    );
  });
});
