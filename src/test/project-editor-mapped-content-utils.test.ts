import { describe, expect, it } from "vitest";

import { getPostsMappingStepsForCollection } from "@/components/editor/project-editor/constants";
import {
  getProjectEditorAuthorOptionsFromRelationOptions,
  getProjectEditorCategoryOptionsFromRelationOptions,
  getProjectEditorCollectionAvailability,
  getProjectEditorCollectionSetupCopy,
  getProjectEditorMainFieldSpecs,
  getProjectEditorPostFieldStates,
  getProjectEditorPostsListUiCapabilities,
  getProjectEditorParentPageOptionsFromRelationOptions,
  getProjectEditorTagOptionsFromRelationOptions,
  getProjectEditorWorkspaceNotReadyCopy,
  hasProjectEditorRemoteRelationSearch,
  isSelectedPostEditorHydrated,
  resolveWorkspaceState,
  shouldApplySelectedPostEditorOptionsPayload,
} from "@/components/editor/project-editor/utils";
import type { ContentWorkspaceMeta } from "@/lib/content-runtime/shared";

const createMappedContentRuntime = (
  overrides: Partial<NonNullable<ContentWorkspaceMeta["contentRuntime"]>> = {},
): NonNullable<ContentWorkspaceMeta["contentRuntime"]> => ({
  customFields: [],
  editorFields: [],
  fieldSpecs: [],
  filesStorage: null,
  mediaStorage: null,
  ...overrides,
});

describe("project editor mapped-content collection availability", () => {
  it("defaults missing workspace metadata to the self-host mapping draft state", () => {
    expect(
      resolveWorkspaceState({}),
    ).toBe("mapping_draft");
  });

  it("preserves explicit ready workspace metadata", () => {
    expect(
      resolveWorkspaceState({
        workspaceState: "ready",
      }),
    ).toBe("ready");
  });

  it("shows accessible mapped-content sections as unmapped during the initial mapping draft", () => {
    expect(
      getProjectEditorCollectionAvailability({
        canManageAuthorDirectory: true,
        collection: "Categories",
        contentRuntime: null,
        isContentProject: true,
        workspaceState: "mapping_draft",
      }),
    ).toBe("unmapped");

    expect(
      getProjectEditorCollectionAvailability({
        canManageAuthorDirectory: true,
        collection: "Media",
        contentRuntime: null,
        isContentProject: true,
        workspaceState: "mapping_draft",
      }),
    ).toBe("unmapped");
  });

  it("keeps authors hidden when the member cannot access the author directory", () => {
    expect(
      getProjectEditorCollectionAvailability({
        canManageAuthorDirectory: false,
        collection: "Authors",
        contentRuntime: createMappedContentRuntime(),
        isContentProject: true,
        workspaceState: "ready",
      }),
    ).toBe("hidden");
  });

  it("marks mapped mapped-content sections as ready once their runtime support exists", () => {
    const runtime = createMappedContentRuntime({
      fieldSpecs: [
        {
          allowedValues: null,
          contentFormat: null,
          editabilityState: "editable",
          fieldKey: "author",
          label: "Author",
          multiple: false,
          nullable: true,
          patchMode: "replace",
          readOnly: false,
          relationMode: "managed_single",
          required: false,
          searchMode: "remote",
          semanticRole: "author",
          uiControl: "single_select",
          valueKind: "relation_id_or_key",
          visible: true,
        },
        {
          allowedValues: null,
          contentFormat: null,
          editabilityState: "editable",
          fieldKey: "categories",
          label: "Categories",
          multiple: true,
          nullable: true,
          patchMode: "replace",
          readOnly: false,
          relationMode: "managed_multi",
          required: false,
          searchMode: "remote",
          semanticRole: "categories",
          uiControl: "multi_select",
          valueKind: "relation_id_or_key",
          visible: true,
        },
        {
          allowedValues: null,
          contentFormat: null,
          editabilityState: "editable",
          fieldKey: "tags",
          label: "Tags",
          multiple: true,
          nullable: true,
          patchMode: "replace",
          readOnly: false,
          relationMode: "managed_multi",
          required: false,
          searchMode: "remote",
          semanticRole: "tags",
          uiControl: "multi_select",
          valueKind: "relation_id_or_key",
          visible: true,
        },
      ],
      mediaStorage: {
        bucketName: "cms-media",
        canManage: false,
        provider: "supabase_bucket",
        supportsLibrary: true,
      },
    });

    expect(
      getProjectEditorCollectionAvailability({
        canManageAuthorDirectory: true,
        collection: "Authors",
        contentRuntime: runtime,
        isContentProject: true,
        workspaceState: "ready",
      }),
    ).toBe("ready");

    expect(
      getProjectEditorCollectionAvailability({
        canManageAuthorDirectory: true,
        collection: "Categories",
        contentRuntime: runtime,
        isContentProject: true,
        workspaceState: "ready",
      }),
    ).toBe("ready");

    expect(
      getProjectEditorCollectionAvailability({
        canManageAuthorDirectory: true,
        collection: "Media",
        contentRuntime: runtime,
        isContentProject: true,
        workspaceState: "ready",
      }),
    ).toBe("ready");
  });

  it("keeps unmapped mapped-content sections visible-but-unmapped after the posts mapping is ready", () => {
    const runtime = createMappedContentRuntime({
      mediaStorage: {
        bucketName: null,
        canManage: false,
        provider: "none",
        supportsLibrary: false,
      },
    });

    expect(
      getProjectEditorCollectionAvailability({
        canManageAuthorDirectory: true,
        collection: "Tags",
        contentRuntime: runtime,
        isContentProject: true,
        workspaceState: "ready",
      }),
    ).toBe("unmapped");

    expect(
      getProjectEditorCollectionAvailability({
        canManageAuthorDirectory: true,
        collection: "Files",
        contentRuntime: runtime,
        isContentProject: true,
        workspaceState: "ready",
      }),
    ).toBe("unmapped");
  });
});

