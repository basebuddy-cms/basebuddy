"use client";

import React from "react";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Search,
} from "lucide-react";

import type {
  ContentFieldSpecSummary,
  ContentPostRelationFieldKey,
  ContentRelationOption,
} from "@/lib/content-runtime/shared";
import { relationOptionsRenderLimit } from "@/components/editor/project-editor/constants";
import { useProjectEditorRelationOptionsQuery } from "@/components/editor/project-editor/queries";
import { cn } from "@/lib/utils";

import { badgeVariants, Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ProjectEditorRelationFieldProps = {
  canEditCurrentPost: boolean;
  emptyStateMessage?: string;
  fieldKey: ContentPostRelationFieldKey | `custom_field:${string}`;
  fieldSpec: ContentFieldSpecSummary;
  helperText?: string;
  inputId: string;
  label: string;
  noneOptionLabel?: string | null;
  noResultsMessage?: string;
  onChange: (value: string | string[] | null) => void;
  onSearchChange?: (value: string) => void;
  options?: ContentRelationOption[];
  optionStyle?: "badges" | "checklist";
  projectId: string;
  searchInputId?: string;
  searchPlaceholder?: string;
  searchValue?: string;
  selectedPostId: string;
  totalOptionCount?: number;
  value: unknown;
};

const normalizeRelationIds = ({
  fieldSpec,
  value,
}: {
  fieldSpec: ContentFieldSpecSummary;
  value: unknown;
}) => {
  const rawValues = fieldSpec.multiple ? (Array.isArray(value) ? value : []) : [value];
  const seenValues = new Set<string>();
  const normalizedValues: string[] = [];

  for (const rawValue of rawValues) {
    const normalizedValue = String(rawValue ?? "").trim();

    if (!normalizedValue || seenValues.has(normalizedValue)) {
      continue;
    }

    seenValues.add(normalizedValue);
    normalizedValues.push(normalizedValue);
  }

  return normalizedValues;
};

const getRelationOptionMetadataText = ({
  key,
  option,
}: {
  key: string;
  option: ContentRelationOption;
}) => {
  const rawValue = option.metadata?.[key];
  return typeof rawValue === "string" && rawValue.trim().length > 0 ? rawValue.trim() : null;
};

const getRelationFieldEmptyStateMessage = ({
  emptyStateMessage,
}: {
  emptyStateMessage?: string;
}) => emptyStateMessage ?? "No selectable options are available for this field right now.";

export function ProjectEditorRelationField({
  canEditCurrentPost,
  emptyStateMessage,
  fieldKey,
  fieldSpec,
  helperText,
  inputId,
  label,
  noneOptionLabel = fieldSpec.required ? null : "None",
  noResultsMessage,
  onChange,
  onSearchChange,
  options,
  optionStyle = "checklist",
  projectId,
  searchInputId,
  searchPlaceholder = "Search options",
  searchValue = "",
  selectedPostId,
  totalOptionCount,
  value,
}: ProjectEditorRelationFieldProps) {
  const selectedIds = normalizeRelationIds({ fieldSpec, value });
  const relationOptionsQuery = useProjectEditorRelationOptionsQuery({
    enabled: options === undefined && fieldSpec.searchMode === "remote",
    fieldKey,
    limit: relationOptionsRenderLimit,
    projectId,
    search: "",
    selectedIds,
  });
  const baseOptions = options ?? relationOptionsQuery.data ?? [];
  const selectableOptions = baseOptions.filter(
    (option) => !(fieldSpec.relationTargetEntity === "posts" && option.id === selectedPostId),
  );
  const optionIds = new Set(selectableOptions.map((option) => option.id));
  const baseOptionIds = new Set(baseOptions.map((option) => option.id));
  const resolvedOptions = [
    ...selectableOptions,
    ...selectedIds
      .filter((selectedId) => !optionIds.has(selectedId))
      .map((selectedId) => ({ id: selectedId, label: selectedId })),
  ];
  const selectedIdSet = new Set(selectedIds);
  const renderedOptions = [
    ...resolvedOptions.filter((option) => selectedIdSet.has(option.id)),
    ...resolvedOptions.filter((option) => !selectedIdSet.has(option.id)),
  ].slice(0, relationOptionsRenderLimit);
  const hiddenOptionCount = Math.max(0, resolvedOptions.length - renderedOptions.length);
  const resolvedOptionsById = new Map(resolvedOptions.map((option) => [option.id, option] as const));
  const disabled = !canEditCurrentPost || relationOptionsQuery.isLoading;
  const assetRelationKind =
    fieldSpec.relationTargetEntity === "media"
      ? "media"
      : fieldSpec.relationTargetEntity === "files"
        ? "files"
        : null;
  const selectedAssetOptions =
    assetRelationKind === null
      ? []
      : selectedIds.map((selectedId) => {
          const resolvedOption = resolvedOptionsById.get(selectedId) ?? {
            id: selectedId,
            label: selectedId,
          };

          return {
            ...resolvedOption,
            isStale: !baseOptionIds.has(selectedId),
            objectPath: getRelationOptionMetadataText({
              key: "objectPath",
              option: resolvedOption,
            }),
            url:
              getRelationOptionMetadataText({
                key: "url",
                option: resolvedOption,
              }) ??
              getRelationOptionMetadataText({
                key: "publicUrl",
                option: resolvedOption,
              }),
          };
        });
  const showSelectionControls = fieldSpec.uiControl !== "read_only";
  const effectiveUiControl =
    fieldSpec.uiControl === "read_only"
      ? fieldSpec.multiple
        ? "multi_select"
        : "single_select"
      : fieldSpec.uiControl;
  const showSearchInput =
    Boolean(searchInputId) &&
    typeof searchValue === "string" &&
    typeof searchPlaceholder === "string" &&
    typeof onSearchChange === "function";
  const isSearching = searchValue.trim().length > 0;

  const moveSelectedAsset = ({
    fromIndex,
    toIndex,
  }: {
    fromIndex: number;
    toIndex: number;
  }) => {
    const nextIds = [...selectedIds];
    const [movedId] = nextIds.splice(fromIndex, 1);

    if (!movedId) {
      return;
    }

    nextIds.splice(toIndex, 0, movedId);
    onChange(nextIds);
  };

  const renderAssetPreview = ({
    option,
  }: {
    option: (typeof selectedAssetOptions)[number];
  }) => {
    if (assetRelationKind === "media" && option.url) {
      return (
        <div className="h-14 w-20 overflow-hidden rounded-md border border-border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={option.url}
            alt={`${option.label} preview`}
            className="h-full w-full object-cover"
          />
        </div>
      );
    }

    return (
      <div className="flex h-14 w-20 items-center justify-center rounded-md border border-dashed border-border bg-secondary text-muted-foreground">
        {assetRelationKind === "media" ? (
          <ImageIcon className="h-5 w-5" aria-hidden="true" />
        ) : (
          <FileText className="h-5 w-5" aria-hidden="true" />
        )}
      </div>
    );
  };

  const renderAssetSelectionSummary = () => {
    if (assetRelationKind === null || selectedAssetOptions.length === 0) {
      return null;
    }

    if (fieldSpec.multiple) {
      return (
        <ol aria-label={`${label} selected items`} className="space-y-2">
          {selectedAssetOptions.map((option, index) => (
            <li
              key={option.id}
              className="flex items-start gap-3 rounded-md border border-border bg-secondary/20 p-3"
            >
              {renderAssetPreview({ option })}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-xs font-medium text-foreground">{option.label}</span>
                  {option.isStale ? (
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase tracking-wide">
                      Stale selection
                    </Badge>
                  ) : null}
                </div>
                <p className="break-all text-[11px] text-muted-foreground">
                  {option.objectPath ?? option.id}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {option.url ? (
                  <a
                    href={option.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${option.label}`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
                {!disabled ? (
                  <>
                    <button
                      type="button"
                      aria-label={`Move ${option.label} earlier`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={index === 0}
                      onClick={() =>
                        moveSelectedAsset({
                          fromIndex: index,
                          toIndex: index - 1,
                        })
                      }
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${option.label} later`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={index === selectedAssetOptions.length - 1}
                      onClick={() =>
                        moveSelectedAsset({
                          fromIndex: index,
                          toIndex: index + 1,
                        })
                      }
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      );
    }

    const option = selectedAssetOptions[0]!;

    return (
      <div className="rounded-md border border-border bg-secondary/20 p-3">
        <div className="flex items-start gap-3">
          {renderAssetPreview({ option })}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-xs font-medium text-foreground">{option.label}</span>
              {option.isStale ? (
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase tracking-wide">
                  Stale selection
                </Badge>
              ) : null}
            </div>
            <p className="break-all text-[11px] text-muted-foreground">{option.objectPath ?? option.id}</p>
          </div>
          {option.url ? (
            <a
              href={option.url}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${label}`}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      </div>
    );
  };

  if (
    effectiveUiControl === "single_select" &&
    resolvedOptions.length === 0 &&
    selectedIds.length === 0
  ) {
    return (
      <div className="rounded-md border border-dashed border-border bg-secondary px-3 py-4">
        {helperText ? <p className="mb-1.5 text-xs text-muted-foreground">{helperText}</p> : null}
        <p className="text-xs text-muted-foreground">
          {getRelationFieldEmptyStateMessage({ emptyStateMessage })}
        </p>
      </div>
    );
  }

  if (effectiveUiControl === "single_select") {
    if (!showSelectionControls) {
      return (
        <div className="space-y-3">
          {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
          {renderAssetSelectionSummary()}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
        {renderAssetSelectionSummary()}
        {showSearchInput ? (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={searchInputId}
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 border-border pl-8 text-xs"
              disabled={disabled}
            />
          </div>
        ) : null}
        <Select
          value={selectedIds[0] ?? (noneOptionLabel === null ? undefined : "__null__")}
          onValueChange={(nextValue) => onChange(nextValue === "__null__" ? null : nextValue)}
          disabled={disabled}
        >
          <SelectTrigger id={inputId} aria-label={label} className="h-8 border-border text-xs">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {noneOptionLabel !== null ? <SelectItem value="__null__">{noneOptionLabel}</SelectItem> : null}
            {renderedOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hiddenOptionCount > 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Showing the first {relationOptionsRenderLimit} options. Search to narrow the list.
          </p>
        ) : null}
      </div>
    );
  }

  if (resolvedOptions.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-secondary px-3 py-4">
        {helperText ? <p className="mb-1.5 text-xs text-muted-foreground">{helperText}</p> : null}
        {showSearchInput ? (
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={searchInputId}
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 border-border pl-8 text-xs"
              disabled={disabled}
            />
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {isSearching && (totalOptionCount ?? 0) > 0 && noResultsMessage
            ? noResultsMessage
            : getRelationFieldEmptyStateMessage({ emptyStateMessage })}
        </p>
      </div>
    );
  }

  if (!showSelectionControls) {
    return (
      <div className="space-y-3">
        {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
        {renderAssetSelectionSummary()}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
      {renderAssetSelectionSummary()}
      {showSearchInput ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={searchInputId}
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 border-border pl-8 text-xs"
            disabled={disabled}
          />
        </div>
      ) : null}
      {optionStyle === "badges" ? (
        <div className="flex flex-wrap gap-2">
          {renderedOptions.map((option) => {
            const checked = selectedIds.includes(option.id);

            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={checked}
                className={cn(
                  badgeVariants({ variant: checked ? "secondary" : "outline" }),
                  "cursor-pointer px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-0 focus:ring-offset-0",
                  checked
                    ? "border-transparent bg-white text-black hover:bg-white/90"
                    : "border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
                onClick={() => {
                  const nextIds = checked
                    ? selectedIds.filter((entry) => entry !== option.id)
                    : Array.from(new Set([...selectedIds, option.id]));
                  onChange(nextIds);
                }}
                disabled={disabled}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-1 rounded-md border border-border bg-secondary/20 p-1">
          {renderedOptions.map((option) => {
            const checked = selectedIds.includes(option.id);
            const optionInputId = `${inputId}-${option.id}`;

            return (
              <label
                key={option.id}
                htmlFor={optionInputId}
                className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent"
              >
                <Checkbox
                  id={optionInputId}
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(nextChecked) => {
                    const nextIds = nextChecked
                      ? Array.from(new Set([...selectedIds, option.id]))
                      : selectedIds.filter((entry) => entry !== option.id);
                    onChange(nextIds);
                  }}
                />
                <span className="truncate text-xs text-foreground">{option.label}</span>
              </label>
            );
          })}
        </div>
      )}
      {hiddenOptionCount > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Showing the first {relationOptionsRenderLimit} options. Search to narrow the list.
        </p>
      ) : null}
    </div>
  );
}
