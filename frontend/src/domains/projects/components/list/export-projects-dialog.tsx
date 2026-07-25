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

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/shared/ui/dropdown-menu";
import {
  TASK_EXPORT_FIELD_OPTIONS,
  DEFAULT_TASK_EXPORT_FIELDS,
  DEFAULT_PROJECT_EXPORT_FIELDS,
} from "../../utils/import-export";

export interface ExportProjectsDialogProps {
  open: boolean;
  onClose: () => void;
  /** Projects available to include in the export (id + name). */
  projects?: { id: string; name: string }[];
  onExport: (
    selectedFields: string[],
    format: "xlsx" | "csv" | "pdf" | "doc" | "mspdi",
    selectedTaskFields?: string[],
    selectedProjectIds?: string[],
  ) => Promise<void>;
  isExporting?: boolean;
}

const PROJECT_FIELD_META: Record<string, { label: string; desc: string }> = {
  Name: { label: "Project Name", desc: "The official name of the project" },
  Objective: { label: "Objective", desc: "Scope, details, and objectives" },
  Department: { label: "Department", desc: "Associated department or team" },
  Customer: { label: "Customer", desc: "The client or account name" },
  "Engagement Type": {
    label: "Engagement Type",
    desc: "Staff Augmentation, Managed Services, or Fixed Price",
  },
  "Billing Model": {
    label: "Billing Model",
    desc: "Billing arrangement (T&M, Retainer, etc.)",
  },
  Priority: { label: "Priority", desc: "Urgency level (Critical, High, Medium, Low)" },
  "Start Date": { label: "Start Date", desc: "Current scheduled start" },
  "End Date": { label: "End Date", desc: "Current scheduled finish" },
  "Duration Days": { label: "Duration Days", desc: "Current working-day duration" },
  "Baseline Start": { label: "Baseline Start", desc: "Frozen original start" },
  "Baseline End": { label: "Baseline End", desc: "Frozen original finish" },
  "Baseline Duration Days": {
    label: "Baseline Duration Days",
    desc: "Frozen original duration",
  },
  "% Complete": {
    label: "% Complete",
    desc: "Project percent complete from schedule",
  },
  "Duration Variance Days": {
    label: "Duration Variance Days",
    desc: "Current duration − baseline duration",
  },
  "Actual Start": { label: "Actual Start", desc: "When work actually started" },
  "Actual End": { label: "Actual End", desc: "When work actually finished" },
  "Resource Names": {
    label: "Resource Names",
    desc: "MSP-style Name (Organization) for PMs and team",
  },
  Value: { label: "Value", desc: "Budget or total commercial value" },
  Currency: { label: "Currency", desc: "Currency code (USD, EUR, SAR, AED)" },
  "Primary PM": { label: "Primary PM", desc: "Lead Project Manager assigned" },
  "Secondary PM": {
    label: "Secondary PM",
    desc: "Secondary/Backup Project Manager",
  },
  Status: { label: "Status", desc: "Current project delivery status" },
};

const PROJECT_FIELDS = DEFAULT_PROJECT_EXPORT_FIELDS.map((id) => ({
  id,
  label: PROJECT_FIELD_META[id]?.label ?? id,
  desc: PROJECT_FIELD_META[id]?.desc ?? "",
}));

const TASK_FIELDS = TASK_EXPORT_FIELD_OPTIONS.map((f) => ({
  id: f.id,
  label: f.label,
  desc: f.desc,
}));

