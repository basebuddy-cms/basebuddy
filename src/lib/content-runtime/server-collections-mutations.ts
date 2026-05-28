import "server-only";

import {
  createContentRuntimeAdapter,
  getRequiredContentRuntimeAdapterMethod,
} from "./adapter/factory";
import {
  type CollectionDependencies,
  type ContentCollectionEntryTable,
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

export const createContentCollectionEntry = async ({
  bio,
  collection,
  dependencies,
  description,
  email,
  name,
  parentCategoryId,
  projectId,
  slug,
}: {
  bio?: string | null;
  collection: ContentCollectionEntryTable;
  dependencies: CollectionDependencies;
  description?: string | null;
  email?: string | null;
  name: string;
  parentCategoryId?: string | null;
  projectId: string;
  slug?: string | null;
}) => {
  const normalizedBio = bio?.trim() ? bio.trim() : null;
  const trimmedName = name.trim();
  const normalizedDescription = description?.trim() ? description.trim() : null;
  const normalizedEmail = email?.trim() ? email.trim() : null;
  const normalizedParentCategoryId = parentCategoryId?.trim()
    ? parentCategoryId.trim()
    : null;
  const normalizedSlug = slug?.trim() ? slug.trim() : null;

  if (!trimmedName) {
    throw new Error("Name is required.");
  }

  const context = await dependencies.getProjectContext(projectId);

  if (!context) {
    throw new Error("Could not load this project right now.");
  }

  dependencies.ensureCollectionWritePermission(context, collection);

  const readyMapping = await dependencies.getReadyContentProjectMapping({
    context,
    projectId,
  });

  if (!readyMapping) {
    throw new Error("Finish mapping before managing collections.");
  }

  ensureContentDatabaseConnection(context);

  return dependencies.withContentDatabaseClient(context.connectionString as string, async (client) => {
    const adapter = createContentCollectionsAdapter(readyMapping);
    const createCollectionEntry = getRequiredContentRuntimeAdapterMethod(
      adapter,
      "createCollectionEntry",
    );

    return createCollectionEntry({
      bio: normalizedBio,
      client,
      collection,
      description: normalizedDescription,
      email: normalizedEmail,
      name: trimmedName,
      parentCategoryId: normalizedParentCategoryId,
      slug: normalizedSlug,
    });
  });
};

export const updateContentCollectionEntry = async ({
  bio,
  collection,
  dependencies,
  description,
  email,
  entryId,
  name,
  parentCategoryId,
  projectId,
  slug,
}: {
  bio?: string | null;
  collection: ContentCollectionEntryTable;
  dependencies: CollectionDependencies;
  description?: string | null;
  email?: string | null;
  entryId: string;
  name: string;
  parentCategoryId?: string | null;
  projectId: string;
  slug?: string | null;
}) => {
  const normalizedEntryId = entryId.trim();
  const normalizedBio = bio?.trim() ? bio.trim() : null;
  const trimmedName = name.trim();
  const normalizedDescription = description?.trim() ? description.trim() : null;
  const normalizedEmail = email?.trim() ? email.trim() : null;
  const normalizedParentCategoryId = parentCategoryId?.trim()
    ? parentCategoryId.trim()
    : null;
  const normalizedSlug = slug?.trim() ? slug.trim() : null;

  if (!normalizedEntryId) {
    throw new Error("Select an entry first.");
  }

  if (!trimmedName) {
    throw new Error("Name is required.");
  }

  const context = await dependencies.getProjectContext(projectId);

  if (!context) {
    throw new Error("Could not load this project right now.");
  }

  dependencies.ensureCollectionWritePermission(context, collection);

  const readyMapping = await dependencies.getReadyContentProjectMapping({
    context,
    projectId,
  });

  if (!readyMapping) {
    throw new Error("Finish mapping before managing collections.");
  }

  ensureContentDatabaseConnection(context);

  return dependencies.withContentDatabaseClient(context.connectionString as string, async (client) => {
    const adapter = createContentCollectionsAdapter(readyMapping);
    const updateCollectionEntry = getRequiredContentRuntimeAdapterMethod(
      adapter,
      "updateCollectionEntry",
    );

    return updateCollectionEntry({
      bio: normalizedBio,
      client,
      collection,
      description: normalizedDescription,
      email: normalizedEmail,
      entryId: normalizedEntryId,
      name: trimmedName,
      parentCategoryId: normalizedParentCategoryId,
      slug: normalizedSlug,
    });
  });
};

export const deleteContentCollectionEntries = async ({
  collection,
  dependencies,
  entryIds,
  projectId,
}: {
  collection: ContentCollectionEntryTable;
  dependencies: CollectionDependencies;
  entryIds: string[];
  projectId: string;
}) => {
  const normalizedEntryIds = [...new Set(entryIds.map((value) => value.trim()).filter(Boolean))];

  if (!normalizedEntryIds.length) {
    throw new Error("Select an entry first.");
  }

  const context = await dependencies.getProjectContext(projectId);

  if (!context) {
    throw new Error("Could not load this project right now.");
  }

  dependencies.ensureCollectionWritePermission(context, collection);

  const readyMapping = await dependencies.getReadyContentProjectMapping({
    context,
    projectId,
  });

  if (!readyMapping) {
    throw new Error("Finish mapping before managing collections.");
  }

  ensureContentDatabaseConnection(context);

  return dependencies.withContentDatabaseClient(context.connectionString as string, async (client) => {
    const adapter = createContentCollectionsAdapter(readyMapping);
    const deleteCollectionEntries = getRequiredContentRuntimeAdapterMethod(
      adapter,
      "deleteCollectionEntries",
    );

    return deleteCollectionEntries({
      client,
      collection,
      entryIds: normalizedEntryIds,
    });
  });
};
