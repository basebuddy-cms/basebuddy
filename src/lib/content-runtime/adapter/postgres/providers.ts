import type { ContentDatabaseClient } from "@/lib/content-runtime/mapped-content-runtime-support";

import type { ContentProviderQueryResult } from "../contracts";
import type { ContentSqlFamilyProviderAdapter } from "../factory";

type QueryableClient = Pick<ContentDatabaseClient, "query">;

const createSqlProviderAdapter = (client: QueryableClient): ContentSqlFamilyProviderAdapter => ({
  async executeQuery<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<ContentProviderQueryResult<T>> {
    const result = await client.query<T>(sql, params);

    return {
      rowCount: result.rowCount ?? null,
      rows: result.rows,
    };
  },
  family: "sql",
});

export const createSupabaseSqlProviderAdapter = (client: QueryableClient): ContentSqlFamilyProviderAdapter =>
  createSqlProviderAdapter(client);

export const createPostgresSqlProviderAdapter = (client: QueryableClient): ContentSqlFamilyProviderAdapter =>
  createSqlProviderAdapter(client);

export const postgresContentRuntimeAdapterProvider = {
  createPostgresSqlProviderAdapter,
  createSupabaseSqlProviderAdapter,
  id: "postgres",
  label: "Postgres/Supabase",
} as const;
