import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client as PgClient } from "pg";

import { signInAsRole } from "./support/auth";
import {
  resolvePlaywrightSeedDatabaseUrl,
  resolvePlaywrightSeedRootCertificate,
  resolvePlaywrightSeedRootCertificateFile,
  shouldUsePlaywrightSeedDatabaseSsl,
} from "./support/seed-env";

const SEEDED_SELF_HOST_POST_ID = "20000000-0000-0000-0000-000000000501";
const SEEDED_SELF_HOST_POST_TITLE = "Self Host Assigned Draft";

const createContentDbClient = async () => {
  const connectionString = resolvePlaywrightSeedDatabaseUrl(process.env);

  if (!connectionString) {
    throw new Error("Missing required environment variable: BASEBUDDY_CONTENT_DATABASE_URL");
  }

  const inlineRootCertificate =
    resolvePlaywrightSeedRootCertificate(process.env)?.replace(/\\n/g, "\n").trim() ?? null;
  const rootCertificateFile = resolvePlaywrightSeedRootCertificateFile(process.env);
  const rootCertificate = inlineRootCertificate
    ? inlineRootCertificate
    : rootCertificateFile
      ? readFileSync(
          path.isAbsolute(rootCertificateFile)
            ? rootCertificateFile
            : path.join(process.cwd(), rootCertificateFile),
          "utf8",
        ).trim()
      : null;
  const client = new PgClient({
    connectionString,
    ssl: rootCertificate
      ? {
          ca: rootCertificate,
          rejectUnauthorized: true,
        }
      : shouldUsePlaywrightSeedDatabaseSsl(process.env, connectionString)
        ? {
            rejectUnauthorized: false,
          }
        : undefined,
  });

  await client.connect();
  return client;
};

const readSeedPostRow = async (client: PgClient) => {
  const result = await client.query<{
    published_at: string | null;
    slug: string;
    status: string;
    title: string;
  }>(
    `
      select title, slug, status, published_at::text
      from public.pw_self_host_posts
      where id = $1
    `,
    [SEEDED_SELF_HOST_POST_ID],
  );

  return result.rows[0] ?? null;
};

const restoreSeedPostRow = async (client: PgClient) => {
  await client.query(
    `
      update public.pw_self_host_posts
      set title = $1,
          status = 'draft',
          published_at = null
      where id = $2
    `,
    [SEEDED_SELF_HOST_POST_TITLE, SEEDED_SELF_HOST_POST_ID],
  );
};