describe("project editor posts-list ui capabilities", () => {
  it("keeps non-mapped-content posts-list capabilities enabled without adapter field specs", () => {
    expect(
      getProjectEditorPostsListUiCapabilities({
        contentRuntime: null,
        isContentProject: false,
      }),
    ).toMatchObject({
      showAuthorColumn: true,
      showSlugColumn: true,
      showStatusControls: true,
    });
  });

  it("derives mapped-content posts-list capabilities from adapter field specs", () => {
    expect(
      getProjectEditorPostsListUiCapabilities({
        contentRuntime: createMappedContentRuntime({
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
              searchMode: "local",
              uiControl: "single_select",
              valueKind: "relation_id_or_key",
              visible: true,
            },
            {
              allowedValues: null,
              contentFormat: null,
              editabilityState: "editable",
              fieldKey: "slug",
              label: "Slug",
              multiple: false,
              nullable: true,
              patchMode: "replace",
              readOnly: false,
              relationMode: "none",
              required: true,
              searchMode: "none",
              uiControl: "text_input",
              valueKind: "text_like",
              visible: true,
            },
            {
              allowedValues: null,
              contentFormat: null,
              editabilityState: "read_only",
              fieldKey: "status",
              label: "Status",
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
        }),
        isContentProject: true,
      }),
    ).toEqual({
      showAuthorColumn: true,
      showSlugColumn: true,
      showStatusControls: false,
    });
  });

  it("does not derive mapped-content posts-list capabilities from sidebar specs when field specs are unavailable", () => {
    expect(
      getProjectEditorPostsListUiCapabilities({
        contentRuntime: createMappedContentRuntime({
          fieldSpecs: [],
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
        }),
        isContentProject: true,
      }),
    ).toEqual({
      showAuthorColumn: false,
      showSlugColumn: false,
      showStatusControls: false,
    });
  });
});

