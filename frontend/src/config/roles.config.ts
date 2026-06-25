export const ROLE_CATALOG = [
  { id: 1, code: 'super_admin', label: 'Super Admin' },
  { id: 2, code: 'it_admin', label: 'IT Admin' },
  { id: 3, code: 'pmo_lead', label: 'PMO Lead' },
  { id: 4, code: 'pm', label: 'PM' },
  { id: 5, code: 'team_lead', label: 'Team Lead' },
  { id: 6, code: 'engineer', label: 'Engineer' },
  { id: 7, code: 'finance', label: 'Finance' },
  { id: 8, code: 'hr', label: 'HR' },
  { id: 9, code: 'sales', label: 'Sales' },
  { id: 10, code: 'client', label: 'Client' },
  { id: 11, code: 'vendor', label: 'Vendor' },
] as const;

export const ROLE_ID_BY_CODE = Object.fromEntries(
  ROLE_CATALOG.map((role) => [role.code, role.id]),
) as Record<(typeof ROLE_CATALOG)[number]['code'], number>;

export const ROLE_CODE_BY_ID = Object.fromEntries(
  ROLE_CATALOG.map((role) => [role.id, role.code]),
) as Record<number, (typeof ROLE_CATALOG)[number]['code']>;
