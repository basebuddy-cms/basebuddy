import type {
  ContentAuthor,
  ContentCategory,
  ContentPrimaryContentFormat,
  ContentFieldSpecSummary,
  ContentPost,
  ContentRelationFieldKey,
  ContentRelationOption,
  ContentTag,
  ContentWorkspaceMeta,
  ContentWorkspaceState,
} from "@/lib/content-runtime/shared";
import type { ContentFieldSemanticRole } from "@/lib/content-runtime/field-contract";
import {
  findContentFieldSpecBySemanticRole,
  isContentPostEditorPayloadReady,
} from "@/lib/content-runtime/shared";
import type { ContentMappingEntityStatus } from "@/lib/content-runtime/mapping";
import { projectEditorLocalCachePrefixes } from "./queries";

import type {
  CollectionLabel,
  ProjectEditorPostFieldStates,
  ProjectEditorSemanticFieldState,
  ProjectEditorPostsListUiCapabilities,
  SettingsTabKey,
  SidebarItem,
  TaxonomyCollectionLabel,
} from "./types";

export type ProjectEditorCollectionAvailability = "hidden" | "ready" | "unmapped";

export type ProjectEditorRouteState = {
  routePostId: string | null;
  routePostsPage: number | null;
  routeSection: SidebarItem;
};

export const resolveWorkspaceState = (payload: Partial<ContentWorkspaceMeta>) => {
  if (payload.workspaceState) {
    return payload.workspaceState;
  }

  return "mapping_draft" satisfies ContentWorkspaceState;
};

export const formatPostDate = (date: string) =>
  new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));

export const formatRevisionDate = (date: string) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));

export const formatMappingLabel = (value: string) =>
  value
    .split("_")
    .filter(Boolean)
    .map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : ""))
    .join(" ");

export const formatMappingValue = (value: unknown, emptyLabel = "Not detected"): string => {
  if (value === null || value === undefined) {
    return emptyLabel;
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized || emptyLabel;
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    const normalized = value.map((entry) => formatMappingValue(entry, "")).filter(Boolean);
    return normalized.length ? normalized.join(", ") : emptyLabel;
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return emptyLabel;
    }
  }

  return String(value);
};

export const getMappingStatusBadgeClassName = (status: ContentMappingEntityStatus) => {
  if (status === "mapped") {
    return "border-transparent bg-success/10 font-medium capitalize text-success hover:bg-success/10";
  }

  if (status === "limited") {
    return "border-transparent bg-warning/10 font-medium capitalize text-warning hover:bg-warning/10";
  }

  if (status === "unsupported") {
    return "border-transparent bg-destructive/10 font-medium capitalize text-destructive hover:bg-destructive/10";
  }

  if (status === "detecting") {
    return "border-transparent bg-secondary font-medium capitalize text-foreground hover:bg-secondary";
  }

  return "border-transparent bg-muted font-medium capitalize text-muted-foreground hover:bg-muted";
};

export const getPostStatusBadgeClassName = (status: ContentPost["status"]) => {
  if (status === "published") {
    return "gap-1.5 border-transparent bg-success/10 capitalize font-medium text-success hover:bg-success/10";
  }

  if (status === "draft") {
    return "gap-1.5 border-transparent bg-warning/10 capitalize font-medium text-warning hover:bg-warning/10";
  }

  return "gap-1.5 border-transparent bg-secondary font-medium capitalize text-muted-foreground hover:bg-secondary";
};

export const getPostStatusDotClassName = (status: ContentPost["status"]) => {
  if (status === "published") {
    return "h-1.5 w-1.5 rounded-full bg-success";
  }

  if (status === "draft") {
    return "h-1.5 w-1.5 rounded-full bg-warning";
  }

  return "h-1.5 w-1.5 rounded-full bg-muted-foreground";
};

export const getPostTitle = (title: string) => title.trim() || "Untitled";

export const getAvatarUrl = (value: string | null | undefined) => {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : null;
};

export const shouldShowUnresolvedPostsListSkeleton = ({
  hasResolvedCollectionSnapshot,
  postsPageDataReady,
  postsPageLoadFailed,
  shouldQueryPostsPage,
}: {
  hasResolvedCollectionSnapshot: boolean;
  postsPageDataReady: boolean;
  postsPageLoadFailed: boolean;
  shouldQueryPostsPage: boolean;
}) =>
  shouldQueryPostsPage &&
  !postsPageDataReady &&
  !hasResolvedCollectionSnapshot &&
  !postsPageLoadFailed;

