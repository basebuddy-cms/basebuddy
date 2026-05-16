"use client";

import React from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import {
  AlertCircle,
  Database,
  Lock,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  type ClipboardEventHandler,
  type ChangeEventHandler,
  type KeyboardEventHandler,
  type ReactNode,
  type RefCallback,
} from "react";

import type {
  CollectionLabel,
  SidebarCollectionEntry,
} from "@/components/editor/project-editor/types";
import { ProjectEditorTitleTextareaField } from "@/components/editor/project-editor/text-field-controls";
import type {
  ContentFieldSpecSummary,
  ContentPostContentFieldValue,
} from "@/lib/content-runtime/shared";
import { createContentRuntimeEditorExtensions } from "@/lib/content-runtime/editor-extensions";
import { createDefaultEditorDoc } from "@/lib/content-runtime/shared";
import { getResolvedPostEditorContentJson } from "@/lib/editor/post-editor-content-sync";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

type ProjectEditorScrollPaneProps = {
  children: ReactNode;
};

type ProjectEditorStateCardProps = {
  children?: ReactNode;
  description: ReactNode;
  descriptionClassName?: string;
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
};

type ProjectEditorPostBlockedStateProps = {
  acquiringPostEditSession: boolean;
  canForcePostTakeover: boolean;
  description: string;
  onGoBack: () => void;
  onTakeOver: () => void;
};

type ProjectEditorPostEditorBodyProps = {
  canEditCurrentPost: boolean;
  currentPostReadOnlyMessage: string | null;
  editor: Editor | null;
  floatingMenu?: ReactNode;
  isCurrentPostReadOnly: boolean;
  mainFieldSpecs: ContentFieldSpecSummary[];
  onRetryCurrentPostEditAccess: () => void;
  onTitleChange: ChangeEventHandler<HTMLTextAreaElement>;
  onTitleKeyDown: KeyboardEventHandler<HTMLTextAreaElement>;
  onTitlePaste: ClipboardEventHandler<HTMLTextAreaElement>;
  selectedPostId: string;
  selectedPostTitle: string;
  titleTextareaRef: RefCallback<HTMLTextAreaElement>;
};

type ProjectEditorMultiFieldEditorBodyProps = {
  canEditCurrentPost: boolean;
  contentFields: Record<string, ContentPostContentFieldValue>;
  currentPostReadOnlyMessage: string | null;
  floatingMenu?: ReactNode;
  isCurrentPostReadOnly: boolean;
  mainFieldSpecs: ContentFieldSpecSummary[];
  onContentFieldChange: (fieldId: string, contentHtml: string, contentJson: Record<string, unknown>) => void;
  onEditorFocus: (editor: Editor) => void;
  onEditorInstanceChange: (fieldId: string, editor: Editor | null) => void;
  onEditorKeyDown: (event: KeyboardEvent) => boolean;
  onEditorLinkClick: (editor: Editor) => void;
  onEditorStateChange: (editor: Editor) => void;
  onRetryCurrentPostEditAccess: () => void;
  onTitleChange: ChangeEventHandler<HTMLTextAreaElement>;
  onTitleKeyDown: KeyboardEventHandler<HTMLTextAreaElement>;
  onTitlePaste: ClipboardEventHandler<HTMLTextAreaElement>;
  selectedPostId: string;
  selectedPostTitle: string;
  titleTextareaRef: RefCallback<HTMLTextAreaElement>;
};

type ContentFieldEditorProps = {
  canEdit: boolean;
  contentValue: ContentPostContentFieldValue | undefined;
  field: ContentFieldSpecSummary;
  isFirst: boolean;
  isLast: boolean;
  onContentChange: (fieldId: string, contentHtml: string, contentJson: Record<string, unknown>) => void;
  onEditorFocus: (editor: Editor) => void;
  onEditorInstanceChange: (fieldId: string, editor: Editor | null) => void;
  onEditorKeyDown: (event: KeyboardEvent) => boolean;
  onEditorLinkClick: (editor: Editor) => void;
  onEditorStateChange: (editor: Editor) => void;
  postId: string;
};

type ProjectEditorSidebarEntriesListProps = {
  entries: SidebarCollectionEntry[];
  pagination?: ReactNode;
};

type ProjectEditorEmptyCollectionStateProps = {
  collection: CollectionLabel;
  icon: LucideIcon;
};

export function ProjectEditorScrollPane({ children }: ProjectEditorScrollPaneProps) {
  return <div className="h-full min-h-0 overflow-y-auto overscroll-contain">{children}</div>;
}

