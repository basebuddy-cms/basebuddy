"use client";

import { useCallback, useEffect, useState } from "react";

import type { ContentAutoMappingResult } from "@/lib/content-runtime/introspection";
import type {
  CollectionLabel,
  MappingTableCatalogEntry,
} from "@/components/editor/project-editor/types";

export function useProjectEditorMappingDialogState() {
  const [mappingDetection, setMappingDetection] = useState<ContentAutoMappingResult | null>(null);
  const [mappingDetectionError, setMappingDetectionError] = useState<string | null>(null);
  const [mappingDetectionMode, setMappingDetectionMode] = useState<"auto" | "manual">("auto");
  const [loadingMappingDetection, setLoadingMappingDetection] = useState(false);
  const [mappingTableCatalog, setMappingTableCatalog] = useState<MappingTableCatalogEntry[]>([]);
  const [mappingTableCatalogError, setMappingTableCatalogError] = useState<string | null>(null);
  const [loadingMappingTableCatalog, setLoadingMappingTableCatalog] = useState(false);
  const [mappingManualTableRef, setMappingManualTableRef] = useState("");
  const [mappingSelectedTableRef, setMappingSelectedTableRef] = useState<string | null>(null);
  const [postsMappingStepIndex, setPostsMappingStepIndex] = useState(0);
  const [savingPostsMapping, setSavingPostsMapping] = useState(false);
  const [showMappingConfirmDialog, setShowMappingConfirmDialog] = useState(false);
  const [showPostsMappingDialog, setShowPostsMappingDialog] = useState(false);
  const [mappingDialogEntryCollection, setMappingDialogEntryCollection] =
    useState<CollectionLabel>("Posts");
  const [hasMountedPostsMappingWorkspace, setHasMountedPostsMappingWorkspace] = useState(false);

  const resetMappingDetectionState = useCallback(() => {
    setMappingDetection(null);
    setMappingDetectionError(null);
    setMappingDetectionMode("auto");
    setLoadingMappingDetection(false);
    setMappingTableCatalog([]);
    setMappingTableCatalogError(null);
    setLoadingMappingTableCatalog(false);
    setMappingManualTableRef("");
    setMappingSelectedTableRef(null);
  }, []);

  const prepareMappingDialog = useCallback((entryCollection: CollectionLabel) => {
    setMappingDialogEntryCollection(entryCollection);
    setPostsMappingStepIndex(0);
    setShowPostsMappingDialog(true);
  }, []);

  useEffect(() => {
    if (showPostsMappingDialog) {
      setHasMountedPostsMappingWorkspace(true);
    }
  }, [showPostsMappingDialog]);

  return {
    hasMountedPostsMappingWorkspace,
    loadingMappingDetection,
    loadingMappingTableCatalog,
    mappingDetection,
    mappingDetectionError,
    mappingDetectionMode,
    mappingDialogEntryCollection,
    mappingManualTableRef,
    mappingSelectedTableRef,
    mappingTableCatalog,
    mappingTableCatalogError,
    postsMappingStepIndex,
    prepareMappingDialog,
    resetMappingDetectionState,
    savingPostsMapping,
    setHasMountedPostsMappingWorkspace,
    setLoadingMappingDetection,
    setLoadingMappingTableCatalog,
    setMappingDetection,
    setMappingDetectionError,
    setMappingDetectionMode,
    setMappingDialogEntryCollection,
    setMappingManualTableRef,
    setMappingSelectedTableRef,
    setMappingTableCatalog,
    setMappingTableCatalogError,
    setPostsMappingStepIndex,
    setSavingPostsMapping,
    setShowMappingConfirmDialog,
    setShowPostsMappingDialog,
    showMappingConfirmDialog,
    showPostsMappingDialog,
  };
}
