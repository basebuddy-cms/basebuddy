import {
  createDefaultContentMappingConfig,
  type ContentEntityMapping,
  type ContentMappedField,
  type ContentMappingConfig,
  type ContentMappingEntityKey,
  type ContentRelationMapping,
} from "./mapping";

import type {
  ContentAutoMappingCandidate,
  ContentIntrospectedTable,
  ContentSchemaIntrospection,
} from "./introspection";
import {
  ENTITY_KEYS,
  type ScoredEntityCandidate,
  applyDetectedRelation,
  buildPreview,
  detectTimestampSourceHint,
  detectContentColumns,
  detectWorkflow,
  findColumn,
  findJoinTableCandidate,
  getCreatedAtColumn,
  getExcerptColumn,
  getFeaturedImageColumn,
  getFocusKeywordColumn,
  getPostTitleColumn,
  getRedirectsColumn,
  getSeoDescriptionColumn,
  getSeoTitleColumn,
  getSlugColumn,
  getUpdatedAtColumn,
  scoreEntityTable,
  scorePostTable,
  setMappingFieldColumn,
  toLabel,
  toTableRef,
} from "./introspection-support-shared";

const createDirectEntityMapping = (
  entity: Exclude<ContentMappingEntityKey, "posts">,
  table: ContentIntrospectedTable,
  reasons: string[],
  score: number,
): ContentEntityMapping => {
  const mapping = createDefaultContentMappingConfig().entities[entity];
  const nameColumn = findColumn(table, [/^name$/, /name$/, /^title$/], {
    requireTextLike: true,
  });
  const slugColumn = getSlugColumn(table);
  const descriptionColumn = findColumn(table, [/^description$/, /^bio$/, /^summary$/, /^alt_text$/], {
    requireTextLike: true,
  });
  const emailColumn = entity === "authors" ? findColumn(table, [/email/], { requireTextLike: true }) : null;
  const parentColumn = entity === "categories" ? findColumn(table, [/parent/], { requireTextLike: true }) : null;
  const objectPathColumn =
    entity === "media" || entity === "files"
      ? findColumn(table, [/^object_path$/, /path$/, /file_path$/, /url$/, /file_name$/], {
          requireTextLike: true,
        })
      : null;

  mapping.capabilities = {
    browse: true,
    create: table.kind === "table",
    delete: table.kind === "table",
    read: true,
    update: table.kind === "table",
  };
  mapping.notes = reasons;
  mapping.source = {
    kind: table.kind,
    primaryKey: table.primaryKey,
    schema: table.schema,
    table: table.name,
  };
  mapping.status = score >= 55 ? "mapped" : "limited";
  setMappingFieldColumn(mapping, "id", table.primaryKey);
  setMappingFieldColumn(mapping, "name", nameColumn?.name ?? null);
  setMappingFieldColumn(mapping, "slug", slugColumn?.name ?? null);

  if (entity === "authors") {
    setMappingFieldColumn(mapping, "bio", descriptionColumn?.name ?? null);
    setMappingFieldColumn(mapping, "email", emailColumn?.name ?? null);
  }

  if (entity === "categories") {
    setMappingFieldColumn(mapping, "description", descriptionColumn?.name ?? null);
    setMappingFieldColumn(mapping, "parentId", parentColumn?.name ?? null);
  }

  if (entity === "tags") {
    setMappingFieldColumn(mapping, "description", descriptionColumn?.name ?? null);
  }

  if (entity === "media") {
    setMappingFieldColumn(mapping, "altText", descriptionColumn?.name ?? null);
    setMappingFieldColumn(mapping, "objectPath", objectPathColumn?.name ?? null);
    setMappingFieldColumn(mapping, "title", nameColumn?.name ?? null);
    setMappingFieldColumn(mapping, "url", objectPathColumn?.name ?? null);
  }

  if (entity === "files") {
    setMappingFieldColumn(mapping, "objectPath", objectPathColumn?.name ?? null);
    setMappingFieldColumn(mapping, "title", nameColumn?.name ?? null);
    setMappingFieldColumn(mapping, "url", objectPathColumn?.name ?? null);
  }

  return mapping;
};

