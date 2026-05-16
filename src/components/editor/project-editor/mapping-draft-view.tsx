"use client";

import type { LucideIcon } from "lucide-react";
import React from "react";

import type { CollectionLabel } from "@/components/editor/project-editor/types";
import {
  formatMappingLabel,
  formatMappingValue,
  getMappingStatusBadgeClassName,
} from "@/components/editor/project-editor/utils";
import type {
  ContentEntityMapping,
  ContentMappedField,
  ContentPostWorkflowMapping,
  ContentRelationMapping,
} from "@/lib/content-runtime/mapping";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ProjectEditorPostsMappingDraftEntryProps = {
  actionLabel?: string;
  canUpdateProject: boolean;
  onOpenMappingDialog: () => void;
};

type ProjectEditorMappingDraftCollectionCardProps = {
  canUpdateProject: boolean;
  description: string;
  icon: LucideIcon;
  loadingMappingDetection: boolean;
  mappingDetectionError: string | null;
  selectedCollection: CollectionLabel;
  selectedDetectedMapping: ContentEntityMapping;
};

type ProjectEditorContentCollectionSetupCardProps = {
  actionLabel: string;
  canUpdateProject: boolean;
  description: string;
  icon: LucideIcon;
  onOpenMappingDialog: () => void;
  title: string;
};

