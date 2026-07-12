"use client";

import { ChevronDown } from "lucide-react";
import { Checkbox } from "@/shared/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { cn } from "@/shared/utils/cn";

export function mergeDesignationOptions(
  options: string[],
  ...extra: (string | undefined | null)[]
): string[] {
  const merged = new Set(options);
  for (const value of extra) {
    const trimmed = value?.trim();
    if (trimmed) merged.add(trimmed);
  }
  return [...merged].sort((a, b) => a.localeCompare(b));
}

type ProjectRoleSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  extraOptions?: (string | undefined | null)[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export function ProjectRoleSelect({
  value,
  onValueChange,
  options,
  extraOptions = [],
  placeholder = "Select project role…",
  className,
  disabled,
}: ProjectRoleSelectProps) {
  const mergedOptions = mergeDesignationOptions(options, value, ...extraOptions);

  return (
    <Select
      value={value || undefined}
      onValueChange={(next) => onValueChange(next ?? "")}
      disabled={disabled}
    >
      <SelectTrigger className={cn("h-9 w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {mergedOptions.length === 0 ? (
          <SelectItem value="__empty__" disabled>
            No designations available
          </SelectItem>
        ) : (
          mergedOptions.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}

type DesignationMultiSelectProps = {
  value: string[];
  onChange: (values: string[]) => void;
  options: string[];
  extraOptions?: (string | undefined | null)[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export function DesignationMultiSelect({
  value,
  onChange,
  options,
  extraOptions = [],
  placeholder = "Select allowed designations…",
  className,
  disabled,
}: DesignationMultiSelectProps) {
  const mergedOptions = mergeDesignationOptions(options, ...value, ...extraOptions);
  const selected = new Set(value.map((item) => item.trim()).filter(Boolean));

  const toggleOption = (option: string, checked: boolean) => {
    if (checked) {
      onChange([...value.filter((item) => item !== option), option]);
      return;
    }
    onChange(value.filter((item) => item !== option));
  };

  return (
    <Popover>
      <PopoverTrigger
        type="button"
        disabled={disabled}
        className={cn(
          "flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 text-left text-sm shadow-xs",
          "hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          {selected.size === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            <span className="flex flex-wrap gap-1">
              {[...selected].map((option) => (
                <span
                  key={option}
                  className="inline-flex max-w-full items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary"
                >
                  <span className="truncate">{option}</span>
                </span>
              ))}
            </span>
          )}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[var(--anchor-width)] p-0">
        <div className="max-h-64 overflow-y-auto p-2">
          {mergedOptions.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">No designations available.</p>
          ) : (
            mergedOptions.map((option) => {
              const isChecked = selected.has(option);
              return (
                <label
                  key={option}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-muted/50",
                    isChecked && "bg-primary/5",
                  )}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(checked) => toggleOption(option, checked === true)}
                  />
                  <span className="min-w-0 flex-1 text-sm leading-5">{option}</span>
                </label>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
