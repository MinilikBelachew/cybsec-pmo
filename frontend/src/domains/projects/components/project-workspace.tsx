"use client";

import React, { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  useGetProjectByIdQuery,
  useGetTasksQuery,
  useUpdateTaskMutation,
  useGetPhasesQuery,
  useGetMilestonesQuery,
  useDeleteTaskMutation,
  useCreateTaskMutation,
} from "@/domains/projects";
import type { GetTasksParams, TaskPriority } from "@/domains/projects/types/tasks.types";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { toast } from "react-hot-toast";
import { DeleteDialog } from "@/shared/ui/delete-dialog";
import { useRole } from "@/shared/providers/role-provider";
import {
  ChevronDown,
  Plus,
  Star,
  List,
  LayoutGrid,
  Calendar as CalendarIcon,
  ChartGantt,
  Table2,
  Search,
  Loader2,
  ArrowLeft,
  Flag,
  ChevronRight,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";

// Import child views
import { ListView } from "./workspace-views/list-view";
import { BoardView } from "./workspace-views/board-view";
import { CalendarView } from "./workspace-views/calendar-view";
import { GanttView } from "./workspace-views/gantt-view";
import { TableView } from "./workspace-views/table-view";
import { PhaseView } from "./workspace-views/phase-view";
import { AddTaskSheet } from "./add-task-sheet";
import { TaskDetailPanel } from "./task-detail-panel";
import { PhaseMilestonePanel } from "./phase-milestone-panel";

type Priority = "high" | "medium" | "low" | "critical";
type Status = "To_Do" | "In_Progress" | "Submitted_for_Review" | "Approved" | "Rework" | "Done";
type View = "list" | "board" | "calendar" | "gantt" | "table" | "phases";

interface Task {
  id: string;
  name: string;
  assigneeInitials: string;
  assigneeColor: string;
  dueDate: string;
  priority: Priority;
  status: Status;
  comments: number;
  hasSubtasks?: boolean;
  done: boolean;
}

const PRIORITY_STYLES: Record<Priority, string> = {
  critical: "text-red-600 dark:text-red-400 font-bold",
  high: "text-rose-500",
  medium: "text-amber-500",
  low: "text-slate-400 dark:text-white/30",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const STATUS_DOT: Record<Status, string> = {
  "To_Do": "border-2 border-slate-400 dark:border-white/30 bg-transparent",
  "In_Progress": "bg-blue-500",
  "Submitted_for_Review": "bg-amber-500",
  "Approved": "bg-teal-500",
  "Rework": "bg-rose-500",
  "Done": "bg-emerald-500",
};

const GROUP_ACCENT: Record<Status, string> = {
  "To_Do": "text-slate-500 dark:text-white/40",
  "In_Progress": "text-blue-600 dark:text-blue-400",
  "Submitted_for_Review": "text-amber-600 dark:text-amber-400",
  "Approved": "text-teal-605 dark:text-teal-400",
  "Rework": "text-rose-600 dark:text-rose-400",
  "Done": "text-emerald-600 dark:text-emerald-400",
};

const VIEWS: { id: View; label: string; icon: React.ElementType }[] = [
  { id: "list", label: "Task list", icon: List },
  { id: "board", label: "Kanban board", icon: LayoutGrid },
  { id: "calendar", label: "Calendar", icon: CalendarIcon },
  { id: "gantt", label: "Gantt", icon: ChartGantt },
  { id: "table", label: "Table", icon: Table2 },
  { id: "phases", label: "Phases", icon: Flag },
];

const PRIORITY_FILTER_TO_API: Record<string, TaskPriority | undefined> = {
  ALL: undefined,
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export function ProjectWorkspace() {
  const params = useParams();
  const id = params.id as string;

  const { userRole } = useRole();
  const roleLabel = userRole ? userRole.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Guest";

  // Fetch project details
  const { data: project, isLoading: isProjectLoading, isError } = useGetProjectByIdQuery(id);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const debouncedSearch = useDebounce(searchQuery, 300);

  const taskQueryParams = useMemo((): GetTasksParams => {
    const params: GetTasksParams = {
      projectId: id,
      limit: 50,
    };
    const trimmedSearch = debouncedSearch.trim();
    if (trimmedSearch) {
      params.search = trimmedSearch;
    }
    if (statusFilter !== "ALL") {
      params.status = statusFilter;
    }
    const priority = PRIORITY_FILTER_TO_API[priorityFilter];
    if (priority) {
      params.priority = priority;
    }
    return params;
  }, [id, debouncedSearch, statusFilter, priorityFilter]);

  const { data: tasksResponse, isLoading: isTasksLoading, refetch: refetchTasks } =
    useGetTasksQuery(taskQueryParams);
  
  const [updateTask] = useUpdateTaskMutation();
  const [deleteTask, { isLoading: isDeletingTask }] = useDeleteTaskMutation();
  const [createTask] = useCreateTaskMutation();

  const [deleteTaskConfirm, setDeleteTaskConfirm] = useState<{
    isOpen: boolean;
    taskId: string | null;
  }>({ isOpen: false, taskId: null });

  const [isPhasePanelOpen, setIsPhasePanelOpen] = useState(false);
  const [selectedPhaseIdForNewTask, setSelectedPhaseIdForNewTask] = useState<string | null>(null);

  // Fetch phases
  const { data: phases = [], isLoading: isPhasesLoading } = useGetPhasesQuery(id);

  // Fetch milestones
  const { data: milestones = [], isLoading: isMilestonesLoading } = useGetMilestonesQuery(id);

  const recentMilestones = useMemo(() => {
    return [...milestones]
      .sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime())
      .slice(0, 4)
      .map(m => {
        let status: 'done' | 'in-progress' | 'upcoming' = 'upcoming';
        if (m.status === 'Done') status = 'done';
        else if (m.status === 'In Progress') status = 'in-progress';
        
        return {
          id: m.id,
          name: m.title,
          dueDate: new Date(m.targetDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          status
        };
      });
  }, [milestones]);

  const tasks = useMemo(() => {
    if (!tasksResponse?.data) return [];
    
    const priorityMap: Record<string, Priority> = {
      "Low": "low",
      "Medium": "medium",
      "High": "high",
      "Critical": "critical",
    };

    const colors = [
      "bg-purple-500", "bg-sky-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500"
    ];

    return tasksResponse.data.map((t: any) => {
      const initials = t.owner?.displayName
        ? t.owner.displayName.split(" ").map((w: string) => w[0]).join("").toUpperCase()
        : "UA";
      const colorIndex = t.owner?.id ? t.owner.id.charCodeAt(0) % colors.length : 0;
      
      return {
        id: t.id,
        name: t.title,
        assigneeInitials: initials,
        assigneeColor: colors[colorIndex],
        dueDate: t.endDate
          ? new Date(t.endDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })
          : "No due date",
        priority: priorityMap[t.priority] || "medium",
        status: t.status || "To_Do",
        comments: t.comments?.length ?? 0,
        hasSubtasks: t.subTasks && t.subTasks.length > 0,
        done: t.status === "Done" || t.status === "Approved",
        phaseId: t.phaseId,
        phaseName: t.phase?.name || "Unassigned",
        phaseColor: t.phase?.color || "#64748b",
        rawStartDate: t.startDate,
        rawEndDate: t.endDate,
      };
    });
  }, [tasksResponse]);

  const isLoading = isProjectLoading || isTasksLoading || isPhasesLoading || isMilestonesLoading;

  // States
  const [activeView, setActiveView] = useState<View>("list");
  const [openGroups, setOpenGroups] = useState<Set<Status>>(new Set(["To_Do", "In_Progress", "Submitted_for_Review", "Approved", "Rework", "Done"]));

// Side Sheet states
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [newTaskStatus, setNewTaskStatus] = useState<Status>("To_Do");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [parentTaskId, setParentTaskId] = useState<string | null>(null);

  // Gantt Zoom state
  const [ganttZoom, setGanttZoom] = useState(1);

  const toggleGroup = (status: Status) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(status) ? next.delete(status) : next.add(status);
      return next;
    });
  };

  const toggleTask = async (taskId: string) => {
    const target = tasks.find((t) => t.id === taskId);
    if (!target) return;
    const newStatus = target.status === "Done" || target.status === "Approved" ? "To_Do" : "Done";
    try {
      await updateTask({ id: taskId, body: { status: newStatus } }).unwrap();
    } catch (err) {
      console.error("Failed to toggle task:", err);
    }
  };

  const handleDeleteTask = (taskId: string) => {
    setDeleteTaskConfirm({ isOpen: true, taskId });
  };

  const confirmDeleteTask = async () => {
    if (!deleteTaskConfirm.taskId) return;
    try {
      await deleteTask(deleteTaskConfirm.taskId).unwrap();
      toast.success("Task deleted successfully");
    } catch (err) {
      console.error("Failed to delete task:", err);
      toast.error("Failed to delete task");
    } finally {
      setDeleteTaskConfirm({ isOpen: false, taskId: null });
    }
  };

  const handleDuplicateTask = async (taskId: string) => {
    const original = tasksResponse?.data?.find((t) => t.id === taskId);
    if (!original) {
      toast.error("Task not found");
      return;
    }
    try {
      await createTask({
        projectId: original.projectId,
        parentTaskId: original.parentTaskId,
        phaseId: original.phaseId,
        title: `${original.title} (Copy)`,
        description: original.description || undefined,
        priority: original.priority,
        ownerId: original.ownerId || undefined,
        startDate: original.startDate,
        endDate: original.endDate,
        effortHours: original.effortHours || undefined,
        status: original.status,
      }).unwrap();
      toast.success("Task duplicated successfully");
    } catch (err) {
      console.error("Failed to duplicate task:", err);
      toast.error("Failed to duplicate task");
    }
  };

  const handleMoveTask = async (taskId: string, toStatus: Status) => {
    try {
      await updateTask({ id: taskId, body: { status: toStatus } }).unwrap();
      const friendlyName = toStatus === "To_Do"
        ? "To Do"
        : toStatus === "In_Progress"
        ? "In Progress"
        : toStatus === "Submitted_for_Review"
        ? "Submitted for Review"
        : toStatus;
      toast.success(`Task moved to ${friendlyName}`);
    } catch (err) {
      console.error("Failed to move task:", err);
      toast.error("Failed to move task");
    }
  };

  const handleSetDueDate = async (taskId: string, date: string | null) => {
    try {
      await updateTask({ id: taskId, body: { endDate: date } }).unwrap();
      toast.success(date ? "Due date updated successfully" : "Due date cleared");
    } catch (err) {
      console.error("Failed to update due date:", err);
      toast.error("Failed to update due date");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center text-slate-500 dark:text-white/40">
        <Loader2 className="mr-2 size-6 animate-spin text-purple-600" />
        Loading workspace details...
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <Card className="border-red-500/20 bg-red-50/50 dark:bg-red-950/10">
          <CardHeader>
            <CardTitle className="text-red-600 dark:text-red-400">Failed to load Project</CardTitle>
            <CardDescription>
              We couldn't retrieve the workspace details. It might have been deleted or you don't have access.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center gap-3">
            <Link href="/dashboard/projects">
              <Button variant="outline">Back to Projects</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "Done" || t.status === "Approved").length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] -m-6 overflow-hidden bg-transparent text-slate-900 dark:text-white transition-colors duration-300">
      {/* ─── BREADCRUMB / TITLE BAR ────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-200/60 dark:border-white/[0.08] shrink-0 bg-transparent transition-colors">
        <span className="text-xs text-slate-400 dark:text-white/40">Team Space</span>
        <span className="text-xs text-slate-400 dark:text-white/20">/</span>
        <span className="text-sm font-semibold text-slate-950 dark:text-white">{project.name}</span>
        <button className="ml-1 text-slate-400 dark:text-white/30 hover:text-amber-400 transition-colors">
          <Star className="size-3.5 fill-current text-amber-500 animate-none" />
        </button>
        <button className="text-slate-400 dark:text-white/30 hover:text-slate-950 dark:hover:text-white transition-colors">
          <List className="size-3.5" />
        </button>

        <div className="ml-auto flex items-center gap-2">
          <div className="text-[10px] text-slate-400 dark:text-white/40 font-medium px-2 py-0.5 rounded-md border border-slate-200 dark:border-white/5 bg-slate-100/50 dark:bg-white/5">
            {roleLabel}
          </div>
        </div>
      </div>

      {/* ─── PROJECT OVERVIEW HEADER PANEL ───────────────────────────────────── */}
      <div className="px-5 py-4 bg-slate-500/5 dark:bg-white/[0.02] border-b border-slate-200/60 dark:border-white/[0.08] grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0 bg-transparent">
        {/* Progress Tracker */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 dark:text-white/40">Project Health</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
              on track
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>Overall Progress</span>
              <span className="text-purple-600 dark:text-purple-400">{progressPercent}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-200/80 dark:bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-600 dark:bg-purple-400 transition-all duration-1000 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Commercial/Financial Info */}
        <div className="grid grid-cols-2 gap-3 border-x border-slate-200/60 dark:border-white/[0.08] px-4 bg-transparent">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 dark:text-white/40">Tasks</p>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-slate-900 dark:text-white">{completedTasks}</span>
              <span className="text-[10px] text-slate-400 dark:text-white/40">/ {totalTasks}</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 dark:text-white/40">Budget</p>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-slate-900 dark:text-white">
                {project.currency === "USD" ? "$" : project.currency}
                {Math.round((project.value ?? 0) / 1000)}k
              </span>
              <span className="text-[10px] text-slate-400 dark:text-white/40">/ {project.currency === "USD" ? "$" : project.currency}280k</span>
            </div>
          </div>
        </div>

        {/* Key Milestones */}
        <div className="md:col-span-2 space-y-2 bg-transparent">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 dark:text-white/40">Recent Milestones</span>
            <button onClick={() => setIsPhasePanelOpen(true)} className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline">Manage Roadmap</button>
          </div>
          <div className="flex items-center gap-1">
            {recentMilestones.length === 0 ? (
              <span className="text-[10px] text-slate-400 dark:text-white/30 italic px-1">No milestones defined.</span>
            ) : (
              recentMilestones.map((m, i) => (
                <React.Fragment key={m.id}>
                  <div className={`flex-1 p-2 rounded-lg border transition-all cursor-default relative overflow-hidden group ${
                    m.status === 'done'        ? "bg-emerald-50/50 border-emerald-200/50 dark:bg-emerald-950/10 dark:border-emerald-800/30" :
                    m.status === 'in-progress' ? "bg-purple-600/5 border-purple-500/20 ring-1 ring-purple-500/20 shadow-sm" :
                    "bg-slate-100/50 dark:bg-white/5 border-slate-200 dark:border-white/5"
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[8px] font-bold uppercase tracking-tighter ${
                        m.status === 'done'        ? "text-emerald-600" :
                        m.status === 'in-progress' ? "text-purple-600 dark:text-purple-400" :
                        "text-slate-400 dark:text-white/30"
                      }`}>
                        {m.dueDate}
                      </span>
                      {m.status === 'done' && <CheckCircle2 className="size-2 text-emerald-500" />}
                      {m.status === 'in-progress' && <Clock className="size-2 text-purple-600 dark:text-purple-400 animate-pulse" />}
                    </div>
                    <p className="text-[10px] font-bold truncate leading-tight">{m.name}</p>
                  </div>
                  {i < recentMilestones.length - 1 && <ChevronRight className="size-3 text-slate-300 dark:text-white/10 shrink-0" />}
                </React.Fragment>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ─── TABS NAV ────────────────────────────────────────────────────────── */}
      <div className="flex items-center px-5 border-b border-slate-200/60 dark:border-white/[0.08] shrink-0 bg-transparent transition-colors">
        {VIEWS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveView(id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px ${
              activeView === id
                ? "border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400"
                : "border-transparent text-slate-400 hover:text-slate-900 dark:text-white/45 dark:hover:text-white"
            }`}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ─── TOOLBAR & SEARCH / FILTERS ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-3 border-b border-slate-200/60 dark:border-white/[0.08] shrink-0 bg-transparent">
        {/* Search */}
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200/60 dark:border-white/5 bg-slate-50 dark:bg-white/5 px-2.5 py-1 text-xs">
            <span className="text-slate-400 dark:text-white/30">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent font-semibold outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="To_Do">To Do</option>
              <option value="In_Progress">In Progress</option>
              <option value="Submitted_for_Review">Submitted for Review</option>
              <option value="Approved">Approved</option>
              <option value="Rework">Rework</option>
              <option value="Done">Done</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200/60 dark:border-white/5 bg-slate-50 dark:bg-white/5 px-2.5 py-1 text-xs">
            <span className="text-slate-400 dark:text-white/30">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-transparent font-semibold outline-none cursor-pointer"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <div className="flex-1" />

          {/* Action button */}
          <Button
            onClick={() => {
              setParentTaskId(null);
              setNewTaskStatus("To_Do");
              setIsSheetOpen(true);
            }}
          >
            <Plus className="mr-1.5 size-4" />
            Add Task
          </Button>
        </div>
      </div>

      {/* ─── ACTIVE VIEW DISPLAY AREA ────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {activeView === "list" && (
          <ListView
            tasks={tasks}
            openGroups={openGroups}
            toggleGroup={toggleGroup}
            toggleTask={toggleTask}
            onTaskClick={setSelectedTaskId}
            onAddTask={(status) => {
              setParentTaskId(null);
              setNewTaskStatus(status);
              setIsSheetOpen(true);
            }}
            phases={phases}
          />
        )}

        {activeView === "board" && (
          <BoardView
            tasks={tasks}
            toggleTask={toggleTask}
            onTaskClick={setSelectedTaskId}
            onAddTask={(status) => {
              setParentTaskId(null);
              setNewTaskStatus(status);
              setIsSheetOpen(true);
            }}
            onDeleteTask={handleDeleteTask}
            onDuplicateTask={handleDuplicateTask}
            onMoveTask={handleMoveTask}
            onSetDueDate={handleSetDueDate}
          />
        )}

        {activeView === "calendar" && <CalendarView tasks={tasks} />}

        {activeView === "gantt" && (
          <GanttView
            tasks={tasks}
            toggleTask={toggleTask}
            ganttZoom={ganttZoom}
            setGanttZoom={setGanttZoom}
            phases={phases}
            milestones={milestones}
          />
        )}

        {activeView === "table" && (
          <TableView
            tasks={tasks}
            toggleTask={toggleTask}
            onTaskClick={setSelectedTaskId}
          />
        )}

        {activeView === "phases" && (
          <PhaseView
            projectId={id}
            taskQueryParams={{ ...taskQueryParams, limit: 100 }}
            onTaskClick={setSelectedTaskId}
            onAddTask={(phaseId) => {
              setSelectedPhaseIdForNewTask(phaseId);
              setNewTaskStatus("To_Do");
              setIsSheetOpen(true);
            }}
          />
        )}
      </div>

      {/* Add Task Side Sheet */}
      <AddTaskSheet
        open={isSheetOpen}
        onClose={() => {
          setIsSheetOpen(false);
          setParentTaskId(null);
          setSelectedPhaseIdForNewTask(null);
        }}
        onCreated={() => {
          refetchTasks();
          setSearchQuery("");
          setStatusFilter("ALL");
          setPriorityFilter("ALL");
        }}
        projectId={id}
        parentTaskId={parentTaskId}
        defaultStatus={newTaskStatus}
        defaultPhaseId={selectedPhaseIdForNewTask}
        projectName={project.name}
      />

      <TaskDetailPanel
        taskId={selectedTaskId}
        projectId={id}
        open={!!selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onOpenSubTask={(subId) => setSelectedTaskId(subId)}
        onUpdated={() => refetchTasks()}
      />

      <PhaseMilestonePanel
        projectId={id}
        isOpen={isPhasePanelOpen}
        onClose={() => setIsPhasePanelOpen(false)}
      />

      <DeleteDialog
        isOpen={deleteTaskConfirm.isOpen}
        onClose={() => setDeleteTaskConfirm({ isOpen: false, taskId: null })}
        onConfirm={confirmDeleteTask}
        title="Delete Task"
        description="Are you sure you want to delete this task? This action cannot be undone."
        isDeleting={isDeletingTask}
      />
    </div>
  );
}
