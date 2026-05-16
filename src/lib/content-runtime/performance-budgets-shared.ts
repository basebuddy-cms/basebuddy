export const CONTENT_RUNTIME_ROUTE_BUDGETS_MS = {
  "content.post_payload": 1_200,
  "content.posts_page": 1_000,
  "content.posts_presence": 400,
  "content.workspace": 1_200,
  "content.workspace_counts": 1_500,
  default: 750,
} as const;

export const CONTENT_RUNTIME_REQUEST_SPAN_BUDGETS_MS = {
  auth: 250,
  "cache-build": 400,
  context: 350,
  db: 600,
  handler: 1_000,
} as const;

export const getContentRuntimeRouteBudgetMs = (endpoint: string) =>
  CONTENT_RUNTIME_ROUTE_BUDGETS_MS[
    endpoint as keyof typeof CONTENT_RUNTIME_ROUTE_BUDGETS_MS
  ] ?? CONTENT_RUNTIME_ROUTE_BUDGETS_MS.default;

export const getContentRuntimeRequestSpanBudgetMs = (spanName: string) =>
  CONTENT_RUNTIME_REQUEST_SPAN_BUDGETS_MS[
    spanName as keyof typeof CONTENT_RUNTIME_REQUEST_SPAN_BUDGETS_MS
  ] ?? null;

export const getContentRuntimeCacheBuildSlowThresholdMs = () =>
  CONTENT_RUNTIME_REQUEST_SPAN_BUDGETS_MS["cache-build"];