const createPostMapping = (
  table: ContentIntrospectedTable,
  reasons: string[],
  score: number,
): ContentEntityMapping => {
  const mapping = createDefaultContentMappingConfig().entities.posts;
  const titleColumn = getPostTitleColumn(table);
  const slugColumn = getSlugColumn(table);
  const excerptColumn = getExcerptColumn(table);
  const redirectsColumn = getRedirectsColumn(table);
  const featuredImageColumn = getFeaturedImageColumn(table);
  const focusKeywordColumn = getFocusKeywordColumn(table);
  const createdAtColumn = getCreatedAtColumn(table);
  const seoDescriptionColumn = getSeoDescriptionColumn(table);
  const seoTitleColumn = getSeoTitleColumn(table);
  const updatedAtColumn = getUpdatedAtColumn(table);
  const workflow = detectWorkflow(table);
  const applyTimestampField = (fieldKey: "createdAt" | "publishedAt" | "updatedAt", columnName: string | null) => {
    mapping.fields[fieldKey].column = columnName;

    const timestampSourceHint = detectTimestampSourceHint(table, columnName);

    if (timestampSourceHint) {
      mapping.fields[fieldKey].timestampSourceHint = timestampSourceHint;
      return;
    }

    delete mapping.fields[fieldKey].timestampSourceHint;
  };

  mapping.capabilities = {
    browse: true,
    create: table.kind === "table",
    delete: table.kind === "table",
    read: true,
    update: table.kind === "table",
  };
  mapping.editorFields = detectContentColumns(table);
  mapping.fields.id.column = table.primaryKey;
  mapping.fields.title.column = titleColumn?.name ?? null;
  mapping.fields.slug.column = slugColumn?.name ?? null;
  mapping.fields.excerpt.column = excerptColumn?.name ?? null;
  mapping.fields.redirects.column = redirectsColumn?.name ?? null;
  mapping.fields.featuredImageUrl.column = featuredImageColumn?.name ?? null;
  mapping.fields.focusKeyword.column = focusKeywordColumn?.name ?? null;
  applyTimestampField("createdAt", createdAtColumn?.name ?? null);
  applyTimestampField("publishedAt", workflow.publishedAtColumn);
  mapping.fields.seoDescription.column = seoDescriptionColumn?.name ?? null;
  mapping.fields.seoTitle.column = seoTitleColumn?.name ?? null;
  mapping.fields.status.column = workflow.statusColumn ?? workflow.publishedFlagColumn;
  applyTimestampField("updatedAt", updatedAtColumn?.name ?? null);
  mapping.notes = reasons;
  mapping.source = {
    kind: table.kind,
    primaryKey: table.primaryKey,
    schema: table.schema,
    table: table.name,
  };
  mapping.status = score >= 60 ? "mapped" : "limited";
  mapping.workflow = workflow;

  return mapping;
};

const mapDirectCandidates = (
  schema: ContentSchemaIntrospection,
): Record<ContentMappingEntityKey, ScoredEntityCandidate[]> => {
  const result = {
    authors: [],
    categories: [],
    files: [],
    media: [],
    posts: [],
    tags: [],
  } satisfies Record<ContentMappingEntityKey, ScoredEntityCandidate[]>;

  for (const table of schema.tables) {
    const postScore = scorePostTable(table);

    if (postScore.score >= 35) {
      const mapping = createPostMapping(table, postScore.reasons, postScore.score);
      result.posts.push({
        confidence: Number(Math.min(0.99, postScore.score / 100).toFixed(2)),
        entity: "posts",
        label: toTableRef(table),
        mapping,
        reasons: postScore.reasons,
        samplePreview: buildPreview(table, [
          mapping.fields.id.column,
          mapping.fields.title.column,
          mapping.fields.slug.column,
          ...mapping.editorFields.map((field) => field.column),
        ]),
        score: postScore.score,
        tableRef: toTableRef(table),
      });
    }

    for (const entity of ENTITY_KEYS.filter((key) => key !== "posts")) {
      const entityScore = scoreEntityTable(table, entity);

      if (entityScore.score < 28) {
        continue;
      }

      const mapping = createDirectEntityMapping(entity, table, entityScore.reasons, entityScore.score);
      result[entity].push({
        confidence: Number(Math.min(0.99, entityScore.score / 100).toFixed(2)),
        entity,
        label: toTableRef(table),
        mapping,
        reasons: entityScore.reasons,
        samplePreview: buildPreview(
          table,
          Object.values(mapping.fields).map((field) => field.column),
        ),
        score: entityScore.score,
        tableRef: toTableRef(table),
      });
    }
  }

  for (const entity of ENTITY_KEYS) {
    result[entity].sort((left, right) => right.score - left.score || left.label.localeCompare(right.label));
    result[entity] = result[entity].slice(0, 4);
  }

  return result;
};

