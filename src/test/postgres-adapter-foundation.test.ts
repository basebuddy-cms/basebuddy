import { describe, expect, it, vi } from "vitest";

import type { ContentDatabaseClient } from "@/lib/content-runtime/server-posts-shared";
import {
  coerceContentAdapterValue,
} from "@/lib/content-runtime/adapter/postgres/coercion-helpers";
import {
  createContentAdapterArrayPatchError,
  createContentAdapterJsonPatchError,
  mapContentProviderErrorToAdapterError,
} from "@/lib/content-runtime/adapter/error-mapping";
import {
  applyContentArrayIndexPatch,
  applyContentArrayObjectPatch,
  applyContentArrayReplacePatch,
  applyContentJsonObjectReplacePatch,
  applyContentJsonPathPatch,
  validateContentArrayWriteValue,
  validateContentJsonWriteValue,
  resolveContentAdapterPatchMode,
} from "@/lib/content-runtime/adapter/postgres/json-array-patch-helpers";
import {
  buildContentAdapterRelationOption,
  dedupeContentAdapterRelationOptions,
  readContentJoinTableValues,
  readContentPolymorphicJoinValues,
  readContentValueMatchRelationOptions,
} from "@/lib/content-runtime/adapter/postgres/relation-helpers";
import {
  inspectContentOneToOneHelperRowValue,
  readContentArrayIndexValue,
  readContentArrayValue,
  readContentDirectColumnValue,
  readContentForeignRowScalarValue,
  readContentForeignKeyValue,
  readContentJsonPathValue,
  readContentJoinRowValue,
  readContentRelatedRowByPostIdValue,
  readContentValueMatchScalarValue,
  resolveContentDerivedReadOnlyValue,
} from "@/lib/content-runtime/adapter/postgres/read-helpers";
import {
  createPostgresSqlProviderAdapter,
  createSupabaseSqlProviderAdapter,
} from "@/lib/content-runtime/adapter/postgres/providers";
import {
  contentRuntimeAdapterProviders,
  defaultContentRuntimeAdapterProvider,
  getContentRuntimeAdapterProvider,
} from "@/lib/content-runtime/adapter/providers";
import {
  withContentAdapterTransaction,
} from "@/lib/content-runtime/adapter/postgres/transaction";
import {
  buildContentArrayReplaceWrite,
  buildContentArrayIndexWrite,
  buildContentDirectColumnWrite,
  buildContentForeignRowScalarWrite,
  buildContentForeignKeyWrite,
  buildContentJsonPathWrite,
  buildContentJoinRowUpsertWrite,
  buildContentJoinTableReplaceWrite,
  buildContentPolymorphicJoinReplaceWrite,
  buildContentRelatedRowByPostIdUpsertWrite,
  buildContentValueMatchScalarWrite,
  buildContentValueMatchRelationWrite,
} from "@/lib/content-runtime/adapter/postgres/write-helpers";

const asCustomerPgQuery = (query: ReturnType<typeof vi.fn>) =>
  query as unknown as ContentDatabaseClient["query"];

