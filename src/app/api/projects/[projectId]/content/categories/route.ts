import { requireAuthenticatedProjectApiUser } from "@/lib/api/project-api-auth";
import { getContentCategoriesPage } from "@/lib/content-runtime/server";

import {
  parsePositiveInteger,
  runTimedAuthenticatedContentGetRoute,
} from "../shared";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const authStartedAt = performance.now();
  const authResult = await requireAuthenticatedProjectApiUser();
  const { searchParams } = new URL(request.url);
  const page = parsePositiveInteger(searchParams.get("page"), 1);
  const pageSize = parsePositiveInteger(searchParams.get("pageSize"), 20);
  const includeAllCategories = searchParams.get("includeAllCategories") === "true";
  const search = searchParams.get("search")?.trim() ?? "";

  return runTimedAuthenticatedContentGetRoute({
    authDurationMs: performance.now() - authStartedAt,
    authResult,
    endpoint: "content.categories_page",
    handler: async () =>
      getContentCategoriesPage({
        includeAllCategories,
        page,
        pageSize,
        projectId,
        search,
      }),
    metadata: {
      includeAllCategories,
      page,
      pageSize,
      search,
    },
    projectId,
  });
}