describe("project editor post field states", () => {
  it("keeps non-mapped-content editor field states enabled without adapter field specs", () => {
    expect(
      getProjectEditorPostFieldStates({
        contentRuntime: null,
        isContentProject: false,
      }),
    ).toMatchObject({
      excerpt: { editable: true, mapped: true, visible: true },
      seoDescription: { editable: true, mapped: true, visible: true },
      seoTitle: { editable: true, mapped: true, visible: true },
      slug: { editable: true, mapped: true, visible: true },
      status: { editable: true, mapped: true, visible: true },
      title: { editable: true, mapped: true, visible: true },
    });
  });

  it("derives editor field states from adapter field specs instead of legacy booleans", () => {
    expect(
      getProjectEditorPostFieldStates({
        contentRuntime: createMappedContentRuntime({
          fieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
              editabilityState: "read_only",
              fieldKey: "title",
              label: "Title",
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
              fieldKey: "status",
              label: "Status",
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
              editabilityState: "editable",
              fieldKey: "seoDescription",
              label: "Meta Description",
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
              visible: false,
            },
          ],
        }),
        isContentProject: true,
      }),
    ).toMatchObject({
      excerpt: { editable: false, mapped: false, visible: false },
      focusKeyword: { editable: false, mapped: true, visible: false },
      seoDescription: { editable: true, mapped: true, visible: true },
      seoTitle: { editable: false, mapped: false, visible: false },
      slug: { editable: false, mapped: false, visible: false },
      status: { editable: false, mapped: true, visible: true },
      title: { editable: false, mapped: true, visible: true },
    });
  });

  it("derives editor field states from semantic roles instead of mapped field keys", () => {
    expect(
      getProjectEditorPostFieldStates({
        contentRuntime: createMappedContentRuntime({
          fieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
              editabilityState: "editable",
              fieldKey: "headline_text",
              label: "Headline",
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
              contentFormat: null,
              editabilityState: "editable",
              fieldKey: "url_path",
              label: "URL Path",
              multiple: false,
              nullable: true,
              patchMode: "replace",
              readOnly: false,
              relationMode: "none",
              required: false,
              searchMode: "none",
              semanticRole: "slug",
              uiControl: "text_input",
              valueKind: "text_like",
              visible: true,
            },
            {
              allowedValues: null,
              contentFormat: null,
              editabilityState: "editable",
              fieldKey: "search_description",
              label: "Search Description",
              multiple: false,
              nullable: true,
              patchMode: "replace",
              readOnly: false,
              relationMode: "none",
              required: false,
              searchMode: "none",
              semanticRole: "seoDescription",
              uiControl: "textarea",
              valueKind: "long_text",
              visible: true,
            },
            {
              allowedValues: null,
              contentFormat: null,
              editabilityState: "read_only",
              fieldKey: "keyword_phrase",
              label: "Keyword Phrase",
              multiple: false,
              nullable: true,
              patchMode: "no_write",
              readOnly: true,
              relationMode: "none",
              required: false,
              searchMode: "none",
              semanticRole: "focusKeyword",
              uiControl: "read_only",
              valueKind: "text_like",
              visible: true,
            },
            {
              allowedValues: null,
              contentFormat: null,
              editabilityState: "editable",
              fieldKey: "publish_flag",
              label: "Publish Flag",
              multiple: false,
              nullable: true,
              patchMode: "replace",
              readOnly: false,
              relationMode: "none",
              required: false,
              searchMode: "none",
              semanticRole: "status",
              storagePrimitive: "boolean_mapping",
              uiControl: "toggle",
              valueKind: "boolean",
              visible: true,
            },
          ],
        }),
        isContentProject: true,
      }),
    ).toMatchObject({
      focusKeyword: { editable: false, mapped: true, visible: true },
      seoDescription: { editable: true, mapped: true, visible: true },
      slug: { editable: true, mapped: true, visible: true },
      status: { editable: true, mapped: true, visible: true },
      title: { editable: true, mapped: true, visible: true },
    });
  });
});

