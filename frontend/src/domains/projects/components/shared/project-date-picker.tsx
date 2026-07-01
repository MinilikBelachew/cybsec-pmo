"use client";

import { Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Calendar } from "@/shared/ui/calendar";
import { cn } from "@/shared/utils/cn";

function toDate(value?: string | Date | null): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function startOfToday(): Date {
  return startOfDay(new Date());
}

function formatDateLabel(value?: string | Date | null): string {
  const date = toDate(value);
  if (!date) return "Pick a date";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface ProjectDatePickerProps {
  value?: string | Date | null;
  onChange: (value: Date | undefined) => void;
  minDate?: Date;
  maxDate?: Date;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  invalid?: boolean;
}

export function ProjectDatePicker({
  value,
  onChange,
  minDate = startOfToday(),
  maxDate,
  placeholder = "Pick a date",
  className,
  disabled = false,
  invalid = false,
}: ProjectDatePickerProps) {
  const selected = toDate(value);
  const currentYear = new Date().getFullYear();
  const startMonth = new Date(currentYear, 0);
  const endMonth = new Date(currentYear + 15, 11);

  return (
    <Popover>
      <PopoverTrigger
        type="button"
        disabled={disabled}
        className={cn(
          "flex h-8 w-full cursor-pointer items-center justify-between rounded-lg border bg-slate-50 px-3 text-sm text-slate-900 outline-none transition-all hover:border-slate-300 dark:bg-white/[0.03] dark:text-white dark:hover:border-white/20",
          invalid
            ? "border-rose-500 ring-2 ring-rose-500/20 dark:border-rose-500"
            : "border-slate-200 dark:border-white/[0.08]",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        <span className={selected ? "font-medium text-slate-900 dark:text-white" : "text-slate-400"}>
          {selected ? formatDateLabel(selected) : placeholder}
        </span>
        <CalendarIcon className="size-4 text-slate-400" />
      </PopoverTrigger>
      <PopoverContent
        className="w-auto border border-slate-200 bg-white p-0 shadow-xl dark:border-white/[0.08] dark:bg-zinc-950"
        align="start"
      >
        <Calendar
          mode="single"
          captionLayout="dropdown"
          startMonth={startMonth}
          endMonth={endMonth}
          selected={selected}
          defaultMonth={selected ?? minDate}
          disabled={{
            before: startOfDay(minDate),
            ...(maxDate ? { after: startOfDay(maxDate) } : {}),
          }}
          onSelect={(date) => onChange(date ?? undefined)}
        />
      </PopoverContent>
    </Popover>
  );
}
