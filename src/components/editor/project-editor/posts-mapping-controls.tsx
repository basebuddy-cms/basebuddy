"use client";

import React from "react";
import type { ReactNode } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2, X } from "lucide-react";

import { POSTS_MAPPING_NONE_VALUE } from "@/components/editor/project-editor/constants";
import type {
  MappingSelectOption,
  ProjectEditorMappingRowRenderProps,
} from "@/components/editor/project-editor/types";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  SelectLabel as SelectMenuLabel,
} from "@/components/ui/select";

type ProjectEditorPostsMappingMiniSelectProps = {
  helperText?: string;
  label: string;
  onChange: (value: string) => void;
  options: MappingSelectOption[];
  selectClassName?: string;
  value: string;
};

type ProjectEditorPostsMappingMiniInputProps = {
  className?: string;
  inputMode?: React.ComponentProps<typeof Input>["inputMode"];
  label: string;
  min?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: React.ComponentProps<typeof Input>["type"];
  value: string;
};

type ProjectEditorPostsMappingRelatedColumnsEditorProps = {
  addLabel?: string;
  onAdd: () => void;
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  options: MappingSelectOption[];
  values: string[];
};

type ProjectEditorPostsMappingContentFieldsEditorProps = {
  extraContents?: ReactNode[];
  onAdd: (index: number) => void;
  onChange: (index: number, value: string) => void;
  onKindChange: (index: number, value: string) => void;
  onMoveDown: (index: number) => void;
  onMoveUp: (index: number) => void;
  onRemove: (index: number) => void;
  contentKindOptions: MappingSelectOption[];
  contentKinds: string[];
  options: MappingSelectOption[];
  specialOptions?: MappingSelectOption[];
  values: string[];
};

type ProjectEditorPostsMappingDetailSectionProps = {
  children: ReactNode;
  description?: string;
  title: string;
};