const createDerivedCandidate = ({
  entity,
  label,
  mapping,
  reasons,
  table,
}: {
  entity: Exclude<ContentMappingEntityKey, "posts">;
  label: string;
  mapping: ContentEntityMapping;
  reasons: string[];
  table: ContentIntrospectedTable;
}): ScoredEntityCandidate => ({
  confidence: 0.42,
  entity,
  label,
  mapping,
  reasons,
  samplePreview: buildPreview(
    table,
    Object.values(mapping.fields).map((field) => field.column),
  ),
  score: 42,
  tableRef: toTableRef(table),
});

const createDerivedValueEntityCandidate = ({
  entity,
  reason,
  sourceColumn,
  table,
}: {
  entity: "authors" | "categories" | "media" | "tags";
  reason: string;
  sourceColumn: string;
  table: ContentIntrospectedTable;
}) => {
  const mapping = createDefaultContentMappingConfig().entities[entity];
  mapping.capabilities = {
    browse: true,
    create: false,
    delete: false,
    read: true,
    update: false,
  };
  mapping.notes = [reason];
  mapping.source = {
    kind: "derived",
    primaryKey: null,
    schema: table.schema,
    table: table.name,
  };
  mapping.status = "limited";
  mapping.fields.id.column = null;

  if ("name" in mapping.fields) {
    (mapping.fields.name as ContentMappedField).column = sourceColumn;
  }

  if ("slug" in mapping.fields) {
    (mapping.fields.slug as ContentMappedField).column = null;
  }

  return createDerivedCandidate({
    entity,
    label: `${toTableRef(table)} (${sourceColumn})`,
    mapping,
    reasons: [reason],
    table,
  });
};