export const isSelectedPostEditorHydrated = ({
  post,
  postEditorOptionsReady,
  routePostId,
}: {
  post: Pick<ContentPost, "editorPayloadReady" | "id"> | null | undefined;
  postEditorOptionsReady: boolean;
  routePostId: string | null;
}) =>
  Boolean(
    routePostId &&
      post?.id === routePostId &&
      isContentPostEditorPayloadReady(post) &&
      postEditorOptionsReady,
  );

export const shouldApplySelectedPostEditorOptionsPayload = ({
  payloadEditorOptionsReady,
  payloadPostId,
  post,
  postEditorOptionsReady,
  routePostId,
}: {
  payloadEditorOptionsReady: boolean;
  payloadPostId: string | null | undefined;
  post: Pick<ContentPost, "editorPayloadReady" | "id"> | null | undefined;
  postEditorOptionsReady: boolean;
  routePostId: string | null;
}) =>
  Boolean(
    routePostId &&
      payloadEditorOptionsReady &&
      payloadPostId === routePostId &&
      !isSelectedPostEditorHydrated({
        post,
        postEditorOptionsReady,
        routePostId,
      }),
  );

export const getCollectionPromptLabel = (collection: CollectionLabel) => {
  if (collection === "Authors") {
    return "author";
  }

  if (collection === "Categories") {
    return "category";
  }

  if (collection === "Tags") {
    return "tag";
  }

  return "entry";
};

export const getTaxonomyNoun = (collection: TaxonomyCollectionLabel, plural = false) => {
  if (collection === "Categories") {
    return plural ? "categories" : "category";
  }

  return plural ? "tags" : "tag";
};

export const getCollectionApiName = (collection: CollectionLabel) => {
  if (collection === "Authors") {
    return "authors";
  }

  if (collection === "Categories") {
    return "categories";
  }

  if (collection === "Tags") {
    return "tags";
  }

  return null;
};

export const getProjectEditorCollectionAvailability = ({
  canManageAuthorDirectory,
  collection,
  contentRuntime,
  isContentProject,
  workspaceState,
}: {
  canManageAuthorDirectory: boolean;
  collection: CollectionLabel;
  contentRuntime: ContentWorkspaceMeta["contentRuntime"];
  isContentProject: boolean;
  workspaceState: ContentWorkspaceState | null;
}): ProjectEditorCollectionAvailability => {
  if (collection === "Authors" && !canManageAuthorDirectory) {
    return "hidden";
  }

  if (!isContentProject || collection === "Posts") {
    return "ready";
  }

  if (workspaceState === "mapping_draft") {
    return "unmapped";
  }

  const author = getProjectEditorSemanticFieldState(
    getProjectEditorFieldSpecBySemanticRole({ contentRuntime, semanticRole: "author" }),
  );
  const categories = getProjectEditorSemanticFieldState(
    getProjectEditorFieldSpecBySemanticRole({ contentRuntime, semanticRole: "categories" }),
  );
  const tags = getProjectEditorSemanticFieldState(
    getProjectEditorFieldSpecBySemanticRole({ contentRuntime, semanticRole: "tags" }),
  );

  if (collection === "Authors") {
    return author.mapped ? "ready" : "unmapped";
  }

  if (collection === "Categories") {
    return categories.mapped ? "ready" : "unmapped";
  }

  if (collection === "Tags") {
    return tags.mapped ? "ready" : "unmapped";
  }

  if (collection === "Media") {
    return contentRuntime?.mediaStorage?.supportsLibrary ? "ready" : "unmapped";
  }

  if (collection === "Files") {
    return contentRuntime?.filesStorage?.supportsLibrary ? "ready" : "unmapped";
  }

  return "ready";
};

const getProjectEditorSemanticFieldState = (
  fieldSpec: ContentFieldSpecSummary | undefined | null,
): ProjectEditorSemanticFieldState => ({
  editable: Boolean(
    fieldSpec &&
      fieldSpec.visible &&
      fieldSpec.readOnly !== true &&
      fieldSpec.editabilityState !== "read_only" &&
      fieldSpec.editabilityState !== "unsupported",
  ),
  mapped: Boolean(fieldSpec),
  visible: fieldSpec?.visible === true,
});

