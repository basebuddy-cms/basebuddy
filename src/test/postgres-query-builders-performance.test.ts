import { describe, expect, it } from "vitest";

import {
  buildPostgresApproximateTableRowEstimateQuery,
  buildPostgresBoundedExactCountQuery,
  buildPostgresCategoryChildExistsQuery,
  buildPostgresEntityCursorPageRowsQuery,
  buildPostgresEntityRowsQuery,
  buildPostgresIndexedPrefixSearchPredicate,
  buildPostgresRelationOptionSearchQuery,
  buildPostgresSelectedIdsHydrationQuery,
  buildPostgresTrigramSearchPredicate,
} from "@/lib/content-runtime/adapter/postgres/query-builders";

const compactSql = (sql: string) => sql.replace(/\s+/g, " ").trim();

describe("Postgres performance query builders", () => {
  it("builds cursor pagination SQL with a deterministic cursor predicate and limit", () => {
    const sql = compactSql(
      buildPostgresEntityCursorPageRowsQuery({
        cursorClause: '("updated_at", "id") < ($2::timestamptz, $3::text)',
        filterClause: 'where "status"::text = $1::text',
        limitParamIndex: 4,
        orderClause: 'order by "updated_at" desc, "id" desc',
        selectClause: '"id", "title", "updated_at"',
        tableName: '"public"."posts"',
      }),
    );

    expect(sql).toBe(
      'select "id", "title", "updated_at" from "public"."posts" where "status"::text = $1::text and ("updated_at", "id") < ($2::timestamptz, $3::text) order by "updated_at" desc, "id" desc limit $4',
    );
  });

  it("builds cursor pagination SQL without a filter clause", () => {
    const sql = compactSql(
      buildPostgresEntityCursorPageRowsQuery({
        cursorClause: '"id"::text > $1::text',
        filterClause: "",
        limitParamIndex: 2,
        orderClause: 'order by "id" asc',
        selectClause: '"id"',
        tableName: '"public"."posts"',
      }),
    );

    expect(sql).toBe(
      'select "id" from "public"."posts" where "id"::text > $1::text order by "id" asc limit $2',
    );
  });

  it("builds selected-ID hydration SQL that preserves caller selection order", () => {
    const sql = compactSql(
      buildPostgresSelectedIdsHydrationQuery({
        idColumn: "id",
        labelExpression: 'coalesce("display_name", "slug", "id"::text)',
        metadataExpressions: {
          slug: '"slug"::text',
        },
        tableName: '"public"."authors"',
      }),
    );

    expect(sql).toBe(
      'select "id"::text as id, coalesce("display_name", "slug", "id"::text)::text as label, jsonb_build_object(\'slug\', "slug"::text) as metadata from "public"."authors" where "id"::text = any($1::text[]) order by array_position($1::text[], "id"::text)',
    );
  });

  it("builds native entity ID hydration SQL for mapped collection rows", () => {
    const sql = compactSql(
      buildPostgresEntityRowsQuery({
        filterByIds: true,
        idColumn: "id",
        selectClause: '"id", "name", "parent_id"',
        tableName: '"public"."categories"',
      }),
    );

    expect(sql).toBe(
      'select "id", "name", "parent_id" from "public"."categories" where "id" = any($1)',
    );
  });

  it("builds limited relation option search SQL", () => {
    const sql = compactSql(
      buildPostgresRelationOptionSearchQuery({
        idColumn: "id",
        labelExpression: 'coalesce("name", "slug", "id"::text)',
        limitParamIndex: 2,
        orderClause: 'order by lower(coalesce("name", "slug", "id"::text)), "id"::text',
        searchParamIndex: 1,
        searchPredicate: 'lower(coalesce("name", "slug", "id"::text)) like lower($1::text || \'%\')',
        tableName: '"public"."categories"',
      }),
    );

    expect(sql).toBe(
      'select "id"::text as id, coalesce("name", "slug", "id"::text)::text as label from "public"."categories" where lower(coalesce("name", "slug", "id"::text)) like lower($1::text || \'%\') order by lower(coalesce("name", "slug", "id"::text)), "id"::text limit $2',
    );
  });

  it("builds approximate and bounded count SQL", () => {
    expect(compactSql(buildPostgresApproximateTableRowEstimateQuery())).toBe(
      "select coalesce(c.reltuples::bigint, 0)::text as estimated_count from pg_class c where c.oid = to_regclass($1)",
    );

    expect(
      compactSql(
        buildPostgresBoundedExactCountQuery({
          filterClause: 'where "status"::text = $1::text',
          limitParamIndex: 2,
          tableName: '"public"."posts"',
        }),
      ),
    ).toBe(
      'select count(*)::text as count, (count(*) >= $2::bigint) as reached_limit from (select 1 from "public"."posts" where "status"::text = $1::text limit $2) as bounded_count',
    );
  });

  it("builds prefix and trigram search predicates with explicit parameter ownership", () => {
    expect(
      buildPostgresIndexedPrefixSearchPredicate({
        expression: 'coalesce("name", "slug", "id"::text)',
        paramIndex: 3,
      }),
    ).toBe('lower(coalesce("name", "slug", "id"::text)) like lower($3::text || \'%\')');

    expect(
      buildPostgresTrigramSearchPredicate({
        expression: 'coalesce("name", "slug", "id"::text)',
        paramIndex: 4,
      }),
    ).toBe('coalesce("name", "slug", "id"::text) ilike \'%\' || $4::text || \'%\'');
  });

  it("builds bounded category child-exists SQL for visible category rows", () => {
    const sql = compactSql(
      buildPostgresCategoryChildExistsQuery({
        idColumn: "id",
        limitParamIndex: 2,
        parentColumn: "parent_id",
        tableName: '"public"."categories"',
      }),
    );

    expect(sql).toBe(
      'select distinct "parent_id"::text as parent_id from "public"."categories" where "parent_id" = any($1) limit $2',
    );
  });
});
