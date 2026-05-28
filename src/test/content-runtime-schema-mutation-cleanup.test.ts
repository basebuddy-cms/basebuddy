import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  };
});

import { getContentPostById } from "@/lib/content-runtime/server-posts-shared";
import { insertPostRevision } from "@/lib/content-runtime/server-post-revisions";
import type { ContentPost } from "@/lib/content-runtime/shared";

const createClientThatRejectsSchemaMutation = () => {
  const query = vi.fn(async (sql: string) => {
    const hiddenMutationPattern = new RegExp(
      [
        ["alter", "table"].join(" "),
        ["add", "column", "if", "not", "exists"].join(" "),
        "information_schema\\.columns",
      ].join("|"),
      "i",
    );

    expect(sql).not.toMatch(hiddenMutationPattern);

    if (/max\(revision_number\)/i.test(sql)) {
      return {
        rows: [
          {
            next_revision: 1,
          },
        ],
      };
    }

    if (/insert into/i.test(sql)) {
      return {
        rows: [],
      };
    }

    return {
      rows: [
        {
          author_id: null,
          category_ids: [],
          content_format: "markdown",
          content_html: "<p>Hello</p>",
          content_json: {},
          content_markdown: "Hello",
          created_at: "2026-05-27T00:00:00.000Z",
          excerpt: null,
          featured_image_url: null,
          focus_keyword: null,
          id: "post-1",
          published_at: null,
          seo_description: null,
          seo_title: null,
          slug: "hello",
          status: "draft",
          tag_ids: [],
          title: "Hello",
          updated_at: "2026-05-27T00:00:00.000Z",
        },
      ],
    };
  });

  return {
    client: {
      query,
    },
    query,
  };
};

describe("content runtime schema mutation cleanup", () => {
  it("does not repair generated content tables while reading or writing runtime posts", async () => {
    const { client, query } = createClientThatRejectsSchemaMutation();

    const post = await getContentPostById({
      client: client as never,
      postId: "post-1",
      projectSlug: "demo",
      schemaVersion: 9,
    });

    await insertPostRevision({
      client: client as never,
      post: {
        ...post,
        customFields: {},
      } satisfies ContentPost,
      projectSlug: "demo",
      schemaVersion: 9,
      user: {
        avatarUrl: null,
        email: "owner@example.com",
        id: "user-1",
        name: "Owner",
      },
    });

    expect(query).toHaveBeenCalled();
  });
});