const getProjectEditorFieldSpecBySemanticRole = ({
  contentRuntime,
  semanticRole,
}: {
  contentRuntime: ContentWorkspaceMeta["contentRuntime"];
  semanticRole: ContentFieldSemanticRole;
}) => {
  const fieldSpecs = contentRuntime?.fieldSpecs ?? [];

  return findContentFieldSpecBySemanticRole({
    fieldSpecs,
    semanticRole,
  });
};

export const getProjectEditorPostsListUiCapabilities = ({
  contentRuntime,
  isContentProject,
}: {
  contentRuntime: ContentWorkspaceMeta["contentRuntime"];
  isContentProject: boolean;
}): ProjectEditorPostsListUiCapabilities => {
  if (!isContentProject) {
    return {
      showAuthorColumn: true,
      showSlugColumn: true,
      showStatusControls: true,
    };
  }

  const author = getProjectEditorSemanticFieldState(
    getProjectEditorFieldSpecBySemanticRole({ contentRuntime, semanticRole: "author" }),
  );
  const slug = getProjectEditorSemanticFieldState(
    getProjectEditorFieldSpecBySemanticRole({ contentRuntime, semanticRole: "slug" }),
  );
  const status = getProjectEditorSemanticFieldState(
    getProjectEditorFieldSpecBySemanticRole({ contentRuntime, semanticRole: "status" }),
  );

  return {
    showAuthorColumn: author.visible,
    showSlugColumn: slug.visible,
    showStatusControls: status.editable,
  };
};

export const getProjectEditorMainFieldSpecs = ({
  contentRuntime,
  isContentProject,
  primaryContentFormat,
}: {
  contentRuntime: ContentWorkspaceMeta["contentRuntime"];
  isContentProject: boolean;
  primaryContentFormat: ContentPrimaryContentFormat;
}): ContentFieldSpecSummary[] => {
  if (!isContentProject) {
    return [
      {
        allowedValues: null,
        contentFormat: null,
        editabilityState: "editable",
        fieldKey: "title",
        label: "Title",
        multiple: false,
        nullable: false,
        patchMode: "replace",
        readOnly: false,
        relationMode: "none",
        required: true,
        searchMode: "none",
        semanticRole: "title",
        uiControl: "text_input",
        valueKind: "text_like",
        visible: true,
      },
      {
        allowedValues: null,
        contentFormat: primaryContentFormat,
        editabilityState: "editable",
        fieldKey: "content",
        label: "Content",
        multiple: false,
        nullable: true,
        patchMode: "replace",
        readOnly: false,
        relationMode: "none",
        required: false,
        searchMode: "none",
        semanticRole: "content",
        uiControl: "content_editor",
        valueKind: "content",
        visible: true,
      },
    ];
  }

  return (contentRuntime?.fieldSpecs ?? []).filter(
    (fieldSpec) =>
      fieldSpec.visible &&
      (fieldSpec.semanticRole === "title" || fieldSpec.valueKind === "content"),
  );
};

const createDefaultProjectEditorSemanticFieldState = (): ProjectEditorSemanticFieldState => ({
  editable: true,
  mapped: true,
  visible: true,
});

