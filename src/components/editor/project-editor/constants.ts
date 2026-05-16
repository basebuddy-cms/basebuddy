import { File, FileText, Folder, Image as ImageIcon, Tag, UserRound, type LucideIcon } from "lucide-react";

import type {
  ContentCollectionCounts,
  ContentPagination,
  ContentPostsSort,
  ContentPostsStatusFilter,
} from "@/lib/content-runtime/shared";
import type {
  ContentMappingEntityKey,
  ContentMediaStorageProvider,
} from "@/lib/content-runtime/mapping";

import type {
  CollectionLabel,
  PostsMappingFieldOptionKey,
  PostsMediaStorageDraft,
} from "./types";

export const POST_SESSION_RECOVERED_SENTINEL = "__post_session_recovered__";
export const POST_EDIT_CAPABILITY_CHANGED_SENTINEL = "__post_edit_capability_changed__";
export const POSTS_MAPPING_NONE_VALUE = "__none__";
export const POSTS_MAPPING_NOT_IN_TABLE_VALUE = "__not_in_table__";

export const POSTS_MAPPING_FIELD_OPTION_KEYS = [
  "contentColumn",
  "createdAtColumn",
  "excerptColumn",
  "featuredImageUrlColumn",
  "focusKeywordColumn",
  "idColumn",
  "publishedAtColumn",
  "redirectsColumn",
  "seoDescriptionColumn",
  "seoTitleColumn",
  "slugColumn",
  "statusColumn",
  "titleColumn",
  "updatedAtColumn",
] satisfies PostsMappingFieldOptionKey[];

export const defaultMediaStorageDraft = (): PostsMediaStorageDraft => ({
  bucketName: "",
  endpoint: "",
  hasStoredCredentials: false,
  provider: "none" satisfies ContentMediaStorageProvider,
  publicUrlBase: "",
  region: "",
});

export const defaultFilesStorageDraft = (): PostsMediaStorageDraft => ({
  bucketName: "",
  endpoint: "",
  hasStoredCredentials: false,
  provider: "none" satisfies ContentMediaStorageProvider,
  publicUrlBase: "",
  region: "",
});

export const collectionItems = [
  { icon: FileText, label: "Posts" },
  { icon: ImageIcon, label: "Media" },
  { icon: File, label: "Files" },
  { icon: Folder, label: "Categories" },
  { icon: Tag, label: "Tags" },
  { icon: UserRound, label: "Authors" },
] as const satisfies ReadonlyArray<{
  icon: LucideIcon;
  label: CollectionLabel;
}>;

export const collectionToMappingEntityKey: Record<CollectionLabel, ContentMappingEntityKey> = {
  Authors: "authors",
  Categories: "categories",
  Files: "media",
  Media: "media",
  Posts: "posts",
  Tags: "tags",
};

export const mappingCardDescriptions: Record<CollectionLabel, string> = {
  Authors: "Author profiles, team assignments, and editor access.",
  Categories: "Category fields and how posts connect to them.",
  Files: "Downloadable file storage and editor access.",
  Media: "Image library fields, storage, and editor access.",
  Posts: "Post fields, publishing flow, SEO, and related content.",
  Tags: "Tag fields and how posts connect to them.",
};

export const postsMappingSteps = [
  {
    description: "Choose where each post or article comes from.",
    id: "posts_table",
    title: "Choose Posts Source",
  },
  {
    description: "Choose the fields that store title, content, address, and redirects.",
    id: "core_fields",
    title: "Core Fields",
  },
  {
    description: "Connect posts to author information. This can be a direct column or a related table.",
    id: "authors",
    title: "Authors",
  },
  {
    description: "Set up how posts are organized into categories from your database.",
    id: "categories",
    title: "Categories",
  },
  {
    description: "Set up how posts are tagged from your content.",
    id: "tags",
    title: "Tags",
  },
  {
    description: "Define which column values determine whether a post is a draft, published, or archived.",
    id: "status",
    title: "Status",
  },
  {
    description: "Choose the dates that track when posts are created, published, and last updated.",
    id: "timestamps",
    title: "Timestamps",
  },
  {
    description: "Choose the fields that store SEO title, description, and focus keyword.",
    id: "seo",
    title: "SEO",
  },
  {
    description: "Choose where images are stored for the media library.",
    id: "media_storage",
    title: "Media Storage",
  },
  {
    description: "Choose where downloadable files are stored for the files library.",
    id: "files_storage",
    title: "Files Storage",
  },
  {
    description: "Any remaining columns in your posts table can be exposed as custom fields in the editor.",
    id: "custom_fields",
    title: "Custom Fields",
  },
] as const;

export type PostsMappingStep = (typeof postsMappingSteps)[number];

const postsMappingStepById = Object.fromEntries(
  postsMappingSteps.map((step) => [step.id, step]),
) as Record<PostsMappingStep["id"], PostsMappingStep>;

export const getPostsMappingStepsForCollection = (collection: CollectionLabel): PostsMappingStep[] => {
  if (collection === "Authors") {
    return [postsMappingStepById.authors];
  }

  if (collection === "Categories") {
    return [postsMappingStepById.categories];
  }

  if (collection === "Tags") {
    return [postsMappingStepById.tags];
  }

  if (collection === "Media" || collection === "Files") {
    return collection === "Media"
      ? [postsMappingStepById.media_storage]
      : [postsMappingStepById.files_storage];
  }

  return [
    postsMappingStepById.posts_table,
    postsMappingStepById.core_fields,
    postsMappingStepById.status,
    postsMappingStepById.timestamps,
    postsMappingStepById.seo,
    postsMappingStepById.custom_fields,
  ];
};

export const defaultCollectionCounts: ContentCollectionCounts = {
  authors: 0,
  categories: 0,
  files: 0,
  media: 0,
  posts: 0,
  tags: 0,
};

export const defaultCollectionPages: Record<CollectionLabel, number> = {
  Authors: 1,
  Categories: 1,
  Files: 1,
  Media: 1,
  Posts: 1,
  Tags: 1,
};

export const postsPageSize = 10;
export const postsCacheVersion = 4;
export const relationOptionsRenderLimit = 200;

export const postStatusFilterOptions: Array<{ label: string; value: ContentPostsStatusFilter }> = [
  { label: "All statuses", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Published", value: "published" },
  { label: "Archived", value: "archived" },
];

export const postSortOptions: Array<{ label: string; value: ContentPostsSort }> = [
  { label: "Last updated", value: "updated_desc" },
  { label: "First updated", value: "updated_asc" },
  { label: "Newest created", value: "created_desc" },
  { label: "Oldest created", value: "created_asc" },
  { label: "Title A-Z", value: "title_asc" },
  { label: "Title Z-A", value: "title_desc" },
];

export const defaultPagination: ContentPagination = {
  page: 1,
  pageSize: 20,
  totalItems: 0,
  totalPages: 1,
};
