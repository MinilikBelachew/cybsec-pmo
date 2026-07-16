"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Calendar, ChevronDown, Loader2 } from "lucide-react";
import Link from "next/link";
import {
  useGetProjectLeaveImpactsQuery,
  useApplyLeaveBackupMutation,
  useGetProjectTeamQuery,
  useSetAllocationBackupMutation,
  type LeaveImpactRow,
} from "@/domains/projects";
import { Button } from "@/shared/ui/button";
import { EmployeePickerSelect } from "@/shared/components/employee-picker-select";
import { toast } from "react-hot-toast";
import { cn } from "@/shared/utils/cn";

interface ProjectLeaveImpactSectionProps {
  projectId: string;
  canEdit?: boolean;
}

const INITIAL_VISIBLE_GROUPS = 3;
const LOAD_MORE_STEP = 5;

type GroupedLeaveImpact = {
  key: string;
  assignee: LeaveImpactRow["assignee"];
  leave: LeaveImpactRow["leave"];
  allocationId: string | null;
  tasks: Array<{
    rowId: string;
    taskId: string;
    title: string;
    overlapDays: number;
    estimatedDelayDays: number;
    projectedTaskEnd: string | null;
    downstreamTaskCount: number;
    isCritical: boolean;
    isCriticalAllocation: boolean;
    hasBackupConfigured: boolean;
    backupOwnerName: string | null;
  }>;
  maxSlip: number;
  criticalCount: number;
  criticalWithoutBackup: number;
};

function groupLeaveImpactRows(rows: LeaveImpactRow[]): GroupedLeaveImpact[] {
  const groups = new Map<string, GroupedLeaveImpact>();

  for (const row of rows) {
    const key = `${row.assignee.employeeId}:${row.leave.from}:${row.leave.to}`;
    const existing = groups.get(key);

    const taskEntry = {
      rowId: row.id,
      taskId: row.task.taskId,
      title: row.task.title,
      overlapDays: row.task.overlapDays,
      estimatedDelayDays: row.task.estimatedDelayDays,
      projectedTaskEnd: row.task.projectedTaskEnd,
      downstreamTaskCount: row.task.downstreamTaskCount,
      isCritical: row.isCritical,
      isCriticalAllocation: row.isCriticalAllocation,
      hasBackupConfigured: row.hasBackup,
      backupOwnerName: row.task.backupOwnerName,
    };

    if (!existing) {
      groups.set(key, {
        key,
        assignee: row.assignee,
        leave: row.leave,
        allocationId: row.allocationId,
        tasks: [taskEntry],
        maxSlip: row.task.estimatedDelayDays,
        criticalCount: row.isCritical ? 1 : 0,
        criticalWithoutBackup: row.isCritical && !row.hasBackup ? 1 : 0,
      });
      continue;
    }

    if (!existing.tasks.some((task) => task.taskId === taskEntry.taskId)) {
      existing.tasks.push(taskEntry);
    }
    if (!existing.allocationId && row.allocationId) {
      existing.allocationId = row.allocationId;
    }
    existing.maxSlip = Math.max(existing.maxSlip, row.task.estimatedDelayDays);
    if (row.isCritical) {
      existing.criticalCount += 1;
      if (!row.hasBackup) {
        existing.criticalWithoutBackup += 1;
      }
    }
  }

  return [...groups.values()].sort((a, b) => b.maxSlip - a.maxSlip);
}