describe("Postgres adapter foundation helpers", () => {
  it("normalizes SQL provider queries for supabase and generic postgres clients", async () => {
    const query = vi.fn(async () => ({
      rowCount: 1,
      rows: [{ id: "row-1" }],
    }));

    const supabaseProvider = createSupabaseSqlProviderAdapter({ query: asCustomerPgQuery(query) });
    const postgresProvider = createPostgresSqlProviderAdapter({ query: asCustomerPgQuery(query) });

    await expect(supabaseProvider.executeQuery("select 1", [])).resolves.toEqual({
      rowCount: 1,
      rows: [{ id: "row-1" }],
    });
    await expect(postgresProvider.executeQuery("select 2", [123])).resolves.toEqual({
      rowCount: 1,
      rows: [{ id: "row-1" }],
    });
    expect(supabaseProvider.family).toBe("sql");
    expect(postgresProvider.family).toBe("sql");
  });

  it("registers Postgres as the default launch content runtime adapter provider", () => {
    expect(contentRuntimeAdapterProviders.map((provider) => provider.id)).toEqual(["postgres"]);
    expect(defaultContentRuntimeAdapterProvider.id).toBe("postgres");
    expect(getContentRuntimeAdapterProvider("postgres")).toBe(defaultContentRuntimeAdapterProvider);
    expect(getContentRuntimeAdapterProvider("mysql")).toBeNull();
  });

  it("wraps adapter transactions with begin and commit", async () => {
    const query = vi.fn(async () => ({ rowCount: 0, rows: [] }));

    const result = await withContentAdapterTransaction(
      { query: asCustomerPgQuery(query) },
      async () => "ok",
    );

    expect(result).toBe("ok");
    expect(query).toHaveBeenNthCalledWith(1, "begin");
    expect(query).toHaveBeenNthCalledWith(2, "commit");
  });

  it("rolls back adapter transactions when work fails", async () => {
    const query = vi.fn(async () => ({ rowCount: 0, rows: [] }));

    await expect(
      withContentAdapterTransaction({ query: asCustomerPgQuery(query) }, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(query).toHaveBeenNthCalledWith(1, "begin");
    expect(query).toHaveBeenNthCalledWith(2, "rollback");
  });

  it("reads direct-column, foreign-key, helper-row, json-path, array, join-table, and derived values from rows", () => {
    const row = {
      author_id: " author-1 ",
      derived_title: "Computed title",
      headline: "Hello",
      seo_blob: {
        meta: {
          title: "SEO title",
        },
      },
      tag_ids: ["tag-1", "tag-2", "tag-3"],
    };

    expect(
      readContentDirectColumnValue({
        column: "headline",
        row,
      }),
    ).toBe("Hello");
    expect(
      readContentForeignKeyValue({
        column: "author_id",
        row,
      }),
    ).toBe("author-1");
    expect(
      readContentForeignRowScalarValue({
        row: {
          seo_meta_id: "meta-1",
        },
        sourceColumn: "seo_meta_id",
        targetColumn: "id",
        targetRows: [
          { id: "meta-2", title_text: "Other title" },
          { id: "meta-1", title_text: "Meta title" },
        ],
        valueColumn: "title_text",
      }),
    ).toBe("Meta title");
    expect(
      readContentRelatedRowByPostIdValue({
        helperRows: [
          { post_id: "post-2", seo_title: "Other title" },
          { post_id: "post-1", seo_title: "Meta title" },
          { post_id: "post-1", seo_title: "Alpha title" },
        ],
        postId: "post-1",
        postIdColumn: "post_id",
        valueColumn: "seo_title",
      }),
    ).toBe("Alpha title");
    expect(
      readContentJoinRowValue({
        helperRows: [
          { post_id: "post-1", redirect_slug: "old-post", sort_order: 2 },
          { post_id: "post-1", redirect_slug: "older-post", sort_order: 1 },
        ],
        orderColumn: "sort_order",
        postId: "post-1",
        postIdColumn: "post_id",
        valueColumn: "redirect_slug",
      }),
    ).toBe("older-post");
    expect(
      readContentJsonPathValue({
        column: "seo_blob",
        path: "meta.title",
        row,
      }),
    ).toBe("SEO title");
    expect(
      readContentArrayValue({
        column: "tag_ids",
        row,
      }),
    ).toEqual(["tag-1", "tag-2", "tag-3"]);
    expect(
      readContentArrayIndexValue({
        column: "tag_ids",
        index: 1,
        row,
      }),
    ).toBe("tag-2");
    expect(
      resolveContentDerivedReadOnlyValue({
        value: row.derived_title,
      }),
    ).toBe("Computed title");
    expect(
      readContentJoinTableValues({
        joinRows: [
          { category_id: "category-2", post_id: "post-1" },
          { category_id: "category-1", post_id: "post-1" },
          { category_id: "category-2", post_id: "post-1" },
          { category_id: "category-9", post_id: "post-2" },
        ],
        postId: "post-1",
        sourceColumn: "post_id",
        targetColumn: "category_id",
      }),
    ).toEqual(["category-1", "category-2"]);
    expect(
      readContentJoinTableValues({
        joinRows: [
          { category_id: "category-2", post_id: "post-1", sort_order: 2 },
          { category_id: "category-1", post_id: "post-1", sort_order: 1 },
          { category_id: "category-3", post_id: "post-1", sort_order: 3 },
        ],
        orderColumn: "sort_order",
        postId: "post-1",
        sourceColumn: "post_id",
        targetColumn: "category_id",
      }),
    ).toEqual(["category-1", "category-2", "category-3"]);
    expect(
      readContentPolymorphicJoinValues({
        discriminatorColumn: "owner_type",
        discriminatorValue: "post",
        joinRows: [
          { owner_id: "post-1", owner_type: "post", tag_id: "tag-2", sort_order: 2 },
          { owner_id: "post-1", owner_type: "page", tag_id: "tag-page", sort_order: 1 },
          { owner_id: "post-1", owner_type: "post", tag_id: "tag-1", sort_order: 1 },
          { owner_id: "post-1", owner_type: "post", tag_id: "tag-1", sort_order: 3 },
        ],
        orderColumn: "sort_order",
        postId: "post-1",
        sourceColumn: "owner_id",
        targetColumn: "tag_id",
      }),
    ).toEqual(["tag-1", "tag-2"]);
    expect(
      readContentValueMatchScalarValue({
        sourceValue: "launch",
        targetColumn: "slug",
        targetRows: [
          { meta_title: "Launch Title", slug: "launch" },
          { meta_title: "Other Title", slug: "other" },
        ],
        valueColumn: "meta_title",
      }),
    ).toBe("Launch Title");
    expect(
      readContentValueMatchScalarValue({
        sourceValue: "legacy-slug",
        targetColumn: "slug",
        targetRows: [{ meta_title: "Launch Title", slug: "launch" }],
        valueColumn: "meta_title",
      }),
    ).toBe("legacy-slug");
    expect(
      readContentValueMatchRelationOptions({
        multiple: true,
        sourceValue: ["launch", "legacy-slug", "launch", "  "],
        targetFallbackLabelColumn: "slug",
        targetIdColumn: "id",
        targetLabelColumn: "name",
        targetMatchColumn: "slug",
        targetRows: [
          { id: "tag-1", name: "Launch", slug: "launch" },
          { id: "tag-2", name: null, slug: "product" },
        ],
      }),
    ).toEqual([
      {
        id: "tag-1",
        label: "Launch",
        metadata: { matchValue: "launch" },
      },
      {
        id: "legacy-slug",
        label: "legacy-slug",
        metadata: { matchValue: "legacy-slug", stale: true },
      },
    ]);
  });

  it("reports ambiguity for one-to-one helper rows instead of silently hiding duplicates", () => {
    expect(
      inspectContentOneToOneHelperRowValue({
        helperRows: [
          { post_id: "post-2", redirect_slug: "other-post", sort_order: 1 },
          { post_id: "post-1", redirect_slug: "old-post", sort_order: 2 },
          { post_id: "post-1", redirect_slug: "older-post", sort_order: 1 },
        ],
        orderColumn: "sort_order",
        postId: "post-1",
        postIdColumn: "post_id",
        valueColumn: "redirect_slug",
      }),
    ).toEqual({
      ambiguous: true,
      helperRowCount: 2,
      matchedValues: ["older-post", "old-post"],
      value: "older-post",
    });
  });

  it("builds direct, foreign-key, helper-row, json-path, array-value, array-index, and join-table write operations", () => {
    expect(
      buildContentDirectColumnWrite({
        column: "headline",
        value: "Hello",
      }),
    ).toEqual({
      column: "headline",
      kind: "direct_column",
      value: "Hello",
    });
    expect(
      buildContentForeignKeyWrite({
        column: "author_id",
        value: "author-1",
      }),
    ).toEqual({
      column: "author_id",
      kind: "foreign_key",
      value: "author-1",
    });
    expect(
      buildContentForeignRowScalarWrite({
        targetColumn: "id",
        targetLookupValue: "meta-1",
        value: "Updated title",
        valueColumn: "title_text",
      }),
    ).toEqual({
      kind: "target_row_scalar",
      strategy: "foreign_key",
      targetColumn: "id",
      targetLookupValue: "meta-1",
      value: "Updated title",
      valueColumn: "title_text",
    });
    expect(
      buildContentRelatedRowByPostIdUpsertWrite({
        postId: "post-1",
        postIdColumn: "post_id",
        value: "Meta title",
        valueColumn: "seo_title",
      }),
    ).toEqual({
      kind: "related_row_by_post_id",
      postId: "post-1",
      postIdColumn: "post_id",
      row: {
        post_id: "post-1",
        seo_title: "Meta title",
      },
      valueColumn: "seo_title",
    });
    expect(
      buildContentJoinRowUpsertWrite({
        postId: "post-1",
        postIdColumn: "post_id",
        value: "old-post",
        valueColumn: "redirect_slug",
      }),
    ).toEqual({
      kind: "join_row",
      postId: "post-1",
      postIdColumn: "post_id",
      row: {
        post_id: "post-1",
        redirect_slug: "old-post",
      },
      valueColumn: "redirect_slug",
    });

    expect(
      buildContentJsonPathWrite({
        column: "seo_blob",
        path: "meta.title",
        value: "SEO title",
      }),
    ).toEqual({
      column: "seo_blob",
      kind: "json_path",
      path: ["meta", "title"],
      value: "SEO title",
    });

    expect(
      buildContentArrayReplaceWrite({
        column: "tag_ids",
        value: ["tag-1", "tag-2"],
      }),
    ).toEqual({
      column: "tag_ids",
      kind: "array_value",
      value: ["tag-1", "tag-2"],
    });

    expect(
      buildContentArrayIndexWrite({
        column: "tag_ids",
        index: 1,
        value: "tag-2",
      }),
    ).toEqual({
      column: "tag_ids",
      index: 1,
      kind: "array_item",
      value: "tag-2",
    });
    expect(
      buildContentJoinTableReplaceWrite({
        orderColumn: "sort_order",
        postId: "post-1",
        sourceColumn: "post_id",
        targetColumn: "category_id",
        values: ["category-2", "category-2", "category-1"],
      }),
    ).toEqual({
      kind: "join_table",
      orderColumn: "sort_order",
      postId: "post-1",
      rows: [
        {
          category_id: "category-2",
          post_id: "post-1",
          sort_order: 0,
        },
        {
          category_id: "category-1",
          post_id: "post-1",
          sort_order: 1,
        },
      ],
      sourceColumn: "post_id",
      targetColumn: "category_id",
    });
    expect(
      buildContentPolymorphicJoinReplaceWrite({
        discriminatorColumn: "owner_type",
        discriminatorValue: "post",
        orderColumn: "sort_order",
        postId: "post-1",
        sourceColumn: "owner_id",
        targetColumn: "tag_id",
        values: ["tag-2", "tag-2", "tag-1"],
      }),
    ).toEqual({
      discriminatorColumn: "owner_type",
      discriminatorValue: "post",
      kind: "polymorphic_join",
      orderColumn: "sort_order",
      postId: "post-1",
      rows: [
        {
          owner_id: "post-1",
          owner_type: "post",
          sort_order: 0,
          tag_id: "tag-2",
        },
        {
          owner_id: "post-1",
          owner_type: "post",
          sort_order: 1,
          tag_id: "tag-1",
        },
      ],
      sourceColumn: "owner_id",
      targetColumn: "tag_id",
    });
    expect(
      buildContentValueMatchRelationWrite({
        multiple: true,
        selectedIds: ["tag-1", "legacy-slug", "tag-2", "tag-1"],
        targetIdColumn: "id",
        targetMatchColumn: "slug",
        targetRows: [
          { id: "tag-1", slug: "launch" },
          { id: "tag-2", slug: "product" },
        ],
        unresolvedMatchValuesById: {
          "legacy-slug": "legacy-slug",
        },
      }),
    ).toEqual({
      kind: "value_match_relation",
      multiple: true,
      value: ["launch", "legacy-slug", "product"],
    });
    expect(
      buildContentValueMatchRelationWrite({
        multiple: false,
        selectedIds: "legacy-author",
        targetIdColumn: "id",
        targetMatchColumn: "slug",
        targetRows: [],
        unresolvedMatchValuesById: {
          "legacy-author": "legacy-author",
        },
      }),
    ).toEqual({
      kind: "value_match_relation",
      multiple: false,
      value: "legacy-author",
    });
    expect(
      buildContentValueMatchScalarWrite({
        targetColumn: "slug",
        targetLookupValue: "launch",
        value: "Launch Title",
        valueColumn: "meta_title",
      }),
    ).toEqual({
      kind: "target_row_scalar",
      strategy: "value_match_relation",
      targetColumn: "slug",
      targetLookupValue: "launch",
      value: "Launch Title",
      valueColumn: "meta_title",
    });
  });

  it("coerces mapped values into normalized adapter types", () => {
    expect(
      coerceContentAdapterValue({
        value: "42",
        valueKind: "number",
      }),
    ).toEqual({
      ok: true,
      value: 42,
    });

    expect(
      coerceContentAdapterValue({
        value: "true",
        valueKind: "boolean",
      }),
    ).toEqual({
      ok: true,
      value: true,
    });

    expect(
      coerceContentAdapterValue({
        allowedValues: ["draft", "published"],
        value: "archived",
        valueKind: "enum",
      }),
    ).toEqual({
      code: "enum_value_not_allowed",
      message: 'Choose one of the allowed values instead of "archived".',
      ok: false,
    });

    expect(
      coerceContentAdapterValue({
        value: ["not", "an", "object"],
        valueKind: "json_object",
      }),
    ).toEqual({
      code: "invalid_json_object",
      message: "Enter a valid JSON object.",
      ok: false,
    });
  });

  it("normalizes relation options and falls back when labels are missing", () => {
    const option = buildContentAdapterRelationOption({
      fallbackLabel: "author-1",
      id: "author-1",
      label: " ",
      metadata: { slug: "author-one" },
    });

    expect(option).toEqual({
      id: "author-1",
      label: "author-1",
      metadata: { slug: "author-one" },
    });

    expect(
      dedupeContentAdapterRelationOptions([
        option,
        { id: "author-1", label: "Author One" },
        { id: "author-2", label: "Author Two" },
      ]),
    ).toEqual([
      { id: "author-1", label: "author-1", metadata: { slug: "author-one" } },
      { id: "author-2", label: "Author Two" },
    ]);
  });

  it("patches json objects and arrays without losing unrelated siblings", () => {
    expect(
      applyContentJsonPathPatch({
        allowCreateMissingPath: true,
        path: "meta.title",
        target: {
          meta: {
            description: "Keep me",
          },
          untouched: true,
        },
        value: "SEO title",
      }),
    ).toEqual({
      meta: {
        description: "Keep me",
        title: "SEO title",
      },
      untouched: true,
    });

    expect(
      applyContentArrayReplacePatch({
        target: ["a", "b"],
        value: ["x", "y"],
      }),
    ).toEqual(["x", "y"]);

    expect(
      applyContentArrayIndexPatch({
        index: 1,
        target: ["a", "b", "c"],
        value: "updated",
      }),
    ).toEqual(["a", "updated", "c"]);

    expect(
      resolveContentAdapterPatchMode({
        editabilityState: "editable",
        storagePrimitive: "json_path",
      }),
    ).toBe("key_patch");
  });

  it("only allows full-object JSON replace when explicitly enabled", () => {
    expect(() =>
      applyContentJsonObjectReplacePatch({
        allowFullObjectReplace: false,
        path: "$",
        target: {
          meta: {
            title: "Old title",
          },
        },
        value: {
          meta: {
            title: "New title",
          },
        },
      }),
    ).toThrow("Full-object JSON replace is not allowed.");

    expect(
      applyContentJsonObjectReplacePatch({
        allowFullObjectReplace: true,
        path: "$",
        target: {
          meta: {
            title: "Old title",
          },
        },
        value: {
          meta: {
            title: "New title",
          },
        },
      }),
    ).toEqual({
      meta: {
        title: "New title",
      },
    });
  });

  it("patches object arrays only when a stable identity key is configured", () => {
    expect(() =>
      applyContentArrayObjectPatch({
        target: [
          { id: "a", label: "Alpha" },
          { id: "b", label: "Beta" },
        ],
        value: { id: "b", label: "Beta updated" },
      }),
    ).toThrow("Object-array patch requires a stable identity key.");

    expect(
      applyContentArrayObjectPatch({
        identityKey: "id",
        target: [
          { id: "a", label: "Alpha" },
          { id: "b", label: "Beta" },
          { id: "b", label: "Stale duplicate" },
        ],
        value: { id: "b", label: "Beta updated" },
      }),
    ).toEqual([
      { id: "a", label: "Alpha" },
      { id: "b", label: "Beta updated" },
    ]);
  });

  it("enforces safe JSON path creation and validates JSON and array payloads", () => {
    expect(() =>
      applyContentJsonPathPatch({
        allowCreateMissingPath: false,
        path: "meta.title",
        target: {
          meta: {},
        },
        value: "SEO title",
      }),
    ).toThrow("The selected JSON path is missing.");

    expect(
      applyContentJsonPathPatch({
        allowCreateMissingPath: true,
        allowCreateParentContainers: true,
        path: "meta.title",
        target: {},
        value: "SEO title",
      }),
    ).toEqual({
      meta: {
        title: "SEO title",
      },
    });

    expect(() =>
      applyContentJsonPathPatch({
        allowCreateMissingPath: true,
        allowCreateParentContainers: false,
        path: "meta.title",
        target: {},
        value: "SEO title",
      }),
    ).toThrow("The selected JSON container is missing.");

    expect(validateContentJsonWriteValue('{"title":"Hello"}')).toEqual({
      title: "Hello",
    });
    expect(validateContentArrayWriteValue('["tag-1","tag-2"]')).toEqual([
      "tag-1",
      "tag-2",
    ]);
    expect(() => validateContentJsonWriteValue("{oops")).toThrow("Malformed JSON payload.");
    expect(() => validateContentArrayWriteValue('{"nope":true}')).toThrow(
      "Array payload must be an array.",
    );
  });

  it("throws structured JSON and array patch errors from helper failures", () => {
    let jsonPatchError: unknown;
    let arrayPatchError: unknown;
    let jsonReplaceError: unknown;
    let arrayObjectPatchError: unknown;

    try {
      applyContentJsonPathPatch({
        allowCreateMissingPath: false,
        fieldKey: "seoTitle",
        path: "meta.title",
        sourceColumn: "meta_payload",
        target: {
          meta: {},
        },
        value: "SEO title",
      });
    } catch (error) {
      jsonPatchError = error;
    }

    try {
      applyContentArrayIndexPatch({
        fieldKey: "categories",
        index: 1,
        sourceColumn: "category_ids",
        target: {} as unknown as unknown[],
        value: "category-2",
      });
    } catch (error) {
      arrayPatchError = error;
    }

    try {
      applyContentJsonObjectReplacePatch({
        allowFullObjectReplace: false,
        fieldKey: "metadata",
        path: "$",
        sourceColumn: "metadata",
        target: {
          hero: true,
        },
        value: {
          hero: false,
        },
      });
    } catch (error) {
      jsonReplaceError = error;
    }

    try {
      applyContentArrayObjectPatch({
        fieldKey: "redirects",
        sourceColumn: "redirects",
        target: [
          { slug: "old-post" },
        ],
        value: { slug: "older-post" },
      });
    } catch (error) {
      arrayObjectPatchError = error;
    }

    expect(mapContentProviderErrorToAdapterError(jsonPatchError)).toEqual({
      code: "json_patch_failure",
      fieldKey: "seoTitle",
      message: 'Could not update the JSON path "meta.title".',
      metadata: {
        path: "meta.title",
        reason: "missing_path",
        sourceColumn: "meta_payload",
      },
    });

    expect(mapContentProviderErrorToAdapterError(arrayPatchError)).toEqual({
      code: "array_patch_failure",
      fieldKey: "categories",
      message: 'Could not update the array target "index:1".',
      metadata: {
        reason: "invalid_array_target",
        sourceColumn: "category_ids",
        target: "index:1",
      },
    });

    expect(mapContentProviderErrorToAdapterError(jsonReplaceError)).toEqual({
      code: "json_patch_failure",
      fieldKey: "metadata",
      message: 'Could not update the JSON path "$".',
      metadata: {
        path: "$",
        reason: "full_object_replace_not_allowed",
        sourceColumn: "metadata",
      },
    });

    expect(mapContentProviderErrorToAdapterError(arrayObjectPatchError)).toEqual({
      code: "array_patch_failure",
      fieldKey: "redirects",
      message: 'Could not update the array target "object_array".',
      metadata: {
        reason: "missing_stable_identity",
        sourceColumn: "redirects",
        target: "object_array",
      },
    });
  });

  it("maps common postgres errors into normalized adapter errors", () => {
    expect(
      mapContentProviderErrorToAdapterError({
        code: "23505",
        constraint: "posts_slug_key",
        detail: "Key (slug)=(hello) already exists.",
        message: "duplicate key value violates unique constraint",
      }),
    ).toEqual({
      code: "uniqueness_violation",
      message: "A unique value is already in use.",
      metadata: {
        constraint: "posts_slug_key",
        detail: "Key (slug)=(hello) already exists.",
        postgresCode: "23505",
      },
    });

    expect(
      mapContentProviderErrorToAdapterError(
        {
          code: "23503",
          column: "author_id",
          detail: 'Key (author_id)=(author-999) is not present in table "authors".',
          message: "insert or update on table violates foreign key constraint",
        },
        {
          fieldKeyByColumn: {
            author_id: "author",
          },
        },
      ),
    ).toEqual({
      code: "foreign_key_violation",
      fieldKey: "author",
      message: "The selected related record is invalid.",
      metadata: {
        detail: 'Key (author_id)=(author-999) is not present in table "authors".',
        postgresCode: "23503",
      },
    });

    expect(
      mapContentProviderErrorToAdapterError(
        {
          code: "23514",
          column: "audience",
          constraint: "posts_audience_check",
          detail: 'Failing row contains (audience=admins).',
          message: "new row for relation violates check constraint",
        },
        {
          allowedValuesByFieldKey: {
            audience: ["everyone", "members"],
          },
          fieldKeyByColumn: {
            audience: "audience",
          },
        },
      ),
    ).toEqual({
      code: "check_constraint_violation",
      fieldKey: "audience",
      message: "The value does not satisfy a database rule.",
      metadata: {
        allowedValues: ["everyone", "members"],
        constraint: "posts_audience_check",
        detail: 'Failing row contains (audience=admins).',
        postgresCode: "23514",
      },
    });

    expect(
      mapContentProviderErrorToAdapterError(
        {
          code: "42501",
          column: "body",
          message: "permission denied for table posts",
        },
        {
          fieldKeyByColumn: {
            body: "content",
          },
        },
      ),
    ).toEqual({
      code: "database_write_privilege_denied",
      fieldKey: "content",
      message: "The database connection cannot update this field.",
      metadata: {
        postgresCode: "42501",
      },
    });

    expect(
      mapContentProviderErrorToAdapterError(
        createContentAdapterJsonPatchError({
          fieldKey: "seoTitle",
          path: "meta.title",
          reason: "missing_path",
          sourceColumn: "meta_payload",
        }),
      ),
    ).toEqual({
      code: "json_patch_failure",
      fieldKey: "seoTitle",
      message: 'Could not update the JSON path "meta.title".',
      metadata: {
        path: "meta.title",
        reason: "missing_path",
        sourceColumn: "meta_payload",
      },
    });

    expect(
      mapContentProviderErrorToAdapterError(
        createContentAdapterArrayPatchError({
          fieldKey: "categories",
          reason: "invalid_array_target",
          sourceColumn: "category_ids",
          target: "whole_array",
        }),
      ),
    ).toEqual({
      code: "array_patch_failure",
      fieldKey: "categories",
      message: 'Could not update the array target "whole_array".',
      metadata: {
        reason: "invalid_array_target",
        sourceColumn: "category_ids",
        target: "whole_array",
      },
    });

    expect(
      mapContentProviderErrorToAdapterError(new Error("plain failure")),
    ).toEqual({
      code: "unknown_error",
      message: "plain failure",
    });
  });
});
