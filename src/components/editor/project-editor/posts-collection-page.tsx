"use client";

import React, { type ReactNode } from "react";
import { FileText, Pencil, Plus, Search, Trash2 } from "lucide-react";

import { NavigationLink } from "@/components/editor/navigation-link";
import {
  type ContentPagination,
  type ContentPost,
  type ContentPostsListIndexState,
  type ContentPostsSort,
  type ContentPostsStatusFilter,
} from "@/lib/content-runtime/shared";
import { getUserDisplayName } from "@/lib/control-plane/utils";

import {
  formatPostDate,
  getPostStatusBadgeClassName,
  getPostStatusDotClassName,
  getPostTitle,
} from "./utils";
import { postSortOptions, postStatusFilterOptions } from "./constants";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PostAuthorListEntry = {
  avatarUrl: string | null;
  displayName: string;
  email: string | null;
};

type ProjectEditorPostsCollectionPageProps = {
  authorsById: Map<string, PostAuthorListEntry>;
  collectionPagination: ContentPagination;
  creatingPost: boolean;
  currentProjectName: string;
  getPostHref: (postId: string) => string;
  hasPostsQueryControlsActive: boolean;
  onClearSelection: () => void;
  onCreatePost: () => void;
  onOpenPostEditor: (postId: string) => void;
  onRequestDeletePost: (postId: string) => void;
  onRequestDeleteSelection: () => void;
  onResetView: () => void;
  onSearchQueryChange: (value: string) => void;
  onSortChange: (value: ContentPostsSort) => void;
  onStatusFilterChange: (value: ContentPostsStatusFilter) => void;
  onToggleAllSelection: (checked: boolean) => void;
  onToggleSelection: (postId: string, checked: boolean) => void;
  pagination: ReactNode;
  posts: ContentPost[];
  postsListIndexState?: ContentPostsListIndexState;
  postsSearchQuery: string;
  showAuthorColumn: boolean;
  showSlugColumn: boolean;
  showStatusControls: boolean;
  postsSort: ContentPostsSort;
  postsStatusFilter: ContentPostsStatusFilter;
  selectedPostIds: string[];
};

