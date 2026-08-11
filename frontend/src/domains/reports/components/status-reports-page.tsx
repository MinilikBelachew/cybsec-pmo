"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Calendar,
  ChevronDown,
  Download,
  FilePlus2,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { PageHeader } from "@/shared/components/page-header";
import { FilterSelect } from "@/shared/components/filter-select";
import { Spinner } from "@/shared/components/spinner";
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
import { cn } from "@/shared/utils/cn";
import {
  useApproveStatusReportMutation,
  useDeleteStatusReportMutation,
  useDistributeStatusReportMutation,
  useGenerateStatusReportMutation,
  useGetStatusReportsQuery,
} from "../api/reports.api";
import type { ReportType, StatusReport } from "../types/reports.types";

const FILTER_TRIGGER =
  "h-10 w-[220px] max-w-[min(100%,280px)] shrink-0 rounded-lg border-border/60 bg-background px-3 shadow-none";

const STATUS_FILTER_OPTIONS = [
  { id: "Draft", label: "Draft" },
  { id: "Approved", label: "Approved" },
  { id: "Distributed", label: "Distributed" },
];

const TYPE_FILTER_OPTIONS = [
  { id: "WSR", label: "Weekly (WSR)" },
  { id: "MSR", label: "Monthly (MSR)" },
];

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

const STATUS_BADGE: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  Approved: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  Distributed: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
};

const PAGE_SIZES = [5, 10, 20];

function statusBadgeClass(status: string) {
  return STATUS_BADGE[status] ?? "bg-muted text-muted-foreground ring-1 ring-border";
}

