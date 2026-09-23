"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/domains/auth";
import { useAppSelector } from "@/store/hooks";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/utils/cn";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  RefreshCw,
  Eye,
  EyeOff,
  Clock,
  Compass,
  Download,
} from "lucide-react";
import {
  useGetDashboardStatsQuery,
  useGetDashboardProjectHealthQuery,
  useGetDashboardMilestonesQuery,
  useGetDashboardResourcesQuery,
  useGetDashboardBurnRateQuery,
  useGetDashboardAuditFeedQuery,
} from "../api/dashboard.api";
import {
  resolveDashboardLayout,
  type DashboardTab,
} from "../utils/dashboard-role-config";
import { useModulePermissions } from "@/domains/auth/hooks/use-module-permissions";
import { Button } from "@/shared/ui/button";
import { toast } from "react-hot-toast";
import { ExportProjectsDialog } from "@/domains/projects/components/list/export-projects-dialog";
import { ExportTasksDialog } from "@/domains/projects/components/tasks/export-tasks-dialog";
import {
  useGetDepartmentsQuery,
  useGetCustomersQuery,
  useGetProjectManagersQuery,
  useLazyExportProjectsQuery,
  useLazyGetPhasesQuery,
  useLazyGetMilestonesQuery,
} from "@/domains/projects/api/projects.api";
import { useLazyExportTasksQuery, useLazyGetTaskDependenciesQuery } from "@/domains/projects/api/tasks.api";
import type { ProjectMilestone, ProjectPhase } from "@/domains/projects/types/projects.types";
import type { TaskExportDependency } from "@/domains/projects/utils/task-export-fields";
import { useGetRisksQuery } from "@/domains/risk-compliance/api/risks.api";
import {
  exportProjectsToXLSX,
  convertToCSV,
  exportProjectsToPDF,
  exportProjectsToWord,
  exportProjectsToMspdi,
  exportTasksToXLSX,
  convertTasksToCSV,
  exportTasksToPDF,
  exportTasksToWord,
  exportTasksToMspdi,
} from "@/domains/projects/utils/import-export";

import { KpiRow } from "./dashboard-kpi-row";
import { BurnRateChart } from "./dashboard-burn-rate";
import { ProjectHealthTable } from "./dashboard-project-health";
import { RiskMatrix } from "./dashboard-risk-matrix";
import { MilestoneTimeline } from "./dashboard-milestone-timeline";
import { AuditFeed } from "./dashboard-audit-feed";
import { ResourceUtilization } from "./dashboard-resource-utilization";
import { PortfolioStrip } from "./dashboard-portfolio-strip";
import { ProjectSimulationPanel } from "./dashboard-simulation-panel";

const TAB_LABELS: Record<DashboardTab, string> = {
  portfolio: "Portfolio Overview",
  execution: "Execution Health",
  people: "People & Resources",
};

