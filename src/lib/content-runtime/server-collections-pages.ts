import "server-only";

import {
  createContentRuntimeAdapter,
  getRequiredContentRuntimeAdapterMethod,
} from "./adapter/factory";
import {
  type CollectionDependencies,
  type ContentAuthor,
  type ContentCategoriesPage,
  type ContentCollectionPage,
  type ContentMedia,
  type ContentPaginationInput,
  type ContentTag,
  createEmptyContentCategoriesPage,
  createEmptyContentCollectionPage,
  ensureContentDatabaseConnection,
} from "./server-collections-shared";

const createContentCollectionsAdapter = (
  mapping: import("./mapping").ContentProjectMapping,
) =>
  createContentRuntimeAdapter({
    hasFilesS3CompatibleCredentials: false,
    hasS3CompatibleCredentials: false,
    mapping,
  });

export const getContentCategoriesPage = async ({
  dependencies,
  includeAllCategories = false,
  page,
  pageSize,
  projectId,
  search,
}: ContentPaginationInput & {
  dependencies: CollectionDependencies;
  includeAllCategories?: boolean;
  projectId: string;
  search?: string;
}): Promise<ContentCategoriesPage> => {
  const context = await dependencies.getProjectContext(projectId);

  if (!context) {
    throw new Error("Could not load this project right now.");
  }

  const readyMapping = await dependencies.getReadyContentProjectMapping({
    context,
    projectId,
  });

  if (!readyMapping) {
    return createEmptyContentCategoriesPage({ page, pageSize });
  }

  ensureContentDatabaseConnection(context);

  return dependencies.withContentDatabaseClient(context.connectionString as string, async (client) => {
    const adapter = createContentCollectionsAdapter(readyMapping);
    const loadCategoriesPage = getRequiredContentRuntimeAdapterMethod(
      adapter,
      "loadCategoriesPage",
    );

    return loadCategoriesPage({
      client,
      includeAllCategories,
      page,
      pageSize,
      projectId,
      search,
    });
  });
};

export const getContentTagsPage = async ({
  dependencies,
  page,
  pageSize,
  projectId,
  search,
}: ContentPaginationInput & {
  dependencies: CollectionDependencies;
  projectId: string;
  search?: string;
}): Promise<ContentCollectionPage<ContentTag>> => {
  const context = await dependencies.getProjectContext(projectId);

  if (!context) {
    throw new Error("Could not load this project right now.");
  }

  const readyMapping = await dependencies.getReadyContentProjectMapping({
    context,
    projectId,
  });

  if (!readyMapping) {
    return createEmptyContentCollectionPage({ page, pageSize });
  }

  ensureContentDatabaseConnection(context);

  return dependencies.withContentDatabaseClient(context.connectionString as string, async (client) => {
    const adapter = createContentCollectionsAdapter(readyMapping);
    const loadTagsPage = getRequiredContentRuntimeAdapterMethod(adapter, "loadTagsPage");

    return loadTagsPage({
      client,
      page,
      pageSize,
      search,
    });
  });
};

export const getContentAuthorsPage = async ({
  dependencies,
  page,
  pageSize,
  projectId,
  search,
}: ContentPaginationInput & {
  dependencies: CollectionDependencies;
  projectId: string;
  search?: string;
}): Promise<ContentCollectionPage<ContentAuthor>> => {
  const context = await dependencies.getProjectContext(projectId);

  if (!context) {
    throw new Error("Could not load this project right now.");
  }

  const readyMapping = await dependencies.getReadyContentProjectMapping({
    context,
    projectId,
  });

  if (!readyMapping) {
    return createEmptyContentCollectionPage({ page, pageSize });
  }

  ensureContentDatabaseConnection(context);
  dependencies.ensureAuthorManagementPermission(context);
  const authorAssignmentsByAuthorId =
    await dependencies.getProjectPostAuthorAssignments(projectId);

  return dependencies.withContentDatabaseClient(context.connectionString as string, async (client) => {
    const adapter = createContentCollectionsAdapter(readyMapping);
    const loadAuthorsPage = getRequiredContentRuntimeAdapterMethod(adapter, "loadAuthorsPage");

    return loadAuthorsPage({
      authorAssignmentsByAuthorId,
      client,
      page,
      pageSize,
      search,
    });
  });
};

export const getContentAuthorOptions = async ({
  dependencies,
  limit = 100,
  projectId,
}: {
  dependencies: CollectionDependencies;
  limit?: number;
  projectId: string;
}): Promise<Array<Pick<ContentAuthor, "id" | "name" | "slug">>> => {
  const context = await dependencies.getProjectContext(projectId);

  if (!context) {
    throw new Error("Could not load this project right now.");
  }

  const readyMapping = await dependencies.getReadyContentProjectMapping({
    context,
    projectId,
  });

  if (!readyMapping) {
    return [];
  }

  ensureContentDatabaseConnection(context);

  return dependencies.withContentDatabaseClient(context.connectionString as string, async (client) => {
    const adapter = createContentCollectionsAdapter(readyMapping);
    const loadAuthorOptions = getRequiredContentRuntimeAdapterMethod(
      adapter,
      "loadAuthorOptions",
    );

    return loadAuthorOptions({
      client,
      limit,
    });
  });
};

export const getContentMediaPage = async ({
  dependencies,
  page,
  pageSize,
  projectId,
}: ContentPaginationInput & {
  dependencies: CollectionDependencies;
  projectId: string;
}): Promise<ContentCollectionPage<ContentMedia>> => {
  const context = await dependencies.getProjectContext(projectId);

  if (!context) {
    throw new Error("Could not load this project right now.");
  }

  const readyMapping = await dependencies.getReadyContentProjectMapping({
    context,
    projectId,
  });

  if (!readyMapping) {
    return createEmptyContentCollectionPage({ page, pageSize });
  }

  ensureContentDatabaseConnection(context);

  return dependencies.withContentDatabaseClient(context.connectionString as string, async (client) => {
    const adapter = createContentCollectionsAdapter(readyMapping);
    const loadMediaPage = getRequiredContentRuntimeAdapterMethod(adapter, "loadMediaPage");

    return loadMediaPage({
      client,
      page,
      pageSize,
    });
  });
};
