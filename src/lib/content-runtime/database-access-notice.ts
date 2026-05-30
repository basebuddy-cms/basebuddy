import type { ContentEntityMapping } from "./mapping";
import type { ContentDatabaseReadAccessNotice } from "./shared";

type ContentDatabaseClient = {
  query: <T = Record<string, unknown>>(queryText: string, values?: unknown[]) => Promise<{ rows: T[] }>;
};

type TableAccessRow = {
  estimated_rows: number | string | null;
  rls_enabled: boolean | null;
};

const normalizeEstimatedRows = (value: number | string | null | undefined) => {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.floor(parsed);
};

const getEntityTable = (entity: ContentEntityMapping) => {
  const schema = entity.source.schema?.trim();
  const table = entity.source.table?.trim();

  if (
    (entity.source.kind !== "table" && entity.source.kind !== "view") ||
    !schema ||
    !table
  ) {
    return null;
  }

  return {
    schema,
    table,
    tableRef: `${schema}.${table}`,
  };
};

export const getContentDatabaseReadAccessNotice = async ({
  client,
  collectionLabel,
  entity,
  hasActiveFilters,
  visibleItemCount,
}: {
  client: ContentDatabaseClient;
  collectionLabel: string;
  entity: ContentEntityMapping;
  hasActiveFilters: boolean;
  visibleItemCount: number;
}): Promise<ContentDatabaseReadAccessNotice | null> => {
  if (visibleItemCount > 0 || hasActiveFilters) {
    return null;
  }

  const table = getEntityTable(entity);

  if (!table) {
    return null;
  }

  try {
    const result = await client.query<TableAccessRow>(
      `
        select
          c.reltuples::bigint as estimated_rows,
          c.relrowsecurity as rls_enabled
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = $1
          and c.relname = $2
        limit 1
      `,
      [table.schema, table.table],
    );
    const row = result.rows[0];

    if (!row) {
      return null;
    }

    const estimatedRows = normalizeEstimatedRows(row.estimated_rows);
    const hasLikelyRows = estimatedRows !== null && estimatedRows > 0;
    const hasLimitedPolicySignal = row.rls_enabled === true;

    if (!hasLikelyRows && !hasLimitedPolicySignal) {
      return null;
    }

    return {
      estimatedRows,
      kind: "database_read_access_limited",
      message: `BaseBuddy can connect to ${table.tableRef}, but this database connection cannot read any ${collectionLabel}. Use a database connection with read access to show the existing rows.`,
      tableRef: table.tableRef,
    };
  } catch {
    return null;
  }
};
