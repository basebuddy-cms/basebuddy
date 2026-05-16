import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const {
  useProjectEditorRelationOptionsQueryMock,
} = vi.hoisted(() => ({
  useProjectEditorRelationOptionsQueryMock: vi.fn(() => ({
    data: [],
    error: null,
    isError: false,
    isFetching: false,
    isLoading: false,
  })),
}));

vi.mock("@/components/editor/project-editor/queries", () => ({
  useProjectEditorRelationOptionsQuery: useProjectEditorRelationOptionsQueryMock,
}));

import { ProjectEditorPostSidePanel } from "@/components/editor/project-editor/post-side-panel";
import type {
  ContentFieldSpecSummary,
  ContentPostSidebarFieldKey,
  ContentPostSidebarConfig,
  ContentSidebarFieldSpecSummary,
} from "@/lib/content-runtime/shared";

const createSelectedPost = () => ({
  authorId: "author-1",
  categoryIds: [],
  contentFields: {},
  contentFormat: "html" as const,
  contentHtml: "<p>Hello</p>",
  contentJson: {},
  contentMarkdown: null,
  createdAt: "2026-03-31T00:00:00.000Z",
  customFields: {},
  excerpt: "Summary",
  focusKeyword: "cms",
  featuredImageUrl: null,
  id: "post-1",
  publishedAt: null,
  redirects: [],
  seoDescription: "Meta description",
  seoTitle: "Meta title",
  slug: "hello-world",
  status: "draft" as const,
  tagIds: [],
  title: "Hello World",
  updatedAt: "2026-03-31T00:00:00.000Z",
});

const baseProps = {
  canEditCurrentPost: true,
  canOpenSelectedPostPreview: true,
  canOpenSelectedPostRevisions: true,
  canUploadFeaturedImage: true,
  categoryOptions: [
    {
      createdAt: "2026-03-31T00:00:00.000Z",
      depth: 0,
      description: null,
      hierarchyPath: "News",
      id: "category-1",
      name: "News",
      parentCategoryId: null,
      slug: "news",
    },
  ],
  displayedSelectedPostSlug: "hello-world",
  contentRuntime: null,
  featuredImageDragActive: false,
  featuredImageInputRef: { current: null },
  isEditingPostSlug: false,
  isYoastAnalyzing: false,
  onCancelPostSlugEdit: vi.fn(),
  onClose: vi.fn(),
  onHandleOpenPostPreview: vi.fn(),
  onHandleOpenPostRevisions: vi.fn(),
  onPostSidePanelViewChange: vi.fn(),
  onPostSlugDraftChange: vi.fn(),
  onPostTagsSearchQueryChange: vi.fn(),
  onSavePostSlugEdit: vi.fn(),
  onStartPostSlugEdit: vi.fn(),
  onToggleFeaturedImageDragActive: vi.fn(),
  postAuthorOptions: [
    {
      avatarUrl: null,
      bio: null,
      createdAt: "2026-03-31T00:00:00.000Z",
      email: "owner@example.com",
      id: "author-1",
      name: "Owner",
      slug: "owner",
    },
  ],
  projectId: "project-1",
  postSidePanelView: "details" as const,
  postSlugDraft: "hello-world",
  postTagsSearchQuery: "",
  selectedPost: createSelectedPost(),
  supportsPostRevisions: true,
  tags: [],
  updatePost: vi.fn(),
  uploadFeaturedImage: vi.fn(async () => undefined),
  uploadingFeaturedImage: false,
  yoastReadabilityResults: [],
  yoastReadabilityScore: null,
  yoastSeoResults: [],
  yoastSeoScore: null,
};

const createCustomRelationSidebarProps = ({
  fieldKey,
  label,
  multiple,
  readOnly = false,
  relationTargetEntity,
}: {
  fieldKey: string;
  label: string;
  multiple: boolean;
  readOnly?: boolean;
  relationTargetEntity: "authors" | "categories" | "files" | "media" | "posts" | "tags";
}) => {
  const sidebarFieldId = `custom_field:${fieldKey}` as ContentPostSidebarFieldKey;
  const fieldSpec = {
    allowedValues: null,
    contentFormat: null,
    editabilityState: readOnly ? "read_only" : "editable",
    fieldKey,
    isCustomField: true,
    label,
    multiple,
    nullable: true,
    patchMode: "link_replace",
    readOnly,
    relationMode: multiple ? "managed_multi" : "managed_single",
    relationTargetEntity,
    required: false,
    searchMode: "remote",
    uiControl: readOnly ? "read_only" : multiple ? "multi_select" : "single_select",
    valueKind: "relation_id_or_key",
    visible: true,
  } satisfies ContentFieldSpecSummary;

  const sidebarFieldSpec = {
    ...fieldSpec,
    defaultParentId: "custom-fields",
    description: `Edit the mapped "${label}" field.`,
    sidebarFieldId,
  } satisfies ContentSidebarFieldSpecSummary;

  return {
    contentRuntime: {
      customFields: [],
      editorFields: [],
      fieldSpecs: [fieldSpec],
      filesStorage: null,
      mediaStorage: null,
      sidebarFieldSpecs: [sidebarFieldSpec],
    },
    postSidePanelView: "page:custom-fields" as const,
    postSidebarConfig: {
      nodes: [{ id: sidebarFieldId, kind: "field" as const, parentId: null, visible: true }],
      version: 2 as const,
    } satisfies ContentPostSidebarConfig,
  };
};