export function ProjectEditorPostsMappingDraftEntry({
  actionLabel = "Map Posts",
  canUpdateProject,
  onOpenMappingDialog,
}: ProjectEditorPostsMappingDraftEntryProps) {
  return (
    <div className="mx-auto flex min-h-full max-w-6xl items-center px-10 py-12">
      <div className="w-full py-12 text-center">
        {canUpdateProject ? (
          <Button variant="hero" size="sm" className="gap-2" onClick={onOpenMappingDialog}>
            {actionLabel}
          </Button>
        ) : (
          <div className="mx-auto max-w-xl rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Only project owners and admins can review or update content mapping.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function ProjectEditorMappingDraftCollectionCard({
  canUpdateProject,
  description,
  icon: Icon,
  loadingMappingDetection,
  mappingDetectionError,
  selectedCollection,
  selectedDetectedMapping,
}: ProjectEditorMappingDraftCollectionCardProps) {
  if (!canUpdateProject) {
    return (
      <div className="mx-auto flex h-full w-full max-w-3xl items-start px-8 py-10">
        <Card className="w-full">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Only project owners and admins can review or update content mapping.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sourceTableName = selectedDetectedMapping.source.table?.trim() || selectedCollection.toLowerCase();
  const sourceRef =
    selectedDetectedMapping.source.schema && selectedDetectedMapping.source.table
      ? `${selectedDetectedMapping.source.schema}.${selectedDetectedMapping.source.table}`
      : formatMappingValue(selectedDetectedMapping.source.table);
  const bullets: string[] = [];

  const formatSourceColumn = (column: string | null | undefined) =>
    column ? `${sourceTableName}.${column}` : "not detected";

  const formatFieldBullet = (label: string, fieldKey: string) => {
    const field = selectedDetectedMapping.fields[fieldKey] as ContentMappedField | undefined;

    if (!field) {
      return;
    }

    bullets.push(`${label}: ${formatSourceColumn(field.column)}`);
  };

  const hasDetectedWorkflow = (workflow: ContentPostWorkflowMapping | null) =>
    Boolean(workflow && (workflow.statusColumn || workflow.publishedFlagColumn || workflow.publishedAtColumn));

  const formatRelationBullet = (label: string, relation: ContentRelationMapping | undefined) => {
    if (!relation || relation.strategy === "none" || relation.status === "unmapped") {
      bullets.push(`${label}: not detected`);
      return;
    }

    const targetRef = relation.targetTable
      ? `${relation.targetTable}${relation.targetColumn ? `.${relation.targetColumn}` : ""}`
      : relation.targetEntity
        ? formatMappingLabel(relation.targetEntity).toLowerCase()
        : "target";
    const fieldMap = Object.entries(relation.fieldMap ?? {})
      .map(([fieldKey, column]) => `${fieldKey}: ${sourceTableName}.${column}`)
      .join(", ");

    if (relation.strategy === "foreign_key") {
      bullets.push(`${label}: ${formatSourceColumn(relation.sourceColumn)} - FK to ${targetRef}`);
      return;
    }

    if (relation.strategy === "join_table") {
      bullets.push(
        `${label}: stored in another table - connected with ${relation.junctionTable ?? "not detected"}${
          relation.targetTable ? ` to ${relation.targetTable}` : ""
        }`,
      );
      return;
    }

    if (relation.strategy === "array") {
      bullets.push(`${label}: stored as array in ${formatSourceColumn(relation.sourceColumn)}`);
      return;
    }

    if (relation.strategy === "json_array") {
      bullets.push(`${label}: stored as JSON array in ${formatSourceColumn(relation.sourceColumn)}`);
      return;
    }

    if (relation.strategy === "json_object") {
      bullets.push(`${label}: stored as JSON object in ${formatSourceColumn(relation.sourceColumn)}`);
      return;
    }

    if (relation.strategy === "inline_fields") {
      bullets.push(`${label}: stored inline on ${sourceTableName}${fieldMap ? ` (${fieldMap})` : ""}`);
      return;
    }

    if (relation.strategy === "derived_distinct") {
      bullets.push(`${label}: derived from ${formatSourceColumn(relation.sourceColumn)}`);
      return;
    }

    bullets.push(`${label}: ${formatMappingLabel(relation.strategy).toLowerCase()}`);
  };

  const sourceLabel =
    selectedDetectedMapping.source.kind === "table"
      ? "table"
      : selectedDetectedMapping.source.kind === "view"
        ? "view"
        : "source";

  bullets.push(`${sourceLabel}: ${sourceRef}`);

  if (selectedCollection === "Posts") {
    formatFieldBullet("id", "id");
    formatFieldBullet("title", "title");

    if (selectedDetectedMapping.editorFields.length === 1) {
      bullets.push(`content: ${formatSourceColumn(selectedDetectedMapping.editorFields[0]?.column)}`);
    } else if (selectedDetectedMapping.editorFields.length > 1) {
      bullets.push(
        `content fields: ${selectedDetectedMapping.editorFields
          .map((field) => formatSourceColumn(field.column))
          .join(", ")}`,
      );
    } else {
      bullets.push("content: not detected");
    }

    formatFieldBullet("slug", "slug");
    formatFieldBullet("excerpt", "excerpt");
    formatFieldBullet("featured image", "featuredImageUrl");
    formatRelationBullet("author", selectedDetectedMapping.relations.authors);
    formatRelationBullet("categories", selectedDetectedMapping.relations.categories);
    formatRelationBullet("tags", selectedDetectedMapping.relations.tags);

    if (hasDetectedWorkflow(selectedDetectedMapping.workflow)) {
      const workflowParts = [
        selectedDetectedMapping.workflow?.statusColumn
          ? `status from ${formatSourceColumn(selectedDetectedMapping.workflow.statusColumn)}`
          : null,
        selectedDetectedMapping.workflow?.publishedFlagColumn
          ? `published flag ${formatSourceColumn(selectedDetectedMapping.workflow.publishedFlagColumn)}`
          : null,
        selectedDetectedMapping.workflow?.publishedAtColumn
          ? `published at ${formatSourceColumn(selectedDetectedMapping.workflow.publishedAtColumn)}`
          : null,
      ].filter(Boolean);

      bullets.push(`workflow: ${workflowParts.join("; ")}`);
    }
  }

  if (selectedCollection === "Authors") {
    formatFieldBullet("id", "id");
    formatFieldBullet("name", "name");
    formatFieldBullet("email", "email");
    formatFieldBullet("bio", "bio");
    formatFieldBullet("slug", "slug");
  }

  if (selectedCollection === "Categories") {
    formatFieldBullet("id", "id");
    formatFieldBullet("name", "name");
    formatFieldBullet("slug", "slug");
    formatFieldBullet("description", "description");
    formatFieldBullet("parent", "parentId");
  }

  if (selectedCollection === "Tags") {
    formatFieldBullet("id", "id");
    formatFieldBullet("name", "name");
    formatFieldBullet("slug", "slug");
    formatFieldBullet("description", "description");
  }

  if (selectedCollection === "Media") {
    formatFieldBullet("id", "id");
    formatFieldBullet("title", "title");
    formatFieldBullet("object path", "objectPath");
    formatFieldBullet("url", "url");
    formatFieldBullet("alt text", "altText");
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl items-start px-8 py-10">
      <Card className="w-full">
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <CardTitle>{selectedCollection} mapping</CardTitle>
              </div>
              <CardDescription>{description}</CardDescription>
            </div>
            <Badge className={getMappingStatusBadgeClassName(selectedDetectedMapping.status)}>
              {selectedDetectedMapping.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loadingMappingDetection ? (
            <p className="text-sm text-muted-foreground">Checking this section.</p>
          ) : null}

          {!loadingMappingDetection && mappingDetectionError ? (
            <p className="text-sm text-muted-foreground">{mappingDetectionError}</p>
          ) : null}

          {!loadingMappingDetection && !mappingDetectionError ? (
            <div className="space-y-4">
              <p className="text-sm leading-6 text-muted-foreground">
                BaseBuddy found a possible mapping for this section. Review the details before saving.
              </p>
              <details className="rounded-md border border-border bg-secondary/40 px-4 py-3">
                <summary className="cursor-pointer text-sm font-medium text-foreground">
                  Detected field details
                </summary>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-foreground">
                  {bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </details>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export function ProjectEditorContentCollectionSetupCard({
  actionLabel,
  canUpdateProject,
  description,
  icon: Icon,
  onOpenMappingDialog,
  title,
}: ProjectEditorContentCollectionSetupCardProps) {
  return (
    <div className="mx-auto flex h-full w-full max-w-3xl items-start px-8 py-10">
      <Card className="w-full">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <CardTitle>{title}</CardTitle>
          </div>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canUpdateProject ? (
            <>
              <p className="text-sm text-muted-foreground">
                Finish this section mapping to make it available in the editor.
              </p>
              <Button variant="hero" size="sm" onClick={onOpenMappingDialog}>
                {actionLabel}
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Ask a project owner or admin to finish mapping before you use this section.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
