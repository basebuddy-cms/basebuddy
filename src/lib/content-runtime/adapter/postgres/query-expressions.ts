import type { ContentEntityMapping } from "@/lib/content-runtime/mapping";
import type {
  ContentPostsSort,
  ContentPostsStatusFilter,
} from "@/lib/content-runtime/shared";

import { buildPostgresTrigramSearchPredicate } from "./query-builders";
import { quotePostgresIdentifier } from "./sql";

const getPostgresMappedFieldColumn = (entity: ContentEntityMapping, fieldKey: string) =>
  entity.fields[fieldKey]?.column?.trim() || null;

const getPostgresMappedFieldPath = (entity: ContentEntityMapping, fieldKey: string) =>
  entity.fields[fieldKey]?.path?.trim() || null;

const getPostgresMappedFieldArrayIndex = (
  entity: ContentEntityMapping,
  fieldKey: string,
) => {
  const arrayIndex = entity.fields[fieldKey]?.arrayIndex;
  return Number.isInteger(arrayIndex) && Number(arrayIndex) >= 0 ? Number(arrayIndex) : null;
};

const getPostgresMappedPublishedAtColumn = (posts: ContentEntityMapping) =>
  posts.workflow?.publishedAtColumn ||
  posts.fields.publishedAt?.column?.trim() ||
  null;

const getPostgresEntityIdColumn = (entity: ContentEntityMapping) =>
  entity.fields.id?.column?.trim() || entity.source.primaryKey?.trim() || null;

export const buildPostgresJsonPathArrayExpression = (path: string) => {
  const segments = path
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => `'${segment.replace(/'/g, "''")}'`);

  return `array[${segments.join(", ")}]`;
};

export const getPostgresMappedFieldComparableExpression = (
  entity: ContentEntityMapping,
  fieldKey: string,
) => {
  const column = getPostgresMappedFieldColumn(entity, fieldKey);

  if (!column) {
    return null;
  }

  const path = getPostgresMappedFieldPath(entity, fieldKey);

  if (path) {
    return `${quotePostgresIdentifier(column)}#>>${buildPostgresJsonPathArrayExpression(path)}`;
  }

  const arrayIndex = getPostgresMappedFieldArrayIndex(entity, fieldKey);

  if (arrayIndex !== null) {
    return `${quotePostgresIdentifier(column)}[${arrayIndex + 1}]`;
  }

  return quotePostgresIdentifier(column);
};

export const getPostgresMappedFieldTextExpression = (
  entity: ContentEntityMapping,
  fieldKey: string,
) => {
  const comparableExpression = getPostgresMappedFieldComparableExpression(entity, fieldKey);

  if (!comparableExpression) {
    return null;
  }

  return getPostgresMappedFieldPath(entity, fieldKey)
    ? comparableExpression
    : `${comparableExpression}::text`;
};

export const buildPostgresNextNumericPrimaryKeyValueQuery = ({
  primaryKeyColumn,
  tableName,
}: {
  primaryKeyColumn: string;
  tableName: string;
}) => `
        select coalesce(max(${quotePostgresIdentifier(primaryKeyColumn)})::bigint, 0) + 1 as next_value
        from ${tableName}
      `;

export const buildPostgresPostsWhereClause = ({
  posts,
  search,
  status,
}: {
  posts: ContentEntityMapping;
  search: string;
  status: ContentPostsStatusFilter;
}) => {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let parameterIndex = 1;
  const titleExpression = getPostgresMappedFieldTextExpression(posts, "title");
  const slugExpression = getPostgresMappedFieldTextExpression(posts, "slug");
  const excerptExpression = getPostgresMappedFieldTextExpression(posts, "excerpt");
  const workflow = posts.workflow;
  const publishedAtColumn = getPostgresMappedPublishedAtColumn(posts);

  if (status !== "all") {
    if (workflow?.statusColumn) {
      const values =
        status === "published"
          ? workflow.publishedValues
          : status === "archived"
            ? workflow.archivedValues
            : workflow.draftValues;

      if (values.length) {
        clauses.push(`${quotePostgresIdentifier(workflow.statusColumn)}::text = any($${parameterIndex}::text[])`);
        params.push(values);
        parameterIndex += 1;
      } else if (status === "archived") {
        clauses.push("1 = 0");
      }
    } else if (workflow?.publishedFlagColumn) {
      const publishedIsTrue = !(workflow.publishedValues ?? []).some((value) => value.toLowerCase() === "false");
      clauses.push(
        `${quotePostgresIdentifier(workflow.publishedFlagColumn)} is ${status === "published"
          ? publishedIsTrue
            ? "true"
            : "false"
          : status === "draft"
            ? publishedIsTrue
              ? "false"
              : "true"
            : "null"}`,
      );

      if (status === "archived") {
        clauses[clauses.length - 1] = "1 = 0";
      }
    } else if (publishedAtColumn) {
      clauses.push(`${quotePostgresIdentifier(publishedAtColumn)} is ${status === "published" ? "not null" : "null"}`);

      if (status === "archived") {
        clauses[clauses.length - 1] = "1 = 0";
      }
    }
  }

  if (search) {
    const searchColumns = [titleExpression, slugExpression, excerptExpression].filter(Boolean) as string[];

    if (searchColumns.length) {
      clauses.push(
        searchColumns
          .map((expression) =>
            buildPostgresTrigramSearchPredicate({
              expression: `coalesce(${expression}, '')`,
              paramIndex: parameterIndex,
            }),
          )
          .join(" or "),
      );
      params.push(search);
      parameterIndex += 1;
    }
  }

  return {
    clause: clauses.length ? `where ${clauses.map((clause) => `(${clause})`).join(" and ")}` : "",
    params,
  };
};

export const buildPostgresPostsOrderClause = (
  posts: ContentEntityMapping,
  sort: ContentPostsSort,
) => {
  const createdAtExpression = getPostgresMappedFieldComparableExpression(posts, "createdAt");
  const updatedAtExpression = getPostgresMappedFieldComparableExpression(posts, "updatedAt");
  const titleExpression = getPostgresMappedFieldTextExpression(posts, "title");
  const primaryKey = getPostgresEntityIdColumn(posts) || posts.source.primaryKey;

  switch (sort) {
    case "updated_asc":
      return updatedAtExpression
        ? `order by ${updatedAtExpression} asc`
        : createdAtExpression
          ? `order by ${createdAtExpression} asc`
          : primaryKey
            ? `order by ${quotePostgresIdentifier(primaryKey)} asc`
            : "";
    case "created_desc":
      return createdAtExpression ? `order by ${createdAtExpression} desc` : "";
    case "created_asc":
      return createdAtExpression ? `order by ${createdAtExpression} asc` : "";
    case "title_asc":
      return titleExpression ? `order by lower(${titleExpression}) asc` : "";
    case "title_desc":
      return titleExpression ? `order by lower(${titleExpression}) desc` : "";
    case "updated_desc":
    default:
      return updatedAtExpression
        ? `order by ${updatedAtExpression} desc`
        : createdAtExpression
          ? `order by ${createdAtExpression} desc`
          : primaryKey
            ? `order by ${quotePostgresIdentifier(primaryKey)} desc`
            : "";
  }
};