export function ProjectEditorStateCard({
  children,
  description,
  descriptionClassName,
  icon: Icon,
  iconClassName,
  title,
}: ProjectEditorStateCardProps) {
  return (
    <ProjectEditorScrollPane>
      <div className="mx-auto flex h-full max-w-2xl items-center px-8 py-10">
        <div className="w-full rounded-lg border border-dashed border-border p-10 text-center">
          <Icon className={iconClassName ?? "mx-auto h-8 w-8 text-muted-foreground"} />
          <h2 className="mt-4 text-lg font-semibold text-foreground">{title}</h2>
          <div className={descriptionClassName ?? "mt-2 text-sm leading-6 text-muted-foreground"}>
            {description}
          </div>
          {children ? <div className="mt-6">{children}</div> : null}
        </div>
      </div>
    </ProjectEditorScrollPane>
  );
}

export function ProjectEditorConnectionErrorState({ description }: { description: string }) {
  return (
    <ProjectEditorStateCard
      description={description}
      icon={Database}
      title="Content connection failed"
    />
  );
}

export function ProjectEditorPostLoadErrorState({ description }: { description: string }) {
  return (
    <ProjectEditorStateCard
      description={description}
      descriptionClassName="mt-2 text-sm text-destructive"
      icon={AlertCircle}
      iconClassName="mx-auto h-8 w-8 text-destructive/70"
      title="Unable to load this post"
    />
  );
}

export function ProjectEditorEmptyCollectionState({
  collection,
  icon,
}: ProjectEditorEmptyCollectionStateProps) {
  return (
    <ProjectEditorStateCard
      description="This collection is empty right now."
      icon={icon}
      title={`No ${collection.toLowerCase()} yet`}
    />
  );
}

export function ProjectEditorTablePageSkeleton() {
  return (
    <ProjectEditorScrollPane>
      <div className="mx-auto max-w-4xl px-8 py-10">
        <div className="mb-8 space-y-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-[40px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_56px] gap-4 border-b border-border pb-3">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="ml-auto h-4 w-10" />
          </div>
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`table-skeleton-${index}`}
              className="grid grid-cols-[40px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_56px] gap-4 py-3"
            >
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-40 max-w-full" />
              <Skeleton className="h-4 w-24 max-w-full" />
              <Skeleton className="h-4 w-32 max-w-full" />
              <Skeleton className="ml-auto h-8 w-8 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </ProjectEditorScrollPane>
  );
}

export function ProjectEditorPostsListSkeleton() {
  return (
    <ProjectEditorScrollPane>
      <div className="mx-auto max-w-6xl px-10 py-12">
        <div className="mb-10 flex items-center justify-between gap-4">
          <div className="space-y-3">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>

        <div className="mb-8 space-y-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <Skeleton className="h-9 flex-1 rounded-md" />
            <div className="flex flex-col gap-3 sm:flex-row xl:flex-none">
              <Skeleton className="h-9 w-40 rounded-md" />
              <Skeleton className="h-9 w-48 rounded-md" />
              <Skeleton className="h-9 w-16 rounded-md" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Separator />
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-[minmax(0,1.4fr)_120px_minmax(0,1fr)_140px_160px] gap-4 border-b border-border pb-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`posts-skeleton-${index}`}
              className="grid grid-cols-[minmax(0,1.4fr)_120px_minmax(0,1fr)_140px_160px] gap-4 py-3"
            >
              <div className="space-y-2">
                <Skeleton className="h-4 w-48 max-w-full" />
                <Skeleton className="h-3 w-64 max-w-full" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <Skeleton className="h-4 w-20" />
              <div className="ml-auto space-y-2">
                <Skeleton className="ml-auto h-4 w-24" />
                <Skeleton className="ml-auto h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </ProjectEditorScrollPane>
  );
}

export function ProjectEditorPostEditorSkeleton() {
  return (
    <ProjectEditorScrollPane>
      <div className="mx-auto max-w-2xl px-8 py-10">
        <div className="mb-8 space-y-4">
          <Skeleton className="h-10 w-80 max-w-full" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={`post-editor-skeleton-${index}`} className="h-4 w-full" />
          ))}
        </div>
      </div>
    </ProjectEditorScrollPane>
  );
}

