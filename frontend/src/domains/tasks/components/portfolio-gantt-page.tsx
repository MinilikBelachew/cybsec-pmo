"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { cn } from "@/shared/utils/cn";
import {
  GanttView,
  TaskDetailPanel,
  useGetMilestonesQuery,
  useGetPhasesQuery,
  useGetProjectsQuery,
  useGetTaskDependenciesQuery,
  useGetTasksQuery,
  useUpdateTaskMutation,
} from "@/domains/projects";
import type { ProjectPhase, Task } from "@/domains/projects";
import { mapTasksToGanttRows } from "@/domains/projects/utils/map-task-to-gantt";
import { ProjectFilterSelect } from "./project-filter-select";

function minDateString(dates: (string | null | undefined)[]): string {
  const valid = dates.filter(Boolean).map((d) => new Date(d!).getTime());
  if (valid.length === 0) return new Date().toISOString();
  return new Date(Math.min(...valid)).toISOString();
}

function maxDateString(dates: (string | null | undefined)[]): string {
  const valid = dates.filter(Boolean).map((d) => new Date(d!).getTime());
  if (valid.length === 0) return new Date().toISOString();
  return new Date(Math.max(...valid)).toISOString();
}

function buildProjectPhases(tasks: Task[]): ProjectPhase[] {
  const byProject = new Map<string, Task[]>();
  tasks.forEach((task) => {
    const list = byProject.get(task.projectId) ?? [];
    list.push(task);
    byProject.set(task.projectId, list);
  });

  return Array.from(byProject.entries()).map(([projectId, projectTasks], index) => {
    const dates = projectTasks.flatMap((t) => [t.startDate, t.endDate]);
    return {
      id: projectId,
      projectId,
      name: projectTasks[0]?.project?.name ?? "Unknown project",
      orderIndex: index,
      startDate: minDateString(dates),
      endDate: maxDateString(dates),
      status: "Active" as const,
      createdAt: "",
      updatedAt: "",
    };
  });
}

export function PortfolioGanttPage() {
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [ganttZoom, setGanttZoom] = useState(1);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 350);
  const isSingleProject = projectFilter !== "all";

  const taskQueryParams = useMemo(
    () => ({
      page: 1,
      limit: 100,
      search: debouncedSearch || undefined,
      projectId: isSingleProject ? projectFilter : undefined,
      topLevelOnly: false as const,
    }),
    [debouncedSearch, isSingleProject, projectFilter],
  );

  const { data: tasksResponse, isLoading, isFetching, refetch } =
    useGetTasksQuery(taskQueryParams);
  const { data: projectsPage } = useGetProjectsQuery({ page: 1, limit: 100 });
  const { data: phases = [] } = useGetPhasesQuery(projectFilter, {
    skip: !isSingleProject,
  });
  const { data: milestones = [] } = useGetMilestonesQuery(projectFilter, {
    skip: !isSingleProject,
  });
  const { data: taskDependencies = [] } = useGetTaskDependenciesQuery(
    { projectId: projectFilter },
    { skip: !isSingleProject },
  );

  const [updateTask] = useUpdateTaskMutation();

  const projects = projectsPage?.data ?? [];
  const rawTasks = tasksResponse?.data ?? [];
  const filteredTotal = tasksResponse?.meta?.total ?? rawTasks.length;

  const ganttTasks = useMemo(
    () => mapTasksToGanttRows(rawTasks, { groupByProject: !isSingleProject }),
    [rawTasks, isSingleProject],
  );

  const ganttPhases = useMemo(() => {
    if (isSingleProject) return phases;
    return buildProjectPhases(rawTasks);
  }, [isSingleProject, phases, rawTasks]);

  const toggleTask = useCallback(
    async (taskId: string) => {
      const target = ganttTasks.find((t) => t.id === taskId);
      if (!target) return;
      const newStatus =
        target.status === "Done" || target.status === "Approved" ? "To_Do" : "Done";
      try {
        await updateTask({ id: taskId, body: { status: newStatus } }).unwrap();
      } catch (err) {
        console.error("Failed to toggle task:", err);
      }
    },
    [ganttTasks, updateTask],
  );

  const handleTaskClick = useCallback(
    (taskId: string) => {
      const task = rawTasks.find((t) => t.id === taskId);
      if (!task) return;
      setSelectedProjectId(task.projectId);
      setSelectedTaskId(taskId);
    },
    [rawTasks],
  );

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col space-y-4 pb-4">
      {/* Header */}
      <div className="flex shrink-0 items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Project Execution
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Gantt &amp; Dependencies</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filteredTotal} task{filteredTotal === 1 ? "" : "s"}
            {isSingleProject
              ? " · phase view with milestones & dependency links"
              : " · grouped by project (select a project for full schedule)"}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2.5">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="pointer-events-none absolute inset-s-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search tasks..."
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

        <ProjectFilterSelect
          value={projectFilter}
          onValueChange={setProjectFilter}
          projects={projects}
        />

        {isFetching && !isLoading && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Updating…
          </span>
        )}
      </div>

      {/* Gantt chart — same component as project workspace */}
      <div
        className={cn(
          "min-h-0 flex-1 overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm",
        )}
      >
        {isLoading ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading schedule…
          </div>
        ) : ganttTasks.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
            No tasks with schedule data. Create tasks in a project workspace or adjust filters.
          </div>
        ) : (
          <GanttView
            tasks={ganttTasks}
            dependencies={isSingleProject ? taskDependencies : []}
            toggleTask={toggleTask}
            ganttZoom={ganttZoom}
            setGanttZoom={setGanttZoom}
            phases={ganttPhases}
            milestones={isSingleProject ? milestones : []}
            onTaskClick={handleTaskClick}
          />
        )}
      </div>

      {selectedTaskId && selectedProjectId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          projectId={selectedProjectId}
          open={!!selectedTaskId}
          onClose={() => {
            setSelectedTaskId(null);
            setSelectedProjectId(null);
          }}
          onUpdated={() => void refetch()}
          onOpenSubTask={setSelectedTaskId}
        />
      )}
    </div>
  );
}
