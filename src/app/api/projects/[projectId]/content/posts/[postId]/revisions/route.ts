import { getContentPostRevisions } from "@/lib/content-runtime/server";
import { requireAuthenticatedProjectApiUser } from "@/lib/api/project-api-auth";

import {
  runTimedAuthenticatedContentGetRoute,
} from "../../../shared";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ postId: string; projectId: string }> },
) {
  const { postId, projectId } = await params;
  const authStartedAt = performance.now();
  const authResult = await requireAuthenticatedProjectApiUser();

  return runTimedAuthenticatedContentGetRoute({
    authDurationMs: performance.now() - authStartedAt,
    authResult,
    endpoint: "content.post_revisions",
    handler: async () => ({
      revisions: await getContentPostRevisions({
        postId,
        projectId,
      }),
    }),
    metadata: {
      limit: 20,
    },
    projectId,
  });
}
