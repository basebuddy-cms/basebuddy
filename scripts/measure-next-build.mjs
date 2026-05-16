import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

process.loadEnvFile?.(".env.playwright");
process.loadEnvFile?.(".env");

const cwd = process.cwd();
const nextDir = path.join(cwd, ".next");
const startedAt = performance.now();

if (existsSync(nextDir)) {
  await rm(nextDir, { force: true, recursive: true });
}

const child = spawn(
  process.execPath,
  ["--env-file=.env.playwright", "./node_modules/next/dist/bin/next", "build"],
  {
    env: process.env,
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  const durationMs = Math.round(performance.now() - startedAt);
  console.log(`\n[perf] next build duration: ${durationMs}ms`);

  void (async () => {
    if (signal) {
      process.exit(1);
      return;
    }

    process.exit(code ?? 1);
  })().catch((error) => {
    console.error("[perf] failed to finalize build measurement cleanup", error);
    process.exit(1);
  });
});