export function DashboardHome() {
  const { user } = useAuth();
  const permissions = useAppSelector((state) => state.auth.permissions);
  const roleCode = user?.backendRoleCode ?? user?.roles?.[0] ?? null;

  const layout = useMemo(
    () => resolveDashboardLayout(permissions, roleCode),
    [permissions, roleCode],
  );

  const router = useRouter();
  const [tab, setTab] = useState<DashboardTab>(layout.defaultTab);
  const [showBudget, setShowBudget] = useState(layout.showPortfolioBudget);
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState("");
  const [primaryPmId, setPrimaryPmId] = useState("");
  const dashboardFilters = useMemo(() => {
    if (!layout.showFilters) return {};
    return {
      ...(departmentId ? { departmentId } : {}),
      ...(status ? { status } : {}),
      ...(layout.showPmFilter && primaryPmId ? { primaryPmId } : {}),
    };
  }, [
    layout.showFilters,
    layout.showPmFilter,
    departmentId,
    status,
    primaryPmId,
  ]);

  useEffect(() => {
    setTab(layout.defaultTab);
    setShowBudget(layout.showPortfolioBudget);
  }, [layout.defaultTab, layout.showPortfolioBudget]);

  useEffect(() => {
    if (!layout.showFilters) {
      setDepartmentId("");
      setStatus("");
      setPrimaryPmId("");
    } else if (!layout.showPmFilter) {
      setPrimaryPmId("");
    }
  }, [layout.showFilters, layout.showPmFilter]);

  useEffect(() => {
    if (layout.isTasksOnly) {
      router.replace("/dashboard/tasks");
    }
  }, [layout.isTasksOnly, router]);

  const { data: stats, refetch: refetchStats } = useGetDashboardStatsQuery(dashboardFilters, {
    skip: !layout.canLoadStats,
  });
  const { data: health, refetch: refetchHealth } = useGetDashboardProjectHealthQuery(
    dashboardFilters,
    { skip: !layout.canLoadProjectHealth },
  );
  const { data: milestones, refetch: refetchMilestones } = useGetDashboardMilestonesQuery(
    dashboardFilters,
    { skip: !layout.canLoadMilestones },
  );
  const { data: resources, refetch: refetchResources } = useGetDashboardResourcesQuery(
    dashboardFilters,
    { skip: !layout.canLoadResources },
  );
  const { data: burnRate, refetch: refetchBurnRate } = useGetDashboardBurnRateQuery(
    dashboardFilters,
    { skip: !layout.canLoadBurnRate },
  );
  const { data: auditFeed, refetch: refetchAuditFeed } = useGetDashboardAuditFeedQuery(
    undefined,
    { skip: !layout.canLoadAuditFeed },
  );
  const { canViewRisks, canExportProjects, canViewTasks } = useModulePermissions();
  const { data: liveRisks = [] } = useGetRisksQuery(
    { status: "Open" },
    { skip: !layout.showRiskMatrix || !canViewRisks },
  );
  const dashboardRisks = useMemo(() => {
    const openRisks = liveRisks.filter(
      (r) => !["Closed", "Cancelled", "Accepted"].includes(r.status),
    );
    if (openRisks.length > 0) {
      return openRisks.slice(0, 24).map((risk) => ({
        id: risk.id.slice(0, 5).toUpperCase(),
        label: risk.title,
        likelihood: Math.min(4, Math.max(1, risk.likelihood)),
        impact: Math.min(4, Math.max(1, risk.impact)),
        owner: risk.owner?.displayName ?? "Unassigned",
      }));
    }
    // Fallback while risks module is empty / inaccessible
    return (health ?? [])
      .filter((project) => project.risks > 0)
      .map((project) => ({
        id: project.id.slice(0, 5).toUpperCase(),
        label: `${project.name}: ${project.risks} open risk item${project.risks === 1 ? "" : "s"}`,
        likelihood: Math.min(4, Math.max(1, project.risks)),
        impact: project.status === "delayed" ? 4 : project.status === "at-risk" ? 3 : 2,
        owner: project.pm,
      }));
  }, [liveRisks, health]);

  const canExportTasks = canViewTasks;

  const [showExportProjects, setShowExportProjects] = useState(false);
  const [showExportTasks, setShowExportTasks] = useState(false);

  const { data: departments = [] } = useGetDepartmentsQuery(undefined, {
    skip: !layout.showFilters,
  });
  const { data: customers = [] } = useGetCustomersQuery(undefined, {
    skip: !canExportProjects,
  });
  const { data: managers = [] } = useGetProjectManagersQuery(undefined, {
    skip: !layout.showPmFilter,
  });

  const [triggerExportProjects, { isLoading: isExportingProjects }] = useLazyExportProjectsQuery();
  const [triggerExportTasks, { isLoading: isExportingTasks }] = useLazyExportTasksQuery();
  const [triggerExportDependencies] = useLazyGetTaskDependenciesQuery();
  const [triggerGetPhases] = useLazyGetPhasesQuery();
  const [triggerGetMilestones] = useLazyGetMilestonesQuery();

  const handleExportProjects = async (
    selectedFields: string[],
    format: "xlsx" | "csv" | "pdf" | "doc" | "mspdi",
    selectedTaskFields?: string[]
  ) => {
    const exportToast = toast.loading(`Preparing portfolio export (${format.toUpperCase()})...`);
    try {
      const projectsToExport = await triggerExportProjects({}).unwrap();
      if (!projectsToExport || projectsToExport.length === 0) {
        toast.dismiss(exportToast);
        toast.error("No projects to export.");
        return;
      }

      let blob: Blob;
      let filename: string;

      if (format === "xlsx" || format === "pdf" || format === "doc" || format === "mspdi") {
        toast.loading("Fetching phases, milestones, tasks, and dependencies...", {
          id: exportToast,
        });
        const tasksPromises = projectsToExport.map((proj) =>
          triggerExportTasks({ projectId: proj.id, topLevelOnly: false }).unwrap()
        );
        const depPromises = projectsToExport.map((proj) =>
          triggerExportDependencies({ projectId: proj.id })
            .unwrap()
            .catch(() => [] as TaskExportDependency[]),
        );
        const phasePromises = projectsToExport.map((proj) =>
          triggerGetPhases(proj.id)
            .unwrap()
            .catch(() => [] as ProjectPhase[]),
        );
        const milestonePromises = projectsToExport.map((proj) =>
          triggerGetMilestones(proj.id)
            .unwrap()
            .catch(() => [] as ProjectMilestone[]),
        );
        const [tasksResults, depResults, phaseResults, milestoneResults] =
          await Promise.all([
            Promise.all(tasksPromises),
            Promise.all(depPromises),
            Promise.all(phasePromises),
            Promise.all(milestonePromises),
          ]);
        const allTasks = tasksResults.flatMap((tasks, index) => {
          const proj = projectsToExport[index];
          return tasks.map((t) => ({
            ...t,
            projectName: proj.name,
          }));
        });
        const allDependencies = depResults.flat() as TaskExportDependency[];
        const phasesByProjectId: Record<string, ProjectPhase[]> = {};
        const milestonesByProjectId: Record<string, ProjectMilestone[]> = {};
        projectsToExport.forEach((proj, index) => {
          phasesByProjectId[proj.id] = phaseResults[index] ?? [];
          milestonesByProjectId[proj.id] = milestoneResults[index] ?? [];
        });

        if (format === "xlsx") {
          const xlsxBuffer = exportProjectsToXLSX(
            projectsToExport,
            departments,
            customers,
            managers,
            selectedFields,
            allTasks,
            selectedTaskFields,
            allDependencies,
            phasesByProjectId,
            milestonesByProjectId,
          );
          blob = new Blob([xlsxBuffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          });
          filename = `projects_export_${new Date().toISOString().split("T")[0]}.xlsx`;
        } else if (format === "pdf") {
          blob = exportProjectsToPDF(
            projectsToExport,
            departments,
            customers,
            managers,
            selectedFields,
            allTasks,
            selectedTaskFields,
            allDependencies,
            phasesByProjectId,
            milestonesByProjectId,
          );
          filename = `projects_export_${new Date().toISOString().split("T")[0]}.pdf`;
        } else if (format === "doc") {
          blob = exportProjectsToWord(
            projectsToExport,
            departments,
            customers,
            managers,
            selectedFields,
            allTasks,
            selectedTaskFields,
            allDependencies,
            phasesByProjectId,
            milestonesByProjectId,
          );
          filename = `projects_export_${new Date().toISOString().split("T")[0]}.doc`;
        } else {
          blob = exportProjectsToMspdi(
            projectsToExport,
            departments,
            customers,
            managers,
            allTasks,
            allDependencies,
            [],
            phasesByProjectId,
            milestonesByProjectId,
          );
          filename = `projects_export_${new Date().toISOString().split("T")[0]}.xml`;
        }
      } else {
        const csvContent = convertToCSV(projectsToExport, departments, customers, managers, selectedFields);
        blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        filename = `projects_export_${new Date().toISOString().split("T")[0]}.csv`;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.dismiss(exportToast);
      toast.success(`Portfolio exported successfully to ${format.toUpperCase()}.`);
    } catch (err) {
      console.error(err);
      toast.dismiss(exportToast);
      toast.error("Failed to export projects.");
    }
  };

  const handleExportTasks = async (
    selectedFields: string[],
    format: "xlsx" | "csv" | "pdf" | "doc" | "mspdi"
  ) => {
    const exportToast = toast.loading(`Preparing tasks export (${format.toUpperCase()})...`);
    try {
      const tasksToExport = await triggerExportTasks({
        ownerId: user?.id,
        topLevelOnly: false,
      }).unwrap();

      if (!tasksToExport || tasksToExport.length === 0) {
        toast.dismiss(exportToast);
        toast.error("No tasks to export.");
        return;
      }

      let blob: Blob;
      let filename: string;

      if (format === "xlsx") {
        const xlsxBuffer = exportTasksToXLSX(tasksToExport, [], [], selectedFields);
        blob = new Blob([xlsxBuffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        filename = `my_tasks_${new Date().toISOString().split("T")[0]}.xlsx`;
      } else if (format === "csv") {
        const csvContent = convertTasksToCSV(tasksToExport, [], [], selectedFields);
        blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        filename = `my_tasks_${new Date().toISOString().split("T")[0]}.csv`;
      } else if (format === "pdf") {
        blob = exportTasksToPDF(tasksToExport, [], [], selectedFields);
        filename = `my_tasks_${new Date().toISOString().split("T")[0]}.pdf`;
      } else if (format === "doc") {
        blob = exportTasksToWord(tasksToExport, [], [], selectedFields);
        filename = `my_tasks_${new Date().toISOString().split("T")[0]}.doc`;
      } else {
        blob = exportTasksToMspdi(tasksToExport, [], [], "My Tasks");
        filename = `my_tasks_${new Date().toISOString().split("T")[0]}.xml`;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.dismiss(exportToast);
      toast.success(`Tasks exported successfully to ${format.toUpperCase()}.`);
    } catch (err) {
      console.error(err);
      toast.dismiss(exportToast);
      toast.error("Failed to export tasks.");
    }
  };

  const handleReload = () => {
    if (layout.canLoadStats) void refetchStats();
    if (layout.canLoadProjectHealth) void refetchHealth();
    if (layout.canLoadMilestones) void refetchMilestones();
    if (layout.canLoadResources) void refetchResources();
    if (layout.canLoadBurnRate) void refetchBurnRate();
    if (layout.canLoadAuditFeed) void refetchAuditFeed();
  };

  if (layout.isTasksOnly) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Redirecting to your task workspace…
      </div>
    );
  }

  const portfolioBudgetVisible = layout.showPortfolioBudget && showBudget;
  const totalProjects = stats?.projects.total ?? 0;
  const totalValue = stats?.projects.totalValue ?? 0;

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 font-medium">
          <Compass className="size-3.5" />
          <span>Home</span>
          <span>/</span>
          <span className="font-semibold text-foreground">Dashboard</span>
        </div>
        <div className="flex items-center gap-3">
          {canExportProjects && (
            <button
              type="button"
              onClick={() => setShowExportProjects(true)}
              className="flex cursor-pointer items-center gap-1 font-semibold text-[#ff6000] hover:underline"
            >
              <Download className="size-3" /> Export Portfolio
            </button>
          )}
          {!canExportProjects && canExportTasks && (
            <button
              type="button"
              onClick={() => setShowExportTasks(true)}
              className="flex cursor-pointer items-center gap-1 font-semibold text-[#ff6000] hover:underline"
            >
              <Download className="size-3" /> Export My Tasks
            </button>
          )}
          {(canExportProjects || canExportTasks) && <span className="text-muted-foreground/30">|</span>}
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            <Badge variant="secondary" className="h-5 text-[10px] capitalize">
              {stats?.dataFreshness.source ?? "live"}
            </Badge>
            {stats?.dataFreshness.asOf
              ? `As of ${new Date(stats.dataFreshness.asOf).toLocaleTimeString()}`
              : "Refreshing"}
          </span>
          <button
            type="button"
            onClick={handleReload}
            className="flex cursor-pointer items-center gap-1 font-semibold text-[#ff6000] hover:underline"
          >
            <RefreshCw className="size-3" /> Reload
          </button>
        </div>
      </div>

      {layout.showFilters && (
        <div className="flex flex-wrap gap-3 rounded-xl border border-border/40 bg-card/70 p-3">
          <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="h-9 min-w-44 rounded-lg border bg-background px-3 text-xs">
            <option value="">All departments</option>
            {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 min-w-40 rounded-lg border bg-background px-3 text-xs">
            <option value="">All statuses</option>
            <option value="Draft">Draft</option>
            <option value="Active">Active</option>
            <option value="At_Risk">At risk</option>
            <option value="On_Hold">On hold</option>
            <option value="Closed">Closed</option>
          </select>
          {layout.showPmFilter && (
            <select value={primaryPmId} onChange={(e) => setPrimaryPmId(e.target.value)} className="h-9 min-w-44 rounded-lg border bg-background px-3 text-xs">
              <option value="">All project managers</option>
              {managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.displayName ?? manager.email}</option>)}
            </select>
          )}
          {(departmentId || status || primaryPmId) && <Button variant="outline" size="sm" onClick={() => { setDepartmentId(""); setStatus(""); setPrimaryPmId(""); }}>Clear filters</Button>}
        </div>
      )}

      <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-border/40 bg-background/80 p-4 backdrop-blur-md md:flex-row md:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">
              Welcome back, {user?.name || "User"}!
            </h1>
            <div className="flex gap-1.5">
              {user?.roles?.map((role) => (
                <Badge
                  key={role}
                  variant="secondary"
                  className="rounded px-1.5 py-0.5 text-[10px] capitalize"
                >
                  {role}
                </Badge>
              ))}
            </div>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {layout.title} · {layout.subtitle}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">

          {layout.tabs.length > 1 && (
            <div className="flex items-center gap-0.5 rounded-xl border border-border/50 bg-muted/60 p-1">
              {layout.tabs.map((tabItem) => (
                <button
                  key={tabItem}
                  type="button"
                  onClick={() => setTab(tabItem)}
                  className={cn(
                    "cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-150",
                    tab === tabItem
                      ? "border border-border/60 bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {TAB_LABELS[tabItem]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {tab === "portfolio" && layout.tabs.includes("portfolio") && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-5">
            <div className="flex min-h-[160px] flex-col justify-between rounded-xl border border-border/40 bg-card/70 p-4 backdrop-blur-md lg:col-span-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  {layout.showPortfolioBudget ? "Total Portfolio Budget" : "Total Projects"}
                </p>
                {layout.showPortfolioBudget && (
                  <button
                    type="button"
                    onClick={() => setShowBudget((current) => !current)}
                    className="cursor-pointer text-muted-foreground hover:text-foreground"
                  >
                    {showBudget ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                )}
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <p className="text-2xl font-bold tracking-tight text-foreground">
                  {layout.showPortfolioBudget
                    ? portfolioBudgetVisible
                      ? `$${Number(totalValue).toLocaleString()}.00`
                      : "••••••••••"
                    : totalProjects}
                </p>
                {layout.showPortfolioBudget && (
                  <span className="text-xs font-semibold text-muted-foreground">USD</span>
                )}
              </div>
              {layout.showPortfolioBudget && (
                <div className="mt-4 flex items-center justify-between border-t border-border/30 pt-3 text-xs">
                  <Badge className="flex items-center gap-0.5 border-violet-100 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 hover:bg-violet-50">
                    <TrendingUp className="size-2.5" /> +2.8%
                  </Badge>
                  <span className="text-muted-foreground">vs last quarter</span>
                </div>
              )}
            </div>

            <div className="lg:col-span-3">
              <PortfolioStrip stats={stats} />
            </div>
          </div>

          <KpiRow
            variant="portfolio"
            stats={stats}
            showFinancials={layout.showPortfolioBudget}
          />

          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5">
            <div className="space-y-4 lg:col-span-3">
              {layout.showBurnRate && (
                <BurnRateChart data={burnRate} showBudget={portfolioBudgetVisible} />
              )}
              {layout.canLoadMilestones && (
                <MilestoneTimeline data={milestones || []} />
              )}
            </div>
            <div className="space-y-4 lg:col-span-2">
              {layout.canLoadProjectHealth && (
                <ProjectHealthTable data={health || []} />
              )}
              {layout.showAuditFeed && <AuditFeed data={auditFeed || []} />}
            </div>
          </div>
        </div>
      )}

      {tab === "execution" && layout.tabs.includes("execution") && (
        <div className="space-y-4">
          <KpiRow variant="execution" stats={stats} />
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5">
            <div className="space-y-4 lg:col-span-3">
              {layout.canLoadProjectHealth && (
                <ProjectHealthTable data={health || []} />
              )}
              {layout.canLoadMilestones && (
                <MilestoneTimeline data={milestones || []} />
              )}
              {layout.showAuditFeed && <AuditFeed data={auditFeed || []} />}
            </div>
            <div className="space-y-4 lg:col-span-2">
              {layout.showRiskMatrix && <RiskMatrix risks={dashboardRisks} />}
              {layout.showSimulation && (
                <ProjectSimulationPanel projects={health || []} />
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "people" && layout.tabs.includes("people") && (
        <div className="space-y-4">
          <KpiRow variant="people" stats={stats} resources={resources} />
          {layout.canLoadResources && <ResourceUtilization data={resources} />}
        </div>
      )}
      {showExportProjects && (
        <ExportProjectsDialog
          open={showExportProjects}
          onClose={() => setShowExportProjects(false)}
          onExport={handleExportProjects}
          isExporting={isExportingProjects || isExportingTasks}
        />
      )}
      {showExportTasks && (
        <ExportTasksDialog
          open={showExportTasks}
          onClose={() => setShowExportTasks(false)}
          onExport={handleExportTasks}
          isExporting={isExportingTasks}
        />
      )}
    </div>
  );
}
