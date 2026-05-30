import { NextResponse } from "next/server";
import { z } from "zod";

import {
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
import {
  createContentCollectionEntry,
  deleteContentCollectionEntries,
  getContentAuthorsPage,
} from "@/lib/content-runtime/server";
import {
  getConfigProjectAuthorAssignments,
  getConfigProjectAuthorMembers,
  removeConfigProjectAuthorScopes,
  setConfigProjectAuthorAssignment,
} from "@/lib/basebuddy-config/projects";
export const runtime = "nodejs";

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
}: {
  includeMeta?: boolean;
  page: number;
  pageSize: number;
  projectId: string;
}) => {
  const authorsPage = await getContentAuthorsPage({
    page,
    pageSize,
    projectId,
  });

  if (!includeMeta) {
    return {
      accessNotice: authorsPage.accessNotice ?? null,
      authors: authorsPage.items,
      pagination: authorsPage.pagination,
    } satisfies ProjectAuthorsPayload;
  }

  const [authorMembers, assignments] = await Promise.all([
    getConfigProjectAuthorMembers({ projectId }),
    getConfigProjectAuthorAssignments({ projectId }),
  ]);

  return {
    accessNotice: authorsPage.accessNotice ?? null,
    assignments,
    authorMembers,
    authors: authorsPage.items,
    pagination: authorsPage.pagination,
  } satisfies ProjectAuthorsPayload;
};

export const GET = withAuthenticatedProjectRoute(async (request, { projectId }) => {
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
    });

    return NextResponse.json(payload satisfies ProjectAuthorsPayload);
  } catch (error) {
    const message = getProjectAccessRouteErrorMessage(error, "authors");
    return NextResponse.json({ error: message }, { status: getProjectAccessRouteErrorStatus(message, "authors") });
  }
});

export const POST = withAuthenticatedPreparedProjectRoute(async (request, { projectId, user }) => {
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
      await setConfigProjectAuthorAssignment({
        actorUserId: user.id,
        canPublish: true,
        cmsAuthorId: entry.id,
        projectId,
        userId: payload.assignUserId,
      });
    }

    const refreshedPayload = await loadProjectAuthorsPayload({
      page: 1,
      pageSize: 20,
      projectId,
    });

    return NextResponse.json(refreshedPayload satisfies ProjectAuthorsPayload);
  } catch (error) {
    const message = getProjectAccessRouteErrorMessage(error, "authors");
    return NextResponse.json({ error: message }, { status: getProjectAccessRouteErrorStatus(message, "authors") });
  }
});

export const PATCH = withAuthenticatedPreparedProjectRoute(async (request, { projectId, user }) => {
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
    await setConfigProjectAuthorAssignment({
      actorUserId: user.id,
      canPublish: payload.canPublish ?? true,
      cmsAuthorId: payload.cmsAuthorId,
      projectId,
      userId: payload.userId,
    });

    const { searchParams } = new URL(request.url);
    const page = parsePositiveInteger(searchParams.get("page"), 1);
    const pageSize = parsePositiveInteger(searchParams.get("pageSize"), 20);

    const refreshedPayload = await loadProjectAuthorsPayload({
      page,
      pageSize,
      projectId,
    });

    return NextResponse.json(refreshedPayload satisfies ProjectAuthorsPayload);
  } catch (error) {
    const message = getProjectAccessRouteErrorMessage(error, "authors");
    return NextResponse.json({ error: message }, { status: getProjectAccessRouteErrorStatus(message, "authors") });
  }
});

export const DELETE = withAuthenticatedPreparedProjectRoute(async (request, { projectId, user }) => {
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
    await removeConfigProjectAuthorScopes({
      cmsAuthorIds: entryIds,
      projectId,
    });

    const refreshedPayload = await loadProjectAuthorsPayload({
      page: 1,
      pageSize: 20,
      projectId,
    });

    return NextResponse.json(refreshedPayload satisfies ProjectAuthorsPayload);
  } catch (error) {
    const message = getProjectAccessRouteErrorMessage(error, "authors");
    return NextResponse.json({ error: message }, { status: getProjectAccessRouteErrorStatus(message, "authors") });
  }
});
