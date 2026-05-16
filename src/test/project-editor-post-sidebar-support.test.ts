import { describe, expect, it } from "vitest";

import { getProjectEditorPostSidebarFieldDefinitions } from "@/components/editor/project-editor/post-sidebar-support";

describe("project editor post sidebar support", () => {
  it("does not expose the legacy revisions sidebar action in self-host", () => {
    const fieldDefinitions = getProjectEditorPostSidebarFieldDefinitions({
      contentRuntime: null,
      supportsPostRevisions: true,
    });

    expect(fieldDefinitions.some((fieldDefinition) => fieldDefinition.id === "revisions")).toBe(false);
  });

  it("uses the stable legacy sidebar field set instead of legacy mapped-post booleans", () => {
    const fieldDefinitions = getProjectEditorPostSidebarFieldDefinitions({
      contentRuntime: null,
      supportsPostRevisions: true,
    });

    expect(fieldDefinitions.map((fieldDefinition) => fieldDefinition.id)).toEqual(
      expect.arrayContaining([
        "author",
        "published_at",
        "updated_at",
        "excerpt",
        "slug",
        "featured_image",
        "preview",
        "categories",
        "tags",
        "focus_keyword",
        "seo_analysis",
        "readability_analysis",
        "meta_title",
        "meta_description",
      ]),
    );
    expect(fieldDefinitions).toHaveLength(14);
  });

  it("prefers adapter sidebar field specs over legacy mapped-post booleans", () => {
    const fieldDefinitions = getProjectEditorPostSidebarFieldDefinitions({
      contentRuntime: {
        customFields: [],
        editorFields: [],
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
          {
            allowedValues: null,
            contentFormat: null,
            defaultParentId: "meta-fields",
            description: "Override the meta title used in search results.",
            editabilityState: "editable",
            fieldKey: "seoTitle",
            label: "Meta Title",
            multiple: false,
            nullable: true,
            patchMode: "replace",
            readOnly: false,
            relationMode: "none",
            required: false,
            searchMode: "none",
            sidebarFieldId: "meta_title",
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
      } as never,
      supportsPostRevisions: false,
    });

    expect(fieldDefinitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          defaultParentId: null,
          description: "Edit the URL slug for this post.",
          id: "slug",
          label: "URL Slug",
        }),
        expect.objectContaining({
          defaultParentId: "meta-fields",
          description: "Override the meta title used in search results.",
          id: "meta_title",
          label: "Meta Title",
        }),
        expect.objectContaining({
          defaultParentId: "custom-fields",
          description: "Edit the mapped \"Reading Time\" field.",
          id: "custom_field:reading_time_minutes",
          label: "Reading Time",
        }),
        expect.objectContaining({
          id: "preview",
          label: "Preview",
        }),
      ]),
    );

    expect(fieldDefinitions.some((fieldDefinition) => fieldDefinition.id === "author")).toBe(false);
  });

  it("does not inject SEO or meta sidebar nodes when the adapter did not expose SEO fields", () => {
    const fieldDefinitions = getProjectEditorPostSidebarFieldDefinitions({
      contentRuntime: {
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
      } as never,
      supportsPostRevisions: false,
    });

    expect(fieldDefinitions.map((fieldDefinition) => fieldDefinition.id)).toEqual(["slug", "preview"]);
  });
});
