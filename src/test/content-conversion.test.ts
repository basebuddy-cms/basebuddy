import { describe, expect, it } from "vitest";

import {
  normalizeContentRuntimeContent,
  normalizeContentRuntimePostContentFieldValue,
  normalizeContentRuntimePostForEditor,
} from "@/lib/content-runtime/content-conversion";
import type { ContentPost } from "@/lib/content-runtime/shared";

const createPost = (overrides?: Partial<ContentPost>): ContentPost => ({
  authorId: null,
  categoryIds: [],
  contentFields: {},
  contentFormat: "html",
  contentHtml: "<p>Primary body</p>",
  contentJson: {
    content: [{ type: "paragraph" }],
    type: "doc",
  },
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

describe("content conversion", () => {
  it("builds editor content from markdown", () => {
    const normalized = normalizeContentRuntimeContent({
      contentMarkdown: "# Hello\n\nThis is **markdown**.",
      primaryContentFormat: "markdown",
    });

    expect(normalized.contentHtml).toContain("<h1>Hello</h1>");
    expect(normalized.contentMarkdown).toContain("**markdown**");
    expect(normalized.contentJson).toMatchObject({
      type: "doc",
    });
  });

  it("builds markdown from html", () => {
    const normalized = normalizeContentRuntimeContent({
      contentHtml: "<h2>Title</h2><p>A paragraph with <strong>bold</strong>.</p>",
      primaryContentFormat: "html",
    });

    expect(normalized.contentHtml).toContain("<h2>Title</h2>");
    expect(normalized.contentMarkdown).toContain("## Title");
    expect(normalized.contentMarkdown).toContain("**bold**");
  });

  it("treats editor json as the source of truth when it is present", () => {
    const normalized = normalizeContentRuntimeContent({
      contentHtml: "<p>stale html</p>",
      contentJson: {
        content: [
          {
            attrs: { level: 2 },
            content: [{ text: "Canonical Title", type: "text" }],
            type: "heading",
          },
        ],
        type: "doc",
      },
      contentMarkdown: "stale markdown",
      primaryContentFormat: "markdown",
    });

    expect(normalized.contentHtml).toContain("Canonical Title");
    expect(normalized.contentMarkdown).toContain("## Canonical Title");
    expect(normalized.contentHtml).not.toContain("stale html");
    expect(normalized.contentMarkdown).not.toContain("stale markdown");
  });

  it("sanitizes unsafe html when normalizing content", () => {
    const normalized = normalizeContentRuntimeContent({
      contentHtml:
        '<p>Hello</p><script>alert("xss")</script><p><a href="javascript:alert(1)">bad</a></p>',
      primaryContentFormat: "html",
    });

    expect(normalized.contentHtml).toContain("<p>Hello</p>");
    expect(normalized.contentHtml).not.toContain("<script");
    expect(normalized.contentHtml).not.toContain("javascript:alert");
  });

  it("does not allow raw html from markdown to render as html", () => {
    const normalized = normalizeContentRuntimeContent({
      contentMarkdown: 'Hello\n\n<script>alert("xss")</script>\n\n<div>unsafe</div>',
      primaryContentFormat: "markdown",
    });

    expect(normalized.contentHtml).toContain("<p>Hello</p>");
    expect(normalized.contentHtml).not.toContain("<script");
    expect(normalized.contentHtml).not.toContain("<div>unsafe</div>");
  });

  it("normalizes malformed content field values into canonical editor content", () => {
    const normalized = normalizeContentRuntimePostContentFieldValue({
      contentHtml: "<p>Legacy body</p>",
      contentJson: ["not", "a", "doc"] as unknown as Record<string, unknown>,
    });

    expect(normalized.contentHtml).toBe("<p>Legacy body</p>");
    expect(normalized.contentJson).toMatchObject({
      type: "doc",
    });
  });

  it("hydrates a missing primary mapped field from the canonical post body", () => {
    const normalized = normalizeContentRuntimePostForEditor({
      editorFields: [{ id: "content" }, { id: "sidebar" }],
      post: {
        ...createPost({
          contentHtml: "<p>Recovered primary body</p>",
          contentJson: null as unknown as Record<string, unknown>,
        }),
        contentFields: undefined as unknown as Record<string, { contentHtml: string; contentJson: Record<string, unknown> }>,
      },
    });

    expect(normalized.contentFields.content).toMatchObject({
      contentHtml: "<p>Recovered primary body</p>",
    });
    expect(normalized.contentJson).toMatchObject({
      type: "doc",
    });
  });
});
