import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

let envLoaded = false;

const parseDotEnvValue = (rawValue: string) => {
  const value = rawValue.trim();
  const quote = value[0];

  if ((quote === "\"" || quote === "'") && value.endsWith(quote)) {
    return value.slice(1, -1).replace(/\\n/g, "\n");
  }

  return value;
};

const loadedEnvKeys = new Set<string>();

const loadDotEnvFile = (
  filePath: string,
  options: {
    override?: boolean;
  } = {},
) => {
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

export const loadPlaywrightEnv = () => {
  if (envLoaded) {
    return;
  }

  loadDotEnvFile(".env");
  loadDotEnvFile(".env.playwright", { override: true });
  envLoaded = true;
};
