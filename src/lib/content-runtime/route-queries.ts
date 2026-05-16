import { NextResponse } from "next/server";

import type { ContentAutoMappingResult } from "@/lib/content-runtime/introspection";
import type { ContentProjectMapping } from "@/lib/content-runtime/mapping";
import {
  getContentAuthorsPage,
  getContentCategoriesPage,
  getContentMediaPage,
  getContentPostEditorPayload,
  getContentPostRelationOptions,
  getContentPostRevisions,
  getContentPostsPage,
  getContentPostsPresence,
  getContentProjectFilesStorageCredentialStatus,
  getContentProjectMappingDetection,
  getContentProjectMappingTables,
  getContentProjectMediaStorageCredentialStatus,
  getContentProjectSupabaseStorageBuckets,
  getContentTagsPage,
  getContentWorkspaceMeta,
  getContentWorkspaceSummary,
  getStoredContentProjectMapping,
} from "@/lib/content-runtime/server";
import type {
  ContentPostEditorPayload,
  ContentPostRevisionsPayload,
  ContentPostsPage,
  ContentPostsSort,
  ContentPostsStatusFilter,
  ContentRelationFieldKey,
  ContentStorageBucketOption,
  ContentWorkspaceMeta,
  ContentWorkspaceSummary,
} from "@/lib/content-runtime/shared";
import {
  isContentRelationFieldKey,
  normalizeContentPostsSearch,
  normalizeContentPostsSort,
  normalizeContentPostsStatusFilter,
} from "@/lib/content-runtime/shared";

export type ContentRouteView =
  | "authors"
  | "categories"
  | "mapping_detection"
  | "mapping_tables"
  | "mapping"
  | "media"
  | "post"
  | "relation_options"
  | "posts_presence"
  | "post_revisions"
  | "posts"
  | "tags"
  | "workspace_counts"
  | "workspace";

const parsePositiveInteger = (value: string | null, fallback: number) => {
  const parsedValue = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
};

