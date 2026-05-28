import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { getLocalAuthenticatedSessionFromCookies } from "@/lib/auth/local-auth";
import type { LocalAuthenticatedUser } from "@/lib/basebuddy-config/auth";
import {
  getConfigProjectForUser,
  getConfigProjectForUserBySlug,
  listConfigProjectsForUser,
  type ConfigProjectSummary,
} from "@/lib/basebuddy-config/projects";
import {
  controlPlaneRuntimeCacheGroups,
  getCachedControlPlaneRuntimeValue,
} from "@/lib/control-plane/server-runtime-cache";

import {
  getUserDisplayName,
  normalizeProjectSlug,
} from "./utils";

type ConfigProjectListResult = {
  errorMessage?: string;
  hasMoreProjects: boolean;
  projects: ConfigProjectSummary[];
  projectSearchQuery: string;
  setupRequired: boolean;
};

type ConfigProjectResult = {
  errorMessage?: string;
  project: ConfigProjectSummary | null;
  setupRequired: boolean;
};

export type AuthenticatedUserAccount = {
  avatarUrl: string | null;
  email: string | null;
  name: string;
};

export type AuthenticatedApiUser = LocalAuthenticatedUser & {
  user_metadata?: Record<string, unknown> | null;
};

export type AuthenticatedApiRequestContext =
  | {
      account: AuthenticatedUserAccount;
      ok: true;
      user: AuthenticatedApiUser;
    }
  | {
      errorMessage: string;
      ok: false;
      status: number;
      user: null;
    };

type AuthenticatedServerSession = {
  account: AuthenticatedUserAccount | null;
  user: AuthenticatedApiUser | null;
};

type ConfigAppUser = Pick<AuthenticatedApiUser, "email" | "id" | "name" | "avatarUrl"> & {
  user_metadata?: Record<string, unknown> | null;
};

type ProfileSettingsPageBootstrap = {
  avatarUrl: string | null;
  email: string | null;
  errorMessage?: string;
  name: string;
  setupRequired: boolean;
  userId: string;
};

const APP_BOOTSTRAP_TTL_MS = 30_000;
const APP_BOOTSTRAP_STALE_WHILE_REVALIDATE_MS = 30_000;
const PROJECTS_PAGE_SIZE = 48;

const loadAuthenticatedServerSession = cache(async (): Promise<AuthenticatedServerSession> => {
  const session = await getLocalAuthenticatedSessionFromCookies(await cookies());

  return {
    account: session?.account ?? null,
    user: session?.user ?? null,
  };
});

const normalizeProjectListLimit = (value: number | null | undefined) =>
  Number.isFinite(value) && value && value > 0
    ? Math.min(Math.floor(value), 100)
    : PROJECTS_PAGE_SIZE;

const normalizeProjectListSearchQuery = (value: string | null | undefined) =>
  (value ?? "")
    .trim()
    .replace(/[%(),]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80);

const getRequiredAuthenticatedUser = cache(async () => {
  const { user } = await loadAuthenticatedServerSession();

  if (!user) {
    redirect("/login");
  }

  return { user };
});

export const requireAuthenticatedUser = async () => getRequiredAuthenticatedUser();

export const getAuthenticatedUserAccount = (
  user: Partial<Pick<ConfigAppUser, "avatarUrl" | "email" | "name" | "user_metadata">>,
): AuthenticatedUserAccount => {
  const authDisplayName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : user.name ?? null;
  const authAvatarUrl =
    typeof user.user_metadata?.avatar_url === "string"
      ? user.user_metadata.avatar_url
      : typeof user.user_metadata?.picture === "string"
        ? user.user_metadata.picture
        : user.avatarUrl ?? null;
  const accountEmail = user.email ?? null;

  return {
    avatarUrl: authAvatarUrl,
    email: accountEmail,
    name: getUserDisplayName(accountEmail, authDisplayName),
  };
};

const loadOptionalAuthenticatedUserWithAccount = cache(async () => {
  const { user } = await loadAuthenticatedServerSession();

  return {
    account: user ? getAuthenticatedUserAccount(user) : null,
    user,
  };
});

export const getOptionalAuthenticatedUserWithAccount = async () => loadOptionalAuthenticatedUserWithAccount();

const getRequiredAuthenticatedUserWithAccount = cache(async () => {
  const { user } = await getRequiredAuthenticatedUser();

  return {
    account: getAuthenticatedUserAccount(user),
    user,
  };
});

export const requireAuthenticatedUserWithAccount = async () => getRequiredAuthenticatedUserWithAccount();

const loadAuthenticatedApiRequestContext = cache(async (
  _ensurePreparedProfile: boolean,
): Promise<AuthenticatedApiRequestContext> => {
  const { account, user } = await loadAuthenticatedServerSession();

  if (!user) {
    return {
      errorMessage: "Please sign in to continue.",
      ok: false,
      status: 401,
      user: null,
    };
  }

  return {
    account: account ?? getAuthenticatedUserAccount(user),
    ok: true,
    user,
  };
});

export const getAuthenticatedApiRequestContext = async (options?: {
  ensurePreparedProfile?: boolean;
}) =>
  loadAuthenticatedApiRequestContext(Boolean(options?.ensurePreparedProfile));

