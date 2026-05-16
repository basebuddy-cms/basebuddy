import { quotePostgresIdentifier } from "./sql";

const normalizePostgresWhereClause = (clause: string) => clause.trim();

const stripPostgresWhereKeyword = (clause: string) =>
  clause.replace(/^where\s+/i, "").trim();

const combinePostgresWhereClauses = (clauses: string[]) => {
  const predicates = clauses
    .map(normalizePostgresWhereClause)
    .filter(Boolean)
    .map(stripPostgresWhereKeyword);

  return predicates.length ? `where ${predicates.join(" and ")}` : "";
};

const quotePostgresStringLiteral = (value: string) => `'${value.replace(/'/g, "''")}'`;

export const buildPostgresUniqueSlugLookupQuery = ({
  hasExcludeId,
  idColumn,
  idColumnUsesNativeComparison,
  slugColumn,
  slugColumnUsesNativeComparison,
  tableName,
}: {
  hasExcludeId: boolean;
  idColumn: string;
  idColumnUsesNativeComparison: boolean;
  slugColumn: string;
  slugColumnUsesNativeComparison: boolean;
  tableName: string;
}) => `
        select ${quotePostgresIdentifier(idColumn)}::text as id
        from ${tableName}
        where ${
          slugColumnUsesNativeComparison
            ? `${quotePostgresIdentifier(slugColumn)} = $1`
            : `${quotePostgresIdentifier(slugColumn)}::text = $1`
        }${
          hasExcludeId
            ? `
          and ${
            idColumnUsesNativeComparison
              ? `${quotePostgresIdentifier(idColumn)} <> $2`
              : `${quotePostgresIdentifier(idColumn)}::text <> $2::text`
          }`
            : ""
        }
        limit 1
      `;

export const buildPostgresEntityRowsQuery = ({
  filterByIds,
  idColumn,
  selectClause,
  tableName,
}: {
  filterByIds: boolean;
  idColumn: string | null;
  selectClause: string;
  tableName: string;
}) =>
  filterByIds && idColumn
    ? `
            select ${selectClause}
            from ${tableName}
            where ${quotePostgresIdentifier(idColumn)} = any($1)
          `
    : `select ${selectClause} from ${tableName}`;

export const buildPostgresEntityIdFilterClause = ({
  idColumn,
}: {
  idColumn: string;
}) => `where ${quotePostgresIdentifier(idColumn)}::text = any($1::text[])`;

export const buildPostgresEntityCountQuery = ({
  filterClause,
  tableName,
}: {
  filterClause: string;
  tableName: string;
}) => `select count(*)::text as count from ${tableName} ${filterClause}`;

export const buildPostgresEntityPageRowsQuery = ({
  filterClause,
  filterParamCount,
  orderClause,
  selectClause,
  tableName,
}: {
  filterClause: string;
  filterParamCount: number;
  orderClause: string;
  selectClause: string;
  tableName: string;
}) => `
      select ${selectClause}
      from ${tableName}
      ${filterClause}
      ${orderClause}
      limit $${filterParamCount + 1}
      offset $${filterParamCount + 2}
    `;

export const buildPostgresEntityCursorPageRowsQuery = ({
  cursorClause,
  filterClause,
  limitParamIndex,
  orderClause,
  selectClause,
  tableName,
}: {
  cursorClause?: string | null;
  filterClause: string;
  limitParamIndex: number;
  orderClause: string;
  selectClause: string;
  tableName: string;
}) => `
      select ${selectClause}
      from ${tableName}
      ${combinePostgresWhereClauses([filterClause, cursorClause ?? ""])}
      ${orderClause}
      limit $${limitParamIndex}
    `;

export const buildPostgresCategoryChildExistsQuery = ({
  idColumn,
  limitParamIndex,
  parentColumn,
  tableName,
}: {
  idColumn: string;
  limitParamIndex: number;
  parentColumn: string;
  tableName: string;
}) => {
  void idColumn;

  return `
      select distinct ${quotePostgresIdentifier(parentColumn)}::text as parent_id
      from ${tableName}
      where ${quotePostgresIdentifier(parentColumn)} = any($1)
      limit $${limitParamIndex}
    `;
};

export const buildPostgresEntityRowsByPredicateQuery = ({
  predicateClause,
  selectClause,
  tableName,
}: {
  predicateClause: string;
  selectClause: string;
  tableName: string;
}) => `
         select ${selectClause}
         from ${tableName}
         where ${predicateClause}
         limit 1
       `;

export const buildPostgresPostRowsQuery = ({
  orderClause,
  selectClause,
  tableName,
  whereClause,
}: {
  orderClause: string;
  selectClause: string;
  tableName: string;
  whereClause: string;
}) => `select ${selectClause} from ${tableName} ${whereClause} ${orderClause}`;

