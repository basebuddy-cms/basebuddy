"use client";

import React from "react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Clock3, Eye, Globe, RefreshCw } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { sanitizeContentRuntimeHtml } from "@/lib/content-runtime/content-conversion";
import type { StoredPostPreviewSnapshot } from "@/lib/editor/post-editor-preview";
import { createPostEditorPreviewStorage } from "@/lib/editor/post-editor-preview";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";

const formatPreviewDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const getStatusBadgeClassName = (status: StoredPostPreviewSnapshot["post"]["status"]) => {
  if (status === "published") {
    return "border-transparent bg-success/10 text-success";
  }

  if (status === "draft") {
    return "border-transparent bg-warning/10 text-warning";
  }

  return "border-transparent bg-secondary text-muted-foreground";
};

const ContentPreviewUnavailable = () => (
  <main className="grid min-h-screen place-items-center bg-background px-6 py-16">
    <div className="w-full max-w-xl rounded-lg border border-dashed border-border bg-card p-8 text-center">
      <Eye className="mx-auto h-8 w-8 text-muted-foreground" />
      <h1 className="mt-4 text-xl font-semibold text-foreground">Preview unavailable</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        This preview has expired. Open it again from the editor.
      </p>
    </div>
  </main>
);

function ContentPreviewPageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const [snapshot, setSnapshot] = useState<StoredPostPreviewSnapshot | null>(null);

  useEffect(() => {
    if (!token) {
      setSnapshot(null);
      return;
    }

    const previewStorage = createPostEditorPreviewStorage(window.localStorage);
    setSnapshot(previewStorage.readSnapshot(token));
  }, [token]);

  const previewPath = useMemo(() => {
    if (!snapshot) {
      return "";
    }

    return `${snapshot.projectSlug}/${snapshot.post.slug}`;
  }, [snapshot]);
  const previewContentHtml = useMemo(
    () => sanitizeContentRuntimeHtml(snapshot?.post.contentHtml),
    [snapshot?.post.contentHtml],
  );

  if (!token || !snapshot) {
    return <ContentPreviewUnavailable />;
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                <Eye className="mr-1.5 h-3.5 w-3.5" />
                Preview
              </Badge>
              <Badge variant="outline" className={cn("capitalize", getStatusBadgeClassName(snapshot.post.status))}>
                {snapshot.post.status}
              </Badge>
              {snapshot.hasUnsavedChanges ? (
                <Badge variant="outline" className="border-border bg-secondary text-foreground">
                  Unsaved changes included
                </Badge>
              ) : null}
            </div>
            <p className="mt-3 text-sm font-medium text-foreground">{snapshot.projectName}</p>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5" />
                Previewed {formatPreviewDate(snapshot.previewedAt)}
              </span>
              <span className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" />
                /{previewPath}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5" />
            Open Preview again from the editor to refresh this snapshot.
          </div>
        </div>
      </div>

      <article className="mx-auto max-w-3xl px-6 py-10">
        <header className="border-b border-border pb-8">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">
            {snapshot.post.title.trim() || "Untitled"}
          </h1>
          {snapshot.post.excerpt?.trim() ? (
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{snapshot.post.excerpt}</p>
          ) : null}
        </header>

        <div
          className="preview-content pt-8 text-base leading-8 text-foreground/90"
          dangerouslySetInnerHTML={{ __html: previewContentHtml }}
        />
      </article>
    </main>
  );
}

export default function ContentPreviewPage() {
  return (
    <Suspense fallback={<ContentPreviewUnavailable />}>
      <ContentPreviewPageContent />
    </Suspense>
  );
}
