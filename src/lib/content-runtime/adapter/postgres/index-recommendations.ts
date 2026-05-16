import type {
  ContentEntityMapping,
  ContentMappingEntityKey,
  ContentProjectMapping,
  ContentRelationMapping,
} from "@/lib/content-runtime/mapping";

import { quotePostgresIdentifier, quotePostgresQualifiedIdentifier } from "./sql";

export type PostgresMappedContentIndexRecommendationCategory =
  | "filter"
  | "lookup"
  | "relation"
  | "search"
  | "sort";

export type PostgresMappedContentIndexRecommendation = {
  category: PostgresMappedContentIndexRecommendationCategory;
  id: string;
  reason: string;
  sql: string;
  table: {
    schema: string;
    table: string;
  };
  title: string;
};

type ResolvedTableRef = {
  schema: string;
  table: string;
};

const mappedAssetEntityKeys: Array<Extract<ContentMappingEntityKey, "files" | "media">> = [
  "media",
  "files",
];

const normalizeSqlIdentifierSegment = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_") || "value";

const createIndexName = ({
  columns,
  table,
  suffix = "idx",
}: {
  columns: string[];
  table: string;
  suffix?: string;
}) => {
  const rawName = `basebuddy_${normalizeSqlIdentifierSegment(table)}_${columns
    .map(normalizeSqlIdentifierSegment)
    .join("_")}_${suffix}`;

  return rawName.length <= 63 ? rawName : `${rawName.slice(0, 55)}_${rawName.length.toString(36)}`;
};

const resolveEntityTableRef = (entity: ContentEntityMapping): ResolvedTableRef | null => {
  const schema = entity.source.schema?.trim();
  const table = entity.source.table?.trim();

  if (entity.source.kind !== "table" || !schema || !table) {
    return null;
  }

  return { schema, table };
};

const parseTableRef = (tableRef?: string | null): ResolvedTableRef | null => {
  const normalized = tableRef?.trim();

  if (!normalized) {
    return null;
  }

  const [schema, table] = normalized.split(".");

  if (!schema?.trim() || !table?.trim()) {
    return null;
  }

  return {
    schema: schema.trim(),
    table: table.trim(),
  };
};

const createBtreeIndexSql = ({
  columns,
  indexName,
  tableRef,
}: {
  columns: string[];
  indexName: string;
  tableRef: ResolvedTableRef;
}) =>
  `create index if not exists ${quotePostgresIdentifier(indexName)} on ${quotePostgresQualifiedIdentifier(
    tableRef.schema,
    tableRef.table,
  )} (${columns.map(quotePostgresIdentifier).join(", ")});`;

const createTrigramIndexSql = ({
  column,
  indexName,
  tableRef,
}: {
  column: string;
  indexName: string;
  tableRef: ResolvedTableRef;
}) =>
  `create extension if not exists pg_trgm;\ncreate index if not exists ${quotePostgresIdentifier(
    indexName,
  )} on ${quotePostgresQualifiedIdentifier(
    tableRef.schema,
    tableRef.table,
  )} using gin ((coalesce(${quotePostgresIdentifier(column)}::text, '')) gin_trgm_ops);`;

const getMappedColumn = (entity: ContentEntityMapping, fieldKey: string) =>
  entity.fields[fieldKey]?.column?.trim() || null;

const addRecommendation = (
  recommendations: PostgresMappedContentIndexRecommendation[],
  recommendation: PostgresMappedContentIndexRecommendation,
) => {
  if (recommendations.some((existing) => existing.sql === recommendation.sql)) {
    return;
  }

  recommendations.push(recommendation);
};

