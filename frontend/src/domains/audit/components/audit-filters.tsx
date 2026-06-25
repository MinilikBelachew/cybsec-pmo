"use client";

import { SlidersHorizontal, ChevronDown } from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { cn } from "@/shared/utils/cn";

const ACTION_OPTIONS = [
  { value: "", label: "All actions" },
  { value: "POST", label: "POST" },
  { value: "BREAK_GLASS_ACTIVATED", label: "Break-glass activated" },
  { value: "BREAK_GLASS_STOPPED", label: "Break-glass stopped" },
  { value: "UPDATE_USER", label: "Update user" },
  { value: "CREATE_USER", label: "Create user" },
  { value: "DELETE_USER", label: "Delete user" },
  { value: "LOGOUT", label: "Logout" },
  { value: "REFRESH", label: "Refresh" },
];

const OBJECT_OPTIONS = [
  { value: "", label: "All objects" },
  { value: "Auth", label: "Auth" },
  { value: "Session", label: "Session" },
  { value: "User", label: "User" },
  { value: "Project", label: "Project" },
  { value: "Task", label: "Task" },
];

type AuditFiltersProps = {
  action: string;
  objectType: string;
  breakGlassOnly: boolean;
  onActionChange: (value: string) => void;
  onObjectTypeChange: (value: string) => void;
  onBreakGlassOnlyChange: (value: boolean) => void;
};

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const active = options.find((o) => o.value === value)?.label ?? label;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-9 gap-1.5 border-border/60 bg-white font-normal shadow-none dark:bg-card",
              value && "border-primary/40 bg-primary/5",
            )}
          />
        }
      >
        <span className="text-muted-foreground">{label}</span>
        <span className="max-w-[120px] truncate">{active}</span>
        <ChevronDown className="size-3.5 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {options.map((option) => (
          <button
            key={option.value || "all"}
            type="button"
            className={cn(
              "flex w-full cursor-pointer items-center rounded-md px-2 py-1.5 text-sm outline-none hover:bg-muted",
              value === option.value && "bg-muted font-medium",
            )}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AuditFilters({
  action,
  objectType,
  breakGlassOnly,
  onActionChange,
  onObjectTypeChange,
  onBreakGlassOnlyChange,
}: AuditFiltersProps) {
  const activeFilterCount =
    (action ? 1 : 0) + (objectType ? 1 : 0) + (breakGlassOnly ? 1 : 0);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterDropdown
        label="Action"
        value={action}
        options={ACTION_OPTIONS}
        onChange={onActionChange}
      />
      <FilterDropdown
        label="Object"
        value={objectType}
        options={OBJECT_OPTIONS}
        onChange={onObjectTypeChange}
      />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-9 gap-1.5 border-border/60 bg-white font-normal shadow-none dark:bg-card",
                activeFilterCount > 0 && "border-primary/40 bg-primary/5",
              )}
            />
          }
        >
          <SlidersHorizontal className="size-3.5" />
          All filters
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Scope
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={breakGlassOnly ? "break-glass" : "all"}
            onValueChange={(v) => onBreakGlassOnlyChange(v === "break-glass")}
          >
            <DropdownMenuRadioItem value="all">All activity</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="break-glass">
              Break-glass only
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Quick reset
          </DropdownMenuLabel>
          <button
            type="button"
            className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
            onClick={() => {
              onActionChange("");
              onObjectTypeChange("");
              onBreakGlassOnlyChange(false);
            }}
          >
            Clear all filters
          </button>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
