import "server-only";

import type { Client } from "pg";

import type {
  ContentAutoMappingResult,
  ContentIntrospectedColumn,
  ContentIntrospectedForeignKey,
  ContentIntrospectedTable,
  ContentSchemaIntrospection,
} from "../../introspection";
import type {
  ContentEntityMapping,
  ContentMappingConfig,
  ContentMappingEntityKey,
} from "../../mapping";

type ContentDatabaseClient = Pick<Client, "query">;
type PostgresContentSchemaIntrospectionOptions = {
  focusTableRefs?: string[];
  includeSampleRows?: "all" | "focused" | "none";
  maxSampleTables?: number;
  restrictToTableRefs?: string[];
};

type PostgresContentIntrospectionTableRow = {
  object_kind: "table" | "view";
  row_count_estimate: number | string | null;
  schema_name: string;
  table_name: string;
};

type PostgresContentIntrospectionColumnRow = {
  column_default: string | null;
  column_name: string;
  data_type: string;
  is_generated: "ALWAYS" | "NEVER" | "YES" | "NO" | null;
  is_nullable: "NO" | "YES";
  table_name: string;
  table_schema: string;
  udt_name: string | null;
  udt_schema: string | null;
};

type PostgresContentIntrospectionColumnCountRow = {
  column_count: number | string;
  table_name: string;
  table_schema: string;
};

type PostgresContentIntrospectionTriggerRow = {
  table_name: string;
  table_schema: string;
  trigger_definition: string;
};

type PostgresContentIntrospectionPrimaryKeyRow = {
  column_name: string;
  ordinal_position: number | string;
  table_name: string;
  table_schema: string;
};

type PostgresContentIntrospectionForeignKeyRow = {
  column_name: string;
  foreign_column_name: string;
  foreign_table_name: string;
  foreign_table_schema: string;
  table_name: string;
  table_schema: string;
};

type PostgresContentIntrospectionEnumRow = {
  enum_label: string;
  type_name: string;
  type_schema: string;
};

type PostgresContentIntrospectionCheckConstraintRow = {
  column_name: string;
  constraint_def: string;
  table_name: string;
  table_schema: string;
};

export type PostgresContentSchemaTableCatalogEntry = {
  columnCount: number;
  kind: "table" | "view";
  primaryKey: string | null;
  rowCountEstimate: number | null;
  schema: string;
  table: string;
  tableRef: string;
};

const POSTGRES_CONTENT_INTROSPECTION_EXCLUDED_SCHEMAS = [
  "auth",
  "extensions",
  "graphql",
  "graphql_public",
  "information_schema",
  "pg_catalog",
  "pg_toast",
  "realtime",
  "storage",
  "supabase_functions",
  "supabase_migrations",
  "vault",
] as const;

const quotePostgresContentIdentifier = (value: string) => `"${value.replace(/"/g, "\"\"")}"`;

const quoteQualifiedPostgresContentTable = (schema: string, table: string) =>
  `${quotePostgresContentIdentifier(schema)}.${quotePostgresContentIdentifier(table)}`;

const parsePostgresContentScopedTableRef = (tableRef: string | null | undefined) => {
  const normalizedTableRef = tableRef?.trim();

  if (!normalizedTableRef) {
    return null;
  }

  const [schema, ...tableSegments] = normalizedTableRef.split(".");
  const normalizedSchema = schema?.trim() || "public";
  const normalizedTable = tableSegments.join(".").trim();

  if (!normalizedTable) {
    return null;
  }

  return {
    schema: normalizedSchema,
    table: normalizedTable,
  };
};

