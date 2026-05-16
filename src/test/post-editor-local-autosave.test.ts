import { beforeEach, describe, expect, it } from "vitest";

import type { ContentPost } from "@/lib/content-runtime/shared";
import {
  createPostEditorLocalAutosaveStorage,
  type PostEditorAutosavePayloadStore,
  type StoredLostPostDraftBackup,
  type StoredPostDraft,
} from "@/lib/editor/post-editor-local-autosave";

const createPost = (overrides?: Partial<ContentPost>): ContentPost => ({
  authorId: null,
  categoryIds: [],
  contentFields: {},
  contentFormat: "html",
  contentHtml: "<p>Hello world</p>",
  contentJson: {
    content: [],
    type: "doc",
  },
  contentMarkdown: null,
  createdAt: "2026-03-11T10:00:00.000Z",
  excerpt: null,
  focusKeyword: null,
  id: "post-1",
  featuredImageUrl: null,
  publishedAt: null,
  redirects: [],
  seoDescription: null,
  seoTitle: null,
  slug: "hello-world",
  status: "draft",
  tagIds: [],
  title: "Hello world",
  updatedAt: "2026-03-11T10:00:00.000Z",
  customFields: {},
  ...overrides,
});

const createStoredDraft = (overrides?: Partial<StoredPostDraft>): StoredPostDraft => ({
  isEditingPostSlug: false,
  persistedPost: createPost(),
  post: createPost({
    contentHtml: "<p>Updated draft</p>",
    contentJson: {
      content: [
        {
          content: [
            {
              text: "Updated draft",
              type: "text",
            },
          ],
          type: "paragraph",
        },
      ],
      type: "doc",
    },
    title: "Updated draft",
  }),
  postSlugDraft: "updated-draft",
  ...overrides,
});

const createLostDraftBackup = (
  overrides?: Partial<StoredLostPostDraftBackup>,
): StoredLostPostDraftBackup => ({
  backedUpAt: "2026-03-12T10:05:00.000Z",
  ...createStoredDraft(),
  ...overrides,
});

const createMemoryPayloadStore = () => {
  const payloads = new Map<string, unknown>();

  const store: PostEditorAutosavePayloadStore = {
    read: async <T,>(key: string) => (payloads.get(key) as T | undefined) ?? null,
    remove: async (key: string) => {
      payloads.delete(key);
    },
    write: async (key: string, value: unknown) => {
      payloads.set(key, value);
      return true;
    },
  };

  return {
    payloads,
    store,
  };
};

const createMemoryLocalStorage = () => {
  const entries = new Map<string, string>();

  return {
    getItem: (key: string) => entries.get(key) ?? null,
    removeItem: (key: string) => {
      entries.delete(key);
    },
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  };
};

