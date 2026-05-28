import "server-only";

import type { Client } from "pg";

import {
  buildContentStorageObjectsQuery,
} from "./adapter/query-builders";
import { createConnectedProjectStorageClient } from "./adapter/storage-clients";
import { getProductionErrorMessage } from "@/lib/errors/user-facing";
import {
  type ContentStorageObjectRecord,
  normalizeContentMediaPath,
} from "./media-library";
import type { ContentProjectMapping } from "./mapping";
import type { ContentProjectContext } from "./server-project-context";
import { normalizeGeneratedContentTimestamp } from "./server-project-schema-support";

type ContentDatabaseClient = Pick<Client, "query">;

type ContentStorageObjectRow = {
  created_at: Date | string;
  id: string;
  metadata: Record<string, unknown> | null;
  name: string;
  updated_at: Date | string | null;
};

type WithContentDatabaseClient = <T>(
  connectionString: string,
  handler: (client: ContentDatabaseClient) => Promise<T>,
) => Promise<T>;

export type ConnectedProjectStorageClient = ReturnType<
  typeof createConnectedProjectStorageClient
>;

export { createConnectedProjectStorageClient };

const CONTENT_MEDIA_SIGNED_URL_TTL_SECONDS = 60 * 60;
const CONTENT_STORAGE_BUCKET_VISIBILITY_CACHE_TTL_MS = 60_000;

const contentStorageBucketVisibilityCache = new Map<
  string,
  {
    expiresAt: number;
    isPublic: boolean;
  }
>();

export const ensureContentMediaApiAccess = (context: ContentProjectContext) => {
  if (!context.apiUrl?.trim()) {
    throw new Error("This project does not have the API credentials required for media browsing.");
  }
};

export const getMappedContentSupabaseMediaBucketName = (
  mapping: ContentProjectMapping,
) => {
  const mediaStorage = mapping.mappingConfig.mediaStorage;

  if (mediaStorage?.provider !== "supabase_bucket") {
    return null;
  }

  return mediaStorage.bucketName?.trim() || null;
};

export const getMappedContentSupabaseFilesBucketName = (
  mapping: ContentProjectMapping,
) => {
  const filesStorage = mapping.mappingConfig.filesStorage;

  if (filesStorage?.provider !== "supabase_bucket") {
    return null;
  }

  return filesStorage.bucketName?.trim() || null;
};

export const getContentStorageBucketIsPublic = async ({
  bucketName,
  connectionString,
  withContentDatabaseClient,
}: {
  bucketName: string;
  connectionString: string;
  withContentDatabaseClient: WithContentDatabaseClient;
}) => {
  const cacheKey = `${connectionString}|${bucketName}`;
  const cached = contentStorageBucketVisibilityCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.isPublic;
  }

  const isPublic = await withContentDatabaseClient(connectionString, async (client) => {
    const result = await client.query<{ public: boolean | null }>(
      `
        select public
        from storage.buckets
        where id = $1
        limit 1
      `,
      [bucketName],
    );

    return result.rows[0]?.public === true;
  });

  contentStorageBucketVisibilityCache.set(cacheKey, {
    expiresAt: Date.now() + CONTENT_STORAGE_BUCKET_VISIBILITY_CACHE_TTL_MS,
    isPublic,
  });
  return isPublic;
};

const buildSupabasePublicMediaUrl = ({
  apiUrl,
  bucketName,
  objectPath,
}: {
  apiUrl: string;
  bucketName: string;
  objectPath: string;
}) => {
  const normalizedPath = objectPath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return new URL(
    `/storage/v1/object/public/${encodeURIComponent(bucketName)}/${normalizedPath}`,
    apiUrl,
  ).toString();
};

export const getContentMediaObjects = async ({
  bucketName,
  connectionString,
  currentPath,
  cursor,
  limit,
  search,
  withContentDatabaseClient,
}: {
  bucketName: string;
  connectionString: string;
  currentPath?: string | null;
  cursor?: string | null;
  limit?: number;
  search?: string | null;
  withContentDatabaseClient: WithContentDatabaseClient;
}) =>
  withContentDatabaseClient(connectionString, async (client) => {
    const params: unknown[] = [bucketName];
    const normalizedPath = normalizeContentMediaPath(currentPath);
    const normalizedCursor = cursor?.trim() ?? "";
    const normalizedSearch = search?.trim() ?? "";
    const normalizedLimit =
      Number.isFinite(limit) && limit ? Math.max(1, Math.min(250, Math.floor(limit))) : 250;
    const prefixParamIndex = normalizedPath ? params.push(`${normalizedPath}/`) : null;
    const searchParamIndex = normalizedSearch ? params.push(normalizedSearch) : null;
    const cursorParamIndex = normalizedCursor ? params.push(normalizedCursor) : null;
    const limitParamIndex = params.push(normalizedLimit);
    const result = await client.query<ContentStorageObjectRow>(
      buildContentStorageObjectsQuery({
        cursorParamIndex,
        limitParamIndex,
        prefixParamIndex,
        searchParamIndex,
      }),
      params,
    );

    return result.rows.map(
      (row) =>
        ({
          createdAt: normalizeGeneratedContentTimestamp(row.created_at) ?? new Date(0).toISOString(),
          id: row.id,
          metadata: row.metadata,
          objectPath: row.name,
          updatedAt: normalizeGeneratedContentTimestamp(row.updated_at),
        }) satisfies ContentStorageObjectRecord,
    );
  });