describe("project editor main field specs", () => {
  it("builds the default self-host title and content fields for non-mapped-content projects", () => {
    expect(
      getProjectEditorMainFieldSpecs({
        contentRuntime: null,
        isContentProject: false,
        primaryContentFormat: "markdown",
      }),
    ).toMatchObject([
      expect.objectContaining({
        fieldKey: "title",
        semanticRole: "title",
        uiControl: "text_input",
        valueKind: "text_like",
        visible: true,
      }),
      expect.objectContaining({
        contentFormat: "markdown",
        fieldKey: "content",
        semanticRole: "content",
        uiControl: "content_editor",
        valueKind: "content",
        visible: true,
      }),
    ]);
  });

  it("keeps only visible title and content field contracts for mapped-content projects", () => {
    expect(
      getProjectEditorMainFieldSpecs({
        contentRuntime: createMappedContentRuntime({
          fieldSpecs: [
            {
              allowedValues: null,
              contentFormat: null,
              editabilityState: "editable",
              fieldKey: "headline",
              label: "Headline",
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
              contentFormat: null,
              editabilityState: "editable",
              fieldKey: "summary",
              label: "Summary",
              multiple: false,
              nullable: true,
              patchMode: "replace",
              readOnly: false,
              relationMode: "none",
              required: false,
              searchMode: "none",
              semanticRole: "excerpt",
              uiControl: "textarea",
              valueKind: "long_text",
              visible: true,
            },
            {
              allowedValues: null,
              contentFormat: "html",
              editabilityState: "editable",
              fieldKey: "body_html",
              label: "Body",
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
            {
              allowedValues: null,
              contentFormat: "html",
              editabilityState: "editable",
              fieldKey: "hidden_notes",
              label: "Hidden Notes",
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
              visible: false,
            },
          ],
        }),
        isContentProject: true,
        primaryContentFormat: "html",
      }).map((fieldSpec) => fieldSpec.fieldKey),
    ).toEqual(["headline", "body_html"]);
  });
});

describe("project editor adapter-driven relation option helpers", () => {
  it("detects when an mapped-content relation field is configured for remote search", () => {
    expect(
      hasProjectEditorRemoteRelationSearch({
        contentRuntime: createMappedContentRuntime({
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
        }),
        fieldKey: "author",
      }),
    ).toBe(true);

    expect(
      hasProjectEditorRemoteRelationSearch({
        contentRuntime: createMappedContentRuntime({
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
              required: false,
              searchMode: "local",
              uiControl: "multi_select",
              valueKind: "relation_id_or_key",
              visible: true,
            },
          ],
        }),
        fieldKey: "tags",
      }),
    ).toBe(false);
  });

  it("prefers adapter author options while preserving the selected fallback author", () => {
    expect(
      getProjectEditorAuthorOptionsFromRelationOptions({
        fallbackOptions: [
          {
            avatarUrl: null,
            bio: null,
            createdAt: "2026-04-05T00:00:00.000Z",
            email: "owner@example.com",
            id: "author-1",
            name: "Owner",
            slug: "owner",
          },
          {
            avatarUrl: null,
            bio: null,
            createdAt: "2026-04-05T00:00:00.000Z",
            email: "writer@example.com",
            id: "author-2",
            name: "Writer",
            slug: "writer",
          },
        ],
        relationOptions: [
          {
            id: "author-3",
            label: "Guest",
            metadata: { slug: "guest" },
          },
        ],
        selectedAuthorId: "author-1",
      }),
    ).toEqual([
      {
        avatarUrl: null,
        bio: null,
        createdAt: "2026-04-05T00:00:00.000Z",
        email: "owner@example.com",
        id: "author-1",
        name: "Owner",
        slug: "owner",
      },
      {
        avatarUrl: null,
        bio: null,
        createdAt: "",
        email: null,
        id: "author-3",
        name: "Guest",
        slug: "guest",
      },
    ]);
  });

  it("keeps a stale selected author visible when neither fallback options nor remote results include it", () => {
    expect(
      getProjectEditorAuthorOptionsFromRelationOptions({
        fallbackOptions: [],
        relationOptions: [],
        selectedAuthorId: "missing-author",
      }),
    ).toEqual([
      {
        avatarUrl: null,
        bio: null,
        createdAt: "",
        email: null,
        id: "missing-author",
        name: "missing-author",
        slug: "missing-author",
      },
    ]);
  });

  it("normalizes adapter category options and keeps selected fallback categories visible", () => {
    expect(
      getProjectEditorCategoryOptionsFromRelationOptions({
        fallbackOptions: [
          {
            createdAt: "2026-04-05T00:00:00.000Z",
            depth: 1,
            description: null,
            hierarchyPath: "News / Launches",
            id: "category-1",
            name: "Launches",
            parentCategoryId: "category-root",
            slug: "launches",
          },
        ],
        relationOptions: [
          {
            id: "category-2",
            label: "Updates / Product",
            metadata: {
              depth: 1,
              hierarchyPath: "Updates / Product",
              name: "Product",
              slug: "product",
            },
          },
        ],
        selectedCategoryIds: ["category-1"],
      }),
    ).toEqual([
      {
        createdAt: "2026-04-05T00:00:00.000Z",
        depth: 1,
        description: null,
        hierarchyPath: "News / Launches",
        id: "category-1",
        name: "Launches",
        parentCategoryId: "category-root",
        slug: "launches",
      },
      {
        createdAt: "",
        depth: 1,
        description: null,
        hierarchyPath: "Updates / Product",
        id: "category-2",
        name: "Product",
        parentCategoryId: null,
        slug: "product",
      },
    ]);
  });

  it("keeps stale selected categories visible when the current query cannot resolve them", () => {
    expect(
      getProjectEditorCategoryOptionsFromRelationOptions({
        fallbackOptions: [],
        relationOptions: [],
        selectedCategoryIds: ["missing-category"],
      }),
    ).toEqual([
      {
        createdAt: "",
        depth: 0,
        description: null,
        hierarchyPath: "missing-category",
        id: "missing-category",
        name: "missing-category",
        parentCategoryId: null,
        slug: "missing-category",
      },
    ]);
  });

  it("normalizes adapter tag options and keeps selected fallback tags visible", () => {
    expect(
      getProjectEditorTagOptionsFromRelationOptions({
        fallbackOptions: [
          {
            createdAt: "2026-04-05T00:00:00.000Z",
            description: null,
            id: "tag-1",
            name: "Launch",
            slug: "launch",
          },
        ],
        relationOptions: [
          {
            id: "tag-2",
            label: "Product",
            metadata: {
              slug: "product",
            },
          },
        ],
        selectedTagIds: ["tag-1"],
      }),
    ).toEqual([
      {
        createdAt: "2026-04-05T00:00:00.000Z",
        description: null,
        id: "tag-1",
        name: "Launch",
        slug: "launch",
      },
      {
        createdAt: "",
        description: null,
        id: "tag-2",
        name: "Product",
        slug: "product",
      },
    ]);
  });

  it("keeps stale selected tags visible when the current query cannot resolve them", () => {
    expect(
      getProjectEditorTagOptionsFromRelationOptions({
        fallbackOptions: [],
        relationOptions: [],
        selectedTagIds: ["missing-tag"],
      }),
    ).toEqual([
      {
        createdAt: "",
        description: null,
        id: "missing-tag",
        name: "missing-tag",
        slug: "missing-tag",
      },
    ]);
  });

  it("keeps stale selected parent pages visible when the current query cannot resolve them", () => {
    expect(
      getProjectEditorParentPageOptionsFromRelationOptions({
        relationOptions: [],
        selectedParentPageId: "missing-parent",
        selectedPostId: "post-1",
      }),
    ).toEqual([
      {
        id: "missing-parent",
        label: "missing-parent",
      },
    ]);
  });

  it("excludes the current post from parent page options while preserving other mapped pages", () => {
    expect(
      getProjectEditorParentPageOptionsFromRelationOptions({
        relationOptions: [
          {
            id: "post-1",
            label: "Current Post",
          },
          {
            id: "post-2",
            label: "Parent Page",
          },
        ],
        selectedParentPageId: "post-2",
        selectedPostId: "post-1",
      }),
    ).toEqual([
      {
        id: "post-2",
        label: "Parent Page",
        metadata: undefined,
      },
    ]);
  });
});

