"use client";

import { AlertTriangle } from "lucide-react";
import { useGetTaskAssigneeAvailabilityQuery } from "@/domains/projects";

function formatDateValue(value?: string | Date | null): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
}

function parseEffortHours(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

interface TaskAssigneeAvailabilityAlertProps {
  projectId: string;
  ownerId?: string | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  effortHours?: unknown;
  excludeTaskId?: string;
}

export function TaskAssigneeAvailabilityAlert({
  projectId,
  ownerId,
  startDate,
  endDate,
  effortHours,
  excludeTaskId,
}: TaskAssigneeAvailabilityAlertProps) {
  const start = formatDateValue(startDate);
  const end = formatDateValue(endDate);
  const effort = parseEffortHours(effortHours);

  const { data, isFetching } = useGetTaskAssigneeAvailabilityQuery(
    {
      projectId,
      ownerId: ownerId!,
      startDate: start,
      endDate: end,
      effortHours: effort,
      excludeTaskId,
    },
    {
      skip: !projectId || !ownerId || !start || !end,
    }
  );

  if (!ownerId || !start || !end) {
    return null;
  }

  if (isFetching && !data) {
    return (
      <p className="text-[11px] text-muted-foreground">Checking assignee availability…</p>
    );
  }

  if (!data?.canCheck) {
    if (data?.message) {
      return <p className="text-[11px] text-muted-foreground">{data.message}</p>;
    }
    return null;
  }

  if (!data.isOverAllocated && data.warnings.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground">
        {data.employeeName}: {data.remainingHours}h/wk remaining (
        {data.utilizationPercent}% utilized).
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-100">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        <div className="space-y-1">
          {data.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
          <p className="text-muted-foreground">
            Allocations {data.allocationHours}h/wk · other tasks {data.otherTaskHours}h/wk · this
            task {data.thisTaskHours}h/wk.
          </p>
        </div>
      </div>
    </div>
  );
}
