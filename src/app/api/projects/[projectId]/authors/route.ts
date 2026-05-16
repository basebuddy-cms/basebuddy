import { NextResponse } from "next/server";
import { z } from "zod";

import {
  type AuthenticatedProjectApiRouteContext,
  withAuthenticatedPreparedProjectRoute,
  withAuthenticatedProjectRoute,
} from "@/lib/api/project-api-auth";
import {
  getProjectAccessRouteErrorMessage,
  getProjectAccessRouteErrorStatus,
} from "@/lib/api/project-access-route-errors";
import { parseJsonBody, enforceRateLimit } from "@/lib/api/request-guards";
import type {
  CreateProjectAuthorPayload,
  DeleteProjectAuthorsPayload,
  ProjectAuthorsPayload,
  SetProjectAuthorAssignmentPayload,
} from "@/lib/control-plane/authors";
import { normalizeProjectMemberAuthorScopeCanPublish } from "@/lib/control-plane/members";
import {
  APP_SETUP_REQUIRED_MESSAGE,
  isControlPlaneSetupError,
} from "@/lib/control-plane/server";
import {
  createContentCollectionEntry,
  deleteContentCollectionEntries,
  getContentAuthorsPage,
} from "@/lib/content-runtime/server";
export const runtime = "nodejs";

type ProjectAuthorMembersRow = {
  avatar_url: string | null;
  email: string | null;
  name: string | null;
  user_id: string;
};

type ProjectAuthorAssignmentsRow = {
  avatar_url: string | null;
  can_publish: boolean | null;
  cms_author_id: string;
  email: string | null;
  name: string | null;
  user_id: string | null;
};

