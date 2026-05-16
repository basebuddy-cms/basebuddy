import type { ContentWorkspaceMeta } from "@/lib/content-runtime/shared";

type ProjectEditorManagedStorageStateInput = {
  contentRuntime: ContentWorkspaceMeta["contentRuntime"];
};

export type ProjectEditorManagedStorageState = {
  canUploadFeaturedImage: boolean;
  contentFilesStorage: NonNullable<ContentWorkspaceMeta["contentRuntime"]>["filesStorage"];
  contentMediaStorage: NonNullable<ContentWorkspaceMeta["contentRuntime"]>["mediaStorage"];
  usesManagedFilesLibrary: boolean;
  usesManagedMediaLibrary: boolean;
};

export const getProjectEditorManagedStorageState = ({
  contentRuntime,
}: ProjectEditorManagedStorageStateInput): ProjectEditorManagedStorageState => {
  const contentFilesStorage = contentRuntime?.filesStorage ?? null;
  const contentMediaStorage = contentRuntime?.mediaStorage ?? null;

  return {
    canUploadFeaturedImage: Boolean(
      contentMediaStorage?.supportsLibrary && contentMediaStorage.canManage,
    ),
    contentFilesStorage,
    contentMediaStorage,
    usesManagedFilesLibrary: Boolean(contentFilesStorage?.supportsLibrary),
    usesManagedMediaLibrary: Boolean(contentMediaStorage?.supportsLibrary),
  };
};
