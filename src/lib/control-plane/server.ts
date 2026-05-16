import type { User } from "@supabase/supabase-js";
import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  controlPlaneRuntimeCacheGroups,
  getCachedControlPlaneRuntimeValue,
} from "@/lib/control-plane/server-runtime-cache";

import {
  getHighestProjectRole,
  getUserDisplayName,
  normalizeProjectSlug,
  type ProjectRole,
} from "./utils";

export type ControlPlaneProject = {
  id: string;
  name: string;
  slug: string;
  websiteUrl: string | null;
  createdAt: string;
  role: ProjectRole;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type SupabaseErrorLike = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

type ControlPlaneListResult = {
  errorMessage?: string;
  hasMoreProjects: boolean;
  projects: ControlPlaneProject[];
  projectSearchQuery: string;
  setupRequired: boolean;
};

type ControlPlaneProjectResult = {
  errorMessage?: string;
  project: ControlPlaneProject | null;
  setupRequired: boolean;
};

export type AuthenticatedUserAccount = {
  avatarUrl: string | null;
  email: string | null;
  name: string;
};

export type AuthenticatedApiRequestContext =
  | {
      account: AuthenticatedUserAccount;
      ok: true;
      supabase: SupabaseServerClient;
      user: User;
    }
  | {
      errorMessage: string;
      ok: false;
      status: number;
      supabase: SupabaseServerClient;
      user: null;
    };

type AuthenticatedServerSession = {
  supabase: SupabaseServerClient;
  user: User | null;
};

type ControlPlaneProjectRow = {
  created_at: string;
  id: string;
  name: string;
  slug: string;
  website_url?: string | null;
};

type ControlPlaneProjectMembershipRow = {
  role_key: string;
  projects?: ControlPlaneProjectRow | ControlPlaneProjectRow[] | null;
};

type ProfileSettingsPageBootstrap = {
  avatarUrl: string | null;
  email: string | null;
  errorMessage?: string;
  name: string;
  setupRequired: boolean;
};

const APP_BOOTSTRAP_TTL_MS = 30_000;
const APP_BOOTSTRAP_STALE_WHILE_REVALIDATE_MS = 30_000;
const PROJECT_MEMBERSHIP_EMPTY_RETRY_DELAY_MS = 250;
const PROJECTS_PAGE_SIZE = 48;
const PROJECT_LIST_ROLE_ROW_MULTIPLIER = 5;

const APP_SETUP_ERROR_CODES = new Set(["42P01", "42703", "42883", "PGRST200", "PGRST202", "PGRST205"]);

export const APP_SETUP_REQUIRED_MESSAGE =
  "BaseBuddy setup is incomplete. Open setup to review the app configuration, content connection, sign-in, and upload storage.";

export const isControlPlaneSetupError = (error: SupabaseErrorLike | null | undefined) =>
  Boolean(
    (error?.code && APP_SETUP_ERROR_CODES.has(error.code)) ||
      /(schema cache|relation .* does not exist|column .* does not exist|function .* does not exist)/i.test(
        [error?.message, error?.details, error?.hint].filter(Boolean).join(" "),
      ),
  );

export const isUniqueViolationError = (error: SupabaseErrorLike | null | undefined) =>
  error?.code === "23505";

const loadAuthenticatedServerSession = cache(async (): Promise<AuthenticatedServerSession> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    supabase,
    user,
  };
});

const normalizeControlPlaneProjectMembershipProject = (
  value: ControlPlaneProjectMembershipRow["projects"],
) => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

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

