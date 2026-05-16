import { existsSync } from "node:fs";
import { performance } from "node:perf_hooks";

type TimingCheck = {
  budgetMs: number;
  name: string;
  path: string;
};

const readArgValue = (args: string[], name: string) => {
  const index = args.indexOf(name);

  if (index === -1) {
    return null;
  }

  return args[index + 1] ?? null;
};

const parseBudget = (args: string[], name: string, fallback: number) => {
  const rawValue = readArgValue(args, name);

  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
};

const hasFlag = (args: string[], name: string) => args.includes(name);

const normalizeBaseUrl = (value: string | null) => {
  const baseUrl = value?.trim() || process.env.BASEBUDDY_LOAD_TEST_BASE_URL?.trim() || "http://127.0.0.1:8080";

  return baseUrl.replace(/\/+$/, "");
};

const requireValue = (value: string | null, message: string) => {
  const normalized = value?.trim() ?? "";

  if (!normalized) {
    throw new Error(message);
  }

  return normalized;
};

const loadOptionalEnvFile = (path: string) => {
  if (existsSync(path)) {
    process.loadEnvFile?.(path);
  }
};

const buildChecks = ({
  args,
  postId,
  projectId,
}: {
  args: string[];
  postId: string;
  projectId: string;
}): TimingCheck[] => [
  {
    budgetMs: parseBudget(args, "--posts-budget-ms", 1500),
    name: "posts first page",
    path: `/api/projects/${projectId}/content/posts?page=1&pageSize=20&sort=updated_desc`,
  },
  {
    budgetMs: parseBudget(args, "--posts-search-budget-ms", 1500),
    name: "posts search",
    path: `/api/projects/${projectId}/content/posts?page=1&pageSize=20&search=499999&sort=updated_desc`,
  },
  {
    budgetMs: parseBudget(args, "--relation-budget-ms", 800),
    name: "relation option search",
    path: `/api/projects/${projectId}/content?view=relation_options&fieldKey=categories&search=Category%20499999&limit=20`,
  },
  {
    budgetMs: parseBudget(args, "--editor-budget-ms", 1500),
    name: "post editor payload",
    path: `/api/projects/${projectId}/content/posts/${encodeURIComponent(postId)}?includeEditorOptions=false`,
  },
  {
    budgetMs: parseBudget(args, "--mapping-budget-ms", 1500),
    name: "mapping table catalog",
    path: `/api/projects/${projectId}/content?view=mapping_tables`,
  },
  {
    budgetMs: parseBudget(args, "--media-budget-ms", 2000),
    name: "media folder browse",
    path: `/api/projects/${projectId}/media?includeFolderOptions=false&path=folder-0099`,
  },
  {
    budgetMs: parseBudget(args, "--files-budget-ms", 2000),
    name: "files folder browse",
    path: `/api/projects/${projectId}/files?includeFolderOptions=false&path=folder-0099`,
  },
];

const measure = async ({
  baseUrl,
  cookie,
  check,
  enforceBudget,
}: {
  baseUrl: string;
  check: TimingCheck;
  cookie: string;
  enforceBudget: boolean;
}) => {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}${check.path}`, {
    headers: {
      cookie,
    },
    redirect: "manual",
  });
  const durationMs = Math.round(performance.now() - startedAt);

  if (!response.ok) {
    const body = await response.text();

    throw new Error(`${check.name} failed with HTTP ${response.status}: ${body.slice(0, 300)}`);
  }

  return {
    budgetMs: check.budgetMs,
    durationMs,
    name: check.name,
    ok: !enforceBudget || durationMs <= check.budgetMs,
    path: check.path,
  };
};

const main = async () => {
  loadOptionalEnvFile(".env");
  loadOptionalEnvFile(".env.local");

  const args = process.argv.slice(2);
  const baseUrl = normalizeBaseUrl(readArgValue(args, "--base-url"));
  const cookie = requireValue(
    readArgValue(args, "--cookie") ?? process.env.BASEBUDDY_LOAD_TEST_COOKIE ?? null,
    "Pass --cookie or set BASEBUDDY_LOAD_TEST_COOKIE with an authenticated app session cookie.",
  );
  const projectId = requireValue(
    readArgValue(args, "--project-id") ?? process.env.BASEBUDDY_LOAD_TEST_PROJECT_ID ?? null,
    "Pass --project-id or set BASEBUDDY_LOAD_TEST_PROJECT_ID.",
  );
  const postId = requireValue(
    readArgValue(args, "--post-id") ?? process.env.BASEBUDDY_LOAD_TEST_POST_ID ?? "1",
    "Pass --post-id or set BASEBUDDY_LOAD_TEST_POST_ID.",
  );
  const checks = buildChecks({
    args,
    postId,
    projectId,
  });
  const warmup = !hasFlag(args, "--skip-warmup");
  const results = [];

  if (warmup) {
    for (const check of checks) {
      await measure({ baseUrl, check, cookie, enforceBudget: false });
    }
  }

  for (const check of checks) {
    results.push(await measure({ baseUrl, check, cookie, enforceBudget: true }));
  }

  console.log(JSON.stringify({ baseUrl, results, warmup }, null, 2));

  if (results.some((result) => !result.ok)) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
