import { describe, expect, it } from "vitest";

import { createPostEditorLocalSeoStorage } from "@/lib/editor/post-editor-local-seo";

const createStorage = () => {
  const values = new Map<string, string>();

  return {
    getItem(key: string) {
      return values.has(key) ? values.get(key)! : null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
};

describe("post editor local seo storage", () => {
  it("stores and reads a focus keyword per post", () => {
    const storage = createStorage();
    const seoStorage = createPostEditorLocalSeoStorage("project-1", storage);

    seoStorage.writeFocusKeyword("post-1", " headless cms ");

    expect(seoStorage.readFocusKeyword("post-1")).toBe("headless cms");
    expect(seoStorage.readFocusKeyword("post-2")).toBeNull();
  });

  it("clears empty values", () => {
    const storage = createStorage();
    const seoStorage = createPostEditorLocalSeoStorage("project-1", storage);

    seoStorage.writeFocusKeyword("post-1", "headless cms");
    seoStorage.writeFocusKeyword("post-1", "   ");

    expect(seoStorage.readFocusKeyword("post-1")).toBeNull();
  });
});
