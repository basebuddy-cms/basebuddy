import { describe, expect, it } from "vitest";

import {
  getContentPostCombinedContentHtml,
  getContentPrimaryEditorFieldId,
  type ContentPost,
} from "@/lib/content-runtime/shared";

const createPost = (overrides?: Partial<ContentPost>): ContentPost => ({
  authorId: null,
  categoryIds: [],
  contentFields: {},
  contentFormat: "html",
  contentHtml: "<p>Primary content</p>",
  contentJson: { type: "doc" },
  contentMarkdown: null,
  createdAt: "2026-03-25T00:00:00.000Z",
  customFields: {},
  excerpt: null,
  focusKeyword: null,
  featuredImageUrl: null,
  id: "post-1",
  publishedAt: null,
  redirects: [],
  seoDescription: null,
  seoTitle: null,
  slug: "post-1",
  status: "draft",
  tagIds: [],
  title: "Post 1",
  updatedAt: "2026-03-25T00:00:00.000Z",
  ...overrides,
});

describe("content post body helpers", () => {
  it("returns the first editor field id as the primary field", () => {
    expect(
      getContentPrimaryEditorFieldId([
        { id: "intro" },
        { id: "body" },
        { id: "outro" },
      ]),
    ).toBe("intro");

    expect(getContentPrimaryEditorFieldId([])).toBeNull();
  });

  it("combines content field html in editor field order", () => {
    expect(
      getContentPostCombinedContentHtml({
        editorFields: [{ id: "intro" }, { id: "body" }, { id: "outro" }],
        post: createPost({
          contentFields: {
            body: { contentHtml: "<p>Body</p>", contentJson: { type: "doc" } },
            intro: { contentHtml: "<p>Intro</p>", contentJson: { type: "doc" } },
            outro: { contentHtml: "<p>Outro</p>", contentJson: { type: "doc" } },
          },
        }),
      }),
    ).toBe("<p>Intro</p>\n<p>Body</p>\n<p>Outro</p>");
  });

  it("falls back to the primary post html when field values are unavailable", () => {
    expect(
      getContentPostCombinedContentHtml({
        editorFields: [{ id: "intro" }, { id: "body" }],
        post: createPost(),
      }),
    ).toBe("<p>Primary content</p>");
  });
});
