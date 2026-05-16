import { expect, test } from "@playwright/test";

import { signInAsRole } from "./support/auth";
import type { PlaywrightSeedUserKey } from "./support/state";

const roles: PlaywrightSeedUserKey[] = ["owner", "admin", "editor", "author", "viewer"];

test.describe("authenticated project access", () => {
  for (const role of roles) {
    test(`${role} can open the seeded project list`, async ({ page }) => {
      const { baseUrl, seedState } = await signInAsRole(page, role);

      await page.goto(`${baseUrl}/projects`);

      await expect(page).toHaveURL(/\/projects$/);
      await expect(page.getByText(seedState.projects.project.name)).toBeVisible();
    });
  }

  test("owner sees project creation on the projects page", async ({ page }) => {
    const { baseUrl } = await signInAsRole(page, "owner");

    await page.goto(`${baseUrl}/projects`);

    await expect(page.getByLabel("Project name")).toBeVisible();
    await expect(page.getByLabel("Project address")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create project" })).toBeVisible();
    await expect(page.getByText(/connect|verify|review|database password|one-click/i)).toHaveCount(0);
  });

  test("owner can create a self-host project and land in mapping mode", async ({ page }, testInfo) => {
    test.setTimeout(90_000);

    const { baseUrl } = await signInAsRole(page, "owner");
    const uniqueSuffix = `${Date.now()}-${testInfo.parallelIndex}`;
    const projectName = `Playwright Smoke ${uniqueSuffix}`;
    const projectSlug = `pw-smoke-${uniqueSuffix}`;

    await page.goto(`${baseUrl}/projects`);

    await page.getByLabel("Project name").fill(projectName);
    await page.getByLabel("Project address").fill(projectSlug);
    await expect(page.getByText("This project address is available.")).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "Create project" }).click();

    await expect(page).toHaveURL(new RegExp(`/projects/${projectSlug}(?:/posts)?$`), {
      timeout: 45_000,
    });
    await expect(page.getByRole("button", { name: "Set up Posts" })).toBeVisible({
      timeout: 30_000,
    });
  });
});
