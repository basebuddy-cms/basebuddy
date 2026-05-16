import {
  EXISTING_DB_FALLBACK_TIMESTAMP_COLUMNS,
  ContentDatabaseClient,
  getEntityColumnMetadata,
  getEntityIdColumn,
  getMappedContentRuntime,
  getEntityTableName,
  getFallbackTimestamp,
  getEntitySelectableColumns,
  getMappedFieldColumn,
  getRequiredPrimaryKeyInsertValue,
  getResolvedEntity,
  getRowValue,
  isUsableEntitySource,
  quoteIdentifier,
  resolvePagination,
  toText,
} from "./mapped-content-runtime-support";
import {
  buildContentDeleteEntitiesByIdsQuery,
  buildContentCategoryChildExistsQuery,
  buildContentEntityByIdQuery,
  buildContentEntityCountQuery,
  buildContentEntityIdFilterClause,
  buildContentEntityPageRowsQuery,
  buildContentEntityRowsQuery,
  buildContentInsertReturningIdQuery,
  buildContentUniqueSlugLookupQuery,
  buildContentUpdateReturningIdQuery,
} from "./adapter/query-builders";
import type { ContentProjectMapping, ContentEntityMapping, ContentRelationMapping } from "./mapping";
import {
  slugifyContentValue,
  type ContentAuthor,
  type ContentCategory,
  type ContentFileItem,
  type ContentMedia,
  type ContentPagination,
  type ContentTag,
} from "./shared";
import {
  getCachedProjectRuntimeValue,
  projectRuntimeCacheGroups,
} from "./server-runtime-cache";
import { getContentCategoriesHierarchyCacheKey } from "./server-content-cache-keys";

export type MappedContentCollectionEntryTable = "authors" | "categories" | "tags";

const MAPPED_CONTENT_CATEGORY_HIERARCHY_CACHE_TTL_MS = 30_000;
const MAPPED_CONTENT_CATEGORY_HIERARCHY_CACHE_STALE_WHILE_REVALIDATE_MS = 120_000;

const getCollectionEntryLabel = (collection: MappedContentCollectionEntryTable) =>
  collection === "authors" ? "author" : collection === "categories" ? "category" : "tag";

const normalizeMappedContentCollectionSearch = (value: string | null | undefined) =>
  value?.trim().toLowerCase() ?? "";

const normalizeMappedContentSearchLimit = (limit?: number) => {
  if (!Number.isFinite(limit) || !limit) {
    return 100;
  }

  return Math.max(1, Math.min(250, Math.floor(limit)));
};

const getUniqueSlugForMappedTable = async ({
  base,
  client,
  entity,
  excludeId,
  idColumn,
  slugColumn,
  tableName,
}: {
  base: string;
  client: ContentDatabaseClient;
  entity?: ContentEntityMapping | null;
  excludeId?: string | null;
  idColumn: string;
  slugColumn: string;
  tableName: string;
}) => {
  const normalizedBase = slugifyContentValue(base) || "untitled";
  const normalizedExcludeId = excludeId?.trim() ? excludeId.trim() : null;
  let candidate = normalizedBase;
  let suffix = 2;
  const predicateEntity =
    entity ??
    ({
      source: {
        primaryKey: idColumn,
      },
    } as ContentEntityMapping);

  while (true) {
    const [slugMetadata, idMetadata] = await Promise.all([
      getEntityColumnMetadata({
        client,
        columnName: slugColumn,
        entity: predicateEntity,
      }).catch(() => null),
      getEntityColumnMetadata({
        client,
        columnName: idColumn,
        entity: predicateEntity,
      }).catch(() => null),
    ]);
    const result = await client.query<{ id: string }>(
      buildContentUniqueSlugLookupQuery({
        hasExcludeId: Boolean(normalizedExcludeId),
        idColumn,
        idColumnUsesNativeComparison: Boolean(idMetadata),
        slugColumn,
        slugColumnUsesNativeComparison: Boolean(slugMetadata),
        tableName,
      }),
      normalizedExcludeId ? [candidate, normalizedExcludeId] : [candidate],
    );

    if (!result.rows.length) {
      return candidate;
    }

    candidate = `${normalizedBase}-${suffix}`;
    suffix += 1;
  }
};

const resolveMappedContentCollectionEntity = async ({
  client,
  entity,
  posts = null,
  relation,
}: {
  client: ContentDatabaseClient;
  entity: ContentEntityMapping;
  posts?: ContentEntityMapping | null;
  relation?: ContentRelationMapping;
}) => {
  if (entity.status === "unmapped" || relation?.status === "unmapped" || relation?.strategy === "none") {
    return getResolvedEntity({
      client,
      entity,
      posts,
      relation,
    });
  }

  if (isUsableEntitySource(entity)) {
    return entity;
  }

  return getResolvedEntity({
    client,
    entity,
    posts,
    relation,
  });
};

export const loadEntityRows = async ({
  client,
  columns = null,
  entity,
  ids = null,
  posts = null,
  relation,
}: {
  client: ContentDatabaseClient;
  columns?: string[] | null;
  entity: ContentEntityMapping;
  ids?: string[] | null;
  posts?: ContentEntityMapping | null;
  relation?: ContentRelationMapping;
}) => {
  const resolvedEntity = await resolveMappedContentCollectionEntity({
    client,
    entity,
    posts,
    relation,
  });

  if (!isUsableEntitySource(resolvedEntity)) {
    return {
      entity: resolvedEntity,
      rows: [] as Record<string, unknown>[],
    };
  }

  const normalizedIds = ids === null ? null : [...new Set(ids.map((value) => value.trim()).filter(Boolean))];
  const idColumn = getEntityIdColumn(resolvedEntity);

  if (normalizedIds !== null && !normalizedIds.length) {
    return {
      entity: resolvedEntity,
      rows: [] as Record<string, unknown>[],
    };
  }

  const selectColumns =
    columns && columns.length
      ? await getEntitySelectableColumns({
          client,
          entity: resolvedEntity,
          requestedColumns: columns,
        })
      : [];
  const selectClause = selectColumns.length ? selectColumns.map((column) => quoteIdentifier(column)).join(", ") : "*";

  const result =
    normalizedIds !== null && idColumn
      ? await client.query<Record<string, unknown>>(
          buildContentEntityRowsQuery({
            filterByIds: true,
            idColumn,
            selectClause,
            tableName: getEntityTableName(resolvedEntity),
          }),
          [normalizedIds],
        )
      : await client.query<Record<string, unknown>>(
          buildContentEntityRowsQuery({
            filterByIds: false,
            idColumn,
            selectClause,
            tableName: getEntityTableName(resolvedEntity),
          }),
        );
  return {
    entity: resolvedEntity,
    rows: result.rows,
  };
};

const getRequestedEntityReadColumns = (entity: ContentEntityMapping, fieldKeys: string[]) => {
  const requestedColumns = [
    getEntityIdColumn(entity),
    ...fieldKeys.map((fieldKey) => getMappedFieldColumn(entity, fieldKey)),
    ...EXISTING_DB_FALLBACK_TIMESTAMP_COLUMNS,
  ];
  const uniqueColumns = new Set<string>();

  for (const requestedColumn of requestedColumns) {
    const normalizedColumn = requestedColumn?.trim();

    if (!normalizedColumn) {
      continue;
    }

    uniqueColumns.add(normalizedColumn);
  }

  return [...uniqueColumns];
};

