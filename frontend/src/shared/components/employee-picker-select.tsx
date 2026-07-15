"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Search } from "lucide-react";
import { EmployeeAvatar } from "@/shared/components/employee-avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { cn } from "@/shared/utils/cn";

export type EmployeePickerOption = {
  id: string;
  name: string;
  profileImageUrl?: string | null;
  subtitle?: string;
};

type EmployeePickerSelectProps = {
  value: string | null;
  onValueChange: (value: string | null) => void;
  options: EmployeePickerOption[];
  /** Keep trigger label when the selected row is not on the current page. */
  selectedOption?: EmployeePickerOption | null;
  placeholder?: string;
  noneLabel?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** When true, search is controlled by parent (server-side). */
  remoteSearch?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
  isFetchingMore?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function EmployeePickerSelect({
  value,
  onValueChange,
  options,
  selectedOption,
  placeholder = "Select employee",
  noneLabel = "No backup",
  disabled = false,
  className,
  triggerClassName,
  searchable = false,
  searchPlaceholder = "Search employee...",
  remoteSearch = false,
  searchValue,
  onSearchChange,
  onLoadMore,
  hasMore = false,
  isLoading = false,
  isFetchingMore = false,
  onOpenChange,
}: EmployeePickerSelectProps) {
  const [open, setOpen] = useState(false);
  const [localQuery, setLocalQuery] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const query = remoteSearch ? (searchValue ?? "") : localQuery;

  const selected =
    options.find((option) => option.id === value) ??
    (selectedOption?.id === value ? selectedOption : null);

  const filtered = useMemo(() => {
    if (remoteSearch) return options;
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => {
      const haystack = `${option.name} ${option.subtitle ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [options, query, remoteSearch]);

  const handleOpenChange = (next: boolean) => {
    if (disabled) return;
    setOpen(next);
    onOpenChange?.(next);
    if (!next && !remoteSearch) setLocalQuery("");
  };

  const handleSelect = (next: string | null) => {
    onValueChange(next);
    setOpen(false);
    if (!remoteSearch) setLocalQuery("");
  };

  const handleScroll = () => {
    const el = listRef.current;
    if (!el || !onLoadMore || !hasMore || isFetchingMore || isLoading) return;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (remaining < 48) onLoadMore();
  };

  useEffect(() => {
    if (!open || !hasMore || !onLoadMore || isFetchingMore || isLoading) return;
    const el = listRef.current;
    if (!el) return;
    if (el.scrollHeight <= el.clientHeight + 8) {
      onLoadMore();
    }
  }, [open, filtered.length, hasMore, onLoadMore, isFetchingMore, isLoading]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        type="button"
        disabled={disabled}
        className={cn(
          "flex h-7 w-fit min-w-[180px] items-center justify-between gap-1.5 rounded-[min(var(--radius-md),10px)] border border-input bg-transparent py-1 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "dark:bg-input/30 dark:hover:bg-input/50",
          triggerClassName,
          className,
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {selected ? (
            <>
              <EmployeeAvatar
                name={selected.name}
                employeeId={selected.id}
                profileImageUrl={selected.profileImageUrl}
                size="xs"
              />
              <span className="truncate">{selected.name}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{noneLabel || placeholder}</span>
          )}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>

      <PopoverContent align="start" side="bottom" className="w-72 p-0">
        {searchable ? (
          <div className="border-b border-border/50 p-2">
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-1.5">
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => {
                  const next = event.target.value;
                  if (remoteSearch) onSearchChange?.(next);
                  else setLocalQuery(next);
                }}
                placeholder={searchPlaceholder}
                className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
                autoFocus
              />
            </div>
          </div>
        ) : null}

        <div
          ref={listRef}
          onScroll={handleScroll}
          className="max-h-64 overflow-y-auto p-1.5"
        >
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-muted/50",
              !selected && "bg-primary/10",
            )}
          >
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{noneLabel}</span>
            {!selected ? <Check className="size-3.5 shrink-0 text-primary" /> : null}
          </button>

          {isLoading && filtered.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-2 py-4 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Loading...
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">No employees found</p>
          ) : (
            filtered.map((option) => {
              const isSelected = selected?.id === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelect(option.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/50",
                    isSelected && "bg-primary/10",
                  )}
                >
                  <EmployeeAvatar
                    name={option.name}
                    employeeId={option.id}
                    profileImageUrl={option.profileImageUrl}
                    size="xs"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{option.name}</span>
                    {option.subtitle ? (
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {option.subtitle}
                      </span>
                    ) : null}
                  </span>
                  {isSelected ? <Check className="size-3.5 shrink-0 text-primary" /> : null}
                </button>
              );
            })
          )}

          {isFetchingMore ? (
            <div className="flex items-center justify-center gap-2 px-2 py-2 text-[11px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Loading more...
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
