import type { ContentProjectMapping } from "@/lib/content-runtime/mapping";
import type {
  ContentAuthor,
  ContentCategoriesPage,
  ContentCollectionCounts,
  ContentCollectionPage,
  ContentCategory,
  ContentMedia,
  ContentPostEditorPayload,
  ContentPost,
  ContentPostsPage,
  ContentPostsSort,
  ContentPostsStatusFilter,
  ContentSnapshot,
  ContentTag,
} from "@/lib/content-runtime/shared";
import type { ContentDatabaseClient } from "@/lib/content-runtime/mapped-content-runtime-support";
import {
  buildPostsWhereClause,
  getEntityIdColumn,
  getEntityTableName,
  getMappedContentRuntime,
  getRowValue,
  toText,
} from "@/lib/content-runtime/mapped-content-runtime-support";
import type { ContentCollectionEntryTable } from "@/lib/content-runtime/server-collections-shared";

import type {
  ContentAdapterArchiveRequest,
  ContentAdapterCapabilitySummary,
  ContentAdapterCreatePostRequest,
  ContentAdapterFieldSpec,
  ContentAdapterPost,
  ContentAdapterPostListRow,
  ContentAdapterPublishRequest,
  ContentAdapterRelationOption,
  ContentAdapterSavePostRequest,
  ContentAdapterSidebarFieldSpec,
  ContentAdapterUnpublishRequest,
  ContentProviderQueryResult,
} from "../contracts";
import {
  compileContentProjectMappingToAdapterInstructions,
  type ContentCompiledAdapterMapping,
} from "../compiler";
import {
  createMappedContentCollectionEntry,
  createMappedContentPost,
  deleteMappedContentCollectionEntries,
  deleteMappedContentPosts,
  discardMappedContentPost,
  getMappedContentAuthorOptions,
  getMappedContentAuthorsPage,
  getMappedContentCategoriesPage,
  getMappedContentMediaPage,
  getMappedContentPostAuthorId,
  getMappedContentPostById,
  getMappedContentPostEditorPayload,
  getMappedContentPostsPage,
  getMappedContentSnapshot,
  getMappedContentWorkspaceCounts,
  getMappedContentTagsPage,
  getMappedRelationValuesForPosts,
  loadMappedContentAuthors,
  loadMappedContentPostRows,
  mapMappedContentPostListRow,
  updateMappedContentPost,
  updateMappedContentCollectionEntry,
} from "./runtime";
import { buildContentAdapterCapabilitySummary } from "./capability-summary";
import { buildContentAdapterErrorFieldContext } from "./error-field-context";
import { buildContentAdapterFieldSpecs } from "./field-specs";
import {
  searchContentAdapterAuthors,
  searchContentAdapterCategories,
  searchContentAdapterFiles,
  searchContentAdapterMedia,
  searchContentAdapterParentPages,
  searchContentAdapterTags,
} from "./relation-search";
import { sanitizeAdapterSavePostRequest } from "./save-post-request";
import { buildContentAdapterSidebarFieldSpecs } from "./sidebar-field-specs";
import {
  createContentAdapterOperationError,
  isContentAdapterOperationError,
  mapContentProviderErrorToAdapterError,
  type ContentAdapterErrorFieldContext,
} from "../error-mapping";

type ContentRuntimeAdapterContext = {
  hasFilesS3CompatibleCredentials: boolean;
  hasS3CompatibleCredentials: boolean;
  mapping: ContentProjectMapping;
};

export type ContentProviderAdapter = {
  executeQuery<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<ContentProviderQueryResult<T>>;
};

export type ContentSqlFamilyProviderAdapter = ContentProviderAdapter & {
  family: "sql";
};

