"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import {
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  ListChecks,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { ListPagination, paginateItems } from "@/shared/components/list-pagination";
import {
  KpiStatCard,
  KPI_CARD_THEMES,
} from "@/shared/components/kpi-stat-card";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { useAuth } from "@/domains/auth";
import { useModulePermissions } from "@/domains/auth/hooks/use-module-permissions";
import { useGetProjectsQuery } from "@/domains/projects/api/projects.api";
import {
  useGetActionClosureReportQuery,
  useGetPortfolioActionsQuery,
  useSendActionRemindersMutation,
} from "../api/actions-portfolio.api";

export function ActionsPortfolioPage() {
  const { user } = useAuth();
  const { canViewProjects, canEditProjects } = useModulePermissions();
  const isEngineer = (user?.backendRoleCode ?? "") === "engineer";
  const canViewKpis = canViewProjects && !isEngineer;
  const [projectFilter, setProjectFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: projectsResponse } = useGetProjectsQuery({ page: 1, limit: 200 });
  const projects = projectsResponse?.data ?? [];

  const listParams = useMemo(
    () => ({
      ...(projectFilter !== "all" ? { projectId: projectFilter } : {}),
      ...(sourceFilter !== "all" ? { sourceType: sourceFilter } : {}),
    }),
    [projectFilter, sourceFilter],
  );

  const { data: actions = [], isLoading } = useGetPortfolioActionsQuery(listParams, {
    skip: !canViewProjects,
  });
  const { data: report } = useGetActionClosureReportQuery(
    projectFilter !== "all" ? { projectId: projectFilter } : undefined,
    { skip: !canViewKpis },
  );
  const [sendReminders, { isLoading: isReminding }] =
    useSendActionRemindersMutation();

  useEffect(() => {
    setPage(1);
  }, [projectFilter, sourceFilter, pageSize]);

  const pageCount = Math.max(1, Math.ceil(actions.length / pageSize));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const pagedActions = useMemo(
    () => paginateItems(actions, page, pageSize),
    [actions, page, pageSize],
  );

  const selectedFilterProjectName =
    projectFilter === "all"
      ? "All projects"
      : projects.find((p) => p.id === projectFilter)?.name;

  const closedRate =
    report && report.total > 0
      ? Math.round((report.closed / report.total) * 100)
      : 0;
  const overdueRate =
    report && report.total > 0
      ? Math.round((report.overdueOpen / report.total) * 100)
      : 0;
  const openCount = report ? Math.max(0, report.total - report.closed) : 0;

  if (!canViewProjects) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center text-muted-foreground">
        You do not have permission to view action points.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Action Points"
        description="Portfolio view of actions linked to projects, tasks, risks, issues, meetings and MoM — with reminders and closure reporting."
        actions={
          canEditProjects ? (
            <Button
              disabled={isReminding}
              onClick={async () => {
                try {
                  const res = await sendReminders().unwrap();
                  toast.success(`Sent ${res.sent} reminder(s)`);
                } catch {
                  toast.error("Failed to send reminders");
                }
              }}
            >
              {isReminding && <Loader2 className="size-4 me-2 animate-spin" />}
              Send due reminders
            </Button>
          ) : null
        }
      />

      {canViewKpis && report && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <KpiStatCard
            title="Total"
            subtitle="all action points"
            value={report.total}
            numericValue={report.total}
            chartMax={Math.max(report.total, 1)}
            icon={ListChecks}
            theme={KPI_CARD_THEMES.primary}
          />
          <KpiStatCard
            title="Closed"
            subtitle={`${closedRate}% of total`}
            value={report.closed}
            numericValue={report.closed}
            chartMax={Math.max(report.total, 1)}
            icon={CheckCircle2}
            theme={KPI_CARD_THEMES.emerald}
          />
          <KpiStatCard
            title="Overdue open"
            subtitle={
              openCount > 0
                ? `${overdueRate}% of total · ${openCount} open`
                : "none overdue"
            }
            value={report.overdueOpen}
            numericValue={report.overdueOpen}
            chartMax={Math.max(report.total, 1)}
            icon={AlertTriangle}
            theme={KPI_CARD_THEMES.rose}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Select
          value={projectFilter}
          onValueChange={(v) => setProjectFilter(v ?? "all")}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Project">
              {selectedFilterProjectName}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sourceFilter}
          onValueChange={(v) => setSourceFilter(v ?? "all")}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Source">
              {sourceFilter === "all" ? "All sources" : sourceFilter}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {["Project", "Task", "Meeting", "MoM", "Risk", "Issue"].map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border/60 overflow-hidden">
        {isLoading ? (
          <div className="py-12 flex justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : actions.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
            <CheckSquare className="size-8 opacity-40" />
            No action points found.
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-start px-4 py-3">Action</th>
                  <th className="text-start px-4 py-3">Project</th>
                  <th className="text-start px-4 py-3">Source</th>
                  <th className="text-start px-4 py-3">Linked</th>
                  <th className="text-start px-4 py-3">Owner</th>
                  <th className="text-start px-4 py-3">Due</th>
                  <th className="text-start px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {pagedActions.map((action) => (
                  <tr key={action.id} className="border-t border-border/40">
                    <td className="px-4 py-3 font-medium">
                      {action.title}
                      {action.isOverdue && (
                        <Badge
                          variant="outline"
                          className="ms-2 text-rose-700 border-rose-200"
                        >
                          Overdue
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {action.projectName ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{action.sourceType}</Badge>
                    </td>
                    <td
                      className="px-4 py-3 text-muted-foreground max-w-[220px] truncate"
                      title={action.linkedLabel ?? undefined}
                    >
                      {action.linkedLabel ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {action.owner?.displayName ?? "—"}
                    </td>
                    <td className="px-4 py-3">{action.dueDate}</td>
                    <td className="px-4 py-3">{action.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ListPagination
              page={page}
              pageSize={pageSize}
              total={actions.length}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
