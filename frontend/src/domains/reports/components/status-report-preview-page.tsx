"use client";
import { Spinner } from "@/shared/components/spinner";

import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckSquare, CircleDollarSign, Flag, Hourglass, Milestone, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { cn } from "@/shared/utils/cn";
import { useGetStatusReportQuery } from "../api/reports.api";

type SnapshotDimension = {
  dimension: string;
  score: number;
  ragStatus: string;
  previousScore: number | null;
  previousRag: string | null;
};

type SnapshotMilestone = {
  title?: string;
  status?: string;
  baselineDate?: string | null;
  expectedDate?: string | null;
  varianceDays?: number | null;
  percentComplete?: number | null;
  ragStatus?: string | null;
};

type SnapshotAction = {
  title?: string;
  owner?: string | null;
  dueDate?: string | null;
  status?: string;
};

type SnapshotIssue = {
  description?: string;
  reportedDate?: string | null;
  issueOwner?: string | null;
  targetResolutionDate?: string | null;
  status?: string;
};

type SnapshotRisk = {
  description?: string;
  category?: string | null;
  owner?: string | null;
  source?: string;
  status?: string;
};

type SnapshotPending = {
  item?: string;
  type?: string;
  daysWaiting?: number | null;
  owner?: string | null;
  holdingUp?: string | null;
};

type SnapshotDataQuality = {
  flagType?: string;
  description?: string;
};

type SnapshotCost = {
  currency?: string;
  baselineAmount?: number | null;
  actualAmount?: number | null;
  varianceAmount?: number | null;
  actualEffortHours?: number | null;
};

type ReportSnapshotView = {
  title?: string;
  generatedAt?: string;
  dataAsOf?: string;
  periodLabel?: string;
  projectName?: string;
  health: {
    overallRag: string;
    previousOverallRag: string | null;
    dimensions: SnapshotDimension[];
  };
  milestones: SnapshotMilestone[];
  actionPoints: SnapshotAction[];
  issues: SnapshotIssue[];
  risks: SnapshotRisk[];
  pendingItems: SnapshotPending[];
  cost: SnapshotCost | null;
  dataQuality: SnapshotDataQuality[];
  phasesNotStarted: string[];
};

const STATUS_BADGE: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  Approved: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  Distributed: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
};

