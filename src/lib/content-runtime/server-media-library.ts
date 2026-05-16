import "server-only";

import {
  buildContentMediaLibrary,
  getContentMediaUrlPaths,
} from "./media-library";
import type { ContentMediaLibrary } from "./shared";
import { getContentMediaLibraryContext } from "./server-media-context";
import {
  getContentManagedMediaFolderPaths,
  getContentManagedMediaObjects,
  getContentManagedMediaUrls,
  type ContentMediaDependencies,
} from "./server-media-shared";

export const getContentMediaLibrary = async ({
  currentPath,
  cursor = null,
  dependencies,
  includeFolderOptions = false,
  projectId,
  search,
}: {
  currentPath?: string | null;
  cursor?: string | null;
  dependencies: ContentMediaDependencies;
  includeFolderOptions?: boolean;
  projectId: string;
  search?: string | null;
}): Promise<ContentMediaLibrary> => {
  const mediaContext = await getContentMediaLibraryContext({
    dependencies,
    projectId,
  });
  const pageSize = 250;
  const [records, folderPaths] = await Promise.all([
    getContentManagedMediaObjects({
      currentPath,
      cursor,
      dependencies,
      limit: pageSize + 1,
      mediaContext,
      search,
    }),
    search?.trim()
      ? Promise.resolve([])
      : getContentManagedMediaFolderPaths({
          currentPath,
          dependencies,
          limit: 200,
          mediaContext,
        }),
  ]);
  const visibleRecords = records.slice(0, pageSize);
  const nextCursor = records.length > pageSize
    ? (visibleRecords.at(-1)?.objectPath ?? null)
    : null;
  const signedUrlByPath = await getContentManagedMediaUrls({
    mediaContext,
    objectPaths: getContentMediaUrlPaths({
      currentPath,
      records: visibleRecords,
      search,
    }),
  });

  return buildContentMediaLibrary({
    bucketName: mediaContext.bucketName,
    canManage: mediaContext.canManage,
    currentPath,
    folderPaths,
    includeFolderOptions,
    publicUrlForPath: (objectPath) => signedUrlByPath.get(objectPath) ?? "",
    records: visibleRecords,
    search,
    urlExpiresAt: mediaContext.signedUrlExpiresAt,
    nextCursor,
  });
};
