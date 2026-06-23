import React, { useState, useEffect, useRef } from "react";
import {
  X, CheckSquare, FileText, Bell, Layout, BarChart3,
  ChevronDown, User, Calendar, Flag, Tag, Plus,
  Sparkles, AlignLeft, Table2, Columns, List,
  Clock, UserCircle, Lock, Mic, Pencil, AlertCircle
} from "lucide-react";
import { useGetProjectManagersQuery } from "@/domains/projects";
import { createTaskSchema } from "../schemas/create-task.schema";

type Priority = "high" | "medium" | "low" | "critical";
type Status = "TO DO" | "IN PROGRESS" | "DONE";
type SheetTab = "task" | "doc" | "reminder" | "whiteboard" | "dashboard";

const TABS: { id: SheetTab; label: string; icon: React.ElementType }[] = [
  { id: "task",       label: "Task",       icon: CheckSquare },
  { id: "doc",        label: "Doc",        icon: FileText    },
  { id: "reminder",   label: "Reminder",   icon: Bell        },
  { id: "whiteboard", label: "Whiteboard", icon: Layout      },
  { id: "dashboard",  label: "Dashboard",  icon: BarChart3   },
];

const PRIORITY_OPTIONS: { id: Priority; label: string; color: string }[] = [
  { id: "critical", label: "Critical", color: "text-red-600 dark:text-red-400" },
  { id: "high",     label: "High",     color: "text-rose-500" },
  { id: "medium",   label: "Medium",   color: "text-amber-500" },
  { id: "low",      label: "Low",      color: "text-slate-400 dark:text-white/30" },
];

const STATUS_OPTIONS: Status[] = ["TO DO", "IN PROGRESS", "DONE"];

const STATUS_STYLE: Record<Status, string> = {
  "TO DO":       "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-white/5 dark:text-white/60 dark:border-white/5",
  "IN PROGRESS": "bg-blue-500/10 text-blue-500 border border-blue-500/20",
  "DONE":        "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
};

const MAP_PRIORITY_FE_TO_API = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
} as const;

const MAP_STATUS_FE_TO_API = {
  "TO DO": "To_Do",
  "IN PROGRESS": "In_Progress",
  "DONE": "Done",
} as const;

interface AddTaskSheetProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  defaultStatus?: Status;
  projectName?: string;
  onCreateTask?: (task: {
    title: string;
    description: string;
    status: "To_Do" | "In_Progress" | "Done";
    priority: "Low" | "Medium" | "High" | "Critical";
    ownerId: string | null;
    startDate: string | null;
    endDate: string | null;
  }) => void;
}

