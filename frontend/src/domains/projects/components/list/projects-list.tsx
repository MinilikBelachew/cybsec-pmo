"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { type SortingState } from "@tanstack/react-table";
import { DataTable } from "@/shared/components/data-table";
import {
  useGetProjectsQuery,
  useGetPortfolioStatsQuery,
  useLazyExportProjectsQuery,
  useDeleteProjectMutation,
  useGetDepartmentsQuery,
  useGetCustomersQuery,
  useGetProjectManagersQuery,
} from "../../api/projects.api";
import { useLazyExportTasksQuery } from "../../api/tasks.api";
import { CreateProjectSheet } from "./create-project-sheet";
import { ImportProjectsDialog } from "./import-projects-dialog";
import { ImportMppDialog } from "../mpp/import-mpp-dialog";
import { createProjectListColumns } from "./project-list-columns";
import { exportProjectsToXLSX, convertToCSV, exportProjectsToPDF } from "../../utils/import-export";
import { ExportProjectsDialog } from "./export-projects-dialog";
import {
  DEFAULT_PROJECT_DEPT_COLOR,
  formatProjectTimeline,
  PROJECT_DEPT_COLOR,
} from "../../utils/project-display.utils";
import { formatProjectBudgetCompact } from "../../utils/format-budget";
import { EmployeeTooltip } from "../shared/employee-tooltip";
import { useModulePermissions } from "@/domains/auth/hooks/use-module-permissions";
import { cn } from "@/shared/utils/cn";
import { useRouter } from "@/i18n/routing";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { Button } from "@/shared/ui/button";
import { DeleteDialog } from "@/shared/ui/delete-dialog";
import { toast } from "react-hot-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import type { GetProjectsParams, PriorityLevel, Project, ProjectSortField, ProjectStatus } from "../../types/projects.types";
import {
  PROJECT_STATUS_CONFIG,
  PROJECT_STATUS_FILTER_OPTIONS,
  getProjectStatusConfig,
} from "../../utils/project-status";
import {
  Search, Plus, LayoutGrid, List, FolderKanban,
  CheckSquare, TrendingUp, MoreHorizontal, AlertTriangle,
  ChevronDown, X, Calendar, Milestone,
  Pencil, Eye, Trash2, Activity, CheckCircle2, PauseCircle,
  Upload,
  Download,
  Loader2,
  FileUp,
} from "lucide-react";
const STATUS_CONFIG = PROJECT_STATUS_CONFIG;

