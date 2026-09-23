"use client";
import { Spinner } from "@/shared/components/spinner";

import { CheckCircle2, Minimize2, X, XCircle } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import type { ImportJobStatus } from "@/domains/projects/api/imports.api";
import type { TrackedImportKind } from "./import-progress-provider";

type ImportProgressCardProps = {
  label: string;
  kind: TrackedImportKind;
  status: ImportJobStatus | null;
  minimized: boolean;
  onMinimize: () => void;
  onExpand: () => void;
  onDismiss: () => void;
};

function formatKind(kind: TrackedImportKind) {
  switch (kind) {
    case "mpp":
      return "MPP";
    case "mpp-portfolio":
      return "MPP portfolio";
    case "excel-tasks":
      return "Excel tasks";
    case "excel-projects":
      return "Excel projects";
    default:
      return "Import";
  }
}

export function ImportProgressCard({
  label,
  kind,
  status,
  minimized,
  onMinimize,
  onExpand,
  onDismiss,
}: ImportProgressCardProps) {
  const progress = status?.progress ?? 0;
  const step = status?.step || "Working…";
  const jobStatus = status?.status ?? "waiting";
  const done = jobStatus === "completed";
  const failed = jobStatus === "failed" || jobStatus === "unknown";
  const running = !done && !failed;
  const displayProgress = done ? 100 : progress;

  // Collapsed chip — click to bring the full card back
  if (minimized && running) {
    return (
      <button
        type="button"
        onClick={onExpand}
        className={cn(
          "fixed bottom-4 end-4 z-[60] flex max-w-[min(100vw-2rem,20rem)] items-center gap-2.5 rounded-full",
          "border border-border bg-background px-3.5 py-2.5 shadow-2xl",
          "animate-in fade-in slide-in-from-bottom-2 duration-200",
          "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        )}
        aria-label="Show import progress"
        title="Show import progress"
      >
        <Spinner size="sm" />
        <span className="min-w-0 truncate text-xs font-semibold text-foreground">
          {label}
        </span>
        <span className="shrink-0 text-[11px] font-bold tabular-nums text-primary">
          {displayProgress}%
        </span>
      </button>
    );
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 end-4 z-[60] w-[min(100vw-2rem,22rem)] rounded-2xl border border-border bg-background shadow-2xl",
        "animate-in fade-in slide-in-from-bottom-2 duration-200",
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3 p-3.5">
        <div
          className={cn(
            "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl",
            failed
              ? "bg-rose-500/10 text-rose-600"
              : done
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-primary/10 text-primary",
          )}
        >
          {failed ? (
            <XCircle className="size-4.5" />
          ) : done ? (
            <CheckCircle2 className="size-4.5" />
          ) : (
            <Spinner size="sm" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {label}
              </p>
              <p className="text-[11px] font-medium text-muted-foreground">
                {formatKind(kind)}
                {running
                  ? " · in progress"
                  : done
                    ? " · completed"
                    : " · failed"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              {running ? (
                <button
                  type="button"
                  onClick={onMinimize}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Minimize import progress"
                  title="Minimize"
                >
                  <Minimize2 className="size-3.5" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={running ? "Minimize import progress" : "Dismiss"}
                title={running ? "Minimize" : "Dismiss"}
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          <p
            className={cn(
              "mt-1.5 line-clamp-2 text-xs",
              failed ? "text-rose-600" : "text-muted-foreground",
            )}
          >
            {failed ? status?.failedReason || step : step}
          </p>

          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                failed
                  ? "bg-rose-500"
                  : done
                    ? "bg-emerald-500"
                    : "bg-primary",
              )}
              style={{
                width: `${Math.max(displayProgress, running ? 2 : 0)}%`,
              }}
            />
          </div>
          <p className="mt-1 text-end text-[10px] font-bold tabular-nums text-muted-foreground">
            {displayProgress}%
          </p>
        </div>
      </div>
    </div>
  );
}
