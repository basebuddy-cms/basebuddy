import {
  CONTENT_RUNTIME_REQUEST_SPAN_BUDGETS_MS,
  CONTENT_RUNTIME_ROUTE_BUDGETS_MS,
  getContentRuntimeCacheBuildSlowThresholdMs,
} from "../src/lib/content-runtime/performance-budgets-shared";

console.log("Content runtime performance budgets");
console.log("");
console.log("Route budgets (ms)");

for (const [route, budgetMs] of Object.entries(CONTENT_RUNTIME_ROUTE_BUDGETS_MS)) {
  console.log(`- ${route}: ${budgetMs}`);
}

console.log("");
console.log("Span budgets (ms)");

for (const [span, budgetMs] of Object.entries(CONTENT_RUNTIME_REQUEST_SPAN_BUDGETS_MS)) {
  console.log(`- ${span}: ${budgetMs}`);
}

console.log("");
console.log(`Cache-build slow threshold (ms): ${getContentRuntimeCacheBuildSlowThresholdMs()}`);
