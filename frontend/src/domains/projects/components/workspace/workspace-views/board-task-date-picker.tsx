"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Calendar } from "@/shared/ui/calendar";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/utils/cn";
import {
  applyTimeToDate,
  mergeDateKeepingTime,
  parseTaskDateTime,
  toDateTimeString,
  toTimeInputValue,
} from "@/shared/utils/date";

type DateField = "start" | "end";

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function toDayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateTime(value?: string | null, fallbackHours = 9) {
  if (!value) return undefined;
  try {
    const parsed = parseTaskDateTime(value);
    if (Number.isNaN(parsed.getTime())) return undefined;
    // Legacy date-only midnight → sensible default time for inline edits
    if (
      parsed.getHours() === 0 &&
      parsed.getMinutes() === 0 &&
      /^(\d{4}-\d{2}-\d{2})(T00:00:00(\.0+)?Z)?$/.test(String(value).trim())
    ) {
      parsed.setHours(fallbackHours, 0, 0, 0);
    }
    return parsed;
  } catch {
    return undefined;
  }
}

function formatTabLabel(value?: Date | string | null) {
  if (!value) return "—";
  const date = value instanceof Date ? value : parseDateTime(value);
  if (!date) return "—";
  const day = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day}, ${time}`;
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
  return next;
}

function upcomingSaturday(from: Date) {
  const day = from.getDay();
  const daysUntil = day === 6 ? 0 : day === 0 ? 6 : 6 - day;
  return addDays(startOfDay(from), daysUntil);
}

function upcomingMonday(from: Date) {
  const day = from.getDay();
  const offset = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  return addDays(startOfDay(from), offset);
}

function buildShortcuts(base: Date) {
  const today = startOfDay(base);
  const laterToday = new Date();
  const thisWeekend = upcomingSaturday(today);
  const nextWeek = upcomingMonday(today);
  const nextWeekend = addDays(thisWeekend, 7);
  const twoWeeks = addDays(today, 14);
  const fourWeeks = addDays(today, 28);

  const withDefaultTime = (day: Date, hours: number, minutes = 0) => {
    const next = new Date(day);
    next.setHours(hours, minutes, 0, 0);
    return next;
  };

  return [
    { label: "Today", hint: formatWeekday(today), date: withDefaultTime(today, 9) },
    {
      label: "Later",
      hint: laterToday.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
      date: laterToday,
    },
    { label: "Tomorrow", hint: formatWeekday(addDays(today, 1)), date: withDefaultTime(addDays(today, 1), 9) },
    { label: "This weekend", hint: formatWeekday(thisWeekend), date: withDefaultTime(thisWeekend, 9) },
    { label: "Next week", hint: formatWeekday(nextWeek), date: withDefaultTime(nextWeek, 9) },
    { label: "Next weekend", hint: formatMonthDay(nextWeekend), date: withDefaultTime(nextWeekend, 9) },
    { label: "2 weeks", hint: formatMonthDay(twoWeeks), date: withDefaultTime(twoWeeks, 9) },
    { label: "4 weeks", hint: formatMonthDay(fourWeeks), date: withDefaultTime(fourWeeks, 9) },
  ];
}

function normalizeRange(start: Date, end: Date) {
  if (end < start) {
    return { start, end: new Date(start) };
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
    const start =
      parseDateTime(startDate, 9) ??
      (() => {
        const d = new Date();
        d.setHours(9, 0, 0, 0);
        return d;
      })();
    const end =
      parseDateTime(endDate, 17) ??
      (() => {
        const d = addDays(start, 7);
        d.setHours(17, 0, 0, 0);
        return d;
      })();
    const range = normalizeRange(start, end);
    setDraftStart(range.start);
    setDraftEnd(range.end);
    setActiveField("end");
    setCalendarMonth(range.end);
  }, [open, startDate, endDate]);

  const shortcuts = useMemo(() => buildShortcuts(new Date()), [open]);

  const selectedDate = activeField === "start" ? draftStart : draftEnd;

  const persist = async (nextStart: Date, nextEnd: Date) => {
    const range = normalizeRange(nextStart, nextEnd);
    setDraftStart(range.start);
    setDraftEnd(range.end);
    setIsSaving(true);
    try {
      await onSave({
        startDate: toDateTimeString(range.start),
        endDate: toDateTimeString(range.end),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const applyDate = async (date: Date) => {
    let nextStart = draftStart ?? date;
    let nextEnd = draftEnd ?? date;

    if (activeField === "start") {
      nextStart = mergeDateKeepingTime(date, draftStart, 9, 0);
      if (nextEnd < nextStart) {
        nextEnd = mergeDateKeepingTime(nextStart, draftEnd, 17, 0);
      }
    } else {
      nextEnd = mergeDateKeepingTime(date, draftEnd, 17, 0);
      if (nextStart > nextEnd) {
        nextStart = mergeDateKeepingTime(nextEnd, draftStart, 9, 0);
      }
    }

    setCalendarMonth(date);
    await persist(nextStart, nextEnd);
  };

  const applyTime = async (timeValue: string) => {
    if (activeField === "start") {
      const base = draftStart ?? new Date();
      const nextStart = applyTimeToDate(base, timeValue, 9, 0);
      let nextEnd = draftEnd ?? nextStart;
      if (nextEnd < nextStart) nextEnd = new Date(nextStart);
      await persist(nextStart, nextEnd);
    } else {
      const base = draftEnd ?? new Date();
      const nextEnd = applyTimeToDate(base, timeValue, 17, 0);
      let nextStart = draftStart ?? nextEnd;
      if (nextStart > nextEnd) nextStart = new Date(nextEnd);
      await persist(nextStart, nextEnd);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        disabled={isSaving}
        className="shrink-0 text-left disabled:opacity-50"
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
            <span>Start</span>
            <span className="text-muted-foreground">{formatTabLabel(draftStart ?? startDate)}</span>
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
            <span>Due</span>
            <span className="text-muted-foreground">{formatTabLabel(draftEnd ?? endDate)}</span>
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

          <div className="p-2 space-y-2">
            <Calendar
              mode="single"
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              selected={selectedDate}
              onSelect={(date) => {
                if (date) void applyDate(date);
              }}
            />
            <div className="px-1 pb-1">
              <Input
                type="time"
                className="h-8"
                value={toTimeInputValue(selectedDate)}
                disabled={isSaving || !selectedDate}
                onChange={(e) => void applyTime(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function formatBoardDateRange(startDate?: string | null, endDate?: string | null) {
  const start = parseDateTime(startDate, 9);
  const end = parseDateTime(endDate, 17);
  if (!start && !end) return "No dates";
  if (start && end) {
    const sameDay = toDayKey(start) === toDayKey(end);
    const startLabel = formatTabLabel(start);
    const endLabel = formatTabLabel(end);
    if (sameDay && start.getTime() === end.getTime()) return endLabel;
    if (sameDay) {
      const day = start.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
      const startTime = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      const endTime = end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      return `${day}, ${startTime} – ${endTime}`;
    }
    return `${startLabel} – ${endLabel}`;
  }
  return formatTabLabel(end ?? start);
}
