"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  ChevronDown,
  Clock,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/utils/cn";
import {
  useApproveTimesheetSubmissionMutation,
  useGetTimesheetApprovalsQuery,
  useRejectTimesheetSubmissionMutation,
  useRetryTimesheetSyncMutation,
} from "../api/resources.api";
import type { ApprovalStatus, TimesheetSubmission } from "../types/resources.types";
import { APPROVAL_STATUS_CONFIG } from "../utils/resource-ui.config";

const EMPLOYEE_COLORS = [
  "bg-sky-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
];

function employeeColor(name: string) {
  const code = name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return EMPLOYEE_COLORS[code % EMPLOYEE_COLORS.length];
}

function formatSubmittedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ApprovalQueuePage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ApprovalStatus | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [approveNotes, setApproveNotes] = useState<Record<string, string>>({});
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const { data, isLoading, isFetching } = useGetTimesheetApprovalsQuery({
    search: search || undefined,
    status: filter,
  });
  const [approveSubmission, { isLoading: approving }] =
    useApproveTimesheetSubmissionMutation();
  const [rejectSubmission, { isLoading: rejecting }] =
    useRejectTimesheetSubmissionMutation();
  const [retrySync] = useRetryTimesheetSyncMutation();

  const submissions = data?.rows ?? [];
  const stats = data?.stats ?? {
    pending: 0,
    approved: 0,
    rejected: 0,
    escalated: 0,
    overThreshold: 0,
  };

  const filtered = useMemo(() => submissions, [submissions]);
  const syncFailureCount = useMemo(
    () => submissions.reduce((sum, row) => sum + row.failedSyncCount, 0),
    [submissions],
  );

  async function approve(submission: TimesheetSubmission) {
    const comment = approveNotes[submission.id]?.trim();
    try {
      const result = await approveSubmission({
        employeeId: submission.employeeId,
        weekStart: submission.weekStart,
        comment: comment || undefined,
      }).unwrap();

      if (result.syncFailures.length > 0) {
        toast.success(
          `Approved ${result.updatedCount} entries. ${result.syncFailures.length} Keka sync failure(s) — retry from the entry list.`,
          { duration: 6000 },
        );
      } else {
        toast.success(`Approved ${result.updatedCount} entries.`);
      }
      setExpanded(null);
    } catch {
      toast.error("Could not approve submission.");
    }
  }

  async function reject(submission: TimesheetSubmission) {
    const note = rejectNotes[submission.id]?.trim();
    try {
      const result = await rejectSubmission({
        employeeId: submission.employeeId,
        weekStart: submission.weekStart,
        comment: note,
      }).unwrap();
      toast.success(`Rejected ${result.updatedCount} entries.`);
      setExpanded(null);
    } catch {
      toast.error("Could not reject submission.");
    }
  }

  async function retryEntrySync(timesheetId: string) {
    setRetryingId(timesheetId);
    try {
      const result = await retrySync({ timesheetId }).unwrap();
      if (result.success) {
        toast.success("Keka sync succeeded.");
      } else {
        toast.error("Keka sync failed again. Check integration logs.");
      }
    } catch {
      toast.error("Could not retry Keka sync.");
    } finally {
      setRetryingId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" />
        Loading approval queue...
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Approval Queue"
        description={`${stats.pending} pending${stats.escalated > 0 ? ` · ${stats.escalated} escalated` : ""}${stats.overThreshold > 0 ? ` · ${stats.overThreshold} over threshold` : ""}${syncFailureCount > 0 ? ` · ${syncFailureCount} sync failure(s)` : ""}`}
      />

      {stats.escalated > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-800 dark:bg-rose-900/20">
          <Bell className="size-4 shrink-0 text-rose-500" />
          <p className="text-sm text-rose-700 dark:text-rose-400">
            <span className="font-bold">
              {stats.escalated} submission{stats.escalated > 1 ? "s" : ""}
            </span>{" "}
            have been escalated due to delayed approval.
          </p>
        </div>
      )}

      {syncFailureCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20">
          <AlertCircle className="size-4 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800 dark:text-amber-400">
            <span className="font-bold">{syncFailureCount} approved entr{syncFailureCount > 1 ? "ies" : "y"}</span>{" "}
            failed to sync to Keka. Expand the submission and use Retry on each failed row.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Pending", value: stats.pending, color: "text-amber-600", icon: Clock },
          { label: "Approved", value: stats.approved, color: "text-emerald-600", icon: CheckCircle2 },
          { label: "Rejected", value: stats.rejected, color: "text-rose-600", icon: X },
          { label: "Escalated", value: stats.escalated, color: "text-foreground", icon: AlertCircle },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="flex items-center gap-3 rounded-xl border border-border/50 bg-card px-4 py-3"
            >
              <Icon className={cn("size-5 shrink-0", item.color)} />
              <div>
                <p className={cn("text-xl font-bold", item.color)}>{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee, week..."
            className="pl-9"
          />
        </div>
        <div className="relative">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as ApprovalStatus | "all")}
            className="h-9 cursor-pointer appearance-none rounded-xl border border-border/50 bg-muted/50 px-3 pr-7 text-sm outline-none focus:ring-1 focus:ring-primary/30"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
        </div>
        <span className="text-xs text-muted-foreground sm:ml-auto">
          {filtered.length} submissions
          {isFetching && " · refreshing..."}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 py-16 text-center text-sm text-muted-foreground">
          No timesheet submissions match your filters.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((submission) => {
            const status = APPROVAL_STATUS_CONFIG[submission.status];
            const StatusIcon = status.icon;
            const isExpanded = expanded === submission.id;
            const colorClass = employeeColor(submission.employee);

            return (
              <div
                key={submission.id}
                className={cn(
                  "rounded-2xl border transition-all duration-150",
                  isExpanded
                    ? "border-primary/30 bg-primary/[0.02]"
                    : "border-border/60 bg-card hover:border-primary/20",
                )}
              >
                <div
                  className="flex cursor-pointer flex-wrap items-center gap-4 px-5 py-4"
                  onClick={() => setExpanded(isExpanded ? null : submission.id)}
                >
                  <div
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white",
                      colorClass,
                    )}
                  >
                    {submission.employeeInitials}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold">{submission.employee}</span>
                      <span className="text-xs text-muted-foreground">
                        {submission.employeeRole}
                      </span>
                      {submission.isEscalated && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold text-rose-600 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-400">
                          <Bell className="size-2.5" />
                          Escalated
                        </span>
                      )}
                      {submission.isOverThreshold && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                          <AlertCircle className="size-2.5" />
                          Over threshold
                        </span>
                      )}
                      {submission.hasSyncFailures && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                          <AlertCircle className="size-2.5" />
                          {submission.failedSyncCount} Keka sync failed
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {submission.week} · Submitted {formatSubmittedAt(submission.submittedAt)}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold">{submission.totalHours.toFixed(1)}h</p>
                    <p className="text-[10px] text-muted-foreground">
                      {submission.billableHours.toFixed(1)}h billable
                    </p>
                  </div>

                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold",
                      status.bg,
                      status.text,
                      status.border,
                    )}
                  >
                    <StatusIcon className="size-3" />
                    {status.label}
                  </span>

                  {submission.status === "pending" && (
                    <div
                      className="flex shrink-0 items-center gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400"
                        disabled={approving || rejecting}
                        onClick={() => approve(submission)}
                      >
                        <CheckCircle2 className="size-3.5" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400"
                        onClick={() => setExpanded(submission.id)}
                      >
                        <X className="size-3.5" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>

                {isExpanded && (
                  <div className="space-y-4 border-t border-border/30 px-5 pb-5 pt-4">
                    <div className="overflow-hidden rounded-xl border border-border/50">
                      <div className="grid grid-cols-[80px_1fr_1fr_80px_90px] gap-3 border-b border-border/40 bg-muted/30 px-4 py-2">
                        {["Date", "Project / Task", "Description", "Hours", "Keka"].map((header) => (
                          <div
                            key={header}
                            className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                          >
                            {header}
                          </div>
                        ))}
                      </div>
                      <div className="divide-y divide-border/20">
                        {submission.entries.map((entry) => (
                          <div
                            key={entry.id}
                            className="grid grid-cols-[80px_1fr_1fr_80px_90px] items-start gap-3 px-4 py-2.5 transition-colors hover:bg-muted/20"
                          >
                            <p className="text-xs font-medium">{entry.date}</p>
                            <div>
                              <p className="text-xs font-semibold">{entry.task}</p>
                              <p className="text-[10px] text-muted-foreground">{entry.project}</p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {entry.description || "—"}
                            </p>
                            <p className="text-sm font-bold">{entry.hours}h</p>
                            <div className="flex items-center gap-1">
                              {entry.kekaSyncStatus === "synced" && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600">
                                  <CheckCircle2 className="size-3" />
                                  Synced
                                </span>
                              )}
                              {entry.kekaSyncStatus === "failed" && (
                                <>
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700">
                                    <AlertCircle className="size-3" />
                                    Failed
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-1.5 text-[10px]"
                                    disabled={retryingId === entry.id}
                                    onClick={() => retryEntrySync(entry.id)}
                                  >
                                    {retryingId === entry.id ? (
                                      <Loader2 className="size-3 animate-spin" />
                                    ) : (
                                      <>
                                        <RefreshCw className="mr-0.5 size-3" />
                                        Retry
                                      </>
                                    )}
                                  </Button>
                                </>
                              )}
                              {!entry.kekaSyncStatus && (
                                <span className="text-[10px] text-muted-foreground">—</span>
                              )}
                            </div>
                          </div>
                        ))}
                        <div className="grid grid-cols-[80px_1fr_1fr_80px_90px] gap-3 bg-muted/20 px-4 py-2.5">
                          <div className="col-span-3 text-end text-xs font-bold text-muted-foreground">
                            Total
                          </div>
                          <p className="text-sm font-bold text-primary">
                            {submission.totalHours.toFixed(1)}h
                          </p>
                          <div />
                        </div>
                      </div>
                    </div>

                    {submission.status === "pending" && (
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Approval note (optional)
                          </label>
                          <textarea
                            value={approveNotes[submission.id] ?? ""}
                            onChange={(e) =>
                              setApproveNotes((prev) => ({
                                ...prev,
                                [submission.id]: e.target.value,
                              }))
                            }
                            placeholder="Optional note included in the approval notification..."
                            rows={2}
                            className="w-full resize-none rounded-xl border border-border/50 bg-muted/40 px-3 py-2 text-sm outline-none transition-all focus:ring-1 focus:ring-primary/30"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Rejection feedback (optional)
                          </label>
                          <textarea
                            value={rejectNotes[submission.id] ?? ""}
                            onChange={(e) =>
                              setRejectNotes((prev) => ({
                                ...prev,
                                [submission.id]: e.target.value,
                              }))
                            }
                            placeholder="Provide feedback if rejecting..."
                            rows={2}
                            className="w-full resize-none rounded-xl border border-border/50 bg-muted/40 px-3 py-2 text-sm outline-none transition-all focus:ring-1 focus:ring-primary/30"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            className="gap-1.5 bg-emerald-600 hover:bg-emerald-600/90"
                            disabled={approving || rejecting}
                            onClick={() => approve(submission)}
                          >
                            <CheckCircle2 className="size-4" />
                            Approve Timesheet
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="gap-1.5"
                            disabled={approving || rejecting}
                            onClick={() => reject(submission)}
                          >
                            <X className="size-4" />
                            Reject & Send Feedback
                          </Button>
                        </div>
                      </div>
                    )}

                    {submission.status === "rejected" && submission.feedback && (
                      <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 dark:border-rose-800 dark:bg-rose-900/20">
                        <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-rose-500" />
                        <p className="text-xs text-rose-700 dark:text-rose-400">
                          <span className="font-semibold">Feedback sent:</span>{" "}
                          {submission.feedback}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
