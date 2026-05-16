const DEFAULT_AUTH_REDIRECT = "/projects";

export const getSafeNextPath = (value: string | null | undefined) => {
  const normalizedValue = value?.trim();

  if (!normalizedValue || !normalizedValue.startsWith("/")) {
    return DEFAULT_AUTH_REDIRECT;
  }

  if (
    normalizedValue.startsWith("//") ||
    normalizedValue.includes("\\") ||
    /[\u0000-\u001F\u007F]/.test(normalizedValue)
  ) {
    return DEFAULT_AUTH_REDIRECT;
  }

  try {
    const resolvedUrl = new URL(normalizedValue, "http://localhost");

    if (resolvedUrl.origin !== "http://localhost") {
      return DEFAULT_AUTH_REDIRECT;
    }

    return `${resolvedUrl.pathname}${resolvedUrl.search}${resolvedUrl.hash}`;
  } catch {
    return DEFAULT_AUTH_REDIRECT;
  }
};

export const buildBrowserRedirectUrl = (path: string) => {
  if (typeof window === "undefined") {
    return path;
  }

  return new URL(path, window.location.origin).toString();
};
