import { constants } from "node:fs";
import { access, readFile, rename, unlink, writeFile } from "node:fs/promises";

import { getBaseBuddyConfigPath } from "./paths";
import {
  baseBuddyConfigSchema,
  createDefaultBaseBuddyConfig,
  formatBaseBuddyConfigValidationError,
  redactBaseBuddyConfig,
  type BaseBuddyConfig,
  type CreateDefaultBaseBuddyConfigInput,
} from "./schema";

type BaseBuddyConfigStatus = {
  config: {
    error: string | null;
    exists: boolean;
    path: string;
    readable: boolean;
    valid: boolean;
    writable: boolean;
  };
  redactedConfig: BaseBuddyConfig | null;
};

let pendingConfigWrite: Promise<void> = Promise.resolve();

const createConfigReadError = (message: string, cause?: unknown) =>
  Object.assign(new Error(message), { cause });

const createInvalidConfigError = (error: unknown) => {
  if (error && typeof error === "object" && "issues" in error) {
    return createConfigReadError(
      `BaseBuddy config file is invalid: ${formatBaseBuddyConfigValidationError(
        error as Parameters<typeof formatBaseBuddyConfigValidationError>[0],
      )}`,
      error,
    );
  }

  return createConfigReadError("BaseBuddy config file is invalid.", error);
};

const parseBaseBuddyConfig = (rawConfig: string): BaseBuddyConfig => {
  let parsedConfig: unknown;

  try {
    parsedConfig = JSON.parse(rawConfig);
  } catch (error) {
    throw createConfigReadError("Could not parse BaseBuddy config file.", error);
  }

  const result = baseBuddyConfigSchema.safeParse(parsedConfig);

  if (!result.success) {
    throw createInvalidConfigError(result.error);
  }

  return result.data;
};

const validateBaseBuddyConfig = (config: BaseBuddyConfig): BaseBuddyConfig => {
  const result = baseBuddyConfigSchema.safeParse(config);

  if (!result.success) {
    throw createInvalidConfigError(result.error);
  }

  return result.data;
};

const readBaseBuddyConfigFile = async (): Promise<string | null> => {
  try {
    return await readFile(getBaseBuddyConfigPath(), "utf8");
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }

    throw error;
  }
};

export const loadOptionalBaseBuddyConfig = async (): Promise<BaseBuddyConfig | null> => {
  const rawConfig = await readBaseBuddyConfigFile();

  if (rawConfig === null) {
    return null;
  }

  return parseBaseBuddyConfig(rawConfig);
};

export const loadBaseBuddyConfig = async (): Promise<BaseBuddyConfig> => {
  const config = await loadOptionalBaseBuddyConfig();

  if (!config) {
    throw new Error("BaseBuddy config file does not exist.");
  }

  return config;
};

const writeValidatedBaseBuddyConfig = async (config: BaseBuddyConfig) => {
  const validatedConfig = validateBaseBuddyConfig(config);
  const configPath = getBaseBuddyConfigPath();
  const tempPath = `${configPath}.${process.pid}.${Date.now()}.tmp`;
  const serializedConfig = `${JSON.stringify(validatedConfig, null, 2)}\n`;

  try {
    await writeFile(tempPath, serializedConfig, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(tempPath, configPath);
  } catch (error) {
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }

  return validatedConfig;
};

export const writeBaseBuddyConfig = async (
  updater: (config: BaseBuddyConfig) => BaseBuddyConfig | Promise<BaseBuddyConfig>,
): Promise<BaseBuddyConfig> => {
  const operation = pendingConfigWrite
    .catch(() => undefined)
    .then(async () => {
      const currentConfig = await loadBaseBuddyConfig();
      const nextConfig = await updater(currentConfig);
      return writeValidatedBaseBuddyConfig(nextConfig);
    });

  pendingConfigWrite = operation.then(
    () => undefined,
    () => undefined,
  );

  return operation;
};

export const ensureBaseBuddyConfig = async (
  seed: CreateDefaultBaseBuddyConfigInput,
): Promise<BaseBuddyConfig> => {
  const operation = pendingConfigWrite
    .catch(() => undefined)
    .then(async () => {
      const existingConfig = await loadOptionalBaseBuddyConfig();

      if (existingConfig) {
        return existingConfig;
      }

      return writeValidatedBaseBuddyConfig(createDefaultBaseBuddyConfig(seed));
    });

  pendingConfigWrite = operation.then(
    () => undefined,
    () => undefined,
  );

  return operation;
};

const canAccessConfig = async (mode: number) => {
  try {
    await access(getBaseBuddyConfigPath(), mode);
    return true;
  } catch {
    return false;
  }
};

export const getRedactedBaseBuddyConfigStatus =
  async (): Promise<BaseBuddyConfigStatus> => {
    const configPath = getBaseBuddyConfigPath();
    const readable = await canAccessConfig(constants.R_OK);
    const writable = await canAccessConfig(constants.W_OK);

    try {
      const config = await loadOptionalBaseBuddyConfig();

      return {
        config: {
          error: null,
          exists: Boolean(config),
          path: configPath,
          readable: Boolean(config) && readable,
          valid: Boolean(config),
          writable: Boolean(config) && writable,
        },
        redactedConfig: config ? redactBaseBuddyConfig(config) : null,
      };
    } catch (error) {
      return {
        config: {
          error: error instanceof Error ? error.message : "BaseBuddy config file is invalid.",
          exists: true,
          path: configPath,
          readable,
          valid: false,
          writable,
        },
        redactedConfig: null,
      };
    }
  };