export function ExportProjectsDialog({
  open,
  onClose,
  onExport,
  projects = [],
  isExporting = false,
}: ExportProjectsDialogProps) {
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [projectPickSearch, setProjectPickSearch] = useState("");
  const [selectedFields, setSelectedFields] = useState<string[]>([
    ...DEFAULT_PROJECT_EXPORT_FIELDS,
  ]);
  const [selectedTaskFields, setSelectedTaskFields] = useState<string[]>([
    ...DEFAULT_TASK_EXPORT_FIELDS,
  ]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<"xlsx" | "csv" | "pdf" | "doc" | "mspdi">("xlsx");

  const [activePanel, setActivePanel] = useState<"pick" | "projects" | "tasks" | null>("pick");
  const isPickExpanded = activePanel === "pick";
  const isProjectsExpanded = activePanel === "projects";
  const isTasksExpanded = activePanel === "tasks";

  // When dialog opens, select all projects and refresh field list (picks up new schedule columns).
  React.useEffect(() => {
    if (!open) return;
    setSelectedProjectIds(projects.map((p) => p.id));
    setSelectedFields([...DEFAULT_PROJECT_EXPORT_FIELDS]);
  }, [open, projects]);

  const filteredPickProjects = useMemo(() => {
    const q = projectPickSearch.toLowerCase().trim();
    if (!q) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, projectPickSearch]);

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

  const handleToggleProject = (id: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllProjects = () => {
    setSelectedFields(PROJECT_FIELDS.map((f) => f.id));
  };

  const handleSelectNoneProjects = () => {
    setSelectedFields([]);
  };

  const handleSelectAllPick = () => {
    setSelectedProjectIds(projects.map((p) => p.id));
  };

  const handleSelectNonePick = () => {
    setSelectedProjectIds([]);
  };

  const handleSelectAllTasks = () => {
    setSelectedTaskFields(TASK_FIELDS.map((f) => f.id));
  };

  const handleSelectNoneTasks = () => {
    setSelectedTaskFields([]);
  };

  const handleExportClick = async () => {
    if (selectedFields.length === 0) return;
    if (projects.length > 0 && selectedProjectIds.length === 0) return;
    await onExport(selectedFields, exportFormat, selectedTaskFields, selectedProjectIds);
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
                  Export Project Schedule
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-[10px] text-muted-foreground">
                  Choose projects, fields, and format to export.
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
            {/* Projects to include */}
            {projects.length > 0 && (
              <div className="border border-border/60 rounded-xl overflow-hidden bg-muted/5 transition-all">
                <button
                  type="button"
                  onClick={() => setActivePanel(activePanel === "pick" ? null : "pick")}
                  className="w-full flex items-center justify-between px-4 py-3 bg-muted/15 hover:bg-muted/30 transition-all font-bold text-xs text-foreground text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span>Projects</span>
                    <span className="text-[10px] font-normal text-muted-foreground">
                      ({selectedProjectIds.length} of {projects.length} selected)
                    </span>
                  </div>
                  <ChevronDown
                    className={cn(
                      "size-4 text-muted-foreground transition-transform duration-200",
                      isPickExpanded && "rotate-180"
                    )}
                  />
                </button>
                {isPickExpanded && (
                  <div className="p-4 border-t border-border/60 space-y-3 bg-background">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Search projects..."
                          value={projectPickSearch}
                          onChange={(e) => setProjectPickSearch(e.target.value)}
                          className="w-full h-8 ps-8 pr-8 rounded-lg bg-muted/40 border border-border/60 text-xs outline-none focus:ring-1 focus:ring-primary/30 focus:bg-muted/60 transition-all text-foreground"
                        />
                        {projectPickSearch && (
                          <button
                            onClick={() => setProjectPickSearch("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            <X className="size-3" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-end gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={handleSelectAllPick}
                          className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                        >
                          Select All
                        </button>
                        <span className="text-[9px] text-muted-foreground/60">|</span>
                        <button
                          type="button"
                          onClick={handleSelectNonePick}
                          className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-border/50 rounded-xl p-3 bg-muted/15 max-h-[220px] overflow-y-auto">
                      {filteredPickProjects.length === 0 ? (
                        <p className="col-span-2 text-center text-[10px] text-muted-foreground italic py-6">
                          No projects match your search.
                        </p>
                      ) : (
                        filteredPickProjects.map((p) => {
                          const isChecked = selectedProjectIds.includes(p.id);
                          return (
                            <div
                              key={p.id}
                              role="checkbox"
                              aria-checked={isChecked}
                              tabIndex={0}
                              onClick={() => handleToggleProject(p.id)}
                              onKeyDown={(e) => {
                                if (e.key === " " || e.key === "Enter") {
                                  e.preventDefault();
                                  handleToggleProject(p.id);
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
                                <p className="text-xs font-bold text-foreground leading-snug truncate">
                                  {p.name}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

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
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-2 rounded-lg border-border/60 bg-muted/45 px-3 font-semibold text-xs text-foreground cursor-pointer hover:bg-muted/65"
                    />
                  }
                >
                  <span className="text-muted-foreground font-normal">Format:</span>
                  <span>
                    {([
                      { value: "xlsx", label: "Excel (.xlsx)" },
                      { value: "csv", label: "CSV (.csv)" },
                      { value: "pdf", label: "PDF (.pdf)" },
                      { value: "doc", label: "Word (.doc)" },
                      { value: "mspdi", label: "MS Project XML (MSPDI)" },
                    ].find(o => o.value === exportFormat)?.label ?? exportFormat.toUpperCase())}
                  </span>
                  <ChevronDown className="size-3.5 opacity-60" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-2 shadow-lg border border-border bg-background rounded-xl">
                  <div className="space-y-1">
                    {[
                      { value: "xlsx", label: "Excel (.xlsx)", desc: "Spreadsheet representation" },
                      { value: "csv", label: "CSV (.csv)", desc: "Plain text table" },
                      { value: "pdf", label: "PDF (.pdf)", desc: "Print-ready document" },
                      { value: "doc", label: "Word (.doc)", desc: "Landscape layout report" },
                      { value: "mspdi", label: "MS Project XML (MSPDI)", desc: "Open in MS Project via File > Open" },
                    ].map((opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        onClick={() => setExportFormat(opt.value as any)}
                        className={cn(
                          "flex w-full items-start gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors cursor-pointer select-none focus:outline-none focus:bg-muted/50 focus:border-border/60",
                          exportFormat === opt.value
                            ? "border-primary/30 bg-primary/5 font-bold"
                            : "border-transparent hover:border-border/60 hover:bg-muted/50",
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold text-foreground">{opt.label}</span>
                          <span className="block text-[10px] text-muted-foreground leading-relaxed">{opt.desc}</span>
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
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
                disabled={
                  isExporting ||
                  selectedFields.length === 0 ||
                  (projects.length > 0 && selectedProjectIds.length === 0)
                }
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
                    Export Schedule
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
