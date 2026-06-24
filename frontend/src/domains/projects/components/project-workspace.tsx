"use client";

import React, { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  useGetProjectByIdQuery,
  useGetTasksQuery,
  useUpdateTaskMutation,
} from "@/domains/projects";
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
import { AddTaskSheet } from "./add-task-sheet";
import { TaskDetailPanel } from "./task-detail-panel";

type Priority = "high" | "medium" | "low" | "critical";
type Status = "TO DO" | "IN PROGRESS" | "DONE";
type View = "list" | "board" | "calendar" | "gantt" | "table";

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

// ─── INITIAL MOCK TASKS ───────────────────────────────────────────────────────
const INITIAL_TASKS: Task[] = [
  {
    id: "t1",
    name: "Set up project structure",
    assigneeInitials: "AH",
    assigneeColor: "bg-purple-500",
    dueDate: "Nov 3",
    priority: "high",
    status: "TO DO",
    comments: 3,
    hasSubtasks: true,
    done: false,
  },
  {
    id: "t2",
    name: "Define API contracts",
    assigneeInitials: "SP",
    assigneeColor: "bg-sky-500",
    dueDate: "Nov 5",
    priority: "medium",
    status: "TO DO",
    comments: 1,
    done: false,
  },
  {
    id: "t3",
    name: "Build authentication module",
    assigneeInitials: "LC",
    assigneeColor: "bg-emerald-500",
    dueDate: "Nov 8",
    priority: "high",
    status: "IN PROGRESS",
    comments: 5,
    hasSubtasks: true,
    done: false,
  },
  {
    id: "t4",
    name: "Design system setup",
    assigneeInitials: "MO",
    assigneeColor: "bg-amber-500",
    dueDate: "Nov 10",
    priority: "low",
    status: "IN PROGRESS",
    comments: 2,
    done: false,
  },
  {
    id: "t5",
    name: "Project kickoff meeting",
    assigneeInitials: "AH",
    assigneeColor: "bg-purple-500",
    dueDate: "Oct 28",
    priority: "medium",
    status: "DONE",
    comments: 0,
    done: true,
  },
];

const STATUS_GROUPS: Status[] = ["TO DO", "IN PROGRESS", "DONE"];

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
  "TO DO": "border-2 border-slate-400 dark:border-white/30 bg-transparent",
  "IN PROGRESS": "bg-blue-500",
  "DONE": "bg-emerald-500",
};

const GROUP_ACCENT: Record<Status, string> = {
  "TO DO": "text-slate-500 dark:text-white/40",
  "IN PROGRESS": "text-blue-600 dark:text-blue-400",
  "DONE": "text-emerald-600 dark:text-emerald-400",
};

const VIEWS: { id: View; label: string; icon: React.ElementType }[] = [
  { id: "list", label: "Task list", icon: List },
  { id: "board", label: "Kanban board", icon: LayoutGrid },
  { id: "calendar", label: "Calendar", icon: CalendarIcon },
  { id: "gantt", label: "Gantt", icon: ChartGantt },
  { id: "table", label: "Table", icon: Table2 },
];

const MOCK_MILESTONES = [
  { id: "m1", name: "Phase 1 - Discovery", dueDate: "Feb 14", status: "done" },
  { id: "m2", name: "Phase 2 - Design", dueDate: "Mar 21", status: "done" },
  { id: "m3", name: "Phase 3 - Development", dueDate: "May 10", status: "in-progress" },
  { id: "m4", name: "Phase 4 - UAT", dueDate: "Jun 1", status: "upcoming" },
];

