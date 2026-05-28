import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  buildMappedContentPostEditorSelectClauseMock,
  buildMappedContentPostListSelectClauseMock,
  getEntityColumnMetadataMock,
  getMappedContentRuntimeMock,
  getContentMappingRevisionCacheKeyMock,
  getContentPostProjectionAuthorIdMock,
  getEntityIdColumnMock,
  getEntityTableNameMock,
  getMappedRelationValuesForPostsMock,
  mapMappedContentPostRowMock,
  quoteIdentifierMock,
  runtimeState,
} = vi.hoisted(() => {
  const runtimeState = {
    authorStrategy: "array",
  };

  return {
    buildMappedContentPostEditorSelectClauseMock: vi.fn(() => "id"),
    buildMappedContentPostListSelectClauseMock: vi.fn(() => "id"),
    getEntityColumnMetadataMock: vi.fn(async () => ({
      dataType: "uuid",
      defaultValue: null,
      isNullable: false,
      udtName: "uuid",
    })),
    getContentMappingRevisionCacheKeyMock: vi.fn(() => "binding:none:0"),
    getContentPostProjectionAuthorIdMock: vi.fn(async () => null),
    getMappedContentRuntimeMock: vi.fn(() => ({
      posts: {
        relations: {
          authors: {
            strategy: runtimeState.authorStrategy,
          },
        },
        source: {
          primaryKey: "id",
        },
      },
    })),
    getEntityIdColumnMock: vi.fn(() => "id"),
    getEntityTableNameMock: vi.fn(() => '"public"."posts"'),
    getMappedRelationValuesForPostsMock: vi.fn(async () => new Map([["post-1", ["author-1"]]])),
    mapMappedContentPostRowMock: vi.fn(() => ({ id: "post-1", title: "Post 1" })),
    quoteIdentifierMock: vi.fn((value: string) => `"${value}"`),
    runtimeState,
  };
});

vi.mock("@/lib/content-runtime/mapped-content-runtime-support", () => ({
  getEntityColumnMetadata: getEntityColumnMetadataMock,
  getEntityIdColumn: getEntityIdColumnMock,
  getEntityTableName: getEntityTableNameMock,
  getContentMappingRevisionCacheKey: getContentMappingRevisionCacheKeyMock,
  getMappedContentRuntime: getMappedContentRuntimeMock,
  quoteIdentifier: quoteIdentifierMock,
}));

vi.mock("@/lib/content-runtime/mapped-content-post-support", () => ({
  buildMappedContentPostEditorSelectClause: buildMappedContentPostEditorSelectClauseMock,
  buildMappedContentPostListSelectClause: buildMappedContentPostListSelectClauseMock,
  getMappedRelationValuesForPosts: getMappedRelationValuesForPostsMock,
  mapMappedContentPostRow: mapMappedContentPostRowMock,
}));

vi.mock("@/lib/content-runtime/server-content-post-projection", () => ({
  getContentPostProjectionAuthorId: getContentPostProjectionAuthorIdMock,
}));

import { getMappedContentPostAuthorId, getMappedContentPostById } from "@/lib/content-runtime/mapped-content-post-reads";
import { invalidateProjectRuntimeCache } from "@/lib/content-runtime/server-runtime-cache";

const createMappingStub = () =>
  ({
    bindingId: "binding",
    revisionId: "revision",
    revisionVersion: 1,
  }) as unknown as Parameters<typeof getMappedContentPostAuthorId>[0]["mapping"];