const addPostColumnIndexRecommendation = ({
  category,
  column,
  id,
  reason,
  recommendations,
  tableRef,
  title,
}: {
  category: PostgresMappedContentIndexRecommendationCategory;
  column: string | null;
  id: string;
  reason: string;
  recommendations: PostgresMappedContentIndexRecommendation[];
  tableRef: ResolvedTableRef;
  title: string;
}) => {
  if (!column) {
    return;
  }

  addRecommendation(recommendations, {
    category,
    id,
    reason,
    sql: createBtreeIndexSql({
      columns: [column],
      indexName: createIndexName({ columns: [column, category], table: tableRef.table }),
      tableRef,
    }),
    table: tableRef,
    title,
  });
};

const addPostTrigramRecommendation = ({
  column,
  fieldKey,
  recommendations,
  tableRef,
  title,
}: {
  column: string | null;
  fieldKey: string;
  recommendations: PostgresMappedContentIndexRecommendation[];
  tableRef: ResolvedTableRef;
  title: string;
}) => {
  if (!column) {
    return;
  }

  addRecommendation(recommendations, {
    category: "search",
    id: `posts-${fieldKey}-trigram-search`,
    reason: `${title} is used in post search. A trigram index keeps partial searches responsive on large tables.`,
    sql: createTrigramIndexSql({
      column,
      indexName: createIndexName({ columns: [column, "trgm"], table: tableRef.table }),
      tableRef,
    }),
    table: tableRef,
    title: `${title} search`,
  });
};

const addRelationRecommendation = ({
  fieldKey,
  postsTableRef,
  recommendations,
  relation,
}: {
  fieldKey: string;
  postsTableRef: ResolvedTableRef;
  recommendations: PostgresMappedContentIndexRecommendation[];
  relation: ContentRelationMapping | undefined;
}) => {
  if (!relation || relation.status !== "mapped") {
    return;
  }

  if (relation.strategy === "foreign_key" && relation.sourceColumn) {
    const column = relation.sourceColumn.trim();

    if (!column) {
      return;
    }

    addRecommendation(recommendations, {
      category: "relation",
      id: `posts-${fieldKey}-foreign-key`,
      reason: "Relation selectors and scoped post lists use this foreign-key column.",
      sql: createBtreeIndexSql({
        columns: [column],
        indexName: createIndexName({ columns: [column, "relation"], table: postsTableRef.table }),
        tableRef: postsTableRef,
      }),
      table: postsTableRef,
      title: `${fieldKey} relation`,
    });
    return;
  }

  if (
    !["join_row", "join_table", "polymorphic_join"].includes(relation.strategy) ||
    !relation.junctionSourceColumn ||
    !relation.junctionTargetColumn
  ) {
    return;
  }

  const junctionTableRef = parseTableRef(relation.junctionTable);

  if (!junctionTableRef) {
    return;
  }

  const columns = [
    relation.junctionSourceColumn,
    relation.junctionTargetColumn,
    relation.discriminatorColumn,
  ]
    .map((column) => column?.trim())
    .filter(Boolean) as string[];

  addRecommendation(recommendations, {
    category: "relation",
    id: `posts-${fieldKey}-${relation.strategy.replace(/_/g, "-")}`,
    reason: "Post relation editing and option hydration use this join table.",
    sql: createBtreeIndexSql({
      columns,
      indexName: createIndexName({ columns, table: junctionTableRef.table }),
      tableRef: junctionTableRef,
    }),
    table: junctionTableRef,
    title: `${fieldKey} join table`,
  });
};

