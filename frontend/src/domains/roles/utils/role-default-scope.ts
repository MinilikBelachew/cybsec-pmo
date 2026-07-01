/** Default record scope when granting a permission from the matrix UI. */
export const DEFAULT_RECORD_SCOPE_BY_ROLE: Record<string, string> = {
  super_admin: "all",
  it_admin: "all",
  pmo_lead: "all",
  pm: "own_projects",
  team_lead: "team",
  engineer: "assigned",
  finance: "department",
  hr: "department",
  sales: "all",
  client: "shared",
  vendor: "assigned",
};

export function defaultRecordScopeForRole(roleCode: string): string {
  return DEFAULT_RECORD_SCOPE_BY_ROLE[roleCode] ?? "all";
}
