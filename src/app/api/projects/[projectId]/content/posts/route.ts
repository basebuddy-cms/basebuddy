import { getContentPostsPage } from "@/lib/content-runtime/server";
import { requireAuthenticatedProjectApiUser } from "@/lib/api/project-api-auth";
import {
  type ContentPostsSort,
  type ContentPostsStatusFilter,
  normalizeContentPostsSearch,
  normalizeContentPostsSort,
  normalizeContentPostsStatusFilter,
} from "@/lib/content-runtime/shared";

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
  const postsSearch = normalizeContentPostsSearch(searchParams.get("search") ?? "");
  const postsSort =
    normalizeContentPostsSort(searchParams.get("sort")) satisfies ContentPostsSort;
  const postsStatus =
    normalizeContentPostsStatusFilter(
      searchParams.get("status"),
    ) satisfies ContentPostsStatusFilter;

  return runTimedAuthenticatedContentGetRoute({
    authDurationMs: performance.now() - authStartedAt,
    authResult,
    endpoint: "content.posts_page",
    handler: async () =>
      getContentPostsPage({
        page,
        pageSize,
        projectId,
        search: postsSearch,
        sort: postsSort,
        status: postsStatus,
      }),
    metadata: {
      hasSearch: postsSearch.length > 0,
      page,
      pageSize,
      searchLength: postsSearch.length,
      sort: postsSort,
      statusFilter: postsStatus,
    },
    projectId,
  });
}