const buildPostgresContentTableFilterClause = ({
  params,
  schemaColumn,
  tableColumn,
  tableRefs,
}: {
  params: unknown[];
  schemaColumn: string;
  tableColumn: string;
  tableRefs: string[] | undefined;
}) => {
  const parsedTableRefs = (tableRefs ?? [])
    .map((tableRef) => parsePostgresContentScopedTableRef(tableRef))
    .filter((value): value is { schema: string; table: string } => Boolean(value));

  if (!parsedTableRefs.length) {
    return {
      clause: "",
      params,
    };
  }

  const nextParams = [...params];
  const clause = parsedTableRefs
    .map(({ schema, table }) => {
      const schemaParamIndex = nextParams.push(schema);
      const tableParamIndex = nextParams.push(table);
      return `(${schemaColumn} = $${schemaParamIndex} and ${tableColumn} = $${tableParamIndex})`;
    })
    .join(" or ");

  return {
    clause: ` and (${clause})`,
    params: nextParams,
  };
};

const isPostgresContentIntrospectionSchemaAllowed = (schemaName: string) =>
  !POSTGRES_CONTENT_INTROSPECTION_EXCLUDED_SCHEMAS.includes(
    schemaName as (typeof POSTGRES_CONTENT_INTROSPECTION_EXCLUDED_SCHEMAS)[number],
  ) &&
  !schemaName.startsWith("pg_temp_") &&
  !schemaName.startsWith("pg_toast_temp_");

const sanitizePostgresContentSampleValue = (value: unknown): unknown => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizePostgresContentSampleValue(entry));
  }

  if (value && typeof value === "object" && !Buffer.isBuffer(value)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        sanitizePostgresContentSampleValue(entry),
      ]),
    );
  }

  if (Buffer.isBuffer(value)) {
    return value.toString("base64");
  }

  return value;
};

const buildPostgresContentAllowedTableRefs = (tableRefs?: string[]) => {
  const parsedTableFilters = (tableRefs ?? [])
    .map((tableRef) => parsePostgresContentScopedTableRef(tableRef))
    .filter((value): value is { schema: string; table: string } => Boolean(value));

  return parsedTableFilters.length > 0
    ? new Set(parsedTableFilters.map(({ schema, table }) => `${schema}.${table}`))
    : null;
};

const getPostgresContentSampleRows = async (
  client: ContentDatabaseClient,
  table: Pick<ContentIntrospectedTable, "name" | "primaryKey" | "schema">,
) => {
  try {
    const orderByClause = table.primaryKey
      ? ` order by ${quotePostgresContentIdentifier(table.primaryKey)} desc`
      : "";
    const result = await client.query<Record<string, unknown>>(
      `select * from ${quoteQualifiedPostgresContentTable(table.schema, table.name)}${orderByClause} limit 3`,
    );

    return result.rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, sanitizePostgresContentSampleValue(value)]),
      ),
    );
  } catch {
    return [];
  }
};

const parseCheckConstraintEnumValues = (constraintDef: string): string[] | null => {
  const arrayMatch = /ARRAY\[([^\]]+)\]/.exec(constraintDef);

  if (arrayMatch) {
    const entries = arrayMatch[1]
      .split(",")
      .map((entry) => {
        const quotedMatch = /'((?:[^']|'')*)'/.exec(entry.trim());
        return quotedMatch ? quotedMatch[1].replace(/''/g, "'") : null;
      })
      .filter((v): v is string => v !== null);

    if (entries.length >= 2) return entries;
  }

  const castArrayMatch = /'\{([^}]+)\}'::/.exec(constraintDef);

  if (castArrayMatch) {
    const entries = castArrayMatch[1].split(",").map((v) => v.trim()).filter(Boolean);

    if (entries.length >= 2) return entries;
  }

  return null;
};

const scorePostgresContentSampleCandidate = (
  table: Pick<ContentIntrospectedTable, "columns" | "kind" | "name" | "rowCountEstimate">,
) => {
  const normalizedTableName = table.name.toLowerCase();
  const normalizedColumnNames = table.columns.map((column) => column.name.toLowerCase());
  let score = 0;

  if (table.kind === "table") {
    score += 8;
  }

  if (/(post|article|story|page|entry|content|blog)/.test(normalizedTableName)) {
    score += 28;
  }

  if (/(author|writer|category|tag|media|image|file|asset)/.test(normalizedTableName)) {
    score += 12;
  }

  if (normalizedColumnNames.some((columnName) => /^(title|headline|name)$/.test(columnName))) {
    score += 10;
  }

  if (normalizedColumnNames.some((columnName) => /(slug|status|published_at|content|body|excerpt)/.test(columnName))) {
    score += 12;
  }

  if (normalizedColumnNames.some((columnName) => /(revision|history|audit|event)/.test(columnName))) {
    score -= 18;
  }

  if ((table.rowCountEstimate ?? 0) > 0) {
    score += 4;
  }

  return score;
};

