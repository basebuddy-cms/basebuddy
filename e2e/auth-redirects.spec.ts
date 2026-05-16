import { expect, test } from "@playwright/test";

const protectedRoutes = [
  "/projects",
  "/settings/profile",
  "/projects/demo-project",
  "/projects/demo-project/posts",
  "/projects/demo-project/media",
  "/projects/demo-project/settings",
];

test("keeps setup onboarding available before sign-in", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("heading", { level: 1, name: /BaseBuddy setup|Setup summary/ })).toBeVisible();
});

test.describe("auth-gated routes", () => {
  for (const route of protectedRoutes) {
    test(`redirects signed-out users from ${route} to login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("heading", { level: 1, name: "Welcome back" })).toBeVisible();
    });
  }
});
