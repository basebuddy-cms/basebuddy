import "server-only";

import type { User } from "@supabase/supabase-js";
import { cache } from "react";

import { getProductionErrorMessage } from "@/lib/errors/user-facing";
import {
  APP_SETUP_REQUIRED_MESSAGE,
  getAuthenticatedApiRequestContext,
  isControlPlaneSetupError,
} from "@/lib/control-plane/server";
import type { ProjectMemberAccess } from "@/lib/control-plane/permissions";
import { normalizeProjectMemberAuthorScopeCanPublish } from "@/lib/control-plane/members";
import { getInstallRuntimeContext } from "@/lib/self-host/install-runtime";
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

type ProjectMemberAccessRow = {
  author_scopes:
    | Array<{
        canPublish?: boolean;
        can_publish?: boolean;
        cmsAuthorId?: string;
        cms_author_id?: string;
      }>
    | null;
  permission_keys: string[] | null;
  role_keys: string[] | null;
};

export type ContentProjectContext = {
  apiUrl: string | null;
  connectionString: string | null;
  memberAccess: ProjectMemberAccess;
  publishableKey: string | null;
  projectId: string;
  projectSlug: string;
  schemaOptions: ContentSchemaOptions;
  user: User;
};

export type ContentProjectAccessSnapshot = Omit<
  ContentProjectContext,
  "apiUrl" | "connectionString" | "publishableKey"
>;

const CONTENT_PROJECT_ACCESS_CACHE_TTL_MS = 30_000;
const CONTENT_PROJECT_ACCESS_STALE_WHILE_REVALIDATE_MS = 60_000;
const CONTENT_PROJECT_CONTEXT_CACHE_TTL_MS = 15_000;
const CONTENT_PROJECT_CONTEXT_STALE_WHILE_REVALIDATE_MS = 15_000;

const normalizeProjectMemberAccess = (row: ProjectMemberAccessRow | null): ProjectMemberAccess => ({
  authorScopes: Array.isArray(row?.author_scopes)
    ? row.author_scopes
        .map((scope) => ({
          canPublish: normalizeProjectMemberAuthorScopeCanPublish(scope?.canPublish ?? scope?.can_publish),
          cmsAuthorId: String(scope?.cmsAuthorId ?? scope?.cms_author_id ?? "").trim(),
        }))
        .filter((scope) => scope.cmsAuthorId)
    : [],
  permissions: Array.isArray(row?.permission_keys)
    ? row.permission_keys.map((permission) => permission.trim()).filter(Boolean)
    : [],
  roles: Array.isArray(row?.role_keys) ? row.role_keys.map((role) => role.trim()).filter(Boolean) : [],
});

const getAuthenticatedProjectRequestContext = cache(async () => {
  const authResult = await getAuthenticatedApiRequestContext({
    ensurePreparedProfile: false,
  });

  return {
    supabase: authResult.supabase,
    user: authResult.ok ? authResult.user : null,
  };
});

const loadContentProjectAccessSnapshotUncached = async ({
  projectId,
  projectSlugHint,
  supabase,
  user,
}: {
  projectId: string;
  projectSlugHint?: string | null;
  supabase: Awaited<ReturnType<typeof getAuthenticatedProjectRequestContext>>["supabase"];
  user: User;
}): Promise<ContentProjectAccessSnapshot | null> => {
  const normalizedProjectSlugHint = projectSlugHint?.trim() || null;
  const accessPromise = supabase.rpc("get_current_project_member_access", {
    p_project_id: projectId,
  });
  const projectPromise = normalizedProjectSlugHint
    ? Promise.resolve<{ data: { slug: string } | null; error: null }>({
        data: {
          slug: normalizedProjectSlugHint,
        },
        error: null,
      })
    : supabase
          .from("basebuddy_projects")
          .select("slug")
          .eq("id", projectId)
          .maybeSingle();
  const [{ data: accessData, error: accessError }, { data: project, error: projectError }] =
    await Promise.all([accessPromise, projectPromise]);

  if (accessError) {
    if (isControlPlaneSetupError(accessError)) {
      throw new Error(APP_SETUP_REQUIRED_MESSAGE);
    }

    throw new Error(
      getProductionErrorMessage(accessError, "Could not load this project right now."),
    );
  }

  const accessRow = (Array.isArray(accessData) ? accessData[0] : accessData) as ProjectMemberAccessRow | null;

  if (!accessRow) {
    return null;
  }

  if (projectError || !project?.slug) {
    throw new Error("Could not load this project right now.");
  }

  return {
    memberAccess: normalizeProjectMemberAccess(accessRow),
    projectId,
    projectSlug: project.slug,
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
  const { supabase, user } = await getAuthenticatedProjectRequestContext();

  if (!user) {
    throw new Error("Please sign in to continue.");
  }

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
        supabase,
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
  const installRuntime = getInstallRuntimeContext();

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
