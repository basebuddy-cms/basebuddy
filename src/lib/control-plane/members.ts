import type { ContentAuthor } from "@/lib/content-runtime/shared";

export type ProjectMemberAuthorScope = {
  canPublish?: boolean;
  cmsAuthorId: string;
};

export const normalizeProjectMemberAuthorScopeCanPublish = (value: unknown) =>
  value === false || value === "false" ? false : true;

export type ProjectMemberRecord = {
  authorScopes: ProjectMemberAuthorScope[];
  avatarUrl: string | null;
  email: string | null;
  joinedAt: string;
  name: string | null;
  roles: string[];
  userId: string;
};

export type ProjectRoleDefinition = {
  description: string;
  label: string;
  priority: number;
  roleKey: string;
};

export const DEFAULT_PROJECT_ROLE_DEFINITIONS: ProjectRoleDefinition[] = [
  {
    description: "Full project access, including delete controls.",
    label: "Owner",
    priority: 500,
    roleKey: "owner",
  },
  {
    description: "Manage the project, members, settings, and content except delete.",
    label: "Admin",
    priority: 400,
    roleKey: "admin",
  },
  {
    description: "Read, edit, and publish content across the whole project.",
    label: "Editor",
    priority: 300,
    roleKey: "editor",
  },
  {
    description: "Read, edit, and publish only assigned author content.",
    label: "Author",
    priority: 200,
    roleKey: "author",
  },
  {
    description: "Read-only access to project content.",
    label: "Viewer",
    priority: 100,
    roleKey: "viewer",
  },
];

export type ProjectMemberAuthorOption = Pick<ContentAuthor, "id" | "name" | "slug">;

export type ProjectMembersCapabilities = {
  canInviteMembers: boolean;
  canManageMembers: boolean;
};

export type ProjectMembersPayload = {
  availableAuthors: ProjectMemberAuthorOption[];
  availableRoles: ProjectRoleDefinition[];
  capabilities: ProjectMembersCapabilities;
  currentUserId: string;
  hasMoreMembers?: boolean;
  members: ProjectMemberRecord[];
  memberPage?: number;
  memberPageSize?: number;
};

export type AddProjectMemberPayload = {
  action: "add_member";
  authorScopes: ProjectMemberAuthorScope[];
  email: string;
  roles: string[];
};

export type UpdateProjectMemberPayload = {
  action: "update_member";
  authorScopes: ProjectMemberAuthorScope[];
  roles: string[];
  userId: string;
};

export type ProjectMembersMutationPayload = AddProjectMemberPayload | UpdateProjectMemberPayload;