const resolvePostgresContentTablesToSample = ({
  focusTableRefs,
  maxSampleTables,
  mode,
  tables,
}: {
  focusTableRefs?: string[];
  maxSampleTables?: number;
  mode: PostgresContentSchemaIntrospectionOptions["includeSampleRows"];
  tables: ContentIntrospectedTable[];
}) => {
  if (mode === "none") {
    return new Set<string>();
  }

  if (mode === "all") {
    return new Set(tables.map((table) => `${table.schema}.${table.name}`));
  }

  const normalizedMaxSampleTables = Math.max(1, maxSampleTables ?? 12);
  const focusRefs = new Set((focusTableRefs ?? []).map((tableRef) => tableRef.trim()).filter(Boolean));
  const rankedTableRefs = [...tables]
    .sort((left, right) => {
      const leftRef = `${left.schema}.${left.name}`;
      const rightRef = `${right.schema}.${right.name}`;
      const leftFocusBoost = focusRefs.has(leftRef) ? 1_000 : 0;
      const rightFocusBoost = focusRefs.has(rightRef) ? 1_000 : 0;

      return (
        rightFocusBoost + scorePostgresContentSampleCandidate(right) -
          (leftFocusBoost + scorePostgresContentSampleCandidate(left)) ||
        leftRef.localeCompare(rightRef)
      );
    })
    .slice(0, normalizedMaxSampleTables)
    .map((table) => `${table.schema}.${table.name}`);

  return new Set(rankedTableRefs);
};

