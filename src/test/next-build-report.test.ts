import { describe, expect, it } from "vitest";

import {
  calculateNextRouteAssetReport,
  formatBytes,
  resolveNextManifestRouteKey,
} from "@/lib/performance/next-build-report";

describe("next build report", () => {
  it("calculates per-route js/css totals from a manifest and asset-size map", () => {
    const report = calculateNextRouteAssetReport({
      assetSizes: {
        "static/chunks/a.js": 10_000,
        "static/chunks/b.js": 20_000,
        "static/chunks/c.js": 5_000,
        "static/css/app.css": 3_000,
      },
      manifestPages: {
        "/layout": ["static/chunks/a.js", "static/css/app.css"],
        "/projects": ["static/chunks/a.js", "static/chunks/b.js"],
        "/onboarding": ["static/chunks/a.js", "static/chunks/c.js"],
      },
      routes: ["/projects", "/onboarding"],
    });

    expect(report).toEqual([
      {
        cssBytes: 0,
        jsBytes: 30_000,
        route: "/projects",
        totalBytes: 30_000,
      },
      {
        cssBytes: 0,
        jsBytes: 15_000,
        route: "/onboarding",
        totalBytes: 15_000,
      },
    ]);
  });

  it("matches route paths against Next app-manifest page keys", () => {
    const report = calculateNextRouteAssetReport({
      assetSizes: {
        "static/chunks/root.js": 100_000,
        "static/chunks/projects.js": 25_000,
        "static/chunks/posts.js": 50_000,
        "static/css/projects.css": 4_000,
      },
      manifestPages: {
        "/layout": ["static/chunks/root.js"],
        "/projects/page": [
          "static/chunks/root.js",
          "static/chunks/projects.js",
          "static/css/projects.css",
        ],
        "/projects/[projectSlug]/posts/page": [
          "static/chunks/root.js",
          "static/chunks/posts.js",
        ],
      },
      routes: ["/projects", "/projects/[projectSlug]/posts"],
    });

    expect(report).toEqual([
      {
        cssBytes: 4_000,
        jsBytes: 125_000,
        route: "/projects",
        totalBytes: 129_000,
      },
      {
        cssBytes: 0,
        jsBytes: 150_000,
        route: "/projects/[projectSlug]/posts",
        totalBytes: 150_000,
      },
    ]);
  });

  it("formats bytes into a compact human-readable string", () => {
    expect(formatBytes(999)).toBe("999 B");
    expect(formatBytes(2_048)).toBe("2.0 KB");
    expect(formatBytes(1_048_576)).toBe("1.0 MB");
  });

  it("resolves friendly app routes onto Next app-build-manifest page keys", () => {
    const manifestPages = {
      "/layout": [],
      "/onboarding/page": [],
      "/projects/page": [],
      "/projects/[projectSlug]/posts/page": [],
    };

    expect(resolveNextManifestRouteKey("/onboarding", manifestPages)).toBe("/onboarding/page");
    expect(resolveNextManifestRouteKey("/projects", manifestPages)).toBe("/projects/page");
    expect(resolveNextManifestRouteKey("/projects/[projectSlug]/posts", manifestPages)).toBe(
      "/projects/[projectSlug]/posts/page",
    );
  });
});
