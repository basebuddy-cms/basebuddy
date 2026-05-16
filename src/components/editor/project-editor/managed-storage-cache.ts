export const mergeProjectEditorManagedStorageFolderOptions = <
  TPayload extends {
    currentPath: string;
    folderOptions: string[];
    search: string;
  },
>({
  currentPayload,
  nextPayload,
  persistPayload,
}: {
  currentPayload: TPayload | null;
  nextPayload: TPayload;
  persistPayload: (payload: TPayload) => void;
}) => {
  if (!currentPayload) {
    return nextPayload;
  }

  const mergedPayload = {
    ...currentPayload,
    folderOptions: nextPayload.folderOptions,
  };

  persistPayload(mergedPayload);
  return mergedPayload;
};
