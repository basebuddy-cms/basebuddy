import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import type { ProjectEditorShortcutId } from "@/components/editor/project-editor/keyboard-shortcuts";
import type {
  ContentCollectionCounts,
  ContentCollectionPage,
  ContentPagination,
  ContentPost,
  ContentPostSidebarConfig,
  ContentPostEditorPayload,
  ContentPostsPage,
  ContentPostRevisionsPayload,
  ContentStorageBucketOption,
  ContentWorkspaceMeta,
  ContentAuthor,
  ContentCategory,
  ContentFileItem,
  ContentMedia,
  ContentTag,
  ContentWorkspaceSummary,
} from "@/lib/content-runtime/shared";
import type {
  ContentAutoMappingResult,
  ContentIntrospectedColumn,
  ContentIntrospectedTable,
} from "@/lib/content-runtime/introspection";
import type {
  ContentCompanionContentColumn,
  ContentCustomFieldMapping,
  ContentMappingRelationStrategy,
  ContentMediaStorageProvider,
} from "@/lib/content-runtime/mapping";
import type { ContentAdapterError } from "@/lib/content-runtime/adapter/contracts";

export type CollectionLabel = "Posts" | "Media" | "Files" | "Categories" | "Tags" | "Authors";
export type SidebarItem = CollectionLabel | "Settings";
export type SettingsTabKey =
  | "general"
  | "members"
  | "invite-members"
  | "permissions"
  | "mapping"
  | "sidebar-fields";
export type TaxonomyCollectionLabel = Extract<CollectionLabel, "Categories" | "Tags">;
export type PostSidePanelView = "details" | `page:${string}`;
export type YoastResult = { id: string; score: number; text: string };
export type ProjectEditorToolbarTool = {
  icon: LucideIcon;
  label: string;
  run: () => void;
  shortcutId?: ProjectEditorShortcutId;
  shortcutLabel?: string;
};
export type ProjectEditorToolbarGroup = ProjectEditorToolbarTool[];
export type MappingSelectOption = {
  label: string;
  value: string;
};
export type SidebarCollectionEntry = {
  id: string;
  label: string;
  meta: string;
};
export type PostsMappingCustomField = {
  allowedValues: string[] | null;
  arrayIndex: number | null;
  column: string;
  dataType: string;
  defaultValue: string | null;
  enabled: boolean;
  fieldKey: string;
  isNullable: boolean;
  kind: ContentCustomFieldMapping["kind"];
  label: string;
  path: string | null;
  sampleValues: string[];
  sourceIsArray: boolean;
  sourceIsExotic: boolean;
  sourceIsJson: boolean;
};
export type ProjectEditorMappingRowRenderProps = {
  extraContent?: ReactNode;
  helperText?: string;
  label: string;
  onChange: (value: string) => void;
  options: MappingSelectOption[];
  required?: boolean;
  selectClassName?: string;
  specialOptions?: MappingSelectOption[];
  value: string;
};
export type ProjectEditorSemanticFieldState = {
  editable: boolean;
  mapped: boolean;
  visible: boolean;
};

export type ProjectEditorPostFieldStates = {
  excerpt: ProjectEditorSemanticFieldState;
  focusKeyword: ProjectEditorSemanticFieldState;
  seoDescription: ProjectEditorSemanticFieldState;
  seoTitle: ProjectEditorSemanticFieldState;
  slug: ProjectEditorSemanticFieldState;
  status: ProjectEditorSemanticFieldState;
  title: ProjectEditorSemanticFieldState;
};

export type ProjectEditorPostsListUiCapabilities = {
  showAuthorColumn: boolean;
  showSlugColumn: boolean;
  showStatusControls: boolean;
};

export type WorkspacePayload = ContentWorkspaceMeta & {
  error?: string;
};

export type WorkspaceSummaryPayload = ContentWorkspaceSummary & {
  error?: string;
};

export type PostsPagePayload = ContentPostsPage & {
  error?: string;
};

export type CollectionPagePayload<T> = ContentCollectionPage<T> & {
  error?: string;
};

export type MappingDetectionPayload = ContentAutoMappingResult & {
  error?: string;
};

export type MappingTableCatalogEntry = {
  columnCount: number;
  kind: ContentIntrospectedTable["kind"];
  primaryKey: string | null;
  rowCountEstimate: number | null;
  schema: string;
  table: string;
  tableRef: string;
};

export type CreateCollectionResponse = {
  entry?: ContentAuthor | ContentCategory | ContentTag;
  error?: string;
};