const PRIORITY_CONFIG: Record<PriorityLevel, { label: string; dot: string; bg: string; text: string }> = {
  Critical: { label: "Critical", dot: "bg-red-500", bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-700 dark:text-red-400" },
  High: { label: "High", dot: "bg-rose-500", bg: "bg-rose-50 dark:bg-rose-900/20", text: "text-rose-700 dark:text-rose-400" },
  Medium: { label: "Medium", dot: "bg-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400" },
  Low: { label: "Low", dot: "bg-slate-400", bg: "bg-slate-50 dark:bg-slate-900/20", text: "text-slate-600 dark:text-slate-400" },
};

const STATUS_FILTER_OPTIONS = PROJECT_STATUS_FILTER_OPTIONS;

const PRIORITY_FILTER_OPTIONS: { value: PriorityLevel | "all"; label: string; description: string; dot: string }[] = [
  { value: "all", label: "All priorities", description: "Any priority level", dot: "bg-muted-foreground" },
  { value: "Critical", label: "Critical", description: "Highest urgency", dot: "bg-red-500" },
  { value: "High", label: "High", description: "Important delivery", dot: "bg-rose-500" },
  { value: "Medium", label: "Medium", description: "Standard priority", dot: "bg-amber-400" },
  { value: "Low", label: "Low", description: "Lower urgency", dot: "bg-slate-400" },
];

type ProcessedProject = ReturnType<typeof enrichProject>;

function enrichProject(
  project: NonNullable<ReturnType<typeof useGetProjectsQuery>["data"]>["data"][number],
) {
  const tasksTotal = project.tasksTotal ?? 0;
  const tasksDone = project.tasksDone ?? 0;
  const milestonesTotal = project.milestonesTotal ?? 0;
  const milestonesDone = project.milestonesDone ?? 0;
  const progress =
    project.status === "Closed"
      ? 100
      : project.status === "Draft"
        ? 0
        : tasksTotal > 0
          ? Math.round((tasksDone / tasksTotal) * 100)
          : 0;

  const budget = project.value ?? 0;
  const budgetUsed = project.budgetSpent ?? 0;
  const budgetRemaining = project.budgetRemaining ?? Math.max(0, budget - budgetUsed);

  const team = [
    {
      initials: project.primaryPm?.displayName
        ? project.primaryPm.displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase()
        : "PM",
      color: "bg-primary",
      user: project.primaryPm,
      roleName: "Primary Project Manager",
    },
  ];
  if (project.secondaryPm?.displayName) {
    team.push({
      initials: project.secondaryPm.displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase(),
      color: "bg-primary/70",
      user: project.secondaryPm,
      roleName: "Secondary Project Manager",
    });
  }

  return {
    ...project,
    description: project.objective || "No objective description provided.",
    progress,
    tasksTotal,
    tasksDone,
    milestonesTotal,
    milestonesDone,
    risks: 0,
    budget,
    budgetUsed,
    budgetRemaining,
    team,
  };
}

const CARD_THEMES = {
  total: {
    border: "border-slate-200 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700",
    gradient: "from-slate-500/[0.05] via-transparent to-transparent",
    iconColor: "text-slate-500 dark:text-slate-400",
    chartColor: "text-slate-500/40 dark:text-slate-400/30",
    activeRing: "ring-slate-500/30 border-slate-500/40",
  },
  active: {
    border: "border-emerald-500/20 dark:border-emerald-500/10 hover:border-emerald-500/35 dark:hover:border-emerald-500/25",
    gradient: "from-emerald-500/[0.05] via-transparent to-transparent",
    iconColor: "text-emerald-500 dark:text-emerald-400",
    chartColor: "text-emerald-500/40 dark:text-emerald-400/30",
    activeRing: "ring-emerald-500/30 border-emerald-500/40",
  },
  atRisk: {
    border: "border-rose-500/20 dark:border-rose-500/10 hover:border-rose-500/35 dark:hover:border-rose-500/25",
    gradient: "from-rose-500/[0.05] via-transparent to-transparent",
    iconColor: "text-rose-500 dark:text-rose-400",
    chartColor: "text-rose-500/40 dark:text-rose-400/30",
    activeRing: "ring-rose-500/30 border-rose-500/40",
  },
  delayed: {
    border: "border-amber-500/20 dark:border-amber-500/10 hover:border-amber-500/35 dark:hover:border-amber-500/25",
    gradient: "from-amber-500/[0.05] via-transparent to-transparent",
    iconColor: "text-amber-500 dark:text-amber-400",
    chartColor: "text-amber-500/40 dark:text-amber-400/30",
    activeRing: "ring-amber-500/30 border-amber-500/40",
  },
  completed: {
    border: "border-sky-500/20 dark:border-sky-500/10 hover:border-sky-500/35 dark:hover:border-sky-500/25",
    gradient: "from-sky-500/[0.05] via-transparent to-transparent",
    iconColor: "text-sky-500 dark:text-sky-400",
    chartColor: "text-sky-500/40 dark:text-sky-400/30",
    activeRing: "ring-sky-500/30 border-sky-500/40",
  },
};

interface CardTheme {
  border: string;
  gradient: string;
  iconColor: string;
  chartColor: string;
  activeRing: string;
}

function formatPortfolioValue(val: number) {
  if (val >= 1_000_000) {
    return `$${(val / 1_000_000).toFixed(1)}M`;
  }
  if (val >= 1_000) {
    return `$${(val / 1_000).toFixed(1)}k`;
  }
  return `$${Math.round(val).toLocaleString()}`;
}

function MiniTrendChart({
  value,
  max,
  colorClass,
}: {
  value: number;
  max: number;
  colorClass?: string;
}) {
  const ratio = max > 0 ? value / max : 0;
  // Use relative points for a smooth trend line (x from 0 to 40, y from 0 to 14)
  const baseHeights = [0.2, 0.55, 0.35, 0.8, 0.65];
  const points = baseHeights.map((h, i) => {
    const x = i * 10;
    // Calculate y: if value is 0 (ratio is 0), y is 13 (flat line at the bottom).
    const y = 14 - (h * ratio * 10 + 1);
    return { x, y };
  });

  const linePath = `M ${points.map((p) => `${p.x} ${p.y}`).join(" L ")}`;
  const areaPath = `${linePath} L 40 14 L 0 14 Z`;

  return (
    <svg viewBox="0 0 40 14" className={cn("h-3.5 w-9 shrink-0", colorClass || "text-muted-foreground/40")} aria-hidden>
      {/* Area under the line */}
      <path d={areaPath} fill="currentColor" className="opacity-15" />
      {/* Trend line */}
      <path
        d={linePath}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PortfolioStatCard({
  title,
  subtitle,
  value,
  numericValue,
  chartMax,
  icon: Icon,
  theme,
}: {
  title: string;
  subtitle: string;
  value: string | number;
  numericValue: number;
  chartMax: number;
  icon: React.ElementType;
  theme: CardTheme;
}) {
  return (
    <div
      className={cn(
        "relative flex min-h-[82px] flex-col rounded-xl border bg-card p-3 px-3.5 text-left bg-gradient-to-l",
        theme.border,
        theme.gradient,
      )}
    >
      <div className="flex items-start justify-between gap-2 w-full">
        <span className="text-[11px] font-medium text-muted-foreground/90 truncate">{title}</span>
        <Icon className={cn("size-3.5 shrink-0", theme.iconColor)} />
      </div>

      <span className="mt-0.5 text-xl font-bold tracking-tight text-foreground">{value}</span>

      <div className="mt-auto flex items-end justify-between gap-2 pt-1 w-full">
        <span className="text-[10px] text-muted-foreground/75 truncate">{subtitle}</span>
        <MiniTrendChart value={numericValue} max={chartMax} colorClass={theme.chartColor} />
      </div>
    </div>
  );
}

function FilterCardDropdown<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; description: string; dot: string }[];
  onChange: (value: T) => void;
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
              "h-9 w-full gap-2 rounded-xl border-border/60 bg-muted/45 px-3 font-normal shadow-none sm:w-auto",
              value !== "all" && "border-primary/40 bg-primary/5",
            )}
          />
        }
      >
        <span className="text-muted-foreground">{label}</span>
        <span className="inline-flex items-center gap-1.5 font-medium">
          {active && active.value !== "all" && (
            <span className={cn("size-2 rounded-full", active.dot)} />
          )}
          <span className="max-w-[120px] truncate">{active?.label ?? label}</span>
        </span>
        <ChevronDown className="size-3.5 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 p-2 shadow-none">
        <div className="space-y-1">
          {options.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border px-2.5 py-1.5 text-left transition-colors cursor-pointer select-none focus:outline-none focus:bg-muted/50 focus:border-border/60",
                value === option.value
                  ? "border-primary/30 bg-primary/5"
                  : "border-transparent hover:border-border/60 hover:bg-muted/50",
              )}
            >
              <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", option.dot)} />
              <span className="min-w-0">
                <span className="block text-xs font-medium">{option.label}</span>
                <span className="block text-[10px] text-muted-foreground">{option.description}</span>
              </span>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const PROJECT_SORTABLE_COLUMNS = new Set<string>([
  "name",
  "primaryPm",
  "priority",
  "startDate",
  "status",
  "endDate",
  "createdAt",
  "value",
]);

