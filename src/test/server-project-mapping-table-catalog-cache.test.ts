import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

vi.mock("@/lib/content-runtime/adapter/introspection", () => ({
  getContentSchemaTableCatalog: vi.fn(async (client: { query: () => Promise<{ rows: unknown[] }> }) => {
    await client.query();

    return [
      {
        columnCount: 4,
        kind: "table",
        primaryKey: "id",
        rowCountEstimate: 100,
        schema: "public",
        table: "posts",
        tableRef: "public.posts",
      },
    ];
  }),
  introspectContentSchema: vi.fn(),
}));

import {
  getContentDatabaseCacheFingerprint,
  getContentProjectMappingTables,
} from "@/lib/content-runtime/server-project-mapping";

describe("content project mapping table catalog cache", () => {
  it("uses a content database fingerprint instead of raw credentials for table catalog cache keys", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const dependencies = {
      ensureProjectManagementPermission: vi.fn(),
      ensureProjectPermission: vi.fn(),
      getFilesStorageCredentialStatus: vi.fn(),
      getMediaStorageCredentialStatus: vi.fn(),
      getProjectContext: vi
        .fn()
        .mockResolvedValueOnce({
          connectionString: "postgresql://user-one:secret-one@db.example.com:5432/content?sslmode=require",
        })
        .mockResolvedValueOnce({
          connectionString: "postgresql://user-two:secret-two@db.example.com:5432/content?sslmode=require",
        }),
      withContentDatabaseClient: vi.fn(async (_connectionString: string, handler: (client: { query: typeof query }) => Promise<unknown>) =>
        handler({ query }),
      ),
    };

    await getContentProjectMappingTables({
      dependencies: dependencies as never,
      projectId: "project-1",
    });
    await getContentProjectMappingTables({
      dependencies: dependencies as never,
      projectId: "project-2",
    });

    expect(getContentDatabaseCacheFingerprint("postgresql://u:p@db.example.com:5432/content?sslmode=require")).toBe(
      "postgresql://db.example.com:5432/content?sslmode=require",
    );
    expect(query).toHaveBeenCalledTimes(1);
  });
});