export const getProjectEditorPostFieldStates = ({
  contentRuntime,
  isContentProject,
}: {
  contentRuntime: ContentWorkspaceMeta["contentRuntime"];
  isContentProject: boolean;
}): ProjectEditorPostFieldStates => {
  if (!isContentProject) {
    return {
      excerpt: createDefaultProjectEditorSemanticFieldState(),
      focusKeyword: createDefaultProjectEditorSemanticFieldState(),
      seoDescription: createDefaultProjectEditorSemanticFieldState(),
      seoTitle: createDefaultProjectEditorSemanticFieldState(),
      slug: createDefaultProjectEditorSemanticFieldState(),
      status: createDefaultProjectEditorSemanticFieldState(),
      title: createDefaultProjectEditorSemanticFieldState(),
    };
  }

  const title = getProjectEditorSemanticFieldState(
    getProjectEditorFieldSpecBySemanticRole({ contentRuntime, semanticRole: "title" }),
  );
  const excerpt = getProjectEditorSemanticFieldState(
    getProjectEditorFieldSpecBySemanticRole({ contentRuntime, semanticRole: "excerpt" }),
  );
  const slug = getProjectEditorSemanticFieldState(
    getProjectEditorFieldSpecBySemanticRole({ contentRuntime, semanticRole: "slug" }),
  );
  const seoTitle = getProjectEditorSemanticFieldState(
    getProjectEditorFieldSpecBySemanticRole({ contentRuntime, semanticRole: "seoTitle" }),
  );
  const seoDescription = getProjectEditorSemanticFieldState(
    getProjectEditorFieldSpecBySemanticRole({ contentRuntime, semanticRole: "seoDescription" }),
  );
  const focusKeyword = getProjectEditorSemanticFieldState(
    getProjectEditorFieldSpecBySemanticRole({ contentRuntime, semanticRole: "focusKeyword" }),
  );
  const status = getProjectEditorSemanticFieldState(
    getProjectEditorFieldSpecBySemanticRole({ contentRuntime, semanticRole: "status" }),
  );

  return {
    excerpt,
    focusKeyword,
    seoDescription,
    seoTitle,
    slug,
    status,
    title,
  };
};

export const getProjectEditorCustomFieldSpecs = ({
  contentRuntime,
  includeHidden = false,
}: {
  contentRuntime: ContentWorkspaceMeta["contentRuntime"];
  includeHidden?: boolean;
}): ContentFieldSpecSummary[] =>
  (contentRuntime?.fieldSpecs ?? []).filter(
    (fieldSpec) => fieldSpec.isCustomField === true && (includeHidden || fieldSpec.visible),
  );

export const isProjectEditorCustomFieldValueMissing = (input: {
  fieldSpec: ContentFieldSpecSummary;
  value: unknown;
}) => {
  const { value } = input;

  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === "string") {
    return value.trim().length === 0;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  return false;
};

export const hasProjectEditorRemoteRelationSearch = ({
  contentRuntime,
  fieldKey,
}: {
  contentRuntime: ContentWorkspaceMeta["contentRuntime"];
  fieldKey: ContentRelationFieldKey;
}) =>
  contentRuntime?.fieldSpecs?.some(
    (fieldSpec) =>
      fieldSpec.fieldKey === fieldKey &&
      fieldSpec.visible &&
      fieldSpec.searchMode === "remote",
  ) ?? false;

const dedupeProjectEditorEntitiesById = <T extends { id: string }>(entities: T[]) => {
  const seenIds = new Set<string>();

  return entities.filter((entity) => {
    if (seenIds.has(entity.id)) {
      return false;
    }

    seenIds.add(entity.id);
    return true;
  });
};

const getStaleSelectedRelationIds = <T extends { id: string }>({
  options,
  selectedIds,
}: {
  options: T[];
  selectedIds: string[];
}) => {
  const optionIds = new Set(options.map((option) => option.id));

  return [...new Set(selectedIds.map((value) => value.trim()).filter(Boolean))].filter(
    (selectedId) => !optionIds.has(selectedId),
  );
};

const getProjectEditorRelationOptionStringMetadata = (
  option: ContentRelationOption,
  key: string,
) => {
  const value = option.metadata?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};

