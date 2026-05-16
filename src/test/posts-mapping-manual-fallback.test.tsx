import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/editor/project-editor/posts-mapping-controls", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/components/editor/project-editor/posts-mapping-controls")
  >();

  return {
    ...actual,
    ProjectEditorPostsMappingRow: () => <div data-testid="mapping-row" />,
  };
});

import { ProjectEditorPostsMappingWorkspace } from "@/components/editor/project-editor/posts-mapping-workspace";
import type { MappingTableCatalogEntry } from "@/components/editor/project-editor/types";
import { createDefaultContentMappingConfig } from "@/lib/content-runtime/mapping";

const createCatalogEntry = (table = "posts"): MappingTableCatalogEntry => ({
  columnCount: 8,
  kind: "table",
  primaryKey: "id",
  rowCountEstimate: 24,
  schema: "public",
  table,
  tableRef: `public.${table}`,
});

const renderWorkspace = (overrides?: Partial<React.ComponentProps<typeof ProjectEditorPostsMappingWorkspace>>) =>
  render(
    <ProjectEditorPostsMappingWorkspace
      currentProjectName="Demo Project"
      loadingMappingDetection={false}
      loadingMappingTableCatalog={false}
      loadingSavedMapping={false}
      manualMappingTableRef="public.posts"
      mappingDetection={null}
      mappingDetectionError="Auto-detection took too long for this database. Choose a table manually to continue."
      mappingDetectionMode="manual"
      mappingEntryCollection="Posts"
      mappingSelectedTableRef={null}
      mappingTableCatalog={[createCatalogEntry()]}
      mappingTableCatalogError={null}
      onManualMappingTableRefChange={vi.fn()}
      onPostsMappingStepIndexChange={vi.fn()}
      onRegisterFinishHandler={vi.fn()}
      onRequestManualMappingDetection={vi.fn()}
      onRequestMappingConfirm={vi.fn()}
      onSaveMapping={vi.fn(async () => undefined)}
      postsMappingStepIndex={0}
      savingPostsMapping={false}
      savedMappingError={null}
      selectedDetectedMapping={createDefaultContentMappingConfig().entities.posts}
      settingsAvailableSupabaseBuckets={[]}
      settingsSavedFilesStorage={null}
      settingsSavedMappingConfig={null}
      settingsSavedMediaStorage={null}
      settingsSavedPostsEntity={null}
      {...overrides}
    />,
  );

describe("posts mapping manual fallback", () => {
  it("does not show a stop button while auto-detection is still running", () => {
    renderWorkspace({
      loadingMappingDetection: true,
      mappingDetectionError: null,
      mappingDetectionMode: "auto",
    });

    expect(
      screen.queryByRole("button", { name: "Stop auto-detect and choose a table manually" }),
    ).not.toBeInTheDocument();
  });

  it("uses the existing table select without showing text-entry fallback controls", () => {
    renderWorkspace();

    expect(screen.getByRole("combobox", { name: "Table" })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("public.posts")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Detect fields for this table" }),
    ).not.toBeInTheDocument();
  });

  it("starts field detection when the user selects a table from the existing picker", () => {
    const onRequestManualMappingDetection = vi.fn();
    const onManualMappingTableRefChange = vi.fn();

    renderWorkspace({
      manualMappingTableRef: "",
      onManualMappingTableRefChange,
      onRequestManualMappingDetection,
    });

    fireEvent.change(screen.getByRole("combobox", { name: "Table" }), {
      target: {
        value: "public.posts",
      },
    });

    expect(onManualMappingTableRefChange).toHaveBeenCalledWith("public.posts");
    expect(onRequestManualMappingDetection).toHaveBeenCalledWith("public.posts");
  });

  it("caps large manual table catalogs and filters them by search", () => {
    const mappingTableCatalog = Array.from({ length: 150 }, (_, index) =>
      createCatalogEntry(`content_table_${index.toString().padStart(3, "0")}`),
    );

    renderWorkspace({
      manualMappingTableRef: "",
      mappingTableCatalog,
    });

    expect(screen.getAllByRole("option")).toHaveLength(101);
    expect(screen.getByText("Showing 100 of 150 tables. Search to narrow the list.")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search tables"), {
      target: {
        value: "149",
      },
    });

    expect(screen.getByRole("option", { name: "public.content_table_149" })).toBeInTheDocument();
    expect(screen.queryByText("Showing 100 of 150 tables. Search to narrow the list.")).not.toBeInTheDocument();
  });

  it("offers an explicit refresh for the manual table catalog", () => {
    const onRefreshMappingTableCatalog = vi.fn();

    renderWorkspace({
      onRefreshMappingTableCatalog,
    });

    screen.getByRole("button", { name: "Refresh table list" }).click();

    expect(onRefreshMappingTableCatalog).toHaveBeenCalledTimes(1);
  });
});
