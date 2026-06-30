"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Calendar } from "@/shared/ui/calendar";
import { cn } from "@/shared/utils/cn";

type DateField = "start" | "end";

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseIsoDate(value?: string | null) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : startOfDay(parsed);
}

function formatTabLabel(value?: string | null) {
  const date = parseIsoDate(value);
  if (!date) return "—";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatWeekday(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: "short" });
}

function formatMonthDay(date: Date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
}

function upcomingSaturday(from: Date) {
  const day = from.getDay();
  const daysUntil = day === 6 ? 0 : day === 0 ? 6 : 6 - day;
  return addDays(from, daysUntil);
}

function upcomingMonday(from: Date) {
  const day = from.getDay();
  const offset = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  return addDays(from, offset);
}

function buildShortcuts(base: Date) {
  const today = startOfDay(base);
  const laterToday = new Date();
  const thisWeekend = upcomingSaturday(today);
  const nextWeek = upcomingMonday(today);
  const nextWeekend = addDays(thisWeekend, 7);
  const twoWeeks = addDays(today, 14);
  const fourWeeks = addDays(today, 28);

  return [
    { label: "Today", hint: formatWeekday(today), date: today },
    {
      label: "Later",
      hint: laterToday.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
      date: today,
    },
    { label: "Tomorrow", hint: formatWeekday(addDays(today, 1)), date: addDays(today, 1) },
    { label: "This weekend", hint: formatWeekday(thisWeekend), date: thisWeekend },
    { label: "Next week", hint: formatWeekday(nextWeek), date: nextWeek },
    { label: "Next weekend", hint: formatMonthDay(nextWeekend), date: nextWeekend },
    { label: "2 weeks", hint: formatMonthDay(twoWeeks), date: twoWeeks },
    { label: "4 weeks", hint: formatMonthDay(fourWeeks), date: fourWeeks },
  ];
}

function normalizeRange(start: Date, end: Date) {
  if (end < start) {
    return { start, end: start };
  }
  return { start, end };
}

interface BoardTaskDatePickerProps {
  startDate?: string | null;
  endDate?: string | null;
  onSave: (dates: { startDate: string; endDate: string }) => Promise<void>;
  children: ReactNode;
}

export function BoardTaskDatePicker({
  startDate,
  endDate,
  onSave,
  children,
}: BoardTaskDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [activeField, setActiveField] = useState<DateField>("end");
  const [draftStart, setDraftStart] = useState<Date | undefined>();
  const [draftEnd, setDraftEnd] = useState<Date | undefined>();
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const start = parseIsoDate(startDate) ?? startOfDay(new Date());
    const end = parseIsoDate(endDate) ?? addDays(start, 7);
    const range = normalizeRange(start, end);
    setDraftStart(range.start);
    setDraftEnd(range.end);
    setActiveField("end");
    setCalendarMonth(range.end);
  }, [open, startDate, endDate]);

  const shortcuts = useMemo(() => buildShortcuts(new Date()), [open]);

  const selectedDate = activeField === "start" ? draftStart : draftEnd;

  const applyDate = async (date: Date) => {
    let nextStart = draftStart ?? date;
    let nextEnd = draftEnd ?? date;

    if (activeField === "start") {
      nextStart = date;
      if (nextEnd < nextStart) nextEnd = nextStart;
    } else {
      nextEnd = date;
      if (nextStart > nextEnd) nextStart = nextEnd;
    }

    setDraftStart(nextStart);
    setDraftEnd(nextEnd);
    setCalendarMonth(date);
    setIsSaving(true);
    try {
      await onSave({ startDate: toIsoDate(nextStart), endDate: toIsoDate(nextEnd) });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        disabled={isSaving}
        className="text-left disabled:opacity-50"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="w-auto p-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex border-b border-border/50">
          <button
            type="button"
            onClick={() => {
              setActiveField("start");
              if (draftStart) setCalendarMonth(draftStart);
            }}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors border-b-2",
              activeField === "start"
                ? "border-foreground text-foreground bg-muted/30"
                : "border-transparent text-muted-foreground hover:bg-muted/20"
            )}
          >
            <CalendarIcon className="size-3.5" />
            <span>Start date</span>
            <span className="text-muted-foreground">
              {formatTabLabel(draftStart ? toIsoDate(draftStart) : startDate)}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveField("end");
              if (draftEnd) setCalendarMonth(draftEnd);
            }}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors border-b-2",
              activeField === "end"
                ? "border-foreground text-foreground bg-background"
                : "border-transparent text-muted-foreground hover:bg-muted/20"
            )}
          >
            <CalendarIcon className="size-3.5" />
            <span>Due date</span>
            <span className="text-muted-foreground">
              {formatTabLabel(draftEnd ? toIsoDate(draftEnd) : endDate)}
            </span>
          </button>
        </div>

        <div className="flex">
          <div className="w-44 shrink-0 border-r border-border/50 py-1">
            {shortcuts.map((shortcut) => (
              <button
                key={shortcut.label}
                type="button"
                onClick={() => void applyDate(shortcut.date)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-muted/50 transition-colors"
              >
                <span className="font-medium text-foreground">{shortcut.label}</span>
                <span className="text-muted-foreground shrink-0">{shortcut.hint}</span>
              </button>
            ))}
          </div>

          <div className="p-2">
            <Calendar
              mode="single"
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              selected={selectedDate}
              onSelect={(date) => {
                if (date) void applyDate(startOfDay(date));
              }}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function formatBoardDateRange(startDate?: string | null, endDate?: string | null) {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (!start && !end) return "No dates";
  if (start && end) {
    const sameYear = start.getFullYear() === end.getFullYear();
    const startLabel = start.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      ...(sameYear ? {} : { year: "numeric" }),
    });
    const endLabel = end.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    if (toIsoDate(start) === toIsoDate(end)) return endLabel;
    return `${startLabel} – ${endLabel}`;
  }
  return formatTabLabel(endDate ?? startDate);
}
