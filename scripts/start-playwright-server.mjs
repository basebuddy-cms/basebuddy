import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const loadedEnvKeys = new Set();

const parseDotEnvValue = (rawValue) => {
  const value = rawValue.trim();
  const quote = value[0];

  if ((quote === "\"" || quote === "'") && value.endsWith(quote)) {
    return value.slice(1, -1).replace(/\\n/g, "\n");
  }

  return value;
};

const loadDotEnvFile = (filePath, options = {}) => {
  const absolutePath = resolve(process.cwd(), filePath);

  if (!existsSync(absolutePath)) {
    return;
  }

  const source = readFileSync(absolutePath, "utf8");

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");

    if (equalsIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = parseDotEnvValue(trimmed.slice(equalsIndex + 1));

    if (!key) {
      continue;
    }

    if (process.env[key] === undefined || (options.override && loadedEnvKeys.has(key))) {
      process.env[key] = value;
      loadedEnvKeys.add(key);
    }
  }
};

loadDotEnvFile(".env");
loadDotEnvFile(".env.local");
loadDotEnvFile(".env.playwright", { override: true });

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const findListeningPids = () => {
  try {
    const output = execFileSync("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });

    return output
      .split(/\s+/)
      .map((value) => Number(value.trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid);
  } catch {
    return [];
  }
};

const pidExists = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const stopExistingPlaywrightServer = async () => {
  const pids = findListeningPids();

  if (pids.length === 0) {
    return;
  }

  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Ignore races where the port owner exits between lookup and shutdown.
    }
  }

  const shutdownDeadline = Date.now() + 5_000;

  while (Date.now() < shutdownDeadline) {
    if (pids.every((pid) => !pidExists(pid))) {
      return;
    }

    await sleep(100);
  }

  for (const pid of pids) {
    if (!pidExists(pid)) {
      continue;
    }

    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Ignore races where the process exits during the forced shutdown pass.
    }
  }
};

await stopExistingPlaywrightServer();

const child = spawn(
  process.execPath,
  ["--env-file=.env.playwright", "./node_modules/next/dist/bin/next", "start", "--port", String(port)],
  {
    env: {
      ...process.env,
      BASEBUDDY_PLAYWRIGHT_RUNTIME: "1",
    },
    stdio: "inherit",
  },
);

const forwardSignal = (signal) => {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill(signal);
  }
};

process.on("SIGINT", () => {
  forwardSignal("SIGINT");
});

process.on("SIGTERM", () => {
  forwardSignal("SIGTERM");
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.exit(1);
  }

  process.exit(code ?? 1);
});
