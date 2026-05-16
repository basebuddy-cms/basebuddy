"use client";

import React, { useMemo } from "react";
import { CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ProjectEditorFieldLabel } from "@/components/editor/project-editor/text-field-controls";

type ProjectEditorNumberFieldProps = {
  disabled?: boolean;
  id: string;
  label: React.ReactNode;
  onChange: (value: number | null) => void;
  required?: boolean;
  value: number | null;
};

type ProjectEditorBooleanFieldProps = {
  disabled?: boolean;
  id: string;
  label: React.ReactNode;
  onChange: (value: boolean | null) => void;
  required?: boolean;
  value: boolean | null;
};

type ProjectEditorEnumFieldProps = {
  disabled?: boolean;
  id: string;
  label: React.ReactNode;
  onChange: (value: string | null) => void;
  options: string[];
  required?: boolean;
  value: string | null;
};

type ProjectEditorDateTimeFieldProps = {
  allowClear?: boolean;
  disabled?: boolean;
  id: string;
  label: React.ReactNode;
  mode: "date" | "datetime";
  onChange: (value: string | null) => void;
  required?: boolean;
  value: string | null;
};

const formatFieldDateValue = ({
  mode,
  value,
}: {
  mode: "date" | "datetime";
  value: string | null;
}) => {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return mode === "datetime"
    ? parsedDate.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : parsedDate.toLocaleDateString(undefined, { dateStyle: "medium" });
};

export function ProjectEditorNumberField({
  disabled = false,
  id,
  label,
  onChange,
  required = false,
  value,
}: ProjectEditorNumberFieldProps) {
  return (
    <div>
      <ProjectEditorFieldLabel htmlFor={id} label={label} required={required} />
      <Input
        id={id}
        type="number"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
        className="h-8 border-border text-xs"
        disabled={disabled}
      />
    </div>
  );
}

export function ProjectEditorBooleanField({
  disabled = false,
  id,
  label,
  onChange,
  required = false,
  value,
}: ProjectEditorBooleanFieldProps) {
  if (required) {
    return (
      <div>
        <ProjectEditorFieldLabel htmlFor={id} label={label} required={required} />
        <div className="flex h-8 items-center gap-3">
          <Switch
            id={id}
            checked={value === true}
            disabled={disabled}
            onCheckedChange={(nextChecked) => onChange(nextChecked)}
            aria-label={typeof label === "string" ? label : undefined}
          />
          <span className="text-xs text-muted-foreground">{value === true ? "On" : "Off"}</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ProjectEditorFieldLabel htmlFor={id} label={label} required={required} />
      <Select
        value={value === true ? "true" : value === false ? "false" : "__null__"}
        onValueChange={(nextValue) =>
          onChange(nextValue === "true" ? true : nextValue === "false" ? false : null)
        }
        disabled={disabled}
      >
        <SelectTrigger aria-label={typeof label === "string" ? label : undefined} className="h-8 border-border text-xs" id={id}>
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          {!required ? <SelectItem value="__null__">None</SelectItem> : null}
          <SelectItem value="true">True</SelectItem>
          <SelectItem value="false">False</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function ProjectEditorEnumField({
  disabled = false,
  id,
  label,
  onChange,
  options,
  required = false,
  value,
}: ProjectEditorEnumFieldProps) {
  return (
    <div>
      <ProjectEditorFieldLabel htmlFor={id} label={label} required={required} />
      <Select
        value={value ?? "__null__"}
        onValueChange={(nextValue) => onChange(nextValue === "__null__" ? null : nextValue)}
        disabled={disabled}
      >
        <SelectTrigger aria-label={typeof label === "string" ? label : undefined} className="h-8 border-border text-xs" id={id}>
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          {!required ? <SelectItem value="__null__">None</SelectItem> : null}
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ProjectEditorDateTimeField({
  allowClear = false,
  disabled = false,
  id,
  label,
  mode,
  onChange,
  required = false,
  value,
}: ProjectEditorDateTimeFieldProps) {
  const parsedDate = useMemo(() => {
    if (!value) {
      return null;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }, [value]);
  const displayValue = formatFieldDateValue({ mode, value });
  const timeValue = parsedDate
    ? `${String(parsedDate.getHours()).padStart(2, "0")}:${String(parsedDate.getMinutes()).padStart(2, "0")}`
    : "00:00";

  return (
    <div>
      <ProjectEditorFieldLabel htmlFor={id} label={label} required={required} />
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            aria-label={typeof label === "string" ? label : undefined}
            disabled={disabled}
            className={cn(
              "h-8 w-full justify-start border-border text-left text-xs font-normal",
              !displayValue && "text-muted-foreground",
            )}
            id={id}
          >
            <CalendarDays className="mr-2 h-3.5 w-3.5" />
            {displayValue ?? "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={parsedDate ?? undefined}
            onSelect={(day) => {
              if (!day) {
                if (allowClear) {
                  onChange(null);
                }
                return;
              }

              const nextDate = new Date(day);
              if (parsedDate) {
                nextDate.setHours(parsedDate.getHours(), parsedDate.getMinutes(), 0, 0);
              }
              onChange(nextDate.toISOString());
            }}
            initialFocus
          />
          {mode === "datetime" ? (
            <div className="border-t border-border px-3 py-2">
              <label htmlFor={`${id}-time`} className="mb-1 block text-xs text-muted-foreground">
                Time
              </label>
              <Input
                id={`${id}-time`}
                type="time"
                value={timeValue}
                className="h-8 text-xs"
                disabled={disabled}
                onChange={(event) => {
                  const [hours, minutes] = event.target.value.split(":").map(Number);
                  const nextDate = parsedDate ? new Date(parsedDate) : new Date();
                  nextDate.setHours(hours ?? 0, minutes ?? 0, 0, 0);
                  onChange(nextDate.toISOString());
                }}
              />
            </div>
          ) : null}
          {allowClear ? (
            <div className="border-t border-border px-3 py-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onChange(null)}
                disabled={disabled || value === null}
              >
                Clear
              </Button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}
