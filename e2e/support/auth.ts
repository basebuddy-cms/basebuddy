import type { Page } from "@playwright/test";
import { loadPlaywrightEnv } from "./env";
import { loadPlaywrightSeedState, type PlaywrightSeedUserKey } from "./state";

export const signInAsRole = async (page: Page, roleKey: PlaywrightSeedUserKey) => {
  const seedState = loadPlaywrightSeedState();
  loadPlaywrightEnv();
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim() || "http://localhost:3100";
  await page.context().clearCookies();
  await page.goto(
    `${baseUrl}/api/test-auth/playwright-sign-in?role=${encodeURIComponent(roleKey)}&next=${encodeURIComponent("/projects")}`,
    {
      waitUntil: "domcontentloaded",
    },
  );
  await page.goto(`${baseUrl}/projects`, {
    waitUntil: "domcontentloaded",
  });

  if (/\/login(?:[/?#]|$)/.test(page.url())) {
    throw new Error(`Role ${roleKey} did not establish an authenticated browser session.`);
  }

  return {
    baseUrl,
    projectSlug: seedState.projects.project.slug,
    seedState,
  };
};
