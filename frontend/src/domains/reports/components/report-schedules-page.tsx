"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/ui/button";
import { DeleteDialog } from "@/shared/ui/delete-dialog";
import { cn } from "@/shared/utils/cn";
import {
  useDeleteReportScheduleMutation,
  useGetReportSchedulesQuery,
  useUpdateReportScheduleMutation,
} from "../api/reports.api";
import { describeCronExpression } from "../schemas/report-schedule.schema";
import { CreateReportScheduleModal } from "./create-report-schedule-modal";

export function ReportSchedulesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const { data: schedules = [] } = useGetReportSchedulesQuery();
  const [update, { isLoading: updating }] = useUpdateReportScheduleMutation();
  const [remove, { isLoading: deleting }] = useDeleteReportScheduleMutation();

  const onToggleActive = async (id: string, isActive: boolean) => {
    try {
      await update({ id, body: { isActive } }).unwrap();
      toast.success(isActive ? "Schedule activated" : "Schedule deactivated");
    } catch {
      toast.error("Update failed");
    }
  };

  const onConfirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await remove(deleteConfirm.id).unwrap();
      toast.success("Schedule deleted");
      setDeleteConfirm(null);
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Report Schedules"
        description="Automate weekly and monthly report generation."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 size-4" />
            Create schedule
          </Button>
        }
      />

      <div className="divide-y overflow-hidden rounded-xl border bg-card">
        {schedules.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            No report schedules.
          </p>
        ) : (
          schedules.map((schedule) => {
            const label = `${schedule.reportType} · ${
              schedule.project?.name ??
              (schedule.projectId ? schedule.projectId : "All projects")
            }`;

            return (
              <div
                key={schedule.id}
                className="flex flex-wrap items-center gap-4 p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {describeCronExpression(
                      schedule.cronExpression,
                      schedule.reportType,
                    )}
                    {" · Next: "}
                    {schedule.nextRun
                      ? new Date(schedule.nextRun).toLocaleString()
                      : "pending"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Recipients:{" "}
                    {schedule.recipients
                      ?.map((recipient) => recipient.role?.label)
                      .filter(Boolean)
                      .join(", ") || "Primary PM fallback"}
                  </p>
                </div>

                <div
                  role="radiogroup"
                  aria-label="Schedule status"
                  className="inline-flex rounded-lg border border-border/70 bg-muted/40 p-0.5"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={schedule.isActive}
                    disabled={updating}
                    onClick={() => {
                      if (!schedule.isActive) {
                        void onToggleActive(schedule.id, true);
                      }
                    }}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                      schedule.isActive
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!schedule.isActive}
                    disabled={updating}
                    onClick={() => {
                      if (schedule.isActive) {
                        void onToggleActive(schedule.id, false);
                      }
                    }}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                      !schedule.isActive
                        ? "bg-slate-500 text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Inactive
                  </button>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="text-rose-600 hover:text-rose-700"
                  onClick={() =>
                    setDeleteConfirm({
                      id: schedule.id,
                      label,
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            );
          })
        )}
      </div>

      <CreateReportScheduleModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      <DeleteDialog
        isOpen={Boolean(deleteConfirm)}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => void onConfirmDelete()}
        title="Delete report schedule"
        description={
          deleteConfirm
            ? `Are you sure you want to delete "${deleteConfirm.label}"? Automated generation for this schedule will stop. This cannot be undone.`
            : "Are you sure you want to delete this report schedule?"
        }
        isDeleting={deleting}
      />
    </div>
  );
}
