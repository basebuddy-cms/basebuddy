import {
  slugifyContentValue,
  type ContentPost,
  type ContentPostContentFieldValue,
} from "@/lib/content-runtime/shared";

export type PostComparableState = {
  authorId: string | null;
  categoryIds: string[];
  contentFields: Record<string, ContentPostContentFieldValue>;
  contentFormat: "html" | "markdown";
  contentHtml: string;
  contentJson: Record<string, unknown>;
  contentMarkdown: string | null;
  customFields: Record<string, unknown>;
  excerpt: string | null;
  focusKeyword: string | null;
  featuredImageUrl: string | null;
  parentPageId?: string | null;
  publishedAt: string | null;
  redirects: ContentPost["redirects"];
  seoDescription: string | null;
  seoTitle: string | null;
  slug: string;
  status: "draft" | "published" | "archived";
  tagIds: string[];
  title: string;
  updatedAt: string;
};

export type UnsavedChangesInput = {
  draft: PostComparableState | null;
  isEditingSlug: boolean;
  persisted: PostComparableState | null;
  slugDraft: string;
};

export type LocalAutosaveRestoreReason =
  | "crash"
  | "reload"
  | "session_resume"
  | "discard"
  | "leave_without_saving"
  | "manual_save";

export type PostLockHeartbeatInput = {
  active: boolean;
  blockingUserId?: string | null;
};

export type PostLockHeartbeatResolution = "keep-editing" | "show-takeover-dialog";

export type PostNavigationGuardInput = {
  hasPendingConfirmation: boolean;
  hasUnsavedChanges: boolean;
};

export type PostNavigationGuardResolution =
  | "allow-navigation"
  | "confirm-navigation"
  | "block-navigation";

export type PostEditCapabilityErrorSource = "acquire" | "heartbeat" | "save";

export type PostEditReadOnlyReason = "permission_lost" | "session_expired" | "refresh_failed";

const UNTITLED_DRAFT_SLUG_PATTERN = /^untitled(?:-[a-z0-9]{1,64})?$/;

const normalizeOptionalText = (value: string | null | undefined) => value?.trim() ?? "";

const isProjectConnectionFailure = (message: string) => {
  const normalizedMessage = message.trim().toLowerCase();

  return (
    normalizedMessage.includes("saved session pooler credentials") ||
    normalizedMessage.includes("saved session pooler username or password") ||
    normalizedMessage.includes("temporarily blocked authentication") ||
    normalizedMessage.includes("circuit breaker open") ||
    normalizedMessage.includes("password authentication failed") ||
    normalizedMessage.includes("tenant or user not found")
  );
};

export const getDisplayedPostSlug = ({
  persistedSlug,
  title,
  autoManaged,
}: {
  autoManaged: boolean;
  persistedSlug: string;
  title: string;
}) => {
  if (!autoManaged) {
    return persistedSlug;
  }

  return slugifyContentValue(title) || persistedSlug;
};

export const hasPublishablePostTitle = (title: string) => Boolean(title.trim());

export const isDisposableContentPostDraft = (post: ContentPost | null | undefined) => {
  if (!post || post.status !== "draft") {
    return false;
  }

  if (!UNTITLED_DRAFT_SLUG_PATTERN.test(post.slug.trim().toLowerCase())) {
    return false;
  }

  if (
    normalizeOptionalText(post.title) ||
    normalizeOptionalText(post.excerpt) ||
    normalizeOptionalText(post.focusKeyword) ||
    normalizeOptionalText(post.featuredImageUrl) ||
    normalizeOptionalText(post.seoDescription) ||
    normalizeOptionalText(post.seoTitle)
  ) {
    return false;
  }

  if (post.categoryIds.length || post.tagIds.length || post.publishedAt) {
    return false;
  }

  return true;
};

export const resolvePostEditReadOnlyReason = ({
  message,
  source,
  status,
}: {
  message: string;
  source: PostEditCapabilityErrorSource;
  status?: number;
}): PostEditReadOnlyReason | null => {
  const normalizedMessage = message.trim().toLowerCase();
  const isPermissionError =
    status === 401 ||
    status === 403 ||
    normalizedMessage.includes("authentication required") ||
    normalizedMessage.includes("do not have permission") ||
    normalizedMessage.includes("not authorized");

  if (source !== "save" && isPermissionError) {
    return "permission_lost";
  }

  if (normalizedMessage.includes("editing access expired")) {
    return "session_expired";
  }

  if (
    isProjectConnectionFailure(normalizedMessage)
  ) {
    return "refresh_failed";
  }

  if (
    source === "heartbeat" &&
    (normalizedMessage.includes("could not refresh editing access") ||
      normalizedMessage.includes("could not verify post editing access") ||
      normalizedMessage.includes("failed to fetch") ||
      normalizedMessage.includes("load failed"))
  ) {
    return "refresh_failed";
  }

  return null;
};

export const hasManualUnsavedChanges = ({
  draft,
  isEditingSlug,
  persisted,
  slugDraft,
}: UnsavedChangesInput) => {
  if (!draft || !persisted) {
    return false;
  }

  if (isEditingSlug && slugDraft !== draft.slug) {
    return true;
  }

  return JSON.stringify(draft) !== JSON.stringify(persisted);
};

export const shouldRestoreLocalAutosave = ({
  hasLocalAutosave,
  reason,
}: {
  hasLocalAutosave: boolean;
  reason: LocalAutosaveRestoreReason;
}) =>
  hasLocalAutosave &&
  reason !== "discard" &&
  reason !== "leave_without_saving" &&
  reason !== "manual_save";

export const shouldKeepAutoSlugSynced = ({
  autoManaged,
  event,
}: {
  autoManaged: boolean;
  event: "create" | "manual_save" | "manual_slug_save" | "publish";
}) => {
  if (!autoManaged) {
    return false;
  }

  return event === "create";
};

export const resolvePostLockHeartbeat = ({
  active,
  blockingUserId,
}: PostLockHeartbeatInput): PostLockHeartbeatResolution => {
  // The heartbeat RPC already refreshes or silently recovers the session when no blocker exists.
  if (active || !blockingUserId?.trim()) {
    return "keep-editing";
  }

  return "show-takeover-dialog";
};

export const resolvePostNavigationGuard = ({
  hasPendingConfirmation,
  hasUnsavedChanges,
}: PostNavigationGuardInput): PostNavigationGuardResolution => {
  if (hasPendingConfirmation) {
    return "block-navigation";
  }

  if (hasUnsavedChanges) {
    return "confirm-navigation";
  }

  return "allow-navigation";
};
