import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProjectEditorPostsCollectionPage } from "@/components/editor/project-editor/posts-collection-page";
import type { ContentPost } from "@/lib/content-runtime/shared";

const createPost = (overrides?: Partial<ContentPost>): ContentPost => ({
  authorId: null,
  categoryIds: [],
  contentFields: {},
  contentFormat: "html",
  contentHtml: "",
  contentJson: {},
  contentMarkdown: null,
  createdAt: "2026-03-27T00:00:00.000Z",
  customFields: {},
  excerpt: "Example excerpt",
  focusKeyword: null,
  featuredImageUrl: null,
  id: "post-1",
  publishedAt: null,
  redirects: [],
  seoDescription: null,
  seoTitle: null,
  slug: "post-1",
  status: "draft",
  tagIds: [],
  title: "Post One",
  updatedAt: "2026-03-27T01:00:00.000Z",
  canWrite: true,
  ...overrides,
});

describe("ProjectEditorPostsCollectionPage", () => {
  it("does not show preparation copy while the fast posts list is being prepared", () => {
    render(
      <ProjectEditorPostsCollectionPage
        authorsById={new Map()}
        collectionPagination={{
          hasNextPage: true,
          hasPreviousPage: false,
          page: 1,
          pageSize: 20,
          totalItems: 21,
          totalItemsExact: false,
          totalPages: 2,
        }}
        creatingPost={false}
        currentProjectName="Demo Project"
        getPostHref={(postId) => `/projects/demo/posts/${postId}`}
        hasPostsQueryControlsActive={false}
        onClearSelection={vi.fn()}
        onCreatePost={vi.fn()}
        onRequestDeletePost={vi.fn()}
        onRequestDeleteSelection={vi.fn()}
        onOpenPostEditor={vi.fn()}
        onResetView={vi.fn()}
        onSearchQueryChange={vi.fn()}
        onSortChange={vi.fn()}
        onStatusFilterChange={vi.fn()}
        onToggleAllSelection={vi.fn()}
        onToggleSelection={vi.fn()}
        pagination={null}
        posts={[createPost()]}
        postsListIndexState="warming"
        postsSearchQuery=""
        showAuthorColumn={false}
        showSlugColumn={true}
        showStatusControls={true}
        postsSort="updated_desc"
        postsStatusFilter="all"
        selectedPostIds={[]}
      />,
    );

    expect(screen.queryByText("Preparing faster post browsing.")).not.toBeInTheDocument();
    expect(
      screen.queryByText("You can keep working while BaseBuddy finishes updating this project."),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Post One")).toBeInTheDocument();
  });

  it("shows an approximate match count while the exact total is still pending", () => {
    render(
      <ProjectEditorPostsCollectionPage
        authorsById={new Map()}
        collectionPagination={{
          hasNextPage: true,
          hasPreviousPage: false,
          page: 1,
          pageSize: 20,
          totalItems: 21,
          totalItemsExact: false,
          totalPages: 2,
        }}
        creatingPost={false}
        currentProjectName="Demo Project"
        getPostHref={(postId) => `/projects/demo/posts/${postId}`}
        hasPostsQueryControlsActive={false}
        onClearSelection={vi.fn()}
        onCreatePost={vi.fn()}
        onRequestDeletePost={vi.fn()}
        onRequestDeleteSelection={vi.fn()}
        onOpenPostEditor={vi.fn()}
        onResetView={vi.fn()}
        onSearchQueryChange={vi.fn()}
        onSortChange={vi.fn()}
        onStatusFilterChange={vi.fn()}
        onToggleAllSelection={vi.fn()}
        onToggleSelection={vi.fn()}
        pagination={<div>Pagination</div>}
        posts={[createPost()]}
        postsSearchQuery=""
        showAuthorColumn={false}
        showSlugColumn={true}
        showStatusControls={true}
        postsSort="updated_desc"
        postsStatusFilter="all"
        selectedPostIds={[]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Posts" })).toBeInTheDocument();
    expect(screen.getByText("21+ matching posts")).toBeInTheDocument();
    expect(screen.getByText("Post One")).toBeInTheDocument();
    expect(screen.getByText("Pagination")).toBeInTheDocument();
  });

  it("switches the header actions to bulk-delete controls when posts are selected", () => {
    render(
      <ProjectEditorPostsCollectionPage
        authorsById={new Map()}
        collectionPagination={{
          hasNextPage: false,
          hasPreviousPage: false,
          page: 1,
          pageSize: 20,
          totalItems: 2,
          totalItemsExact: true,
          totalPages: 1,
        }}
        creatingPost={false}
        currentProjectName="Demo Project"
        getPostHref={(postId) => `/projects/demo/posts/${postId}`}
        hasPostsQueryControlsActive={false}
        onClearSelection={vi.fn()}
        onCreatePost={vi.fn()}
        onRequestDeletePost={vi.fn()}
        onRequestDeleteSelection={vi.fn()}
        onOpenPostEditor={vi.fn()}
        onResetView={vi.fn()}
        onSearchQueryChange={vi.fn()}
        onSortChange={vi.fn()}
        onStatusFilterChange={vi.fn()}
        onToggleAllSelection={vi.fn()}
        onToggleSelection={vi.fn()}
        pagination={null}
        posts={[
          createPost({ id: "post-1", title: "Writable Post", canWrite: true }),
          createPost({ id: "post-2", slug: "readonly-post", title: "Read Only Post", canWrite: false }),
        ]}
        postsSearchQuery=""
        showAuthorColumn={false}
        showSlugColumn={true}
        showStatusControls={true}
        postsSort="updated_desc"
        postsStatusFilter="all"
        selectedPostIds={["post-1"]}
      />,
    );

    expect(screen.queryByRole("button", { name: "New Post" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Selected" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear Selection" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Select Writable Post" })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "Select Read Only Post" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete Writable Post" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Delete Read Only Post" })).toBeDisabled();
  });

  it("uses a fixed table layout and wraps long post titles inside the title cell", () => {
    const longTitle = "VeryLongPostTitleWithoutNaturalBreakPoints".repeat(6);

    render(
      <ProjectEditorPostsCollectionPage
        authorsById={new Map()}
        collectionPagination={{
          hasNextPage: false,
          hasPreviousPage: false,
          page: 1,
          pageSize: 20,
          totalItems: 1,
          totalItemsExact: true,
          totalPages: 1,
        }}
        creatingPost={false}
        currentProjectName="Demo Project"
        getPostHref={(postId) => `/projects/demo/posts/${postId}`}
        hasPostsQueryControlsActive={false}
        onClearSelection={vi.fn()}
        onCreatePost={vi.fn()}
        onRequestDeletePost={vi.fn()}
        onRequestDeleteSelection={vi.fn()}
        onOpenPostEditor={vi.fn()}
        onResetView={vi.fn()}
        onSearchQueryChange={vi.fn()}
        onSortChange={vi.fn()}
        onStatusFilterChange={vi.fn()}
        onToggleAllSelection={vi.fn()}
        onToggleSelection={vi.fn()}
        pagination={null}
        posts={[createPost({ title: longTitle })]}
        postsSearchQuery=""
        showAuthorColumn={false}
        showSlugColumn={true}
        showStatusControls={true}
        postsSort="updated_desc"
        postsStatusFilter="all"
        selectedPostIds={[]}
      />,
    );

    expect(screen.getByRole("table")).toHaveClass("table-fixed");
    expect(screen.getByRole("table")).toHaveClass("min-w-[920px]");
    expect(screen.getByText(longTitle)).toHaveClass("[overflow-wrap:anywhere]");
  });

  it("hides optional adapter-driven columns and filters when those capabilities are unavailable", () => {
    render(
      <ProjectEditorPostsCollectionPage
        authorsById={new Map()}
        collectionPagination={{
          hasNextPage: false,
          hasPreviousPage: false,
          page: 1,
          pageSize: 20,
          totalItems: 1,
          totalItemsExact: true,
          totalPages: 1,
        }}
        creatingPost={false}
        currentProjectName="Demo Project"
        getPostHref={(postId) => `/projects/demo/posts/${postId}`}
        hasPostsQueryControlsActive={false}
        onClearSelection={vi.fn()}
        onCreatePost={vi.fn()}
        onRequestDeletePost={vi.fn()}
        onRequestDeleteSelection={vi.fn()}
        onOpenPostEditor={vi.fn()}
        onResetView={vi.fn()}
        onSearchQueryChange={vi.fn()}
        onSortChange={vi.fn()}
        onStatusFilterChange={vi.fn()}
        onToggleAllSelection={vi.fn()}
        onToggleSelection={vi.fn()}
        pagination={null}
        posts={[createPost()]}
        postsSearchQuery=""
        showAuthorColumn={false}
        showSlugColumn={false}
        showStatusControls={false}
        postsSort="updated_desc"
        postsStatusFilter="all"
        selectedPostIds={[]}
      />,
    );

    expect(screen.queryByRole("columnheader", { name: "Status" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Author" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Slug" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /status/i })).not.toBeInTheDocument();
  });
});
