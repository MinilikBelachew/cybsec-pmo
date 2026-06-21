import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  GanttChartSquare,
  FileStack,
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
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type NavChild = {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  badge?: string;
};

export type NavSection = {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  children?: NavChild[];
  roles: string[];
};

export const sidebarNav: NavSection[] = [
  // ── 1. My Workspace ───────────────────────────────────────────────────────
  {
    id: "workspace",
    label: "My Workspace",
    icon: LayoutDashboard,
    href: "/dashboard",
    roles: ["super_admin", "admin", "pmo_lead", "project_manager", "team_lead", "member", "consultant", "hr", "finance", "client"],
  },

  // ── 2. Projects ───────────────────────────────────────────────────────────
  {
    id: "projects",
    label: "Projects",
    icon: FolderKanban,
    href: "/dashboard/projects",
    roles: ["super_admin", "admin", "pmo_lead", "project_manager", "team_lead", "consultant"],
  },

  // ── 3. Project Execution ─────────────────────────────────────────────────
  {
    id: "execution",
    label: "Project Execution",
    icon: CheckSquare,
    roles: ["super_admin", "admin", "pmo_lead", "project_manager", "team_lead", "member", "consultant"],
    children: [
      {
        id: "tasks",
        label: "Active Tasks",
        icon: CheckSquare,
        href: "/dashboard/tasks",
      },
      {
        id: "gantt",
        label: "Gantt & Dependencies",
        icon: GanttChartSquare,
        href: "/dashboard/gantt",
      },
      {
        id: "documents",
        label: "Document Vault",
        icon: FileStack,
        href: "/dashboard/documents",
      },
      {
        id: "audit",
        label: "Audit Trail",
        icon: ClipboardList,
        href: "/dashboard/audit",
      },
    ],
  },

  // ── 4. Resource & Time ────────────────────────────────────────────────────
  {
    id: "resources",
    label: "Resource & Time",
    icon: Users,
    roles: ["super_admin", "admin", "pmo_lead", "project_manager", "team_lead", "member", "consultant", "hr"],
    children: [
      {
        id: "team-dir",
        label: "Team Directory",
        icon: Users,
        href: "/dashboard/team",
      },
      {
        id: "log-hours",
        label: "Log Hours",
        icon: Clock,
        href: "/dashboard/timesheets/log",
      },
      {
        id: "approvals",
        label: "Approval Queue",
        icon: CheckCircle,
        href: "/dashboard/timesheets/approvals",
      },
    ],
  },

  // ── 5. Risk & Issues ──────────────────────────────────────────────────────
  {
    id: "risk",
    label: "Risk & Issues",
    icon: AlertTriangle,
    roles: ["super_admin", "admin", "pmo_lead", "project_manager", "team_lead", "consultant"],
    children: [
      {
        id: "risk-register",
        label: "Risk Register",
        icon: AlertTriangle,
        href: "/dashboard/risks",
      },
      {
        id: "issues",
        label: "Issue Tracker",
        icon: Bug,
        href: "/dashboard/issues",
      },
    ],
  },

  // ── 6. Financials ─────────────────────────────────────────────────────────
  {
    id: "finance",
    label: "Financials",
    icon: Wallet,
    roles: ["super_admin", "admin", "pmo_lead", "finance"],
    children: [
      {
        id: "budget",
        label: "Budget Tracker",
        icon: Wallet,
        href: "/dashboard/budget",
      },
      {
        id: "revenue",
        label: "Revenue & CRM Sync",
        icon: TrendingUp,
        href: "/dashboard/revenue",
      },
      {
        id: "expenses",
        label: "Expense Claims",
        icon: Receipt,
        href: "/dashboard/expenses",
      },
    ],
  },

  // ── 7. Reports ────────────────────────────────────────────────────────────
  {
    id: "reports",
    label: "Reports",
    icon: FileText,
    roles: ["super_admin", "admin", "pmo_lead", "project_manager", "hr", "finance"],
    children: [
      { id: "report-library",   label: "Report Library",       icon: FileText,   href: "/dashboard/reports" },
      { id: "status-reports",   label: "Status Reports",        icon: Calendar,   href: "/dashboard/reports/status" },
      { id: "analytics",        label: "Analytics",             icon: BarChart3,  href: "/dashboard/reports/analytics" },
      { id: "project-health",   label: "Project Health",        icon: CheckSquare,href: "/dashboard/reports/health" },
      { id: "financial-summary",label: "Financial Summary",     icon: Wallet,     href: "/dashboard/reports/financial" },
      { id: "utilization",      label: "Utilization",           icon: PieChart,   href: "/dashboard/reports/utilization" },
      { id: "scheduled",        label: "Scheduled Reports",     icon: Clock,      href: "/dashboard/reports/scheduled" },
    ],
  },

  // ── 8. External Access ────────────────────────────────────────────────────
  {
    id: "external",
    label: "External Access",
    icon: Globe,
    roles: ["super_admin", "admin", "pmo_lead", "project_manager"],
    children: [
      {
        id: "client-portal",
        label: "Client Portal",
        icon: Globe,
        href: "/dashboard/portals/client",
      },
      {
        id: "vendor",
        label: "Vendor Management",
        icon: Store,
        href: "/dashboard/portals/vendor",
      },
    ],
  },

  // ── 9. Settings ───────────────────────────────────────────────────────────
  {
    id: "settings",
    label: "Settings",
    icon: KeyRound,
    href: "/dashboard/settings",
    roles: ["super_admin", "admin"],
  },

  // ── AI Assistant ───────────────────────────────────────────────────────────
  {
    id: "assistant",
    label: "AI Assistant",
    icon: Sparkles,
    href: "/dashboard/assistant",
    roles: ["super_admin", "admin", "pmo_lead", "project_manager", "team_lead", "member", "consultant"],
  },
];

export function getVisibleSections(userRoles: string[]): NavSection[] {
  if (!userRoles || userRoles.length === 0) return [];
  
  // Normalize backend role codes to frontend roles
  const normalizedRoles = userRoles.map((role) => {
    if (role === "pm") return "project_manager";
    if (role === "engineer") return "member";
    if (role === "it_admin") return "super_admin";
    if (role === "sales") return "member";
    return role;
  });

  if (normalizedRoles.includes("super_admin")) {
    return sidebarNav;
  }
  return sidebarNav.filter((s) => s.roles.some((r) => normalizedRoles.includes(r)));
}

