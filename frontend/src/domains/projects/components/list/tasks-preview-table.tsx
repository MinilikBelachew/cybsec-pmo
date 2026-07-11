import React from "react";
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { ParsedTaskRow } from "../../utils/import-export";
import {
  PRIORITY_CONFIG,
  TASK_STATUS_CONFIG,
  PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
  isPriorityValid,
  isTaskStatusValid,
  EnumSelect,
} from "./import-types-helpers";

interface TasksPreviewTableProps {
  tasksList: ParsedTaskRow[];
  projName: string;
  handleSubRowChange: (
    projName: string,
    type: "phases" | "tasks" | "milestones",
    rowIndex: number,
    field: string,
    value: any
  ) => void;
}

export function TasksPreviewTable({ tasksList, projName, handleSubRowChange }: TasksPreviewTableProps) {
  return (
    <table className="w-full text-left text-xs min-w-[1200px]">
      <thead>
        <tr className="bg-muted/40 font-bold border-b border-border text-muted-foreground text-[10px] uppercase">
          <th className="p-3 w-40">Validation</th>
          <th className="p-3 w-56">Title & Description</th>
          <th className="p-3 w-32">Priority</th>
          <th className="p-3 w-40">Status</th>
          <th className="p-3 w-44">Assignee</th>
          <th className="p-3 w-44">Phase</th>
          <th className="p-3 w-36">Start Date</th>
          <th className="p-3 w-36">End Date</th>
          <th className="p-3 w-28">Effort</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/60">
        {tasksList.map((tRow, idx) => (
          <tr key={idx} className={cn("hover:bg-muted/5", tRow.errors.length > 0 ? "bg-rose-50/10" : "")}>
            {/* Validation */}
            <td className="p-3">
              {tRow.errors.length > 0 ? (
                <div className="text-rose-500 font-bold flex items-center gap-1.5">
                  <XCircle className="size-3.5 shrink-0" />
                  <span className="text-[10px]">{tRow.errors[0]}</span>
                </div>
              ) : (
                <span className="text-emerald-600 font-semibold flex items-center gap-1.5">
                  <CheckCircle className="size-3.5" />
                  Ready
                </span>
              )}
            </td>

            {/* Title & Description */}
            <td className="p-3">
              <div className="font-bold truncate flex items-center gap-1.5">
                {tRow.importMode === "update" ? (
                  <span className="shrink-0 text-[8px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                    UPDATE
                  </span>
                ) : (
                  <span className="shrink-0 text-[8px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                    NEW
                  </span>
                )}
                <span className="truncate">{tRow.title}</span>
              </div>
              <div className="text-[10px] text-muted-foreground line-clamp-1">
                {tRow.description || "No description"}
              </div>
            </td>

            {/* Priority */}
            <td className="p-3">
              {isPriorityValid(tRow.priority) ? (
                <span
                  className={cn(
                    "text-[9px] font-bold px-1.5 py-0.5 rounded border",
                    PRIORITY_CONFIG[tRow.priority]?.bg,
                    PRIORITY_CONFIG[tRow.priority]?.text
                  )}
                >
                  {tRow.priority}
                </span>
              ) : (
                <EnumSelect
                  value={tRow.priority}
                  options={PRIORITY_OPTIONS}
                  onChange={(val) => handleSubRowChange(projName, "tasks", idx, "priority", val)}
                />
              )}
            </td>

            {/* Status */}
            <td className="p-3">
              {isTaskStatusValid(tRow.status) ? (
                <span
                  className={cn(
                    "text-[9px] font-bold px-1.5 py-0.5 rounded border inline-flex items-center gap-1",
                    TASK_STATUS_CONFIG[tRow.status]?.bg,
                    TASK_STATUS_CONFIG[tRow.status]?.text,
                    TASK_STATUS_CONFIG[tRow.status]?.border
                  )}
                >
                  <span className={cn("size-1 rounded-full", TASK_STATUS_CONFIG[tRow.status]?.dot)} />
                  {TASK_STATUS_CONFIG[tRow.status]?.label}
                </span>
              ) : (
                <EnumSelect
                  value={tRow.status}
                  options={TASK_STATUS_OPTIONS}
                  onChange={(val) => handleSubRowChange(projName, "tasks", idx, "status", val)}
                />
              )}
            </td>

            {/* Assignee */}
            <td className="p-3 text-muted-foreground">
              {tRow.assigneeName ? (
                <span
                  className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-500"
                  title="Assignees are mapped to project team members after import. This task will import as Unassigned."
                >
                  <AlertTriangle className="size-3 shrink-0" />
                  {tRow.assigneeName} (Unassigned)
                </span>
              ) : (
                "Unassigned"
              )}
            </td>

            {/* Phase */}
            <td className="p-3 font-semibold">
              {tRow.phaseName ? (
                <span className="text-primary">{tRow.phaseName}</span>
              ) : (
                <span className="text-muted-foreground">No Phase</span>
              )}
            </td>

            <td className="p-3">{tRow.startDate || "—"}</td>
            <td className="p-3">{tRow.endDate || "—"}</td>
            <td className="p-3">{tRow.effortHours ? `${tRow.effortHours} hrs` : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
