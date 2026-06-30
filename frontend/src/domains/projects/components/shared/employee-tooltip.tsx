"use client";

import { Briefcase } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

export interface TooltipEmployee {
  displayName?: string;
  name?: string;
  email?: string;
  designation?: string;
  role?: string;
  employeeId?: string;
  department?: {
    code?: string;
    name?: string;
  };
}

interface EmployeeTooltipProps {
  employee?: TooltipEmployee | null;
  children: React.ReactNode;
}

export function EmployeeTooltip({ employee, children }: EmployeeTooltipProps) {
  if (!employee) return <>{children}</>;

  const fullName = employee.displayName || employee.name || "Unknown Employee";
  const email = employee.email || "";
  const designation = employee.designation || "";
  const role = employee.role || "";
  const deptName = employee.department?.name || "";
  const employeeId = employee.employeeId || "";

  return (
    <Tooltip>
      <TooltipTrigger render={children as React.ReactElement} />
      <TooltipContent
        className="z-[100] border border-border/80 bg-popover text-popover-foreground px-2.5 py-1.5 shadow-md rounded-lg bg-white dark:bg-slate-900 flex flex-col text-left text-xs font-normal"
        side="top"
        sideOffset={6}
      >
        <div className="flex flex-col text-left text-xs w-full">
          {/* Header Area */}
          <div className="space-y-0.5 w-full">
            <h4 className="font-bold text-sm text-foreground tracking-tight truncate">
              {fullName}
            </h4>
            {designation && (
              <p className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                <Briefcase className="size-3 text-muted-foreground/60 shrink-0" />
                {designation}
              </p>
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
