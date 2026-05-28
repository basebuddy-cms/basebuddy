import "server-only";

import {
  getS3CompatibleSignedUrlExpiresAt,
  type S3CompatibleMediaStorageConfig,
} from "./s3-compatible-storage";
import {
  createConnectedProjectStorageClient,
  ensureContentMediaApiAccess,
  getContentMediaSignedUrlExpiresAt,
  getContentStorageBucketIsPublic,
  getMappedContentSupabaseFilesBucketName,
} from "./server-media-supabase";
import {
  CONTENT_MEDIA_SIGNED_URL_TTL_SECONDS,
  canManageContentMedia,
  ensureContentStorageConnection,
  getMappedS3CompatibleFilesStorageConfig,
  type ContentMediaContext,
  type ContentMediaDependencies,
} from "./server-media-shared";

export const getContentFilesLibraryContext = async ({
  dependencies,
  projectId,
}: {
  dependencies: ContentMediaDependencies;
  projectId: string;
}) => {
  const context = await dependencies.getProjectContext(projectId);

  if (!context) {
    throw new Error("Could not load this project right now.");
  }

  const readyMapping = await dependencies.getReadyContentProjectMapping({
    context,
    projectId,
  });

  if (!readyMapping) {
    throw new Error("Finish files mapping before opening the files library.");
  }

  ensureContentStorageConnection(context);

  const bucketName = getMappedContentSupabaseFilesBucketName(readyMapping);
  const s3CompatibleFilesStorage = getMappedS3CompatibleFilesStorageConfig(readyMapping);

  if (bucketName) {
    ensureContentMediaApiAccess(context);
    const serviceRoleKey = await dependencies.getContentStorageServiceKey(projectId);
    const isPublicBucket = await getContentStorageBucketIsPublic({
      bucketName,
      connectionString: context.connectionString as string,
      withContentDatabaseClient: dependencies.withContentDatabaseClient,
    });

    if (!serviceRoleKey && !isPublicBucket) {
      throw new Error(
        "Could not browse this private files storage. Check media storage and try again.",
      );
    }

    return {
      bucketName,
      canManage: Boolean(serviceRoleKey) && canManageContentMedia(context),
      context,
      provider: "supabase_bucket",
      publicObjectUrlBase: null,
      s3Storage: null,
      signedUrlExpiresAt: getContentMediaSignedUrlExpiresAt(),
      storage: serviceRoleKey
        ? createConnectedProjectStorageClient({
            apiUrl: context.apiUrl as string,
            serviceRoleKey,
          })
        : null,
      usePublicObjectUrls: isPublicBucket,
    } satisfies ContentMediaContext;
  }

  if (s3CompatibleFilesStorage) {
    const credentials = await dependencies.getContentS3CompatibleFilesCredentials(projectId);

    if (!credentials) {
      throw new Error(
        "Could not browse files storage. Add files storage credentials in environment values and try again.",
      );
    }

    return {
      bucketName: s3CompatibleFilesStorage.bucketName,
      canManage: canManageContentMedia(context),
      context,
      provider: "s3_compatible",
      publicObjectUrlBase: s3CompatibleFilesStorage.publicUrlBase,
      s3Storage: {
        accessKeyId: credentials.accessKeyId,
        bucketName: s3CompatibleFilesStorage.bucketName,
        endpoint: s3CompatibleFilesStorage.endpoint,
        publicUrlBase: s3CompatibleFilesStorage.publicUrlBase,
        region: s3CompatibleFilesStorage.region,
        secretAccessKey: credentials.secretAccessKey,
      } satisfies S3CompatibleMediaStorageConfig,
      signedUrlExpiresAt: getS3CompatibleSignedUrlExpiresAt(CONTENT_MEDIA_SIGNED_URL_TTL_SECONDS),
      storage: null,
      usePublicObjectUrls: Boolean(s3CompatibleFilesStorage.publicUrlBase),
    } satisfies ContentMediaContext;
  }

  throw new Error("Map a supported files storage bucket before opening the files library.");
};
