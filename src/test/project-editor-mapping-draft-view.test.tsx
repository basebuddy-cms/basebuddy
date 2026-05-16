import { render, screen } from "@testing-library/react";
import { FileText } from "lucide-react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import {
  ProjectEditorContentCollectionSetupCard,
  ProjectEditorMappingDraftCollectionCard,
  ProjectEditorPostsMappingDraftEntry,
} from "@/components/editor/project-editor/mapping-draft-view";
import { createDefaultContentMappingConfig } from "@/lib/content-runtime/mapping";

describe("mapping draft view copy", () => {
  it("uses mapping copy for members who cannot update mapping", () => {
    render(
      <ProjectEditorPostsMappingDraftEntry
        canUpdateProject={false}
        onOpenMappingDialog={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Only project owners and admins can review or update content mapping."),
    ).toBeInTheDocument();
  });

  it("labels detected collection cards as mapping and uses plain loading copy", () => {
    render(
      <ProjectEditorMappingDraftCollectionCard
        canUpdateProject
        description="Connect posts before editing."
        icon={FileText}
        loadingMappingDetection
        mappingDetectionError={null}
        selectedCollection="Posts"
        selectedDetectedMapping={createDefaultContentMappingConfig().entities.posts}
      />,
    );

    expect(screen.getByText("Posts mapping")).toBeInTheDocument();
    expect(screen.getByText("Checking this section.")).toBeInTheDocument();
  });

  it("keeps detected field details behind a disclosure", () => {
    render(
      <ProjectEditorMappingDraftCollectionCard
        canUpdateProject
        description="Connect posts before editing."
        icon={FileText}
        loadingMappingDetection={false}
        mappingDetectionError={null}
        selectedCollection="Posts"
        selectedDetectedMapping={createDefaultContentMappingConfig().entities.posts}
      />,
    );

    expect(
      screen.getByText("BaseBuddy found a possible mapping for this section. Review the details before saving."),
    ).toBeInTheDocument();
    expect(screen.getByText("Detected field details")).toBeInTheDocument();
  });

  it("describes join-table relations as stored in another table", () => {
    const mapping = createDefaultContentMappingConfig().entities.posts;
    mapping.status = "mapped";
    mapping.source = {
      kind: "table",
      primaryKey: "id",
      schema: "public",
      table: "posts",
    };
    mapping.relations.categories = {
      fieldMap: {},
      junctionSourceColumn: "post_id",
      junctionTargetColumn: "category_id",
      junctionTable: "post_categories",
      multiple: true,
      sourceColumn: null,
      status: "mapped",
      strategy: "join_table",
      targetColumn: "id",
      targetEntity: "categories",
      targetTable: "categories",
      valueColumn: null,
    };

    render(
      <ProjectEditorMappingDraftCollectionCard
        canUpdateProject
        description="Connect posts before editing."
        icon={FileText}
        loadingMappingDetection={false}
        mappingDetectionError={null}
        selectedCollection="Posts"
        selectedDetectedMapping={mapping}
      />,
    );

    expect(
      screen.getByText("categories: stored in another table - connected with post_categories to categories"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/not in table/i)).not.toBeInTheDocument();
  });

  it("asks owners to open mapping when a section is not connected", () => {
    render(
      <ProjectEditorContentCollectionSetupCard
        actionLabel="Open Tags mapping"
        canUpdateProject
        description="Connect tags before filtering."
        icon={FileText}
        onOpenMappingDialog={vi.fn()}
        title="Tags mapping"
      />,
    );

    expect(
      screen.getByText("Finish this section mapping to make it available in the editor."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Tags mapping" })).toBeInTheDocument();
  });
});
