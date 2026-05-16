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
  getMappedContentSupabaseMediaBucketName,
} from "./server-media-supabase";
import {
  CONTENT_MEDIA_SIGNED_URL_TTL_SECONDS,
  canManageContentMedia,
  ensureContentPlaneStorageConnection,
  getMappedS3CompatibleMediaStorageConfig,
  type ContentMediaContext,
  type ContentMediaDependencies,
} from "./server-media-shared";

export const getContentMediaLibraryContext = async ({
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
    throw new Error("Finish media mapping before opening the media library.");
  }

  ensureContentPlaneStorageConnection(context);

  const bucketName = getMappedContentSupabaseMediaBucketName(readyMapping);
  const s3CompatibleMediaStorage = getMappedS3CompatibleMediaStorageConfig(readyMapping);

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
        "Could not browse this private media storage. Check upload storage and try again.",
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

  if (s3CompatibleMediaStorage) {
    const credentials = await dependencies.getContentS3CompatibleMediaCredentials(projectId);

    if (!credentials) {
      throw new Error(
        "Could not browse media storage. Add media upload storage credentials in app configuration and try again.",
      );
    }

    return {
      bucketName: s3CompatibleMediaStorage.bucketName,
      canManage: canManageContentMedia(context),
      context,
      provider: "s3_compatible",
      publicObjectUrlBase: s3CompatibleMediaStorage.publicUrlBase,
      s3Storage: {
        accessKeyId: credentials.accessKeyId,
        bucketName: s3CompatibleMediaStorage.bucketName,
        endpoint: s3CompatibleMediaStorage.endpoint,
        publicUrlBase: s3CompatibleMediaStorage.publicUrlBase,
        region: s3CompatibleMediaStorage.region,
        secretAccessKey: credentials.secretAccessKey,
      } satisfies S3CompatibleMediaStorageConfig,
      signedUrlExpiresAt: getS3CompatibleSignedUrlExpiresAt(CONTENT_MEDIA_SIGNED_URL_TTL_SECONDS),
      storage: null,
      usePublicObjectUrls: Boolean(s3CompatibleMediaStorage.publicUrlBase),
    } satisfies ContentMediaContext;
  }

  throw new Error("Map a supported media storage bucket before opening the media library.");
};
