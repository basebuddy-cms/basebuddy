"use client";

import React, { type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, Database } from "lucide-react";

import { BaseBuddyWordmark } from "@/components/basebuddy-mark";
import {
  postsMappingSteps,
  type PostsMappingStep,
} from "@/components/editor/project-editor/constants";
import type { PostsMappingSaveMessage } from "@/components/editor/project-editor/posts-mapping-save-messages";
import type {
  PostsMappingCustomField,
  PostsMediaStorageDraft,
  ProjectEditorStorageBucketOption,
} from "@/components/editor/project-editor/types";
import type {
  ContentMappingFieldKind,
  ContentMediaStorageProvider,
} from "@/lib/content-runtime/mapping";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSequenceScreen } from "@/components/ui/loading-sequence-screen";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type ProjectEditorPostsMappingWizardProps = {
  children?: ReactNode;
  currentProjectName: string;
  currentStepDescription: string;
  currentStepTitle: string;
  onFinish: () => void;
  onNext: () => void;
  onPrevious: () => void;
  postsMappingStepIndex: number;
  savingMessages?: PostsMappingSaveMessage[] | null;
  savingPostsMapping: boolean;
  statusChildren?: ReactNode;
  statusMessage?: string | null;
  steps?: ReadonlyArray<PostsMappingStep>;
};

type ProjectEditorPostsMappingMediaStorageStepProps = {
  availableSupabaseBuckets: ProjectEditorStorageBucketOption[];
  filesStorage: PostsMediaStorageDraft;
  onFilesBucketNameChange: (value: string) => void;
  onFilesEndpointChange: (value: string) => void;
  onFilesProviderChange: (provider: ContentMediaStorageProvider) => void;
  onFilesPublicUrlBaseChange: (value: string) => void;
  onFilesRegionChange: (value: string) => void;
  mediaStorage: PostsMediaStorageDraft;
  onBucketNameChange: (value: string) => void;
  onEndpointChange: (value: string) => void;
  onProviderChange: (provider: ContentMediaStorageProvider) => void;
  onPublicUrlBaseChange: (value: string) => void;
  onRegionChange: (value: string) => void;
  visibleStorage?: "both" | "files" | "media";
};

type ProjectEditorPostsMappingCustomFieldsStepProps = {
  customFields: PostsMappingCustomField[];
  onToggleField: (column: string, enabled: boolean) => void;
  onUpdateFieldArrayIndex: (column: string, value: string | null) => void;
  onUpdateFieldKind: (column: string, value: ContentMappingFieldKind) => void;
  onUpdateFieldPath: (column: string, value: string) => void;
};

const buildCustomFieldKindLabel = (kind: ContentMappingFieldKind) =>
  kind
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const getCustomFieldKindOptions = ({
  field,
  showItemKindOptions,
  showJsonKindOptions,
}: {
  field: PostsMappingCustomField;
  showItemKindOptions: boolean;
  showJsonKindOptions: boolean;
}) => {
  const options: ContentMappingFieldKind[] = showJsonKindOptions
    ? ["text", "plain_text", "number", "boolean", "date", "datetime", "json"]
    : showItemKindOptions
      ? ["text", "plain_text", "number", "boolean", "date", "datetime"]
      : [];

  return options.includes(field.kind) ? options : [field.kind, ...options];
};

export const getPostsMappingSupabaseBucketOptionLabel = (
  bucket: ProjectEditorStorageBucketOption,
) => {
  const visibilityLabel = bucket.isPublic ? "Public" : "Private";

  if (bucket.name === bucket.id) {
    return `${bucket.id} (${visibilityLabel})`;
  }

  return `${bucket.name} (${bucket.id}, ${visibilityLabel})`;
};

export const getPostsMappingSupabaseBucketOptions = ({
  availableSupabaseBuckets,
  currentBucketName,
}: {
  availableSupabaseBuckets: ProjectEditorStorageBucketOption[];
  currentBucketName: string;
}) => {
  const normalizedCurrentBucketName = currentBucketName.trim();
  const options = availableSupabaseBuckets.map((bucket) => ({
    label: getPostsMappingSupabaseBucketOptionLabel(bucket),
    value: bucket.id,
  }));

  if (
    normalizedCurrentBucketName &&
    !options.some((bucket) => bucket.value === normalizedCurrentBucketName)
  ) {
    options.unshift({
      label: `${normalizedCurrentBucketName} (Current selection)`,
      value: normalizedCurrentBucketName,
    });
  }

  return options;
};

