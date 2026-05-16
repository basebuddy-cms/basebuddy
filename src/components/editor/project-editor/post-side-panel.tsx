"use client";

import React from "react";
import type { RefObject } from "react";

import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  FileText,
  Folder,
  History,
  Pencil,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import type {
  ContentAuthor,
  ContentCategory,
  ContentFieldSpecSummary,
  ContentPost,
  ContentRelationOption,
  ContentPostSidebarConfig,
  ContentPostSidebarFieldKey,
  ContentSidebarFieldSpecSummary,
  ContentTag,
  ContentWorkspaceMeta,
} from "@/lib/content-runtime/shared";
import {
  createContentRedirectEntry,
  createDefaultContentPostSidebarConfig,
} from "@/lib/content-runtime/shared";
import type {
  PostSidePanelView,
  YoastResult,
} from "@/components/editor/project-editor/types";
import {
  getProjectEditorCustomSidebarPageId,
  getProjectEditorPostSidebarChildNodes,
  getProjectEditorPostSidebarPageNode,
  getProjectEditorPostSidebarPageParentId,
  getProjectEditorResolvedPostSidebarNodes,
} from "@/components/editor/project-editor/post-sidebar-support";
import { ProjectEditorFieldStateNotice } from "@/components/editor/project-editor/field-state-notice";
import {
  ProjectEditorRedirectRowsField,
  ProjectEditorStructuredField,
  ProjectEditorTokenListField,
} from "@/components/editor/project-editor/compound-field-controls";
import {
  ProjectEditorBooleanField,
  ProjectEditorDateTimeField,
  ProjectEditorEnumField,
  ProjectEditorNumberField,
} from "@/components/editor/project-editor/primitive-field-controls";
import {
  ProjectEditorMultirangeField,
  ProjectEditorRangeField,
} from "@/components/editor/project-editor/range-field-controls";
import { ProjectEditorRelationField } from "@/components/editor/project-editor/relation-field-controls";
import {
  ProjectEditorFieldLabel,
  ProjectEditorTextInputField,
  ProjectEditorTextareaField,
} from "@/components/editor/project-editor/text-field-controls";
import {
  formatCategoryHierarchyLabel,
  getProjectEditorPostFieldStates,
} from "@/components/editor/project-editor/utils";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

const getReadOnlyFieldHelperText = ({
  editabilityState,
  label,
}: {
  editabilityState?: string | null;
  label: string;
}) =>
  editabilityState === "unsupported"
    ? `This ${label.toLowerCase()} field can't be edited here yet. Ask an owner to review this field mapping.`
    : `This ${label.toLowerCase()} field is read-only in BaseBuddy.`;

const getDuplicateFieldRecordsHelperText = (label: string) =>
  `This ${label.toLowerCase()} field has duplicate records behind it. Ask an owner to review the mapping before editing it.`;

type ProjectEditorPostSidePanelProps = {
  canEditCurrentPost: boolean;
  canOpenSelectedPostPreview: boolean;
  canOpenSelectedPostRevisions: boolean;
  canUploadFeaturedImage: boolean;
  categoryOptions: ContentCategory[];
  displayedSelectedPostSlug: string;
  contentRuntime: ContentWorkspaceMeta["contentRuntime"];
  featuredImageDragActive: boolean;
  featuredImageInputRef: RefObject<HTMLInputElement | null>;
  isEditingPostSlug: boolean;
  isYoastAnalyzing: boolean;
  onCancelPostSlugEdit: () => void;
  onClose: () => void;
  onHandleOpenPostPreview: () => void;
  onHandleOpenPostRevisions: () => void;
  onPostSidePanelViewChange: (view: PostSidePanelView) => void;
  onPostAuthorsSearchQueryChange?: (value: string) => void;
  onPostCategoriesSearchQueryChange?: (value: string) => void;
  onPostParentPageSearchQueryChange?: (value: string) => void;
  onPostSlugDraftChange: (value: string) => void;
  onPostTagsSearchQueryChange: (value: string) => void;
  onPostCustomFieldChange?: (postId: string, fieldKey: string, value: unknown) => void;
  onSavePostSlugEdit: () => void;
  onStartPostSlugEdit: () => void;
  onToggleFeaturedImageDragActive: (value: boolean) => void;
  parentPageOptions?: ContentRelationOption[];
  postAuthorOptions: ContentAuthor[];
  postSidebarConfig?: ContentPostSidebarConfig;
  postSidePanelView: PostSidePanelView;
  postSlugDraft: string;
  postAuthorsSearchQuery?: string;
  postCategoriesSearchQuery?: string;
  postParentPageSearchQuery?: string;
  postTagsSearchQuery: string;
  projectId: string;
  selectedPost: ContentPost | null;
  supportsPostRevisions: boolean;
  tags: ContentTag[];
  updatePost: (postId: string, updates: Partial<ContentPost>) => void;
  uploadFeaturedImage: (file: File) => Promise<void>;
  uploadingFeaturedImage: boolean;
  yoastReadabilityResults: YoastResult[];
  yoastReadabilityScore: number | null;
  yoastSeoResults: YoastResult[];
  yoastSeoScore: number | null;
};

type CustomFieldDefinition = ContentFieldSpecSummary;
type SidebarFieldDefinition = ContentSidebarFieldSpecSummary;

const isAssetRelationFieldSpec = (fieldSpec: CustomFieldDefinition) =>
  fieldSpec.relationTargetEntity === "media" || fieldSpec.relationTargetEntity === "files";

const getFieldInputId = ({
  fieldKey,
  postId,
  suffix = "input",
}: {
  fieldKey: string;
  postId: string;
  suffix?: string;
}) => `post-sidebar-${postId}-${fieldKey.replace(/[^a-z0-9_-]/gi, "-")}-${suffix}`;

const getScoreToneClasses = ({
  strongThreshold,
  value,
  warningThreshold,
}: {
  strongThreshold: number;
  value: number;
  warningThreshold: number;
}) => {
  if (value >= strongThreshold) {
    return "bg-success/15 text-success";
  }

  if (value >= warningThreshold) {
    return "bg-warning/15 text-warning";
  }

  return "bg-destructive/15 text-destructive";
};

const renderAnalysisResults = ({
  emptyMessage,
  isAnalyzing,
  results,
}: {
  emptyMessage: string;
  isAnalyzing: boolean;
  results: YoastResult[];
}) => {
  if (isAnalyzing && results.length === 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/50" />
        Analyzing...
      </span>
    );
  }

  if (results.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-0.5">
      {results.map((result) => (
        <div
          key={result.id}
          className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
        >
          <span
            className={cn(
              "mt-[3px] h-3 w-3 shrink-0 rounded-full",
              result.score >= 7
                ? "bg-success"
                : result.score >= 4
                  ? "bg-warning"
                  : "bg-destructive",
            )}
          />
          <p className="text-xs leading-snug text-foreground/80">{result.text}</p>
        </div>
      ))}
    </div>
  );
};

