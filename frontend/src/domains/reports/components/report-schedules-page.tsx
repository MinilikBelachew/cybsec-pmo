"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/ui/button";
import { useGetProjectsQuery } from "@/domains/projects";
import { useGetRolesQuery } from "@/domains/roles/api/roles.api";
import {
  useCreateReportScheduleMutation,
  useDeleteReportScheduleMutation,
  useGetReportSchedulesQuery,
  useUpdateReportScheduleMutation,
} from "../api/reports.api";
import type { ReportType } from "../types/reports.types";

export function ReportSchedulesPage() {
  const [cronExpression, setCronExpression] = useState("0 9 * * 1");
  const [reportType, setReportType] = useState<ReportType>("WSR");
  const [projectId, setProjectId] = useState("");
  const [roleIds, setRoleIds] = useState<number[]>([]);
  const { data: schedules = [] } = useGetReportSchedulesQuery();
  const { data: projects } = useGetProjectsQuery({ page: 1, limit: 100 });
  const { data: roles } = useGetRolesQuery({ page: 1, limit: 100 });
  const [create, { isLoading }] = useCreateReportScheduleMutation();
  const [update] = useUpdateReportScheduleMutation();
  const [remove] = useDeleteReportScheduleMutation();
  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Report Schedules"
        description="Automate weekly and monthly report generation."
      />
      <form
        className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-5"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await create({
              cronExpression,
              reportType,
              projectId: projectId || null,
              isActive: true,
              recipients: roleIds.map((roleId) => ({ roleId })),
            }).unwrap();
            toast.success("Schedule created");
          } catch {
            toast.error("Could not create schedule");
          }
        }}
      >
        <select
          value={reportType}
          onChange={(e) => setReportType(e.target.value as ReportType)}
          className="h-10 rounded-lg border bg-background px-3 text-sm"
        >
          <option value="WSR">WSR</option>
          <option value="MSR">MSR</option>
        </select>
        <input
          value={cronExpression}
          onChange={(e) => setCronExpression(e.target.value)}
          placeholder="Cron expression"
          className="h-10 rounded-lg border bg-background px-3 text-sm"
          required
        />
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="h-10 rounded-lg border bg-background px-3 text-sm"
        >
          <option value="">All projects</option>
          {projects?.data.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <select
          multiple
          value={roleIds.map(String)}
          onChange={(e) =>
            setRoleIds(
              Array.from(e.target.selectedOptions, (option) =>
                Number(option.value),
              ),
            )
          }
          className="min-h-10 rounded-lg border bg-background px-3 py-2 text-sm"
          aria-label="Recipient roles"
        >
          {roles?.data.map((role) => (
            <option key={role.id} value={role.id}>
              {role.label}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={isLoading}>
          <Plus className="mr-1 size-4" />
          Create schedule
        </Button>
      </form>
      <div className="divide-y overflow-hidden rounded-xl border bg-card">
        {schedules.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            No report schedules.
          </p>
        ) : (
          schedules.map((schedule) => (
            <div
              key={schedule.id}
              className="flex flex-wrap items-center gap-4 p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {schedule.reportType} ·{" "}
                  {schedule.project?.name ??
                    (schedule.projectId ? schedule.projectId : "All projects")}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {schedule.cronExpression} · Next:{" "}
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
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={schedule.isActive}
                  onChange={async (e) => {
                    try {
                      await update({
                        id: schedule.id,
                        body: { isActive: e.target.checked },
                      }).unwrap();
                      toast.success("Schedule updated");
                    } catch {
                      toast.error("Update failed");
                    }
                  }}
                />
                Active
              </label>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await remove(schedule.id).unwrap();
                    toast.success("Schedule deleted");
                  } catch {
                    toast.error("Delete failed");
                  }
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
