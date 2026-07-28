"use client";

import Link from "next/link";
import { useState } from "react";
import { Download, FilePlus2, Loader2, Send, ShieldCheck } from "lucide-react";
import { toast } from "react-hot-toast";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/ui/button";
import { useGetProjectsQuery } from "@/domains/projects";
import {
  useApproveStatusReportMutation,
  useDistributeStatusReportMutation,
  useGenerateStatusReportMutation,
  useGetStatusReportsQuery,
  useLazyExportStatusReportQuery,
} from "../api/reports.api";
import type { ReportType } from "../types/reports.types";

export function StatusReportsPage() {
  const [projectId, setProjectId] = useState("");
  const [reportType, setReportType] = useState<ReportType>("WSR");
  const { data: projects } = useGetProjectsQuery({ page: 1, limit: 100 });
  const { data: reports = [], isLoading } = useGetStatusReportsQuery();
  const [generate, { isLoading: generating }] =
    useGenerateStatusReportMutation();
  const [approve] = useApproveStatusReportMutation();
  const [distribute, { isLoading: distributing }] =
    useDistributeStatusReportMutation();
  const [exportReport] = useLazyExportStatusReportQuery();

  const onGenerate = async () => {
    if (!projectId) return toast.error("Select a project");
    try {
      await generate({ projectId, reportType }).unwrap();
      toast.success(`${reportType} generated`);
    } catch {
      toast.error("Could not generate status report");
    }
  };

  const onDownload = async (
    id: string,
    format: "pdf" | "docx" | "xlsx" | "csv",
  ) => {
    try {
      const blob = await exportReport({ id, format }).unwrap();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `status-report-${id}.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Export failed");
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Status Reports"
        description="Generate, review, approve, and export WSR/MSR snapshots."
      />
      <div className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[1fr_160px_auto]">
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="h-10 rounded-lg border bg-background px-3 text-sm"
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
          className="h-10 rounded-lg border bg-background px-3 text-sm"
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
            {reports.map((report) => (
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
                  <p className="text-xs text-muted-foreground">
                    {report.reportType} ·{" "}
                    {new Date(report.generatedAt).toLocaleString()}
                  </p>
                </Link>
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
                {(["pdf", "docx", "xlsx", "csv"] as const).map((format) => (
                  <Button
                    key={format}
                    variant="outline"
                    size="sm"
                    disabled={
                      report.status !== "Draft" && report.status !== "Approved"
                    }
                    onClick={() => void onDownload(report.id, format)}
                  >
                    <Download className="mr-1 size-4" />
                    {format === "xlsx" ? "Excel" : format.toUpperCase()}
                  </Button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
