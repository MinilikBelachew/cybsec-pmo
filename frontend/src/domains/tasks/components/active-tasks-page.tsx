"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  ChevronDown,
  X,
  Circle,
  CircleCheck,
  Calendar,
  MessageSquare,
  ChevronRight,
  MoreHorizontal,
  AlertCircle,
  Clock,
  CheckSquare,
  ArrowUpRight,
  Loader2,
  ListTodo,
  Activity,
  AlertTriangle,
  CheckCircle2,
  FolderKanban,
} from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/domains/auth";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";
import {
  TaskDetailPanel,
  useGetActiveTaskStatsQuery,
  useGetProjectsQuery,
  useGetTasksQuery,
} from "@/domains/projects";
import { TASKS_POLLING_INTERVAL_MS } from "@/domains/projects/constants/tasks-polling";
import type { Task, TaskPriority, TaskStatus } from "@/domains/projects";

// ─── Status & priority maps ───────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<
  TaskPriority,
  { label: string; text: string; bg: string; border: string }
> = {
  Critical: {
    label: "Critical",
    text: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-900/20",
    border: "border-rose-200 dark:border-rose-800",
  },
  High: {
    label: "High",
    text: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-900/20",
    border: "border-rose-200 dark:border-rose-800",
  },
  Medium: {
    label: "Medium",
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    border: "border-amber-200 dark:border-amber-800",
  },
  Low: {
    label: "Low",
    text: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/30",
  },
};

type TaskGroupKey = "in_progress" | "blocked" | "todo" | "done";

const GROUP_ORDER: TaskGroupKey[] = ["in_progress", "blocked", "todo", "done"];

const GROUP_CONFIG: Record<
  TaskGroupKey,
  { label: string; dot: string; text: string; bg: string; border: string }
> = {
  in_progress: {
    label: "In Progress",
    dot: "bg-primary",
    text: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/30",
  },
  blocked: {
    label: "Rework",
    dot: "bg-rose-500",
    text: "text-rose-700 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-900/20",
    border: "border-rose-200 dark:border-rose-800",
  },
  todo: {
    label: "To Do",
    dot: "bg-muted-foreground/50",
    text: "text-muted-foreground",
    bg: "bg-muted",
    border: "border-border/60",
  },
  done: {
    label: "Done",
    dot: "bg-primary",
    text: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/30",
  },
};

const TASK_CARD_THEMES = {
  total: {
    border: "border-slate-200 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700",
    gradient: "from-slate-500/[0.05] via-transparent to-transparent",
    iconColor: "text-slate-500 dark:text-slate-400",
    chartColor: "text-slate-500/40 dark:text-slate-400/30",
  },
  todo: {
    border: "border-border/60 hover:border-border",
    gradient: "from-muted/30 via-transparent to-transparent",
    iconColor: "text-muted-foreground",
    chartColor: "text-muted-foreground/40",
  },
  inProgress: {
    border: "border-primary/20 dark:border-primary/10 hover:border-primary/35 dark:hover:border-primary/25",
    gradient: "from-primary/[0.06] via-transparent to-transparent",
    iconColor: "text-primary",
    chartColor: "text-primary/40",
  },
  rework: {
    border: "border-rose-500/20 dark:border-rose-500/10 hover:border-rose-500/35 dark:hover:border-rose-500/25",
    gradient: "from-rose-500/[0.05] via-transparent to-transparent",
    iconColor: "text-rose-500 dark:text-rose-400",
    chartColor: "text-rose-500/40 dark:text-rose-400/30",
  },
  done: {
    border: "border-primary/20 dark:border-primary/10 hover:border-primary/35 dark:hover:border-primary/25",
    gradient: "from-primary/[0.06] via-transparent to-transparent",
    iconColor: "text-primary",
    chartColor: "text-primary/40",
  },
};

const STATUS_FILTER_OPTIONS: { value: TaskStatus | "all"; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "To_Do", label: "To Do" },
  { value: "In_Progress", label: "In Progress" },
  { value: "Submitted_for_Review", label: "Submitted for Review" },
  { value: "Approved", label: "Approved" },
  { value: "Rework", label: "Rework" },
  { value: "Done", label: "Done" },
];

