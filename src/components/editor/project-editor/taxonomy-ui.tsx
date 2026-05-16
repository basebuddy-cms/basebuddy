"use client";

import React, { type ReactNode } from "react";
import { ChevronDown, Pencil, Plus, Trash2, type LucideIcon } from "lucide-react";

import type {
  ContentCategory,
  ContentTag,
} from "@/lib/content-runtime/shared";

import type { EditingTaxonomyEntry, TaxonomyCollectionLabel } from "./types";
import { formatCategoryHierarchyLabel, getTaxonomyNoun } from "./utils";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type TaxonomyEntry = ContentCategory | ContentTag;

type ProjectEditorTaxonomyCollectionPageProps = {
  canManageTaxonomy: boolean;
  collection: TaxonomyCollectionLabel;
  emptyMessage: string;
  entries: TaxonomyEntry[];
  helperText: string;
  isContentReady: boolean;
  onDeleteEntry: (entry: TaxonomyEntry) => void;
  onEditEntry: (entry: TaxonomyEntry) => void;
  onToggleAllSelection: (checked: boolean) => void;
  onToggleSelection: (entryId: string, checked: boolean) => void;
  pagination?: ReactNode;
  selectedEntryIds: string[];
  title: string;
};

type ProjectEditorTaxonomySidePanelProps = {
  canManageTaxonomy: boolean;
  categoryOptions: ContentCategory[];
  collection: TaxonomyCollectionLabel;
  creatingCollectionEntry: boolean;
  currentDescription: string;
  currentName: string;
  currentSlug: string;
  editingTaxonomyEntry: EditingTaxonomyEntry | null;
  icon: LucideIcon;
  isContentReady: boolean;
  onClearSelection: () => void;
  onClose: () => void;
  onDescriptionChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onParentCategoryChange: (value: string) => void;
  onRequestDeleteSelection: () => void;
  onReset: () => void;
  onSlugChange: (value: string) => void;
  onSubmit: () => void;
  parentCategoryId: string;
  selectedIds: string[];
};

