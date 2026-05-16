import type { ContentProjectMapping } from "@/lib/content-runtime/mapping";

export const createStorageLibraryState = ({
  bucketName,
  hasCredentials,
  provider,
}: {
  bucketName: string | null;
  hasCredentials: boolean;
  provider: ContentProjectMapping["mappingConfig"]["mediaStorage"] extends infer T
    ? T extends { provider: infer P }
      ? P
      : never
    : never;
}) => {
  const normalizedBucketName = bucketName?.trim() || null;
  const supportsLibrary =
    (provider === "supabase_bucket" && Boolean(normalizedBucketName)) ||
    (provider === "s3_compatible" && Boolean(normalizedBucketName) && hasCredentials);

  return {
    bucketName: normalizedBucketName,
    canManage: false,
    provider,
    supportsLibrary,
  };
};
