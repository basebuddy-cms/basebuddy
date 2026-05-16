import "server-only";

import type { Client } from "pg";

import type { ContentProjectMapping } from "./mapping";
import type { ContentProjectContext } from "./server-project-context";
import {
  type ContentAuthor,
  type ContentCategoriesPage,
  type ContentCategory,
  type ContentCollectionPage,
  type ContentMedia,
  type ContentTag,
} from "./shared";
import {
  createEmptyContentPagination,
  type ContentPaginationInput,
} from "./server-support";

export type ContentDatabaseClient = Pick<Client, "query">;

export type ContentCollectionEntryTable = "authors" | "categories" | "tags";

export type AuthorAssignment = {
  avatar_url: string | null;
  cms_author_id: string;
  email: string | null;
  name: string | null;
  user_id: string | null;
};

export type CollectionDependencies = {
  ensureAuthorManagementPermission: (context: ContentProjectContext) => void;
  ensureCollectionWritePermission: (
    context: ContentProjectContext,
    collection: ContentCollectionEntryTable,
  ) => void;
  getProjectContext: (projectId: string) => Promise<ContentProjectContext | null>;
  getProjectPostAuthorAssignments: (projectId: string) => Promise<Map<string, AuthorAssignment>>;
  getReadyContentProjectMapping: ({
    context,
    projectId,
  }: {
    context: ContentProjectContext;
    projectId: string;
  }) => Promise<ContentProjectMapping | null>;
  withContentDatabaseClient: <T>(
    connectionString: string,
    handler: (client: ContentDatabaseClient) => Promise<T>,
  ) => Promise<T>;
};

export const createEmptyContentCollectionPage = <T>(
  input: ContentPaginationInput = {},
): ContentCollectionPage<T> => ({
  items: [],
  pagination: createEmptyContentPagination(input),
});

export const createEmptyContentCategoriesPage = (
  input: ContentPaginationInput = {},
): ContentCategoriesPage => ({
  allCategories: [],
  items: [],
  pagination: createEmptyContentPagination(input),
});

export const ensureContentPlaneConnection = (context: ContentProjectContext) => {
  if (!context.connectionString) {
    throw new Error("This project needs a content connection before you can continue.");
  }
};

export type {
  ContentAuthor,
  ContentCategoriesPage,
  ContentCategory,
  ContentCollectionPage,
  ContentMedia,
  ContentTag,
  ContentPaginationInput,
};
