"use client";

import { useEffect, useMemo, useState } from "react";
import { type SortingState } from "@tanstack/react-table";
import { ChevronDown } from "lucide-react";
import { DataTable } from "@/shared/components/data-table";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Input } from "@/shared/ui/input";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { cn } from "@/shared/utils/cn";
import { useGetEmployeeAttendanceQuery } from "../api/resources.api";
import type {
  AttendanceDayType,
  EmployeeAttendanceSortField,
} from "../types/resources.types";
import { createEmployeeAttendanceColumns } from "./team-member-attendance-columns";

const DAY_TYPE_OPTIONS: { value: string; label: string; dayType?: AttendanceDayType }[] = [
  { value: "all", label: "All day types" },
  { value: "0", label: "Working day", dayType: 0 },
  { value: "1", label: "Holiday", dayType: 1 },
  { value: "2", label: "Weekly off", dayType: 2 },
  { value: "3", label: "Leave", dayType: 3 },
  { value: "4", label: "Unknown", dayType: 4 },
];

const ATTENDANCE_SORTABLE = new Set<EmployeeAttendanceSortField>([
  "attendanceDate",
  "dayType",
  "shiftStartTime",
  "shiftDuration",
  "shiftEffectiveDuration",
  "totalEffectiveHours",
  "syncedAt",
]);

type FilterOption = { value: string; label: string };

function FilterMenu({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}) {
  const active = options.find((option) => option.value === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-xl border border-border/60 bg-muted/45 px-3 text-sm font-normal shadow-none outline-none hover:bg-muted/70",
          value !== options[0]?.value && "border-primary/40 bg-primary/5",
        )}
      >
        <span className="text-muted-foreground">{label}</span>
        <span className="max-w-[140px] truncate font-medium">
          {active?.label ?? label}
        </span>
        <ChevronDown className="size-3.5 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 p-1">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "cursor-pointer rounded-lg px-3 py-2",
              value === option.value && "bg-primary/5 font-medium",
            )}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatSyncTimestamp(value: string | null): string {
  if (!value) return "Not synced yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function TeamMemberAttendanceTab({ employeeId }: { employeeId: string }) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [dayTypeFilter, setDayTypeFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "attendanceDate", desc: true },
  ]);

  useEffect(() => {
    setPageIndex(0);
  }, [debouncedSearch, dayTypeFilter, fromDate, toDate, pageSize]);

  const activeSort = sorting[0];
  const sortBy =
    activeSort && ATTENDANCE_SORTABLE.has(activeSort.id as EmployeeAttendanceSortField)
      ? (activeSort.id as EmployeeAttendanceSortField)
      : "attendanceDate";
  const sortOrder = activeSort?.desc === false ? "asc" : "desc";

  const queryArgs = useMemo(
    () => ({
      employeeId,
      search: debouncedSearch || undefined,
      dayType: dayTypeFilter === "all" ? undefined : Number(dayTypeFilter),
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      sortBy,
      sortOrder: sortOrder as "asc" | "desc",
      page: pageIndex + 1,
      limit: pageSize,
    }),
    [
      employeeId,
      debouncedSearch,
      dayTypeFilter,
      fromDate,
      toDate,
      sortBy,
      sortOrder,
      pageIndex,
      pageSize,
    ],
  );

  const { data, isLoading, isFetching } = useGetEmployeeAttendanceQuery(queryArgs);
  const columns = useMemo(() => createEmployeeAttendanceColumns(), []);
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const filters = (
    <div className="flex flex-wrap items-center gap-2">
      <FilterMenu
        label="Type"
        value={dayTypeFilter}
        options={DAY_TYPE_OPTIONS.map(({ value, label }) => ({ value, label }))}
        onChange={setDayTypeFilter}
      />
      <Input
        type="date"
        value={fromDate}
        onChange={(event) => setFromDate(event.target.value)}
        className="h-9 w-auto rounded-xl border-border/60 bg-muted/45"
        aria-label="From date"
      />
      <Input
        type="date"
        value={toDate}
        onChange={(event) => setToDate(event.target.value)}
        className="h-9 w-auto rounded-xl border-border/60 bg-muted/45"
        aria-label="To date"
      />
      {(dayTypeFilter !== "all" || fromDate || toDate || search) && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9"
          onClick={() => {
            setDayTypeFilter("all");
            setFromDate("");
            setToDate("");
            setSearch("");
          }}
        >
          Clear
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Last successful sync: {formatSyncTimestamp(data?.lastSuccessfulSyncAt ?? null)}
        {isFetching && !isLoading ? " · Updating…" : ""}
      </p>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        manual
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search date (YYYY-MM-DD) or day type…"
        filters={filters}
        pageCount={pageCount}
        totalRows={total}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageChange={setPageIndex}
        onPageSizeChange={setPageSize}
        sorting={sorting}
        onSortingChange={setSorting}
        isLoading={isLoading}
        emptyMessage="No attendance records match your filters."
        minTableWidth="min-w-[1100px]"
        enableColumnReorder
        columnOrderStorageKey="cybsec-employee-attendance-column-order"
      />
    </div>
  );
}
