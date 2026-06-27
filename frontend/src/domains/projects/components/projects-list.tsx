"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  useGetProjectsQuery,
  useLazyExportProjectsQuery,
  useDeleteProjectMutation,
  useGetDepartmentsQuery,
  useGetCustomersQuery,
  useGetProjectManagersQuery,
} from "../api/projects.api";
import { CreateProjectSheet } from "./create-project-sheet";
import { ImportProjectsDialog } from "./import-projects-dialog";
import { convertToCSV } from "../utils/import-export";
import { useAppAbility } from "@/domains/auth/casl/ability-context";
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
import type { GetProjectsParams, PriorityLevel, Project, ProjectStatus } from "../types/projects.types";
import {
  Search, Plus, LayoutGrid, List, FolderKanban,
  CheckSquare, TrendingUp, MoreHorizontal, AlertTriangle,
  ChevronDown, X, Star, ArrowUpRight, Calendar, Milestone,
  Pencil, Trash2, Activity, CheckCircle2, PauseCircle,
  Loader2,
  Download,
  Upload,
} from "lucide-react";

// ─── Status Config Mapping ────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, {
  label: string; dot: string; text: string; bg: string; border: string
}> = {
  Active: { 
    label: "Active", 
    dot: "bg-emerald-500", 
    text: "text-emerald-700 dark:text-emerald-400", 
    bg: "bg-emerald-50 dark:bg-emerald-900/20", 
    border: "border-emerald-200 dark:border-emerald-800" 
  },
  OnHold: { 
    label: "On Hold", 
    dot: "bg-amber-400", 
    text: "text-amber-700 dark:text-amber-400", 
    bg: "bg-amber-50 dark:bg-amber-900/20", 
    border: "border-amber-200 dark:border-amber-800" 
  },
  PendingClosure: { 
    label: "At Risk", 
    dot: "bg-rose-500", 
    text: "text-rose-700 dark:text-rose-400", 
    bg: "bg-rose-50 dark:bg-rose-900/20", 
    border: "border-rose-200 dark:border-rose-800" 
  },
  Closed: { 
    label: "Completed", 
    dot: "bg-primary", 
    text: "text-primary", 
    bg: "bg-primary/10", 
    border: "border-primary/30" 
  },
  Draft: { 
    label: "Draft", 
    dot: "bg-muted-foreground", 
    text: "text-muted-foreground", 
    bg: "bg-muted/40", 
    border: "border-border" 
  },
};

const METHODOLOGY_EMOJI: Record<string, string> = {
  Agile: "⚡", Waterfall: "🌊", Hybrid: "🔀",
};

const DEPT_COLOR: Record<string, string> = {
  Engineering: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  Delivery: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  Finance: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  HR: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300",
  Product: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  SOC: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  GRC: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  Cloud: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  AppSec: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300",
};

