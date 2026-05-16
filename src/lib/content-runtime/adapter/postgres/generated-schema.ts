import type { Client } from "pg";

import { isValidContentSlug } from "../../shared";

type ContentDatabaseClient = Pick<Client, "query">;

const featuredImageColumnsEnsurePromises = new Map<string, Promise<void>>();

export const quoteGeneratedContentIdentifier = (value: string) => `"${value.replace(/"/g, "\"\"")}"`;

export const getGeneratedContentTables = (projectSlug: string) => {
  if (!isValidContentSlug(projectSlug)) {
    throw new Error("Invalid project slug for the project schema.");
  }

  return {
    authors: `public.${quoteGeneratedContentIdentifier(`${projectSlug}_authors`)}`,
    categories: `public.${quoteGeneratedContentIdentifier(`${projectSlug}_categories`)}`,
    media: `public.${quoteGeneratedContentIdentifier(`${projectSlug}_media`)}`,
    postCategories: `public.${quoteGeneratedContentIdentifier(`${projectSlug}_post_categories`)}`,
    postRevisions: `public.${quoteGeneratedContentIdentifier(`${projectSlug}_post_revisions`)}`,
    postTags: `public.${quoteGeneratedContentIdentifier(`${projectSlug}_post_tags`)}`,
    posts: `public.${quoteGeneratedContentIdentifier(`${projectSlug}_posts`)}`,
    tags: `public.${quoteGeneratedContentIdentifier(`${projectSlug}_tags`)}`,
  };
};

export const hasGeneratedContentTableColumn = async (
  client: ContentDatabaseClient,
  tableName: string,
  columnName: string,
) => {
  const result = await client.query<{ exists: boolean }>(
    `
      select exists(
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = $1
          and column_name = $2
      ) as exists
    `,
    [tableName, columnName],
  );

  return Boolean(result.rows[0]?.exists);
};

export const ensurePostgresGeneratedContentFeaturedImageColumns = async ({
  client,
  enableRevisions,
  projectSlug,
}: {
  client: ContentDatabaseClient;
  enableRevisions: boolean;
  projectSlug: string;
}) => {
  const cacheKey = `${projectSlug}:${enableRevisions ? "revisions" : "no-revisions"}`;
  const existingPromise = featuredImageColumnsEnsurePromises.get(cacheKey);

  if (existingPromise) {
    await existingPromise;
    return;
  }

  const nextPromise = (async () => {
    const tables = getGeneratedContentTables(projectSlug);
    const postsTableName = `${projectSlug}_posts`;
    const revisionsTableName = `${projectSlug}_post_revisions`;
    const postsHasLegacyColumn = await hasGeneratedContentTableColumn(client, postsTableName, "og_image_url");

    await client.query(`alter table ${tables.posts} add column if not exists featured_image_url text`);

    if (postsHasLegacyColumn) {
      await client.query(
        `
          update ${tables.posts}
          set featured_image_url = coalesce(featured_image_url, og_image_url)
          where featured_image_url is null
            and og_image_url is not null
        `,
      );
    }

    if (!enableRevisions) {
      return;
    }

    const revisionsHasLegacyColumn = await hasGeneratedContentTableColumn(
      client,
      revisionsTableName,
      "og_image_url",
    );

    await client.query(`alter table ${tables.postRevisions} add column if not exists featured_image_url text`);

    if (revisionsHasLegacyColumn) {
      await client.query(
        `
          update ${tables.postRevisions}
          set featured_image_url = coalesce(featured_image_url, og_image_url)
          where featured_image_url is null
            and og_image_url is not null
        `,
      );
    }
  })();

  featuredImageColumnsEnsurePromises.set(cacheKey, nextPromise);

  try {
    await nextPromise;
  } catch (error) {
    featuredImageColumnsEnsurePromises.delete(cacheKey);
    throw error;
  }
};
