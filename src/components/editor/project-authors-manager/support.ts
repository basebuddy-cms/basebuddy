import type {
  ProjectAuthorAssignment,
  ProjectAuthorsPayload,
} from "@/lib/control-plane/authors";
import { projectEditorLocalCachePrefixes } from "@/components/editor/project-editor/queries";
import {
  clearProjectEditorPersistedCacheEntries,
  readProjectEditorPersistedCacheEntry,
  writeProjectEditorPersistedCacheEntry,
} from "@/components/editor/project-editor/persisted-cache";
import type {
  ContentAuthor,
  ContentPagination,
} from "@/lib/content-runtime/shared";

export type AuthorAssignmentDraft = {
  canPublish: boolean;
  isDirty: boolean;
  originalCanPublish: boolean;
  originalUserId: string | null;
  userId: string | null;
};

export type PendingAuthorMemberAssignment = Record<string, string>;

export type PendingAuthorDelete = {
  ids: string[];
  label: string;
} | null;

export type AuthorEditorResponse = {
  entry?: ContentAuthor;
  error?: string;
};

export const defaultPagination: ContentPagination = {
  page: 1,
  pageSize: 20,
  totalItems: 0,
  totalPages: 1,
};

const authorsCacheVersion = 2;

const getAuthorsCacheKey = (projectId: string, page: number, pageSize: number) =>
  `${projectEditorLocalCachePrefixes.authorsManager(projectId, authorsCacheVersion)}${page}:${pageSize}`;

export const readCachedAuthorsPayload = (projectId: string, page: number, pageSize: number) => {
  return readProjectEditorPersistedCacheEntry<ProjectAuthorsPayload>({
    key: getAuthorsCacheKey(projectId, page, pageSize),
  });
};

export const writeCachedAuthorsPayload = (projectId: string, payload: ProjectAuthorsPayload) => {
  writeProjectEditorPersistedCacheEntry({
    key: getAuthorsCacheKey(projectId, payload.pagination.page, payload.pagination.pageSize),
    payload,
  });
};

export const clearCachedAuthorsPayloads = (projectId: string) => {
  clearProjectEditorPersistedCacheEntries(
    projectEditorLocalCachePrefixes.authorsManager(projectId, authorsCacheVersion),
  );
};

export const buildAuthorAssignmentDrafts = (
  authors: ContentAuthor[],
  assignments: ProjectAuthorAssignment[],
): Record<string, AuthorAssignmentDraft> => {
  const assignmentByAuthorId = new Map(assignments.map((assignment) => [assignment.cmsAuthorId, assignment]));

  return Object.fromEntries(
    authors.map((author) => {
      const assignment = assignmentByAuthorId.get(author.id);

      return [
        author.id,
        {
          isDirty: false,
          canPublish: assignment?.canPublish ?? true,
          originalCanPublish: assignment?.canPublish ?? true,
          originalUserId: assignment?.userId ?? null,
          userId: assignment?.userId ?? null,
        } satisfies AuthorAssignmentDraft,
      ];
    }),
  );
};

export const getAuthorsErrorMessage = async (response: Response) => {
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  return payload.error || "Could not manage project authors right now.";
};