export function ProjectEditorPostBlockedState({
  acquiringPostEditSession,
  canForcePostTakeover,
  description,
  onGoBack,
  onTakeOver,
}: ProjectEditorPostBlockedStateProps) {
  return (
    <ProjectEditorStateCard
      description={description}
      icon={Lock}
      title="Post already in use"
    >
      {!canForcePostTakeover ? (
        <p className="text-sm leading-6 text-muted-foreground">
          Only owners, admins, and editors can take over an active editing session.
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button type="button" variant="outline" onClick={onGoBack}>
          Go back
        </Button>
        {canForcePostTakeover ? (
          <Button
            type="button"
            variant="hero"
            onClick={onTakeOver}
            disabled={acquiringPostEditSession}
          >
            {acquiringPostEditSession ? "Taking over..." : "Take over"}
          </Button>
        ) : null}
      </div>
    </ProjectEditorStateCard>
  );
}

const isEditableMainField = (fieldSpec: ContentFieldSpecSummary | null) =>
  Boolean(
    fieldSpec &&
      fieldSpec.visible &&
      fieldSpec.readOnly !== true &&
      fieldSpec.editabilityState !== "read_only" &&
      fieldSpec.editabilityState !== "unsupported",
  );

const getTitleMainFieldSpec = (mainFieldSpecs: ContentFieldSpecSummary[]) =>
  mainFieldSpecs.find((fieldSpec) => fieldSpec.visible && fieldSpec.semanticRole === "title") ?? null;

const getContentMainFieldSpecs = (mainFieldSpecs: ContentFieldSpecSummary[]) =>
  mainFieldSpecs.filter((fieldSpec) => fieldSpec.visible && fieldSpec.valueKind === "content");

export function ProjectEditorPostEditorBody({
  canEditCurrentPost,
  currentPostReadOnlyMessage,
  editor,
  floatingMenu,
  isCurrentPostReadOnly,
  mainFieldSpecs,
  onRetryCurrentPostEditAccess,
  onTitleChange,
  onTitleKeyDown,
  onTitlePaste,
  selectedPostId,
  selectedPostTitle,
  titleTextareaRef,
}: ProjectEditorPostEditorBodyProps) {
  const titleFieldSpec = getTitleMainFieldSpec(mainFieldSpecs);
  const primaryContentFieldSpec = getContentMainFieldSpecs(mainFieldSpecs)[0] ?? null;
  const canEditTitleField = isEditableMainField(titleFieldSpec);
  const showTitleField = titleFieldSpec?.visible === true;
  const showPrimaryContentField = primaryContentFieldSpec?.visible === true;

  return (
    <ProjectEditorScrollPane>
      <div className="mx-auto max-w-2xl px-8 py-10">
        {isCurrentPostReadOnly && currentPostReadOnlyMessage ? (
          <Alert className="mb-6">
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>{currentPostReadOnlyMessage}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRetryCurrentPostEditAccess}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
        {showTitleField ? (
          <ProjectEditorTitleTextareaField
            id={selectedPostId}
            textareaRef={titleTextareaRef}
            value={selectedPostTitle}
            onChange={onTitleChange}
            onKeyDown={onTitleKeyDown}
            onPaste={onTitlePaste}
            disabled={!canEditCurrentPost || !canEditTitleField}
          />
        ) : null}

        <div className="prose-editor space-y-4 text-sm leading-7 text-foreground/90">
          {showPrimaryContentField && editor ? <EditorContent editor={editor} /> : null}
          {floatingMenu}
        </div>
      </div>
    </ProjectEditorScrollPane>
  );
}

function ContentFieldEditor({
  canEdit,
  contentValue,
  field,
  isFirst,
  isLast,
  onContentChange,
  onEditorFocus,
  onEditorInstanceChange,
  onEditorKeyDown,
  onEditorLinkClick,
  onEditorStateChange,
  postId,
}: ContentFieldEditorProps) {
  const extensions = useMemo(() => createContentRuntimeEditorExtensions(), []);
  const editorRef = useRef<Editor | null>(null);
  const resolvedContentJson = useMemo(
    () => getResolvedPostEditorContentJson(contentValue?.contentJson),
    [contentValue?.contentJson],
  );

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions,
      content: resolvedContentJson ?? createDefaultEditorDoc(),
      editorProps: {
        attributes: {
          class: "outline-none min-h-[15.75rem]",
        },
        handleKeyDown(_, event) {
          return onEditorKeyDown(event);
        },
        handleClick(_, __, event) {
          const target = event.target instanceof Element ? event.target : null;

          if (target?.closest("a[href]")) {
            requestAnimationFrame(() => {
              if (editorRef.current) {
                onEditorLinkClick(editorRef.current);
              }
            });
          }

          return false;
        },
      },
      onFocus({ editor: currentEditor }) {
        onEditorFocus(currentEditor);
      },
      onSelectionUpdate({ editor: currentEditor }) {
        onEditorStateChange(currentEditor);
      },
      onUpdate({ editor: currentEditor, transaction }) {
        onEditorStateChange(currentEditor);

        if (!transaction.docChanged || !currentEditor.isFocused) {
          return;
        }
        onContentChange(
          field.fieldKey,
          currentEditor.getHTML(),
          currentEditor.getJSON() as Record<string, unknown>,
        );
      },
    },
    [field.fieldKey],
  );

  useEffect(() => {
    editorRef.current = editor ?? null;
    onEditorInstanceChange(field.fieldKey, editor ?? null);

    return () => {
      editorRef.current = null;
      onEditorInstanceChange(field.fieldKey, null);
    };
  }, [editor, field.fieldKey, onEditorInstanceChange]);

  useEffect(() => {
    if (!editor) return;
    const nextContent = resolvedContentJson ?? createDefaultEditorDoc();
    if (JSON.stringify(editor.getJSON()) !== JSON.stringify(nextContent)) {
      editor.commands.setContent(nextContent, { emitUpdate: false });
    }
  }, [editor, postId, resolvedContentJson]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(canEdit);
  }, [canEdit, editor]);

  return (
    <section
      data-testid={`content-field-${field.fieldKey}`}
      className="w-full min-w-0"
    >
      {!isFirst ? (
        <div
          aria-hidden="true"
          data-testid={`content-field-divider-${field.fieldKey}`}
          className="h-[3px] w-full bg-border/90"
        />
      ) : null}
      <div
        data-testid={`content-field-shell-${field.fieldKey}`}
        className={cn("mx-auto max-w-2xl px-8", isFirst ? "pt-0" : "pt-10", !isLast && "pb-10")}
      >
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {field.label}
          </span>
          {field.required ? (
            <span className="text-xs text-destructive/70">*</span>
          ) : null}
        </div>
        <div className="prose-editor min-h-[15.75rem] space-y-4 text-sm leading-7 text-foreground/90">
          {editor ? <EditorContent editor={editor} /> : null}
        </div>
      </div>
    </section>
  );
}

