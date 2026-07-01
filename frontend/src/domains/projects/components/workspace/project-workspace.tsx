"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useRouter } from "@/i18n/routing";
import {
  useGetProjectByIdQuery,
  useGetTasksQuery,
  useLazyExportTasksQuery,
  useUpdateTaskMutation,
  useGetPhasesQuery,
  useGetMilestonesQuery,
  useDeleteTaskMutation,
  useCreateTaskMutation,
  useGetProjectTaskAssigneesQuery,
  useGetTaskDependenciesQuery,
} from "@/domains/projects";
import type { GetTasksParams, TaskPriority } from "@/domains/projects/types/tasks.types";
import {
  canMoveTaskToStatus,
  formatTaskApiError,
  getTaskStatusMoveDeniedMessage,
} from "@/domains/projects/utils/task-status-permissions";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { toast } from "react-hot-toast";
import { DeleteDialog } from "@/shared/ui/delete-dialog";
import { useAppAbility, useAuth } from "@/domains/auth";
import { cn } from "@/shared/utils/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
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
  Upload,
  Download,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";

// Import child views
import { ListView } from "./workspace-views/list-view";
import { BoardView, type BoardQuickCreatePayload } from "./workspace-views/board-view";
import { CalendarView } from "./workspace-views/calendar-view";
import { GanttView } from "./workspace-views/gantt-view";
import { TableView } from "./workspace-views/table-view";
import { PhaseView, type PhaseViewRef } from "./workspace-views/phase-view";
import { AddTaskSheet } from "../tasks/add-task-sheet";
import { TaskDetailPanel } from "../tasks/task-detail-panel";
import { PhaseMilestonePanel } from "../roadmap/phase-milestone-panel";
import { exportTasksToXLSX } from "../../utils/import-export";
import { mapTasksToGanttRows } from "../../utils/map-task-to-gantt";
import { ImportTasksDialog } from "../tasks/import-tasks-dialog";
import { ProgressReviewInbox } from "../tasks/progress-review-inbox";
import { formatProjectBudget } from "../../utils/format-budget";


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

const STATUS_FILTER_OPTIONS: { value: string; label: string; description: string; dot: string }[] = [
  { value: "ALL", label: "All Statuses", description: "Any status level", dot: "bg-muted-foreground" },
  { value: "To_Do", label: "To Do", description: "Not yet started", dot: "bg-slate-400" },
  { value: "In_Progress", label: "In Progress", description: "Currently working", dot: "bg-blue-500" },
  { value: "Submitted_for_Review", label: "Submitted for Review", description: "Ready for check", dot: "bg-amber-500" },
  { value: "Approved", label: "Approved", description: "Accepted and signed off", dot: "bg-teal-500" },
  { value: "Rework", label: "Rework", description: "Needs revision", dot: "bg-rose-500" },
  { value: "Done", label: "Done", description: "Completed tasks", dot: "bg-emerald-500" },
];

