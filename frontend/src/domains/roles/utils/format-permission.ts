const RECORD_SCOPE_LABELS: Record<string, string> = {
  all: "All records",
  own_projects: "Own projects (primary/secondary PM)",
  department: "Same department",
  shared: "Explicitly shared (customer contact)",
  assigned: "Assigned (PM, task owner, or allocation)",
  team: "Team (reports + project allocations)",
};

export function humanizePermissionToken(token: string): string {
  return token
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatRoleCodeLabel(code: string): string {
  return humanizePermissionToken(code);
}

export function formatPermissionCode(module: string, action: string): string {
  return `${module}.${action}`;
}

export function formatPermissionLabel(module: string, action: string): string {
  return `${humanizePermissionToken(module)} ${humanizePermissionToken(action)}`;
}

export function formatRecordScopeLabel(scope: string | null | undefined): string {
  if (!scope) return "—";
  return RECORD_SCOPE_LABELS[scope] ?? humanizePermissionToken(scope);
}