const readSeedPostsColumns = async (client: PgClient) => {
  const result = await client.query<{ column_name: string }>(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'pw_self_host_posts'
      order by ordinal_position
    `,
  );

  return result.rows.map((row) => row.column_name);
};

const expectCorePostsListUi = async ({
  baseUrl,
  page,
  projectSlug,
}: {
  baseUrl: string;
  page: import("@playwright/test").Page;
  projectSlug: string;
}) => {
  await page.goto(`${baseUrl}/projects/${projectSlug}/posts`);

  await expect(page.getByRole("heading", { name: "Posts" })).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByRole("button", { name: "New Post" })).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByRole("columnheader", { name: "Status" })).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByRole("columnheader", { name: "Slug" })).toBeVisible({
    timeout: 45_000,
  });
};

test.describe("authenticated post flows", () => {
  test("owner sees the core posts-list and draft-editor chrome in the seeded self-host project", async ({ page }) => {
    const { baseUrl, projectSlug } = await signInAsRole(page, "owner");

    await expectCorePostsListUi({
      baseUrl,
      page,
      projectSlug,
    });

    await page.goto(`${baseUrl}/projects/${projectSlug}/posts/${SEEDED_SELF_HOST_POST_ID}`);

    await expect(page.getByRole("textbox", { name: "Post title" })).toHaveValue("Self Host Assigned Draft", {
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "Publish" })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("owner can open the seeded self-host draft post", async ({ page }) => {
    const { baseUrl, projectSlug } = await signInAsRole(page, "owner");

    await page.goto(`${baseUrl}/projects/${projectSlug}/posts/${SEEDED_SELF_HOST_POST_ID}`);

    await expect(page).toHaveURL(new RegExp(`/projects/${projectSlug}/posts/${SEEDED_SELF_HOST_POST_ID}$`));
    await expect(page.getByRole("textbox", { name: "Post title" })).toHaveValue("Self Host Assigned Draft", {
      timeout: 15_000,
    });
    await expect(page.getByText("Self-host assigned draft body.")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("owner can open the seeded self-host draft post from the posts list", async ({ page }) => {
    const { baseUrl, projectSlug } = await signInAsRole(page, "owner");

    await page.goto(`${baseUrl}/projects/${projectSlug}/posts`);

    await expect(page).toHaveURL(new RegExp(`/projects/${projectSlug}/posts$`));
    await expect(page.getByRole("heading", { name: "Posts" })).toBeVisible({
      timeout: 45_000,
    });
    const firstPostLink = page.locator("tbody tr").first().getByRole("link").first();
    await expect(firstPostLink).toBeVisible({
      timeout: 45_000,
    });

    const expectedPostPath = await firstPostLink.getAttribute("href");

    await firstPostLink.click();

    expect(expectedPostPath).toMatch(new RegExp(`^/projects/${projectSlug}/posts/`));
    await expect(page).toHaveURL(new RegExp(`${expectedPostPath?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), {
      timeout: 15_000,
    });
    await expect(page.getByRole("textbox", { name: "Post title" })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("owner keeps the self-host posts URL in sync when leaving the post editor", async ({ page }) => {
    const { baseUrl, projectSlug } = await signInAsRole(page, "owner");

    await page.goto(`${baseUrl}/projects/${projectSlug}/posts/${SEEDED_SELF_HOST_POST_ID}`);

    await expect(page).toHaveURL(new RegExp(`/projects/${projectSlug}/posts/${SEEDED_SELF_HOST_POST_ID}$`));
    await expect(page.getByRole("textbox", { name: "Post title" })).toHaveValue("Self Host Assigned Draft", {
      timeout: 15_000,
    });

    await page.getByRole("link", { name: "Posts" }).click();

    await expect(page).toHaveURL(new RegExp(`/projects/${projectSlug}/posts$`));
    await expect(page.getByRole("heading", { name: "Posts" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("textbox", { name: "Post title" })).toHaveCount(0);
  });

  test("owner sees mapped redirects in the seeded self-host draft editor", async ({ page }) => {
    const { baseUrl, projectSlug } = await signInAsRole(page, "owner");

    await page.goto(`${baseUrl}/projects/${projectSlug}/posts/${SEEDED_SELF_HOST_POST_ID}`);

    await expect(
      page.getByText(
        "Old slugs that should keep resolving to this post. This setup only supports a slug list.",
      ),
    ).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("legacy-self-host-draft")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("older-self-host-draft")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("textbox", { name: "Redirects" })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("owner saves dirty fields and runs explicit workflow actions against the content plane", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    const { baseUrl, seedState } = await signInAsRole(page, "owner");
    const projectId = seedState.projects.project.id;
    const client = await createContentDbClient();
    const savedTitle = `Self Host Dirty Save ${Date.now()}`;

    const postContentAction = async (action: Record<string, unknown>) =>
      page.evaluate(
        async ({ actionPayload, targetProjectId }) => {
          const response = await fetch(`/api/projects/${targetProjectId}/content`, {
            body: JSON.stringify(actionPayload),
            headers: {
              "Content-Type": "application/json",
            },
            method: "POST",
          });
          const payload = (await response.json()) as { error?: string };

          return {
            ok: response.ok,
            payload,
            status: response.status,
          };
        },
        {
          actionPayload: action,
          targetProjectId: projectId,
        },
      );

    try {
      await page.goto(`${baseUrl}/projects/${seedState.projects.project.slug}/posts`);

      const saveResponse = await postContentAction({
        action: "update_post",
        postId: SEEDED_SELF_HOST_POST_ID,
        title: savedTitle,
      });
      expect(saveResponse).toMatchObject({ ok: true, status: 200 });

      const savedRow = await readSeedPostRow(client);
      expect(savedRow).toMatchObject({
        slug: "self-host-assigned-draft",
        status: "draft",
        title: savedTitle,
      });

      const publishResponse = await postContentAction({
        action: "publish_post",
        postId: SEEDED_SELF_HOST_POST_ID,
      });
      expect(publishResponse).toMatchObject({ ok: true, status: 200 });

      const publishedRow = await readSeedPostRow(client);
      expect(publishedRow?.status).toBe("published");
      expect(publishedRow?.published_at).toEqual(expect.any(String));

      const unpublishResponse = await postContentAction({
        action: "unpublish_post",
        postId: SEEDED_SELF_HOST_POST_ID,
      });
      expect(unpublishResponse).toMatchObject({ ok: true, status: 200 });

      const unpublishedRow = await readSeedPostRow(client);
      expect(unpublishedRow).toMatchObject({
        published_at: null,
        status: "draft",
      });

      const archiveResponse = await postContentAction({
        action: "archive_post",
        postId: SEEDED_SELF_HOST_POST_ID,
      });
      expect(archiveResponse).toMatchObject({ ok: true, status: 200 });

      const archivedRow = await readSeedPostRow(client);
      expect(archivedRow?.status).toBe("archived");
      await expect(readSeedPostsColumns(client)).resolves.toEqual([
        "id",
        "author_id",
        "title",
        "slug",
        "status",
        "excerpt",
        "content_json",
        "content_html",
        "seo_title",
        "seo_description",
        "focus_keyword",
        "featured_image_url",
        "redirect_paths",
        "published_at",
        "created_at",
        "updated_at",
      ]);
    } finally {
      await restoreSeedPostRow(client);
      await client.end();
    }
  });
});
