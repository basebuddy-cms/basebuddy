import type { CollectionLabel } from "@/components/editor/project-editor/types";
import type { LoadingSequenceMessage } from "@/components/ui/loading-sequence-screen";
import type { ContentEntityMapping, ContentMappingConfig } from "@/lib/content-runtime/mapping";

export type PostsMappingSaveMode = "initial" | "update";

export type PostsMappingSaveMessage = LoadingSequenceMessage;

const hasMappedRelation = (
  postsEntity: ContentEntityMapping,
  relation: "author" | "categories" | "tags",
) => {
  const mapping = postsEntity.relations[relation];
  return Boolean(
    mapping &&
      mapping.status !== "unmapped" &&
      mapping.strategy !== "missing" &&
      mapping.strategy !== "none",
  );
};

const formatNaturalList = (items: string[]) => {
  if (items.length <= 1) {
    return items[0] ?? "";
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
};

const buildCoreFieldLabels = (postsEntity: ContentEntityMapping) => {
  const fieldLabels = [
    postsEntity.fields.title.column ? "title" : null,
    postsEntity.fields.slug.column ? "slug" : null,
    postsEntity.editorFields.length > 0 ? "content" : null,
    postsEntity.workflow?.statusColumn || postsEntity.workflow?.publishedAtColumn ? "workflow" : null,
  ].filter(Boolean) as string[];

  return fieldLabels.length > 0 ? fieldLabels : ["content"];
};

const buildFieldDetail = (postsEntity: ContentEntityMapping, mode: PostsMappingSaveMode) => {
  const verb = mode === "update" ? "Reviewing" : "Checking";
  return `${verb} ${formatNaturalList(buildCoreFieldLabels(postsEntity))} fields.`;
};

const buildRelatedContentDetail = (postsEntity: ContentEntityMapping) => {
  const relatedItems = [
    hasMappedRelation(postsEntity, "author") ? "authors" : null,
    hasMappedRelation(postsEntity, "categories") ? "categories" : null,
    hasMappedRelation(postsEntity, "tags") ? "tags" : null,
    postsEntity.fields.featuredImageUrl?.column ? "featured images" : null,
  ].filter(Boolean) as string[];

  if (relatedItems.length > 0) {
    return `Checking ${formatNaturalList(relatedItems)} for this mapping.`;
  }

  return "Preparing the editor with this mapping.";
};

export const getPostsMappingSaveMessages = ({
  collection,
  mappingConfig,
  mode,
  projectName,
}: {
  collection: CollectionLabel;
  mappingConfig: ContentMappingConfig;
  mode: PostsMappingSaveMode;
  projectName: string;
}): PostsMappingSaveMessage[] => {
  if (collection === "Media") {
    const bucketLabel = mappingConfig.mediaStorage?.bucketName?.trim() || "your media storage";
    const normalizedProjectName = projectName.trim() || "your project";

    return [
      {
        detail: "Saving media library storage.",
        title: "Saving media storage",
      },
      {
        detail: `Checking upload access for ${bucketLabel}.`,
        title: "Checking media storage",
      },
      {
        detail: "Reloading the media library with the saved mapping.",
        title: "Refreshing media library",
      },
      {
        detail: "Almost there.",
        title: `Opening ${normalizedProjectName}`,
      },
    ];
  }

  if (collection === "Files") {
    const bucketLabel = mappingConfig.filesStorage?.bucketName?.trim() || "your files storage";
    const normalizedProjectName = projectName.trim() || "your project";

    return [
      {
        detail: "Saving files library storage.",
        title: "Saving files storage",
      },
      {
        detail: `Checking upload access for ${bucketLabel}.`,
        title: "Checking files storage",
      },
      {
        detail: "Reloading the files library with the saved mapping.",
        title: "Refreshing files library",
      },
      {
        detail: "Almost there.",
        title: `Opening ${normalizedProjectName}`,
      },
    ];
  }

  if (collection === "Authors" || collection === "Categories" || collection === "Tags") {
    const relationLabel =
      collection === "Authors" ? "author" : collection === "Categories" ? "category" : "tag";
    const normalizedProjectName = projectName.trim() || "your project";

    return [
      {
        detail: `Saving the ${relationLabel} mapping for your project.`,
        title: `Saving ${relationLabel} mapping`,
      },
      {
        detail: `Checking the related ${relationLabel} connection on posts.`,
        title: `Checking ${relationLabel} relation`,
      },
      {
        detail: "Reloading the editor with the saved mapping.",
        title: "Refreshing editor",
      },
      {
        detail: "Almost there.",
        title: `Opening ${normalizedProjectName}`,
      },
    ];
  }

  const postsEntity = mappingConfig.entities.posts;
  const normalizedProjectName = projectName.trim() || "your project";

  return [
    {
      detail: "Saving the connected post mapping.",
      title: mode === "update" ? "Saving mapping changes" : "Saving content mapping",
    },
    {
      detail: buildFieldDetail(postsEntity, mode),
      title: mode === "update" ? "Checking updated fields" : "Checking post fields",
    },
    {
      detail: buildRelatedContentDetail(postsEntity),
      title: "Checking related content",
    },
    {
      detail: "Reloading the editor with the saved mapping.",
      title: "Refreshing editor",
    },
    {
      detail: "Almost there.",
      title: `Opening ${normalizedProjectName}`,
    },
  ];
};
