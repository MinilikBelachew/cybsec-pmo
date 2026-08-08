import type { PermissionRow } from "@/domains/auth/types/permissions.types";
import { hasModulePermission } from "@/domains/auth/utils/module-permissions";

export type DashboardTab = "portfolio" | "execution" | "people";

export type DashboardLayout = {
  title: string;
  subtitle: string;
  tabs: DashboardTab[];
  defaultTab: DashboardTab;
  showPortfolioBudget: boolean;
  showBurnRate: boolean;
  showAuditFeed: boolean;
  showRiskMatrix: boolean;
  showSimulation: boolean;
  /** Portfolio filters (department / status / PM). Hidden for engineer-style roles. */
  showFilters: boolean;
  /** When false, hide the primary-PM filter (e.g. own_projects PM scope). */
  showPmFilter: boolean;
  canLoadStats: boolean;
  canLoadProjectHealth: boolean;
  canLoadMilestones: boolean;
  canLoadResources: boolean;
  canLoadBurnRate: boolean;
  canLoadAuditFeed: boolean;
  isTasksOnly: boolean;
};

function buildLayout(
  partial: Pick<DashboardLayout, "title" | "subtitle" | "tabs" | "defaultTab"> &
    Partial<DashboardLayout>,
): DashboardLayout {
  return {
    showPortfolioBudget: false,
    showBurnRate: false,
    showAuditFeed: false,
    showRiskMatrix: false,
    showSimulation: false,
    showFilters: false,
    showPmFilter: false,
    canLoadStats: true,
    canLoadProjectHealth: false,
    canLoadMilestones: false,
    canLoadResources: false,
    canLoadBurnRate: false,
    canLoadAuditFeed: false,
    isTasksOnly: false,
    ...partial,
  };
}

function projectsViewScope(
  permissions: PermissionRow[],
): string | null {
  const row = permissions.find(
    (permission) =>
      permission.module === "projects" && permission.action === "view",
  );
  return row?.recordScope ?? null;
}