export function AddTaskSheet({
  open,
  onClose,
  projectId,
  defaultStatus = "TO DO",
  projectName = "Workspace",
  onCreateTask,
}: AddTaskSheetProps) {
  const [tab, setTab] = useState<SheetTab>("task");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 z-40 bg-slate-950/20 dark:bg-black/60 backdrop-blur-[2px] transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Sheet panel - slides in from the right */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-50 w-[520px] max-w-full bg-white dark:bg-zinc-950 border-l border-slate-200 dark:border-white/[0.08] shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-200 dark:border-white/[0.05] shrink-0">
          <div className="flex items-center gap-1.5">
            <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-xs font-semibold text-slate-800 dark:text-white transition-colors">
              <div className="size-3.5 rounded bg-purple-600/20 text-purple-600 dark:text-purple-400 text-[8px] font-bold flex items-center justify-center">
                P
              </div>
              {projectName}
              <ChevronDown className="size-3 text-slate-400" />
            </button>
            {tab === "task" && (
              <button className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-600/10 text-purple-600 dark:text-purple-400 text-xs font-semibold hover:bg-purple-600/15 transition-colors">
                <CheckSquare className="size-3" />
                Task
                <ChevronDown className="size-3" />
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="size-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center px-6 border-b border-slate-200 dark:border-white/[0.05] shrink-0 bg-slate-50/50 dark:bg-black/10">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px ${
                tab === id
                  ? "border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400"
                  : "border-transparent text-slate-400 hover:text-slate-950 dark:text-white/40 dark:hover:text-white"
              }`}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Dynamic content tab body */}
        <div className="flex-1 overflow-y-auto">
          {tab === "task" && (
            <TaskTab
              projectId={projectId}
              defaultStatus={defaultStatus}
              onClose={onClose}
              onCreateTask={onCreateTask}
            />
          )}
          {tab === "doc" && <DocTab onClose={onClose} />}
          {tab === "reminder" && <ReminderTab onClose={onClose} />}
          {tab === "whiteboard" && <WhiteboardTab onClose={onClose} />}
          {tab === "dashboard" && <DashboardTab onClose={onClose} />}
        </div>
      </div>
    </>
  );
}

// ─── Task Tab Component ───────────────────────────────────────────────────────
function TaskTab({
  projectId,
  defaultStatus,
  onClose,
  onCreateTask,
}: {
  projectId: string;
  defaultStatus: Status;
  onClose: () => void;
  onCreateTask?: (task: {
    title: string;
    description: string;
    status: "To_Do" | "In_Progress" | "Done";
    priority: "Low" | "Medium" | "High" | "Critical";
    ownerId: string | null;
    startDate: string | null;
    endDate: string | null;
  }) => void;
}) {
  const [taskName, setTaskName] = useState("");
  const [description, setDescription] = useState("");
  const [showDesc, setShowDesc] = useState(false);
  const [status, setStatus] = useState<Status>(defaultStatus);
  const [priority, setPriority] = useState<Priority>("medium");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [ownerId, setOwnerId] = useState<string | null>(null);
  
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [showAssigneeMenu, setShowAssigneeMenu] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Fetch project managers/users list
  const { data: users } = useGetProjectManagersQuery();

  // Force pre-select status update if defaultStatus changes
  useEffect(() => {
    setStatus(defaultStatus);
  }, [defaultStatus]);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  function handleCreate() {
    const rawValues = {
      projectId,
      title: taskName,
      description,
      priority: MAP_PRIORITY_FE_TO_API[priority],
      status: MAP_STATUS_FE_TO_API[status],
      ownerId: ownerId || null,
      startDate: startDate || null,
      endDate: endDate || null,
    };

    // Zod validation check
    const result = createTaskSchema.safeParse(rawValues);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          errors[issue.path[0].toString()] = issue.message;
        }
      });
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    onCreateTask?.({
      title: rawValues.title,
      description: rawValues.description,
      status: rawValues.status as any,
      priority: rawValues.priority,
      ownerId: rawValues.ownerId,
      startDate: rawValues.startDate,
      endDate: rawValues.endDate,
    });
    onClose();
  }

  const selectedUser = users?.find(u => u.id === ownerId);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 text-slate-900 dark:text-white">
      <div className="flex-1 px-6 py-5 space-y-5">
        {/* Name Input */}
        <div>
          <input
            ref={nameInputRef}
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            placeholder="Task Name"
            className="w-full text-xl font-bold bg-transparent border-none outline-none placeholder:text-slate-400/50 dark:placeholder:text-white/20 text-slate-950 dark:text-white"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          {validationErrors.title && (
            <p className="text-xs text-red-500 mt-1">{validationErrors.title}</p>
          )}
        </div>

        {/* Description Block */}
        {showDesc ? (
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add description..."
            rows={3}
            className="w-full text-xs bg-slate-50 dark:bg-white/5 rounded-xl px-3 py-2.5 border border-slate-200 dark:border-white/5 outline-none focus:ring-1 focus:ring-purple-500/30 resize-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:white/20"
          />
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDesc(true)}
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-900 dark:text-white/40 dark:hover:text-white transition-colors"
            >
              <AlignLeft className="size-4" />
              Add description
            </button>
            <button className="flex items-center gap-2 text-xs text-purple-600 hover:text-purple-500 dark:text-purple-400 dark:hover:text-purple-300 font-semibold transition-colors">
              <Sparkles className="size-4" />
              Write with AI
            </button>
          </div>
        )}

        <div className="border-t border-slate-200 dark:border-white/5" />

        {/* Status / Priority / Assignee / Dates Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Select */}
          <div className="relative">
            <button
              onClick={() => {
                setShowStatusMenu(!showStatusMenu);
                setShowPriorityMenu(false);
                setShowAssigneeMenu(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${STATUS_STYLE[status]}`}
            >
              {status}
              <ChevronDown className="size-3" />
            </button>
            {showStatusMenu && (
              <div className="absolute top-full mt-1 left-0 z-20 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-lg p-1 min-w-[140px]">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setStatus(s);
                      setShowStatusMenu(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:bg-slate-100 dark:hover:bg-white/5 ${STATUS_STYLE[s]} mb-0.5 last:mb-0`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Assignee Selection */}
          <div className="relative">
            <button
              onClick={() => {
                setShowAssigneeMenu(!showAssigneeMenu);
                setShowStatusMenu(false);
                setShowPriorityMenu(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-medium text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-white/5"
            >
              <User className="size-3.5" />
              {selectedUser ? selectedUser.displayName : "Assignee"}
              <ChevronDown className="size-3" />
            </button>
            {showAssigneeMenu && (
              <div className="absolute top-full mt-1 left-0 z-20 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-lg p-1 min-w-[200px] max-h-[220px] overflow-y-auto">
                <button
                  onClick={() => {
                    setOwnerId(null);
                    setShowAssigneeMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-100 dark:hover:bg-white/5 text-muted-foreground"
                >
                  Unassigned
                </button>
                {users?.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      setOwnerId(u.id);
                      setShowAssigneeMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-100 dark:hover:bg-white/5 block truncate"
                  >
                    {u.displayName} ({u.email})
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Start Date */}
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-medium text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-white/5 cursor-pointer">
            <Calendar className="size-3.5" />
            {startDate ? `Start: ${startDate}` : "Start Date"}
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="sr-only"
            />
          </label>

          {/* End Date */}
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-medium text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-white/5 cursor-pointer">
            <Calendar className="size-3.5" />
            {endDate ? `Due: ${endDate}` : "Due Date"}
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="sr-only"
            />
          </label>

          {/* Priority dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowPriorityMenu(!showPriorityMenu);
                setShowStatusMenu(false);
                setShowAssigneeMenu(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-medium text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-white/5"
            >
              <Flag className={`size-3.5 ${PRIORITY_OPTIONS.find((p) => p.id === priority)?.color}`} />
              {PRIORITY_OPTIONS.find((p) => p.id === priority)?.label}
              <ChevronDown className="size-3 ml-1" />
            </button>
            {showPriorityMenu && (
              <div className="absolute top-full mt-1 left-0 z-20 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-lg p-1 min-w-[120px]">
                {PRIORITY_OPTIONS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setPriority(p.id);
                      setShowPriorityMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                  >
                    <Flag className={`size-3.5 ${p.color}`} />
                    <span className={p.color}>{p.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tags */}
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-medium text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-white/5">
            <Tag className="size-3.5" />
            Tags
          </button>
        </div>

        {/* Date Validation Error message */}
        {validationErrors.endDate && (
          <div className="flex items-center gap-1.5 text-xs text-red-500 bg-red-500/10 px-3 py-2 rounded-lg">
            <AlertCircle className="size-3.5" />
            {validationErrors.endDate}
          </div>
        )}

        {/* Fields Panel */}
        <div className="space-y-3 pt-2">
          <p className="text-[10px] font-bold text-slate-400 dark:text-white/30 uppercase tracking-widest">Fields</p>
          <button className="flex items-center gap-2 text-xs text-slate-400 dark:text-white/40 hover:text-purple-600 dark:hover:text-purple-400 transition-colors group">
            <div className="size-5 rounded-md border-2 border-dashed border-slate-200 dark:border-white/10 group-hover:border-purple-500/40 flex items-center justify-center transition-colors">
              <Plus className="size-3" />
            </div>
            Create new field
          </button>
        </div>
      </div>

      {/* Footer bar */}
      <div className="px-6 py-4 border-t border-slate-200 dark:border-white/5 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-zinc-950">
        <button className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
          <Pencil className="size-3.5" />
          Templates
        </button>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
            <Mic className="size-4" />
          </button>
          <span className="text-xs text-slate-400 dark:text-white/30">1</span>
          <button
            onClick={handleCreate}
            disabled={!taskName.trim()}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-5 py-2 rounded-xl text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-purple-600/20"
          >
            Create Task
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Doc Tab Component ────────────────────────────────────────────────────────
function DocTab({ onClose }: { onClose: () => void }) {
  const [docName, setDocName] = useState("");

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 text-slate-900 dark:text-white p-6 space-y-6">
      <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-400 dark:bg-white/5 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition self-start">
        <FileText className="size-3.5" />
        My Docs
        <ChevronDown className="size-3" />
      </button>

      <input
        value={docName}
        onChange={(e) => setDocName(e.target.value)}
        placeholder="Name this Doc..."
        className="w-full text-xl font-bold bg-transparent border-none outline-none placeholder:text-slate-400/50 dark:placeholder:text-white/20 text-slate-950 dark:text-white"
      />

      <div className="border-t border-slate-200 dark:border-white/5" />

      <div className="space-y-2">
        <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group text-left">
          <div className="size-8 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-purple-600/10 transition-colors">
            <Pencil className="size-4 text-slate-400 group-hover:text-purple-600 transition-colors" />
          </div>
          <div>
            <p className="text-xs font-semibold">Start writing</p>
            <p className="text-[10px] text-slate-400 dark:text-white/30">Open a blank document</p>
          </div>
        </button>

        <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group text-left">
          <div className="size-8 rounded-lg bg-purple-600/10 flex items-center justify-center shrink-0">
            <Sparkles className="size-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-purple-600 dark:text-purple-400">Write with AI</p>
            <p className="text-[10px] text-slate-400 dark:text-white/30">Generate content from a prompt</p>
          </div>
        </button>
      </div>

      <div className="border-t border-slate-200 dark:border-white/5" />

      <div className="space-y-2">
        <p className="text-[10px] font-bold text-slate-400 dark:text-white/30 uppercase tracking-widest">Add new</p>
        {[
          { icon: Table2,  label: "Table",       sub: "Insert a structured table" },
          { icon: Columns, label: "Column",      sub: "Multi-column layout" },
          { icon: List,    label: "PMO List",    sub: "Linked task list" },
        ].map(({ icon: Icon, label, sub }) => (
          <button key={label} className="flex items-center gap-3 w-full px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group text-left">
            <div className="size-7 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center shrink-0">
              <Icon className="size-3.5 text-slate-400" />
            </div>
            <div>
              <p className="text-xs font-medium">{label}</p>
              <p className="text-[10px] text-slate-400 dark:text-white/30">{sub}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Reminder Tab Component ──────────────────────────────────────────────────
function ReminderTab({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [when, setWhen] = useState<"today" | "tomorrow" | "custom">("today");

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 text-slate-900 dark:text-white p-6 space-y-6">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Reminder name..."
        className="w-full text-lg font-bold bg-transparent border-none outline-none placeholder:text-slate-400/50 dark:placeholder:text-white/20 text-slate-950 dark:text-white"
      />

      <div className="border-t border-slate-200 dark:border-white/5" />

      <div className="space-y-2">
        <p className="text-[10px] font-bold text-slate-400 dark:text-white/30 uppercase tracking-widest">When</p>
        <div className="flex items-center gap-2 flex-wrap">
          {(["today", "tomorrow", "custom"] as const).map((w) => (
            <button
              key={w}
              onClick={() => setWhen(w)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors capitalize ${
                when === w
                  ? "bg-purple-600/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                  : "bg-slate-50 dark:bg-white/5 text-slate-400 border-slate-200 dark:border-white/5 hover:text-slate-950 dark:hover:text-white"
              }`}
            >
              <Calendar className="size-3.5" />
              {w === "today" ? "Today" : w === "tomorrow" ? "Tomorrow" : "Pick date"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-purple-600/10 text-purple-600 dark:text-purple-400 border-purple-500/20">
          <UserCircle className="size-3.5" />
          For me
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-slate-50 dark:bg-white/5 text-slate-400 border-slate-200 dark:border-white/5">
          <Bell className="size-3.5" />
          Notify me
        </button>
      </div>
    </div>
  );
}

// ─── Whiteboard Tab Component ────────────────────────────────────────────────
function WhiteboardTab({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 text-slate-900 dark:text-white p-6 space-y-6">
      <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-400 dark:bg-white/5 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition self-start">
        <Layout className="size-3.5" />
        My Whiteboards
        <ChevronDown className="size-3" />
      </button>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name this Whiteboard..."
        className="w-full text-xl font-bold bg-transparent border-none outline-none placeholder:text-slate-400/50 dark:placeholder:text-white/20 text-slate-950 dark:text-white"
      />

      <div className="border-t border-slate-200 dark:border-white/5" />

      <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] flex flex-col items-center justify-center py-16 gap-3 text-center">
        <div className="size-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center">
          <Layout className="size-6 text-slate-400 dark:text-white/40" />
        </div>
        <p className="text-xs font-semibold">Infinite canvas</p>
        <p className="text-[10px] text-slate-400 dark:text-white/30 max-w-[200px]">
          Sketch, diagram, and brainstorm with your team in real time.
        </p>
      </div>
    </div>
  );
}

// ─── Dashboard Tab Component ─────────────────────────────────────────────────
function DashboardTab({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");

  const WIDGETS = [
    { label: "KPI Cards",        desc: "Track key metrics at a glance" },
    { label: "Project Health",   desc: "Status across all projects" },
    { label: "Burn Rate Chart",  desc: "Budget vs actual spend" },
    { label: "Risk Heatmap",     desc: "Likelihood × impact matrix" },
  ];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 text-slate-900 dark:text-white p-6 space-y-6">
      <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-400 dark:bg-white/5 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition self-start">
        <BarChart3 className="size-3.5" />
        My Dashboards
        <ChevronDown className="size-3" />
      </button>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name this Dashboard..."
        className="w-full text-xl font-bold bg-transparent border-none outline-none placeholder:text-slate-400/50 dark:placeholder:text-white/20 text-slate-950 dark:text-white"
      />

      <div className="border-t border-slate-200 dark:border-white/5" />

      <div className="space-y-2">
        <p className="text-[10px] font-bold text-slate-400 dark:text-white/30 uppercase tracking-widest">Add widgets</p>
        <div className="grid grid-cols-2 gap-2">
          {WIDGETS.map(({ label, desc }) => (
            <button
              key={label}
              className="flex flex-col p-3 rounded-xl border border-slate-200 dark:border-white/5 hover:border-purple-500/30 hover:bg-purple-500/5 transition text-left"
            >
              <span className="text-xs font-semibold leading-tight">{label}</span>
              <span className="text-[9px] text-slate-400 dark:text-white/30 mt-1 leading-tight">{desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
