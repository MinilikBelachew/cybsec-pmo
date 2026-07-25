"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { cn } from "@/shared/utils/cn";

export type FilterSelectOption = {
  id: string;
  label: string;
  subtitle?: string;
};

type FilterSelectProps = {
  value: string | null;
  onValueChange: (value: string | null) => void;
  options: FilterSelectOption[];
  noneLabel: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  /** When false, hides the none/clear row (selection-only lists). Default true. */
  allowNone?: boolean;
};

export function FilterSelect({
  value,
  onValueChange,
  options,
  noneLabel,
  searchable = false,
  searchPlaceholder = "Search...",
  disabled = false,
  className,
  triggerClassName,
  allowNone = true,
}: FilterSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((option) => option.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => {
      const haystack = `${option.label} ${option.subtitle ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [options, query]);

  const handleSelect = (next: string | null) => {
    onValueChange(next);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (disabled) return;
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger
        type="button"
        disabled={disabled}
        className={cn(
          "flex h-7 w-fit min-w-[150px] items-center justify-between gap-1.5 rounded-[min(var(--radius-md),10px)] border border-input bg-transparent py-1 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "dark:bg-input/30 dark:hover:bg-input/50",
          triggerClassName,
          className,
        )}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected?.label ?? noneLabel}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>

      <PopoverContent align="start" side="bottom" className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0">
        {searchable ? (
          <div className="border-b border-border/50 p-2">
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-1.5">
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
                autoFocus
              />
            </div>
          </div>
        ) : null}

        <div className="max-h-64 overflow-y-auto p-1.5">
          {allowNone ? (
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
          ) : null}

          {filtered.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">No results</p>
          ) : (
            filtered.map((option) => {
              const isSelected = selected?.id === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelect(option.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/50",
                    isSelected && "bg-primary/10",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{option.label}</span>
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
        </div>
      </PopoverContent>
    </Popover>
  );
}
