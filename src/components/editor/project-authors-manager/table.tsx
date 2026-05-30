"use client";

import { Fragment } from "react";
import { Pencil, Trash2 } from "lucide-react";

import type { ProjectAuthorMember } from "@/lib/control-plane/authors";
import { getUserDisplayName } from "@/lib/control-plane/utils";
import type {
  ContentAuthor,
  ContentDatabaseReadAccessNotice,
  ContentPagination,
} from "@/lib/content-runtime/shared";
import type { AuthorAssignmentDraft } from "@/components/editor/project-authors-manager/support";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ProjectAuthorsManagerTableProps = {
  accessNotice?: ContentDatabaseReadAccessNotice | null;
  authorAssignmentDrafts: Record<string, AuthorAssignmentDraft>;
  authorMembers: ProjectAuthorMember[];
  authors: ContentAuthor[];
  deletingAuthorIds: string[] | null;
  onAuthorDeleteRequest: (author: ContentAuthor) => void;
  onAuthorEditRequest: (author: ContentAuthor) => void;
  onAssignmentDraftChange: (authorId: string, memberId: string | null) => void;
  onAssignmentPublishChange: (authorId: string, canPublish: boolean) => void;
  onAssignmentSave: (authorId: string) => void;
  onAuthorSelectionChange: (authorId: string, selected: boolean) => void;
  onPageChange: (page: number) => void;
  onSelectAllChange: (selected: boolean) => void;
  pagination: ContentPagination;
  paginationPages: number[];
  savingAuthorId: string | null;
  selectedAuthorIds: string[];
};

export function ProjectAuthorsManagerTable({
  accessNotice,
  authorAssignmentDrafts,
  authorMembers,
  authors,
  deletingAuthorIds,
  onAuthorDeleteRequest,
  onAuthorEditRequest,
  onAssignmentDraftChange,
  onAssignmentPublishChange,
  onAssignmentSave,
  onAuthorSelectionChange,
  onPageChange,
  onSelectAllChange,
  pagination,
  paginationPages,
  savingAuthorId,
  selectedAuthorIds,
}: ProjectAuthorsManagerTableProps) {
  const allAuthorsSelected = authors.length > 0 && selectedAuthorIds.length === authors.length;
  const someAuthorsSelected = selectedAuthorIds.length > 0 && selectedAuthorIds.length < authors.length;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-10 w-10 px-0">
              <Checkbox
                checked={allAuthorsSelected ? true : someAuthorsSelected ? "indeterminate" : false}
                onCheckedChange={(checked) => onSelectAllChange(checked === true)}
                disabled={!authors.length}
              />
            </TableHead>
            <TableHead className="h-10 px-0 text-xs uppercase tracking-wider">Name</TableHead>
            <TableHead className="h-10 px-0 text-xs uppercase tracking-wider">Slug</TableHead>
            <TableHead className="h-10 px-0 text-xs uppercase tracking-wider">Member</TableHead>
            <TableHead className="h-10 px-0 text-xs uppercase tracking-wider">Publish</TableHead>
            <TableHead className="h-10 px-0 text-right text-xs uppercase tracking-wider">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {authors.length ? (
            authors.map((author) => {
              const draft = authorAssignmentDrafts[author.id];
              const selectedMemberId = draft?.userId ?? null;
              const canPublish = selectedMemberId ? draft?.canPublish ?? true : false;
              const isDirty = draft?.isDirty ?? false;
              const isSaving = savingAuthorId === author.id;

              return (
                <TableRow key={author.id} data-state={selectedAuthorIds.includes(author.id) ? "selected" : undefined}>
                  <TableCell className="px-0 py-3">
                    <Checkbox
                      checked={selectedAuthorIds.includes(author.id)}
                      onCheckedChange={(checked) => onAuthorSelectionChange(author.id, checked === true)}
                    />
                  </TableCell>
                  <TableCell className="px-0 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">{author.name}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {author.email?.trim() || author.bio?.trim() || "No extra details"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="px-0 py-3 text-sm text-muted-foreground">{author.slug}</TableCell>
                  <TableCell className="px-0 py-3">
                    <Select
                      value={selectedMemberId ?? "unassigned"}
                      onValueChange={(value) => onAssignmentDraftChange(author.id, value === "unassigned" ? null : value)}
                      disabled={isSaving}
                    >
                      <SelectTrigger className="h-8 w-[220px] border-border text-xs">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {authorMembers.map((member) => (
                          <SelectItem key={member.userId} value={member.userId}>
                            {getUserDisplayName(member.email, member.name)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="px-0 py-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        aria-label={`Allow ${author.name} assignment to publish`}
                        checked={canPublish}
                        disabled={isSaving || !selectedMemberId}
                        onCheckedChange={(checked) => onAssignmentPublishChange(author.id, checked)}
                      />
                      <span className="text-xs text-muted-foreground">
                        {canPublish ? "Can publish" : "Draft only"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-0 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="hero"
                        disabled={isSaving || !isDirty}
                        onClick={() => onAssignmentSave(author.id)}
                      >
                        {isSaving ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        aria-label="Edit author"
                        disabled={Boolean(deletingAuthorIds?.length)}
                        onClick={() => onAuthorEditRequest(author)}
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit {author.name}</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        aria-label="Delete author"
                        disabled={Boolean(deletingAuthorIds?.length)}
                        onClick={() => onAuthorDeleteRequest(author)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete {author.name}</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={6} className="px-0 py-10 text-sm text-muted-foreground">
                {accessNotice?.message ?? "Create your first author to connect team members to author profiles."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {pagination.totalPages > 1 ? (
        <Pagination className="mt-8 justify-start">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(event) => {
                  event.preventDefault();

                  if (pagination.page > 1) {
                    onPageChange(pagination.page - 1);
                  }
                }}
                className={pagination.page <= 1 ? "pointer-events-none opacity-50" : undefined}
              />
            </PaginationItem>
            {paginationPages.map((page, index) => {
              const previousPage = paginationPages[index - 1];
              const showEllipsis = previousPage && page - previousPage > 1;

              return (
                <Fragment key={page}>
                  {showEllipsis ? (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : null}
                  <PaginationItem>
                    <PaginationLink
                      href="#"
                      isActive={page === pagination.page}
                      onClick={(event) => {
                        event.preventDefault();
                        onPageChange(page);
                      }}
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                </Fragment>
              );
            })}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(event) => {
                  event.preventDefault();

                  if (pagination.page < pagination.totalPages) {
                    onPageChange(pagination.page + 1);
                  }
                }}
                className={pagination.page >= pagination.totalPages ? "pointer-events-none opacity-50" : undefined}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </>
  );
}
