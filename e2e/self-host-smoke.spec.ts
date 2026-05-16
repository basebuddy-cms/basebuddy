import { expect, test } from "@playwright/test";

import { signInAsRole } from "./support/auth";

const SEEDED_SELF_HOST_POST_ID = "20000000-0000-0000-0000-000000000501";

test.describe.configure({ mode: "serial" });

test.describe("self-host smoke", () => {
  test("fresh install path reaches login and an authenticated projects list", async ({ page }) => {
    test.setTimeout(90_000);

    await page.goto("/");

    await expect(page).toHaveURL(/\/login$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Welcome back" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("button", { name: "Email me a Sign-In Link" })).toBeVisible({
      timeout: 30_000,
    });

    const { baseUrl, seedState } = await signInAsRole(page, "owner");

    await page.goto(`${baseUrl}/projects`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/projects$/, { timeout: 30_000 });
    await expect(page.getByText(seedState.projects.project.name)).toBeVisible({
      timeout: 30_000,
    });
  });

  test("owner can create a self-host project and land in mapping mode", async ({ page }, testInfo) => {
    test.setTimeout(90_000);

    const { baseUrl } = await signInAsRole(page, "owner");
    const uniqueSuffix = `${Date.now()}-${testInfo.parallelIndex}`;
    const projectName = `Playwright Smoke ${uniqueSuffix}`;
    const projectSlug = `pw-smoke-${uniqueSuffix}`;

    await page.goto(`${baseUrl}/projects`, { waitUntil: "domcontentloaded" });
    await expect(page.getByLabel("Project name")).toBeVisible({
      timeout: 30_000,
    });

    await page.getByLabel("Project name").fill(projectName);
    await page.getByLabel("Project address").fill(projectSlug);
    await expect(page.getByText("This project address is available.")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Create project" }).click();

    await expect(page).toHaveURL(new RegExp(`/projects/${projectSlug}(?:/posts)?$`), {
      timeout: 45_000,
    });
    await expect(page.getByRole("button", { name: "Set up Posts" })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("owner can open mapping, edit posts, and browse media and files in the seeded self-host project", async ({ page }) => {
    test.setTimeout(120_000);

    const { baseUrl, projectSlug } = await signInAsRole(page, "owner");

    await page.goto(`${baseUrl}/projects/${projectSlug}/settings?tab=mapping`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByRole("main").getByText("Content Mapping").first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("button", { name: "Open Posts setup" })).toBeVisible({
      timeout: 30_000,
    });

    await page.goto(`${baseUrl}/projects/${projectSlug}/posts/${SEEDED_SELF_HOST_POST_ID}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByRole("textbox", { name: "Post title" })).toHaveValue("Self Host Assigned Draft", {
      timeout: 45_000,
    });
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible({
      timeout: 30_000,
    });

    await page.goto(`${baseUrl}/projects/${projectSlug}/media`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByRole("heading", { name: "Media" })).toBeVisible({
      timeout: 30_000,
    });

    await page.goto(`${baseUrl}/projects/${projectSlug}/files`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByRole("heading", { level: 2, name: "Files" })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByText("seed").first().click();
    await expect(page.getByText("self-host-seed.txt")).toBeVisible({
      timeout: 30_000,
    });
  });
});
