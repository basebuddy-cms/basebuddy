"use client";

import React, { type ReactNode, type RefCallback } from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ProjectEditorFieldLabelProps = {
  htmlFor?: string;
  label: ReactNode;
  required?: boolean;
};

type ProjectEditorTextInputFieldProps = {
  disabled?: boolean;
  footer?: ReactNode;
  helperText?: ReactNode;
  id: string;
  inputClassName?: string;
  label: ReactNode;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  required?: boolean;
  value: string;
};

type ProjectEditorTextareaFieldProps = {
  disabled?: boolean;
  footer?: ReactNode;
  helperText?: ReactNode;
  id: string;
  label: ReactNode;
  onChange: React.ChangeEventHandler<HTMLTextAreaElement>;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  textareaClassName?: string;
  value: string;
};

type ProjectEditorTitleTextareaFieldProps = {
  disabled?: boolean;
  id: string;
  onChange: React.ChangeEventHandler<HTMLTextAreaElement>;
  onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>;
  onPaste: React.ClipboardEventHandler<HTMLTextAreaElement>;
  placeholder?: string;
  textareaRef: RefCallback<HTMLTextAreaElement>;
  value: string;
};

export function ProjectEditorFieldLabel({
  htmlFor,
  label,
  required = false,
}: ProjectEditorFieldLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
    >
      {label}
      {required ? <span className="ml-0.5 text-destructive">*</span> : null}
    </label>
  );
}

export function ProjectEditorTextInputField({
  disabled = false,
  footer,
  helperText,
  id,
  inputClassName,
  label,
  onChange,
  placeholder,
  required = false,
  value,
}: ProjectEditorTextInputFieldProps) {
  return (
    <div>
      <ProjectEditorFieldLabel htmlFor={id} label={label} required={required} />
      <Input
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={cn("h-8 border-border text-xs", inputClassName)}
        disabled={disabled}
      />
      {helperText ? <p className="mt-1 text-xs text-muted-foreground">{helperText}</p> : null}
      {footer ? <div className="mt-1.5">{footer}</div> : null}
    </div>
  );
}

export function ProjectEditorTextareaField({
  disabled = false,
  footer,
  helperText,
  id,
  label,
  onChange,
  placeholder,
  required = false,
  rows = 4,
  textareaClassName,
  value,
}: ProjectEditorTextareaFieldProps) {
  return (
    <div>
      <ProjectEditorFieldLabel htmlFor={id} label={label} required={required} />
      <Textarea
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className={cn("border-border text-xs", textareaClassName)}
        disabled={disabled}
      />
      {helperText ? <p className="mt-1 text-xs text-muted-foreground">{helperText}</p> : null}
      {footer ? <div className="mt-1.5">{footer}</div> : null}
    </div>
  );
}

export function ProjectEditorTitleTextareaField({
  disabled = false,
  id,
  onChange,
  onKeyDown,
  onPaste,
  placeholder = "Post title",
  textareaRef,
  value,
}: ProjectEditorTitleTextareaFieldProps) {
  return (
    <textarea
      key={id}
      ref={textareaRef}
      aria-label="Post title"
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      placeholder={placeholder}
      className="mb-8 w-full resize-none overflow-hidden border-none bg-transparent text-3xl font-bold leading-tight text-foreground outline-none"
      disabled={disabled}
      rows={1}
    />
  );
}
