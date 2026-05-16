import { defaultCollectionCounts } from "@/components/editor/project-editor/constants";
import type { CollectionLabel } from "@/components/editor/project-editor/types";
import {
  contentCollections,
  type ContentCollection,
  type ContentCollectionCounts,
  type ContentWorkspaceSummary,
} from "@/lib/content-runtime/shared";

export const WORKSPACE_SUMMARY_REFRESH_INTERVAL_MS = 30_000;

export const collectionLabelToWorkspaceCollection = (
  label: CollectionLabel,
): ContentCollection => {
  if (label === "Posts") {
    return "posts";
  }

  if (label === "Categories") {
    return "categories";
  }

  if (label === "Tags") {
    return "tags";
  }

  if (label === "Authors") {
    return "authors";
  }

  if (label === "Files") {
    return "files";
  }

  return "media";
};

export const createDefaultWorkspaceSummaryState = (
  counts: ContentCollectionCounts = defaultCollectionCounts,
): ContentWorkspaceSummary => ({
  counts,
  isDerived: false,
  isExact: false,
  pendingCollections: [...contentCollections],
  refreshedAt: null,
});

export const getWorkspaceCollectionCount = ({
  counts,
  label,
  summary,
}: {
  counts: ContentCollectionCounts;
  label: CollectionLabel;
  summary: ContentWorkspaceSummary;
}) => {
  const workspaceCollection = collectionLabelToWorkspaceCollection(label);

  const count =
    label === "Posts"
      ? counts.posts
      : label === "Authors"
        ? counts.authors
        : label === "Categories"
          ? counts.categories
          : label === "Files"
            ? counts.files
            : label === "Tags"
              ? counts.tags
              : counts.media;

  if (
    summary.pendingCollections.includes(workspaceCollection) &&
    (!summary.refreshedAt || count === 0)
  ) {
    return null;
  }

  return count;
};