export const handleContentRouteGetView = async (
  request: Request,
  { projectId }: { projectId: string },
) => {
  const { searchParams } = new URL(request.url);
  const view = (searchParams.get("view") ?? "workspace") as ContentRouteView;
  const page = parsePositiveInteger(searchParams.get("page"), 1);
  const pageSize = parsePositiveInteger(searchParams.get("pageSize"), 20);
  const postsSearch = normalizeContentPostsSearch(searchParams.get("search") ?? "");
  const postsSort = normalizeContentPostsSort(searchParams.get("sort")) satisfies ContentPostsSort;
  const postsStatus =
    normalizeContentPostsStatusFilter(searchParams.get("status")) satisfies ContentPostsStatusFilter;
  const postsCursor = searchParams.get("cursor")?.trim() || null;
  const postId = searchParams.get("postId")?.trim() ?? "";
  const relationFieldKey = (searchParams.get("fieldKey")?.trim() ?? "") as ContentRelationFieldKey;
  const relationSearch = searchParams.get("search")?.trim() ?? "";
  const relationLimit = parsePositiveInteger(searchParams.get("limit"), 100);
  const relationSelectedIds = searchParams.getAll("selectedId").map((value) => value.trim()).filter(Boolean);
  const tableRef = searchParams.get("tableRef")?.trim() ?? "";
  const refreshMappingTables = ["1", "true"].includes(
    searchParams.get("refresh")?.trim().toLowerCase() ?? "",
  );
  const includeEditorOptions = !["0", "false"].includes(
    searchParams.get("includeEditorOptions")?.trim().toLowerCase() ?? "",
  );

  if (view === "workspace") {
    const workspace = await getContentWorkspaceMeta(projectId);
    return NextResponse.json(workspace satisfies ContentWorkspaceMeta);
  }

  if (view === "workspace_counts") {
    const workspaceSummary = await getContentWorkspaceSummary(projectId);
    return NextResponse.json(workspaceSummary satisfies ContentWorkspaceSummary);
  }

  if (view === "mapping") {
    const mapping = await getStoredContentProjectMapping(projectId);
    const filesStorageCredentialStatus = await getContentProjectFilesStorageCredentialStatus(projectId);
    const mediaStorageCredentialStatus = await getContentProjectMediaStorageCredentialStatus(projectId);
    const availableSupabaseBuckets = await getContentProjectSupabaseStorageBuckets(projectId);
    return NextResponse.json({
      ...mapping,
      availableSupabaseBuckets,
      filesStorageCredentialStatus,
      mediaStorageCredentialStatus,
    } satisfies ContentProjectMapping & {
      availableSupabaseBuckets: ContentStorageBucketOption[];
      filesStorageCredentialStatus: {
        hasS3AccessKeyId: boolean;
        hasS3SecretAccessKey: boolean;
      };
      mediaStorageCredentialStatus: {
        hasS3AccessKeyId: boolean;
        hasS3SecretAccessKey: boolean;
      };
    });
  }

  if (view === "mapping_detection") {
    const detection = await getContentProjectMappingDetection(projectId, {
      tableRef,
    });
    return NextResponse.json(detection satisfies ContentAutoMappingResult);
  }

  if (view === "mapping_tables") {
    const tables = await getContentProjectMappingTables(projectId, {
      refresh: refreshMappingTables,
    });
    return NextResponse.json({ tables });
  }

  if (view === "posts") {
    const postsPage = await getContentPostsPage({
      cursor: postsCursor,
      page,
      pageSize,
      projectId,
      search: postsSearch,
      sort: postsSort,
      status: postsStatus,
    });
    return NextResponse.json(postsPage satisfies ContentPostsPage);
  }

  if (view === "posts_presence") {
    const postsPresence = await getContentPostsPresence(projectId);
    return NextResponse.json(postsPresence);
  }

  if (view === "post") {
    if (!postId) {
      return NextResponse.json({ error: "Select a post first." }, { status: 400 });
    }

    const postPayload = await getContentPostEditorPayload({
      includeEditorOptions,
      postId,
      projectId,
    });
    return NextResponse.json(postPayload satisfies ContentPostEditorPayload);
  }

  if (view === "post_revisions") {
    if (!postId) {
      return NextResponse.json({ error: "Select a post first." }, { status: 400 });
    }

    const revisions = await getContentPostRevisions({
      postId,
      projectId,
    });
    return NextResponse.json({ revisions } satisfies ContentPostRevisionsPayload);
  }

  if (view === "categories") {
    const includeAllCategories = searchParams.get("includeAllCategories") === "true";
    const collectionSearch = searchParams.get("search")?.trim() ?? "";
    const categoriesPage = await getContentCategoriesPage({
      includeAllCategories,
      page,
      pageSize,
      projectId,
      search: collectionSearch,
    });
    return NextResponse.json(categoriesPage);
  }

  if (view === "tags") {
    const collectionSearch = searchParams.get("search")?.trim() ?? "";
    const tagsPage = await getContentTagsPage({
      page,
      pageSize,
      projectId,
      search: collectionSearch,
    });
    return NextResponse.json(tagsPage);
  }

  if (view === "authors") {
    const collectionSearch = searchParams.get("search")?.trim() ?? "";
    const authorsPage = await getContentAuthorsPage({
      page,
      pageSize,
      projectId,
      search: collectionSearch,
    });
    return NextResponse.json(authorsPage);
  }

  if (view === "relation_options") {
    if (!isContentRelationFieldKey(relationFieldKey)) {
      return NextResponse.json({ error: "Select a valid relation field." }, { status: 400 });
    }

    const options = await getContentPostRelationOptions({
      fieldKey: relationFieldKey,
      limit: relationLimit,
      projectId,
      search: relationSearch,
      selectedIds: relationSelectedIds,
    });
    return NextResponse.json(options);
  }

  if (view === "media") {
    const mediaPage = await getContentMediaPage({ page, pageSize, projectId });
    return NextResponse.json(mediaPage);
  }

  return NextResponse.json({ error: "Unsupported content view." }, { status: 400 });
};