function ragClass(rag: string) {
  const key = rag.toLowerCase();
  if (key === "green")
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (key === "red") return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
  if (key === "amber" || key === "yellow")
    return "bg-amber-50 text-amber-800 ring-1 ring-amber-200";
  return "bg-muted text-muted-foreground ring-1 ring-border";
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

function money(currency: string | undefined, value: number | null | undefined) {
  if (value == null) return "—";
  return `${currency ?? ""} ${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`.trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseSnapshot(raw: unknown): ReportSnapshotView {
  const data = asRecord(raw) ?? {};
  const health = asRecord(data.health) ?? {};
  const cost = asRecord(data.cost);

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

  const dimensions = mapRows(health.dimensions, (item) => ({
    dimension: String(item.dimension ?? "Unknown"),
    score: Number(item.score ?? 0),
    ragStatus: String(item.ragStatus ?? "amber"),
    previousScore:
      item.previousScore == null ? null : Number(item.previousScore),
    previousRag:
      item.previousRag != null ? String(item.previousRag) : null,
  }));

  // Older snapshots carried "missingData" with a severity; new ones use
  // "dataQuality" without it. Accept either so historical reports still open.
  const dataQuality = mapRows(
    data.dataQuality ?? data.missingData,
    (row) => ({
      flagType: row.flagType != null ? String(row.flagType) : undefined,
      description:
        row.description != null ? String(row.description) : undefined,
    }),
  );

  return {
    title: data.title != null ? String(data.title) : undefined,
    generatedAt:
      data.generatedAt != null ? String(data.generatedAt) : undefined,
    dataAsOf: data.dataAsOf != null ? String(data.dataAsOf) : undefined,
    periodLabel:
      data.periodLabel != null ? String(data.periodLabel) : undefined,
    projectName:
      data.projectName != null ? String(data.projectName) : undefined,
    health: {
      overallRag: String(health.overallRag ?? "amber"),
      previousOverallRag:
        health.previousOverallRag != null
          ? String(health.previousOverallRag)
          : null,
      dimensions,
    },
    milestones: mapRows(data.milestones, (row) => ({
      title: row.title != null ? String(row.title) : undefined,
      status: row.status != null ? String(row.status) : undefined,
      baselineDate:
        row.baselineDate != null
          ? String(row.baselineDate)
          : row.targetDate != null
            ? String(row.targetDate)
            : null,
      expectedDate:
        row.expectedDate != null ? String(row.expectedDate) : null,
      varianceDays:
        row.varianceDays == null ? null : Number(row.varianceDays),
      percentComplete:
        row.percentComplete == null ? null : Number(row.percentComplete),
      ragStatus: row.ragStatus != null ? String(row.ragStatus) : null,
    })),
    actionPoints: mapRows(data.actionPoints, (row) => ({
      title: row.title != null ? String(row.title) : undefined,
      owner: row.owner != null ? String(row.owner) : null,
      dueDate: row.dueDate != null ? String(row.dueDate) : null,
      status: row.status != null ? String(row.status) : undefined,
    })),
    issues: mapRows(data.issues, (row) => ({
      description:
        row.description != null
          ? String(row.description)
          : row.title != null
            ? String(row.title)
            : undefined,
      reportedDate:
        row.reportedDate != null ? String(row.reportedDate) : null,
      issueOwner:
        row.issueOwner != null ? String(row.issueOwner) : null,
      targetResolutionDate:
        row.targetResolutionDate != null
          ? String(row.targetResolutionDate)
          : null,
      status: row.status != null ? String(row.status) : undefined,
    })),
    risks: mapRows(data.risks, (row) => ({
      description:
        row.description != null ? String(row.description) : undefined,
      category: row.category != null ? String(row.category) : null,
      owner: row.owner != null ? String(row.owner) : null,
      source: row.source != null ? String(row.source) : undefined,
      status: row.status != null ? String(row.status) : undefined,
    })),
    pendingItems: mapRows(data.pendingItems, (row) => ({
      item: row.item != null ? String(row.item) : undefined,
      type: row.type != null ? String(row.type) : undefined,
      daysWaiting:
        row.daysWaiting == null ? null : Number(row.daysWaiting),
      owner: row.owner != null ? String(row.owner) : null,
      holdingUp: row.holdingUp != null ? String(row.holdingUp) : null,
    })),
    cost: cost
      ? {
          currency:
            cost.currency != null ? String(cost.currency) : undefined,
          baselineAmount:
            cost.baselineAmount == null
              ? null
              : Number(cost.baselineAmount),
          actualAmount:
            cost.actualAmount == null ? null : Number(cost.actualAmount),
          varianceAmount:
            cost.varianceAmount == null
              ? null
              : Number(cost.varianceAmount),
          actualEffortHours:
            cost.actualEffortHours == null
              ? null
              : Number(cost.actualEffortHours),
        }
      : null,
    dataQuality,
    phasesNotStarted: Array.isArray(data.phasesNotStarted)
      ? data.phasesNotStarted.map((item) => String(item))
      : [],
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
          {empty ?? "Nothing to report."}
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
        <Spinner size="md" />
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
    snapshot.issues.length > 0 ||
    snapshot.risks.length > 0 ||
    snapshot.pendingItems.length > 0 ||
    snapshot.dataQuality.length > 0 ||
    Boolean(snapshot.cost);

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
        <Pill
          className={
            STATUS_BADGE[report.status] ??
            "bg-muted text-muted-foreground ring-1 ring-border"
          }
        >
          {report.status}
        </Pill>
        <Pill className={ragClass(snapshot.health.overallRag)}>
          Overall: {formatLabel(snapshot.health.overallRag)}
        </Pill>
        {snapshot.health.previousOverallRag && (
          <Pill className={ragClass(snapshot.health.previousOverallRag)}>
            Previous: {formatLabel(snapshot.health.previousOverallRag)}
          </Pill>
        )}
        <span className="text-xs text-muted-foreground">
          {report.reportType === "WSR" ? "Weekly" : "Monthly"}
          {snapshot.periodLabel ? ` · ${snapshot.periodLabel}` : ""}
        </span>
        <span className="text-xs text-muted-foreground">
          Data as at{" "}
          {formatDateTime(snapshot.dataAsOf ?? snapshot.generatedAt ?? report.generatedAt)}
        </span>
      </div>

      {!hasContent ? (
        <EmptySnapshot />
      ) : (
        <div className="space-y-4">
          <SectionCard
            title="Executive health summary"
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
                      {item.previousScore != null
                        ? ` · previous ${item.previousScore}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.previousRag && (
                      <Pill className={ragClass(item.previousRag)}>
                        Was {formatLabel(item.previousRag)}
                      </Pill>
                    )}
                    <Pill className={ragClass(item.ragStatus)}>
                      {formatLabel(item.ragStatus)}
                    </Pill>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard
            title="Milestones"
            icon={<Milestone className="size-4" />}
            count={snapshot.milestones.length}
            empty="No milestones reported this period."
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold sm:px-5">
                      Milestone
                    </th>
                    <th className="px-3 py-2.5 font-semibold">Baseline</th>
                    <th className="px-3 py-2.5 font-semibold">Expected</th>
                    <th className="px-3 py-2.5 font-semibold">Variance</th>
                    <th className="px-3 py-2.5 font-semibold">% complete</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-4 py-2.5 font-semibold sm:px-5">RAG</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {snapshot.milestones.map((item, index) => (
                    <tr key={`${item.title ?? "m"}-${index}`}>
                      <td className="px-4 py-3 font-medium sm:px-5">
                        {item.title ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {formatDate(item.baselineDate)}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {formatDate(item.expectedDate)}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {item.varianceDays == null
                          ? "—"
                          : item.varianceDays === 0
                            ? "On baseline"
                            : item.varianceDays > 0
                              ? `+${item.varianceDays}`
                              : String(item.varianceDays)}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {item.percentComplete == null
                          ? "—"
                          : `${Math.round(item.percentComplete)}%`}
                      </td>
                      <td className="px-3 py-3">
                        <Pill className="bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                          {item.status ?? "—"}
                        </Pill>
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        {item.ragStatus ? (
                          <Pill className={ragClass(item.ragStatus)}>
                            {formatLabel(item.ragStatus)}
                          </Pill>
                        ) : (
                          "—"
                        )}
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
            empty="No open action points."
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold sm:px-5">Action</th>
                    <th className="px-3 py-2.5 font-semibold">Owner</th>
                    <th className="px-3 py-2.5 font-semibold">Due</th>
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
            title="Issues"
            icon={<AlertTriangle className="size-4" />}
            count={snapshot.issues.length}
            empty="No issues reported this period."
          >
            <ul className="divide-y divide-border/50">
              {snapshot.issues.map((item, index) => (
                <li
                  key={`${item.description ?? "i"}-${index}`}
                  className="flex flex-col gap-1 px-4 py-3 sm:px-5"
                >
                  <p className="text-sm font-semibold">
                    {item.description ?? "Issue"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Owner {item.issueOwner ?? "—"} · Reported{" "}
                    {formatDate(item.reportedDate)} · Target{" "}
                    {formatDate(item.targetResolutionDate)} ·{" "}
                    {item.status ?? "—"}
                  </p>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard
            title="Risks"
            icon={<ShieldAlert className="size-4" />}
            count={snapshot.risks.length}
            empty="No risks raised against this project."
          >
            <ul className="divide-y divide-border/50">
              {snapshot.risks.map((item, index) => (
                <li
                  key={`${item.description ?? "r"}-${index}`}
                  className="flex flex-col gap-1 px-4 py-3 sm:px-5"
                >
                  <p className="text-sm font-semibold">
                    {item.description ?? "Risk"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.category ?? "—"} · Owner {item.owner ?? "—"} ·{" "}
                    {item.source === "system" ? "System raised" : "Manual"} ·{" "}
                    {item.status ?? "—"}
                  </p>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard
            title="Pending items"
            icon={<Hourglass className="size-4" />}
            count={snapshot.pendingItems.length}
            empty="No pending items are past their date."
          >
            <ul className="divide-y divide-border/50">
              {snapshot.pendingItems.map((item, index) => (
                <li
                  key={`${item.item ?? "p"}-${index}`}
                  className="flex flex-col gap-1 px-4 py-3 sm:px-5"
                >
                  <p className="text-sm font-semibold">{item.item ?? "Item"}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.type ?? "—"} · {item.daysWaiting ?? "—"} days waiting
                    · Owner {item.owner ?? "—"}
                    {item.holdingUp ? ` · Holding up ${item.holdingUp}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </SectionCard>

          {snapshot.cost && (
            <SectionCard
              title="Cost"
              icon={<CircleDollarSign className="size-4" />}
            >
              <div className="grid gap-3 px-4 py-4 sm:grid-cols-4 sm:px-5">
                <div>
                  <p className="text-xs text-muted-foreground">Baseline</p>
                  <p className="text-sm font-semibold">
                    {money(snapshot.cost.currency, snapshot.cost.baselineAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Actual</p>
                  <p className="text-sm font-semibold">
                    {money(snapshot.cost.currency, snapshot.cost.actualAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Variance</p>
                  <p className="text-sm font-semibold">
                    {money(snapshot.cost.currency, snapshot.cost.varianceAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Actual effort (hours)
                  </p>
                  <p className="text-sm font-semibold">
                    {snapshot.cost.actualEffortHours == null
                      ? "—"
                      : Math.round(snapshot.cost.actualEffortHours)}
                  </p>
                </div>
              </div>
            </SectionCard>
          )}

          <SectionCard
            title="Missing or incomplete data"
            icon={<AlertTriangle className="size-4" />}
            count={snapshot.dataQuality.length}
            empty="No missing or incomplete data flagged."
          >
            <ul className="divide-y divide-border/50">
              {snapshot.dataQuality.map((item, index) => (
                <li
                  key={`${item.flagType ?? "f"}-${index}`}
                  className="px-4 py-3 sm:px-5"
                >
                  <p className="text-sm font-semibold">
                    {item.flagType
                      ? formatLabel(item.flagType)
                      : "Data quality flag"}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {item.description ?? "No description provided."}
                  </p>
                </li>
              ))}
            </ul>
          </SectionCard>

          {snapshot.phasesNotStarted.length > 0 && (
            <SectionCard
              title="Phases not yet started"
              icon={<Flag className="size-4" />}
              count={snapshot.phasesNotStarted.length}
            >
              <ul className="divide-y divide-border/50">
                {snapshot.phasesNotStarted.map((phase) => (
                  <li key={phase} className="px-4 py-3 text-sm sm:px-5">
                    {phase}
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>
      )}
    </div>
  );
}