const PRIORITY_FILTER_OPTIONS: { value: string; label: string; description: string; dot: string }[] = [
  { value: "ALL", label: "All Priorities", description: "Any urgency level", dot: "bg-muted-foreground" },
  { value: "CRITICAL", label: "Critical", description: "Highest urgency", dot: "bg-red-500" },
  { value: "HIGH", label: "High", description: "Important priority", dot: "bg-rose-500" },
  { value: "MEDIUM", label: "Medium", description: "Standard priority", dot: "bg-amber-400" },
  { value: "LOW", label: "Low", description: "Lower urgency", dot: "bg-slate-400" },
];

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
              "h-9 gap-2 rounded-xl border-border/60 bg-muted/45 px-3 font-normal shadow-none text-xs select-none hover:bg-muted/50 cursor-pointer transition-colors",
              value !== "ALL" && "border-primary/40 bg-primary/5",
            )}
          />
        }
      >
        <span className="text-muted-foreground">{label}:</span>
        <span className="inline-flex items-center gap-1.5 font-medium">
          {active && active.value !== "ALL" && (
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

export function ProjectWorkspace() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params.id as string;

  const { user } = useAuth();
  const ability = useAppAbility();
  /** PM / PMO / team lead / super admin — engineers only have task edit (status/progress), not create. */
  const canManageTasks = ability?.can("create", "Task") ?? false;
  const canCreateTask = canManageTasks;
  const canAssignTask = canManageTasks;
  const canReviewProgress = ability?.can("approve", "Task") ?? false;
  const phaseViewRef = useRef<PhaseViewRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error("Failed to enter fullscreen mode:", err);
      });
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

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
  const [triggerExportTasks, { isFetching: isExportingTasks }] = useLazyExportTasksQuery();

  const [deleteTaskConfirm, setDeleteTaskConfirm] = useState<{
    isOpen: boolean;
    taskId: string | null;
  }>({ isOpen: false, taskId: null });

  const [isPhasePanelOpen, setIsPhasePanelOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const [selectedPhaseIdForNewTask, setSelectedPhaseIdForNewTask] = useState<string | null>(null);

  // Fetch phases
  const { data: phases = [], isLoading: isPhasesLoading } = useGetPhasesQuery(id);

  // Fetch milestones
  const { data: milestones = [], isLoading: isMilestonesLoading } = useGetMilestonesQuery(id);

  const { data: taskDependencies = [] } = useGetTaskDependenciesQuery(
    { projectId: id },
    { skip: !id },
  );

  const { data: assignees = [] } = useGetProjectTaskAssigneesQuery(id);

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

  const handleExport = async () => {
    const exportToast = toast.loading("Preparing tasks export...");
    try {
      const exportParams: GetTasksParams = {
        projectId: id,
        topLevelOnly: false,
      };
      const trimmedSearch = debouncedSearch.trim();
      if (trimmedSearch) {
        exportParams.search = trimmedSearch;
      }
      if (statusFilter !== "ALL") {
        exportParams.status = statusFilter;
      }
      const priority = PRIORITY_FILTER_TO_API[priorityFilter];
      if (priority) {
        exportParams.priority = priority;
      }

      const tasksToExport = await triggerExportTasks(exportParams).unwrap();
      if (!tasksToExport || tasksToExport.length === 0) {
        toast.dismiss(exportToast);
        toast.error("No tasks to export.");
        return;
      }

      const xlsxBuffer = exportTasksToXLSX(tasksToExport, phases, assignees);
      const blob = new Blob([xlsxBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `${project?.name || "project"}_tasks.xlsx`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.dismiss(exportToast);
      toast.success("Tasks exported to Excel successfully.");
    } catch (err) {
      console.error(err);
      toast.dismiss(exportToast);
      toast.error("Failed to export tasks to Excel.");
    }
  };

  const tasks = useMemo(
    () => mapTasksToGanttRows(tasksResponse?.data ?? []),
    [tasksResponse?.data],
  );

  const overallProgressPercent = useMemo(() => {
    const rows = tasksResponse?.data ?? [];
    if (rows.length === 0) return 0;
    const sum = rows.reduce((acc, task) => acc + (task.progressApproved ?? 0), 0);
    return Math.round(sum / rows.length);
  }, [tasksResponse]);

  const isLoading = isProjectLoading || isTasksLoading || isPhasesLoading || isMilestonesLoading;

  // States
  const [activeView, setActiveView] = useState<View>("list");
  const [openGroups, setOpenGroups] = useState<Set<Status>>(new Set(["To_Do", "In_Progress", "Submitted_for_Review", "Approved", "Rework", "Done"]));

// Side Sheet states
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [newTaskStatus, setNewTaskStatus] = useState<Status>("To_Do");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskDetailDefaultTab, setTaskDetailDefaultTab] = useState<"comments" | "subtasks" | undefined>(undefined);
  const [focusProgressReview, setFocusProgressReview] = useState(false);
  const [parentTaskId, setParentTaskId] = useState<string | null>(null);
  const [newTaskStartDate, setNewTaskStartDate] = useState<string | null>(null);
  const [newTaskEndDate, setNewTaskEndDate] = useState<string | null>(null);

  const openTaskDetail = (
    taskId: string,
    optionsOrTab?:
      | { focusProgressReview?: boolean; initialTab?: "comments" | "subtasks" }
      | "comments"
      | "subtasks",
  ) => {
    if (typeof optionsOrTab === "string") {
      setTaskDetailDefaultTab(optionsOrTab);
      setFocusProgressReview(false);
    } else {
      setTaskDetailDefaultTab(optionsOrTab?.initialTab);
      setFocusProgressReview(optionsOrTab?.focusProgressReview ?? false);
    }
    setSelectedTaskId(taskId);
  };

  useEffect(() => {
    const taskIdParam = searchParams.get("taskId");
    if (!taskIdParam) return;

    const shouldFocusReview = searchParams.get("reviewProgress") === "1";
    const shouldFocusProgress = searchParams.get("progress") === "1";
    setTaskDetailDefaultTab(undefined);
    setFocusProgressReview(shouldFocusReview || shouldFocusProgress);
    setSelectedTaskId(taskIdParam);
    router.replace(`/dashboard/projects/${id}`);
  }, [searchParams, id, router]);

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
    const isOwner = user?.id === target.assigneeId;
    if (
      !canMoveTaskToStatus(target.status, newStatus, isOwner, canReviewProgress)
    ) {
      toast.error(
        getTaskStatusMoveDeniedMessage(target.status, newStatus, isOwner, canReviewProgress),
      );
      return;
    }
    try {
      await updateTask({ id: taskId, body: { status: newStatus } }).unwrap();
    } catch (err) {
      console.error("Failed to toggle task:", err);
      toast.error(formatTaskApiError(err, "Failed to update task status"));
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
    const target = tasks.find((t) => t.id === taskId);
    if (target && target.status !== toStatus) {
      const isOwner = user?.id === target.assigneeId;
      if (!canMoveTaskToStatus(target.status, toStatus, isOwner, canReviewProgress)) {
        toast.error(
          getTaskStatusMoveDeniedMessage(target.status, toStatus, isOwner, canReviewProgress),
        );
        return;
      }
    }

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
      toast.error(formatTaskApiError(err, "Failed to move task"));
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

  const handleBoardQuickCreateTask = async (status: Status, payload: BoardQuickCreatePayload) => {
    const phaseId = selectedPhaseIdForNewTask ?? phases[0]?.id;
    if (!phaseId) {
      toast.error("Add a project phase before creating tasks");
      throw new Error("No phase available");
    }

    try {
      await createTask({
        projectId: id,
        phaseId,
        title: payload.title,
        status,
        priority: payload.priority,
        ownerId: payload.ownerId ?? null,
        startDate: payload.startDate,
        endDate: payload.endDate,
      }).unwrap();
      toast.success("Task created");
    } catch (err) {
      console.error("Failed to create task:", err);
      toast.error("Failed to create task");
      throw err;
    }
  };

  const handleRenameTask = async (taskId: string, title: string) => {
    try {
      await updateTask({ id: taskId, body: { title } }).unwrap();
      toast.success("Task renamed");
    } catch (err) {
      console.error("Failed to rename task:", err);
      toast.error("Failed to rename task");
      throw err;
    }
  };

  const handleAssignTask = async (taskId: string, ownerId: string | null) => {
    try {
      await updateTask({ id: taskId, body: { ownerId } }).unwrap();
      toast.success(ownerId ? "Assignee updated" : "Task unassigned");
    } catch (err) {
      console.error("Failed to assign task:", err);
      toast.error("Failed to update assignee");
      throw err;
    }
  };

  const handleUpdateTaskDates = async (
    taskId: string,
    dates: { startDate: string; endDate: string },
  ) => {
    try {
      await updateTask({ id: taskId, body: dates }).unwrap();
      toast.success("Dates updated");
    } catch (err) {
      console.error("Failed to update task dates:", err);
      toast.error("Failed to update dates");
      throw err;
    }
  };

  const handleAddTaskOnDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const localDateStr = `${y}-${m}-${d}`;
    setNewTaskStartDate(localDateStr);
    setNewTaskEndDate(localDateStr);
    setParentTaskId(null);
    setNewTaskStatus("To_Do");
    setIsSheetOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 size-6 animate-spin text-primary" />
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
  const progressPercent = overallProgressPercent;

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col overflow-hidden text-foreground transition-colors duration-300",
        isFullscreen
          ? "h-screen w-screen p-6 bg-background"
          : "h-[calc(100vh-6rem)] -m-6 bg-transparent"
      )}
    >
      {/* ─── BREADCRUMB / TITLE BAR ────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-200/60 dark:border-white/[0.08] shrink-0 bg-transparent transition-colors">
        <span className="text-xs text-slate-400 dark:text-white/40">Team Space</span>
        <span className="text-xs text-slate-400 dark:text-white/20">/</span>
        <span className="text-sm font-semibold text-slate-950 dark:text-white">{project.name}</span>
      </div>

    {canReviewProgress && (
        <ProgressReviewInbox
          projectId={id}
          onOpenTask={(taskId, options) => openTaskDetail(taskId, options)}
          onReviewed={() => refetchTasks()}
        />
      )}

      {/* ─── PROJECT OVERVIEW HEADER PANEL ───────────────────────────────────── */}
      <div className="px-5 py-4 bg-slate-500/5 dark:bg-white/[0.02] border-b border-slate-200/60 dark:border-white/[0.08] grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0 bg-transparent">
        {/* Progress Tracker */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground">Project Health</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
              on track
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>Overall Progress</span>
              <span className="text-primary">{progressPercent}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-200/80 dark:bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-1000 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Average approved progress across tasks
            </p>
          </div>
        </div>

        {/* Commercial/Financial Info */}
        <div className="grid grid-cols-2 gap-3 border-x border-slate-200/60 dark:border-white/[0.08] px-4 bg-transparent">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground">Tasks</p>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-foreground">{completedTasks}</span>
              <span className="text-[10px] text-muted-foreground">/ {totalTasks}</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground">Budget</p>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-foreground">
                {formatProjectBudget(project.value, project.currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Key Milestones */}
        <div className="md:col-span-2 space-y-2 bg-transparent">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground">Recent Milestones</span>
            <button onClick={() => setIsPhasePanelOpen(true)} className="text-[10px] font-bold text-primary hover:underline">Manage Roadmap</button>
          </div>
          <div className="flex items-center gap-1">
            {recentMilestones.length === 0 ? (
              <span className="text-[10px] text-muted-foreground/70 italic px-1">No milestones defined.</span>
            ) : (
              recentMilestones.map((m, i) => (
                <React.Fragment key={m.id}>
                  <div className={`flex-1 p-2 rounded-lg border transition-all cursor-default relative overflow-hidden group ${
                    m.status === 'done'        ? "bg-emerald-50/50 border-emerald-200/50 dark:bg-emerald-950/10 dark:border-emerald-800/30" :
                    m.status === 'in-progress' ? "bg-primary/5 border-primary/20 ring-1 ring-primary/20 shadow-sm" :
                    "bg-slate-100/50 dark:bg-white/5 border-slate-200 dark:border-white/5"
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[8px] font-bold uppercase tracking-tighter ${
                        m.status === 'done'        ? "text-emerald-600" :
                        m.status === 'in-progress' ? "text-primary" :
                        "text-muted-foreground/70"
                      }`}>
                        {m.dueDate}
                      </span>
                      {m.status === 'done' && <CheckCircle2 className="size-2 text-emerald-500" />}
                      {m.status === 'in-progress' && <Clock className="size-2 text-primary animate-pulse" />}
                    </div>
                    <p className="text-[10px] font-bold truncate leading-tight">{m.name}</p>
                  </div>
                  {i < recentMilestones.length - 1 && <ChevronRight className="size-3 text-muted-foreground/30 shrink-0" />}
                </React.Fragment>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ─── TABS NAV ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 border-b border-slate-200/60 dark:border-white/[0.08] shrink-0 bg-transparent transition-colors">
        <div className="flex items-center">
          {VIEWS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px ${
                activeView === id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={toggleFullscreen}
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Mode"}
        >
          {isFullscreen ? (
            <Minimize2 className="size-4" />
          ) : (
            <Maximize2 className="size-4" />
          )}
        </button>
      </div>

      {/* ─── TOOLBAR & SEARCH / FILTERS ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-3 border-b border-slate-200/60 dark:border-white/[0.08] shrink-0 bg-transparent">
        {/* Left Side: Search & Filters */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
          {/* Search */}
          <div className="relative w-full max-w-xs shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl"
            />
          </div>

          {/* Status Filter */}
          <FilterCardDropdown
            label="Status"
            value={statusFilter}
            options={STATUS_FILTER_OPTIONS}
            onChange={setStatusFilter}
          />

          {/* Priority Filter */}
          <FilterCardDropdown
            label="Priority"
            value={priorityFilter}
            options={PRIORITY_FILTER_OPTIONS}
            onChange={setPriorityFilter}
          />
        </div>

        {/* Right Side: Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {activeView !== "phases" && (
            <>
              {canCreateTask && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsImportOpen(true)}
                  className="gap-1.5 font-semibold text-xs h-9 rounded-xl border-slate-200/60 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  <Upload className="size-4" />
                  Import Tasks
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={isExportingTasks}
                className="gap-1.5 font-semibold text-xs h-9 rounded-xl border-slate-200/60 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5"
              >
                {isExportingTasks ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                Export Tasks
              </Button>
            </>
          )}

          {activeView === "phases" ? (
            <Button
              onClick={() => {
                phaseViewRef.current?.openAddPhase();
              }}
              className="h-9 text-xs rounded-xl"
            >
              <Plus className="mr-1.5 size-4" />
              Add Phase
            </Button>
          ) : canCreateTask ? (
            <Button
              onClick={() => {
                setParentTaskId(null);
                setNewTaskStatus("To_Do");
                setIsSheetOpen(true);
              }}
              className="h-9 text-xs rounded-xl"
            >
              <Plus className="mr-1.5 size-4" />
              Add Task
            </Button>
          ) : null}
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
            onTaskClick={openTaskDetail}
            onAddTask={
              canCreateTask
                ? (status) => {
                    setParentTaskId(null);
                    setNewTaskStatus(status);
                    setIsSheetOpen(true);
                  }
                : undefined
            }
            onDeleteTask={handleDeleteTask}
            onDuplicateTask={canCreateTask ? handleDuplicateTask : undefined}
            onMoveTask={handleMoveTask}
            phases={phases}
            assignees={assignees}
          />
        )}

        {activeView === "board" && (
          <BoardView
            tasks={tasks}
            toggleTask={toggleTask}
            onTaskClick={openTaskDetail}
            canApproveTask={canReviewProgress}
            onCreateTask={canCreateTask ? handleBoardQuickCreateTask : undefined}
            onRenameTask={canManageTasks ? handleRenameTask : undefined}
            onAssignTask={canAssignTask ? handleAssignTask : undefined}
            onUpdateTaskDates={canManageTasks ? handleUpdateTaskDates : undefined}
            canAssignTask={canAssignTask}
            canEditDates={canManageTasks}
            currentUserId={user?.id}
            assignees={assignees}
            onDeleteTask={handleDeleteTask}
            onDuplicateTask={canCreateTask ? handleDuplicateTask : undefined}
            onMoveTask={handleMoveTask}
            onSetDueDate={handleSetDueDate}
          />
        )}

        {activeView === "calendar" && (
          <CalendarView
            tasks={tasks}
            onTaskClick={openTaskDetail}
            onAddTask={canCreateTask ? handleAddTaskOnDate : undefined}
            onDeleteTask={handleDeleteTask}
            onDuplicateTask={canCreateTask ? handleDuplicateTask : undefined}
            onMoveTask={handleMoveTask}
            onSetDueDate={handleSetDueDate}
            toggleTask={toggleTask}
          />
        )}

        {activeView === "gantt" && (
          <GanttView
            tasks={tasks}
            dependencies={taskDependencies}
            toggleTask={toggleTask}
            ganttZoom={ganttZoom}
            setGanttZoom={setGanttZoom}
            phases={phases}
            milestones={milestones}
            onTaskClick={openTaskDetail}
          />
        )}

        {activeView === "table" && (
          <TableView
            tasks={tasks}
            toggleTask={toggleTask}
            onTaskClick={openTaskDetail}
            onAddTask={
              canCreateTask
                ? (status) => {
                    setParentTaskId(null);
                    setNewTaskStatus(status);
                    setIsSheetOpen(true);
                  }
                : undefined
            }
            onDeleteTask={handleDeleteTask}
            onDuplicateTask={canCreateTask ? handleDuplicateTask : undefined}
            onMoveTask={handleMoveTask}
            onSetDueDate={handleSetDueDate}
          />
        )}

        {activeView === "phases" && (
          <PhaseView
            ref={phaseViewRef}
            projectId={id}
            taskQueryParams={{ ...taskQueryParams, limit: 100 }}
            onTaskClick={openTaskDetail}
            onAddTask={
              canCreateTask
                ? (phaseId) => {
                    setSelectedPhaseIdForNewTask(phaseId);
                    setNewTaskStatus("To_Do");
                    setIsSheetOpen(true);
                  }
                : undefined
            }
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
          setNewTaskStartDate(null);
          setNewTaskEndDate(null);
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
        defaultStartDate={newTaskStartDate}
        defaultEndDate={newTaskEndDate}
      />

      <TaskDetailPanel
        taskId={selectedTaskId}
        projectId={id}
        open={!!selectedTaskId}
        onClose={() => {
          setSelectedTaskId(null);
          setTaskDetailDefaultTab(undefined);
          setFocusProgressReview(false);
        }}
        onOpenSubTask={(subId) => setSelectedTaskId(subId)}
        onUpdated={() => refetchTasks()}
        initialTab={taskDetailDefaultTab}
        focusProgressReview={focusProgressReview}
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

      <ImportTasksDialog
        open={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        refetch={refetchTasks}
        projectId={id}
      />
    </div>
  );
}