export type ContentRuntimeAdapter = {
  compiled: ContentCompiledAdapterMapping;
  createCollectionEntry: (
    request: ContentAdapterCreateCollectionEntryRequest,
  ) => Promise<ContentAuthor | ContentCategory | ContentTag>;
  createPost: (request: ContentAdapterCreatePostExecutionRequest) => Promise<ContentAdapterPost>;
  deletePosts: (request: ContentAdapterDeletePostsRequest) => Promise<void>;
  discardPost: (request: ContentAdapterDiscardPostRequest) => Promise<void>;
  deleteCollectionEntries: (
    request: ContentAdapterDeleteCollectionEntriesRequest,
  ) => Promise<void>;
  getCapabilitySummary(): ContentAdapterCapabilitySummary;
  kind: "postgres_content";
  loadAuthorOptions: (
    request: ContentAdapterAuthorOptionsRequest,
  ) => Promise<Array<Pick<ContentAuthor, "id" | "name" | "slug">>>;
  loadAuthorsPage: (
    request: ContentAdapterAuthorsPageRequest,
  ) => Promise<ContentCollectionPage<ContentAuthor>>;
  loadCategoriesPage: (
    request: ContentAdapterCategoriesPageRequest,
  ) => Promise<ContentCategoriesPage>;
  loadMediaPage: (
    request: ContentAdapterMediaPageRequest,
  ) => Promise<ContentCollectionPage<ContentMedia>>;
  loadFieldSpecs?: () => Promise<ContentAdapterFieldSpec[]>;
  loadPostEditorPayload: (
    request: ContentAdapterPostEditorPayloadRequest,
  ) => Promise<ContentPostEditorPayload>;
  countPosts: (request: ContentAdapterCountPostsRequest) => Promise<number>;
  loadPostListAuthors: (
    request: ContentAdapterPostListAuthorsRequest,
  ) => Promise<ContentAuthor[]>;
  loadPost: (request: ContentAdapterLoadPostRequest) => Promise<ContentAdapterPost>;
  loadPostAuthorId: (
    request: ContentAdapterLoadPostAuthorIdRequest,
  ) => Promise<string | null>;
  loadPostsPreviewSnapshot: (
    request: ContentAdapterPostsPreviewSnapshotRequest,
  ) => Promise<ContentAdapterPostsPreviewSnapshot>;
  loadPostsPage: (request: ContentAdapterPostsPageRequest) => Promise<ContentPostsPage>;
  loadSidebarFieldSpecs?: () => Promise<ContentAdapterSidebarFieldSpec[]>;
  loadTagsPage: (
    request: ContentAdapterTagsPageRequest,
  ) => Promise<ContentCollectionPage<ContentTag>>;
  loadWorkspaceCounts: (
    request: ContentAdapterWorkspaceCountsRequest,
  ) => Promise<ContentCollectionCounts>;
  loadWorkspaceSnapshot: (
    request: ContentAdapterWorkspaceSnapshotRequest,
  ) => Promise<ContentSnapshot>;
  loadWorkspace: () => Promise<ContentAdapterCapabilitySummary>;
  listPosts?: () => Promise<ContentAdapterPostListRow[]>;
  publishPost: (request: ContentAdapterPublishExecutionRequest) => Promise<ContentAdapterPost>;
  savePost: (request: ContentAdapterSavePostExecutionRequest) => Promise<ContentAdapterPost>;
  searchAuthors: (
    request: ContentAdapterRelationSearchRequest & {
      accessibleAuthorIds?: string[] | null;
    },
  ) => Promise<ContentAdapterRelationOption[]>;
  searchCategories: (
    request: ContentAdapterRelationSearchRequest,
  ) => Promise<ContentAdapterRelationOption[]>;
  searchFiles: (
    request: ContentAdapterRelationSearchRequest,
  ) => Promise<ContentAdapterRelationOption[]>;
  searchMedia: (
    request: ContentAdapterRelationSearchRequest,
  ) => Promise<ContentAdapterRelationOption[]>;
  searchParentPages: (
    request: ContentAdapterRelationSearchRequest & {
      accessibleAuthorIds?: string[] | null;
    },
  ) => Promise<ContentAdapterRelationOption[]>;
  searchTags: (
    request: ContentAdapterRelationSearchRequest,
  ) => Promise<ContentAdapterRelationOption[]>;
  updateCollectionEntry: (
    request: ContentAdapterUpdateCollectionEntryRequest,
  ) => Promise<ContentAuthor | ContentCategory | ContentTag>;
  unpublishPost: (request: ContentAdapterUnpublishExecutionRequest) => Promise<ContentAdapterPost>;
  archivePost: (request: ContentAdapterArchiveExecutionRequest) => Promise<ContentAdapterPost>;
};

