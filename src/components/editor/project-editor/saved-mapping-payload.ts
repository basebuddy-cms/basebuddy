import type {
  ContentEntityMapping,
  ContentMappingConfig,
  ContentProjectMapping,
} from "@/lib/content-runtime/mapping";

import type {
  PostsMediaStorageDraft,
  ProjectEditorStorageBucketOption,
} from "./types";

export type ProjectEditorSavedMappingPayload = ContentProjectMapping & {
  availableSupabaseBuckets?: ProjectEditorStorageBucketOption[];
  filesStorageCredentialStatus?: {
    hasS3AccessKeyId?: boolean;
    hasS3SecretAccessKey?: boolean;
  };
  mediaStorageCredentialStatus?: {
    hasS3AccessKeyId?: boolean;
    hasS3SecretAccessKey?: boolean;
  };
};

export type ProjectEditorSavedMappingPayloadState = {
  availableSupabaseBuckets: ProjectEditorStorageBucketOption[];
  filesStorage: PostsMediaStorageDraft | null;
  mappingConfig: ContentMappingConfig | null;
  mediaStorage: PostsMediaStorageDraft | null;
  postsEntity: ContentEntityMapping | null;
};

const buildSavedStorageDraft = ({
  hasStoredCredentials,
  storage,
}: {
  hasStoredCredentials: boolean;
  storage: NonNullable<ContentMappingConfig["filesStorage"]>;
}): PostsMediaStorageDraft => ({
  bucketName: storage.bucketName ?? "",
  endpoint: storage.endpoint ?? "",
  hasStoredCredentials,
  provider: storage.provider ?? "none",
  publicUrlBase: storage.publicUrlBase ?? "",
  region: storage.region ?? "",
});

export const buildProjectEditorSavedMappingPayloadState = (
  mappingPayload: ProjectEditorSavedMappingPayload,
): ProjectEditorSavedMappingPayloadState => {
  const savedFiles = mappingPayload.mappingConfig?.filesStorage;
  const savedMedia = mappingPayload.mappingConfig?.mediaStorage;

  return {
    availableSupabaseBuckets: mappingPayload.availableSupabaseBuckets ?? [],
    filesStorage: savedFiles
      ? buildSavedStorageDraft({
          hasStoredCredentials: Boolean(
            mappingPayload.filesStorageCredentialStatus?.hasS3AccessKeyId &&
              mappingPayload.filesStorageCredentialStatus?.hasS3SecretAccessKey,
          ),
          storage: savedFiles,
        })
      : null,
    mappingConfig: mappingPayload.mappingConfig ?? null,
    mediaStorage: savedMedia
      ? buildSavedStorageDraft({
          hasStoredCredentials: Boolean(
            mappingPayload.mediaStorageCredentialStatus?.hasS3AccessKeyId &&
              mappingPayload.mediaStorageCredentialStatus?.hasS3SecretAccessKey,
          ),
          storage: savedMedia,
        })
      : null,
    postsEntity: mappingPayload.mappingConfig?.entities?.posts ?? null,
  };
};
