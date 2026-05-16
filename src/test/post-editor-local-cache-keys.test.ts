import { describe, expect, it } from "vitest";

import {
  getPostEditorDraftPayloadStorageKey,
  getPostEditorDraftSessionStorageKey,
  getPostEditorDraftStorageKey,
  getPostEditorFocusKeywordStorageKey,
  getPostEditorPreviewStorageKey,
  getPostEditorPreviewStoragePrefix,
  getPostEditorTakeoverBackupPayloadStorageKey,
  getPostEditorTakeoverBackupStorageKey,
} from "@/lib/editor/post-editor-local-cache-keys";

describe("post editor local cache keys", () => {
  it("builds the autosave draft and takeover keys from one shared contract", () => {
    expect(getPostEditorDraftStorageKey("project-1", "post-1")).toBe(
      "content-runtime:project-1:post-draft:post-1",
    );
    expect(getPostEditorDraftPayloadStorageKey("project-1", "post-1")).toBe(
      "content-runtime:project-1:post-draft-payload:post-1",
    );
    expect(getPostEditorDraftSessionStorageKey("project-1")).toBe(
      "content-runtime:project-1:post-draft-session",
    );
    expect(getPostEditorTakeoverBackupStorageKey("project-1", "post-1")).toBe(
      "content-runtime:project-1:post-takeover-backup:post-1",
    );
    expect(getPostEditorTakeoverBackupPayloadStorageKey("project-1", "post-1")).toBe(
      "content-runtime:project-1:post-takeover-backup-payload:post-1",
    );
  });

  it("builds the per-project seo focus keyword key", () => {
    expect(getPostEditorFocusKeywordStorageKey("project-1", "post-1")).toBe(
      "content-runtime:project-1:seo-focus-keyword:post-1",
    );
  });

  it("builds preview keys from one shared preview prefix", () => {
    expect(getPostEditorPreviewStoragePrefix()).toBe("content-runtime:post-preview:");
    expect(getPostEditorPreviewStorageKey("token-1")).toBe("content-runtime:post-preview:token-1");
  });
});
