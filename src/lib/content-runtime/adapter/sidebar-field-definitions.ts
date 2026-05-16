import type { ContentPostSidebarFieldKey } from "@/lib/content-runtime/shared";

import type { ContentCompiledAdapterMapping } from "./compiler";

type SidebarFieldDefinition = {
  defaultParentId: string | null;
  description: string;
  label: string;
  sidebarFieldId: ContentPostSidebarFieldKey;
};

export const sidebarScalarFieldDefinitions: Partial<
  Record<keyof ContentCompiledAdapterMapping["scalarFields"], SidebarFieldDefinition>
> = {
  excerpt: {
    defaultParentId: null,
    description: "Edit the short summary used in previews and listings.",
    label: "Excerpt",
    sidebarFieldId: "excerpt",
  },
  featuredImage: {
    defaultParentId: null,
    description: "Upload or replace the featured image.",
    label: "Featured Image",
    sidebarFieldId: "featured_image",
  },
  focusKeyword: {
    defaultParentId: "seo-fields",
    description: "Choose the main keyword this post should target.",
    label: "Focus Keyword",
    sidebarFieldId: "focus_keyword",
  },
  publishedAt: {
    defaultParentId: null,
    description: "Adjust the published date and time for this post.",
    label: "Published On",
    sidebarFieldId: "published_at",
  },
  redirects: {
    defaultParentId: null,
    description: "Manage old slugs that should keep redirecting to this post.",
    label: "Redirects",
    sidebarFieldId: "redirects",
  },
  seoDescription: {
    defaultParentId: "meta-fields",
    description: "Override the meta description used in search results.",
    label: "Meta Description",
    sidebarFieldId: "meta_description",
  },
  seoTitle: {
    defaultParentId: "meta-fields",
    description: "Override the meta title used in search results.",
    label: "Meta Title",
    sidebarFieldId: "meta_title",
  },
  slug: {
    defaultParentId: null,
    description: "Edit the URL slug for this post.",
    label: "URL Slug",
    sidebarFieldId: "slug",
  },
  updatedAt: {
    defaultParentId: null,
    description: "Adjust the updated date and time for this post.",
    label: "Updated On",
    sidebarFieldId: "updated_at",
  },
};

export const sidebarRelationFieldDefinitions: Partial<
  Record<keyof ContentCompiledAdapterMapping["relationFields"], SidebarFieldDefinition>
> = {
  author: {
    defaultParentId: null,
    description: "Choose the author assigned to this post.",
    label: "Author",
    sidebarFieldId: "author",
  },
  categories: {
    defaultParentId: null,
    description: "Select one or more categories for this post.",
    label: "Categories",
    sidebarFieldId: "categories",
  },
  parentPage: {
    defaultParentId: null,
    description: "Choose the parent page for this post.",
    label: "Parent Page",
    sidebarFieldId: "parent_page",
  },
  tags: {
    defaultParentId: null,
    description: "Select one or more tags for this post.",
    label: "Tags",
    sidebarFieldId: "tags",
  },
};
