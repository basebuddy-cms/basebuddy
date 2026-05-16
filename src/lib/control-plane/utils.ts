export const PROJECT_ROLES = ["owner", "admin", "editor", "author", "viewer"] as const;

export type ProjectRole = (typeof PROJECT_ROLES)[number];

const PROJECT_ROLE_PRIORITY: Record<ProjectRole, number> = {
  admin: 400,
  author: 200,
  editor: 300,
  owner: 500,
  viewer: 100,
};

export const isProjectRole = (value: string): value is ProjectRole =>
  PROJECT_ROLES.includes(value as ProjectRole);

export const getHighestProjectRole = (
  roles: ReadonlyArray<string | null | undefined>,
): ProjectRole | null => {
  let highestRole: ProjectRole | null = null;
  let highestPriority = 0;

  for (const role of roles) {
    if (!role || !isProjectRole(role)) {
      continue;
    }

    const priority = PROJECT_ROLE_PRIORITY[role];

    if (priority > highestPriority) {
      highestRole = role;
      highestPriority = priority;
    }
  }

  return highestRole;
};

export const normalizeProjectSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const getProjectSlug = (name: string, customSlug?: string | null) =>
  normalizeProjectSlug(customSlug?.trim() || name);

const PROJECT_WEBSITE_PROTOCOLS = new Set(["http:", "https:"]);

export const normalizeProjectWebsiteUrl = (value: string | null | undefined) => {
  const trimmedValue = value?.trim() ?? "";

  if (!trimmedValue) {
    return null;
  }

  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmedValue)
    ? trimmedValue
    : `https://${trimmedValue}`;

  try {
    const url = new URL(candidate);

    if (!PROJECT_WEBSITE_PROTOCOLS.has(url.protocol)) {
      return null;
    }

    url.hash = "";

    if (url.pathname === "/" && !url.search) {
      url.pathname = "";
    }

    return url.toString();
  } catch {
    return null;
  }
};

export const getUserDisplayName = (
  email: string | null | undefined,
  preferredName?: string | null,
) => {
  const trimmedPreferredName = preferredName?.trim();

  if (trimmedPreferredName) {
    return trimmedPreferredName;
  }

  const emailName = email?.split("@")[0]?.replace(/[.\-_]+/g, " ").trim();

  if (!emailName) {
    return "BaseBuddy User";
  }

  return (
    emailName
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || "BaseBuddy User"
  );
};

export const getUserInitials = (email: string | null | undefined, preferredName?: string | null) => {
  const trimmedPreferredName = preferredName?.trim();

  if (trimmedPreferredName) {
    const nameInitials = trimmedPreferredName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");

    if (nameInitials) {
      return nameInitials;
    }
  }

  if (!email) {
    return "SP";
  }

  return email
    .split("@")[0]
    .split(/[.\-_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "SP";
};

export const formatProjectDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));

export const getProjectRoleLabel = (role: ProjectRole) =>
  role.charAt(0).toUpperCase() + role.slice(1);
