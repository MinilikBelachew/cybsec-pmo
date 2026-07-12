"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  Clock,
  Mail,
  User,
} from "lucide-react";
import { EmployeeAvatar } from "@/shared/components/employee-avatar";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";
import type { TeamDirectoryMember, TeamLeaveRecord } from "../types/resources.types";
import { formatAllocationDateRange } from "@/domains/projects/utils/allocation-date.utils";
import { KEKA_SYNC_CONFIG, UTILIZATION_CONFIG } from "../utils/resource-ui.config";

type DetailTab = "profile" | "assignments" | "leave";

const LEAVE_STATUS_STYLES: Record<TeamLeaveRecord["status"], string> = {
  approved:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
  pending:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
  rejected:
    "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800",
};

export function TeamMemberDetail({
  member,
  onBack,
}: {
  member: TeamDirectoryMember;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<DetailTab>("profile");
  const util = UTILIZATION_CONFIG[member.utilStatus];
  const keka = KEKA_SYNC_CONFIG[member.kekaSyncStatus];
  const KekaIcon = keka.icon;
  const activeAssignments = member.assignments.filter((a) => a.status === "active");

  return (
    <div className="space-y-6 pb-10">
      <nav className="flex items-center gap-2 text-sm">
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Team Directory
        </Button>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium text-foreground">{member.name}</span>
      </nav>

      <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-1 gap-5">
            <EmployeeAvatar
              name={member.name}
              employeeId={member.id}
              profileImageUrl={member.avatarUrl}
              size="lg"
            />

            <div className="min-w-0 flex-1 space-y-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight">{member.name}</h1>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                      util.bg,
                      util.text,
                      util.border,
                    )}
                  >
                    <span className={cn("size-1.5 rounded-full", util.bar)} />
                    {util.label}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-[11px] font-semibold",
                      keka.text,
                    )}
                  >
                    <KekaIcon className="size-3" />
                    {keka.label}
                  </span>
                </div>
                <p className="text-sm font-medium text-foreground">{member.designation}</p>
                <p className="text-sm text-primary">{member.department}</p>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="size-3.5 shrink-0" />
                  {member.email}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="size-3.5 shrink-0" />
                  {member.department}
                </span>
                <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                  <User className="size-3.5 shrink-0" />
                  {member.kekaEmployeeId}
                </span>
              </div>
            </div>
          </div>

          <div className="w-full shrink-0 space-y-2 lg:w-48">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Utilization</span>
              <span className="font-bold">{member.utilization}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full transition-all", util.bar)}
                style={{ width: `${Math.min(member.utilization, 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">Next 90 days · active allocations</p>
          </div>
        </div>
      </div>

      <div className="flex border-b border-border/50">
        {(
          [
            { id: "profile" as const, label: "Profile", icon: User },
            {
              id: "assignments" as const,
              label: "Assignments",
              icon: Briefcase,
              count: activeAssignments.length,
            },
            {
              id: "leave" as const,
              label: "Leave",
              icon: Calendar,
              count: member.leaveHistory.length,
            },
          ]
        ).map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              tab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {label}
            {count !== undefined && count > 0 ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  tab === id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                {count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === "profile" && <ProfileTab member={member} util={util} />}
      {tab === "assignments" && <AssignmentsTab member={member} />}
      {tab === "leave" && <LeaveTab member={member} />}
    </div>
  );
}

function ProfileTab({
  member,
  util,
}: {
  member: TeamDirectoryMember;
  util: (typeof UTILIZATION_CONFIG)[keyof typeof UTILIZATION_CONFIG];
}) {
  const activeProjects = member.projects.length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Weekly capacity" value={`${member.weeklyCapacity}h`} />
        <StatCard label="Allocated" value={`${member.allocatedHours}h/wk`} />
        <StatCard label="Remaining" value={`${member.remainingHours}h/wk`} />
        <StatCard label="Active projects" value={String(activeProjects)} />
      </div>

      <section className="rounded-2xl border border-border/60 bg-card p-5">
        <h2 className="text-sm font-semibold">Capacity overview</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Based on active project allocations over the next 90 days
        </p>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Utilization</span>
            <span className="font-semibold">{member.utilization}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", util.bar)}
              style={{ width: `${Math.min(member.utilization, 100)}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <span
              className={cn(
                "rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                util.bg,
                util.text,
                util.border,
              )}
            >
              {util.label}
            </span>
            {member.utilization >= 100 && (
              <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400">
                At or above full capacity
              </span>
            )}
          </div>
        </div>
      </section>

      {member.projects.length > 0 && (
        <section className="rounded-2xl border border-border/60 bg-card p-5">
          <h2 className="text-sm font-semibold">Current projects</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {member.projects.length} active project{member.projects.length === 1 ? "" : "s"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {member.projects.map((project) => (
              <span
                key={project}
                className="rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5 text-sm font-medium"
              >
                {project}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-border/60 bg-card p-5">
        <h2 className="text-sm font-semibold">HR integration</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Keka employee ID</p>
            <p className="mt-1 font-mono text-sm font-semibold">{member.kekaEmployeeId}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Sync status</p>
            <p className="mt-1 text-sm font-medium capitalize">{member.kekaSyncStatus}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function AssignmentsTab({ member }: { member: TeamDirectoryMember }) {
  if (member.assignments.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 py-16 text-center">
        <Briefcase className="mx-auto size-8 text-muted-foreground/50" />
        <p className="mt-3 text-sm font-medium">No project assignments</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Assignments appear when this person is added to a project team.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {member.assignments.length} assignment{member.assignments.length === 1 ? "" : "s"}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {member.assignments.map((assignment) => (
          <div
            key={`${assignment.project}-${assignment.role}-${assignment.startDate}`}
            className="flex gap-3 rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-primary/20 hover:bg-muted/20"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Briefcase className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-sm font-semibold">{assignment.project}</p>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize",
                    assignment.status === "active"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400"
                      : "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {assignment.status}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{assignment.role}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3" />
                  {assignment.hoursPerWeek}h/wk
                  {assignment.allocationPercent > 0 ? ` · ${assignment.allocationPercent}%` : ""}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="size-3" />
                  {formatAllocationDateRange(assignment.startDate, assignment.endDate)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeaveTab({ member }: { member: TeamDirectoryMember }) {
  if (member.leaveHistory.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 py-16 text-center">
        <Calendar className="mx-auto size-8 text-muted-foreground/50" />
        <p className="mt-3 text-sm font-medium">No leave on record</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Leave records will appear after Keka leave sync.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {member.leaveHistory.length} leave record{member.leaveHistory.length === 1 ? "" : "s"}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {member.leaveHistory.map((leave) => (
          <div
            key={leave.id}
            className="flex gap-3 rounded-xl border border-border/60 bg-card p-4"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Calendar className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold">{leave.type}</p>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize",
                    LEAVE_STATUS_STYLES[leave.status],
                  )}
                >
                  {leave.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {leave.from}
                {leave.to !== leave.from ? ` – ${leave.to}` : ""}
              </p>
              <p className="mt-2 text-[11px] font-medium text-muted-foreground">
                {leave.days} day{leave.days === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
    </div>
  );
}
