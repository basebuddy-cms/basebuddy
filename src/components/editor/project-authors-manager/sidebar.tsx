"use client";

import { Plus, Users } from "lucide-react";

type ProjectAuthorsManagerSidebarProps = {
  creatingAuthor: boolean;
  editingAuthorId: string | null;
  hasSelectedAuthors: boolean;
  newAuthorBio: string;
  newAuthorEmail: string;
  newAuthorName: string;
  newAuthorSlug: string;
  onAuthorBioChange: (value: string) => void;
  onAuthorEmailChange: (value: string) => void;
  onAuthorNameChange: (value: string) => void;
  onAuthorSlugChange: (value: string) => void;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
  onEditorCancel: () => void;
  onSubmit: () => void;
  selectedAuthorCount: number;
};

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ProjectAuthorsManagerSidebar({
  creatingAuthor,
  editingAuthorId,
  hasSelectedAuthors,
  newAuthorBio,
  newAuthorEmail,
  newAuthorName,
  newAuthorSlug,
  onAuthorBioChange,
  onAuthorEmailChange,
  onAuthorNameChange,
  onAuthorSlugChange,
  onClearSelection,
  onDeleteSelected,
  onEditorCancel,
  onSubmit,
  selectedAuthorCount,
}: ProjectAuthorsManagerSidebarProps) {
  return (
    <aside className="w-72 flex-shrink-0 overflow-y-auto border-l border-border bg-card">
      <div className="p-4">
        <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground">
          <Users className="h-3.5 w-3.5" />
          Authors
        </div>

        {hasSelectedAuthors && !editingAuthorId ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Delete Authors</p>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                {selectedAuthorCount} {selectedAuthorCount === 1 ? "author" : "authors"} selected.
              </p>
            </div>
            <Button type="button" variant="destructive" size="sm" className="w-full" onClick={onDeleteSelected}>
              Delete Authors
            </Button>
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={onClearSelection}>
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
                {editingAuthorId ? "Edit author" : "Create author"}
              </p>
              {editingAuthorId ? (
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onEditorCancel}>
                  Cancel
                </Button>
              ) : null}
            </div>
            <div>
              <Label
                htmlFor="author-panel-name"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                Name
              </Label>
              <Input
                id="author-panel-name"
                value={newAuthorName}
                onChange={(event) => onAuthorNameChange(event.target.value)}
                placeholder="Author name"
                className="h-8 border-border text-xs"
                disabled={creatingAuthor}
              />
            </div>

            <div>
              <Label
                htmlFor="author-panel-slug"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                Slug
              </Label>
              <Input
                id="author-panel-slug"
                value={newAuthorSlug}
                onChange={(event) => onAuthorSlugChange(event.target.value)}
                placeholder="author-slug"
                className="h-8 border-border text-xs"
                disabled={creatingAuthor}
              />
            </div>

            <div>
              <Label
                htmlFor="author-panel-email"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                Email
              </Label>
              <Input
                id="author-panel-email"
                type="email"
                value={newAuthorEmail}
                onChange={(event) => onAuthorEmailChange(event.target.value)}
                placeholder="author@example.com"
                className="h-8 border-border text-xs"
                disabled={creatingAuthor}
              />
            </div>

            <div>
              <Label
                htmlFor="author-panel-bio"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                Bio
              </Label>
              <Textarea
                id="author-panel-bio"
                value={newAuthorBio}
                onChange={(event) => onAuthorBioChange(event.target.value)}
                placeholder="Optional author bio"
                className="min-h-28 resize-none border-border text-xs"
                disabled={creatingAuthor}
              />
            </div>

            <Button type="submit" variant="hero" size="sm" className="w-full gap-2" disabled={!newAuthorName.trim() || creatingAuthor}>
              <Plus className="h-3.5 w-3.5" />
              {creatingAuthor
                ? editingAuthorId
                  ? "Saving author..."
                  : "Creating author..."
                : editingAuthorId
                  ? "Save Author"
                  : "Create Author"}
            </Button>
          </form>
        )}
      </div>
    </aside>
  );
}
