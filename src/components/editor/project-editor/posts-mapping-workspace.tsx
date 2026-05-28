"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  getPostsMappingSaveMessages,
  type PostsMappingSaveMessage,
} from "@/components/editor/project-editor/posts-mapping-save-messages";
import {
  getSuggestedPostsMappingStorageBucket,
  ProjectEditorPostsMappingCustomFieldsStep,
  ProjectEditorPostsMappingMediaStorageStep,
  ProjectEditorPostsMappingWizard,
} from "@/components/editor/project-editor/posts-mapping-wizard";
import {
  ProjectEditorPostsMappingCoreFieldsStep,
  ProjectEditorPostsMappingSeoStep,
  ProjectEditorPostsMappingStatusStep,
  ProjectEditorPostsMappingTimestampsStep,
} from "@/components/editor/project-editor/posts-mapping-step-content";
import { ProjectEditorPostsMappingRow } from "@/components/editor/project-editor/posts-mapping-controls";
import {
  getProjectEditorPostsMappingFieldHelperText,
  ProjectEditorPostsMappingContentFieldExtraContent,
  ProjectEditorPostsMappingFieldExtraContent,
  ProjectEditorPostsMappingRelationRow,
} from "@/components/editor/project-editor/posts-mapping-ui";
import { createProjectEditorPostsMappingDraftController } from "@/components/editor/project-editor/posts-mapping-draft-controller";
import {
  buildProjectEditorMissingOptionLabel,
  buildProjectEditorSpecialSelectOptions,
  createProjectEditorPostsMappingConfigBuilder,
} from "@/components/editor/project-editor/posts-mapping-config";
import { createProjectEditorPostsMappingSupport } from "@/components/editor/project-editor/posts-mapping-support";
import {
  getPostsMappingStepsForCollection,
  POSTS_MAPPING_NONE_VALUE,
} from "@/components/editor/project-editor/constants";
import type {
  CollectionLabel,
  MappingDetectionPayload,
  MappingTableCatalogEntry,
  PostsMappingBooleanStatusMode,
  PostsMappingCustomField,
  PostsMappingDraftState,
  PostsMappingFieldOptionKey,
  PostsMediaStorageDraft,
  ProjectEditorStorageBucketOption,
} from "@/components/editor/project-editor/types";
import {
  createDefaultContentMappingConfig,
  getContentMappingDuplicateColumnIssues,
  type ContentEntityMapping,
  type ContentMappingConfig,
  type ContentProjectMapping,
} from "@/lib/content-runtime/mapping";
import { isContentCustomFieldBinaryOrExoticDataType } from "@/lib/content-runtime/custom-field-support";
import {
  buildContentMappedPostIndexRecommendations,
  type ContentMappedPostIndexRecommendation,
} from "@/lib/content-runtime/adapter/index-recommendations";

import { Button } from "@/components/ui/button";

const createRecommendationsMapping = (
  mappingConfig: ContentMappingConfig,
): ContentProjectMapping => ({
  bindingId: "draft",
  bindingMode: "mapped_content",
  bindingStatus: "ready",
  mappingConfig,
  revisionId: "draft",
  revisionVersion: 0,
});

