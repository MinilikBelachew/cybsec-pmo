import { CaslAction } from './casl.types';

/** Maps permission `module` from DB → CASL subject (Prisma model or module subject). */
export const MODULE_TO_SUBJECT: Record<string, string> = {
  auth: 'Auth',
  users: 'User',
  rbac: 'Rbac',
  audit: 'AuditLog',
  settings: 'Settings',
  integrations: 'Integration',
  notifications: 'Notification',
  projects: 'Project',
  milestones: 'Project',
  dependencies: 'Project',
  project_import: 'Project',
  project_export: 'Project',
  project_templates: 'Project',
  project_closure: 'Project',
  charter: 'Project',
  tasks: 'Task',
  subtasks: 'Task',
  task_progress: 'Task',
  timesheets: 'Timesheet',
  team: 'Team',
  financials: 'Financial',
  reports: 'Report',
  risks: 'Project',
  issues: 'Project',
  documents: 'Document',
  portal_client: 'Project',
  portal_vendor: 'Task',
};

/** Maps permission `action` from DB → CASL action. */
export const PERMISSION_ACTION_TO_CASL: Record<string, CaslAction> = {
  view: 'read',
  view_internal: 'read',
  login: 'read',
  session: 'read',
  mfa: 'read',
  export: 'read',
  create: 'create',
  import: 'create',
  instantiate: 'create',
  edit: 'update',
  comment: 'update',
  attach: 'update',
  submit: 'update',
  initiate: 'update',
  assign_role: 'manage',
  manage: 'manage',
  configure: 'manage',
  security: 'manage',
  approve: 'approve',
  validate: 'approve',
};

export function toCaslAction(permissionAction: string): CaslAction {
  return PERMISSION_ACTION_TO_CASL[permissionAction] ?? 'read';
}

export function toCaslSubject(module: string): string {
  if (MODULE_TO_SUBJECT[module]) {
    return MODULE_TO_SUBJECT[module];
  }

  return module
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}
