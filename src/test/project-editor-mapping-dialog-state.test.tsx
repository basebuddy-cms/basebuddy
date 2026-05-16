import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useProjectEditorMappingDialogState } from "@/components/editor/project-editor/use-project-editor-mapping-dialog-state";

describe("useProjectEditorMappingDialogState", () => {
  it("prepares a mapping dialog for the requested collection", () => {
    const { result } = renderHook(() => useProjectEditorMappingDialogState());

    act(() => {
      result.current.prepareMappingDialog("Media");
    });

    expect(result.current.mappingDialogEntryCollection).toBe("Media");
    expect(result.current.postsMappingStepIndex).toBe(0);
    expect(result.current.showPostsMappingDialog).toBe(true);
    expect(result.current.hasMountedPostsMappingWorkspace).toBe(true);
  });

  it("resets detection and table-picker state without closing the dialog", () => {
    const { result } = renderHook(() => useProjectEditorMappingDialogState());

    act(() => {
      result.current.setMappingDetectionError("failed");
      result.current.setMappingDetectionMode("manual");
      result.current.setLoadingMappingDetection(true);
      result.current.setMappingTableCatalog([{ columnCount: 1, kind: "table", primaryKey: "id", rowCountEstimate: 1, schema: "public", table: "posts", tableRef: "public.posts" }]);
      result.current.setMappingTableCatalogError("catalog failed");
      result.current.setLoadingMappingTableCatalog(true);
      result.current.setMappingManualTableRef("public.posts");
      result.current.setMappingSelectedTableRef("public.posts");
      result.current.setShowPostsMappingDialog(true);
    });

    act(() => {
      result.current.resetMappingDetectionState();
    });

    expect(result.current.mappingDetection).toBeNull();
    expect(result.current.mappingDetectionError).toBeNull();
    expect(result.current.mappingDetectionMode).toBe("auto");
    expect(result.current.loadingMappingDetection).toBe(false);
    expect(result.current.mappingTableCatalog).toEqual([]);
    expect(result.current.mappingTableCatalogError).toBeNull();
    expect(result.current.loadingMappingTableCatalog).toBe(false);
    expect(result.current.mappingManualTableRef).toBe("");
    expect(result.current.mappingSelectedTableRef).toBeNull();
    expect(result.current.showPostsMappingDialog).toBe(true);
  });
});