type ContentRuntimeAdapterMethodName = {
  [TKey in keyof ContentRuntimeAdapter]: ContentRuntimeAdapter[TKey] extends (
    ...args: never[]
  ) => unknown
    ? TKey
    : never;
}[keyof ContentRuntimeAdapter];

export const getRequiredContentRuntimeAdapterMethod = <
  TMethodName extends ContentRuntimeAdapterMethodName,
>(
  adapter: ContentRuntimeAdapter,
  methodName: TMethodName,
) => {
  const method = adapter[methodName];

  if (typeof method !== "function") {
    throw new Error(`Mapped content adapter is missing required method "${String(methodName)}".`);
  }

  return method.bind(adapter) as Extract<
    ContentRuntimeAdapter[TMethodName],
    (...args: never[]) => unknown
  >;
};

export type ContentAdapterPostsPageRequest = {
  accessibleAuthorIds?: string[] | null;
  authorAssignmentsByAuthorId?: Map<string, { avatar_url: string | null }> | null;
  client: ContentDatabaseClient;
  cursor?: string | null;
  includeEditorOptions?: boolean;
  page?: number;
  pageSize?: number;
  projectId?: string;
  search?: string;
  sort?: ContentPostsSort;
  status?: ContentPostsStatusFilter;
  totalItems?: number;
  useWindowPagination?: boolean;
  writableAuthorIds?: string[] | null;
};

export type ContentAdapterPostEditorPayloadRequest = {
  accessibleAuthorIds?: string[] | null;
  authorAssignmentsByAuthorId?: Map<string, { avatar_url: string | null }> | null;
  client: ContentDatabaseClient;
  includeEditorOptions?: boolean;
  postId: string;
  projectId?: string;
};

export type ContentAdapterCountPostsRequest = {
  client: ContentDatabaseClient;
  search: string;
  status: ContentPostsStatusFilter;
};

export type ContentAdapterPostListAuthorsRequest = {
  client: ContentDatabaseClient;
  visibleAuthorIds: string[];
};

export type ContentAdapterLoadPostRequest = {
  client: ContentDatabaseClient;
  postId: string;
  projectId?: string;
};

export type ContentAdapterLoadPostAuthorIdRequest = {
  client: ContentDatabaseClient;
  postId: string;
  projectId?: string;
};

export type ContentAdapterPostsPreviewSnapshotRequest = {
  accessibleAuthorIds: string[] | null;
  client: ContentDatabaseClient;
  search: string;
  sort: ContentPostsSort;
  status: ContentPostsStatusFilter;
};

export type ContentAdapterPostsPreviewSnapshot = {
  posts: ContentPost[];
  totalItems: number;
};

export type ContentAdapterWorkspaceCountsRequest = {
  accessibleAuthorIds?: string[] | null;
  approximateCounts?: boolean;
  client: ContentDatabaseClient;
  postsCountOverride?: number;
};

export type ContentAdapterWorkspaceSnapshotRequest = {
  accessibleAuthorIds?: string[] | null;
  authorAssignmentsByAuthorId?: Map<string, { avatar_url: string | null }> | null;
  client: ContentDatabaseClient;
  projectId?: string;
};

export type ContentAdapterCreatePostExecutionRequest = ContentAdapterCreatePostRequest & {
  client: ContentDatabaseClient;
};

export type ContentAdapterDeletePostsRequest = {
  client: ContentDatabaseClient;
  postIds: string[];
};

export type ContentAdapterDiscardPostRequest = {
  client: ContentDatabaseClient;
  postId: string;
};

export type ContentAdapterSavePostExecutionRequest = ContentAdapterSavePostRequest & {
  client: ContentDatabaseClient;
  expectedUpdatedAt?: string | null;
};

export type ContentAdapterPublishExecutionRequest = ContentAdapterPublishRequest & {
  client: ContentDatabaseClient;
  expectedUpdatedAt?: string | null;
};

export type ContentAdapterUnpublishExecutionRequest = ContentAdapterUnpublishRequest & {
  client: ContentDatabaseClient;
  expectedUpdatedAt?: string | null;
};

export type ContentAdapterArchiveExecutionRequest = ContentAdapterArchiveRequest & {
  client: ContentDatabaseClient;
  expectedUpdatedAt?: string | null;
};

export type ContentAdapterCategoriesPageRequest = {
  client: ContentDatabaseClient;
  includeAllCategories?: boolean;
  page?: number;
  pageSize?: number;
  projectId?: string;
  search?: string;
};

