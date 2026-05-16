import { expect, test } from "@playwright/test";

const previewToken = "playwright-preview-token";
const previewStorageKey = `content-runtime:post-preview:${previewToken}`;

test.describe("public pages", () => {
  test("routes signed-out users from the app root to login", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { level: 1, name: "Welcome back" })).toBeVisible();
  });

  test("renders the login page with all sign-in options", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { level: 1, name: "Welcome back" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with GitHub" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
    await expect(page.getByRole("button", { name: "Email me a Sign-In Link" })).toBeVisible();
  });

  test("shows client-side validation when email sign-in is empty", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Email me a Sign-In Link" }).click();
    await expect(page.getByText("Enter an email address first.")).toBeVisible();
  });

  test("shows the auth callback error toast on the login page", async ({ page }) => {
    await page.goto("/login?error=auth_callback_error");
    await expect(page.getByText("Could not complete sign-in.")).toBeVisible();
  });

  test("shows the email confirmation error toast on the login page", async ({ page }) => {
    await page.goto("/login?error=email_confirm_error");
    await expect(page.getByText("Could not verify the email sign-in link.")).toBeVisible();
  });

  test("renders the 404 page for an unknown route", async ({ page }) => {
    await page.goto("/this-route-should-not-exist");
    await expect(page.getByRole("heading", { level: 1, name: "404" })).toBeVisible();
    await expect(page.getByText("This page doesn't exist")).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to home" })).toBeVisible();
  });
});

test.describe("content preview", () => {
  test("shows the unavailable state without a preview token", async ({ page }) => {
    await page.goto("/content-preview");
    await expect(page.getByRole("heading", { level: 1, name: "Preview unavailable" })).toBeVisible();
    await expect(page.getByText("This preview has expired. Open it again from the editor.")).toBeVisible();
  });

  test("shows the unavailable state for a missing preview snapshot", async ({ page }) => {
    await page.goto("/content-preview?token=missing-preview-token");
    await expect(page.getByRole("heading", { level: 1, name: "Preview unavailable" })).toBeVisible();
  });

  test("renders a stored preview snapshot from browser storage", async ({ page }) => {
    const now = new Date().toISOString();
    const previewSnapshot = {
      hasUnsavedChanges: true,
      post: {
        authorId: null,
        categoryIds: [],
        contentFormat: "html",
        contentHtml: "<p>Playwright preview body</p><p><strong>Rendered from local storage.</strong></p>",
        contentJson: {},
        contentMarkdown: null,
        createdAt: now,
        customFields: {},
        excerpt: "A short preview excerpt",
        focusKeyword: null,
        featuredImageUrl: null,
        id: "post-preview-1",
        publishedAt: null,
        seoDescription: null,
        seoTitle: null,
        slug: "playwright-preview",
        status: "draft",
        tagIds: [],
        title: "Playwright Preview Title",
        updatedAt: now,
      },
      previewedAt: now,
      projectName: "Preview Project",
      projectSlug: "preview-project",
      version: 1,
    };

    await page.addInitScript(
      ({ key, value }) => {
        window.localStorage.setItem(key, value);
      },
      {
        key: previewStorageKey,
        value: JSON.stringify(previewSnapshot),
      },
    );

    await page.goto(`/content-preview?token=${previewToken}`);

    await expect(page.getByRole("heading", { level: 1, name: "Playwright Preview Title" })).toBeVisible();
    await expect(page.getByText("A short preview excerpt")).toBeVisible();
    await expect(page.getByText("Unsaved changes included")).toBeVisible();
    await expect(page.getByText("Playwright preview body")).toBeVisible();
    await expect(page.getByText("Rendered from local storage.")).toBeVisible();
    await expect(page.getByText("/preview-project/playwright-preview")).toBeVisible();
  });
});