export function ProjectEditorPostsCollectionPage({
  authorsById,
  collectionPagination,
  creatingPost,
  currentProjectName,
  getPostHref,
  hasPostsQueryControlsActive,
  onClearSelection,
  onCreatePost,
  onOpenPostEditor,
  onRequestDeletePost,
  onRequestDeleteSelection,
  onResetView,
  onSearchQueryChange,
  onSortChange,
  onStatusFilterChange,
  onToggleAllSelection,
  onToggleSelection,
  pagination,
  posts,
  postsListIndexState = "ready",
  postsSearchQuery,
  showAuthorColumn,
  showSlugColumn,
  showStatusControls,
  postsSort,
  postsStatusFilter,
  selectedPostIds,
}: ProjectEditorPostsCollectionPageProps) {
  const selectablePosts = posts.filter((post) => post.canWrite !== false);
  const selectablePostIds = new Set(selectablePosts.map((post) => post.id));
  const selectedWritablePostIds = selectedPostIds.filter((postId) => selectablePostIds.has(postId));
  const allSelected = selectablePosts.length > 0 && selectedWritablePostIds.length === selectablePosts.length;
  const partiallySelected = selectedWritablePostIds.length > 0 && !allSelected;
  const hasSelection = selectedWritablePostIds.length > 0;

  if (!posts.length && collectionPagination.totalItems === 0 && !hasPostsQueryControlsActive) {
    return (
      <div className="mx-auto flex min-h-full max-w-6xl items-center px-10 py-12">
        <div className="w-full py-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold text-foreground">Create your first post</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Write your first post for {currentProjectName}.
          </p>
          <Button
            variant="hero"
            size="sm"
            className="mt-5 gap-2"
            onClick={onCreatePost}
            disabled={creatingPost}
          >
            <Plus className="h-3.5 w-3.5" />
            {creatingPost ? "Creating..." : "New Post"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-10 py-12">
      <div className="mb-10 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Posts</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Search, sort, and open posts from this project.
          </p>
        </div>
        {hasSelection ? (
          <div className="flex items-center gap-2">
            <Button variant="destructive" size="sm" onClick={onRequestDeleteSelection}>
              Delete Selected
            </Button>
            <Button variant="outline" size="sm" onClick={onClearSelection}>
              Clear Selection
            </Button>
          </div>
        ) : (
          <Button
            variant="hero"
            size="sm"
            className="gap-2"
            onClick={onCreatePost}
            disabled={creatingPost}
          >
            <Plus className="h-3.5 w-3.5" />
            {creatingPost ? "Creating..." : "New Post"}
          </Button>
        )}
      </div>

      <div className="mb-8 flex flex-col gap-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={postsSearchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Search title, slug, or excerpt"
              className="h-9 border-border bg-background pl-9"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row xl:flex-none">
            {showStatusControls ? (
              <Select
                value={postsStatusFilter}
                onValueChange={(value) => onStatusFilterChange(value as ContentPostsStatusFilter)}
              >
                <SelectTrigger className="h-9 min-w-[160px] border-border bg-background">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {postStatusFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            <Select value={postsSort} onValueChange={(value) => onSortChange(value as ContentPostsSort)}>
              <SelectTrigger className="h-9 min-w-[190px] border-border bg-background">
                <SelectValue placeholder="Sort posts" />
              </SelectTrigger>
              <SelectContent>
                {postSortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 px-2.5 text-muted-foreground hover:text-foreground"
              onClick={onResetView}
              disabled={!hasPostsQueryControlsActive}
            >
              Clear
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Search by title, slug, or excerpt.</p>
          <div className="flex items-center gap-2">
            {hasPostsQueryControlsActive ? (
              <Badge variant="outline" className="border-border bg-transparent font-medium text-muted-foreground">
                Filtered view
              </Badge>
            ) : null}
            <span>
              {collectionPagination.totalItems}
              {collectionPagination.totalItemsExact === false ? "+" : ""} matching{" "}
              {collectionPagination.totalItems === 1 &&
              collectionPagination.totalItemsExact !== false
                ? "post"
                : "posts"}
            </span>
          </div>
        </div>
        <Separator />
      </div>

      {posts.length ? (
        <>
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-10 w-10 px-0">
                  <Checkbox
                    aria-label="Select all posts"
                    checked={
                      selectablePosts.length
                        ? allSelected
                          ? true
                          : partiallySelected
                            ? "indeterminate"
                            : false
                        : false
                    }
                    onCheckedChange={(checked) => onToggleAllSelection(checked === true)}
                    disabled={!selectablePosts.length}
                  />
                </TableHead>
                <TableHead className="h-10 w-[38%] px-0 text-sm uppercase tracking-wider">Title</TableHead>
                {showStatusControls ? (
                  <TableHead className="h-10 w-[128px] px-0 text-sm uppercase tracking-wider">Status</TableHead>
                ) : null}
                {showAuthorColumn ? (
                  <TableHead className="h-10 w-[180px] px-0 text-sm uppercase tracking-wider">Author</TableHead>
                ) : null}
                {showSlugColumn ? (
                  <TableHead className="h-10 w-[180px] px-0 text-sm uppercase tracking-wider">Slug</TableHead>
                ) : null}
                <TableHead className="h-10 w-[180px] px-0 text-right text-sm uppercase tracking-wider">
                  Updated
                </TableHead>
                <TableHead className="h-10 w-[88px] px-0 text-right text-sm uppercase tracking-wider">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => {
                const author = post.authorId ? authorsById.get(post.authorId) : null;
                const authorDisplayName = author?.displayName ?? "No author";
                const authorEmail = author?.email ?? null;
                const editingSession = post.editingSession;
                const editingDisplayName = getUserDisplayName(
                  editingSession?.editorEmail,
                  editingSession?.editorName,
                );
                const canDeletePost = post.canWrite !== false;
                const isSelected = selectedWritablePostIds.includes(post.id);

                return (
                  <TableRow
                    key={post.id}
                    className="border-border/70"
                    data-state={isSelected ? "selected" : undefined}
                  >
                    <TableCell className="px-0 py-3">
                      <Checkbox
                        aria-label={`Select ${getPostTitle(post.title)}`}
                        checked={isSelected}
                        onCheckedChange={(checked) => onToggleSelection(post.id, checked === true)}
                        disabled={!canDeletePost}
                      />
                    </TableCell>
                    <TableCell className="px-0 py-3">
                      <NavigationLink
                        href={getPostHref(post.id)}
                        onPlainNavigation={() => onOpenPostEditor(post.id)}
                        className="inline-flex h-auto w-full justify-start rounded-md px-0 py-0 text-left transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="min-w-0 max-w-full">
                          <p className="[overflow-wrap:anywhere] text-sm font-medium leading-6 text-foreground">
                            {getPostTitle(post.title)}
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                            {post.excerpt?.trim() || `/${post.slug}`}
                          </p>
                        </div>
                      </NavigationLink>
                    </TableCell>
                    {showStatusControls ? (
                      <TableCell className="px-0 py-3">
                        <Badge variant="secondary" className={getPostStatusBadgeClassName(post.status)}>
                          <span className={getPostStatusDotClassName(post.status)} />
                          {post.status}
                        </Badge>
                      </TableCell>
                    ) : null}
                    {showAuthorColumn ? (
                      <TableCell className="px-0 py-3">
                        <div className="min-w-0">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{authorDisplayName}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {authorEmail ?? "Unassigned content author"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                    ) : null}
                    {showSlugColumn ? (
                      <TableCell className="px-0 py-3 text-xs font-mono text-muted-foreground">
                        <span className="block truncate">/{post.slug}</span>
                      </TableCell>
                    ) : null}
                    <TableCell className="px-0 py-3">
                      <div className="flex flex-col items-end gap-1 text-right">
                        {editingSession ? (
                          <span className="max-w-full truncate text-xs text-muted-foreground">
                            {editingSession.isCurrentUser ? "You are editing" : `${editingDisplayName} editing`}
                          </span>
                        ) : null}
                        <p className="text-xs text-muted-foreground">{formatPostDate(post.updatedAt)}</p>
                      </div>
                    </TableCell>
                    <TableCell className="px-0 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground"
                          onClick={() => onOpenPostEditor(post.id)}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit {getPostTitle(post.title)}</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          disabled={!canDeletePost}
                          onClick={() => onRequestDeletePost(post.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete {getPostTitle(post.title)}</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {pagination}
        </>
      ) : (
        <div className="py-16 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold text-foreground">No posts match this view</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Try a different search, switch the status filter, or clear the current view settings.
          </p>
          {hasPostsQueryControlsActive ? (
            <Button
              type="button"
              variant="hero-outline"
              size="sm"
              className="mt-5"
              onClick={onResetView}
            >
              Reset View
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
