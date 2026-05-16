import type { ContentPost, ContentWorkspaceMeta } from "@/lib/content-runtime/shared";
import { hasPublishablePostTitle } from "@/lib/editor/post-editor-rules";

import {
  getProjectEditorCustomFieldSpecs,
  isProjectEditorCustomFieldValueMissing,
} from "./utils";

export type ProjectEditorPostStatusTransitionAction =
  | "archive_post"
  | "publish_post"
  | "unpublish_post";

type ProjectEditorPostStatusTransitionCopy = {
  errorMessage: string;
  successMessage: string;
  unsavedMessage: string;
};

type ProjectEditorPostStatusTransitionReadinessInput = {
  action: ProjectEditorPostStatusTransitionAction;
  canEditCurrentPost: boolean;
  contentRuntime: ContentWorkspaceMeta["contentRuntime"];
  currentPost: Pick<ContentPost, "customFields" | "title"> | null;
  hasUnsavedChanges: boolean;
  nextStatus: ContentPost["status"];
};

export const getProjectEditorPostStatusTransitionCopy = (
  action: ProjectEditorPostStatusTransitionAction,
): ProjectEditorPostStatusTransitionCopy => {
  if (action === "publish_post") {
    return {
      errorMessage: "Could not publish the post right now.",
      successMessage: "Post published.",
      unsavedMessage: "Save changes before publishing.",
    };
  }

  if (action === "archive_post") {
    return {
      errorMessage: "Could not archive the post right now.",
      successMessage: "Post archived.",
      unsavedMessage: "Save changes before archiving.",
    };
  }

  return {
    errorMessage: "Could not move the post back to draft right now.",
    successMessage: "Post moved back to draft.",
    unsavedMessage: "Save changes before moving the post to draft.",
  };
};

export const getProjectEditorMissingRequiredCustomFields = ({
  contentRuntime,
  values,
}: {
  contentRuntime: ContentWorkspaceMeta["contentRuntime"];
  values: ContentPost["customFields"] | null | undefined;
}) =>
  getProjectEditorCustomFieldSpecs({
    contentRuntime,
  }).filter((fieldSpec) => {
    if (!fieldSpec.required) {
      return false;
    }

    return isProjectEditorCustomFieldValueMissing({
      fieldSpec,
      value: values?.[fieldSpec.fieldKey],
    });
  });

export const getProjectEditorMissingRequiredCustomFieldsMessage = (
  missingRequiredFields: ReturnType<typeof getProjectEditorMissingRequiredCustomFields>,
) => {
  const fieldNames = missingRequiredFields.map((fieldSpec) => `"${fieldSpec.label}"`).join(", ");

  return missingRequiredFields.length === 1
    ? `The custom field ${fieldNames} is required.`
    : `The custom fields ${fieldNames} are required.`;
};

export const getProjectEditorPostStatusTransitionReadiness = ({
  action,
  canEditCurrentPost,
  contentRuntime,
  currentPost,
  hasUnsavedChanges,
  nextStatus,
}: ProjectEditorPostStatusTransitionReadinessInput) => {
  if (!currentPost || !canEditCurrentPost) {
    return { status: "blocked" as const };
  }

  if (hasUnsavedChanges) {
    return {
      message: getProjectEditorPostStatusTransitionCopy(action).unsavedMessage,
      status: "unsaved_changes" as const,
    };
  }

  if (nextStatus === "published" && !hasPublishablePostTitle(currentPost.title)) {
    return {
      message: "Enter a title before publishing.",
      status: "missing_title" as const,
    };
  }

  const missingFields = getProjectEditorMissingRequiredCustomFields({
    contentRuntime,
    values: currentPost.customFields,
  });

  if (missingFields.length > 0) {
    return {
      message: getProjectEditorMissingRequiredCustomFieldsMessage(missingFields),
      missingFields,
      status: "missing_required_custom_fields" as const,
    };
  }

  return { status: "ready" as const };
};

export const runProjectEditorPostStatusTransitionAction = async ({
  action,
  canEditCurrentPost,
  contentRuntime,
  flushPostSave,
  focusMissingRequiredField,
  getErrorMessage,
  getResolvedSelectedPostForSave,
  isExpectedSessionError,
  setIsPublishing,
  status,
  toastError,
  toastSuccess,
}: {
  action: ProjectEditorPostStatusTransitionAction;
  canEditCurrentPost: boolean;
  contentRuntime: ContentWorkspaceMeta["contentRuntime"];
  flushPostSave: (
    post: ContentPost,
    options: { action: ProjectEditorPostStatusTransitionAction },
  ) => Promise<unknown>;
  focusMissingRequiredField: (fieldKey: string | null) => void;
  getErrorMessage: (error: unknown, fallbackMessage: string) => string;
  getResolvedSelectedPostForSave: () => {
    hasUnsavedChanges: boolean;
    post: ContentPost;
  } | null;
  isExpectedSessionError: (error: unknown) => boolean;
  setIsPublishing: (value: boolean) => void;
  status: ContentPost["status"];
  toastError: (message: string) => void;
  toastSuccess: (message: string) => void;
}) => {
  const transitionCopy = getProjectEditorPostStatusTransitionCopy(action);
  const resolvedCurrentPost = getResolvedSelectedPostForSave();

  if (!resolvedCurrentPost || !canEditCurrentPost) {
    return;
  }

  const resolvedSave = {
    ...resolvedCurrentPost,
    post: {
      ...resolvedCurrentPost.post,
      status,
    },
  };

  const transitionReadiness = getProjectEditorPostStatusTransitionReadiness({
    action,
    canEditCurrentPost,
    contentRuntime,
    currentPost: resolvedSave.post,
    hasUnsavedChanges: resolvedCurrentPost.hasUnsavedChanges,
    nextStatus: status,
  });

  if (transitionReadiness.status === "blocked") {
    return;
  }

  if (
    transitionReadiness.status === "unsaved_changes" ||
    transitionReadiness.status === "missing_title"
  ) {
    toastError(transitionReadiness.message);
    return;
  }

  if (transitionReadiness.status === "missing_required_custom_fields") {
    const firstMissingField = transitionReadiness.missingFields[0] ?? null;

    toastError(transitionReadiness.message);
    focusMissingRequiredField(firstMissingField?.fieldKey ?? null);
    return;
  }

  if (action === "publish_post") {
    setIsPublishing(true);
  }

  try {
    await flushPostSave(resolvedSave.post, { action });
    toastSuccess(transitionCopy.successMessage);
  } catch (error) {
    if (isExpectedSessionError(error)) {
      return;
    }

    toastError(getErrorMessage(error, transitionCopy.errorMessage));
  } finally {
    if (action === "publish_post") {
      setIsPublishing(false);
    }
  }
};
