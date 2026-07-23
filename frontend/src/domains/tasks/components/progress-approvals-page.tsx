"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import type { ColumnDef } from "@tanstack/react-table";
import {
  CheckCircle2,
  ExternalLink,
  LayoutGrid,
  Loader2,
  MoreHorizontal,
  RotateCcw,
  Table2,
  XCircle,
} from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/domains/auth";
import {
  TaskDetailPanel,
  useGetPendingProgressReviewsQuery,
  useReviewTaskProgressUpdateMutation,
  type TaskProgressUpdate,
} from "@/domains/projects";
import { TASKS_POLLING_INTERVAL_MS } from "@/domains/projects/constants/tasks-polling";
import { DataTable } from "@/shared/components/data-table";
import { DataTableColumnHeader } from "@/shared/components/data-table-column-header";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "@/shared/utils/cn";

type ViewMode = "table" | "cards";
type ReviewDecision = "reject" | "rework";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function formatHours(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${Number(value)}h`;
}

function HoursCell({
  value,
  emphasize,
}: {
  value: number | null | undefined;
  emphasize?: "over" | "under" | null;
}) {
  if (value == null) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  return (
    <span
      className={cn(
        "text-sm tabular-nums whitespace-nowrap",
        emphasize === "over" && "font-medium text-amber-700 dark:text-amber-300",
        emphasize === "under" && "font-medium text-emerald-700 dark:text-emerald-300",
        !emphasize && "text-foreground",
      )}
    >
      {emphasize === "over" && value > 0 ? "+" : ""}
      {formatHours(value)}
    </span>
  );
}

export function ProgressApprovalsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [reviewTarget, setReviewTarget] = useState<{
    update: TaskProgressUpdate;
    decision: ReviewDecision;
  } | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const page = pageIndex + 1;

  const { data, isLoading, isFetching, refetch } = useGetPendingProgressReviewsQuery(
    { page, limit: pageSize },
    { pollingInterval: TASKS_POLLING_INTERVAL_MS },
  );
  const [reviewProgress, { isLoading: isReviewing }] =
    useReviewTaskProgressUpdateMutation();

  const pending = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const totalPages = Math.max(1, data?.meta.totalPages ?? 1);
  const previousTotalRef = useRef<number | null>(null);

  useEffect(() => {
    if (previousTotalRef.current === null) {
      previousTotalRef.current = total;
      return;
    }
    if (total > previousTotalRef.current) {
      const added = total - previousTotalRef.current;
      toast.success(
        `${added} new progress submission${added === 1 ? "" : "s"} awaiting review`,
      );
    }
    previousTotalRef.current = total;
  }, [total]);

  const scopeHint = useMemo(() => {
    const code = user?.backendRoleCode;
    if (code === "super_admin" || code === "pmo_lead") {
      return "Showing pending progress across all projects in your scope.";
    }
    if (code === "pm") {
      return "Showing pending progress for projects where you are Primary or Secondary PM.";
    }
    return "Showing pending progress for projects you are allowed to approve.";
  }, [user?.backendRoleCode]);

  useEffect(() => {
    setReviewTarget(null);
    setReviewReason("");
  }, [pageIndex, pageSize, viewMode]);

  useEffect(() => {
    if (pageIndex > 0 && pageIndex >= totalPages) {
      setPageIndex(Math.max(0, totalPages - 1));
    }
  }, [pageIndex, totalPages]);

  async function handleApprove(update: TaskProgressUpdate) {
    try {
      await reviewProgress({
        taskId: update.taskId,
        updateId: update.id,
        decision: "approve",
      }).unwrap();
      toast.success(
        `Approved ${update.progressPercent}% on "${update.task?.title ?? "task"}".`,
      );
      refetch();
    } catch (err: unknown) {
      const apiError = err as { data?: { message?: string; errors?: Record<string, string> } };
      toast.error(
        apiError?.data?.errors
          ? Object.values(apiError.data.errors)[0]
          : (apiError?.data?.message ?? "Failed to approve progress"),
      );
    }
  }

  async function handleDecisionConfirm() {
    if (!reviewTarget) return;
    if (!reviewReason.trim()) {
      toast.error("Please provide a reason.");
      return;
    }

    try {
      await reviewProgress({
        taskId: reviewTarget.update.taskId,
        updateId: reviewTarget.update.id,
        decision: reviewTarget.decision,
        reviewReason: reviewReason.trim(),
      }).unwrap();
      toast.success(
        reviewTarget.decision === "reject" ? "Progress rejected" : "Rework requested",
      );
      setReviewTarget(null);
      setReviewReason("");
      refetch();
    } catch (err: unknown) {
      const apiError = err as { data?: { message?: string; errors?: Record<string, string> } };
      toast.error(
        apiError?.data?.errors
          ? Object.values(apiError.data.errors)[0]
          : (apiError?.data?.message ?? "Failed to submit review"),
      );
    }
  }

  function openTask(update: TaskProgressUpdate) {
    const projectId = update.task?.projectId ?? update.task?.project?.id;
    if (!projectId) {
      toast.error("Project not found for this task.");
      return;
    }
    setSelectedProjectId(projectId);
    setSelectedTaskId(update.taskId);
  }

  function RowActions({ update }: { update: TaskProgressUpdate }) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Actions"
              onClick={(e) => e.stopPropagation()}
            />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            className="cursor-pointer gap-2"
            disabled={isReviewing || isFetching}
            onClick={() => void handleApprove(update)}
          >
            <CheckCircle2 className="size-3.5" />
            Approve
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer gap-2"
            onClick={() => openTask(update)}
          >
            <ExternalLink className="size-3.5" />
            Open task
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer gap-2"
            onClick={() => {
              setReviewTarget({ update, decision: "rework" });
              setReviewReason("");
            }}
          >
            <RotateCcw className="size-3.5" />
            Request rework
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer gap-2 text-rose-600 focus:text-rose-600"
            onClick={() => {
              setReviewTarget({ update, decision: "reject" });
              setReviewReason("");
            }}
          >
            <XCircle className="size-3.5" />
            Reject
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const columns = useMemo((): ColumnDef<TaskProgressUpdate>[] => {
    return [
      {
        id: "submitted",
        accessorKey: "createdAt",
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Submitted" />
        ),
        cell: ({ row }) => (
          <time
            dateTime={row.original.createdAt}
            className="block truncate text-sm text-muted-foreground tabular-nums"
          >
            {new Date(row.original.createdAt).toLocaleString()}
          </time>
        ),
        meta: { className: "w-[160px]" },
      },
      {
        id: "project",
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Project" />
        ),
        cell: ({ row }) => {
          const update = row.original;
          const projectName = update.task?.project?.name ?? "Unknown project";
          const projectId = update.task?.projectId ?? update.task?.project?.id;
          return (
            <button
              type="button"
              className="block w-full truncate text-left text-sm font-medium text-foreground transition-colors hover:text-primary disabled:opacity-50"
              onClick={(e) => {
                e.stopPropagation();
                if (projectId) router.push(`/dashboard/projects/${projectId}`);
              }}
              disabled={!projectId}
              title={projectName}
            >
              {projectName}
            </button>
          );
        },
        meta: { className: "w-[14%] max-w-0" },
      },
      {
        id: "task",
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Task" />
        ),
        cell: ({ row }) => (
          <p className="truncate text-sm font-medium" title={row.original.task?.title}>
            {row.original.task?.title ?? "Task"}
          </p>
        ),
        meta: { className: "w-[16%] max-w-0" },
      },
      {
        id: "status",
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: () => (
          <Badge
            variant="outline"
            className="h-5 border-amber-500/30 bg-amber-500/10 px-1.5 text-[10px] text-amber-800 dark:text-amber-300"
          >
            Pending
          </Badge>
        ),
        meta: { className: "w-[88px]" },
      },
      {
        id: "engineer",
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Engineer" />
        ),
        cell: ({ row }) => {
          const name = row.original.engineer.displayName;
          return (
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {name.charAt(0).toUpperCase()}
              </div>
              <p className="min-w-0 truncate text-sm font-medium leading-tight" title={name}>
                {name}
              </p>
            </div>
          );
        },
        meta: { className: "w-[168px] max-w-[168px] overflow-hidden" },
      },
      {
        id: "progress",
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Progress" />
        ),
        cell: ({ row }) => (
          <span className="text-sm font-medium tabular-nums whitespace-nowrap">
            {row.original.progressPercent}%
          </span>
        ),
        meta: { className: "w-[88px]" },
      },
      {
        id: "hoursSpent",
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Hours" />
        ),
        cell: ({ row }) => <HoursCell value={row.original.hoursSpent} />,
        meta: { className: "w-[72px]" },
      },
      {
        id: "planned",
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Planned" />
        ),
        cell: ({ row }) => (
          <HoursCell
            value={
              row.original.task?.effortHours != null
                ? Number(row.original.task.effortHours)
                : null
            }
          />
        ),
        meta: { className: "w-[80px]" },
      },
      {
        id: "logged",
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Logged" />
        ),
        cell: ({ row }) => {
          const logged = row.original.task?.actualHoursLogged;
          const over = Boolean(row.original.task?.isOverEffort);
          return (
            <HoursCell
              value={logged != null ? logged : null}
              emphasize={over ? "over" : null}
            />
          );
        },
        meta: { className: "w-[80px]" },
      },
      {
        id: "variance",
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Variance" />
        ),
        cell: ({ row }) => {
          const variance = row.original.task?.effortVarianceHours;
          const over = Boolean(row.original.task?.isOverEffort);
          if (variance == null) {
            return <span className="text-sm text-muted-foreground">—</span>;
          }
          return (
            <HoursCell
              value={variance}
              emphasize={over ? "over" : variance < 0 ? "under" : null}
            />
          );
        },
        meta: { className: "w-[88px]" },
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div
            className="flex items-center justify-end"
            onClick={(e) => e.stopPropagation()}
          >
            <RowActions update={row.original} />
          </div>
        ),
        meta: { sticky: "right", className: "w-12" },
      },
    ];
  }, [isFetching, isReviewing, router]);

  const viewToggle = (
    <div className="inline-flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
      <Button
        type="button"
        size="icon"
        variant={viewMode === "table" ? "secondary" : "ghost"}
        className="size-8"
        onClick={() => setViewMode("table")}
        aria-label="Table view"
        title="Table view"
        aria-pressed={viewMode === "table"}
      >
        <Table2 className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={viewMode === "cards" ? "secondary" : "ghost"}
        className="size-8"
        onClick={() => setViewMode("cards")}
        aria-label="Cards view"
        title="Cards view"
        aria-pressed={viewMode === "cards"}
      >
        <LayoutGrid className="size-4" />
      </Button>
    </div>
  );

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="Progress Approvals"
        description={
          isFetching && !isLoading ? `${scopeHint} Refreshing…` : scopeHint
        }
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {total} pending
            </Badge>
            {viewToggle}
          </div>
        }
      />

      {viewMode === "table" ? (
        <DataTable
          columns={columns}
          data={pending}
          getRowId={(row) => row.id}
          manual
          hideSearch
          isLoading={isLoading}
          pageCount={totalPages}
          totalRows={total}
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPageChange={setPageIndex}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPageIndex(0);
          }}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No pending progress reviews"
          minTableWidth="min-w-[1280px]"
        />
      ) : isLoading ? (
        <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading progress review queue…
        </div>
      ) : pending.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
          <CheckCircle2 className="mx-auto size-8 text-emerald-500" />
          <p className="mt-3 text-sm font-medium">No pending progress reviews</p>
          <p className="mt-1 text-xs text-muted-foreground">
            When engineers submit progress, items will appear here for Approve / Reject /
            Rework.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-3">
            {pending.map((update) => {
              const projectName = update.task?.project?.name ?? "Unknown project";
              const projectId = update.task?.projectId ?? update.task?.project?.id;
              const planned =
                update.task?.effortHours != null
                  ? Number(update.task.effortHours)
                  : null;
              const logged = update.task?.actualHoursLogged ?? null;
              const variance = update.task?.effortVarianceHours ?? null;
              const over = Boolean(update.task?.isOverEffort);

              return (
                <div
                  key={update.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-xs"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="text-sm font-medium text-foreground transition-colors hover:text-primary disabled:opacity-50"
                          onClick={() => {
                            if (projectId) {
                              router.push(`/dashboard/projects/${projectId}`);
                            }
                          }}
                          disabled={!projectId}
                        >
                          {projectName}
                        </button>
                        <Badge
                          variant="outline"
                          className="h-5 border-amber-500/30 bg-amber-500/10 px-1.5 text-[10px] text-amber-800 dark:text-amber-300"
                        >
                          Pending
                        </Badge>
                      </div>
                      <p className="truncate text-sm font-semibold">
                        {update.task?.title ?? "Task"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {update.engineer.displayName} · {update.progressPercent}% ·{" "}
                        {formatHours(update.hoursSpent)} this submission ·{" "}
                        {new Date(update.createdAt).toLocaleString()}
                      </p>
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span>
                          Planned{" "}
                          <span className="font-medium text-foreground">
                            {formatHours(planned)}
                          </span>
                        </span>
                        <span>
                          Logged{" "}
                          <span
                            className={cn(
                              "font-medium",
                              over
                                ? "text-amber-700 dark:text-amber-300"
                                : "text-foreground",
                            )}
                          >
                            {formatHours(logged)}
                          </span>
                        </span>
                        <span>
                          Variance{" "}
                          <span
                            className={cn(
                              "font-medium",
                              over
                                ? "text-amber-700 dark:text-amber-300"
                                : variance != null && variance < 0
                                  ? "text-emerald-700 dark:text-emerald-300"
                                  : "text-foreground",
                            )}
                          >
                            {variance == null
                              ? "—"
                              : `${variance > 0 ? "+" : ""}${formatHours(variance)}`}
                          </span>
                        </span>
                      </div>
                      {planned != null &&
                        planned > 0 &&
                        update.hoursSpent > planned && (
                          <p className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                            This submission alone ({formatHours(update.hoursSpent)}) exceeds
                            planned effort ({formatHours(planned)}).
                          </p>
                        )}
                      {update.comment && (
                        <p className="text-xs text-foreground/80 line-clamp-3">
                          {update.comment}
                        </p>
                      )}
                    </div>

                    <RowActions update={update} />
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages} · {total} total
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pageIndex <= 0 || isFetching}
                  onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pageIndex >= totalPages - 1 || isFetching}
                  onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <DialogPrimitive.Root
        open={!!reviewTarget}
        onOpenChange={(open) => {
          if (!open) {
            setReviewTarget(null);
            setReviewReason("");
          }
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs" />
          <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background p-5 shadow-xl">
            <DialogPrimitive.Title className="text-sm font-bold">
              {reviewTarget?.decision === "reject" ? "Reject progress" : "Request rework"}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-1 text-xs text-muted-foreground">
              {reviewTarget?.update.task?.title
                ? `Task: ${reviewTarget.update.task.title}`
                : "Provide a reason for the engineer."}
            </DialogPrimitive.Description>
            <Input
              value={reviewReason}
              onChange={(e) => setReviewReason(e.target.value)}
              placeholder="Reason required"
              className="mt-4 h-9 text-xs"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setReviewTarget(null);
                  setReviewReason("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                variant={reviewTarget?.decision === "reject" ? "destructive" : "default"}
                disabled={isReviewing}
                onClick={() => void handleDecisionConfirm()}
              >
                {isReviewing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : reviewTarget?.decision === "reject" ? (
                  "Reject"
                ) : (
                  "Request rework"
                )}
              </Button>
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {selectedTaskId && selectedProjectId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          projectId={selectedProjectId}
          open={!!selectedTaskId}
          onClose={() => {
            setSelectedTaskId(null);
            setSelectedProjectId(null);
          }}
          focusProgressReview
          onUpdated={() => {
            refetch();
          }}
        />
      )}
    </div>
  );
}
