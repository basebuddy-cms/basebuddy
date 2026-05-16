"use client";

import React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createContentRedirectEntry,
  type ContentRedirectEntry,
} from "@/lib/content-runtime/shared";
import { ProjectEditorFieldLabel } from "@/components/editor/project-editor/text-field-controls";
import { X } from "lucide-react";

type ProjectEditorTokenListFieldProps = {
  disabled?: boolean;
  helperText?: React.ReactNode;
  id: string;
  label: React.ReactNode;
  onChange: (values: string[]) => void;
  values: string[];
};

type ProjectEditorStructuredFieldProps = {
  disabled?: boolean;
  format?: "json" | "xml";
  id: string;
  label: React.ReactNode;
  onChange: (value: unknown) => void;
  required?: boolean;
  value: unknown;
};

type ProjectEditorRedirectRowsFieldProps = {
  disabled?: boolean;
  helperText?: React.ReactNode;
  id: string;
  label: React.ReactNode;
  onChange: (values: ContentRedirectEntry[]) => void;
  values: ContentRedirectEntry[];
};

export function ProjectEditorTokenListField({
  disabled = false,
  helperText,
  id,
  label,
  onChange,
  values,
}: ProjectEditorTokenListFieldProps) {
  return (
    <div>
      <ProjectEditorFieldLabel htmlFor={id} label={label} />
      <div className="rounded-md border border-border bg-secondary px-2 py-1.5">
        {helperText ? <p className="mb-1.5 px-1 text-xs text-muted-foreground">{helperText}</p> : null}
        <div className="mb-1.5 flex flex-wrap gap-1">
          {values.map((item, index) => (
            <Badge
              key={`${item}-${index}`}
              variant="secondary"
              className="gap-1 bg-background px-2 py-0.5 text-xs"
            >
              {item}
              {!disabled ? (
                <button
                  type="button"
                  aria-label={`Remove ${item}`}
                  className="ml-0.5 rounded-full hover:bg-destructive/20"
                  onClick={() => {
                    const nextValues = [...values];
                    nextValues.splice(index, 1);
                    onChange(nextValues);
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </Badge>
          ))}
          {values.length === 0 ? (
            <span className="px-1 text-xs text-muted-foreground">No items</span>
          ) : null}
        </div>
        <Input
          id={id}
          placeholder="Type and press Enter"
          className="h-7 border-0 bg-transparent p-0 px-1 text-xs shadow-none focus-visible:ring-0"
          disabled={disabled}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              const input = event.currentTarget;
              const nextValue = input.value.trim();

              if (nextValue) {
                onChange([...values, nextValue]);
                input.value = "";
              }
            }
          }}
        />
      </div>
    </div>
  );
}

export function ProjectEditorStructuredField({
  disabled = false,
  format = "json",
  id,
  label,
  onChange,
  required = false,
  value,
}: ProjectEditorStructuredFieldProps) {
  const textValue =
    value != null
      ? typeof value === "string"
        ? value
        : JSON.stringify(value, null, 2)
      : "";

  return (
    <div>
      <ProjectEditorFieldLabel htmlFor={id} label={label} required={required} />
      <Textarea
        id={id}
        value={textValue}
        onChange={(event) => {
          const raw = event.target.value;

          if (format === "json") {
            try {
              onChange(JSON.parse(raw));
              return;
            } catch {
              onChange(raw);
              return;
            }
          }

          onChange(raw);
        }}
        rows={4}
        className="border-border font-mono text-xs"
        placeholder={format === "xml" ? "<root />" : "{}"}
        disabled={disabled}
      />
    </div>
  );
}

export function ProjectEditorRedirectRowsField({
  disabled = false,
  helperText,
  id,
  label,
  onChange,
  values,
}: ProjectEditorRedirectRowsFieldProps) {
  return (
    <div>
      <ProjectEditorFieldLabel htmlFor={id} label={label} />
      <div className="rounded-md border border-border bg-secondary px-2 py-1.5">
        {helperText ? <p className="mb-2 px-1 text-xs text-muted-foreground">{helperText}</p> : null}
        <div className="space-y-2">
          {values.map((entry, index) => (
            <div key={`${entry.source || "redirect"}-${index}`} className="rounded-md border border-border bg-background p-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <label
                    htmlFor={`${id}-${index}-source`}
                    className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                  >
                    Redirect Source
                  </label>
                  <Input
                    id={`${id}-${index}-source`}
                    aria-label="Redirect Source"
                    className="h-8 text-xs"
                    disabled={disabled}
                    value={entry.source}
                    onChange={(event) => {
                      const nextValues = [...values];
                      nextValues[index] = {
                        ...entry,
                        source: event.target.value,
                      };
                      onChange(nextValues);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor={`${id}-${index}-status`}
                    className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                  >
                    Status Code
                  </label>
                  <Input
                    id={`${id}-${index}-status`}
                    aria-label="Status Code"
                    className="h-8 text-xs"
                    disabled={disabled}
                    inputMode="numeric"
                    value={entry.statusCode ?? ""}
                    onChange={(event) => {
                      const trimmedValue = event.target.value.trim();
                      const nextValues = [...values];
                      nextValues[index] = {
                        ...entry,
                        statusCode: trimmedValue ? Number.parseInt(trimmedValue, 10) || null : null,
                      };
                      onChange(nextValues);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor={`${id}-${index}-locale`}
                    className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                  >
                    Locale
                  </label>
                  <Input
                    id={`${id}-${index}-locale`}
                    aria-label="Locale"
                    className="h-8 text-xs"
                    disabled={disabled}
                    value={entry.locale ?? ""}
                    onChange={(event) => {
                      const nextValues = [...values];
                      nextValues[index] = {
                        ...entry,
                        locale: event.target.value || null,
                      };
                      onChange(nextValues);
                    }}
                  />
                </div>
                <div className="flex items-end justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs text-foreground">
                    <Checkbox
                      aria-label="Active"
                      checked={entry.active === true}
                      disabled={disabled}
                      onCheckedChange={(checked) => {
                        const nextValues = [...values];
                        nextValues[index] = {
                          ...entry,
                          active: checked === "indeterminate" ? null : checked === true,
                        };
                        onChange(nextValues);
                      }}
                    />
                    Active
                  </label>
                  {!disabled ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs text-destructive"
                      onClick={() => {
                        const nextValues = [...values];
                        nextValues.splice(index, 1);
                        onChange(nextValues);
                      }}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          {values.length === 0 ? (
            <div className="rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
              No redirects yet.
            </div>
          ) : null}
          {!disabled ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() =>
                onChange([
                  ...values,
                  createContentRedirectEntry({
                    source: "",
                  }),
                ])
              }
            >
              Add redirect
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
