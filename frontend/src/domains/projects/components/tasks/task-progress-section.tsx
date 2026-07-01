"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import {
  CheckCircle2,
  Clock,
  Loader2,
  Paperclip,
  RotateCcw,
  Send,
  X,
  XCircle,
} from "lucide-react";
import {
  useGetTaskProgressUpdatesQuery,
  useReviewTaskProgressUpdateMutation,
  useSubmitTaskProgressUpdateMutation,
  useUploadFileMutation,
  type Task,
  type TaskProgressUpdate,
  type ProgressEvidenceFile,
} from "@/domains/projects";
import { formatTaskApiError } from "@/domains/projects/utils/task-status-permissions";
import { TASKS_POLLING_INTERVAL_MS } from "@/domains/projects/constants/tasks-polling";
import { useAuth, useAppAbility } from "@/domains/auth";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/utils/cn";
import { SecureFileLink } from "@/shared/components/secure-file-link";

const STATUS_BADGE: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  Approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  Rejected: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  Rework: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
};

interface TaskProgressSectionProps {
  task: Task;
  onUpdated?: () => void;
  focusProgressReview?: boolean;
}

export function TaskProgressSection({
  task,
  onUpdated,
  focusProgressReview = false,
}: TaskProgressSectionProps) {
  const { user } = useAuth();
  const ability = useAppAbility();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const reviewBlockRef = useRef<HTMLDivElement>(null);

  const [progressPercent, setProgressPercent] = useState("");
  const [hoursSpent, setHoursSpent] = useState("");
  const [comment, setComment] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<
    Pick<ProgressEvidenceFile, "storageKey" | "filename">[]
  >([]);
  const [reviewReason, setReviewReason] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const { data: updates = [], isLoading } = useGetTaskProgressUpdatesQuery(task.id, {
    skip: !task.id,
    pollingInterval: TASKS_POLLING_INTERVAL_MS,
  });
  const [submitProgress, { isLoading: isSubmitting }] = useSubmitTaskProgressUpdateMutation();
  const [reviewProgress, { isLoading: isReviewing }] = useReviewTaskProgressUpdateMutation();
  const [uploadFile] = useUploadFileMutation();

  const canApprove = ability?.can("approve", "Task") ?? false;
  const isOwner = user?.id === task.ownerId;
  const approvedPercent = task.progressApproved ?? 0;
  const remainingPercent = Math.max(0, 100 - approvedPercent);
  const hasPartialApproval = approvedPercent > 0 && approvedPercent < 100;
  const canSubmit =
    isOwner &&
    (task.status === "In_Progress" || task.status === "Rework") &&
    !updates.some((row) => row.status === "Pending") &&
    approvedPercent < 100;

  const pendingUpdate = useMemo(
    () => updates.find((row) => row.status === "Pending"),
    [updates],
  );

  const canReviewPendingUpdate =
    canApprove && pendingUpdate != null && pendingUpdate.engineerId !== user?.id;

  useEffect(() => {
    if (!focusProgressReview) return;

    const target =
      canReviewPendingUpdate && pendingUpdate ? reviewBlockRef.current : sectionRef.current;
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.add("ring-2", "ring-amber-500", "ring-offset-2");

    const timer = window.setTimeout(() => {
      target.classList.remove("ring-2", "ring-amber-500", "ring-offset-2");
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [focusProgressReview, pendingUpdate?.id, canReviewPendingUpdate]);

  useEffect(() => {
    setProgressPercent("");
    setHoursSpent("");
    setComment("");
    setEvidenceFiles([]);
    setReviewReason("");
  }, [task.id, task.progressApproved, task.status, pendingUpdate?.id]);

  async function handleEvidenceSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const uploaded = await Promise.all(
        files.map(async (file) => {
          const result = await uploadFile(file).unwrap();
          return {
            storageKey: result.storageKey,
            filename: result.filename,
          };
        }),
      );

      setEvidenceFiles((prev) => {
        const byKey = new Map(prev.map((item) => [item.storageKey, item]));
        for (const file of uploaded) {
          byKey.set(file.storageKey, file);
        }
        return Array.from(byKey.values());
      });

      toast.success(
        uploaded.length === 1
          ? "Evidence file attached"
          : `${uploaded.length} evidence files attached`,
      );
    } catch {
      toast.error("Failed to upload evidence");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeEvidenceFile(storageKey: string) {
    setEvidenceFiles((prev) => prev.filter((file) => file.storageKey !== storageKey));
  }

  async function handleSubmit() {
    const percent = Number(progressPercent);
    const hours = Number(hoursSpent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      toast.error("Enter a valid progress percentage (0–100).");
      return;
    }
    if (percent <= approvedPercent) {
      toast.error(
        `Enter cumulative progress above the approved total (${approvedPercent}%).`,
      );
      return;
    }
    if (!Number.isFinite(hours) || hours < 0) {
      toast.error("Enter valid hours spent.");
      return;
    }

    try {
      await submitProgress({
        taskId: task.id,
        progressPercent: percent,
        hoursSpent: hours,
        comment: comment.trim() || undefined,
        evidenceFiles: evidenceFiles.length > 0 ? evidenceFiles : undefined,
      }).unwrap();
      toast.success(
        hasPartialApproval
          ? "Next progress update submitted for PM review"
          : "Progress submitted for PM review",
      );
      setComment("");
      setHoursSpent("");
      setEvidenceFiles([]);
      onUpdated?.();
    } catch (err: unknown) {
      toast.error(formatTaskApiError(err, "Failed to submit progress"));
    }
  }

  async function handleReview(decision: "approve" | "reject" | "rework") {
    if (!pendingUpdate) return;
    if ((decision === "reject" || decision === "rework") && !reviewReason.trim()) {
      toast.error("Please provide a reason.");
      return;
    }

    try {
      await reviewProgress({
        taskId: task.id,
        updateId: pendingUpdate.id,
        decision,
        reviewReason: reviewReason.trim() || undefined,
      }).unwrap();
      toast.success(
        decision === "approve"
          ? "Progress approved"
          : decision === "reject"
            ? "Progress rejected"
            : "Rework requested",
      );
      setReviewReason("");
      onUpdated?.();
    } catch (err: unknown) {
      toast.error(formatTaskApiError(err, "Failed to review progress"));
    }
  }

  return (
    <div
      ref={sectionRef}
      className="space-y-4 rounded-xl border border-border/60 bg-muted/10 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Progress & review</p>
          <p className="text-[11px] text-muted-foreground">
            Approved progress counts toward KPIs. Pending submissions await PM review.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 text-[10px]">
            Approved {approvedPercent}%
          </Badge>
          {hasPartialApproval && (
            <Badge variant="secondary" className="text-[10px]">
              {remainingPercent}% remaining
            </Badge>
          )}
          {task.progressPending > 0 && (
            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px]">
              Pending {task.progressPending}%
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Official progress (KPI)</span>
          <span className="font-medium text-foreground">{approvedPercent}% / 100%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${approvedPercent}%` }}
          />
        </div>
        {task.progressPending > 0 && (
          <p className="text-[10px] text-amber-700 dark:text-amber-300">
            {task.progressPending}% submitted — awaiting PM review (not counted in KPI yet).
          </p>
        )}
        {hasPartialApproval && task.status === "In_Progress" && isOwner && !pendingUpdate && (
          <p className="text-[10px] text-muted-foreground">
            Continue the remaining work, then submit your next cumulative total (e.g. 100%).
          </p>
        )}
      </div>

      {canSubmit && (
        <div className="space-y-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3">
          <div>
            <p className="text-xs font-semibold text-primary">
              {hasPartialApproval ? "Submit next progress update" : "Submit progress update"}
            </p>
            {hasPartialApproval && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Approved so far: {approvedPercent}%. Enter the new cumulative total (must be
                greater than {approvedPercent}%).
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">
                Cumulative progress %
              </Label>
              <Input
                type="number"
                min={approvedPercent + 1}
                max={100}
                value={progressPercent}
                onChange={(e) => setProgressPercent(e.target.value)}
                placeholder={
                  hasPartialApproval ? `e.g. 100 (${approvedPercent}% approved)` : "e.g. 60"
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Hours spent</Label>
              <Input
                type="number"
                min={0}
                step={0.5}
                value={hoursSpent}
                onChange={(e) => setHoursSpent(e.target.value)}
                placeholder="e.g. 8"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Comment</Label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What was completed? Any blockers?"
              className="flex min-h-[72px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleEvidenceSelected}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Paperclip className="size-3.5" />
              )}
              Attach evidence
            </Button>
            {evidenceFiles.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {evidenceFiles.map((file) => (
                  <span
                    key={file.storageKey}
                    className="inline-flex max-w-[200px] items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-[11px] text-muted-foreground"
                  >
                    <span className="truncate">{file.filename}</span>
                    <button
                      type="button"
                      className="shrink-0 rounded-sm text-muted-foreground transition-colors hover:text-destructive"
                      aria-label={`Remove ${file.filename}`}
                      onClick={() => removeEvidenceFile(file.storageKey)}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <Button
              type="button"
              size="sm"
              className="ml-auto"
              disabled={isSubmitting}
              onClick={() => void handleSubmit()}
            >
              {isSubmitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              Submit for review
            </Button>
          </div>
        </div>
      )}

      {approvedPercent >= 100 && task.status === "Approved" && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-900 dark:text-emerald-100">
          All progress is approved (100%). The PM can mark this task Done when delivery is
          complete.
        </p>
      )}

      {canReviewPendingUpdate && pendingUpdate && (
        <div
          ref={reviewBlockRef}
          className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 transition-shadow"
        >
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
            Pending review from {pendingUpdate.engineer.displayName}
          </p>
          <ProgressUpdateRow update={pendingUpdate} compact />
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">
              Reason (required for reject / rework)
            </Label>
            <textarea
              rows={2}
              value={reviewReason}
              onChange={(e) => setReviewReason(e.target.value)}
              placeholder="Explain your decision…"
              className="flex min-h-[56px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isReviewing}
              onClick={() => void handleReview("approve")}
            >
              <CheckCircle2 className="size-3.5" /> Approve
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isReviewing}
              onClick={() => void handleReview("rework")}
            >
              <RotateCcw className="size-3.5" /> Request rework
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={isReviewing}
              onClick={() => void handleReview("reject")}
            >
              <XCircle className="size-3.5" /> Reject
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold">Submission history</p>
        {isLoading ? (
          <p className="text-[11px] text-muted-foreground">Loading…</p>
        ) : updates.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No progress submissions yet.</p>
        ) : (
          updates.map((update) => <ProgressUpdateRow key={update.id} update={update} />)
        )}
      </div>
    </div>
  );
}

function ProgressUpdateRow({
  update,
  compact = false,
}: {
  update: TaskProgressUpdate;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/40 bg-background/60 p-3",
        compact && "border-none bg-transparent p-0",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge className={cn("text-[10px]", STATUS_BADGE[update.status])}>{update.status}</Badge>
          <span className="text-xs font-semibold">{update.progressPercent}%</span>
          <span className="text-[11px] text-muted-foreground">{update.hoursSpent}h spent</span>
        </div>
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Clock className="size-3" />
          {new Date(update.createdAt).toLocaleString()}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        By {update.engineer.displayName}
        {update.reviewer ? ` · Reviewed by ${update.reviewer.displayName}` : ""}
      </p>
      {update.comment && (
        <p className="mt-2 text-xs text-foreground/90 whitespace-pre-wrap">{update.comment}</p>
      )}
      {update.reviewReason && (
        <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">
          Review note: {update.reviewReason}
        </p>
      )}
      {(() => {
        const files =
          update.evidenceFiles && update.evidenceFiles.length > 0
            ? update.evidenceFiles
            : update.s3EvidenceKey
              ? [{ storageKey: update.s3EvidenceKey, filename: "Evidence file" }]
              : [];

        if (files.length === 0) return null;

        return (
          <div className="mt-2 flex flex-wrap gap-2">
            {files.map((file) => (
              <SecureFileLink
                key={file.storageKey}
                storageKey={file.storageKey}
                filename={file.filename}
                showLabel
                label={files.length === 1 ? "View evidence" : file.filename}
                className="text-[11px]"
              />
            ))}
          </div>
        );
      })()}
    </div>
  );
}

export {
  filterStatusOptionsForRole,
  canMoveTaskToStatus,
  getTaskStatusMoveDeniedMessage,
  formatTaskApiError,
} from "@/domains/projects/utils/task-status-permissions";
