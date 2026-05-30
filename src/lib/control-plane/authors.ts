import type {
  ContentAuthor,
  ContentDatabaseReadAccessNotice,
  ContentPagination,
} from "@/lib/content-runtime/shared";

export type ProjectAuthorMember = {
  avatarUrl: string | null;
  email: string | null;
  name: string | null;
  userId: string;
};

export type ProjectAuthorAssignment = {
  canPublish: boolean;
  cmsAuthorId: string;
  userId: string | null;
};

export type ProjectAuthorsPayload = {
  accessNotice?: ContentDatabaseReadAccessNotice | null;
  assignments?: ProjectAuthorAssignment[];
  authorMembers?: ProjectAuthorMember[];
  authors: ContentAuthor[];
  pagination: ContentPagination;
};

export type CreateProjectAuthorPayload = {
  action: "create_author";
  assignUserId?: string | null;
  bio?: string | null;
  email?: string | null;
  name: string;
  slug?: string | null;
};

export type SetProjectAuthorAssignmentPayload = {
  action: "set_author_assignment";
  canPublish?: boolean;
  cmsAuthorId: string;
  userId: string | null;
};

export type DeleteProjectAuthorsPayload = {
  entryIds: string[];
};
