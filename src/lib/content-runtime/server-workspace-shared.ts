import "server-only";

import type { Client } from "pg";

import { type ProjectContentAction, type ProjectMemberAccess } from "@/lib/control-plane/permissions";

import { buildGeneratedContentAuthorScopePredicate } from "./adapter/generated-query-builders";
import type { ContentProjectMapping } from "./mapping";
import type {
  ContentPostSidebarConfig,
  ContentPrimaryContentFormat,
  ContentSnapshot,
  ContentWorkspaceMeta,
} from "./shared";

export type ContentDatabaseClient = Pick<Client, "query">;

export type ContentCountRow = {
  count: string;
};

export type SnapshotResponse = ContentSnapshot & {
  message?: string;
};

export type ContentProjectContext = {
  apiUrl: string | null;
  connectionString: string | null;
  memberAccess: ProjectMemberAccess;
  projectSlug: string;
  schemaOptions: {
    enableRevisions: boolean;
    primaryContentFormat: ContentPrimaryContentFormat;
  };
};

export type ContentMediaCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
};

export type ProjectPostAuthorAssignment = {
  avatar_url: string | null;
  cms_author_id: string;
  email: string | null;
  name: string | null;
  user_id: string | null;
};

export type WorkspaceDependencies = {
  ensureContentPermission: (
    context: ContentProjectContext,
    action: ProjectContentAction,
  ) => string[] | null;
  ensureDirectConnectionForMappedRuntime: (context: ContentProjectContext) => void;
  getProjectContext: (projectId: string) => Promise<ContentProjectContext | null>;
  getContentS3CompatibleFilesCredentials: (
    projectId: string,
  ) => Promise<ContentMediaCredentials | null>;
  getContentS3CompatibleMediaCredentials: (
    projectId: string,
  ) => Promise<ContentMediaCredentials | null>;
  getContentStorageServiceKey: (projectId: string) => Promise<string | null>;
  getProjectPostSidebarConfig: (
    projectId: string,
  ) => Promise<ContentPostSidebarConfig>;
  getProjectPostAuthorAssignments: (
    projectId: string,
  ) => Promise<Map<string, ProjectPostAuthorAssignment>>;
  getBootstrapContentProjectMapping: ({
    context,
    projectId,
  }: {
    context: ContentProjectContext;
    projectId: string;
  }) => Promise<ContentProjectMapping | null>;
  getReadyContentProjectMapping: ({
    context,
    projectId,
  }: {
    context: ContentProjectContext;
    projectId: string;
  }) => Promise<ContentProjectMapping | null>;
  withContentDatabaseClient: <T>(
    connectionString: string,
    handler: (client: ContentDatabaseClient) => Promise<T>,
  ) => Promise<T>;
};

export const buildContentAuthorFilter = ({
  accessibleAuthorIds,
  alias,
  parameterIndex,
  where,
}: {
  accessibleAuthorIds: string[] | null;
  alias: string;
  parameterIndex: number;
  where?: boolean;
}) => {
  if (accessibleAuthorIds === null) {
    return {
      clause: "",
      params: [] as unknown[],
    };
  }

  return {
    clause: `${where ? "where" : "and"} ${buildGeneratedContentAuthorScopePredicate({
      alias,
      parameterIndex,
    })}`,
    params: [accessibleAuthorIds],
  };
};

export const createWorkspaceCapabilities = (
  context: ContentProjectContext,
): ContentWorkspaceMeta["capabilities"] => ({
  canManageAuthors: context.memberAccess.permissions.includes("author.scope.manage"),
  canManageTaxonomy:
    context.memberAccess.permissions.includes("project.update") ||
    context.memberAccess.permissions.includes("content.write.all"),
});