const parsePositiveInteger = (value: string | null, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseBooleanFlag = (value: string | null, fallback: boolean) => {
  if (value === null) {
    return fallback;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
};

const createProjectAuthorSchema = z.object({
  action: z.literal("create_author"),
  assignUserId: z.string().trim().max(200, "Assigned user id is too long.").nullable().optional(),
  bio: z.string().trim().max(10_000, "Author bio must be 10000 characters or fewer.").nullable().optional(),
  email: z.string().trim().email("Enter a valid author email address.").max(320, "Author email is too long.").nullable().optional(),
  name: z.string().trim().min(1, "Name is required.").max(120, "Author name must be 120 characters or fewer."),
  slug: z.string().trim().max(200, "Author slug must be 200 characters or fewer.").nullable().optional(),
});

const setProjectAuthorAssignmentSchema = z.object({
  action: z.literal("set_author_assignment"),
  canPublish: z.boolean().optional().default(true),
  cmsAuthorId: z.string().trim().min(1, "Select a content author first.").max(200, "Content author id is too long."),
  userId: z.string().trim().max(200, "Assigned user id is too long.").nullable(),
});

const deleteProjectAuthorsSchema = z.object({
  entryIds: z.array(z.string().trim().min(1, "Select an entry first.").max(200, "Entry id is too long.")).min(1, "Select an entry first.").max(50, "Too many author entries were selected."),
});

const loadProjectAuthorsPayload = async ({
  includeMeta = true,
  page,
  pageSize,
  projectId,
  supabase,
}: {
  includeMeta?: boolean;
  page: number;
  pageSize: number;
  projectId: string;
  supabase: AuthenticatedProjectApiRouteContext["supabase"];
}) => {
  const authorsPage = await getContentAuthorsPage({
    page,
    pageSize,
    projectId,
  });

  if (!includeMeta) {
    return {
      authors: authorsPage.items,
      pagination: authorsPage.pagination,
    } satisfies ProjectAuthorsPayload;
  }

  const { data: membersData, error: membersError } = await supabase.rpc("get_project_author_members", {
    p_project_id: projectId,
  });

  if (membersError) {
    if (isControlPlaneSetupError(membersError)) {
      throw new Error(APP_SETUP_REQUIRED_MESSAGE);
    }

    throw new Error(getProjectAccessRouteErrorMessage(membersError, "authors"));
  }

  const { data: assignmentsData, error: assignmentsError } = await supabase.rpc("get_project_author_assignments", {
    p_project_id: projectId,
  });

  if (assignmentsError) {
    if (isControlPlaneSetupError(assignmentsError)) {
      throw new Error(APP_SETUP_REQUIRED_MESSAGE);
    }

    throw new Error(getProjectAccessRouteErrorMessage(assignmentsError, "authors"));
  }

  return {
    assignments: ((assignmentsData ?? []) as ProjectAuthorAssignmentsRow[]).map((assignment) => ({
      canPublish: normalizeProjectMemberAuthorScopeCanPublish(assignment.can_publish),
      cmsAuthorId: assignment.cms_author_id,
      userId: assignment.user_id,
    })),
    authorMembers: ((membersData ?? []) as ProjectAuthorMembersRow[]).map((member) => ({
      avatarUrl: member.avatar_url,
      email: member.email,
      name: member.name,
      userId: member.user_id,
    })),
    authors: authorsPage.items,
    pagination: authorsPage.pagination,
  } satisfies ProjectAuthorsPayload;
};

export const GET = withAuthenticatedProjectRoute(async (request, { projectId, supabase }) => {
  const { searchParams } = new URL(request.url);
  const page = parsePositiveInteger(searchParams.get("page"), 1);
  const pageSize = parsePositiveInteger(searchParams.get("pageSize"), 20);
  const includeMeta = parseBooleanFlag(searchParams.get("includeMeta"), true);

  try {
    const payload = await loadProjectAuthorsPayload({
      includeMeta,
      page,
      pageSize,
      projectId,
      supabase,
    });

    return NextResponse.json(payload satisfies ProjectAuthorsPayload);
  } catch (error) {
    const message = getProjectAccessRouteErrorMessage(error, "authors");
    return NextResponse.json({ error: message }, { status: getProjectAccessRouteErrorStatus(message, "authors") });
  }
});

export const POST = withAuthenticatedPreparedProjectRoute(async (request, { projectId, supabase, user }) => {
  const payloadResult = await parseJsonBody(request, createProjectAuthorSchema, {
    maxBytes: 24 * 1024,
  });

  if (payloadResult.errorResponse) {
    return payloadResult.errorResponse;
  }

  const payload = payloadResult.data as CreateProjectAuthorPayload;

  if (payload.action !== "create_author") {
    return NextResponse.json({ error: "Unsupported authors action." }, { status: 400 });
  }

  const rateLimitError = enforceRateLimit({
    bucket: "api:project-authors:post",
    key: user.id,
    limit: 20,
    request,
    windowMs: 60_000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  try {
    const entry = await createContentCollectionEntry({
      bio: payload.bio,
      collection: "authors",
      email: payload.email,
      name: payload.name,
      projectId,
      slug: payload.slug,
    });

    if (payload.assignUserId) {
      const { error } = await supabase.rpc("set_project_author_assignment", {
        p_can_publish: true,
        p_cms_author_id: entry.id,
        p_project_id: projectId,
        p_user_id: payload.assignUserId,
      });

      if (error) {
        if (isControlPlaneSetupError(error)) {
          return NextResponse.json({ error: APP_SETUP_REQUIRED_MESSAGE }, { status: 500 });
        }

        const message = getProjectAccessRouteErrorMessage(error, "authors");
        return NextResponse.json(
          { error: message },
          { status: getProjectAccessRouteErrorStatus(message, "authors") },
        );
      }
    }

    const refreshedPayload = await loadProjectAuthorsPayload({
      page: 1,
      pageSize: 20,
      projectId,
      supabase,
    });

    return NextResponse.json(refreshedPayload satisfies ProjectAuthorsPayload);
  } catch (error) {
    const message = getProjectAccessRouteErrorMessage(error, "authors");
    return NextResponse.json({ error: message }, { status: getProjectAccessRouteErrorStatus(message, "authors") });
  }
});

export const PATCH = withAuthenticatedPreparedProjectRoute(async (request, { projectId, supabase, user }) => {
  const payloadResult = await parseJsonBody(request, setProjectAuthorAssignmentSchema, {
    maxBytes: 16 * 1024,
  });

  if (payloadResult.errorResponse) {
    return payloadResult.errorResponse;
  }

  const payload = payloadResult.data as SetProjectAuthorAssignmentPayload;

  if (payload.action !== "set_author_assignment") {
    return NextResponse.json({ error: "Unsupported authors action." }, { status: 400 });
  }

  const rateLimitError = enforceRateLimit({
    bucket: "api:project-authors:patch",
    key: user.id,
    request,
    limit: 20,
    windowMs: 60_000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  try {
    const { error } = await supabase.rpc("set_project_author_assignment", {
      p_can_publish: payload.canPublish ?? true,
      p_cms_author_id: payload.cmsAuthorId,
      p_project_id: projectId,
      p_user_id: payload.userId,
    });

    if (error) {
      if (isControlPlaneSetupError(error)) {
        return NextResponse.json({ error: APP_SETUP_REQUIRED_MESSAGE }, { status: 500 });
      }

      const message = getProjectAccessRouteErrorMessage(error, "authors");
      return NextResponse.json(
        { error: message },
        { status: getProjectAccessRouteErrorStatus(message, "authors") },
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parsePositiveInteger(searchParams.get("page"), 1);
    const pageSize = parsePositiveInteger(searchParams.get("pageSize"), 20);

    const refreshedPayload = await loadProjectAuthorsPayload({
      page,
      pageSize,
      projectId,
      supabase,
    });

    return NextResponse.json(refreshedPayload satisfies ProjectAuthorsPayload);
  } catch (error) {
    const message = getProjectAccessRouteErrorMessage(error, "authors");
    return NextResponse.json({ error: message }, { status: getProjectAccessRouteErrorStatus(message, "authors") });
  }
});

export const DELETE = withAuthenticatedPreparedProjectRoute(async (request, { projectId, supabase, user }) => {
  const payloadResult = await parseJsonBody(request, deleteProjectAuthorsSchema, {
    maxBytes: 16 * 1024,
  });

  if (payloadResult.errorResponse) {
    return payloadResult.errorResponse;
  }

  const { entryIds } = payloadResult.data as DeleteProjectAuthorsPayload;

  const rateLimitError = enforceRateLimit({
    bucket: "api:project-authors:delete",
    key: user.id,
    request,
    limit: 20,
    windowMs: 60_000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  try {
    await deleteContentCollectionEntries({
      collection: "authors",
      entryIds,
      projectId,
    });

    const { error: cleanupError } = await supabase
      .from("basebuddy_project_member_author_scopes")
      .delete()
      .eq("project_id", projectId)
      .in("cms_author_id", entryIds);

    if (cleanupError && !isControlPlaneSetupError(cleanupError)) {
      throw new Error(getProjectAccessRouteErrorMessage(cleanupError, "authors"));
    }

    const refreshedPayload = await loadProjectAuthorsPayload({
      page: 1,
      pageSize: 20,
      projectId,
      supabase,
    });

    return NextResponse.json(refreshedPayload satisfies ProjectAuthorsPayload);
  } catch (error) {
    const message = getProjectAccessRouteErrorMessage(error, "authors");
    return NextResponse.json({ error: message }, { status: getProjectAccessRouteErrorStatus(message, "authors") });
  }
});