export const introspectPostgresContentSchema = async (
  client: ContentDatabaseClient,
  options: PostgresContentSchemaIntrospectionOptions = {},
): Promise<ContentSchemaIntrospection> => {
  const sampleRowsMode = options.includeSampleRows ?? "all";
  const allowedTableRefs = buildPostgresContentAllowedTableRefs(options.restrictToTableRefs);
  const tablesFilter = buildPostgresContentTableFilterClause({
    params: [[...POSTGRES_CONTENT_INTROSPECTION_EXCLUDED_SCHEMAS]],
    schemaColumn: "n.nspname",
    tableColumn: "c.relname",
    tableRefs: options.restrictToTableRefs,
  });
  const tablesResult = await client.query<PostgresContentIntrospectionTableRow>(
    `
      select
        n.nspname as schema_name,
        c.relname as table_name,
        case
          when c.relkind = 'r' then 'table'
          else 'view'
        end as object_kind,
        case
          when c.relkind = 'r' then greatest(c.reltuples, 0)::bigint::text
          else null
        end as row_count_estimate
      from pg_class as c
      inner join pg_namespace as n
        on n.oid = c.relnamespace
      where c.relkind in ('r', 'v', 'm')
        and n.nspname <> all($1::text[])
        and n.nspname not like 'pg_temp_%'
        and n.nspname not like 'pg_toast_temp_%'
        ${tablesFilter.clause}
      order by n.nspname, c.relname
    `,
    tablesFilter.params,
  );
  const columnsFilter = buildPostgresContentTableFilterClause({
    params: [[...POSTGRES_CONTENT_INTROSPECTION_EXCLUDED_SCHEMAS]],
    schemaColumn: "table_schema",
    tableColumn: "table_name",
    tableRefs: options.restrictToTableRefs,
  });
  const columnsResult = await client.query<PostgresContentIntrospectionColumnRow>(
    `
      select
        table_schema,
        table_name,
        column_name,
        data_type,
        udt_name,
        is_nullable,
        is_generated,
        column_default,
        udt_schema
      from information_schema.columns
      where table_schema <> all($1::text[])
        and table_schema not like 'pg_temp_%'
        and table_schema not like 'pg_toast_temp_%'
        ${columnsFilter.clause}
      order by table_schema, table_name, ordinal_position
    `,
    columnsFilter.params,
  );
  const triggersFilter = buildPostgresContentTableFilterClause({
    params: [[...POSTGRES_CONTENT_INTROSPECTION_EXCLUDED_SCHEMAS]],
    schemaColumn: "n.nspname",
    tableColumn: "c.relname",
    tableRefs: options.restrictToTableRefs,
  });
  const triggersResult = await client.query<PostgresContentIntrospectionTriggerRow>(
    `
      select
        n.nspname as table_schema,
        c.relname as table_name,
        pg_get_triggerdef(t.oid) as trigger_definition
      from pg_trigger as t
      inner join pg_class as c
        on c.oid = t.tgrelid
      inner join pg_namespace as n
        on n.oid = c.relnamespace
      where not t.tgisinternal
        and c.relkind in ('r', 'v', 'm')
        and n.nspname <> all($1::text[])
        and n.nspname not like 'pg_temp_%'
        and n.nspname not like 'pg_toast_temp_%'
        ${triggersFilter.clause}
      order by n.nspname, c.relname, t.tgname
    `,
    triggersFilter.params,
  );
  const primaryKeysFilter = buildPostgresContentTableFilterClause({
    params: [[...POSTGRES_CONTENT_INTROSPECTION_EXCLUDED_SCHEMAS]],
    schemaColumn: "kcu.table_schema",
    tableColumn: "kcu.table_name",
    tableRefs: options.restrictToTableRefs,
  });
  const primaryKeysResult = await client.query<PostgresContentIntrospectionPrimaryKeyRow>(
    `
      select
        kcu.table_schema,
        kcu.table_name,
        kcu.column_name,
        kcu.ordinal_position
      from information_schema.table_constraints as tc
      inner join information_schema.key_column_usage as kcu
        on tc.constraint_name = kcu.constraint_name
       and tc.table_schema = kcu.table_schema
       and tc.table_name = kcu.table_name
      where tc.constraint_type = 'PRIMARY KEY'
        and kcu.table_schema <> all($1::text[])
        and kcu.table_schema not like 'pg_temp_%'
        and kcu.table_schema not like 'pg_toast_temp_%'
        ${primaryKeysFilter.clause}
      order by kcu.table_schema, kcu.table_name, kcu.ordinal_position
    `,
    primaryKeysFilter.params,
  );
  const foreignKeysFilter = buildPostgresContentTableFilterClause({
    params: [[...POSTGRES_CONTENT_INTROSPECTION_EXCLUDED_SCHEMAS]],
    schemaColumn: "kcu.table_schema",
    tableColumn: "kcu.table_name",
    tableRefs: options.restrictToTableRefs,
  });
  const foreignKeysResult = await client.query<PostgresContentIntrospectionForeignKeyRow>(
    `
      select
        kcu.table_schema,
        kcu.table_name,
        kcu.column_name,
        ccu.table_schema as foreign_table_schema,
        ccu.table_name as foreign_table_name,
        ccu.column_name as foreign_column_name
      from information_schema.table_constraints as tc
      inner join information_schema.key_column_usage as kcu
        on tc.constraint_name = kcu.constraint_name
       and tc.table_schema = kcu.table_schema
       and tc.table_name = kcu.table_name
      inner join information_schema.constraint_column_usage as ccu
        on tc.constraint_name = ccu.constraint_name
       and tc.table_schema = ccu.table_schema
      where tc.constraint_type = 'FOREIGN KEY'
        and kcu.table_schema <> all($1::text[])
        and kcu.table_schema not like 'pg_temp_%'
        and kcu.table_schema not like 'pg_toast_temp_%'
        ${foreignKeysFilter.clause}
      order by kcu.table_schema, kcu.table_name, kcu.column_name
    `,
    foreignKeysFilter.params,
  );
  const enumsResult = await client.query<PostgresContentIntrospectionEnumRow>(
    `
      select
        n.nspname as type_schema,
        t.typname as type_name,
        e.enumlabel as enum_label
      from pg_enum as e
      inner join pg_type as t on t.oid = e.enumtypid
      inner join pg_namespace as n on n.oid = t.typnamespace
      where n.nspname <> all($1::text[])
        and n.nspname not like 'pg_temp_%'
        and n.nspname not like 'pg_toast_temp_%'
      order by n.nspname, t.typname, e.enumsortorder
    `,
    [[...POSTGRES_CONTENT_INTROSPECTION_EXCLUDED_SCHEMAS]],
  );
  const checkConstraintsResult = await client.query<PostgresContentIntrospectionCheckConstraintRow>(
    `
      select
        n.nspname as table_schema,
        c.relname as table_name,
        a.attname as column_name,
        pg_get_constraintdef(con.oid) as constraint_def
      from pg_constraint as con
      inner join pg_class as c on c.oid = con.conrelid
      inner join pg_namespace as n on n.oid = c.relnamespace
      inner join pg_attribute as a
        on a.attrelid = con.conrelid
       and a.attnum = any(con.conkey)
       and array_length(con.conkey, 1) = 1
      where con.contype = 'c'
        and n.nspname <> all($1::text[])
        and n.nspname not like 'pg_temp_%'
        and n.nspname not like 'pg_toast_temp_%'
      order by n.nspname, c.relname, a.attname
    `,
    [[...POSTGRES_CONTENT_INTROSPECTION_EXCLUDED_SCHEMAS]],
  );

  const enumValuesByType = new Map<string, string[]>();

  for (const row of enumsResult.rows) {
    const key = `${row.type_schema}.${row.type_name}`;
    const current = enumValuesByType.get(key) ?? [];
    current.push(row.enum_label);
    enumValuesByType.set(key, current);
  }

  const checkEnumsByTableColumn = new Map<string, string[]>();

  for (const row of checkConstraintsResult.rows) {
    if (!isPostgresContentIntrospectionSchemaAllowed(row.table_schema)) {
      continue;
    }

    const values = parseCheckConstraintEnumValues(row.constraint_def);

    if (values) {
      checkEnumsByTableColumn.set(`${row.table_schema}.${row.table_name}.${row.column_name}`, values);
    }
  }

  const primaryKeyByTable = new Map<string, string>();

  for (const row of primaryKeysResult.rows) {
    const key = `${row.table_schema}.${row.table_name}`;

    if (!primaryKeyByTable.has(key)) {
      primaryKeyByTable.set(key, row.column_name);
    }
  }

  const columnsByTable = new Map<string, ContentIntrospectedColumn[]>();

  for (const row of columnsResult.rows) {
    if (!isPostgresContentIntrospectionSchemaAllowed(row.table_schema)) {
      continue;
    }

    const key = `${row.table_schema}.${row.table_name}`;

    if (allowedTableRefs && !allowedTableRefs.has(key)) {
      continue;
    }

    const currentColumns = columnsByTable.get(key) ?? [];
    const udtTypeKey = row.udt_schema && row.udt_name ? `${row.udt_schema}.${row.udt_name}` : null;
    const enumValuesFromType = udtTypeKey ? (enumValuesByType.get(udtTypeKey) ?? null) : null;
    const enumValuesFromCheck =
      checkEnumsByTableColumn.get(`${row.table_schema}.${row.table_name}.${row.column_name}`) ?? null;
    currentColumns.push({
      dataType: row.data_type,
      defaultValue: row.column_default,
      enumValues: enumValuesFromType ?? enumValuesFromCheck,
      isArray: (row.udt_name ?? "").startsWith("_"),
      isGenerated: row.is_generated === "ALWAYS" || row.is_generated === "YES",
      isJson: row.data_type === "json" || row.data_type === "jsonb",
      isNullable: row.is_nullable === "YES",
      name: row.column_name,
      udtName: row.udt_name,
    });
    columnsByTable.set(key, currentColumns);
  }

  const foreignKeysByTable = new Map<string, ContentIntrospectedForeignKey[]>();

  for (const row of foreignKeysResult.rows) {
    if (!isPostgresContentIntrospectionSchemaAllowed(row.table_schema)) {
      continue;
    }

    const key = `${row.table_schema}.${row.table_name}`;

    if (allowedTableRefs && !allowedTableRefs.has(key)) {
      continue;
    }

    const currentForeignKeys = foreignKeysByTable.get(key) ?? [];
    currentForeignKeys.push({
      column: row.column_name,
      targetColumn: row.foreign_column_name,
      targetSchema: row.foreign_table_schema,
      targetTable: row.foreign_table_name,
    });
    foreignKeysByTable.set(key, currentForeignKeys);
  }

  const triggerDefinitionsByTable = new Map<string, string[]>();

  for (const row of triggersResult.rows) {
    if (!isPostgresContentIntrospectionSchemaAllowed(row.table_schema)) {
      continue;
    }

    const key = `${row.table_schema}.${row.table_name}`;

    if (allowedTableRefs && !allowedTableRefs.has(key)) {
      continue;
    }

    const currentTriggerDefinitions = triggerDefinitionsByTable.get(key) ?? [];
    currentTriggerDefinitions.push(row.trigger_definition);
    triggerDefinitionsByTable.set(key, currentTriggerDefinitions);
  }

  const tables: ContentIntrospectedTable[] = [];

  for (const row of tablesResult.rows) {
    if (!isPostgresContentIntrospectionSchemaAllowed(row.schema_name)) {
      continue;
    }

    const key = `${row.schema_name}.${row.table_name}`;

    if (allowedTableRefs && !allowedTableRefs.has(key)) {
      continue;
    }

    const rowCountEstimate =
      typeof row.row_count_estimate === "number"
        ? row.row_count_estimate
        : typeof row.row_count_estimate === "string"
          ? Number.parseInt(row.row_count_estimate, 10)
          : null;

    tables.push({
      columns: columnsByTable.get(key) ?? [],
      foreignKeys: foreignKeysByTable.get(key) ?? [],
      kind: row.object_kind,
      name: row.table_name,
      primaryKey: primaryKeyByTable.get(key) ?? null,
      rowCountEstimate: Number.isFinite(rowCountEstimate) ? rowCountEstimate : null,
      sampleRows: [],
      schema: row.schema_name,
      triggerDefinitions: triggerDefinitionsByTable.get(key) ?? [],
    });
  }

  const tableRefsToSample = resolvePostgresContentTablesToSample({
    focusTableRefs: options.focusTableRefs ?? options.restrictToTableRefs,
    maxSampleTables: options.maxSampleTables,
    mode: sampleRowsMode,
    tables,
  });

  for (const table of tables) {
    const tableRef = `${table.schema}.${table.name}`;
    table.sampleRows = tableRefsToSample.has(tableRef)
      ? await getPostgresContentSampleRows(client, table)
      : [];
  }

  return {
    tables,
  };
};

