import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import type {
  ContentPost,
  ContentPostEditingSession,
} from "@/lib/content-runtime/shared";
import {
  resolvePostEditReadOnlyReason,
  resolvePostLockHeartbeat,
  type PostEditCapabilityErrorSource,
  type PostEditReadOnlyReason,
} from "@/lib/editor/post-editor-rules";

import type {
  LostPostAccessState,
  PendingPostTakeover,
  PostContentView,
  PostEditSessionResponse,
  ReadOnlyPostAccessState,
} from "@/hooks/post-editor-session/types";
import {
  getEditingSessionLabel,
  getPostTitle,
  getReadOnlyAccessMessage,
} from "@/hooks/post-editor-session/utils";

type SyncLocalPostEditingSession = (args: {
  postId?: string | null;
  postTitle?: string | null;
  releaseOnly?: boolean;
}) => void;

export const isRecoverablePostSessionError = (message: string) => {
  const normalizedMessage = message.trim().toLowerCase();
  return (
    normalizedMessage.includes("is already working on") ||
    normalizedMessage.includes("editing access expired")
  );
};

type CreatePostSessionTransitionHelpersArgs = {
  activePostEditSessionPostIdRef: MutableRefObject<string | null>;
  backupLostPostDraft: (postId: string) => Promise<boolean>;
  canEditCurrentPostRef: MutableRefObject<boolean>;
  draftPostsRef: MutableRefObject<Record<string, ContentPost>>;
  refreshPostsPresenceRef: MutableRefObject<() => Promise<void>>;
  restorePersistedPostDraft: (postId: string) => void;
  selectedPostIdRef: MutableRefObject<string | null>;
  setActivePostEditSessionPostId: Dispatch<SetStateAction<string | null>>;
  setIsEditingPostSlug: Dispatch<SetStateAction<boolean>>;
  setLostPostAccessState: Dispatch<SetStateAction<LostPostAccessState | null>>;
  setPendingPostTakeover: Dispatch<SetStateAction<PendingPostTakeover | null>>;
  setPostContentView: Dispatch<SetStateAction<PostContentView>>;
  setPostSlugDraft: Dispatch<SetStateAction<string>>;
  setReadOnlyPostAccessState: Dispatch<SetStateAction<ReadOnlyPostAccessState | null>>;
  setSelectedPostId: Dispatch<SetStateAction<string | null>>;
  syncLocalPostEditingSession: SyncLocalPostEditingSession;
};

export const createPostSessionTransitionHelpers = ({
  activePostEditSessionPostIdRef,
  backupLostPostDraft,
  canEditCurrentPostRef,
  draftPostsRef,
  refreshPostsPresenceRef,
  restorePersistedPostDraft,
  selectedPostIdRef,
  setActivePostEditSessionPostId,
  setIsEditingPostSlug,
  setLostPostAccessState,
  setPendingPostTakeover,
  setPostContentView,
  setPostSlugDraft,
  setReadOnlyPostAccessState,
  setSelectedPostId,
  syncLocalPostEditingSession,
}: CreatePostSessionTransitionHelpersArgs) => {
  const transitionPostToReadOnly = async ({
    post,
    reason,
  }: {
    post: ContentPost;
    reason: PostEditReadOnlyReason;
  }) => {
    if (selectedPostIdRef.current !== post.id) {
      return false;
    }

    activePostEditSessionPostIdRef.current = null;
    canEditCurrentPostRef.current = false;
    setActivePostEditSessionPostId(null);
    setPendingPostTakeover(null);
    setIsEditingPostSlug(false);
    setPostSlugDraft(draftPostsRef.current[post.id]?.slug ?? post.slug);
    syncLocalPostEditingSession({
      postId: post.id,
      releaseOnly: true,
    });
    setReadOnlyPostAccessState({
      message: getReadOnlyAccessMessage({
        postTitle: getPostTitle(post.title),
        reason,
      }),
      postId: post.id,
      postTitle: getPostTitle(post.title),
      reason,
    });
    await refreshPostsPresenceRef.current();
    return true;
  };

  const handlePostEditCapabilityError = async ({
    message,
    post,
    source,
    status,
  }: {
    message: string;
    post: ContentPost;
    source: PostEditCapabilityErrorSource;
    status?: number;
  }) => {
    const reason = resolvePostEditReadOnlyReason({
      message,
      source,
      status,
    });

    if (!reason) {
      return false;
    }

    return transitionPostToReadOnly({
      post,
      reason,
    });
  };

  const markPostEditSessionActive = async (post: ContentPost) => {
    setSelectedPostId(post.id);
    setPostContentView("editor");
    setActivePostEditSessionPostId(post.id);
    activePostEditSessionPostIdRef.current = post.id;
    canEditCurrentPostRef.current = true;
    setPendingPostTakeover(null);
    setReadOnlyPostAccessState((currentState) =>
      currentState?.postId === post.id ? null : currentState,
    );
    syncLocalPostEditingSession({
      postId: post.id,
      postTitle: getPostTitle(post.title),
    });
    await refreshPostsPresenceRef.current();
  };

  const handlePostEditSessionLost = async (
    post: ContentPost,
    blockingSession: ContentPostEditingSession | null | undefined,
  ) => {
    if (activePostEditSessionPostIdRef.current !== post.id) {
      return;
    }

    const takenOverBy = getEditingSessionLabel(blockingSession);
    const preservedDraft = await backupLostPostDraft(post.id);
    activePostEditSessionPostIdRef.current = null;
    canEditCurrentPostRef.current = false;
    setActivePostEditSessionPostId(null);
    syncLocalPostEditingSession({
      postId: post.id,
      releaseOnly: true,
    });
    setReadOnlyPostAccessState((currentState) =>
      currentState?.postId === post.id ? null : currentState,
    );
    restorePersistedPostDraft(post.id);
    setLostPostAccessState({
      postId: post.id,
      postTitle: getPostTitle(post.title),
      preservedDraft,
      takenOverBy,
    });
    await refreshPostsPresenceRef.current();
  };

  const handlePostEditSessionHeartbeatResult = async (
    post: ContentPost,
    payload: PostEditSessionResponse,
  ) => {
    const resolution = resolvePostLockHeartbeat({
      active: Boolean(payload.active),
      blockingUserId: payload.blockingSession?.userId ?? null,
    });

    if (resolution === "keep-editing") {
      return false;
    }

    await handlePostEditSessionLost(post, payload.blockingSession);
    return true;
  };

  return {
    handlePostEditCapabilityError,
    handlePostEditSessionHeartbeatResult,
    handlePostEditSessionLost,
    markPostEditSessionActive,
    transitionPostToReadOnly,
  };
};
