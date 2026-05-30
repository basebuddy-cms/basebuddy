import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProjectEditorPostsCollectionPage } from "@/components/editor/project-editor/posts-collection-page";
import type { ContentDatabaseReadAccessNotice } from "@/lib/content-runtime/shared";

const accessNotice: ContentDatabaseReadAccessNotice = {
  estimatedRows: 3908,
  kind: "database_read_access_limited",
  message:
    "BaseBuddy can connect to public.games, but this database connection cannot read any posts. Use a database connection with read access to show the existing rows.",
  tableRef: "public.games",
};

describe("project editor posts collection page", () => {
  it("shows a database access notice instead of the create-first-post empty state", () => {
    render(
      <ProjectEditorPostsCollectionPage
        accessNotice={accessNotice}
        authorsById={new Map()}
        collectionPagination={{
          hasNextPage: false,
          hasPreviousPage: false,
          page: 1,
          pageSize: 20,
          totalItems: 0,
          totalItemsExact: true,
          totalPages: 1,
        }}
        creatingPost={false}
        currentProjectName="Bloxodes"
        getPostHref={(postId) => `/posts/${postId}`}
        hasPostsQueryControlsActive={false}
        onClearSelection={vi.fn()}
        onCreatePost={vi.fn()}
        onOpenPostEditor={vi.fn()}
        onRequestDeletePost={vi.fn()}
        onRequestDeleteSelection={vi.fn()}
        onResetView={vi.fn()}
        onSearchQueryChange={vi.fn()}
        onSortChange={vi.fn()}
        onStatusFilterChange={vi.fn()}
        onToggleAllSelection={vi.fn()}
        onToggleSelection={vi.fn()}
        pagination={null}
        posts={[]}
        postsSearchQuery=""
        postsSort="updated_desc"
        postsStatusFilter="all"
        selectedPostIds={[]}
        showAuthorColumn
        showSlugColumn
        showStatusControls
      />,
    );

    expect(screen.getByText("No readable posts")).toBeInTheDocument();
    expect(screen.getByText(accessNotice.message)).toBeInTheDocument();
    expect(screen.queryByText("Create your first post")).not.toBeInTheDocument();
  });
});
