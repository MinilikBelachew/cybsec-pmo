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
export interface ExportTasksDialogProps {
  open: boolean;
  onClose: () => void;
  onExport: (selectedFields: string[], format: "xlsx" | "csv" | "pdf" | "doc" | "mpp") => Promise<void>;
  isExporting?: boolean;
}

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

export function ExportTasksDialog({
  open,
  onClose,
  onExport,
  isExporting = false,
}: ExportTasksDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFields, setSelectedFields] = useState<string[]>(
    TASK_FIELDS.map((f) => f.id)
  );
  const [exportFormat, setExportFormat] = useState<"xlsx" | "csv" | "pdf" | "doc" | "mpp">("xlsx");

  const filteredFields = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return TASK_FIELDS;
    return TASK_FIELDS.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.desc.toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleToggleField = (id: string) => {
    setSelectedFields((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedFields(TASK_FIELDS.map((f) => f.id));
  };

  const handleSelectNone = () => {
    setSelectedFields([]);
  };

  const handleExportClick = async () => {
    if (selectedFields.length === 0) return;
    await onExport(selectedFields, exportFormat);
    onClose();
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background shadow-2xl transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:scale-95 data-starting-style:scale-95 overflow-hidden flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-center text-primary">
                <FileSpreadsheet className="size-4" />
              </div>
              <div>
                <DialogPrimitive.Title className="text-sm font-bold text-foreground">
                  Export Project Tasks
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-[10px] text-muted-foreground">
                  Select fields and format to export.
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
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Field Selector */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground">
                  Select Columns ({selectedFields.length} of {TASK_FIELDS.length})
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-[9px] text-muted-foreground/60">|</span>
                  <button
                    type="button"
                    onClick={handleSelectNone}
                    className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search fields..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8 ps-8 pr-8 rounded-lg bg-muted/40 border border-border/60 text-xs outline-none focus:ring-1 focus:ring-primary/30 focus:bg-muted/60 transition-all text-foreground"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>

              {/* Checkbox Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-border/50 rounded-xl p-3 bg-muted/15 max-h-[300px] overflow-y-auto">
                {filteredFields.length === 0 ? (
                  <p className="col-span-2 text-center text-[10px] text-muted-foreground italic py-6">
                    No fields match your search.
                  </p>
                ) : (
                  filteredFields.map((f) => {
                    const isChecked = selectedFields.includes(f.id);
                    return (
                      <div
                        key={f.id}
                        role="checkbox"
                        aria-checked={isChecked}
                        tabIndex={0}
                        onClick={() => handleToggleField(f.id)}
                        onKeyDown={(e) => {
                          if (e.key === " " || e.key === "Enter") {
                            e.preventDefault();
                            handleToggleField(f.id);
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
                    { value: "mpp", label: "Microsoft Project (.xml)" },
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
                    { value: "mpp", label: "Microsoft Project (.xml)", desc: "Open in MS Project via File > Open" },
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
                    Export Tasks
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
