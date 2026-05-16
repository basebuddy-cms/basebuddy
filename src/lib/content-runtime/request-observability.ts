import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

import {
  getContentRuntimeCacheBuildSlowThresholdMs,
  getContentRuntimeRequestSpanBudgetMs,
  getContentRuntimeRouteBudgetMs,
} from "./performance-budgets";

export type ContentRuntimeTimingSpan = {
  durationMs: number;
  name: string;
};

export type ContentRuntimeRequestMetricValue = boolean | null | number | string;

type ContentRuntimeRequestMetricsStore = {
  endpoint: string;
  metadata: Record<string, ContentRuntimeRequestMetricValue>;
  projectId: string;
  spans: ContentRuntimeTimingSpan[];
  startedAt: number;
};

type ContentRuntimeSlowRequestLogInput = {
  cacheState?: "fresh" | "missing" | "stale" | "uncached" | "unknown";
  durationMs: number;
  endpoint: string;
  mode: string | null;
  projectId: string;
  scopeKey: string;
  status?: number;
  spans?: ContentRuntimeTimingSpan[];
};

type ContentRuntimeCacheBuildLogInput = {
  durationMs: number;
  groups: string[];
  mode?: string | null;
  projectId: string;
  scopeKey: string;
};

export type ContentRuntimeRequestMetricsSnapshot = {
  endpoint: string;
  metadata: Record<string, ContentRuntimeRequestMetricValue>;
  projectId: string;
  spans: ContentRuntimeTimingSpan[];
  totalDurationMs: number;
};

const contentRuntimeRequestMetricsStorage = new AsyncLocalStorage<ContentRuntimeRequestMetricsStore>();

const formatDurationMs = (durationMs: number) => Math.round(durationMs * 10) / 10;

const getContentRuntimeRequestMetricsStore = () => contentRuntimeRequestMetricsStorage.getStore();

export const runWithContentRuntimeRequestMetrics = async <T>({
  endpoint,
  projectId,
  work,
}: {
  endpoint: string;
  projectId: string;
  work: () => Promise<T>;
}) =>
  contentRuntimeRequestMetricsStorage.run(
    {
      endpoint,
      metadata: {},
      projectId,
      spans: [],
      startedAt: performance.now(),
    },
    work,
  );

export const measureContentRuntimeRequestSpan = async <T>(
  name: string,
  work: () => Promise<T> | T,
) => {
  const store = getContentRuntimeRequestMetricsStore();

  if (!store) {
    return await work();
  }

  const spanStartedAt = performance.now();

  try {
    return await work();
  } finally {
    store.spans.push({
      durationMs: performance.now() - spanStartedAt,
      name,
    });
  }
};

export const pushContentRuntimeRequestSpan = (
  name: string,
  durationMs: number,
) => {
  const store = getContentRuntimeRequestMetricsStore();

  if (!store) {
    return;
  }

  store.spans.push({
    durationMs,
    name,
  });
};

export const setContentRuntimeRequestMetric = (
  key: string,
  value: ContentRuntimeRequestMetricValue,
) => {
  const store = getContentRuntimeRequestMetricsStore();

  if (!store) {
    return;
  }

  store.metadata[key] = value;
};

export const incrementContentRuntimeRequestMetric = (key: string, amount = 1) => {
  const store = getContentRuntimeRequestMetricsStore();

  if (!store) {
    return;
  }

  const currentValue = store.metadata[key];
  const nextValue =
    typeof currentValue === "number" && Number.isFinite(currentValue)
      ? currentValue + amount
      : amount;

  store.metadata[key] = nextValue;
};

export const getContentRuntimeRequestMetricsSnapshot = (): ContentRuntimeRequestMetricsSnapshot | null => {
  const store = getContentRuntimeRequestMetricsStore();

  if (!store) {
    return null;
  }

  return {
    endpoint: store.endpoint,
    metadata: { ...store.metadata },
    projectId: store.projectId,
    spans: store.spans.map((entry) => ({
      durationMs: formatDurationMs(entry.durationMs),
      name: entry.name,
    })),
    totalDurationMs: formatDurationMs(performance.now() - store.startedAt),
  };
};

export const getContentRuntimeRequestServerTimingHeader = () => {
  const snapshot = getContentRuntimeRequestMetricsSnapshot();

  if (!snapshot) {
    return "";
  }

  return [
    ...snapshot.spans,
    {
      durationMs: snapshot.totalDurationMs,
      name: "total",
    },
  ]
    .map((entry) => `${entry.name};dur=${formatDurationMs(entry.durationMs)}`)
    .join(", ");
};

export const logSlowContentRuntimeRequest = ({
  cacheState = "unknown",
  durationMs,
  endpoint,
  mode,
  projectId,
  scopeKey,
  spans = [],
  status,
}: ContentRuntimeSlowRequestLogInput) => {
  const budgetMs = getContentRuntimeRouteBudgetMs(endpoint);

  if (durationMs < budgetMs) {
    return;
  }

  console.warn(
    "[content-runtime][slow-request]",
    JSON.stringify({
      cacheState,
      budgetMs: formatDurationMs(budgetMs),
      durationMs: formatDurationMs(durationMs),
      endpoint,
      mode,
      overBudgetMs: formatDurationMs(Math.max(0, durationMs - budgetMs)),
      projectId,
      scopeKey,
      spans: spans.map((entry) => ({
        budgetMs: getContentRuntimeRequestSpanBudgetMs(entry.name),
        durationMs: formatDurationMs(entry.durationMs),
        name: entry.name,
        overBudgetMs:
          getContentRuntimeRequestSpanBudgetMs(entry.name) === null
            ? null
            : formatDurationMs(
                Math.max(0, entry.durationMs - (getContentRuntimeRequestSpanBudgetMs(entry.name) ?? 0)),
              ),
      })),
      status: status ?? null,
    }),
  );
};

export const logContentRuntimeCacheBuild = ({
  durationMs,
  groups,
  mode = null,
  projectId,
  scopeKey,
}: ContentRuntimeCacheBuildLogInput) => {
  const thresholdMs = getContentRuntimeCacheBuildSlowThresholdMs();

  if (durationMs < thresholdMs) {
    return;
  }

  console.info(
    "[content-runtime][cache-build]",
    JSON.stringify({
      budgetMs: formatDurationMs(thresholdMs),
      durationMs: formatDurationMs(durationMs),
      groups,
      mode,
      overBudgetMs: formatDurationMs(Math.max(0, durationMs - thresholdMs)),
      projectId,
      scopeKey,
    }),
  );
};
