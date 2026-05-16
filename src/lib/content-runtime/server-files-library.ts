import "server-only";

import {
  buildContentFilesLibrary,
  getContentFilesUrlPaths,
} from "./media-library";
import type { ContentFilesLibrary } from "./shared";
import { getContentFilesLibraryContext } from "./server-files-context";
import {
  getContentManagedMediaFolderPaths,
  getContentManagedMediaObjects,
  getContentManagedMediaUrls,
  type ContentMediaDependencies,
} from "./server-media-shared";

export const getContentFilesLibrary = async ({
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
}): Promise<ContentFilesLibrary> => {
  const filesContext = await getContentFilesLibraryContext({
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
      mediaContext: filesContext,
      search,
    }),
    search?.trim()
      ? Promise.resolve([])
      : getContentManagedMediaFolderPaths({
          currentPath,
          dependencies,
          limit: 200,
          mediaContext: filesContext,
        }),
  ]);
  const visibleRecords = records.slice(0, pageSize);
  const nextCursor = records.length > pageSize
    ? (visibleRecords.at(-1)?.objectPath ?? null)
    : null;
  const signedUrlByPath = await getContentManagedMediaUrls({
    mediaContext: filesContext,
    objectPaths: getContentFilesUrlPaths({
      currentPath,
      records: visibleRecords,
      search,
    }),
  });

  return buildContentFilesLibrary({
    bucketName: filesContext.bucketName,
    canManage: filesContext.canManage,
    currentPath,
    folderPaths,
    includeFolderOptions,
    publicUrlForPath: (objectPath) => signedUrlByPath.get(objectPath) ?? "",
    records: visibleRecords,
    search,
    urlExpiresAt: filesContext.signedUrlExpiresAt,
    nextCursor,
  });
};
