import { getProductionErrorMessage } from "@/lib/errors/user-facing";

export type ManagedStorageRouteKind = "files" | "media";

const MANAGED_STORAGE_DEFAULT_ERROR_MESSAGES: Record<ManagedStorageRouteKind, string> = {
  files: "Could not manage the files library right now.",
  media: "Could not manage the media library right now.",
};

const MANAGED_STORAGE_MISSING_PATTERNS: Record<ManagedStorageRouteKind, RegExp> = {
  files: /Could not find that (file|folder)/i,
  media: /Could not find that (image|folder)/i,
};

const MANAGED_STORAGE_BAD_REQUEST_PATTERNS: Record<ManagedStorageRouteKind, RegExp> = {
  files:
    /required|cannot contain|Choose at least one|Image files belong in the media library|Choose a file|Choose a folder|Choose a different|not configured|Check the storage configuration and try again|read-only|Map a supported files storage bucket|save the access key pair|save the required server-side credentials/i,
  media:
    /required|cannot contain|Choose at least one|Only image files|Choose an image|Choose a folder|Choose a different|not configured|Check the storage configuration and try again|read-only|Map a supported media storage bucket|save the access key pair|save the required server-side credentials/i,
};

export const getManagedStorageRouteErrorMessage = (
  error: unknown,
  kind: ManagedStorageRouteKind,
) => getProductionErrorMessage(error, MANAGED_STORAGE_DEFAULT_ERROR_MESSAGES[kind]);

export const getManagedStorageRouteErrorStatus = (
  message: string,
  kind: ManagedStorageRouteKind,
) => {
  if (/Authentication required|Please sign in to continue/i.test(message)) {
    return 401;
  }

  if (/permission/i.test(message)) {
    return 403;
  }

  if (/responding too slowly right now|temporarily switched this project into a degraded state|having trouble reaching this project's content right now/i.test(message)) {
    return 503;
  }

  if (MANAGED_STORAGE_BAD_REQUEST_PATTERNS[kind].test(message)) {
    return 400;
  }

  if (MANAGED_STORAGE_MISSING_PATTERNS[kind].test(message)) {
    return 404;
  }

  return 500;
};
