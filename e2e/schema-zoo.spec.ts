import { expect, test } from "@playwright/test";

const runKey = process.env.BASEBUDDY_SCHEMA_ZOO_RUN_KEY?.trim();

test.describe("schema-zoo mapping", () => {
  test.skip(!runKey, "Set BASEBUDDY_SCHEMA_ZOO_RUN_KEY after running scripts/smoke-schema-zoo.ts.");

  test("owner can use mapped content from nonstandard schemas", async ({ page }) => {
    test.setTimeout(120_000);

    const baseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim() || "http://localhost:3100";

    await page.goto(
      `${baseUrl}/api/test-auth/playwright-sign-in?role=owner&next=${encodeURIComponent("/projects")}`,
      {
        waitUntil: "domcontentloaded",
      },
    );

    for (const projectSlug of [
      `bb-zoo-direct-${runKey}`,
      `bb-zoo-json-${runKey}`,
      `bb-zoo-helper-${runKey}`,
      `bb-zoo-readonly-${runKey}`,
    ]) {
      await page.goto(`${baseUrl}/projects/${projectSlug}/posts`, {
        waitUntil: "domcontentloaded",
      });

      await expect(page).toHaveURL(new RegExp(`/projects/${projectSlug}/posts$`), {
        timeout: 45_000,
      });
      await expect(page.getByRole("heading", { name: "Posts" })).toBeVisible({
        timeout: 45_000,
      });
      await expect(page.locator("tbody tr").first()).toBeVisible({
        timeout: 45_000,
      });
    }
  });
});