describe("getMappedContentPostAuthorId", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-27T00:00:00.000Z"));
    runtimeState.authorStrategy = "array";
    getEntityColumnMetadataMock.mockReset();
    getEntityColumnMetadataMock.mockResolvedValue({
      dataType: "uuid",
      defaultValue: null,
      isNullable: false,
      udtName: "uuid",
    });
    buildMappedContentPostListSelectClauseMock.mockClear();
    getContentPostProjectionAuthorIdMock.mockReset();
    getContentPostProjectionAuthorIdMock.mockResolvedValue(null);
    getMappedRelationValuesForPostsMock.mockReset();
    getMappedRelationValuesForPostsMock.mockResolvedValue(new Map([["post-1", ["author-1"]]]));
    mapMappedContentPostRowMock.mockClear();
  });

  afterEach(() => {
    invalidateProjectRuntimeCache("project-post-author-cache-test");
    vi.useRealTimers();
  });

  it("caches non-SQL author strategy lookups briefly by project and post", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ id: "post-1" }],
      }),
    };
    const mapping = createMappingStub();

    await expect(
      getMappedContentPostAuthorId({
        client,
        mapping,
        postId: "post-1",
        projectId: "project-post-author-cache-test",
      }),
    ).resolves.toBe("author-1");

    await expect(
      getMappedContentPostAuthorId({
        client,
        mapping,
        postId: "post-1",
        projectId: "project-post-author-cache-test",
      }),
    ).resolves.toBe("author-1");

    expect(client.query).toHaveBeenCalledTimes(1);
    expect(getMappedRelationValuesForPostsMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5_001);

    await expect(
      getMappedContentPostAuthorId({
        client,
        mapping,
        postId: "post-1",
        projectId: "project-post-author-cache-test",
      }),
    ).resolves.toBe("author-1");

    expect(client.query).toHaveBeenCalledTimes(2);
    expect(getMappedRelationValuesForPostsMock).toHaveBeenCalledTimes(2);
  });

  it("does not cache SQL-backed author strategies", async () => {
    runtimeState.authorStrategy = "foreign_key";
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ id: "post-1" }],
      }),
    };
    const mapping = createMappingStub();

    await expect(
      getMappedContentPostAuthorId({
        client,
        mapping,
        postId: "post-1",
        projectId: "project-post-author-cache-test",
      }),
    ).resolves.toBe("author-1");

    await expect(
      getMappedContentPostAuthorId({
        client,
        mapping,
        postId: "post-1",
        projectId: "project-post-author-cache-test",
      }),
    ).resolves.toBe("author-1");

    expect(client.query).toHaveBeenCalledTimes(2);
    expect(getMappedRelationValuesForPostsMock).toHaveBeenCalledTimes(2);
  });

  it("prefers the mapped projection author id when available", async () => {
    const client = {
      query: vi.fn(),
    };
    const mapping = createMappingStub();
    getContentPostProjectionAuthorIdMock.mockResolvedValue("projected-author");

    await expect(
      getMappedContentPostAuthorId({
        client,
        mapping,
        postId: "post-1",
        projectId: "project-post-author-cache-test",
      }),
    ).resolves.toBe("projected-author");

    expect(getContentPostProjectionAuthorIdMock).toHaveBeenCalledWith({
      mapping,
      postId: "post-1",
      projectId: "project-post-author-cache-test",
    });
    expect(client.query).not.toHaveBeenCalled();
    expect(getMappedRelationValuesForPostsMock).not.toHaveBeenCalled();
  });

  it("uses a typed primary-key predicate for direct author-id lookups when column metadata is known", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ id: "post-1" }],
      }),
    };

    await expect(
      getMappedContentPostAuthorId({
        client,
        mapping: createMappingStub(),
        postId: "post-1",
      }),
    ).resolves.toBe("author-1");

    const query = client.query.mock.calls[0]?.[0] as string;
    expect(query).toContain('where "id" = $1');
    expect(query).not.toContain('"id"::text = $1');
  });

  it("uses a typed primary-key predicate for direct post hydration when column metadata is known", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ id: "post-1" }],
      }),
    };

    await expect(
      getMappedContentPostById({
        client,
        mapping: createMappingStub(),
        postId: "post-1",
      }),
    ).resolves.toMatchObject({ id: "post-1" });

    const query = client.query.mock.calls[0]?.[0] as string;
    expect(query).toContain('where "id" = $1');
    expect(query).not.toContain('"id"::text = $1');
    expect(mapMappedContentPostRowMock).toHaveBeenCalledTimes(1);
  });
});
