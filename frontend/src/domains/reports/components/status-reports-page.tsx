"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Calendar,
  ChevronDown,
  Download,
  FilePlus2,
  Loader2,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/ui/button";
import { DeleteDialog } from "@/shared/ui/delete-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { useGetProjectsQuery } from "@/domains/projects";
import { env } from "@/config/env.config";
import { useAppSelector } from "@/store/hooks";
import {
  useApproveStatusReportMutation,
  useDeleteStatusReportMutation,
  useDistributeStatusReportMutation,
  useGenerateStatusReportMutation,
  useGetStatusReportsQuery,
} from "../api/reports.api";
import type { ReportType } from "../types/reports.types";

const EXPORT_FORMATS = [
  { value: "pdf" as const, label: "PDF" },
  { value: "docx" as const, label: "DOCX" },
  { value: "xlsx" as const, label: "Excel" },
  { value: "csv" as const, label: "CSV" },
];

const EXPORT_MIME: Record<(typeof EXPORT_FORMATS)[number]["value"], string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv;charset=utf-8",
};

export function StatusReportsPage() {
  const [projectId, setProjectId] = useState("");
  const [reportType, setReportType] = useState<ReportType>("WSR");
  const userId = useAppSelector((state) => state.auth.user?.id);
  const { data: projects } = useGetProjectsQuery({ page: 1, limit: 100 });
  const { data: reports = [], isLoading } = useGetStatusReportsQuery();
  const [generate, { isLoading: generating }] =
    useGenerateStatusReportMutation();
  const [approve] = useApproveStatusReportMutation();
  const [distribute, { isLoading: distributing }] =
    useDistributeStatusReportMutation();
  const [deleteReport, { isLoading: deleting }] =
    useDeleteStatusReportMutation();
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    label: string;
  } | null>(null);

  const onGenerate = async () => {
    if (!projectId) return toast.error("Select a project");
    try {
      const created = await generate({ projectId, reportType }).unwrap();
      toast.success(`${reportType} v${created.version} generated`);
    } catch {
      toast.error("Could not generate status report");
    }
  };

  const onDownload = async (
    id: string,
    format: "pdf" | "docx" | "xlsx" | "csv",
  ) => {
    setExportingId(id);
    try {
      const response = await fetch(
        `${env.apiUrl}/reports/status/${id}/export?format=${format}`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: userId ? { "x-user-id": userId } : undefined,
        },
      );
      if (!response.ok) throw new Error(`Export failed (${response.status})`);
      const buffer = await response.arrayBuffer();
      const file = new Blob([buffer], { type: EXPORT_MIME[format] });
      const url = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `status-report-${id}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success(
        `${format === "xlsx" ? "Excel" : format.toUpperCase()} downloaded`,
      );
    } catch {
      toast.error("Export failed");
    } finally {
      setExportingId(null);
    }
  };

  const onConfirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteReport(deleteConfirm.id).unwrap();
      toast.success("Report deleted");
      setDeleteConfirm(null);
    } catch {
      toast.error("Could not delete report");
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Status Reports"
        description="Generate, review, approve, and export WSR/MSR snapshots. Regenerating the same project and type creates a new version."
      />
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="h-10 w-full max-w-md rounded-lg border bg-background px-3 text-sm"
        >
          <option value="">Select project</option>
          {projects?.data.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <select
          value={reportType}
          onChange={(e) => setReportType(e.target.value as ReportType)}
          className="h-10 w-40 rounded-lg border bg-background px-3 text-sm"
        >
          <option value="WSR">Weekly (WSR)</option>
          <option value="MSR">Monthly (MSR)</option>
        </select>
        <Button onClick={onGenerate} disabled={generating} className="gap-2">
          {generating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FilePlus2 className="size-4" />
          )}{" "}
          Generate
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        {isLoading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Loading reports…
          </p>
        ) : reports.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No status reports generated yet.
          </p>
        ) : (
          <div className="divide-y">
            {reports.map((report) => {
              const canExport =
                report.status === "Draft" || report.status === "Approved";
              return (
                <div
                  key={report.id}
                  className="flex flex-wrap items-center gap-3 p-4"
                >
                  <Link
                    href={`/dashboard/reports/status/${report.id}`}
                    className="min-w-0 flex-1"
                  >
                    <p className="font-semibold hover:text-primary">
                      {report.project?.name ?? report.projectId}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        {report.reportType} · v{report.version}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="size-3 shrink-0" />
                        {new Date(report.generatedAt).toLocaleString()}
                      </span>
                    </p>
                  </Link>
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                    v{report.version}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold">
                    {report.status}
                  </span>
                  {report.status === "Draft" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await approve(report.id).unwrap();
                          toast.success("Report approved");
                        } catch {
                          toast.error("Approval failed");
                        }
                      }}
                    >
                      <ShieldCheck className="mr-1 size-4" />
                      Approve
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={report.status !== "Approved" || distributing}
                    onClick={async () => {
                      try {
                        await distribute(report.id).unwrap();
                        toast.success("Report distributed");
                      } catch {
                        toast.error("Distribution failed");
                      }
                    }}
                  >
                    <Send className="mr-1 size-4" />
                    Distribute
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!canExport || exportingId === report.id}
                          className="gap-1"
                        />
                      }
                    >
                      {exportingId === report.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Download className="size-4" />
                      )}
                      Export
                      <ChevronDown className="size-3.5 opacity-60" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      {EXPORT_FORMATS.map((format) => (
                        <DropdownMenuItem
                          key={format.value}
                          onClick={() =>
                            void onDownload(report.id, format.value)
                          }
                        >
                          {format.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-rose-600 hover:text-rose-700"
                    disabled={deleting}
                    onClick={() =>
                      setDeleteConfirm({
                        id: report.id,
                        label: `${report.reportType} v${report.version}`,
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <DeleteDialog
        isOpen={Boolean(deleteConfirm)}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => void onConfirmDelete()}
        title="Delete status report"
        description={
          deleteConfirm
            ? `Are you sure you want to delete ${deleteConfirm.label}? This action cannot be undone.`
            : "Are you sure you want to delete this status report?"
        }
        isDeleting={deleting}
      />
    </div>
  );
}
