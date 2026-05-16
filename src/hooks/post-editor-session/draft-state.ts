import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import type { ContentPost } from "@/lib/content-runtime/shared";
import {
  createPostEditorLocalAutosaveStorage,
  type StoredLostPostDraftBackup,
  type StoredPostDraft,
} from "@/lib/editor/post-editor-local-autosave";
import {
  hasManualUnsavedChanges,
  type PostComparableState,
} from "@/lib/editor/post-editor-rules";

import type { PostContentView } from "@/hooks/post-editor-session/types";

type PostEditorAutosaveStorage = ReturnType<typeof createPostEditorLocalAutosaveStorage>;
type ComparablePostStateGetter = (post: ContentPost) => PostComparableState;

export type PostAutosaveContext = {
  currentPostId: string;
  draftPost: ContentPost;
  hasUnsavedChanges: boolean;
  persistedPost: ContentPost | null;
};

export const hasComparableUnsavedPostChanges = ({
  draftPost,
  getComparablePostState,
  isEditingSlug,
  persistedPost,
  slugDraft,
}: {
  draftPost: ContentPost | null | undefined;
  getComparablePostState: ComparablePostStateGetter;
  isEditingSlug: boolean;
  persistedPost: ContentPost | null | undefined;
  slugDraft: string;
}) => {
  if (!draftPost) {
    return false;
  }

  if (!persistedPost) {
    return true;
  }

  return hasManualUnsavedChanges({
    draft: getComparablePostState(draftPost),
    isEditingSlug,
    persisted: getComparablePostState(persistedPost),
    slugDraft,
  });
};

export const getCurrentPostAutosaveContext = ({
  draftPosts,
  getComparablePostState,
  isEditingSlug,
  persistedPosts,
  postContentView,
  selectedCollection,
  selectedPostId,
  slugDraft,
}: {
  draftPosts: Record<string, ContentPost>;
  getComparablePostState: ComparablePostStateGetter;
  isEditingSlug: boolean;
  persistedPosts: Record<string, ContentPost>;
  postContentView: PostContentView;
  selectedCollection: string;
  selectedPostId: string | null;
  slugDraft: string;
}): PostAutosaveContext | null => {
  if (selectedCollection !== "Posts" || postContentView !== "editor" || !selectedPostId) {
    return null;
  }

  const draftPost = draftPosts[selectedPostId];

  if (!draftPost) {
    return null;
  }

  const persistedPost = persistedPosts[selectedPostId] ?? null;
  const hasUnsavedChanges = hasComparableUnsavedPostChanges({
    draftPost,
    getComparablePostState,
    isEditingSlug,
    persistedPost,
    slugDraft,
  });

  return {
    currentPostId: selectedPostId,
    draftPost,
    hasUnsavedChanges,
    persistedPost,
  };
};

type CreatePostDraftStateHelpersArgs = {
  autoSlugPostIdsRef: MutableRefObject<Set<string>>;
  autosaveStorage: PostEditorAutosaveStorage;
  clearStoredPostDraftState: (postId?: string | null) => Promise<void>;
  dirtyPostIdsRef: MutableRefObject<Set<string>>;
  draftPostsRef: MutableRefObject<Record<string, ContentPost>>;
  getComparablePostState: ComparablePostStateGetter;
  isEditingPostSlugRef: MutableRefObject<boolean>;
  persistedPostsRef: MutableRefObject<Record<string, ContentPost>>;
  postContentViewRef: MutableRefObject<PostContentView>;
  postSlugDraftRef: MutableRefObject<string>;
  selectedCollectionRef: MutableRefObject<string>;
  selectedPostIdRef: MutableRefObject<string | null>;
  setIsEditingPostSlug: Dispatch<SetStateAction<boolean>>;
  setPostSlugDraft: Dispatch<SetStateAction<string>>;
  setPosts: Dispatch<SetStateAction<ContentPost[]>>;
};

