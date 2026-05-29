import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createBaseBuddyConfigUser } from "../src/lib/basebuddy-config/auth";
import { createInitialBaseBuddySetup } from "../src/lib/basebuddy-config/initial-setup";
import { getBaseBuddyConfigPath } from "../src/lib/basebuddy-config/paths";
import {
  ensureBaseBuddyConfig,
  loadBaseBuddyConfig,
  loadOptionalBaseBuddyConfig,
  writeBaseBuddyConfig,
} from "../src/lib/basebuddy-config/store";
import {
  getBaseBuddyConfigSetupStatus,
  isBaseBuddyConfigSetupReady,
  type BaseBuddyConfigSetupSection,
} from "../src/lib/basebuddy-config/setup";
import {
  addConfigProjectMemberByEmail,
  createConfigProject,
  createConfigProjectMemberInvitation,
  deleteConfigProject,
  getConfigProjectContentMapping,
  getConfigProjectPostSidebarConfig,
  listConfigProjectMemberInvitations,
  listConfigProjectMembers,
  listConfigProjectPermissionMembers,
  listConfigProjectsForUser,
  removeConfigProjectMember,
  revokeConfigProjectMemberInvitation,
  saveConfigProjectContentMappingRevision,
  saveConfigProjectPostSidebarConfig,
  setConfigProjectMemberPermissionOverrides,
  updateConfigProjectMemberAccess,
  updateConfigProjectMetadata,
} from "../src/lib/basebuddy-config/projects";
import { normalizeProjectSlug } from "../src/lib/control-plane/utils";
import type { BaseBuddyConfigProject, BaseBuddyConfigUser } from "../src/lib/basebuddy-config/schema";
import { createDefaultContentPostSidebarConfig } from "../src/lib/content-runtime/shared";
import {
  CONTENT_BINDING_STATUS_VALUES,
  CONTENT_MEDIA_STORAGE_PROVIDER_VALUES,
  CONTENT_MAPPING_ENTITY_KEYS,
  CONTENT_MAPPING_WORKFLOW_MODE_VALUES,
  normalizeContentMappingConfig,
  type ContentBindingStatus,
  type ContentCustomFieldMapping,
  type ContentEditorField,
  type ContentEntityMapping,
  type ContentMappingConfig,
  type ContentMappingEntityKey,
  type ContentMappingFieldKind,
  type ContentMediaStorageProvider,
  type ContentPostWorkflowMapping,
} from "../src/lib/content-runtime/mapping";
import {
  buildContentAutoMappingResult,
  type ContentIntrospectedColumn,
  type ContentIntrospectedForeignKey,
  type ContentIntrospectedTable,
  type ContentSchemaIntrospection,
} from "../src/lib/content-runtime/introspection";

type BaseBuddyCliDependencies = {
  introspectContentSchema?: (options: CliSchemaInspectOptions) => Promise<ContentSchemaIntrospection>;
  now?: () => Date | string;
  queryDatabase?: (connectionString: string) => Promise<void>;
  randomBytes?: (byteCount: number) => Buffer;
  randomUUID?: () => string;
  stderr?: (chunk: string) => void;
  stdout?: (chunk: string) => void;
};

type ParsedArguments = {
  options: Record<string, boolean | string>;
  positionals: string[];
};

type CliSchemaInspectOptions = {
  includeSamples: boolean;
  schema?: string | null;
  tableRefs?: string[];
};

const defaultStdout = (chunk: string) => {
  process.stdout.write(chunk);
};

const defaultStderr = (chunk: string) => {
  process.stderr.write(chunk);
};

const writeLine = (write: (chunk: string) => void, line = "") => {
  write(`${line}\n`);
};

const getIsoNow = (dependencies: BaseBuddyCliDependencies) => {
  const value = dependencies.now?.() ?? new Date();

  return value instanceof Date ? value.toISOString() : value;
};

const createCliProjectMemberInvitationToken = () => randomBytes(24).toString("base64url");

const parseArguments = (args: string[]): ParsedArguments => {
  const options: ParsedArguments["options"] = {};
  const positionals: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--") {
      positionals.push(...args.slice(index + 1));
      break;
    }

    if (arg === "-h") {
      options.help = true;
      continue;
    }

    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }

    const option = arg.slice(2);
    const equalsIndex = option.indexOf("=");

    if (equalsIndex >= 0) {
      const key = option.slice(0, equalsIndex);
      const value = option.slice(equalsIndex + 1);
      options[key] = value;
      continue;
    }

    const nextArg = args[index + 1];

    if (nextArg && !nextArg.startsWith("-")) {
      options[option] = nextArg;
      index += 1;
    } else {
      options[option] = true;
    }
  }

  return {
    options,
    positionals,
  };
};

const assertKnownOptions = (
  parsed: ParsedArguments,
  command: string,
  knownOptions: string[],
) => {
  const known = new Set([...knownOptions, "help"]);

  for (const option of Object.keys(parsed.options)) {
    if (!known.has(option)) {
      throw new Error(`Unknown option for ${command}: --${option}`);
    }
  }
};

const getOptionalStringOption = (parsed: ParsedArguments, name: string) => {
  const value = parsed.options[name];

  if (value === undefined) {
    return null;
  }

  if (typeof value === "boolean") {
    throw new Error(`--${name} requires a value.`);
  }

  return value;
};

const getRequiredStringOption = (parsed: ParsedArguments, name: string) => {
  const value = getOptionalStringOption(parsed, name);

  if (value === null || value.trim() === "") {
    throw new Error(`Missing required option: --${name}.`);
  }

  return value;
};

const getBooleanOption = (parsed: ParsedArguments, name: string) =>
  parsed.options[name] === true;

const getOptionalNumberOption = (parsed: ParsedArguments, name: string) => {
  const value = getOptionalStringOption(parsed, name);

  if (value === null) {
    return undefined;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    throw new Error(`--${name} must be a number.`);
  }

  return parsedValue;
};

const parseCommaList = (value: string | null) =>
  value
    ? value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];

const parseAuthorScopes = (value: string | null) =>
  parseCommaList(value).map((entry) => {
    const [cmsAuthorId, canPublishValue] = entry.split(":");
    return {
      canPublish: canPublishValue === undefined
        ? true
        : !["0", "false", "no"].includes(canPublishValue.trim().toLowerCase()),
      cmsAuthorId: cmsAuthorId.trim(),
    };
  });

const parseTableRef = (value: string, fallbackSchema = "public") => {
  const normalized = value.trim();
  const [schema, ...tableParts] = normalized.split(".");
  const table = tableParts.length ? tableParts.join(".").trim() : normalized;

  return {
    schema: tableParts.length ? schema.trim() || fallbackSchema : fallbackSchema,
    table,
  };
};

const toTableRef = ({ schema, table }: { schema: string; table: string }) => `${schema}.${table}`;

const getSchemaInspectOptions = (parsed: ParsedArguments): CliSchemaInspectOptions => {
  const schema = getOptionalStringOption(parsed, "schema") ?? null;
  const fallbackSchema = schema?.trim() || "public";
  const tableRefs = parseCommaList(getOptionalStringOption(parsed, "table")).map((table) =>
    toTableRef(parseTableRef(table, fallbackSchema)),
  );

  return {
    includeSamples: parsed.options.samples !== false,
    schema: schema?.trim() || null,
    tableRefs,
  };
};

const getContentDatabaseUrl = () => {
  const value = process.env.BASEBUDDY_CONTENT_DATABASE_URL?.trim();

  if (!value) {
    throw new Error("BASEBUDDY_CONTENT_DATABASE_URL is required for schema inspection.");
  }

  return value;
};

const quotePostgresIdentifier = (value: string) => `"${value.replace(/"/g, "\"\"")}"`;

const buildSchemaWhereClause = ({
  options,
  schemaColumn,
  tableColumn,
  startIndex = 1,
}: {
  options: CliSchemaInspectOptions;
  schemaColumn: string;
  startIndex?: number;
  tableColumn: string;
}) => {
  const params: unknown[] = [];
  const clauses: string[] = [];

  if (options.schema) {
    params.push(options.schema);
    clauses.push(`${schemaColumn} = $${startIndex + params.length - 1}`);
  }

  if (options.tableRefs?.length) {
    const tableClauses = options.tableRefs.map((tableRef) => {
      const parsed = parseTableRef(tableRef, options.schema ?? "public");
      const schemaParam = startIndex + params.push(parsed.schema) - 1;
      const tableParam = startIndex + params.push(parsed.table) - 1;
      return `(${schemaColumn} = $${schemaParam} and ${tableColumn} = $${tableParam})`;
    });
    clauses.push(`(${tableClauses.join(" or ")})`);
  }

  return {
    clause: clauses.length ? ` and ${clauses.join(" and ")}` : "",
    params,
  };
};

const normalizeDatabaseSampleValue = (value: unknown): unknown => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Buffer.isBuffer(value)) {
    return value.toString("base64");
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeDatabaseSampleValue(entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        normalizeDatabaseSampleValue(entry),
      ]),
    );
  }

  return value;
};

const getColumnKindHint = (column: ContentIntrospectedColumn): ContentMappingFieldKind => {
  const name = column.name.toLowerCase();
  const type = column.dataType.toLowerCase();

  if (column.isJson) return "json";
  if (column.isArray) return "array";
  if (name.includes("slug")) return "slug";
  if (type.includes("bool")) return "boolean";
  if (type.includes("timestamp")) return "datetime";
  if (type === "date") return "date";
  if (type.includes("int") || type.includes("numeric") || type.includes("double") || type.includes("real")) {
    return "number";
  }
  if (column.enumValues?.length) return "enum";
  if (name.endsWith("_md") || name.includes("markdown")) return "markdown";
  if (name.endsWith("_html") || name.includes("html")) return "html";
  if (name.includes("content") || name.includes("body") || name.includes("description")) return "plain_text";

  return "text";
};