const getProjectEditorRelationOptionNumberMetadata = (
  option: ContentRelationOption,
  key: string,
) => {
  const value = option.metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const buildProjectEditorAuthorFromRelationOption = (
  option: ContentRelationOption,
): ContentAuthor => ({
  avatarUrl: null,
  bio: null,
  createdAt: "",
  email: getProjectEditorRelationOptionStringMetadata(option, "email"),
  id: option.id,
  name: option.label.trim() || option.id,
  slug: getProjectEditorRelationOptionStringMetadata(option, "slug") ?? option.id,
});

const buildProjectEditorCategoryFromRelationOption = (
  option: ContentRelationOption,
): ContentCategory => {
  const hierarchyPath =
    getProjectEditorRelationOptionStringMetadata(option, "hierarchyPath") ??
    option.label.trim() ??
    option.id;

  return {
    createdAt: "",
    depth: getProjectEditorRelationOptionNumberMetadata(option, "depth") ?? 0,
    description: null,
    hierarchyPath,
    id: option.id,
    name: getProjectEditorRelationOptionStringMetadata(option, "name") ?? hierarchyPath,
    parentCategoryId: getProjectEditorRelationOptionStringMetadata(option, "parentCategoryId"),
    slug: getProjectEditorRelationOptionStringMetadata(option, "slug") ?? option.id,
  };
};

const buildProjectEditorTagFromRelationOption = (
  option: ContentRelationOption,
): ContentTag => ({
  createdAt: "",
  description: null,
  id: option.id,
  name: option.label.trim() || option.id,
  slug: getProjectEditorRelationOptionStringMetadata(option, "slug") ?? option.id,
});

export const getProjectEditorAuthorOptionsFromRelationOptions = ({
  fallbackOptions,
  relationOptions,
  selectedAuthorId,
}: {
  fallbackOptions: ContentAuthor[];
  relationOptions: ContentRelationOption[] | null | undefined;
  selectedAuthorId: string | null;
}) => {
  const normalizedOptions = relationOptions
    ? dedupeProjectEditorEntitiesById([
        ...fallbackOptions.filter((author) => author.id === selectedAuthorId),
        ...relationOptions.map(buildProjectEditorAuthorFromRelationOption),
      ])
    : fallbackOptions;
  const staleSelectedIds = getStaleSelectedRelationIds({
    options: normalizedOptions,
    selectedIds: selectedAuthorId ? [selectedAuthorId] : [],
  });

  return dedupeProjectEditorEntitiesById([
    ...normalizedOptions,
    ...staleSelectedIds.map((staleSelectedId) => ({
      avatarUrl: null,
      bio: null,
      createdAt: "",
      email: null,
      id: staleSelectedId,
      name: staleSelectedId,
      slug: staleSelectedId,
    })),
  ]);
};

export const getProjectEditorCategoryOptionsFromRelationOptions = ({
  fallbackOptions,
  relationOptions,
  selectedCategoryIds,
}: {
  fallbackOptions: ContentCategory[];
  relationOptions: ContentRelationOption[] | null | undefined;
  selectedCategoryIds: string[];
}) => {
  const selectedCategoryIdSet = new Set(selectedCategoryIds);
  const normalizedOptions = relationOptions
    ? dedupeProjectEditorEntitiesById([
        ...fallbackOptions.filter((category) => selectedCategoryIdSet.has(category.id)),
        ...relationOptions.map(buildProjectEditorCategoryFromRelationOption),
      ])
    : fallbackOptions;
  const staleSelectedIds = getStaleSelectedRelationIds({
    options: normalizedOptions,
    selectedIds: selectedCategoryIds,
  });

  return dedupeProjectEditorEntitiesById([
    ...normalizedOptions,
    ...staleSelectedIds.map((staleSelectedId) => ({
      createdAt: "",
      depth: 0,
      description: null,
      hierarchyPath: staleSelectedId,
      id: staleSelectedId,
      name: staleSelectedId,
      parentCategoryId: null,
      slug: staleSelectedId,
    })),
  ]);
};

export const getProjectEditorTagOptionsFromRelationOptions = ({
  fallbackOptions,
  relationOptions,
  selectedTagIds,
}: {
  fallbackOptions: ContentTag[];
  relationOptions: ContentRelationOption[] | null | undefined;
  selectedTagIds: string[];
}) => {
  const selectedTagIdSet = new Set(selectedTagIds);
  const normalizedOptions = relationOptions
    ? dedupeProjectEditorEntitiesById([
        ...fallbackOptions.filter((tag) => selectedTagIdSet.has(tag.id)),
        ...relationOptions.map(buildProjectEditorTagFromRelationOption),
      ])
    : fallbackOptions;
  const staleSelectedIds = getStaleSelectedRelationIds({
    options: normalizedOptions,
    selectedIds: selectedTagIds,
  });

  return dedupeProjectEditorEntitiesById([
    ...normalizedOptions,
    ...staleSelectedIds.map((staleSelectedId) => ({
      createdAt: "",
      description: null,
      id: staleSelectedId,
      name: staleSelectedId,
      slug: staleSelectedId,
    })),
  ]);
};

export const getProjectEditorParentPageOptionsFromRelationOptions = ({
  relationOptions,
  selectedParentPageId,
  selectedPostId,
}: {
  relationOptions: ContentRelationOption[] | null | undefined;
  selectedParentPageId: string | null;
  selectedPostId: string | null;
}) => {
  const normalizedOptions = relationOptions
    ? dedupeProjectEditorEntitiesById(
        relationOptions
          .filter((option) => option.id !== selectedPostId)
          .map((option) => ({
            id: option.id,
            label: option.label.trim() || option.id,
            metadata: option.metadata,
          })),
      )
    : [];
  const staleSelectedIds = getStaleSelectedRelationIds({
    options: normalizedOptions,
    selectedIds: selectedParentPageId ? [selectedParentPageId] : [],
  });

  return dedupeProjectEditorEntitiesById([
    ...normalizedOptions,
    ...staleSelectedIds
      .filter((staleSelectedId) => staleSelectedId !== selectedPostId)
      .map((staleSelectedId) => ({
        id: staleSelectedId,
        label: staleSelectedId,
      })),
  ]);
};

export const shouldRequirePostsMappingBeforeCollectionSetup = (
  collection: Exclude<CollectionLabel, "Posts">,
) => collection === "Authors" || collection === "Categories" || collection === "Tags";

export const getProjectEditorMappingDialogEntryCollection = ({
  collection,
  workspaceState,
}: {
  collection: CollectionLabel;
  workspaceState: ContentWorkspaceState | null;
}): CollectionLabel =>
  workspaceState === "mapping_draft" &&
  (collection === "Authors" || collection === "Categories" || collection === "Tags")
    ? "Posts"
    : collection;

export const getProjectEditorCollectionSetupCopy = (
  collection: Exclude<CollectionLabel, "Posts">,
  options?: {
    workspaceState?: ContentWorkspaceState | null;
  },
) => {
  if (
    options?.workspaceState === "mapping_draft" &&
    shouldRequirePostsMappingBeforeCollectionSetup(collection)
  ) {
    return {
      actionLabel: "Map Posts",
      description:
        "Map posts first so BaseBuddy can connect related content like authors, categories, and tags afterward.",
      title: "Map posts first",
    };
  }

  if (collection === "Authors") {
    return {
      actionLabel: "Map Authors",
      description:
        "Connect your author source to show author profiles, assignments, and author-scoped access in BaseBuddy.",
      title: "Authors need mapping",
    };
  }

  if (collection === "Categories") {
    return {
      actionLabel: "Map Categories",
      description:
        "Connect your categories source so this project can browse and organize post categories in BaseBuddy.",
      title: "Categories need mapping",
    };
  }

  if (collection === "Tags") {
    return {
      actionLabel: "Map Tags",
      description:
        "Connect your tags source so this project can browse and label content with tags in BaseBuddy.",
      title: "Tags need mapping",
    };
  }

  if (collection === "Media") {
    return {
      actionLabel: "Map Media",
      description:
        "Choose media storage so this project can browse images and upload new media from BaseBuddy.",
      title: "Media needs mapping",
    };
  }

  return {
    actionLabel: "Map Files",
    description:
      "Choose file storage so this project can browse documents and upload new files from BaseBuddy.",
    title: "Files need mapping",
  };
};

export const getProjectEditorWorkspaceNotReadyCopy = (workspaceState: ContentWorkspaceState | null) => {
  void workspaceState;

  return {
    description: "Finish content mapping before the editor can load content.",
    title: "Project mapping is not ready yet",
  };
};

export const formatCategoryHierarchyLabel = (category: ContentCategory) =>
  `${"—".repeat(Math.max(0, category.depth))}${category.depth > 0 ? " " : ""}${category.name}`;

export const getEditorSectionFromSegment = (value: string | null | undefined) => {
  switch ((value ?? "").trim().toLowerCase()) {
    case "authors":
      return "Authors" as const;
    case "categories":
      return "Categories" as const;
    case "files":
      return "Files" as const;
    case "media":
      return "Media" as const;
    case "settings":
      return "Settings" as const;
    case "tags":
      return "Tags" as const;
    default:
      return "Posts" as const;
  }
};

export const getProjectEditorRouteState = (pathname: string | null | undefined): ProjectEditorRouteState => {
  const pathSegments = (pathname ?? "")
    .split("?")[0]
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });

  if (pathSegments[0] !== "projects") {
    return {
      routePostId: null,
      routePostsPage: null,
      routeSection: "Posts",
    };
  }

  const sectionSegment = pathSegments[2] ?? null;
  const normalizedSectionSegment = sectionSegment?.trim().toLowerCase() ?? "";

  if (normalizedSectionSegment === "posts") {
    if (pathSegments[3] === "page") {
      return {
        routePostId: null,
        routePostsPage: normalizeRoutePageNumber(pathSegments[4]),
        routeSection: "Posts",
      };
    }

    return {
      routePostId: pathSegments[3] ?? null,
      routePostsPage: null,
      routeSection: "Posts",
    };
  }

  return {
    routePostId: null,
    routePostsPage: null,
    routeSection: getEditorSectionFromSegment(sectionSegment),
  };
};

