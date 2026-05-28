import "server-only";

import {
  getBaseBuddyContentRuntimeEnv,
  getBaseBuddyContentStorageServiceKey,
  getBaseBuddyS3CompatibleStorageCredentialStatus,
  getBaseBuddyS3CompatibleStorageCredentials,
} from "./env";

export type ConfigContentRuntimeContext = {
  apiUrl: string | null;
  databaseUrl: string | null;
  publishableKey: string | null;
};

export type ConfigS3CompatibleStorageCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
};

export type ConfigContentDatabaseSslConfig =
  | false
  | {
      rejectUnauthorized: false;
    };

export const getConfigContentRuntimeContext =
  async (): Promise<ConfigContentRuntimeContext> => getBaseBuddyContentRuntimeEnv();

export const getConfigContentStorageServiceKey = async () =>
  getBaseBuddyContentStorageServiceKey();

export const getConfigS3CompatibleStorageCredentials =
  async (): Promise<ConfigS3CompatibleStorageCredentials | null> => {
    return getBaseBuddyS3CompatibleStorageCredentials();
  };

export const getConfigS3CompatibleStorageCredentialStatus = async () => {
  return getBaseBuddyS3CompatibleStorageCredentialStatus();
};

export const getConfigContentDatabaseSslConfig = (
  connectionString: string,
): ConfigContentDatabaseSslConfig => {
  try {
    const databaseUrl = new URL(connectionString);

    if (databaseUrl.searchParams.get("sslmode")?.toLowerCase() === "disable") {
      return false;
    }
  } catch {
    // URL validation is reported by setup/runtime callers; default to TLS.
  }

  return {
    rejectUnauthorized: false,
  };
};
