import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  GanttChartSquare,
  ClipboardList,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
  Bug,
  Wallet,
  FileText,
  Calendar,
  BarChart3,
  PieChart,
  KeyRound,
  Bell,
  ShieldCheck,
  ListChecks,
  Plug,
  ClipboardCheck,
  BookUser,
  BookOpen,
  Building2,
  Siren,
  TrendingUp,
  type LucideIcon,
  FileStack,
} from "lucide-react";
import type { PermissionRow } from "@/domains/auth/types/permissions.types";
import { hasModulePermission } from "@/domains/auth/utils/module-permissions";

/** RBAC module/action — matches page gates (avoids CASL subject collisions). */
export type NavPermission = {
  module: string;
  action: string;
};

export type NavChild = {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  badge?: string;
  /** Required module permission (all must pass if array). */
  permission?: NavPermission | NavPermission[];
  /** Pass if any of these permissions match (OR). Takes precedence over `permission`. */
  anyOf?: NavPermission[];
  /** When set, only these role codes can see the item (in addition to permission). */
  roles?: string[];
  /** When set, these role codes cannot see the item. */
  excludeRoles?: string[];
};

export type NavSection = {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  children?: NavChild[];
  permission?: NavPermission | NavPermission[];
  anyOf?: NavPermission[];
  roles?: string[];
  /** When set, these role codes cannot see the section (or any of its children). */
  excludeRoles?: string[];
};

