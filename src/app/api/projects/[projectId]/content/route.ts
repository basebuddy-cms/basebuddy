import { withAuthenticatedProjectRoute } from "@/lib/api/project-api-auth";

import {
  handleContentRouteGet,
  handleContentRoutePost,
} from "./_lib/content-route-handlers";

export const runtime = "nodejs";

export const GET = withAuthenticatedProjectRoute(async (request, context) =>
  handleContentRouteGet(request, {
    projectId: context.projectId,
  }),
);

export const POST = withAuthenticatedProjectRoute(async (request, context) =>
  handleContentRoutePost(request, {
    projectId: context.projectId,
    user: context.user,
  }),
);
