import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

process.loadEnvFile?.(".env.playwright");
process.loadEnvFile?.(".env");

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const cliArgs = process.argv.slice(2);
const defaultArgs = [
  "--env-file=.env.playwright",
  "./node_modules/@playwright/test/cli.js",
  "test",
  "e2e/authenticated-shell.spec.ts",
  "e2e/authenticated-posts.spec.ts",
  "--workers=1",
];
const args = cliArgs.length ? cliArgs : defaultArgs;
const startedAt = performance.now();

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const waitForServerReady = async () => {
  const deadline = Date.now() + 180_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl, { redirect: "manual" });

      if (response.status >= 200 && response.status < 500) {
        return;
      }
    } catch {
      // Wait for the Next production server to finish booting.
    }

    await sleep(500);
  }

  throw new Error(`Timed out waiting for Playwright web server at ${baseUrl}`);
};

const serverChild = spawn(
  process.execPath,
  ["./scripts/start-playwright-server.mjs"],
  {
    env: process.env,
    stdio: "inherit",
  },
);

const stopChild = (child) => {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
  }
};

const forwardSignal = (signal) => {
  stopChild(serverChild);
};

process.on("SIGINT", () => {
  forwardSignal("SIGINT");
});

process.on("SIGTERM", () => {
  forwardSignal("SIGTERM");
});

await waitForServerReady();

const child = spawn(process.execPath, args, {
  env: {
    ...process.env,
    PLAYWRIGHT_REUSE_EXISTING_SERVER: "1",
  },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  stopChild(serverChild);
  const durationMs = Math.round(performance.now() - startedAt);
  console.log(`\n[perf] playwright runtime duration: ${durationMs}ms`);

  if (signal) {
    process.exit(1);
  }

  process.exit(code ?? 1);
});

serverChild.on("exit", (code, signal) => {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  if (signal) {
    child.kill("SIGTERM");
    return;
  }

  if (code && code !== 0) {
    child.kill("SIGTERM");
    process.exit(code);
  }
});