describe("project editor mapping wizard flows", () => {
  it("keeps the initial posts flow focused on post fields only", () => {
    expect(getPostsMappingStepsForCollection("Posts").map((step) => step.id)).toEqual([
      "posts_table",
      "core_fields",
      "status",
      "timestamps",
      "seo",
      "custom_fields",
    ]);
  });

  it("uses focused follow-up flows for secondary mappings", () => {
    expect(getPostsMappingStepsForCollection("Authors").map((step) => step.id)).toEqual(["authors"]);
    expect(getPostsMappingStepsForCollection("Categories").map((step) => step.id)).toEqual([
      "categories",
    ]);
    expect(getPostsMappingStepsForCollection("Tags").map((step) => step.id)).toEqual(["tags"]);
    expect(getPostsMappingStepsForCollection("Media").map((step) => step.id)).toEqual([
      "media_storage",
    ]);
    expect(getPostsMappingStepsForCollection("Files").map((step) => step.id)).toEqual([
      "files_storage",
    ]);
  });
});

describe("project editor mapped-content setup copy", () => {
  it("asks authors, categories, and tags to map posts first during the initial draft", () => {
    expect(
      getProjectEditorCollectionSetupCopy("Authors", {
        workspaceState: "mapping_draft",
      }),
    ).toMatchObject({
      actionLabel: "Map Posts",
      title: "Map posts first",
    });

    expect(
      getProjectEditorCollectionSetupCopy("Categories", {
        workspaceState: "mapping_draft",
      }),
    ).toMatchObject({
      actionLabel: "Map Posts",
      title: "Map posts first",
    });

    expect(
      getProjectEditorCollectionSetupCopy("Tags", {
        workspaceState: "mapping_draft",
      }),
    ).toMatchObject({
      actionLabel: "Map Posts",
      title: "Map posts first",
    });
  });

  it("still allows media and files to map independently during the initial draft", () => {
    expect(
      getProjectEditorCollectionSetupCopy("Media", {
        workspaceState: "mapping_draft",
      }),
    ).toMatchObject({
      actionLabel: "Map Media",
      title: "Media needs mapping",
    });

    expect(
      getProjectEditorCollectionSetupCopy("Files", {
        workspaceState: "mapping_draft",
      }),
    ).toMatchObject({
      actionLabel: "Map Files",
      title: "Files need mapping",
    });
  });

  it("uses self-host wording for not-ready project states", () => {
    expect(getProjectEditorWorkspaceNotReadyCopy("mapping_draft")).toEqual({
      description: "Finish content mapping before the editor can load content.",
      title: "Project mapping is not ready yet",
    });

    expect(getProjectEditorWorkspaceNotReadyCopy(null)).toEqual({
      description: "Finish content mapping before the editor can load content.",
      title: "Project mapping is not ready yet",
    });
  });
});