export type ContentAdapterTagsPageRequest = {
  client: ContentDatabaseClient;
  page?: number;
  pageSize?: number;
  search?: string;
};

export type ContentAdapterMediaPageRequest = {
  client: ContentDatabaseClient;
  page?: number;
  pageSize?: number;
};

export type ContentAdapterAuthorsPageRequest = {
  authorAssignmentsByAuthorId?: Map<string, { avatar_url: string | null }> | null;
  client: ContentDatabaseClient;
  page?: number;
  pageSize?: number;
  search?: string;
};

export type ContentAdapterAuthorOptionsRequest = {
  client: ContentDatabaseClient;
  limit?: number;
};

export type ContentAdapterRelationSearchRequest = {
  client: ContentDatabaseClient;
  limit?: number;
  search: string;
  selectedIds?: string[];
};

type ContentAdapterCollectionEntryMutableFields = {
  bio?: string | null;
  collection: ContentCollectionEntryTable;
  description?: string | null;
  email?: string | null;
  name: string;
  parentCategoryId?: string | null;
  slug?: string | null;
};

export type ContentAdapterCreateCollectionEntryRequest =
  ContentAdapterCollectionEntryMutableFields & {
    client: ContentDatabaseClient;
  };

export type ContentAdapterUpdateCollectionEntryRequest =
  ContentAdapterCollectionEntryMutableFields & {
    client: ContentDatabaseClient;
    entryId: string;
  };

export type ContentAdapterDeleteCollectionEntriesRequest = {
  client: ContentDatabaseClient;
  collection: ContentCollectionEntryTable;
  entryIds: string[];
};

class PostgresContentRuntimeAdapter implements ContentRuntimeAdapter {
  readonly compiled: ContentCompiledAdapterMapping;
  readonly kind = "postgres_content" as const;
  private readonly errorFieldContext: ContentAdapterErrorFieldContext;

  constructor(private readonly context: ContentRuntimeAdapterContext) {
    this.compiled = compileContentProjectMappingToAdapterInstructions(context.mapping);
    this.errorFieldContext = buildContentAdapterErrorFieldContext({
      compiled: this.compiled,
      mapping: context.mapping,
    });
  }

  private rethrowNormalizedAdapterError(error: unknown): never {
    if (isContentAdapterOperationError(error)) {
      throw error;
    }

    throw createContentAdapterOperationError([
      mapContentProviderErrorToAdapterError(error, this.errorFieldContext),
    ]);
  }

  getCapabilitySummary(): ContentAdapterCapabilitySummary {
    return buildContentAdapterCapabilitySummary({
      compiled: this.compiled,
      hasFilesS3CompatibleCredentials: this.context.hasFilesS3CompatibleCredentials,
      hasS3CompatibleCredentials: this.context.hasS3CompatibleCredentials,
      mapping: this.context.mapping,
    });
  }

  async loadWorkspace() {
    return this.getCapabilitySummary();
  }

  async loadFieldSpecs() {
    return buildContentAdapterFieldSpecs({
      compiled: this.compiled,
      mapping: this.context.mapping,
    });
  }

  async loadAuthorOptions(request: ContentAdapterAuthorOptionsRequest) {
    return getMappedContentAuthorOptions({
      ...request,
      mapping: this.context.mapping,
    });
  }

  async searchAuthors({
    accessibleAuthorIds = null,
    client,
    limit = 100,
    search,
  }: ContentAdapterRelationSearchRequest & {
    accessibleAuthorIds?: string[] | null;
  }) {
    return searchContentAdapterAuthors({
      accessibleAuthorIds,
      client,
      limit,
      mapping: this.context.mapping,
      search,
    });
  }

  async searchCategories({
    client,
    limit = 100,
    search,
  }: ContentAdapterRelationSearchRequest) {
    return searchContentAdapterCategories({
      client,
      limit,
      mapping: this.context.mapping,
      search,
    });
  }

  async searchMedia({
    client,
    limit = 100,
    search,
  }: ContentAdapterRelationSearchRequest) {
    return searchContentAdapterMedia({
      client,
      limit,
      mapping: this.context.mapping,
      search,
    });
  }