export const buildPostgresUniqueValueLookupQuery = ({
  excludePredicate,
  idColumn,
  tableName,
  valuePredicate,
}: {
  excludePredicate: string | null;
  idColumn: string;
  tableName: string;
  valuePredicate: string;
}) => `
        select ${quotePostgresIdentifier(idColumn)}::text as id
        from ${tableName}
        where ${valuePredicate}
          ${excludePredicate ? `and ${excludePredicate}` : ""}
        limit 1
      `;

export const buildPostgresSingleValuePredicate = ({
  columnName,
  operator,
  paramIndex,
  usesNativeComparison,
}: {
  columnName: string;
  operator: "=" | "<>";
  paramIndex: number;
  usesNativeComparison: boolean;
}) =>
  usesNativeComparison
    ? `${quotePostgresIdentifier(columnName)} ${operator} $${paramIndex}`
    : `${quotePostgresIdentifier(columnName)}::text ${operator} $${paramIndex}::text`;

export const buildPostgresTextExpressionPredicate = ({
  expression,
  operator,
  paramIndex,
}: {
  expression: string;
  operator: "=" | "<>";
  paramIndex: number;
}) => `${expression} ${operator} $${paramIndex}::text`;

export const buildPostgresIndexedPrefixSearchPredicate = ({
  expression,
  paramIndex,
}: {
  expression: string;
  paramIndex: number;
}) => `lower(${expression}) like lower($${paramIndex}::text || '%')`;

export const buildPostgresTrigramSearchPredicate = ({
  expression,
  paramIndex,
}: {
  expression: string;
  paramIndex: number;
}) => `${expression} ilike '%' || $${paramIndex}::text || '%'`;

export const buildPostgresRelationOptionSearchQuery = ({
  extraWhereClause,
  idColumn,
  labelExpression,
  limitParamIndex,
  orderClause,
  searchParamIndex,
  searchPredicate,
  tableName,
}: {
  extraWhereClause?: string | null;
  idColumn: string;
  labelExpression: string;
  limitParamIndex: number;
  orderClause: string;
  searchParamIndex: number;
  searchPredicate?: string | null;
  tableName: string;
}) => `
      select
        ${quotePostgresIdentifier(idColumn)}::text as id,
        ${labelExpression}::text as label
      from ${tableName}
      ${combinePostgresWhereClauses([
        extraWhereClause ?? "",
        searchPredicate ?? `coalesce($${searchParamIndex}::text, '') = ''`,
      ])}
      ${orderClause}
      limit $${limitParamIndex}
    `;

export const buildPostgresSelectedIdsHydrationQuery = ({
  idColumn,
  labelExpression,
  metadataExpressions,
  tableName,
}: {
  idColumn: string;
  labelExpression: string;
  metadataExpressions?: Record<string, string>;
  tableName: string;
}) => {
  const idExpression = `${quotePostgresIdentifier(idColumn)}::text`;
  const metadataEntries = Object.entries(metadataExpressions ?? {});
  const metadataSelectClause = metadataEntries.length
    ? `,\n        jsonb_build_object(${metadataEntries
        .map(([key, expression]) => `${quotePostgresStringLiteral(key)}, ${expression}`)
        .join(", ")}) as metadata`
    : "";

  return `
      select
        ${idExpression} as id,
        ${labelExpression}::text as label${metadataSelectClause}
      from ${tableName}
      where ${idExpression} = any($1::text[])
      order by array_position($1::text[], ${idExpression})
    `;
};

export const buildPostgresApproximateTableRowEstimateQuery = () => `
      select coalesce(c.reltuples::bigint, 0)::text as estimated_count
      from pg_class c
      where c.oid = to_regclass($1)
    `;

export const buildPostgresBoundedExactCountQuery = ({
  filterClause,
  limitParamIndex,
  tableName,
}: {
  filterClause: string;
  limitParamIndex: number;
  tableName: string;
}) => `
      select
        count(*)::text as count,
        (count(*) >= $${limitParamIndex}::bigint) as reached_limit
      from (select 1 from ${tableName} ${filterClause} limit $${limitParamIndex}) as bounded_count
    `;

export const buildPostgresRelationExistsPredicate = ({
  discriminatorColumn,
  discriminatorParamIndex,
  joinSourceColumn,
  joinTableName,
  postIdColumn,
  relationValuePredicate,
  sourceUsesNativeComparison,
}: {
  discriminatorColumn?: string | null;
  discriminatorParamIndex?: number | null;
  joinSourceColumn: string;
  joinTableName: string;
  postIdColumn: string;
  relationValuePredicate: string;
  sourceUsesNativeComparison: boolean;
}) => `exists (
                select 1
                from ${joinTableName}
                where ${
                  sourceUsesNativeComparison
                    ? `${quotePostgresIdentifier(joinSourceColumn)} = ${quotePostgresIdentifier(postIdColumn)}`
                    : `${quotePostgresIdentifier(joinSourceColumn)}::text = ${quotePostgresIdentifier(postIdColumn)}::text`
                }
                  and ${relationValuePredicate}
                  ${
                    discriminatorColumn && discriminatorParamIndex
                      ? `\n                  and ${quotePostgresIdentifier(discriminatorColumn)}::text = $${discriminatorParamIndex}::text`
                      : ""
                  }
              )`;

