import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProjectEditorTaxonomyCollectionPage } from "@/components/editor/project-editor/taxonomy-ui";

describe("project editor taxonomy UI", () => {
  it("shows a child-category indicator only for visible categories with children", () => {
    render(
      <ProjectEditorTaxonomyCollectionPage
        canManageTaxonomy
        collection="Categories"
        emptyMessage="No categories yet."
        entries={[
          {
            createdAt: "2026-04-01T00:00:00.000Z",
            depth: 0,
            description: null,
            hasChildren: true,
            hierarchyPath: "Parent",
            id: "category-parent",
            name: "Parent",
            parentCategoryId: null,
            slug: "parent",
          },
          {
            createdAt: "2026-04-01T00:00:00.000Z",
            depth: 1,
            description: null,
            hasChildren: false,
            hierarchyPath: "Parent / Child",
            id: "category-child",
            name: "Child",
            parentCategoryId: "category-parent",
            slug: "child",
          },
        ]}
        helperText="Manage categories."
        isContentReady
        onDeleteEntry={vi.fn()}
        onEditEntry={vi.fn()}
        onToggleAllSelection={vi.fn()}
        onToggleSelection={vi.fn()}
        selectedEntryIds={[]}
        title="Categories"
      />,
    );

    expect(screen.getByText("Has subcategories")).toBeInTheDocument();
    expect(screen.getByText("Parent")).toBeInTheDocument();
    expect(screen.getByText("— Child")).toBeInTheDocument();
  });
});