export const createPostDraftStateHelpers = ({
  autoSlugPostIdsRef,
  autosaveStorage,
  clearStoredPostDraftState,
  dirtyPostIdsRef,
  draftPostsRef,
  getComparablePostState,
  isEditingPostSlugRef,
  persistedPostsRef,
  postContentViewRef,
  postSlugDraftRef,
  selectedCollectionRef,
  selectedPostIdRef,
  setIsEditingPostSlug,
  setPostSlugDraft,
  setPosts,
}: CreatePostDraftStateHelpersArgs) => {
  const isPostSlugAutoManaged = (postId: string) => autoSlugPostIdsRef.current.has(postId);

  const markPostDirty = (postId: string) => {
    dirtyPostIdsRef.current.add(postId);
  };

  const markPostPersisted = (
    post: ContentPost,
    options?: {
      invalidatePostsCache?: () => void;
    },
  ) => {
    persistedPostsRef.current[post.id] = post;
    draftPostsRef.current[post.id] = post;
    dirtyPostIdsRef.current.delete(post.id);
    autoSlugPostIdsRef.current.delete(post.id);
    void clearStoredPostDraftState(post.id);
    void autosaveStorage.clearLostPostDraftBackup(post.id);
    options?.invalidatePostsCache?.();
  };

  const restorePersistedPostDraft = (postId: string) => {
    const persistedPost = persistedPostsRef.current[postId];

    if (persistedPost) {
      draftPostsRef.current[postId] = persistedPost;
      setPosts((currentPosts) =>
        currentPosts.map((post) => (post.id === postId ? persistedPost : post)),
      );
    }

    dirtyPostIdsRef.current.delete(postId);
    void clearStoredPostDraftState(postId);
    setIsEditingPostSlug(false);
  };

  const applyRestoredDraftSnapshot = ({
    postId,
    selectedPost,
    storedDraft,
  }: {
    postId: string;
    selectedPost: ContentPost;
    storedDraft: StoredLostPostDraftBackup | StoredPostDraft;
  }) => {
    if (storedDraft.isSlugAutoManaged) {
      autoSlugPostIdsRef.current.add(postId);
    } else {
      autoSlugPostIdsRef.current.delete(postId);
    }

    const restoredPersistedPost = {
      ...(storedDraft.persistedPost ?? selectedPost),
      editingSession: selectedPost.editingSession ?? null,
      updatedAt: selectedPost.updatedAt,
    };
    const restoredDraftPost = {
      ...storedDraft.post,
      editingSession: selectedPost.editingSession ?? null,
    };

    persistedPostsRef.current[postId] = restoredPersistedPost;
    draftPostsRef.current[postId] = restoredDraftPost;
    dirtyPostIdsRef.current.add(postId);
    setPosts((currentPosts) =>
      currentPosts.map((post) => (post.id === postId ? restoredDraftPost : post)),
    );
    setPostSlugDraft(storedDraft.postSlugDraft);
    setIsEditingPostSlug(storedDraft.isEditingPostSlug);
  };

  const getAutosaveContext = () =>
    getCurrentPostAutosaveContext({
      draftPosts: draftPostsRef.current,
      getComparablePostState,
      isEditingSlug: isEditingPostSlugRef.current,
      persistedPosts: persistedPostsRef.current,
      postContentView: postContentViewRef.current,
      selectedCollection: selectedCollectionRef.current,
      selectedPostId: selectedPostIdRef.current,
      slugDraft: postSlugDraftRef.current,
    });

  const flushCurrentPostAutosaveNow = (
    browserSessionId: string,
    sessionState: "active" | "recoverable",
  ) => {
    const autosaveContext = getAutosaveContext();

    if (!autosaveContext?.hasUnsavedChanges) {
      return false;
    }

    autosaveStorage.writeStoredPostDraftSync(autosaveContext.currentPostId, {
      isSlugAutoManaged: isPostSlugAutoManaged(autosaveContext.currentPostId),
      isEditingPostSlug: isEditingPostSlugRef.current,
      persistedPost: autosaveContext.persistedPost,
      post: autosaveContext.draftPost,
      postSlugDraft: postSlugDraftRef.current,
    });
    autosaveStorage.writeStoredPostDraftSession({
      postId: autosaveContext.currentPostId,
      sessionId: browserSessionId,
      state: sessionState,
      updatedAt: new Date().toISOString(),
    });
    return true;
  };

  const backupLostPostDraft = async (postId: string) => {
    const draftPost = draftPostsRef.current[postId];

    if (!draftPost) {
      return false;
    }

    const persistedPost = persistedPostsRef.current[postId] ?? null;
    const hasUnsavedChanges = hasComparableUnsavedPostChanges({
      draftPost,
      getComparablePostState,
      isEditingSlug: postId === selectedPostIdRef.current ? isEditingPostSlugRef.current : false,
      persistedPost,
      slugDraft: postId === selectedPostIdRef.current ? postSlugDraftRef.current : draftPost.slug,
    });

    if (!hasUnsavedChanges) {
      return false;
    }

    return autosaveStorage.writeLostPostDraftBackup(postId, {
      backedUpAt: new Date().toISOString(),
      isEditingPostSlug: postId === selectedPostIdRef.current ? isEditingPostSlugRef.current : false,
      persistedPost,
      post: draftPost,
      postSlugDraft: postId === selectedPostIdRef.current ? postSlugDraftRef.current : draftPost.slug,
    } satisfies StoredLostPostDraftBackup);
  };

  return {
    applyRestoredDraftSnapshot,
    backupLostPostDraft,
    flushCurrentPostAutosaveNow,
    getCurrentPostAutosaveContext: getAutosaveContext,
    hasComparableUnsavedPostChanges: (args: {
      draftPost: ContentPost | null | undefined;
      isEditingSlug: boolean;
      persistedPost: ContentPost | null | undefined;
      slugDraft: string;
    }) =>
      hasComparableUnsavedPostChanges({
        ...args,
        getComparablePostState,
      }),
    isPostSlugAutoManaged,
    markPostDirty,
    markPostPersisted,
    restorePersistedPostDraft,
    writeStoredPostDraftSessionState: (browserSessionId: string, postId: string, state: "active" | "recoverable") => {
      autosaveStorage.writeStoredPostDraftSession({
        postId,
        sessionId: browserSessionId,
        state,
        updatedAt: new Date().toISOString(),
      });
    },
  };
};