const scorePostsMappingStorageBucket = ({
  bucket,
  kind,
}: {
  bucket: ProjectEditorStorageBucketOption;
  kind: "files" | "media";
}) => {
  const haystack = `${bucket.id} ${bucket.name}`.toLowerCase();
  let score = 0;

  const mediaPatterns = [
    /\bmedia\b/,
    /\bimage\b/,
    /\bimages\b/,
    /\basset\b/,
    /\bassets\b/,
    /\bphoto\b/,
    /\bphotos\b/,
    /\bgallery\b/,
  ];
  const filesPatterns = [
    /\bfile\b/,
    /\bfiles\b/,
    /\bdoc\b/,
    /\bdocs\b/,
    /\bdocument\b/,
    /\bdocuments\b/,
    /\bdownload\b/,
    /\bdownloads\b/,
    /\battachment\b/,
    /\battachments\b/,
  ];
  const preferredPatterns = kind === "media" ? mediaPatterns : filesPatterns;
  const opposingPatterns = kind === "media" ? filesPatterns : mediaPatterns;

  for (const pattern of preferredPatterns) {
    if (pattern.test(haystack)) {
      score += 30;
    }
  }

  for (const pattern of opposingPatterns) {
    if (pattern.test(haystack)) {
      score -= 12;
    }
  }

  if (/\bupload\b|\buploads\b/.test(haystack)) {
    score += 4;
  }

  if (!bucket.isPublic) {
    score += 2;
  }

  return score;
};

