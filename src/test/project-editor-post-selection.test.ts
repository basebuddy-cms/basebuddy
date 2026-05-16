import { describe, expect, it } from "vitest";

import {
  getNextSelectedPostIds,
  getPendingPostsDeleteCandidate,
  getSelectablePostIds,
} from "@/components/editor/project-editor/post-selection";
import type { ContentPost } from "@/lib/content-runtime/shared";

const createPost = ({
  canWrite = true,
  id,
  title = "Untitled",
}: {
  canWrite?: boolean;
  id: string;
  title?: string;
}) => ({
  canWrite,
  id,
  title,
}) as ContentPost;

describe("project editor post selection helpers", () => {
  it("selects only writable posts and preserves existing unique selections", () => {
    const posts = [
      createPost({ id: "post-1" }),
      createPost({ canWrite: false, id: "post-2" }),
    ];

    expect(
      getNextSelectedPostIds({
        checked: true,
        postId: "post-1",
        posts,
        selectedPostIds: ["post-1"],
      }),
    ).toEqual(["post-1"]);
    expect(
      getNextSelectedPostIds({
        checked: true,
        postId: "post-2",
        posts,
        selectedPostIds: ["post-1"],
      }),
    ).toEqual(["post-1"]);
    expect(getSelectablePostIds(posts)).toEqual(["post-1"]);
  });

  it("builds a pending delete candidate only when every requested post is writable", () => {
    const posts = [
      createPost({ id: "post-1", title: "Hello" }),
      createPost({ canWrite: false, id: "post-2", title: "Locked" }),
    ];

    expect(
      getPendingPostsDeleteCandidate({
        formatPostTitle: (title) => title?.trim() || "Untitled",
        postIds: ["post-1", "post-1", " "],
        posts,
      }),
    ).toEqual({
      pendingDelete: {
        ids: ["post-1"],
        label: "Hello",
      },
      permissionDenied: false,
    });
    expect(
      getPendingPostsDeleteCandidate({
        formatPostTitle: (title) => title?.trim() || "Untitled",
        postIds: ["post-1", "post-2"],
        posts,
      }),
    ).toEqual({
      pendingDelete: null,
      permissionDenied: true,
    });
  });
});
