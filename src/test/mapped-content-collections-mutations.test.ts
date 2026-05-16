import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/content-runtime/server-runtime-cache", () => ({
  getCachedProjectRuntimeValue: vi.fn(async ({ load }: { load: () => Promise<unknown> }) => load()),
  projectRuntimeCacheGroups: {
    taxonomyOptions: "taxonomy-options",
  },
}));

import { createDefaultContentMappingConfig, type ContentProjectMapping } from "@/lib/content-runtime/mapping";
import { createMappedContentCollectionEntry } from "@/lib/content-runtime/mapped-content-collections";

const createMapping = (): ContentProjectMapping => {
  const mappingConfig = createDefaultContentMappingConfig();
  const categories = mappingConfig.entities.categories;
  const posts = mappingConfig.entities.posts;

  categories.status = "mapped";
  categories.source = {
    kind: "table",
    primaryKey: "id",
    schema: "public",
    table: "categories",
  };
  categories.fields.id.column = "id";
  categories.fields.name.column = "name";
  categories.fields.slug.column = "slug";
  categories.fields.description.column = "description";
  categories.fields.parentId.column = "parent_id";
  categories.capabilities = {
    browse: true,
    create: true,
    delete: true,
    read: true,
    update: true,
  };
  posts.status = "mapped";
  posts.source = {
    kind: "table",
    primaryKey: "id",
    schema: "public",
    table: "posts",
  };
  posts.relations.categories = {
    fieldMap: {},
    junctionSourceColumn: "post_id",
    junctionTable: "public.post_categories",
    junctionTargetColumn: "category_id",
    multiple: true,
    sourceColumn: null,
    status: "mapped",
    strategy: "join_table",
    targetColumn: "id",
    targetEntity: "categories",
    targetTable: null,
    valueColumn: null,
  };

  return {
    bindingId: "binding-1",
    bindingMode: "mapped_content",
    bindingStatus: "ready",
    mappingConfig,
    revisionId: "revision-1",
    revisionVersion: 1,
  };
};

const createQueryMock = () =>
  vi.fn(async (sql: string, params?: unknown[]) => {
    if (sql.includes("information_schema.columns") && sql.includes("column_name = $3")) {
      const columnName = String(params?.[2] ?? "");

      if (columnName === "id") {
        return {
          rows: [
            {
              column_default: null,
              data_type: "uuid",
              is_nullable: "NO",
              udt_name: "uuid",
            },
          ],
        };
      }

      return {
        rows: [
          {
            column_default: null,
            data_type: "text",
            is_nullable: columnName === "name" ? "NO" : "YES",
            udt_name: "text",
          },
        ],
      };
    }

    if (sql.includes("from information_schema.columns")) {
      return {
        rows: [
          { column_name: "id" },
          { column_name: "name" },
          { column_name: "slug" },
          { column_name: "description" },
          { column_name: "parent_id" },
          { column_name: "created_at" },
        ],
      };
    }

    if (sql.includes("select \"id\"::text as id") && sql.includes("where \"slug\" = $1")) {
      return { rows: [] };
    }

    if (sql.includes("insert into \"public\".\"categories\"")) {
      return { rows: [{ id: "category-1" }] };
    }

    if (sql.includes("from \"public\".\"categories\"") && sql.includes("where \"id\" = any($1)")) {
      return {
        rows: [
          {
            created_at: "2026-04-30T00:00:00.000Z",
            description: "Smoke category",
            id: "category-1",
            name: "Smoke Category",
            parent_id: null,
            slug: "smoke-category",
          },
        ],
      };
    }

    throw new Error(`Unexpected query: ${sql}`);
  });

describe("mapped content collection mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates direct-table collection entries with generated UUID primary keys", async () => {
    const query = createQueryMock();

    await expect(
      createMappedContentCollectionEntry({
        client: { query } as never,
        collection: "categories",
        description: "Smoke category",
        mapping: createMapping(),
        name: "Smoke Category",
        slug: "smoke-category",
      }),
    ).resolves.toMatchObject({
      id: "category-1",
      name: "Smoke Category",
      slug: "smoke-category",
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("insert into \"public\".\"categories\""),
      expect.arrayContaining(["Smoke Category", "smoke-category", "Smoke category"]),
    );

    const slugLookupCall = query.mock.calls.find(
      ([sql]) =>
        typeof sql === "string" &&
        sql.includes("select \"id\"::text as id") &&
        sql.includes("where \"slug\" = $1"),
    );

    expect(slugLookupCall?.[0]).not.toContain("$2");
    expect(slugLookupCall?.[1]).toEqual(["smoke-category"]);
  });
});