  async searchFiles({
    client,
    limit = 100,
    search,
  }: ContentAdapterRelationSearchRequest) {
    return searchContentAdapterFiles({
      client,
      limit,
      mapping: this.context.mapping,
      search,
    });
  }

  async searchParentPages({
    accessibleAuthorIds = null,
    client,
    limit = 100,
    search,
  }: ContentAdapterRelationSearchRequest & {
    accessibleAuthorIds?: string[] | null;
  }) {
    return searchContentAdapterParentPages({
      accessibleAuthorIds,
      client,
      limit,
      mapping: this.context.mapping,
      search,
    });
  }

  async searchTags({
    client,
    limit = 100,
    search,
  }: ContentAdapterRelationSearchRequest) {
    return searchContentAdapterTags({
      client,
      limit,
      mapping: this.context.mapping,
      search,
    });
  }

  async createCollectionEntry(request: ContentAdapterCreateCollectionEntryRequest) {
    return createMappedContentCollectionEntry({
      ...request,
      mapping: this.context.mapping,
    });
  }

  async updateCollectionEntry(request: ContentAdapterUpdateCollectionEntryRequest) {
    return updateMappedContentCollectionEntry({
      ...request,
      mapping: this.context.mapping,
    });
  }

  async deleteCollectionEntries(request: ContentAdapterDeleteCollectionEntriesRequest) {
    return deleteMappedContentCollectionEntries({
      ...request,
      mapping: this.context.mapping,
    });
  }

  async loadAuthorsPage(request: ContentAdapterAuthorsPageRequest) {
    return getMappedContentAuthorsPage({
      ...request,
      mapping: this.context.mapping,
    });
  }

  async loadCategoriesPage(request: ContentAdapterCategoriesPageRequest) {
    return getMappedContentCategoriesPage({
      ...request,
      mapping: this.context.mapping,
    });
  }

  async loadMediaPage(request: ContentAdapterMediaPageRequest) {
    return getMappedContentMediaPage({
      ...request,
      mapping: this.context.mapping,
    });
  }

  async createPost(request: ContentAdapterCreatePostExecutionRequest) {
    try {
      return await createMappedContentPost({
        ...request,
        mapping: this.context.mapping,
      });
    } catch (error) {
      this.rethrowNormalizedAdapterError(error);
    }
  }

  async loadPost(request: ContentAdapterLoadPostRequest) {
    return getMappedContentPostById({
      ...request,
      mapping: this.context.mapping,
    });
  }

  async loadPostAuthorId(request: ContentAdapterLoadPostAuthorIdRequest) {
    return getMappedContentPostAuthorId({
      ...request,
      mapping: this.context.mapping,
    });
  }

  async countPosts(request: ContentAdapterCountPostsRequest) {
    const runtime = getMappedContentRuntime(this.context.mapping);
    const where = buildPostsWhereClause({
      posts: runtime.posts,
      search: request.search,
      status: request.status,
    });
    const result = await request.client.query<{ count: string }>(
      `select count(*)::text as count from ${getEntityTableName(runtime.posts)} ${where.clause}`,
      where.params,
    );

    return Number(result.rows[0]?.count ?? 0);
  }

  async loadPostListAuthors(request: ContentAdapterPostListAuthorsRequest) {
    if (!request.visibleAuthorIds.length) {
      return [];
    }

    const runtime = getMappedContentRuntime(this.context.mapping);

    return loadMappedContentAuthors({
      client: request.client,
      entity: runtime.authors,
      ids: request.visibleAuthorIds,
      posts: runtime.posts,
      relation: runtime.posts.relations.authors,
    });
  }

