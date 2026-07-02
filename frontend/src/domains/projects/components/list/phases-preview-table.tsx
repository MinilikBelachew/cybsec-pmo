import React from "react";
import { Badge } from "@/shared/ui/badge";
import { CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { ParsedPhaseRow } from "../../utils/import-export";
import {
  PHASE_STATUS_OPTIONS,
  isPhaseStatusValid,
  EnumSelect,
} from "./import-types-helpers";

interface PhasesPreviewTableProps {
  phasesList: ParsedPhaseRow[];
  projName: string;
  handleSubRowChange: (projName: string, type: "phases" | "tasks" | "milestones", rowIndex: number, field: string, value: any) => void;
}

export function PhasesPreviewTable({ phasesList, projName, handleSubRowChange }: PhasesPreviewTableProps) {
  return (
    <table className="w-full text-left text-xs min-w-[1000px]">
      <thead>
        <tr className="bg-muted/40 font-bold border-b border-border text-muted-foreground text-[10px] uppercase">
          <th className="p-3 w-40">Validation</th>
          <th className="p-3 w-48">Name</th>
          <th className="p-3 w-56">Description</th>
          <th className="p-3 w-24">Order</th>
          <th className="p-3 w-32">Status</th>
          <th className="p-3 w-36">Start Date</th>
          <th className="p-3 w-36">End Date</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/60">
        {phasesList.map((phRow, idx) => (
          <tr key={idx} className={cn("hover:bg-muted/5", phRow.errors.length > 0 ? "bg-rose-50/10" : "")}>
            <td className="p-3">
              {phRow.errors.length > 0 ? (
                <div className="text-rose-500 font-bold flex items-center gap-1.5">
                  <XCircle className="size-3.5" />
                  <span className="text-[10px]">{phRow.errors[0]}</span>
                </div>
              ) : (
                <span className="text-emerald-600 font-semibold flex items-center gap-1.5"><CheckCircle className="size-3.5" />Ready</span>
              )}
            </td>
            <td className="p-3 font-semibold">{phRow.name}</td>
            <td className="p-3 text-muted-foreground truncate max-w-xs">{phRow.description || "—"}</td>
            <td className="p-3">{phRow.orderIndex}</td>
            <td className="p-3">
              {isPhaseStatusValid(phRow.status) ? (
                <Badge variant="outline" className="text-[9px]">{phRow.status}</Badge>
              ) : (
                <EnumSelect
                  value={phRow.status}
                  options={PHASE_STATUS_OPTIONS}
                  onChange={(val) => handleSubRowChange(projName, "phases", idx, "status", val)}
                />
              )}
            </td>
            <td className="p-3">{phRow.startDate || "—"}</td>
            <td className="p-3">{phRow.endDate || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
