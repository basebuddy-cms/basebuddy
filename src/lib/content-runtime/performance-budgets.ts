import "server-only";

export {
  CONTENT_RUNTIME_REQUEST_SPAN_BUDGETS_MS,
  CONTENT_RUNTIME_ROUTE_BUDGETS_MS,
  getContentRuntimeCacheBuildSlowThresholdMs,
  getContentRuntimeRequestSpanBudgetMs,
  getContentRuntimeRouteBudgetMs,
} from "./performance-budgets-shared";
