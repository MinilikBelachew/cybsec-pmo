"use client";

import React, { useState, useMemo } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Checkbox } from "@/shared/ui/checkbox";
import { Button } from "@/shared/ui/button";
import { 
  X, 
  Download, 
  Search, 
  FileSpreadsheet, 
  Loader2,
  ChevronDown
} from "lucide-react";
import { cn } from "@/shared/utils/cn";

export interface ExportProjectsDialogProps {
  open: boolean;
  onClose: () => void;
  onExport: (
    selectedFields: string[],
    format: "xlsx",
    selectedTaskFields?: string[]
  ) => Promise<void>;
  isExporting?: boolean;
}

const PROJECT_FIELDS = [
  { id: "Name", label: "Project Name", desc: "The official name of the project" },
  { id: "Objective", label: "Objective", desc: "Scope, details, and objectives" },
  { id: "Department", label: "Department", desc: "Associated department or team" },
  { id: "Customer", label: "Customer", desc: "The client or account name" },
  { id: "Engagement Type", label: "Engagement Type", desc: "Staff Augmentation, Managed Services, or Fixed Price" },
  { id: "Billing Model", label: "Billing Model", desc: "Billing arrangement (T&M, Retainer, etc.)" },
  { id: "Priority", label: "Priority", desc: "Urgency level (Critical, High, Medium, Low)" },
  { id: "Start Date", label: "Start Date", desc: "The scheduled kickoff date" },
  { id: "End Date", label: "End Date", desc: "The scheduled target delivery date" },
  { id: "Value", label: "Value", desc: "Budget or total commercial value" },
  { id: "Currency", label: "Currency", desc: "Currency code (USD, EUR, SAR, AED)" },
  { id: "Primary PM", label: "Primary PM", desc: "Lead Project Manager assigned" },
  { id: "Secondary PM", label: "Secondary PM", desc: "Secondary/Backup Project Manager" },
  { id: "Status", label: "Status", desc: "Current project delivery status" },
];

const TASK_FIELDS = [
  { id: "Title", label: "Title", desc: "The name/summary of the task" },
  { id: "Description", label: "Description", desc: "Detailed description of requirements" },
  { id: "Priority", label: "Priority", desc: "Urgency (Critical, High, Medium, Low)" },
  { id: "Status", label: "Status", desc: "Current state (To Do, In Progress, Done, etc.)" },
  { id: "Assignee", label: "Assignee", desc: "Team member currently owning the task" },
  { id: "Phase", label: "Phase", desc: "Project phase or roadmap stage" },
  { id: "Start Date", label: "Start Date", desc: "Scheduled start date" },
  { id: "End Date", label: "End Date", desc: "Scheduled due date" },
  { id: "Effort Hours", label: "Effort Hours", desc: "Hours allocated or logged for this task" },
];

