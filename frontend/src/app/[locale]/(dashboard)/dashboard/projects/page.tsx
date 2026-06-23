"use client";

import React, { useState, useMemo, useEffect } from "react";
import { 
  useGetProjectsQuery, 
  useGetDepartmentsQuery, 
  useGetCustomersQuery, 
  useGetProjectManagersQuery,
  useCreateProjectMutation 
} from "@/domains/projects";
import { useRole } from "@/shared/providers/role-provider";
import { cn } from "@/shared/utils/cn";
import { useRouter } from "@/i18n/routing";
import {
  Search, Plus, LayoutGrid, List, FolderKanban,
  CheckSquare, AlertTriangle, TrendingUp, MoreHorizontal,
  ChevronDown, X, Star, ArrowUpRight, Calendar, Milestone, Loader2,
  Briefcase, DollarSign, Users2, ShieldAlert
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

const CREATE_PROJECT_ROLES = ["super_admin", "pmo_lead", "project_manager"];

export default function ProjectsPage() {
  const { userRole } = useRole();
  const canCreate = CREATE_PROJECT_ROLES.includes(userRole);
  
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [starredIds, setStarredIds] = useState<string[]>([]);
  const [showNew, setShowNew] = useState(false);

  const { data, isLoading, isError } = useGetProjectsQuery({ page: 1, limit: 100 });

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
    return data.data.map((project) => {
      const numId = project.id.split("-").reduce((acc, char) => acc + char.charCodeAt(0), 0);
      
      let progress = 40;
      if (project.status === "Closed") progress = 100;
      else if (project.status === "Draft") progress = 0;
      else if (project.status === "OnHold") progress = 35;
      else {
        progress = 30 + (numId % 56);
      }

      const tasksTotal = 15 + (numId % 45);
      const tasksDone = Math.floor(tasksTotal * (progress / 100));
      const milestonesTotal = 3 + (numId % 5);
      const milestonesDone = Math.floor(milestonesTotal * (progress / 100));
      const budget = project.value || 120;
      const budgetUsed = Math.floor(budget * (progress / 100) * 0.95);
      const risks = (numId % 4) + (project.priority === "Critical" ? 3 : project.priority === "High" ? 1 : 0);

      const team = [
        { initials: project.primaryPm?.displayName ? project.primaryPm.displayName.split(" ").map(n => n[0]).join("").toUpperCase() : "PM", color: "bg-violet-500" }
      ];
      if (project.secondaryPm?.displayName) {
        team.push({ initials: project.secondaryPm.displayName.split(" ").map(n => n[0]).join("").toUpperCase(), color: "bg-sky-500" });
      }
      if (numId % 2 === 0) team.push({ initials: "LC", color: "bg-emerald-500" });
      if (numId % 3 === 0) team.push({ initials: "MO", color: "bg-amber-500" });

      return {
        ...project,
        description: project.objective || "No objective description provided.",
        statusLabel: project.status,
        starred: starredIds.includes(project.id),
        progress,
        tasksTotal,
        tasksDone,
        milestonesTotal,
        milestonesDone,
        budget,
        budgetUsed,
        risks,
        team
      };
    });
  }, [data, starredIds]);

  const stats = useMemo(() => {
    const list = processedProjects;
    return {
      total: list.length,
      active: list.filter((p) => p.status === "Active").length,
      atRisk: list.filter((p) => p.status === "PendingClosure").length,
      delayed: list.filter((p) => p.status === "OnHold").length,
      completed: list.filter((p) => p.status === "Closed").length,
    };
  }, [processedProjects]);

  const filteredProjects = useMemo(() => {
    return processedProjects.filter((p) => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase()) ||
        (p.primaryPm?.displayName ?? "").toLowerCase().includes(search.toLowerCase());
      
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && p.status === "Active") ||
        (statusFilter === "at-risk" && p.status === "PendingClosure") ||
        (statusFilter === "delayed" && p.status === "OnHold") ||
        (statusFilter === "completed" && p.status === "Closed") ||
        (statusFilter === "on-hold" && p.status === "Draft");

      const matchDept =
        deptFilter === "all" ||
        p.department?.name === deptFilter ||
        p.department?.code === deptFilter;

      return matchSearch && matchStatus && matchDept;
    });
  }, [processedProjects, search, statusFilter, deptFilter]);

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
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity shadow-md shadow-primary/20 shrink-0 cursor-pointer"
          >
            <Plus className="size-4" />
            New Project
          </button>
        )}
      </div>

      {/* ── Summary Strip ── */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total, filterVal: "all", color: "text-foreground", bg: "bg-card border-border/50" },
          { label: "Active", value: stats.active, filterVal: "active", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/10" },
          { label: "At Risk", value: stats.atRisk, filterVal: "at-risk", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/10" },
          { label: "Delayed", value: stats.delayed, filterVal: "delayed", color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-900/10" },
          { label: "Completed", value: stats.completed, filterVal: "completed", color: "text-primary", bg: "bg-primary/10 border-primary/20" },
        ].map((s) => (
          <button
            key={s.label}
            onClick={() => setStatusFilter(s.filterVal)}
            className={cn(
              "flex flex-col items-center justify-center py-3 rounded-xl border transition-all hover:border-primary/40 cursor-pointer shadow-xs",
              s.bg,
              statusFilter === s.filterVal ? "ring-2 ring-primary/40 scale-[1.01]" : ""
            )}
          >
            <span className={cn("text-2xl font-bold", s.color)}>{s.value}</span>
            <span className="text-xs text-muted-foreground mt-0.5">{s.label}</span>
          </button>
        ))}
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

        {/* Status Dropdown */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 pl-3 pr-8 rounded-xl bg-muted/45 border border-border/50 text-sm outline-none focus:ring-1 focus:ring-primary/30 appearance-none cursor-pointer text-foreground font-medium"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="at-risk">At Risk</option>
            <option value="delayed">Delayed</option>
            <option value="completed">Completed</option>
            <option value="on-hold">On Hold</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        </div>

        {/* Dept Dropdown */}
        <div className="relative">
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="h-9 pl-3 pr-8 rounded-xl bg-muted/45 border border-border/50 text-sm outline-none focus:ring-1 focus:ring-primary/30 appearance-none cursor-pointer text-foreground font-medium"
          >
            <option value="all">All Departments</option>
            <option value="SOC">SOC</option>
            <option value="GRC">GRC</option>
            <option value="Cloud">Cloud</option>
            <option value="AppSec">AppSec</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        </div>

        <div className="flex-1" />

        {/* Count */}
        <span className="text-xs text-muted-foreground">
          {filteredProjects.length} of {processedProjects.length}
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

      {!isLoading && !isError && filteredProjects.length === 0 && (
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
              setDeptFilter("all");
            }}
            className="text-xs text-primary hover:underline font-semibold"
          >
            Clear filters
          </button>
        </div>
      )}

      {!isLoading && !isError && filteredProjects.length > 0 && (
        view === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredProjects.map((p) => (
              <ProjectGridCard key={p.id} project={p} onToggleStar={toggleStar} />
            ))}
          </div>
        ) : (
          <ProjectListView projects={filteredProjects} onToggleStar={toggleStar} />
        )
      )}

      {/* ── New Project Side Sheet ── */}
      {showNew && <NewProjectSheet onClose={() => setShowNew(false)} />}
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function ProjectGridCard({ project: p, onToggleStar }: { project: any; onToggleStar: (id: string) => void }) {
  const router = useRouter();
  const s = STATUS_CONFIG[p.status] || STATUS_CONFIG.Draft;
  const budgetPct = Math.round((p.budgetUsed / p.budget) * 100);
  const overBudget = budgetPct > 90;

  return (
    <div className="group flex flex-col bg-card border border-border/60 rounded-2xl hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 overflow-hidden">
      <div className="p-5 flex flex-col gap-4 flex-1">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            
            {/* Badges */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border", s.bg, s.text, s.border)}>
                <span className={cn("size-1.5 rounded-full", s.dot)} />
                {s.label}
              </span>
              <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", DEPT_COLOR[p.department?.name] || DEPT_COLOR.Engineering)}>
                {p.department?.name || "Direct"}
              </span>
              <span className="text-[10px] text-muted-foreground font-medium">
                {METHODOLOGY_EMOJI[p.methodology] || "⚡"} {p.methodology || "Agile"}
              </span>
            </div>

            <h3 className="text-base font-bold text-foreground leading-tight truncate">{p.name}</h3>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{p.description}</p>
          </div>

          {/* Star & Options */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar(p.id);
              }}
              className={cn("p-1 rounded-lg transition-colors", p.starred ? "text-amber-400" : "text-muted-foreground/30 hover:text-amber-400")}
            >
              <Star className={cn("size-4", p.starred && "fill-amber-400")} />
            </button>
            <button className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/65 transition-all">
              <MoreHorizontal className="size-4" />
            </button>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground">Progress</span>
            <span className="text-[11px] font-bold text-foreground">{p.progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                p.progress === 100 ? "bg-emerald-500" :
                p.progress >= 60  ? "bg-primary" :
                p.progress >= 30  ? "bg-amber-400" : "bg-rose-400"
              )}
              style={{ width: `${p.progress}%` }}
            />
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2">
          <StatPill icon={CheckSquare} label="Tasks" value={`${p.tasksDone}/${p.tasksTotal}`} />
          <StatPill icon={Milestone} label="Milestones" value={`${p.milestonesDone}/${p.milestonesTotal}`} />
          <StatPill icon={AlertTriangle} label="Risks" value={String(p.risks)} alert={p.risks >= 3} />
        </div>

        {/* Budget */}
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/40">
          <TrendingUp className={cn("size-3.5 shrink-0", overBudget ? "text-rose-500" : "text-muted-foreground")} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground">Budget</span>
              <span className={cn("text-[10px] font-bold", overBudget ? "text-rose-500" : "text-foreground")}>
                ${p.budgetUsed}k / ${p.budget}k
              </span>
            </div>
            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", overBudget ? "bg-rose-400" : "bg-emerald-400")}
                style={{ width: `${Math.min(budgetPct, 100)}%` }}
              />
            </div>
          </div>
          <span className={cn("text-[10px] font-bold shrink-0", overBudget ? "text-rose-500" : "text-muted-foreground")}>
            {budgetPct}%
          </span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t border-border/40">
          {/* Team Initials */}
          <div className="flex items-center -space-x-1.5">
            {p.team.slice(0, 4).map((m: any, i: number) => (
              <span
                key={i}
                className={cn("inline-flex items-center justify-center size-6 rounded-full text-[9px] font-bold text-white border-2 border-card", m.color)}
                title={m.initials}
              >
                {m.initials}
              </span>
            ))}
            {p.team.length > 4 && (
              <span className="inline-flex items-center justify-center size-6 rounded-full text-[9px] font-bold bg-muted text-muted-foreground border-2 border-card">
                +{p.team.length - 4}
              </span>
            )}
          </div>

          {/* Dates & PM info */}
          <div className="text-end">
            <p className="text-[10px] font-semibold text-foreground">{p.primaryPm?.displayName || "Unassigned"}</p>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground justify-end">
              <Calendar className="size-3" />
              {p.startDate ? p.startDate.slice(0, 10) : "—"} → {p.endDate ? p.endDate.slice(0, 10) : "—"}
            </div>
          </div>
        </div>

      </div>

      {/* View Details Action Button */}
      <div className="px-5 pb-4">
        <button
          onClick={() => router.push(`/dashboard/projects/${p.id}`)}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-border/50 text-xs font-semibold text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all group/btn"
        >
          Open Project
          <ArrowUpRight className="size-3.5 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
}

