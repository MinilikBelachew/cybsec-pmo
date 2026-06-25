/**
 * Stable role IDs (int) for seeding and RBAC matrix alignment.
 * IDs 1–11 are fixed for Gate 1; new roles use the DB sequence (12, 13, …).
 */
export const ROLE_CATALOG = [
  { id: 1, code: 'super_admin', label: 'Super Admin', isExternal: false },
  { id: 2, code: 'it_admin', label: 'IT Admin', isExternal: false },
  { id: 3, code: 'pmo_lead', label: 'PMO Lead', isExternal: false },
  { id: 4, code: 'pm', label: 'PM', isExternal: false },
  { id: 5, code: 'team_lead', label: 'Team Lead', isExternal: false },
  { id: 6, code: 'engineer', label: 'Engineer', isExternal: false },
  { id: 7, code: 'finance', label: 'Finance', isExternal: false },
  { id: 8, code: 'hr', label: 'HR', isExternal: false },
  { id: 9, code: 'sales', label: 'Sales', isExternal: false },
  { id: 10, code: 'client', label: 'Client', isExternal: true },
  { id: 11, code: 'vendor', label: 'Vendor', isExternal: true },
] as const;

export type RoleCatalogEntry = (typeof ROLE_CATALOG)[number];

export const ROLE_ID_BY_CODE = Object.fromEntries(
  ROLE_CATALOG.map((role) => [role.code, role.id]),
) as Record<RoleCatalogEntry['code'], number>;

export const ROLE_CODE_BY_ID = Object.fromEntries(
  ROLE_CATALOG.map((role) => [role.id, role.code]),
) as Record<number, RoleCatalogEntry['code']>;
