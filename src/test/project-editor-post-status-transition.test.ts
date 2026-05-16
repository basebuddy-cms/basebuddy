import { describe, expect, it, vi } from "vitest";

import {
  getProjectEditorMissingRequiredCustomFields,
  getProjectEditorMissingRequiredCustomFieldsMessage,
  getProjectEditorPostStatusTransitionReadiness,
  getProjectEditorPostStatusTransitionCopy,
  runProjectEditorPostStatusTransitionAction,
} from "@/components/editor/project-editor/post-status-transition";
import type { ContentPost } from "@/lib/content-runtime/shared";
import type { ContentFieldSpecSummary, ContentWorkspaceMeta } from "@/lib/content-runtime/shared";

const createFieldSpec = (
  overrides: Partial<ContentFieldSpecSummary> = {},
): ContentFieldSpecSummary => ({
  allowedValues: null,
  contentFormat: null,
  editabilityState: "editable",
  fieldKey: "summary",
  label: "Summary",
  multiple: false,
  nullable: false,
  patchMode: "replace",
  readOnly: false,
  relationMode: "none",
  required: true,
  searchMode: "none",
  semanticRole: "customField",
  uiControl: "text_input",
  valueKind: "text_like",
  visible: true,
  isCustomField: true,
  ...overrides,
});

const createContentRuntime = (
  fieldSpecs: ContentFieldSpecSummary[],
): NonNullable<ContentWorkspaceMeta["contentRuntime"]> => ({
  customFields: [],
  editorFields: [],
  fieldSpecs,
  filesStorage: null,
  mediaStorage: null,
});

const createPost = (overrides: Partial<ContentPost> = {}): ContentPost => ({
  authorId: null,
  categoryIds: [],
  contentFields: {},
  contentFormat: "html",
  contentHtml: "",
  contentJson: {},
  contentMarkdown: null,
  createdAt: "2026-04-01T00:00:00.000Z",
  customFields: {},
  excerpt: null,
  featuredImageUrl: null,
  focusKeyword: null,
  id: "post-1",
  parentPageId: null,
  publishedAt: null,
  redirects: [],
  seoDescription: null,
  seoTitle: null,
  slug: "hello",
  status: "draft",
  tagIds: [],
  title: "Hello",
  updatedAt: "2026-04-01T00:00:00.000Z",
  ...overrides,
});

