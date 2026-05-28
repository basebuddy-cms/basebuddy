import { join } from "node:path";

export const BASEBUDDY_CONFIG_FILENAME = "basebuddy.config.json";

export const getBaseBuddyConfigPath = () =>
  join(process.cwd(), BASEBUDDY_CONFIG_FILENAME);