const mapMappedContentAuthorRows = ({
  authorAssignmentsByAuthorId,
  entity,
  rows,
}: {
  authorAssignmentsByAuthorId?: Map<string, { avatar_url: string | null }> | null;
  entity: ContentEntityMapping;
  rows: Record<string, unknown>[];
}) => {
  const idColumn = getEntityIdColumn(entity);

  return rows
    .map((row) => {
      const id = toText(getRowValue(row, idColumn)) ?? "";
      const slugBase = toText(getRowValue(row, getMappedFieldColumn(entity, "name"))) ?? id;
      const generatedSlug = slugifyContentValue(slugBase) || id;

      return {
        avatarUrl: authorAssignmentsByAuthorId?.get(id)?.avatar_url ?? null,
        bio: toText(getRowValue(row, getMappedFieldColumn(entity, "bio"))),
        createdAt: getFallbackTimestamp(row),
        email: toText(getRowValue(row, getMappedFieldColumn(entity, "email"))),
        id,
        name: toText(getRowValue(row, getMappedFieldColumn(entity, "name"))) ?? "",
        slug: toText(getRowValue(row, getMappedFieldColumn(entity, "slug"))) ?? generatedSlug,
      } satisfies ContentAuthor;
    })
    .filter((author) => author.id);
};

const mapMappedContentCategoryRows = ({
  entity,
  rows,
}: {
  entity: ContentEntityMapping;
  rows: Record<string, unknown>[];
}) =>
  buildCategoryHierarchy(
    rows
      .map((row) => {
        const name = toText(getRowValue(row, getMappedFieldColumn(entity, "name"))) ?? "";
        const id = toText(getRowValue(row, getEntityIdColumn(entity))) ?? "";
        const generatedSlug = slugifyContentValue(name || id) || id;

        return {
          createdAt: getFallbackTimestamp(row),
          depth: 0,
          description: toText(getRowValue(row, getMappedFieldColumn(entity, "description"))),
          hasChildren: false,
          hierarchyPath: name,
          id,
          name,
          parentCategoryId: toText(getRowValue(row, getMappedFieldColumn(entity, "parentId"))),
          slug: toText(getRowValue(row, getMappedFieldColumn(entity, "slug"))) ?? generatedSlug,
        } satisfies ContentCategory;
      })
      .filter((category) => category.id),
  );

const mapMappedContentTagRows = ({
  entity,
  rows,
}: {
  entity: ContentEntityMapping;
  rows: Record<string, unknown>[];
}) =>
  rows
    .map((row) => {
      const name = toText(getRowValue(row, getMappedFieldColumn(entity, "name"))) ?? "";
      const id = toText(getRowValue(row, getEntityIdColumn(entity))) ?? "";
      const generatedSlug = slugifyContentValue(name || id) || id;

      return {
        createdAt: getFallbackTimestamp(row),
        description: toText(getRowValue(row, getMappedFieldColumn(entity, "description"))),
        id,
        name,
        slug: toText(getRowValue(row, getMappedFieldColumn(entity, "slug"))) ?? generatedSlug,
      } satisfies ContentTag;
    })
    .filter((tag) => tag.id);

const mapMappedContentMediaRows = ({
  entity,
  rows,
}: {
  entity: ContentEntityMapping;
  rows: Record<string, unknown>[];
}) =>
  rows
    .map((row) => {
      const id = toText(getRowValue(row, getEntityIdColumn(entity))) ?? "";

      return {
        altText: toText(getRowValue(row, getMappedFieldColumn(entity, "altText"))),
        bucketName: "",
        createdAt: getFallbackTimestamp(row),
        fileName: toText(getRowValue(row, getMappedFieldColumn(entity, "title"))) ?? "",
        id,
        objectPath: toText(getRowValue(row, getMappedFieldColumn(entity, "objectPath"))) ?? "",
      } satisfies ContentMedia;
    })
    .filter((mediaItem) => mediaItem.id);

const mapMappedContentFileRows = ({
  entity,
  rows,
}: {
  entity: ContentEntityMapping;
  rows: Record<string, unknown>[];
}) =>
  rows
    .map((row) => {
      const id = toText(getRowValue(row, getEntityIdColumn(entity))) ?? "";

      return {
        createdAt: getFallbackTimestamp(row),
        fileName: toText(getRowValue(row, getMappedFieldColumn(entity, "title"))) ?? "",
        folderPath: "",
        id,
        objectPath: toText(getRowValue(row, getMappedFieldColumn(entity, "objectPath"))) ?? "",
        publicUrl: toText(getRowValue(row, getMappedFieldColumn(entity, "url"))) ?? "",
        sizeBytes: null,
        updatedAt: null,
      } satisfies ContentFileItem;
    })
    .filter((fileItem) => fileItem.id);

const getMappedContentSelectableOrderColumn = (
  columns: Array<string | null | undefined>,
  selectableColumns: string[],
) => {
  if (!selectableColumns.length) {
    return columns.find((column): column is string => Boolean(column?.trim())) ?? null;
  }

  const selectableColumnNames = new Map(
    selectableColumns.map((column) => [column.toLowerCase(), column] as const),
  );

  for (const column of columns) {
    const normalizedColumn = column?.trim();

    if (!normalizedColumn) {
      continue;
    }

    const selectableColumn = selectableColumnNames.get(normalizedColumn.toLowerCase());

    if (selectableColumn) {
      return selectableColumn;
    }
  }

  return null;
};

const buildMappedContentEntityPageOrderClause = (
  entity: ContentEntityMapping,
  selectableColumns: string[] = [],
) => {
  const idColumn = getEntityIdColumn(entity) || entity.source.primaryKey;
  const timestampColumn = getMappedContentSelectableOrderColumn(
    [getMappedFieldColumn(entity, "createdAt"), ...EXISTING_DB_FALLBACK_TIMESTAMP_COLUMNS],
    selectableColumns,
  );

  if (timestampColumn) {
    return `order by ${quoteIdentifier(timestampColumn)} desc, ${quoteIdentifier(idColumn)} desc`;
  }

  const labelColumn = getMappedContentSelectableOrderColumn(
    [getMappedFieldColumn(entity, "name"), getMappedFieldColumn(entity, "title")],
    selectableColumns,
  );

  if (labelColumn) {
    return `order by ${quoteIdentifier(labelColumn)} asc, ${quoteIdentifier(idColumn)} asc`;
  }

  return `order by ${quoteIdentifier(idColumn)} asc`;
};

const buildMappedContentEntitySearchFilterClause = ({
  paramIndex,
  search,
  searchColumns,
}: {
  paramIndex: number;
  search: string;
  searchColumns: string[];
}) => {
  if (!search || !searchColumns.length) {
    return "";
  }

  return `where ${searchColumns
    .map((column) => `lower(coalesce(${quoteIdentifier(column)}::text, '')) like lower($${paramIndex}::text || '%')`)
    .map((predicate) => `(${predicate})`)
    .join(" or ")}`;
};

