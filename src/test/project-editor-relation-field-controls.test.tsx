import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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

import { ProjectEditorRelationField } from "@/components/editor/project-editor/relation-field-controls";
import type { ContentFieldSpecSummary } from "@/lib/content-runtime/shared";

const baseFieldSpec = {
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
  searchMode: "none",
  uiControl: "multi_select",
  valueKind: "relation_id_or_key",
  visible: true,
} satisfies ContentFieldSpecSummary;

describe("project editor relation field controls", () => {
  it("caps remote relation option requests at the local render window size", () => {
    render(
      <ProjectEditorRelationField
        canEditCurrentPost
        fieldKey="tags"
        fieldSpec={{
          ...baseFieldSpec,
          relationTargetEntity: "tags",
          searchMode: "remote",
        }}
        inputId="tags-field"
        label="Tags"
        onChange={vi.fn()}
        projectId="project-1"
        selectedPostId="post-1"
        value={[]}
      />,
    );

    expect(useProjectEditorRelationOptionsQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 200,
      }),
    );
  });

  it("renders only the first 200 local relation options", () => {
    const options = Array.from({ length: 225 }, (_, index) => ({
      id: `tag-${index}`,
      label: `Tag ${index}`,
    }));

    render(
      <ProjectEditorRelationField
        canEditCurrentPost
        fieldKey="tags"
        fieldSpec={baseFieldSpec}
        inputId="tags-field"
        label="Tags"
        onChange={vi.fn()}
        options={options}
        projectId="project-1"
        selectedPostId="post-1"
        value={[]}
      />,
    );

    expect(screen.getByText("Tag 199")).toBeInTheDocument();
    expect(screen.queryByText("Tag 200")).not.toBeInTheDocument();
    expect(screen.getByText("Showing the first 200 options. Search to narrow the list.")).toBeInTheDocument();
  });

  it("renders the empty state when there are no selectable single-select options", () => {
    render(
      <ProjectEditorRelationField
        canEditCurrentPost
        fieldKey="author"
        fieldSpec={{
          ...baseFieldSpec,
          fieldKey: "author",
          label: "Author",
          multiple: false,
          relationMode: "managed_single",
          relationTargetEntity: "authors",
          uiControl: "single_select",
        }}
        inputId="author-field"
        label="Author"
        onChange={vi.fn()}
        options={[]}
        projectId="project-1"
        selectedPostId="post-1"
        value={null}
      />,
    );

    expect(screen.getByText(/No selectable options are available/i)).toBeInTheDocument();
  });

  it("toggles badge selections for multi-select relations", () => {
    const onChange = vi.fn();

    render(
      <ProjectEditorRelationField
        canEditCurrentPost
        fieldKey="tags"
        fieldSpec={baseFieldSpec}
        inputId="tags-field"
        label="Tags"
        onChange={onChange}
        optionStyle="badges"
        options={[
          { id: "tag-1", label: "News" },
          { id: "tag-2", label: "Product" },
        ]}
        projectId="project-1"
        selectedPostId="post-1"
        value={["tag-1"]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Product" }));
    expect(onChange).toHaveBeenCalledWith(["tag-1", "tag-2"]);
  });

  it("renders search input for single-select remote relation controls", () => {
    const onSearchChange = vi.fn();

    render(
      <ProjectEditorRelationField
        canEditCurrentPost
        fieldKey="author"
        fieldSpec={{
          ...baseFieldSpec,
          fieldKey: "author",
          label: "Author",
          multiple: false,
          relationMode: "managed_single",
          relationTargetEntity: "authors",
          searchMode: "remote",
          uiControl: "single_select",
        }}
        inputId="author-field"
        label="Author"
        onChange={vi.fn()}
        onSearchChange={onSearchChange}
        options={[{ id: "author-1", label: "Ada Lovelace" }]}
        projectId="project-1"
        searchInputId="author-search"
        searchPlaceholder="Search authors"
        searchValue=""
        selectedPostId="post-1"
        value={null}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Search authors"), {
      target: { value: "gra" },
    });

    expect(onSearchChange).toHaveBeenCalledWith("gra");
  });

  it("keeps large taxonomy fields usable when the initial option page is empty", () => {
    render(
      <ProjectEditorRelationField
        canEditCurrentPost
        emptyStateMessage="No tags are available yet."
        fieldKey="tags"
        fieldSpec={{
          ...baseFieldSpec,
          relationTargetEntity: "tags",
          searchMode: "remote",
        }}
        inputId="tags-field"
        label="Tags"
        onChange={vi.fn()}
        onSearchChange={vi.fn()}
        options={[]}
        projectId="project-1"
        searchInputId="tags-search"
        searchPlaceholder="Search tags"
        searchValue=""
        selectedPostId="post-1"
        totalOptionCount={0}
        value={[]}
      />,
    );

    expect(screen.getByPlaceholderText("Search tags")).toBeInTheDocument();
    expect(screen.getByText("No tags are available yet.")).toBeInTheDocument();
  });

  it("shows a search-specific empty state for large taxonomy searches", () => {
    render(
      <ProjectEditorRelationField
        canEditCurrentPost
        emptyStateMessage="No tags are available yet."
        fieldKey="tags"
        fieldSpec={{
          ...baseFieldSpec,
          relationTargetEntity: "tags",
          searchMode: "remote",
        }}
        inputId="tags-field"
        label="Tags"
        noResultsMessage="No tags match this search."
        onChange={vi.fn()}
        onSearchChange={vi.fn()}
        options={[]}
        projectId="project-1"
        searchInputId="tags-search"
        searchPlaceholder="Search tags"
        searchValue="launch"
        selectedPostId="post-1"
        totalOptionCount={500_000}
        value={[]}
      />,
    );

    expect(screen.getByDisplayValue("launch")).toBeInTheDocument();
    expect(screen.getByText("No tags match this search.")).toBeInTheDocument();
  });
});