export function ProjectEditorTaxonomyCollectionPage({
  canManageTaxonomy,
  collection,
  emptyMessage,
  entries,
  helperText,
  isContentReady,
  onDeleteEntry,
  onEditEntry,
  onToggleAllSelection,
  onToggleSelection,
  pagination,
  selectedEntryIds,
  title,
}: ProjectEditorTaxonomyCollectionPageProps) {
  const allSelected = entries.length > 0 && selectedEntryIds.length === entries.length;
  const partiallySelected = selectedEntryIds.length > 0 && !allSelected;

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <div className="mb-8 space-y-2">
        <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{helperText}</p>
        {!canManageTaxonomy ? (
          <p className="text-sm text-muted-foreground">
            Only project owners, admins, and editors can manage categories and tags.
          </p>
        ) : null}
      </div>

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-10 w-10 px-0">
              <Checkbox
                checked={entries.length ? (allSelected ? true : partiallySelected ? "indeterminate" : false) : false}
                onCheckedChange={(checked) => onToggleAllSelection(checked === true)}
                disabled={!entries.length || !isContentReady || !canManageTaxonomy}
              />
            </TableHead>
            <TableHead className="h-10 px-0 text-sm uppercase tracking-wider">Name</TableHead>
            <TableHead className="h-10 px-0 text-sm uppercase tracking-wider">Slug</TableHead>
            <TableHead className="h-10 px-0 text-sm uppercase tracking-wider">Description</TableHead>
            <TableHead className="h-10 px-0 text-right text-sm uppercase tracking-wider">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.length ? (
            entries.map((entry) => (
              <TableRow
                key={entry.id}
                data-state={selectedEntryIds.includes(entry.id) ? "selected" : undefined}
              >
                <TableCell className="px-0 py-3">
                  <Checkbox
                    checked={selectedEntryIds.includes(entry.id)}
                    onCheckedChange={(checked) => onToggleSelection(entry.id, checked === true)}
                    disabled={!isContentReady || !canManageTaxonomy}
                  />
                </TableCell>
                <TableCell className="px-0 py-3 text-sm text-foreground">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">
                      {collection === "Categories" ? formatCategoryHierarchyLabel(entry as ContentCategory) : entry.name}
                    </p>
                    {collection === "Categories" && (entry as ContentCategory).hasChildren ? (
                      <p className="mt-1 text-xs text-muted-foreground">Has subcategories</p>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="px-0 py-3 text-sm text-muted-foreground">{entry.slug}</TableCell>
                <TableCell className="px-0 py-3 text-sm text-muted-foreground">
                  {entry.description?.trim() || "—"}
                </TableCell>
                <TableCell className="px-0 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground"
                      disabled={!isContentReady || !canManageTaxonomy}
                      onClick={() => onEditEntry(entry)}
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Edit {entry.name}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      disabled={!isContentReady || !canManageTaxonomy}
                      onClick={() => onDeleteEntry(entry)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete {entry.name}</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={5} className="px-0 py-10 text-sm text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {pagination}
    </div>
  );
}

export function ProjectEditorTaxonomySidePanel({
  canManageTaxonomy,
  categoryOptions,
  collection,
  creatingCollectionEntry,
  currentDescription,
  currentName,
  currentSlug,
  editingTaxonomyEntry,
  icon: Icon,
  isContentReady,
  onClearSelection,
  onClose,
  onDescriptionChange,
  onNameChange,
  onParentCategoryChange,
  onRequestDeleteSelection,
  onReset,
  onSlugChange,
  onSubmit,
  parentCategoryId,
  selectedIds,
}: ProjectEditorTaxonomySidePanelProps) {
  const singularLabel = collection === "Categories" ? "Category" : "Tag";
  const singularNoun = getTaxonomyNoun(collection);
  const pluralNoun = getTaxonomyNoun(collection, true);
  const isEditingEntry = editingTaxonomyEntry?.collection === collection;
  const hasSelection = selectedIds.length > 0;

  return (
    <aside className="min-h-0 w-72 flex-shrink-0 overflow-y-auto overscroll-contain border-l border-border bg-card">
      <div className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground">
            <Icon className="h-3.5 w-3.5" />
            {collection}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>

        {!canManageTaxonomy ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            Only project owners, admins, and editors can manage categories and tags.
          </div>
        ) : hasSelection && !isEditingEntry ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Delete {collection}
              </p>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                {selectedIds.length} {selectedIds.length === 1 ? singularNoun : pluralNoun} selected.
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="w-full"
              disabled={!isContentReady}
              onClick={onRequestDeleteSelection}
            >
              Delete {collection}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={onClearSelection}
            >
              Clear Selection
            </Button>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {isEditingEntry ? `Edit ${singularLabel}` : `Create ${singularLabel}`}
              </p>
              {isEditingEntry ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={onReset}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
            <div>
              <Label
                htmlFor={collection === "Categories" ? "category-panel-name" : "tag-panel-name"}
                className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                Name
              </Label>
              <Input
                id={collection === "Categories" ? "category-panel-name" : "tag-panel-name"}
                value={currentName}
                onChange={(event) => onNameChange(event.target.value)}
                placeholder={`${singularLabel} name`}
                className="h-8 border-border bg-secondary text-xs"
                disabled={!isContentReady || creatingCollectionEntry}
              />
            </div>

            <div>
              <Label
                htmlFor={collection === "Categories" ? "category-panel-slug" : "tag-panel-slug"}
                className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                Slug
              </Label>
              <Input
                id={collection === "Categories" ? "category-panel-slug" : "tag-panel-slug"}
                value={currentSlug}
                onChange={(event) => onSlugChange(event.target.value)}
                placeholder={`${singularLabel.toLowerCase()}-slug`}
                className="h-8 border-border bg-secondary text-xs"
                disabled={!isContentReady || creatingCollectionEntry}
              />
            </div>

            {collection === "Categories" ? (
              <div>
                <Label
                  htmlFor="category-panel-parent"
                  className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  Parent Category
                </Label>
                <Select
                  value={parentCategoryId}
                  onValueChange={onParentCategoryChange}
                  disabled={!isContentReady || creatingCollectionEntry}
                >
                  <SelectTrigger
                    id="category-panel-parent"
                    className="h-8 border-border bg-secondary text-xs"
                  >
                    <SelectValue placeholder="No parent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No parent</SelectItem>
                    {categoryOptions
                      .filter((category) => !isEditingEntry || category.id !== editingTaxonomyEntry?.entryId)
                      .map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {formatCategoryHierarchyLabel(category)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div>
              <Label
                htmlFor={collection === "Categories" ? "category-panel-description" : "tag-panel-description"}
                className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                Description
              </Label>
              <Textarea
                id={collection === "Categories" ? "category-panel-description" : "tag-panel-description"}
                value={currentDescription}
                onChange={(event) => onDescriptionChange(event.target.value)}
                placeholder="Optional description"
                className="min-h-28 resize-none border-border bg-secondary text-xs"
                disabled={!isContentReady || creatingCollectionEntry}
              />
            </div>

            <Button
              type="submit"
              variant="hero"
              size="sm"
              className="w-full gap-2"
              disabled={!currentName.trim() || !isContentReady || creatingCollectionEntry}
            >
              <Plus className="h-3.5 w-3.5" />
              {creatingCollectionEntry
                ? `${isEditingEntry ? "Saving" : "Creating"} ${singularLabel.toLowerCase()}...`
                : isEditingEntry
                  ? `Save ${singularLabel}`
                  : `Create ${singularLabel}`}
            </Button>
          </form>
        )}
      </div>
    </aside>
  );
}
