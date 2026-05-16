import type { ContentMediaLibrary } from "@/lib/content-runtime/shared";
import { projectEditorLocalCachePrefixes } from "@/components/editor/project-editor/queries";
import {
  clearProjectEditorPersistedCacheEntries,
  readProjectEditorPersistedCacheEntry,
  writeProjectEditorPersistedCacheEntry,
} from "@/components/editor/project-editor/persisted-cache";

const mediaCacheVersion = 2;
export const mediaCacheExpiryBufferMs = 5 * 60 * 1000;

export const ROOT_FOLDER_VALUE = "__root__";

export const getMediaErrorMessage = async (response: Response) => {
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  return payload.error || "Could not load the media library right now.";
};

export const formatBytes = (sizeBytes: number | null) => {
  if (!sizeBytes || sizeBytes <= 0) {
    return "Unknown size";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = sizeBytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
};

export const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export const getFolderName = (folderPath: string) => folderPath.split("/").pop() ?? folderPath;

export const getParentFolderPath = (folderPath: string) => {
  const segments = folderPath.split("/").filter(Boolean);
  segments.pop();
  return segments.join("/");
};

export const rebaseFolderPath = (currentValue: string, sourcePath: string, targetPath: string) => {
  if (currentValue === sourcePath) {
    return targetPath;
  }

  if (!currentValue.startsWith(`${sourcePath}/`)) {
    return currentValue;
  }

  return `${targetPath}/${currentValue.slice(sourcePath.length + 1)}`;
};

const getMediaCacheKey = (projectId: string, path: string, search: string) =>
  `${projectEditorLocalCachePrefixes.mediaManager(projectId, mediaCacheVersion)}${path || "__home__"}:${search || "__all__"}`;

export const readCachedMediaPayload = (projectId: string, path: string, search: string) => {
  return readProjectEditorPersistedCacheEntry<ContentMediaLibrary>({
    key: getMediaCacheKey(projectId, path, search),
    shouldDiscard: (payload) => {
      const expiresAt = Date.parse(payload.urlExpiresAt ?? "");
      return !Number.isFinite(expiresAt) || expiresAt - Date.now() <= mediaCacheExpiryBufferMs;
    },
  });
};

export const writeCachedMediaPayload = (
  projectId: string,
  path: string,
  search: string,
  payload: ContentMediaLibrary,
) => {
  writeProjectEditorPersistedCacheEntry({
    key: getMediaCacheKey(projectId, path, search),
    payload,
  });
};

export const clearCachedMediaPayloads = (projectId: string) => {
  clearProjectEditorPersistedCacheEntries(
    projectEditorLocalCachePrefixes.mediaManager(projectId, mediaCacheVersion),
  );
};
