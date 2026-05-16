import type { Dispatch, SetStateAction } from "react";

import type { ContentPost, ContentPostEditingSession } from "@/lib/content-runtime/shared";
import type { PostComparableState, PostEditReadOnlyReason } from "@/lib/editor/post-editor-rules";

export type PostContentView = "list" | "editor";

export type PendingUnsavedChangesAction = {
  description: string;
  proceedLabel: string;
  title: string;
};

export type PendingPostTakeover = {
  blockingSession: ContentPostEditingSession | null;
  postId: string;
  postTitle: string;
};

export type LostPostAccessState = {
  postId: string;
  postTitle: string;
  preservedDraft: boolean;
  takenOverBy: string;
};

export type ReadOnlyPostAccessState = {
  message: string;
  postId: string;
  postTitle: string;
  reason: PostEditReadOnlyReason;
};

export type PostEditCapabilityState =
  | { state: "inactive" }
  | { state: "acquiring"; postId: string }
  | { state: "blocked"; postId: string; postTitle: string }
  | { state: "editable"; postId: string }
  | { state: "read_only"; message: string; postId: string; postTitle: string; reason: PostEditReadOnlyReason }
  | { state: "taken_over"; postId: string; postTitle: string; preservedDraft: boolean; takenOverBy: string };

export type PendingStoredDraftRestore = {
  postId: string;
  postTitle: string;
};

export type PendingLostPostDraftRestore = {
  backedUpAt: string;
  postId: string;
  postTitle: string;
};

export type PostEditSessionResponse = {
  acquired?: boolean;
  active?: boolean;
  blockingSession?: ContentPostEditingSession | null;
  error?: string;
  success?: boolean;
  takeover?: boolean;
};

export type RequestError = Error & {
  status?: number;
};

export type UsePostEditorSessionArgs = {
  getComparablePostState: (post: ContentPost) => PostComparableState;
  isContentReady: boolean;
  isSaving: boolean;
  onSessionError?: (message: string) => void;
  onStoredDraftRestored?: () => void;
  pathname: string;
  prepareForNavigationAwayFromPostEditor?: () => Promise<boolean>;
  posts: ContentPost[];
  projectId: string;
  refreshPostsPresence: () => Promise<void>;
  routePostId: string | null;
  searchParamsString: string;
  selectedCollection: string;
  setPosts: Dispatch<SetStateAction<ContentPost[]>>;
};
