import type { ContentProjectMapping } from "@/lib/content-runtime/mapping";
import type { ContentDatabaseClient } from "@/lib/content-runtime/mapped-content-runtime-support";

import type { ContentAdapterRelationOption } from "../contracts";
import {
  buildContentAdapterRelationOption,
  dedupeContentAdapterRelationOptions,
} from "./relation-helpers";
import {
  searchMappedContentAuthors,
  searchMappedContentCategories,
  searchMappedContentFiles,
  searchMappedContentMedia,
  searchMappedContentParentPages,
  searchMappedContentTags,
} from "./runtime";

type ContentAdapterRelationSearchBaseRequest = {
  client: ContentDatabaseClient;
  limit?: number;
  mapping: ContentProjectMapping;
  search: string;
  selectedIds?: string[];
};

type ContentAdapterScopedRelationSearchRequest = ContentAdapterRelationSearchBaseRequest & {
  accessibleAuthorIds?: string[] | null;
};

const getSelectedIdsRequest = (selectedIds?: string[]) =>
  selectedIds?.length ? { selectedIds } : {};

export const searchContentAdapterAuthors = async ({
  accessibleAuthorIds = null,
  client,
  limit = 100,
  mapping,
  search,
  selectedIds,
}: ContentAdapterScopedRelationSearchRequest): Promise<ContentAdapterRelationOption[]> => {
  const authors = await searchMappedContentAuthors({
    accessibleAuthorIds,
    client,
    limit,
    mapping,
    search,
    ...getSelectedIdsRequest(selectedIds),
  });

  return dedupeContentAdapterRelationOptions(
    authors.map((author) =>
      buildContentAdapterRelationOption({
        fallbackLabel: author.slug,
        id: author.id,
        label: author.name,
        metadata: {
          slug: author.slug,
        },
      }),
    ),
  );
};

export const searchContentAdapterCategories = async ({
  client,
  limit = 100,
  mapping,
  search,
  selectedIds,
}: ContentAdapterRelationSearchBaseRequest): Promise<ContentAdapterRelationOption[]> => {
  const categories = await searchMappedContentCategories({
    client,
    limit,
    mapping,
    search,
    ...getSelectedIdsRequest(selectedIds),
  });

  return dedupeContentAdapterRelationOptions(
    categories.map((category) =>
      buildContentAdapterRelationOption({
        fallbackLabel: category.slug,
        id: category.id,
        label: category.hierarchyPath || category.name,
        metadata: {
          depth: category.depth,
          hierarchyPath: category.hierarchyPath,
          slug: category.slug,
        },
      }),
    ),
  );
};

export const searchContentAdapterMedia = async ({
  client,
  limit = 100,
  mapping,
  search,
  selectedIds,
}: ContentAdapterRelationSearchBaseRequest): Promise<ContentAdapterRelationOption[]> => {
  const mediaItems = await searchMappedContentMedia({
    client,
    limit,
    mapping,
    search,
    ...getSelectedIdsRequest(selectedIds),
  });

  return dedupeContentAdapterRelationOptions(
    mediaItems.map((mediaItem) =>
      buildContentAdapterRelationOption({
        fallbackLabel: mediaItem.objectPath,
        id: mediaItem.id,
        label: mediaItem.fileName,
        metadata: {
          objectPath: mediaItem.objectPath,
          ...(mediaItem.url ? { url: mediaItem.url } : {}),
        },
      }),
    ),
  );
};

export const searchContentAdapterFiles = async ({
  client,
  limit = 100,
  mapping,
  search,
  selectedIds,
}: ContentAdapterRelationSearchBaseRequest): Promise<ContentAdapterRelationOption[]> => {
  const fileItems = await searchMappedContentFiles({
    client,
    limit,
    mapping,
    search,
    ...getSelectedIdsRequest(selectedIds),
  });

  return dedupeContentAdapterRelationOptions(
    fileItems.map((fileItem) =>
      buildContentAdapterRelationOption({
        fallbackLabel: fileItem.objectPath,
        id: fileItem.id,
        label: fileItem.fileName,
        metadata: {
          objectPath: fileItem.objectPath,
          ...(fileItem.url ? { url: fileItem.url } : {}),
        },
      }),
    ),
  );
};

export const searchContentAdapterParentPages = async ({
  accessibleAuthorIds = null,
  client,
  limit = 100,
  mapping,
  search,
  selectedIds,
}: ContentAdapterScopedRelationSearchRequest): Promise<ContentAdapterRelationOption[]> => {
  const posts = await searchMappedContentParentPages({
    accessibleAuthorIds,
    client,
    limit,
    mapping,
    search,
    ...getSelectedIdsRequest(selectedIds),
  });

  return dedupeContentAdapterRelationOptions(
    posts.map((post) =>
      buildContentAdapterRelationOption({
        fallbackLabel: post.slug,
        id: post.id,
        label: post.title,
        metadata: {
          slug: post.slug,
        },
      }),
    ),
  );
};

export const searchContentAdapterTags = async ({
  client,
  limit = 100,
  mapping,
  search,
  selectedIds,
}: ContentAdapterRelationSearchBaseRequest): Promise<ContentAdapterRelationOption[]> => {
  const tags = await searchMappedContentTags({
    client,
    limit,
    mapping,
    search,
    ...getSelectedIdsRequest(selectedIds),
  });

  return dedupeContentAdapterRelationOptions(
    tags.map((tag) =>
      buildContentAdapterRelationOption({
        fallbackLabel: tag.slug,
        id: tag.id,
        label: tag.name,
        metadata: {
          slug: tag.slug,
        },
      }),
    ),
  );
};