describe("project editor post status transition helpers", () => {
  it("returns action-specific copy for post status transitions", () => {
    expect(getProjectEditorPostStatusTransitionCopy("publish_post")).toEqual({
      errorMessage: "Could not publish the post right now.",
      successMessage: "Post published.",
      unsavedMessage: "Save changes before publishing.",
    });
    expect(getProjectEditorPostStatusTransitionCopy("archive_post")).toEqual({
      errorMessage: "Could not archive the post right now.",
      successMessage: "Post archived.",
      unsavedMessage: "Save changes before archiving.",
    });
    expect(getProjectEditorPostStatusTransitionCopy("unpublish_post")).toEqual({
      errorMessage: "Could not move the post back to draft right now.",
      successMessage: "Post moved back to draft.",
      unsavedMessage: "Save changes before moving the post to draft.",
    });
  });

  it("returns only visible required custom fields with missing values", () => {
    const missingFields = getProjectEditorMissingRequiredCustomFields({
      contentRuntime: createContentRuntime([
        createFieldSpec({ fieldKey: "summary", label: "Summary" }),
        createFieldSpec({ fieldKey: "topics", label: "Topics" }),
        createFieldSpec({ fieldKey: "internal_note", label: "Internal Note", visible: false }),
        createFieldSpec({ fieldKey: "optional_note", label: "Optional Note", required: false }),
      ]),
      values: {
        internal_note: "",
        optional_note: "",
        summary: "  ",
        topics: [],
      },
    });

    expect(missingFields.map((field) => field.fieldKey)).toEqual(["summary", "topics"]);
  });

  it("builds singular and plural required custom field messages", () => {
    expect(
      getProjectEditorMissingRequiredCustomFieldsMessage([
        createFieldSpec({ label: "Summary" }),
      ]),
    ).toBe('The custom field "Summary" is required.');

    expect(
      getProjectEditorMissingRequiredCustomFieldsMessage([
        createFieldSpec({ label: "Summary" }),
        createFieldSpec({ label: "Topics" }),
      ]),
    ).toBe('The custom fields "Summary", "Topics" are required.');
  });

  it("keeps post status transition readiness decisions out of the editor shell", () => {
    expect(
      getProjectEditorPostStatusTransitionReadiness({
        action: "publish_post",
        canEditCurrentPost: false,
        contentRuntime: createContentRuntime([]),
        currentPost: null,
        hasUnsavedChanges: false,
        nextStatus: "published",
      }),
    ).toEqual({ status: "blocked" });

    expect(
      getProjectEditorPostStatusTransitionReadiness({
        action: "archive_post",
        canEditCurrentPost: true,
        contentRuntime: createContentRuntime([]),
        currentPost: {
          customFields: {},
          title: "Hello",
        },
        hasUnsavedChanges: true,
        nextStatus: "archived",
      }),
    ).toEqual({
      message: "Save changes before archiving.",
      status: "unsaved_changes",
    });

    expect(
      getProjectEditorPostStatusTransitionReadiness({
        action: "publish_post",
        canEditCurrentPost: true,
        contentRuntime: createContentRuntime([]),
        currentPost: {
          customFields: {},
          title: " ",
        },
        hasUnsavedChanges: false,
        nextStatus: "published",
      }),
    ).toEqual({
      message: "Enter a title before publishing.",
      status: "missing_title",
    });

    const missingRequired = getProjectEditorPostStatusTransitionReadiness({
      action: "publish_post",
      canEditCurrentPost: true,
      contentRuntime: createContentRuntime([createFieldSpec({ label: "Summary" })]),
      currentPost: {
        customFields: {
          summary: "",
        },
        title: "Hello",
      },
      hasUnsavedChanges: false,
      nextStatus: "published",
    });

    expect(missingRequired).toMatchObject({
      message: 'The custom field "Summary" is required.',
      status: "missing_required_custom_fields",
    });
    expect(
      missingRequired.status === "missing_required_custom_fields"
        ? missingRequired.missingFields.map((field) => field.fieldKey)
        : [],
    ).toEqual(["summary"]);
  });

  it("runs successful publish mutation orchestration outside the editor shell", async () => {
    const flushPostSave = vi.fn(async () => undefined);
    const publishingStates: boolean[] = [];
    const toastSuccess = vi.fn();

    await runProjectEditorPostStatusTransitionAction({
      action: "publish_post",
      canEditCurrentPost: true,
      contentRuntime: createContentRuntime([]),
      flushPostSave,
      focusMissingRequiredField: vi.fn(),
      getErrorMessage: (error, fallback) => (error instanceof Error ? error.message : fallback),
      getResolvedSelectedPostForSave: () => ({
        hasUnsavedChanges: false,
        post: createPost(),
      }),
      isExpectedSessionError: () => false,
      setIsPublishing: (value) => publishingStates.push(value),
      status: "published",
      toastError: vi.fn(),
      toastSuccess,
    });

    expect(flushPostSave).toHaveBeenCalledWith(
      expect.objectContaining({ status: "published" }),
      { action: "publish_post" },
    );
    expect(publishingStates).toEqual([true, false]);
    expect(toastSuccess).toHaveBeenCalledWith("Post published.");
  });

  it("focuses the first missing required custom field without running the status mutation", async () => {
    const flushPostSave = vi.fn(async () => undefined);
    const focusMissingRequiredField = vi.fn();
    const toastError = vi.fn();

    await runProjectEditorPostStatusTransitionAction({
      action: "publish_post",
      canEditCurrentPost: true,
      contentRuntime: createContentRuntime([createFieldSpec({ fieldKey: "summary", label: "Summary" })]),
      flushPostSave,
      focusMissingRequiredField,
      getErrorMessage: (_error, fallback) => fallback,
      getResolvedSelectedPostForSave: () => ({
        hasUnsavedChanges: false,
        post: createPost({
          customFields: {
            summary: "",
          },
        }),
      }),
      isExpectedSessionError: () => false,
      setIsPublishing: vi.fn(),
      status: "published",
      toastError,
      toastSuccess: vi.fn(),
    });

    expect(flushPostSave).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith('The custom field "Summary" is required.');
    expect(focusMissingRequiredField).toHaveBeenCalledWith("summary");
  });
});