export const getSuggestedPostsMappingStorageBucket = ({
  availableSupabaseBuckets,
  kind,
}: {
  availableSupabaseBuckets: ProjectEditorStorageBucketOption[];
  kind: "files" | "media";
}) => {
  const rankedBuckets = [...availableSupabaseBuckets]
    .map((bucket) => ({
      bucket,
      score: scorePostsMappingStorageBucket({
        bucket,
        kind,
      }),
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.bucket.name.localeCompare(right.bucket.name) ||
        left.bucket.id.localeCompare(right.bucket.id),
    );

  const bestBucket = rankedBuckets[0];
  return bestBucket && bestBucket.score > 0 ? bestBucket.bucket.id : null;
};

export function ProjectEditorPostsMappingWizard({
  children,
  currentProjectName,
  currentStepDescription,
  currentStepTitle,
  onFinish,
  onNext,
  onPrevious,
  postsMappingStepIndex,
  savingMessages = null,
  savingPostsMapping,
  statusChildren = null,
  statusMessage = null,
  steps = postsMappingSteps,
}: ProjectEditorPostsMappingWizardProps) {
  const visibleSavingMessages = savingPostsMapping
    ? savingMessages?.length
      ? savingMessages
      : [
          {
            detail: "Refreshing BaseBuddy to match your latest mapping.",
            title: "Applying your mapping changes",
          },
        ]
    : null;
  const hideFooter = Boolean(statusMessage) || Boolean(visibleSavingMessages?.length);
  const isLastStep = postsMappingStepIndex >= steps.length - 1;

  if (visibleSavingMessages?.length) {
    return <LoadingSequenceScreen messages={visibleSavingMessages} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-background">
        <div className="container mx-auto flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <div className="flex h-14 items-center">
              <BaseBuddyWordmark className="h-7 w-auto" />
            </div>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="text-sm text-foreground">{currentProjectName}</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-16">
        <div className="mb-12 overflow-x-auto">
          <div className="mx-auto flex min-w-max items-center justify-center gap-2 px-2 sm:px-6">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors",
                    index <= postsMappingStepIndex
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground",
                  )}
                >
                  {index < postsMappingStepIndex ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </div>
                <span
                  className={cn(
                    "whitespace-nowrap text-xs font-medium",
                    index <= postsMappingStepIndex ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step.title}
                </span>
                {index < steps.length - 1 ? (
                  <div className={cn("h-px w-8", index < postsMappingStepIndex ? "bg-primary" : "bg-border")} />
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto max-w-2xl">
          {statusMessage ? (
            <div className="animate-fade-in">
              <h2 className="text-center text-xl font-bold tracking-tight text-foreground">{currentStepTitle}</h2>
              <p className="mt-2 text-center text-sm text-muted-foreground">{statusMessage}</p>
              {statusChildren ? <div className="mt-6">{statusChildren}</div> : null}
            </div>
          ) : (
            <div className="animate-fade-in">
              <div className="mb-8 text-center">
                <h2 className="text-xl font-bold tracking-tight text-foreground">{currentStepTitle}</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  {currentStepDescription}
                </p>
              </div>
              <div className="space-y-6">{children}</div>
            </div>
          )}

          {!hideFooter ? (
            <div className="mt-10 flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onPrevious}
                disabled={postsMappingStepIndex === 0 || savingPostsMapping}
                className="gap-2"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </Button>

              {!isLastStep ? (
                <Button
                  type="button"
                  variant="hero"
                  size="sm"
                  onClick={onNext}
                  disabled={savingPostsMapping}
                  className="gap-2"
                >
                  Continue
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="hero"
                  size="sm"
                  onClick={onFinish}
                  disabled={savingPostsMapping}
                  className="gap-2"
                >
                  Finish
                  <Check className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ProjectEditorPostsMappingMediaStorageStep({
  availableSupabaseBuckets,
  filesStorage,
  onFilesBucketNameChange,
  onFilesEndpointChange,
  onFilesProviderChange,
  onFilesPublicUrlBaseChange,
  onFilesRegionChange,
  mediaStorage,
  onBucketNameChange,
  onEndpointChange,
  onProviderChange,
  onPublicUrlBaseChange,
  onRegionChange,
  visibleStorage = "both",
}: ProjectEditorPostsMappingMediaStorageStepProps) {
  return (
    <div className="space-y-8">
      {visibleStorage !== "files" ? (
        <ProjectEditorPostsMappingStorageSection
          availableSupabaseBuckets={availableSupabaseBuckets}
          noneLabel="None (skip media storage)"
          providerLabel="Media Storage"
          sectionDescription="Use a dedicated image bucket or share a storage bucket with the files library."
          storage={mediaStorage}
          supabaseBucketDescription="The name of the Supabase Storage bucket used for images in this install."
          onBucketNameChange={onBucketNameChange}
          onEndpointChange={onEndpointChange}
          onProviderChange={onProviderChange}
          onPublicUrlBaseChange={onPublicUrlBaseChange}
          onRegionChange={onRegionChange}
        />
      ) : null}

      {visibleStorage !== "media" ? (
        <ProjectEditorPostsMappingStorageSection
          availableSupabaseBuckets={availableSupabaseBuckets}
          noneLabel="None (skip files storage)"
          providerLabel="Files Storage"
          sectionDescription="Choose the bucket that should back documents, PDFs, CSVs, and other non-image files."
          storage={filesStorage}
          supabaseBucketDescription="The name of the Supabase Storage bucket used for non-image files in this install."
          onBucketNameChange={onFilesBucketNameChange}
          onEndpointChange={onFilesEndpointChange}
          onProviderChange={onFilesProviderChange}
          onPublicUrlBaseChange={onFilesPublicUrlBaseChange}
          onRegionChange={onFilesRegionChange}
        />
      ) : null}
    </div>
  );
}

function ProjectEditorPostsMappingStorageSection({
  availableSupabaseBuckets,
  noneLabel,
  providerLabel,
  sectionDescription,
  storage,
  supabaseBucketDescription,
  onBucketNameChange,
  onEndpointChange,
  onProviderChange,
  onPublicUrlBaseChange,
  onRegionChange,
}: {
  availableSupabaseBuckets: ProjectEditorStorageBucketOption[];
  noneLabel: string;
  providerLabel: string;
  sectionDescription: string;
  storage: PostsMediaStorageDraft;
  supabaseBucketDescription: string;
  onBucketNameChange: (value: string) => void;
  onEndpointChange: (value: string) => void;
  onProviderChange: (provider: ContentMediaStorageProvider) => void;
  onPublicUrlBaseChange: (value: string) => void;
  onRegionChange: (value: string) => void;
}) {
  const bucketOptions = getPostsMappingSupabaseBucketOptions({
    availableSupabaseBuckets,
    currentBucketName: storage.bucketName,
  });

  return (
    <div className="space-y-6 rounded-lg border border-border bg-card/60 p-5">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{providerLabel}</h3>
        <p className="text-xs leading-6 text-muted-foreground">{sectionDescription}</p>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Storage Provider</Label>
        <Select
          value={storage.provider}
          onValueChange={(value) => onProviderChange(value as ContentMediaStorageProvider)}
        >
          <SelectTrigger className="sm:w-[360px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{noneLabel}</SelectItem>
            <SelectItem value="supabase_bucket">Supabase Storage Bucket</SelectItem>
            <SelectItem value="s3_compatible">S3-Compatible Storage</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {storage.provider === "none"
            ? "You can configure this storage later."
            : storage.provider === "supabase_bucket"
              ? "Use a Supabase Storage bucket from this install."
              : "Works with AWS S3, Cloudflare R2, Backblaze B2, DigitalOcean Spaces, and other S3-compatible providers."}
        </p>
      </div>

      {storage.provider === "supabase_bucket" ? (
        <div className="space-y-4 rounded-lg border border-border p-4">
          <div className="space-y-2">
            <Label className="text-sm">
              Bucket Name
            </Label>
            {bucketOptions.length > 0 ? (
              <Select value={storage.bucketName || undefined} onValueChange={onBucketNameChange}>
                <SelectTrigger className="sm:w-[360px]">
                  <SelectValue placeholder="Select a bucket" />
                </SelectTrigger>
                <SelectContent>
                  {bucketOptions.map((bucket) => (
                    <SelectItem key={bucket.value} value={bucket.value}>
                      {bucket.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                placeholder="e.g. media, uploads, content-assets"
                value={storage.bucketName}
                onChange={(event) => onBucketNameChange(event.target.value)}
              />
            )}
            <p className="text-xs text-muted-foreground">
              {bucketOptions.length > 0
                ? `${supabaseBucketDescription} Choose one of the available buckets in this install.`
                : supabaseBucketDescription}
            </p>
          </div>
        </div>
      ) : null}

      {storage.provider === "s3_compatible" ? (
        <div className="space-y-4 rounded-lg border border-border p-4">
          <div className="space-y-2">
            <Label htmlFor="mapping-media-s3-bucket" className="text-sm">
              Bucket Name
            </Label>
            <Input
              id="mapping-media-s3-bucket"
              placeholder="e.g. my-content-bucket"
              value={storage.bucketName}
              onChange={(event) => onBucketNameChange(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mapping-media-region" className="text-sm">
              Region
            </Label>
            <Input
              id="mapping-media-region"
              placeholder="e.g. auto, us-east-1"
              value={storage.region}
              onChange={(event) => onRegionChange(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Use `auto` for Cloudflare R2. Leave this blank only if your provider defaults the region for the endpoint.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mapping-media-endpoint" className="text-sm">
              Endpoint URL
            </Label>
            <Input
              id="mapping-media-endpoint"
              placeholder="e.g. https://<account-id>.r2.cloudflarestorage.com"
              value={storage.endpoint}
              onChange={(event) => onEndpointChange(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Required for non-AWS providers like R2 or B2. Leave empty for standard AWS S3.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mapping-media-public-url" className="text-sm">
              Public URL Base
            </Label>
            <Input
              id="mapping-media-public-url"
              placeholder="e.g. https://cdn.example.com"
              value={storage.publicUrlBase}
              onChange={(event) => onPublicUrlBaseChange(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Optional but recommended. If you provide a public bucket/custom domain here, uploaded media can be stored as stable public URLs.
            </p>
          </div>
          <div className="space-y-2">
            <p className="rounded-lg border border-border bg-secondary/60 px-3 py-2 text-xs leading-5 text-muted-foreground">
              Upload storage credentials are managed in app configuration. Add the matching
              storage credential pair before saving this mapping.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ProjectEditorPostsMappingCustomFieldsStep({
  customFields,
  onToggleField,
  onUpdateFieldArrayIndex,
  onUpdateFieldKind,
  onUpdateFieldPath,
}: ProjectEditorPostsMappingCustomFieldsStepProps) {
  if (customFields.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <Database className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
        <p className="text-sm font-medium text-foreground">No extra columns found</p>
        <p className="mt-1 text-xs text-muted-foreground">
          All columns in your posts table have been mapped above.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {customFields.map((field) => {
        const isRequired = !field.isNullable && field.defaultValue === null;
        const normalizedPath = field.path?.trim() ?? "";
        const rawArrayItemIndex =
          field.arrayIndex === null || field.arrayIndex === undefined ? "" : String(field.arrayIndex + 1);
        const showJsonPathControl = field.enabled && field.sourceIsJson;
        const showArrayItemControl = field.enabled && field.sourceIsArray;
        const showJsonKindOptions = showJsonPathControl && normalizedPath.length > 0;
        const showArrayItemKindOptions = showArrayItemControl && rawArrayItemIndex.length > 0;
        const kindOptions = getCustomFieldKindOptions({
          field,
          showItemKindOptions: showArrayItemKindOptions,
          showJsonKindOptions,
        });

        return (
          <div
            key={field.column}
            className={cn(
              "flex items-start gap-4 rounded-lg border px-4 py-3",
              field.enabled ? "border-border bg-secondary/50" : "border-border/50 bg-background",
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{field.label}</span>
                {isRequired ? (
                  <Badge variant="outline" className="border-destructive/40 text-[10px] text-destructive">
                    Required
                  </Badge>
                ) : null}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span className="font-mono">{field.column}</span>
                <span>
                  {field.dataType}
                  {field.isNullable ? "" : " NOT NULL"}
                </span>
                {field.defaultValue ? <span>default: {field.defaultValue}</span> : null}
              </div>
              {field.sampleValues.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {field.sampleValues.slice(0, 5).map((value) => (
                    <span
                      key={value}
                      className="inline-block rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {value.length > 30 ? `${value.slice(0, 30)}...` : value}
                    </span>
                  ))}
                  {field.sampleValues.length > 5 ? (
                    <span className="inline-block rounded px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      +{field.sampleValues.length - 5} more
                    </span>
                  ) : null}
                </div>
              ) : null}
              {field.sourceIsExotic ? (
                <p className="mt-2 text-[11px] text-amber-700">
                  This source type will stay read-only in BaseBuddy until this field type is supported.
                </p>
              ) : null}
              {showJsonPathControl || showArrayItemControl ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {showJsonPathControl ? (
                    <div className="space-y-1.5">
                      <Label htmlFor={`custom-field-${field.column}-json-path`} className="text-xs">
                        {field.label} JSON path
                      </Label>
                      <Input
                        id={`custom-field-${field.column}-json-path`}
                        placeholder="Leave blank for full JSON value"
                        value={normalizedPath}
                        onChange={(event) => {
                          const nextValue = event.target.value.trim();
                          onUpdateFieldPath(field.column, nextValue);
                          if (!nextValue) {
                            onUpdateFieldKind(field.column, "json");
                          } else if (field.kind === "json") {
                            onUpdateFieldKind(field.column, "text");
                          }
                        }}
                        className="h-8 border-border bg-background text-xs shadow-none"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Use dot notation like `card.title`. Leave this empty to keep the whole JSON value.
                      </p>
                    </div>
                  ) : null}
                  {showArrayItemControl ? (
                    <div className="space-y-1.5">
                      <Label htmlFor={`custom-field-${field.column}-array-index`} className="text-xs">
                        {field.label} item number
                      </Label>
                      <Input
                        id={`custom-field-${field.column}-array-index`}
                        inputMode="numeric"
                        min="1"
                        placeholder="Leave blank for whole array"
                        type="number"
                        value={rawArrayItemIndex}
                        onChange={(event) => {
                          const normalizedValue = event.target.value.replace(/[^0-9]/g, "");
                          const nextValue =
                            normalizedValue && normalizedValue !== "0" ? normalizedValue : null;
                          onUpdateFieldArrayIndex(field.column, nextValue);
                          if (!nextValue) {
                            onUpdateFieldKind(field.column, "array");
                          } else if (field.kind === "array") {
                            onUpdateFieldKind(field.column, "text");
                          }
                        }}
                        className="h-8 border-border bg-background text-xs shadow-none"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Leave this empty to map the whole array. Enter a number to map a single array item instead.
                      </p>
                    </div>
                  ) : null}
                  {showJsonKindOptions || showArrayItemKindOptions ? (
                    <div className="space-y-1.5">
                      <Label htmlFor={`custom-field-${field.column}-kind`} className="text-xs">
                        {field.label} field type
                      </Label>
                      <select
                        id={`custom-field-${field.column}-kind`}
                        aria-label={`${field.label} field type`}
                        className="flex h-8 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground shadow-none outline-none"
                        value={field.kind}
                        onChange={(event) =>
                          onUpdateFieldKind(field.column, event.target.value as ContentMappingFieldKind)
                        }
                      >
                        {kindOptions.map((kind) => (
                          <option key={`${field.column}-${kind}`} value={kind}>
                            {buildCustomFieldKindLabel(kind)}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-muted-foreground">
                        Choose how the selected JSON path or array item should behave inside the editor.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="flex-shrink-0 pt-0.5">
              <Switch
                checked={field.enabled}
                disabled={isRequired}
                onCheckedChange={(checked) => onToggleField(field.column, checked)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