function ProjectEditorPostsPerformanceRecommendations({
  recommendations,
}: {
  recommendations: ContentMappedPostIndexRecommendation[];
}) {
  if (!recommendations.length) {
    return null;
  }

  const sql = recommendations.map((recommendation) => recommendation.sql).join("\n\n");
  const copySql = async () => {
    if (!navigator.clipboard) {
      toast.error("Copy is not available in this browser.");
      return;
    }

    await navigator.clipboard.writeText(sql);
    toast.success("Index SQL copied.");
  };

  return (
    <details className="rounded-lg border border-border bg-secondary/40 p-4">
      <summary className="cursor-pointer text-sm font-medium text-foreground">
        Performance recommendations
      </summary>
      <div className="mt-4 space-y-4">
        <p className="text-xs leading-6 text-muted-foreground">
          These optional indexes help large post tables stay fast. Review them with your database owner before running.
        </p>
        <div className="max-h-56 space-y-3 overflow-auto rounded-md border border-border bg-background p-3">
          {recommendations.map((recommendation) => (
            <div key={recommendation.id} className="space-y-1 border-b border-border pb-3 last:border-0 last:pb-0">
              <p className="text-xs font-medium text-foreground">{recommendation.title}</p>
              <p className="text-xs leading-5 text-muted-foreground">{recommendation.reason}</p>
              <pre className="overflow-x-auto rounded bg-secondary px-3 py-2 text-[11px] leading-5 text-foreground">
                {recommendation.sql}
              </pre>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={copySql}>
          Copy SQL
        </Button>
      </div>
    </details>
  );
}

type ProjectEditorPostsMappingWorkspaceProps = {
  currentProjectName: string;
  loadingMappingDetection: boolean;
  loadingMappingTableCatalog: boolean;
  loadingSavedMapping: boolean;
  manualMappingTableRef: string;
  mappingDetection: MappingDetectionPayload | null;
  mappingDetectionError: string | null;
  mappingDetectionMode: "auto" | "manual";
  mappingEntryCollection: CollectionLabel;
  mappingSelectedTableRef: string | null;
  mappingTableCatalog: MappingTableCatalogEntry[];
  mappingTableCatalogError: string | null;
  onManualMappingTableRefChange: (value: string) => void;
  onPostsMappingStepIndexChange: (updater: number | ((currentStep: number) => number)) => void;
  onRegisterFinishHandler: (handler: (() => Promise<void>) | null) => void;
  onRequestManualMappingDetection: (tableRef: string) => void;
  onRequestMappingConfirm: () => void;
  onRefreshMappingTableCatalog?: () => void;
  onSaveMapping: (input: {
    mappingConfig: ContentMappingConfig;
  }) => Promise<void>;
  postsMappingStepIndex: number;
  savingPostsMapping: boolean;
  savedMappingError: string | null;
  selectedDetectedMapping: ContentEntityMapping;
  settingsAvailableSupabaseBuckets: ProjectEditorStorageBucketOption[];
  settingsSavedFilesStorage: PostsMediaStorageDraft | null;
  settingsSavedMappingConfig: ContentMappingConfig | null;
  settingsSavedMediaStorage: PostsMediaStorageDraft | null;
  settingsSavedPostsEntity: ContentEntityMapping | null;
};

export function ProjectEditorPostsMappingWorkspace({
  currentProjectName,
  loadingMappingDetection,
  loadingMappingTableCatalog,
  loadingSavedMapping,
  manualMappingTableRef,
  mappingDetection,
  mappingDetectionError,
  mappingDetectionMode,
  mappingEntryCollection,
  mappingSelectedTableRef,
  mappingTableCatalog,
  mappingTableCatalogError,
  onManualMappingTableRefChange,
  onPostsMappingStepIndexChange,
  onRegisterFinishHandler,
  onRequestManualMappingDetection,
  onRequestMappingConfirm,
  onRefreshMappingTableCatalog = () => {},
  onSaveMapping,
  postsMappingStepIndex,
  savingPostsMapping,
  savedMappingError,
  selectedDetectedMapping,
  settingsAvailableSupabaseBuckets,
  settingsSavedFilesStorage,
  settingsSavedMappingConfig,
  settingsSavedMediaStorage,
  settingsSavedPostsEntity,
}: ProjectEditorPostsMappingWorkspaceProps) {
  const defaultMappingConfig = useMemo(() => createDefaultContentMappingConfig(), []);
  const detectedPostsEntity = useMemo(
    () => mappingDetection?.suggestedMappingConfig.entities.posts ?? selectedDetectedMapping,
    [mappingDetection, selectedDetectedMapping],
  );
  const seededPostsEntity = useMemo(() => {
    if (!settingsSavedPostsEntity) {
      return detectedPostsEntity;
    }

    const mergedPostsEntity = JSON.parse(
      JSON.stringify(settingsSavedPostsEntity),
    ) as ContentEntityMapping;

    for (const relationKey of ["authors", "categories", "tags"] as const) {
      const savedRelation = mergedPostsEntity.relations[relationKey];
      const detectedRelation = detectedPostsEntity.relations[relationKey];
      const hasSavedRelation =
        savedRelation?.status === "mapped" && savedRelation.strategy !== "none";
      const hasDetectedRelation =
        detectedRelation?.status === "mapped" && detectedRelation.strategy !== "none";

      if (!hasSavedRelation && hasDetectedRelation) {
        mergedPostsEntity.relations[relationKey] = JSON.parse(
          JSON.stringify(detectedRelation),
        );
      }
    }

    return mergedPostsEntity;
  }, [detectedPostsEntity, settingsSavedPostsEntity]);
  const activeMappingSteps = useMemo(
    () => getPostsMappingStepsForCollection(mappingEntryCollection),
    [mappingEntryCollection],
  );
  const [postsMappingDraft, setPostsMappingDraft] = useState<PostsMappingDraftState | null>(null);
  const [postsMappingSaveMessages, setPostsMappingSaveMessages] = useState<PostsMappingSaveMessage[] | null>(
    null,
  );
  const [manualMappingTableSearch, setManualMappingTableSearch] = useState("");
  const {
    applyRelationFieldMapDefaults,
    classifyPostsStatusValues,
    createEmptyPostsFieldOptionDraft,
    createPostsMappingDraftFromDetectedMapping,
    createPostsMappingDraftFromTable,
    detectContentKindForColumn,
    findJoinTableBetween,
    getBooleanStatusValueLists,
    getColumnForeignKey,
    getColumnSelectValue,
    getCustomFieldsForTable,
    getJoinRelationSelectionDefaults,
    getLikelyTargetColumn,
    getNormalizedSampleValues,
    getPrimarySelectedColumn,
    getRelationDraftKeyForEntity,
    getRelationFieldConfig,
    getRelatedColumnsDraft,
    getStoredTableRef,
    getTableByRef,
    getTableColumn,
    getTableRef,
    getTopEntityTableRef,
    isBooleanLikeColumn,
    isLikelyIdentifierArrayColumn,
    parsePostsMappingValues,
    relationEntityByKey,
  } = useMemo(() => createProjectEditorPostsMappingSupport(mappingDetection), [mappingDetection]);

  const applySuggestedStorageBuckets = useCallback(
    (draft: PostsMappingDraftState): PostsMappingDraftState => {
      const suggestedMediaBucket =
        settingsSavedMediaStorage?.bucketName?.trim() ||
        getSuggestedPostsMappingStorageBucket({
          availableSupabaseBuckets: settingsAvailableSupabaseBuckets,
          kind: "media",
        });
      const suggestedFilesBucket =
        settingsSavedFilesStorage?.bucketName?.trim() ||
        getSuggestedPostsMappingStorageBucket({
          availableSupabaseBuckets: settingsAvailableSupabaseBuckets,
          kind: "files",
        });

      return {
        ...draft,
        filesStorage:
          draft.filesStorage.provider === "none" && !draft.filesStorage.bucketName.trim() && suggestedFilesBucket
            ? {
                ...draft.filesStorage,
                bucketName: suggestedFilesBucket,
                provider: "supabase_bucket",
              }
            : draft.filesStorage,
        mediaStorage:
          draft.mediaStorage.provider === "none" && !draft.mediaStorage.bucketName.trim() && suggestedMediaBucket
            ? {
                ...draft.mediaStorage,
                bucketName: suggestedMediaBucket,
                provider: "supabase_bucket",
              }
            : draft.mediaStorage,
      };
    },
    [
      settingsAvailableSupabaseBuckets,
      settingsSavedFilesStorage?.bucketName,
      settingsSavedMediaStorage?.bucketName,
    ],
  );

  useEffect(() => {
    if (!mappingDetection) {
      setPostsMappingDraft(null);
      return;
    }

    const seededDraft =
      mappingSelectedTableRef?.trim()
        ? (createPostsMappingDraftFromTable(mappingSelectedTableRef) ??
          createPostsMappingDraftFromDetectedMapping(
            seededPostsEntity,
            settingsSavedFilesStorage,
            settingsSavedMediaStorage,
          ))
        : createPostsMappingDraftFromDetectedMapping(
            seededPostsEntity,
            settingsSavedFilesStorage,
            settingsSavedMediaStorage,
          );

    setPostsMappingDraft((currentDraft) =>
      applySuggestedStorageBuckets(
        currentDraft ?? seededDraft,
      ),
    );
  }, [
    applySuggestedStorageBuckets,
    createPostsMappingDraftFromDetectedMapping,
    createPostsMappingDraftFromTable,
    mappingDetection,
    mappingSelectedTableRef,
    seededPostsEntity,
    settingsSavedFilesStorage,
    settingsSavedMediaStorage,
  ]);

  const postsTable = postsMappingDraft ? getTableByRef(postsMappingDraft.tableRef) : null;
  const tableOptions = (mappingDetection?.tables ?? []).map((table) => ({
    label: `${table.schema}.${table.name}`,
    value: getTableRef(table),
  }));
  const columnOptions =
    postsTable?.columns.map((column) => ({
      label: column.name,
      value: column.name,
    })) ?? [];
  const joinTableOptions = (mappingDetection?.tables ?? [])
    .filter((table) => table.foreignKeys.length >= 2)
    .map((table) => ({
      label: `${table.schema}.${table.name}`,
      value: getTableRef(table),
    }));
  const buildMissingOptionLabel = buildProjectEditorMissingOptionLabel;
  const buildSpecialSelectOptions = buildProjectEditorSpecialSelectOptions;
  const currentPostsMappingStep =
    activeMappingSteps[postsMappingStepIndex] ?? activeMappingSteps[0];

  const {
    addPostsContentColumn,
    addPostsFieldRelatedColumn,
    addPostsRelationDisplayColumn,
    getRelationTargetTableRef,
    handleContentColumnChange,
    handleContentColumnKindChange,
    handleFieldColumnChange,
    handlePostsTableChange,
    handleRelationColumnChange,
    handleStatusBooleanModeChange,
    handleStatusColumnChange,
    movePostsContentColumn,
    removePostsContentColumn,
    removePostsFieldRelatedColumn,
    removePostsRelationDisplayColumn,
    togglePostsCustomField,
    updatePostsCustomField,
    updatePostsContentFieldOptions,
    updatePostsDraftField,
    updatePostsFieldOptions,
    updatePostsFieldRelatedColumns,
    updatePostsFilesStorageDraft,
    updatePostsMediaStorageDraft,
    updatePostsRelationDisplayColumns,
    updatePostsRelationDraft,
    updatePostsRelationFieldMap,
    updatePostsValueList,
  } = createProjectEditorPostsMappingDraftController({
    applyRelationFieldMapDefaults,
    classifyPostsStatusValues,
    createEmptyPostsFieldOptionDraft,
    createPostsMappingDraftFromTable,
    detectContentKindForColumn,
    findJoinTableBetween,
    getBooleanStatusValueLists,
    getColumnForeignKey,
    getColumnSelectValue,
    getCustomFieldsForTable,
    getJoinRelationSelectionDefaults,
    getLikelyTargetColumn,
    getPrimarySelectedColumn,
    getRelatedColumnsDraft,
    getStoredTableRef,
    getTableByRef,
    getTableColumn,
    getTopEntityTableRef,
    isBooleanLikeColumn,
    isLikelyIdentifierArrayColumn,
    parsePostsMappingValues,
    postsMappingDraft,
    postsTable,
    relationEntityByKey,
    setPostsMappingDraft,
  });

  const { buildPostsMappingConfig } = createProjectEditorPostsMappingConfigBuilder({
    baseMappingConfig: settingsSavedMappingConfig ?? defaultMappingConfig,
    defaultMappingConfig,
    detectContentKindForColumn,
    getBooleanStatusValueLists,
    getCustomFieldsForTable,
    getRelationDraftKeyForEntity,
    getRelationTargetTableRef,
    getTableByRef,
    getTableColumn,
    isBooleanLikeColumn,
    mappingEntryCollection,
    postsMappingDraft,
    postsTable,
    relationEntityByKey,
  });
  const postgresIndexRecommendations = useMemo(() => {
    const mappingConfig = buildPostsMappingConfig();

    return mappingConfig
      ? buildContentMappedPostIndexRecommendations(createRecommendationsMapping(mappingConfig))
      : [];
  }, [buildPostsMappingConfig]);

  const handlePostsMappingPrevious = () => {
    onPostsMappingStepIndexChange((currentStep) => Math.max(currentStep - 1, 0));
  };

  const handlePostsMappingNext = () => {
    onPostsMappingStepIndexChange((currentStep) =>
      Math.min(currentStep + 1, activeMappingSteps.length - 1),
    );
  };

  const handlePostsMappingFinish = useCallback(async () => {
    const nextMappingConfig = buildPostsMappingConfig();

    if (!nextMappingConfig) {
      toast.error("Could not prepare the mapping to save.");
      return;
    }

    const duplicateColumnIssues = getContentMappingDuplicateColumnIssues(nextMappingConfig);

    if (duplicateColumnIssues.length > 0) {
      toast.error(duplicateColumnIssues[0]!.message);
      return;
    }

    const isFilesStorageScope = mappingEntryCollection === "Files";
    const isMediaStorageScope = mappingEntryCollection === "Media";
    const isS3CompatibleFilesStorage =
      isFilesStorageScope && nextMappingConfig.filesStorage?.provider === "s3_compatible";
    const isS3CompatibleMediaStorage =
      isMediaStorageScope && nextMappingConfig.mediaStorage?.provider === "s3_compatible";

    if (isS3CompatibleFilesStorage) {
      if (!nextMappingConfig.filesStorage?.bucketName) {
        toast.error("Bucket name is required for files storage.");
        return;
      }

      if (!nextMappingConfig.filesStorage.endpoint && !nextMappingConfig.filesStorage.region) {
        toast.error("Enter either an endpoint URL or a region for files storage.");
        return;
      }

    }

    if (isS3CompatibleMediaStorage) {
      if (!nextMappingConfig.mediaStorage?.bucketName) {
        toast.error("Bucket name is required for media storage.");
        return;
      }

      if (!nextMappingConfig.mediaStorage.endpoint && !nextMappingConfig.mediaStorage.region) {
        toast.error("Enter either an endpoint URL or a region for media storage.");
        return;
      }

    }

    setPostsMappingSaveMessages(
      getPostsMappingSaveMessages({
        collection: mappingEntryCollection,
        mappingConfig: nextMappingConfig,
        mode:
          mappingEntryCollection === "Posts"
            ? settingsSavedPostsEntity
              ? "update"
              : "initial"
            : "update",
        projectName: currentProjectName,
      }),
    );

    await onSaveMapping({
      mappingConfig: nextMappingConfig,
    });
  }, [
    buildPostsMappingConfig,
    currentProjectName,
    mappingEntryCollection,
    onSaveMapping,
    settingsSavedPostsEntity,
  ]);

  useEffect(() => {
    if (!savingPostsMapping) {
      setPostsMappingSaveMessages(null);
    }
  }, [savingPostsMapping]);

  useEffect(() => {
    onRegisterFinishHandler(handlePostsMappingFinish);
    return () => {
      onRegisterFinishHandler(null);
    };
  }, [handlePostsMappingFinish, onRegisterFinishHandler]);

  const isRelationFlow =
    mappingEntryCollection === "Authors" ||
    mappingEntryCollection === "Categories" ||
    mappingEntryCollection === "Tags";

  const mappingWizardStatusMessage = loadingSavedMapping
    ? "Loading saved mapping data."
    : savedMappingError
      ? savedMappingError
      : loadingMappingDetection
        ? mappingDetectionMode === "manual"
          ? "Detecting fields for the selected table."
          : "Loading detected mapping data."
        : mappingDetectionError
      ? mappingDetectionError
      : mappingTableCatalogError
        ? mappingTableCatalogError
      : isRelationFlow && !settingsSavedPostsEntity
        ? `Map posts first before updating the ${mappingEntryCollection.toLowerCase()} mapping.`
        : mappingDetectionMode === "manual" && !mappingDetection
          ? "Choose a table to continue mapping."
        : !postsMappingDraft || !postsTable
          ? "Preparing the mapping form."
          : null;
  const manualMappingTableSearchValue = manualMappingTableSearch.trim().toLowerCase();
  const filteredManualMappingTableCatalog = manualMappingTableSearchValue
    ? mappingTableCatalog.filter((table) => table.tableRef.toLowerCase().includes(manualMappingTableSearchValue))
    : mappingTableCatalog;
  const visibleManualMappingTableCatalog = filteredManualMappingTableCatalog.slice(0, 100);
  const selectedManualMappingTable =
    manualMappingTableRef.trim() &&
    !visibleManualMappingTableCatalog.some((table) => table.tableRef === manualMappingTableRef)
      ? mappingTableCatalog.find((table) => table.tableRef === manualMappingTableRef)
      : null;
  const renderedManualMappingTableCatalog = selectedManualMappingTable
    ? [selectedManualMappingTable, ...visibleManualMappingTableCatalog]
    : visibleManualMappingTableCatalog;
  const hiddenManualMappingTableCount =
    filteredManualMappingTableCatalog.length - visibleManualMappingTableCatalog.length;
  const mappingWizardStatusChildren =
    loadingSavedMapping || savedMappingError || (isRelationFlow && !settingsSavedPostsEntity)
      ? null
      : mappingDetectionMode === "manual" || Boolean(mappingDetectionError) || Boolean(mappingTableCatalogError)
          ? (
              <div className="mx-auto max-w-md space-y-4">
                <div className="space-y-2 text-left">
                  <label
                    htmlFor="manual-mapping-table-search"
                    className="block text-sm font-medium text-foreground"
                  >
                    Search tables
                  </label>
                  <input
                    id="manual-mapping-table-search"
                    aria-label="Search tables"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={manualMappingTableSearch}
                    disabled={loadingMappingTableCatalog || loadingMappingDetection}
                    onChange={(event) => setManualMappingTableSearch(event.target.value)}
                    placeholder="Search tables"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <label
                      htmlFor="manual-mapping-table-select"
                      className="block text-sm font-medium text-foreground"
                    >
                      Table
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-2 text-xs"
                      disabled={loadingMappingTableCatalog || loadingMappingDetection}
                      onClick={onRefreshMappingTableCatalog}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Refresh table list
                    </Button>
                  </div>
                  <select
                    id="manual-mapping-table-select"
                    aria-label="Table"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={manualMappingTableRef}
                    disabled={loadingMappingTableCatalog || loadingMappingDetection}
                    onChange={(event) => {
                      const nextTableRef = event.target.value;

                      onManualMappingTableRefChange(nextTableRef);

                      if (nextTableRef.trim()) {
                        onRequestManualMappingDetection(nextTableRef);
                      }
                    }}
                  >
                    <option value="">
                      {loadingMappingTableCatalog
                        ? "Loading available tables..."
                        : mappingTableCatalog.length > 0
                          ? "Select a table"
                          : "No tables found"}
                    </option>
                    {renderedManualMappingTableCatalog.map((table) => (
                      <option key={table.tableRef} value={table.tableRef}>
                        {table.tableRef}
                      </option>
                    ))}
                  </select>
                  {hiddenManualMappingTableCount > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Showing {visibleManualMappingTableCatalog.length} of{" "}
                      {filteredManualMappingTableCatalog.length} tables. Search to narrow the list.
                    </p>
                  ) : null}
                </div>
                {loadingMappingTableCatalog ? (
                  <p className="text-center text-sm text-muted-foreground">Loading available tables.</p>
                ) : null}
                {mappingTableCatalogError ? (
                  <p className="text-center text-sm text-muted-foreground">{mappingTableCatalogError}</p>
                ) : null}
                {!loadingMappingTableCatalog && !mappingTableCatalogError && mappingTableCatalog.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">
                    No tables were found for mapping.
                  </p>
                ) : null}
              </div>
          )
        : null;

  if (mappingWizardStatusMessage) {
    return (
      <ProjectEditorPostsMappingWizard
        currentProjectName={currentProjectName}
        currentStepDescription={currentPostsMappingStep.description}
        currentStepTitle={currentPostsMappingStep.title}
        onFinish={onRequestMappingConfirm}
        onNext={handlePostsMappingNext}
        onPrevious={handlePostsMappingPrevious}
        postsMappingStepIndex={postsMappingStepIndex}
        savingMessages={postsMappingSaveMessages}
        savingPostsMapping={savingPostsMapping}
        statusChildren={mappingWizardStatusChildren}
        statusMessage={mappingWizardStatusMessage}
        steps={activeMappingSteps}
      />
    );
  }

  if (!postsMappingDraft || !postsTable) {
    return null;
  }

  const joinTableSelectOptions = [
    { label: "Select join table", value: POSTS_MAPPING_NONE_VALUE },
    ...joinTableOptions,
  ];
  const contentKindOptions = [
    { label: "HTML", value: "html" },
    { label: "Markdown", value: "markdown" },
    { label: "Plain Text", value: "plain_text" },
    { label: "Legacy JSON", value: "json" },
  ] satisfies Array<{ label: string; value: PostsMappingDraftState["contentKind"] }>;
  const booleanStatusOptions = [
    { label: "True = Published, False = Draft", value: "true_is_published" },
    { label: "False = Published, True = Draft", value: "false_is_published" },
  ] satisfies Array<{ label: string; value: PostsMappingBooleanStatusMode }>;

  const getFieldHelperText = (
    label: string,
    key: PostsMappingFieldOptionKey,
    value: string,
  ) =>
    getProjectEditorPostsMappingFieldHelperText({
      buildMissingOptionLabel,
      getColumnForeignKey,
      getTableColumn,
      isBooleanLikeColumn,
      key,
      label,
      postsMappingDraft,
      postsTable,
      value,
    });

  const renderFieldExtraContent = (
    key: PostsMappingFieldOptionKey,
    value: string,
    options?: { includeContentKind?: boolean; includeStatusControls?: boolean },
  ) => (
    <ProjectEditorPostsMappingFieldExtraContent
      addPostsFieldRelatedColumn={addPostsFieldRelatedColumn}
      booleanStatusOptions={booleanStatusOptions}
      contentKindOptions={contentKindOptions}
      fieldKey={key}
      getColumnForeignKey={getColumnForeignKey}
      getNormalizedSampleValues={getNormalizedSampleValues}
      getTableByRef={getTableByRef}
      getTableColumn={getTableColumn}
      handleStatusBooleanModeChange={handleStatusBooleanModeChange}
      isBooleanLikeColumn={isBooleanLikeColumn}
      options={options}
      postsMappingDraft={postsMappingDraft}
      postsTable={postsTable}
      removePostsFieldRelatedColumn={removePostsFieldRelatedColumn}
      updatePostsDraftField={updatePostsDraftField}
      updatePostsFieldOptions={updatePostsFieldOptions}
      updatePostsFieldRelatedColumns={updatePostsFieldRelatedColumns}
      updatePostsValueList={updatePostsValueList}
      value={value}
    />
  );

  const renderContentFieldExtraContent = (index: number, value: string) => (
    <ProjectEditorPostsMappingContentFieldExtraContent
      getTableColumn={getTableColumn}
      index={index}
      postsMappingDraft={postsMappingDraft}
      postsTable={postsTable}
      updatePostsContentFieldOptions={updatePostsContentFieldOptions}
      value={value}
    />
  );

  const renderRelationRow = (
    label: string,
    key: "author" | "categories" | "tags",
  ) => (
    <ProjectEditorPostsMappingRelationRow
      addPostsRelationDisplayColumn={addPostsRelationDisplayColumn}
      applyRelationFieldMapDefaults={applyRelationFieldMapDefaults}
      columnOptions={columnOptions}
      getColumnForeignKey={getColumnForeignKey}
      getColumnSelectValue={getColumnSelectValue}
      getJoinRelationSelectionDefaults={getJoinRelationSelectionDefaults}
      getLikelyTargetColumn={getLikelyTargetColumn}
      getRelationFieldConfig={getRelationFieldConfig}
      getRelationTargetTableRef={getRelationTargetTableRef}
      getRelatedColumnsDraft={getRelatedColumnsDraft}
      getTableByRef={getTableByRef}
      getTableColumn={getTableColumn}
      getTopEntityTableRef={getTopEntityTableRef}
      handleRelationColumnChange={handleRelationColumnChange}
      isLikelyIdentifierArrayColumn={isLikelyIdentifierArrayColumn}
      joinTableSelectOptions={joinTableSelectOptions}
      label={label}
      postsTable={postsTable}
      relation={postsMappingDraft[key]}
      relationEntityByKey={relationEntityByKey}
      relationKey={key}
      relationSpecialOptions={buildSpecialSelectOptions(label)}
      removePostsRelationDisplayColumn={removePostsRelationDisplayColumn}
      updatePostsRelationDisplayColumns={updatePostsRelationDisplayColumns}
      updatePostsRelationDraft={updatePostsRelationDraft}
      updatePostsRelationFieldMap={updatePostsRelationFieldMap}
    />
  );

  const renderedStepContent =
    currentPostsMappingStep.id === "posts_table"
      ? ProjectEditorPostsMappingRow({
          helperText: "Changing the posts table re-detects the remaining fields.",
          label: "Posts",
          onChange: handlePostsTableChange,
          options: tableOptions,
          selectClassName: "sm:w-[360px]",
          value: postsMappingDraft.tableRef,
        })
      : currentPostsMappingStep.id === "core_fields"
        ? (
            <ProjectEditorPostsMappingCoreFieldsStep
              buildSpecialSelectOptions={buildSpecialSelectOptions}
              columnOptions={columnOptions}
              contentKindOptions={contentKindOptions}
              getFieldHelperText={getFieldHelperText}
              handleContentFieldAdd={addPostsContentColumn}
              handleContentFieldChange={handleContentColumnChange}
              handleContentFieldKindChange={handleContentColumnKindChange}
              handleContentFieldMove={movePostsContentColumn}
              handleContentFieldRemove={removePostsContentColumn}
              handleFieldColumnChange={handleFieldColumnChange}
              postsMappingDraft={postsMappingDraft}
              renderContentFieldExtraContent={renderContentFieldExtraContent}
              renderFieldExtraContent={renderFieldExtraContent}
              renderPostsMappingRow={ProjectEditorPostsMappingRow}
            />
          )
        : currentPostsMappingStep.id === "authors"
          ? renderRelationRow("Author", "author")
          : currentPostsMappingStep.id === "categories"
            ? renderRelationRow("Categories", "categories")
            : currentPostsMappingStep.id === "tags"
              ? renderRelationRow("Tags", "tags")
              : currentPostsMappingStep.id === "status"
                ? (
                    <ProjectEditorPostsMappingStatusStep
                      buildSpecialSelectOptions={buildSpecialSelectOptions}
                      columnOptions={columnOptions}
                      getFieldHelperText={getFieldHelperText}
                      handleStatusColumnChange={handleStatusColumnChange}
                      postsMappingDraft={postsMappingDraft}
                      renderFieldExtraContent={renderFieldExtraContent}
                      renderPostsMappingRow={ProjectEditorPostsMappingRow}
                    />
                  )
                : currentPostsMappingStep.id === "timestamps"
                  ? (
                      <ProjectEditorPostsMappingTimestampsStep
                        buildSpecialSelectOptions={buildSpecialSelectOptions}
                        columnOptions={columnOptions}
                        getFieldHelperText={getFieldHelperText}
                        handleFieldColumnChange={handleFieldColumnChange}
                        postsMappingDraft={postsMappingDraft}
                        renderFieldExtraContent={renderFieldExtraContent}
                        renderPostsMappingRow={ProjectEditorPostsMappingRow}
                      />
                    )
                  : currentPostsMappingStep.id === "seo"
                    ? (
                        <ProjectEditorPostsMappingSeoStep
                          buildSpecialSelectOptions={buildSpecialSelectOptions}
                          columnOptions={columnOptions}
                          getFieldHelperText={getFieldHelperText}
                          handleFieldColumnChange={handleFieldColumnChange}
                          postsMappingDraft={postsMappingDraft}
                          renderFieldExtraContent={renderFieldExtraContent}
                          renderPostsMappingRow={ProjectEditorPostsMappingRow}
                        />
                      )
                    : currentPostsMappingStep.id === "media_storage" || currentPostsMappingStep.id === "files_storage"
                      ? (
                          <ProjectEditorPostsMappingMediaStorageStep
                            availableSupabaseBuckets={settingsAvailableSupabaseBuckets}
                            filesStorage={postsMappingDraft.filesStorage}
                            mediaStorage={postsMappingDraft.mediaStorage}
                            onBucketNameChange={(value) =>
                              updatePostsMediaStorageDraft({ bucketName: value })
                            }
                            onEndpointChange={(value) =>
                              updatePostsMediaStorageDraft({ endpoint: value })
                            }
                            onFilesBucketNameChange={(value) =>
                              updatePostsFilesStorageDraft({ bucketName: value })
                            }
                            onFilesEndpointChange={(value) =>
                              updatePostsFilesStorageDraft({ endpoint: value })
                            }
                            onFilesProviderChange={(provider) =>
                              updatePostsFilesStorageDraft({ provider })
                            }
                            onFilesPublicUrlBaseChange={(value) =>
                              updatePostsFilesStorageDraft({ publicUrlBase: value })
                            }
                            onFilesRegionChange={(value) =>
                              updatePostsFilesStorageDraft({ region: value })
                            }
                            onProviderChange={(provider) =>
                              updatePostsMediaStorageDraft({ provider })
                            }
                            onPublicUrlBaseChange={(value) =>
                              updatePostsMediaStorageDraft({ publicUrlBase: value })
                            }
                            onRegionChange={(value) =>
                              updatePostsMediaStorageDraft({ region: value })
                            }
                            visibleStorage={
                              currentPostsMappingStep.id === "media_storage"
                                ? "media"
                                : currentPostsMappingStep.id === "files_storage"
                                  ? "files"
                                  : "both"
                            }
                          />
                        )
                      : (() => {
                          const customFields: PostsMappingCustomField[] = getCustomFieldsForTable(
                            postsTable,
                            postsMappingDraft,
                          ).map((field) => {
                            const sourceColumn = getTableColumn(postsTable, field.column);

                            return {
                              ...field,
                              arrayIndex: field.arrayIndex ?? null,
                              fieldKey: field.fieldKey ?? field.column,
                              path: field.path ?? null,
                              sourceIsArray: Boolean(sourceColumn?.isArray),
                              sourceIsExotic: isContentCustomFieldBinaryOrExoticDataType(field),
                              sourceIsJson: Boolean(sourceColumn?.isJson),
                            };
                          });

                          return (
                            <ProjectEditorPostsMappingCustomFieldsStep
                              customFields={customFields}
                              onToggleField={togglePostsCustomField}
                              onUpdateFieldArrayIndex={(column, value) =>
                                updatePostsCustomField(column, {
                                  arrayIndex:
                                    value === null
                                      ? null
                                      : (() => {
                                          const parsedValue = Number.parseInt(value, 10);
                                          return Number.isFinite(parsedValue) && parsedValue > 0
                                            ? parsedValue - 1
                                            : 0;
                                        })(),
                                })
                              }
                              onUpdateFieldKind={(column, value) =>
                                updatePostsCustomField(column, {
                                  kind: value,
                                })
                              }
                              onUpdateFieldPath={(column, value) =>
                                updatePostsCustomField(column, {
                                  path: value.trim() || null,
                                })
                              }
                            />
                          );
                        })();

  return (
    <ProjectEditorPostsMappingWizard
      currentProjectName={currentProjectName}
      currentStepDescription={currentPostsMappingStep.description}
      currentStepTitle={currentPostsMappingStep.title}
      onFinish={onRequestMappingConfirm}
      onNext={handlePostsMappingNext}
      onPrevious={handlePostsMappingPrevious}
      postsMappingStepIndex={postsMappingStepIndex}
      savingMessages={postsMappingSaveMessages}
      savingPostsMapping={savingPostsMapping}
      steps={activeMappingSteps}
    >
      {renderedStepContent}
      {postsMappingStepIndex >= activeMappingSteps.length - 1 ? (
        <ProjectEditorPostsPerformanceRecommendations recommendations={postgresIndexRecommendations} />
      ) : null}
    </ProjectEditorPostsMappingWizard>
  );
}
