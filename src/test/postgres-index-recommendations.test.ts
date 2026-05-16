import { describe, expect, it } from "vitest";

import {
  createDefaultContentMappingConfig,
  type ContentProjectMapping,
} from "@/lib/content-runtime/mapping";
import {
  buildPostgresMappedPostIndexRecommendations,
} from "@/lib/content-runtime/adapter/postgres/index-recommendations";

const createMappedPostMapping = (): ContentProjectMapping => {
  const mappingConfig = createDefaultContentMappingConfig();
  const posts = mappingConfig.entities.posts;

  posts.status = "mapped";
  posts.source = {
    kind: "table",
    primaryKey: "id",
    schema: "public",
    table: "posts",
  };
  posts.fields.id.column = "id";
  posts.fields.title.column = "title";
  posts.fields.slug.column = "slug";
  posts.fields.excerpt.column = "summary";
  posts.fields.createdAt.column = "created_at";
  posts.fields.updatedAt.column = "updated_at";
  posts.fields.publishedAt.column = "published_at";
  posts.workflow = {
    archivedValues: ["archived"],
    customValues: [],
    draftValues: ["draft"],
    mode: "status",
    publishedAtColumn: "published_at",
    publishedFlagColumn: null,
    publishedValues: ["published"],
    statusColumn: "status",
  };
  posts.relations.authors = {
    ...posts.relations.authors!,
    sourceColumn: "author_id",
    status: "mapped",
    strategy: "foreign_key",
    targetColumn: "id",
    targetTable: "public.authors",
  };
  posts.relations.categories = {
    ...posts.relations.categories!,
    junctionSourceColumn: "post_id",
    junctionTable: "public.post_categories",
    junctionTargetColumn: "category_id",
    status: "mapped",
    strategy: "join_table",
    targetColumn: "id",
    targetTable: "public.categories",
  };
  posts.relations.tags = {
    ...posts.relations.tags!,
    discriminatorColumn: "kind",
    discriminatorValue: "tag",
    junctionSourceColumn: "post_id",
    junctionTable: "public.taggables",
    junctionTargetColumn: "tag_id",
    status: "mapped",
    strategy: "polymorphic_join",
    targetColumn: "id",
    targetTable: "public.tags",
  };
  posts.customRelationFields = [
    {
      enabled: true,
      fieldKey: "relatedPosts",
      isNullable: true,
      kind: "multi_relation",
      label: "Related Posts",
      relation: {
        ...posts.relations.tags!,
        discriminatorColumn: null,
        discriminatorValue: null,
        junctionSourceColumn: "source_post_id",
        junctionTable: "public.related_posts",
        junctionTargetColumn: "target_post_id",
        status: "mapped",
        strategy: "join_table",
        targetColumn: "id",
        targetEntity: "posts",
        targetTable: "public.posts",
      },
    },
  ];
  mappingConfig.entities.media.status = "mapped";
  mappingConfig.entities.media.source = {
    kind: "table",
    primaryKey: "id",
    schema: "storage",
    table: "objects",
  };
  mappingConfig.entities.media.fields.id.column = "id";
  mappingConfig.entities.media.fields.objectPath.column = "name";

  return {
    bindingId: "binding-1",
    bindingMode: "mapped_content",
    bindingStatus: "ready",
    mappingConfig,
    revisionId: "revision-1",
    revisionVersion: 1,
  };
};

describe("Postgres mapped post index recommendations", () => {
  it("generates copyable SQL for mapped post lookups, filters, search, relations, and object paths", () => {
    const recommendations = buildPostgresMappedPostIndexRecommendations(createMappedPostMapping());
    const recommendationIds = recommendations.map((recommendation) => recommendation.id);

    expect(recommendationIds).toEqual([
      "posts-primary-lookup",
      "posts-status-filter",
      "posts-published-at-filter",
      "posts-updated-at-sort",
      "posts-created-at-sort",
      "posts-slug-lookup",
      "posts-title-trigram-search",
      "posts-slug-trigram-search",
      "posts-excerpt-trigram-search",
      "posts-authors-foreign-key",
      "posts-categories-join-table",
      "posts-tags-polymorphic-join",
      "posts-relatedPosts-join-table",
      "media-object-path-lookup",
    ]);
    expect(recommendations.every((recommendation) => recommendation.sql.trim().endsWith(";"))).toBe(true);
    expect(recommendations.find((recommendation) => recommendation.id === "posts-primary-lookup")?.sql).toBe(
      'create index if not exists "basebuddy_posts_id_lookup_idx" on "public"."posts" ("id");',
    );
    expect(recommendations.find((recommendation) => recommendation.id === "posts-title-trigram-search")?.sql).toBe(
      'create extension if not exists pg_trgm;\ncreate index if not exists "basebuddy_posts_title_trgm_idx" on "public"."posts" using gin ((coalesce("title"::text, \'\')) gin_trgm_ops);',
    );
    expect(recommendations.find((recommendation) => recommendation.id === "posts-tags-polymorphic-join")?.sql).toBe(
      'create index if not exists "basebuddy_taggables_post_id_tag_id_kind_idx" on "public"."taggables" ("post_id", "tag_id", "kind");',
    );
    expect(recommendations.find((recommendation) => recommendation.id === "media-object-path-lookup")?.sql).toBe(
      'create index if not exists "basebuddy_objects_name_lookup_idx" on "storage"."objects" ("name");',
    );
  });

  it("returns no recommendations when posts are not backed by a mapped table", () => {
    const mappingConfig = createDefaultContentMappingConfig();

    expect(
      buildPostgresMappedPostIndexRecommendations({
        bindingId: "binding-1",
        bindingMode: "mapped_content",
        bindingStatus: "ready",
        mappingConfig,
        revisionId: "revision-1",
        revisionVersion: 1,
      }),
    ).toEqual([]);
  });
});
