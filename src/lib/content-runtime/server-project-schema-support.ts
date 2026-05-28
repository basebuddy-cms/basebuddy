import { isValidContentSlug } from "./shared";

export const quoteGeneratedContentIdentifier = (value: string) =>
  `"${value.replace(/"/g, "\"\"")}"`;

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

export const normalizeGeneratedContentTimestamp = (value: Date | string | null) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
};
