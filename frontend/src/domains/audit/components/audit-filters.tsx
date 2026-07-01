"use client";

import { useMemo } from "react";
import { SlidersHorizontal, ChevronDown, Calendar as CalendarIcon, X } from "lucide-react";
import { useGetUsersQuery } from "@/domains/users/api/users.api";
import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Calendar } from "@/shared/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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
  { value: "LOGIN", label: "Login" },
  { value: "LOGIN_FAILED", label: "Login failed" },
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

type FilterOption = {
  value: string;
  label: string;
  description?: string;
};

type AuditFiltersProps = {
  action: string;
  objectType: string;
  actorId: string;
  dateFrom: string;
  dateTo: string;
  breakGlassOnly: boolean;
  externalOnly: boolean;
  onActionChange: (value: string) => void;
  onObjectTypeChange: (value: string) => void;
  onActorIdChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onBreakGlassOnlyChange: (value: boolean) => void;
  onExternalOnlyChange: (value: boolean) => void;
  onClearAll: () => void;
};

function FilterDropdown({
  label,
  value,
  options,
  onChange,
  menuClassName,
}: {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  menuClassName?: string;
}) {
  const active = options.find((option) => option.value === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-9 gap-2 rounded-xl border-border/60 bg-muted/45 px-3 font-normal shadow-none dark:bg-card",
              value && "border-primary/40 bg-primary/5",
            )}
          />
        }
      >
        <span className="text-muted-foreground">{label}</span>
        <span className="max-w-[140px] truncate font-medium">
          {active?.label ?? label}
        </span>
        <ChevronDown className="size-3.5 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={cn("max-h-72 overflow-y-auto p-2", menuClassName ?? "w-56")}
      >
        <div className="space-y-1">
          {options.map((option) => (
            <button
              key={option.value || "all"}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "flex w-full flex-col rounded-xl border px-3 py-2 text-left transition-colors",
                value === option.value
                  ? "border-primary/30 bg-primary/5"
                  : "border-transparent hover:border-border/60 hover:bg-muted/50",
              )}
            >
              <span className="text-sm font-medium">{option.label}</span>
              {option.description ? (
                <span className="truncate text-xs text-muted-foreground">
                  {option.description}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toDateString(date: Date | undefined): string {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateString(dateStr: string): Date | undefined {
  if (!dateStr) return undefined;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return undefined;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const date = new Date(year, month, day);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function AuditDatePicker({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const selectedDate = parseDateString(value);

  return (
    <Popover>
      <div className="relative flex items-center">
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-9 gap-2 rounded-xl border-border/60 bg-muted/45 px-3 font-normal shadow-none dark:bg-card pr-8",
                value && "border-primary/40 bg-primary/5 font-medium",
              )}
            />
          }
        >
          <CalendarIcon className="size-3.5 text-muted-foreground" />
          {value ? (
            <span className="text-sm">{formatDate(value)}</span>
          ) : (
            <span className="text-sm text-muted-foreground">{placeholder}</span>
          )}
        </PopoverTrigger>
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`Clear ${label}`}
          >
            <X className="size-3" />
          </button>
        )}
      </div>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          captionLayout="dropdown"
          selected={selectedDate}
          onSelect={(date) => {
            onChange(date ? toDateString(date) : "");
          }}
          startMonth={new Date(2020, 0)}
          endMonth={new Date(new Date().getFullYear() + 2, 11)}
        />
      </PopoverContent>
    </Popover>
  );
}

export function AuditFilters({
  action,
  objectType,
  actorId,
  dateFrom,
  dateTo,
  breakGlassOnly,
  externalOnly,
  onActionChange,
  onObjectTypeChange,
  onActorIdChange,
  onDateFromChange,
  onDateToChange,
  onBreakGlassOnlyChange,
  onExternalOnlyChange,
  onClearAll,
}: AuditFiltersProps) {
  const { data: usersData } = useGetUsersQuery({ page: 1, limit: 100 });

  const actorOptions = useMemo<FilterOption[]>(
    () => [
      { value: "", label: "All users" },
      ...(usersData?.data ?? []).map((user) => ({
        value: user.id,
        label: user.displayName,
        description: user.email,
      })),
    ],
    [usersData?.data],
  );

  const activeFilterCount =
    (action ? 1 : 0) +
    (objectType ? 1 : 0) +
    (actorId ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (breakGlassOnly ? 1 : 0) +
    (externalOnly ? 1 : 0);

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
      <FilterDropdown
        label="Actor"
        value={actorId}
        options={actorOptions}
        onChange={onActorIdChange}
        menuClassName="w-72"
      />

      <AuditDatePicker
        label="From Date"
        value={dateFrom}
        onChange={onDateFromChange}
        placeholder="From date"
      />
      <AuditDatePicker
        label="To Date"
        value={dateTo}
        onChange={onDateToChange}
        placeholder="To date"
      />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-9 gap-2 rounded-xl border-border/60 bg-muted/45 px-3 font-normal shadow-none dark:bg-card",
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
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Scope
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={breakGlassOnly ? "break-glass" : externalOnly ? "external" : "all"}
              onValueChange={(v) => {
                onBreakGlassOnlyChange(v === "break-glass");
                onExternalOnlyChange(v === "external");
              }}
            >
              <DropdownMenuRadioItem value="all">All activity</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="break-glass">
                Break-glass only
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="external">
                External users only
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Quick reset
            </DropdownMenuLabel>
            <button
              type="button"
              className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
              onClick={onClearAll}
            >
              Clear all filters
            </button>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
