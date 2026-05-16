import {
  loadMappedContentCategories,
  loadMappedContentTags,
} from "./mapped-content-collections";
import {
  getMappedContentRuntime,
  type ContentDatabaseClient,
} from "./mapped-content-runtime-support";
import {
  getCachedProjectRuntimeValue,
  projectRuntimeCacheGroups,
} from "./server-runtime-cache";
import { getContentEditorTaxonomyCacheKey } from "./server-runtime-cache-keys";
import type { ContentPostEditorPayload } from "./shared";
import type { ContentProjectMapping } from "./mapping";

const MAPPED_CONTENT_EDITOR_TAXONOMY_CACHE_TTL_MS = 30_000;
const MAPPED_CONTENT_EDITOR_TAXONOMY_CACHE_STALE_WHILE_REVALIDATE_MS = 120_000;

export const loadMappedContentEditorTaxonomyOptions = async ({
  client,
  mapping,
  projectId,
  runtime,
}: {
  client: ContentDatabaseClient;
  mapping: ContentProjectMapping;
  projectId?: string;
  runtime: ReturnType<typeof getMappedContentRuntime>;
}): Promise<Pick<ContentPostEditorPayload, "categories" | "tags">> => {
  const loadTaxonomyOptions = async () => {
    const [categories, tags] = await Promise.all([
      loadMappedContentCategories({
        client,
        entity: runtime.categories,
        posts: runtime.posts,
        relation: runtime.posts.relations.categories,
      }),
      loadMappedContentTags({
        client,
        entity: runtime.tags,
        posts: runtime.posts,
        relation: runtime.posts.relations.tags,
      }),
    ]);

    return {
      categories,
      tags,
    };
  };

  if (!projectId) {
    return loadTaxonomyOptions();
  }

  return getCachedProjectRuntimeValue({
    cacheKey: getContentEditorTaxonomyCacheKey({
      mapping,
      projectId,
    }),
    groups: [projectRuntimeCacheGroups.taxonomyOptions],
    load: loadTaxonomyOptions,
    projectId,
    staleWhileRevalidateMs: MAPPED_CONTENT_EDITOR_TAXONOMY_CACHE_STALE_WHILE_REVALIDATE_MS,
    ttlMs: MAPPED_CONTENT_EDITOR_TAXONOMY_CACHE_TTL_MS,
  });
};