export const buildPostgresMappedPostIndexRecommendations = (
  mapping: ContentProjectMapping,
): PostgresMappedContentIndexRecommendation[] => {
  const recommendations: PostgresMappedContentIndexRecommendation[] = [];
  const { entities } = mapping.mappingConfig;
  const posts = entities.posts;
  const postsTableRef = resolveEntityTableRef(posts);

  if (!postsTableRef || posts.status !== "mapped") {
    return recommendations;
  }

  const postIdColumn = getMappedColumn(posts, "id") ?? posts.source.primaryKey?.trim() ?? null;
  const statusColumn = posts.workflow?.statusColumn?.trim() || getMappedColumn(posts, "status");
  const publishedAtColumn =
    posts.workflow?.publishedAtColumn?.trim() || getMappedColumn(posts, "publishedAt");

  addPostColumnIndexRecommendation({
    category: "lookup",
    column: postIdColumn,
    id: "posts-primary-lookup",
    reason: "Opening, saving, deleting, and refreshing one post use the mapped post ID.",
    recommendations,
    tableRef: postsTableRef,
    title: "Post ID lookup",
  });
  addPostColumnIndexRecommendation({
    category: "filter",
    column: statusColumn,
    id: "posts-status-filter",
    reason: "The posts list can filter by draft, published, and archived status.",
    recommendations,
    tableRef: postsTableRef,
    title: "Status filter",
  });
  addPostColumnIndexRecommendation({
    category: "filter",
    column: publishedAtColumn,
    id: "posts-published-at-filter",
    reason: "Published-date filters and publish-state checks use this timestamp.",
    recommendations,
    tableRef: postsTableRef,
    title: "Published date filter",
  });
  addPostColumnIndexRecommendation({
    category: "sort",
    column: getMappedColumn(posts, "updatedAt"),
    id: "posts-updated-at-sort",
    reason: "The default posts list sorts by updated date.",
    recommendations,
    tableRef: postsTableRef,
    title: "Updated date sort",
  });
  addPostColumnIndexRecommendation({
    category: "sort",
    column: getMappedColumn(posts, "createdAt"),
    id: "posts-created-at-sort",
    reason: "Created-date sorting uses this column.",
    recommendations,
    tableRef: postsTableRef,
    title: "Created date sort",
  });
  addPostColumnIndexRecommendation({
    category: "lookup",
    column: getMappedColumn(posts, "slug"),
    id: "posts-slug-lookup",
    reason: "Slug checks and URL-oriented searches use this column.",
    recommendations,
    tableRef: postsTableRef,
    title: "Slug lookup",
  });

  addPostTrigramRecommendation({
    column: getMappedColumn(posts, "title"),
    fieldKey: "title",
    recommendations,
    tableRef: postsTableRef,
    title: "Title",
  });
  addPostTrigramRecommendation({
    column: getMappedColumn(posts, "slug"),
    fieldKey: "slug",
    recommendations,
    tableRef: postsTableRef,
    title: "Slug",
  });
  addPostTrigramRecommendation({
    column: getMappedColumn(posts, "excerpt"),
    fieldKey: "excerpt",
    recommendations,
    tableRef: postsTableRef,
    title: "Excerpt",
  });

  for (const [fieldKey, relation] of Object.entries(posts.relations)) {
    addRelationRecommendation({
      fieldKey,
      postsTableRef,
      recommendations,
      relation,
    });
  }

  for (const customRelation of posts.customRelationFields ?? []) {
    if (!customRelation.enabled) {
      continue;
    }

    addRelationRecommendation({
      fieldKey: customRelation.fieldKey,
      postsTableRef,
      recommendations,
      relation: customRelation.relation,
    });
  }

  for (const entityKey of mappedAssetEntityKeys) {
    const entity = entities[entityKey];
    const tableRef = resolveEntityTableRef(entity);
    const objectPathColumn = getMappedColumn(entity, "objectPath");

    if (!tableRef || entity.status !== "mapped" || !objectPathColumn) {
      continue;
    }

    addRecommendation(recommendations, {
      category: "lookup",
      id: `${entityKey}-object-path-lookup`,
      reason: "Asset pickers and selected asset hydration use the mapped object path.",
      sql: createBtreeIndexSql({
        columns: [objectPathColumn],
        indexName: createIndexName({
          columns: [objectPathColumn, "lookup"],
          table: tableRef.table,
        }),
        tableRef,
      }),
      table: tableRef,
      title: `${entityKey === "media" ? "Media" : "Files"} object path lookup`,
    });
  }

  return recommendations;
};
