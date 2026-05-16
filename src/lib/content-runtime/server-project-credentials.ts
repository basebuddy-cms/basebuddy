import "server-only";

import {
  getInstallContentSupabaseServiceRoleKey,
  getInstallS3CompatibleStorageCredentialStatus,
  getInstallS3CompatibleStorageCredentials,
} from "@/lib/self-host/install-runtime";

export const getContentStorageServiceKey = async (_projectId: string) =>
  getInstallContentSupabaseServiceRoleKey();

export const getContentMediaStorageCredentialStatus = async (_projectId: string) =>
  getInstallS3CompatibleStorageCredentialStatus("media");

export const getContentFilesStorageCredentialStatus = async (_projectId: string) =>
  getInstallS3CompatibleStorageCredentialStatus("files");

export const getContentS3CompatibleMediaCredentials = async (_projectId: string) =>
  getInstallS3CompatibleStorageCredentials("media");

export const getContentS3CompatibleFilesCredentials = async (_projectId: string) =>
  getInstallS3CompatibleStorageCredentials("files");