describe("post editor local autosave storage", () => {
  let localStorage: ReturnType<typeof createMemoryLocalStorage>;

  beforeEach(() => {
    localStorage = createMemoryLocalStorage();
  });

  it("stores the heavy draft payload in the payload store and keeps only a pointer in localStorage", async () => {
    const { payloads, store } = createMemoryPayloadStore();
    const autosaveStorage = createPostEditorLocalAutosaveStorage("project-1", {
      localStorage,
      payloadStore: store,
    });
    const draft = createStoredDraft();

    await autosaveStorage.writeStoredPostDraft("post-1", draft);
    autosaveStorage.writeStoredPostDraftSession({
      postId: "post-1",
      sessionId: "session-1",
      state: "active",
      updatedAt: "2026-03-12T10:00:00.000Z",
    });

    expect(
      JSON.parse(localStorage.getItem("content-runtime:project-1:post-draft:post-1") ?? "null"),
    ).toMatchObject({
      payloadKey: "content-runtime:project-1:post-draft-payload:post-1",
      savedAt: expect.any(String),
      version: 1,
    });
    expect(payloads.get("content-runtime:project-1:post-draft-payload:post-1")).toEqual(draft);
    expect(autosaveStorage.readStoredPostDraftSession()).toEqual({
      postId: "post-1",
      sessionId: "session-1",
      state: "active",
      updatedAt: "2026-03-12T10:00:00.000Z",
    });
    await expect(autosaveStorage.readStoredPostDraft("post-1")).resolves.toEqual(draft);
  });

  it("clears the stored draft payload and session metadata", async () => {
    const { payloads, store } = createMemoryPayloadStore();
    const autosaveStorage = createPostEditorLocalAutosaveStorage("project-1", {
      localStorage,
      payloadStore: store,
    });

    await autosaveStorage.writeStoredPostDraft("post-1", createStoredDraft());
    autosaveStorage.writeStoredPostDraftSession({
      postId: "post-1",
      sessionId: "session-1",
      state: "recoverable",
      updatedAt: "2026-03-12T10:00:00.000Z",
    });
    await autosaveStorage.clearStoredPostDraftState("post-1");

    expect(localStorage.getItem("content-runtime:project-1:post-draft:post-1")).toBeNull();
    expect(localStorage.getItem("content-runtime:project-1:post-draft-session")).toBeNull();
    expect(payloads.has("content-runtime:project-1:post-draft-payload:post-1")).toBe(false);
  });

  it("migrates a legacy localStorage draft into the payload store when it is read", async () => {
    const { payloads, store } = createMemoryPayloadStore();
    const autosaveStorage = createPostEditorLocalAutosaveStorage("project-1", {
      localStorage,
      payloadStore: store,
    });
    const draft = createStoredDraft();

    localStorage.setItem("content-runtime:project-1:post-draft:post-1", JSON.stringify(draft));

    await expect(autosaveStorage.readStoredPostDraft("post-1")).resolves.toEqual(draft);
    expect(payloads.get("content-runtime:project-1:post-draft-payload:post-1")).toEqual(draft);
    expect(localStorage.getItem("content-runtime:project-1:post-draft:post-1")).toContain(
      "\"payloadKey\":\"content-runtime:project-1:post-draft-payload:post-1\"",
    );
  });

  it("falls back to localStorage when the payload store is unavailable", async () => {
    const autosaveStorage = createPostEditorLocalAutosaveStorage("project-1", {
      localStorage,
      payloadStore: {
        read: async () => null,
        remove: async () => undefined,
        write: async () => false,
      },
    });
    const draft = createStoredDraft();

    await autosaveStorage.writeStoredPostDraft("post-1", draft);

    expect(localStorage.getItem("content-runtime:project-1:post-draft:post-1")).toBe(
      JSON.stringify(draft),
    );
    await expect(autosaveStorage.readStoredPostDraft("post-1")).resolves.toEqual(draft);
  });

  it("treats legacy session metadata as a recoverable draft prompt target", () => {
    const autosaveStorage = createPostEditorLocalAutosaveStorage("project-1", {
      localStorage,
    });

    localStorage.setItem("content-runtime:project-1:post-draft-session", JSON.stringify({ postId: "post-1" }));

    expect(autosaveStorage.readStoredPostDraftSession()).toEqual({
      postId: "post-1",
      sessionId: null,
      state: "recoverable",
      updatedAt: "",
    });
  });

  it("can read and clear a preserved takeover backup separately from the ordinary recovery draft", async () => {
    const { payloads, store } = createMemoryPayloadStore();
    const autosaveStorage = createPostEditorLocalAutosaveStorage("project-1", {
      localStorage,
      payloadStore: store,
    });
    const backup = createLostDraftBackup();

    await autosaveStorage.writeLostPostDraftBackup("post-1", backup);

    await expect(autosaveStorage.readLostPostDraftBackup("post-1")).resolves.toEqual(backup);
    expect(payloads.get("content-runtime:project-1:post-takeover-backup-payload:post-1")).toEqual(backup);

    await autosaveStorage.clearLostPostDraftBackup("post-1");

    expect(localStorage.getItem("content-runtime:project-1:post-takeover-backup:post-1")).toBeNull();
    expect(payloads.has("content-runtime:project-1:post-takeover-backup-payload:post-1")).toBe(false);
  });

  it("can synchronously persist the latest recovery draft into localStorage for unload handling", async () => {
    const { store } = createMemoryPayloadStore();
    const autosaveStorage = createPostEditorLocalAutosaveStorage("project-1", {
      localStorage,
      payloadStore: store,
    });
    const draft = createStoredDraft({
      post: createPost({
        contentHtml: "<p>Typed just before closing</p>",
        title: "Typed just before closing",
      }),
      postSlugDraft: "typed-just-before-closing",
    });

    autosaveStorage.writeStoredPostDraftSync("post-1", draft);

    expect(localStorage.getItem("content-runtime:project-1:post-draft:post-1")).toBe(
      JSON.stringify(draft),
    );
    await expect(autosaveStorage.readStoredPostDraft("post-1")).resolves.toEqual(draft);
  });
});