const waitForProjectMembershipRetry = (delayMs: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

const listProjectMembershipsWithProjects = async ({
  limit,
  projectId,
  projectSlug,
  search,
  supabase,
  userId,
}: {
  limit?: number;
  projectId?: string;
  projectSlug?: string;
  search?: string;
  supabase: SupabaseServerClient;
  userId: string;
}) => {
  const buildMembershipProjectsQuery = (
    selectClause: string,
  ) => {
    let query = supabase
      .from("basebuddy_project_member_roles")
      .select(selectClause)
      .eq("user_id", userId);

    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    if (projectSlug) {
      query = query.eq("projects.slug", projectSlug);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`, {
        referencedTable: "projects",
      });
    }

    if (limit) {
      query = query
        .order("created_at", {
          ascending: false,
          referencedTable: "projects",
        })
        .limit(limit);
    }

    return query;
  };

  const result = await buildMembershipProjectsQuery(
    "role_key, projects:basebuddy_projects!inner(id, name, slug, website_url, created_at)",
  );

  return result as {
    data: ControlPlaneProjectMembershipRow[] | null;
    error: SupabaseErrorLike | null;
  };
};

const listProjectMembershipsWithProjectsRetryingEmpty = async ({
  projectId,
  projectSlug,
  supabase,
  userId,
}: {
  projectId?: string;
  projectSlug?: string;
  supabase: SupabaseServerClient;
  userId: string;
}) => {
  const firstResult = await listProjectMembershipsWithProjects({
    projectId,
    projectSlug,
    supabase,
    userId,
  });

  if (firstResult.error || (firstResult.data?.length ?? 0) > 0 || (!projectId && !projectSlug)) {
    return firstResult;
  }

  await waitForProjectMembershipRetry(PROJECT_MEMBERSHIP_EMPTY_RETRY_DELAY_MS);

  return listProjectMembershipsWithProjects({
    projectId,
    projectSlug,
    supabase,
    userId,
  });
};

const getRequiredAuthenticatedUser = cache(async () => {
  const { supabase, user } = await loadAuthenticatedServerSession();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
});

export const requireAuthenticatedUser = async () => getRequiredAuthenticatedUser();

export const getAuthenticatedUserAccount = (user: Pick<User, "email" | "user_metadata">): AuthenticatedUserAccount => {
  const authDisplayName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : null;
  const authAvatarUrl =
    typeof user.user_metadata?.avatar_url === "string"
      ? user.user_metadata.avatar_url
      : typeof user.user_metadata?.picture === "string"
        ? user.user_metadata.picture
        : null;
  const accountEmail = user.email ?? null;

  return {
    avatarUrl: authAvatarUrl,
    email: accountEmail,
    name: getUserDisplayName(accountEmail, authDisplayName),
  };
};

const loadOptionalAuthenticatedUserWithAccount = cache(async () => {
  const { supabase, user } = await loadAuthenticatedServerSession();

  return {
    account: user ? getAuthenticatedUserAccount(user) : null,
    supabase,
    user,
  };
});

export const getOptionalAuthenticatedUserWithAccount = async () => loadOptionalAuthenticatedUserWithAccount();

const getRequiredAuthenticatedUserWithAccount = cache(async () => {
  const { supabase, user } = await getRequiredAuthenticatedUser();

  return {
    account: getAuthenticatedUserAccount(user),
    supabase,
    user,
  };
});

export const requireAuthenticatedUserWithAccount = async () => getRequiredAuthenticatedUserWithAccount();

const loadAuthenticatedApiRequestContext = cache(async (
  ensurePreparedProfile: boolean,
): Promise<AuthenticatedApiRequestContext> => {
  const { supabase, user } = await loadAuthenticatedServerSession();

  if (!user) {
    return {
      errorMessage: "Please sign in to continue.",
      ok: false,
      status: 401,
      supabase,
      user: null,
    };
  }

  if (ensurePreparedProfile) {
    const profileResult = await ensureProfile(supabase, user);

    if (profileResult.setupRequired) {
      return {
        errorMessage: APP_SETUP_REQUIRED_MESSAGE,
        ok: false,
        status: 500,
        supabase,
        user: null,
      };
    }

    if (profileResult.error) {
      return {
        errorMessage: "Could not prepare your account right now.",
        ok: false,
        status: 500,
        supabase,
        user: null,
      };
    }
  }

  return {
    account: getAuthenticatedUserAccount(user),
    ok: true,
    supabase,
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
  const { account, supabase, user } = await requireAuthenticatedUserWithAccount();
  const projectSearchQuery = normalizeProjectListSearchQuery(options.search);
  const projectsResult = await getCachedControlPlaneRuntimeValue({
    cacheKey: `projects-list:${user.id}:${projectSearchQuery}`,
    getProjectIds: (value: ControlPlaneListResult) => value.projects.map((project) => project.id),
    groups: [controlPlaneRuntimeCacheGroups.projectsList],
    load: () => listProjectsForUser(supabase, user, {
      search: projectSearchQuery,
    }),
    staleWhileRevalidateMs: APP_BOOTSTRAP_STALE_WHILE_REVALIDATE_MS,
    ttlMs: APP_BOOTSTRAP_TTL_MS,
    userId: user.id,
  });

  return {
    account,
    ...projectsResult,
    supabase,
    user,
  };
};

export const getProjectPageBootstrapBySlug = async (projectSlug: string) => {
  const { account, supabase, user } = await requireAuthenticatedUserWithAccount();
  const projectResult = await getCachedControlPlaneRuntimeValue({
    cacheKey: `project-bootstrap:slug:${user.id}:${normalizeProjectSlug(projectSlug) || projectSlug}`,
    getProjectIds: (value: ControlPlaneProjectResult) => (value.project ? [value.project.id] : []),
    groups: [controlPlaneRuntimeCacheGroups.projectBootstrap],
    load: () => getProjectForUserBySlug(supabase, user, projectSlug),
    staleWhileRevalidateMs: APP_BOOTSTRAP_STALE_WHILE_REVALIDATE_MS,
    ttlMs: APP_BOOTSTRAP_TTL_MS,
    userId: user.id,
  });

  return {
    account,
    ...projectResult,
    supabase,
    user,
  };
};

export const getProjectPageBootstrapById = async (projectId: string) => {
  const { account, supabase, user } = await requireAuthenticatedUserWithAccount();
  const projectResult = await getCachedControlPlaneRuntimeValue({
    cacheKey: `project-bootstrap:id:${user.id}:${projectId}`,
    getProjectIds: (value: ControlPlaneProjectResult) => (value.project ? [value.project.id] : []),
    groups: [controlPlaneRuntimeCacheGroups.projectBootstrap],
    load: () => getProjectForUser(supabase, user, projectId),
    staleWhileRevalidateMs: APP_BOOTSTRAP_STALE_WHILE_REVALIDATE_MS,
    ttlMs: APP_BOOTSTRAP_TTL_MS,
    userId: user.id,
  });

  return {
    account,
    ...projectResult,
    supabase,
    user,
  };
};

export const ensureProfile = async (supabase: SupabaseServerClient, user: User) => {
  const authDisplayName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : null;
  const authAvatarUrl =
    typeof user.user_metadata?.avatar_url === "string"
      ? user.user_metadata.avatar_url
      : typeof user.user_metadata?.picture === "string"
        ? user.user_metadata.picture
        : null;
  const { error } = await supabase.from("basebuddy_profiles").upsert(
    {
      id: user.id,
      email: user.email ?? null,
    },
    {
      onConflict: "id",
    },
  );

  if (!error) {
    return { error: null, setupRequired: false };
  }

  if (isControlPlaneSetupError(error)) {
    return { error: null, setupRequired: true };
  }

  if (error) {
    return { error, setupRequired: false };
  }

  if (authDisplayName || authAvatarUrl) {
    const { data: profile, error: profileError } = await supabase
      .from("basebuddy_profiles")
      .select("name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      if (isControlPlaneSetupError(profileError)) {
        return { error: null, setupRequired: true };
      }

      return { error: profileError, setupRequired: false };
    }

    const updates: {
      avatar_url?: string | null;
      name?: string | null;
    } = {};

    if (authDisplayName && !profile?.name?.trim()) {
      updates.name = authDisplayName;
    }

    if (authAvatarUrl && !profile?.avatar_url?.trim()) {
      updates.avatar_url = authAvatarUrl;
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase.from("basebuddy_profiles").update(updates).eq("id", user.id);

      if (updateError) {
        if (isControlPlaneSetupError(updateError)) {
          return { error: null, setupRequired: true };
        }

        return { error: updateError, setupRequired: false };
      }
    }
  }

  return { error: null, setupRequired: false };
};

const getProjectRoleByProjectId = (
  roles: Array<{
    project_id: string;
    role_key: string;
  }>,
) => {
  const roleKeysByProjectId = new Map<string, string[]>();

  for (const role of roles) {
    const projectRoles = roleKeysByProjectId.get(role.project_id);

    if (projectRoles) {
      projectRoles.push(role.role_key);
      continue;
    }

    roleKeysByProjectId.set(role.project_id, [role.role_key]);
  }

  const roleByProjectId = new Map<string, ProjectRole>();

  for (const [projectId, roleKeys] of roleKeysByProjectId) {
    const highestRole = getHighestProjectRole(roleKeys);

    if (highestRole) {
      roleByProjectId.set(projectId, highestRole);
    }
  }

  return roleByProjectId;
};

export const listProjectsForUser = async (
  supabase: SupabaseServerClient,
  user: User,
  options: {
    limit?: number;
    search?: string | null;
  } = {},
): Promise<ControlPlaneListResult> => {
  const projectLimit = normalizeProjectListLimit(options.limit);
  const projectSearchQuery = normalizeProjectListSearchQuery(options.search);
  const membershipRowLimit = projectLimit * PROJECT_LIST_ROLE_ROW_MULTIPLIER + 1;
  const profileResult = await ensureProfile(supabase, user);

  if (profileResult.setupRequired) {
    return {
      hasMoreProjects: false,
      projects: [],
      projectSearchQuery,
      setupRequired: true,
    };
  }

  if (profileResult.error) {
    return {
      errorMessage: "Could not load your profile right now.",
      hasMoreProjects: false,
      projects: [],
      projectSearchQuery,
      setupRequired: false,
    };
  }

  const { data: memberships, error: membershipsError } = await listProjectMembershipsWithProjects({
    limit: membershipRowLimit,
    search: projectSearchQuery,
    supabase,
    userId: user.id,
  });

  if (membershipsError) {
    if (isControlPlaneSetupError(membershipsError)) {
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

  if (!memberships.length) {
    return {
      hasMoreProjects: false,
      projects: [],
      projectSearchQuery,
      setupRequired: false,
    };
  }

  const roleByProjectId = getProjectRoleByProjectId(
    memberships.flatMap((membership) => {
      const project = normalizeControlPlaneProjectMembershipProject(membership.projects);

      return project
        ? [
            {
              project_id: project.id,
              role_key: membership.role_key,
            },
          ]
        : [];
    }),
  );
  const projectsById = new Map<string, ControlPlaneProjectRow>();

  memberships.forEach((membership) => {
    const project = normalizeControlPlaneProjectMembershipProject(membership.projects);

    if (!project || projectsById.has(project.id)) {
      return;
    }

    projectsById.set(project.id, project);
  });

  const projects = Array.from(projectsById.values()).sort((left, right) =>
    right.created_at.localeCompare(left.created_at),
  );
  const visibleProjects = projects.slice(0, projectLimit);

  return {
    hasMoreProjects: memberships.length >= membershipRowLimit || projects.length > visibleProjects.length,
    projects: visibleProjects.map((project) => ({
      id: project.id,
      name: project.name,
      slug: project.slug,
      websiteUrl: project.website_url ?? null,
      createdAt: project.created_at,
      role: roleByProjectId.get(project.id) ?? "viewer",
    })),
    projectSearchQuery,
    setupRequired: false,
  };
};

export const getProjectForUser = async (
  supabase: SupabaseServerClient,
  user: User,
  projectId: string,
): Promise<ControlPlaneProjectResult> => {
  const profileResult = await ensureProfile(supabase, user);

  if (profileResult.setupRequired) {
    return {
      project: null,
      setupRequired: true,
    };
  }

  if (profileResult.error) {
    return {
      errorMessage: "Could not load your profile right now.",
      project: null,
      setupRequired: false,
    };
  }

  const { data: memberships, error: membershipError } = await listProjectMembershipsWithProjectsRetryingEmpty({
    projectId,
    supabase,
    userId: user.id,
  });

  if (membershipError) {
    if (isControlPlaneSetupError(membershipError)) {
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

  if (!memberships.length) {
    return {
      project: null,
      setupRequired: false,
    };
  }

  const membershipRole = getHighestProjectRole(memberships.map((membership) => membership.role_key));

  if (!membershipRole) {
    return {
      project: null,
      setupRequired: false,
    };
  }

  const project = normalizeControlPlaneProjectMembershipProject(memberships[0]?.projects);

  if (!project) {
    return {
      project: null,
      setupRequired: false,
    };
  }

  return {
    project: {
      id: project.id,
      name: project.name,
      slug: project.slug,
      websiteUrl: project.website_url ?? null,
      createdAt: project.created_at,
      role: membershipRole,
    },
    setupRequired: false,
  };
};

export const getProjectForUserBySlug = async (
  supabase: SupabaseServerClient,
  user: User,
  projectSlug: string,
): Promise<ControlPlaneProjectResult> => {
  const profileResult = await ensureProfile(supabase, user);

  if (profileResult.setupRequired) {
    return {
      project: null,
      setupRequired: true,
    };
  }

  if (profileResult.error) {
    return {
      errorMessage: "Could not load your profile right now.",
      project: null,
      setupRequired: false,
    };
  }

  const normalizedSlug = normalizeProjectSlug(projectSlug);

  if (!normalizedSlug) {
    return {
      project: null,
      setupRequired: false,
    };
  }

  const { data: memberships, error: membershipError } = await listProjectMembershipsWithProjectsRetryingEmpty({
    projectSlug: normalizedSlug,
    supabase,
    userId: user.id,
  });

  if (membershipError) {
    if (isControlPlaneSetupError(membershipError)) {
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

  if (!memberships.length) {
    return {
      project: null,
      setupRequired: false,
    };
  }

  const membershipRole = getHighestProjectRole(memberships.map((membership) => membership.role_key));

  if (!membershipRole) {
    return {
      project: null,
      setupRequired: false,
    };
  }

  const project = normalizeControlPlaneProjectMembershipProject(memberships[0]?.projects);

  if (!project) {
    return {
      project: null,
      setupRequired: false,
    };
  }

  return {
    project: {
      id: project.id,
      name: project.name,
      slug: project.slug,
      websiteUrl: project.website_url ?? null,
      createdAt: project.created_at,
      role: membershipRole,
    },
    setupRequired: false,
  };
};

export const getProfileSettingsPageBootstrap = async (): Promise<ProfileSettingsPageBootstrap> => {
  const { supabase, user } = await requireAuthenticatedUser();
  return getCachedControlPlaneRuntimeValue({
    cacheKey: `profile-bootstrap:${user.id}`,
    groups: [controlPlaneRuntimeCacheGroups.profileBootstrap],
    load: async () => {
      const { data, error } = await supabase
        .from("basebuddy_profiles")
        .select("email, name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        if (isControlPlaneSetupError(error)) {
          return {
            avatarUrl: null,
            email: user.email ?? null,
            name: getUserDisplayName(user.email ?? null, null),
            setupRequired: true,
          } satisfies ProfileSettingsPageBootstrap;
        }

        return {
          avatarUrl: null,
          email: user.email ?? null,
          errorMessage: "Unable to load your profile. Please refresh the page.",
          name: getUserDisplayName(user.email ?? null, null),
          setupRequired: false,
        } satisfies ProfileSettingsPageBootstrap;
      }

      const profile = data as {
        avatar_url: string | null;
        email: string | null;
        name: string | null;
      } | null;
      const authDisplayName =
        typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : typeof user.user_metadata?.name === "string"
            ? user.user_metadata.name
            : null;
      const authAvatarUrl =
        typeof user.user_metadata?.avatar_url === "string"
          ? user.user_metadata.avatar_url
          : typeof user.user_metadata?.picture === "string"
            ? user.user_metadata.picture
            : null;
      const email = profile?.email ?? user.email ?? null;

      return {
        avatarUrl: profile?.avatar_url ?? authAvatarUrl,
        email,
        name: getUserDisplayName(email, profile?.name ?? authDisplayName),
        setupRequired: false,
      } satisfies ProfileSettingsPageBootstrap;
    },
    staleWhileRevalidateMs: APP_BOOTSTRAP_STALE_WHILE_REVALIDATE_MS,
    ttlMs: APP_BOOTSTRAP_TTL_MS,
    userId: user.id,
  });
};
