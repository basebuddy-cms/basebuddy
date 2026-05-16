import { defineConfig, devices } from "@playwright/test";

import { loadPlaywrightEnv } from "./e2e/support/env";

loadPlaywrightEnv();

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL,
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  webServer: {
    command: "node ./scripts/start-playwright-server.mjs",
    port: PORT,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === "1",
    stdout: "ignore",
    stderr: "pipe",
    timeout: 180_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
