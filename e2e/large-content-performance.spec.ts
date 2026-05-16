import { expect, test } from "@playwright/test";

import { signInAsRole } from "./support/auth";

const loadTestProjectId = process.env.BASEBUDDY_LOAD_TEST_PROJECT_ID?.trim() ?? "";
const loadTestProjectSlug = process.env.BASEBUDDY_LOAD_TEST_PROJECT_SLUG?.trim() ?? "";
const hasLoadTestTarget = Boolean(loadTestProjectId && loadTestProjectSlug);

test.describe("large content performance smoke", () => {
  test.skip(!hasLoadTestTarget, "Set BASEBUDDY_LOAD_TEST_PROJECT_ID and BASEBUDDY_LOAD_TEST_PROJECT_SLUG to run large content browser smoke checks.");

  test("browser session can search large relation options from the editor", async ({ page }) => {
    await signInAsRole(page, "owner");

    const result = await page.evaluate(async ({ projectId }) => {
      const measure = async () => {
        const startedAt = performance.now();
        const response = await fetch(
          `/api/projects/${projectId}/content?view=relation_options&fieldKey=categories&search=Category%20499999&limit=20`,
          {
            cache: "no-store",
          },
        );
        const options = await response.json();

        return {
          durationMs: Math.round(performance.now() - startedAt),
          optionCount: Array.isArray(options) ? options.length : 0,
          status: response.status,
        };
      };

      await measure();
      const startedAt = performance.now();
      const response = await fetch(
        `/api/projects/${projectId}/content?view=relation_options&fieldKey=categories&search=Category%20499999&limit=20`,
        {
          cache: "no-store",
        },
      );
      const options = await response.json();

      return {
        durationMs: Math.round(performance.now() - startedAt),
        optionCount: Array.isArray(options) ? options.length : 0,
        status: response.status,
      };
    }, {
      projectId: loadTestProjectId,
    });

    expect(result.status).toBe(200);
    expect(result.optionCount).toBeGreaterThan(0);
    expect(result.optionCount).toBeLessThanOrEqual(20);
    expect(result.durationMs).toBeLessThanOrEqual(1_500);
  });

  test("browser session can open large media and files libraries without full scans", async ({ page }) => {
    const { baseUrl } = await signInAsRole(page, "owner");

    await page.goto(`${baseUrl}/projects/${loadTestProjectSlug}/media`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByRole("heading", { name: "Media" })).toBeVisible({
      timeout: 45_000,
    });

    const result = await page.evaluate(async ({ projectId }) => {
      const measure = async (path: string) => {
        const startedAt = performance.now();
        const response = await fetch(path, {
          cache: "no-store",
        });
        const payload = await response.json();

        return {
          durationMs: Math.round(performance.now() - startedAt),
          itemCount: Array.isArray(payload?.items) ? payload.items.length : 0,
          status: response.status,
        };
      };
      const mediaPath = `/api/projects/${projectId}/media?includeFolderOptions=false&path=folder-0099`;
      const filesPath = `/api/projects/${projectId}/files?includeFolderOptions=false&path=folder-0099`;

      return {
        files: await measure(filesPath),
        filesCached: await measure(filesPath),
        media: await measure(mediaPath),
        mediaCached: await measure(mediaPath),
      };
    }, {
      projectId: loadTestProjectId,
    });

    expect(result.media.status).toBe(200);
    expect(result.files.status).toBe(200);
    expect(result.media.itemCount).toBeLessThanOrEqual(250);
    expect(result.files.itemCount).toBeLessThanOrEqual(250);
    expect(result.media.durationMs).toBeLessThanOrEqual(10_000);
    expect(result.files.durationMs).toBeLessThanOrEqual(10_000);
    expect(result.mediaCached.durationMs).toBeLessThanOrEqual(600);
    expect(result.filesCached.durationMs).toBeLessThanOrEqual(600);
  });
});