const loadSearchedEntityRows = async ({
  client,
  columns,
  entity,
  ids = null,
  limit,
  posts = null,
  relation,
  search,
  searchFieldKeys,
}: {
  client: ContentDatabaseClient;
  columns: string[];
  entity: ContentEntityMapping;
  ids?: string[] | null;
  limit?: number;
  posts?: ContentEntityMapping | null;
  relation?: ContentRelationMapping;
  search: string;
  searchFieldKeys: string[];
}) => {
  const resolvedEntity = await resolveMappedContentCollectionEntity({
    client,
    entity,
    posts,
    relation,
  });

  if (!isUsableEntitySource(resolvedEntity)) {
    return {
      entity: resolvedEntity,
      rows: [] as Record<string, unknown>[],
    };
  }

  const normalizedIds = ids === null ? null : [...new Set(ids.map((value) => value.trim()).filter(Boolean))];
  const idColumn = getEntityIdColumn(resolvedEntity);

  if (normalizedIds !== null && (!normalizedIds.length || !idColumn)) {
    return {
      entity: resolvedEntity,
      rows: [] as Record<string, unknown>[],
    };
  }

  const selectColumns = await getEntitySelectableColumns({
    client,
    entity: resolvedEntity,
    requestedColumns: columns,
  });
  const selectableColumnSet = new Set(selectColumns.map((column) => column.toLowerCase()));
  const searchColumns = searchFieldKeys
    .map((fieldKey) => getMappedFieldColumn(resolvedEntity, fieldKey))
    .filter((column): column is string => Boolean(column?.trim()))
    .filter((column) => selectableColumnSet.has(column.toLowerCase()));
  const normalizedSearch = normalizeMappedContentCollectionSearch(search);
  const filterPredicates: string[] = [];
  const filterParams: unknown[] = [];

  if (normalizedIds !== null && idColumn) {
    filterPredicates.push(`${quoteIdentifier(idColumn)}::text = any($1::text[])`);
    filterParams.push(normalizedIds);
  }

  const searchFilterClause = buildMappedContentEntitySearchFilterClause({
    paramIndex: filterParams.length + 1,
    search: normalizedSearch,
    searchColumns,
  });

  if (searchFilterClause) {
    filterPredicates.push(searchFilterClause.replace(/^where\s+/i, ""));
    filterParams.push(normalizedSearch);
  }

  const filterClause = filterPredicates.length
    ? `where ${filterPredicates.map((predicate) => `(${predicate})`).join(" and ")}`
    : "";
  const selectClause = selectColumns.length
    ? selectColumns.map((column) => quoteIdentifier(column)).join(", ")
    : "*";
  const rowsResult = await client.query<Record<string, unknown>>(
    buildContentEntityPageRowsQuery({
      filterClause,
      filterParamCount: filterParams.length,
      orderClause: buildMappedContentEntityPageOrderClause(resolvedEntity, selectColumns),
      selectClause,
      tableName: getEntityTableName(resolvedEntity),
    }),
    [...filterParams, normalizeMappedContentSearchLimit(limit), 0],
  );

  return {
    entity: resolvedEntity,
    rows: rowsResult.rows,
  };
};

const normalizeMappedContentSelectedIds = (selectedIds?: string[] | null) =>
  [...new Set((selectedIds ?? []).map((value) => value.trim()).filter(Boolean))].slice(0, 250);

const mergeMappedContentSelectedItems = <TItem extends { id: string }>({
  searchItems,
  selectedItems,
}: {
  searchItems: TItem[];
  selectedItems: TItem[];
}) => {
  const seenIds = new Set<string>();
  const mergedItems: TItem[] = [];

  for (const item of [...selectedItems, ...searchItems]) {
    if (!item.id || seenIds.has(item.id)) {
      continue;
    }

    seenIds.add(item.id);
    mergedItems.push(item);
  }

  return mergedItems;
};

const createMappedContentCollectionWindowPagination = ({
  hasNextPage,
  page,
  pageSize,
  totalItemsHint,
  visibleItemsCount,
}: {
  hasNextPage: boolean;
  page: number;
  pageSize: number;
  totalItemsHint: number;
  visibleItemsCount: number;
}): ContentPagination & { offset: number } => {
  const exactTotalItems = (page - 1) * pageSize + visibleItemsCount;

  if (!hasNextPage) {
    return {
      hasNextPage: false,
      hasPreviousPage: page > 1,
      offset: (page - 1) * pageSize,
      page,
      pageSize,
      totalItems: exactTotalItems,
      totalItemsExact: true,
      totalPages: Math.max(1, page),
    };
  }

  const totalItems = Math.max(totalItemsHint, exactTotalItems + 1);

  return {
    hasNextPage: true,
    hasPreviousPage: page > 1,
    offset: (page - 1) * pageSize,
    page,
    pageSize,
    totalItems,
    totalItemsExact: false,
    totalPages: Math.max(page + 1, Math.ceil(totalItems / pageSize), 1),
  };
};

export const loadPagedEntityRows = async ({
  client,
  columns = null,
  entity,
  ids = null,
  page,
  pageSize,
  posts = null,
  relation,
  useWindowPagination = false,
}: {
  client: ContentDatabaseClient;
  columns?: string[] | null;
  entity: ContentEntityMapping;
  ids?: string[] | null;
  page?: number;
  pageSize?: number;
  posts?: ContentEntityMapping | null;
  relation?: ContentRelationMapping;
  useWindowPagination?: boolean;
}) => {
  const resolvedEntity = await resolveMappedContentCollectionEntity({
    client,
    entity,
    posts,
    relation,
  });

  if (!isUsableEntitySource(resolvedEntity)) {
    return {
      entity: resolvedEntity,
      pagination: resolvePagination({
        page,
        pageSize,
        totalItems: 0,
      }),
      rows: [] as Record<string, unknown>[],
    };
  }

  const normalizedIds = ids === null ? null : [...new Set(ids.map((value) => value.trim()).filter(Boolean))];
  const idColumn = getEntityIdColumn(resolvedEntity);

  if (normalizedIds !== null && (!normalizedIds.length || !idColumn)) {
    return {
      entity: resolvedEntity,
      pagination: resolvePagination({
        page,
        pageSize,
        totalItems: 0,
      }),
      rows: [] as Record<string, unknown>[],
    };
  }

  const selectColumns =
    columns && columns.length
      ? await getEntitySelectableColumns({
          client,
          entity: resolvedEntity,
          requestedColumns: columns,
        })
      : [];
  const selectClause = selectColumns.length
    ? selectColumns.map((column) => quoteIdentifier(column)).join(", ")
    : "*";
  const filterClause =
    normalizedIds !== null && idColumn
      ? buildContentEntityIdFilterClause({ idColumn })
      : "";
  const filterParams = normalizedIds !== null ? [normalizedIds] : [];
  const pagination = useWindowPagination
    ? resolvePagination({
        page,
        pageSize,
        totalItems: Math.max(1, (page ?? 1) * (pageSize ?? 20) + 1),
      })
    : resolvePagination({
        page,
        pageSize,
        totalItems: Number(
          (
            await client.query<{ count: string }>(
              buildContentEntityCountQuery({
                filterClause,
                tableName: getEntityTableName(resolvedEntity),
              }),
              filterParams,
            )
          ).rows[0]?.count ?? 0,
        ),
      });
  const rowsResult = await client.query<Record<string, unknown>>(
    buildContentEntityPageRowsQuery({
      filterClause,
      filterParamCount: filterParams.length,
      orderClause: buildMappedContentEntityPageOrderClause(resolvedEntity, selectColumns),
      selectClause,
      tableName: getEntityTableName(resolvedEntity),
    }),
    [
      ...filterParams,
      pagination.pageSize + (useWindowPagination ? 1 : 0),
      pagination.offset,
    ],
  );
  const visibleRows = useWindowPagination
    ? rowsResult.rows.slice(0, pagination.pageSize)
    : rowsResult.rows;

  return {
    entity: resolvedEntity,
    pagination: useWindowPagination
      ? createMappedContentCollectionWindowPagination({
          hasNextPage: rowsResult.rows.length > pagination.pageSize,
          page: pagination.page,
          pageSize: pagination.pageSize,
          totalItemsHint: pagination.totalItems,
          visibleItemsCount: visibleRows.length,
        })
      : pagination,
    rows: visibleRows,
  };
};

