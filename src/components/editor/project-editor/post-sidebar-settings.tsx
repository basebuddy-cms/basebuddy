"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, FolderPlus, RotateCcw, Save, Trash2 } from "lucide-react";

import {
  getProjectEditorResolvedPostSidebarNodes,
} from "@/components/editor/project-editor/post-sidebar-support";
import {
  createProjectEditorPostSidebarPage,
  getProjectEditorPostSidebarValidationError,
  moveProjectEditorPostSidebarNode,
  removeProjectEditorPostSidebarPage,
  renameProjectEditorPostSidebarPage,
  setProjectEditorPostSidebarNodeParent,
  toggleProjectEditorPostSidebarNodeVisibility,
} from "@/components/editor/project-editor/post-sidebar-settings-support";
import type {
  ContentPostSidebarConfig,
  ContentWorkspaceMeta,
} from "@/lib/content-runtime/shared";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ProjectEditorPostSidebarSettingsProps = {
  canUpdateProject: boolean;
  contentRuntime: ContentWorkspaceMeta["contentRuntime"];
  hasPostSidebarConfigChanges: boolean;
  isSavingPostSidebarConfig: boolean;
  onPostSidebarConfigChange: (config: ContentPostSidebarConfig) => void;
  onResetPostSidebarConfigToDefault: () => void;
  onRestoreSavedPostSidebarConfig: () => void;
  onSavePostSidebarConfig: () => Promise<void> | void;
  postSidebarConfig: ContentPostSidebarConfig;
  supportsPostRevisions: boolean;
};

const ROOT_LOCATION_VALUE = "__root__";

