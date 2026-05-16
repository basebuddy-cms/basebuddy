import type {
  ContentFileItem,
  ContentFilesLibrary,
  ContentMediaBreadcrumb,
  ContentMediaFolder,
  ContentMediaImage,
  ContentMediaLibrary,
} from "./shared";

export const CONTENT_MEDIA_FOLDER_MARKER = ".basebuddy-folder";
export const LEGACY_SUPAPRESS_MEDIA_FOLDER_MARKER = ".supapress-folder";

const CONTENT_MEDIA_FOLDER_MARKERS = new Set([
  CONTENT_MEDIA_FOLDER_MARKER,
  LEGACY_SUPAPRESS_MEDIA_FOLDER_MARKER,
]);

const IMAGE_EXTENSIONS = new Set([
  "avif",
  "bmp",
  "gif",
  "heic",
  "heif",
  "ico",
  "jpeg",
  "jpg",
  "png",
  "svg",
  "tif",
  "tiff",
  "webp",
]);

export type ContentStorageObjectRecord = {
  createdAt: string;
  id: string;
  metadata: Record<string, unknown> | null;
  objectPath: string;
  updatedAt: string | null;
};

type BuildContentMediaLibraryInput = {
  bucketName: string;
  canManage: boolean;
  currentPath?: string | null;
  folderPaths?: string[];
  includeFolderOptions?: boolean;
  nextCursor?: string | null;
  publicUrlForPath: (path: string) => string;
  records: ContentStorageObjectRecord[];
  search?: string | null;
  urlExpiresAt: string;
};

const getFileName = (objectPath: string) => {
  const normalizedPath = objectPath.trim().replace(/^\/+|\/+$/g, "");

  if (!normalizedPath) {
    return "";
  }

  const pathSegments = normalizedPath.split("/");
  return pathSegments[pathSegments.length - 1] ?? "";
};

export const normalizeContentMediaPath = (value: string | null | undefined) =>
  (value ?? "").trim().replace(/^\/+|\/+$/g, "").replace(/\/+/g, "/");

export const joinContentMediaPath = (parentPath: string, childName: string) => {
  const normalizedParentPath = normalizeContentMediaPath(parentPath);
  const normalizedChildName = normalizeContentMediaPath(childName);

  if (!normalizedParentPath) {
    return normalizedChildName;
  }

  if (!normalizedChildName) {
    return normalizedParentPath;
  }

  return `${normalizedParentPath}/${normalizedChildName}`;
};

export const getContentMediaFolderPath = (objectPath: string) => {
  const normalizedPath = normalizeContentMediaPath(objectPath);

  if (!normalizedPath || !normalizedPath.includes("/")) {
    return "";
  }

  const pathSegments = normalizedPath.split("/");
  pathSegments.pop();
  return pathSegments.join("/");
};

export const isContentFolderMarkerPath = (objectPath: string) =>
  CONTENT_MEDIA_FOLDER_MARKERS.has(getFileName(objectPath));

export const isContentReservedFolderName = (folderName: string) =>
  CONTENT_MEDIA_FOLDER_MARKERS.has(folderName.trim());

const getMimeType = (metadata: Record<string, unknown> | null) => {
  const mimetype = metadata?.mimetype;
  return typeof mimetype === "string" && mimetype.trim() ? mimetype.trim().toLowerCase() : null;
};

const getSizeBytes = (metadata: Record<string, unknown> | null) => {
  const size =
    typeof metadata?.size === "number"
      ? metadata.size
      : typeof metadata?.size === "string"
        ? Number.parseInt(metadata.size, 10)
        : null;

  return typeof size === "number" && Number.isFinite(size) ? size : null;
};

const getFileExtension = (objectPath: string) => {
  const fileName = getFileName(objectPath);
  const extension = fileName.includes(".") ? fileName.split(".").pop() : null;
  return extension?.toLowerCase() ?? null;
};