export type EditingTaxonomyEntry = {
  collection: TaxonomyCollectionLabel;
  entryId: string;
};

export type DeleteCollectionResponse = {
  error?: string;
  success?: boolean;
};

export type DeleteProjectResponse = {
  error?: string;
  success?: boolean;
};

export type DiscardPostResponse = {
  error?: string;
  success?: boolean;
};

export type UpdatePostResponse = {
  error?: string;
  errors?: ContentAdapterError[];
  post?: ContentPost;
};

export type PostRevisionsResponse = ContentPostRevisionsPayload & {
  error?: string;
};

export type UpdateProjectSettingsResponse = {
  error?: string;
  project?: {
    id: string;
    name: string;
    slug: string;
    websiteUrl: string | null;
  };
};

export type UpdateProjectPostSidebarConfigResponse = {
  error?: string;
  postSidebarConfig?: ContentPostSidebarConfig;
};

export type PendingTaxonomyDelete = {
  collection: TaxonomyCollectionLabel;
  ids: string[];
  label: string;
};

export type PendingPostsDelete = {
  ids: string[];
  label: string;
};

export type PostsMappingRelationDraft = {
  column: string;
  displayColumns: string[];
  fieldMap: Record<string, string>;
  joinSourceColumn: string;
  joinTableRef: string;
  joinTargetColumn: string;
  strategy: ContentMappingRelationStrategy | "missing";
  targetColumn: string;
  targetTableRef: string;
  valueColumn: string;
};

export type PostsMappingFieldOptionKey =
  | "contentColumn"
  | "createdAtColumn"
  | "excerptColumn"
  | "featuredImageUrlColumn"
  | "focusKeywordColumn"
  | "idColumn"
  | "publishedAtColumn"
  | "redirectsColumn"
  | "seoDescriptionColumn"
  | "seoTitleColumn"
  | "slugColumn"
  | "statusColumn"
  | "titleColumn"
  | "updatedAtColumn";

export type PostsMappingFieldOptionDraft = {
  arrayItemIndex: string;
  jsonPath: string;
  relatedColumns: string[];
  relatedTableRef: string;
};

export type PostsMappingBooleanStatusMode = "false_is_published" | "true_is_published";
export type PostsMappingRelationKey = "author" | "categories" | "tags";
export type PostsRelationFieldKey = "author" | "categories" | "tags";
export type PostsRelationEntityKey = "authors" | "categories" | "tags";

export type PostsMediaStorageDraft = {
  bucketName: string;
  endpoint: string;
  hasStoredCredentials: boolean;
  provider: ContentMediaStorageProvider;
  publicUrlBase: string;
  region: string;
};

export type PostsMappingContentKind = "html" | "json" | "markdown" | "plain_text";

export type PostsMappingDraftState = {
  archivedValues: string[];
  author: PostsMappingRelationDraft;
  categories: PostsMappingRelationDraft;
  contentColumns: string[];
  contentFieldOptions: PostsMappingFieldOptionDraft[];
  contentColumnKinds: PostsMappingContentKind[];
  contentKind: PostsMappingContentKind;
  createdAtColumn: string;
  customFields: ContentCustomFieldMapping[];
  draftValues: string[];
  excerptColumn: string;
  featuredImageUrlColumn: string;
  fieldOptions: Record<PostsMappingFieldOptionKey, PostsMappingFieldOptionDraft>;
  focusKeywordColumn: string;
  filesStorage: PostsMediaStorageDraft;
  idColumn: string;
  legacyCompanionContentColumns: ContentCompanionContentColumn[];
  mediaStorage: PostsMediaStorageDraft;
  publishedAtColumn: string;
  publishedValues: string[];
  redirectsColumn: string;
  seoDescriptionColumn: string;
  seoTitleColumn: string;
  slugColumn: string;
  statusBooleanMode: PostsMappingBooleanStatusMode;
  statusColumn: string;
  tableRef: string;
  tags: PostsMappingRelationDraft;
  titleColumn: string;
  updatedAtColumn: string;
};

export type ProjectEditorIntrospectedColumn = ContentIntrospectedColumn;
export type ProjectEditorIntrospectedTable = ContentIntrospectedTable;
export type ProjectEditorCollectionCounts = ContentCollectionCounts;
export type ProjectEditorPagination = ContentPagination;
export type ProjectEditorPostEditorPayload = ContentPostEditorPayload;
export type ProjectEditorMedia = ContentMedia;
export type ProjectEditorFile = ContentFileItem;
export type ProjectEditorStorageBucketOption = ContentStorageBucketOption;