export function ExportProjectsDialog({
  open,
  onClose,
  onExport,
  isExporting = false,
}: ExportProjectsDialogProps) {
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [selectedFields, setSelectedFields] = useState<string[]>(
    PROJECT_FIELDS.map((f) => f.id)
  );
  const [selectedTaskFields, setSelectedTaskFields] = useState<string[]>(
    TASK_FIELDS.map((f) => f.id)
  );

  const [activePanel, setActivePanel] = useState<"projects" | "tasks" | null>("projects");
  const isProjectsExpanded = activePanel === "projects";
  const isTasksExpanded = activePanel === "tasks";

  const filteredProjectFields = useMemo(() => {
    const q = projectSearchQuery.toLowerCase().trim();
    if (!q) return PROJECT_FIELDS;
    return PROJECT_FIELDS.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.desc.toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q)
    );
  }, [projectSearchQuery]);

  const filteredTaskFields = useMemo(() => {
    const q = taskSearchQuery.toLowerCase().trim();
    if (!q) return TASK_FIELDS;
    return TASK_FIELDS.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.desc.toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q)
    );
  }, [taskSearchQuery]);

  const handleToggleProjectField = (id: string) => {
    setSelectedFields((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleTaskField = (id: string) => {
    setSelectedTaskFields((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllProjects = () => {
    setSelectedFields(PROJECT_FIELDS.map((f) => f.id));
  };

  const handleSelectNoneProjects = () => {
    setSelectedFields([]);
  };

  const handleSelectAllTasks = () => {
    setSelectedTaskFields(TASK_FIELDS.map((f) => f.id));
  };

  const handleSelectNoneTasks = () => {
    setSelectedTaskFields([]);
  };

  const handleExportClick = async () => {
    if (selectedFields.length === 0) return;
    await onExport(selectedFields, "xlsx", selectedTaskFields);
    onClose();
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-xl rounded-2xl border border-border bg-background shadow-2xl transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:scale-95 data-starting-style:scale-95 overflow-hidden flex flex-col max-h-[90vh] -translate-x-1/2 -translate-y-1/2">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-center text-primary">
                <FileSpreadsheet className="size-4" />
              </div>
              <div>
                <DialogPrimitive.Title className="text-sm font-bold text-foreground">
                  Export Portfolio Data
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-[10px] text-muted-foreground">
                  Select fields to export. Tasks will be exported to separate worksheets.
                </DialogPrimitive.Description>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Project Columns Accordion */}
            <div className="border border-border/60 rounded-xl overflow-hidden bg-muted/5 transition-all">
              <button
                type="button"
                onClick={() => setActivePanel(activePanel === "projects" ? null : "projects")}
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/15 hover:bg-muted/30 transition-all font-bold text-xs text-foreground text-left cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span>Project Columns</span>
                  <span className="text-[10px] font-normal text-muted-foreground">
                    ({selectedFields.length} of {PROJECT_FIELDS.length} selected)
                  </span>
                </div>
                <ChevronDown 
                  className={cn(
                    "size-4 text-muted-foreground transition-transform duration-200", 
                    isProjectsExpanded && "rotate-180"
                  )} 
                />
              </button>
              {isProjectsExpanded && (
                <div className="p-4 border-t border-border/60 space-y-3 bg-background">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    {/* Search Bar */}
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search project fields..."
                        value={projectSearchQuery}
                        onChange={(e) => setProjectSearchQuery(e.target.value)}
                        className="w-full h-8 ps-8 pr-8 rounded-lg bg-muted/40 border border-border/60 text-xs outline-none focus:ring-1 focus:ring-primary/30 focus:bg-muted/60 transition-all text-foreground"
                      />
                      {projectSearchQuery && (
                        <button
                          onClick={() => setProjectSearchQuery("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="size-3" />
                        </button>
                      )}
                    </div>
                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleSelectAllProjects}
                        className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                      >
                        Select All
                      </button>
                      <span className="text-[9px] text-muted-foreground/60">|</span>
                      <button
                        type="button"
                        onClick={handleSelectNoneProjects}
                        className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  {/* Checkbox Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-border/50 rounded-xl p-3 bg-muted/15 max-h-[220px] overflow-y-auto">
                    {filteredProjectFields.length === 0 ? (
                      <p className="col-span-2 text-center text-[10px] text-muted-foreground italic py-6">
                        No fields match your search.
                      </p>
                    ) : (
                      filteredProjectFields.map((f) => {
                        const isChecked = selectedFields.includes(f.id);
                        return (
                          <div
                            key={f.id}
                            role="checkbox"
                            aria-checked={isChecked}
                            tabIndex={0}
                            onClick={() => handleToggleProjectField(f.id)}
                            onKeyDown={(e) => {
                              if (e.key === " " || e.key === "Enter") {
                                e.preventDefault();
                                handleToggleProjectField(f.id);
                              }
                            }}
                            className={cn(
                              "flex items-start gap-2.5 p-2 rounded-lg border border-transparent transition-all hover:bg-muted/50 cursor-pointer select-none focus-visible:outline-none focus-visible:bg-muted/50 focus-visible:ring-1 focus-visible:ring-primary/30",
                              isChecked && "bg-primary/[0.02]"
                            )}
                          >
                            <div className="pointer-events-none mt-0.5">
                              <Checkbox checked={isChecked} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-foreground leading-none">{f.label}</p>
                              <p className="text-[9px] text-muted-foreground mt-1 truncate">{f.desc}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Task Columns Accordion */}
            <div className="border border-border/60 rounded-xl overflow-hidden bg-muted/5 transition-all">
              <button
                type="button"
                onClick={() => setActivePanel(activePanel === "tasks" ? null : "tasks")}
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/15 hover:bg-muted/30 transition-all font-bold text-xs text-foreground text-left cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span>Task Columns</span>
                  <span className="text-[10px] font-normal text-muted-foreground">
                    ({selectedTaskFields.length} of {TASK_FIELDS.length} selected)
                  </span>
                </div>
                <ChevronDown 
                  className={cn(
                    "size-4 text-muted-foreground transition-transform duration-200", 
                    isTasksExpanded && "rotate-180"
                  )} 
                />
              </button>
              {isTasksExpanded && (
                <div className="p-4 border-t border-border/60 space-y-3 bg-background">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    {/* Search Bar */}
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search task fields..."
                        value={taskSearchQuery}
                        onChange={(e) => setTaskSearchQuery(e.target.value)}
                        className="w-full h-8 ps-8 pr-8 rounded-lg bg-muted/40 border border-border/60 text-xs outline-none focus:ring-1 focus:ring-primary/30 focus:bg-muted/60 transition-all text-foreground"
                      />
                      {taskSearchQuery && (
                        <button
                          onClick={() => setTaskSearchQuery("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="size-3" />
                        </button>
                      )}
                    </div>
                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleSelectAllTasks}
                        className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                      >
                        Select All
                      </button>
                      <span className="text-[9px] text-muted-foreground/60">|</span>
                      <button
                        type="button"
                        onClick={handleSelectNoneTasks}
                        className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  {/* Checkbox Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-border/50 rounded-xl p-3 bg-muted/15 max-h-[220px] overflow-y-auto">
                    {filteredTaskFields.length === 0 ? (
                      <p className="col-span-2 text-center text-[10px] text-muted-foreground italic py-6">
                        No fields match your search.
                      </p>
                    ) : (
                      filteredTaskFields.map((f) => {
                        const isChecked = selectedTaskFields.includes(f.id);
                        return (
                          <div
                            key={f.id}
                            role="checkbox"
                            aria-checked={isChecked}
                            tabIndex={0}
                            onClick={() => handleToggleTaskField(f.id)}
                            onKeyDown={(e) => {
                              if (e.key === " " || e.key === "Enter") {
                                e.preventDefault();
                                handleToggleTaskField(f.id);
                              }
                            }}
                            className={cn(
                              "flex items-start gap-2.5 p-2 rounded-lg border border-transparent transition-all hover:bg-muted/50 cursor-pointer select-none focus-visible:outline-none focus-visible:bg-muted/50 focus-visible:ring-1 focus-visible:ring-primary/30",
                              isChecked && "bg-primary/[0.02]"
                            )}
                          >
                            <div className="pointer-events-none mt-0.5">
                              <Checkbox checked={isChecked} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-foreground leading-none">{f.label}</p>
                              <p className="text-[9px] text-muted-foreground mt-1 truncate">{f.desc}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-border px-6 py-4 flex items-center justify-between bg-muted/10">
            <span className="text-[10px] text-muted-foreground font-medium">
              * Blank columns will be created if no data exists.
            </span>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isExporting}
                className="h-8 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleExportClick}
                disabled={isExporting || selectedFields.length === 0}
                className="h-8 rounded-lg text-xs font-semibold gap-1.5 cursor-pointer bg-primary text-primary-foreground hover:opacity-90"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="size-3.5" />
                    Export Portfolio
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