export const buildPostgresRelatedValueRowsByTargetIdsQuery = ({
  tableName,
  targetColumn,
  valueColumn,
}: {
  tableName: string;
  targetColumn: string;
  valueColumn: string;
}) => `
                select
                  ${quotePostgresIdentifier(targetColumn)} as ${quotePostgresIdentifier(targetColumn)},
                  ${quotePostgresIdentifier(valueColumn)} as ${quotePostgresIdentifier(valueColumn)}
                from ${tableName}
                where ${quotePostgresIdentifier(targetColumn)}::text = any($1::text[])
              `;

export const buildPostgresRelationRowsQuery = ({
  discriminatorColumn,
  joinSourceColumn,
  joinSourcePredicate,
  joinTableName,
  relationOrderColumn,
  relationValueColumn,
}: {
  discriminatorColumn?: string | null;
  joinSourceColumn: string;
  joinSourcePredicate: string;
  joinTableName: string;
  relationOrderColumn?: string | null;
  relationValueColumn: string;
}) => `
        select
          ${quotePostgresIdentifier(joinSourceColumn)} as post_id,
          ${quotePostgresIdentifier(relationValueColumn)} as related_value
          ${
            relationOrderColumn
              ? `,\n          ${quotePostgresIdentifier(relationOrderColumn)}`
              : ""
          }
        from ${joinTableName}
        where ${joinSourcePredicate}
          ${discriminatorColumn ? `and ${quotePostgresIdentifier(discriminatorColumn)}::text = $2::text` : ""}
      `;

export const buildPostgresHelperRowsForPostIdsQuery = ({
  helperPostIdColumn,
  helperTableName,
  helperValueColumn,
}: {
  helperPostIdColumn: string;
  helperTableName: string;
  helperValueColumn: string;
}) => `
          select
            ${quotePostgresIdentifier(helperPostIdColumn)}::text as post_id,
            ${quotePostgresIdentifier(helperValueColumn)} as related_value
          from ${helperTableName}
          where ${quotePostgresIdentifier(helperPostIdColumn)}::text = any($1::text[])
        `;

export const buildPostgresHelperValueConflictQuery = ({
  helperPostIdColumn,
  helperTableName,
  helperValueColumn,
}: {
  helperPostIdColumn: string;
  helperTableName: string;
  helperValueColumn: string;
}) => `
          select ${quotePostgresIdentifier(helperPostIdColumn)}::text as id
          from ${helperTableName}
          where ${quotePostgresIdentifier(helperValueColumn)}::text = $1::text
            and ${quotePostgresIdentifier(helperPostIdColumn)}::text <> $2::text
          limit 1
        `;

export const buildPostgresHelperRowsForPostIdQuery = ({
  helperPostIdColumn,
  helperTableName,
  helperValueColumn,
}: {
  helperPostIdColumn: string;
  helperTableName: string;
  helperValueColumn: string;
}) => `
        select
          ${quotePostgresIdentifier(helperPostIdColumn)}::text as post_id,
          ${quotePostgresIdentifier(helperValueColumn)} as related_value
        from ${helperTableName}
          where ${quotePostgresIdentifier(helperPostIdColumn)}::text = $1::text
        `;

export const buildPostgresTargetValueConflictQuery = ({
  tableName,
  targetColumn,
  valueColumn,
}: {
  tableName: string;
  targetColumn: string;
  valueColumn: string;
}) => `
          select ${quotePostgresIdentifier(targetColumn)}::text as id
          from ${tableName}
          where ${quotePostgresIdentifier(valueColumn)}::text = $1::text
            and ${quotePostgresIdentifier(targetColumn)}::text <> $2::text
          limit 1
        `;

export const buildPostgresEntityByIdQuery = ({
  idColumn,
  tableName,
}: {
  idColumn: string;
  tableName: string;
}) => `
        select ${quotePostgresIdentifier(idColumn)}::text as id
        from ${tableName}
        where ${quotePostgresIdentifier(idColumn)}::text = $1
        limit 1
      `;

export const buildPostgresInsertReturningIdQuery = ({
  idColumn,
  insertColumns,
  placeholders,
  tableName,
}: {
  idColumn: string;
  insertColumns: string[];
  placeholders: string[];
  tableName: string;
}) => `
      insert into ${tableName} (${insertColumns.join(", ")})
      values (${placeholders.join(", ")})
      returning ${quotePostgresIdentifier(idColumn)}::text as id
    `;