export const normalizeRoutePageNumber = (value: string | string[] | undefined) => {
  if (typeof value !== "string") {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return null;
  }

  return parsedValue;
};

export const getEditorPathSegment = (section: SidebarItem) => {
  switch (section) {
    case "Authors":
      return "authors";
    case "Categories":
      return "categories";
    case "Files":
      return "files";
    case "Media":
      return "media";
    case "Settings":
      return "settings";
    case "Tags":
      return "tags";
    default:
      return "posts";
  }
};

export const getNormalizedSettingsTab = ({
  canUpdateProject,
  value,
}: {
  canUpdateProject: boolean;
  value: unknown;
}): SettingsTabKey => {
  const normalizedValue = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (normalizedValue === "members" && canUpdateProject) {
    return "members";
  }

  if (normalizedValue === "invite-members" && canUpdateProject) {
    return "invite-members";
  }

  if (normalizedValue === "permissions" && canUpdateProject) {
    return "permissions";
  }

  if (normalizedValue === "sidebar-fields" && canUpdateProject) {
    return "sidebar-fields";
  }

  if (normalizedValue === "mapping" && canUpdateProject) {
    return "mapping";
  }

  return "general";
};

export const getSettingsTabLabel = (value: SettingsTabKey) => {
  switch (value) {
    case "members":
      return "Members";
    case "invite-members":
      return "Invite Members";
    case "permissions":
      return "Permissions";
    case "sidebar-fields":
      return "Sidebar Fields";
    case "mapping":
      return "Content Mapping";
    default:
      return "General";
  }
};

