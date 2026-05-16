import {
  getEntityIdColumn,
  getEntityTableName,
  getMappedContentRuntime,
  type ContentDatabaseClient,
} from "./mapped-content-runtime-support";
import { buildContentDeleteEntityByIdQuery } from "./adapter/query-builders";
import { applyMappedRelationWrite } from "./mapped-content-post-support";
import type { ContentProjectMapping } from "./mapping";

const deleteMappedContentPostRecord = async ({
  client,
  mapping,
  missingMessage,
  postId,
}: {
  client: ContentDatabaseClient;
  mapping: ContentProjectMapping;
  missingMessage: string;
  postId: string;
}) => {
  const runtime = getMappedContentRuntime(mapping);
  const posts = runtime.posts;

  if (runtime.categories) {
    await applyMappedRelationWrite({
      client,
      entity: runtime.categories,
      ids: [],
      postId,
      posts,
      relation: posts.relations.categories,
    });
  }

  if (runtime.tags) {
    await applyMappedRelationWrite({
      client,
      entity: runtime.tags,
      ids: [],
      postId,
      posts,
      relation: posts.relations.tags,
    });
  }

  const tableName = getEntityTableName(posts);
  const postIdColumn = getEntityIdColumn(posts) || posts.source.primaryKey;

  if (!postIdColumn) {
    throw new Error("Posts setup is missing a stable ID field.");
  }

  const result = await client.query(
    buildContentDeleteEntityByIdQuery({
      idColumn: postIdColumn,
      tableName,
    }),
    [postId],
  );

  if (!result.rowCount) {
    throw new Error(missingMessage);
  }
};

export const discardMappedContentPost = async ({
  client,
  mapping,
  postId,
}: {
  client: ContentDatabaseClient;
  mapping: ContentProjectMapping;
  postId: string;
}) => {
  const runtime = getMappedContentRuntime(mapping);
  const posts = runtime.posts;

  if (posts.source.kind !== "table") {
    throw new Error("This posts setup is read-only. Choose an editable posts source before discarding posts.");
  }

  const postIdColumn = getEntityIdColumn(posts) || posts.source.primaryKey;

  if (!postIdColumn) {
    throw new Error("Posts setup is missing a stable ID field.");
  }

  await client.query("begin");

  try {
    await deleteMappedContentPostRecord({
      client,
      mapping,
      missingMessage: "Could not find that post in this project.",
      postId,
    });
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
};

export const deleteMappedContentPosts = async ({
  client,
  mapping,
  postIds,
}: {
  client: ContentDatabaseClient;
  mapping: ContentProjectMapping;
  postIds: string[];
}) => {
  const runtime = getMappedContentRuntime(mapping);
  const posts = runtime.posts;

  if (posts.source.kind !== "table") {
    throw new Error("This posts setup is read-only. Choose an editable posts source before deleting posts.");
  }

  const postIdColumn = getEntityIdColumn(posts) || posts.source.primaryKey;

  if (!postIdColumn) {
    throw new Error("Posts setup is missing a stable ID field.");
  }

  const normalizedPostIds = Array.from(new Set(postIds.map((candidatePostId) => candidatePostId.trim()).filter(Boolean)));

  if (!normalizedPostIds.length) {
    return;
  }

  await client.query("begin");

  try {
    for (const normalizedPostId of normalizedPostIds) {
      await deleteMappedContentPostRecord({
        client,
        mapping,
        missingMessage:
          normalizedPostIds.length === 1
            ? "Could not find that post in this project."
            : "Could not find one or more selected posts in this project.",
        postId: normalizedPostId,
      });
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
};
