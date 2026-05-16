import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePostEditorSession } from "@/hooks/use-post-editor-session";
import type { ContentPost } from "@/lib/content-runtime/shared";

const createPost = (overrides: Partial<ContentPost> = {}): ContentPost => ({
  authorId: null,
  categoryIds: [],
  contentFields: {},
  contentFormat: "html",
  contentHtml: "<p>Hello</p>",
  contentJson: {},
  contentMarkdown: null,
  createdAt: "2026-03-30T00:00:00.000Z",
  customFields: {},
  editorPayloadReady: true,
  excerpt: null,
  featuredImageUrl: null,
  focusKeyword: null,
  id: "post-1",
  publishedAt: null,
  redirects: [],
  seoDescription: null,
  seoTitle: null,
  slug: "hello-world",
  status: "draft",
  tagIds: [],
  title: "Hello World",
  updatedAt: "2026-03-30T00:00:00.000Z",
  ...overrides,
});

const getComparablePostState = (post: ContentPost) => ({
  authorId: post.authorId,
  categoryIds: post.categoryIds,
  contentFields: post.contentFields,
  contentFormat: post.contentFormat,
  contentHtml: post.contentHtml,
  contentJson: post.contentJson,
  contentMarkdown: post.contentMarkdown,
  customFields: post.customFields,
  excerpt: post.excerpt,
  featuredImageUrl: post.featuredImageUrl,
  focusKeyword: post.focusKeyword,
  publishedAt: post.publishedAt,
  redirects: post.redirects,
  seoDescription: post.seoDescription,
  seoTitle: post.seoTitle,
  slug: post.slug,
  status: post.status,
  tagIds: post.tagIds,
  title: post.title,
  updatedAt: post.updatedAt,
});

const createJsonResponse = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json",
    },
    status: 200,
  });

