import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProjectEditorTaxonomyCollectionPage } from "@/components/editor/project-editor/taxonomy-ui";
import type { ContentDatabaseReadAccessNotice } from "@/lib/content-runtime/shared";

const accessNotice: ContentDatabaseReadAccessNotice = {
  estimatedRows: 229,
  kind: "database_read_access_limited",
  message:
    "BaseBuddy can connect to public.categories, but this database connection cannot read any categories. Use a database connection with read access to show the existing rows.",
  tableRef: "public.categories",
};

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

  it("shows a database access notice when a mapped taxonomy table cannot be read", () => {
    render(
      <ProjectEditorTaxonomyCollectionPage
        accessNotice={accessNotice}
        canManageTaxonomy
        collection="Categories"
        emptyMessage="No categories yet."
        entries={[]}
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

    expect(screen.getByText(accessNotice.message)).toBeInTheDocument();
    expect(screen.queryByText("No categories yet.")).not.toBeInTheDocument();
  });
});
