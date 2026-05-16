import type { PendingPostsDelete } from "@/components/editor/project-editor/types";
import type { ContentPost } from "@/lib/content-runtime/shared";

export const getSelectablePostIds = (posts: ContentPost[]) =>
  posts.filter((post) => post.canWrite !== false).map((post) => post.id);

export const getNextSelectedPostIds = ({
  checked,
  postId,
  posts,
  selectedPostIds,
}: {
  checked: boolean;
  postId: string;
  posts: ContentPost[];
  selectedPostIds: string[];
}) => {
  const targetPost = posts.find((post) => post.id === postId);

  if (!targetPost || targetPost.canWrite === false) {
    return selectedPostIds;
  }

  return checked
    ? Array.from(new Set([...selectedPostIds, postId]))
    : selectedPostIds.filter((value) => value !== postId);
};

export const getPendingPostsDeleteCandidate = ({
  formatPostTitle,
  postIds,
  posts,
}: {
  formatPostTitle: (title: string | null | undefined) => string;
  postIds: string[];
  posts: ContentPost[];
}): {
  pendingDelete: PendingPostsDelete | null;
  permissionDenied: boolean;
} => {
  const normalizedPostIds = Array.from(new Set(postIds.map((postId) => postId.trim()).filter(Boolean)));

  if (!normalizedPostIds.length) {
    return {
      pendingDelete: null,
      permissionDenied: false,
    };
  }

  const deletablePosts = posts.filter(
    (post) => normalizedPostIds.includes(post.id) && post.canWrite !== false,
  );

  if (deletablePosts.length !== normalizedPostIds.length) {
    return {
      pendingDelete: null,
      permissionDenied: true,
    };
  }

  return {
    pendingDelete: {
      ids: normalizedPostIds,
      label:
        normalizedPostIds.length === 1
          ? formatPostTitle(deletablePosts[0]?.title)
          : `${normalizedPostIds.length} selected posts`,
    },
    permissionDenied: false,
  };
};
