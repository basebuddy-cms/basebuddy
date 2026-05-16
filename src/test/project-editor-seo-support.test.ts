import { describe, expect, it } from "vitest";

import {
  filterProjectEditorYoastSeoResults,
  getProjectEditorSeoCapabilities,
  mergePostWithLocalFocusKeyword,
} from "@/components/editor/project-editor/seo-support";
import type {
  ProjectEditorPostFieldStates,
  YoastResult,
} from "@/components/editor/project-editor/types";
import type { ContentPost } from "@/lib/content-runtime/shared";

const createPostFieldStates = (
  overrides?: Partial<ProjectEditorPostFieldStates>,
): ProjectEditorPostFieldStates => ({
  excerpt: { editable: false, mapped: false, visible: false },
  focusKeyword: { editable: false, mapped: false, visible: false },
  seoDescription: { editable: false, mapped: false, visible: false },
  seoTitle: { editable: false, mapped: false, visible: false },
  slug: { editable: false, mapped: false, visible: false },
  status: { editable: true, mapped: true, visible: true },
  title: { editable: false, mapped: false, visible: false },
  ...overrides,
});

const createPost = (overrides?: Partial<ContentPost>): ContentPost => ({
  authorId: null,
  categoryIds: [],
  contentFields: {},
  contentFormat: "html",
  contentHtml: "<p>Hello world</p>",
  contentJson: {},
  contentMarkdown: null,
  createdAt: "2026-03-24T00:00:00.000Z",
  customFields: {},
  excerpt: null,
  focusKeyword: null,
  featuredImageUrl: null,
  id: "post-1",
  publishedAt: null,
  redirects: [],
  seoDescription: null,
  seoTitle: null,
  slug: "hello-world",
  status: "draft",
  tagIds: [],
  title: "",
  updatedAt: "2026-03-24T00:00:00.000Z",
  ...overrides,
});

describe("project editor seo support", () => {
  it("filters out checks that are not actionable for a minimal schema", () => {
    const capabilities = getProjectEditorSeoCapabilities({
      hasWebsiteUrl: false,
      postFieldStates: createPostFieldStates(),
    });
    const results: YoastResult[] = [
      { id: "internalLinks", score: 3, text: "Internal links" },
      { id: "externalLinks", score: 3, text: "External links" },
      { id: "titleWidth", score: 3, text: "Title width" },
      { id: "metaDescriptionLength", score: 3, text: "Meta description" },
      { id: "slugKeyword", score: 3, text: "Slug keyword" },
      { id: "textLength", score: 9, text: "Text length" },
    ];

    expect(filterProjectEditorYoastSeoResults({ capabilities, results })).toEqual([
      { id: "textLength", score: 9, text: "Text length" },
    ]);
  });

  it("keeps title and description checks when fallback fields exist", () => {
    const capabilities = getProjectEditorSeoCapabilities({
      hasWebsiteUrl: true,
      postFieldStates: createPostFieldStates({
        excerpt: { editable: true, mapped: true, visible: true },
        slug: { editable: true, mapped: true, visible: true },
        title: { editable: true, mapped: true, visible: true },
      }),
    });
    const results: YoastResult[] = [
      { id: "titleWidth", score: 9, text: "Title width" },
      { id: "metaDescriptionLength", score: 9, text: "Meta description" },
      { id: "slugKeyword", score: 9, text: "Slug keyword" },
      { id: "internalLinks", score: 9, text: "Internal links" },
    ];

    expect(filterProjectEditorYoastSeoResults({ capabilities, results })).toEqual(results);
  });

  it("merges a local focus keyword only when the server post does not already have one", () => {
    expect(
      mergePostWithLocalFocusKeyword({
        focusKeyword: "headless cms",
        post: createPost(),
      }).focusKeyword,
    ).toBe("headless cms");

    expect(
      mergePostWithLocalFocusKeyword({
        focusKeyword: "headless cms",
        post: createPost({ focusKeyword: "database value" }),
      }).focusKeyword,
    ).toBe("database value");
  });
});
