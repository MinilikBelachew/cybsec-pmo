export function getRoleBadgeColor(role: string) {
  switch (role) {
    case "super_admin":
      return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
    case "pmo_lead":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    case "project_manager":
    case "pm":
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
    case "team_lead":
      return "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20";
    case "engineer":
    case "member":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    case "finance":
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
    case "hr":
      return "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20";
    default:
      return "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20";
  }
}

export function getRoleLabel(role: string) {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "pmo_lead":
      return "PMO Lead";
    case "project_manager":
    case "pm":
      return "Project Manager";
    case "team_lead":
      return "Team Lead";
    case "engineer":
      return "Engineer";
    case "finance":
      return "Finance";
    case "hr":
      return "HR";
    case "client":
      return "Client";
    case "vendor":
      return "Vendor";
    default:
      return role;
  }
}
