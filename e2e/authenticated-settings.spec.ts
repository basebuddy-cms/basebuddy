import { expect, test } from "@playwright/test";

import { signInAsRole } from "./support/auth";

test.describe("authenticated settings flows", () => {
  test("owner can review project permissions for the self-host project", async ({ page }) => {
    const { baseUrl, projectSlug, seedState } = await signInAsRole(page, "owner");

    await page.goto(`${baseUrl}/projects/${projectSlug}/settings?tab=permissions`);

    await expect(page).toHaveURL(/\/settings\?tab=permissions$/);
    await expect(page.getByRole("heading", { level: 2, name: "Settings" })).toBeVisible();
    await expect(
      page.getByRole("main").getByText(
        "Manage project details, members, invitations, permissions, content mapping, and editor sidebar behavior.",
      ).first(),
    ).toBeVisible();
    await expect(page.getByText(seedState.users.owner.email)).toBeVisible();
    await expect(page.getByText(seedState.users.admin.email)).toBeVisible();
    await expect(page.getByText(seedState.users.editor.email)).toBeVisible();
    await expect(page.getByText(seedState.users.author.email)).toBeVisible();
    await expect(page.getByText(seedState.users.viewer.email)).toBeVisible();
  });

  test("admin can review project members for the self-host project", async ({ page }) => {
    const { baseUrl, projectSlug, seedState } = await signInAsRole(page, "admin");

    await page.goto(`${baseUrl}/projects/${projectSlug}/settings?tab=members`);

    await expect(page).toHaveURL(/\/settings\?tab=members$/);
    await expect(page.getByText("Loading members...")).toHaveCount(0, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Current members" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(seedState.users.owner.email)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(seedState.users.viewer.email)).toBeVisible({ timeout: 15000 });
  });

  test("owner can create and revoke a project member invite", async ({ page }) => {
    const { baseUrl, projectSlug } = await signInAsRole(page, "owner");
    const invitedEmail = `pw-invite-${Date.now()}@basebuddy.test`;

    await page.goto(`${baseUrl}/projects/${projectSlug}/settings?tab=invite-members`);

    await expect(page).toHaveURL(/\/settings\?tab=invite-members$/);
    await expect(page.getByRole("heading", { name: "Create invite link" })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByLabel("Email").fill(invitedEmail);
    await page.getByRole("button", { name: "Create invite link" }).click();

    const inviteRow = page.getByRole("row").filter({ hasText: invitedEmail });
    await expect(inviteRow).toBeVisible({ timeout: 15_000 });
    await expect(inviteRow.getByText("viewer")).toBeVisible();

    await inviteRow.getByRole("button", { name: "Revoke" }).click();
    await expect(inviteRow).toHaveCount(0, { timeout: 15_000 });
  });

  test("editor stays on the restricted general settings view", async ({ page }) => {
    const { baseUrl, projectSlug } = await signInAsRole(page, "editor");

    await page.goto(`${baseUrl}/projects/${projectSlug}/settings?tab=permissions`);

    await expect(page).toHaveURL(/\/settings\?tab=general$/);
    await expect(
      page.getByRole("main").getByText(
        "Manage project details, members, invitations, permissions, content mapping, and editor sidebar behavior.",
      ).first(),
    ).toBeVisible();
    await expect(page.getByText("Only project owners and admins can update these settings.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Members" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Permissions" })).toHaveCount(0);
  });

  test("owner can open posts mapping from settings", async ({ page }) => {
    test.setTimeout(90_000);

    const { baseUrl, projectSlug } = await signInAsRole(page, "owner");

    await page.goto(`${baseUrl}/projects/${projectSlug}/settings?tab=mapping`);

    await expect(page).toHaveURL(/\/settings\?tab=mapping$/);
    await expect(page.getByRole("main").getByText("Content Mapping").first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: "Open Posts mapping" })).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole("button", { name: "Open Posts mapping" }).click();
    const mappingDialog = page.getByRole("dialog", { name: "Connect BaseBuddy to your content" });
    await expect(mappingDialog.getByRole("heading", { name: "Connect BaseBuddy to your content" })).toBeVisible({
      timeout: 15000,
    });
    await expect(mappingDialog.getByRole("heading", { name: "Choose Posts Source" })).toBeVisible({ timeout: 45_000 });
  });
});