export const isContentImageObject = (record: ContentStorageObjectRecord) => {
  if (isContentFolderMarkerPath(record.objectPath)) {
    return false;
  }

  const mimeType = getMimeType(record.metadata);

  if (mimeType?.startsWith("image/")) {
    return true;
  }

  const extension = getFileExtension(record.objectPath);
  return Boolean(extension && IMAGE_EXTENSIONS.has(extension));
};

export const isContentFileObject = (record: ContentStorageObjectRecord) => {
  if (isContentFolderMarkerPath(record.objectPath)) {
    return false;
  }

  return !isContentImageObject(record);
};

const createBreadcrumbs = (currentPath: string): ContentMediaBreadcrumb[] => {
  if (!currentPath) {
    return [{ label: "Home", path: "" }];
  }

  const segments = currentPath.split("/");
  const breadcrumbs: ContentMediaBreadcrumb[] = [{ label: "Home", path: "" }];

  segments.forEach((segment, index) => {
    breadcrumbs.push({
      label: segment,
      path: segments.slice(0, index + 1).join("/"),
    });
  });

  return breadcrumbs;
};

const getAncestorFolderPaths = (folderPath: string) => {
  const normalizedFolderPath = normalizeContentMediaPath(folderPath);

  if (!normalizedFolderPath) {
    return [] as string[];
  }

  const segments = normalizedFolderPath.split("/");
  return segments.map((_, index) => segments.slice(0, index + 1).join("/"));
};

const matchesFolderScope = (objectPath: string, currentPath: string) => {
  if (!currentPath) {
    return true;
  }

  return objectPath === currentPath || objectPath.startsWith(`${currentPath}/`);
};

const collectContentMediaFolderPaths = (records: ContentStorageObjectRecord[]) => {
  const folderPaths = new Set<string>();

  records.forEach((record) => {
    if (isContentFolderMarkerPath(record.objectPath)) {
      getAncestorFolderPaths(getContentMediaFolderPath(record.objectPath)).forEach((folderPath) =>
        folderPaths.add(folderPath),
      );
      return;
    }

    if (!isContentImageObject(record)) {
      return;
    }

    getAncestorFolderPaths(getContentMediaFolderPath(record.objectPath)).forEach((folderPath) =>
      folderPaths.add(folderPath),
    );
  });

  return folderPaths;
};

const collectContentFolderPathsForPredicate = (
  records: ContentStorageObjectRecord[],
  predicate: (record: ContentStorageObjectRecord) => boolean,
) => {
  const folderPaths = new Set<string>();

  records.forEach((record) => {
    if (isContentFolderMarkerPath(record.objectPath)) {
      getAncestorFolderPaths(getContentMediaFolderPath(record.objectPath)).forEach((folderPath) =>
        folderPaths.add(folderPath),
      );
      return;
    }

    if (!predicate(record)) {
      return;
    }

    getAncestorFolderPaths(getContentMediaFolderPath(record.objectPath)).forEach((folderPath) =>
      folderPaths.add(folderPath),
    );
  });

  return folderPaths;
};

