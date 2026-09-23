export enum RoleEnum {
  super_admin = 'super_admin',
  it_admin = 'it_admin',
  pmo_lead = 'pmo_lead',
  pm = 'pm',
  team_lead = 'team_lead',
  engineer = 'engineer',
  finance = 'finance',
  hr = 'hr',
  sales = 'sales',
  client = 'client',
  vendor = 'vendor',
  sdm = 'sdm',
}

/** Org delivery roles that can own a task without a project team allocation. */
export const TASK_ASSIGNEE_ORG_ROLE_CODES: RoleEnum[] = [
  RoleEnum.pmo_lead,
  RoleEnum.sdm,
];