describe("post editor payload hydration guard", () => {
  it("does not treat a selected post shell as fully hydrated until editor options are ready", () => {
    expect(
      isSelectedPostEditorHydrated({
        post: {
          editorPayloadReady: true,
          id: "post-1",
        },
        postEditorOptionsReady: false,
        routePostId: "post-1",
      }),
    ).toBe(false);
  });

  it("treats the selected post as hydrated once the full editor options are loaded", () => {
    expect(
      isSelectedPostEditorHydrated({
        post: {
          editorPayloadReady: true,
          id: "post-1",
        },
        postEditorOptionsReady: true,
        routePostId: "post-1",
      }),
    ).toBe(true);
  });

  it("applies the full editor-options payload only while the selected post is not hydrated yet", () => {
    expect(
      shouldApplySelectedPostEditorOptionsPayload({
        payloadEditorOptionsReady: true,
        payloadPostId: "post-1",
        post: {
          editorPayloadReady: true,
          id: "post-1",
        },
        postEditorOptionsReady: false,
        routePostId: "post-1",
      }),
    ).toBe(true);

    expect(
      shouldApplySelectedPostEditorOptionsPayload({
        payloadEditorOptionsReady: true,
        payloadPostId: "post-1",
        post: {
          editorPayloadReady: true,
          id: "post-1",
        },
        postEditorOptionsReady: true,
        routePostId: "post-1",
      }),
    ).toBe(false);
  });
});
