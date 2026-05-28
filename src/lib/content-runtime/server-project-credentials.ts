import "server-only";

import {
  getConfigContentStorageServiceKey,
  getConfigS3CompatibleStorageCredentialStatus,
  getConfigS3CompatibleStorageCredentials,
} from "@/lib/basebuddy-config/install";

export const getContentStorageServiceKey = async (_projectId: string) =>
  getConfigContentStorageServiceKey();

export const getContentMediaStorageCredentialStatus = async (_projectId: string) =>
  getConfigS3CompatibleStorageCredentialStatus();

export const getContentFilesStorageCredentialStatus = async (_projectId: string) =>
  getConfigS3CompatibleStorageCredentialStatus();

export const getContentS3CompatibleMediaCredentials = async (_projectId: string) =>
  getConfigS3CompatibleStorageCredentials();

export const getContentS3CompatibleFilesCredentials = async (_projectId: string) =>
  getConfigS3CompatibleStorageCredentials();
