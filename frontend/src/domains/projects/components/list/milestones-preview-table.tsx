import React from "react";
import { Badge } from "@/shared/ui/badge";
import { CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { ParsedMilestoneRow } from "../../utils/import-export";
import {
  MILESTONE_STATUS_OPTIONS,
  isMilestoneStatusValid,
  EnumSelect,
} from "./import-types-helpers";

interface MilestonesPreviewTableProps {
  milestonesList: ParsedMilestoneRow[];
  projName: string;
  handleSubRowChange: (
    projName: string,
    type: "phases" | "tasks" | "milestones",
    rowIndex: number,
    field: string,
    value: any
  ) => void;
}

export function MilestonesPreviewTable({ milestonesList, projName, handleSubRowChange }: MilestonesPreviewTableProps) {
  return (
    <table className="w-full text-left text-xs min-w-[800px]">
      <thead>
        <tr className="bg-muted/40 font-bold border-b border-border text-muted-foreground text-[10px] uppercase">
          <th className="p-3 w-40">Validation</th>
          <th className="p-3 w-56">Title</th>
          <th className="p-3 w-32">Target Date</th>
          <th className="p-3 w-24">Weight</th>
          <th className="p-3 w-32">Status</th>
          <th className="p-3 w-44">Phase</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/60">
        {milestonesList.map((msRow, idx) => (
          <tr key={idx} className={cn("hover:bg-muted/5", msRow.errors.length > 0 ? "bg-rose-50/10" : "")}>
            {/* Validation */}
            <td className="p-3">
              {msRow.errors.length > 0 ? (
                <div className="text-rose-500 font-bold flex items-center gap-1.5">
                  <XCircle className="size-3.5 shrink-0" />
                  <span className="text-[10px]">{msRow.errors[0]}</span>
                </div>
              ) : (
                <span className="text-emerald-600 font-semibold flex items-center gap-1.5">
                  <CheckCircle className="size-3.5" />
                  Ready
                </span>
              )}
            </td>

            <td className="p-3 font-semibold">{msRow.title}</td>
            <td className="p-3">{msRow.targetDate}</td>
            <td className="p-3 font-medium">{msRow.weight}%</td>

            {/* Status */}
            <td className="p-3">
              {isMilestoneStatusValid(msRow.status) ? (
                <Badge variant="outline" className="text-[9px]">
                  {msRow.status}
                </Badge>
              ) : (
                <EnumSelect
                  value={msRow.status}
                  options={MILESTONE_STATUS_OPTIONS}
                  onChange={(val) => handleSubRowChange(projName, "milestones", idx, "status", val)}
                />
              )}
            </td>

            {/* Phase */}
            <td className="p-3 font-semibold">
              {msRow.phaseName ? (
                <span className="text-primary">{msRow.phaseName}</span>
              ) : (
                <span className="text-muted-foreground">No Phase</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