export function StatusReportsPage() {
  const [generateProjectId, setGenerateProjectId] = useState("");
  const [generateType, setGenerateType] = useState<ReportType>("WSR");

  const [filterProjectId, setFilterProjectId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState<"" | ReportType>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const userId = useAppSelector((state) => state.auth.user?.id);
  const { data: projects } = useGetProjectsQuery({ page: 1, limit: 100 });
  const { data: list, isLoading, isFetching } = useGetStatusReportsQuery({
    projectId: filterProjectId || undefined,
    reportType: filterType || undefined,
    status: filterStatus || undefined,
    page,
    limit: pageSize,
  });
  const [generate, { isLoading: generating }] =
    useGenerateStatusReportMutation();
  const [approve, { isLoading: approving }] = useApproveStatusReportMutation();
  const [distribute, { isLoading: distributing }] =
    useDistributeStatusReportMutation();
  const [deleteReport, { isLoading: deleting }] =
    useDeleteStatusReportMutation();
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    label: string;
  } | null>(null);

  const reports = list?.data ?? [];
  const total = list?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPage(1);
  }, [filterProjectId, filterStatus, filterType, pageSize]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const onGenerate = async () => {
    if (!generateProjectId) return toast.error("Select a project");
    try {
      const created = await generate({
        projectId: generateProjectId,
        reportType: generateType,
      }).unwrap();
      toast.success(`${generateType} v${created.version} generated`);
    } catch {
      toast.error("Could not generate status report");
    }
  };

  const onFlowAction = async (report: StatusReport) => {
    setActionId(report.id);
    try {
      if (report.status === "Draft") {
        await approve(report.id).unwrap();
        toast.success("Report approved");
      } else if (report.status === "Approved") {
        await distribute(report.id).unwrap();
        toast.success("Report distributed");
      }
    } catch {
      toast.error(
        report.status === "Draft" ? "Approval failed" : "Distribution failed",
      );
    } finally {
      setActionId(null);
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
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(disposition);
      const filename = match
        ? decodeURIComponent(match[1].replace(/"/g, "").trim())
        : `status-report-${id}.${format}`;
      const url = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
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

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const projectOptions =
    projects?.data.map((project) => ({
      id: project.id,
      label: project.name,
    })) ?? [];

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Status Reports"
        description="Generate, review, approve, and export WSR/MSR snapshots. Regenerating the same project and type creates a new version."
      />

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-card p-4">
        <FilterSelect
          value={generateProjectId || null}
          onValueChange={(next) => setGenerateProjectId(next ?? "")}
          options={projectOptions}
          noneLabel="Select project to generate"
          searchable
          searchPlaceholder="Search projects..."
          triggerClassName={cn(FILTER_TRIGGER, "w-[280px] max-w-[min(100%,320px)]")}
        />
        <FilterSelect
          value={generateType}
          onValueChange={(next) => setGenerateType((next as ReportType) || "WSR")}
          options={TYPE_FILTER_OPTIONS}
          noneLabel="Weekly (WSR)"
          allowNone={false}
          triggerClassName={cn(FILTER_TRIGGER, "w-[180px]")}
        />
        <Button onClick={onGenerate} disabled={generating} className="gap-2">
          {generating ? (
            <Spinner size="sm" />
          ) : (
            <FilePlus2 className="size-4" />
          )}{" "}
          Generate
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
        <FilterSelect
          value={filterProjectId || null}
          onValueChange={(next) => setFilterProjectId(next ?? "")}
          options={projectOptions}
          noneLabel="All projects"
          searchable
          searchPlaceholder="Search projects..."
          triggerClassName={FILTER_TRIGGER}
        />
        <FilterSelect
          value={filterStatus || null}
          onValueChange={(next) => setFilterStatus(next ?? "")}
          options={STATUS_FILTER_OPTIONS}
          noneLabel="All statuses"
          triggerClassName={cn(FILTER_TRIGGER, "w-[160px]")}
        />
        <FilterSelect
          value={filterType || null}
          onValueChange={(next) => setFilterType((next as "" | ReportType) ?? "")}
          options={TYPE_FILTER_OPTIONS}
          noneLabel="All types"
          triggerClassName={cn(FILTER_TRIGGER, "w-[180px]")}
        />
        {(filterProjectId || filterStatus || filterType) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterProjectId("");
              setFilterStatus("");
              setFilterType("");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {isLoading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Loading reports…
          </p>
        ) : reports.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No status reports match the current filters.
          </p>
        ) : (
          <div className={cn("divide-y", isFetching && "opacity-70")}>
            {reports.map((report) => {
              const isFlowBusy = actionId === report.id && (approving || distributing);
              return (
                <div
                  key={report.id}
                  className="flex flex-wrap items-center gap-3 p-4"
                >
                  <Link
                    href={`/dashboard/reports/status/${report.id}`}
                    className="min-w-0 flex-1"
                  >
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="truncate font-semibold hover:text-primary">
                        {report.project?.name ?? report.projectId}
                      </p>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                          statusBadgeClass(report.status),
                        )}
                      >
                        {report.status}
                      </span>
                    </div>
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

                  {report.status === "Draft" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isFlowBusy}
                      onClick={() => void onFlowAction(report)}
                    >
                      {isFlowBusy ? (
                        <Spinner size="sm" className="mr-1" />
                      ) : (
                        <ShieldCheck className="mr-1 size-4" />
                      )}
                      Approve
                    </Button>
                  )}
                  {report.status === "Approved" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isFlowBusy}
                      onClick={() => void onFlowAction(report)}
                    >
                      {isFlowBusy ? (
                        <Spinner size="sm" className="mr-1" />
                      ) : (
                        <Send className="mr-1 size-4" />
                      )}
                      Distribute
                    </Button>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={exportingId === report.id}
                          className="gap-1"
                        />
                      }
                    >
                      {exportingId === report.id ? (
                        <Spinner size="sm" />
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

        {total > 0 && (
          <div className="flex flex-col gap-3 border-t border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {from}–{to} of {total}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-8 rounded-lg border bg-background px-2 text-sm"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} per page
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                Next
              </Button>
            </div>
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