export const getProjectEditorTopBarStatusLabel = ({
  externalPageLoading,
  selectedSidebarItem,
  showTopBarAutosaveStatus,
  showTopBarSpinner,
}: {
  externalPageLoading: boolean;
  selectedSidebarItem: SidebarItem;
  showTopBarAutosaveStatus: boolean;
  showTopBarSpinner: boolean;
}) => {
  if (externalPageLoading) {
    return selectedSidebarItem === "Settings"
      ? "Opening project settings..."
      : `Opening ${selectedSidebarItem.toLowerCase()}...`;
  }

  if (showTopBarAutosaveStatus) {
    return "Auto saving to local storage";
  }

  if (showTopBarSpinner) {
    return "Checking if data is up to date.";
  }

  return null;
};

export const rememberProjectEditorCollectionSnapshot = (
  snapshotKeys: string[],
  cacheKey: string,
) => (snapshotKeys.includes(cacheKey) ? snapshotKeys : [...snapshotKeys, cacheKey]);

export const forgetProjectEditorCollectionSnapshots = ({
  collection,
  projectId,
  snapshotKeys,
}: {
  collection?: CollectionLabel;
  projectId: string;
  snapshotKeys: string[];
}) => {
  if (!collection) {
    return [];
  }

  const collectionPrefix = projectEditorLocalCachePrefixes.collectionSnapshots(projectId, collection);
  return snapshotKeys.filter((cacheKey) => !cacheKey.startsWith(collectionPrefix));
};

export const isProjectConnectionErrorMessage = (message: string) => {
  const normalizedMessage = message.trim().toLowerCase();

  return (
    /saved session .*(credentials|username|password)/.test(normalizedMessage) ||
    normalizedMessage.includes("temporarily blocked authentication") ||
    normalizedMessage.includes("circuit breaker open") ||
    normalizedMessage.includes("password authentication failed") ||
    normalizedMessage.includes("tenant or user not found")
  );
};
