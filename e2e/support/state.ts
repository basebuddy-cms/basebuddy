import path from "node:path";
import { readFileSync } from "node:fs";

export type PlaywrightSeedUserKey = "owner" | "admin" | "editor" | "author" | "viewer";

export type PlaywrightSeedUserRecord = {
  email: string;
  userId: string;
};

export type PlaywrightSeedProjectRecord = {
  assignedAuthorId: string;
  id: string;
  mediaBucket: string;
  name: string;
  slug: string;
};

export type PlaywrightSeedState = {
  contentDatabaseUrl?: string;
  generatedAt: string;
  projects: {
    project: PlaywrightSeedProjectRecord;
  };
  users: Record<PlaywrightSeedUserKey, PlaywrightSeedUserRecord>;
};

export const PLAYWRIGHT_AUTH_DIR = path.join(process.cwd(), "playwright", ".auth");
export const PLAYWRIGHT_CACHE_DIR = path.join(process.cwd(), "playwright", ".cache");
export const PLAYWRIGHT_SEED_STATE_PATH = path.join(PLAYWRIGHT_CACHE_DIR, "seed-state.json");

export const PLAYWRIGHT_AUTH_STATE_PATHS: Record<PlaywrightSeedUserKey, string> = {
  owner: path.join(PLAYWRIGHT_AUTH_DIR, "owner.json"),
  admin: path.join(PLAYWRIGHT_AUTH_DIR, "admin.json"),
  editor: path.join(PLAYWRIGHT_AUTH_DIR, "editor.json"),
  author: path.join(PLAYWRIGHT_AUTH_DIR, "author.json"),
  viewer: path.join(PLAYWRIGHT_AUTH_DIR, "viewer.json"),
};

export const loadPlaywrightSeedState = () =>
  JSON.parse(readFileSync(PLAYWRIGHT_SEED_STATE_PATH, "utf8")) as PlaywrightSeedState;