export function resolveDashboardLayout(
  permissions: PermissionRow[],
  roleCode?: string | null,
): DashboardLayout {
  const canViewProjects = hasModulePermission(permissions, "projects", "view");
  const canViewTasks = hasModulePermission(permissions, "tasks", "view");
  const canViewReports = hasModulePermission(permissions, "reports", "view");
  const canViewFinancials = hasModulePermission(permissions, "financials", "view");
  const canViewTeam = hasModulePermission(permissions, "team", "view");
  const canViewMilestones = hasModulePermission(permissions, "milestones", "view");
  const canViewAudit = hasModulePermission(permissions, "audit", "view");
  const projectScope = projectsViewScope(permissions);
  const isOwnProjectsScope = projectScope === "own_projects";

  const canLoadStats = canViewProjects || canViewTasks || canViewReports;
  const canLoadProjectHealth = canViewProjects;
  const canLoadMilestones = canViewProjects || canViewMilestones;
  const canLoadResources = canViewTeam || canViewReports;
  const canLoadBurnRate = canViewFinancials && canViewProjects;
  const canLoadAuditFeed = canViewAudit;

  if (!canViewProjects && canViewTasks) {
    return buildLayout({
      title: "My Workspace",
      subtitle: "Task delivery overview",
      tabs: ["execution"],
      defaultTab: "execution",
      isTasksOnly: true,
      canLoadStats,
      canLoadProjectHealth: false,
      canLoadMilestones: canViewMilestones,
      canLoadResources: false,
      showRiskMatrix: false,
      showSimulation: false,
      showFilters: false,
      showPmFilter: false,
    });
  }

  if (roleCode === "finance" || (canViewFinancials && !canViewReports)) {
    return buildLayout({
      title: "Finance Dashboard",
      subtitle: "Department financial performance",
      tabs: canViewTeam ? ["portfolio", "people"] : ["portfolio"],
      defaultTab: "portfolio",
      showPortfolioBudget: canViewFinancials,
      showBurnRate: canLoadBurnRate,
      showAuditFeed: false,
      showFilters: canLoadProjectHealth,
      showPmFilter: canLoadProjectHealth && !isOwnProjectsScope,
      canLoadStats,
      canLoadProjectHealth,
      canLoadMilestones,
      canLoadResources,
      canLoadBurnRate,
    });
  }

  if (roleCode === "engineer" || roleCode === "vendor") {
    return buildLayout({
      title: "My Workspace",
      subtitle: "Assigned work and delivery status",
      tabs: ["execution"],
      defaultTab: "execution",
      canLoadStats,
      canLoadProjectHealth,
      canLoadMilestones,
      showRiskMatrix: true,
      showSimulation: false,
      showFilters: false,
      showPmFilter: false,
    });
  }

  if (roleCode === "hr") {
    return buildLayout({
      title: "People Dashboard",
      subtitle: "Team capacity and utilization",
      tabs: ["people", "execution"],
      defaultTab: "people",
      canLoadStats,
      canLoadProjectHealth,
      canLoadMilestones,
      canLoadResources,
      showRiskMatrix: false,
      showSimulation: false,
      showFilters: canLoadProjectHealth,
      showPmFilter: canLoadProjectHealth && !isOwnProjectsScope,
    });
  }

  if (roleCode === "client") {
    return buildLayout({
      title: "Project Portal",
      subtitle: "Shared project status",
      tabs: ["execution"],
      defaultTab: "execution",
      canLoadStats,
      canLoadProjectHealth,
      canLoadMilestones,
      showRiskMatrix: false,
      showSimulation: false,
      showFilters: false,
      showPmFilter: false,
    });
  }

  if (roleCode === "sales") {
    return buildLayout({
      title: "Sales Portfolio",
      subtitle: "Pipeline and project value",
      tabs: ["portfolio", "execution"],
      defaultTab: "portfolio",
      showPortfolioBudget: canViewFinancials,
      showBurnRate: canLoadBurnRate,
      showFilters: canLoadProjectHealth,
      showPmFilter: canLoadProjectHealth,
      canLoadStats,
      canLoadProjectHealth,
      canLoadMilestones,
      canLoadBurnRate,
    });
  }

  if (roleCode === "pm" || roleCode === "team_lead") {
    return buildLayout({
      title: roleCode === "pm" ? "PM Dashboard" : "Team Dashboard",
      subtitle:
        roleCode === "pm" ? "Your project portfolio" : "Team delivery overview",
      tabs: canViewTeam ? ["portfolio", "execution", "people"] : ["portfolio", "execution"],
      defaultTab: "portfolio",
      showPortfolioBudget: canViewFinancials,
      showBurnRate: canLoadBurnRate,
      // PM own_projects: filters for status/department only — not cross-PM.
      showFilters: canLoadProjectHealth,
      showPmFilter: canLoadProjectHealth && !isOwnProjectsScope,
      canLoadStats,
      canLoadProjectHealth,
      canLoadMilestones,
      canLoadResources,
      canLoadBurnRate,
      showRiskMatrix: true,
      showSimulation: roleCode === "pm",
    });
  }

  if (canViewReports || roleCode === "pmo_lead" || roleCode === "super_admin" || roleCode === "it_admin") {
    return buildLayout({
      title: "Executive Dashboard",
      subtitle: "PMO portfolio overview",
      tabs: ["portfolio", "execution", "people"],
      defaultTab: "portfolio",
      showPortfolioBudget: canViewFinancials,
      showBurnRate: canLoadBurnRate,
      showAuditFeed: canLoadAuditFeed,
      showRiskMatrix: true,
      showSimulation: true,
      showFilters: canLoadProjectHealth,
      showPmFilter: canLoadProjectHealth,
      canLoadStats,
      canLoadProjectHealth,
      canLoadMilestones,
      canLoadResources,
      canLoadBurnRate,
      canLoadAuditFeed,
    });
  }

  return buildLayout({
    title: "Dashboard",
    subtitle: "Workspace overview",
    tabs: ["execution"],
    defaultTab: "execution",
    canLoadStats,
    canLoadProjectHealth,
    canLoadMilestones,
    canLoadResources,
    showFilters: false,
    showPmFilter: false,
  });
}