export const loadMappedContentAuthors = async ({
  accessibleAuthorIds = null,
  authorAssignmentsByAuthorId,
  client,
  entity,
  ids = null,
  posts = null,
  relation,
}: {
  accessibleAuthorIds?: string[] | null;
  authorAssignmentsByAuthorId?: Map<string, { avatar_url: string | null }> | null;
  client: ContentDatabaseClient;
  entity: ContentEntityMapping;
  ids?: string[] | null;
  posts?: ContentEntityMapping | null;
  relation?: ContentRelationMapping;
}) => {
  const { entity: resolvedEntity, rows } = await loadEntityRows({
    client,
    columns: getRequestedEntityReadColumns(entity, ["name", "bio", "email", "slug"]),
    entity,
    ids,
    posts,
    relation,
  });
  const authors = mapMappedContentAuthorRows({
    authorAssignmentsByAuthorId,
    entity: resolvedEntity,
    rows,
  });

  if (accessibleAuthorIds === null) {
    return authors;
  }

  return authors.filter((author) => accessibleAuthorIds.includes(author.id));
};

const buildCategoryHierarchy = (categories: ContentCategory[]) => {
  const byId = new Map(categories.map((category) => [category.id, category]));

  const visit = (category: ContentCategory, seen: Set<string>): { depth: number; hierarchyPath: string } => {
    if (!category.parentCategoryId || seen.has(category.id)) {
      return {
        depth: 0,
        hierarchyPath: category.name,
      };
    }

    const parent = byId.get(category.parentCategoryId);

    if (!parent) {
      return {
        depth: 0,
        hierarchyPath: category.name,
      };
    }

    const nextSeen = new Set(seen);
    nextSeen.add(category.id);
    const parentMeta = visit(parent, nextSeen);

    return {
      depth: parentMeta.depth + 1,
      hierarchyPath: `${parentMeta.hierarchyPath} / ${category.name}`,
    };
  };

  return categories.map((category) => ({
    ...category,
    ...visit(category, new Set()),
  }));
};

const hydrateVisibleCategoryHierarchy = async ({
  categories,
  client,
  entity,
}: {
  categories: ContentCategory[];
  client: ContentDatabaseClient;
  entity: ContentEntityMapping;
}) => {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  let pendingParentIds = [
    ...new Set(
      categories
        .map((category) => category.parentCategoryId)
        .filter((categoryId): categoryId is string => Boolean(categoryId && !categoriesById.has(categoryId))),
    ),
  ];
  let depth = 0;

  while (pendingParentIds.length && depth < 10) {
    const { rows } = await loadEntityRows({
      client,
      columns: getRequestedEntityReadColumns(entity, ["name", "description", "parentId", "slug"]),
      entity,
      ids: pendingParentIds,
    });
    const parentCategories = mapMappedContentCategoryRows({
      entity,
      rows,
    });

    for (const parentCategory of parentCategories) {
      categoriesById.set(parentCategory.id, parentCategory);
    }

    pendingParentIds = [
      ...new Set(
        parentCategories
          .map((category) => category.parentCategoryId)
          .filter((categoryId): categoryId is string => Boolean(categoryId && !categoriesById.has(categoryId))),
      ),
    ];
    depth += 1;
  }

  const hydratedById = new Map(
    buildCategoryHierarchy([...categoriesById.values()]).map((category) => [category.id, category]),
  );

  return categories.map((category) => hydratedById.get(category.id) ?? category);
};

const hydrateVisibleCategoryChildExists = async ({
  categories,
  client,
  entity,
}: {
  categories: ContentCategory[];
  client: ContentDatabaseClient;
  entity: ContentEntityMapping;
}) => {
  const parentColumn = getMappedFieldColumn(entity, "parentId");
  const idColumn = getEntityIdColumn(entity);
  const visibleIds = [...new Set(categories.map((category) => category.id).filter(Boolean))];

  if (!categories.length || !parentColumn || !idColumn || !visibleIds.length) {
    return categories.map((category) => ({ ...category, hasChildren: false }));
  }

  const result = await client.query<{ parent_id: string | null }>(
    buildContentCategoryChildExistsQuery({
      idColumn,
      limitParamIndex: 2,
      parentColumn,
      tableName: getEntityTableName(entity),
    }),
    [visibleIds, visibleIds.length],
  );
  const parentIdsWithChildren = new Set(
    result.rows
      .map((row) => toText(row.parent_id))
      .filter((parentId): parentId is string => Boolean(parentId)),
  );

  return categories.map((category) => ({
    ...category,
    hasChildren: parentIdsWithChildren.has(category.id),
  }));
};

export const loadMappedContentCategories = async ({
  client,
  entity,
  ids = null,
  posts = null,
  relation,
}: {
  client: ContentDatabaseClient;
  entity: ContentEntityMapping;
  ids?: string[] | null;
  posts?: ContentEntityMapping | null;
  relation?: ContentRelationMapping;
}) => {
  const { entity: resolvedEntity, rows } = await loadEntityRows({
    client,
    columns: getRequestedEntityReadColumns(entity, ["name", "description", "parentId", "slug"]),
    entity,
    ids,
    posts,
    relation,
  });
  return mapMappedContentCategoryRows({
    entity: resolvedEntity,
    rows,
  });
};

export const loadMappedContentTags = async ({
  client,
  entity,
  ids = null,
  posts = null,
  relation,
}: {
  client: ContentDatabaseClient;
  entity: ContentEntityMapping;
  ids?: string[] | null;
  posts?: ContentEntityMapping | null;
  relation?: ContentRelationMapping;
}) => {
  const { entity: resolvedEntity, rows } = await loadEntityRows({
    client,
    columns: getRequestedEntityReadColumns(entity, ["name", "description", "slug"]),
    entity,
    ids,
    posts,
    relation,
  });
  return mapMappedContentTagRows({
    entity: resolvedEntity,
    rows,
  });
};

export const getMappedContentCollectionContext = async ({
  client,
  collection,
  mapping,
}: {
  client: ContentDatabaseClient;
  collection: MappedContentCollectionEntryTable;
  mapping: ContentProjectMapping;
}) => {
  const runtime = getMappedContentRuntime(mapping);
  const entity =
    collection === "authors"
      ? runtime.authors
      : collection === "categories"
        ? runtime.categories
        : runtime.tags;
  const relation =
    collection === "authors"
      ? runtime.posts.relations.authors
      : collection === "categories"
        ? runtime.posts.relations.categories
        : runtime.posts.relations.tags;
  const resolvedEntity = await resolveMappedContentCollectionEntity({
    client,
    entity,
    posts: runtime.posts,
    relation,
  });
  const idColumn = getEntityIdColumn(resolvedEntity) || resolvedEntity.source.primaryKey;

  if (!isUsableEntitySource(resolvedEntity) || !idColumn) {
    throw new Error(`Mapped ${collection} table is incomplete.`);
  }

  if (resolvedEntity.source.kind !== "table") {
    throw new Error(`Mapped ${collection} source must be a table to allow edits.`);
  }

  return {
    entity: resolvedEntity,
    idColumn,
    relation,
    runtime,
    tableName: getEntityTableName(resolvedEntity),
  };
};

