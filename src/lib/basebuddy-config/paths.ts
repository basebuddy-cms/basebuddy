import { mkdirSync } from "node:fs";
import { join } from "node:path";

export const BASEBUDDY_CONFIG_DIRECTORY = "basebuddy-data";
export const BASEBUDDY_CONFIG_FILENAME = "basebuddy.config.json";

export const getBaseBuddyDataDirectoryPath = () =>
  join(process.cwd(), BASEBUDDY_CONFIG_DIRECTORY);

export const ensureBaseBuddyDataDirectorySync = () => {
  const directoryPath = getBaseBuddyDataDirectoryPath();
  mkdirSync(directoryPath, { recursive: true });
  return directoryPath;
};

export const getBaseBuddyConfigPath = () =>
  join(ensureBaseBuddyDataDirectorySync(), BASEBUDDY_CONFIG_FILENAME);