export const getPostgresContentSchemaTableCatalog = async (
  client: ContentDatabaseClient,
  options: Pick<PostgresContentSchemaIntrospectionOptions, "restrictToTableRefs"> = {},
): Promise<PostgresContentSchemaTableCatalogEntry[]> => {
  const allowedTableRefs = buildPostgresContentAllowedTableRefs(options.restrictToTableRefs);
  const tablesFilter = buildPostgresContentTableFilterClause({
    params: [[...POSTGRES_CONTENT_INTROSPECTION_EXCLUDED_SCHEMAS]],
    schemaColumn: "n.nspname",
    tableColumn: "c.relname",
    tableRefs: options.restrictToTableRefs,
  });
  const tablesResult = await client.query<PostgresContentIntrospectionTableRow>(
    `
      select
        n.nspname as schema_name,
        c.relname as table_name,
        case
          when c.relkind = 'r' then 'table'
          else 'view'
        end as object_kind,
        case
          when c.relkind = 'r' then greatest(c.reltuples, 0)::bigint::text
          else null
        end as row_count_estimate
      from pg_class as c
      inner join pg_namespace as n
        on n.oid = c.relnamespace
      where c.relkind in ('r', 'v', 'm')
        and n.nspname <> all($1::text[])
        and n.nspname not like 'pg_temp_%'
        and n.nspname not like 'pg_toast_temp_%'
        ${tablesFilter.clause}
      order by n.nspname, c.relname
    `,
    tablesFilter.params,
  );
  const columnCountsFilter = buildPostgresContentTableFilterClause({
    params: [[...POSTGRES_CONTENT_INTROSPECTION_EXCLUDED_SCHEMAS]],
    schemaColumn: "n.nspname",
    tableColumn: "c.relname",
    tableRefs: options.restrictToTableRefs,
  });
  const columnCountsResult = await client.query<PostgresContentIntrospectionColumnCountRow>(
    `
      select
        n.nspname as table_schema,
        c.relname as table_name,
        count(a.attnum)::int as column_count
      from pg_class as c
      inner join pg_namespace as n
        on n.oid = c.relnamespace
      inner join pg_attribute as a
        on a.attrelid = c.oid
       and a.attnum > 0
       and not a.attisdropped
      where c.relkind in ('r', 'v', 'm')
        and n.nspname <> all($1::text[])
        and n.nspname not like 'pg_temp_%'
        and n.nspname not like 'pg_toast_temp_%'
        ${columnCountsFilter.clause}
      group by n.nspname, c.relname
      order by n.nspname, c.relname
    `,
    columnCountsFilter.params,
  );
  const primaryKeysFilter = buildPostgresContentTableFilterClause({
    params: [[...POSTGRES_CONTENT_INTROSPECTION_EXCLUDED_SCHEMAS]],
    schemaColumn: "n.nspname",
    tableColumn: "c.relname",
    tableRefs: options.restrictToTableRefs,
  });
  const primaryKeysResult = await client.query<PostgresContentIntrospectionPrimaryKeyRow>(
    `
      select
        n.nspname as table_schema,
        c.relname as table_name,
        a.attname as column_name,
        key_position.ordinality::int as ordinal_position
      from pg_class as c
      inner join pg_namespace as n
        on n.oid = c.relnamespace
      inner join pg_index as i
        on i.indrelid = c.oid
       and i.indisprimary
      inner join lateral unnest(i.indkey) with ordinality as key_position(attnum, ordinality)
        on true
      inner join pg_attribute as a
        on a.attrelid = c.oid
       and a.attnum = key_position.attnum
      where c.relkind in ('r', 'v', 'm')
        and n.nspname <> all($1::text[])
        and n.nspname not like 'pg_temp_%'
        and n.nspname not like 'pg_toast_temp_%'
        ${primaryKeysFilter.clause}
      order by n.nspname, c.relname, key_position.ordinality
    `,
    primaryKeysFilter.params,
  );

  const columnCountByTable = new Map<string, number>();

  for (const row of columnCountsResult.rows) {
    if (!isPostgresContentIntrospectionSchemaAllowed(row.table_schema)) {
      continue;
    }

    const key = `${row.table_schema}.${row.table_name}`;

    if (allowedTableRefs && !allowedTableRefs.has(key)) {
      continue;
    }

    const columnCount =
      typeof row.column_count === "number"
        ? row.column_count
        : Number.parseInt(row.column_count, 10);

    columnCountByTable.set(key, Number.isFinite(columnCount) ? columnCount : 0);
  }

  const primaryKeyByTable = new Map<string, string>();

  for (const row of primaryKeysResult.rows) {
    const key = `${row.table_schema}.${row.table_name}`;

    if (!primaryKeyByTable.has(key)) {
      primaryKeyByTable.set(key, row.column_name);
    }
  }

  return tablesResult.rows.flatMap((row) => {
    if (!isPostgresContentIntrospectionSchemaAllowed(row.schema_name)) {
      return [];
    }

    const key = `${row.schema_name}.${row.table_name}`;

    if (allowedTableRefs && !allowedTableRefs.has(key)) {
      return [];
    }

    const rowCountEstimate =
      typeof row.row_count_estimate === "number"
        ? row.row_count_estimate
        : typeof row.row_count_estimate === "string"
          ? Number.parseInt(row.row_count_estimate, 10)
          : null;

    return [
      {
        columnCount: columnCountByTable.get(key) ?? 0,
        kind: row.object_kind,
        primaryKey: primaryKeyByTable.get(key) ?? null,
        rowCountEstimate: Number.isFinite(rowCountEstimate) ? rowCountEstimate : null,
        schema: row.schema_name,
        table: row.table_name,
        tableRef: key,
      },
    ];
  });
};