export const loadMappedContentCollectionEntryById = async ({
  client,
  collection,
  id,
  mapping,
}: {
  client: ContentDatabaseClient;
  collection: MappedContentCollectionEntryTable;
  id: string;
  mapping: ContentProjectMapping;
}) => {
  const context = await getMappedContentCollectionContext({
    client,
    collection,
    mapping,
  });

  if (collection === "authors") {
    const authors = await loadMappedContentAuthors({
      client,
      entity: context.entity,
      ids: [id],
      posts: context.runtime.posts,
      relation: context.relation,
    });
    return authors.find((author) => author.id === id) ?? null;
  }

  if (collection === "categories") {
    const categories = await loadMappedContentCategories({
      client,
      entity: context.entity,
      ids: [id],
      posts: context.runtime.posts,
      relation: context.relation,
    });
    return categories.find((category) => category.id === id) ?? null;
  }

  const tags = await loadMappedContentTags({
    client,
    entity: context.entity,
    ids: [id],
    posts: context.runtime.posts,
    relation: context.relation,
  });
  return tags.find((tag) => tag.id === id) ?? null;
};

export const getMappedContentCategoriesPage = async ({
  client,
  includeAllCategories = true,
  mapping,
  page,
  pageSize,
  projectId,
  search,
}: {
  client: ContentDatabaseClient;
  includeAllCategories?: boolean;
  mapping: ContentProjectMapping;
  page?: number;
  pageSize?: number;
  projectId?: string;
  search?: string;
}) => {
  const runtime = getMappedContentRuntime(mapping);
  const normalizedSearch = normalizeMappedContentCollectionSearch(search);

  if (normalizedSearch) {
    const { entity, rows } = await loadSearchedEntityRows({
      client,
      columns: getRequestedEntityReadColumns(runtime.categories, [
        "name",
        "description",
        "parentId",
        "slug",
      ]),
      entity: runtime.categories,
      limit: pageSize,
      posts: runtime.posts,
      relation: runtime.posts.relations.categories,
      search: normalizedSearch,
      searchFieldKeys: ["name", "slug", "description"],
    });
    const hierarchyItems = await hydrateVisibleCategoryHierarchy({
      categories: mapMappedContentCategoryRows({
        entity,
        rows,
      }),
      client,
      entity,
    });
    const items = await hydrateVisibleCategoryChildExists({
      categories: hierarchyItems,
      client,
      entity,
    });

    return {
      ...(includeAllCategories ? { allCategories: items } : {}),
      items,
      pagination: resolvePagination({
        page,
        pageSize,
        totalItems: items.length,
      }),
    };
  }

  const pageResult = await loadPagedEntityRows({
    client,
    columns: getRequestedEntityReadColumns(runtime.categories, [
      "name",
      "description",
      "parentId",
      "slug",
    ]),
    entity: runtime.categories,
    page,
    pageSize,
    posts: runtime.posts,
    relation: runtime.posts.relations.categories,
    useWindowPagination: true,
  });
  const pageCategories = mapMappedContentCategoryRows({
    entity: pageResult.entity,
    rows: pageResult.rows,
  });

  if (!includeAllCategories) {
    const pageItems = await hydrateVisibleCategoryChildExists({
      categories: await hydrateVisibleCategoryHierarchy({
        categories: pageCategories,
        client,
        entity: pageResult.entity,
      }),
      client,
      entity: pageResult.entity,
    });

    return {
      items: pageItems,
      pagination: pageResult.pagination,
    };
  }

  const loadAllCategories = () =>
    loadMappedContentCategories({
      client,
      entity: runtime.categories,
      posts: runtime.posts,
      relation: runtime.posts.relations.categories,
    });
  const allCategories =
    projectId
      ? await getCachedProjectRuntimeValue({
          cacheKey: getContentCategoriesHierarchyCacheKey({
            mapping,
            projectId,
          }),
          groups: [projectRuntimeCacheGroups.taxonomyOptions],
          load: loadAllCategories,
          projectId,
          staleWhileRevalidateMs:
            MAPPED_CONTENT_CATEGORY_HIERARCHY_CACHE_STALE_WHILE_REVALIDATE_MS,
          ttlMs: MAPPED_CONTENT_CATEGORY_HIERARCHY_CACHE_TTL_MS,
        })
      : await loadAllCategories();
  const allCategoriesById = new Map(allCategories.map((category) => [category.id, category]));
  const itemIds = pageResult.rows
    .map((row) => toText(getRowValue(row, getEntityIdColumn(pageResult.entity))) ?? "")
    .filter(Boolean);
  const pageItems = await hydrateVisibleCategoryChildExists({
    categories: itemIds
      .map((categoryId) => allCategoriesById.get(categoryId))
      .filter((category): category is ContentCategory => Boolean(category)),
    client,
    entity: pageResult.entity,
  });

  return {
    ...(includeAllCategories ? { allCategories } : {}),
    items: pageItems,
    pagination: pageResult.pagination,
  };
};

export const getMappedContentTagsPage = async ({
  client,
  mapping,
  page,
  pageSize,
  search,
}: {
  client: ContentDatabaseClient;
  mapping: ContentProjectMapping;
  page?: number;
  pageSize?: number;
  search?: string;
}) => {
  const runtime = getMappedContentRuntime(mapping);

  if (normalizeMappedContentCollectionSearch(search)) {
    const { entity, rows } = await loadSearchedEntityRows({
      client,
      columns: getRequestedEntityReadColumns(runtime.tags, ["name", "description", "slug"]),
      entity: runtime.tags,
      limit: pageSize,
      posts: runtime.posts,
      relation: runtime.posts.relations.tags,
      search: search ?? "",
      searchFieldKeys: ["name", "slug", "description"],
    });
    const items = mapMappedContentTagRows({
      entity,
      rows,
    });

    return {
      items,
      pagination: resolvePagination({
        page,
        pageSize,
        totalItems: items.length,
      }),
    };
  }

  const { entity, pagination, rows } = await loadPagedEntityRows({
    client,
    columns: getRequestedEntityReadColumns(runtime.tags, ["name", "description", "slug"]),
    entity: runtime.tags,
    page,
    pageSize,
    posts: runtime.posts,
    relation: runtime.posts.relations.tags,
    useWindowPagination: true,
  });

  return {
    items: mapMappedContentTagRows({
      entity,
      rows,
    }),
    pagination,
  };
};

export const getMappedContentAuthorsPage = async ({
  authorAssignmentsByAuthorId,
  client,
  mapping,
  page,
  pageSize,
  search,
}: {
  authorAssignmentsByAuthorId?: Map<string, { avatar_url: string | null }> | null;
  client: ContentDatabaseClient;
  mapping: ContentProjectMapping;
  page?: number;
  pageSize?: number;
  search?: string;
}) => {
  const runtime = getMappedContentRuntime(mapping);

  if (normalizeMappedContentCollectionSearch(search)) {
    const { entity, rows } = await loadSearchedEntityRows({
      client,
      columns: getRequestedEntityReadColumns(runtime.authors, ["name", "bio", "email", "slug"]),
      entity: runtime.authors,
      limit: pageSize,
      posts: runtime.posts,
      relation: runtime.posts.relations.authors,
      search: search ?? "",
      searchFieldKeys: ["name", "slug", "email"],
    });
    const items = mapMappedContentAuthorRows({
      authorAssignmentsByAuthorId: authorAssignmentsByAuthorId ?? null,
      entity,
      rows,
    });

    return {
      items,
      pagination: resolvePagination({
        page,
        pageSize,
        totalItems: items.length,
      }),
    };
  }

  const { entity, pagination, rows } = await loadPagedEntityRows({
    client,
    columns: getRequestedEntityReadColumns(runtime.authors, ["name", "bio", "email", "slug"]),
    entity: runtime.authors,
    page,
    pageSize,
    posts: runtime.posts,
    relation: runtime.posts.relations.authors,
    useWindowPagination: true,
  });

  return {
    items: mapMappedContentAuthorRows({
      authorAssignmentsByAuthorId: authorAssignmentsByAuthorId ?? null,
      entity,
      rows,
    }),
    pagination,
  };
};

