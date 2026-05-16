import "server-only";

import type { Client } from "pg";

import { joinContentMediaPath } from "./media-library";
import type { ContentProjectMapping } from "./mapping";
import {
  getS3CompatibleMediaUrls,
  listS3CompatibleMediaFolderPaths,
  listS3CompatibleMediaObjects,
  type S3CompatibleMediaStorageConfig,
} from "./s3-compatible-storage";
import type { ContentProjectContext } from "./server-project-context";
import {
  getNormalizedContentS3CompatibleMediaStorageConfig,
  getNormalizedContentS3CompatibleStorageConfig,
} from "./server-support";
import {
  getContentMediaFolderPaths,
  getContentMediaObjects,
  getContentMediaUrls,
  type ConnectedProjectStorageClient,
} from "./server-media-supabase";

export type ContentDatabaseClient = Pick<Client, "query">;

export type ContentMediaCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
};

export type ContentMediaDependencies = {
  getContentS3CompatibleFilesCredentials: (
    projectId: string,
  ) => Promise<ContentMediaCredentials | null>;
  getProjectContext: (projectId: string) => Promise<ContentProjectContext | null>;
  getContentS3CompatibleMediaCredentials: (
    projectId: string,
  ) => Promise<ContentMediaCredentials | null>;
  getContentStorageServiceKey: (projectId: string) => Promise<string | null>;
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

export type ContentMediaContext = {
  bucketName: string;
  canManage: boolean;
  context: ContentProjectContext;
  provider: "s3_compatible" | "supabase_bucket";
  publicObjectUrlBase: string | null;
  s3Storage: S3CompatibleMediaStorageConfig | null;
  signedUrlExpiresAt: string;
  storage: ConnectedProjectStorageClient | null;
  usePublicObjectUrls: boolean;
};

export const CONTENT_MEDIA_SIGNED_URL_TTL_SECONDS = 60 * 60;
const CONTENT_DIRECT_UPLOAD_TTL_MS = 15 * 60_000;

type PreparedContentUploadKind = "files" | "media";

type PreparedContentUploadRegistryEntry = {
  expiresAt: number;
  kind: PreparedContentUploadKind;
  objectPath: string;
  projectId: string;
  userId: string;
};

const preparedContentUploads = new Map<string, PreparedContentUploadRegistryEntry>();

const getPreparedContentUploadKey = ({
  kind,
  objectPath,
  projectId,
  userId,
}: Omit<PreparedContentUploadRegistryEntry, "expiresAt">) =>
  `${kind}:${projectId}:${userId}:${objectPath}`;

const pruneExpiredPreparedContentUploads = (now = Date.now()) => {
  for (const [key, entry] of preparedContentUploads.entries()) {
    if (entry.expiresAt <= now) {
      preparedContentUploads.delete(key);
    }
  }
};

export const registerPreparedContentUpload = ({
  kind,
  objectPath,
  projectId,
  ttlMs = CONTENT_DIRECT_UPLOAD_TTL_MS,
  userId,
}: {
  kind: PreparedContentUploadKind;
  objectPath: string;
  projectId: string;
  ttlMs?: number;
  userId: string;
}) => {
  pruneExpiredPreparedContentUploads();

  const entry: PreparedContentUploadRegistryEntry = {
    expiresAt: Date.now() + ttlMs,
    kind,
    objectPath,
    projectId,
    userId,
  };

  preparedContentUploads.set(getPreparedContentUploadKey(entry), entry);
};

export const assertPreparedContentUploads = ({
  kind,
  objectPaths,
  projectId,
  userId,
}: {
  kind: PreparedContentUploadKind;
  objectPaths: string[];
  projectId: string;
  userId: string;
}) => {
  pruneExpiredPreparedContentUploads();

  for (const objectPath of objectPaths) {
    const key = getPreparedContentUploadKey({
      kind,
      objectPath,
      projectId,
      userId,
    });

    if (!preparedContentUploads.has(key)) {
      throw new Error("Could not verify those uploads. Prepare the upload again and try.");
    }
  }

  objectPaths.forEach((objectPath) => {
    preparedContentUploads.delete(
      getPreparedContentUploadKey({
        kind,
        objectPath,
        projectId,
        userId,
      }),
    );
  });
};

export const ensureContentPlaneStorageConnection = (context: ContentProjectContext) => {
  if (!context.connectionString) {
    throw new Error("This project needs a content connection before you can continue.");
  }
};

export const canManageContentMedia = (context: {
  memberAccess: {
    roles: string[];
  };
}) =>
  context.memberAccess.roles.some(
    (role) => role === "owner" || role === "admin" || role === "editor" || role === "author",
  );

export const getMappedS3CompatibleMediaStorageConfig = (
  mapping: ContentProjectMapping,
): Pick<S3CompatibleMediaStorageConfig, "bucketName" | "endpoint" | "publicUrlBase" | "region"> | null => {
  const mediaStorage = getNormalizedContentS3CompatibleMediaStorageConfig(mapping.mappingConfig.mediaStorage);

  if (!mediaStorage) {
    return null;
  }

  return {
    bucketName: mediaStorage.bucketName,
    endpoint: mediaStorage.endpoint,
    publicUrlBase: mediaStorage.publicUrlBase,
    region: mediaStorage.region,
  };
};

export const getMappedS3CompatibleFilesStorageConfig = (
  mapping: ContentProjectMapping,
): Pick<S3CompatibleMediaStorageConfig, "bucketName" | "endpoint" | "publicUrlBase" | "region"> | null => {
  const filesStorage = getNormalizedContentS3CompatibleStorageConfig(mapping.mappingConfig.filesStorage);

  if (!filesStorage) {
    return null;
  }

  return {
    bucketName: filesStorage.bucketName,
    endpoint: filesStorage.endpoint,
    publicUrlBase: filesStorage.publicUrlBase,
    region: filesStorage.region,
  };
};

export const requireContentManagedStorage = (mediaContext: ContentMediaContext) => {
  if (!canManageContentMedia(mediaContext.context)) {
    throw new Error("You do not have permission to manage media in this project.");
  }

  if (
    !mediaContext.canManage ||
    (mediaContext.provider === "supabase_bucket" && !mediaContext.storage) ||
    (mediaContext.provider === "s3_compatible" && !mediaContext.s3Storage)
  ) {
    throw new Error(
      "This storage library is read-only right now. Add upload storage credentials to enable uploads and media management.",
    );
  }

  return mediaContext;
};

export const getContentManagedMediaObjects = async ({
  currentPath,
  cursor = null,
  dependencies,
  limit,
  mediaContext,
  search,
}: {
  currentPath?: string | null;
  cursor?: string | null;
  dependencies: ContentMediaDependencies;
  limit?: number;
  mediaContext: ContentMediaContext;
  search?: string | null;
}) =>
  mediaContext.provider === "s3_compatible"
    ? listS3CompatibleMediaObjects(mediaContext.s3Storage as S3CompatibleMediaStorageConfig, {
        currentPath,
        cursor,
        limit,
        search,
      })
    : getContentMediaObjects({
        bucketName: mediaContext.bucketName,
        connectionString: mediaContext.context.connectionString as string,
        currentPath,
        cursor,
        limit,
        search,
        withContentDatabaseClient: dependencies.withContentDatabaseClient,
      });

export const getContentManagedMediaFolderPaths = async ({
  currentPath,
  dependencies,
  limit,
  mediaContext,
}: {
  currentPath?: string | null;
  dependencies: ContentMediaDependencies;
  limit?: number;
  mediaContext: ContentMediaContext;
}) =>
  mediaContext.provider === "s3_compatible"
    ? listS3CompatibleMediaFolderPaths(mediaContext.s3Storage as S3CompatibleMediaStorageConfig, {
        currentPath,
        limit,
      })
    : getContentMediaFolderPaths({
        bucketName: mediaContext.bucketName,
        connectionString: mediaContext.context.connectionString as string,
        currentPath,
        limit,
        withContentDatabaseClient: dependencies.withContentDatabaseClient,
      });

export const getContentManagedMediaUrls = async ({
  mediaContext,
  objectPaths,
}: {
  mediaContext: ContentMediaContext;
  objectPaths: string[];
}) =>
  mediaContext.provider === "s3_compatible"
    ? getS3CompatibleMediaUrls({
        config: mediaContext.s3Storage as S3CompatibleMediaStorageConfig,
        objectPaths,
        ttlSeconds: CONTENT_MEDIA_SIGNED_URL_TTL_SECONDS,
      })
    : getContentMediaUrls({
        apiUrl: mediaContext.context.apiUrl as string,
        bucketName: mediaContext.bucketName,
        objectPaths,
        storage: mediaContext.storage,
        usePublicObjectUrls: mediaContext.usePublicObjectUrls,
      });

const sanitizeContentPathSegment = (value: string, fallback: string) => {
  const lastSegment = value.trim().split(/[\\/]+/).filter(Boolean).pop() ?? "";
  const sanitized = lastSegment
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\.\.+/g, ".")
    .replace(/^\.|\.$/g, "")
    .trim();

  return sanitized || fallback;
};