const PRIORITY_CONFIG: Record<PriorityLevel, { label: string; dot: string; bg: string; text: string }> = {
  Critical: { label: "Critical", dot: "bg-red-500", bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-700 dark:text-red-400" },
  High: { label: "High", dot: "bg-rose-500", bg: "bg-rose-50 dark:bg-rose-900/20", text: "text-rose-700 dark:text-rose-400" },
  Medium: { label: "Medium", dot: "bg-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400" },
  Low: { label: "Low", dot: "bg-slate-400", bg: "bg-slate-50 dark:bg-slate-900/20", text: "text-slate-600 dark:text-slate-400" },
};

const STATUS_FILTER_OPTIONS: { value: ProjectStatus | "all"; label: string; description: string; dot: string }[] = [
  { value: "all", label: "All statuses", description: "Every project in your portfolio", dot: "bg-muted-foreground" },
  { value: "Active", label: "Active", description: "Currently in delivery", dot: "bg-emerald-500" },
  { value: "PendingClosure", label: "At risk", description: "Pending closure review", dot: "bg-rose-500" },
  { value: "OnHold", label: "On hold", description: "Paused or delayed", dot: "bg-amber-400" },
  { value: "Closed", label: "Completed", description: "Successfully closed", dot: "bg-primary" },
  { value: "Draft", label: "Draft", description: "Not yet started", dot: "bg-muted-foreground" },
];

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
  starredIds: string[],
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
      color: "bg-violet-500",
    },
  ];
  if (project.secondaryPm?.displayName) {
    team.push({
      initials: project.secondaryPm.displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase(),
      color: "bg-sky-500",
    });
  }

  return {
    ...project,
    description: project.objective || "No objective description provided.",
    starred: starredIds.includes(project.id),
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

function formatPmShortName(name?: string) {
  if (!name) return "Unassigned";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}

function formatBudgetK(amount: number) {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(1);
}

function formatProjectTimeline(startDate?: string, endDate?: string) {
  const format = (value?: string) => {
    if (!value) return "—";
    return new Date(value).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };
  return `${format(startDate)} → ${format(endDate)}`;
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
  if (val >= 1000) {
    return `$${(val / 1000).toFixed(1)}M`;
  }
  return `$${val}k`;
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
  active,
  onClick,
  theme,
}: {
  title: string;
  subtitle: string;
  value: string | number;
  numericValue: number;
  chartMax: number;
  icon: React.ElementType;
  active?: boolean;
  onClick: () => void;
  theme: CardTheme;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex min-h-[82px] flex-col rounded-xl border bg-card p-3 px-3.5 text-left transition-all bg-gradient-to-l",
        theme.border,
        theme.gradient,
        active ? cn("ring-1 bg-muted/15 shadow-xs", theme.activeRing) : "hover:shadow-xs",
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
    </button>
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
              "h-9 gap-2 rounded-xl border-border/60 bg-muted/45 px-3 font-normal shadow-none",
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
      <DropdownMenuContent align="start" className="w-64 p-2">
        <div className="space-y-1">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                value === option.value
                  ? "border-primary/30 bg-primary/5"
                  : "border-transparent hover:border-border/60 hover:bg-muted/50",
              )}
            >
              <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", option.dot)} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{option.label}</span>
                <span className="block text-[11px] text-muted-foreground">{option.description}</span>
              </span>
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ProjectsList() {
  const ability = useAppAbility();
  const canCreate = ability?.can("create", "Project") ?? false;
  const canUpdate = ability?.can("update", "Project") ?? false;
  const canDelete = ability?.can("approve", "Project") ?? false;
  
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityLevel | "all">("all");
  const [starredIds, setStarredIds] = useState<string[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProcessedProject | null>(null);

  // Fetch metadata lists for export resolving
  const { data: departments = [] } = useGetDepartmentsQuery();
  const { data: customers = [] } = useGetCustomersQuery();
  const { data: managers = [] } = useGetProjectManagersQuery();
  const debouncedSearch = useDebounce(search, 300);

  const [deleteProject, { isLoading: isDeleting }] = useDeleteProjectMutation();
  const [triggerExportProjects, { isFetching: isExporting }] = useLazyExportProjectsQuery();

  const queryParams = useMemo((): GetProjectsParams => {
    const params: GetProjectsParams = { page: 1, limit: 100 };
    const trimmedSearch = debouncedSearch.trim();
    if (trimmedSearch) params.search = trimmedSearch;
    if (statusFilter !== "all") params.status = statusFilter;
    if (priorityFilter !== "all") params.priority = priorityFilter;
    return params;
  }, [debouncedSearch, statusFilter, priorityFilter]);

  const { data, isLoading, isError, refetch } = useGetProjectsQuery(queryParams);

  useEffect(() => {
    const saved = localStorage.getItem("pmo_starred_projects");
    if (saved) {
      try {
        setStarredIds(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const toggleStar = (id: string) => {
    const next = starredIds.includes(id)
      ? starredIds.filter((x) => x !== id)
      : [...starredIds, id];
    setStarredIds(next);
    localStorage.setItem("pmo_starred_projects", JSON.stringify(next));
  };

  const processedProjects = useMemo(() => {
    if (!data?.data) return [];
    return data.data.map((project) => enrichProject(project, starredIds));
  }, [data, starredIds]);

  const totalValue = useMemo(() => {
    return processedProjects.reduce((acc, p) => acc + (p.value ?? 0), 0);
  }, [processedProjects]);

  const stats = data?.stats ?? {
    total: processedProjects.length,
    active: processedProjects.filter((p) => p.status === "Active").length,
    atRisk: processedProjects.filter((p) => p.status === "PendingClosure").length,
    delayed: processedProjects.filter((p) => p.status === "OnHold").length,
    completed: processedProjects.filter((p) => p.status === "Closed").length,
  };

  const hasActiveFilters =
    Boolean(debouncedSearch.trim()) || statusFilter !== "all" || priorityFilter !== "all";

  const existingProjectNames = useMemo(() => {
    return data?.data?.map((p) => p.name) || [];
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

  const handleExportCSV = async () => {
    const exportParams: GetProjectsParams = {};
    const trimmedSearch = debouncedSearch.trim();
    if (trimmedSearch) exportParams.search = trimmedSearch;
    if (statusFilter !== "all") exportParams.status = statusFilter;
    if (priorityFilter !== "all") exportParams.priority = priorityFilter;

    const exportToast = toast.loading("Preparing portfolio export...");
    try {
      const projectsToExport = await triggerExportProjects(exportParams).unwrap();
      if (!projectsToExport || projectsToExport.length === 0) {
        toast.dismiss(exportToast);
        toast.error("No projects to export.");
        return;
      }

      const csvContent = convertToCSV(projectsToExport, departments, customers, managers);
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `projects_export_${new Date().toISOString().split("T")[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.dismiss(exportToast);
      toast.success("Portfolio exported successfully to CSV.");
    } catch (err) {
      console.error(err);
      toast.dismiss(exportToast);
      toast.error("Failed to export projects.");
    }
  };

  return (
    <div className="space-y-6 pb-10">
      
      {/* ── Page Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">
            Portfolio
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {stats.total} projects · {stats.active} active · {stats.atRisk} at risk
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity  shrink-0 cursor-pointer"
          >
            <Plus className="size-4" />
            New Project
          </button>
        )}
      </div>

      {/* ── Summary Strip ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <PortfolioStatCard
          title="Total value"
          subtitle="All in portfolio"
          value={formatPortfolioValue(totalValue)}
          numericValue={totalValue}
          chartMax={Math.max(totalValue, 1)}
          icon={FolderKanban}
          active={statusFilter === "all"}
          onClick={() => setStatusFilter("all")}
          theme={CARD_THEMES.total}
        />
        <PortfolioStatCard
          title="Active"
          subtitle="In delivery"
          value={stats.active}
          numericValue={stats.active}
          chartMax={Math.max(stats.total, 1)}
          icon={Activity}
          active={statusFilter === "Active"}
          onClick={() => setStatusFilter("Active")}
          theme={CARD_THEMES.active}
        />
        <PortfolioStatCard
          title="At risk"
          subtitle="Pending closure"
          value={stats.atRisk}
          numericValue={stats.atRisk}
          chartMax={Math.max(stats.total, 1)}
          icon={AlertTriangle}
          active={statusFilter === "PendingClosure"}
          onClick={() => setStatusFilter("PendingClosure")}
          theme={CARD_THEMES.atRisk}
        />
        <PortfolioStatCard
          title="Delayed"
          subtitle="On hold"
          value={stats.delayed}
          numericValue={stats.delayed}
          chartMax={Math.max(stats.total, 1)}
          icon={PauseCircle}
          active={statusFilter === "OnHold"}
          onClick={() => setStatusFilter("OnHold")}
          theme={CARD_THEMES.delayed}
        />
        <PortfolioStatCard
          title="Completed"
          subtitle="Closed projects"
          value={stats.completed}
          numericValue={stats.completed}
          chartMax={Math.max(stats.total, 1)}
          icon={CheckCircle2}
          active={statusFilter === "Closed"}
          onClick={() => setStatusFilter("Closed")}
          theme={CARD_THEMES.completed}
        />
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
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

        {/* Filters */}
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

        <div className="flex-1" />

        {/* Count */}
        <span className="text-xs text-muted-foreground">
          {processedProjects.length} of {stats.total}
          {hasActiveFilters ? " matching" : ""}
        </span>

        {/* Grid/List View Toggles */}
        <div className="flex items-center gap-0.5 p-1 rounded-xl bg-muted/50 border border-border/50">
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

        {/* Import/Export Buttons */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImport(true)}
            className="h-9 gap-1.5 rounded-xl border-border/60 bg-muted/45 px-3 font-semibold shadow-none cursor-pointer"
          >
            <Upload className="size-3.5" />
            Import
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={isExporting}
            className="h-9 gap-1.5 rounded-xl border-border/60 bg-muted/45 px-3 font-semibold shadow-none cursor-pointer"
          >
            {isExporting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            Export
          </Button>
        </div>
      </div>

      {/* ── Content View ── */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <p className="text-sm font-semibold animate-pulse">Loading projects...</p>
        </div>
      )}

      {isError && (
        <div className="text-center py-12 text-rose-500 font-semibold">
          Failed to load portfolio. Please try again.
        </div>
      )}

      {!isLoading && !isError && processedProjects.length === 0 && (
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

      {!isLoading && !isError && processedProjects.length > 0 && (
        view === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {processedProjects.map((p) => (
              <ProjectGridCard
                key={p.id}
                project={p}
                onToggleStar={toggleStar}
                onEdit={canUpdate ? setEditProject : undefined}
                onDelete={canDelete ? setDeleteTarget : undefined}
              />
            ))}
          </div>
        ) : (
          <ProjectListView
            projects={processedProjects}
            onToggleStar={toggleStar}
            onEdit={canUpdate ? setEditProject : undefined}
            onDelete={canDelete ? setDeleteTarget : undefined}
          />
        )
      )}

      {/* ── New Project Side Sheet ── */}
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
        existingProjectNames={existingProjectNames}
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

// ─── Subcomponents ───────────────────────────────────────────────────────────

function ProjectGridCard({
  project: p,
  onToggleStar,
  onEdit,
  onDelete,
}: {
  project: ProcessedProject;
  onToggleStar: (id: string) => void;
  onEdit?: (project: Project) => void;
  onDelete?: (project: ProcessedProject) => void;
}) {
  const router = useRouter();
  const s = STATUS_CONFIG[p.status] || STATUS_CONFIG.Draft;
  const budgetPct = p.budget > 0 ? Math.round((p.budgetUsed / p.budget) * 100) : 0;
  const overBudget = p.budgetUsed > p.budget;
  const showActions = Boolean(onEdit || onDelete);

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold", s.bg, s.text, s.border)}>
                <span className={cn("size-1.5 rounded-full", s.dot)} />
                {s.label}
              </span>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", DEPT_COLOR[p.department?.name ?? ""] || DEPT_COLOR.Engineering)}>
                {p.department?.name || "Direct"}
              </span>
              <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {METHODOLOGY_EMOJI[p.methodology] || "🔀"} {p.methodology || "Hybrid"}
              </span>
            </div>

            <h3 className="truncate text-base font-bold leading-tight text-foreground">{p.name}</h3>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{p.description}</p>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar(p.id);
              }}
              className={cn("rounded-lg p-1 transition-colors", p.starred ? "text-amber-400" : "text-muted-foreground/30 hover:text-amber-400")}
            >
              <Star className={cn("size-4", p.starred && "fill-amber-400")} />
            </button>

            {showActions && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      className="rounded-lg p-1 text-muted-foreground opacity-0 transition-all hover:bg-muted/65 hover:text-foreground group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    />
                  }
                >
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  {onEdit && (
                    <DropdownMenuItem
                      className="cursor-pointer gap-2"
                      onClick={() => onEdit(p)}
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <DropdownMenuItem
                      className="cursor-pointer gap-2 text-rose-600 focus:text-rose-600"
                      onClick={() => onDelete(p)}
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
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
        </div>

        <div className="grid grid-cols-3 gap-2">
          <StatPill icon={CheckSquare} label="Tasks" value={`${p.tasksDone}/${p.tasksTotal}`} />
          <StatPill icon={Milestone} label="Milestones" value={`${p.milestonesDone}/${p.milestonesTotal}`} />
          <StatPill icon={AlertTriangle} label="Risks" value={String(p.risks)} />
        </div>

        {p.budget > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-muted/40 p-2.5">
            <TrendingUp className={cn("size-3.5 shrink-0", overBudget ? "text-rose-500" : "text-muted-foreground")} />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted-foreground">Budget</span>
                <span className={cn("text-[10px] font-bold", overBudget ? "text-rose-500" : "text-foreground")}>
                  ${formatBudgetK(p.budgetUsed)}k / ${formatBudgetK(p.budget)}k
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", overBudget ? "bg-rose-400" : "bg-emerald-400")}
                  style={{ width: `${Math.min(budgetPct, 100)}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                ${formatBudgetK(p.budgetRemaining)}k remaining
              </p>
            </div>
            <span className={cn("shrink-0 text-[10px] font-bold", overBudget ? "text-rose-500" : "text-muted-foreground")}>
              {budgetPct}%
            </span>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border/40 pt-1">
          <div className="flex items-center -space-x-1.5">
            {p.team.slice(0, 4).map((member: { initials: string; color: string }, index: number) => (
              <span
                key={index}
                className={cn("inline-flex size-6 items-center justify-center rounded-full border-2 border-card text-[9px] font-bold text-white", member.color)}
                title={member.initials}
              >
                {member.initials}
              </span>
            ))}
          </div>

          <div className="text-end">
            <p className="text-[10px] font-semibold text-foreground">{formatPmShortName(p.primaryPm?.displayName)}</p>
            <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
              <Calendar className="size-3" />
              {formatProjectTimeline(p.startDate, p.endDate)}
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 pb-4">
        <button
          type="button"
          onClick={() => router.push(`/dashboard/projects/${p.id}`)}
          className="group/btn flex w-full items-center justify-center gap-1.5 rounded-xl border border-border/50 py-2 text-xs font-semibold text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
        >
          Open Project
          <ArrowUpRight className="size-3.5 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
        </button>
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
  onToggleStar,
  onEdit,
  onDelete,
}: {
  projects: ProcessedProject[];
  onToggleStar: (id: string) => void;
  onEdit?: (project: Project) => void;
  onDelete?: (project: ProcessedProject) => void;
}) {
  const router = useRouter();
  return (
    <div className="rounded-2xl border border-border/60 overflow-hidden bg-card">
      
      {/* Table Header */}
      <div className="grid grid-cols-[2fr_1fr_1fr_120px_100px_80px_80px_40px] gap-3 px-5 py-3 border-b border-border/50 bg-muted/30">
        {["Project", "PM", "Priority", "Progress", "Timeline", "Tasks", "Milestones", ""].map((h) => (
          <div key={h} className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {h}
          </div>
        ))}
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/30">
        {projects.map((p) => {
          const s = STATUS_CONFIG[p.status] || STATUS_CONFIG.Draft;
          const priority = PRIORITY_CONFIG[p.priority as PriorityLevel] ?? PRIORITY_CONFIG.Medium;
          return (
            <div
              key={p.id}
              onClick={() => router.push(`/dashboard/projects/${p.id}`)}
              className="grid grid-cols-[2fr_1fr_1fr_120px_100px_80px_80px_40px] gap-3 px-5 py-3.5 items-center hover:bg-muted/20 transition-colors group cursor-pointer"
            >
              {/* Star + Name */}
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleStar(p.id);
                  }}
                  className={cn(
                    "shrink-0",
                    p.starred ? "text-amber-400" : "text-muted-foreground/20 hover:text-amber-400 transition-colors"
                  )}
                >
                  <Star className={cn("size-3.5", p.starred && "fill-amber-400")} />
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold truncate">{p.name}</span>
                    <span className={cn("inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0", s.bg, s.text, s.border)}>
                      <span className={cn("size-1.5 rounded-full", s.dot)} />
                      {s.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">{p.description}</p>
                </div>
              </div>

              {/* PM */}
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn("inline-flex items-center justify-center size-6 rounded-full text-[9px] font-bold text-white shrink-0", p.team[0]?.color || "bg-violet-500")}>
                  {p.team[0]?.initials || "PM"}
                </span>
                <span className="text-xs text-muted-foreground truncate">{p.primaryPm?.displayName || "Unassigned"}</span>
              </div>

              {/* Priority */}
              <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit", priority.bg, priority.text)}>
                {priority.label}
              </span>

              {/* Progress */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      p.progress >= 80 ? "bg-emerald-500" :
                      p.progress >= 50 ? "bg-primary" :
                      p.progress >= 30 ? "bg-amber-400" : "bg-rose-400"
                    )}
                    style={{ width: `${p.progress}%` }}
                  />
                </div>
                <span className="text-[11px] font-bold text-foreground w-8 text-end shrink-0">{p.progress}%</span>
              </div>

              {/* Timeline */}
              <div className="text-[10px] text-muted-foreground">
                <div>{p.startDate ? p.startDate.slice(0, 10) : "—"}</div>
                <div className="text-muted-foreground/60">→ {p.endDate ? p.endDate.slice(0, 10) : "—"}</div>
              </div>

              {/* Tasks */}
              <div className="text-xs font-semibold text-foreground">
                {p.tasksDone}
                <span className="text-muted-foreground font-normal">/{p.tasksTotal}</span>
              </div>

              {/* Milestones */}
              <div className="text-xs font-semibold text-foreground">
                {p.milestonesDone}
                <span className="text-muted-foreground font-normal">/{p.milestonesTotal}</span>
              </div>

              {/* Actions */}
              {(onEdit || onDelete) && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button
                        type="button"
                        className="rounded-lg p-1 text-muted-foreground opacity-0 transition-all hover:bg-muted/65 hover:text-foreground group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      />
                    }
                  >
                    <MoreHorizontal className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    {onEdit && (
                      <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => onEdit(p)}>
                        <Pencil className="size-3.5" />
                        Edit
                      </DropdownMenuItem>
                    )}
                    {onDelete && (
                      <DropdownMenuItem
                        className="cursor-pointer gap-2 text-rose-600 focus:text-rose-600"
                        onClick={() => onDelete(p)}
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


