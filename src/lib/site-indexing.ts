export const isSearchIndexingEnabled = (rawValue = process.env.NEXT_PUBLIC_SITE_INDEXABLE) => {
  const normalizedValue = rawValue?.trim().toLowerCase();
  return normalizedValue === "true" || normalizedValue === "1" || normalizedValue === "yes";
};

export const getRobotsTagHeaderValue = (searchIndexingEnabled = isSearchIndexingEnabled()) =>
  searchIndexingEnabled ? null : "noindex, nofollow, noarchive, nosnippet, noimageindex";

export const getSiteRobotsMetadata = (searchIndexingEnabled = isSearchIndexingEnabled()) =>
  searchIndexingEnabled
    ? {
        follow: true,
        index: true,
      }
    : {
        follow: false,
        googleBot: {
          follow: false,
          index: false,
          noimageindex: true,
        },
        index: false,
        nocache: true,
      };

export const getSiteRobotsRules = (searchIndexingEnabled = isSearchIndexingEnabled()) =>
  searchIndexingEnabled
    ? {
        rules: {
          allow: "/",
          userAgent: "*",
        },
      }
    : {
        rules: {
          disallow: "/",
          userAgent: "*",
        },
      };