export function ProjectsList() {
  const {
    canCreateProjects,
    canEditProjects,
    canViewProjects,
    canApproveProjects,
    canViewFinancials,
    canImportProjects,
    canExportProjects,
  } = useModulePermissions();
  const canCreate = canCreateProjects;
  const canUpdate = canEditProjects;
  const canView = canViewProjects;
  const canOpenProjectSheet = canUpdate || canView;
  const projectSheetActionLabel = canUpdate ? "Edit" : "View";
  const canDelete = canApproveProjects;
  
  const [view, setView] = useState<"grid" | "list">("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityLevel | "all">("all");
  const [listPageIndex, setListPageIndex] = useState(0);
  const [listPageSize, setListPageSize] = useState(10);
  const [listSorting, setListSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showMppImport, setShowMppImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProcessedProject | null>(null);

  // Fetch metadata lists for export resolving
  const { data: departments = [] } = useGetDepartmentsQuery();
  const { data: customers = [] } = useGetCustomersQuery();
  const { data: managers = [] } = useGetProjectManagersQuery();
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    setListPageIndex(0);
  }, [debouncedSearch, statusFilter, priorityFilter, listPageSize, listSorting]);

  const [deleteProject, { isLoading: isDeleting }] = useDeleteProjectMutation();
  const [triggerExportProjects, { isFetching: isExporting }] = useLazyExportProjectsQuery();
  const [triggerExportTasks, { isFetching: isExportingTasks }] = useLazyExportTasksQuery();

  const queryParams = useMemo((): GetProjectsParams => {
    const isListView = view === "list";
    const params: GetProjectsParams = isListView
      ? { page: listPageIndex + 1, limit: listPageSize }
      : { page: 1, limit: 100 };

    const trimmedSearch = debouncedSearch.trim();
    if (trimmedSearch) params.search = trimmedSearch;
    if (statusFilter !== "all") params.status = statusFilter;
    if (priorityFilter !== "all") params.priority = priorityFilter;

    const activeSort = listSorting[0];
    const sortBy =
      isListView && activeSort && PROJECT_SORTABLE_COLUMNS.has(activeSort.id)
        ? (activeSort.id as ProjectSortField)
        : "createdAt";

    params.sortBy = sortBy;
    params.sortOrder = activeSort?.desc ? "desc" : "asc";

    return params;
  }, [
    view,
    listPageIndex,
    listPageSize,
    listSorting,
    debouncedSearch,
    statusFilter,
    priorityFilter,
  ]);

  const { data, isLoading, isFetching, isError, refetch } = useGetProjectsQuery(queryParams);
  const { data: portfolioStats } = useGetPortfolioStatsQuery();

  const portfolioKpis = portfolioStats ?? data?.stats ?? {
    total: 0,
    active: 0,
    atRisk: 0,
    delayed: 0,
    completed: 0,
    totalValue: 0,
  };

  const processedProjects = useMemo(() => {
    if (!data?.data) return [];
    return data.data.map((project) => enrichProject(project));
  }, [data]);

  const hasActiveFilters =
    Boolean(debouncedSearch.trim()) || statusFilter !== "all" || priorityFilter !== "all";

  const existingProjects = useMemo(() => {
    return data?.data?.map((p) => ({ id: p.id, name: p.name })) || [];
  }, [data]);

  const handleDeleteProject = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProject(deleteTarget.id).unwrap();
      toast.success("Project deleted successfully");
      setDeleteTarget(null);
      refetch();
    } catch {
      toast.error("Failed to delete project");
    }
  };

  const handleExportData = async (selectedFields: string[], format: "xlsx" | "csv" | "pdf", selectedTaskFields?: string[]) => {
    const exportParams: GetProjectsParams = {};
    const trimmedSearch = debouncedSearch.trim();
    if (trimmedSearch) exportParams.search = trimmedSearch;
    if (statusFilter !== "all") exportParams.status = statusFilter;
    if (priorityFilter !== "all") exportParams.priority = priorityFilter;

    const exportToast = toast.loading(`Preparing portfolio export (${format.toUpperCase()})...`);
    try {
      const projectsToExport = await triggerExportProjects(exportParams).unwrap();
      if (!projectsToExport || projectsToExport.length === 0) {
        toast.dismiss(exportToast);
        toast.error("No projects to export.");
        return;
      }

      let blob: Blob;
      let filename: string;

      if (format === "xlsx" || format === "pdf") {
        toast.loading("Fetching tasks for projects...", { id: exportToast });
        const tasksPromises = projectsToExport.map((proj) =>
          triggerExportTasks({ projectId: proj.id, topLevelOnly: false }).unwrap()
        );
        const tasksResults = await Promise.all(tasksPromises);
        const allTasks = tasksResults.flatMap((tasks, index) => {
          const proj = projectsToExport[index];
          return tasks.map((t) => ({
            ...t,
            projectName: proj.name,
          }));
        });

        if (format === "xlsx") {
          const xlsxBuffer = exportProjectsToXLSX(projectsToExport, departments, customers, managers, selectedFields, allTasks, selectedTaskFields);
          blob = new Blob([xlsxBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
          filename = `projects_export_${new Date().toISOString().split("T")[0]}.xlsx`;
        } else {
          blob = exportProjectsToPDF(projectsToExport, departments, customers, managers, selectedFields, allTasks, selectedTaskFields);
          filename = `projects_export_${new Date().toISOString().split("T")[0]}.pdf`;
        }
      } else {
        const csvContent = convertToCSV(projectsToExport, departments, customers, managers, selectedFields);
        blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        filename = `projects_export_${new Date().toISOString().split("T")[0]}.csv`;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.dismiss(exportToast);
      toast.success(`Portfolio exported successfully to ${format.toUpperCase()}.`);
    } catch (err) {
      console.error(err);
      toast.dismiss(exportToast);
      toast.error("Failed to export projects.");
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        </div>
        {canCreate && (
          <Button
            onClick={() => setShowNew(true)}
          >
            <Plus className="size-4" />
            New Project
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <PortfolioStatCard
          title={canViewFinancials ? "Total value" : "Total projects"}
          subtitle={canViewFinancials ? "All in portfolio" : "In your portfolio"}
          value={
            canViewFinancials
              ? formatPortfolioValue(portfolioKpis.totalValue ?? 0)
              : portfolioKpis.total
          }
          numericValue={canViewFinancials ? (portfolioKpis.totalValue ?? 0) : portfolioKpis.total}
          chartMax={
            canViewFinancials
              ? Math.max(portfolioKpis.totalValue ?? 0, 1)
              : Math.max(portfolioKpis.total, 1)
          }
          icon={FolderKanban}
          theme={CARD_THEMES.total}
        />
        <PortfolioStatCard
          title="Active"
          subtitle="In delivery"
          value={portfolioKpis.active}
          numericValue={portfolioKpis.active}
          chartMax={Math.max(portfolioKpis.total, 1)}
          icon={Activity}
          theme={CARD_THEMES.active}
        />
        <PortfolioStatCard
          title="At risk"
          subtitle="Health concerns"
          value={portfolioKpis.atRisk}
          numericValue={portfolioKpis.atRisk}
          chartMax={Math.max(portfolioKpis.total, 1)}
          icon={AlertTriangle}
          theme={CARD_THEMES.atRisk}
        />
        <PortfolioStatCard
          title="Delayed"
          subtitle="On hold"
          value={portfolioKpis.delayed}
          numericValue={portfolioKpis.delayed}
          chartMax={Math.max(portfolioKpis.total, 1)}
          icon={PauseCircle}
          theme={CARD_THEMES.delayed}
        />
        <PortfolioStatCard
          title="Completed"
          subtitle="Closed projects"
          value={portfolioKpis.completed}
          numericValue={portfolioKpis.completed}
          chartMax={Math.max(portfolioKpis.total, 1)}
          icon={CheckCircle2}
          theme={CARD_THEMES.completed}
        />
      </div>
      <div className="flex flex-col gap-3">
        <div className="relative w-full min-w-0 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder="Search projects, PMs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 ps-9 pr-8 rounded-xl bg-muted/45 border border-border/50 text-sm outline-none focus:ring-1 focus:ring-primary/30 focus:bg-muted/65 transition-all text-foreground"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <FilterCardDropdown
            label="Status"
            value={statusFilter}
            options={STATUS_FILTER_OPTIONS}
            onChange={setStatusFilter}
          />
          <FilterCardDropdown
            label="Priority"
            value={priorityFilter}
            options={PRIORITY_FILTER_OPTIONS}
            onChange={setPriorityFilter}
          />
        </div>

        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:justify-end">
          <span className="text-xs text-muted-foreground w-full sm:w-auto sm:mr-auto">
            {processedProjects.length} of {portfolioKpis.total}
            {hasActiveFilters ? " matching" : ""}
          </span>

          <div className="flex items-center gap-0.5 p-1 rounded-xl bg-muted/50 border border-border/50 shrink-0">
            <button
              onClick={() => setView("grid")}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                view === "grid" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              onClick={() => setView("list")}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                view === "list" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="size-4" />
            </button>
          </div>

          {(canImportProjects || canExportProjects) && (
            <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5 sm:w-auto">
              {canImportProjects && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowImport(true)}
                  className="h-9 flex-1 gap-1.5 rounded-xl border-border/60 bg-muted/45 px-2.5 text-xs font-semibold shadow-none cursor-pointer sm:flex-none sm:px-3"
                >
                  <Upload className="size-3.5 shrink-0" />
                  Import
                </Button>
              )}
              {canImportProjects && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMppImport(true)}
                  className="h-9 flex-1 gap-1.5 rounded-xl border-border/60 bg-muted/45 px-2.5 text-xs font-semibold shadow-none cursor-pointer sm:flex-none sm:px-3"
                >
                  <FileUp className="size-3.5 shrink-0" />
                  Import MPP
                </Button>
              )}
              {canExportProjects && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowExport(true)}
                  disabled={isExporting}
                  className="h-9 flex-1 gap-1.5 rounded-xl border-border/60 bg-muted/45 px-2.5 text-xs font-semibold shadow-none cursor-pointer sm:flex-none sm:px-3"
                >
                  {isExporting ? (
                    <Loader2 className="size-3.5 shrink-0 animate-spin" />
                  ) : (
                    <Download className="size-3.5 shrink-0" />
                  )}
                  Export
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      {isLoading && view === "grid" && (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <p className="text-sm font-semibold animate-pulse">Loading projects...</p>
        </div>
      )}

      {isError && (
        <div className="text-center py-12 text-rose-500 font-semibold">
          Failed to load portfolio. Please try again.
        </div>
      )}

      {!isLoading && !isError && view === "grid" && processedProjects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
          <div className="size-14 rounded-2xl bg-muted/40 border border-border/40 flex items-center justify-center">
            <FolderKanban className="size-7 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-muted-foreground">No projects found</p>
          <p className="text-xs text-muted-foreground/60">Try adjusting your filters or search string</p>
          <button
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
              setPriorityFilter("all");
            }}
            className="text-xs text-primary hover:underline font-semibold"
          >
            Clear filters
          </button>
        </div>
      )}

      {!isLoading && !isError && view === "grid" && processedProjects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {processedProjects.map((p) => (
            <ProjectGridCard
              key={p.id}
              project={p}
              onEdit={canOpenProjectSheet ? setEditProject : undefined}
              onDelete={canDelete ? setDeleteTarget : undefined}
              projectSheetActionLabel={projectSheetActionLabel}
              showBudget={canViewFinancials}
            />
          ))}
        </div>
      )}

      {view === "list" && (
        <ProjectListView
          projects={processedProjects}
          isLoading={isLoading || isFetching}
          pageIndex={listPageIndex}
          pageSize={listPageSize}
          pageCount={data?.meta?.totalPages ?? 0}
          totalRows={data?.meta?.total ?? 0}
          sorting={listSorting}
          onPageChange={setListPageIndex}
          onPageSizeChange={setListPageSize}
          onSortingChange={setListSorting}
          onEdit={canOpenProjectSheet ? setEditProject : undefined}
          onDelete={canDelete ? setDeleteTarget : undefined}
          projectSheetActionLabel={projectSheetActionLabel}
          showBudget={canViewFinancials}
        />
      )}
      <CreateProjectSheet open={showNew} onClose={() => setShowNew(false)} refetch={refetch} />
      <CreateProjectSheet
        open={Boolean(editProject)}
        project={editProject}
        onClose={() => setEditProject(null)}
        refetch={refetch}
      />
      <ImportProjectsDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        refetch={refetch}
        existingProjects={existingProjects}
      />
      <ImportMppDialog
        open={showMppImport}
        onClose={() => setShowMppImport(false)}
        onCompleted={refetch}
      />
      <ExportProjectsDialog
        open={showExport}
        onClose={() => setShowExport(false)}
        onExport={handleExportData}
        isExporting={isExporting || isExportingTasks}
      />
      <DeleteDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteProject}
        isDeleting={isDeleting}
        title="Delete project?"
        description={
          deleteTarget
            ? `This will permanently delete "${deleteTarget.name}" and cannot be undone.`
            : ""
        }
      />
    </div>
  );
}