export function ProjectEditorMultiFieldEditorBody({
  canEditCurrentPost,
  contentFields,
  currentPostReadOnlyMessage,
  floatingMenu,
  isCurrentPostReadOnly,
  mainFieldSpecs,
  onContentFieldChange,
  onEditorFocus,
  onEditorInstanceChange,
  onEditorKeyDown,
  onEditorLinkClick,
  onEditorStateChange,
  onRetryCurrentPostEditAccess,
  onTitleChange,
  onTitleKeyDown,
  onTitlePaste,
  selectedPostId,
  selectedPostTitle,
  titleTextareaRef,
}: ProjectEditorMultiFieldEditorBodyProps) {
  const titleFieldSpec = getTitleMainFieldSpec(mainFieldSpecs);
  const contentFieldSpecs = getContentMainFieldSpecs(mainFieldSpecs);
  const canEditTitleField = isEditableMainField(titleFieldSpec);
  const showTitleField = titleFieldSpec?.visible === true;

  return (
    <ProjectEditorScrollPane>
      <div className="py-10">
        <div className="mx-auto max-w-2xl px-8">
          {isCurrentPostReadOnly && currentPostReadOnlyMessage ? (
            <Alert className="mb-6">
              <AlertDescription className="flex items-center justify-between gap-4">
                <span>{currentPostReadOnlyMessage}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onRetryCurrentPostEditAccess}
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
          {showTitleField ? (
            <ProjectEditorTitleTextareaField
              id={selectedPostId}
              textareaRef={titleTextareaRef}
              value={selectedPostTitle}
              onChange={onTitleChange}
              onKeyDown={onTitleKeyDown}
              onPaste={onTitlePaste}
              disabled={!canEditCurrentPost || !canEditTitleField}
            />
          ) : null}
        </div>

        {contentFieldSpecs.map((field, index) => (
          <ContentFieldEditor
            key={`${selectedPostId}-${field.fieldKey}`}
            canEdit={canEditCurrentPost}
            contentValue={contentFields[field.fieldKey]}
            field={field}
            isFirst={index === 0}
            isLast={index === contentFieldSpecs.length - 1}
            onContentChange={onContentFieldChange}
            onEditorFocus={onEditorFocus}
            onEditorInstanceChange={onEditorInstanceChange}
            onEditorKeyDown={onEditorKeyDown}
            onEditorLinkClick={onEditorLinkClick}
            onEditorStateChange={onEditorStateChange}
            postId={selectedPostId}
          />
        ))}
        {floatingMenu}
      </div>
    </ProjectEditorScrollPane>
  );
}

export function ProjectEditorSidebarEntriesList({
  entries,
  pagination,
}: ProjectEditorSidebarEntriesListProps) {
  return (
    <ProjectEditorScrollPane>
      <div className="mx-auto max-w-2xl px-8 py-10">
        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-border bg-card px-4 py-4">
              <p className="text-sm font-medium text-foreground">{entry.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{entry.meta}</p>
            </div>
          ))}
        </div>

        {pagination}
      </div>
    </ProjectEditorScrollPane>
  );
}
