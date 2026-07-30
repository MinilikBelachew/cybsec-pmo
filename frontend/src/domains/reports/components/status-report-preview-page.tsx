"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckSquare,
  Flag,
  Loader2,
  Milestone,
} from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { cn } from "@/shared/utils/cn";
import { useGetStatusReportQuery } from "../api/reports.api";

type SnapshotDimension = {
  dimension: string;
  score: number;
  ragStatus: string;
};

type SnapshotMilestone = {
  title?: string;
  targetDate?: string;
  status?: string;
  weight?: number | null;
};

type SnapshotAction = {
  title?: string;
  owner?: string;
  dueDate?: string;
  priority?: string;
  status?: string;
};

type SnapshotMissing = {
  flagType?: string;
  severity?: string;
  description?: string;
  flaggedAt?: string;
};

type ReportSnapshotView = {
  title?: string;
  generatedAt?: string;
  periodLabel?: string;
  projectName?: string;
  health: {
    overallRag: string;
    dimensions: SnapshotDimension[];
  };
  milestones: SnapshotMilestone[];
  actionPoints: SnapshotAction[];
  missingData: SnapshotMissing[];
};

const STATUS_BADGE: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  Approved: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  Distributed: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
};

function ragClass(rag: string) {
  const key = rag.toLowerCase();
  if (key === "green") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (key === "red") return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
  if (key === "amber" || key === "yellow")
    return "bg-amber-50 text-amber-800 ring-1 ring-amber-200";
  return "bg-muted text-muted-foreground ring-1 ring-border";
}

function severityClass(severity: string) {
  const key = severity.toLowerCase();
  if (key === "critical" || key === "high")
    return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
  if (key === "medium") return "bg-amber-50 text-amber-800 ring-1 ring-amber-200";
  return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
}

function formatLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseSnapshot(raw: unknown): ReportSnapshotView {
  const data = asRecord(raw) ?? {};
  const health = asRecord(data.health) ?? {};
  const dimensions = Array.isArray(health.dimensions)
    ? health.dimensions
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map((item) => ({
          dimension: String(item.dimension ?? "Unknown"),
          score: Number(item.score ?? 0),
          ragStatus: String(item.ragStatus ?? "amber"),
        }))
    : [];

  const mapRows = <T,>(
    value: unknown,
    map: (row: Record<string, unknown>) => T,
  ): T[] =>
    Array.isArray(value)
      ? value
          .map((item) => asRecord(item))
          .filter((item): item is Record<string, unknown> => Boolean(item))
          .map(map)
      : [];

  return {
    title: data.title != null ? String(data.title) : undefined,
    generatedAt: data.generatedAt != null ? String(data.generatedAt) : undefined,
    periodLabel: data.periodLabel != null ? String(data.periodLabel) : undefined,
    projectName: data.projectName != null ? String(data.projectName) : undefined,
    health: {
      overallRag: String(health.overallRag ?? "amber"),
      dimensions,
    },
    milestones: mapRows(data.milestones, (row) => ({
      title: row.title != null ? String(row.title) : undefined,
      targetDate: row.targetDate != null ? String(row.targetDate) : undefined,
      status: row.status != null ? String(row.status) : undefined,
      weight:
        row.weight == null || row.weight === ""
          ? null
          : Number(row.weight),
    })),
    actionPoints: mapRows(data.actionPoints, (row) => ({
      title: row.title != null ? String(row.title) : undefined,
      owner: row.owner != null ? String(row.owner) : undefined,
      dueDate: row.dueDate != null ? String(row.dueDate) : undefined,
      priority: row.priority != null ? String(row.priority) : undefined,
      status: row.status != null ? String(row.status) : undefined,
    })),
    missingData: mapRows(data.missingData, (row) => ({
      flagType: row.flagType != null ? String(row.flagType) : undefined,
      severity: row.severity != null ? String(row.severity) : undefined,
      description:
        row.description != null ? String(row.description) : undefined,
      flaggedAt: row.flaggedAt != null ? String(row.flaggedAt) : undefined,
    })),
  };
}

function Pill({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize",
        className,
      )}
    >
      {children}
    </span>
  );
}

function SectionCard({
  title,
  icon,
  count,
  children,
  empty,
}: {
  title: string;
  icon: ReactNode;
  count?: number;
  children: ReactNode;
  empty?: string;
}) {
  const isEmpty = count === 0;
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <h2 className="text-sm font-bold">{title}</h2>
        </div>
        {typeof count === "number" && (
          <span className="text-xs font-medium text-muted-foreground">
            {count}
          </span>
        )}
      </div>
      {isEmpty ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-5">
          {empty ?? "Nothing to show."}
        </p>
      ) : (
        children
      )}
    </section>
  );
}

function EmptySnapshot() {
  return (
    <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
      This report has no snapshot data yet.
    </p>
  );
}

