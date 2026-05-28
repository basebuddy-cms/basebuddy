import "server-only";

import crypto from "node:crypto";

import type { Client } from "pg";

import type { ProjectMemberAccess } from "@/lib/control-plane/permissions";
import type { AuthenticatedApiUser } from "@/lib/control-plane/server";

import {
  buildGeneratedContentInsertPostRevisionQuery,
  buildGeneratedContentNextPostRevisionNumberQuery,
} from "./adapter/generated-query-builders";
import {
  supportsContentFormatAwareSchema,
  type ContentPost,
  type ContentPostRevision,
} from "./shared";
import { getGeneratedContentTables } from "./server-project-schema-support";

type ContentDatabaseClient = Pick<Client, "query">;

type ContentPostRevisionContext = {
  connectionString: string | null;
  memberAccess: ProjectMemberAccess;
  projectSlug: string;
  schemaOptions: {
    enableRevisions: boolean;
  };
  user: AuthenticatedApiUser;
};

type RevisionDependencies = {
  getProjectContext: (projectId: string) => Promise<ContentPostRevisionContext | null>;
};

const SELF_HOST_REVISIONS_UNSUPPORTED_MESSAGE =
  "Post revisions are not supported for this project yet.";

export const insertPostRevision = async ({
  client,
  post,
  projectSlug,
  schemaVersion,
  user,
}: {
  client: ContentDatabaseClient;
  post: ContentPost;
  projectSlug: string;
  schemaVersion: number | null | undefined;
  user: AuthenticatedApiUser;
}) => {
  const tables = getGeneratedContentTables(projectSlug);
  const supportsFormatAwareSchema = supportsContentFormatAwareSchema(schemaVersion);
  const nextRevisionResult = await client.query<{ next_revision: number }>(
    buildGeneratedContentNextPostRevisionNumberQuery({
      tableName: tables.postRevisions,
    }),
    [post.id],
  );

  const nextRevisionNumber = nextRevisionResult.rows[0]?.next_revision ?? 1;

  if (supportsFormatAwareSchema) {
    await client.query(
      buildGeneratedContentInsertPostRevisionQuery({
        supportsFormatAwareSchema,
        tables,
      }),
      [
        crypto.randomUUID(),
        post.id,
        nextRevisionNumber,
        user.id,
        user.email ?? null,
        post.title,
        post.slug,
        post.status,
        post.excerpt,
        post.contentFormat,
        JSON.stringify(post.contentJson),
        post.contentMarkdown,
        post.contentHtml,
        post.seoTitle,
        post.seoDescription,
        post.focusKeyword,
        post.featuredImageUrl,
        post.publishedAt,
      ],
    );
    return;
  }

  await client.query(
    buildGeneratedContentInsertPostRevisionQuery({
      supportsFormatAwareSchema,
      tables,
    }),
    [
      crypto.randomUUID(),
      post.id,
      nextRevisionNumber,
      user.id,
      user.email ?? null,
      post.title,
      post.slug,
      post.status,
      post.excerpt,
      JSON.stringify(post.contentJson),
      post.contentHtml,
      post.seoTitle,
      post.seoDescription,
      post.focusKeyword,
      post.featuredImageUrl,
      post.publishedAt,
    ],
  );
};

export const getContentPostRevisions = async ({
  dependencies,
  limit = 20,
  postId,
  projectId,
}: {
  dependencies: RevisionDependencies;
  limit?: number;
  postId: string;
  projectId: string;
}): Promise<ContentPostRevision[]> => {
  const context = await dependencies.getProjectContext(projectId);
  void limit;
  void postId;

  if (!context) {
    throw new Error("Could not load this project right now.");
  }

  throw new Error(SELF_HOST_REVISIONS_UNSUPPORTED_MESSAGE);
};

export const restoreContentPostRevision = async ({
  dependencies,
  postId,
  projectId,
  revisionNumber,
}: {
  dependencies: RevisionDependencies;
  postId: string;
  projectId: string;
  revisionNumber: number;
}) => {
  const context = await dependencies.getProjectContext(projectId);
  void postId;
  void revisionNumber;

  if (!context) {
    throw new Error("Could not load this project right now.");
  }

  throw new Error(SELF_HOST_REVISIONS_UNSUPPORTED_MESSAGE);
};
