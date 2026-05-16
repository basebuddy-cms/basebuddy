export type NextRouteAssetReportRow = {
  cssBytes: number;
  jsBytes: number;
  route: string;
  totalBytes: number;
};

export const resolveNextManifestRouteKey = (
  route: string,
  manifestPages: Record<string, string[]>,
) => {
  if (manifestPages[route]) {
    return route;
  }

  if (route === "/") {
    return manifestPages["/page"] ? "/page" : route;
  }

  const pageRoute = `${route}/page`;

  if (manifestPages[pageRoute]) {
    return pageRoute;
  }

  return route;
};

export const formatBytes = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const calculateNextRouteAssetReport = ({
  assetSizes,
  manifestPages,
  routes,
}: {
  assetSizes: Record<string, number>;
  manifestPages: Record<string, string[]>;
  routes: string[];
}): NextRouteAssetReportRow[] =>
  routes.map((route) => {
    const resolvedRoute = resolveNextManifestRouteKey(route, manifestPages);
    const assets = manifestPages[resolvedRoute] ?? [];
    let cssBytes = 0;
    let jsBytes = 0;

    for (const assetPath of assets) {
      const size = assetSizes[assetPath] ?? 0;

      if (assetPath.endsWith(".css")) {
        cssBytes += size;
      } else if (assetPath.endsWith(".js")) {
        jsBytes += size;
      }
    }

    return {
      cssBytes,
      jsBytes,
      route,
      totalBytes: cssBytes + jsBytes,
    };
  });
