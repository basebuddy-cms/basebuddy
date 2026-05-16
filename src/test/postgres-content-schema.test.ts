import { describe, expect, it, vi } from "vitest";

import { buildContentAutoMappingResult } from "@/lib/content-runtime/introspection";
import { createDefaultContentMappingConfig } from "@/lib/content-runtime/mapping";
import {
  getPostgresContentSchemaTableCatalog,
  introspectPostgresContentSchema,
  repairContentMappingConfig,
} from "@/lib/content-runtime/adapter/postgres/schema";

describe("mapped-content schema repair", () => {
  it("can load a lightweight table catalog without full schema introspection", async () => {
    const query = vi.fn(async (sql: string) => {
      const normalizedSql = sql.toLowerCase();

      if (normalizedSql.includes("row_count_estimate") && normalizedSql.includes("from pg_class as c")) {
        return {
          rows: [
            {
              object_kind: "table",
              row_count_estimate: "12",
              schema_name: "public",
              table_name: "posts",
            },
            {
              object_kind: "view",
              row_count_estimate: null,
              schema_name: "public",
              table_name: "published_posts",
            },
          ],
        };
      }

      if (
        normalizedSql.includes("count(a.attnum)::int as column_count") &&
        normalizedSql.includes("from pg_class as c") &&
        normalizedSql.includes("join pg_attribute as a")
      ) {
        return {
          rows: [
            {
              column_count: 8,
              table_name: "posts",
              table_schema: "public",
            },
            {
              column_count: 6,
              table_name: "published_posts",
              table_schema: "public",
            },
          ],
        };
      }

      if (
        normalizedSql.includes("join pg_index as i") &&
        normalizedSql.includes("i.indisprimary") &&
        normalizedSql.includes("unnest(i.indkey) with ordinality")
      ) {
        return {
          rows: [
            {
              column_name: "id",
              ordinal_position: 1,
              table_name: "posts",
              table_schema: "public",
            },
          ],
        };
      }

      expect(normalizedSql).not.toContain("from information_schema.columns");
      expect(normalizedSql).not.toContain("from information_schema.table_constraints");
      expect(normalizedSql).not.toContain("from information_schema.key_column_usage");
      throw new Error(`Unexpected query: ${sql}`);
    });

    await expect(getPostgresContentSchemaTableCatalog({ query } as never)).resolves.toEqual([
      {
        columnCount: 8,
        kind: "table",
        primaryKey: "id",
        rowCountEstimate: 12,
        schema: "public",
        table: "posts",
        tableRef: "public.posts",
      },
      {
        columnCount: 6,
        kind: "view",
        primaryKey: null,
        rowCountEstimate: null,
        schema: "public",
        table: "published_posts",
        tableRef: "public.published_posts",
      },
    ]);
  });

  it("keeps the table catalog response compact for 1000-table schemas", async () => {
    const tableRows = Array.from({ length: 1_000 }, (_, index) => ({
      object_kind: "table",
      row_count_estimate: "500000",
      schema_name: "public",
      table_name: `content_table_${index.toString().padStart(4, "0")}`,
    }));
    const columnCountRows = tableRows.map((row) => ({
      column_count: 12,
      table_name: row.table_name,
      table_schema: row.schema_name,
    }));
    const primaryKeyRows = tableRows.map((row) => ({
      column_name: "id",
      ordinal_position: 1,
      table_name: row.table_name,
      table_schema: row.schema_name,
    }));
    const query = vi.fn(async (sql: string) => {
      const normalizedSql = sql.toLowerCase();

      if (normalizedSql.includes("row_count_estimate") && normalizedSql.includes("from pg_class as c")) {
        return { rows: tableRows };
      }

      if (
        normalizedSql.includes("count(a.attnum)::int as column_count") &&
        normalizedSql.includes("from pg_class as c") &&
        normalizedSql.includes("join pg_attribute as a")
      ) {
        return { rows: columnCountRows };
      }

      if (
        normalizedSql.includes("join pg_index as i") &&
        normalizedSql.includes("i.indisprimary") &&
        normalizedSql.includes("unnest(i.indkey) with ordinality")
      ) {
        return { rows: primaryKeyRows };
      }

      expect(normalizedSql).not.toContain("from information_schema.columns");
      expect(normalizedSql).not.toContain("from information_schema.table_constraints");
      expect(normalizedSql).not.toContain("from information_schema.key_column_usage");
      throw new Error(`Unexpected query: ${sql}`);
    });

    const catalog = await getPostgresContentSchemaTableCatalog({ query } as never);

    expect(catalog).toHaveLength(1_000);
    expect(catalog[0]).toEqual({
      columnCount: 12,
      kind: "table",
      primaryKey: "id",
      rowCountEstimate: 500_000,
      schema: "public",
      table: "content_table_0000",
      tableRef: "public.content_table_0000",
    });
    expect(JSON.stringify(catalog).length).toBeLessThan(180_000);
    expect(
      query.mock.calls
        .map((call) => String(call[0]).toLowerCase())
        .some((sql) => sql.includes("select * from")),
    ).toBe(false);
  });

  it("captures generated columns and trigger definitions during schema introspection", async () => {
    const query = vi.fn(async (sql: string) => {
      const normalizedSql = sql.toLowerCase();

      if (normalizedSql.includes("row_count_estimate") && normalizedSql.includes("from pg_class as c")) {
        return {
          rows: [
            {
              object_kind: "table",
              row_count_estimate: "12",
              schema_name: "public",
              table_name: "posts",
            },
          ],
        };
      }

      if (normalizedSql.includes("from information_schema.columns")) {
        return {
          rows: [
            {
              column_default: null,
              column_name: "id",
              data_type: "uuid",
              is_generated: "NEVER",
              is_nullable: "NO",
              table_name: "posts",
              table_schema: "public",
              udt_name: "uuid",
              udt_schema: "pg_catalog",
            },
            {
              column_default: null,
              column_name: "created_at",
              data_type: "timestamp with time zone",
              is_generated: "ALWAYS",
              is_nullable: "NO",
              table_name: "posts",
              table_schema: "public",
              udt_name: "timestamptz",
              udt_schema: "pg_catalog",
            },
            {
              column_default: null,
              column_name: "updated_at",
              data_type: "timestamp with time zone",
              is_generated: "NEVER",
              is_nullable: "YES",
              table_name: "posts",
              table_schema: "public",
              udt_name: "timestamptz",
              udt_schema: "pg_catalog",
            },
          ],
        };
      }

      if (normalizedSql.includes("from pg_trigger as t")) {
        return {
          rows: [
            {
              table_name: "posts",
              table_schema: "public",
              trigger_definition:
                "CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at')",
            },
          ],
        };
      }

      if (normalizedSql.includes("constraint_type = 'primary key'")) {
        return {
          rows: [
            {
              column_name: "id",
              ordinal_position: 1,
              table_name: "posts",
              table_schema: "public",
            },
          ],
        };
      }

      if (normalizedSql.includes("constraint_type = 'foreign key'")) {
        return {
          rows: [],
        };
      }

      if (normalizedSql.includes("from pg_enum as e")) {
        return {
          rows: [],
        };
      }

      if (normalizedSql.includes("from pg_constraint as con")) {
        return {
          rows: [],
        };
      }

      if (normalizedSql.includes('select * from "public"."posts"')) {
        return {
          rows: [
            {
              created_at: "2026-04-08T00:00:00.000Z",
              id: "post-1",
              updated_at: "2026-04-08T01:00:00.000Z",
            },
          ],
        };
      }

      throw new Error(`Unexpected query: ${sql}`);
    });

    const schema = await introspectPostgresContentSchema({
      query,
    } as never);

    expect(schema.tables).toEqual([
      expect.objectContaining({
        kind: "table",
        name: "posts",
        primaryKey: "id",
        schema: "public",
        triggerDefinitions: [
          "CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at')",
        ],
      }),
    ]);
    expect(schema.tables[0]?.columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          isGenerated: true,
          name: "created_at",
        }),
        expect.objectContaining({
          isGenerated: false,
          name: "updated_at",
        }),
      ]),
    );
  });

  it("can limit introspection to a selected table and skip sampling unrelated tables", async () => {
    const query = vi.fn(async (sql: string) => {
      const normalizedSql = sql.toLowerCase();

      if (normalizedSql.includes("row_count_estimate") && normalizedSql.includes("from pg_class as c")) {
        return {
          rows: [
            {
              object_kind: "table",
              row_count_estimate: "12",
              schema_name: "public",
              table_name: "posts",
            },
            {
              object_kind: "table",
              row_count_estimate: "48",
              schema_name: "public",
              table_name: "audit_log",
            },
          ],
        };
      }

      if (normalizedSql.includes("from information_schema.columns")) {
        return {
          rows: [
            {
              column_default: null,
              column_name: "id",
              data_type: "uuid",
              is_generated: "NEVER",
              is_nullable: "NO",
              table_name: "posts",
              table_schema: "public",
              udt_name: "uuid",
              udt_schema: "pg_catalog",
            },
            {
              column_default: null,
              column_name: "title",
              data_type: "text",
              is_generated: "NEVER",
              is_nullable: "NO",
              table_name: "posts",
              table_schema: "public",
              udt_name: "text",
              udt_schema: "pg_catalog",
            },
            {
              column_default: null,
              column_name: "id",
              data_type: "uuid",
              is_generated: "NEVER",
              is_nullable: "NO",
              table_name: "audit_log",
              table_schema: "public",
              udt_name: "uuid",
              udt_schema: "pg_catalog",
            },
          ],
        };
      }

      if (normalizedSql.includes("from pg_trigger as t")) {
        return { rows: [] };
      }

      if (normalizedSql.includes("constraint_type = 'primary key'")) {
        return {
          rows: [
            {
              column_name: "id",
              ordinal_position: 1,
              table_name: "posts",
              table_schema: "public",
            },
            {
              column_name: "id",
              ordinal_position: 1,
              table_name: "audit_log",
              table_schema: "public",
            },
          ],
        };
      }

      if (normalizedSql.includes("constraint_type = 'foreign key'")) {
        return { rows: [] };
      }

      if (normalizedSql.includes("from pg_enum as e")) {
        return { rows: [] };
      }

      if (normalizedSql.includes("from pg_constraint as con")) {
        return { rows: [] };
      }

      if (normalizedSql.includes('select * from "public"."posts"')) {
        return {
          rows: [
            {
              id: "post-1",
              title: "Hello World",
            },
          ],
        };
      }

      if (normalizedSql.includes('select * from "public"."audit_log"')) {
        throw new Error("Should not sample unrelated tables.");
      }

      throw new Error(`Unexpected query: ${sql}`);
    });

    const schema = await introspectPostgresContentSchema(
      { query } as never,
      {
        focusTableRefs: ["public.posts"],
        includeSampleRows: "focused",
        maxSampleTables: 1,
        restrictToTableRefs: ["public.posts"],
      },
    );

    expect(schema.tables).toEqual([
      expect.objectContaining({
        name: "posts",
        sampleRows: [{ id: "post-1", title: "Hello World" }],
        schema: "public",
      }),
    ]);
    expect(
      query.mock.calls
        .map((call) => String(call[0]))
        .filter((sql) => sql.includes('select * from "public".')),
    ).toEqual([
      expect.stringContaining('select * from "public"."posts"'),
    ]);
  });

  it("keeps unmapped relations as suggestions until the user confirms them", () => {
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

    const detection = buildContentAutoMappingResult({
      tables: [
        {
          columns: [
            {
              dataType: "uuid",
              defaultValue: null,
              enumValues: null,
              isArray: false,
              isJson: false,
              isNullable: false,
              name: "id",
              udtName: "uuid",
            },
            {
              dataType: "text",
              defaultValue: null,
              enumValues: null,
              isArray: false,
              isJson: false,
              isNullable: false,
              name: "title",
              udtName: "text",
            },
            {
              dataType: "uuid",
              defaultValue: null,
              enumValues: null,
              isArray: false,
              isJson: false,
              isNullable: true,
              name: "category_id",
              udtName: "uuid",
            },
          ],
          foreignKeys: [
            {
              column: "category_id",
              targetColumn: "id",
              targetSchema: "public",
              targetTable: "categories",
            },
          ],
          kind: "table",
          name: "posts",
          primaryKey: "id",
          rowCountEstimate: 5,
          sampleRows: [{ category_id: "cat-1", id: "post-1", title: "Hello" }],
          schema: "public",
        },
        {
          columns: [
            {
              dataType: "uuid",
              defaultValue: null,
              enumValues: null,
              isArray: false,
              isJson: false,
              isNullable: false,
              name: "id",
              udtName: "uuid",
            },
            {
              dataType: "text",
              defaultValue: null,
              enumValues: null,
              isArray: false,
              isJson: false,
              isNullable: false,
              name: "name",
              udtName: "text",
            },
            {
              dataType: "text",
              defaultValue: null,
              enumValues: null,
              isArray: false,
              isJson: false,
              isNullable: true,
              name: "slug",
              udtName: "text",
            },
          ],
          foreignKeys: [],
          kind: "table",
          name: "categories",
          primaryKey: "id",
          rowCountEstimate: 5,
          sampleRows: [{ id: "cat-1", name: "News", slug: "news" }],
          schema: "public",
        },
      ],
    });

    const repaired = repairContentMappingConfig({
      detection,
      mappingConfig,
    });

    expect(repaired.entities.categories.status).toBe("unmapped");
    expect(repaired.entities.categories.source.table).toBeNull();
    expect(repaired.entities.posts.relations.categories.status).toBe("unmapped");
    expect(repaired.entities.posts.relations.categories.targetTable).toBeNull();
  });
});