function ProjectGridCard({
  project: p,
  onEdit,
  onDelete,
  projectSheetActionLabel = "Edit",
  showBudget = true,
}: {
  project: ProcessedProject;
  onEdit?: (project: Project) => void;
  onDelete?: (project: ProcessedProject) => void;
  projectSheetActionLabel?: string;
  showBudget?: boolean;
}) {
  const router = useRouter();
  const s = getProjectStatusConfig(p.status);
  const budgetPct = p.budget > 0 ? Math.round((p.budgetUsed / p.budget) * 100) : 0;
  const overBudget = p.budgetUsed > p.budget;
  const showActions = Boolean(onEdit || onDelete);

  const openProject = () => router.push(`/dashboard/projects/${p.id}`);

  const handleCardKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openProject();
    }
  };

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card text-left transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-2">
          <div
            role="button"
            tabIndex={0}
            onClick={openProject}
            onKeyDown={handleCardKeyDown}
            className="min-w-0 flex-1 cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold", s.bg, s.text, s.border)}>
                <span className={cn("size-1.5 rounded-full", s.dot)} />
                {s.label}
              </span>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", PROJECT_DEPT_COLOR[p.department?.name ?? ""] || DEFAULT_PROJECT_DEPT_COLOR)}>
                {p.department?.name || "Direct"}
              </span>
            </div>

            <h3 className="truncate text-base font-bold leading-tight text-foreground">{p.name}</h3>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{p.description}</p>
          </div>

          {showActions && (
            <div
              className="flex shrink-0 items-center gap-0.5"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      className="rounded-lg p-1 text-muted-foreground opacity-0 transition-all hover:bg-muted/65 hover:text-foreground group-hover:opacity-100"
                    />
                  }
                >
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40" onClick={(event) => event.stopPropagation()}>
                  {onEdit && (
                    <DropdownMenuItem
                      className="cursor-pointer gap-2"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(p);
                      }}
                    >
                      {projectSheetActionLabel === "Edit" ? (
                        <Pencil className="size-3.5" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                      {projectSheetActionLabel}
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <DropdownMenuItem
                      className="cursor-pointer gap-2 text-rose-600 focus:text-rose-600"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(p);
                      }}
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={openProject}
          onKeyDown={handleCardKeyDown}
          className="cursor-pointer space-y-4 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground">Progress</span>
            <span className="text-[11px] font-bold text-foreground">{p.progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${p.progress}%` }}
            />
          </div>

        <div className="grid grid-cols-3 gap-2">
          <StatPill icon={CheckSquare} label="Tasks" value={`${p.tasksDone}/${p.tasksTotal}`} />
          <StatPill icon={Milestone} label="Milestones" value={`${p.milestonesDone}/${p.milestonesTotal}`} />
          <StatPill icon={AlertTriangle} label="Risks" value={String(p.risks)} />
        </div>

        {showBudget && p.budget > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-muted/40 p-2.5">
            <TrendingUp className={cn("size-3.5 shrink-0", overBudget ? "text-rose-500" : "text-muted-foreground")} />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted-foreground">Budget</span>
                <span className={cn("text-[10px] font-bold", overBudget ? "text-rose-500" : "text-foreground")}>
                  {formatProjectBudgetCompact(p.budgetUsed, p.currency)} / {formatProjectBudgetCompact(p.budget, p.currency)}
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", overBudget ? "bg-rose-400" : "bg-emerald-400")}
                  style={{ width: `${Math.min(budgetPct, 100)}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {formatProjectBudgetCompact(p.budgetRemaining, p.currency)} remaining
              </p>
            </div>
            <span className={cn("shrink-0 text-[10px] font-bold", overBudget ? "text-rose-500" : "text-muted-foreground")}>
              {budgetPct}%
            </span>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border/40 pt-1">
          <div className="flex items-center -space-x-1.5">
            {p.team.slice(0, 4).map((member: { initials: string; color: string; user?: any; roleName?: string }, index: number) => (
              <EmployeeTooltip
                key={index}
                employee={{
                  displayName: member.user?.displayName,
                  email: member.user?.email,
                  role: member.roleName,
                  designation: "Project Manager",
                }}
              >
                <span
                  className={cn("inline-flex size-6 items-center justify-center rounded-full border-2 border-card text-[9px] font-bold text-primary-foreground cursor-default", member.color)}
                >
                  {member.initials}
                </span>
              </EmployeeTooltip>
            ))}
          </div>

          <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
            <Calendar className="size-3" />
            {formatProjectTimeline(p.startDate, p.endDate)}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

function StatPill({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl border border-border/30 bg-muted/40 p-2">
      <Icon className="size-3.5 text-muted-foreground" />
      <span className="text-sm font-bold text-foreground">{value}</span>
      <span className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

function ProjectListView({
  projects,
  isLoading,
  pageIndex,
  pageSize,
  pageCount,
  totalRows,
  sorting,
  onPageChange,
  onPageSizeChange,
  onSortingChange,
  onEdit,
  onDelete,
  projectSheetActionLabel = "Edit",
  showBudget = true,
}: {
  projects: ProcessedProject[];
  isLoading: boolean;
  pageIndex: number;
  pageSize: number;
  pageCount: number;
  totalRows: number;
  sorting: SortingState;
  onPageChange: (pageIndex: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSortingChange: (sorting: SortingState) => void;
  onEdit?: (project: Project) => void;
  onDelete?: (project: ProcessedProject) => void;
  projectSheetActionLabel?: string;
  showBudget?: boolean;
}) {
  const router = useRouter();

  const handleNavigate = useCallback(
    (projectId: string) => {
      router.push(`/dashboard/projects/${projectId}`);
    },
    [router],
  );

  const columns = useMemo(
    () =>
      createProjectListColumns({
        onNavigate: handleNavigate,
        onEdit,
        onDelete,
        projectSheetActionLabel,
        showBudget,
      }),
    [handleNavigate, onEdit, onDelete, projectSheetActionLabel, showBudget],
  );

  return (
    <DataTable
      columns={columns}
      data={projects}
      getRowId={(row) => row.id}
      manual
      hideSearch
      pageCount={pageCount}
      totalRows={totalRows}
      pageIndex={pageIndex}
      pageSize={pageSize}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      sorting={sorting}
      onSortingChange={onSortingChange}
      isLoading={isLoading}
      emptyMessage="No projects match your filters."
      minTableWidth="min-w-[1100px]"
      enableColumnReorder
      columnOrderStorageKey="cybsec-projects-list-column-order"
    />
  );
}