export function StatusReportPreviewPage({ id }: { id: string }) {
  const { data: report, isLoading, isError } = useGetStatusReportQuery(id);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (isError || !report) {
    return (
      <p className="py-20 text-center text-sm text-rose-500">
        Status report could not be loaded.
      </p>
    );
  }

  const snapshot = parseSnapshot(report.dataSnapshot);
  const hasContent =
    Boolean(snapshot.title) ||
    Boolean(snapshot.periodLabel) ||
    snapshot.health.dimensions.length > 0 ||
    snapshot.milestones.length > 0 ||
    snapshot.actionPoints.length > 0 ||
    snapshot.missingData.length > 0;

  const projectName =
    snapshot.projectName ?? report.project?.name ?? report.projectId;

  return (
    <div className="space-y-6 pb-10">
      <div className="space-y-3">
        <Link
          href="/dashboard/reports/status"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to status reports
        </Link>
        <PageHeader
          title={snapshot.title ?? `${report.reportType} Preview`}
          description={`${projectName} · v${report.version}`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-4 py-3 sm:px-5">
        <Pill className={STATUS_BADGE[report.status] ?? "bg-muted text-muted-foreground ring-1 ring-border"}>
          {report.status}
        </Pill>
        <Pill className={ragClass(snapshot.health.overallRag)}>
          Overall RAG: {formatLabel(snapshot.health.overallRag)}
        </Pill>
        <span className="text-xs text-muted-foreground">
          {report.reportType === "WSR" ? "Weekly" : "Monthly"}
          {snapshot.periodLabel ? ` · ${snapshot.periodLabel}` : ""}
        </span>
        <span className="text-xs text-muted-foreground">
          Generated {formatDateTime(snapshot.generatedAt ?? report.generatedAt)}
        </span>
      </div>

      {!hasContent ? (
        <EmptySnapshot />
      ) : (
        <div className="space-y-4">
          <SectionCard
            title="Project health"
            icon={<Flag className="size-4" />}
            count={snapshot.health.dimensions.length}
            empty="No health dimensions in this snapshot."
          >
            <ul className="divide-y divide-border/50">
              {snapshot.health.dimensions.map((item) => (
                <li
                  key={item.dimension}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5"
                >
                  <div>
                    <p className="text-sm font-semibold">
                      {formatLabel(item.dimension)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Score {Number.isFinite(item.score) ? item.score : "—"}
                    </p>
                  </div>
                  <Pill className={ragClass(item.ragStatus)}>
                    {formatLabel(item.ragStatus)}
                  </Pill>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard
            title="Milestones"
            icon={<Milestone className="size-4" />}
            count={snapshot.milestones.length}
            empty="No milestones in this snapshot."
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold sm:px-5">Milestone</th>
                    <th className="px-3 py-2.5 font-semibold">Target</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-4 py-2.5 font-semibold sm:px-5">Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {snapshot.milestones.map((item, index) => (
                    <tr key={`${item.title ?? "m"}-${index}`}>
                      <td className="px-4 py-3 font-medium sm:px-5">
                        {item.title ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {formatDate(item.targetDate)}
                      </td>
                      <td className="px-3 py-3">
                        <Pill className="bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                          {item.status ?? "—"}
                        </Pill>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground sm:px-5">
                        {item.weight == null || Number.isNaN(item.weight)
                          ? "—"
                          : item.weight}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard
            title="Open action points"
            icon={<CheckSquare className="size-4" />}
            count={snapshot.actionPoints.length}
            empty="No open action points in this snapshot."
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold sm:px-5">Action</th>
                    <th className="px-3 py-2.5 font-semibold">Owner</th>
                    <th className="px-3 py-2.5 font-semibold">Due</th>
                    <th className="px-3 py-2.5 font-semibold">Priority</th>
                    <th className="px-4 py-2.5 font-semibold sm:px-5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {snapshot.actionPoints.map((item, index) => (
                    <tr key={`${item.title ?? "a"}-${index}`}>
                      <td className="px-4 py-3 font-medium sm:px-5">
                        {item.title ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {item.owner ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {formatDate(item.dueDate)}
                      </td>
                      <td className="px-3 py-3">
                        <Pill className="bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                          {item.priority ?? "—"}
                        </Pill>
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <Pill className="bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                          {item.status ?? "—"}
                        </Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard
            title="Data quality issues"
            icon={<AlertTriangle className="size-4" />}
            count={snapshot.missingData.length}
            empty="No open data quality issues in this snapshot."
          >
            <ul className="divide-y divide-border/50">
              {snapshot.missingData.map((item, index) => (
                <li
                  key={`${item.flagType ?? "f"}-${index}`}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {item.flagType
                        ? formatLabel(item.flagType)
                        : "Data quality flag"}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {item.description ?? "No description provided."}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Flagged {formatDateTime(item.flaggedAt)}
                    </p>
                  </div>
                  {item.severity && (
                    <Pill className={severityClass(item.severity)}>
                      {formatLabel(item.severity)}
                    </Pill>
                  )}
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
