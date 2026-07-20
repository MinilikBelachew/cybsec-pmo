"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type SortingState } from "@tanstack/react-table";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  LayoutGrid,
  List,
  Loader2,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
} from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { EmployeeAvatar } from "@/shared/components/employee-avatar";
import { KpiStatCard, KPI_CARD_THEMES } from "@/shared/components/kpi-stat-card";
import { DataTable } from "@/shared/components/data-table";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { cn } from "@/shared/utils/cn";
import { useDebounce } from "@/shared/hooks/use-debounce";
import {
  useGetTeamDirectoryQuery,
  useGetTeamLeaveQuery,
} from "../api/resources.api";
import type {
  TeamDirectoryMember,
  TeamDirectorySortField,
  TeamLeaveSortField,
  UtilizationStatus,
} from "../types/resources.types";
import { formatUpcomingLeaveSummary, mapTeamDirectoryMember } from "../utils/team-directory.mapper";
import { KEKA_SYNC_CONFIG, UTILIZATION_CONFIG } from "../utils/resource-ui.config";
import { createTeamDirectoryColumns } from "./team-directory-columns";
import { createTeamLeaveColumns } from "./team-leave-columns";
import { TeamMemberDetail } from "./team-member-detail";

type DirectoryTab = "directory" | "leave";

const DIRECTORY_SORTABLE_COLUMNS = new Set<TeamDirectorySortField>([
  "name",
  "designation",
  "department",
  "utilization",
  "allocatedHours",
  "remainingHours",
]);

const LEAVE_SORTABLE_COLUMNS = new Set<TeamLeaveSortField>([
  "employeeName",
  "department",
  "type",
  "from",
  "days",
  "status",
]);

