import "server-only";

import { cache } from "react";

import {
  getAuthenticatedApiRequestContext,
  type AuthenticatedApiUser,
} from "@/lib/control-plane/server";
import type { ProjectMemberAccess } from "@/lib/control-plane/permissions";
import { getConfigContentRuntimeContext } from "@/lib/basebuddy-config/install";
import { getConfigProjectAccessContext } from "@/lib/basebuddy-config/projects";
import {
  getCachedProjectRuntimeValue,
  invalidateProjectRuntimeCacheGroups,
  projectRuntimeCacheGroups,
} from "./server-runtime-cache";
import {
  getContentAccessScopeCacheSignature,
  getContentProjectAccessCacheKey,
  getContentProjectContextCacheKey,
} from "./server-runtime-cache-keys";
import {
  getContentSchemaOptions,
  type ContentSchemaOptions,
} from "./shared";

export type ContentProjectContext = {
  apiUrl: string | null;
  connectionString: string | null;
  memberAccess: ProjectMemberAccess;
  publishableKey: string | null;
  projectId: string;
  projectSlug: string;
  schemaOptions: ContentSchemaOptions;
  user: AuthenticatedApiUser;
};

export type ContentProjectAccessSnapshot = Omit<
  ContentProjectContext,
  "apiUrl" | "connectionString" | "publishableKey"
>;

const CONTENT_PROJECT_ACCESS_CACHE_TTL_MS = 30_000;
const CONTENT_PROJECT_ACCESS_STALE_WHILE_REVALIDATE_MS = 60_000;
const CONTENT_PROJECT_CONTEXT_CACHE_TTL_MS = 15_000;
const CONTENT_PROJECT_CONTEXT_STALE_WHILE_REVALIDATE_MS = 15_000;

const getAuthenticatedProjectRequestContext = cache(async () => {
  const authResult = await getAuthenticatedApiRequestContext({
    ensurePreparedProfile: false,
  });

  if (!authResult.ok) {
    const errorResult = authResult as Extract<
      Awaited<ReturnType<typeof getAuthenticatedApiRequestContext>>,
      { ok: false }
    >;
    throw new Error(errorResult.errorMessage);
  }

  return {
    user: authResult.user,
  };
});

const loadContentProjectAccessSnapshotUncached = async ({
  projectId,
  projectSlugHint,
  user,
}: {
  projectId: string;
  projectSlugHint?: string | null;
  user: AuthenticatedApiUser;
}): Promise<ContentProjectAccessSnapshot | null> => {
  const normalizedProjectSlugHint = projectSlugHint?.trim() || null;
  const accessContext = await getConfigProjectAccessContext({
    projectId,
    userId: user.id,
  });

  if (!accessContext) {
    return null;
  }

  return {
    memberAccess: accessContext.memberAccess,
    projectId,
    projectSlug: normalizedProjectSlugHint ?? accessContext.project.slug,
    schemaOptions: getContentSchemaOptions(null),
    user,
  };
};

const getContentProjectAccessSnapshot = cache(async (
  projectId: string,
  options?: {
    projectSlug?: string | null;
  },
) => {
  const { user } = await getAuthenticatedProjectRequestContext();

  return getCachedProjectRuntimeValue({
    cacheKey: getContentProjectAccessCacheKey({
      projectId,
      userId: user.id,
    }),
    groups: [projectRuntimeCacheGroups.projectAccess],
    load: () =>
      loadContentProjectAccessSnapshotUncached({
        projectId,
        projectSlugHint: options?.projectSlug ?? null,
        user,
      }),
    projectId,
    staleWhileRevalidateMs: CONTENT_PROJECT_ACCESS_STALE_WHILE_REVALIDATE_MS,
    ttlMs: CONTENT_PROJECT_ACCESS_CACHE_TTL_MS,
  });
});

const resolveContentProjectContextFromAccessSnapshot = async (
  accessSnapshot: ContentProjectAccessSnapshot,
): Promise<ContentProjectContext> => {
  const installRuntime = await getConfigContentRuntimeContext();

  return {
    ...accessSnapshot,
    apiUrl: installRuntime.apiUrl,
    connectionString: installRuntime.databaseUrl,
    publishableKey: installRuntime.publishableKey,
  };
};

const loadContentProjectContext = cache(async (
  projectId: string,
  options?: {
    projectSlug?: string | null;
  },
) => {
  const accessSnapshot = await getContentProjectAccessSnapshot(projectId, options);

  if (!accessSnapshot) {
    return null;
  }

  return getCachedProjectRuntimeValue({
    cacheKey: getContentProjectContextCacheKey({
      accessSignature: getContentAccessScopeCacheSignature(accessSnapshot),
      projectId,
      userId: accessSnapshot.user.id,
    }),
    groups: [projectRuntimeCacheGroups.projectContext],
    load: () => resolveContentProjectContextFromAccessSnapshot(accessSnapshot),
    projectId,
    staleWhileRevalidateMs: CONTENT_PROJECT_CONTEXT_STALE_WHILE_REVALIDATE_MS,
    ttlMs: CONTENT_PROJECT_CONTEXT_CACHE_TTL_MS,
  });
});

export const getContentProjectContext = async (
  projectId: string,
  options?: {
    projectSlug?: string | null;
  },
) => loadContentProjectContext(projectId, options);

export const prewarmContentProjectContext = ({
  projectId,
  projectSlug,
}: {
  projectId: string;
  projectSlug?: string | null;
}) => {
  void loadContentProjectContext(projectId, {
    projectSlug,
  }).catch(() => undefined);
};

export const invalidateContentProjectContextCaches = (projectId: string) => {
  invalidateProjectRuntimeCacheGroups(projectId, [
    projectRuntimeCacheGroups.projectAccess,
    projectRuntimeCacheGroups.projectContext,
  ]);
};

export const ensureDirectConnectionForMappedRuntime = (context: ContentProjectContext) => {
  if (!context.connectionString) {
    throw new Error("Self-host runtime requires BASEBUDDY_CONTENT_DATABASE_URL.");
  }
};
