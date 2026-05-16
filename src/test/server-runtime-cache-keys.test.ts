import { describe, expect, it } from "vitest";

import {
  getContentAccessScopeCacheSignature,
  getContentContextCacheSignature,
  getContentWorkspaceCountsCacheKey,
  getContentPostPayloadCacheKey,
  getContentProjectAccessCacheKey,
  getContentProjectContextCacheKey,
  getContentProjectCredentialsCacheKey,
  getContentPostsCountCacheKey,
  getContentPostsPageCacheKey,
  getContentPostsPresenceCacheKey,
  getContentPostsQuerySnapshotCacheKey,
  getContentRelationOptionsCacheKey,
  getContentWorkspaceMetaCacheKey,
  getContentWorkspaceSummaryCacheKey,
  getContentEditorTaxonomyCacheKey,
  getContentPostAuthorCacheKey,
  getContentPostCacheKey,
} from "@/lib/content-runtime/server-runtime-cache-keys";
import type { ContentProjectMapping } from "@/lib/content-runtime/mapping";
import type { ContentProjectContext } from "@/lib/content-runtime/server-posts-shared";

const createContext = (): ContentProjectContext =>
  ({
    connectionString: null,
    memberAccess: {
      authorScopes: [
        { cmsAuthorId: "author-b", canPublish: false },
        { cmsAuthorId: "author-a", canPublish: true },
      ],
      permissions: ["posts:write", "posts:read"],
      roles: ["owner"],
    },
    projectId: "project-1",
    projectSlug: "existing-one",
    schemaOptions: {},
    user: {
      id: "user-1",
    },
  }) as unknown as ContentProjectContext;

const createMapping = (): ContentProjectMapping =>
  ({
    bindingId: "binding-1",
    bindingMode: "mapped_content",
    bindingStatus: "ready",
    mappingConfig: {
      entities: {
        posts: {
          source: {
            kind: "table",
            primaryKey: "id",
            schema: "public",
            table: "posts",
          },
        },
      },
    },
    revisionId: "revision-1",
    revisionVersion: 4,
  }) as ContentProjectMapping;

describe("mapped runtime cache key builders", () => {
  it("builds a stable access-scope signature from sorted permissions and author scopes", () => {
    expect(
      getContentAccessScopeCacheSignature(createContext()),
    ).toBe("existing-one:posts:read,posts:write:author-a:publish,author-b:no-publish");
  });

  it("builds stable workspace and posts cache keys from the shared context signature", () => {
    const context = createContext();

    expect(getContentContextCacheSignature(context)).toBe(
      "user-1:existing-one:posts:read,posts:write:author-a:publish,author-b:no-publish",
    );
    expect(
      getContentWorkspaceMetaCacheKey({
        context,
        projectId: "project-1",
      }),
    ).toBe(
      "workspace:project-1:user-1:existing-one:posts:read,posts:write:author-a:publish,author-b:no-publish",
    );
    expect(
      getContentWorkspaceSummaryCacheKey({
        context,
        projectId: "project-1",
      }),
    ).toBe(
      "workspace-summary:project-1:user-1:existing-one:posts:read,posts:write:author-a:publish,author-b:no-publish",
    );
    expect(
      getContentPostsPresenceCacheKey({
        context,
        projectId: "project-1",
      }),
    ).toBe(
      "posts-presence:project-1:user-1:existing-one:posts:read,posts:write:author-a:publish,author-b:no-publish",
    );
    expect(
      getContentProjectAccessCacheKey({
        projectId: "project-1",
        userId: "user-1",
      }),
    ).toBe("project-access:project-1:user-1");
    expect(
      getContentProjectContextCacheKey({
        accessSignature: getContentAccessScopeCacheSignature(context),
        projectId: "project-1",
        userId: "user-1",
      }),
    ).toBe(
      "project-context:project-1:user-1:existing-one:posts:read,posts:write:author-a:publish,author-b:no-publish",
    );
    expect(getContentProjectCredentialsCacheKey("project-1")).toBe("project-credentials:project-1");
  });

  it("normalizes hot list and snapshot cache keys", () => {
    const context = createContext();

    expect(
      getContentPostsPageCacheKey({
        context,
        page: 2,
        pageSize: 20,
        projectId: "project-1",
        search: "  Draft  ",
        sort: "updated_desc",
        status: "draft",
      }),
    ).toBe(
      "posts:project-1:user-1:existing-one:posts:read,posts:write:author-a:publish,author-b:no-publish:2:20:updated_desc:draft:Draft:__offset__",
    );
    expect(
      getContentPostsCountCacheKey({
        context,
        projectId: "project-1",
        scopeKey: "posts-page",
        search: "  Draft  ",
        status: "draft",
      }),
    ).toBe(
      "posts-count:project-1:user-1:existing-one:posts:read,posts:write:author-a:publish,author-b:no-publish:posts-page:draft:Draft",
    );
    expect(
      getContentPostsQuerySnapshotCacheKey({
        cacheSignature: "scope-signature",
        projectId: "project-1",
        scopeKey: "posts-page",
        search: "  Draft  ",
        sort: "updated_desc",
        status: "draft",
      }),
    ).toBe("posts-query-snapshot:v1:project-1:scope-signature:posts-page:updated_desc:draft:draft");
    expect(
      getContentRelationOptionsCacheKey({
        context,
        fieldKey: "categories",
        limit: 20,
        projectId: "project-1",
        search: " Category 499999 ",
        selectedIds: ["3", "2", "2"],
      }),
    ).toBe(
      "relation-options:project-1:user-1:existing-one:posts:read,posts:write:author-a:publish,author-b:no-publish:categories:20:Category 499999:2,3",
    );
    expect(
      getContentWorkspaceCountsCacheKey({
        accessibleAuthorIds: ["author-b", "author-a"],
        filesStorageMode: "supabase:files-bucket",
        hasFilesStorageCredential: true,
        hasMediaStorageCredential: false,
        mappingRevisionId: "revision-1",
        mappingRevisionVersion: 4,
        mediaStorageMode: "none",
        projectId: "project-1",
      }),
    ).toBe(
      "project-1:revision-1:4:author-a,author-b:none:supabase:files-bucket:no-media-creds:files-creds",
    );
  });

  it("builds stable post-detail and mapped content per-post cache keys", () => {
    const context = createContext();
    const mapping = createMapping();

    expect(
      getContentPostPayloadCacheKey({
        context,
        includeEditorOptions: false,
        postId: " post-1 ",
        projectId: "project-1",
      }),
    ).toBe(
      "post-detail:project-1:post-1:shell:user-1:existing-one:posts:read,posts:write:author-a:publish,author-b:no-publish",
    );
    expect(
      getContentEditorTaxonomyCacheKey({
        mapping,
        projectId: "project-1",
      }),
    ).toBe("mapped-content-editor-taxonomy:v1:project-1:binding-1:revision-1:4");
    expect(
      getContentPostCacheKey({
        mapping,
        postId: " post-1 ",
        projectId: "project-1",
      }),
    ).toBe("mapped-content-post:v1:project-1:binding-1:revision-1:4:post-1");
    expect(
      getContentPostAuthorCacheKey({
        mapping,
        postId: " post-1 ",
        projectId: "project-1",
      }),
    ).toBe("mapped-content-post-author:v1:project-1:binding-1:revision-1:4:post-1");
  });
});