export const getMappedContentAuthorOptions = async ({
  client,
  limit = 100,
  mapping,
}: {
  client: ContentDatabaseClient;
  limit?: number;
  mapping: ContentProjectMapping;
}): Promise<Array<Pick<ContentAuthor, "id" | "name" | "slug">>> => {
  const runtime = getMappedContentRuntime(mapping);
  const { entity, rows } = await loadPagedEntityRows({
    client,
    columns: getRequestedEntityReadColumns(runtime.authors, ["name", "slug"]),
    entity: runtime.authors,
    page: 1,
    pageSize: limit,
    posts: runtime.posts,
    relation: runtime.posts.relations.authors,
  });
  const idColumn = getEntityIdColumn(entity) || entity.source.primaryKey;
  const nameColumn = getMappedFieldColumn(entity, "name");
  const slugColumn = getMappedFieldColumn(entity, "slug");

  return rows
    .map((row) => ({
      id: toText(getRowValue(row, idColumn)) ?? "",
      name: toText(getRowValue(row, nameColumn)) ?? "Untitled",
      slug: toText(getRowValue(row, slugColumn)) ?? "",
    }))
    .filter((author) => author.id);
};

export const searchMappedContentAuthors = async ({
  accessibleAuthorIds = null,
  client,
  limit = 100,
  mapping,
  search,
  selectedIds,
}: {
  accessibleAuthorIds?: string[] | null;
  client: ContentDatabaseClient;
  limit?: number;
  mapping: ContentProjectMapping;
  search: string;
  selectedIds?: string[];
}): Promise<Array<Pick<ContentAuthor, "id" | "name" | "slug">>> => {
  const runtime = getMappedContentRuntime(mapping);
  const normalizedSelectedIds = normalizeMappedContentSelectedIds(selectedIds);
  const selectedSearchIds =
    accessibleAuthorIds === null
      ? normalizedSelectedIds
      : normalizedSelectedIds.filter((selectedId) => accessibleAuthorIds.includes(selectedId));
  const [{ entity, rows }, selectedResult] = await Promise.all([
    loadSearchedEntityRows({
      client,
      columns: getRequestedEntityReadColumns(runtime.authors, ["name", "bio", "email", "slug"]),
      entity: runtime.authors,
      ids: accessibleAuthorIds,
      limit,
      posts: runtime.posts,
      relation: runtime.posts.relations.authors,
      search,
      searchFieldKeys: ["name", "slug", "email"],
    }),
    selectedSearchIds.length
      ? loadSearchedEntityRows({
          client,
          columns: getRequestedEntityReadColumns(runtime.authors, ["name", "bio", "email", "slug"]),
          entity: runtime.authors,
          ids: selectedSearchIds,
          limit: selectedSearchIds.length,
          posts: runtime.posts,
          relation: runtime.posts.relations.authors,
          search: "",
          searchFieldKeys: ["name", "slug", "email"],
        })
      : Promise.resolve(null),
  ]);

  const mapAuthors = (sourceRows: Record<string, unknown>[], sourceEntity = entity) =>
    mapMappedContentAuthorRows({
      authorAssignmentsByAuthorId: null,
      entity: sourceEntity,
      rows: sourceRows,
    }).map((author) => ({
      id: author.id,
      name: author.name,
      slug: author.slug,
    }));

  return mergeMappedContentSelectedItems({
    searchItems: mapAuthors(rows),
    selectedItems: selectedResult ? mapAuthors(selectedResult.rows, selectedResult.entity) : [],
  });
};

export const searchMappedContentCategories = async ({
  client,
  limit = 100,
  mapping,
  search,
  selectedIds,
}: {
  client: ContentDatabaseClient;
  limit?: number;
  mapping: ContentProjectMapping;
  search: string;
  selectedIds?: string[];
}): Promise<Array<Pick<ContentCategory, "depth" | "hierarchyPath" | "id" | "name" | "slug">>> => {
  const runtime = getMappedContentRuntime(mapping);
  const normalizedSelectedIds = normalizeMappedContentSelectedIds(selectedIds);
  const [{ entity, rows }, selectedResult] = await Promise.all([
    loadSearchedEntityRows({
      client,
      columns: getRequestedEntityReadColumns(runtime.categories, ["name", "description", "parentId", "slug"]),
      entity: runtime.categories,
      limit,
      posts: runtime.posts,
      relation: runtime.posts.relations.categories,
      search,
      searchFieldKeys: ["name", "slug", "description"],
    }),
    normalizedSelectedIds.length
      ? loadSearchedEntityRows({
          client,
          columns: getRequestedEntityReadColumns(runtime.categories, ["name", "description", "parentId", "slug"]),
          entity: runtime.categories,
          ids: normalizedSelectedIds,
          limit: normalizedSelectedIds.length,
          posts: runtime.posts,
          relation: runtime.posts.relations.categories,
          search: "",
          searchFieldKeys: ["name", "slug", "description"],
        })
      : Promise.resolve(null),
  ]);
  const mapCategories = async (sourceRows: Record<string, unknown>[], sourceEntity = entity) => {
    const hierarchyCategories = await hydrateVisibleCategoryHierarchy({
      categories: mapMappedContentCategoryRows({
        entity: sourceEntity,
        rows: sourceRows,
      }),
      client,
      entity: sourceEntity,
    });
    const categories = await hydrateVisibleCategoryChildExists({
      categories: hierarchyCategories,
      client,
      entity: sourceEntity,
    });

    return categories.map((category) => ({
      depth: category.depth,
      hasChildren: category.hasChildren,
      hierarchyPath: category.hierarchyPath,
      id: category.id,
      name: category.name,
      slug: category.slug,
    }));
  };
  const [searchItems, selectedItems] = await Promise.all([
    mapCategories(rows),
    selectedResult ? mapCategories(selectedResult.rows, selectedResult.entity) : Promise.resolve([]),
  ]);

  return mergeMappedContentSelectedItems({
    searchItems,
    selectedItems,
  });
};

export const searchMappedContentTags = async ({
  client,
  limit = 100,
  mapping,
  search,
  selectedIds,
}: {
  client: ContentDatabaseClient;
  limit?: number;
  mapping: ContentProjectMapping;
  search: string;
  selectedIds?: string[];
}): Promise<Array<Pick<ContentTag, "id" | "name" | "slug">>> => {
  const runtime = getMappedContentRuntime(mapping);
  const normalizedSelectedIds = normalizeMappedContentSelectedIds(selectedIds);
  const [{ entity, rows }, selectedResult] = await Promise.all([
    loadSearchedEntityRows({
      client,
      columns: getRequestedEntityReadColumns(runtime.tags, ["name", "description", "slug"]),
      entity: runtime.tags,
      limit,
      posts: runtime.posts,
      relation: runtime.posts.relations.tags,
      search,
      searchFieldKeys: ["name", "slug", "description"],
    }),
    normalizedSelectedIds.length
      ? loadSearchedEntityRows({
          client,
          columns: getRequestedEntityReadColumns(runtime.tags, ["name", "description", "slug"]),
          entity: runtime.tags,
          ids: normalizedSelectedIds,
          limit: normalizedSelectedIds.length,
          posts: runtime.posts,
          relation: runtime.posts.relations.tags,
          search: "",
          searchFieldKeys: ["name", "slug", "description"],
        })
      : Promise.resolve(null),
  ]);
  const mapTags = (sourceRows: Record<string, unknown>[], sourceEntity = entity) =>
    mapMappedContentTagRows({
      entity: sourceEntity,
      rows: sourceRows,
    }).map((tag) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
    }));

  return mergeMappedContentSelectedItems({
    searchItems: mapTags(rows),
    selectedItems: selectedResult ? mapTags(selectedResult.rows, selectedResult.entity) : [],
  });
};

