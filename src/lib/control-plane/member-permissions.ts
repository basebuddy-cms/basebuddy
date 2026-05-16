export type ProjectPermissionCategory =
  | "author"
  | "content"
  | "integration"
  | "mapping"
  | "member"
  | "project";

export type ProjectPermissionDefinition = {
  category: ProjectPermissionCategory;
  description: string;
  label: string;
  permissionKey: string;
};

export type ProjectMemberPermissionOverrideMode = "allow" | "deny";

export type ProjectPermissionMemberRecord = {
  allowPermissionKeys: string[];
  avatarUrl: string | null;
  denyPermissionKeys: string[];
  effectivePermissionKeys: string[];
  email: string | null;
  inheritedPermissionKeys: string[];
  joinedAt: string;
  name: string | null;
  roles: string[];
  userId: string;
};

export type ProjectPermissionsPayload = {
  currentUserId: string;
  members: ProjectPermissionMemberRecord[];
  permissions: ProjectPermissionDefinition[];
};

export type UpdateProjectMemberPermissionsPayload = {
  allowPermissionKeys: string[];
  denyPermissionKeys: string[];
  userId: string;
};

export const DEFAULT_PROJECT_PERMISSION_DEFINITIONS: ProjectPermissionDefinition[] = [
  {
    category: "project",
    description: "Open the project and read its core metadata.",
    label: "Read project",
    permissionKey: "project.read",
  },
  {
    category: "project",
    description: "Update project settings and metadata.",
    label: "Update project",
    permissionKey: "project.update",
  },
  {
    category: "project",
    description: "Delete the project and all of its saved workspace data.",
    label: "Delete project",
    permissionKey: "project.delete",
  },
  {
    category: "member",
    description: "View the list of project members and their assigned roles.",
    label: "Read members",
    permissionKey: "member.read",
  },
  {
    category: "member",
    description: "Add new members to the project.",
    label: "Invite members",
    permissionKey: "member.invite",
  },
  {
    category: "member",
    description: "Update or remove project memberships and roles.",
    label: "Manage members",
    permissionKey: "member.manage",
  },
  {
    category: "author",
    description: "Assign content author identities to members with the author role.",
    label: "Manage author scopes",
    permissionKey: "author.scope.manage",
  },
  {
    category: "content",
    description: "Read all content in the project.",
    label: "Read all content",
    permissionKey: "content.read.all",
  },
  {
    category: "content",
    description: "Read content for assigned author identities only.",
    label: "Read authored content",
    permissionKey: "content.read.authored",
  },
  {
    category: "content",
    description: "Create and edit all project content.",
    label: "Edit all content",
    permissionKey: "content.write.all",
  },
  {
    category: "content",
    description: "Create and edit content for assigned author identities only.",
    label: "Edit authored content",
    permissionKey: "content.write.authored",
  },
  {
    category: "content",
    description: "Publish any content in the project.",
    label: "Publish all content",
    permissionKey: "content.publish.all",
  },
  {
    category: "content",
    description: "Publish content for assigned author identities.",
    label: "Publish authored content",
    permissionKey: "content.publish.authored",
  },
  {
    category: "mapping",
    description: "View content setup for this project.",
    label: "View content setup",
    permissionKey: "mapping.read",
  },
  {
    category: "mapping",
    description: "Update content setup for this project.",
    label: "Update content setup",
    permissionKey: "mapping.write",
  },
];

export const DEFAULT_PROJECT_ROLE_PERMISSION_KEYS: Record<string, string[]> = {
  owner: [
    "project.read",
    "project.update",
    "project.delete",
    "member.read",
    "member.invite",
    "member.manage",
    "author.scope.manage",
    "content.read.all",
    "content.read.authored",
    "content.write.all",
    "content.write.authored",
    "content.publish.all",
    "content.publish.authored",
    "mapping.read",
    "mapping.write",
  ],
  admin: [
    "project.read",
    "project.update",
    "member.read",
    "member.invite",
    "member.manage",
    "author.scope.manage",
    "content.read.all",
    "content.write.all",
    "content.publish.all",
    "mapping.read",
    "mapping.write",
  ],
  editor: [
    "project.read",
    "content.read.all",
    "content.write.all",
    "content.publish.all",
  ],
  author: [
    "project.read",
    "content.read.authored",
    "content.write.authored",
    "content.publish.authored",
  ],
  viewer: ["project.read", "content.read.all"],
};
