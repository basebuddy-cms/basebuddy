import "server-only";

import {
  type BaseBuddyPostgresSslConfig,
  getBaseBuddyPostgresSslConfig,
} from "./database-ssl";
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

export type ConfigContentDatabaseSslConfig = BaseBuddyPostgresSslConfig;

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
): ConfigContentDatabaseSslConfig => getBaseBuddyPostgresSslConfig(connectionString);
