import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import {
  calculateNextRouteAssetReport,
  formatBytes,
} from "../src/lib/performance/next-build-report";

type NextAppBuildManifest = {
  pages: Record<string, string[]>;
};

const cwd = process.cwd();
const nextDir = path.join(cwd, ".next");
const manifestPath = path.join(nextDir, "app-build-manifest.json");
const buildManifestPath = path.join(nextDir, "build-manifest.json");

if (!existsSync(manifestPath) || !existsSync(buildManifestPath)) {
  throw new Error(
    `Could not find the Next build manifests under ${nextDir}. Run "pnpm run build:e2e" or "pnpm perf:build" first.`,
  );
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as NextAppBuildManifest;

const routes = process.argv.slice(2).filter((value) => value !== "--");
const defaultRoutes = [
  "/layout",
  "/onboarding",
  "/projects",
  "/projects/[projectSlug]/posts",
  "/projects/[projectSlug]/posts/[postId]",
  "/settings/profile",
];
const selectedRoutes = routes.length ? routes : defaultRoutes;

const assetPaths = new Set(
  Object.values(manifest.pages)
    .flatMap((assets) => assets)
    .filter(Boolean),
);

const assetSizes = Object.fromEntries(
  [...assetPaths].map((assetPath) => {
    const absolutePath = path.join(nextDir, assetPath);
    return [assetPath, statSync(absolutePath).size];
  }),
);

const report = calculateNextRouteAssetReport({
  assetSizes,
  manifestPages: manifest.pages,
  routes: selectedRoutes,
});

console.log("Next app bundle report");
console.log(`Manifest: ${manifestPath}`);
console.log("");

for (const entry of report) {
  console.log(
    `${entry.route}
  total: ${formatBytes(entry.totalBytes)}
  js: ${formatBytes(entry.jsBytes)}
  css: ${formatBytes(entry.cssBytes)}`,
  );
}
