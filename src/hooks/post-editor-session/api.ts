import type { ContentPost } from "@/lib/content-runtime/shared";

import type { PostEditSessionResponse } from "@/hooks/post-editor-session/types";
import { createRequestError, getPostTitle } from "@/hooks/post-editor-session/utils";

type ReleasePostEditSessionRequestOptions = {
  keepalive?: boolean;
};

export const releasePostEditSessionRequest = async (
  projectId: string,
  postId?: string | null,
  options?: ReleasePostEditSessionRequestOptions,
) => {
  await fetch(`/api/projects/${projectId}/content`, {
    body: JSON.stringify({
      action: "release_post_edit_session",
      postId: postId ?? null,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    keepalive: options?.keepalive ?? false,
    method: "POST",
  });
};

export const fetchAcquirePostEditSessionRequest = async ({
  force = false,
  post,
  projectId,
}: {
  force?: boolean;
  post: ContentPost;
  projectId: string;
}) => {
  let response: Response;

  try {
    response = await fetch(`/api/projects/${projectId}/content`, {
      body: JSON.stringify({
        action: "acquire_post_edit_session",
        force,
        postId: post.id,
        postTitle: getPostTitle(post.title),
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch {
    throw createRequestError("Could not open this post right now.");
  }

  const payload = (await response.json()) as PostEditSessionResponse;

  if (!response.ok) {
    throw createRequestError(payload.error ?? "Could not open this post right now.", response.status);
  }

  return payload;
};

export const heartbeatPostEditSessionRequest = async ({
  post,
  projectId,
}: {
  post: ContentPost;
  projectId: string;
}) => {
  let response: Response;

  try {
    response = await fetch(`/api/projects/${projectId}/content`, {
      body: JSON.stringify({
        action: "heartbeat_post_edit_session",
        postId: post.id,
        postTitle: getPostTitle(post.title),
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch {
    throw createRequestError("Could not refresh editing access right now.");
  }

  const payload = (await response.json()) as PostEditSessionResponse;

  if (!response.ok) {
    throw createRequestError(payload.error ?? "Could not refresh editing access right now.", response.status);
  }

  return payload;
};