export const searchMappedContentMedia = async ({
  client,
  limit = 100,
  mapping,
  search,
  selectedIds,
}: {
  client: ContentDatabaseClient;
  limit?: number;
  mapping: ContentProjectMapping;
  search: string;
  selectedIds?: string[];
}): Promise<
  Array<{
    fileName: string;
    id: string;
    objectPath: string;
    url?: string;
  }>
> => {
  const runtime = getMappedContentRuntime(mapping);
  const normalizedSelectedIds = normalizeMappedContentSelectedIds(selectedIds);
  const [{ entity, rows }, selectedResult] = await Promise.all([
    loadSearchedEntityRows({
      client,
      columns: getRequestedEntityReadColumns(runtime.media, ["altText", "title", "objectPath", "url"]),
      entity: runtime.media,
      limit,
      search,
      searchFieldKeys: ["title", "objectPath", "altText"],
    }),
    normalizedSelectedIds.length
      ? loadSearchedEntityRows({
          client,
          columns: getRequestedEntityReadColumns(runtime.media, ["altText", "title", "objectPath", "url"]),
          entity: runtime.media,
          ids: normalizedSelectedIds,
          limit: normalizedSelectedIds.length,
          search: "",
          searchFieldKeys: ["title", "objectPath", "altText"],
        })
      : Promise.resolve(null),
  ]);
  const mapMediaItems = (sourceRows: Record<string, unknown>[], sourceEntity = entity) =>
    sourceRows
      .map((row) => ({
        altText: toText(getRowValue(row, getMappedFieldColumn(sourceEntity, "altText"))),
        fileName: toText(getRowValue(row, getMappedFieldColumn(sourceEntity, "title"))) ?? "",
        id: toText(getRowValue(row, getEntityIdColumn(sourceEntity))) ?? "",
        objectPath: toText(getRowValue(row, getMappedFieldColumn(sourceEntity, "objectPath"))) ?? "",
        url: toText(getRowValue(row, getMappedFieldColumn(sourceEntity, "url"))),
      }))
      .filter((mediaItem) => mediaItem.id);

  return mergeMappedContentSelectedItems({
    searchItems: mapMediaItems(rows),
    selectedItems: selectedResult ? mapMediaItems(selectedResult.rows, selectedResult.entity) : [],
  }).map((mediaItem) => ({
    fileName: mediaItem.fileName,
    id: mediaItem.id,
    objectPath: mediaItem.objectPath,
    ...(mediaItem.url ? { url: mediaItem.url } : {}),
  }));
};

export const searchMappedContentFiles = async ({
  client,
  limit = 100,
  mapping,
  search,
  selectedIds,
}: {
  client: ContentDatabaseClient;
  limit?: number;
  mapping: ContentProjectMapping;
  search: string;
  selectedIds?: string[];
}): Promise<
  Array<{
    fileName: string;
    id: string;
    objectPath: string;
    url?: string;
  }>
> => {
  const runtime = getMappedContentRuntime(mapping);
  const normalizedSelectedIds = normalizeMappedContentSelectedIds(selectedIds);
  const [{ entity, rows }, selectedResult] = await Promise.all([
    loadSearchedEntityRows({
      client,
      columns: getRequestedEntityReadColumns(runtime.files, ["title", "objectPath", "url"]),
      entity: runtime.files,
      limit,
      search,
      searchFieldKeys: ["title", "objectPath"],
    }),
    normalizedSelectedIds.length
      ? loadSearchedEntityRows({
          client,
          columns: getRequestedEntityReadColumns(runtime.files, ["title", "objectPath", "url"]),
          entity: runtime.files,
          ids: normalizedSelectedIds,
          limit: normalizedSelectedIds.length,
          search: "",
          searchFieldKeys: ["title", "objectPath"],
        })
      : Promise.resolve(null),
  ]);
  const mapFiles = (sourceRows: Record<string, unknown>[], sourceEntity = entity) =>
    mapMappedContentFileRows({
      entity: sourceEntity,
      rows: sourceRows,
    });

  return mergeMappedContentSelectedItems({
    searchItems: mapFiles(rows),
    selectedItems: selectedResult ? mapFiles(selectedResult.rows, selectedResult.entity) : [],
  }).map((fileItem) => ({
      fileName: fileItem.fileName,
      id: fileItem.id,
      objectPath: fileItem.objectPath,
      ...(fileItem.publicUrl ? { url: fileItem.publicUrl } : {}),
    }));
};

export const getMappedContentMediaPage = async ({
  client,
  mapping,
  page,
  pageSize,
}: {
  client: ContentDatabaseClient;
  mapping: ContentProjectMapping;
  page?: number;
  pageSize?: number;
}) => {
  const runtime = getMappedContentRuntime(mapping);
  const { entity, pagination, rows } = await loadPagedEntityRows({
    client,
    columns: getRequestedEntityReadColumns(runtime.media, ["altText", "title", "objectPath"]),
    entity: runtime.media,
    page,
    pageSize,
  });

  return {
    items: mapMappedContentMediaRows({
      entity,
      rows,
    }),
    pagination,
  };
};

