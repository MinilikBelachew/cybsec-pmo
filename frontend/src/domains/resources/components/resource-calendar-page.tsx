"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  PartyPopper,
  RefreshCw,
} from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/utils/cn";
import { useGetHolidayCalendarsQuery } from "../api/resources.api";
import type { HolidayEntry } from "../types/resources.types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatSyncedAt(value: string | null | undefined) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function buildMonthCells(year: number, monthIndex: number) {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const startPad = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const cells: Array<{
    key: string;
    day: number;
    inMonth: boolean;
    date: Date;
  }> = [];

  const prevDays = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  for (let i = startPad - 1; i >= 0; i -= 1) {
    const day = prevDays - i;
    const date = new Date(Date.UTC(year, monthIndex - 1, day));
    cells.push({ key: toDateKey(date), day, inMonth: false, date });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(Date.UTC(year, monthIndex, day));
    cells.push({ key: toDateKey(date), day, inMonth: true, date });
  }

  while (cells.length % 7 !== 0 || cells.length < 42) {
    const day = cells.length - (startPad + daysInMonth) + 1;
    const date = new Date(Date.UTC(year, monthIndex + 1, day));
    cells.push({ key: toDateKey(date), day, inMonth: false, date });
  }

  return cells;
}

export function ResourceCalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [monthIndex, setMonthIndex] = useState(now.getUTCMonth());
  const [calendarId, setCalendarId] = useState<string>("all");

  const { data, isLoading, isFetching, refetch, isError } =
    useGetHolidayCalendarsQuery({
      year,
      calendarId: calendarId === "all" ? undefined : calendarId,
    });

  const holidaysByDate = useMemo(() => {
    const map = new Map<string, HolidayEntry[]>();
    for (const holiday of data?.holidays ?? []) {
      const key = toDateKey(holiday.holidayDate);
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(holiday);
      map.set(key, list);
    }
    return map;
  }, [data?.holidays]);

  const cells = useMemo(
    () => buildMonthCells(year, monthIndex),
    [year, monthIndex],
  );

  const monthHolidays = useMemo(() => {
    const prefix = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
    return (data?.holidays ?? []).filter((holiday) =>
      toDateKey(holiday.holidayDate).startsWith(prefix),
    );
  }, [data?.holidays, monthIndex, year]);

  const monthLabel = new Date(Date.UTC(year, monthIndex, 1)).toLocaleString(
    "en-US",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );

  const selectedCalendarLabel = useMemo(() => {
    if (calendarId === "all") return "All calendars";
    const selected = (data?.calendars ?? []).find(
      (calendar) => calendar.id === calendarId,
    );
    if (!selected) return "Holiday calendar";
    return `${selected.name} (${selected.holidayCount})`;
  }, [calendarId, data?.calendars]);

  const shiftMonth = (delta: number) => {
    const next = new Date(Date.UTC(year, monthIndex + delta, 1));
    setYear(next.getUTCFullYear());
    setMonthIndex(next.getUTCMonth());
  };

  const todayKey = toDateKey(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Keka holiday calendars for capacity and resource planning."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            {isFetching ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Refresh
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <p className="min-w-[10rem] text-center text-sm font-semibold">
            {monthLabel}
          </p>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setYear(now.getUTCFullYear());
              setMonthIndex(now.getUTCMonth());
            }}
          >
            Today
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={String(year)}
            onValueChange={(value) => {
              if (value) setYear(Number(value));
            }}
          >
            <SelectTrigger className="h-8 w-[110px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {[year - 1, year, year + 1].map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={calendarId}
            onValueChange={(value) => {
              if (value) setCalendarId(value);
            }}
          >
            <SelectTrigger className="h-8 w-[220px]">
              <SelectValue placeholder="Holiday calendar">
                {selectedCalendarLabel}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All calendars</SelectItem>
              {(data?.calendars ?? []).map((calendar) => (
                <SelectItem key={calendar.id} value={calendar.id}>
                  {calendar.name} ({calendar.holidayCount})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Last holiday sync: {formatSyncedAt(data?.lastSyncedAt)} ·{" "}
        {(data?.holidays ?? []).length} holiday
        {(data?.holidays ?? []).length === 1 ? "" : "s"} in {year}
      </p>

      {isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
          Could not load holiday calendars. Sync holidays from Integrations →
          Keka, then refresh.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
          {isLoading && !data ? (
            <div className="flex h-72 items-center justify-center text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 border-b border-border/50">
                {WEEKDAYS.map((day) => (
                  <div
                    key={day}
                    className="py-2 text-center text-[11px] font-medium text-muted-foreground"
                  >
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {cells.map((cell) => {
                  const holidays = holidaysByDate.get(cell.key) ?? [];
                  const isToday = cell.key === todayKey;
                  return (
                    <div
                      key={`${cell.key}-${cell.inMonth}`}
                      className={cn(
                        "min-h-[88px] border-b border-r border-border/30 p-1.5 last:border-r-0",
                        !cell.inMonth && "bg-muted/20 text-muted-foreground",
                        isToday && "bg-primary/5",
                        holidays.length > 0 &&
                          cell.inMonth &&
                          "bg-amber-50/70 dark:bg-amber-950/20",
                      )}
                    >
                      <div className="mb-1 flex items-center justify-between gap-1">
                        <span
                          className={cn(
                            "inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                            isToday &&
                              "bg-primary text-primary-foreground font-semibold",
                          )}
                        >
                          {cell.day}
                        </span>
                        {holidays.length > 0 ? (
                          <PartyPopper className="size-3 text-amber-600" />
                        ) : null}
                      </div>
                      <div className="space-y-0.5">
                        {holidays.slice(0, 2).map((holiday) => (
                          <div
                            key={holiday.id}
                            className="truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight text-amber-900 dark:text-amber-200"
                            title={`${holiday.name} · ${holiday.calendarName}`}
                          >
                            {holiday.name}
                          </div>
                        ))}
                        {holidays.length > 2 ? (
                          <p className="px-1 text-[10px] text-muted-foreground">
                            +{holidays.length - 2} more
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <CalendarDays className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">This month</h3>
          </div>

          {monthHolidays.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No holidays in {monthLabel}.
              {!data?.calendars?.length
                ? " Sync holidays from Integrations → Keka if calendars are empty."
                : null}
            </p>
          ) : (
            <ul className="space-y-2">
              {monthHolidays.map((holiday) => (
                <li
                  key={holiday.id}
                  className="rounded-lg border border-border/50 px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{holiday.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(holiday.holidayDate).toLocaleDateString(
                          undefined,
                          {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            timeZone: "UTC",
                          },
                        )}
                        {" · "}
                        {holiday.calendarName}
                      </p>
                    </div>
                    {holiday.isFloater ? (
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        Floater
                      </Badge>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
