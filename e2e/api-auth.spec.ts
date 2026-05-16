import { expect, test } from "@playwright/test";

test.describe("unauthenticated API access", () => {
  test("rejects slug availability checks without a session", async ({ request }) => {
    const response = await request.get("/api/projects/slug-availability?slug=playwright-project");
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({
      error: "Please sign in to continue.",
    });
  });

  test("rejects profile updates without a session", async ({ request }) => {
    const response = await request.fetch("/api/profile", {
      method: "PATCH",
      multipart: {
        name: "Playwright User",
      },
    });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({
      error: "Please sign in to continue.",
    });
  });

  test("rejects self-host project creation without a session", async ({ request }) => {
    const response = await request.post("/api/projects", {
      data: {
        projectName: "Playwright Project",
        projectSlug: "playwright-project",
      },
    });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({
      error: "Please sign in to continue.",
    });
  });

  test("rejects content workspace reads without a session", async ({ request }) => {
    const response = await request.get("/api/projects/playwright-project/content?view=workspace");
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({
      error: "Please sign in to continue.",
    });
  });

  test("rejects media library reads without a session", async ({ request }) => {
    const response = await request.get("/api/projects/playwright-project/media");
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({
      error: "Please sign in to continue.",
    });
  });
});