export const getProjectsPageBootstrap = async (options: {
  search?: string | null;
} = {}) => {
  const { account, user } = await requireAuthenticatedUserWithAccount();
  const projectSearchQuery = normalizeProjectListSearchQuery(options.search);
  const projectsResult = await getCachedControlPlaneRuntimeValue({
    cacheKey: `projects-list:${user.id}:${projectSearchQuery}`,
    getProjectIds: (value: ConfigProjectListResult) => value.projects.map((project) => project.id),
    groups: [controlPlaneRuntimeCacheGroups.projectsList],
    load: () => listProjectsForUser(user, {
      search: projectSearchQuery,
    }),
    staleWhileRevalidateMs: APP_BOOTSTRAP_STALE_WHILE_REVALIDATE_MS,
    ttlMs: APP_BOOTSTRAP_TTL_MS,
    userId: user.id,
  });

  return {
    account,
    ...projectsResult,
    user,
  };
};

export const getProjectPageBootstrapBySlug = async (projectSlug: string) => {
  const { account, user } = await requireAuthenticatedUserWithAccount();
  const projectResult = await getCachedControlPlaneRuntimeValue({
    cacheKey: `project-bootstrap:slug:${user.id}:${normalizeProjectSlug(projectSlug) || projectSlug}`,
    getProjectIds: (value: ConfigProjectResult) => (value.project ? [value.project.id] : []),
    groups: [controlPlaneRuntimeCacheGroups.projectBootstrap],
    load: () => getProjectForUserBySlug(user, projectSlug),
    staleWhileRevalidateMs: APP_BOOTSTRAP_STALE_WHILE_REVALIDATE_MS,
    ttlMs: APP_BOOTSTRAP_TTL_MS,
    userId: user.id,
  });

  return {
    account,
    ...projectResult,
    user,
  };
};

export const getProjectPageBootstrapById = async (projectId: string) => {
  const { account, user } = await requireAuthenticatedUserWithAccount();
  const projectResult = await getCachedControlPlaneRuntimeValue({
    cacheKey: `project-bootstrap:id:${user.id}:${projectId}`,
    getProjectIds: (value: ConfigProjectResult) => (value.project ? [value.project.id] : []),
    groups: [controlPlaneRuntimeCacheGroups.projectBootstrap],
    load: () => getProjectForUser(user, projectId),
    staleWhileRevalidateMs: APP_BOOTSTRAP_STALE_WHILE_REVALIDATE_MS,
    ttlMs: APP_BOOTSTRAP_TTL_MS,
    userId: user.id,
  });

  return {
    account,
    ...projectResult,
    user,
  };
};

export const listProjectsForUser = async (
  user: ConfigAppUser,
  options: {
    limit?: number;
    search?: string | null;
  } = {},
): Promise<ConfigProjectListResult> => {
  try {
    return await listConfigProjectsForUser({
      limit: normalizeProjectListLimit(options.limit),
      search: options.search,
      userId: user.id,
    });
  } catch (error) {
    const projectSearchQuery = normalizeProjectListSearchQuery(options.search);

    if (error instanceof Error && /config file does not exist/i.test(error.message)) {
      return {
        hasMoreProjects: false,
        projects: [],
        projectSearchQuery,
        setupRequired: true,
      };
    }

    return {
      errorMessage: "Could not load your projects right now.",
      hasMoreProjects: false,
      projects: [],
      projectSearchQuery,
      setupRequired: false,
    };
  }
};

export const getProjectForUser = async (
  user: ConfigAppUser,
  projectId: string,
): Promise<ConfigProjectResult> => {
  try {
    return await getConfigProjectForUser({
      projectId,
      userId: user.id,
    });
  } catch (error) {
    if (error instanceof Error && /config file does not exist/i.test(error.message)) {
      return {
        project: null,
        setupRequired: true,
      };
    }

    return {
      errorMessage: "Could not load this project right now.",
      project: null,
      setupRequired: false,
    };
  }
};

export const getProjectForUserBySlug = async (
  user: ConfigAppUser,
  projectSlug: string,
): Promise<ConfigProjectResult> => {
  try {
    return await getConfigProjectForUserBySlug({
      projectSlug,
      userId: user.id,
    });
  } catch (error) {
    if (error instanceof Error && /config file does not exist/i.test(error.message)) {
      return {
        project: null,
        setupRequired: true,
      };
    }

    return {
      errorMessage: "Could not load this project right now.",
      project: null,
      setupRequired: false,
    };
  }
};

export const getProfileSettingsPageBootstrap = async (): Promise<ProfileSettingsPageBootstrap> => {
  const { user } = await requireAuthenticatedUser();

  return getCachedControlPlaneRuntimeValue({
    cacheKey: `profile-bootstrap:${user.id}`,
    groups: [controlPlaneRuntimeCacheGroups.profileBootstrap],
    load: async () => {
      const account = getAuthenticatedUserAccount(user);

      return {
        avatarUrl: account.avatarUrl,
        email: account.email,
        name: account.name,
        setupRequired: false,
        userId: user.id,
      } satisfies ProfileSettingsPageBootstrap;
    },
    staleWhileRevalidateMs: APP_BOOTSTRAP_STALE_WHILE_REVALIDATE_MS,
    ttlMs: APP_BOOTSTRAP_TTL_MS,
    userId: user.id,
  });
};
