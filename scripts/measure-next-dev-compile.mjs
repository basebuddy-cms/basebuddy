import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

process.loadEnvFile?.(".env.playwright");
process.loadEnvFile?.(".env");

const port = Number(process.env.PERF_DEV_PORT ?? 3201);
const baseUrl = `http://127.0.0.1:${port}`;
const routes = process.argv.slice(2).filter((value) => value !== "--");
const probeRoutes = routes.length ? routes : ["/onboarding", "/projects"];

const wait = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const child = spawn(
  process.execPath,
  [
    "--env-file=.env.playwright",
    "./node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  },
);

let ready = false;
let devLogs = "";

const handleOutput = (chunk) => {
  const text = chunk.toString();
  devLogs += text;

  if (text.includes("Ready in") || text.includes("Local:")) {
    ready = true;
  }

  process.stdout.write(text);
};

child.stdout.on("data", handleOutput);
child.stderr.on("data", handleOutput);

const waitForReady = async () => {
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    if (ready) {
      return;
    }

    await wait(200);
  }

  throw new Error(`Timed out waiting for next dev to be ready.\n${devLogs}`);
};

const fetchRoute = async (route) => {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}${route}`, {
    redirect: "manual",
  });

  return {
    durationMs: Math.round(performance.now() - startedAt),
    route,
    status: response.status,
  };
};

const shutdown = () =>
  new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }

    child.once("exit", () => resolve());
    child.kill("SIGTERM");

    setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
      }
    }, 5_000);
  });

try {
  await waitForReady();

  console.log(`\n[perf] dev compile probe on ${baseUrl}`);

  for (const route of probeRoutes) {
    const result = await fetchRoute(route);
    console.log(`[perf] ${result.route} -> ${result.status} in ${result.durationMs}ms`);
  }
} finally {
  await shutdown();
}