describe("ProjectEditorPostSidePanel", () => {
  it("renders custom sidebar pages separately from the fields assigned to them", () => {
    const postSidebarConfig = {
      nodes: [
        { id: "author", kind: "field" as const, parentId: null, visible: true },
        { id: "meta-fields", kind: "page" as const, label: "Meta Fields", parentId: null, visible: true },
        { id: "seo-fields", kind: "page" as const, label: "SEO Fields", parentId: null, visible: true },
        { id: "meta_title", kind: "field" as const, parentId: "meta-fields", visible: true },
        { id: "meta_description", kind: "field" as const, parentId: "meta-fields", visible: true },
        { id: "focus_keyword", kind: "field" as const, parentId: "seo-fields", visible: true },
        { id: "featured_image", kind: "field" as const, parentId: null, visible: true },
      ],
      version: 2 as const,
    } satisfies ContentPostSidebarConfig;

    const { rerender } = render(
      <ProjectEditorPostSidePanel
        {...baseProps}
        postSidebarConfig={postSidebarConfig}
      />,
    );

    const metaFieldsButton = screen.getByRole("button", { name: /Meta Fields/i });
    const seoFieldsButton = screen.getByRole("button", { name: /SEO Fields/i });

    expect(metaFieldsButton).toBeInTheDocument();
    expect(metaFieldsButton).toHaveClass("-mx-4", "border-t", "border-b", "justify-between", "text-left");
    expect(metaFieldsButton).not.toHaveClass("rounded-lg", "bg-card");
    expect(seoFieldsButton).toHaveClass("-mx-4", "border-b", "justify-between", "text-left");
    expect(seoFieldsButton).not.toHaveClass("border-t");
    expect(screen.queryByLabelText(/Meta Title/i)).not.toBeInTheDocument();
    expect(screen.getByText("Featured Image")).toBeInTheDocument();

    rerender(
      <ProjectEditorPostSidePanel
        {...baseProps}
        postSidePanelView={"page:meta-fields"}
        postSidebarConfig={postSidebarConfig}
      />,
    );

    expect(screen.getByText("Meta Fields")).toBeInTheDocument();
    expect(screen.getByLabelText(/Meta Title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Meta Description/i)).toBeInTheDocument();
  }, 10_000);

  it("hides sidebar folders that have no mapped fields", () => {
    render(
      <ProjectEditorPostSidePanel
        {...baseProps}
        contentRuntime={{
          customFields: [],
          editorFields: [],
          fieldSpecs: [],
          filesStorage: null,
          mediaStorage: null,
          sidebarFieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
              defaultParentId: null,
              description: "Edit the URL slug for this post.",
              editabilityState: "editable",
              fieldKey: "slug",
              label: "URL Slug",
              multiple: false,
              nullable: true,
              patchMode: "replace",
              readOnly: false,
              relationMode: "none",
              required: false,
              searchMode: "none",
              sidebarFieldId: "slug",
              uiControl: "text_input",
              valueKind: "text_like",
              visible: true,
            },
          ],
        } as never}
        postSidebarConfig={{
          nodes: [
            { id: "slug", kind: "field", parentId: null, visible: true },
            { id: "custom-fields", kind: "page", label: "Custom Fields", parentId: null, visible: true },
            { id: "meta-fields", kind: "page", label: "Meta Fields", parentId: null, visible: true },
            { id: "seo-fields", kind: "page", label: "SEO Fields", parentId: null, visible: true },
            { id: "meta_title", kind: "field", parentId: "meta-fields", visible: true },
          ],
          version: 2,
        } satisfies ContentPostSidebarConfig}
      />,
    );

    expect(screen.getByText("URL Slug")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Custom Fields/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Meta Fields/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /SEO Fields/i })).not.toBeInTheDocument();
  });

  it("renders categories as a direct field control when placed on the main sidebar", () => {
    render(
      <ProjectEditorPostSidePanel
        {...baseProps}
        postSidebarConfig={{
          nodes: [{ id: "categories", kind: "field", parentId: null, visible: true }],
          version: 2,
        } satisfies ContentPostSidebarConfig}
      />,
    );

    expect(screen.getByText("Categories")).toBeInTheDocument();
    expect(screen.getByText("News")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Categories$/i })).not.toBeInTheDocument();
  });

  it("treats focus keyword as database-backed when the mapped field exposes the semantic role", () => {
    render(
      <ProjectEditorPostSidePanel
        {...baseProps}
        contentRuntime={{
          customFields: [],
          editorFields: [],
          fieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
              editabilityState: "editable",
              fieldKey: "keyword_phrase",
              label: "Keyword Phrase",
              multiple: false,
              nullable: true,
              patchMode: "replace",
              readOnly: false,
              relationMode: "none",
              required: false,
              searchMode: "none",
              semanticRole: "focusKeyword",
              uiControl: "text_input",
              valueKind: "text_like",
              visible: true,
            },
          ],
          filesStorage: null,
          mediaStorage: null,
          sidebarFieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
              defaultParentId: null,
              description: "Edit the mapped focus keyword field.",
              editabilityState: "editable",
              fieldKey: "keyword_phrase",
              label: "Keyword Phrase",
              multiple: false,
              nullable: true,
              patchMode: "replace",
              readOnly: false,
              relationMode: "none",
              required: false,
              searchMode: "none",
              semanticRole: "focusKeyword",
              sidebarFieldId: "focus_keyword",
              uiControl: "text_input",
              valueKind: "text_like",
              visible: true,
            },
          ],
        }}
        postSidebarConfig={{
          nodes: [{ id: "focus_keyword", kind: "field", parentId: null, visible: true }],
          version: 2,
        }}
      />,
    );

    expect(screen.getByLabelText(/Focus Keyword/i)).toBeInTheDocument();
    expect(screen.queryByText(/Stored locally for this session/i)).not.toBeInTheDocument();
  });

  it("renders published and updated date controls inline near the top of the sidebar", () => {
    render(
      <ProjectEditorPostSidePanel
        {...baseProps}
        postSidebarConfig={{
          nodes: [
            { id: "author", kind: "field", parentId: null, visible: true },
            { id: "published_at", kind: "field", parentId: null, visible: true },
            { id: "updated_at", kind: "field", parentId: null, visible: true },
          ],
          version: 2,
        }}
      />,
    );

    expect(screen.getByText(/published on:/i)).toBeInTheDocument();
    expect(screen.getByText(/updated on:/i)).toBeInTheDocument();

    const publishedRow = screen.getByText(/published on:/i).parentElement;
    const updatedRow = screen.getByText(/updated on:/i).parentElement;

    expect(publishedRow).not.toHaveClass("rounded-md", "border");
    expect(updatedRow).not.toHaveClass("rounded-md", "border");
    expect(publishedRow).toHaveClass("items-start");
    expect(updatedRow).toHaveClass("items-start");

    const authorLabel = screen.getByText("Author");
    const publishedLabel = screen.getByText(/published on:/i);
    const updatedLabel = screen.getByText(/updated on:/i);

    expect(authorLabel.compareDocumentPosition(publishedLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(publishedLabel.compareDocumentPosition(updatedLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders structured redirects as an adapter-driven editor and updates them", () => {
    const updatePost = vi.fn();

    render(
      <ProjectEditorPostSidePanel
        {...baseProps}
        contentRuntime={{
          customFields: [],
          editorFields: [],
          fieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
              editabilityState: "editable",
              fieldKey: "redirects",
              label: "Redirects",
              multiple: true,
              nullable: true,
              patchMode: "replace",
              readOnly: false,
              redirectMetadataSupport: "structured",
              relationMode: "none",
              required: false,
              searchMode: "none",
              uiControl: "redirect_rows_editor",
              valueKind: "redirects",
              visible: true,
            },
          ],
          filesStorage: null,
          mediaStorage: null,
          sidebarFieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
              defaultParentId: null,
              description: "Manage old slugs that should redirect to this post.",
              editabilityState: "editable",
              fieldKey: "redirects",
              label: "Redirects",
              multiple: true,
              nullable: true,
              patchMode: "replace",
              readOnly: false,
              redirectMetadataSupport: "structured",
              relationMode: "none",
              required: false,
              searchMode: "none",
              sidebarFieldId: "redirects",
              uiControl: "redirect_rows_editor",
              valueKind: "redirects",
              visible: true,
            },
          ],
        }}
        postSidebarConfig={{
          nodes: [{ id: "redirects", kind: "field", parentId: null, visible: true }],
          version: 2,
        }}
        selectedPost={{
          ...createSelectedPost(),
          redirects: [{ active: null, locale: null, source: "old-post", statusCode: null }],
        }}
        updatePost={updatePost}
      />,
    );

    expect(screen.getByText("Redirects")).toBeInTheDocument();
    expect(screen.getByDisplayValue("old-post")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Status Code"), {
      target: {
        value: "302",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Add redirect" }));

    expect(updatePost).toHaveBeenCalledWith("post-1", {
      redirects: [
        {
          active: null,
          locale: null,
          source: "old-post",
          statusCode: 302,
        },
      ],
    });
    expect(updatePost).toHaveBeenCalledWith("post-1", {
      redirects: [
        {
          active: null,
          locale: null,
          source: "old-post",
          statusCode: null,
        },
        {
          active: null,
          locale: null,
          source: "",
          statusCode: null,
        },
      ],
    });
  });

  it("shows honest read-only messaging for adapter-backed scalar sidebar fields", () => {
    render(
      <ProjectEditorPostSidePanel
        {...baseProps}
        contentRuntime={{
          customFields: [],
          editorFields: [],
          fieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
              editabilityState: "read_only",
              fieldKey: "excerpt",
              label: "Excerpt",
              multiple: false,
              nullable: true,
              patchMode: "no_write",
              readOnly: true,
              relationMode: "none",
              required: false,
              searchMode: "none",
              uiControl: "read_only",
              valueKind: "long_text",
              visible: true,
            },
            {
              allowedValues: null,
              contentFormat: null,
              editabilityState: "unsupported",
              fieldKey: "slug",
              label: "Slug",
              multiple: false,
              nullable: false,
              patchMode: "no_write",
              readOnly: true,
              relationMode: "none",
              required: true,
              searchMode: "none",
              uiControl: "read_only",
              valueKind: "text_like",
              visible: true,
            },
            {
              allowedValues: null,
              contentFormat: null,
              editabilityState: "read_only",
              fieldKey: "seoTitle",
              label: "Meta Title",
              multiple: false,
              nullable: true,
              patchMode: "no_write",
              readOnly: true,
              relationMode: "none",
              required: false,
              searchMode: "none",
              uiControl: "read_only",
              valueKind: "text_like",
              visible: true,
            },
            {
              allowedValues: null,
              contentFormat: null,
              editabilityState: "unsupported",
              fieldKey: "seoDescription",
              label: "Meta Description",
              multiple: false,
              nullable: true,
              patchMode: "no_write",
              readOnly: true,
              relationMode: "none",
              required: false,
              searchMode: "none",
              uiControl: "read_only",
              valueKind: "long_text",
              visible: true,
            },
            {
              allowedValues: null,
              contentFormat: null,
              editabilityState: "read_only",
              fieldKey: "focusKeyword",
              label: "Focus Keyword",
              multiple: false,
              nullable: true,
              patchMode: "no_write",
              readOnly: true,
              relationMode: "none",
              required: false,
              searchMode: "none",
              uiControl: "read_only",
              valueKind: "text_like",
              visible: true,
            },
          ],
          filesStorage: null,
          mediaStorage: null,
          sidebarFieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
              defaultParentId: null,
              description: "Excerpt",
              editabilityState: "read_only",
              fieldKey: "excerpt",
              label: "Excerpt",
              multiple: false,
              nullable: true,
              patchMode: "no_write",
              readOnly: true,
              relationMode: "none",
              required: false,
              searchMode: "none",
              sidebarFieldId: "excerpt",
              uiControl: "read_only",
              valueKind: "long_text",
              visible: true,
            },
            {
              allowedValues: null,
              contentFormat: null,
              defaultParentId: null,
              description: "Slug",
              editabilityState: "unsupported",
              fieldKey: "slug",
              label: "Slug",
              multiple: false,
              nullable: false,
              patchMode: "no_write",
              readOnly: true,
              relationMode: "none",
              required: true,
              searchMode: "none",
              sidebarFieldId: "slug",
              uiControl: "read_only",
              valueKind: "text_like",
              visible: true,
            },
            {
              allowedValues: null,
              contentFormat: null,
              defaultParentId: null,
              description: "Meta title",
              editabilityState: "read_only",
              fieldKey: "seoTitle",
              label: "Meta Title",
              multiple: false,
              nullable: true,
              patchMode: "no_write",
              readOnly: true,
              relationMode: "none",
              required: false,
              searchMode: "none",
              sidebarFieldId: "meta_title",
              uiControl: "read_only",
              valueKind: "text_like",
              visible: true,
            },
            {
              allowedValues: null,
              contentFormat: null,
              defaultParentId: null,
              description: "Meta description",
              editabilityState: "unsupported",
              fieldKey: "seoDescription",
              label: "Meta Description",
              multiple: false,
              nullable: true,
              patchMode: "no_write",
              readOnly: true,
              relationMode: "none",
              required: false,
              searchMode: "none",
              sidebarFieldId: "meta_description",
              uiControl: "read_only",
              valueKind: "long_text",
              visible: true,
            },
            {
              allowedValues: null,
              contentFormat: null,
              defaultParentId: null,
              description: "Focus keyword",
              editabilityState: "read_only",
              fieldKey: "focusKeyword",
              label: "Focus Keyword",
              multiple: false,
              nullable: true,
              patchMode: "no_write",
              readOnly: true,
              relationMode: "none",
              required: false,
              searchMode: "none",
              sidebarFieldId: "focus_keyword",
              uiControl: "read_only",
              valueKind: "text_like",
              visible: true,
            },
          ],
        }}
        postSidebarConfig={{
          nodes: [
            { id: "excerpt", kind: "field", parentId: null, visible: true },
            { id: "slug", kind: "field", parentId: null, visible: true },
            { id: "meta_title", kind: "field", parentId: null, visible: true },
            { id: "meta_description", kind: "field", parentId: null, visible: true },
            { id: "focus_keyword", kind: "field", parentId: null, visible: true },
          ],
          version: 2,
        }}
      />,
    );

    expect(
      screen.getByText("This excerpt field is read-only in BaseBuddy."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("This url slug field can't be edited here yet. Ask an owner to review this field mapping."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("This meta title field is read-only in BaseBuddy."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("This meta description field can't be edited here yet. Ask an owner to review this field mapping."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("This focus keyword field is read-only in BaseBuddy."),
    ).toBeInTheDocument();
  });

  it("surfaces helper-row ambiguity for scalar sidebar fields instead of showing editable inputs", () => {
    render(
      <ProjectEditorPostSidePanel
        {...baseProps}
        contentRuntime={{
          customFields: [],
          editorFields: [],
          fieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
              editabilityState: "editable",
              fieldKey: "excerpt",
              label: "Excerpt",
              multiple: false,
              nullable: true,
              patchMode: "replace",
              readOnly: false,
              relationMode: "none",
              required: false,
              searchMode: "none",
              uiControl: "textarea",
              valueKind: "long_text",
              visible: true,
            },
          ],
          filesStorage: null,
          mediaStorage: null,
          sidebarFieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
              defaultParentId: null,
              description: "Excerpt",
              editabilityState: "editable",
              fieldKey: "excerpt",
              label: "Excerpt",
              multiple: false,
              nullable: true,
              patchMode: "replace",
              readOnly: false,
              relationMode: "none",
              required: false,
              searchMode: "none",
              sidebarFieldId: "excerpt",
              uiControl: "textarea",
              valueKind: "long_text",
              visible: true,
            },
          ],
        }}
        postSidebarConfig={{
          nodes: [{ id: "excerpt", kind: "field", parentId: null, visible: true }],
          version: 2,
        }}
        selectedPost={{
          ...createSelectedPost(),
          fieldConflicts: {
            excerpt: {
              code: "helper_row_ambiguity",
              helperRowCount: 2,
              values: ["Summary", "Summary v2"],
            },
          },
        }}
      />,
    );

    expect(
      screen.getByText("This excerpt field has duplicate records behind it. Ask an owner to review the mapping before editing it."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /excerpt/i })).not.toBeInTheDocument();
  });

  it("renders adapter-driven featured image url input and preview for safe mapped-content mappings", () => {
    const updatePost = vi.fn();

    render(
      <ProjectEditorPostSidePanel
        {...baseProps}
        contentRuntime={{
          customFields: [],
          editorFields: [],
          fieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
              editabilityState: "editable",
              fieldKey: "featuredImage",
              label: "Featured Image",
              multiple: false,
              nullable: true,
              patchMode: "replace",
              readOnly: false,
              relationMode: "none",
              required: false,
              searchMode: "none",
              uiControl: "image_picker",
              valueKind: "text_like",
              visible: true,
            },
          ],
          filesStorage: null,
          mediaStorage: null,
          sidebarFieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
              defaultParentId: null,
              description: "Upload or replace the featured image.",
              editabilityState: "editable",
              fieldKey: "featuredImage",
              label: "Featured Image",
              multiple: false,
              nullable: true,
              patchMode: "replace",
              readOnly: false,
              relationMode: "none",
              required: false,
              searchMode: "none",
              sidebarFieldId: "featured_image",
              uiControl: "image_picker",
              valueKind: "text_like",
              visible: true,
            },
          ],
        }}
        postSidebarConfig={{
          nodes: [{ id: "featured_image", kind: "field", parentId: null, visible: true }],
          version: 2,
        }}
        selectedPost={{
          ...createSelectedPost(),
          featuredImageUrl: "https://example.com/cover.png",
        }}
        updatePost={updatePost}
      />,
    );

    expect(screen.getByDisplayValue("https://example.com/cover.png")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /featured/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Featured Image"), {
      target: {
        value: "https://example.com/next.png",
      },
    });

    expect(updatePost).toHaveBeenCalledWith("post-1", {
      featuredImageUrl: "https://example.com/next.png",
    });
  });

  it("shows an honest unsupported message for object-backed featured image mappings", () => {
    render(
      <ProjectEditorPostSidePanel
        {...baseProps}
        contentRuntime={{
          customFields: [],
          editorFields: [],
          fieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
              editabilityState: "unsupported",
              fieldKey: "featuredImage",
              label: "Featured Image",
              multiple: false,
              nullable: true,
              patchMode: "no_write",
              readOnly: true,
              relationMode: "none",
              required: false,
              searchMode: "none",
              uiControl: "read_only",
              valueKind: "json_object",
              visible: true,
            },
          ],
          filesStorage: null,
          mediaStorage: null,
          sidebarFieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
              defaultParentId: null,
              description: "Upload or replace the featured image.",
              editabilityState: "unsupported",
              fieldKey: "featuredImage",
              label: "Featured Image",
              multiple: false,
              nullable: true,
              patchMode: "no_write",
              readOnly: true,
              relationMode: "none",
              required: false,
              searchMode: "none",
              sidebarFieldId: "featured_image",
              uiControl: "read_only",
              valueKind: "json_object",
              visible: true,
            },
          ],
        }}
        postSidebarConfig={{
          nodes: [{ id: "featured_image", kind: "field", parentId: null, visible: true }],
          version: 2,
        }}
        selectedPost={{
          ...createSelectedPost(),
          featuredImageUrl: "{\"id\":\"media-1\"}",
        }}
      />,
    );

    expect(
      screen.getByText("This featured image field can't be edited here yet. Ask an owner to review this field mapping."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Click or drop image")).not.toBeInTheDocument();
  });

  it("shows read-only timestamp messaging when the adapter marks sidebar dates as read-only", () => {
    render(
      <ProjectEditorPostSidePanel
        {...baseProps}
        contentRuntime={{
          customFields: [],
          editorFields: [],
          fieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
              editabilityState: "read_only",
              fieldKey: "publishedAt",
              label: "Published At",
              multiple: false,
              nullable: true,
              patchMode: "no_write",
              readOnly: true,
              relationMode: "none",
              required: false,
              searchMode: "none",
              uiControl: "datetime_picker",
              valueKind: "datetime",
              visible: true,
            },
            {
              allowedValues: null,
              contentFormat: null,
              editabilityState: "read_only",
              fieldKey: "updatedAt",
              label: "Updated At",
              multiple: false,
              nullable: true,
              patchMode: "no_write",
              readOnly: true,
              relationMode: "none",
              required: false,
              searchMode: "none",
              uiControl: "datetime_picker",
              valueKind: "datetime",
              visible: true,
            },
          ],
          filesStorage: null,
          mediaStorage: null,
          sidebarFieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
              defaultParentId: null,
              description: "Adjust the published date and time for this post.",
              editabilityState: "read_only",
              fieldKey: "publishedAt",
              label: "Published On",
              multiple: false,
              nullable: true,
              patchMode: "no_write",
              readOnly: true,
              relationMode: "none",
              required: false,
              searchMode: "none",
              sidebarFieldId: "published_at",
              uiControl: "datetime_picker",
              valueKind: "datetime",
              visible: true,
            },
            {
              allowedValues: null,
              contentFormat: null,
              defaultParentId: null,
              description: "Adjust the updated date and time for this post.",
              editabilityState: "read_only",
              fieldKey: "updatedAt",
              label: "Updated On",
              multiple: false,
              nullable: true,
              patchMode: "no_write",
              readOnly: true,
              relationMode: "none",
              required: false,
              searchMode: "none",
              sidebarFieldId: "updated_at",
              uiControl: "datetime_picker",
              valueKind: "datetime",
              visible: true,
            },
          ],
        }}
        postSidebarConfig={{
          nodes: [
            { id: "published_at", kind: "field", parentId: null, visible: true },
            { id: "updated_at", kind: "field", parentId: null, visible: true },
          ],
          version: 2,
        }}
      />,
    );

    expect(
      screen.getByText("This published on field is read-only in BaseBuddy."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("This updated on field is read-only in BaseBuddy."),
    ).toBeInTheDocument();
  });

  it("trusts the adapter focus keyword field instead of legacy mapped-post booleans", () => {
    render(
      <ProjectEditorPostSidePanel
        {...baseProps}
        contentRuntime={{
          customFields: [],
          editorFields: [],
          fieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
              editabilityState: "editable",
              fieldKey: "focusKeyword",
              label: "Focus Keyword",
              multiple: false,
              nullable: true,
              patchMode: "replace",
              readOnly: false,
              relationMode: "none",
              required: false,
              searchMode: "none",
              uiControl: "text_input",
              valueKind: "text_like",
              visible: true,
            },
          ],
          filesStorage: null,
          mediaStorage: null,
          sidebarFieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
              defaultParentId: "seo-fields",
              description: "Choose the main keyword this post should target.",
              editabilityState: "editable",
              fieldKey: "focusKeyword",
              label: "Focus Keyword",
              multiple: false,
              nullable: true,
              patchMode: "replace",
              readOnly: false,
              relationMode: "none",
              required: false,
              searchMode: "none",
              sidebarFieldId: "focus_keyword",
              uiControl: "text_input",
              valueKind: "text_like",
              visible: true,
            },
          ],
        }}
        postSidebarConfig={{
          nodes: [{ id: "focus_keyword", kind: "field", parentId: "seo-fields", visible: true }],
          version: 2,
        }}
        postSidePanelView="page:seo-fields"
      />,
    );

    expect(screen.getByText("The main keyword or phrase this post targets.")).toBeInTheDocument();
    expect(
      screen.queryByText("Saved locally for SEO analysis until a focus keyword column is mapped."),
    ).not.toBeInTheDocument();
  });

  it("keeps published and updated directly below author in the default sidebar order", () => {
    render(<ProjectEditorPostSidePanel {...baseProps} />);

    const authorLabel = screen.getByText("Author");
    const publishedLabel = screen.getByText(/published on:/i);
    const updatedLabel = screen.getByText(/updated on:/i);
    const excerptLabel = screen.getByLabelText(/Excerpt/i);

    expect(authorLabel.compareDocumentPosition(publishedLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(publishedLabel.compareDocumentPosition(updatedLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(updatedLabel.compareDocumentPosition(excerptLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows a blocked required relation message when no valid author options exist", () => {
    render(
      <ProjectEditorPostSidePanel
        {...baseProps}
        contentRuntime={{
          customFields: [],
          editorFields: [],
          fieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
              editabilityState: "editable",
              fieldKey: "author",
              label: "Author",
              multiple: false,
              nullable: false,
              patchMode: "link_replace",
              readOnly: false,
              relationMode: "managed_single",
              required: true,
              searchMode: "remote",
              uiControl: "single_select",
              valueKind: "relation_id_or_key",
              visible: true,
            },
          ],
          filesStorage: null,
          mediaStorage: null,
          sidebarFieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
              defaultParentId: null,
              description: "Choose the author assigned to this post.",
              editabilityState: "editable",
              fieldKey: "author",
              label: "Author",
              multiple: false,
              nullable: false,
              patchMode: "link_replace",
              readOnly: false,
              relationMode: "managed_single",
              required: true,
              searchMode: "remote",
              sidebarFieldId: "author",
              uiControl: "single_select",
              valueKind: "relation_id_or_key",
              visible: true,
            },
          ],
        }}
        postAuthorOptions={[]}
        postSidebarConfig={{
          nodes: [{ id: "author", kind: "field", parentId: null, visible: true }],
          version: 2,
        }}
        selectedPost={{
          ...createSelectedPost(),
          authorId: null,
        }}
      />,
    );

    expect(
      screen.getByText("This mapped author field is required, but no valid authors are available."),
    ).toBeInTheDocument();
  });

  it("uses compiled sidebar relation specs even when duplicate field-spec metadata is absent", () => {
    render(
      <ProjectEditorPostSidePanel
        {...baseProps}
        contentRuntime={{
          customFields: [],
          editorFields: [],
          filesStorage: null,
          mediaStorage: null,
          sidebarFieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
              defaultParentId: null,
              description: "Choose the author assigned to this post.",
              editabilityState: "editable",
              fieldKey: "author",
              label: "Author",
              multiple: false,
              nullable: false,
              patchMode: "link_replace",
              readOnly: false,
              relationMode: "managed_single",
              relationTargetEntity: "authors",
              required: true,
              searchMode: "remote",
              sidebarFieldId: "author",
              uiControl: "single_select",
              valueKind: "relation_id_or_key",
              visible: true,
            },
          ],
        }}
        postAuthorOptions={[]}
        postSidebarConfig={{
          nodes: [{ id: "author", kind: "field", parentId: null, visible: true }],
          version: 2,
        }}
        selectedPost={{
          ...createSelectedPost(),
          authorId: null,
        }}
      />,
    );

    expect(
      screen.getByText("This mapped author field is required, but no valid authors are available."),
    ).toBeInTheDocument();
  });

  it("keeps an unresolved selected author visible instead of collapsing to the empty-state message", () => {
    render(
      <ProjectEditorPostSidePanel
        {...baseProps}
        contentRuntime={{
          customFields: [],
          editorFields: [],
          fieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
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
              searchMode: "remote",
              uiControl: "single_select",
              valueKind: "relation_id_or_key",
              visible: true,
            },
          ],
          filesStorage: null,
          mediaStorage: null,
          sidebarFieldSpecs: [
            {
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
              searchMode: "remote",
              sidebarFieldId: "author",
              uiControl: "single_select",
              valueKind: "relation_id_or_key",
              visible: true,
            },
          ],
        }}
        postAuthorOptions={[]}
        postSidebarConfig={{
          nodes: [{ id: "author", kind: "field", parentId: null, visible: true }],
          version: 2,
        }}
        selectedPost={{
          ...createSelectedPost(),
          authorId: "author-missing",
        }}
      />,
    );

    expect(screen.getByText("author-missing")).toBeInTheDocument();
    expect(
      screen.queryByText("Create authors from the Authors page to assign them here."),
    ).not.toBeInTheDocument();
  });

  it("shows a blocked required relation message when no valid parent page options exist", () => {
    render(
      <ProjectEditorPostSidePanel
        {...baseProps}
        contentRuntime={{
          customFields: [],
          editorFields: [],
          fieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
              editabilityState: "editable",
              fieldKey: "parentPage",
              label: "Parent Page",
              multiple: false,
              nullable: false,
              patchMode: "link_replace",
              readOnly: false,
              relationMode: "managed_single",
              required: true,
              searchMode: "remote",
              uiControl: "single_select",
              valueKind: "relation_id_or_key",
              visible: true,
            },
          ],
          filesStorage: null,
          mediaStorage: null,
          sidebarFieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
              defaultParentId: null,
              description: "Choose the parent page assigned to this post.",
              editabilityState: "editable",
              fieldKey: "parentPage",
              label: "Parent Page",
              multiple: false,
              nullable: false,
              patchMode: "link_replace",
              readOnly: false,
              relationMode: "managed_single",
              required: true,
              searchMode: "remote",
              sidebarFieldId: "parent_page",
              uiControl: "single_select",
              valueKind: "relation_id_or_key",
              visible: true,
            },
          ],
        }}
        parentPageOptions={[]}
        postSidebarConfig={{
          nodes: [{ id: "parent_page", kind: "field", parentId: null, visible: true }],
          version: 2,
        }}
        selectedPost={{
          ...createSelectedPost(),
          parentPageId: null,
        }}
      />,
    );

    expect(
      screen.getByText("This mapped parent page field is required, but no valid parent pages are available."),
    ).toBeInTheDocument();
  });

  it("keeps an unresolved selected parent page visible instead of collapsing to the empty-state message", () => {
    render(
      <ProjectEditorPostSidePanel
        {...baseProps}
        contentRuntime={{
          customFields: [],
          editorFields: [],
          fieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
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
              searchMode: "remote",
              uiControl: "single_select",
              valueKind: "relation_id_or_key",
              visible: true,
            },
          ],
          filesStorage: null,
          mediaStorage: null,
          sidebarFieldSpecs: [
            {
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
              searchMode: "remote",
              sidebarFieldId: "parent_page",
              uiControl: "single_select",
              valueKind: "relation_id_or_key",
              visible: true,
            },
          ],
        }}
        parentPageOptions={[]}
        postSidebarConfig={{
          nodes: [{ id: "parent_page", kind: "field", parentId: null, visible: true }],
          version: 2,
        }}
        selectedPost={{
          ...createSelectedPost(),
          parentPageId: "post-parent-missing",
        }}
      />,
    );

    expect(screen.getByText("post-parent-missing")).toBeInTheDocument();
    expect(
      screen.queryByText("No eligible parent pages are available for this post yet."),
    ).not.toBeInTheDocument();
  });

  it("shows an honest unsupported relation message instead of a fake author selector", () => {
    render(
      <ProjectEditorPostSidePanel
        {...baseProps}
        contentRuntime={{
          customFields: [],
          editorFields: [],
          fieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
              editabilityState: "unsupported",
              fieldKey: "author",
              label: "Author",
              multiple: true,
              nullable: true,
              patchMode: "no_write",
              readOnly: true,
              relationMode: "managed_multi",
              required: false,
              searchMode: "none",
              uiControl: "read_only",
              valueKind: "relation_id_or_key",
              visible: true,
            },
          ],
          filesStorage: null,
          mediaStorage: null,
          sidebarFieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
              defaultParentId: null,
              description: "Choose the author assigned to this post.",
              editabilityState: "unsupported",
              fieldKey: "author",
              label: "Author",
              multiple: true,
              nullable: true,
              patchMode: "no_write",
              readOnly: true,
              relationMode: "managed_multi",
              required: false,
              searchMode: "none",
              sidebarFieldId: "author",
              uiControl: "read_only",
              valueKind: "relation_id_or_key",
              visible: true,
            },
          ],
        }}
        postSidebarConfig={{
          nodes: [{ id: "author", kind: "field", parentId: null, visible: true }],
          version: 2,
        }}
      />,
    );

    expect(
      screen.getByText("This author field can't be edited here yet. Ask an owner to review this field mapping."),
    ).toBeInTheDocument();
    expect(screen.getByText("Current value: Owner")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Author" })).not.toBeInTheDocument();
  });

  it("surfaces helper-row ambiguity for single-value relations instead of showing a writable selector", () => {
    render(
      <ProjectEditorPostSidePanel
        {...baseProps}
        contentRuntime={{
          customFields: [],
          editorFields: [],
          fieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
              editabilityState: "editable",
              fieldKey: "author",
              label: "Author",
              multiple: false,
              nullable: true,
              patchMode: "link_replace",
              readOnly: false,
              relationMode: "managed_single",
              required: false,
              searchMode: "remote",
              uiControl: "single_select",
              valueKind: "relation_id_or_key",
              visible: true,
            },
          ],
          filesStorage: null,
          mediaStorage: null,
          sidebarFieldSpecs: [
            {
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
              required: false,
              searchMode: "remote",
              sidebarFieldId: "author",
              uiControl: "single_select",
              valueKind: "relation_id_or_key",
              visible: true,
            },
          ],
        }}
        postSidebarConfig={{
          nodes: [{ id: "author", kind: "field", parentId: null, visible: true }],
          version: 2,
        }}
        selectedPost={{
          ...createSelectedPost(),
          fieldConflicts: {
            author: {
              code: "helper_row_ambiguity",
              helperRowCount: 2,
              values: ["author-1", "author-2"],
            },
          },
        }}
      />,
    );

    expect(
      screen.getByText("This author field has duplicate records behind it. Ask an owner to review the mapping before editing it."),
    ).toBeInTheDocument();
    expect(screen.getByText("Current value: Owner")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Author" })).not.toBeInTheDocument();
  });

  it("keeps unresolved selected tags visible instead of collapsing to the empty-state message", () => {
    render(
      <ProjectEditorPostSidePanel
        {...baseProps}
        contentRuntime={{
          customFields: [],
          editorFields: [],
          fieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
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
              searchMode: "remote",
              uiControl: "multi_select",
              valueKind: "relation_id_or_key",
              visible: true,
            },
          ],
          filesStorage: null,
          mediaStorage: null,
          sidebarFieldSpecs: [
            {
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
              searchMode: "remote",
              sidebarFieldId: "tags",
              uiControl: "multi_select",
              valueKind: "relation_id_or_key",
              visible: true,
            },
          ],
        }}
        postSidebarConfig={{
          nodes: [{ id: "tags", kind: "field", parentId: null, visible: true }],
          version: 2,
        }}
        selectedPost={{
          ...createSelectedPost(),
          tagIds: ["tag-missing"],
        }}
        tags={[]}
      />,
    );

    expect(screen.getByText("tag-missing")).toBeInTheDocument();
    expect(
      screen.queryByText("Create tags from the Tags page to assign them here."),
    ).not.toBeInTheDocument();
  });

  it("keeps unresolved selected categories visible instead of collapsing to the empty-state message", () => {
    render(
      <ProjectEditorPostSidePanel
        {...baseProps}
        categoryOptions={[]}
        contentRuntime={{
          customFields: [],
          editorFields: [],
          fieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
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
              searchMode: "remote",
              uiControl: "multi_select",
              valueKind: "relation_id_or_key",
              visible: true,
            },
          ],
          filesStorage: null,
          mediaStorage: null,
          sidebarFieldSpecs: [
            {
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
              searchMode: "remote",
              sidebarFieldId: "categories",
              uiControl: "multi_select",
              valueKind: "relation_id_or_key",
              visible: true,
            },
          ],
        }}
        postSidebarConfig={{
          nodes: [{ id: "categories", kind: "field", parentId: null, visible: true }],
          version: 2,
        }}
        selectedPost={{
          ...createSelectedPost(),
          categoryIds: ["category-missing"],
        }}
      />,
    );

    expect(screen.getByText("category-missing")).toBeInTheDocument();
    expect(
      screen.queryByText("Create categories from the Categories page to assign them here."),
    ).not.toBeInTheDocument();
  });

  it("renders adapter-defined custom fields even when raw mapping metadata is unavailable", () => {
    render(
      <ProjectEditorPostSidePanel
        {...baseProps}
        contentRuntime={{
          customFields: [],
          editorFields: [],
          fieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
              editabilityState: "editable",
              fieldKey: "reading_time_minutes",
              isCustomField: true,
              label: "Reading Time",
              multiple: false,
              nullable: true,
              patchMode: "replace",
              readOnly: false,
              relationMode: "none",
              required: false,
              searchMode: "none",
              uiControl: "number_input",
              valueKind: "number",
              visible: true,
            },
          ],
          filesStorage: null,
          mediaStorage: null,
          sidebarFieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
              defaultParentId: "custom-fields",
              description: "Edit the mapped \"Reading Time\" field.",
              editabilityState: "editable",
              fieldKey: "reading_time_minutes",
              isCustomField: true,
              label: "Reading Time",
              multiple: false,
              nullable: true,
              patchMode: "replace",
              readOnly: false,
              relationMode: "none",
              required: false,
              searchMode: "none",
              sidebarFieldId: "custom_field:reading_time_minutes",
              uiControl: "number_input",
              valueKind: "number",
              visible: true,
            },
          ],
        }}
        postSidePanelView={"page:custom-fields"}
        postSidebarConfig={{
          nodes: [{ id: "custom_field:reading_time_minutes", kind: "field", parentId: null, visible: true }],
          version: 2,
        }}
        selectedPost={{
          ...createSelectedPost(),
          customFields: {
            reading_time_minutes: 7,
          },
        }}
      />,
    );

    expect(screen.getByLabelText(/Reading Time/i)).toHaveValue(7);
  });

  it("renders custom sidebar fields from sidebar specs without duplicate field specs", () => {
    render(
      <ProjectEditorPostSidePanel
        {...baseProps}
        contentRuntime={{
          customFields: [],
          editorFields: [],
          filesStorage: null,
          mediaStorage: null,
          sidebarFieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
              defaultParentId: "custom-fields",
              description: "Edit the mapped \"Reading Time\" field.",
              editabilityState: "editable",
              fieldKey: "reading_time_minutes",
              isCustomField: true,
              label: "Reading Time",
              multiple: false,
              nullable: true,
              patchMode: "replace",
              readOnly: false,
              relationMode: "none",
              required: false,
              searchMode: "none",
              sidebarFieldId: "custom_field:reading_time_minutes",
              uiControl: "number_input",
              valueKind: "number",
              visible: true,
            },
          ],
        }}
        postSidePanelView={"page:custom-fields"}
        postSidebarConfig={{
          nodes: [{ id: "custom_field:reading_time_minutes", kind: "field", parentId: null, visible: true }],
          version: 2,
        }}
        selectedPost={{
          ...createSelectedPost(),
          customFields: {
            reading_time_minutes: 7,
          },
        }}
      />,
    );

    expect(screen.getByLabelText(/Reading Time/i)).toHaveValue(7);
  });

  it("shows a minimal fallback when a custom field value cannot be rendered cleanly", () => {
    const circularValue: Record<string, unknown> = {};
    circularValue.self = circularValue;

    render(
      <ProjectEditorPostSidePanel
        {...baseProps}
        contentRuntime={{
          customFields: [],
          editorFields: [],
          fieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
              editabilityState: "read_only",
              fieldKey: "debug_payload",
              isCustomField: true,
              label: "Debug Payload",
              multiple: false,
              nullable: true,
              patchMode: "no_write",
              readOnly: true,
              relationMode: "none",
              required: false,
              searchMode: "none",
              semanticRole: "customField",
              uiControl: "read_only",
              valueKind: "json_object",
              visible: true,
            },
          ],
          filesStorage: null,
          mediaStorage: null,
          sidebarFieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
              defaultParentId: "custom-fields",
              description: "Review the mapped debug payload.",
              editabilityState: "read_only",
              fieldKey: "debug_payload",
              isCustomField: true,
              label: "Debug Payload",
              multiple: false,
              nullable: true,
              patchMode: "no_write",
              readOnly: true,
              relationMode: "none",
              required: false,
              searchMode: "none",
              semanticRole: "customField",
              sidebarFieldId: "custom_field:debug_payload",
              uiControl: "read_only",
              valueKind: "json_object",
              visible: true,
            },
          ],
        }}
        postSidePanelView={"page:custom-fields"}
        postSidebarConfig={{
          nodes: [{ id: "custom_field:debug_payload", kind: "field", parentId: null, visible: true }],
          version: 2,
        }}
        selectedPost={{
          ...createSelectedPost(),
          customFields: {
            debug_payload: circularValue,
          },
        }}
      />,
    );

    expect(screen.getByText("Debug Payload")).toBeInTheDocument();
    expect(screen.getByText("This field couldn't be rendered.")).toBeInTheDocument();
    expect(screen.queryByText(/Control:/i)).not.toBeInTheDocument();
  });

  it("renders adapter-defined custom relation fields with remote relation options", () => {
    useProjectEditorRelationOptionsQueryMock.mockImplementation((({ fieldKey }: { fieldKey: string }) => ({
      data:
        fieldKey === "custom_field:sponsor_author_id"
          ? [
              { id: "author-1", label: "Owner" },
              { id: "author-2", label: "Sponsor Author" },
            ]
          : [],
      error: null,
      isError: false,
      isFetching: false,
      isLoading: false,
    })) as never);

    render(
      <ProjectEditorPostSidePanel
        {...baseProps}
        {...createCustomRelationSidebarProps({
          fieldKey: "sponsor_author_id",
          label: "Sponsor Author",
          multiple: false,
          relationTargetEntity: "authors",
        })}
        selectedPost={{
          ...createSelectedPost(),
          customFields: {
            sponsor_author_id: "author-2",
          },
        }}
      />,
    );

    expect(screen.getByRole("combobox", { name: /Sponsor Author/i })).toBeInTheDocument();
    expect(useProjectEditorRelationOptionsQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        fieldKey: "custom_field:sponsor_author_id",
        limit: 200,
        projectId: "project-1",
      }),
    );
  });

  it("renders media custom relation previews with mapped object-path details", () => {
    useProjectEditorRelationOptionsQueryMock.mockImplementation((({ fieldKey }: { fieldKey: string }) => ({
      data:
        fieldKey === "custom_field:hero_media_id"
          ? [
              {
                id: "media-2",
                label: "cover.png",
                metadata: {
                  objectPath: "uploads/cover.png",
                  url: "https://cdn.example.com/uploads/cover.png",
                },
              },
            ]
          : [],
      error: null,
      isError: false,
      isFetching: false,
      isLoading: false,
    })) as never);

    render(
      <ProjectEditorPostSidePanel
        {...baseProps}
        {...createCustomRelationSidebarProps({
          fieldKey: "hero_media_id",
          label: "Hero Media",
          multiple: false,
          relationTargetEntity: "media",
        })}
        selectedPost={{
          ...createSelectedPost(),
          customFields: {
            hero_media_id: "media-2",
          },
        }}
      />,
    );

    expect(screen.getByText("uploads/cover.png")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /cover\.png preview/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open Hero Media/i })).toHaveAttribute(
      "href",
      "https://cdn.example.com/uploads/cover.png",
    );
  });

  it("renders selected media in stored order and lets editors reorder them", () => {
    const updatePost = vi.fn();

    useProjectEditorRelationOptionsQueryMock.mockImplementation((({ fieldKey }: { fieldKey: string }) => ({
      data:
        fieldKey === "custom_field:gallery_media_ids"
          ? [
              {
                id: "media-1",
                label: "First Image",
                metadata: {
                  objectPath: "gallery/first.png",
                  url: "https://cdn.example.com/gallery/first.png",
                },
              },
              {
                id: "media-2",
                label: "Second Image",
                metadata: {
                  objectPath: "gallery/second.png",
                  url: "https://cdn.example.com/gallery/second.png",
                },
              },
            ]
          : [],
      error: null,
      isError: false,
      isFetching: false,
      isLoading: false,
    })) as never);

    render(
      <ProjectEditorPostSidePanel
        {...baseProps}
        {...createCustomRelationSidebarProps({
          fieldKey: "gallery_media_ids",
          label: "Gallery Media",
          multiple: true,
          relationTargetEntity: "media",
        })}
        selectedPost={{
          ...createSelectedPost(),
          customFields: {
            gallery_media_ids: ["media-2", "media-stale", "media-1"],
          },
        }}
        updatePost={updatePost}
      />,
    );

    const selectedList = screen.getByRole("list", { name: /Gallery Media selected items/i });
    const orderedItems = within(selectedList)
      .getAllByRole("listitem")
      .map((item) => item.textContent ?? "");

    expect(orderedItems[0]).toContain("Second Image");
    expect(orderedItems[1]).toContain("media-stale");
    expect(orderedItems[2]).toContain("First Image");
    expect(within(selectedList).getByText("Stale selection")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Move First Image earlier/i }));

    expect(updatePost).toHaveBeenCalledWith("post-1", {
      customFields: {
        gallery_media_ids: ["media-2", "media-1", "media-stale"],
      },
    });
  });

  it("renders file custom relation previews and read-only stale file lists", () => {
    useProjectEditorRelationOptionsQueryMock.mockImplementation((({ fieldKey }: { fieldKey: string }) => ({
      data:
        fieldKey === "custom_field:attachment_file_id"
          ? [
              {
                id: "file-2",
                label: "spec.pdf",
                metadata: {
                  objectPath: "docs/spec.pdf",
                  url: "https://files.example.com/docs/spec.pdf",
                },
              },
            ]
          : fieldKey === "custom_field:reference_file_ids"
            ? [
                {
                  id: "file-2",
                  label: "spec.pdf",
                  metadata: {
                    objectPath: "docs/spec.pdf",
                    url: "https://files.example.com/docs/spec.pdf",
                  },
                },
              ]
            : [],
      error: null,
      isError: false,
      isFetching: false,
      isLoading: false,
    })) as never);

    const { rerender } = render(
      <ProjectEditorPostSidePanel
        {...baseProps}
        {...createCustomRelationSidebarProps({
          fieldKey: "attachment_file_id",
          label: "Attachment File",
          multiple: false,
          relationTargetEntity: "files",
        })}
        selectedPost={{
          ...createSelectedPost(),
          customFields: {
            attachment_file_id: "file-2",
          },
        }}
      />,
    );

    expect(screen.getByText("docs/spec.pdf")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open Attachment File/i })).toHaveAttribute(
      "href",
      "https://files.example.com/docs/spec.pdf",
    );

    rerender(
      <ProjectEditorPostSidePanel
        {...baseProps}
        {...createCustomRelationSidebarProps({
          fieldKey: "reference_file_ids",
          label: "Reference Files",
          multiple: true,
          readOnly: true,
          relationTargetEntity: "files",
        })}
        selectedPost={{
          ...createSelectedPost(),
          customFields: {
            reference_file_ids: ["file-2", "file-stale"],
          },
        }}
      />,
    );

    expect(
      screen.getByText("This custom field is read-only in BaseBuddy."),
    ).toBeInTheDocument();

    const selectedList = screen.getByRole("list", { name: /Reference Files selected items/i });
    expect(within(selectedList).getByText("spec.pdf")).toBeInTheDocument();
    expect(within(selectedList).getByText("docs/spec.pdf")).toBeInTheDocument();
    expect(within(selectedList).getAllByText("file-stale")).toHaveLength(2);
    expect(within(selectedList).getByText("Stale selection")).toBeInTheDocument();
  });
});