export function ProjectEditorPostSidebarSettings({
  canUpdateProject,
  contentRuntime,
  hasPostSidebarConfigChanges,
  isSavingPostSidebarConfig,
  onPostSidebarConfigChange,
  onResetPostSidebarConfigToDefault,
  onRestoreSavedPostSidebarConfig,
  onSavePostSidebarConfig,
  postSidebarConfig,
  supportsPostRevisions,
}: ProjectEditorPostSidebarSettingsProps) {
  const resolvedNodes = useMemo(
    () =>
      getProjectEditorResolvedPostSidebarNodes({
        config: postSidebarConfig,
        contentRuntime,
        supportsPostRevisions,
      }),
    [contentRuntime, postSidebarConfig, supportsPostRevisions],
  );
  const materializedConfig = useMemo(
    () => ({
      nodes: resolvedNodes.map((node) =>
        node.kind === "page"
          ? {
              id: node.id,
              kind: "page" as const,
              label: node.label,
              parentId: node.parentId,
              visible: node.visible,
            }
          : {
              id: node.id,
              kind: "field" as const,
              parentId: node.parentId,
              visible: node.visible,
            },
      ),
      version: postSidebarConfig.version,
    } satisfies ContentPostSidebarConfig),
    [postSidebarConfig.version, resolvedNodes],
  );
  const validationError = getProjectEditorPostSidebarValidationError(materializedConfig);
  const [newPageLabel, setNewPageLabel] = useState("");
  const [pageLabelDrafts, setPageLabelDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setPageLabelDrafts(
      Object.fromEntries(
        resolvedNodes
          .filter((node): node is Extract<(typeof resolvedNodes)[number], { kind: "page" }> => node.kind === "page")
          .map((page) => [page.id, page.label]),
      ),
    );
  }, [resolvedNodes]);

  const pageNodes = useMemo(
    () => resolvedNodes.filter((node): node is Extract<(typeof resolvedNodes)[number], { kind: "page" }> => node.kind === "page"),
    [resolvedNodes],
  );

  const handleConfigChange = (nextConfig: ContentPostSidebarConfig) => {
    onPostSidebarConfigChange(nextConfig);
  };

  const handleCreatePage = () => {
    if (!canUpdateProject || !newPageLabel.trim()) {
      return;
    }

    handleConfigChange(
      createProjectEditorPostSidebarPage({
        config: materializedConfig,
        label: newPageLabel,
      }),
    );
    setNewPageLabel("");
  };

  const getPageDescendantIds = (pageId: string) => {
    const descendantIds = new Set<string>();
    let foundNextLevel = true;

    while (foundNextLevel) {
      foundNextLevel = false;

      for (const node of pageNodes) {
        if (node.parentId !== pageId && !descendantIds.has(node.parentId ?? "")) {
          continue;
        }

        if (!descendantIds.has(node.id)) {
          descendantIds.add(node.id);
          foundNextLevel = true;
        }
      }
    }

    return descendantIds;
  };

  const buildIndentedRows = (parentId: string | null, depth = 0) =>
    resolvedNodes.flatMap((node) => {
      if (node.parentId !== parentId) {
        return [];
      }

      return [
        {
          depth,
          node,
        },
        ...(node.kind === "page" ? buildIndentedRows(node.id, depth + 1) : []),
      ];
    });

  const rows = buildIndentedRows(null);

  const renderRow = ({
    depth,
    node,
  }: {
    depth: number;
    node: (typeof resolvedNodes)[number];
  }) => {
    const siblingNodes = resolvedNodes.filter((siblingNode) => siblingNode.parentId === node.parentId);
    const siblingIndex = siblingNodes.findIndex((siblingNode) => siblingNode.kind === node.kind && siblingNode.id === node.id);
    const canMoveUp = siblingIndex > 0;
    const canMoveDown = siblingIndex >= 0 && siblingIndex < siblingNodes.length - 1;
    const selectableParentPages = pageNodes.filter((pageNode) => {
      if (node.kind === "field") {
        return pageNode.id !== node.parentId;
      }

      if (pageNode.id === node.id) {
        return false;
      }

      return !getPageDescendantIds(node.id).has(pageNode.id);
    });

    return (
      <div
        key={`${node.kind}:${node.id}`}
        className={cn(
          "grid grid-cols-[minmax(0,1fr)_190px_auto] items-center gap-3 border-b border-border/60 py-3",
          !node.visible && "opacity-55",
        )}
      >
        <div className="min-w-0" style={{ paddingLeft: depth * 18 }}>
          {node.kind === "page" ? (
            <div className="flex items-center gap-3">
              {depth > 0 ? <span className="text-muted-foreground">&gt;</span> : null}
              <Input
                value={pageLabelDrafts[node.id] ?? node.label}
                onChange={(event) =>
                  setPageLabelDrafts((currentDrafts) => ({
                    ...currentDrafts,
                    [node.id]: event.target.value,
                  }))
                }
                onBlur={() => {
                  const nextLabel = (pageLabelDrafts[node.id] ?? node.label).trim().replace(/\s+/g, " ");

                  if (!nextLabel) {
                    setPageLabelDrafts((currentDrafts) => ({
                      ...currentDrafts,
                      [node.id]: node.label,
                    }));
                    return;
                  }

                  if (nextLabel === node.label) {
                    return;
                  }

                  handleConfigChange(
                    renameProjectEditorPostSidebarPage({
                      config: materializedConfig,
                      label: nextLabel,
                      pageId: node.id,
                    }),
                  );
                }}
                className="h-9 border-border bg-transparent px-0 shadow-none focus-visible:ring-0"
                disabled={!canUpdateProject || isSavingPostSidebarConfig}
              />
              <span className="shrink-0 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Page</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {depth > 0 ? <span className="text-muted-foreground">&gt;</span> : null}
              <span className="truncate text-sm text-foreground">{node.label}</span>
              <span className="shrink-0 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Field</span>
            </div>
          )}
        </div>

        <Select
          value={node.parentId ?? ROOT_LOCATION_VALUE}
          onValueChange={(value) =>
            handleConfigChange(
              setProjectEditorPostSidebarNodeParent({
                config: materializedConfig,
                nodeId: `${node.kind}:${node.id}`,
                parentId: value === ROOT_LOCATION_VALUE ? null : value,
              }),
            )
          }
          disabled={!canUpdateProject || isSavingPostSidebarConfig}
        >
          <SelectTrigger className="h-9 border-border bg-transparent text-sm shadow-none">
            <SelectValue placeholder="Choose parent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ROOT_LOCATION_VALUE}>Main sidebar</SelectItem>
            {selectableParentPages.map((pageNode) => (
              <SelectItem key={pageNode.id} value={pageNode.id}>
                {pageNode.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() =>
              handleConfigChange(
                moveProjectEditorPostSidebarNode({
                  config: materializedConfig,
                  direction: "up",
                  nodeId: `${node.kind}:${node.id}`,
                }),
              )
            }
            disabled={!canUpdateProject || isSavingPostSidebarConfig || !canMoveUp}
          >
            <ChevronUp className="h-3.5 w-3.5" />
            <span className="sr-only">Move up</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() =>
              handleConfigChange(
                moveProjectEditorPostSidebarNode({
                  config: materializedConfig,
                  direction: "down",
                  nodeId: `${node.kind}:${node.id}`,
                }),
              )
            }
            disabled={!canUpdateProject || isSavingPostSidebarConfig || !canMoveDown}
          >
            <ChevronDown className="h-3.5 w-3.5" />
            <span className="sr-only">Move down</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() =>
              handleConfigChange(
                toggleProjectEditorPostSidebarNodeVisibility({
                  config: materializedConfig,
                  nodeId: `${node.kind}:${node.id}`,
                }),
              )
            }
            disabled={!canUpdateProject || isSavingPostSidebarConfig}
          >
            {node.visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            <span className="sr-only">{node.visible ? "Hide row" : "Show row"}</span>
          </Button>
          {node.kind === "page" ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() =>
                handleConfigChange(
                  removeProjectEditorPostSidebarPage({
                    config: materializedConfig,
                    pageId: node.id,
                  }),
                )
              }
              disabled={!canUpdateProject || isSavingPostSidebarConfig}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="sr-only">Delete page</span>
            </Button>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Sidebar Fields</p>
          <p className="text-sm text-muted-foreground">
            Pages and fields are configured here as one indented tree. Fields are always real editable controls,
            and pages only group what sits under them.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={newPageLabel}
            onChange={(event) => setNewPageLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleCreatePage();
              }
            }}
            placeholder="New page"
            className="h-9 min-w-[220px] border-border"
            disabled={!canUpdateProject || isSavingPostSidebarConfig}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            onClick={handleCreatePage}
            disabled={!canUpdateProject || isSavingPostSidebarConfig || !newPageLabel.trim()}
          >
            <FolderPlus className="h-3.5 w-3.5" />
            Add page
          </Button>
        </div>
      </div>

      <div className="border-t border-border">
        {rows.map((row) => renderRow(row))}
      </div>

      {validationError ? (
        <p className="text-sm text-destructive">{validationError}</p>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          {hasPostSidebarConfigChanges ? "Unsaved sidebar changes" : "Sidebar settings saved"}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={onRestoreSavedPostSidebarConfig}
            disabled={!canUpdateProject || isSavingPostSidebarConfig || !hasPostSidebarConfigChanges}
          >
            Restore saved
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 gap-2"
            onClick={onResetPostSidebarConfigToDefault}
            disabled={!canUpdateProject || isSavingPostSidebarConfig}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Use default
          </Button>
          <Button
            type="button"
            variant="hero"
            size="sm"
            className="h-9 gap-2"
            onClick={() => void onSavePostSidebarConfig()}
            disabled={
              !canUpdateProject ||
              isSavingPostSidebarConfig ||
              !hasPostSidebarConfigChanges ||
              Boolean(validationError)
            }
          >
            <Save className="h-3.5 w-3.5" />
            {isSavingPostSidebarConfig ? "Saving..." : "Save layout"}
          </Button>
        </div>
      </div>
    </div>
  );
}