  async loadPostsPreviewSnapshot(
    request: ContentAdapterPostsPreviewSnapshotRequest,
  ): Promise<ContentAdapterPostsPreviewSnapshot> {
    const runtime = getMappedContentRuntime(this.context.mapping);
    const result = await loadMappedContentPostRows({
      accessibleAuthorIds: request.accessibleAuthorIds,
      client: request.client,
      runtime,
      search: request.search,
      sort: request.sort,
      status: request.status,
    });
    const rows = result.rows;
    const postIdColumn = getEntityIdColumn(runtime.posts) || runtime.posts.source.primaryKey;
    const authorIdsByPostId = await getMappedRelationValuesForPosts({
      client: request.client,
      entity: runtime.authors,
      postRows: rows,
      posts: runtime.posts,
      relation: runtime.posts.relations.authors,
    });
    const posts: ContentPost[] = [];

    for (const row of rows) {
      const postId = toText(getRowValue(row, postIdColumn)) ?? "";
      const authorId = authorIdsByPostId.get(postId)?.[0] ?? null;

      if (
        !result.authorScopeApplied &&
        request.accessibleAuthorIds !== null &&
        (!authorId || !request.accessibleAuthorIds.includes(authorId))
      ) {
        continue;
      }

      posts.push(
        await mapMappedContentPostListRow({
          authorId,
          client: request.client,
          postRow: row,
          runtime,
        }),
      );
    }

    return {
      posts,
      totalItems: posts.length,
    };
  }

  async loadWorkspaceCounts(request: ContentAdapterWorkspaceCountsRequest) {
    return getMappedContentWorkspaceCounts({
      ...request,
      mapping: this.context.mapping,
    });
  }

  async loadWorkspaceSnapshot(request: ContentAdapterWorkspaceSnapshotRequest) {
    return getMappedContentSnapshot({
      ...request,
      mapping: this.context.mapping,
    });
  }

  async deletePosts(request: ContentAdapterDeletePostsRequest) {
    return deleteMappedContentPosts({
      ...request,
      mapping: this.context.mapping,
    });
  }

  async discardPost(request: ContentAdapterDiscardPostRequest) {
    return discardMappedContentPost({
      ...request,
      mapping: this.context.mapping,
    });
  }

  async loadPostsPage(request: ContentAdapterPostsPageRequest) {
    return getMappedContentPostsPage({
      ...request,
      mapping: this.context.mapping,
    });
  }

  async loadPostEditorPayload(request: ContentAdapterPostEditorPayloadRequest) {
    return getMappedContentPostEditorPayload({
      ...request,
      mapping: this.context.mapping,
    });
  }

  async savePost(request: ContentAdapterSavePostExecutionRequest) {
    try {
      const sanitizedRequest = sanitizeAdapterSavePostRequest({
        compiled: this.compiled,
        mapping: this.context.mapping,
        request,
      });
      return await updateMappedContentPost({
        ...sanitizedRequest,
        mapping: this.context.mapping,
      });
    } catch (error) {
      this.rethrowNormalizedAdapterError(error);
    }
  }

  async publishPost(request: ContentAdapterPublishRequest & { client: ContentDatabaseClient }) {
    try {
      return await updateMappedContentPost({
        ...sanitizeAdapterSavePostRequest({
          compiled: this.compiled,
          forcedStatus: "published",
          mapping: this.context.mapping,
          request,
        }),
        mapping: this.context.mapping,
      });
    } catch (error) {
      this.rethrowNormalizedAdapterError(error);
    }
  }

  async unpublishPost(request: ContentAdapterUnpublishRequest & { client: ContentDatabaseClient }) {
    try {
      return await updateMappedContentPost({
        ...sanitizeAdapterSavePostRequest({
          compiled: this.compiled,
          forcedStatus: "draft",
          mapping: this.context.mapping,
          request,
        }),
        mapping: this.context.mapping,
      });
    } catch (error) {
      this.rethrowNormalizedAdapterError(error);
    }
  }

  async archivePost(request: ContentAdapterArchiveRequest & { client: ContentDatabaseClient }) {
    try {
      return await updateMappedContentPost({
        ...sanitizeAdapterSavePostRequest({
          compiled: this.compiled,
          forcedStatus: "archived",
          mapping: this.context.mapping,
          request,
        }),
        mapping: this.context.mapping,
      });
    } catch (error) {
      this.rethrowNormalizedAdapterError(error);
    }
  }

  async loadSidebarFieldSpecs() {
    return buildContentAdapterSidebarFieldSpecs({
      compiled: this.compiled,
      mapping: this.context.mapping,
    });
  }

  async loadTagsPage(request: ContentAdapterTagsPageRequest) {
    return getMappedContentTagsPage({
      ...request,
      mapping: this.context.mapping,
    });
  }
}

export const createContentRuntimeAdapter = (
  context: ContentRuntimeAdapterContext,
): ContentRuntimeAdapter => new PostgresContentRuntimeAdapter(context);
