import { expect, test } from "@playwright/test";

import { signInAsRole } from "./support/auth";

test.describe("authenticated project shell", () => {
  test("owner sees the mapped self-host collections in navigation", async ({ page }) => {
    const { baseUrl, projectSlug } = await signInAsRole(page, "owner");

    await page.goto(`${baseUrl}/projects/${projectSlug}/posts`);

    await expect(page.getByRole("link", { name: "Project Settings" })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole("link", { name: "Media" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("link", { name: "Files" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("link", { name: "Categories" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("link", { name: "Tags" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("link", { name: "Authors" })).toBeVisible({ timeout: 15000 });
  });

  test("owner can open settings and media from the self-host shell", async ({ page }) => {
    const { baseUrl, projectSlug } = await signInAsRole(page, "owner");

    await page.goto(`${baseUrl}/projects/${projectSlug}/posts`);

    await page.getByRole("link", { name: "Project Settings" }).click();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({
      timeout: 15000,
    });

    await page.getByRole("link", { name: "Media" }).click();
    await expect(page.getByRole("heading", { name: "Media" })).toBeVisible({
      timeout: 15000,
    });

    await page.getByRole("link", { name: "Files" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Files" })).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.getByText("Browse your file library with folders, search, and drag-and-drop uploads for non-image assets."),
    ).toBeVisible({
      timeout: 15000,
    });
  });
});
