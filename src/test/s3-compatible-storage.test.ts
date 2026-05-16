import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getS3CompatibleMediaUrls,
  isS3CompatibleMediaStorageConfigUsable,
  listS3CompatibleMediaFolderPaths,
  listS3CompatibleMediaObjects,
  parseS3CompatibleCommonPrefixes,
  parseS3CompatibleListObjectsV2Response,
} from "@/lib/content-runtime/s3-compatible-storage";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("s3-compatible storage helpers", () => {
  it("accepts either a custom endpoint or a region", () => {
    expect(
      isS3CompatibleMediaStorageConfigUsable({
        bucketName: "assets",
        endpoint: "https://example.r2.cloudflarestorage.com",
      }),
    ).toBe(true);

    expect(
      isS3CompatibleMediaStorageConfigUsable({
        bucketName: "assets",
        endpoint: "",
        region: "us-east-1",
      }),
    ).toBe(true);

    expect(
      isS3CompatibleMediaStorageConfigUsable({
        bucketName: "assets",
        endpoint: "",
        region: "",
      }),
    ).toBe(false);
  });

  it("parses ListObjectsV2 XML into media records", () => {
    const parsed = parseS3CompatibleListObjectsV2Response(`
      <ListBucketResult>
        <Contents>
          <Key>campaigns%2Fhero.png</Key>
          <LastModified>2026-03-18T10:00:00.000Z</LastModified>
          <ETag>"etag-1"</ETag>
          <Size>2048</Size>
        </Contents>
        <Contents>
          <Key>campaigns%2F.basebuddy-folder</Key>
          <LastModified>2026-03-18T09:00:00.000Z</LastModified>
          <ETag>"etag-2"</ETag>
          <Size>0</Size>
        </Contents>
        <NextContinuationToken>next-token</NextContinuationToken>
      </ListBucketResult>
    `);

    expect(parsed.nextContinuationToken).toBe("next-token");
    expect(parsed.records).toEqual([
      expect.objectContaining({
        createdAt: "2026-03-18T10:00:00.000Z",
        id: "etag-1",
        metadata: { size: 2048 },
        objectPath: "campaigns/hero.png",
      }),
      expect.objectContaining({
        objectPath: "campaigns/.basebuddy-folder",
      }),
    ]);
  });

  it("parses ListObjectsV2 common prefixes into folder paths", () => {
    expect(
      parseS3CompatibleCommonPrefixes(`
        <ListBucketResult>
          <CommonPrefixes>
            <Prefix>campaigns%2Farchive%2F</Prefix>
          </CommonPrefixes>
          <CommonPrefixes>
            <Prefix>campaigns%2Flaunch%2F</Prefix>
          </CommonPrefixes>
        </ListBucketResult>
      `),
    ).toEqual(["campaigns/archive", "campaigns/launch"]);
  });

  it("uses the configured public base URL when available", async () => {
    const urls = await getS3CompatibleMediaUrls({
      config: {
        accessKeyId: "demo-access-key",
        bucketName: "assets",
        endpoint: "https://example.r2.cloudflarestorage.com",
        publicUrlBase: "https://cdn.example.com/media",
        region: "auto",
        secretAccessKey: "demo-secret-key",
      },
      objectPaths: ["campaigns/hero image.png"],
      ttlSeconds: 3600,
    });

    expect(urls.get("campaigns/hero image.png")).toBe(
      "https://cdn.example.com/media/campaigns/hero%20image.png",
    );
  });

  it("lists objects with prefix and max-key limits", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        `
          <ListBucketResult>
            <Contents>
              <Key>campaigns%2Fhero.png</Key>
              <LastModified>2026-03-18T10:00:00.000Z</LastModified>
              <ETag>"etag-1"</ETag>
              <Size>2048</Size>
            </Contents>
          </ListBucketResult>
        `,
        { status: 200 },
      ),
    );
    globalThis.fetch = fetchMock;

    await expect(
      listS3CompatibleMediaObjects(
        {
          accessKeyId: "demo-access-key",
          bucketName: "assets",
          endpoint: "https://example.r2.cloudflarestorage.com",
          publicUrlBase: null,
          region: "auto",
          secretAccessKey: "demo-secret-key",
        },
        {
          currentPath: "campaigns",
          cursor: "campaigns/banner.png",
          limit: 25,
          search: "hero",
        },
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        objectPath: "campaigns/hero.png",
      }),
    ]);

    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestUrl.searchParams.get("max-keys")).toBe("25");
    expect(requestUrl.searchParams.get("prefix")).toBe("campaigns/");
    expect(requestUrl.searchParams.get("start-after")).toBe("campaigns/banner.png");
  });

  it("lists folder prefixes with delimiter instead of scanning object contents", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        `
          <ListBucketResult>
            <CommonPrefixes>
              <Prefix>campaigns%2Farchive%2F</Prefix>
            </CommonPrefixes>
          </ListBucketResult>
        `,
        { status: 200 },
      ),
    );
    globalThis.fetch = fetchMock;

    await expect(
      listS3CompatibleMediaFolderPaths(
        {
          accessKeyId: "demo-access-key",
          bucketName: "assets",
          endpoint: "https://example.r2.cloudflarestorage.com",
          publicUrlBase: null,
          region: "auto",
          secretAccessKey: "demo-secret-key",
        },
        {
          currentPath: "campaigns",
          limit: 25,
        },
      ),
    ).resolves.toEqual(["campaigns/archive"]);

    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestUrl.searchParams.get("delimiter")).toBe("/");
    expect(requestUrl.searchParams.get("max-keys")).toBe("25");
    expect(requestUrl.searchParams.get("prefix")).toBe("campaigns/");
  });
});
