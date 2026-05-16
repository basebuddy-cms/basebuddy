import type { FullConfig } from "@playwright/test";

import { seedPlaywrightEnvironment } from "./setup/seed";
import { loadPlaywrightEnv } from "./support/env";

export default async function globalSetup(_config: FullConfig) {
  loadPlaywrightEnv();
  await seedPlaywrightEnvironment();
}
