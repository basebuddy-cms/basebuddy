export type PostgresContentDatabaseClient = {
  query: <T extends object = Record<string, unknown>>(queryText: string, values?: unknown[]) => Promise<{ rows: T[] }>;
};

export type PostgresContentColumnMetadata = {
  dataType: string;
  defaultValue: string | null;
  isNullable: boolean;
  udtName: string | null;
};

export type PostgresContentResolvedTable = {
  kind: "table" | "view";
  primaryKey: string | null;
  schema: string;
  table: string;
};

export type PostgresContentForeignKeyTarget = {
  column: string | null;
  schema: string;
  table: string;
};

export const getPostgresContentTableMetadata = async ({
  client,
  schema,
  table,
}: {
  client: PostgresContentDatabaseClient;
  schema: string;
  table: string;
}): Promise<PostgresContentResolvedTable | null> => {
  const tableResult = await client.query<{ table_type: string }>(
    `
      select table_type
      from information_schema.tables
      where table_schema = $1
        and table_name = $2
      limit 1
    `,
    [schema, table],
  );

  if (!tableResult.rows.length) {
    return null;
  }

  const primaryKeyResult = await client.query<{ column_name: string }>(
    `
      select kcu.column_name
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name
       and tc.constraint_schema = kcu.constraint_schema
       and tc.table_schema = kcu.table_schema
       and tc.table_name = kcu.table_name
      where tc.constraint_type = 'PRIMARY KEY'
        and tc.table_schema = $1
        and tc.table_name = $2
      order by kcu.ordinal_position
      limit 1
    `,
    [schema, table],
  );

  return {
    kind: tableResult.rows[0]?.table_type === "VIEW" ? "view" : "table",
    primaryKey: primaryKeyResult.rows[0]?.column_name ?? null,
    schema,
    table,
  };
};

export const getPostgresContentForeignKeyTarget = async ({
  client,
  column,
  schema,
  table,
}: {
  client: PostgresContentDatabaseClient;
  column: string;
  schema: string;
  table: string;
}): Promise<PostgresContentForeignKeyTarget | null> => {
  const result = await client.query<{
    target_column: string | null;
    target_schema: string;
    target_table: string;
  }>(
    `
      select
        ccu.table_schema as target_schema,
        ccu.table_name as target_table,
        ccu.column_name as target_column
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name
       and tc.constraint_schema = kcu.constraint_schema
       and tc.table_schema = kcu.table_schema
       and tc.table_name = kcu.table_name
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name
       and ccu.constraint_schema = tc.constraint_schema
      where tc.constraint_type = 'FOREIGN KEY'
        and tc.table_schema = $1
        and tc.table_name = $2
        and kcu.column_name = $3
      limit 1
    `,
    [schema, table, column],
  );

  const row = result.rows[0];

  return row
    ? {
        column: row.target_column,
        schema: row.target_schema,
        table: row.target_table,
      }
    : null;
};

export const getPostgresContentColumnMetadata = async ({
  client,
  columnName,
  schema,
  table,
}: {
  client: PostgresContentDatabaseClient;
  columnName: string;
  schema: string;
  table: string;
}): Promise<PostgresContentColumnMetadata | null> => {
  const result = await client.query<{
    column_default: string | null;
    data_type: string;
    is_nullable: "NO" | "YES";
    udt_name: string | null;
  }>(
    `
      select
        data_type,
        udt_name,
        is_nullable,
        column_default
      from information_schema.columns
      where table_schema = $1
        and table_name = $2
        and column_name = $3
      limit 1
    `,
    [schema, table, columnName],
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    dataType: row.data_type,
    defaultValue: row.column_default,
    isNullable: row.is_nullable === "YES",
    udtName: row.udt_name,
  };
};

export const getPostgresContentAvailableColumns = async ({
  client,
  schema,
  table,
}: {
  client: PostgresContentDatabaseClient;
  schema: string;
  table: string;
}) => {
  const result = await client.query<{ column_name: string }>(
    `
      select column_name
      from information_schema.columns
      where table_schema = $1
        and table_name = $2
    `,
    [schema, table],
  );

  return new Map(
    result.rows
      .map((row) => row.column_name?.trim())
      .filter(Boolean)
      .map((columnName) => [columnName!.toLowerCase(), columnName!]),
  );
};