export const getContentMediaUrlPaths = ({
  currentPath,
  records,
  search,
}: Pick<BuildContentMediaLibraryInput, "currentPath" | "records" | "search">) => {
  const normalizedCurrentPath = normalizeContentMediaPath(currentPath);
  const normalizedSearch = (search ?? "").trim().toLowerCase();
  const imageRecords = records.filter(isContentImageObject);
  const folderPaths = collectContentMediaFolderPaths(records);
  const paths = new Set<string>();

  imageRecords
    .filter((record) => matchesFolderScope(record.objectPath, normalizedCurrentPath))
    .filter((record) => {
      if (!normalizedSearch) {
        return getContentMediaFolderPath(record.objectPath) === normalizedCurrentPath;
      }

      const haystack = `${record.objectPath} ${getFileName(record.objectPath)}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    })
    .forEach((record) => {
      paths.add(record.objectPath);
    });

  if (normalizedSearch) {
    return Array.from(paths);
  }

  Array.from(folderPaths)
    .filter((folderPath) => {
      if (normalizedCurrentPath) {
        if (!folderPath.startsWith(`${normalizedCurrentPath}/`)) {
          return false;
        }

        const remainder = folderPath.slice(normalizedCurrentPath.length + 1);
        return Boolean(remainder) && !remainder.includes("/");
      }

      return Boolean(folderPath) && !folderPath.includes("/");
    })
    .forEach((folderPath) => {
      const previewRecord = imageRecords.find(
        (record) =>
          getContentMediaFolderPath(record.objectPath) === folderPath ||
          getContentMediaFolderPath(record.objectPath).startsWith(`${folderPath}/`),
      );

      if (previewRecord) {
        paths.add(previewRecord.objectPath);
      }
    });

  return Array.from(paths);
};

export const buildContentMediaLibrary = ({
  bucketName,
  canManage,
  currentPath,
  folderPaths: loadedFolderPaths,
  includeFolderOptions = true,
  nextCursor = null,
  publicUrlForPath,
  records,
  search,
  urlExpiresAt,
}: BuildContentMediaLibraryInput): ContentMediaLibrary => {
  const normalizedCurrentPath = normalizeContentMediaPath(currentPath);
  const normalizedSearch = (search ?? "").trim().toLowerCase();
  const imageRecords = records.filter(isContentImageObject);
  const folderPaths = collectContentMediaFolderPaths(records);
  const currentFolderPaths = loadedFolderPaths?.length
    ? new Set(loadedFolderPaths.map(normalizeContentMediaPath).filter(Boolean))
    : folderPaths;

  const folderOptions = includeFolderOptions
    ? Array.from(currentFolderPaths).sort((left, right) => left.localeCompare(right))
    : [];

  const images = imageRecords
    .filter((record) => matchesFolderScope(record.objectPath, normalizedCurrentPath))
    .filter((record) => {
      if (!normalizedSearch) {
        return getContentMediaFolderPath(record.objectPath) === normalizedCurrentPath;
      }

      const haystack = `${record.objectPath} ${getFileName(record.objectPath)}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map(
      (record) =>
        ({
          createdAt: record.createdAt,
          fileName: getFileName(record.objectPath),
          folderPath: getContentMediaFolderPath(record.objectPath),
          id: record.id,
          objectPath: record.objectPath,
          publicUrl: publicUrlForPath(record.objectPath),
          sizeBytes: getSizeBytes(record.metadata),
          updatedAt: record.updatedAt,
        }) satisfies ContentMediaImage,
    );

  const folders = normalizedSearch
    ? []
    : Array.from(currentFolderPaths)
        .filter((folderPath) => {
          if (normalizedCurrentPath) {
            if (!folderPath.startsWith(`${normalizedCurrentPath}/`)) {
              return false;
            }

            const remainder = folderPath.slice(normalizedCurrentPath.length + 1);
            return Boolean(remainder) && !remainder.includes("/");
          }

          return Boolean(folderPath) && !folderPath.includes("/");
        })
        .map((folderPath) => {
          const matchingImages = imageRecords.filter(
            (record) =>
              getContentMediaFolderPath(record.objectPath) === folderPath ||
              getContentMediaFolderPath(record.objectPath).startsWith(`${folderPath}/`),
          );

          return {
            imageCount: matchingImages.length,
            name: getFileName(folderPath),
            path: folderPath,
            previewUrl: matchingImages[0] ? publicUrlForPath(matchingImages[0].objectPath) : null,
          } satisfies ContentMediaFolder;
        })
        .sort((left, right) => left.name.localeCompare(right.name));

  return {
    breadcrumbs: createBreadcrumbs(normalizedCurrentPath),
    bucketName,
    canManage,
    currentPath: normalizedCurrentPath,
    folderOptions,
    folders,
    images,
    nextCursor,
    search: search ?? "",
    urlExpiresAt,
  };
};

export const getContentFilesUrlPaths = ({
  currentPath,
  records,
  search,
}: Pick<BuildContentMediaLibraryInput, "currentPath" | "records" | "search">) => {
  const normalizedCurrentPath = normalizeContentMediaPath(currentPath);
  const normalizedSearch = (search ?? "").trim().toLowerCase();
  const fileRecords = records.filter(isContentFileObject);
  const paths = new Set<string>();

  fileRecords
    .filter((record) => matchesFolderScope(record.objectPath, normalizedCurrentPath))
    .filter((record) => {
      if (!normalizedSearch) {
        return getContentMediaFolderPath(record.objectPath) === normalizedCurrentPath;
      }

      const haystack = `${record.objectPath} ${getFileName(record.objectPath)}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    })
    .forEach((record) => {
      paths.add(record.objectPath);
    });

  return Array.from(paths);
};

export const buildContentFilesLibrary = ({
  bucketName,
  canManage,
  currentPath,
  folderPaths: loadedFolderPaths,
  includeFolderOptions = true,
  nextCursor = null,
  publicUrlForPath,
  records,
  search,
  urlExpiresAt,
}: BuildContentMediaLibraryInput): ContentFilesLibrary => {
  const normalizedCurrentPath = normalizeContentMediaPath(currentPath);
  const normalizedSearch = (search ?? "").trim().toLowerCase();
  const fileRecords = records.filter(isContentFileObject);
  const folderPaths = collectContentFolderPathsForPredicate(records, isContentFileObject);
  const currentFolderPaths = loadedFolderPaths?.length
    ? new Set(loadedFolderPaths.map(normalizeContentMediaPath).filter(Boolean))
    : folderPaths;

  const folderOptions = includeFolderOptions
    ? Array.from(currentFolderPaths).sort((left, right) => left.localeCompare(right))
    : [];

  const files = fileRecords
    .filter((record) => matchesFolderScope(record.objectPath, normalizedCurrentPath))
    .filter((record) => {
      if (!normalizedSearch) {
        return getContentMediaFolderPath(record.objectPath) === normalizedCurrentPath;
      }

      const haystack = `${record.objectPath} ${getFileName(record.objectPath)}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map(
      (record) =>
        ({
          createdAt: record.createdAt,
          fileName: getFileName(record.objectPath),
          folderPath: getContentMediaFolderPath(record.objectPath),
          id: record.id,
          objectPath: record.objectPath,
          publicUrl: publicUrlForPath(record.objectPath),
          sizeBytes: getSizeBytes(record.metadata),
          updatedAt: record.updatedAt,
        }) satisfies ContentFileItem,
    );

  const folders = normalizedSearch
    ? []
    : Array.from(currentFolderPaths)
        .filter((folderPath) => {
          if (normalizedCurrentPath) {
            if (!folderPath.startsWith(`${normalizedCurrentPath}/`)) {
              return false;
            }

            const remainder = folderPath.slice(normalizedCurrentPath.length + 1);
            return Boolean(remainder) && !remainder.includes("/");
          }

          return Boolean(folderPath) && !folderPath.includes("/");
        })
        .map((folderPath) => {
          const matchingFiles = fileRecords.filter(
            (record) =>
              getContentMediaFolderPath(record.objectPath) === folderPath ||
              getContentMediaFolderPath(record.objectPath).startsWith(`${folderPath}/`),
          );

          return {
            imageCount: matchingFiles.length,
            name: getFileName(folderPath),
            path: folderPath,
            previewUrl: null,
          } satisfies ContentMediaFolder;
        })
        .sort((left, right) => left.name.localeCompare(right.name));

  return {
    breadcrumbs: createBreadcrumbs(normalizedCurrentPath),
    bucketName,
    canManage,
    currentPath: normalizedCurrentPath,
    fileCount: files.length,
    files,
    folderOptions,
    folders,
    nextCursor,
    search: search ?? "",
    urlExpiresAt,
  };
};
