import { describe, expect, it, vi } from "vitest";

import { getContentDatabaseReadAccessNotice } from "@/lib/content-runtime/database-access-notice";
import type { ContentEntityMapping } from "@/lib/content-runtime/mapping";

const createEntity = (table = "games"): ContentEntityMapping =>
  ({
    source: {
      kind: "table",
      primaryKey: "id",
      schema: "public",
      table,
    },
  }) as ContentEntityMapping;

describe("content database access notices", () => {
  it("reports limited read access when a mapped table has rows but the connection reads none", async () => {
    const client = {
      query: async <T,>() => ({
        rows: [
          {
            estimated_rows: "3908",
            rls_enabled: true,
          },
        ] as T[],
      }),
    };

    await expect(
      getContentDatabaseReadAccessNotice({
        client,
        collectionLabel: "posts",
        entity: createEntity(),
        hasActiveFilters: false,
        visibleItemCount: 0,
      }),
    ).resolves.toEqual({
      estimatedRows: 3908,
      kind: "database_read_access_limited",
      message:
        "BaseBuddy can connect to public.games, but this database connection cannot read any posts. Use a database connection with read access to show the existing rows.",
      tableRef: "public.games",
    });
  });

  it("does not show a warning when rows are visible or the empty view is filtered", async () => {
    const client = {
      query: vi.fn(),
    };

    await expect(
      getContentDatabaseReadAccessNotice({
        client,
        collectionLabel: "posts",
        entity: createEntity(),
        hasActiveFilters: false,
        visibleItemCount: 1,
      }),
    ).resolves.toBeNull();

    await expect(
      getContentDatabaseReadAccessNotice({
        client,
        collectionLabel: "posts",
        entity: createEntity(),
        hasActiveFilters: true,
        visibleItemCount: 0,
      }),
    ).resolves.toBeNull();
    expect(client.query).not.toHaveBeenCalled();
  });

  it("treats unreadable RLS-enabled tables as limited even when the row estimate is unknown", async () => {
    const client = {
      query: async <T,>() => ({
        rows: [
          {
            estimated_rows: "-1",
            rls_enabled: true,
          },
        ] as T[],
      }),
    };

    await expect(
      getContentDatabaseReadAccessNotice({
        client,
        collectionLabel: "categories",
        entity: createEntity("categories"),
        hasActiveFilters: false,
        visibleItemCount: 0,
      }),
    ).resolves.toMatchObject({
      estimatedRows: null,
      message:
        "BaseBuddy can connect to public.categories, but this database connection cannot read any categories. Use a database connection with read access to show the existing rows.",
      tableRef: "public.categories",
    });
  });
});
