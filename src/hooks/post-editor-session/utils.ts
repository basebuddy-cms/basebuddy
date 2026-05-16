import type { ContentPostEditingSession } from "@/lib/content-runtime/shared";
import type { PostEditReadOnlyReason } from "@/lib/editor/post-editor-rules";

import type { RequestError } from "@/hooks/post-editor-session/types";

export const getPostTitle = (title: string) => title.trim() || "Untitled";

export const createBrowserSessionId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const createRequestError = (message: string, status?: number) =>
  Object.assign(new Error(message), status ? { status } : {}) as RequestError;

export const getRequestErrorStatus = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "status" in error &&
  typeof error.status === "number"
    ? error.status
    : undefined;

export const getReadOnlyAccessMessage = ({
  postTitle,
  reason,
}: {
  postTitle: string;
  reason: PostEditReadOnlyReason;
}) => {
  if (reason === "permission_lost") {
    return `You no longer have permission to edit ${postTitle}.`;
  }

  if (reason === "session_expired") {
    return `Your editing access expired for ${postTitle}. Retry to continue editing.`;
  }

  return `We couldn't confirm editing access for ${postTitle}. Retry to continue editing.`;
};

export const getEditingSessionLabel = (session: ContentPostEditingSession | null | undefined) =>
  session?.isCurrentUser ? "You" : session?.editorName?.trim() || session?.editorEmail?.trim() || "Another member";