const cloneContentMappingConfig = (mappingConfig: ContentMappingConfig) =>
  JSON.parse(JSON.stringify(mappingConfig)) as ContentMappingConfig;

const getPostgresContentIntrospectionTableRef = (
  table: Pick<ContentIntrospectedTable, "name" | "schema"> | null | undefined,
) => (table ? `${table.schema}.${table.name}` : null);

const parseContentTableRef = (tableRef: string | null | undefined, fallbackSchema?: string | null) => {
  const normalized = tableRef?.trim();

  if (!normalized) {
    return null;
  }

  const parts = normalized.split(".");

  if (parts.length >= 2) {
    return {
      schema: parts[0]!.trim() || "public",
      table: parts.slice(1).join(".").trim(),
    };
  }

  return {
    schema: fallbackSchema?.trim() || "public",
    table: normalized,
  };
};

const getContentEntitySourceRef = (entity: ContentEntityMapping) =>
  entity.source.schema?.trim() && entity.source.table?.trim()
    ? `${entity.source.schema}.${entity.source.table}`
    : null;

export const repairContentMappingConfig = ({
  detection,
  mappingConfig,
}: {
  detection: ContentAutoMappingResult;
  mappingConfig: ContentMappingConfig;
}) => {
  const repaired = cloneContentMappingConfig(mappingConfig);
  const suggested = detection.suggestedMappingConfig;
  const availableTableRefs = new Set(
    detection.tables.map((table) => getPostgresContentIntrospectionTableRef(table)).filter(Boolean) as string[],
  );
  const relationKeys: Array<Exclude<ContentMappingEntityKey, "posts">> = [
    "authors",
    "categories",
    "tags",
    "media",
  ];

  const hasTableRef = (tableRef: string | null | undefined, fallbackSchema?: string | null) => {
    const parsed = parseContentTableRef(tableRef, fallbackSchema);
    return parsed ? availableTableRefs.has(`${parsed.schema}.${parsed.table}`) : false;
  };

  const repairEntity = (key: ContentMappingEntityKey) => {
    const currentEntity = repaired.entities[key];

    if (
      currentEntity.status === "unmapped" ||
      (currentEntity.source.kind !== "table" && currentEntity.source.kind !== "view")
    ) {
      return;
    }

    if (!hasTableRef(getContentEntitySourceRef(currentEntity))) {
      repaired.entities[key] = cloneContentMappingConfig(suggested).entities[key];
    }
  };

  repairEntity("posts");

  for (const relationKey of relationKeys) {
    repairEntity(relationKey);

    const currentRelation = repaired.entities.posts.relations[relationKey];
    const suggestedRelation = suggested.entities.posts.relations[relationKey];

    if (!currentRelation || !suggestedRelation) {
      continue;
    }

    if (currentRelation.status === "unmapped" || currentRelation.strategy === "none") {
      continue;
    }

    const hasValidTargetTable =
      !currentRelation.targetTable ||
      hasTableRef(currentRelation.targetTable, repaired.entities.posts.source.schema);
    const hasValidJunctionTable =
      !currentRelation.junctionTable ||
      hasTableRef(currentRelation.junctionTable, repaired.entities.posts.source.schema);

    if (!hasValidTargetTable || !hasValidJunctionTable) {
      repaired.entities.posts.relations[relationKey] = {
        ...suggestedRelation,
        fieldMap: Object.keys(currentRelation.fieldMap ?? {}).length
          ? currentRelation.fieldMap
          : suggestedRelation.fieldMap,
      };
      repaired.entities[relationKey] = cloneContentMappingConfig(suggested).entities[relationKey];
    }
  }

  return repaired;
};