const parseSidebarDate = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const formatSidebarDateTime = (value: string | null | undefined) => {
  const parsedDate = parseSidebarDate(value);

  if (!parsedDate) {
    return "Not set";
  }

  return parsedDate.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

export function ProjectEditorPostSidePanel({
  canEditCurrentPost,
  canOpenSelectedPostPreview,
  canOpenSelectedPostRevisions,
  canUploadFeaturedImage,
  categoryOptions,
  displayedSelectedPostSlug,
  contentRuntime,
  featuredImageDragActive,
  featuredImageInputRef,
  isEditingPostSlug,
  isYoastAnalyzing,
  onCancelPostSlugEdit,
  onClose,
  onHandleOpenPostPreview,
  onHandleOpenPostRevisions,
  onPostSidePanelViewChange,
  onPostSlugDraftChange,
  onPostCustomFieldChange,
  onPostAuthorsSearchQueryChange = () => {},
  onPostCategoriesSearchQueryChange = () => {},
  onPostParentPageSearchQueryChange = () => {},
  onPostTagsSearchQueryChange,
  onSavePostSlugEdit,
  onStartPostSlugEdit,
  onToggleFeaturedImageDragActive,
  parentPageOptions = [],
  postAuthorOptions,
  postSidebarConfig = createDefaultContentPostSidebarConfig(),
  postSidePanelView,
  postSlugDraft,
  postAuthorsSearchQuery = "",
  postCategoriesSearchQuery = "",
  postParentPageSearchQuery = "",
  postTagsSearchQuery,
  projectId,
  selectedPost,
  supportsPostRevisions,
  tags,
  updatePost,
  uploadFeaturedImage,
  uploadingFeaturedImage,
  yoastReadabilityResults,
  yoastReadabilityScore,
  yoastSeoResults,
  yoastSeoScore,
}: ProjectEditorPostSidePanelProps) {
  const resolvedNodes = getProjectEditorResolvedPostSidebarNodes({
    config: postSidebarConfig,
    contentRuntime,
    supportsPostRevisions,
  }).filter((node) => node.visible);
  const postFieldStates = React.useMemo(
    () =>
      getProjectEditorPostFieldStates({
        contentRuntime,
        isContentProject: contentRuntime !== null,
      }),
    [contentRuntime],
  );
  const focusKeywordStoredInDatabase = postFieldStates.focusKeyword.mapped;
  const currentPageId = getProjectEditorCustomSidebarPageId(postSidePanelView);
  const currentPage = currentPageId
    ? getProjectEditorPostSidebarPageNode({
        nodes: resolvedNodes,
        pageId: currentPageId,
      }) ?? null
    : null;
  const currentParentId = currentPage
    ? getProjectEditorPostSidebarPageParentId({
        nodes: resolvedNodes,
        pageId: currentPage.id,
      })
    : null;
  const currentParentPage = currentParentId
    ? getProjectEditorPostSidebarPageNode({
        nodes: resolvedNodes,
        pageId: currentParentId,
      }) ?? null
    : null;
  const activeParentId = currentPage?.id ?? null;
  const hasSidebarPageContent = React.useCallback(
    (pageId: string): boolean =>
      getProjectEditorPostSidebarChildNodes({
        nodes: resolvedNodes,
        parentId: pageId,
      }).some((node) => node.kind === "field" || hasSidebarPageContent(node.id)),
    [resolvedNodes],
  );
  const currentNodes = getProjectEditorPostSidebarChildNodes({
    nodes: resolvedNodes,
    parentId: activeParentId,
  }).filter((node) => node.kind === "field" || hasSidebarPageContent(node.id));

  if (!selectedPost) {
    return (
      <aside className="min-h-0 w-72 flex-shrink-0 overflow-y-auto overscroll-contain border-l border-border bg-card">
        <div className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground">
              <FileText className="h-4 w-4" />
              Post Details
            </h3>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              aria-label="Close panel"
              onClick={onClose}
            >
              <ChevronDown className="h-3.5 w-3.5" />
              <span className="sr-only">Close panel</span>
            </Button>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-8 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-2 w-24" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-2 w-28" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-8 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        </div>
      </aside>
    );
  }

  const normalizedTagSearch = postTagsSearchQuery.trim().toLowerCase();
  const filteredTags = tags.filter((tag) => {
    if (!normalizedTagSearch) {
      return true;
    }

    return tag.name.toLowerCase().includes(normalizedTagSearch) || tag.slug.toLowerCase().includes(normalizedTagSearch);
  });
  const sidebarFieldSpecsById = new Map(
    (contentRuntime?.sidebarFieldSpecs ?? []).map((fieldSpec) => [fieldSpec.sidebarFieldId, fieldSpec] as const),
  );
  const getFallbackSidebarFieldSpec = (
    fieldKey: "author" | "categories" | "parent_page" | "tags",
  ): SidebarFieldDefinition => {
    switch (fieldKey) {
      case "author":
        return {
          allowedValues: null,
          contentFormat: null,
          defaultParentId: null,
          description: "Choose the author assigned to this post.",
          editabilityState: "editable",
          fieldKey: "author",
          label: "Author",
          multiple: false,
          nullable: true,
          patchMode: "link_replace",
          readOnly: false,
          relationMode: "managed_single",
          relationTargetEntity: "authors",
          required: false,
          searchMode: "none",
          sidebarFieldId: "author",
          uiControl: "single_select",
          valueKind: "relation_id_or_key",
          visible: true,
        };
      case "categories":
        return {
          allowedValues: null,
          contentFormat: null,
          defaultParentId: null,
          description: "Select one or more categories for this post.",
          editabilityState: "editable",
          fieldKey: "categories",
          label: "Categories",
          multiple: true,
          nullable: true,
          patchMode: "link_replace",
          readOnly: false,
          relationMode: "managed_multi",
          relationTargetEntity: "categories",
          required: false,
          searchMode: "none",
          sidebarFieldId: "categories",
          uiControl: "multi_select",
          valueKind: "relation_id_or_key",
          visible: true,
        };
      case "parent_page":
        return {
          allowedValues: null,
          contentFormat: null,
          defaultParentId: null,
          description: "Choose the parent page assigned to this post.",
          editabilityState: "editable",
          fieldKey: "parentPage",
          label: "Parent Page",
          multiple: false,
          nullable: true,
          patchMode: "link_replace",
          readOnly: false,
          relationMode: "managed_single",
          relationTargetEntity: "posts",
          required: false,
          searchMode: "none",
          sidebarFieldId: "parent_page",
          uiControl: "single_select",
          valueKind: "relation_id_or_key",
          visible: true,
        };
      case "tags":
        return {
          allowedValues: null,
          contentFormat: null,
          defaultParentId: null,
          description: "Select one or more tags for this post.",
          editabilityState: "editable",
          fieldKey: "tags",
          label: "Tags",
          multiple: true,
          nullable: true,
          patchMode: "link_replace",
          readOnly: false,
          relationMode: "managed_multi",
          relationTargetEntity: "tags",
          required: false,
          searchMode: "none",
          sidebarFieldId: "tags",
          uiControl: "multi_select",
          valueKind: "relation_id_or_key",
          visible: true,
        };
    }
  };
  const getSidebarFieldSpec = (fieldKey: ContentPostSidebarFieldKey) => {
    const fieldSpec = sidebarFieldSpecsById.get(fieldKey) as SidebarFieldDefinition | undefined;

    if (fieldSpec) {
      return fieldSpec;
    }

    if (contentRuntime !== null) {
      return null;
    }

    if (fieldKey === "author" || fieldKey === "categories" || fieldKey === "parent_page" || fieldKey === "tags") {
      return getFallbackSidebarFieldSpec(fieldKey);
    }

    return null;
  };
  const getRelationFieldSpec = (fieldKey: "author" | "categories" | "parentPage" | "tags") =>
    getSidebarFieldSpec(
      fieldKey === "parentPage"
        ? "parent_page"
        : fieldKey,
    );
  const getScalarFieldSpec = (
    fieldKey: "excerpt" | "featured_image" | "focus_keyword" | "redirects" | "meta_description" | "meta_title" | "slug",
  ) => getSidebarFieldSpec(fieldKey);
  const getTimestampFieldSpec = (fieldKey: "published_at" | "updated_at") =>
    getSidebarFieldSpec(fieldKey);
  const getCustomFieldSpec = (fieldKey: `custom_field:${string}`) => {
    const fieldSpec = sidebarFieldSpecsById.get(fieldKey) as SidebarFieldDefinition | undefined;
    return fieldSpec?.isCustomField === true ? fieldSpec : null;
  };
  const isRequiredRelationFieldWithoutOptions = ({
    fieldKey,
    optionCount,
  }: {
    fieldKey: "author" | "categories" | "parentPage" | "tags";
    optionCount: number;
  }) => {
    const fieldSpec = getRelationFieldSpec(fieldKey);
    return Boolean(fieldSpec?.required && optionCount === 0);
  };
  const getFieldConflict = (fieldKey: string) => selectedPost.fieldConflicts?.[fieldKey] ?? null;
  const renderReadOnlyRelationField = ({
    fieldKey,
    helperText,
    label,
    values,
  }: {
    fieldKey: "author" | "categories" | "parentPage" | "tags";
    helperText?: string;
    label: string;
    values: string[];
  }) => {
    const fieldSpec = getRelationFieldSpec(fieldKey);
    const resolvedHelperText =
      helperText ??
      getReadOnlyFieldHelperText({
        editabilityState: fieldSpec?.editabilityState,
        label,
      });

    return (
      <div key={fieldKey}>
        <ProjectEditorFieldStateNotice
          currentValue={
            values.length ? `${values.length === 1 ? "Current value" : "Current values"}: ${values.join(", ")}` : undefined
          }
          helperText={resolvedHelperText}
          label={label}
        />
      </div>
    );
  };

  const renderReadOnlyScalarField = ({
    fieldKey,
    helperText,
    label,
    value,
  }: {
    fieldKey: string;
    helperText: string;
    label: string;
    value: string | null;
  }) => (
    <div key={fieldKey}>
      <ProjectEditorFieldStateNotice
        currentValue={value ? `Current value: ${value}` : undefined}
        helperText={helperText}
        label={label}
      />
    </div>
  );

  const renderSidebarDateField = ({
    allowClear = false,
    fieldKey,
    label,
    value,
  }: {
    allowClear?: boolean;
    fieldKey: "published_at" | "updated_at";
    label: "Published On" | "Updated On";
    value: string | null;
  }) => {
    const parsedDate = parseSidebarDate(value);
    const inputId = getFieldInputId({
      fieldKey,
      postId: selectedPost.id,
    });
    const timeInputId = `${inputId}-time`;
    const dateField = fieldKey === "published_at" ? "publishedAt" : "updatedAt";

    const commitDate = (nextDate: Date | null) => {
      updatePost(selectedPost.id, {
        [dateField]: nextDate ? nextDate.toISOString() : null,
      } as Pick<ContentPost, "publishedAt" | "updatedAt">);
    };

    const applySelectedDay = (day: Date | undefined) => {
      if (!day) {
        if (allowClear) {
          commitDate(null);
        }

        return;
      }

      const baseDate = parsedDate ? new Date(parsedDate) : new Date();
      const nextDate = new Date(day);
      nextDate.setHours(baseDate.getHours(), baseDate.getMinutes(), 0, 0);
      commitDate(nextDate);
    };

    return (
      <div key={fieldKey} className="flex flex-col items-start gap-1 py-1">
        <span className="text-xs text-muted-foreground">{label.toLowerCase()}:</span>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 p-0 text-left text-xs font-medium text-foreground transition-colors hover:text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={!canEditCurrentPost}
            >
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{formatSidebarDateTime(value)}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <div className="border-b border-border px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {label}
              </p>
            </div>
            <Calendar
              mode="single"
              selected={parsedDate ?? undefined}
              onSelect={applySelectedDay}
              initialFocus
            />
            <div className="border-t border-border px-3 py-3">
              <label htmlFor={timeInputId} className="mb-1 block text-xs text-muted-foreground">
                Time
              </label>
              <Input
                id={timeInputId}
                type="time"
                value={
                  parsedDate
                    ? `${String(parsedDate.getHours()).padStart(2, "0")}:${String(parsedDate.getMinutes()).padStart(2, "0")}`
                    : "09:00"
                }
                className="h-8 text-xs"
                disabled={!canEditCurrentPost}
                onChange={(event) => {
                  const [hours, minutes] = event.target.value.split(":").map(Number);
                  const nextDate = parsedDate ? new Date(parsedDate) : new Date();
                  nextDate.setHours(hours ?? 0, minutes ?? 0, 0, 0);
                  commitDate(nextDate);
                }}
              />
              {allowClear ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-7 px-2 text-xs"
                  onClick={() => commitDate(null)}
                  disabled={!canEditCurrentPost || value === null}
                >
                  Clear
                </Button>
              ) : null}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  };

  const renderReadOnlyTimestampField = ({
    fieldKey,
    label,
    value,
  }: {
    fieldKey: "published_at" | "updated_at";
    label: "Published On" | "Updated On";
    value: string | null;
  }) => {
    const fieldSpec = getTimestampFieldSpec(fieldKey);
    const helperText = getReadOnlyFieldHelperText({
      editabilityState: fieldSpec?.editabilityState,
      label,
    });

    return (
      <div key={fieldKey}>
        <ProjectEditorFieldStateNotice
          currentValue={`Current value: ${formatSidebarDateTime(value)}`}
          helperText={helperText}
          label={label}
        />
      </div>
    );
  };

  const renderCustomField = (fieldKey: `custom_field:${string}`) => {
    const customField = getCustomFieldSpec(fieldKey);

    if (!customField) {
      return null;
    }

    const currentValue = selectedPost.customFields?.[customField.fieldKey];
    const isRequired = customField.required;
    const labelText = customField.label;
    const inputId = getFieldInputId({
      fieldKey,
      postId: selectedPost.id,
    });
    const handleChange = (value: unknown) => {
      if (onPostCustomFieldChange) {
        onPostCustomFieldChange(selectedPost.id, customField.fieldKey, value);
        return;
      }

      updatePost(selectedPost.id, {
        customFields: {
          ...(selectedPost.customFields ?? {}),
          [customField.fieldKey]: value,
        },
      });
    };

    const fieldLabel = (
      <ProjectEditorFieldLabel htmlFor={inputId} label={labelText} required={isRequired} />
    );
    const renderReadOnlyCustomField = (helperText: string) => (
      <div key={fieldKey}>
        <ProjectEditorFieldStateNotice
          currentValue={
            currentValue !== null && currentValue !== undefined
              ? `Current value: ${
                  typeof currentValue === "string" ? currentValue : JSON.stringify(currentValue)
                }`
              : undefined
          }
          helperText={helperText}
          label={fieldLabel}
        />
      </div>
    );
    const fieldConflict = getFieldConflict(customField.fieldKey);

    try {
      if (fieldConflict?.code === "helper_row_ambiguity") {
        return renderReadOnlyCustomField(
          getDuplicateFieldRecordsHelperText(labelText),
        );
      }

      if (
        isAssetRelationFieldSpec(customField) &&
        (customField.uiControl === "single_select" ||
          customField.uiControl === "multi_select" ||
          customField.uiControl === "read_only")
      ) {
        const helperText =
          customField.readOnly || customField.uiControl === "read_only"
            ? getReadOnlyFieldHelperText({
                editabilityState: customField.editabilityState,
                label: "custom",
              })
            : undefined;

        return (
          <div key={fieldKey}>
            {fieldLabel}
            <ProjectEditorRelationField
              canEditCurrentPost={
                canEditCurrentPost &&
                !customField.readOnly &&
                customField.uiControl !== "read_only"
              }
              fieldKey={fieldKey}
              fieldSpec={customField}
              helperText={helperText}
              inputId={inputId}
              label={labelText}
              onChange={handleChange}
              projectId={projectId}
              selectedPostId={selectedPost.id}
              value={currentValue}
            />
          </div>
        );
      }

      if (customField.readOnly || customField.uiControl === "read_only") {
        return renderReadOnlyCustomField(
          getReadOnlyFieldHelperText({
            editabilityState: customField.editabilityState,
            label: "custom",
          }),
        );
      }

      if (
        customField.uiControl === "single_select" ||
        customField.uiControl === "multi_select"
      ) {
        return (
          <div key={fieldKey}>
            {fieldLabel}
            <ProjectEditorRelationField
              canEditCurrentPost={canEditCurrentPost}
              fieldKey={fieldKey}
              fieldSpec={customField}
              inputId={inputId}
              label={labelText}
              onChange={handleChange}
              projectId={projectId}
              selectedPostId={selectedPost.id}
              value={currentValue}
            />
          </div>
        );
      }

      if (customField.uiControl === "toggle") {
        return (
          <div key={fieldKey}>
            <ProjectEditorBooleanField
              id={inputId}
              label={labelText}
              required={isRequired}
              value={
                currentValue === true || currentValue === "true"
                  ? true
                  : currentValue === false || currentValue === "false"
                    ? false
                    : null
              }
              onChange={handleChange}
              disabled={!canEditCurrentPost}
            />
          </div>
        );
      }

      if (customField.uiControl === "number_input") {
        return (
          <div key={fieldKey}>
            <ProjectEditorNumberField
              id={inputId}
              label={labelText}
              required={isRequired}
              value={
                currentValue === null || currentValue === undefined
                  ? null
                  : typeof currentValue === "number"
                    ? currentValue
                    : Number(currentValue)
              }
              onChange={handleChange}
              disabled={!canEditCurrentPost}
            />
          </div>
        );
      }

      if (customField.uiControl === "range_input") {
        return (
          <div key={fieldKey}>
            <ProjectEditorRangeField
              id={inputId}
              label={labelText}
              required={isRequired}
              value={currentValue != null ? String(currentValue) : null}
              onChange={handleChange}
              disabled={!canEditCurrentPost}
            />
          </div>
        );
      }

      if (customField.uiControl === "multirange_editor") {
        return (
          <div key={fieldKey}>
            <ProjectEditorMultirangeField
              id={inputId}
              label={labelText}
              required={isRequired}
              value={currentValue != null ? String(currentValue) : null}
              onChange={handleChange}
              disabled={!canEditCurrentPost}
            />
          </div>
        );
      }

      if (
        customField.uiControl === "date_picker" ||
        customField.uiControl === "datetime_picker"
      ) {
        return (
          <div key={fieldKey}>
            <ProjectEditorDateTimeField
              id={inputId}
              label={labelText}
              required={isRequired}
              mode={customField.uiControl === "datetime_picker" ? "datetime" : "date"}
              value={currentValue ? String(currentValue) : null}
              onChange={handleChange}
              disabled={!canEditCurrentPost}
            />
          </div>
        );
      }

      if (customField.uiControl === "structured_editor") {
        return (
          <div key={fieldKey}>
            <ProjectEditorStructuredField
              format={customField.contentFormat === "xml" ? "xml" : "json"}
              id={inputId}
              label={labelText}
              onChange={handleChange}
              required={isRequired}
              value={currentValue}
              disabled={!canEditCurrentPost}
            />
          </div>
        );
      }

      if (
        customField.uiControl === "dropdown" ||
        customField.uiControl === "searchable_dropdown"
      ) {
        const optionValues = customField.allowedValues ?? [];

        if (!optionValues.length) {
          return renderReadOnlyCustomField(
            "This custom field does not have options set up.",
          );
        }

        return (
          <div key={fieldKey}>
            <ProjectEditorEnumField
              id={inputId}
              label={labelText}
              required={isRequired}
              value={currentValue != null ? String(currentValue) : null}
              options={optionValues}
              onChange={handleChange}
              disabled={!canEditCurrentPost}
            />
          </div>
        );
      }

      if (customField.uiControl === "token_input") {
        const arrayValues: string[] = Array.isArray(currentValue)
          ? (currentValue as unknown[]).map(String)
          : typeof currentValue === "string"
            ? (() => {
                try {
                  const parsedValue = JSON.parse(currentValue);
                  return Array.isArray(parsedValue) ? parsedValue.map(String) : [];
                } catch {
                  return [];
                }
              })()
            : [];

        return (
          <div key={fieldKey}>
            <ProjectEditorTokenListField
              disabled={!canEditCurrentPost}
              id={inputId}
              label={labelText}
              onChange={handleChange}
              values={arrayValues}
            />
          </div>
        );
      }

      if (customField.uiControl === "textarea") {
        return (
          <div key={fieldKey}>
            <ProjectEditorTextareaField
              id={inputId}
              value={currentValue != null ? String(currentValue) : ""}
              label={labelText}
              required={isRequired}
              onChange={(event) => handleChange(event.target.value || null)}
              disabled={!canEditCurrentPost}
              rows={4}
            />
          </div>
        );
      }

      return (
        <div key={fieldKey}>
          <ProjectEditorTextInputField
            id={inputId}
            value={currentValue != null ? String(currentValue) : ""}
            label={labelText}
            required={isRequired}
            onChange={(event) => handleChange(event.target.value || null)}
            disabled={!canEditCurrentPost}
            inputClassName="h-8 border-border text-xs"
          />
        </div>
      );
    } catch {
      return (
        <div key={fieldKey}>
          <ProjectEditorFieldStateNotice
            helperText="This field couldn't be rendered."
            label={customField.label}
          />
        </div>
      );
    }
  };

  const renderConfiguredSidebarField = (fieldKey: ContentPostSidebarFieldKey) => {
    switch (fieldKey) {
      case "author": {
        const authorFieldSpec = getRelationFieldSpec("author");
        const authorLabel = postAuthorOptions.find((author) => author.id === selectedPost.authorId)?.name ??
          selectedPost.authorId ??
          null;
        const authorConflict = getFieldConflict("author");

        if (authorConflict?.code === "helper_row_ambiguity") {
          return renderReadOnlyRelationField({
            fieldKey: "author",
            helperText: getDuplicateFieldRecordsHelperText("Author"),
            label: "Author",
            values: authorLabel ? [authorLabel] : [],
          });
        }

        if (authorFieldSpec?.uiControl === "read_only") {
          return renderReadOnlyRelationField({
            fieldKey: "author",
            label: "Author",
            values: authorLabel ? [authorLabel] : [],
          });
        }

        const triggerId = getFieldInputId({
          fieldKey,
          postId: selectedPost.id,
        });
        const searchInputId = getFieldInputId({
          fieldKey,
          postId: selectedPost.id,
          suffix: "search",
        });
        const authorOptions = postAuthorOptions.map((author) => ({
          id: author.id,
          label: author.name,
        }));

        return (
          <div key={fieldKey}>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Author
            </label>
            {authorFieldSpec ? (
              <ProjectEditorRelationField
                canEditCurrentPost={canEditCurrentPost}
                emptyStateMessage={
                  isRequiredRelationFieldWithoutOptions({
                    fieldKey: "author",
                    optionCount: authorOptions.length,
                  })
                    ? "This mapped author field is required, but no valid authors are available."
                    : "Create authors from the Authors page to assign them here."
                }
                fieldKey="author"
                fieldSpec={authorFieldSpec}
                inputId={triggerId}
                label="Author"
                noneOptionLabel={null}
                onChange={(value) => updatePost(selectedPost.id, { authorId: typeof value === "string" ? value : null })}
                onSearchChange={onPostAuthorsSearchQueryChange}
                options={authorOptions}
                projectId={projectId}
                searchInputId={searchInputId}
                searchPlaceholder="Search authors"
                searchValue={postAuthorsSearchQuery}
                selectedPostId={selectedPost.id}
                value={selectedPost.authorId}
              />
            ) : null}
          </div>
        );
      }
      case "parent_page": {
        const parentPageFieldSpec = getRelationFieldSpec("parentPage");
        const selectableParentPageOptions = parentPageOptions.filter((option) => option.id !== selectedPost.id);
        const selectedParentPageLabel =
          selectableParentPageOptions.find((option) => option.id === selectedPost.parentPageId)?.label ??
          selectedPost.parentPageId ??
          null;
        const triggerId = getFieldInputId({
          fieldKey,
          postId: selectedPost.id,
        });
        const searchInputId = getFieldInputId({
          fieldKey,
          postId: selectedPost.id,
          suffix: "search",
        });
        const parentPageConflict = getFieldConflict("parentPage");

        if (parentPageConflict?.code === "helper_row_ambiguity") {
          return renderReadOnlyRelationField({
            fieldKey: "parentPage",
            helperText: getDuplicateFieldRecordsHelperText("Parent Page"),
            label: "Parent Page",
            values: selectedParentPageLabel ? [selectedParentPageLabel] : [],
          });
        }

        if (parentPageFieldSpec?.uiControl === "read_only") {
          return renderReadOnlyRelationField({
            fieldKey: "parentPage",
            label: "Parent Page",
            values: selectedParentPageLabel ? [selectedParentPageLabel] : [],
          });
        }

        return (
          <div key={fieldKey}>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Parent Page
            </label>
            {parentPageFieldSpec ? (
              <ProjectEditorRelationField
                canEditCurrentPost={canEditCurrentPost}
                emptyStateMessage={
                  isRequiredRelationFieldWithoutOptions({
                    fieldKey: "parentPage",
                    optionCount: selectableParentPageOptions.length,
                  })
                    ? "This mapped parent page field is required, but no valid parent pages are available."
                    : "No eligible parent pages are available for this post yet."
                }
                fieldKey="parentPage"
                fieldSpec={parentPageFieldSpec}
                inputId={triggerId}
                label="Parent Page"
                noneOptionLabel={parentPageFieldSpec.required ? null : "No Parent Page"}
                onChange={(value) =>
                  updatePost(selectedPost.id, {
                    parentPageId: typeof value === "string" ? value : null,
                  })
                }
                onSearchChange={onPostParentPageSearchQueryChange}
                options={selectableParentPageOptions}
                projectId={projectId}
                searchInputId={searchInputId}
                searchPlaceholder="Search pages"
                searchValue={postParentPageSearchQuery}
                selectedPostId={selectedPost.id}
                value={selectedPost.parentPageId}
              />
            ) : null}
          </div>
        );
      }
      case "published_at":
        if (getTimestampFieldSpec("published_at")?.readOnly) {
          return renderReadOnlyTimestampField({
            fieldKey: "published_at",
            label: "Published On",
            value: selectedPost.publishedAt,
          });
        }

        return renderSidebarDateField({
          allowClear: true,
          fieldKey,
          label: "Published On",
          value: selectedPost.publishedAt,
        });
      case "updated_at":
        if (getTimestampFieldSpec("updated_at")?.readOnly) {
          return renderReadOnlyTimestampField({
            fieldKey: "updated_at",
            label: "Updated On",
            value: selectedPost.updatedAt,
          });
        }

        return renderSidebarDateField({
          fieldKey,
          label: "Updated On",
          value: selectedPost.updatedAt,
        });
      case "excerpt": {
        const excerptFieldSpec = getScalarFieldSpec("excerpt");
        const excerptConflict = getFieldConflict("excerpt");
        const inputId = getFieldInputId({
          fieldKey,
          postId: selectedPost.id,
        });

        if (excerptConflict?.code === "helper_row_ambiguity") {
          return renderReadOnlyScalarField({
            fieldKey,
            helperText: getDuplicateFieldRecordsHelperText("Excerpt"),
            label: "Excerpt",
            value: selectedPost.excerpt,
          });
        }

        if (excerptFieldSpec?.readOnly || excerptFieldSpec?.uiControl === "read_only") {
          return renderReadOnlyScalarField({
            fieldKey,
            helperText: getReadOnlyFieldHelperText({
              editabilityState: excerptFieldSpec.editabilityState,
              label: "Excerpt",
            }),
            label: "Excerpt",
            value: selectedPost.excerpt,
          });
        }

        return (
          <div key={fieldKey}>
            <ProjectEditorTextareaField
              id={inputId}
              value={selectedPost.excerpt ?? ""}
              label="Excerpt"
              onChange={(event) =>
                updatePost(selectedPost.id, {
                  excerpt: event.target.value.trim() ? event.target.value : null,
                })
              }
              placeholder="Optional summary for listings and previews"
              textareaClassName="min-h-24 resize-none border-border text-xs"
              disabled={!canEditCurrentPost}
            />
          </div>
        );
      }
      case "slug": {
        const slugFieldSpec = getScalarFieldSpec("slug");
        const slugConflict = getFieldConflict("slug");
        const inputId = getFieldInputId({
          fieldKey,
          postId: selectedPost.id,
        });

        if (slugConflict?.code === "helper_row_ambiguity") {
          return renderReadOnlyScalarField({
            fieldKey,
            helperText: getDuplicateFieldRecordsHelperText("URL Slug"),
            label: "URL Slug",
            value: displayedSelectedPostSlug ? `/${displayedSelectedPostSlug}` : null,
          });
        }

        if (slugFieldSpec?.readOnly || slugFieldSpec?.uiControl === "read_only") {
          return renderReadOnlyScalarField({
            fieldKey,
            helperText: getReadOnlyFieldHelperText({
              editabilityState: slugFieldSpec.editabilityState,
              label: "URL Slug",
            }),
            label: "URL Slug",
            value: displayedSelectedPostSlug ? `/${displayedSelectedPostSlug}` : null,
          });
        }

        return (
          <div key={fieldKey}>
            <label htmlFor={inputId} className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              URL Slug
            </label>
            {isEditingPostSlug ? (
              <div className="space-y-1.5">
                <Textarea
                  id={inputId}
                  value={postSlugDraft}
                  onChange={(event) => {
                    onPostSlugDraftChange(event.target.value);
                    const element = event.target;
                    element.style.height = "auto";
                    element.style.height = `${element.scrollHeight}px`;
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      onSavePostSlugEdit();
                    }

                    if (event.key === "Escape") {
                      event.preventDefault();
                      onCancelPostSlugEdit();
                    }
                  }}
                  ref={(element) => {
                    if (element) {
                      element.style.height = "auto";
                      element.style.height = `${element.scrollHeight}px`;
                    }
                  }}
                  className="min-h-8 resize-none overflow-hidden border-border font-mono text-xs"
                  autoFocus
                  disabled={!canEditCurrentPost}
                />
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={onSavePostSlugEdit}
                    disabled={!canEditCurrentPost}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" />
                    Save
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={onCancelPostSlugEdit}
                  >
                    <X className="mr-1 h-3.5 w-3.5" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="group flex w-full items-start gap-1.5 rounded-md px-2 py-1.5 text-left font-mono text-xs text-muted-foreground hover:bg-muted"
                onClick={onStartPostSlugEdit}
                disabled={!canEditCurrentPost}
              >
                <span className="break-words">
                  {displayedSelectedPostSlug
                    ? `/${displayedSelectedPostSlug}`.split("-").map((part, index, parts) => (
                        <span key={`${part}-${index}`}>
                          {part}
                          {index < parts.length - 1 ? <>-<wbr /></> : null}
                        </span>
                      ))
                    : "Enter slug"}
                </span>
                <Pencil className="mt-0.5 h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            )}
          </div>
        );
      }
      case "redirects": {
        const redirectsFieldSpec = getScalarFieldSpec("redirects");
        const redirects = selectedPost.redirects ?? [];
        const inputId = getFieldInputId({
          fieldKey,
          postId: selectedPost.id,
        });
        const isReadOnly = redirectsFieldSpec?.readOnly || redirectsFieldSpec?.uiControl === "read_only";
        const supportsStructuredRedirects =
          redirectsFieldSpec?.redirectMetadataSupport === "structured" ||
          redirectsFieldSpec?.uiControl === "redirect_rows_editor";
        const helperText =
          isReadOnly
            ? getReadOnlyFieldHelperText({
                editabilityState: redirectsFieldSpec?.editabilityState,
                label: "Redirects",
            })
            : supportsStructuredRedirects
              ? "Old slugs that should keep resolving to this post. This mapping also supports status code, locale, and active state."
              : "Old slugs that should keep resolving to this post. This mapping only supports a slug list.";

        if (supportsStructuredRedirects) {
          return (
            <div key={fieldKey}>
              <ProjectEditorRedirectRowsField
                disabled={isReadOnly || !canEditCurrentPost}
                helperText={helperText}
                id={inputId}
                label="Redirects"
                onChange={(nextValues) => updatePost(selectedPost.id, { redirects: nextValues })}
                values={redirects}
              />
            </div>
          );
        }

        return (
          <div key={fieldKey}>
            <ProjectEditorTokenListField
              disabled={isReadOnly || !canEditCurrentPost}
              helperText={helperText}
              id={inputId}
              label="Redirects"
              onChange={(nextValues) =>
                updatePost(selectedPost.id, {
                  redirects: nextValues.map((value) => createContentRedirectEntry({ source: value })),
                })
              }
              values={redirects.map((entry) => entry.source)}
            />
          </div>
        );
      }
      case "featured_image": {
        const featuredImageFieldSpec = getScalarFieldSpec("featured_image");
        const inputId = getFieldInputId({
          fieldKey,
          postId: selectedPost.id,
        });
        const featuredImageValue = selectedPost.featuredImageUrl ?? "";
        const isAdapterDrivenMappedContentField = Boolean(contentRuntime && featuredImageFieldSpec);
        const isAdapterReadOnly =
          featuredImageFieldSpec?.readOnly || featuredImageFieldSpec?.uiControl === "read_only";
        const featuredImageLabel = (
          <label htmlFor={inputId} className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Featured Image
          </label>
        );
        const featuredImageFileInput = (
          <input
            ref={featuredImageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (file) {
                void uploadFeaturedImage(file);
              }

              event.target.value = "";
            }}
          />
        );
        const featuredImagePreview = selectedPost.featuredImageUrl ? (
          <div
            className="group relative overflow-hidden rounded-md border border-border"
            style={{ aspectRatio: "1200 / 675" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedPost.featuredImageUrl}
              alt="Featured"
              className="h-full w-full object-cover"
            />
            {!isAdapterReadOnly ? (
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs"
                  disabled={!canEditCurrentPost || !canUploadFeaturedImage || uploadingFeaturedImage}
                  onClick={() => featuredImageInputRef.current?.click()}
                >
                  <Upload className="mr-1 h-3 w-3" />
                  Replace
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs"
                  disabled={!canEditCurrentPost}
                  onClick={() => updatePost(selectedPost.id, { featuredImageUrl: null })}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  Remove
                </Button>
              </div>
            ) : null}
          </div>
        ) : null;

        if (isAdapterDrivenMappedContentField) {
          if (isAdapterReadOnly) {
            const helperText = getReadOnlyFieldHelperText({
              editabilityState: featuredImageFieldSpec?.editabilityState,
              label: "Featured Image",
            });

            return (
              <div key={fieldKey}>
                {featuredImageLabel}
                <div className="rounded-md border border-dashed border-border bg-secondary px-3 py-4">
                  <p className="text-xs text-muted-foreground">{helperText}</p>
                  {selectedPost.featuredImageUrl ? (
                    <p className="mt-1.5 break-words text-xs text-foreground">
                      Current value: {selectedPost.featuredImageUrl}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          }

          return (
            <div key={fieldKey} className="space-y-2">
              {featuredImageLabel}
              {featuredImageFileInput}
              <Input
                id={inputId}
                value={featuredImageValue}
                onChange={(event) =>
                  updatePost(selectedPost.id, {
                    featuredImageUrl: event.target.value.trim() ? event.target.value : null,
                  })
                }
                placeholder="Paste an image URL or storage path"
                className="border-border text-xs"
                disabled={!canEditCurrentPost}
              />
              <p className="text-[11px] text-muted-foreground">
                Paste an image URL or storage path. If uploads are available for this project, you can also replace it from here.
              </p>
              {featuredImagePreview ? (
                featuredImagePreview
              ) : canUploadFeaturedImage ? (
                <button
                  type="button"
                  className={cn(
                    "flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-secondary/50 transition-colors",
                    featuredImageDragActive
                      ? "border-primary bg-primary/5"
                      : "hover:border-muted-foreground/40 hover:bg-muted/50",
                    (!canEditCurrentPost || uploadingFeaturedImage) &&
                      "pointer-events-none opacity-50",
                  )}
                  style={{ aspectRatio: "1200 / 675" }}
                  disabled={!canEditCurrentPost || uploadingFeaturedImage}
                  onClick={() => featuredImageInputRef.current?.click()}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onToggleFeaturedImageDragActive(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    event.dataTransfer.dropEffect = "copy";
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onToggleFeaturedImageDragActive(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onToggleFeaturedImageDragActive(false);
                    const file = event.dataTransfer.files[0];

                    if (file) {
                      void uploadFeaturedImage(file);
                    }
                  }}
                >
                  {uploadingFeaturedImage ? (
                    <Spinner className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {uploadingFeaturedImage ? "Uploading..." : "Click or drop image"}
                  </span>
                </button>
              ) : null}
            </div>
          );
        }

        return (
          <div key={fieldKey}>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Featured Image
            </label>
            {featuredImageFileInput}
            {selectedPost.featuredImageUrl ? (
              <div
                className="group relative overflow-hidden rounded-md border border-border"
                style={{ aspectRatio: "1200 / 675" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedPost.featuredImageUrl}
                  alt="Featured"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-7 text-xs"
                    disabled={!canEditCurrentPost || !canUploadFeaturedImage || uploadingFeaturedImage}
                    onClick={() => featuredImageInputRef.current?.click()}
                  >
                    <Upload className="mr-1 h-3 w-3" />
                    Replace
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs"
                    disabled={!canEditCurrentPost}
                    onClick={() => updatePost(selectedPost.id, { featuredImageUrl: null })}
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className={cn(
                  "flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-secondary/50 transition-colors",
                  featuredImageDragActive
                    ? "border-primary bg-primary/5"
                    : "hover:border-muted-foreground/40 hover:bg-muted/50",
                  (!canEditCurrentPost || !canUploadFeaturedImage || uploadingFeaturedImage) &&
                    "pointer-events-none opacity-50",
                )}
                style={{ aspectRatio: "1200 / 675" }}
                disabled={!canEditCurrentPost || !canUploadFeaturedImage || uploadingFeaturedImage}
                onClick={() => featuredImageInputRef.current?.click()}
                onDragEnter={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onToggleFeaturedImageDragActive(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  event.dataTransfer.dropEffect = "copy";
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onToggleFeaturedImageDragActive(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onToggleFeaturedImageDragActive(false);
                  const file = event.dataTransfer.files[0];

                  if (file) {
                    void uploadFeaturedImage(file);
                  }
                }}
              >
                {uploadingFeaturedImage ? (
                  <Spinner className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Upload className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="text-xs text-muted-foreground">
                  {uploadingFeaturedImage ? "Uploading..." : "Click or drop image"}
                </span>
              </button>
            )}
          </div>
        );
      }
      case "preview":
        return (
          <button
            key={fieldKey}
            type="button"
            disabled={!canOpenSelectedPostPreview}
            onClick={onHandleOpenPostPreview}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Eye className="h-3.5 w-3.5" />
                Preview
              </span>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">Open post in a new tab</p>
          </button>
        );
      case "revisions":
        return (
          <button
            key={fieldKey}
            type="button"
            disabled={!canOpenSelectedPostRevisions}
            onClick={onHandleOpenPostRevisions}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <History className="h-3.5 w-3.5" />
                Revisions
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">View and restore past versions</p>
          </button>
        );
      case "categories":
        if (getRelationFieldSpec("categories")?.uiControl === "read_only") {
          return renderReadOnlyRelationField({
            fieldKey: "categories",
            label: "Categories",
            values: selectedPost.categoryIds.map((categoryId) => {
              const category = categoryOptions.find((entry) => entry.id === categoryId);
              return category ? formatCategoryHierarchyLabel(category) : categoryId;
            }),
          });
        }

        const categoriesFieldSpec = getRelationFieldSpec("categories");
        const searchInputId = getFieldInputId({
          fieldKey,
          postId: selectedPost.id,
          suffix: "search",
        });

        return (
          <div key={fieldKey} className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Categories</p>
            {categoriesFieldSpec ? (
              <ProjectEditorRelationField
                canEditCurrentPost={canEditCurrentPost}
                emptyStateMessage={
                  isRequiredRelationFieldWithoutOptions({
                    fieldKey: "categories",
                    optionCount: categoryOptions.length,
                  })
                    ? "This mapped categories field is required, but no valid categories are available."
                    : "Create categories from the Categories page to assign them here."
                }
                fieldKey="categories"
                fieldSpec={categoriesFieldSpec}
                inputId={getFieldInputId({
                  fieldKey,
                  postId: selectedPost.id,
                })}
                label="Categories"
                onChange={(value) =>
                  updatePost(selectedPost.id, {
                    categoryIds:
                      Array.isArray(value)
                        ? value
                        : typeof value === "string" && value.trim()
                          ? [value.trim()]
                          : [],
                  })
                }
                onSearchChange={onPostCategoriesSearchQueryChange}
                options={categoryOptions.map((category) => ({
                  id: category.id,
                  label: formatCategoryHierarchyLabel(category),
                }))}
                projectId={projectId}
                searchInputId={searchInputId}
                searchPlaceholder="Search categories"
                searchValue={postCategoriesSearchQuery}
                selectedPostId={selectedPost.id}
                value={categoriesFieldSpec.multiple ? selectedPost.categoryIds : selectedPost.categoryIds[0] ?? null}
              />
            ) : null}
          </div>
        );
      case "tags": {
        if (getRelationFieldSpec("tags")?.uiControl === "read_only") {
          return renderReadOnlyRelationField({
            fieldKey: "tags",
            label: "Tags",
            values: selectedPost.tagIds.map((tagId) => tags.find((entry) => entry.id === tagId)?.name ?? tagId),
          });
        }

        const searchInputId = getFieldInputId({
          fieldKey,
          postId: selectedPost.id,
          suffix: "search",
        });
        const tagFieldSpec = getRelationFieldSpec("tags");

        return (
          <div key={fieldKey} className="space-y-3">
            <label htmlFor={searchInputId} className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Tags
            </label>
            {tagFieldSpec ? (
              <ProjectEditorRelationField
                canEditCurrentPost={canEditCurrentPost}
                emptyStateMessage={
                  isRequiredRelationFieldWithoutOptions({
                    fieldKey: "tags",
                    optionCount: tags.length,
                  })
                    ? "This mapped tags field is required, but no valid tags are available."
                    : "Create tags from the Tags page to assign them here."
                }
                fieldKey="tags"
                fieldSpec={tagFieldSpec}
                inputId={getFieldInputId({
                  fieldKey,
                  postId: selectedPost.id,
                })}
                label="Tags"
                noResultsMessage="No tags match this search."
                onChange={(value) =>
                  updatePost(selectedPost.id, {
                    tagIds:
                      Array.isArray(value)
                        ? value
                        : typeof value === "string" && value.trim()
                          ? [value.trim()]
                          : [],
                  })
                }
                onSearchChange={onPostTagsSearchQueryChange}
                optionStyle="badges"
                options={filteredTags.map((tag) => ({
                  id: tag.id,
                  label: tag.name,
                }))}
                projectId={projectId}
                searchInputId={searchInputId}
                searchPlaceholder="Search tags"
                searchValue={postTagsSearchQuery}
                selectedPostId={selectedPost.id}
                totalOptionCount={tags.length}
                value={tagFieldSpec.multiple ? selectedPost.tagIds : selectedPost.tagIds[0] ?? null}
              />
            ) : null}
          </div>
        );
      }
      case "focus_keyword": {
        const focusKeywordFieldSpec = getScalarFieldSpec("focus_keyword");
        const focusKeywordConflict = getFieldConflict("focusKeyword");
        const inputId = getFieldInputId({
          fieldKey,
          postId: selectedPost.id,
        });

        if (focusKeywordConflict?.code === "helper_row_ambiguity") {
          return renderReadOnlyScalarField({
            fieldKey,
            helperText: getDuplicateFieldRecordsHelperText("Focus Keyword"),
            label: "Focus Keyword",
            value: selectedPost.focusKeyword,
          });
        }

        if (focusKeywordFieldSpec?.readOnly || focusKeywordFieldSpec?.uiControl === "read_only") {
          return renderReadOnlyScalarField({
            fieldKey,
            helperText: getReadOnlyFieldHelperText({
              editabilityState: focusKeywordFieldSpec.editabilityState,
              label: "Focus Keyword",
            }),
            label: "Focus Keyword",
            value: selectedPost.focusKeyword,
          });
        }

        return (
          <div key={fieldKey}>
            <ProjectEditorTextInputField
              id={inputId}
              value={selectedPost.focusKeyword ?? ""}
              label="Focus Keyword"
              onChange={(event) => updatePost(selectedPost.id, { focusKeyword: event.target.value })}
              placeholder="e.g. content strategy"
              inputClassName="h-8 border-border text-xs"
              disabled={!canEditCurrentPost}
              helperText={
                focusKeywordStoredInDatabase
                  ? "The main keyword or phrase this post targets."
                  : "Used for SEO analysis in this editor. It will not be saved with the post until an owner connects this field."
              }
            />
          </div>
        );
      }
      case "seo_analysis":
        return (
          <div key={fieldKey} className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">SEO Analysis</p>
              {yoastSeoScore !== null ? (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    getScoreToneClasses({
                      strongThreshold: 70,
                      value: yoastSeoScore,
                      warningThreshold: 40,
                    }),
                  )}
                >
                  {yoastSeoScore >= 70 ? "Good" : yoastSeoScore >= 40 ? "Needs work" : "Poor"} · {yoastSeoScore}
                </span>
              ) : null}
            </div>
            {renderAnalysisResults({
              emptyMessage: "Add a focus keyword and content to see SEO checks.",
              isAnalyzing: isYoastAnalyzing,
              results: yoastSeoResults,
            })}
          </div>
        );
      case "readability_analysis":
        return (
          <div key={fieldKey} className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Readability</p>
              {yoastReadabilityScore !== null ? (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    getScoreToneClasses({
                      strongThreshold: 90,
                      value: yoastReadabilityScore,
                      warningThreshold: 60,
                    }),
                  )}
                >
                  {yoastReadabilityScore >= 90 ? "Good" : yoastReadabilityScore >= 60 ? "Needs work" : "Poor"}
                </span>
              ) : null}
            </div>
            {renderAnalysisResults({
              emptyMessage: "Add content to see readability checks.",
              isAnalyzing: isYoastAnalyzing,
              results: yoastReadabilityResults,
            })}
          </div>
        );
      case "meta_title": {
        const seoTitleFieldSpec = getScalarFieldSpec("meta_title");
        const seoTitleConflict = getFieldConflict("seoTitle");
        const inputId = getFieldInputId({
          fieldKey,
          postId: selectedPost.id,
        });
        const valueLength = (selectedPost.seoTitle ?? "").length;

        if (seoTitleConflict?.code === "helper_row_ambiguity") {
          return renderReadOnlyScalarField({
            fieldKey,
            helperText: getDuplicateFieldRecordsHelperText("Meta Title"),
            label: "Meta Title",
            value: selectedPost.seoTitle,
          });
        }

        if (seoTitleFieldSpec?.readOnly || seoTitleFieldSpec?.uiControl === "read_only") {
          return renderReadOnlyScalarField({
            fieldKey,
            helperText: getReadOnlyFieldHelperText({
              editabilityState: seoTitleFieldSpec.editabilityState,
              label: "Meta Title",
            }),
            label: "Meta Title",
            value: selectedPost.seoTitle,
          });
        }

        return (
          <div key={fieldKey}>
            <ProjectEditorTextInputField
              id={inputId}
              value={selectedPost.seoTitle ?? ""}
              label="Meta Title"
              onChange={(event) => updatePost(selectedPost.id, { seoTitle: event.target.value })}
              placeholder={selectedPost.title || "Enter meta title"}
              inputClassName="h-8 border-border text-xs"
              disabled={!canEditCurrentPost}
              footer={
                <div>
                  <div className="mb-1 h-1 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        valueLength > 60
                          ? "bg-destructive"
                          : valueLength > 50
                            ? "bg-warning"
                            : "bg-success",
                      )}
                      style={{
                        width: `${Math.min((valueLength / 60) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Defaults to post title if blank</p>
                    <p
                      className={cn(
                        "text-xs",
                        valueLength > 60
                          ? "text-destructive"
                          : valueLength > 50
                            ? "text-warning"
                            : "text-muted-foreground",
                      )}
                    >
                      {valueLength} / 60
                    </p>
                  </div>
                </div>
              }
            />
          </div>
        );
      }
      case "meta_description": {
        const seoDescriptionFieldSpec = getScalarFieldSpec("meta_description");
        const seoDescriptionConflict = getFieldConflict("seoDescription");
        const inputId = getFieldInputId({
          fieldKey,
          postId: selectedPost.id,
        });
        const valueLength = (selectedPost.seoDescription ?? "").length;

        if (seoDescriptionConflict?.code === "helper_row_ambiguity") {
          return renderReadOnlyScalarField({
            fieldKey,
            helperText: getDuplicateFieldRecordsHelperText("Meta Description"),
            label: "Meta Description",
            value: selectedPost.seoDescription,
          });
        }

        if (seoDescriptionFieldSpec?.readOnly || seoDescriptionFieldSpec?.uiControl === "read_only") {
          return renderReadOnlyScalarField({
            fieldKey,
            helperText: getReadOnlyFieldHelperText({
              editabilityState: seoDescriptionFieldSpec.editabilityState,
              label: "Meta Description",
            }),
            label: "Meta Description",
            value: selectedPost.seoDescription,
          });
        }

        return (
          <div key={fieldKey}>
            <ProjectEditorTextareaField
              id={inputId}
              value={selectedPost.seoDescription ?? ""}
              label="Meta Description"
              onChange={(event) => updatePost(selectedPost.id, { seoDescription: event.target.value })}
              placeholder={selectedPost.excerpt ?? "Enter meta description"}
              textareaClassName="min-h-24 resize-none border-border text-xs"
              disabled={!canEditCurrentPost}
              footer={
                <div>
                  <div className="mb-1 h-1 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        valueLength > 155
                          ? "bg-destructive"
                          : valueLength > 130
                            ? "bg-warning"
                            : "bg-success",
                      )}
                      style={{
                        width: `${Math.min((valueLength / 155) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Defaults to excerpt if blank</p>
                    <p
                      className={cn(
                        "text-xs",
                        valueLength > 155
                          ? "text-destructive"
                          : valueLength > 130
                            ? "text-warning"
                            : "text-muted-foreground",
                      )}
                    >
                      {valueLength} / 155
                    </p>
                  </div>
                </div>
              }
            />
          </div>
        );
      }
      default:
        return fieldKey.startsWith("custom_field:")
          ? renderCustomField(fieldKey)
          : null;
    }
  };

  const renderPageEntry = ({
    showTopDivider,
    itemCount,
    pageId,
    label,
  }: {
    itemCount: number;
    label: string;
    pageId: string;
    showTopDivider: boolean;
  }) => (
    <button
      key={pageId}
      type="button"
      onClick={() => onPostSidePanelViewChange(`page:${pageId}`)}
      className={cn(
        "-mx-4 flex w-[calc(100%+2rem)] items-center justify-between border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        showTopDivider && "border-t",
      )}
    >
      <div className="flex min-w-0 flex-col items-start gap-1">
        <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <Folder className="h-3.5 w-3.5" />
          {label}
        </span>
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {itemCount} sidebar item{itemCount === 1 ? "" : "s"}
        </p>
      </div>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    </button>
  );

  const renderCurrentNode = (node: (typeof currentNodes)[number], index: number) => {
    if (node.kind === "page") {
      const childCount = getProjectEditorPostSidebarChildNodes({
        nodes: resolvedNodes,
        parentId: node.id,
      }).filter((childNode) => childNode.kind === "field" || hasSidebarPageContent(childNode.id)).length;
      const previousNode = currentNodes[index - 1];

      return renderPageEntry({
        itemCount: childCount,
        label: node.label,
        pageId: node.id,
        showTopDivider: previousNode?.kind !== "page",
      });
    }

    return renderConfiguredSidebarField(node.id);
  };

  const backTargetLabel = currentParentPage?.label ?? "Post Details";

  return (
    <aside className="min-h-0 w-72 flex-shrink-0 overflow-y-auto overscroll-contain border-l border-border bg-card">
      <div className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground">
            {currentPage ? (
              <>
                <Folder className="h-4 w-4" />
                {currentPage.label}
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Post Details
              </>
            )}
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            aria-label="Close panel"
            onClick={onClose}
          >
            <ChevronDown className="h-3.5 w-3.5" />
            <span className="sr-only">Close panel</span>
          </Button>
        </div>

        <div className="space-y-4">
          {currentPage ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 justify-start gap-2 px-2 text-xs"
              onClick={() =>
                onPostSidePanelViewChange(currentParentPage ? `page:${currentParentPage.id}` : "details")
              }
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {backTargetLabel}
            </Button>
          ) : null}

          {currentNodes.length ? (
            <div className="space-y-4">
              {currentNodes.map((node, index) => renderCurrentNode(node, index))}
            </div>
          ) : currentPage ? (
            <div className="rounded-md border border-dashed border-border bg-secondary px-3 py-4">
              <p className="text-xs text-muted-foreground">
                Move fields or pages into this sidebar page from settings to show them here.
              </p>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border bg-secondary px-3 py-4">
              <p className="text-xs text-muted-foreground">
                All sidebar fields are hidden right now. Open Sidebar Fields in settings to show them again.
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