export const createMappedContentCollectionEntry = async ({
  bio,
  client,
  collection,
  description,
  email,
  mapping,
  name,
  parentCategoryId,
  slug,
}: {
  bio?: string | null;
  client: ContentDatabaseClient;
  collection: MappedContentCollectionEntryTable;
  description?: string | null;
  email?: string | null;
  mapping: ContentProjectMapping;
  name: string;
  parentCategoryId?: string | null;
  slug?: string | null;
}): Promise<ContentAuthor | ContentCategory | ContentTag> => {
  const normalizedBio = bio?.trim() ? bio.trim() : null;
  const normalizedDescription = description?.trim() ? description.trim() : null;
  const normalizedEmail = email?.trim() ? email.trim() : null;
  const normalizedName = name.trim();
  const normalizedParentCategoryId = parentCategoryId?.trim() ? parentCategoryId.trim() : null;
  const normalizedSlug = slug?.trim() ? slug.trim() : null;

  if (!normalizedName) {
    throw new Error("Name is required.");
  }

  const context = await getMappedContentCollectionContext({
    client,
    collection,
    mapping,
  });
  const nameColumn = getMappedFieldColumn(context.entity, "name");
  const slugColumn = getMappedFieldColumn(context.entity, "slug");
  const generatedPrimaryKeyValue = await getRequiredPrimaryKeyInsertValue({
    client,
    entity: context.entity,
    primaryKeyColumn: context.idColumn,
  });

  if (!nameColumn) {
    throw new Error(`Mapped ${collection} table is missing a name column.`);
  }

  const slugValue =
    slugColumn
      ? await getUniqueSlugForMappedTable({
          base: normalizedSlug ?? normalizedName,
          client,
          entity: context.entity,
          idColumn: context.idColumn,
          slugColumn,
          tableName: context.tableName,
        })
      : null;

  if (collection === "categories" && normalizedParentCategoryId) {
    const parentColumn = getMappedFieldColumn(context.entity, "parentId");

    if (!parentColumn) {
      throw new Error("Mapped categories table is missing a parent category column.");
    }

    const parentResult = await client.query<{ id: string }>(
      buildContentEntityByIdQuery({
        idColumn: context.idColumn,
        tableName: context.tableName,
      }),
      [normalizedParentCategoryId],
    );

    if (!parentResult.rows.length) {
      throw new Error("Select a valid parent category.");
    }
  }

  const insertColumns: string[] = [];
  const insertValues: unknown[] = [];
  const placeholders: string[] = [];
  const insertedColumns = new Set<string>();
  let parameterIndex = 1;
  const pushValue = (column: string | null | undefined, value: unknown) => {
    if (!column || insertedColumns.has(column)) {
      return;
    }

    insertColumns.push(quoteIdentifier(column));
    insertValues.push(value);
    placeholders.push(`$${parameterIndex}`);
    insertedColumns.add(column);
    parameterIndex += 1;
  };

  if (generatedPrimaryKeyValue !== undefined) {
    pushValue(context.idColumn, generatedPrimaryKeyValue);
  }

  pushValue(nameColumn, normalizedName);
  pushValue(slugColumn, slugValue);

  if (collection === "authors") {
    pushValue(getMappedFieldColumn(context.entity, "email"), normalizedEmail);
    pushValue(getMappedFieldColumn(context.entity, "bio"), normalizedBio);
  } else if (collection === "categories") {
    pushValue(getMappedFieldColumn(context.entity, "description"), normalizedDescription);
    pushValue(getMappedFieldColumn(context.entity, "parentId"), normalizedParentCategoryId);
  } else {
    pushValue(getMappedFieldColumn(context.entity, "description"), normalizedDescription);
  }

  const result = await client.query<{ id: string }>(
    buildContentInsertReturningIdQuery({
      idColumn: context.idColumn,
      insertColumns,
      placeholders,
      tableName: context.tableName,
    }),
    insertValues,
  );

  const createdEntryId = result.rows[0]?.id;

  if (!createdEntryId) {
    throw new Error(`Could not create that ${getCollectionEntryLabel(collection)} right now.`);
  }

  const entry = await loadMappedContentCollectionEntryById({
    client,
    collection,
    id: createdEntryId,
    mapping,
  });

  if (!entry) {
    throw new Error(`Could not load the created ${getCollectionEntryLabel(collection)}.`);
  }

  return entry;
};

export const updateMappedContentCollectionEntry = async ({
  bio,
  client,
  collection,
  description,
  email,
  entryId,
  mapping,
  name,
  parentCategoryId,
  slug,
}: {
  bio?: string | null;
  client: ContentDatabaseClient;
  collection: MappedContentCollectionEntryTable;
  description?: string | null;
  email?: string | null;
  entryId: string;
  mapping: ContentProjectMapping;
  name: string;
  parentCategoryId?: string | null;
  slug?: string | null;
}): Promise<ContentAuthor | ContentCategory | ContentTag> => {
  const normalizedBio = bio?.trim() ? bio.trim() : null;
  const normalizedDescription = description?.trim() ? description.trim() : null;
  const normalizedEmail = email?.trim() ? email.trim() : null;
  const normalizedEntryId = entryId.trim();
  const normalizedName = name.trim();
  const normalizedParentCategoryId = parentCategoryId?.trim() ? parentCategoryId.trim() : null;
  const normalizedSlug = slug?.trim() ? slug.trim() : null;

  if (!normalizedEntryId) {
    throw new Error("Select an entry first.");
  }

  if (!normalizedName) {
    throw new Error("Name is required.");
  }

  const context = await getMappedContentCollectionContext({
    client,
    collection,
    mapping,
  });
  const nameColumn = getMappedFieldColumn(context.entity, "name");
  const slugColumn = getMappedFieldColumn(context.entity, "slug");

  if (!nameColumn) {
    throw new Error(`Mapped ${collection} table is missing a name column.`);
  }

  const slugValue =
    slugColumn
      ? await getUniqueSlugForMappedTable({
          base: normalizedSlug ?? normalizedName,
          client,
          entity: context.entity,
          excludeId: normalizedEntryId,
          idColumn: context.idColumn,
          slugColumn,
          tableName: context.tableName,
        })
      : null;

  if (collection === "categories" && normalizedParentCategoryId === normalizedEntryId) {
    throw new Error("A category cannot be its own parent.");
  }

  if (collection === "categories" && normalizedParentCategoryId) {
    const parentColumn = getMappedFieldColumn(context.entity, "parentId");

    if (!parentColumn) {
      throw new Error("Mapped categories table is missing a parent category column.");
    }

    const parentResult = await client.query<{ id: string }>(
      buildContentEntityByIdQuery({
        idColumn: context.idColumn,
        tableName: context.tableName,
      }),
      [normalizedParentCategoryId],
    );

    if (!parentResult.rows.length) {
      throw new Error("Select a valid parent category.");
    }
  }

  const updates: string[] = [];
  const params: unknown[] = [normalizedEntryId];
  let parameterIndex = 2;
  const pushUpdate = (column: string | null | undefined, value: unknown) => {
    if (!column) {
      return;
    }

    updates.push(`${quoteIdentifier(column)} = $${parameterIndex}`);
    params.push(value);
    parameterIndex += 1;
  };

  pushUpdate(nameColumn, normalizedName);
  pushUpdate(slugColumn, slugValue);

  if (collection === "authors") {
    pushUpdate(getMappedFieldColumn(context.entity, "email"), normalizedEmail);
    pushUpdate(getMappedFieldColumn(context.entity, "bio"), normalizedBio);
  } else if (collection === "categories") {
    pushUpdate(getMappedFieldColumn(context.entity, "description"), normalizedDescription);
    pushUpdate(getMappedFieldColumn(context.entity, "parentId"), normalizedParentCategoryId);
  } else {
    pushUpdate(getMappedFieldColumn(context.entity, "description"), normalizedDescription);
  }

  const result = await client.query<{ id: string }>(
    buildContentUpdateReturningIdQuery({
      idColumn: context.idColumn,
      tableName: context.tableName,
      updates,
    }),
    params,
  );

  if (!result.rows.length) {
    throw new Error("Could not find that entry in this project.");
  }

  const entry = await loadMappedContentCollectionEntryById({
    client,
    collection,
    id: normalizedEntryId,
    mapping,
  });

  if (!entry) {
    throw new Error("Could not load that entry right now.");
  }

  return entry;
};

export const deleteMappedContentCollectionEntries = async ({
  client,
  collection,
  entryIds,
  mapping,
}: {
  client: ContentDatabaseClient;
  collection: MappedContentCollectionEntryTable;
  entryIds: string[];
  mapping: ContentProjectMapping;
}) => {
  const normalizedEntryIds = [...new Set(entryIds.map((value) => value.trim()).filter(Boolean))];

  if (!normalizedEntryIds.length) {
    throw new Error("Select an entry first.");
  }

  const context = await getMappedContentCollectionContext({
    client,
    collection,
    mapping,
  });

  const result = await client.query(
    buildContentDeleteEntitiesByIdsQuery({
      idColumn: context.idColumn,
      tableName: context.tableName,
    }),
    [normalizedEntryIds],
  );

  if (!result.rowCount) {
    throw new Error("Could not find that entry in this project.");
  }
};
