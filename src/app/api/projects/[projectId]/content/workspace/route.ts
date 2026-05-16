import { getContentWorkspaceMeta } from "@/lib/content-runtime/server";
import { requireAuthenticatedProjectApiUser } from "@/lib/api/project-api-auth";

import {
  runTimedAuthenticatedContentGetRoute,
} from "../shared";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const authStartedAt = performance.now();
  const authResult = await requireAuthenticatedProjectApiUser();

  return runTimedAuthenticatedContentGetRoute({
    authDurationMs: performance.now() - authStartedAt,
    authResult,
    endpoint: "content.workspace",
    handler: async () => getContentWorkspaceMeta(projectId),
    projectId,
  });
}