const PRIORITY_FILTER_OPTIONS: { value: TaskPriority | "all"; label: string }[] = [
  { value: "all", label: "All Priority" },
  { value: "Critical", label: "Critical" },
  { value: "High", label: "High" },
  { value: "Medium", label: "Medium" },
  { value: "Low", label: "Low" },
];

const AVATAR_COLORS = [
  "bg-primary",
  "bg-primary/80",
  "bg-primary/70",
  "bg-primary/60",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function taskGroupKey(status: TaskStatus): TaskGroupKey {
  if (status === "In_Progress" || status === "Submitted_for_Review") return "in_progress";
  if (status === "Rework") return "blocked";
  if (status === "Done" || status === "Approved") return "done";
  return "todo";
}

function isTaskDone(status: TaskStatus) {
  return status === "Done" || status === "Approved";
}

function isOverdue(endDate: string | null, status: TaskStatus) {
  if (!endDate || isTaskDone(status)) return false;
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  return end.getTime() < Date.now();
}

function isDueSoon(endDate: string | null, status: TaskStatus) {
  if (!endDate || isTaskDone(status) || isOverdue(endDate, status)) return false;
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  const diff = (end.getTime() - Date.now()) / 86400000;
  return diff >= 0 && diff < 3;
}

function formatDueDate(endDate: string | null) {
  if (!endDate) return "—";
  return new Date(endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getInitials(name?: string) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function avatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function subtaskProgress(task: Task) {
  const subs = task.subTasks ?? [];
  const done = subs.filter((s) => s.status === "Done" || s.status === "Approved").length;
  return { done, total: subs.length };
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
  const baseHeights = [0.2, 0.55, 0.35, 0.8, 0.65];
  const points = baseHeights.map((h, i) => {
    const x = i * 10;
    const y = 14 - (h * ratio * 10 + 1);
    return { x, y };
  });
  const linePath = `M ${points.map((p) => `${p.x} ${p.y}`).join(" L ")}`;
  const areaPath = `${linePath} L 40 14 L 0 14 Z`;

  return (
    <svg
      viewBox="0 0 40 14"
      className={cn("h-3.5 w-9 shrink-0", colorClass || "text-muted-foreground/40")}
      aria-hidden
    >
      <path d={areaPath} fill="currentColor" className="opacity-15" />
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

function TaskStatCard({
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
  theme: (typeof TASK_CARD_THEMES)[keyof typeof TASK_CARD_THEMES];
}) {
  return (
    <div
      className={cn(
        "relative flex min-h-[82px] flex-col rounded-xl border bg-card p-3 px-3.5 text-left bg-gradient-to-l",
        theme.border,
        theme.gradient,
      )}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span className="truncate text-[11px] font-medium text-muted-foreground/90">{title}</span>
        <Icon className={cn("size-3.5 shrink-0", theme.iconColor)} />
      </div>
      <span className="mt-0.5 text-xl font-bold tracking-tight text-foreground">{value}</span>
      <div className="mt-auto flex w-full items-end justify-between gap-2 pt-1">
        <span className="truncate text-[10px] text-muted-foreground/75">{subtitle}</span>
        <MiniTrendChart value={numericValue} max={chartMax} colorClass={theme.chartColor} />
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ActiveTasksPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [accumulatedTasks, setAccumulatedTasks] = useState<Task[]>([]);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 350);

  const filterParams = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
      priority: priorityFilter !== "all" ? priorityFilter : undefined,
      projectId: projectFilter !== "all" ? projectFilter : undefined,
      ownerId: mineOnly && user?.id ? user.id : undefined,
      topLevelOnly: true as const,
    }),
    [debouncedSearch, statusFilter, priorityFilter, projectFilter, mineOnly, user?.id],
  );

  const queryParams = useMemo(
    () => ({
      ...filterParams,
      page,
      limit: 50,
    }),
    [filterParams, page],
  );

  const { data, isLoading, isFetching, isError, refetch } = useGetTasksQuery(queryParams, {
    pollingInterval: TASKS_POLLING_INTERVAL_MS,
  });
  const { data: taskStats } = useGetActiveTaskStatsQuery();
  const { data: projectsPage } = useGetProjectsQuery({ page: 1, limit: 100 });

  const projects = projectsPage?.data ?? [];
  const hasNextPage = data?.hasNextPage ?? false;
  const filteredTotal = data?.meta?.total ?? 0;

  const stats = taskStats ?? {
    total: 0,
    todo: 0,
    inProgress: 0,
    rework: 0,
    done: 0,
    overdue: 0,
  };

  useEffect(() => {
    setPage(1);
    setAccumulatedTasks([]);
  }, [debouncedSearch, statusFilter, priorityFilter, projectFilter, mineOnly]);

  useEffect(() => {
    if (!data?.data) return;
    if (page === 1) {
      setAccumulatedTasks(data.data);
    } else {
      setAccumulatedTasks((prev) => {
        const ids = new Set(prev.map((t) => t.id));
        const next = data.data.filter((t) => !ids.has(t.id));
        return [...prev, ...next];
      });
    }
  }, [data, page]);

  const tasks = accumulatedTasks;

  const grouped = useMemo(() => {
    const groups: Record<TaskGroupKey, Task[]> = {
      in_progress: [],
      blocked: [],
      todo: [],
      done: [],
    };
    tasks.forEach((task) => groups[taskGroupKey(task.status)].push(task));
    return groups;
  }, [tasks]);

  const activeFilterCount = [
    statusFilter !== "all",
    priorityFilter !== "all",
    projectFilter !== "all",
    mineOnly,
    debouncedSearch,
  ].filter(Boolean).length;

  const chartMax = Math.max(stats.total, 1);

  const handleOpenTask = useCallback((task: Task) => {
    setSelectedProjectId(task.projectId);
    setSelectedTaskId(task.id);
  }, []);

  const handleOpenProject = useCallback(
    (projectId: string) => {
      router.push(`/dashboard/projects/${projectId}`);
    },
    [router],
  );

  const clearFilters = () => {
    setStatusFilter("all");
    setPriorityFilter("all");
    setProjectFilter("all");
    setMineOnly(false);
    setSearch("");
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Project Execution
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Active Tasks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats.inProgress} in progress
            {stats.rework > 0 && (
              <>
                {" · "}
                <span className="font-semibold text-rose-500">{stats.rework} rework</span>
              </>
            )}
            {stats.overdue > 0 && (
              <>
                {" · "}
                <span className="font-semibold text-amber-500">{stats.overdue} overdue</span>
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/dashboard/projects")}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" />
          Add Task
        </button>
      </div>

      {/* Stat strip — projects page style */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <TaskStatCard
          title="Total"
          subtitle="All accessible"
          value={stats.total}
          numericValue={stats.total}
          chartMax={chartMax}
          icon={CheckSquare}
          theme={TASK_CARD_THEMES.total}
        />
        <TaskStatCard
          title="To Do"
          subtitle="Not started"
          value={stats.todo}
          numericValue={stats.todo}
          chartMax={chartMax}
          icon={ListTodo}
          theme={TASK_CARD_THEMES.todo}
        />
        <TaskStatCard
          title="In Progress"
          subtitle="Active work"
          value={stats.inProgress}
          numericValue={stats.inProgress}
          chartMax={chartMax}
          icon={Activity}
          theme={TASK_CARD_THEMES.inProgress}
        />
        <TaskStatCard
          title="Rework"
          subtitle="Needs attention"
          value={stats.rework}
          numericValue={stats.rework}
          chartMax={chartMax}
          icon={AlertTriangle}
          theme={TASK_CARD_THEMES.rework}
        />
        <TaskStatCard
          title="Done"
          subtitle="Completed"
          value={stats.done}
          numericValue={stats.done}
          chartMax={chartMax}
          icon={CheckCircle2}
          theme={TASK_CARD_THEMES.done}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="pointer-events-none absolute inset-s-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search tasks, projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-xl border border-border/50 bg-muted/50 ps-9 pe-3 text-sm outline-none transition-all focus:ring-1 focus:ring-primary/30"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute inset-e-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <FilterSelect
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as TaskStatus | "all")}
          options={STATUS_FILTER_OPTIONS.map((o) => [o.value, o.label])}
        />
        <FilterSelect
          value={priorityFilter}
          onChange={(v) => setPriorityFilter(v as TaskPriority | "all")}
          options={PRIORITY_FILTER_OPTIONS.map((o) => [o.value, o.label])}
        />
        <FilterSelect
          value={projectFilter}
          onChange={setProjectFilter}
          options={[
            ["all", "All Projects"],
            ...projects.map((p) => [p.id, p.name] as [string, string]),
          ]}
        />

        <Button
          type="button"
          variant={mineOnly ? "default" : "outline"}
          size="sm"
          className="h-9 rounded-xl"
          onClick={() => setMineOnly((v) => !v)}
        >
          {mineOnly ? "My tasks" : "All assignees"}
        </Button>

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <X className="size-3" />
            Clear {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
          </button>
        )}

        <span className="ms-auto text-xs text-muted-foreground">
          {isFetching && !isLoading ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" />
              Updating…
            </span>
          ) : (
            <>
              {filteredTotal} task{filteredTotal === 1 ? "" : "s"}
              {activeFilterCount > 0 ? " matching filters" : ""}
            </>
          )}
        </span>
      </div>

      {/* Task groups */}
      {isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-8 text-center text-sm text-destructive">
          Failed to load tasks.{" "}
          <button type="button" className="underline" onClick={() => void refetch()}>
            Try again
          </button>
        </div>
      ) : isLoading && tasks.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading tasks…
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-border/50 bg-card px-4 py-16 text-center text-sm text-muted-foreground">
          {activeFilterCount > 0
            ? "No tasks match your filters."
            : "No tasks yet. Create tasks inside a project workspace."}
        </div>
      ) : (
        <div className="space-y-6">
          {GROUP_ORDER.map((groupKey) => {
            const group = grouped[groupKey];
            if (group.length === 0) return null;
            const g = GROUP_CONFIG[groupKey];
            return (
              <div key={groupKey}>
                <div className="mb-3 flex items-center gap-2.5">
                  <span className={cn("size-2.5 shrink-0 rounded-full", g.dot)} />
                  <span className="text-sm font-bold text-foreground">{g.label}</span>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                      g.bg,
                      g.text,
                      g.border,
                    )}
                  >
                    {group.length}
                  </span>
                  <div className="h-px flex-1 bg-border/40" />
                </div>

                <div className="space-y-1.5">
                  {group.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      expanded={expandedTaskId === task.id}
                      onToggleExpand={() =>
                        setExpandedTaskId(expandedTaskId === task.id ? null : task.id)
                      }
                      onOpenTask={() => handleOpenTask(task)}
                      onOpenProject={() => handleOpenProject(task.projectId)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasNextPage && !isLoading && (
        <div className="flex justify-center pt-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={isFetching}
            onClick={() => setPage((p) => p + 1)}
          >
            {isFetching ? (
              <>
                <Loader2 className="me-2 size-4 animate-spin" />
                Loading…
              </>
            ) : (
              "Load more tasks"
            )}
          </Button>
        </div>
      )}

      {selectedTaskId && selectedProjectId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          projectId={selectedProjectId}
          open={!!selectedTaskId}
          onClose={() => {
            setSelectedTaskId(null);
            setSelectedProjectId(null);
          }}
          onUpdated={() => {
            void refetch();
          }}
          onOpenSubTask={setSelectedTaskId}
        />
      )}
    </div>
  );
}

// ─── Task row (PBO layout) ────────────────────────────────────────────────────

function TaskRow({
  task,
  expanded,
  onToggleExpand,
  onOpenTask,
  onOpenProject,
}: {
  task: Task;
  expanded: boolean;
  onToggleExpand: () => void;
  onOpenTask: () => void;
  onOpenProject: () => void;
}) {
  const done = isTaskDone(task.status);
  const overdue = isOverdue(task.endDate, task.status);
  const dueSoon = isDueSoon(task.endDate, task.status);
  const priority = PRIORITY_CONFIG[task.priority];
  const { done: subsDone, total: subsTotal } = subtaskProgress(task);
  const hasSubs = subsTotal > 0;
  const commentCount = task.comments?.length ?? 0;
  const ownerId = task.owner?.id ?? task.ownerId ?? task.id;
  const ownerName = task.owner?.displayName;

  const tags = [
    task.phase?.name,
    task.isOnCriticalPath ? "Critical path" : null,
  ].filter(Boolean) as string[];

  return (
    <div
      className={cn(
        "group rounded-xl border transition-all duration-150",
        expanded
          ? "border-primary/30 bg-primary/[0.02]"
          : "border-border/50 bg-card hover:border-primary/20 hover:bg-muted/20",
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onToggleExpand}
          className="shrink-0 text-muted-foreground/40 transition-colors hover:text-muted-foreground"
        >
          <ChevronRight
            className={cn("size-3.5 transition-transform duration-150", expanded && "rotate-90")}
          />
        </button>

        <button type="button" onClick={onOpenTask} className="shrink-0" aria-label="Open task">
          {done ? (
            <CircleCheck className="size-4.5 text-primary" />
          ) : (
            <Circle className="size-4.5 text-muted-foreground/40 transition-colors hover:text-primary" />
          )}
        </button>

        <button
          type="button"
          onClick={onOpenTask}
          className={cn(
            "min-w-0 flex-1 truncate text-start text-sm font-semibold",
            done && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </button>

        <div className="hidden shrink-0 items-center gap-1 lg:flex">
          {tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary"
            >
              {tag}
            </span>
          ))}
        </div>

        <button
          type="button"
          onClick={onOpenProject}
          className="hidden shrink-0 items-center gap-1.5 xl:flex"
        >
          <span className="size-2 rounded-full bg-primary" />
          <span className="max-w-[120px] truncate text-xs text-muted-foreground">
            {task.project?.name ?? "—"}
          </span>
        </button>

        {hasSubs && (
          <div className="hidden shrink-0 items-center gap-1 text-[10px] text-muted-foreground md:flex">
            <CheckSquare className="size-3" />
            {subsDone}/{subsTotal}
          </div>
        )}

        <div
          className={cn(
            "hidden shrink-0 items-center gap-1 text-[11px] font-medium sm:flex",
            overdue ? "text-rose-500" : dueSoon ? "text-amber-500" : "text-muted-foreground",
          )}
        >
          {overdue ? (
            <AlertCircle className="size-3" />
          ) : dueSoon ? (
            <Clock className="size-3" />
          ) : (
            <Calendar className="size-3" />
          )}
          {formatDueDate(task.endDate)}
        </div>

        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold",
            priority.bg,
            priority.text,
            priority.border,
          )}
        >
          {priority.label}
        </span>

        <span
          className={cn(
            "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white",
            avatarColor(ownerId),
          )}
          title={ownerName}
        >
          {getInitials(ownerName)}
        </span>

        {commentCount > 0 && (
          <div className="flex shrink-0 items-center gap-0.5 text-[10px] text-muted-foreground">
            <MessageSquare className="size-3" />
            {commentCount}
          </div>
        )}

        <button
          type="button"
          onClick={onOpenTask}
          className="rounded-lg p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted/60 hover:text-foreground group-hover:opacity-100"
        >
          <MoreHorizontal className="size-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-border/30 px-12 pb-4">
          {task.description && (
            <p className="pt-3 text-xs leading-relaxed text-muted-foreground">{task.description}</p>
          )}
          {hasSubs && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Subtasks
              </p>
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/60 transition-all"
                    style={{ width: `${(subsDone / subsTotal) * 100}%` }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-foreground">
                  {subsDone}/{subsTotal}
                </span>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onOpenTask}
              className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <ArrowUpRight className="size-3.5" />
              Open full task
            </button>
            <button
              type="button"
              onClick={onOpenProject}
              className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary hover:underline"
            >
              <FolderKanban className="size-3.5" />
              Open project
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 cursor-pointer appearance-none rounded-xl border border-border/50 bg-muted/50 ps-3 pe-7 text-sm outline-none focus:ring-1 focus:ring-primary/30"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute inset-e-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
