"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  RotateCcw,
  XCircle,
} from "lucide-react";
import {
  useGetPendingProgressReviewsQuery,
  useReviewTaskProgressUpdateMutation,
} from "../../api/tasks.api";
import type { TaskProgressUpdate } from "../../types/tasks.types";
import { TASKS_POLLING_INTERVAL_MS } from "../../constants/tasks-polling";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

const INITIAL_VISIBLE_COUNT = 3;
const LOAD_MORE_BATCH = 3;

type ProgressReviewInboxProps = {
  projectId: string;
  onOpenTask: (taskId: string, options?: { focusProgressReview?: boolean }) => void;
  onReviewed?: () => void;
  defaultExpanded?: boolean;
};

export function ProgressReviewInbox({
  projectId,
  onOpenTask,
  onReviewed,
  defaultExpanded = false,
}: ProgressReviewInboxProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [visibleLimit, setVisibleLimit] = useState(INITIAL_VISIBLE_COUNT);
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);
  const [reviewReason, setReviewReason] = useState("");

  const { data, isLoading, refetch } = useGetPendingProgressReviewsQuery(
    { projectId, limit: visibleLimit },
    { skip: !projectId, pollingInterval: TASKS_POLLING_INTERVAL_MS },
  );
  const [reviewProgress, { isLoading: isReviewing }] = useReviewTaskProgressUpdateMutation();

  const pending = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const hasMore = total > pending.length;

  useEffect(() => {
    setVisibleLimit(INITIAL_VISIBLE_COUNT);
    setExpandedActionId(null);
    setReviewReason("");
  }, [projectId]);

  useEffect(() => {
    if (total === 0) {
      setVisibleLimit(INITIAL_VISIBLE_COUNT);
      return;
    }
    // Auto-expand when there is work to review so PMs see Progress Approvals immediately.
    setExpanded(true);
  }, [total]);

  if (total === 0 && !isLoading) {
    return null;
  }

  async function handleApprove(update: TaskProgressUpdate) {
    try {
      await reviewProgress({
        taskId: update.taskId,
        updateId: update.id,
        decision: "approve",
      }).unwrap();
      toast.success(`Approved ${update.progressPercent}% on "${update.task?.title ?? "task"}".`);
      setExpandedActionId(null);
      setReviewReason("");
      refetch();
      onReviewed?.();
    } catch (err: unknown) {
      const apiError = err as { data?: { message?: string; errors?: Record<string, string> } };
      toast.error(
        apiError?.data?.errors
          ? Object.values(apiError.data.errors)[0]
          : apiError?.data?.message ?? "Failed to approve progress",
      );
    }
  }

  async function handleDecision(
    update: TaskProgressUpdate,
    decision: "reject" | "rework",
  ) {
    if (!reviewReason.trim()) {
      toast.error("Please provide a reason.");
      return;
    }

    try {
      await reviewProgress({
        taskId: update.taskId,
        updateId: update.id,
        decision,
        reviewReason: reviewReason.trim(),
      }).unwrap();
      toast.success(decision === "reject" ? "Progress rejected" : "Rework requested");
      setExpandedActionId(null);
      setReviewReason("");
      refetch();
      onReviewed?.();
    } catch (err: unknown) {
      const apiError = err as { data?: { message?: string; errors?: Record<string, string> } };
      toast.error(
        apiError?.data?.errors
          ? Object.values(apiError.data.errors)[0]
          : apiError?.data?.message ?? "Failed to submit review",
      );
    }
  }

  return (
    <div className="mx-5 mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-xs text-amber-900 dark:text-amber-100"
      >
        <span>
          <strong>{total}</strong> progress submission{total === 1 ? "" : "s"} awaiting review
        </span>
        {expanded ? (
          <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-amber-500/20 px-4 pb-4 pt-3">
          {isLoading ? (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Loading review queue…
            </div>
          ) : (
            pending.map((update) => (
              <div
                key={update.id}
                className="rounded-lg border border-border/60 bg-background/80 p-3 shadow-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-semibold truncate">
                      {update.task?.title ?? "Task"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {update.engineer.displayName} · {update.progressPercent}% ·{" "}
                      {update.hoursSpent}h ·{" "}
                      {new Date(update.createdAt).toLocaleString()}
                    </p>
                    {update.task?.effortHours != null &&
                      Number(update.task.effortHours) > 0 &&
                      update.hoursSpent > Number(update.task.effortHours) && (
                        <p className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                          This submission alone ({update.hoursSpent}h) exceeds planned effort (
                          {Number(update.task.effortHours)}h).
                        </p>
                      )}
                    {update.comment && (
                      <p className="text-xs text-foreground/80 line-clamp-2">{update.comment}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={isReviewing}
                      onClick={() => void handleApprove(update)}
                    >
                      {isReviewing ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-3.5" />
                      )}
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        onOpenTask(update.taskId, { focusProgressReview: true })
                      }
                    >
                      <ExternalLink className="size-3.5" />
                      Open
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setExpandedActionId(
                          expandedActionId === update.id ? null : update.id,
                        );
                        setReviewReason("");
                      }}
                    >
                      More
                    </Button>
                  </div>
                </div>

                {expandedActionId === update.id && (
                  <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
                    <Input
                      value={reviewReason}
                      onChange={(e) => setReviewReason(e.target.value)}
                      placeholder="Reason required for reject or rework"
                      className="h-9 text-xs"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isReviewing}
                        onClick={() => void handleDecision(update, "rework")}
                      >
                        <RotateCcw className="size-3.5" />
                        Request rework
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={isReviewing}
                        onClick={() => void handleDecision(update, "reject")}
                      >
                        <XCircle className="size-3.5" />
                        Reject
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}

          {!isLoading && hasMore && (
            <div className="flex justify-center pt-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-muted-foreground"
                onClick={() => setVisibleLimit((current) => current + LOAD_MORE_BATCH)}
              >
                Load more ({total - pending.length} remaining)
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