const applyPostRelationDetections = (
  schema: ContentSchemaIntrospection,
  candidates: Record<ContentMappingEntityKey, ScoredEntityCandidate[]>,
) => {
  const topAuthorsCandidate = candidates.authors[0] ?? null;
  const topCategoriesCandidate = candidates.categories[0] ?? null;
  const topTagsCandidate = candidates.tags[0] ?? null;
  const topMediaCandidate = candidates.media[0] ?? null;

  for (const candidate of candidates.posts) {
    const sourceSchema = candidate.mapping.source.schema;
    const sourceTableName = candidate.mapping.source.table;
    const sourceTable = schema.tables.find(
      (table) => table.schema === sourceSchema && table.name === sourceTableName,
    );

    if (!sourceTable) {
      continue;
    }

    const authorRelation = candidate.mapping.relations.authors;
    const categoryRelation = candidate.mapping.relations.categories;
    const tagRelation = candidate.mapping.relations.tags;
    const mediaRelation = candidate.mapping.relations.media;

    if (authorRelation) {
      const authorNameColumn = findColumn(sourceTable, [/^author_name$/, /^author$/, /^writer_name$/], {
        requireTextLike: true,
      });
      const authorEmailColumn = findColumn(sourceTable, [/^author_email$/, /^writer_email$/], {
        requireTextLike: true,
      });

      if (topAuthorsCandidate?.mapping.source.table && topAuthorsCandidate.mapping.source.schema) {
        const authorTargetRef = `${topAuthorsCandidate.mapping.source.schema}.${topAuthorsCandidate.mapping.source.table}`;
        const authorForeignKey = sourceTable.foreignKeys.find(
          (foreignKey) => `${foreignKey.targetSchema}.${foreignKey.targetTable}` === authorTargetRef,
        );

        if (authorForeignKey) {
          applyDetectedRelation(authorRelation, {
            sourceColumn: authorForeignKey.column,
            status: "mapped",
            strategy: "foreign_key",
            targetColumn: authorForeignKey.targetColumn,
            targetTable: topAuthorsCandidate.mapping.source.table,
          });
        } else if (authorNameColumn || authorEmailColumn) {
          applyDetectedRelation(authorRelation, {
            fieldMap: {
              ...(authorNameColumn ? { name: authorNameColumn.name } : {}),
              ...(authorEmailColumn ? { email: authorEmailColumn.name } : {}),
            },
            status: "limited",
            strategy: "inline_fields",
            targetTable: topAuthorsCandidate.mapping.source.table,
          });
        }
      } else if (authorNameColumn || authorEmailColumn) {
        applyDetectedRelation(authorRelation, {
          fieldMap: {
            ...(authorNameColumn ? { name: authorNameColumn.name } : {}),
            ...(authorEmailColumn ? { email: authorEmailColumn.name } : {}),
          },
          status: "limited",
          strategy: "inline_fields",
        });

        const mapping = createDefaultContentMappingConfig().entities.authors;
        mapping.capabilities = {
          browse: true,
          create: false,
          delete: false,
          read: true,
          update: false,
        };
        mapping.notes = [`Author values appear to be stored inline on ${toTableRef(sourceTable)}.`];
        mapping.source = {
          kind: "derived",
          primaryKey: null,
          schema: sourceTable.schema,
          table: sourceTable.name,
        };
        mapping.status = "limited";
        mapping.fields.id.column = null;
        mapping.fields.name.column = authorNameColumn?.name ?? null;
        mapping.fields.email.column = authorEmailColumn?.name ?? null;
        mapping.fields.slug.column = null;

        candidates.authors.push(
          createDerivedCandidate({
            entity: "authors",
            label: `${toTableRef(sourceTable)} (inline author fields)`,
            mapping,
            reasons: ["uses inline author fields on the detected posts source"],
            table: sourceTable,
          }),
        );
      }
    }

    const applyMultiValueRelation = (
      relation: ContentRelationMapping | undefined,
      entity: "categories" | "tags" | "media",
      directCandidate: ScoredEntityCandidate | null,
      patterns: RegExp[],
    ) => {
      if (!relation) {
        return;
      }

      const targetSource = directCandidate?.mapping.source;
      const targetTable =
        targetSource?.schema && targetSource.table
          ? schema.tables.find((table) => table.schema === targetSource.schema && table.name === targetSource.table)
          : null;

      if (targetTable) {
        const joinTable = findJoinTableCandidate(schema.tables, sourceTable, targetTable);

        if (joinTable) {
          const sourceForeignKey = joinTable.foreignKeys.find(
            (foreignKey) => foreignKey.targetSchema === sourceTable.schema && foreignKey.targetTable === sourceTable.name,
          );
          const targetForeignKey = joinTable.foreignKeys.find(
            (foreignKey) => foreignKey.targetSchema === targetTable.schema && foreignKey.targetTable === targetTable.name,
          );

          applyDetectedRelation(relation, {
            junctionSourceColumn: sourceForeignKey?.column ?? null,
            junctionTable: joinTable.name,
            junctionTargetColumn: targetForeignKey?.column ?? null,
            status: "mapped",
            strategy: "join_table",
            targetColumn: targetForeignKey?.targetColumn ?? targetTable.primaryKey,
            targetTable: targetTable.name,
          });
          return;
        }

        const directForeignKey = sourceTable.foreignKeys.find(
          (foreignKey) =>
            foreignKey.targetSchema === targetTable.schema && foreignKey.targetTable === targetTable.name,
        );

        if (directForeignKey) {
          applyDetectedRelation(relation, {
            sourceColumn: directForeignKey.column,
            status: "mapped",
            strategy: "foreign_key",
            targetColumn: directForeignKey.targetColumn,
            targetTable: targetTable.name,
          });
          return;
        }
      }

      const arrayColumn = findColumn(sourceTable, patterns, { requireArray: true });

      if (arrayColumn) {
        applyDetectedRelation(relation, {
          sourceColumn: arrayColumn.name,
          status: "limited",
          strategy: "array",
          targetTable: directCandidate?.mapping.source.table ?? null,
          valueColumn: arrayColumn.name,
        });

        if (!directCandidate) {
          candidates[entity].push(
            createDerivedValueEntityCandidate({
              entity,
              reason: `${toLabel(entity)} appear to be stored as array values on ${toTableRef(sourceTable)}.`,
              sourceColumn: arrayColumn.name,
              table: sourceTable,
            }),
          );
        }
        return;
      }

      const jsonColumn = findColumn(sourceTable, patterns, { requireJson: true });

      if (jsonColumn) {
        applyDetectedRelation(relation, {
          sourceColumn: jsonColumn.name,
          status: "limited",
          strategy: "json_array",
          targetTable: directCandidate?.mapping.source.table ?? null,
          valueColumn: jsonColumn.name,
        });

        if (!directCandidate) {
          candidates[entity].push(
            createDerivedValueEntityCandidate({
              entity,
              reason: `${toLabel(entity)} appear to be stored as JSON values on ${toTableRef(sourceTable)}.`,
              sourceColumn: jsonColumn.name,
              table: sourceTable,
            }),
          );
        }
        return;
      }

      const derivedColumn = findColumn(sourceTable, patterns, { requireTextLike: true });

      if (derivedColumn) {
        applyDetectedRelation(relation, {
          sourceColumn: derivedColumn.name,
          status: "limited",
          strategy: "derived_distinct",
          targetTable: directCandidate?.mapping.source.table ?? null,
          valueColumn: derivedColumn.name,
        });

        if (!directCandidate) {
          candidates[entity].push(
            createDerivedValueEntityCandidate({
              entity,
              reason: `${toLabel(entity)} appear to come from a derived value column on ${toTableRef(sourceTable)}.`,
              sourceColumn: derivedColumn.name,
              table: sourceTable,
            }),
          );
        }
      }
    };

    applyMultiValueRelation(categoryRelation, "categories", topCategoriesCandidate, [
      /^categories$/,
      /^category_ids$/,
      /^category_names$/,
      /^category$/,
    ]);
    applyMultiValueRelation(tagRelation, "tags", topTagsCandidate, [
      /^tags$/,
      /^tag_ids$/,
      /^tag_names$/,
      /^keywords$/,
    ]);
    applyMultiValueRelation(mediaRelation, "media", topMediaCandidate, [
      /^media$/,
      /^asset_ids$/,
      /^image_ids$/,
      /^attachment_ids$/,
      /^image_urls$/,
      /^assets$/,
    ]);
  }

  for (const entity of ENTITY_KEYS.filter((key) => key !== "posts")) {
    candidates[entity].sort((left, right) => right.score - left.score || left.label.localeCompare(right.label));
    candidates[entity] = candidates[entity].slice(0, 4);
  }
};

const toPublicCandidate = ({
  score: _score,
  tableRef: _tableRef,
  ...candidate
}: ScoredEntityCandidate): ContentAutoMappingCandidate => candidate;

export const buildContentIntrospectionCandidates = (
  schema: ContentSchemaIntrospection,
): {
  candidates: Record<ContentMappingEntityKey, ContentAutoMappingCandidate[]>;
  suggestedMappingConfig: ContentMappingConfig;
} => {
  const candidates = mapDirectCandidates(schema);
  applyPostRelationDetections(schema, candidates);

  const suggestedMappingConfig = createDefaultContentMappingConfig();

  for (const entity of ENTITY_KEYS) {
    if (candidates[entity][0]) {
      suggestedMappingConfig.entities[entity] = candidates[entity][0].mapping;
    }
  }

  return {
    candidates: Object.fromEntries(
      ENTITY_KEYS.map((entity) => [entity, candidates[entity].map(toPublicCandidate)]),
    ) as Record<ContentMappingEntityKey, ContentAutoMappingCandidate[]>,
    suggestedMappingConfig,
  };
};