export function ProjectWorkspace() {
  const params = useParams();
  const id = params.id as string;

  const { userRole } = useRole();
  const roleLabel = userRole ? userRole.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Guest";

  // Fetch project details
  const { data: project, isLoading: isProjectLoading, isError } = useGetProjectByIdQuery(id);

  // Fetch tasks
  const { data: tasksResponse, isLoading: isTasksLoading, refetch: refetchTasks } =
    useGetTasksQuery({ projectId: id, limit: 50 });
  
  const [updateTask] = useUpdateTaskMutation();

  const tasks = useMemo(() => {
    if (!tasksResponse?.data) return [];
    
    const statusMap: Record<string, Status> = {
      "To_Do": "TO DO",
      "In_Progress": "IN PROGRESS",
      "Done": "DONE",
      "Submitted_for_Review": "TO DO",
      "Approved": "DONE",
      "Rework": "IN PROGRESS",
    };
    
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
        status: statusMap[t.status] || "TO DO",
        comments: t.comments?.length ?? 0,
        hasSubtasks: t.subTasks && t.subTasks.length > 0,
        done: t.status === "Done" || t.status === "Approved",
      };
    });
  }, [tasksResponse]);

  const isLoading = isProjectLoading || isTasksLoading;

  // States
  const [activeView, setActiveView] = useState<View>("list");
  const [openGroups, setOpenGroups] = useState<Set<Status>>(new Set(["TO DO", "IN PROGRESS", "DONE"]));
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");

// Side Sheet states
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [newTaskStatus, setNewTaskStatus] = useState<Status>("TO DO");
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
    const newStatus = target.status === "DONE" ? "To_Do" : "Done";
    try {
      await updateTask({ id: taskId, body: { status: newStatus } }).unwrap();
    } catch (err) {
      console.error("Failed to toggle task:", err);
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch = task.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "ALL" || task.status === statusFilter;
      const matchesPriority = priorityFilter === "ALL" || task.priority === priorityFilter.toLowerCase();
      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [tasks, searchQuery, statusFilter, priorityFilter]);

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
  const completedTasks = tasks.filter((t) => t.status === "DONE").length;
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
            <button className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline">View Roadmap</button>
          </div>
          <div className="flex items-center gap-1">
            {MOCK_MILESTONES.map((m, i) => (
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
                {i < 3 && <ChevronRight className="size-3 text-slate-300 dark:text-white/10 shrink-0" />}
              </React.Fragment>
            ))}
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
              <option value="TO DO">To Do</option>
              <option value="IN PROGRESS">In Progress</option>
              <option value="DONE">Completed</option>
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
            size="sm"
            onClick={() => {
              setParentTaskId(null);
              setNewTaskStatus("TO DO");
              setIsSheetOpen(true);
            }}
            className="rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold h-9 text-xs"
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
            tasks={filteredTasks}
            openGroups={openGroups}
            toggleGroup={toggleGroup}
            toggleTask={toggleTask}
            onTaskClick={setSelectedTaskId}
            onAddTask={(status) => {
              setParentTaskId(null);
              setNewTaskStatus(status);
              setIsSheetOpen(true);
            }}
          />
        )}

        {activeView === "board" && (
          <BoardView
            tasks={filteredTasks}
            toggleTask={toggleTask}
            onTaskClick={setSelectedTaskId}
            onAddTask={(status) => {
              setParentTaskId(null);
              setNewTaskStatus(status);
              setIsSheetOpen(true);
            }}
          />
        )}

        {activeView === "calendar" && <CalendarView tasks={filteredTasks} />}

        {activeView === "gantt" && (
          <GanttView
            tasks={filteredTasks}
            toggleTask={toggleTask}
            ganttZoom={ganttZoom}
            setGanttZoom={setGanttZoom}
          />
        )}

        {activeView === "table" && (
          <TableView
            tasks={filteredTasks}
            toggleTask={toggleTask}
            onTaskClick={setSelectedTaskId}
          />
        )}
      </div>

      {/* Add Task Side Sheet */}
      <AddTaskSheet
        open={isSheetOpen}
        onClose={() => {
          setIsSheetOpen(false);
          setParentTaskId(null);
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
    </div>
  );
}