const createDeferredResponse = () => {
  let resolve: (response: Response) => void = () => {};

  return {
    promise: new Promise<Response>((resolvePromise) => {
      resolve = resolvePromise;
    }),
    resolve,
  };
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("post editor session lifecycle", () => {
  it("keeps edit access when the same post refreshes during an in-flight acquire", async () => {
    const initialPost = createPost();
    const refreshedPost = createPost({
      title: "Hello World (refreshed)",
      updatedAt: "2026-03-30T00:00:01.000Z",
    });
    const firstAcquire = createDeferredResponse();
    const secondAcquire = createDeferredResponse();
    const requests: Array<{ action?: string; postId?: string | null }> = [];
    let acquireCount = 0;
    const refreshPostsPresence = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body =
          typeof init?.body === "string"
            ? (JSON.parse(init.body) as { action?: string; postId?: string | null })
            : {};

        requests.push(body);

        if (body.action === "acquire_post_edit_session") {
          acquireCount += 1;
          return acquireCount === 1 ? firstAcquire.promise : secondAcquire.promise;
        }

        if (body.action === "release_post_edit_session") {
          return createJsonResponse({ success: true });
        }

        throw new Error(`Unexpected fetch action: ${body.action ?? "unknown"}`);
      }),
    );

    const { result, rerender } = renderHook(
      ({ posts }) =>
        usePostEditorSession({
          getComparablePostState,
          isContentReady: true,
          isSaving: false,
          pathname: "/projects/demo",
          posts,
          prepareForNavigationAwayFromPostEditor: vi.fn().mockResolvedValue(true),
          projectId: "project-1",
          refreshPostsPresence,
          routePostId: initialPost.id,
          searchParamsString: "",
          selectedCollection: "Posts",
          setPosts: vi.fn(),
        }),
      {
        initialProps: {
          posts: [initialPost],
        },
      },
    );

    await act(async () => {
      result.current.setLoadingSelectedPost(false);
    });

    await waitFor(() => {
      expect(requests.filter((request) => request.action === "acquire_post_edit_session")).toHaveLength(1);
    });

    rerender({
      posts: [refreshedPost],
    });

    await act(async () => {
      firstAcquire.resolve(
        createJsonResponse({
          acquired: true,
          blockingSession: null,
          takeover: false,
        }),
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.canEditCurrentPost).toBe(true);
    });

    expect(requests.filter((request) => request.action === "release_post_edit_session")).toHaveLength(0);

    if (acquireCount > 1) {
      await act(async () => {
        secondAcquire.resolve(
          createJsonResponse({
            acquired: true,
            blockingSession: null,
            takeover: false,
          }),
        );
      });
    }
  });

  it("keeps edit access through a transient heartbeat refresh failure", async () => {
    vi.useFakeTimers();

    const post = createPost();
    const refreshPostsPresence = vi.fn().mockResolvedValue(undefined);
    const onSessionError = vi.fn();
    let heartbeatCount = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body =
          typeof init?.body === "string"
            ? (JSON.parse(init.body) as { action?: string; postId?: string | null })
            : {};

        if (body.action === "acquire_post_edit_session") {
          return createJsonResponse({
            acquired: true,
            blockingSession: null,
            takeover: false,
          });
        }

        if (body.action === "heartbeat_post_edit_session") {
          heartbeatCount += 1;

          if (heartbeatCount === 1) {
            return new Response(
              JSON.stringify({
                error:
                  "The self-host install database is responding too slowly right now. Please wait a moment and try again.",
              }),
              {
                headers: {
                  "Content-Type": "application/json",
                },
                status: 503,
              },
            );
          }

          return createJsonResponse({
            active: true,
            blockingSession: null,
            takeover: false,
          });
        }

        if (body.action === "release_post_edit_session") {
          return createJsonResponse({ success: true });
        }

        throw new Error(`Unexpected fetch action: ${body.action ?? "unknown"}`);
      }),
    );

    const { result } = renderHook(() =>
      usePostEditorSession({
        getComparablePostState,
        isContentReady: true,
        isSaving: false,
        onSessionError,
        pathname: "/projects/demo",
        posts: [post],
        prepareForNavigationAwayFromPostEditor: vi.fn().mockResolvedValue(true),
        projectId: "project-1",
        refreshPostsPresence,
        routePostId: post.id,
        searchParamsString: "",
        selectedCollection: "Posts",
        setPosts: vi.fn(),
      }),
    );

    await act(async () => {
      result.current.setLoadingSelectedPost(false);
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.canEditCurrentPost).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(heartbeatCount).toBe(1);
    expect(result.current.canEditCurrentPost).toBe(true);
    expect(result.current.postEditCapability).toMatchObject({
      postId: post.id,
      state: "editable",
    });
    expect(result.current.readOnlyPostAccessState).toBeNull();
    expect(onSessionError).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(heartbeatCount).toBe(2);
    expect(result.current.canEditCurrentPost).toBe(true);
    expect(result.current.readOnlyPostAccessState).toBeNull();
    expect(onSessionError).not.toHaveBeenCalled();
  });

  it("switches to read-only after repeated heartbeat refresh failures", async () => {
    vi.useFakeTimers();

    const post = createPost();
    const refreshPostsPresence = vi.fn().mockResolvedValue(undefined);
    let heartbeatCount = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body =
          typeof init?.body === "string"
            ? (JSON.parse(init.body) as { action?: string; postId?: string | null })
            : {};

        if (body.action === "acquire_post_edit_session") {
          return createJsonResponse({
            acquired: true,
            blockingSession: null,
            takeover: false,
          });
        }

        if (body.action === "heartbeat_post_edit_session") {
          heartbeatCount += 1;

          return new Response(
            JSON.stringify({
              error:
                "The self-host install database is responding too slowly right now. Please wait a moment and try again.",
            }),
            {
              headers: {
                "Content-Type": "application/json",
              },
              status: 503,
            },
          );
        }

        if (body.action === "release_post_edit_session") {
          return createJsonResponse({ success: true });
        }

        throw new Error(`Unexpected fetch action: ${body.action ?? "unknown"}`);
      }),
    );

    const { result } = renderHook(() =>
      usePostEditorSession({
        getComparablePostState,
        isContentReady: true,
        isSaving: false,
        pathname: "/projects/demo",
        posts: [post],
        prepareForNavigationAwayFromPostEditor: vi.fn().mockResolvedValue(true),
        projectId: "project-1",
        refreshPostsPresence,
        routePostId: post.id,
        searchParamsString: "",
        selectedCollection: "Posts",
        setPosts: vi.fn(),
      }),
    );

    await act(async () => {
      result.current.setLoadingSelectedPost(false);
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.canEditCurrentPost).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
      await vi.advanceTimersByTimeAsync(2_000);
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(heartbeatCount).toBeGreaterThanOrEqual(3);
    expect(result.current.postEditCapability).toMatchObject({
      postId: post.id,
      reason: "refresh_failed",
      state: "read_only",
    });
    expect(result.current.readOnlyPostAccessState?.message).toContain("Retry to continue editing.");
  });
});