export function ProjectLeaveImpactSection({
  projectId,
  canEdit = false,
}: ProjectLeaveImpactSectionProps) {
  const { data, isLoading, refetch: refetchLeaveImpacts } =
    useGetProjectLeaveImpactsQuery(projectId);
  const { data: projectTeam = [] } = useGetProjectTeamQuery(projectId);
  const [applyLeaveBackup, { isLoading: isApplying }] = useApplyLeaveBackupMutation();
  const [setAllocationBackup, { isLoading: isSettingBackup }] =
    useSetAllocationBackupMutation();
  const [expanded, setExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_GROUPS);

  const groups = useMemo(() => groupLeaveImpactRows(data?.rows ?? []), [data?.rows]);

  const teamBackupOptions = useMemo(
    () =>
      projectTeam.map((member) => ({
        id: member.employeeId,
        name: member.employee.name,
        profileImageUrl: member.employee.profileImageUrl,
        subtitle: `${member.employee.department.name} · ${member.employee.designation}`,
      })),
    [projectTeam],
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/20 px-4 py-2.5 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Checking leave schedule impacts...
      </div>
    );
  }

  if (groups.length === 0) {
    return null;
  }

  const totalTasks = groups.reduce((sum, group) => sum + group.tasks.length, 0);
  const maxSlip = groups.reduce((max, group) => Math.max(max, group.maxSlip), 0);
  const criticalWithoutBackup = groups.reduce(
    (sum, group) => sum + group.criticalWithoutBackup,
    0,
  );
  const visibleGroups = expanded ? groups.slice(0, visibleCount) : [];
  const hasMore = visibleCount < groups.length;

  const handleApplyBackup = async (taskId: string) => {
    try {
      const result = await applyLeaveBackup({ projectId, taskId }).unwrap();
      toast.success(`Task reassigned to ${result.ownerName ?? "backup resource"}.`);
      refetchLeaveImpacts();
    } catch {
      toast.error("Could not assign backup to this task.");
    }
  };

  const handleBackupChange = async (
    allocationId: string,
    assigneeEmployeeId: string,
    backupEmployeeId: string | null,
  ) => {
    if (backupEmployeeId === assigneeEmployeeId) {
      toast.error("Backup cannot be the same as the primary resource.");
      return;
    }
    try {
      await setAllocationBackup({
        projectId,
        allocationId,
        backupEmployeeId,
      }).unwrap();
      toast.success(backupEmployeeId ? "Backup resource assigned." : "Backup removed.");
      refetchLeaveImpacts();
    } catch {
      toast.error("Failed to update backup resource.");
    }
  };

  return (
    <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20">
      <button
        type="button"
        className="flex w-full items-start gap-2 px-4 py-3 text-left"
        onClick={() => {
          setExpanded((current) => {
            const next = !current;
            if (next) {
              setVisibleCount(INITIAL_VISIBLE_GROUPS);
            }
            return next;
          });
        }}
      >
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
              Leave schedule impact
            </p>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              {groups.length} leave period{groups.length === 1 ? "" : "s"} · {totalTasks} task
              {totalTasks === 1 ? "" : "s"}
            </span>
            {maxSlip > 0 && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
                ~{maxSlip}d slip
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-amber-800/80 dark:text-amber-400/80">
            {expanded
              ? "Grouped by employee and leave dates. Expand details per period below."
              : criticalWithoutBackup > 0
                ? `${criticalWithoutBackup} critical assignment${criticalWithoutBackup === 1 ? "" : "s"} without backup. Click to review.`
                : "Approved leave overlaps scheduled work. Click to review projected slip."}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "mt-0.5 size-4 shrink-0 text-amber-700 transition-transform dark:text-amber-400",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-amber-200/70 px-4 pb-3 pt-2 dark:border-amber-900/40">
          {visibleGroups.map((group) => {
            const backupName =
              group.tasks.find((task) => task.backupOwnerName)?.backupOwnerName ??
              group.assignee.backupEmployeeName;
            const showCriticalAllocation = group.tasks.some((task) => task.isCriticalAllocation);
            const showCriticalTask = group.tasks.some((task) => task.isCritical);
            const needsBackup = !group.assignee.backupEmployeeId;
            const backupOptionsForAssignee = teamBackupOptions.filter(
              (option) => option.id !== group.assignee.employeeId,
            );

            return (
              <div
                key={group.key}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-xs",
                  showCriticalTask
                    ? "border-rose-200 bg-white/80 dark:border-rose-900/40 dark:bg-background/40"
                    : "border-amber-200/70 bg-white/70 dark:border-amber-900/30 dark:bg-background/30",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-foreground">{group.assignee.name}</span>
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Calendar className="size-3" />
                    {group.leave.from} – {group.leave.to}
                  </span>
                  {showCriticalAllocation && (
                    <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                      Critical allocation
                    </span>
                  )}
                  {showCriticalTask && (
                    <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
                      {group.criticalCount} critical
                    </span>
                  )}
                  {needsBackup && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                      No backup
                    </span>
                  )}
                </div>

                {canEdit && needsBackup && group.allocationId && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Assign backup
                    </label>
                    <EmployeePickerSelect
                      value={group.assignee.backupEmployeeId}
                      onValueChange={(backupEmployeeId) => {
                        void handleBackupChange(
                          group.allocationId!,
                          group.assignee.employeeId,
                          backupEmployeeId,
                        );
                      }}
                      options={backupOptionsForAssignee}
                      disabled={isSettingBackup}
                      noneLabel="Select backup"
                      triggerClassName="min-w-[200px] h-9"
                    />
                  </div>
                )}

                <ul className="mt-2 space-y-2">
                  {group.tasks.map((task) => (
                    <li key={task.rowId} className="text-muted-foreground">
                      <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
                        <Link
                          href={`/dashboard/projects/${projectId}?taskId=${task.taskId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {task.title}
                        </Link>
                        <span>
                          · {task.overlapDays}d overlap
                          {task.estimatedDelayDays > 0 ? ` · ~${task.estimatedDelayDays}d slip` : ""}
                          {task.projectedTaskEnd ? ` · end ~${task.projectedTaskEnd}` : ""}
                        </span>
                        {task.backupOwnerName && (
                          <span className="text-emerald-700 dark:text-emerald-400">
                            · reassigned to {task.backupOwnerName}
                          </span>
                        )}
                      </div>
                      {canEdit &&
                        task.hasBackupConfigured &&
                        !task.backupOwnerName && (
                          <Button
                            type="button"
                            size="sm"
                            className="mt-1.5 h-9 px-4 text-xs font-semibold"
                            disabled={isApplying}
                            onClick={() => void handleApplyBackup(task.taskId)}
                          >
                            {isApplying && (
                              <Loader2 className="mr-2 size-3.5 animate-spin" />
                            )}
                            Assign backup to task
                          </Button>
                        )}
                    </li>
                  ))}
                </ul>

                {backupName && (
                  <p className="mt-1.5 text-emerald-700 dark:text-emerald-400">
                    Backup resource: {backupName}
                  </p>
                )}
              </div>
            );
          })}

          {hasMore && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-full text-xs text-amber-800 hover:bg-amber-100/80 dark:text-amber-300 dark:hover:bg-amber-900/30"
              onClick={() => setVisibleCount((count) => count + LOAD_MORE_STEP)}
            >
              Load more ({groups.length - visibleCount} remaining)
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
