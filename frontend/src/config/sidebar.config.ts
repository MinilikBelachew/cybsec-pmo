import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  GanttChartSquare,
  // FileStack,
  ClipboardList,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
  Bug,
  Wallet,
  TrendingUp,
  Receipt,
  FileText,
  Calendar,
  BarChart3,
  PieChart,
  Globe,
  Store,
  KeyRound,
  Bell,
  ShieldCheck,
  ListChecks,
  Plug,
  // Sparkles,
  type LucideIcon,
  FileStack,
} from "lucide-react";
import type { AppAbility } from "@/domains/auth/casl/define-ability";
import type { CaslAction } from "@/domains/auth/casl/casl.constants";

export type NavPermission = {
  action: CaslAction;
  subject: string;
};

export type NavChild = {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  badge?: string;
  permission?: NavPermission;
};

export type NavSection = {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  children?: NavChild[];
  permission?: NavPermission;
};

export const sidebarNav: NavSection[] = [
  {
    id: "workspace",
    label: "My Workspace",
    icon: LayoutDashboard,
    href: "/dashboard",
  },
  {
    id: "projects",
    label: "Projects",
    icon: FolderKanban,
    href: "/dashboard/projects",
    permission: { action: "read", subject: "Project" },
  },
  {
    id: "execution",
    label: "Project Execution",
    icon: CheckSquare,
    permission: { action: "read", subject: "Task" },
    children: [
      {
        id: "tasks",
        label: "Active Tasks",
        icon: CheckSquare,
        href: "/dashboard/tasks",
        permission: { action: "read", subject: "Task" },
      },
      {
        id: "gantt",
        label: "Gantt & Dependencies",
        icon: GanttChartSquare,
        href: "/dashboard/gantt",
        permission: { action: "read", subject: "Project" },
      },
      {
        id: "documents",
        label: "Document Vault",
        icon: FileStack,
        href: "/dashboard/documents",
        permission: { action: "read", subject: "Document" },
      },
    ],
  },
  {
    id: "resources",
    label: "Resource & Time",
    icon: Users,
    permission: { action: "read", subject: "Team" },
    children: [
      {
        id: "team-dir",
        label: "Team Directory",
        icon: Users,
        href: "/dashboard/team",
        permission: { action: "read", subject: "Team" },
      },
      {
        id: "resource-calendar",
        label: "Calendar",
        icon: Calendar,
        href: "/dashboard/calendar",
        permission: { action: "read", subject: "Team" },
      },
      {
        id: "staffing-approvals",
        label: "Staffing Approvals",
        icon: CheckCircle,
        href: "/dashboard/team/approvals",
        permission: { action: "approve", subject: "Team" },
      },
      {
        id: "log-hours",
        label: "Log Hours",
        icon: Clock,
        href: "/dashboard/timesheets/log",
        permission: { action: "update", subject: "Timesheet" },
      },
      {
        id: "approvals",
        label: "Approval Queue",
        icon: CheckCircle,
        href: "/dashboard/timesheets/approvals",
        permission: { action: "approve", subject: "Timesheet" },
      },
    ],
  },
  // {
  //   id: "risk",
  //   label: "Risk & Issues",
  //   icon: AlertTriangle,
  //   permission: { action: "read", subject: "Project" },
  //   children: [
  //     {
  //       id: "risk-register",
  //       label: "Risk Register",
  //       icon: AlertTriangle,
  //       href: "/dashboard/risks",
  //       permission: { action: "read", subject: "Project" },
  //     },
  //     {
  //       id: "issues",
  //       label: "Issue Tracker",
  //       icon: Bug,
  //       href: "/dashboard/issues",
  //       permission: { action: "update", subject: "Project" },
  //     },
  //   ],
  // },
  // {
  //   id: "finance",
  //   label: "Financials",
  //   icon: Wallet,
  //   permission: { action: "read", subject: "Project" },
  //   children: [
  //     {
  //       id: "budget",
  //       label: "Budget Tracker",
  //       icon: Wallet,
  //       href: "/dashboard/budget",
  //       permission: { action: "read", subject: "Project" },
  //     },
  //     {
  //       id: "revenue",
  //       label: "Revenue & CRM Sync",
  //       icon: TrendingUp,
  //       href: "/dashboard/revenue",
  //       permission: { action: "read", subject: "Project" },
  //     },
  //     {
  //       id: "expenses",
  //       label: "Expense Claims",
  //       icon: Receipt,
  //       href: "/dashboard/expenses",
  //       permission: { action: "update", subject: "Project" },
  //     },
  //   ],
  // },
  {
    id: "reports",
    label: "Reports",
    icon: FileText,
    permission: { action: "read", subject: "Report" },
    children: [
      {
        id: "report-library",
        label: "Report Library",
        icon: FileText,
        href: "/dashboard/reports",
        permission: { action: "read", subject: "Report" },
      },
      {
        id: "utilization",
        label: "Utilization",
        icon: PieChart,
        href: "/dashboard/reports/utilization",
        permission: { action: "read", subject: "Report" },
      },
    ],
  },
  // {
  //   id: "external",
  //   label: "External Access",
  //   icon: Globe,
  //   permission: { action: "read", subject: "Project" },
  //   children: [
  //     {
  //       id: "client-portal",
  //       label: "Client Portal",
  //       icon: Globe,
  //       href: "/dashboard/portals/client",
  //       permission: { action: "read", subject: "Project" },
  //     },
  //     {
  //       id: "vendor",
  //       label: "Vendor Management",
  //       icon: Store,
  //       href: "/dashboard/portals/vendor",
  //       permission: { action: "read", subject: "Task" },
  //     },
  //   ],
  // },
  {
    id: "audit-trail",
    label: "Audit Trail",
    icon: ClipboardList,
    href: "/dashboard/audit",
    permission: { action: "read", subject: "AuditLog" },
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: Plug,
    permission: { action: "read", subject: "Integration" },
    children: [
      {
        id: "integrations-hub",
        label: "Overview",
        icon: Plug,
        href: "/dashboard/integrations",
        permission: { action: "read", subject: "Integration" },
      },
      {
        id: "integrations-keka",
        label: "Keka",
        icon: Users,
        href: "/dashboard/integrations/keka",
        permission: { action: "read", subject: "Integration" },
      },
    ],
  },
  {
    id: "roles-permissions",
    label: "Roles & Permissions",
    icon: ShieldCheck,
    permission: { action: "read", subject: "Rbac" },
    children: [
      {
        id: "rbac-roles",
        label: "Roles",
        icon: ShieldCheck,
        href: "/dashboard/roles",
        permission: { action: "read", subject: "Rbac" },
      },
      {
        id: "rbac-permissions",
        label: "Matrix",
        icon: ListChecks,
        href: "/dashboard/roles/permissions",
        permission: { action: "read", subject: "Rbac" },
      },
    ],
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
    href: "/dashboard/notifications",
    permission: { action: "read", subject: "Notification" },
  },
  {
    id: "settings",
    label: "Settings",
    icon: KeyRound,
    href: "/dashboard/settings",
    permission: { action: "read", subject: "User" },
  },
  // {
  //   id: "assistant",
  //   label: "AI Assistant",
  //   icon: Sparkles,
  //   href: "/dashboard/assistant",
  //   permission: { action: "read", subject: "Task" },
  // },
];

function canSee(
  ability: AppAbility | null,
  permission?: NavPermission,
): boolean {
  if (!permission) return true;
  if (!ability) return false;
  return ability.can(permission.action, permission.subject);
}

export function getVisibleSections(
  ability: AppAbility | null,
  permissionsLoaded = false,
): NavSection[] {
  if (!permissionsLoaded) {
    return sidebarNav;
  }

  return sidebarNav
    .map((section) => {
      if (section.children) {
        const children = section.children.filter((child) =>
          canSee(ability, child.permission ?? section.permission),
        );
        if (children.length === 0) return null;
        if (!canSee(ability, section.permission) && children.length === 0) {
          return null;
        }
        return { ...section, children };
      }

      if (!canSee(ability, section.permission)) return null;
      return section;
    })
    .filter((section): section is NavSection => section !== null);
}
