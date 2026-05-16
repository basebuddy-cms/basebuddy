import { loadPlaywrightEnv } from "../e2e/support/env";
import { seedPlaywrightEnvironment } from "../e2e/setup/seed";

const main = async () => {
  loadPlaywrightEnv();
  const seedState = await seedPlaywrightEnvironment();

  console.log("Seeded Playwright environment:");
  console.log(JSON.stringify(seedState, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
