import { getContentPostEditorPayload } from "@/lib/content-runtime/server";
import { requireAuthenticatedProjectApiUser } from "@/lib/api/project-api-auth";

import {
  runTimedAuthenticatedContentGetRoute,
} from "../../shared";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ postId: string; projectId: string }> },
) {
  const { postId, projectId } = await params;
  const authStartedAt = performance.now();
  const authResult = await requireAuthenticatedProjectApiUser();
  const { searchParams } = new URL(request.url);
  const includeEditorOptions = !["0", "false"].includes(
    searchParams.get("includeEditorOptions")?.trim().toLowerCase() ?? "",
  );

  return runTimedAuthenticatedContentGetRoute({
    authDurationMs: performance.now() - authStartedAt,
    authResult,
    endpoint: "content.post_payload",
    handler: async () =>
      getContentPostEditorPayload({
        includeEditorOptions,
        postId,
        projectId,
      }),
    metadata: {
      includeEditorOptions,
    },
    projectId,
  });
}