export const getContentMediaFolderPaths = async ({
  bucketName,
  connectionString,
  currentPath,
  limit,
  withContentDatabaseClient,
}: {
  bucketName: string;
  connectionString: string;
  currentPath?: string | null;
  limit?: number;
  withContentDatabaseClient: WithContentDatabaseClient;
}) =>
  withContentDatabaseClient(connectionString, async (client) => {
    const normalizedPath = normalizeContentMediaPath(currentPath);
    const normalizedPrefix = normalizedPath ? `${normalizedPath}/` : "";
    const normalizedLimit =
      Number.isFinite(limit) && limit ? Math.max(1, Math.min(200, Math.floor(limit))) : 200;
    const result = await client.query<{ folder_path: string | null }>(
      `
        with recursive immediate_folders(folder_path, next_lower_bound) as (
          select
            first_folder.folder_path,
            first_folder.folder_path || '0'
          from lateral (
            select
              case
                when $2::text = '' then split_part(substring(name from char_length($2::text) + 1), '/', 1)
                else trim(trailing '/' from $2::text) || '/' || split_part(substring(name from char_length($2::text) + 1), '/', 1)
              end as folder_path
            from storage.objects
            where bucket_id = $1
              and ($2::text = '' or name like $2::text || '%')
              and substring(name from char_length($2::text) + 1) like '%/%'
              and split_part(substring(name from char_length($2::text) + 1), '/', 1) <> ''
            order by name
            limit 1
          ) as first_folder

          union all

          select
            next_folder.folder_path,
            next_folder.folder_path || '0'
          from immediate_folders
          cross join lateral (
            select
              case
                when $2::text = '' then split_part(substring(name from char_length($2::text) + 1), '/', 1)
                else trim(trailing '/' from $2::text) || '/' || split_part(substring(name from char_length($2::text) + 1), '/', 1)
              end as folder_path
            from storage.objects
            where bucket_id = $1
              and ($2::text = '' or name like $2::text || '%')
              and name >= immediate_folders.next_lower_bound
              and substring(name from char_length($2::text) + 1) like '%/%'
              and split_part(substring(name from char_length($2::text) + 1), '/', 1) <> ''
            order by name
            limit 1
          ) as next_folder
          where immediate_folders.folder_path is not null
        )
        select folder_path
        from immediate_folders
        order by folder_path
        limit $3
      `,
      [bucketName, normalizedPrefix, normalizedLimit],
    );

    return result.rows
      .map((row) => normalizeContentMediaPath(row.folder_path))
      .filter(Boolean);
  });

export const getContentMediaSignedUrlExpiresAt = () =>
  new Date(Date.now() + CONTENT_MEDIA_SIGNED_URL_TTL_SECONDS * 1000).toISOString();

const getSignedContentMediaUrls = async ({
  bucketName,
  objectPaths,
  storage,
}: {
  bucketName: string;
  objectPaths: string[];
  storage: ConnectedProjectStorageClient;
}) => {
  const uniqueObjectPaths = [...new Set(objectPaths.map((value) => value.trim()).filter(Boolean))];

  if (!uniqueObjectPaths.length) {
    return new Map<string, string>();
  }

  const { data, error } = await storage.storage
    .from(bucketName)
    .createSignedUrls(uniqueObjectPaths, CONTENT_MEDIA_SIGNED_URL_TTL_SECONDS);

  if (error) {
    throw new Error(getProductionErrorMessage(error, "Could not generate secure media URLs right now."));
  }

  return new Map(
    (data ?? [])
      .filter((entry) => Boolean(entry?.path && entry?.signedUrl))
      .map((entry) => [entry.path as string, entry.signedUrl as string]),
  );
};

export const getContentMediaUrls = async ({
  apiUrl,
  bucketName,
  objectPaths,
  storage,
  usePublicObjectUrls,
}: {
  apiUrl: string;
  bucketName: string;
  objectPaths: string[];
  storage: ConnectedProjectStorageClient | null;
  usePublicObjectUrls: boolean;
}) => {
  const uniqueObjectPaths = [...new Set(objectPaths.map((value) => value.trim()).filter(Boolean))];

  if (!uniqueObjectPaths.length) {
    return new Map<string, string>();
  }

  if (usePublicObjectUrls) {
    return new Map(
      uniqueObjectPaths.map((objectPath) => [
        objectPath,
        buildSupabasePublicMediaUrl({
          apiUrl,
          bucketName,
          objectPath,
        }),
      ]),
    );
  }

  if (storage) {
    return getSignedContentMediaUrls({
      bucketName,
      objectPaths: uniqueObjectPaths,
      storage,
    });
  }

  throw new Error(
    "Could not browse this private storage library. Check media storage and try again.",
  );
};

export const removeContentMediaObjectPaths = async ({
  bucketName,
  objectPaths,
  storage,
}: {
  bucketName: string;
  objectPaths: string[];
  storage: ConnectedProjectStorageClient;
}) => {
  for (let index = 0; index < objectPaths.length; index += 100) {
    const batch = objectPaths.slice(index, index + 100);
    const { error } = await storage.storage.from(bucketName).remove(batch);

    if (error) {
      throw new Error(getProductionErrorMessage(error, "Could not delete those media items right now."));
    }
  }
};