const humanizeColumnName = (value: string) =>
  value
    .replace(/_id$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const findInspectedTable = (
  introspection: ContentSchemaIntrospection,
  tableRef: string,
  fallbackSchema = "public",
) => {
  const parsed = parseTableRef(tableRef, fallbackSchema);
  return introspection.tables.find((table) => table.schema === parsed.schema && table.name === parsed.table) ?? null;
};

const findInspectedColumn = (table: ContentIntrospectedTable | null, columnName: string | null | undefined) =>
  table?.columns.find((column) => column.name === columnName) ?? null;

const createEditorFieldFromColumn = ({
  column,
  id,
  kind,
  label,
  path,
}: {
  column: string;
  id?: string;
  kind: ContentMappingFieldKind;
  label?: string;
  path?: string | null;
}): ContentEditorField => ({
  column,
  id: id ?? column.replace(/[^a-zA-Z0-9_-]+/g, "_"),
  kind,
  label: label ?? humanizeColumnName(column),
  path: path ?? null,
  placeholder: null,
  required: false,
  visible: true,
});

type CliMappingFieldHint = {
  column: string;
  id?: string;
  kind?: ContentMappingFieldKind;
  label?: string;
  path?: string | null;
};

type CliMappingHints = {
  contentFields?: CliMappingFieldHint[];
  customFields?: CliMappingFieldHint[];
  excerptColumn?: string;
  featuredImageUrlColumn?: string;
  postsTable?: string;
  slugColumn?: string;
  titleColumn?: string;
  workflow?: Partial<ContentPostWorkflowMapping>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const getStringFromRecord = (record: Record<string, unknown>, key: string) =>
  typeof record[key] === "string" ? record[key].trim() : "";

const normalizeMappingHints = (value: unknown): CliMappingHints => {
  if (!isRecord(value)) {
    return {};
  }

  const normalizeFieldHint = (entry: unknown): CliMappingFieldHint | null => {
    if (!isRecord(entry)) {
      return null;
    }

    const column = getStringFromRecord(entry, "column");

    if (!column) {
      return null;
    }

    const kind = getStringFromRecord(entry, "kind");

    return {
      column,
      id: getStringFromRecord(entry, "id") || undefined,
      kind: kind ? (kind as ContentMappingFieldKind) : undefined,
      label: getStringFromRecord(entry, "label") || undefined,
      path: getStringFromRecord(entry, "path") || null,
    };
  };
  const workflow = isRecord(value.workflow) ? value.workflow : null;

  return {
    contentFields: Array.isArray(value.contentFields)
      ? value.contentFields.map(normalizeFieldHint).filter(Boolean) as CliMappingFieldHint[]
      : undefined,
    customFields: Array.isArray(value.customFields)
      ? value.customFields.map(normalizeFieldHint).filter(Boolean) as CliMappingFieldHint[]
      : undefined,
    excerptColumn: getStringFromRecord(value, "excerptColumn") || undefined,
    featuredImageUrlColumn: getStringFromRecord(value, "featuredImageUrlColumn") || undefined,
    postsTable: getStringFromRecord(value, "postsTable") || undefined,
    slugColumn: getStringFromRecord(value, "slugColumn") || undefined,
    titleColumn: getStringFromRecord(value, "titleColumn") || undefined,
    workflow: workflow
      ? {
          archivedValues: Array.isArray(workflow.archivedValues)
            ? workflow.archivedValues.filter((entry): entry is string => typeof entry === "string")
            : undefined,
          customValues: Array.isArray(workflow.customValues)
            ? workflow.customValues.filter((entry): entry is string => typeof entry === "string")
            : undefined,
          draftValues: Array.isArray(workflow.draftValues)
            ? workflow.draftValues.filter((entry): entry is string => typeof entry === "string")
            : undefined,
          mode: CONTENT_MAPPING_WORKFLOW_MODE_VALUES.includes(workflow.mode as ContentPostWorkflowMapping["mode"])
            ? workflow.mode as ContentPostWorkflowMapping["mode"]
            : undefined,
          publishedAtColumn: typeof workflow.publishedAtColumn === "string" ? workflow.publishedAtColumn : undefined,
          publishedFlagColumn: typeof workflow.publishedFlagColumn === "string" ? workflow.publishedFlagColumn : undefined,
          publishedValues: Array.isArray(workflow.publishedValues)
            ? workflow.publishedValues.filter((entry): entry is string => typeof entry === "string")
            : undefined,
          statusColumn: typeof workflow.statusColumn === "string" ? workflow.statusColumn : undefined,
        }
      : undefined,
  };
};

const createCustomFieldFromColumn = ({
  column,
  hint,
  sampleRows,
}: {
  column: ContentIntrospectedColumn;
  hint: CliMappingFieldHint;
  sampleRows: Array<Record<string, unknown>>;
}): ContentCustomFieldMapping => {
  const sampleValues = sampleRows
    .map((row) => row[column.name])
    .filter((value) => value !== undefined && value !== null)
    .slice(0, 3)
    .map((value) => {
      if (typeof value === "string") {
        return value;
      }

      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    });

  return {
    allowedValues: column.enumValues,
    column: column.name,
    dataType: column.dataType,
    defaultValue: column.defaultValue,
    enabled: true,
    isNullable: column.isNullable,
    kind: hint.kind ?? getColumnKindHint(column),
    label: hint.label ?? humanizeColumnName(column.name),
    path: hint.path ?? null,
    sampleValues,
    sourceType: {
      isArray: column.isArray,
      isJson: column.isJson,
      nativeType: column.udtName ?? column.dataType,
    },
  };
};

const applyMappingHints = (
  mappingConfig: ContentMappingConfig,
  introspection: ContentSchemaIntrospection,
  hints: CliMappingHints,
  inspectOptions: CliSchemaInspectOptions,
) => {
  const normalized = normalizeContentMappingConfig(mappingConfig);
  const tableRef =
    hints.postsTable ??
    inspectOptions.tableRefs?.[0] ??
    (normalized.entities.posts.source.schema && normalized.entities.posts.source.table
      ? `${normalized.entities.posts.source.schema}.${normalized.entities.posts.source.table}`
      : null);
  const postsTable = tableRef ? findInspectedTable(introspection, tableRef, inspectOptions.schema ?? "public") : null;

  if (postsTable) {
    const posts = normalized.entities.posts;
    posts.source = {
      kind: postsTable.kind,
      primaryKey: postsTable.primaryKey,
      schema: postsTable.schema,
      table: postsTable.name,
    };
    posts.status = "mapped";
    posts.capabilities = {
      browse: true,
      create: postsTable.kind === "table",
      delete: postsTable.kind === "table",
      read: true,
      update: postsTable.kind === "table",
    };
    posts.fields.id.column = postsTable.primaryKey;

    const scalarHints = {
      excerpt: hints.excerptColumn,
      featuredImageUrl: hints.featuredImageUrlColumn,
      slug: hints.slugColumn,
      title: hints.titleColumn,
    } satisfies Partial<Record<keyof ContentEntityMapping["fields"], string | undefined>>;

    for (const [fieldKey, columnName] of Object.entries(scalarHints)) {
      if (columnName && posts.fields[fieldKey]) {
        posts.fields[fieldKey].column = columnName;
      }
    }

    if (hints.contentFields?.length) {
      posts.editorFields = hints.contentFields.map((hint) => {
        const column = findInspectedColumn(postsTable, hint.column);
        return createEditorFieldFromColumn({
          column: hint.column,
          id: hint.id,
          kind: hint.kind ?? (column ? getColumnKindHint(column) : "plain_text"),
          label: hint.label,
          path: hint.path,
        });
      });
    }

    if (hints.customFields?.length) {
      posts.customFields = hints.customFields
        .map((hint) => {
          const column = findInspectedColumn(postsTable, hint.column);
          return column ? createCustomFieldFromColumn({ column, hint, sampleRows: postsTable.sampleRows }) : null;
        })
        .filter(Boolean) as ContentCustomFieldMapping[];
    }

    if (hints.workflow) {
      posts.workflow = {
        ...(posts.workflow ?? {
          archivedValues: [],
          customValues: [],
          draftValues: [],
          mode: "status",
          publishedAtColumn: null,
          publishedFlagColumn: null,
          publishedValues: [],
          statusColumn: null,
        }),
        ...hints.workflow,
      };
      posts.fields.status.column = posts.workflow.statusColumn ?? posts.workflow.publishedFlagColumn;
      posts.fields.publishedAt.column = posts.workflow.publishedAtColumn;
    }
  }

  return normalizeContentMappingConfig(normalized);
};

const getMappingSummary = (mappingConfig: ContentMappingConfig) => ({
  entities: Object.fromEntries(
    CONTENT_MAPPING_ENTITY_KEYS.map((entityKey) => {
      const entity = mappingConfig.entities[entityKey];
      const source = entity.source.schema && entity.source.table
        ? `${entity.source.schema}.${entity.source.table}`
        : null;
      const mappedFields = Object.entries(entity.fields)
        .filter(([, field]) => field.column || field.path || field.sourceRelation)
        .map(([fieldKey, field]) => ({
          column: field.column,
          fieldKey,
          kind: field.kind,
          path: field.path,
          semanticRole: field.semanticRole ?? null,
        }));

      return [
        entityKey,
        {
          customFieldCount: entity.customFields.filter((field) => field.enabled).length,
          editorFieldCount: entity.editorFields.filter((field) => field.visible).length,
          mappedFields,
          source,
          status: entity.status,
          workflow: entity.workflow,
        },
      ];
    }),
  ),
  filesStorage: mappingConfig.filesStorage,
  mediaStorage: mappingConfig.mediaStorage,
  version: mappingConfig.version,
});

const getAgentSetupWorkflow = () => [
  {
    command: "pnpm basebuddy doctor",
    purpose: "Check env, config, owner account, and database readiness.",
  },
  {
    command: "pnpm basebuddy setup",
    purpose: "Create basebuddy-data/basebuddy.config.json after env is ready.",
  },
  {
    command: "pnpm basebuddy projects:create",
    purpose: "Create the BaseBuddy project owned by a local user.",
  },
  {
    command: "pnpm basebuddy schema:inspect",
    purpose: "Inspect exact tables, columns, keys, enums, and sample rows from Postgres.",
  },
  {
    command: "pnpm basebuddy mapping:draft",
    purpose: "Generate valid mapping JSON from schema inspection and optional hints.",
  },
  {
    command: "pnpm basebuddy mapping:explain",
    purpose: "Review the generated mapping before saving it.",
  },
  {
    command: "pnpm basebuddy mapping:set",
    purpose: "Save the verified mapping to the project.",
  },
  {
    command: "pnpm basebuddy sidebar:set",
    purpose: "Optionally save a sidebar layout JSON file.",
  },
  {
    command: "pnpm basebuddy storage:set",
    purpose: "Optionally save non-secret media/files bucket metadata.",
  },
];

const inspectContentSchema = async (
  dependencies: BaseBuddyCliDependencies,
  options: CliSchemaInspectOptions,
): Promise<ContentSchemaIntrospection> => {
  if (dependencies.introspectContentSchema) {
    return dependencies.introspectContentSchema(options);
  }

  const { Client } = await import("pg");
  const client = new Client({ connectionString: getContentDatabaseUrl() });

  await client.connect();

  try {
    const tableFilter = buildSchemaWhereClause({
      options,
      schemaColumn: "n.nspname",
      tableColumn: "c.relname",
    });
    const tablesResult = await client.query<{
      object_kind: "table" | "view";
      row_count_estimate: string | number | null;
      schema_name: string;
      table_name: string;
    }>(
      `
        select
          n.nspname as schema_name,
          c.relname as table_name,
          case when c.relkind = 'r' then 'table' else 'view' end as object_kind,
          case when c.relkind = 'r' then greatest(c.reltuples, 0)::bigint::text else null end as row_count_estimate
        from pg_class as c
        inner join pg_namespace as n on n.oid = c.relnamespace
        where c.relkind in ('r', 'v', 'm')
          and n.nspname not in ('auth', 'extensions', 'graphql', 'graphql_public', 'information_schema', 'pg_catalog', 'pg_toast', 'realtime', 'storage', 'supabase_functions', 'supabase_migrations', 'vault')
          and n.nspname not like 'pg_temp_%'
          and n.nspname not like 'pg_toast_temp_%'
          ${tableFilter.clause}
        order by n.nspname, c.relname
      `,
      tableFilter.params,
    );
    const columnFilter = buildSchemaWhereClause({
      options,
      schemaColumn: "table_schema",
      tableColumn: "table_name",
    });
    const constraintFilter = buildSchemaWhereClause({
      options,
      schemaColumn: "kcu.table_schema",
      tableColumn: "kcu.table_name",
    });
    const columnsResult = await client.query<{
      column_default: string | null;
      column_name: string;
      data_type: string;
      is_generated: "ALWAYS" | "NEVER" | "YES" | "NO" | null;
      is_nullable: "NO" | "YES";
      table_name: string;
      table_schema: string;
      udt_name: string | null;
    }>(
      `
        select table_schema, table_name, column_name, data_type, udt_name, is_nullable, is_generated, column_default
        from information_schema.columns
        where table_schema not in ('auth', 'extensions', 'graphql', 'graphql_public', 'information_schema', 'pg_catalog', 'pg_toast', 'realtime', 'storage', 'supabase_functions', 'supabase_migrations', 'vault')
          and table_schema not like 'pg_temp_%'
          and table_schema not like 'pg_toast_temp_%'
          ${columnFilter.clause}
        order by table_schema, table_name, ordinal_position
      `,
      columnFilter.params,
    );
    const primaryKeysResult = await client.query<{
      column_name: string;
      table_name: string;
      table_schema: string;
    }>(
      `
        select kcu.table_schema, kcu.table_name, kcu.column_name
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on tc.constraint_name = kcu.constraint_name
         and tc.constraint_schema = kcu.constraint_schema
         and tc.table_schema = kcu.table_schema
        where tc.constraint_type = 'PRIMARY KEY'
          ${constraintFilter.clause}
        order by kcu.table_schema, kcu.table_name, kcu.ordinal_position
      `,
      constraintFilter.params,
    );
    const foreignKeysResult = await client.query<{
      column_name: string;
      foreign_column_name: string;
      foreign_table_name: string;
      foreign_table_schema: string;
      table_name: string;
      table_schema: string;
    }>(
      `
        select
          kcu.table_schema,
          kcu.table_name,
          kcu.column_name,
          ccu.table_schema as foreign_table_schema,
          ccu.table_name as foreign_table_name,
          ccu.column_name as foreign_column_name
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on tc.constraint_name = kcu.constraint_name
         and tc.constraint_schema = kcu.constraint_schema
         and tc.table_schema = kcu.table_schema
        join information_schema.constraint_column_usage ccu
          on ccu.constraint_name = tc.constraint_name
         and ccu.constraint_schema = tc.constraint_schema
        where tc.constraint_type = 'FOREIGN KEY'
          ${constraintFilter.clause}
        order by kcu.table_schema, kcu.table_name, kcu.column_name
      `,
      constraintFilter.params,
    );
    const enumRows = await client.query<{
      enum_label: string;
      type_name: string;
      type_schema: string;
    }>(
      `
        select n.nspname as type_schema, t.typname as type_name, e.enumlabel as enum_label
        from pg_type t
        join pg_enum e on t.oid = e.enumtypid
        join pg_namespace n on n.oid = t.typnamespace
        order by n.nspname, t.typname, e.enumsortorder
      `,
    );
    const enumValuesByType = new Map<string, string[]>();

    for (const row of enumRows.rows) {
      const key = `${row.type_schema}.${row.type_name}`;
      enumValuesByType.set(key, [...(enumValuesByType.get(key) ?? []), row.enum_label]);
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
      const key = `${row.table_schema}.${row.table_name}`;
      const enumValues = row.udt_name
        ? enumValuesByType.get(`${row.table_schema}.${row.udt_name}`) ?? enumValuesByType.get(`public.${row.udt_name}`) ?? null
        : null;
      columnsByTable.set(key, [
        ...(columnsByTable.get(key) ?? []),
        {
          dataType: row.data_type,
          defaultValue: row.column_default,
          enumValues,
          isArray: row.data_type === "ARRAY",
          isGenerated: row.is_generated === "ALWAYS" || row.is_generated === "YES",
          isJson: row.data_type === "json" || row.data_type === "jsonb",
          isNullable: row.is_nullable === "YES",
          name: row.column_name,
          udtName: row.udt_name,
        },
      ]);
    }

    const foreignKeysByTable = new Map<string, ContentIntrospectedForeignKey[]>();

    for (const row of foreignKeysResult.rows) {
      const key = `${row.table_schema}.${row.table_name}`;
      foreignKeysByTable.set(key, [
        ...(foreignKeysByTable.get(key) ?? []),
        {
          column: row.column_name,
          targetColumn: row.foreign_column_name,
          targetSchema: row.foreign_table_schema,
          targetTable: row.foreign_table_name,
        },
      ]);
    }

    const tables: ContentIntrospectedTable[] = [];

    for (const row of tablesResult.rows) {
      const key = `${row.schema_name}.${row.table_name}`;
      const table: ContentIntrospectedTable = {
        columns: columnsByTable.get(key) ?? [],
        foreignKeys: foreignKeysByTable.get(key) ?? [],
        kind: row.object_kind,
        name: row.table_name,
        primaryKey: primaryKeyByTable.get(key) ?? null,
        rowCountEstimate: row.row_count_estimate === null ? null : Number(row.row_count_estimate),
        sampleRows: [],
        schema: row.schema_name,
      };

      if (options.includeSamples && table.kind === "table") {
        try {
          const sampleResult = await client.query<Record<string, unknown>>(
            `select * from ${quotePostgresIdentifier(table.schema)}.${quotePostgresIdentifier(table.name)} limit 3`,
          );
          table.sampleRows = sampleResult.rows.map((sample) =>
            Object.fromEntries(
              Object.entries(sample).map(([key, value]) => [key, normalizeDatabaseSampleValue(value)]),
            ),
          );
        } catch {
          table.sampleRows = [];
        }
      }

      tables.push(table);
    }

    return { tables };
  } finally {
    await client.end();
  }
};

const assertAuthorScopesMatchRoles = ({
  authorScopes,
  roles,
}: {
  authorScopes: ReturnType<typeof parseAuthorScopes>;
  roles: string[];
}) => {
  const hasAuthorRole = roles.includes("author");

  if (hasAuthorRole && authorScopes.length === 0) {
    throw new Error("Use --author-scopes when assigning the author role.");
  }

  if (!hasAuthorRole && authorScopes.length > 0) {
    throw new Error("--author-scopes can only be used with the author role.");
  }
};

const readJsonFile = async (filePath: string) => {
  try {
    return JSON.parse(await readFile(resolve(process.cwd(), filePath), "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Could not parse JSON input: ${error.message}`);
    }

    throw error;
  }
};

const writeJson = (write: (chunk: string) => void, value: unknown) => {
  writeLine(write, JSON.stringify(value, null, 2));
};

const findConfigUserByEmailOrId = (
  config: Awaited<ReturnType<typeof loadBaseBuddyConfig>>,
  value: string,
) => {
  const normalizedValue = value.trim().toLowerCase();

  return config.users.find((user) =>
    user.id === value.trim() || user.email.trim().toLowerCase() === normalizedValue,
  ) ?? null;
};

const getRequiredUserByEmailOrId = async (value: string) => {
  const config = await loadBaseBuddyConfig();
  const user = findConfigUserByEmailOrId(config, value);

  if (!user) {
    throw new Error(`Could not find user: ${value}`);
  }

  return user;
};

const getRequiredUserFromOption = async (
  parsed: ParsedArguments,
  optionName: string,
) => getRequiredUserByEmailOrId(getRequiredStringOption(parsed, optionName));

const resolveProjectFromConfig = (
  config: Awaited<ReturnType<typeof loadBaseBuddyConfig>>,
  value: string,
): BaseBuddyConfigProject => {
  const normalizedValue = value.trim();
  const normalizedSlug = normalizeProjectSlug(normalizedValue);
  const project = config.projects.find((candidate) =>
    candidate.id === normalizedValue || candidate.slug === normalizedSlug,
  ) ?? null;

  if (!project) {
    throw new Error(`Could not find project: ${value}`);
  }

  return project;
};

const getRequiredProject = async (value: string) => {
  const config = await loadBaseBuddyConfig();
  return resolveProjectFromConfig(config, value);
};

const getRequiredProjectFromOption = async (parsed: ParsedArguments) =>
  getRequiredProject(getRequiredStringOption(parsed, "project"));

const toPublicUser = (user: BaseBuddyConfigUser) => ({
  avatarUrl: user.avatarUrl,
  createdAt: user.createdAt,
  email: user.email,
  id: user.id,
  name: user.name,
  updatedAt: user.updatedAt,
});

const getProjectMemberByUserId = async ({
  projectId,
  userId,
}: {
  projectId: string;
  userId: string;
}) => {
  const permissions = await listConfigProjectPermissionMembers({
    currentUserId: userId,
    projectId,
  });

  return permissions.members.find((member) => member.userId === userId) ?? null;
};

const deleteConfigUserByEmailOrId = async (value: string) => {
  const normalizedValue = value.trim();
  let deletedUser: BaseBuddyConfigUser | null = null;

  await writeBaseBuddyConfig((config) => {
    const user = findConfigUserByEmailOrId(config, normalizedValue);

    if (!user) {
      throw new Error(`Could not find user: ${normalizedValue}`);
    }

    for (const project of config.projects) {
      const targetMember = project.members.find((member) => member.userId === user.id);

      if (!targetMember?.roles.includes("owner")) {
        continue;
      }

      const remainingOwnerCount = project.members.filter(
        (member) => member.userId !== user.id && member.roles.includes("owner"),
      ).length;

      if (remainingOwnerCount === 0) {
        throw new Error(`Cannot delete ${user.email}; they are the last owner of project ${project.slug}.`);
      }
    }

    deletedUser = user;

    return {
      ...config,
      projects: config.projects.map((project) => ({
        ...project,
        members: project.members.filter((member) => member.userId !== user.id),
      })),
      sessions: config.sessions.filter((session) => session.userId !== user.id),
      users: config.users.filter((candidate) => candidate.id !== user.id),
    };
  });

  if (!deletedUser) {
    throw new Error(`Could not find user: ${normalizedValue}`);
  }

  return deletedUser;
};

const printMainHelp = (write: (chunk: string) => void) => {
  writeLine(write, "Usage: pnpm basebuddy <command> [options]");
  writeLine(write);
  writeLine(write, "Commands:");
  writeLine(write, "  doctor          Check BaseBuddy setup readiness.");
  writeLine(write, "  setup           Create basebuddy-data/basebuddy.config.json after env is configured.");
  writeLine(write, "  agent:setup     Print the recommended agent-first CLI setup workflow.");
  writeLine(write, "  users:list      List local config-backed users.");
  writeLine(write, "  user:create     Create a local config-backed user.");
  writeLine(write, "  users:delete    Delete a local user when safe.");
  writeLine(write, "  projects:list   List projects visible to an actor.");
  writeLine(write, "  projects:create Create a project and owner membership.");
  writeLine(write, "  projects:update Update project name, address, or website URL.");
  writeLine(write, "  projects:delete Delete a project from BaseBuddy config.");
  writeLine(write, "  members:list    List project members.");
  writeLine(write, "  members:add     Add an existing local user to a project.");
  writeLine(write, "  members:update  Update member roles and author scopes.");
  writeLine(write, "  members:remove  Remove a project member.");
  writeLine(write, "  invites:list    List project invitations.");
  writeLine(write, "  invites:create  Create a project invitation.");
  writeLine(write, "  invites:revoke  Revoke a project invitation.");
  writeLine(write, "  permissions:get List permission definitions and member permissions.");
  writeLine(write, "  permissions:set Set member permission overrides.");
  writeLine(write, "  schema:inspect  Inspect Postgres tables for mapping work.");
  writeLine(write, "  mapping:draft   Draft mapping JSON from schema inspection.");
  writeLine(write, "  mapping:explain Summarize mapping JSON before saving.");
  writeLine(write, "  mapping:get     Print a project mapping.");
  writeLine(write, "  mapping:set     Save a project mapping from JSON.");
  writeLine(write, "  mapping:validate Validate mapping JSON without saving.");
  writeLine(write, "  sidebar:get     Print post sidebar layout.");
  writeLine(write, "  sidebar:set     Save post sidebar layout from JSON.");
  writeLine(write, "  sidebar:reset   Reset post sidebar layout.");
  writeLine(write, "  storage:get     Print mapped media/files storage metadata.");
  writeLine(write, "  storage:set     Save mapped media/files storage metadata.");
  writeLine(write, "  storage:status  Check env-backed storage readiness.");
  writeLine(write);
  writeLine(write, "Run `pnpm basebuddy <command> --help` for command options.");
};

const printSimpleHelp = (
  write: (chunk: string) => void,
  usage: string,
  options: string[],
) => {
  writeLine(write, `Usage: ${usage}`);
  writeLine(write);
  writeLine(write, "Options:");
  for (const option of options) {
    writeLine(write, `  ${option}`);
  }
  writeLine(write, "  --json              Print JSON output.");
  writeLine(write, "  --help              Show this help.");
};

const printDoctorHelp = (write: (chunk: string) => void) => {
  writeLine(write, "Usage: pnpm basebuddy doctor [options]");
  writeLine(write);
  writeLine(write, "Options:");
  writeLine(write, "  --json           Print machine-readable redacted setup status.");
  writeLine(write, "  --skip-db-check  Skip the database reachability check.");
  writeLine(write, "  --help           Show this help.");
};

const printSetupHelp = (write: (chunk: string) => void) => {
  writeLine(write, "Usage: pnpm basebuddy setup [options]");
  writeLine(write);
  writeLine(write, "Required env:");
  writeLine(write, "  BASEBUDDY_AUTH_SECRET                  Local session signing secret.");
  writeLine(write, "  BASEBUDDY_CONTENT_DATABASE_URL         Postgres database URL.");
  writeLine(write);
  writeLine(write, "Optional env:");
  writeLine(write, "  BASEBUDDY_SUPABASE_URL              Only needed for images and files.");
  writeLine(write, "  BASEBUDDY_SUPABASE_PUBLISHABLE_KEY  Only needed for images and files.");
  writeLine(write, "  BASEBUDDY_SUPABASE_SECRET_KEY       Only needed for images and files.");
  writeLine(write, "  BASEBUDDY_S3_ACCESS_KEY_ID");
  writeLine(write, "  BASEBUDDY_S3_SECRET_ACCESS_KEY");
  writeLine(write);
  writeLine(write, "Options:");
  writeLine(write, "  --owner-email <value>                       Create the first owner user.");
  writeLine(write, "  --owner-name <value>                        First owner display name.");
  writeLine(write, "  --owner-password <value>                    First owner password.");
  writeLine(write, "  --json                                      Print redacted JSON status.");
  writeLine(write, "  --help                                      Show this help.");
};

const printUserCreateHelp = (write: (chunk: string) => void) => {
  writeLine(write, "Usage: pnpm basebuddy user:create --email <email> --name <name> --password <password>");
  writeLine(write);
  writeLine(write, "Options:");
  writeLine(write, "  --email <value>     Local user email.");
  writeLine(write, "  --name <value>      Local user display name.");
  writeLine(write, "  --password <value>  Local user password.");
  writeLine(write, "  --json              Print redacted JSON result.");
  writeLine(write, "  --help              Show this help.");
};

const printProjectsCreateHelp = (write: (chunk: string) => void) =>
  printSimpleHelp(write, "pnpm basebuddy projects:create --actor-email <email> --name <name> --slug <slug>", [
    "--actor-email <value>  Existing local user who will own the project.",
    "--name <value>         Project name.",
    "--slug <value>         Project address.",
  ]);

const printStatusSections = (
  write: (chunk: string) => void,
  sections: BaseBuddyConfigSetupSection[],
) => {
  for (const section of sections) {
    writeLine(write);
    writeLine(write, `${section.title}: ${section.status}`);

    for (const check of section.checks) {
      const value = check.value ? ` (${check.value})` : "";
      writeLine(write, `- ${check.key}: ${check.status}${value}`);
    }
  }
};

const printTextSetupStatus = ({
  heading,
  ready,
  status,
  write,
}: {
  heading: string;
  ready: boolean;
  status: Awaited<ReturnType<typeof getBaseBuddyConfigSetupStatus>>;
  write: (chunk: string) => void;
}) => {
  writeLine(write, heading);
  writeLine(write);
  writeLine(write, `Config file: ${status.configPath}`);
  writeLine(write, `Ready: ${ready ? "yes" : "no"}`);
  printStatusSections(write, status.sections);
};

const runDoctorCommand = async (
  parsed: ParsedArguments,
  dependencies: BaseBuddyCliDependencies,
) => {
  assertKnownOptions(parsed, "doctor", ["json", "skip-db-check"]);

  const stdout = dependencies.stdout ?? defaultStdout;

  if (parsed.options.help) {
    printDoctorHelp(stdout);
    return 0;
  }

  const status = await getBaseBuddyConfigSetupStatus({
    checkContentDatabase: parsed.options["skip-db-check"] !== true,
    queryDatabase: dependencies.queryDatabase,
  });
  const ready = isBaseBuddyConfigSetupReady(status);

  if (parsed.options.json) {
    writeLine(stdout, JSON.stringify({ ready, status }, null, 2));
  } else {
    printTextSetupStatus({
      heading: "BaseBuddy doctor",
      ready,
      status,
      write: stdout,
    });
  }

  return ready ? 0 : 1;
};

const runSetupCommand = async (
  parsed: ParsedArguments,
  dependencies: BaseBuddyCliDependencies,
) => {
  assertKnownOptions(parsed, "setup", [
    "json",
    "owner-email",
    "owner-name",
    "owner-password",
  ]);

  const stdout = dependencies.stdout ?? defaultStdout;

  if (parsed.options.help) {
    printSetupHelp(stdout);
    return 0;
  }

  const ownerEmail = getOptionalStringOption(parsed, "owner-email");
  const ownerName = getOptionalStringOption(parsed, "owner-name");
  const ownerPassword = getOptionalStringOption(parsed, "owner-password");
  const hasOwnerOptions = ownerEmail !== null || ownerName !== null || ownerPassword !== null;
  const existingConfig = await loadOptionalBaseBuddyConfig();
  const now = getIsoNow(dependencies);
  let action: "created" | "exists" | "updated" = "exists";

  if (hasOwnerOptions) {
    if (!ownerEmail || !ownerName || !ownerPassword) {
      throw new Error(
        "Use --owner-email, --owner-name, and --owner-password together when creating the first owner.",
      );
    }

    await createInitialBaseBuddySetup({
      dependencies,
      owner: {
        email: ownerEmail,
        name: ownerName,
        password: ownerPassword,
      },
    });
    action = existingConfig ? "updated" : "created";
  } else if (!existingConfig) {
    await ensureBaseBuddyConfig({
      now,
    });
    action = "created";
  }

  const status = await getBaseBuddyConfigSetupStatus({
    checkContentDatabase: true,
    queryDatabase: dependencies.queryDatabase,
  });
  const ready = isBaseBuddyConfigSetupReady(status);

  if (parsed.options.json) {
    writeLine(stdout, JSON.stringify({ action, ready, status }, null, 2));
  } else {
    writeLine(stdout, "BaseBuddy setup");
    writeLine(stdout);
    writeLine(stdout, `Action: ${action}`);
    writeLine(stdout, `Config file: ${getBaseBuddyConfigPath()}`);
    writeLine(stdout, `Ready: ${ready ? "yes" : "no"}`);
    printStatusSections(stdout, status.sections);
  }

  return 0;
};

const runUserCreateCommand = async (
  parsed: ParsedArguments,
  dependencies: BaseBuddyCliDependencies,
) => {
  assertKnownOptions(parsed, "user:create", ["email", "json", "name", "password"]);

  const stdout = dependencies.stdout ?? defaultStdout;

  if (parsed.options.help) {
    printUserCreateHelp(stdout);
    return 0;
  }

  const email = getRequiredStringOption(parsed, "email").trim().toLowerCase();
  const name = getRequiredStringOption(parsed, "name").trim();
  const password = getRequiredStringOption(parsed, "password");
  const createdUser = await createBaseBuddyConfigUser({
    dependencies,
    email,
    name,
    password,
  });

  if (parsed.options.json) {
    writeLine(
      stdout,
      JSON.stringify(
        {
          configPath: getBaseBuddyConfigPath(),
          user: createdUser
            ? {
                createdAt: createdUser.createdAt,
                email: createdUser.email,
                id: createdUser.id,
                name: createdUser.name,
                password: "stored-securely",
              }
            : null,
        },
        null,
        2,
      ),
    );
  } else {
    writeLine(stdout, "BaseBuddy user created");
    writeLine(stdout);
    writeLine(stdout, `Config file: ${getBaseBuddyConfigPath()}`);
    writeLine(stdout, `User: ${createdUser?.email ?? email}`);
    writeLine(stdout, "Password: stored securely");
  }

  return 0;
};

const runUsersListCommand = async (
  parsed: ParsedArguments,
  dependencies: BaseBuddyCliDependencies,
) => {
  assertKnownOptions(parsed, "users:list", ["json"]);
  const stdout = dependencies.stdout ?? defaultStdout;

  if (parsed.options.help) {
    printSimpleHelp(stdout, "pnpm basebuddy users:list [options]", []);
    return 0;
  }

  const config = await loadBaseBuddyConfig();
  const users = config.users.map(toPublicUser);

  if (parsed.options.json) {
    writeJson(stdout, { configPath: getBaseBuddyConfigPath(), users });
  } else {
    writeLine(stdout, "BaseBuddy users");
    for (const user of users) {
      writeLine(stdout, `- ${user.email} (${user.id})`);
    }
  }

  return 0;
};

const runUsersDeleteCommand = async (
  parsed: ParsedArguments,
  dependencies: BaseBuddyCliDependencies,
) => {
  assertKnownOptions(parsed, "users:delete", ["email", "id", "json"]);
  const stdout = dependencies.stdout ?? defaultStdout;

  if (parsed.options.help) {
    printSimpleHelp(stdout, "pnpm basebuddy users:delete (--email <email> | --id <id>)", [
      "--email <value>      User email.",
      "--id <value>         User id.",
    ]);
    return 0;
  }

  const userRef = getOptionalStringOption(parsed, "email") ?? getOptionalStringOption(parsed, "id");

  if (!userRef) {
    throw new Error("Use --email or --id.");
  }

  const deletedUser = await deleteConfigUserByEmailOrId(userRef);
  const user = toPublicUser(deletedUser);

  if (parsed.options.json) {
    writeJson(stdout, { deletedUser: user });
  } else {
    writeLine(stdout, `Deleted user: ${user.email}`);
  }

  return 0;
};

const runProjectsListCommand = async (
  parsed: ParsedArguments,
  dependencies: BaseBuddyCliDependencies,
) => {
  assertKnownOptions(parsed, "projects:list", ["actor-email", "actor-id", "all", "json", "limit", "search"]);
  const stdout = dependencies.stdout ?? defaultStdout;

  if (parsed.options.help) {
    printSimpleHelp(stdout, "pnpm basebuddy projects:list (--actor-email <email> | --all)", [
      "--actor-email <value>  Existing local user email.",
      "--actor-id <value>     Existing local user id.",
      "--all                  List every config project.",
      "--limit <value>        Maximum projects.",
      "--search <value>       Filter by name or slug.",
    ]);
    return 0;
  }

  if (getBooleanOption(parsed, "all")) {
    const config = await loadBaseBuddyConfig();
    const projects = config.projects.map((project) => ({
      createdAt: project.createdAt,
      id: project.id,
      name: project.name,
      slug: project.slug,
      status: project.status,
      websiteUrl: project.websiteUrl,
    }));

    if (parsed.options.json) {
      writeJson(stdout, { projects });
    } else {
      writeLine(stdout, "BaseBuddy projects");
      for (const project of projects) {
        writeLine(stdout, `- ${project.slug}: ${project.name}`);
      }
    }

    return 0;
  }

  const actorRef = getOptionalStringOption(parsed, "actor-email") ?? getOptionalStringOption(parsed, "actor-id");

  if (!actorRef) {
    throw new Error("Use --actor-email, --actor-id, or --all.");
  }

  const actor = await getRequiredUserByEmailOrId(actorRef);
  const result = await listConfigProjectsForUser({
    limit: getOptionalNumberOption(parsed, "limit"),
    search: getOptionalStringOption(parsed, "search"),
    userId: actor.id,
  });

  if (parsed.options.json) {
    writeJson(stdout, result);
  } else {
    writeLine(stdout, "BaseBuddy projects");
    for (const project of result.projects) {
      writeLine(stdout, `- ${project.slug}: ${project.name}`);
    }
  }

  return 0;
};

const runProjectsCreateCommand = async (
  parsed: ParsedArguments,
  dependencies: BaseBuddyCliDependencies,
) => {
  assertKnownOptions(parsed, "projects:create", ["actor-email", "actor-id", "json", "name", "slug"]);
  const stdout = dependencies.stdout ?? defaultStdout;

  if (parsed.options.help) {
    printProjectsCreateHelp(stdout);
    return 0;
  }

  const actor = await getRequiredUserByEmailOrId(
    getOptionalStringOption(parsed, "actor-email") ??
      getOptionalStringOption(parsed, "actor-id") ??
      "",
  );
  const project = await createConfigProject({
    name: getRequiredStringOption(parsed, "name"),
    slug: getRequiredStringOption(parsed, "slug"),
    userId: actor.id,
  });

  if (parsed.options.json) {
    writeJson(stdout, { project });
  } else {
    writeLine(stdout, `Created project: ${project.slug}`);
  }

  return 0;
};

const runProjectsUpdateCommand = async (
  parsed: ParsedArguments,
  dependencies: BaseBuddyCliDependencies,
) => {
  assertKnownOptions(parsed, "projects:update", [
    "clear-website-url",
    "json",
    "name",
    "project",
    "slug",
    "website-url",
  ]);
  const stdout = dependencies.stdout ?? defaultStdout;

  if (parsed.options.help) {
    printSimpleHelp(stdout, "pnpm basebuddy projects:update --project <id-or-slug> [options]", [
      "--name <value>          Project name.",
      "--slug <value>          Project address.",
      "--website-url <value>   Project website URL.",
      "--clear-website-url     Clear project website URL.",
    ]);
    return 0;
  }

  const currentProject = await getRequiredProjectFromOption(parsed);
  const project = await updateConfigProjectMetadata({
    name: getOptionalStringOption(parsed, "name") ?? currentProject.name,
    projectId: currentProject.id,
    slug: getOptionalStringOption(parsed, "slug") ?? currentProject.slug,
    websiteUrl: getBooleanOption(parsed, "clear-website-url")
      ? null
      : getOptionalStringOption(parsed, "website-url") ?? currentProject.websiteUrl,
  });

  if (parsed.options.json) {
    writeJson(stdout, { project });
  } else {
    writeLine(stdout, `Updated project: ${project.slug}`);
  }

  return 0;
};

const runProjectsDeleteCommand = async (
  parsed: ParsedArguments,
  dependencies: BaseBuddyCliDependencies,
) => {
  assertKnownOptions(parsed, "projects:delete", ["json", "project"]);
  const stdout = dependencies.stdout ?? defaultStdout;

  if (parsed.options.help) {
    printSimpleHelp(stdout, "pnpm basebuddy projects:delete --project <id-or-slug>", [
      "--project <value>  Project id or slug.",
    ]);
    return 0;
  }

  const project = await getRequiredProjectFromOption(parsed);
  const result = await deleteConfigProject({ projectId: project.id });

  if (parsed.options.json) {
    writeJson(stdout, {
      deletedProject: {
        id: result.deletedProject.id,
        name: result.deletedProject.name,
        slug: result.deletedProject.slug,
      },
    });
  } else {
    writeLine(stdout, `Deleted project: ${result.deletedProject.slug}`);
  }

  return 0;
};

const runMembersListCommand = async (
  parsed: ParsedArguments,
  dependencies: BaseBuddyCliDependencies,
) => {
  assertKnownOptions(parsed, "members:list", ["actor-email", "actor-id", "json", "page", "page-size", "project"]);
  const stdout = dependencies.stdout ?? defaultStdout;

  if (parsed.options.help) {
    printSimpleHelp(stdout, "pnpm basebuddy members:list --project <id-or-slug> --actor-email <email>", [
      "--project <value>      Project id or slug.",
      "--actor-email <value>  Existing local user email.",
      "--actor-id <value>     Existing local user id.",
    ]);
    return 0;
  }

  const project = await getRequiredProjectFromOption(parsed);
  const actor = await getRequiredUserByEmailOrId(
    getOptionalStringOption(parsed, "actor-email") ??
      getOptionalStringOption(parsed, "actor-id") ??
      "",
  );
  const result = await listConfigProjectMembers({
    currentUserId: actor.id,
    page: getOptionalNumberOption(parsed, "page"),
    pageSize: getOptionalNumberOption(parsed, "page-size"),
    projectId: project.id,
  });

  if (parsed.options.json) {
    writeJson(stdout, result);
  } else {
    writeLine(stdout, `Members for ${project.slug}`);
    for (const member of result.members) {
      writeLine(stdout, `- ${member.email ?? member.userId}: ${member.roles.join(",")}`);
    }
  }

  return 0;
};

const runMembersAddCommand = async (
  parsed: ParsedArguments,
  dependencies: BaseBuddyCliDependencies,
) => {
  assertKnownOptions(parsed, "members:add", [
    "actor-email",
    "actor-id",
    "author-scopes",
    "email",
    "json",
    "project",
    "roles",
  ]);
  const stdout = dependencies.stdout ?? defaultStdout;

  if (parsed.options.help) {
    printSimpleHelp(stdout, "pnpm basebuddy members:add --project <project> --actor-email <email> --email <email> --roles <roles>", [
      "--project <value>        Project id or slug.",
      "--actor-email <value>    Acting local user email.",
      "--actor-id <value>       Acting local user id.",
      "--email <value>          User email to add.",
      "--roles <value>          Comma-separated roles.",
      "--author-scopes <value>  Comma-separated author ids, optionally id:false.",
    ]);
    return 0;
  }

  const project = await getRequiredProjectFromOption(parsed);
  const actor = await getRequiredUserByEmailOrId(
    getOptionalStringOption(parsed, "actor-email") ??
      getOptionalStringOption(parsed, "actor-id") ??
      "",
  );
  const roles = parseCommaList(getRequiredStringOption(parsed, "roles"));
  const authorScopes = parseAuthorScopes(getOptionalStringOption(parsed, "author-scopes"));
  assertAuthorScopesMatchRoles({ authorScopes, roles });
  const result = await addConfigProjectMemberByEmail({
    actorUserId: actor.id,
    authorScopes,
    email: getRequiredStringOption(parsed, "email"),
    projectId: project.id,
    roles,
  });
  const member = await getProjectMemberByUserId({
    projectId: project.id,
    userId: result.userId,
  });

  if (parsed.options.json) {
    writeJson(stdout, { member });
  } else {
    writeLine(stdout, `Added member: ${getRequiredStringOption(parsed, "email")}`);
  }

  return 0;
};

const runMembersUpdateCommand = async (
  parsed: ParsedArguments,
  dependencies: BaseBuddyCliDependencies,
) => {
  assertKnownOptions(parsed, "members:update", [
    "actor-email",
    "actor-id",
    "author-scopes",
    "json",
    "project",
    "roles",
    "user-email",
    "user-id",
  ]);
  const stdout = dependencies.stdout ?? defaultStdout;

  if (parsed.options.help) {
    printSimpleHelp(stdout, "pnpm basebuddy members:update --project <project> --actor-email <email> --user-email <email> --roles <roles>", [
      "--project <value>        Project id or slug.",
      "--actor-email <value>    Acting local user email.",
      "--actor-id <value>       Acting local user id.",
      "--user-email <value>     Target local user email.",
      "--user-id <value>        Target local user id.",
      "--roles <value>          Comma-separated roles.",
      "--author-scopes <value>  Comma-separated author ids, optionally id:false.",
    ]);
    return 0;
  }

  const project = await getRequiredProjectFromOption(parsed);
  const actor = await getRequiredUserByEmailOrId(
    getOptionalStringOption(parsed, "actor-email") ??
      getOptionalStringOption(parsed, "actor-id") ??
      "",
  );
  const user = await getRequiredUserByEmailOrId(
    getOptionalStringOption(parsed, "user-email") ??
      getOptionalStringOption(parsed, "user-id") ??
      "",
  );
  const roles = parseCommaList(getRequiredStringOption(parsed, "roles"));
  const authorScopes = parseAuthorScopes(getOptionalStringOption(parsed, "author-scopes"));
  assertAuthorScopesMatchRoles({ authorScopes, roles });
  await updateConfigProjectMemberAccess({
    actorUserId: actor.id,
    authorScopes,
    projectId: project.id,
    roles,
    userId: user.id,
  });
  const member = await getProjectMemberByUserId({
    projectId: project.id,
    userId: user.id,
  });

  if (parsed.options.json) {
    writeJson(stdout, { member });
  } else {
    writeLine(stdout, `Updated member: ${user.email}`);
  }

  return 0;
};

const runMembersRemoveCommand = async (
  parsed: ParsedArguments,
  dependencies: BaseBuddyCliDependencies,
) => {
  assertKnownOptions(parsed, "members:remove", ["actor-email", "actor-id", "json", "project", "user-email", "user-id"]);
  const stdout = dependencies.stdout ?? defaultStdout;

  if (parsed.options.help) {
    printSimpleHelp(stdout, "pnpm basebuddy members:remove --project <project> --actor-email <email> --user-email <email>", [
      "--project <value>      Project id or slug.",
      "--actor-email <value>  Acting local user email.",
      "--actor-id <value>     Acting local user id.",
      "--user-email <value>   Target local user email.",
      "--user-id <value>      Target local user id.",
    ]);
    return 0;
  }

  const project = await getRequiredProjectFromOption(parsed);
  const actor = await getRequiredUserByEmailOrId(
    getOptionalStringOption(parsed, "actor-email") ??
      getOptionalStringOption(parsed, "actor-id") ??
      "",
  );
  const user = await getRequiredUserByEmailOrId(
    getOptionalStringOption(parsed, "user-email") ??
      getOptionalStringOption(parsed, "user-id") ??
      "",
  );
  await removeConfigProjectMember({
    actorUserId: actor.id,
    projectId: project.id,
    userId: user.id,
  });

  if (parsed.options.json) {
    writeJson(stdout, { removedUser: toPublicUser(user) });
  } else {
    writeLine(stdout, `Removed member: ${user.email}`);
  }

  return 0;
};

const runPermissionsGetCommand = async (
  parsed: ParsedArguments,
  dependencies: BaseBuddyCliDependencies,
) => {
  assertKnownOptions(parsed, "permissions:get", ["actor-email", "actor-id", "json", "project"]);
  const stdout = dependencies.stdout ?? defaultStdout;

  if (parsed.options.help) {
    printSimpleHelp(stdout, "pnpm basebuddy permissions:get --project <project> --actor-email <email>", [
      "--project <value>      Project id or slug.",
      "--actor-email <value>  Existing local user email.",
      "--actor-id <value>     Existing local user id.",
    ]);
    return 0;
  }

  const project = await getRequiredProjectFromOption(parsed);
  const actor = await getRequiredUserByEmailOrId(
    getOptionalStringOption(parsed, "actor-email") ??
      getOptionalStringOption(parsed, "actor-id") ??
      "",
  );
  const result = await listConfigProjectPermissionMembers({
    currentUserId: actor.id,
    projectId: project.id,
  });

  if (parsed.options.json) {
    writeJson(stdout, result);
  } else {
    writeLine(stdout, `Permissions for ${project.slug}`);
    for (const member of result.members) {
      writeLine(stdout, `- ${member.email ?? member.userId}: ${member.effectivePermissionKeys.join(",")}`);
    }
  }

  return 0;
};

const runPermissionsSetCommand = async (
  parsed: ParsedArguments,
  dependencies: BaseBuddyCliDependencies,
) => {
  assertKnownOptions(parsed, "permissions:set", [
    "actor-email",
    "actor-id",
    "allow",
    "deny",
    "json",
    "project",
    "user-email",
    "user-id",
  ]);
  const stdout = dependencies.stdout ?? defaultStdout;

  if (parsed.options.help) {
    printSimpleHelp(stdout, "pnpm basebuddy permissions:set --project <project> --actor-email <email> --user-email <email> [--allow keys] [--deny keys]", [
      "--project <value>      Project id or slug.",
      "--actor-email <value>  Acting local user email.",
      "--actor-id <value>     Acting local user id.",
      "--user-email <value>   Target local user email.",
      "--user-id <value>      Target local user id.",
      "--allow <value>        Comma-separated permission keys.",
      "--deny <value>         Comma-separated permission keys.",
    ]);
    return 0;
  }

  const project = await getRequiredProjectFromOption(parsed);
  const actor = await getRequiredUserByEmailOrId(
    getOptionalStringOption(parsed, "actor-email") ??
      getOptionalStringOption(parsed, "actor-id") ??
      "",
  );
  const user = await getRequiredUserByEmailOrId(
    getOptionalStringOption(parsed, "user-email") ??
      getOptionalStringOption(parsed, "user-id") ??
      "",
  );

  await setConfigProjectMemberPermissionOverrides({
    actorUserId: actor.id,
    allowPermissionKeys: parseCommaList(getOptionalStringOption(parsed, "allow")),
    denyPermissionKeys: parseCommaList(getOptionalStringOption(parsed, "deny")),
    projectId: project.id,
    userId: user.id,
  });
  const member = await getProjectMemberByUserId({
    projectId: project.id,
    userId: user.id,
  });

  if (parsed.options.json) {
    writeJson(stdout, { member });
  } else {
    writeLine(stdout, `Updated permissions: ${user.email}`);
  }

  return 0;
};

const runInvitesListCommand = async (
  parsed: ParsedArguments,
  dependencies: BaseBuddyCliDependencies,
) => {
  assertKnownOptions(parsed, "invites:list", ["actor-email", "actor-id", "json", "page", "page-size", "project"]);
  const stdout = dependencies.stdout ?? defaultStdout;

  if (parsed.options.help) {
    printSimpleHelp(stdout, "pnpm basebuddy invites:list --project <project> --actor-email <email>", [
      "--project <value>      Project id or slug.",
      "--actor-email <value>  Acting local user email.",
      "--actor-id <value>     Acting local user id.",
    ]);
    return 0;
  }

  const project = await getRequiredProjectFromOption(parsed);
  const actor = await getRequiredUserByEmailOrId(
    getOptionalStringOption(parsed, "actor-email") ??
      getOptionalStringOption(parsed, "actor-id") ??
      "",
  );
  const result = await listConfigProjectMemberInvitations({
    actorUserId: actor.id,
    page: getOptionalNumberOption(parsed, "page"),
    pageSize: getOptionalNumberOption(parsed, "page-size"),
    projectId: project.id,
  });

  if (parsed.options.json) {
    writeJson(stdout, result);
  } else {
    writeLine(stdout, `Invitations for ${project.slug}`);
    for (const invitation of result.invitations) {
      writeLine(stdout, `- ${invitation.invitedEmail}: ${invitation.status}`);
    }
  }

  return 0;
};

const runInvitesCreateCommand = async (
  parsed: ParsedArguments,
  dependencies: BaseBuddyCliDependencies,
) => {
  assertKnownOptions(parsed, "invites:create", [
    "actor-email",
    "actor-id",
    "author-scopes",
    "email",
    "expires-at",
    "json",
    "project",
    "roles",
  ]);
  const stdout = dependencies.stdout ?? defaultStdout;

  if (parsed.options.help) {
    printSimpleHelp(stdout, "pnpm basebuddy invites:create --project <project> --actor-email <email> --email <email> --roles <roles>", [
      "--project <value>        Project id or slug.",
      "--actor-email <value>    Acting local user email.",
      "--actor-id <value>       Acting local user id.",
      "--email <value>          Invitee email.",
      "--roles <value>          Comma-separated roles.",
      "--author-scopes <value>  Comma-separated author ids, optionally id:false.",
      "--expires-at <value>     ISO datetime.",
    ]);
    return 0;
  }

  const project = await getRequiredProjectFromOption(parsed);
  const actor = await getRequiredUserByEmailOrId(
    getOptionalStringOption(parsed, "actor-email") ??
      getOptionalStringOption(parsed, "actor-id") ??
      "",
  );
  const result = await createConfigProjectMemberInvitation({
    actorUserId: actor.id,
    authorScopes: parseAuthorScopes(getOptionalStringOption(parsed, "author-scopes")),
    email: getRequiredStringOption(parsed, "email"),
    expiresAt: getOptionalStringOption(parsed, "expires-at"),
    projectId: project.id,
    publicToken: createCliProjectMemberInvitationToken(),
    roles: parseCommaList(getRequiredStringOption(parsed, "roles")),
  });
  const invitations = await listConfigProjectMemberInvitations({
    actorUserId: actor.id,
    projectId: project.id,
  });
  const invitation = invitations.invitations.find(
    (candidate) => candidate.invitationId === result.invitationId,
  );

  if (parsed.options.json) {
    writeJson(stdout, { invitation });
  } else {
    writeLine(stdout, `Created invitation: ${invitation?.invitePath ?? result.invitationId}`);
  }

  return 0;
};

const runInvitesRevokeCommand = async (
  parsed: ParsedArguments,
  dependencies: BaseBuddyCliDependencies,
) => {
  assertKnownOptions(parsed, "invites:revoke", ["actor-email", "actor-id", "invitation-id", "json", "project"]);
  const stdout = dependencies.stdout ?? defaultStdout;

  if (parsed.options.help) {
    printSimpleHelp(stdout, "pnpm basebuddy invites:revoke --project <project> --actor-email <email> --invitation-id <id>", [
      "--project <value>        Project id or slug.",
      "--actor-email <value>    Acting local user email.",
      "--actor-id <value>       Acting local user id.",
      "--invitation-id <value>  Invitation id.",
    ]);
    return 0;
  }

  const project = await getRequiredProjectFromOption(parsed);
  const actor = await getRequiredUserByEmailOrId(
    getOptionalStringOption(parsed, "actor-email") ??
      getOptionalStringOption(parsed, "actor-id") ??
      "",
  );
  const invitationId = getRequiredStringOption(parsed, "invitation-id");

  await revokeConfigProjectMemberInvitation({
    actorUserId: actor.id,
    invitationId,
    projectId: project.id,
  });

  if (parsed.options.json) {
    writeJson(stdout, { invitationId, revoked: true });
  } else {
    writeLine(stdout, `Revoked invitation: ${invitationId}`);
  }

  return 0;
};

const runAgentSetupCommand = async (
  parsed: ParsedArguments,
  dependencies: BaseBuddyCliDependencies,
) => {
  assertKnownOptions(parsed, "agent:setup", ["json"]);
  const stdout = dependencies.stdout ?? defaultStdout;

  if (parsed.options.help) {
    printSimpleHelp(stdout, "pnpm basebuddy agent:setup [options]", []);
    return 0;
  }

  const workflow = getAgentSetupWorkflow();

  if (parsed.options.json) {
    writeJson(stdout, {
      notes: [
        "Use CLI output as the source of truth before editing JSON by hand.",
        "Use schema:inspect before writing mapping hints.",
        "Use mapping:explain before mapping:set.",
      ],
      workflow,
    });
  } else {
    writeLine(stdout, "BaseBuddy agent setup workflow");
    writeLine(stdout);
    for (const [index, step] of workflow.entries()) {
      writeLine(stdout, `${index + 1}. ${step.command}`);
      writeLine(stdout, `   ${step.purpose}`);
    }
  }

  return 0;
};

const runSchemaInspectCommand = async (
  parsed: ParsedArguments,
  dependencies: BaseBuddyCliDependencies,
) => {
  assertKnownOptions(parsed, "schema:inspect", ["json", "no-samples", "schema", "table"]);
  const stdout = dependencies.stdout ?? defaultStdout;

  if (parsed.options.help) {
    printSimpleHelp(stdout, "pnpm basebuddy schema:inspect [--schema public] [--table posts]", [
      "--schema <value>  Limit inspection to one schema.",
      "--table <value>   Limit inspection to one table or comma-separated tables.",
      "--no-samples      Skip sample row reads.",
    ]);
    return 0;
  }

  const options = {
    ...getSchemaInspectOptions(parsed),
    includeSamples: parsed.options["no-samples"] === true ? false : getSchemaInspectOptions(parsed).includeSamples,
  };
  const schema = await inspectContentSchema(dependencies, options);

  if (parsed.options.json) {
    writeJson(stdout, schema);
  } else {
    writeLine(stdout, "BaseBuddy schema inspection");
    for (const table of schema.tables) {
      const count = table.rowCountEstimate === null ? "unknown rows" : `${table.rowCountEstimate} estimated rows`;
      writeLine(stdout, `- ${table.schema}.${table.name} (${table.kind}, ${count})`);
      writeLine(stdout, `  primary key: ${table.primaryKey ?? "none"}`);
      for (const column of table.columns) {
        const nullable = column.isNullable ? "nullable" : "required";
        writeLine(stdout, `  - ${column.name}: ${column.dataType}${column.isArray ? "[]" : ""}, ${nullable}`);
      }
    }
  }

  return 0;
};

const getBindingStatusOption = (parsed: ParsedArguments): ContentBindingStatus | null => {
  const value = getOptionalStringOption(parsed, "binding-status");

  if (!value) {
    return null;
  }

  if (!CONTENT_BINDING_STATUS_VALUES.includes(value as ContentBindingStatus)) {
    throw new Error(`--binding-status must be one of: ${CONTENT_BINDING_STATUS_VALUES.join(", ")}.`);
  }

  return value as ContentBindingStatus;
};

const runMappingDraftCommand = async (
  parsed: ParsedArguments,
  dependencies: BaseBuddyCliDependencies,
) => {
  assertKnownOptions(parsed, "mapping:draft", ["hints", "json", "no-samples", "schema", "table"]);
  const stdout = dependencies.stdout ?? defaultStdout;

  if (parsed.options.help) {
    printSimpleHelp(stdout, "pnpm basebuddy mapping:draft [--schema public] [--table posts] [--hints mapping-hints.json]", [
      "--schema <value>  Limit inspection to one schema.",
      "--table <value>   Limit inspection to one table or comma-separated tables.",
      "--hints <value>   Optional JSON hints for table, fields, editor fields, custom fields, and workflow.",
      "--no-samples      Skip sample row reads.",
    ]);
    return 0;
  }

  const inspectOptions = {
    ...getSchemaInspectOptions(parsed),
    includeSamples: parsed.options["no-samples"] === true ? false : getSchemaInspectOptions(parsed).includeSamples,
  };
  const schema = await inspectContentSchema(dependencies, inspectOptions);
  const autoMapping = buildContentAutoMappingResult(schema);
  const hintsPath = getOptionalStringOption(parsed, "hints");
  const hints = hintsPath ? normalizeMappingHints(await readJsonFile(hintsPath)) : {};
  const mappingConfig = applyMappingHints(
    autoMapping.suggestedMappingConfig,
    schema,
    hints,
    inspectOptions,
  );
  const output = {
    generatedAt: autoMapping.generatedAt,
    mappingConfig,
    summary: getMappingSummary(mappingConfig),
    valid: true,
  };

  if (parsed.options.json) {
    writeJson(stdout, output);
  } else {
    writeJson(stdout, mappingConfig);
  }

  return 0;
};

const runMappingExplainCommand = async (
  parsed: ParsedArguments,
  dependencies: BaseBuddyCliDependencies,
) => {
  assertKnownOptions(parsed, "mapping:explain", ["input", "json"]);
  const stdout = dependencies.stdout ?? defaultStdout;

  if (parsed.options.help) {
    printSimpleHelp(stdout, "pnpm basebuddy mapping:explain --input <mapping.json>", [
      "--input <value>  JSON file containing mappingConfig.",
    ]);
    return 0;
  }

  const mappingConfig = normalizeContentMappingConfig(
    await readJsonFile(getRequiredStringOption(parsed, "input")),
  );
  const summary = getMappingSummary(mappingConfig);

  if (parsed.options.json) {
    writeJson(stdout, { mappingConfig, summary, valid: true });
  } else {
    writeLine(stdout, "BaseBuddy mapping summary");
    for (const entityKey of CONTENT_MAPPING_ENTITY_KEYS) {
      const entity = summary.entities[entityKey];
      writeLine(stdout, `- ${entityKey}: ${entity.status}, source ${entity.source ?? "not mapped"}`);
      writeLine(stdout, `  mapped fields: ${entity.mappedFields.length}`);
      writeLine(stdout, `  editor fields: ${entity.editorFieldCount}`);
      writeLine(stdout, `  custom fields: ${entity.customFieldCount}`);
    }
  }

  return 0;
};

const runMappingGetCommand = async (
  parsed: ParsedArguments,
  dependencies: BaseBuddyCliDependencies,
) => {
  assertKnownOptions(parsed, "mapping:get", ["json", "project"]);
  const stdout = dependencies.stdout ?? defaultStdout;

  if (parsed.options.help) {
    printSimpleHelp(stdout, "pnpm basebuddy mapping:get --project <project>", [
      "--project <value>  Project id or slug.",
    ]);
    return 0;
  }

  const project = await getRequiredProjectFromOption(parsed);
  const mapping = await getConfigProjectContentMapping({ projectId: project.id });

  if (parsed.options.json) {
    writeJson(stdout, { mapping });
  } else {
    writeJson(stdout, mapping);
  }

  return 0;
};

const runMappingValidateCommand = async (
  parsed: ParsedArguments,
  dependencies: BaseBuddyCliDependencies,
) => {
  assertKnownOptions(parsed, "mapping:validate", ["input", "json"]);
  const stdout = dependencies.stdout ?? defaultStdout;

  if (parsed.options.help) {
    printSimpleHelp(stdout, "pnpm basebuddy mapping:validate --input <mapping.json>", [
      "--input <value>  JSON file containing mappingConfig.",
    ]);
    return 0;
  }

  const mappingConfig = normalizeContentMappingConfig(
    await readJsonFile(getRequiredStringOption(parsed, "input")),
  );

  if (parsed.options.json) {
    writeJson(stdout, { mappingConfig, valid: true });
  } else {
    writeLine(stdout, "Mapping JSON is valid.");
  }

  return 0;
};

const runMappingSetCommand = async (
  parsed: ParsedArguments,
  dependencies: BaseBuddyCliDependencies,
) => {
  assertKnownOptions(parsed, "mapping:set", ["binding-status", "input", "json", "project"]);
  const stdout = dependencies.stdout ?? defaultStdout;

  if (parsed.options.help) {
    printSimpleHelp(stdout, "pnpm basebuddy mapping:set --project <project> --input <mapping.json>", [
      "--project <value>         Project id or slug.",
      "--input <value>           JSON file containing mappingConfig.",
      "--binding-status <value>  draft, ready, invalid, or archived.",
    ]);
    return 0;
  }

  const project = await getRequiredProjectFromOption(parsed);
  const mapping = await saveConfigProjectContentMappingRevision({
    bindingStatus: getBindingStatusOption(parsed),
    mappingConfig: normalizeContentMappingConfig(
      await readJsonFile(getRequiredStringOption(parsed, "input")),
    ),
    projectId: project.id,
    source: "manual",
  });

  if (parsed.options.json) {
    writeJson(stdout, { mapping });
  } else {
    writeLine(stdout, `Saved mapping revision: ${mapping.revisionVersion ?? "unknown"}`);
  }

  return 0;
};

const runSidebarGetCommand = async (
  parsed: ParsedArguments,
  dependencies: BaseBuddyCliDependencies,
) => {
  assertKnownOptions(parsed, "sidebar:get", ["json", "project"]);
  const stdout = dependencies.stdout ?? defaultStdout;

  if (parsed.options.help) {
    printSimpleHelp(stdout, "pnpm basebuddy sidebar:get --project <project>", [
      "--project <value>  Project id or slug.",
    ]);
    return 0;
  }

  const project = await getRequiredProjectFromOption(parsed);
  const sidebar = await getConfigProjectPostSidebarConfig(project.id);

  if (parsed.options.json) {
    writeJson(stdout, { sidebar });
  } else {
    writeJson(stdout, sidebar);
  }

  return 0;
};

const runSidebarSetCommand = async (
  parsed: ParsedArguments,
  dependencies: BaseBuddyCliDependencies,
) => {
  assertKnownOptions(parsed, "sidebar:set", ["input", "json", "project"]);
  const stdout = dependencies.stdout ?? defaultStdout;

  if (parsed.options.help) {
    printSimpleHelp(stdout, "pnpm basebuddy sidebar:set --project <project> --input <sidebar.json>", [
      "--project <value>  Project id or slug.",
      "--input <value>    JSON file containing sidebar config.",
    ]);
    return 0;
  }

  const project = await getRequiredProjectFromOption(parsed);
  const sidebar = await saveConfigProjectPostSidebarConfig({
    config: await readJsonFile(getRequiredStringOption(parsed, "input")),
    projectId: project.id,
    source: "manual",
  });

  if (parsed.options.json) {
    writeJson(stdout, { sidebar });
  } else {
    writeLine(stdout, "Saved sidebar layout.");
  }

  return 0;
};

const runSidebarResetCommand = async (
  parsed: ParsedArguments,
  dependencies: BaseBuddyCliDependencies,
) => {
  assertKnownOptions(parsed, "sidebar:reset", ["json", "project"]);
  const stdout = dependencies.stdout ?? defaultStdout;

  if (parsed.options.help) {
    printSimpleHelp(stdout, "pnpm basebuddy sidebar:reset --project <project>", [
      "--project <value>  Project id or slug.",
    ]);
    return 0;
  }

  const project = await getRequiredProjectFromOption(parsed);
  const sidebar = await saveConfigProjectPostSidebarConfig({
    config: createDefaultContentPostSidebarConfig(),
    projectId: project.id,
    source: "system",
  });

  if (parsed.options.json) {
    writeJson(stdout, { sidebar });
  } else {
    writeLine(stdout, "Reset sidebar layout.");
  }

  return 0;
};

const getStorageLibraryOption = (parsed: ParsedArguments) => {
  const library = getRequiredStringOption(parsed, "library");

  if (library !== "media" && library !== "files") {
    throw new Error("--library must be media or files.");
  }

  return library;
};

const getStorageProviderOption = (parsed: ParsedArguments): ContentMediaStorageProvider => {
  const provider = getRequiredStringOption(parsed, "provider");

  if (!CONTENT_MEDIA_STORAGE_PROVIDER_VALUES.includes(provider as ContentMediaStorageProvider)) {
    throw new Error(`--provider must be one of: ${CONTENT_MEDIA_STORAGE_PROVIDER_VALUES.join(", ")}.`);
  }

  return provider as ContentMediaStorageProvider;
};

const runStorageGetCommand = async (
  parsed: ParsedArguments,
  dependencies: BaseBuddyCliDependencies,
) => {
  assertKnownOptions(parsed, "storage:get", ["json", "library", "project"]);
  const stdout = dependencies.stdout ?? defaultStdout;

  if (parsed.options.help) {
    printSimpleHelp(stdout, "pnpm basebuddy storage:get --project <project> --library <media|files>", [
      "--project <value>  Project id or slug.",
      "--library <value>  media or files.",
    ]);
    return 0;
  }

  const project = await getRequiredProjectFromOption(parsed);
  const library = getStorageLibraryOption(parsed);
  const mapping = await getConfigProjectContentMapping({ projectId: project.id });
  const storage = library === "media"
    ? mapping.mappingConfig.mediaStorage
    : mapping.mappingConfig.filesStorage;

  if (parsed.options.json) {
    writeJson(stdout, { library, storage });
  } else {
    writeJson(stdout, storage);
  }

  return 0;
};

const runStorageSetCommand = async (
  parsed: ParsedArguments,
  dependencies: BaseBuddyCliDependencies,
) => {
  assertKnownOptions(parsed, "storage:set", [
    "bucket",
    "endpoint",
    "json",
    "library",
    "project",
    "provider",
    "public-url-base",
    "region",
  ]);
  const stdout = dependencies.stdout ?? defaultStdout;

  if (parsed.options.help) {
    printSimpleHelp(stdout, "pnpm basebuddy storage:set --project <project> --library <media|files> --provider <provider>", [
      "--project <value>          Project id or slug.",
      "--library <value>          media or files.",
      "--provider <value>         none, supabase_bucket, or s3_compatible.",
      "--bucket <value>           Bucket name.",
      "--endpoint <value>         S3-compatible endpoint.",
      "--region <value>           S3-compatible region.",
      "--public-url-base <value>  Public URL base.",
    ]);
    return 0;
  }

  const project = await getRequiredProjectFromOption(parsed);
  const library = getStorageLibraryOption(parsed);
  const mapping = await getConfigProjectContentMapping({ projectId: project.id });
  const storage = {
    bucketName: getOptionalStringOption(parsed, "bucket"),
    endpoint: getOptionalStringOption(parsed, "endpoint"),
    provider: getStorageProviderOption(parsed),
    publicUrlBase: getOptionalStringOption(parsed, "public-url-base"),
    region: getOptionalStringOption(parsed, "region"),
  };
  const mappingConfig = normalizeContentMappingConfig({
    ...mapping.mappingConfig,
    [library === "media" ? "mediaStorage" : "filesStorage"]: storage,
  });
  const savedMapping = await saveConfigProjectContentMappingRevision({
    bindingStatus: mapping.bindingStatus,
    mappingConfig,
    projectId: project.id,
    source: "manual",
  });
  const savedStorage = library === "media"
    ? savedMapping.mappingConfig.mediaStorage
    : savedMapping.mappingConfig.filesStorage;

  if (parsed.options.json) {
    writeJson(stdout, { library, storage: savedStorage });
  } else {
    writeLine(stdout, `Saved ${library} storage mapping.`);
  }

  return 0;
};

const runStorageStatusCommand = async (
  parsed: ParsedArguments,
  dependencies: BaseBuddyCliDependencies,
) => {
  assertKnownOptions(parsed, "storage:status", ["json"]);
  const stdout = dependencies.stdout ?? defaultStdout;

  if (parsed.options.help) {
    printSimpleHelp(stdout, "pnpm basebuddy storage:status [options]", []);
    return 0;
  }

  const status = await getBaseBuddyConfigSetupStatus({
    checkContentDatabase: false,
    queryDatabase: dependencies.queryDatabase,
  });
  const sections = status.sections.filter((section) =>
    section.title === "Supabase storage" || section.title === "S3-compatible storage",
  );
  const ready = sections.every((section) => section.status === "ready");

  if (parsed.options.json) {
    writeJson(stdout, { ready, sections });
  } else {
    writeLine(stdout, "BaseBuddy storage status");
    printStatusSections(stdout, sections);
  }

  return ready ? 0 : 1;
};

const formatCliError = (error: unknown) =>
  error instanceof Error ? error.message : "BaseBuddy CLI command failed.";

export const runBaseBuddyCli = async (
  args: string[] = process.argv.slice(2),
  dependencies: BaseBuddyCliDependencies = {},
) => {
  const stdout = dependencies.stdout ?? defaultStdout;
  const stderr = dependencies.stderr ?? defaultStderr;

  try {
    const [command, ...commandArgs] = args;

    if (!command || command === "help" || command === "--help" || command === "-h") {
      printMainHelp(stdout);
      return command ? 0 : 1;
    }

    const parsed = parseArguments(commandArgs);

    switch (command) {
      case "doctor":
        return await runDoctorCommand(parsed, dependencies);
      case "setup":
        return await runSetupCommand(parsed, dependencies);
      case "agent:setup":
        return await runAgentSetupCommand(parsed, dependencies);
      case "users:list":
        return await runUsersListCommand(parsed, dependencies);
      case "user:create":
        return await runUserCreateCommand(parsed, dependencies);
      case "users:delete":
        return await runUsersDeleteCommand(parsed, dependencies);
      case "projects:list":
        return await runProjectsListCommand(parsed, dependencies);
      case "projects:create":
        return await runProjectsCreateCommand(parsed, dependencies);
      case "projects:update":
        return await runProjectsUpdateCommand(parsed, dependencies);
      case "projects:delete":
        return await runProjectsDeleteCommand(parsed, dependencies);
      case "members:list":
        return await runMembersListCommand(parsed, dependencies);
      case "members:add":
        return await runMembersAddCommand(parsed, dependencies);
      case "members:update":
        return await runMembersUpdateCommand(parsed, dependencies);
      case "members:remove":
        return await runMembersRemoveCommand(parsed, dependencies);
      case "invites:list":
        return await runInvitesListCommand(parsed, dependencies);
      case "invites:create":
        return await runInvitesCreateCommand(parsed, dependencies);
      case "invites:revoke":
        return await runInvitesRevokeCommand(parsed, dependencies);
      case "permissions:get":
        return await runPermissionsGetCommand(parsed, dependencies);
      case "permissions:set":
        return await runPermissionsSetCommand(parsed, dependencies);
      case "schema:inspect":
        return await runSchemaInspectCommand(parsed, dependencies);
      case "mapping:draft":
        return await runMappingDraftCommand(parsed, dependencies);
      case "mapping:explain":
        return await runMappingExplainCommand(parsed, dependencies);
      case "mapping:get":
        return await runMappingGetCommand(parsed, dependencies);
      case "mapping:set":
        return await runMappingSetCommand(parsed, dependencies);
      case "mapping:validate":
        return await runMappingValidateCommand(parsed, dependencies);
      case "sidebar:get":
        return await runSidebarGetCommand(parsed, dependencies);
      case "sidebar:set":
        return await runSidebarSetCommand(parsed, dependencies);
      case "sidebar:reset":
        return await runSidebarResetCommand(parsed, dependencies);
      case "storage:get":
        return await runStorageGetCommand(parsed, dependencies);
      case "storage:set":
        return await runStorageSetCommand(parsed, dependencies);
      case "storage:status":
        return await runStorageStatusCommand(parsed, dependencies);
      default:
        writeLine(stderr, `Unknown command: ${command}`);
        writeLine(stderr);
        printMainHelp(stderr);
        return 1;
    }
  } catch (error) {
    writeLine(stderr, formatCliError(error));
    return 1;
  }
};

const isDirectRun = () =>
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isDirectRun()) {
  void runBaseBuddyCli().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