export function TeamDirectoryPage() {
  const [tab, setTab] = useState<DirectoryTab>("directory");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [utilFilter, setUtilFilter] = useState<UtilizationStatus | "all">("all");
  const [selected, setSelected] = useState<TeamDirectoryMember | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [directorySorting, setDirectorySorting] = useState<SortingState>([
    { id: "name", desc: false },
  ]);
  const [leaveSorting, setLeaveSorting] = useState<SortingState>([
    { id: "from", desc: true },
  ]);
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    setPageIndex(0);
  }, [debouncedSearch, utilFilter, tab, pageSize, directorySorting, leaveSorting]);

  const directoryQueryParams = useMemo(() => {
    const activeSort = directorySorting[0];
    const sortBy =
      activeSort && DIRECTORY_SORTABLE_COLUMNS.has(activeSort.id as TeamDirectorySortField)
        ? (activeSort.id as TeamDirectorySortField)
        : "name";

    return {
      search: debouncedSearch.trim() || undefined,
      utilizationStatus: utilFilter,
      sortBy,
      sortOrder: (activeSort?.desc ? "desc" : "asc") as "asc" | "desc",
      page: pageIndex + 1,
      limit: pageSize,
    };
  }, [debouncedSearch, utilFilter, directorySorting, pageIndex, pageSize]);

  const leaveQueryParams = useMemo(() => {
    const activeSort = leaveSorting[0];
    const sortBy =
      activeSort && LEAVE_SORTABLE_COLUMNS.has(activeSort.id as TeamLeaveSortField)
        ? (activeSort.id as TeamLeaveSortField)
        : "from";

    return {
      search: debouncedSearch.trim() || undefined,
      sortBy,
      sortOrder: (activeSort?.desc ? "desc" : "asc") as "asc" | "desc",
      page: pageIndex + 1,
      limit: pageSize,
    };
  }, [debouncedSearch, leaveSorting, pageIndex, pageSize]);

  const statsQueryParams = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      utilizationStatus: utilFilter,
      page: 1,
      limit: 1,
    }),
    [debouncedSearch, utilFilter],
  );

  const { data: statsData } = useGetTeamDirectoryQuery(statsQueryParams);

  const {
    data: directoryData,
    isLoading: isDirectoryLoading,
    isError: isDirectoryError,
    refetch: refetchDirectory,
    isFetching: isDirectoryFetching,
  } = useGetTeamDirectoryQuery(directoryQueryParams, { skip: tab !== "directory" });

  const {
    data: leaveData,
    isLoading: isLeaveLoading,
    isError: isLeaveError,
    refetch: refetchLeave,
    isFetching: isLeaveFetching,
  } = useGetTeamLeaveQuery(leaveQueryParams, { skip: tab !== "leave" });

  const members = useMemo(
    () => (directoryData?.members ?? []).map(mapTeamDirectoryMember),
    [directoryData?.members],
  );

  const stats = (tab === "directory" ? directoryData : statsData)?.stats ?? {
    total: 0,
    over: 0,
    available: 0,
    avgUtil: 0,
  };

  const directoryTotal = directoryData?.total ?? 0;
  const leaveTotal = leaveData?.total ?? 0;
  const directoryPageCount = Math.ceil(directoryTotal / pageSize) || 0;
  const leavePageCount = Math.ceil(leaveTotal / pageSize) || 0;

  const handleSelectMember = useCallback((member: TeamDirectoryMember) => {
    setSelected(member);
  }, []);

  const directoryColumns = useMemo(
    () => createTeamDirectoryColumns({ onSelect: handleSelectMember }),
    [handleSelectMember],
  );

  const leaveColumns = useMemo(() => createTeamLeaveColumns(), []);

  const isFetching = tab === "directory" ? isDirectoryFetching : isLeaveFetching;
  const refetch = tab === "directory" ? refetchDirectory : refetchLeave;

  if (selected) {
    return <TeamMemberDetail member={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Team Directory"
        description={`${stats.total} employees · utilization from active project allocations in the next 90 days`}
        actions={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => void refetch()}
            disabled={isFetching}
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

      {(tab === "directory" ? isDirectoryError : isLeaveError) && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400">
          Could not load team data. Try refreshing.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiStatCard
          title="Total"
          subtitle="Active employees"
          value={stats.total}
          numericValue={stats.total}
          chartMax={Math.max(stats.total, 1)}
          icon={Users}
          theme={KPI_CARD_THEMES.slate}
        />
        <KpiStatCard
          title="Overloaded"
          subtitle="Over weekly capacity"
          value={stats.over}
          numericValue={stats.over}
          chartMax={Math.max(stats.total, 1)}
          icon={AlertTriangle}
          theme={KPI_CARD_THEMES.rose}
        />
        <KpiStatCard
          title="Available"
          subtitle="Under 40% utilized"
          value={stats.available}
          numericValue={stats.available}
          chartMax={Math.max(stats.total, 1)}
          icon={CheckCircle2}
          theme={KPI_CARD_THEMES.sky}
        />
        <KpiStatCard
          title="Avg util."
          subtitle="Next 90 days"
          value={`${stats.avgUtil}%`}
          numericValue={stats.avgUtil}
          chartMax={100}
          icon={TrendingUp}
          theme={KPI_CARD_THEMES.primary}
        />
      </div>

      <div className="flex border-b border-border/50">
        {(
          [
            { id: "directory" as const, label: "Directory", icon: Users },
            { id: "leave" as const, label: "Leave", icon: Calendar },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              tab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              tab === "directory"
                ? "Search name, designation, department..."
                : "Search employee, department, leave type..."
            }
            className="pl-9"
          />
        </div>
        {tab === "directory" && (
          <div className="flex items-center gap-2">
            <Select
              value={utilFilter}
              onValueChange={(value) => setUtilFilter(value as UtilizationStatus | "all")}
            >
              <SelectTrigger size="sm" className="min-w-[160px]">
                <SelectValue placeholder="All utilization" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All utilization</SelectItem>
                <SelectItem value="over">Overloaded</SelectItem>
                <SelectItem value="optimal">Optimal</SelectItem>
                <SelectItem value="under">Underutilized</SelectItem>
                <SelectItem value="available">Available</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={view === "grid" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setView("grid")}
              aria-label="Grid view"
            >
              <LayoutGrid className="size-4" />
            </Button>
            <Button
              variant={view === "list" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setView("list")}
              aria-label="List view"
            >
              <List className="size-4" />
            </Button>
          </div>
        )}
      </div>

      {tab === "directory" ? (
        view === "grid" ? (
          isDirectoryLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading team directory…
            </div>
          ) : members.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No team members match your filters.
            </p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {members.map((member) => (
                  <MemberCard key={member.id} member={member} onSelect={() => setSelected(member)} />
                ))}
              </div>
              {directoryTotal > pageSize && (
                <DirectoryPagination
                  pageIndex={pageIndex}
                  pageSize={pageSize}
                  total={directoryTotal}
                  onPageChange={setPageIndex}
                  onPageSizeChange={setPageSize}
                />
              )}
            </>
          )
        ) : (
          <DataTable
            columns={directoryColumns}
            data={members}
            getRowId={(row) => row.id}
            manual
            hideSearch
            pageCount={directoryPageCount}
            totalRows={directoryTotal}
            pageIndex={pageIndex}
            pageSize={pageSize}
            onPageChange={setPageIndex}
            onPageSizeChange={setPageSize}
            sorting={directorySorting}
            onSortingChange={setDirectorySorting}
            isLoading={isDirectoryLoading}
            emptyMessage="No team members match your filters."
            minTableWidth="min-w-[960px]"
            onRowClick={handleSelectMember}
            enableColumnReorder
            columnOrderStorageKey="cybsec-team-directory-column-order-v3"
          />
        )
      ) : (
        <DataTable
          columns={leaveColumns}
          data={leaveData?.rows ?? []}
          getRowId={(row) => row.id}
          manual
          hideSearch
          pageCount={leavePageCount}
          totalRows={leaveTotal}
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPageChange={setPageIndex}
          onPageSizeChange={setPageSize}
          sorting={leaveSorting}
          onSortingChange={setLeaveSorting}
          isLoading={isLeaveLoading}
          emptyMessage="No leave records match your search."
          minTableWidth="min-w-[800px]"
          enableColumnReorder
          columnOrderStorageKey="cybsec-team-leave-column-order"
        />
      )}
    </div>
  );
}

function DirectoryPagination({
  pageIndex,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  pageIndex: number;
  pageSize: number;
  total: number;
  onPageChange: (pageIndex: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const pageCount = Math.ceil(total / pageSize) || 1;
  const from = pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, total);

  return (
    <div className="flex flex-col gap-3 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Select
          value={String(pageSize)}
          onValueChange={(value) => onPageSizeChange(Number(value))}
        >
          <SelectTrigger size="sm" className="min-w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[5, 10, 20].map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size} per page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          disabled={pageIndex <= 0}
          onClick={() => onPageChange(pageIndex - 1)}
        >
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {pageIndex + 1} of {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={pageIndex >= pageCount - 1}
          onClick={() => onPageChange(pageIndex + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function MemberCard({
  member,
  onSelect,
}: {
  member: TeamDirectoryMember;
  onSelect: () => void;
}) {
  const util = UTILIZATION_CONFIG[member.utilStatus];
  const keka = KEKA_SYNC_CONFIG[member.kekaSyncStatus];
  const KekaIcon = keka.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group rounded-2xl border border-border/60 bg-card p-5 text-left transition-all hover:border-primary/30 hover:shadow-md hover:shadow-primary/5"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <EmployeeAvatar
            name={member.name}
            employeeId={member.id}
            profileImageUrl={member.avatarUrl}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <p className="truncate text-sm font-bold">{member.name}</p>
                <KekaIcon className={cn("size-3.5 shrink-0", keka.text)} />
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
                  util.bg,
                  util.text,
                  util.border,
                )}
              >
                {util.label}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{member.designation}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{member.department}</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Utilization</span>
            <span className="font-bold text-foreground">{member.utilization}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all", util.bar)}
              style={{ width: `${Math.min(member.utilization, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{member.allocatedHours}h allocated</span>
            <span>{member.remainingHours}h remaining</span>
          </div>
        </div>
        {(() => {
          const leaveLabel = formatUpcomingLeaveSummary(member.upcomingLeave);
          if (!leaveLabel) return null;
          return (
            <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
              {leaveLabel}
            </p>
          );
        })()}
        {member.projects.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {member.projects.slice(0, 3).map((project) => (
              <span
                key={project}
                className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
              >
                {project}
              </span>
            ))}
            {member.projects.length > 3 && (
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                +{member.projects.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
