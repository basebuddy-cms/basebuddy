import { describe, expect, it } from "vitest";

import { createDefaultEditorDoc } from "@/lib/content-runtime/shared";
import { getResolvedPostEditorContentJson } from "@/lib/editor/post-editor-content-sync";

describe("post editor content sync", () => {
  it("preserves live editor json without re-canonicalizing it", () => {
    const contentJson = {
      content: [
        {
          attrs: { textAlign: null },
          content: [{ text: "/alpha ", type: "text" }],
          type: "paragraph",
        },
      ],
      type: "doc",
    } satisfies Record<string, unknown>;

    expect(getResolvedPostEditorContentJson(contentJson)).toBe(contentJson);
  });

  it("falls back to a default editor document for invalid content values", () => {
    expect(getResolvedPostEditorContentJson(null)).toEqual(createDefaultEditorDoc());
    expect(getResolvedPostEditorContentJson(["not", "a", "doc"])).toEqual(createDefaultEditorDoc());
  });
});