export const buildPostgresUpdateReturningIdQuery = ({
  idColumn,
  tableName,
  updates,
}: {
  idColumn: string;
  tableName: string;
  updates: string[];
}) => `
      update ${tableName}
      set ${updates.join(", ")}
      where ${quotePostgresIdentifier(idColumn)}::text = $1
      returning ${quotePostgresIdentifier(idColumn)}::text as id
    `;

export const buildPostgresUpdateByIdQuery = ({
  idColumn,
  tableName,
  updates,
}: {
  idColumn: string;
  tableName: string;
  updates: string[];
}) => `
          update ${tableName}
          set ${updates.join(", ")}
          where ${quotePostgresIdentifier(idColumn)}::text = $1
        `;

export const buildPostgresDeleteEntitiesByIdsQuery = ({
  idColumn,
  tableName,
}: {
  idColumn: string;
  tableName: string;
}) => `
      delete from ${tableName}
      where ${quotePostgresIdentifier(idColumn)}::text = any($1::text[])
    `;

export const buildPostgresDeleteEntityByIdQuery = ({
  idColumn,
  tableName,
}: {
  idColumn: string;
  tableName: string;
}) => `
      delete from ${tableName}
      where ${quotePostgresIdentifier(idColumn)}::text = $1
    `;

export const buildPostgresDeleteByPredicateQuery = ({
  extraPredicate,
  predicate,
  tableName,
}: {
  extraPredicate?: string | null;
  predicate: string;
  tableName: string;
}) => `delete from ${tableName} where ${predicate}${extraPredicate ? ` and ${extraPredicate}` : ""}`;

export const buildPostgresInsertColumnsQuery = ({
  insertColumns,
  tableName,
}: {
  insertColumns: string[];
  tableName: string;
}) => `
          insert into ${tableName} (${insertColumns.map((column) => quotePostgresIdentifier(column)).join(", ")})
          values (${insertColumns.map((_, index) => `$${index + 1}`).join(", ")})
        `;

export const buildPostgresUpdateColumnByTextIdQuery = ({
  lookupColumn,
  tableName,
  valueColumn,
}: {
  lookupColumn: string;
  tableName: string;
  valueColumn: string;
}) => `
        update ${tableName}
        set ${quotePostgresIdentifier(valueColumn)} = $1
        where ${quotePostgresIdentifier(lookupColumn)}::text = $2::text
      `;

export const buildPostgresSelectColumnsByTextIdQuery = ({
  columns,
  idColumn,
  tableName,
}: {
  columns: string[];
  idColumn: string;
  tableName: string;
}) => `
      select ${columns.map((column) => quotePostgresIdentifier(column)).join(", ")}
      from ${tableName}
      where ${quotePostgresIdentifier(idColumn)}::text = $1
      limit 1
    `;

export const buildPostgresStorageBucketsQuery = () => `
          select
            id::text as bucket_id,
            name as bucket_name,
            public as is_public
          from storage.buckets
          order by lower(coalesce(name, id)), id
        `;

export const buildPostgresStorageObjectsQuery = ({
  cursorParamIndex,
  limitParamIndex,
  prefixParamIndex,
  searchParamIndex,
}: {
  cursorParamIndex?: number | null;
  limitParamIndex?: number | null;
  prefixParamIndex?: number | null;
  searchParamIndex?: number | null;
} = {}) => `
        select
          id::text,
          name,
          metadata,
          created_at,
          updated_at
        from storage.objects
        where bucket_id = $1
          ${prefixParamIndex ? `and name like $${prefixParamIndex}::text || '%'` : ""}
          ${searchParamIndex ? `and lower(name) like '%' || lower($${searchParamIndex}::text) || '%'` : ""}
          ${cursorParamIndex ? `and name > $${cursorParamIndex}::text` : ""}
        order by name asc
        ${limitParamIndex ? `limit $${limitParamIndex}` : ""}
      `;

export const buildPostgresStorageObjectCountQuery = () => `
        select count(*)::text as count
        from storage.objects
        where bucket_id = $1
      `;

export const buildPostgresNonImageStorageObjectCountQuery = () => `
        select count(*)::text as count
        from storage.objects
        where bucket_id = $1
          and name not like $2
          and name not like $3
          and not (
            lower(coalesce(metadata ->> 'mimetype', '')) like 'image/%'
            or lower(split_part(name, '.', array_length(string_to_array(name, '.'), 1))) in (
              'avif', 'bmp', 'gif', 'heic', 'heif', 'ico', 'jpeg', 'jpg', 'png', 'svg', 'tif', 'tiff', 'webp'
            )
          )
      `;
