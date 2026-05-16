import { describe, expect, it } from "vitest";

import {
  createDefaultContentMappingConfig,
  createUnmappedContentMappingConfig,
} from "@/lib/content-runtime/mapping";

describe("content mapping unmap helpers", () => {
  it("unmaps posts and cascades authors, categories, and tags", () => {
    const mappingConfig = createDefaultContentMappingConfig();
    mappingConfig.entities.posts.status = "mapped";
    mappingConfig.entities.posts.source = {
      kind: "table",
      primaryKey: "id",
      schema: "public",
      table: "posts",
    };
    mappingConfig.entities.posts.fields.id.column = "id";
    mappingConfig.entities.posts.fields.title.column = "title";
    mappingConfig.entities.authors.status = "mapped";
    mappingConfig.entities.authors.source = {
      kind: "table",
      primaryKey: "id",
      schema: "public",
      table: "authors",
    };
    mappingConfig.entities.categories.status = "mapped";
    mappingConfig.entities.categories.source = {
      kind: "table",
      primaryKey: "id",
      schema: "public",
      table: "categories",
    };
    mappingConfig.entities.tags.status = "mapped";
    mappingConfig.entities.tags.source = {
      kind: "table",
      primaryKey: "id",
      schema: "public",
      table: "tags",
    };
    mappingConfig.mediaStorage = {
      bucketName: "cms-media",
      endpoint: null,
      provider: "supabase_bucket",
      publicUrlBase: null,
      region: null,
    };

    const nextConfig = createUnmappedContentMappingConfig({
      mappingConfig,
      target: "posts",
    });

    expect(nextConfig.entities.posts.status).toBe("unmapped");
    expect(nextConfig.entities.posts.source.table).toBeNull();
    expect(nextConfig.entities.posts.fields.title.column).toBeNull();
    expect(nextConfig.entities.authors.status).toBe("unmapped");
    expect(nextConfig.entities.categories.status).toBe("unmapped");
    expect(nextConfig.entities.tags.status).toBe("unmapped");
    expect(nextConfig.mediaStorage).toEqual(mappingConfig.mediaStorage);
  });

  it("unmaps categories without replacing posts", () => {
    const mappingConfig = createDefaultContentMappingConfig();
    mappingConfig.entities.posts.status = "mapped";
    mappingConfig.entities.posts.source = {
      kind: "table",
      primaryKey: "id",
      schema: "public",
      table: "posts",
    };
    mappingConfig.entities.posts.fields.title.column = "title";
    mappingConfig.entities.categories.status = "mapped";
    mappingConfig.entities.categories.source = {
      kind: "table",
      primaryKey: "id",
      schema: "public",
      table: "categories",
    };
    mappingConfig.entities.posts.relations.categories = {
      ...mappingConfig.entities.posts.relations.categories!,
      sourceColumn: "category_id",
      status: "mapped",
      strategy: "foreign_key",
      targetColumn: "id",
      targetTable: "public.categories",
    };

    const nextConfig = createUnmappedContentMappingConfig({
      mappingConfig,
      target: "categories",
    });

    expect(nextConfig.entities.posts.status).toBe("mapped");
    expect(nextConfig.entities.posts.fields.title.column).toBe("title");
    expect(nextConfig.entities.categories.status).toBe("unmapped");
    expect(nextConfig.entities.categories.source.table).toBeNull();
    expect(nextConfig.entities.posts.relations.categories?.status).toBe("unmapped");
    expect(nextConfig.entities.posts.relations.categories?.targetTable).toBeNull();
  });

  it("unmaps everything when requested", () => {
    const mappingConfig = createDefaultContentMappingConfig();
    mappingConfig.entities.posts.status = "mapped";
    mappingConfig.entities.posts.source = {
      kind: "table",
      primaryKey: "id",
      schema: "public",
      table: "posts",
    };
    mappingConfig.mediaStorage = {
      bucketName: "cms-media",
      endpoint: null,
      provider: "supabase_bucket",
      publicUrlBase: null,
      region: null,
    };

    const nextConfig = createUnmappedContentMappingConfig({
      mappingConfig,
      target: "all",
    });

    expect(nextConfig).toEqual(createDefaultContentMappingConfig());
  });
});