export const getUniqueContentObjectPath = (
  existingPaths: Set<string>,
  targetFolderPath: string,
  fileName: string,
) => {
  const sanitizedFileName = sanitizeContentPathSegment(fileName, "upload");
  const extension = sanitizedFileName.includes(".") ? sanitizedFileName.split(".").pop() ?? "" : "";
  const baseName = extension ? sanitizedFileName.slice(0, -(extension.length + 1)) : sanitizedFileName;
  let candidateName = sanitizedFileName;
  let suffix = 2;
  let candidatePath = joinContentMediaPath(targetFolderPath, candidateName);

  while (existingPaths.has(candidatePath)) {
    candidateName = extension ? `${baseName}-${suffix}.${extension}` : `${baseName}-${suffix}`;
    candidatePath = joinContentMediaPath(targetFolderPath, candidateName);
    suffix += 1;
  }

  existingPaths.add(candidatePath);
  return candidatePath;
};

export const getUniqueContentFolderPath = (
  existingPaths: Set<string>,
  targetParentPath: string,
  folderName: string,
) => {
  const sanitizedFolderName = sanitizeContentPathSegment(folderName, "folder");
  let candidateName = sanitizedFolderName;
  let suffix = 2;
  let candidatePath = joinContentMediaPath(targetParentPath, candidateName);

  const hasConflict = (folderPath: string) =>
    Array.from(existingPaths).some((path) => path === folderPath || path.startsWith(`${folderPath}/`));

  while (hasConflict(candidatePath)) {
    candidateName = `${sanitizedFolderName}-${suffix}`;
    candidatePath = joinContentMediaPath(targetParentPath, candidateName);
    suffix += 1;
  }

  return candidatePath;
};