function StatPill({ icon: Icon, label, value, alert }: { icon: any; label: string; value: string; alert?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5 p-2 rounded-xl bg-muted/40 border border-border/30">
      <Icon className={cn("size-3.5", alert ? "text-rose-500" : "text-muted-foreground")} />
      <span className={cn("text-sm font-bold", alert ? "text-rose-500" : "text-foreground")}>{value}</span>
      <span className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</span>
    </div>
  );
}

function ProjectListView({ projects, onToggleStar }: { projects: any[]; onToggleStar: (id: string) => void }) {
  const router = useRouter();
  return (
    <div className="rounded-2xl border border-border/60 overflow-hidden bg-card">
      
      {/* Table Header */}
      <div className="grid grid-cols-[2fr_1fr_1fr_120px_100px_80px_80px_40px] gap-3 px-5 py-3 border-b border-border/50 bg-muted/30">
        {["Project", "PM", "Department", "Progress", "Timeline", "Tasks", "Risks", ""].map((h) => (
          <div key={h} className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {h}
          </div>
        ))}
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/30">
        {projects.map((p) => {
          const s = STATUS_CONFIG[p.status] || STATUS_CONFIG.Draft;
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

              {/* Dept */}
              <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit", DEPT_COLOR[p.department?.name] || DEPT_COLOR.Engineering)}>
                {p.department?.name || "Direct"}
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

              {/* Risks */}
              <div className={cn("text-xs font-bold", p.risks >= 3 ? "text-rose-500" : p.risks >= 1 ? "text-amber-500" : "text-muted-foreground")}>
                {p.risks > 0 ? `⚠️ ${p.risks}` : "—"}
              </div>

              {/* Action trigger */}
              <button className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/65 transition-all">
                <MoreHorizontal className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Interactive Side Sheet for Project Creation ──────────────────────────────

function NewProjectSheet({ onClose }: { onClose: () => void }) {
  const [createProject, { isLoading: isSubmitting }] = useCreateProjectMutation();

  const { data: departments = [] } = useGetDepartmentsQuery();
  const { data: customers = [] } = useGetCustomersQuery();
  const { data: managers = [] } = useGetProjectManagersQuery();

  const [form, setForm] = useState({
    name: "",
    description: "",
    departmentId: "",
    customerId: "",
    methodology: "Agile",
    primaryPmId: "",
    secondaryPmId: "",
    startDate: "",
    endDate: "",
    budget: "",
    engagementType: "FixedPrice",
    billingModel: "FixedPrice",
  });

  const handleChange = (key: string, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const isFormValid = useMemo(() => {
    return (
      form.name.trim() &&
      form.departmentId &&
      form.customerId &&
      form.primaryPmId &&
      form.startDate &&
      form.endDate &&
      form.budget
    );
  }, [form]);

  const handleSubmit = async () => {
    try {
      await createProject({
        name: form.name,
        objective: form.description,
        departmentId: form.departmentId,
        customerId: form.customerId,
        engagementType: form.engagementType as any,
        billingModel: form.billingModel as any,
        methodology: form.methodology as any,
        priority: "Medium",
        startDate: form.startDate,
        endDate: form.endDate,
        value: Number(form.budget),
        primaryPmId: form.primaryPmId,
        secondaryPmId: form.secondaryPmId || null,
        status: "Draft",
      }).unwrap();
      onClose();
    } catch (err) {
      console.error("Project creation failed:", err);
      alert("Failed to create project. Please verify all inputs.");
    }
  };

  const activeDept = departments.find((d) => d.id === form.departmentId);
  const activeCustomer = customers.find((c) => c.id === form.customerId);
  const activePM = managers.find((m) => m.id === form.primaryPmId);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs transition-opacity duration-300" onClick={onClose} />
      
      {/* Side Sheet Container */}
      <div className="fixed top-0 right-0 bottom-0 z-50 w-[580px] bg-white dark:bg-zinc-950 border-l border-slate-200 dark:border-white/[0.07] shadow-2xl flex flex-col transition-transform duration-300 ease-out">
        
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 dark:border-white/[0.06] shrink-0">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <FolderKanban className="size-5 text-primary" />
              Create Project Engagement
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Configure project specifications inside a unified ledger</p>
          </div>
          <button 
            onClick={onClose} 
            className="size-8 rounded-full border border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-all cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          
          {/* SECTION 1: OVERVIEW */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest border-b border-slate-100 dark:border-white/[0.04] pb-2">
              <Briefcase className="size-4" />
              <span>Project Overview</span>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Project Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="e.g. ERP Migration Phase 3"
                className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Description / Objective</label>
              <textarea
                value={form.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Brief overview of project goals, compliance scoping, and technical deliverables..."
                rows={3}
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
              />
            </div>

            {/* Department & Customer */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Department *</label>
                <div className="relative">
                  <select
                    value={form.departmentId}
                    onChange={(e) => handleChange("departmentId", e.target.value)}
                    className="w-full h-10 px-3 pr-10 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium cursor-pointer appearance-none"
                  >
                    <option value="" className="bg-white dark:bg-slate-900 text-slate-400">Select...</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{d.name} ({d.code})</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Client / Customer *</label>
                <div className="relative">
                  <select
                    value={form.customerId}
                    onChange={(e) => handleChange("customerId", e.target.value)}
                    className="w-full h-10 px-3 pr-10 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium cursor-pointer appearance-none"
                  >
                    <option value="" className="bg-white dark:bg-slate-900 text-slate-400">Select...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{c.displayName}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Methodology */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Methodology *</label>
              <div className="relative">
                <select
                  value={form.methodology}
                  onChange={(e) => handleChange("methodology", e.target.value)}
                  className="w-full h-10 px-3 pr-10 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium cursor-pointer appearance-none"
                >
                  <option value="Agile" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">⚡ Agile</option>
                  <option value="Waterfall" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">🌊 Waterfall</option>
                  <option value="Hybrid" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">🔀 Hybrid</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* SECTION 2: GOVERNANCE & TIMELINE */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest border-b border-slate-100 dark:border-white/[0.04] pb-2">
              <Users2 className="size-4" />
              <span>Governance & Schedule</span>
            </div>

            {/* Project Managers */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Primary PM *</label>
                <div className="relative">
                  <select
                    value={form.primaryPmId}
                    onChange={(e) => handleChange("primaryPmId", e.target.value)}
                    className="w-full h-10 px-3 pr-10 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium cursor-pointer appearance-none"
                  >
                    <option value="" className="bg-white dark:bg-slate-900 text-slate-400">Select...</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{m.displayName}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Secondary PM</label>
                <div className="relative">
                  <select
                    value={form.secondaryPmId}
                    onChange={(e) => handleChange("secondaryPmId", e.target.value)}
                    className="w-full h-10 px-3 pr-10 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium cursor-pointer appearance-none"
                  >
                    <option value="" className="bg-white dark:bg-slate-900 text-slate-400">None</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{m.displayName}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Start Date *</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => handleChange("startDate", e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">End Date *</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => handleChange("endDate", e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium cursor-pointer"
                />
              </div>
            </div>

            {/* Budget */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Budget ($k) *</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <input
                  type="number"
                  value={form.budget}
                  onChange={(e) => handleChange("budget", e.target.value)}
                  placeholder="e.g. 150"
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: DELIVERY SETTINGS */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest border-b border-slate-100 dark:border-white/[0.04] pb-2">
              <DollarSign className="size-4" />
              <span>Engagement & Billing</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Engagement Type *</label>
                <div className="relative">
                  <select
                    value={form.engagementType}
                    onChange={(e) => handleChange("engagementType", e.target.value)}
                    className="w-full h-10 px-3 pr-10 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium cursor-pointer appearance-none"
                  >
                    <option value="ManagedServices" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Managed Services</option>
                    <option value="StaffAugmentation" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Staff Augmentation</option>
                    <option value="FixedPrice" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Fixed Price</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Billing Model *</label>
                <div className="relative">
                  <select
                    value={form.billingModel}
                    onChange={(e) => handleChange("billingModel", e.target.value)}
                    className="w-full h-10 px-3 pr-10 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium cursor-pointer appearance-none"
                  >
                    <option value="FixedPrice" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Fixed Price</option>
                    <option value="TimeAndMaterial" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Time & Material</option>
                    <option value="Retainer" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Retainer</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Preview Panel */}
          {form.name && (
            <div className="p-4 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/10 dark:border-primary/20 space-y-2">
              <p className="text-xs font-bold text-primary uppercase tracking-widest">Configuration Summary</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400">
                <div>Client: <span className="font-semibold text-slate-900 dark:text-white">{activeCustomer?.displayName || "Direct client"}</span></div>
                <div>Dept: <span className="font-semibold text-slate-900 dark:text-white">{activeDept?.name || "Unassigned"}</span></div>
                <div>Methodology: <span className="font-semibold text-slate-900 dark:text-white">{form.methodology}</span></div>
                <div>Governance Lead: <span className="font-semibold text-slate-900 dark:text-white">{activePM?.displayName || "None"}</span></div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-8 py-4 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between shrink-0 bg-slate-50 dark:bg-zinc-950/40">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-all disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          
          <button
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_14px_rgba(139,92,246,0.3)] cursor-pointer"
          >
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Create Project
          </button>
        </div>

      </div>
    </>
  );
}
