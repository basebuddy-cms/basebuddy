import { describe, expect, it } from "vitest";

import {
  createDefaultContentPostSidebarConfig,
  normalizeContentPostSidebarConfig,
} from "@/lib/content-runtime/shared";

describe("content runtime post sidebar config", () => {
  it("builds the default sidebar as distinct pages and fields", () => {
    const config = createDefaultContentPostSidebarConfig();

    expect(config.version).toBe(2);
    expect(config.nodes).toEqual([
      { id: "author", kind: "field", parentId: null, visible: true },
      { id: "published_at", kind: "field", parentId: null, visible: true },
      { id: "updated_at", kind: "field", parentId: null, visible: true },
      { id: "excerpt", kind: "field", parentId: null, visible: true },
      { id: "slug", kind: "field", parentId: null, visible: true },
      { id: "featured_image", kind: "field", parentId: null, visible: true },
      { id: "preview", kind: "field", parentId: null, visible: true },
      { id: "revisions", kind: "field", parentId: null, visible: true },
      { id: "categories", kind: "field", parentId: null, visible: true },
      { id: "tags", kind: "field", parentId: null, visible: true },
      { id: "seo-fields", kind: "page", label: "SEO Fields", parentId: null, visible: true },
      { id: "focus_keyword", kind: "field", parentId: "seo-fields", visible: true },
      { id: "seo_analysis", kind: "field", parentId: "seo-fields", visible: true },
      { id: "readability_analysis", kind: "field", parentId: "seo-fields", visible: true },
      { id: "meta-fields", kind: "page", label: "Meta Fields", parentId: null, visible: true },
      { id: "meta_title", kind: "field", parentId: "meta-fields", visible: true },
      { id: "meta_description", kind: "field", parentId: "meta-fields", visible: true },
    ]);
  });

  it("normalizes legacy pseudo-page configs into separate page and field nodes", () => {
    const config = normalizeContentPostSidebarConfig({
      items: [
        { key: "author", pageId: null, visible: true },
        { key: "seo", pageId: null, visible: true },
        { key: "meta", pageId: "seo-fields", visible: false },
      ],
      pages: [{ id: "seo-fields", label: "SEO Fields", visible: true }],
      rootEntries: [
        { key: "author", type: "field" },
        { pageId: "seo-fields", type: "page" },
      ],
      version: 1,
    });

    expect(config).toEqual({
      nodes: [
        { id: "author", kind: "field", parentId: null, visible: true },
        { id: "seo-fields", kind: "page", label: "SEO Fields", parentId: null, visible: true },
        { id: "meta-fields", kind: "page", label: "Meta Fields", parentId: "seo-fields", visible: false },
      ],
      version: 2,
    });
  });

  it("drops invalid parent loops when normalizing nested pages", () => {
    const config = normalizeContentPostSidebarConfig({
      nodes: [
        { id: "meta-fields", kind: "page", label: "Meta Fields", parentId: "seo-fields", visible: true },
        { id: "seo-fields", kind: "page", label: "SEO Fields", parentId: "meta-fields", visible: true },
        { id: "meta_title", kind: "field", parentId: "meta-fields", visible: true },
      ],
      version: 99,
    });

    expect(config).toEqual({
      nodes: [
        { id: "meta-fields", kind: "page", label: "Meta Fields", parentId: null, visible: true },
        { id: "seo-fields", kind: "page", label: "SEO Fields", parentId: "meta-fields", visible: true },
        { id: "meta_title", kind: "field", parentId: "meta-fields", visible: true },
      ],
      version: 2,
    });
  });
});