export function ProjectEditorPostsMappingRow({
  extraContent,
  helperText,
  label,
  onChange,
  options,
  required,
  selectClassName,
  specialOptions,
  value,
}: ProjectEditorMappingRowRenderProps) {
  return (
    <div className="grid gap-x-6 gap-y-2 md:grid-cols-[160px_minmax(0,1fr)]">
      <div className="pt-1.5">
        <Label className="text-sm font-medium text-foreground">
          {label}
          {required ? <span className="ml-0.5 text-destructive">*</span> : null}
        </Label>
      </div>
      <div className="min-w-0 space-y-2">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger
            className={cn(
              "h-9 w-full border-border bg-secondary text-sm shadow-none sm:w-[320px]",
              selectClassName,
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.length ? (
              <SelectGroup>
                <SelectMenuLabel className="pl-2 text-xs uppercase tracking-wider text-muted-foreground">
                  Columns
                </SelectMenuLabel>
                {options.map((option) => (
                  <SelectItem key={`${label}:${option.value}`} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ) : null}
            {specialOptions?.length ? (
              <>
                {options.length ? <SelectSeparator /> : null}
                <SelectGroup>
                  <SelectMenuLabel className="pl-2 text-xs uppercase tracking-wider text-muted-foreground">
                    Other
                  </SelectMenuLabel>
                  {specialOptions.map((option) => (
                    <SelectItem key={`${label}:${option.value}`} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </>
            ) : null}
          </SelectContent>
        </Select>
        {helperText ? <p className="max-w-xl text-xs leading-5 text-muted-foreground">{helperText}</p> : null}
        {extraContent}
      </div>
    </div>
  );
}

export function ProjectEditorPostsMappingMiniSelect({
  helperText,
  label,
  onChange,
  options,
  selectClassName,
  value,
}: ProjectEditorPostsMappingMiniSelectProps) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium uppercase tracking-wider text-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          className={cn("h-9 w-full border-border bg-secondary text-sm shadow-none sm:w-[240px]", selectClassName)}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={`${label}:${option.value}`} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {helperText ? <p className="max-w-sm text-xs leading-5 text-muted-foreground">{helperText}</p> : null}
    </div>
  );
}

export function ProjectEditorPostsMappingMiniInput({
  className,
  inputMode,
  label,
  min,
  onChange,
  placeholder,
  type,
  value,
}: ProjectEditorPostsMappingMiniInputProps) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium uppercase tracking-wider text-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode={inputMode}
        min={min}
        placeholder={placeholder}
        type={type}
        className={cn("h-9 w-full border-border bg-secondary text-sm shadow-none sm:w-[240px]", className)}
      />
    </div>
  );
}

export function ProjectEditorPostsMappingRelatedColumnsEditor({
  addLabel = "Add display field",
  onAdd,
  onChange,
  onRemove,
  options,
  values,
}: ProjectEditorPostsMappingRelatedColumnsEditorProps) {
  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Display fields
        </Label>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 px-2" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" />
          {addLabel}
        </Button>
      </div>
      <div className="space-y-2">
        {values.map((currentValue, index) => (
          <div key={`related-column-${index}`} className="flex items-center gap-2">
            <Select value={currentValue} onValueChange={(nextValue) => onChange(index, nextValue)}>
              <SelectTrigger className="h-9 w-full border-border bg-secondary text-sm shadow-none sm:w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={POSTS_MAPPING_NONE_VALUE}>Choose display field</SelectItem>
                {options.map((option) => (
                  <SelectItem key={`related-column-option-${index}-${option.value}`} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {values.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => onRemove(index)}
              >
                <X className="h-3.5 w-3.5" />
                <span className="sr-only">Remove display field</span>
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProjectEditorPostsMappingContentFieldsEditor({
  contentKindOptions,
  contentKinds,
  extraContents,
  onAdd,
  onChange,
  onKindChange,
  onMoveDown,
  onMoveUp,
  onRemove,
  options,
  specialOptions,
  values,
}: ProjectEditorPostsMappingContentFieldsEditorProps) {
  return (
    <div className="space-y-2">
      {values.map((currentValue, index) => (
        <div key={`content-column-${index}`} className="space-y-2 rounded-md border border-border/70 bg-background/40 p-3">
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_auto] md:items-center">
            <Select value={currentValue} onValueChange={(nextValue) => onChange(index, nextValue)}>
              <SelectTrigger className="h-9 w-full border-border bg-secondary text-sm shadow-none">
                <SelectValue placeholder="Choose content field" />
              </SelectTrigger>
              <SelectContent>
                {options.length ? (
                  <SelectGroup>
                    <SelectMenuLabel className="pl-2 text-xs uppercase tracking-wider text-muted-foreground">
                      Columns
                    </SelectMenuLabel>
                    {options.map((option) => (
                      <SelectItem key={`content-column-option-${index}-${option.value}`} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null}
                {specialOptions?.length ? (
                  <>
                    {options.length ? <SelectSeparator /> : null}
                    <SelectGroup>
                      <SelectMenuLabel className="pl-2 text-xs uppercase tracking-wider text-muted-foreground">
                        Other
                      </SelectMenuLabel>
                      {specialOptions.map((option) => (
                        <SelectItem key={`content-column-special-${index}-${option.value}`} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </>
                ) : null}
              </SelectContent>
            </Select>
            <Select
              value={contentKinds[index] ?? contentKinds[0] ?? "html"}
              onValueChange={(nextValue) => onKindChange(index, nextValue)}
            >
              <SelectTrigger className="h-9 w-full border-border bg-secondary text-sm shadow-none">
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                {contentKindOptions.map((option) => (
                  <SelectItem key={`content-kind-option-${index}-${option.value}`} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => onMoveUp(index)}
                disabled={index === 0}
              >
                <ChevronUp className="h-3.5 w-3.5" />
                <span className="sr-only">Move content field up</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => onMoveDown(index)}
                disabled={index >= values.length - 1}
              >
                <ChevronDown className="h-3.5 w-3.5" />
                <span className="sr-only">Move content field down</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => onAdd(index)}
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="sr-only">Add content field</span>
              </Button>
              {values.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => onRemove(index)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="sr-only">Delete content field</span>
                </Button>
              ) : null}
            </div>
          </div>
          {extraContents?.[index] ? <div className="pt-1">{extraContents[index]}</div> : null}
        </div>
      ))}
    </div>
  );
}

export function ProjectEditorPostsMappingDetailSection({
  children,
  description,
  title,
}: ProjectEditorPostsMappingDetailSectionProps) {
  return (
    <div className="space-y-3 pt-2">
      <div className="space-y-1">
        <Label className="text-xs font-medium uppercase tracking-wider text-foreground">{title}</Label>
        {description ? <p className="max-w-2xl text-xs leading-5 text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}
