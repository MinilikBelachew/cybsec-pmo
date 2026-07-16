"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/ui/button";
import { DeleteDialog } from "@/shared/ui/delete-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { cn } from "@/shared/utils/cn";
import { getApiErrorMessage } from "@/core/errors/api-error";
import {
  useCreateTimesheetEntryMutation,
  useDeleteTimesheetEntryMutation,
  useGetTimesheetContextQuery,
  useGetTimesheetWeekQuery,
  useResubmitTimesheetWeekMutation,
  useSubmitTimesheetWeekMutation,
  useUpdateTimesheetEntryMutation,
} from "../api/resources.api";
import type {
  TimesheetContextProject,
  TimesheetEntryStatus,
  TimesheetWeekEntry,
} from "../types/resources.types";
import { TIMESHEET_STATUS_CONFIG } from "../utils/resource-ui.config";
import {
  getTodayDateKey,
  parseHoursInput,
  sanitizeHoursInput,
  validateEntryHours,
  hasEntryHoursErrors,
} from "../utils/timesheet-error.utils";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-rose-600 dark:text-rose-400">{message}</p>;
}

function toUiStatus(status: string): TimesheetEntryStatus {
  return status.toLowerCase() as TimesheetEntryStatus;
}

function shiftWeekStart(weekStart: string, weeks: number) {
  const date = new Date(`${weekStart}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return date.toISOString().slice(0, 10);
}

export function LogHoursPage() {
  const searchParams = useSearchParams();
  const initialWeekStart = searchParams.get("weekStart") ?? undefined;
  const [weekStart, setWeekStart] = useState<string | undefined>(initialWeekStart);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    label: string;
  } | null>(null);

  const today = getTodayDateKey();

  const { data: context, isLoading: contextLoading } = useGetTimesheetContextQuery(
    activeDate ? { asOf: activeDate } : undefined,
  );
  const {
    data: week,
    isLoading: weekLoading,
    isFetching,
    error: weekError,
  } = useGetTimesheetWeekQuery(weekStart ? { weekStart } : undefined);

  const [createEntry, { isLoading: creating }] = useCreateTimesheetEntryMutation();
  const [deleteEntry] = useDeleteTimesheetEntryMutation();
  const [updateEntry, { isLoading: updating }] = useUpdateTimesheetEntryMutation();
  const [submitWeek, { isLoading: submitting }] = useSubmitTimesheetWeekMutation();
  const [resubmitWeek, { isLoading: resubmitting }] = useResubmitTimesheetWeekMutation();

  useEffect(() => {
    if (initialWeekStart) {
      setWeekStart(initialWeekStart);
    }
  }, [initialWeekStart]);

  useEffect(() => {
    if (week?.weekStart && weekStart === undefined) {
      setWeekStart(week.weekStart);
    }
  }, [week?.weekStart, weekStart]);

  useEffect(() => {
    if (!week?.days.length) return;

    const selectableDays = week.days.filter((day) => day.date <= today);
    if (!selectableDays.length) {
      setActiveDate(week.days[0].date);
      return;
    }

    if (
      !activeDate ||
      !week.days.some((day) => day.date === activeDate) ||
      activeDate > today
    ) {
      const todayInWeek = selectableDays.find((day) => day.date === today);
      setActiveDate(todayInWeek?.date ?? selectableDays[selectableDays.length - 1].date);
    }
  }, [week?.days, activeDate, today]);

  useEffect(() => {
    if (activeDate && activeDate > today && showForm) {
      setShowForm(false);
    }
  }, [activeDate, today, showForm]);

  const dayEntries = useMemo(
    () => week?.entries.filter((entry) => entry.workDate === activeDate) ?? [],
    [week?.entries, activeDate],
  );

  const activeDay = week?.days.find((day) => day.date === activeDate);
  const isFutureDate = Boolean(activeDate && activeDate > today);
  const dayHours = activeDay?.totalHours ?? 0;
  const overThreshold = activeDay?.isOverThreshold ?? false;
  const draftCount =
    week?.entries.filter((entry) => toUiStatus(entry.status) === "draft").length ?? 0;

  const rejectedEntries = useMemo(
    () =>
      week?.entries.filter((entry) => toUiStatus(entry.status) === "rejected") ?? [],
    [week?.entries],
  );

  const rejectedCount = rejectedEntries.length;

  async function handleDelete(id: string) {
    try {
      await deleteEntry(id).unwrap();
      toast.success("Entry deleted.");
      setDeleteConfirm(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not delete entry."));
    }
  }

  async function handleSubmitWeek() {
    if (!week?.weekStart) return;
    try {
      const result = await submitWeek({ weekStart: week.weekStart }).unwrap();
      toast.success(`Submitted ${result.submittedCount} entries for approval.`);
    } catch {
      toast.error("Could not submit week.");
    }
  }

  async function handleResubmitWeek() {
    if (!week?.weekStart) return;
    try {
      const result = await resubmitWeek({ weekStart: week.weekStart }).unwrap();
      toast.success(`Resubmitted ${result.submittedCount} entries for approval.`);
    } catch {
      toast.error("Could not resubmit week.");
    }
  }

  const loading = contextLoading || weekLoading;

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" />
        Loading timesheet...
      </div>
    );
  }

  if (weekError || !week) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center text-muted-foreground">
        Could not load timesheet data.
      </div>
    );
  }

  if (!context?.projects.length) {
    return (
      <div className="mx-auto max-w-lg space-y-2 py-16 text-center text-muted-foreground">
        <p className="font-medium text-foreground">No active project allocations</p>
        <p className="text-sm">
          You need an active project allocation before you can log hours.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Log Hours"
        description={`Week of ${week.weekLabel} · ${week.totalHours.toFixed(1)}h logged${
          (week.overtimeHours ?? 0) > 0 ? ` · ${week.overtimeHours.toFixed(1)}h OT` : ""
        }`}
        actions={
          <div className="flex items-center gap-2">
            {rejectedCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400"
                onClick={handleResubmitWeek}
                disabled={resubmitting || isFetching}
              >
                <RefreshCw className={cn("size-3.5", resubmitting && "animate-spin")} />
                Resubmit Week ({rejectedCount})
              </Button>
            )}
            {draftCount > 0 && (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={handleSubmitWeek}
                disabled={submitting || isFetching}
              >
                <Send className="size-3.5" />
                Submit Week ({draftCount})
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {week.recentWeeks.map((summary) => {
          const statusKey =
            summary.status === "mixed" ? "submitted" : summary.status;
          const status = TIMESHEET_STATUS_CONFIG[statusKey];
          const StatusIcon = status.icon;
          const isCurrent = summary.weekStart === week.weekStart;

          return (
            <div
              key={summary.weekStart}
              className={cn(
                "rounded-xl border p-4",
                isCurrent
                  ? "border-primary/30 bg-primary/5"
                  : "border-border/50 bg-card",
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  {summary.weekLabel}
                </p>
                <div className="flex items-center gap-1.5">
                  {isCurrent && (
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                      Current
                    </span>
                  )}
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold",
                      status.bg,
                      status.text,
                      status.border,
                    )}
                  >
                    <StatusIcon className="size-3" />
                    {summary.status === "mixed" ? "In progress" : status.label}
                  </span>
                </div>
              </div>
              <p className="text-xl font-bold">
                {summary.totalHours.toFixed(1)}h{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  / {summary.billableHours.toFixed(1)}h billable
                  {(summary.overtimeHours ?? 0) > 0
                    ? ` · ${summary.overtimeHours.toFixed(1)}h OT`
                    : ""}
                </span>
              </p>
              {summary.approvedBy && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Approved by {summary.approvedBy}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-2.5">
          <div className="flex items-center rounded-lg border border-border/60">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setWeekStart(shiftWeekStart(week.weekStart, -1))}
              aria-label="Previous week"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-[9rem] px-2 text-center text-sm font-semibold text-foreground">
              {week.weekLabel}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setWeekStart(shiftWeekStart(week.weekStart, 1))}
              aria-label="Next week"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {week.totalHours.toFixed(1)}h this week
          </p>
        </div>

        <div className="flex border-b border-border/50">
          {week.days.map((day) => {
            const isActive = day.date === activeDate;
            const isFutureDay = day.date > today;
            const [weekday, ...rest] = day.label.split(" ");

            return (
              <button
                key={day.date}
                type="button"
                disabled={isFutureDay}
                onClick={() => {
                  if (isFutureDay) return;
                  setActiveDate(day.date);
                  setShowForm(false);
                }}
                className={cn(
                  "-mb-px flex flex-1 flex-col items-center border-b-2 px-2 py-3 text-sm transition-colors",
                  isFutureDay && "cursor-not-allowed opacity-40",
                  isActive
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-transparent text-muted-foreground hover:bg-muted/20 hover:text-foreground",
                )}
              >
                <span className="text-[11px] font-semibold">{weekday}</span>
                <span className="text-xs">{rest.join(" ")}</span>
                {day.totalHours > 0 && (
                  <span
                    className={cn(
                      "mt-0.5 text-[10px] font-bold",
                      isActive ? "text-primary" : "text-muted-foreground",
                      day.isOverThreshold && "text-rose-500",
                    )}
                  >
                    {day.totalHours.toFixed(1)}h
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold">{activeDay?.label}</p>
              <p
                className={cn(
                  "mt-0.5 text-xs",
                  overThreshold ? "font-semibold text-rose-500" : "text-muted-foreground",
                )}
              >
                {dayHours.toFixed(1)}h logged
                {overThreshold && " — exceeds 10h threshold"}
              </p>
            </div>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={isFutureDate}
              onClick={() => setShowForm(!showForm)}
            >
              <Plus className="size-3.5" />
              Add Entry
            </Button>
          </div>

          {isFutureDate && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              <AlertCircle className="size-3.5 shrink-0" />
              Hours can only be logged for today or past dates.
            </div>
          )}

          {overThreshold && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400">
              <AlertCircle className="size-3.5 shrink-0" />
              Logged hours exceed the daily threshold. This entry will require manual approval.
            </div>
          )}

          {showForm && activeDate && !isFutureDate && (
            <AddEntryForm
              date={activeDate}
              projects={context.projects}
              dailyThreshold={context.dailyThresholdHours}
              saving={creating}
              onAdd={async (payload) => {
                try {
                  await createEntry(payload).unwrap();
                  setShowForm(false);
                  toast.success("Entry added.");
                } catch (error) {
                  toast.error(getApiErrorMessage(error));
                }
              }}
              onCancel={() => setShowForm(false)}
            />
          )}

          {dayEntries.length === 0 && !showForm ? (
            <div className="flex flex-col items-center justify-center space-y-2 py-10 text-center">
              <Clock className="size-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No hours logged for this day</p>
              <Button
                variant="link"
                size="sm"
                disabled={isFutureDate}
                onClick={() => setShowForm(true)}
              >
                + Add entry
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {dayEntries.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  saving={updating}
                  onDelete={() =>
                    setDeleteConfirm({
                      id: entry.id,
                      label: `${entry.projectName} — ${entry.taskName}`,
                    })
                  }
                  onSave={async (payload) => {
                    try {
                      await updateEntry({ id: entry.id, ...payload }).unwrap();
                      toast.success(
                        toUiStatus(entry.status) === "rejected"
                          ? "Entry updated and moved to draft."
                          : "Entry updated.",
                      );
                    } catch (error) {
                      toast.error(getApiErrorMessage(error, "Could not update entry."));
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {rejectedEntries.length > 0 && (
        <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-800 dark:bg-rose-900/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-rose-700 dark:text-rose-400">
              Entries requiring resubmission
            </p>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleResubmitWeek}
              disabled={resubmitting || isFetching}
            >
              <RefreshCw className={cn("size-3.5", resubmitting && "animate-spin")} />
              Resubmit all ({rejectedCount})
            </Button>
          </div>
          <p className="text-xs text-rose-700/80 dark:text-rose-400/80">
            Edit entries below to address feedback, or resubmit as-is with one click.
          </p>
          {rejectedEntries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-3 text-xs text-rose-700 dark:text-rose-400"
            >
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              <div>
                <span className="font-semibold">
                  {entry.projectName} — {entry.taskName}
                </span>
                {entry.feedback && (
                  <span className="text-muted-foreground"> · {entry.feedback}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <DeleteDialog
        isOpen={deleteConfirm != null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm) {
            void handleDelete(deleteConfirm.id);
          }
        }}
        title="Delete timesheet entry"
        description={
          deleteConfirm
            ? `Remove the log for ${deleteConfirm.label}? This cannot be undone.`
            : ""
        }
      />
    </div>
  );
}

function EntryRow({
  entry,
  saving,
  onDelete,
  onSave,
}: {
  entry: TimesheetWeekEntry;
  saving: boolean;
  onDelete: () => void;
  onSave: (payload: {
    regularHours?: number;
    overtimeHours?: number;
    notes?: string;
    isBillable?: boolean;
  }) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [regularHours, setRegularHours] = useState(
    String(entry.regularHours ?? entry.hours),
  );
  const [overtimeHours, setOvertimeHours] = useState(
    String(entry.overtimeHours ?? 0),
  );
  const [isBillable, setIsBillable] = useState(entry.isBillable);
  const [notes, setNotes] = useState(entry.notes ?? "");
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const status = TIMESHEET_STATUS_CONFIG[toUiStatus(entry.status)];
  const StatusIcon = status.icon;
  const canEdit =
    toUiStatus(entry.status) === "draft" || toUiStatus(entry.status) === "rejected";
  const hourErrors = validateEntryHours(regularHours, overtimeHours);
  const parsedRegular = parseHoursInput(regularHours) ?? 0;
  const parsedOt = parseHoursInput(overtimeHours) ?? 0;
  const canSave = !hasEntryHoursErrors(hourErrors);

  const inputClass =
    "h-9 w-full rounded-xl border border-border/60 bg-background px-3 text-sm outline-none transition-all focus:ring-1 focus:ring-primary/30";

  if (editing) {
    return (
      <form
        className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setSubmitAttempted(true);
          if (!canSave || saving) return;
          await onSave({
            regularHours: parsedRegular,
            overtimeHours: parsedOt,
            isBillable,
            notes: notes.trim() || undefined,
          });
          setEditing(false);
          setSubmitAttempted(false);
        }}
      >
        <p className="text-xs font-bold uppercase tracking-wider text-primary">
          Edit Entry · {entry.projectName} — {entry.taskName}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Regular hours
            </label>
            <input
              type="number"
              min="0"
              max="24"
              step="0.25"
              value={regularHours}
              onChange={(e) => setRegularHours(sanitizeHoursInput(e.target.value))}
              className={inputClass}
            />
            {submitAttempted && <FieldError message={hourErrors.regular} />}
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Overtime
            </label>
            <input
              type="number"
              min="0"
              max="24"
              step="0.25"
              value={overtimeHours}
              onChange={(e) => setOvertimeHours(sanitizeHoursInput(e.target.value))}
              className={inputClass}
            />
            {submitAttempted && <FieldError message={hourErrors.overtime} />}
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Billing
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsBillable(true)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                  isBillable
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "border-border/60 text-muted-foreground hover:text-foreground",
                )}
              >
                Billable
              </button>
              <button
                type="button"
                onClick={() => setIsBillable(false)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                  !isBillable
                    ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                    : "border-border/60 text-muted-foreground hover:text-foreground",
                )}
              >
                Non-billable
              </button>
            </div>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={cn(inputClass, "h-auto resize-none py-2")}
            />
          </div>
        </div>
        {entry.feedback && (
          <p className="text-xs text-rose-600 dark:text-rose-400">
            PM feedback: {entry.feedback}
          </p>
        )}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setEditing(false);
              setSubmitAttempted(false);
            }}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={!canSave || saving}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : "Save changes"}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div
      className={cn(
        "flex items-start gap-4 rounded-xl border p-4 transition-colors",
        toUiStatus(entry.status) === "rejected"
          ? "border-rose-200 bg-rose-50/50 dark:border-rose-800 dark:bg-rose-900/10"
          : "border-border/50 bg-muted/20 hover:bg-muted/40",
      )}
    >
      <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl border border-border/60 bg-card">
        <span className="text-base font-bold leading-none">{entry.hours}</span>
        <span className="text-[9px] text-muted-foreground">hrs</span>
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{entry.taskName}</span>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {entry.projectName}
          </span>
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
              entry.isBillable
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
            )}
          >
            {entry.isBillable ? "Billable" : "Non-billable"}
          </span>
          {(entry.overtimeHours ?? 0) > 0 ? (
            <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
              {entry.regularHours ?? 0}h + {entry.overtimeHours}h OT
            </span>
          ) : null}
        </div>
        {entry.notes && (
          <p className="text-xs text-muted-foreground">{entry.notes}</p>
        )}
        {entry.feedback && (
          <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
            Feedback: {entry.feedback}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold",
            status.bg,
            status.text,
            status.border,
          )}
        >
          <StatusIcon className="size-3" />
          {status.label}
        </span>
        {canEdit && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-primary"
              onClick={() => {
                setRegularHours(String(entry.regularHours ?? entry.hours));
                setOvertimeHours(String(entry.overtimeHours ?? 0));
                setIsBillable(entry.isBillable);
                setNotes(entry.notes ?? "");
                setEditing(true);
              }}
              aria-label="Edit entry"
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
              aria-label="Delete entry"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function AddEntryForm({
  date,
  projects,
  dailyThreshold,
  saving,
  onAdd,
  onCancel,
}: {
  date: string;
  projects: TimesheetContextProject[];
  dailyThreshold: number;
  saving: boolean;
  onAdd: (payload: {
    projectId: string;
    taskId: string;
    workDate: string;
    regularHours: number;
    overtimeHours: number;
    notes?: string;
    isBillable: boolean;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [regularHours, setRegularHours] = useState("");
  const [overtimeHours, setOvertimeHours] = useState("0");
  const [isBillable, setIsBillable] = useState(true);
  const [notes, setNotes] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const selectedProject = projects.find((item) => item.id === projectId);
  const parsedRegular = parseHoursInput(regularHours) ?? 0;
  const parsedOt = parseHoursInput(overtimeHours) ?? 0;
  const total = parsedRegular + parsedOt;
  const hourErrors = validateEntryHours(regularHours, overtimeHours);
  const projectError = !projectId ? "Select a project." : undefined;
  const taskError = !taskId ? "Select a task." : undefined;
  const canSubmit =
    !projectError && !taskError && !hasEntryHoursErrors(hourErrors);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitAttempted(true);
    if (!canSubmit || saving) return;
    await onAdd({
      projectId,
      taskId,
      workDate: date,
      regularHours: parsedRegular,
      overtimeHours: parsedOt,
      isBillable,
      notes: notes.trim() || undefined,
    });
  }

  const inputClass =
    "h-9 w-full rounded-xl border border-border/60 bg-background px-3 text-sm outline-none transition-all focus:ring-1 focus:ring-primary/30";

  return (
    <form
      className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4"
      onSubmit={(event) => void handleSubmit(event)}
      noValidate
    >
      <p className="text-xs font-bold uppercase tracking-wider text-primary">
        New Entry
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Project
          </label>
          <Select
            value={projectId}
            onValueChange={(value) => {
              setProjectId(value ?? "");
              setTaskId("");
            }}
          >
            <SelectTrigger className={cn("h-9 w-full rounded-xl", inputClass)}>
              <SelectValue placeholder="Select project...">
                {selectedProject?.name ?? "Select project..."}
              </SelectValue>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} className="max-h-64">
              {projects.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {submitAttempted && <FieldError message={projectError} />}
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Task
          </label>
          <Select
            value={taskId}
            onValueChange={(value) => setTaskId(value ?? "")}
            disabled={!selectedProject}
          >
            <SelectTrigger
              className={cn(
                "h-9 w-full rounded-xl",
                inputClass,
                !selectedProject && "cursor-not-allowed opacity-50",
              )}
            >
              <SelectValue placeholder="Select task...">
                {selectedProject?.tasks.find((task) => task.id === taskId)?.title ??
                  "Select task..."}
              </SelectValue>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} className="max-h-64">
              {selectedProject?.tasks.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {submitAttempted && <FieldError message={taskError} />}
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Regular hours
          </label>
          <input
            type="number"
            min="0"
            max="24"
            step="0.25"
            value={regularHours}
            onChange={(e) => setRegularHours(sanitizeHoursInput(e.target.value))}
            placeholder="e.g. 4"
            className={inputClass}
            required
          />
          {submitAttempted && <FieldError message={hourErrors.regular} />}
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Overtime
          </label>
          <input
            type="number"
            min="0"
            max="24"
            step="0.25"
            value={overtimeHours}
            onChange={(e) => setOvertimeHours(sanitizeHoursInput(e.target.value))}
            placeholder="0"
            className={inputClass}
          />
          {submitAttempted && <FieldError message={hourErrors.overtime} />}
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Billing type
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIsBillable(true)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                isBillable
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "border-border/60 text-muted-foreground hover:text-foreground",
              )}
            >
              Billable
            </button>
            <button
              type="button"
              onClick={() => setIsBillable(false)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                !isBillable
                  ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                  : "border-border/60 text-muted-foreground hover:text-foreground",
              )}
            >
              Non-billable
            </button>
          </div>
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Date
          </label>
          <input
            type="date"
            value={date}
            readOnly
            className={cn(inputClass, "cursor-not-allowed opacity-60")}
          />
        </div>
      </div>

      {total > dailyThreshold ? (
        <p className="text-[10px] text-rose-500">
          Total {total}h exceeds the {dailyThreshold}h daily threshold — may require approval
        </p>
      ) : null}

      <div className="space-y-1">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Task Details (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Brief description of work done..."
          rows={2}
          className={cn(inputClass, "h-auto resize-none py-2")}
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" size="sm" className="gap-1.5" disabled={saving}>
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          Add Entry
        </Button>
      </div>
    </form>
  );
}