export const sidebarNav: NavSection[] = [
  {
    id: "workspace",
    label: "My Workspace",
    icon: LayoutDashboard,
    children: [
      {
        id: "workspace-home",
        label: "Overview",
        icon: LayoutDashboard,
        href: "/dashboard",
      },
      {
        id: "sows",
        label: "SOWs",
        icon: FileText,
        href: "/dashboard/sows",
        permission: { module: "sow", action: "view" },
      },
    ],
  },
  {
    id: "projects",
    label: "Projects",
    icon: FolderKanban,
    href: "/dashboard/projects",
    permission: { module: "projects", action: "view" },
  },
  {
    id: "execution",
    label: "Project Execution",
    icon: CheckSquare,
    children: [
      {
        id: "tasks",
        label: "Active Tasks",
        icon: CheckSquare,
        href: "/dashboard/tasks",
        permission: { module: "tasks", action: "view" },
      },
      {
        id: "progress-approvals",
        label: "Progress Approvals",
        icon: ClipboardCheck,
        href: "/dashboard/tasks/progress-approvals",
        anyOf: [
          { module: "tasks", action: "approve" },
          { module: "task_progress", action: "approve" },
        ],
      },
      {
        id: "gantt",
        label: "Gantt & Dependencies",
        icon: GanttChartSquare,
        href: "/dashboard/gantt",
        permission: { module: "tasks", action: "view" },
      },
      {
        id: "documents",
        label: "Document Vault",
        icon: FileStack,
        href: "/dashboard/documents",
        permission: { module: "documents", action: "view_internal" },
      },
    ],
  },
  {
    id: "resources",
    label: "Resource & Time",
    icon: Users,
    children: [
      {
        id: "team-dir",
        label: "Team Directory",
        icon: Users,
        href: "/dashboard/team",
        permission: { module: "team", action: "view" },
      },
      {
        id: "resource-calendar",
        label: "Calendar",
        icon: Calendar,
        href: "/dashboard/calendar",
        permission: { module: "team", action: "view" },
      },
      {
        id: "staffing-approvals",
        label: "Staffing Approvals",
        icon: CheckCircle,
        href: "/dashboard/team/approvals",
        permission: { module: "team", action: "approve" },
      },
      {
        id: "log-hours",
        label: "Log Hours",
        icon: Clock,
        href: "/dashboard/timesheets/log",
        permission: { module: "timesheets", action: "submit" },
      },
      {
        id: "approvals",
        label: "Approval Queue",
        icon: CheckCircle,
        href: "/dashboard/timesheets/approvals",
        permission: { module: "timesheets", action: "approve" },
      },
    ],
  },
  {
    id: "risk",
    label: "Risk & Issues",
    icon: AlertTriangle,
    excludeRoles: ["finance"],
    children: [
      {
        id: "risk-register",
        label: "Risk Register",
        icon: AlertTriangle,
        href: "/dashboard/risks",
        permission: { module: "risks", action: "view" },
      },
      {
        id: "issues",
        label: "Issue Tracker",
        icon: Bug,
        href: "/dashboard/issues",
        // Matches useModulePermissions().canViewIssues
        anyOf: [
          { module: "issues", action: "edit" },
          { module: "projects", action: "view" },
        ],
      },
      {
        id: "alerts",
        label: "Alert Catalogue",
        icon: Bell,
        href: "/dashboard/alerts",
        permission: { module: "notifications", action: "manage" },
        roles: ["pm", "pmo_lead", "team_lead", "super_admin", "it_admin"],
      },
      {
        id: "escalations",
        label: "Escalations",
        icon: Siren,
        href: "/dashboard/escalations",
        // Matches EscalationsPage canView
        anyOf: [
          { module: "risks", action: "view" },
          { module: "risks", action: "edit" },
          { module: "issues", action: "edit" },
        ],
      },
      {
        id: "actions-portfolio",
        label: "Action Points",
        icon: CheckSquare,
        href: "/dashboard/actions",
        permission: { module: "projects", action: "view" },
      },
      {
        id: "lessons",
        label: "Lessons Learned",
        icon: BookOpen,
        href: "/dashboard/lessons",
        permission: { module: "projects", action: "view" },
        excludeRoles: ["engineer"],
      },
    ],
  },
  {
    id: "finance",
    label: "Financials",
    icon: Wallet,
    children: [
      {
        id: "budget",
        label: "Budget Tracker",
        icon: Wallet,
        href: "/dashboard/budget",
        permission: { module: "financials", action: "view" },
      },
      {
        id: "revenue",
        label: "Revenue & Collections",
        icon: TrendingUp,
        href: "/dashboard/revenue",
        permission: { module: "financials", action: "view" },
      },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: FileText,
    excludeRoles: ["finance"],
    children: [
      {
        id: "report-library",
        label: "Report Library",
        icon: FileText,
        href: "/dashboard/reports",
        permission: { module: "reports", action: "view" },
      },
      {
        id: "utilization",
        label: "Utilization",
        icon: PieChart,
        href: "/dashboard/reports/utilization",
        permission: { module: "reports", action: "view" },
      },
      {
        id: "status-reports",
        label: "Status Reports",
        icon: BarChart3,
        href: "/dashboard/reports/status",
        permission: { module: "reports", action: "view" },
      },
      {
        id: "data-quality",
        label: "Data Quality",
        icon: AlertTriangle,
        href: "/dashboard/reports/data-quality",
        permission: { module: "reports", action: "view" },
      },
      {
        id: "report-schedules",
        label: "Schedules",
        icon: Calendar,
        href: "/dashboard/reports/schedules",
        permission: { module: "reports", action: "view" },
      },
    ],
  },
  {
    id: "audit-trail",
    label: "Audit Trail",
    icon: ClipboardList,
    href: "/dashboard/audit",
    permission: { module: "audit", action: "view" },
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: Plug,
    children: [
      {
        id: "integrations-hub",
        label: "Overview",
        icon: Plug,
        href: "/dashboard/integrations",
        permission: { module: "integrations", action: "view" },
      },
      {
        id: "integrations-keka",
        label: "Keka",
        icon: Users,
        href: "/dashboard/integrations/keka",
        permission: { module: "integrations", action: "view" },
      },
      {
        id: "integrations-zoho-crm",
        label: "Zoho CRM",
        icon: Building2,
        href: "/dashboard/integrations/zoho",
        permission: { module: "integrations", action: "view" },
      },
      {
        id: "integrations-zoho-books",
        label: "Zoho Books",
        icon: BookOpen,
        href: "/dashboard/integrations/zoho-books",
        permission: { module: "integrations", action: "view" },
      },
    ],
  },
  {
    id: "roles-permissions",
    label: "Roles & Permissions",
    icon: ShieldCheck,
    children: [
      {
        id: "rbac-roles",
        label: "Roles",
        icon: ShieldCheck,
        href: "/dashboard/roles",
        permission: { module: "rbac", action: "view" },
      },
      {
        id: "rbac-permissions",
        label: "Matrix",
        icon: ListChecks,
        href: "/dashboard/roles/permissions",
        permission: { module: "rbac", action: "view" },
      },
    ],
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
    href: "/dashboard/notifications",
    permission: { module: "notifications", action: "view" },
  },
  {
    id: "admin-directory",
    label: "People & Org",
    icon: BookUser,
    href: "/dashboard/admin-directory",
    permission: { module: "users", action: "view" },
    roles: ["super_admin", "it_admin"],
  },
  {
    id: "settings",
    label: "Settings",
    icon: KeyRound,
    href: "/dashboard/settings",
    // User admin, system settings, or finance cost-formula tab
    anyOf: [
      { module: "users", action: "view" },
      { module: "settings", action: "security" },
      { module: "settings", action: "manage" },
      { module: "financials", action: "view" },
    ],
  },
];

function matchesPermission(
  permissions: PermissionRow[],
  required?: NavPermission | NavPermission[],
  anyOf?: NavPermission[],
): boolean {
  if (anyOf?.length) {
    return anyOf.some((p) =>
      hasModulePermission(permissions, p.module, p.action),
    );
  }
  if (!required) return true;
  const list = Array.isArray(required) ? required : [required];
  return list.every((p) =>
    hasModulePermission(permissions, p.module, p.action),
  );
}

function canSee(
  permissions: PermissionRow[],
  required?: NavPermission | NavPermission[],
  anyOf?: NavPermission[],
  roles?: string[],
  roleCode?: string | null,
  excludeRoles?: string[],
): boolean {
  if (excludeRoles?.length && roleCode && excludeRoles.includes(roleCode)) {
    return false;
  }
  if (roles?.length) {
    if (!roleCode || !roles.includes(roleCode)) return false;
  }
  return matchesPermission(permissions, required, anyOf);
}

export function getVisibleSections(
  permissions: PermissionRow[],
  permissionsLoaded = false,
  roleCode?: string | null,
): NavSection[] {
  if (!permissionsLoaded) {
    return sidebarNav;
  }

  return sidebarNav
    .map((section) => {
      if (
        section.excludeRoles?.length &&
        roleCode &&
        section.excludeRoles.includes(roleCode)
      ) {
        return null;
      }

      if (section.children) {
        const children = section.children.filter((child) =>
          canSee(
            permissions,
            child.permission ?? section.permission,
            child.anyOf ?? section.anyOf,
            child.roles ?? section.roles,
            roleCode,
            child.excludeRoles,
          ),
        );
        if (children.length === 0) return null;
        return { ...section, children };
      }

      if (
        !canSee(
          permissions,
          section.permission,
          section.anyOf,
          section.roles,
          roleCode,
          section.excludeRoles,
        )
      ) {
        return null;
      }
      return section;
    })
    .filter((section): section is NavSection => section !== null);
}
