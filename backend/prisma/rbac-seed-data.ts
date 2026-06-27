import { ROLE_CATALOG, ROLE_ID_BY_CODE } from '../src/roles/role-catalog';

type PermissionSeed = {
  module: string;
  action: string;
  recordScope: string;
  fieldScope?: Record<string, unknown> | null;
};

const SCOPE_BY_CODE: Record<string, string> = {
  super_admin: 'all',
  it_admin: 'all',
  pmo_lead: 'all',
  pm: 'own_projects',
  team_lead: 'team',
  engineer: 'assigned',
  finance: 'department',
  hr: 'department',
  sales: 'all',
  client: 'shared',
  vendor: 'assigned',
};

/** Gate 1 baseline — includes Foundation milestones M1.1–M1.7 scope */
const PERMISSIONS_BY_ROLE: Record<string, PermissionSeed[]> = {
  super_admin: [
    { module: 'users', action: 'view', recordScope: 'all' },
    { module: 'users', action: 'create', recordScope: 'all' },
    { module: 'users', action: 'assign_role', recordScope: 'all' },
    { module: 'rbac', action: 'view', recordScope: 'all' },
    { module: 'rbac', action: 'manage', recordScope: 'all' },
    { module: 'audit', action: 'view', recordScope: 'all' },
    { module: 'audit', action: 'export', recordScope: 'all' },
    { module: 'settings', action: 'security', recordScope: 'all' },
    { module: 'integrations', action: 'view', recordScope: 'all' },
    { module: 'integrations', action: 'configure', recordScope: 'all' },
    { module: 'notifications', action: 'view', recordScope: 'all' },
    { module: 'notifications', action: 'manage', recordScope: 'all' },
    { module: 'projects', action: 'view', recordScope: 'all' },
    { module: 'projects', action: 'create', recordScope: 'all' },
    { module: 'projects', action: 'edit', recordScope: 'all' },
    { module: 'projects', action: 'approve', recordScope: 'all' },
    { module: 'milestones', action: 'view', recordScope: 'all' },
    { module: 'milestones', action: 'edit', recordScope: 'all' },
    { module: 'dependencies', action: 'view', recordScope: 'all' },
    { module: 'dependencies', action: 'edit', recordScope: 'all' },
    { module: 'dependencies', action: 'validate', recordScope: 'all' },
    { module: 'project_import', action: 'import', recordScope: 'all' },
    { module: 'project_export', action: 'export', recordScope: 'all' },
    { module: 'project_templates', action: 'view', recordScope: 'all' },
    { module: 'project_templates', action: 'manage', recordScope: 'all' },
    { module: 'project_templates', action: 'instantiate', recordScope: 'all' },
    { module: 'project_closure', action: 'view', recordScope: 'all' },
    { module: 'project_closure', action: 'initiate', recordScope: 'all' },
    { module: 'project_closure', action: 'approve', recordScope: 'all' },
    { module: 'charter', action: 'view', recordScope: 'all' },
    { module: 'charter', action: 'edit', recordScope: 'all' },
    { module: 'charter', action: 'approve', recordScope: 'all' },
    { module: 'tasks', action: 'view', recordScope: 'all' },
    { module: 'tasks', action: 'edit', recordScope: 'all' },
    { module: 'tasks', action: 'comment', recordScope: 'all' },
    { module: 'tasks', action: 'attach', recordScope: 'all' },
    { module: 'subtasks', action: 'view', recordScope: 'all' },
    { module: 'subtasks', action: 'edit', recordScope: 'all' },
    { module: 'task_progress', action: 'submit', recordScope: 'all' },
    { module: 'task_progress', action: 'approve', recordScope: 'all' },
    { module: 'timesheets', action: 'submit', recordScope: 'all' },
    { module: 'timesheets', action: 'approve', recordScope: 'all' },
    { module: 'team', action: 'view', recordScope: 'all' },
    { module: 'team', action: 'edit', recordScope: 'all' },
    { module: 'financials', action: 'view', recordScope: 'all' },
    { module: 'financials', action: 'edit', recordScope: 'all' },
    { module: 'reports', action: 'view', recordScope: 'all' },
    { module: 'risks', action: 'view', recordScope: 'all' },
    { module: 'risks', action: 'edit', recordScope: 'all' },
    { module: 'issues', action: 'edit', recordScope: 'all' },
    { module: 'documents', action: 'view_internal', recordScope: 'all' },
    { module: 'documents', action: 'upload_shared', recordScope: 'all' },
    { module: 'portal_client', action: 'view', recordScope: 'all' },
    { module: 'portal_vendor', action: 'view', recordScope: 'all' },
  ],
  it_admin: [
    { module: 'users', action: 'view', recordScope: 'all' },
    { module: 'users', action: 'create', recordScope: 'all' },
    { module: 'users', action: 'assign_role', recordScope: 'all' },
    { module: 'rbac', action: 'view', recordScope: 'all' },
    { module: 'rbac', action: 'manage', recordScope: 'all' },
    { module: 'audit', action: 'view', recordScope: 'all' },
    { module: 'audit', action: 'export', recordScope: 'all' },
    { module: 'settings', action: 'security', recordScope: 'all' },
    { module: 'integrations', action: 'view', recordScope: 'all' },
    { module: 'integrations', action: 'configure', recordScope: 'all' },
    { module: 'notifications', action: 'view', recordScope: 'all' },
    { module: 'notifications', action: 'manage', recordScope: 'all' },
    { module: 'projects', action: 'view', recordScope: 'all' },
    { module: 'milestones', action: 'view', recordScope: 'all' },
    { module: 'dependencies', action: 'view', recordScope: 'all' },
    { module: 'project_export', action: 'export', recordScope: 'all' },
    { module: 'tasks', action: 'view', recordScope: 'all' },
    { module: 'team', action: 'view', recordScope: 'all' },
    { module: 'team', action: 'edit', recordScope: 'all' },
    { module: 'reports', action: 'view', recordScope: 'all' },
  ],
  pmo_lead: [
    { module: 'users', action: 'view', recordScope: 'all' },
    { module: 'notifications', action: 'view', recordScope: 'all' },
    { module: 'notifications', action: 'manage', recordScope: 'all' },
    { module: 'projects', action: 'view', recordScope: 'all' },
    { module: 'projects', action: 'create', recordScope: 'all' },
    { module: 'projects', action: 'edit', recordScope: 'all' },
    { module: 'projects', action: 'approve', recordScope: 'all' },
    { module: 'milestones', action: 'view', recordScope: 'all' },
    { module: 'milestones', action: 'edit', recordScope: 'all' },
    { module: 'dependencies', action: 'view', recordScope: 'all' },
    { module: 'dependencies', action: 'edit', recordScope: 'all' },
    { module: 'dependencies', action: 'validate', recordScope: 'all' },
    { module: 'project_import', action: 'import', recordScope: 'all' },
    { module: 'project_export', action: 'export', recordScope: 'all' },
    { module: 'project_templates', action: 'view', recordScope: 'all' },
    { module: 'project_templates', action: 'manage', recordScope: 'all' },
    { module: 'project_templates', action: 'instantiate', recordScope: 'all' },
    { module: 'project_closure', action: 'view', recordScope: 'all' },
    { module: 'project_closure', action: 'initiate', recordScope: 'all' },
    { module: 'project_closure', action: 'approve', recordScope: 'all' },
    { module: 'charter', action: 'view', recordScope: 'all' },
    { module: 'charter', action: 'edit', recordScope: 'all' },
    { module: 'charter', action: 'approve', recordScope: 'all' },
    { module: 'tasks', action: 'view', recordScope: 'all' },
    { module: 'tasks', action: 'edit', recordScope: 'all' },
    { module: 'tasks', action: 'comment', recordScope: 'all' },
    { module: 'tasks', action: 'attach', recordScope: 'all' },
    { module: 'subtasks', action: 'view', recordScope: 'all' },
    { module: 'subtasks', action: 'edit', recordScope: 'all' },
    { module: 'task_progress', action: 'approve', recordScope: 'all' },
    { module: 'timesheets', action: 'approve', recordScope: 'all' },
    { module: 'team', action: 'view', recordScope: 'all' },
    { module: 'team', action: 'edit', recordScope: 'all' },
    { module: 'financials', action: 'view', recordScope: 'all' },
    { module: 'reports', action: 'view', recordScope: 'all' },
    { module: 'risks', action: 'view', recordScope: 'all' },
    { module: 'risks', action: 'edit', recordScope: 'all' },
    { module: 'issues', action: 'edit', recordScope: 'all' },
    { module: 'documents', action: 'view_internal', recordScope: 'all' },
    { module: 'documents', action: 'upload_shared', recordScope: 'all' },
    { module: 'portal_client', action: 'view', recordScope: 'all' },
    { module: 'portal_vendor', action: 'view', recordScope: 'all' },
  ],
  pm: [
    { module: 'notifications', action: 'view', recordScope: 'own_projects' },
    { module: 'notifications', action: 'manage', recordScope: 'own_projects' },
    { module: 'projects', action: 'view', recordScope: 'own_projects' },
    { module: 'projects', action: 'create', recordScope: 'own_projects' },
    { module: 'projects', action: 'edit', recordScope: 'own_projects' },
    { module: 'projects', action: 'approve', recordScope: 'own_projects' },
    { module: 'milestones', action: 'view', recordScope: 'own_projects' },
    { module: 'milestones', action: 'edit', recordScope: 'own_projects' },
    { module: 'dependencies', action: 'view', recordScope: 'own_projects' },
    { module: 'dependencies', action: 'edit', recordScope: 'own_projects' },
    { module: 'dependencies', action: 'validate', recordScope: 'own_projects' },
    { module: 'project_import', action: 'import', recordScope: 'own_projects' },
    { module: 'project_export', action: 'export', recordScope: 'own_projects' },
    { module: 'project_templates', action: 'view', recordScope: 'own_projects' },
    { module: 'project_templates', action: 'instantiate', recordScope: 'own_projects' },
    { module: 'project_closure', action: 'view', recordScope: 'own_projects' },
    { module: 'project_closure', action: 'initiate', recordScope: 'own_projects' },
    { module: 'charter', action: 'view', recordScope: 'own_projects' },
    { module: 'charter', action: 'edit', recordScope: 'own_projects' },
    { module: 'tasks', action: 'view', recordScope: 'own_projects' },
    { module: 'tasks', action: 'edit', recordScope: 'own_projects' },
    { module: 'tasks', action: 'comment', recordScope: 'own_projects' },
    { module: 'tasks', action: 'attach', recordScope: 'own_projects' },
    { module: 'subtasks', action: 'view', recordScope: 'own_projects' },
    { module: 'subtasks', action: 'edit', recordScope: 'own_projects' },
    { module: 'task_progress', action: 'approve', recordScope: 'own_projects' },
    { module: 'timesheets', action: 'approve', recordScope: 'own_projects' },
    { module: 'team', action: 'view', recordScope: 'own_projects' },
    { module: 'team', action: 'edit', recordScope: 'own_projects' },
    { module: 'financials', action: 'view', recordScope: 'own_projects' },
    { module: 'reports', action: 'view', recordScope: 'own_projects' },
    { module: 'risks', action: 'view', recordScope: 'own_projects' },
    { module: 'risks', action: 'edit', recordScope: 'own_projects' },
    { module: 'issues', action: 'edit', recordScope: 'own_projects' },
    { module: 'documents', action: 'view_internal', recordScope: 'own_projects' },
    { module: 'documents', action: 'upload_shared', recordScope: 'own_projects' },
    { module: 'portal_client', action: 'view', recordScope: 'own_projects' },
    { module: 'portal_vendor', action: 'view', recordScope: 'own_projects' },
  ],
  team_lead: [
    { module: 'notifications', action: 'view', recordScope: 'team' },
    { module: 'notifications', action: 'manage', recordScope: 'team' },
    { module: 'projects', action: 'view', recordScope: 'team' },
    { module: 'milestones', action: 'view', recordScope: 'team' },
    { module: 'dependencies', action: 'view', recordScope: 'team' },
    { module: 'project_export', action: 'export', recordScope: 'team' },
    { module: 'tasks', action: 'view', recordScope: 'team' },
    { module: 'tasks', action: 'edit', recordScope: 'team' },
    { module: 'tasks', action: 'comment', recordScope: 'team' },
    { module: 'tasks', action: 'attach', recordScope: 'team' },
    { module: 'subtasks', action: 'view', recordScope: 'team' },
    { module: 'subtasks', action: 'edit', recordScope: 'team' },
    { module: 'task_progress', action: 'submit', recordScope: 'team' },
    { module: 'task_progress', action: 'approve', recordScope: 'team' },
    { module: 'timesheets', action: 'submit', recordScope: 'team' },
    { module: 'timesheets', action: 'approve', recordScope: 'team' },
    { module: 'team', action: 'view', recordScope: 'team' },
    { module: 'reports', action: 'view', recordScope: 'team' },
    { module: 'risks', action: 'view', recordScope: 'team' },
    { module: 'issues', action: 'edit', recordScope: 'team' },
    { module: 'documents', action: 'view_internal', recordScope: 'team' },
    { module: 'documents', action: 'upload_shared', recordScope: 'team' },
  ],
  engineer: [
    { module: 'notifications', action: 'view', recordScope: 'assigned' },
    { module: 'notifications', action: 'manage', recordScope: 'assigned' },
    { module: 'projects', action: 'view', recordScope: 'assigned' },
    { module: 'milestones', action: 'view', recordScope: 'assigned' },
    { module: 'dependencies', action: 'view', recordScope: 'assigned' },
    { module: 'tasks', action: 'view', recordScope: 'assigned' },
    { module: 'tasks', action: 'edit', recordScope: 'assigned' },
    { module: 'tasks', action: 'comment', recordScope: 'assigned' },
    { module: 'tasks', action: 'attach', recordScope: 'assigned' },
    { module: 'subtasks', action: 'view', recordScope: 'assigned' },
    { module: 'subtasks', action: 'edit', recordScope: 'assigned' },
    { module: 'task_progress', action: 'submit', recordScope: 'assigned' },
    { module: 'timesheets', action: 'submit', recordScope: 'assigned' },
    { module: 'team', action: 'view', recordScope: 'assigned' },
    { module: 'risks', action: 'view', recordScope: 'assigned' },
    { module: 'issues', action: 'edit', recordScope: 'assigned' },
    { module: 'documents', action: 'view_internal', recordScope: 'assigned' },
    { module: 'documents', action: 'upload_shared', recordScope: 'assigned' },
  ],
  finance: [
    { module: 'notifications', action: 'view', recordScope: 'department' },
    { module: 'notifications', action: 'manage', recordScope: 'department' },
    { module: 'projects', action: 'view', recordScope: 'department' },
    { module: 'milestones', action: 'view', recordScope: 'department' },
    { module: 'tasks', action: 'view', recordScope: 'department' },
    { module: 'financials', action: 'view', recordScope: 'department' },
    { module: 'financials', action: 'edit', recordScope: 'department' },
    { module: 'reports', action: 'view', recordScope: 'department' },
    { module: 'documents', action: 'view_internal', recordScope: 'department' },
  ],
  hr: [
    { module: 'notifications', action: 'view', recordScope: 'department' },
    { module: 'notifications', action: 'manage', recordScope: 'department' },
    { module: 'users', action: 'view', recordScope: 'department' },
    { module: 'projects', action: 'view', recordScope: 'department' },
    { module: 'milestones', action: 'view', recordScope: 'department' },
    { module: 'tasks', action: 'view', recordScope: 'department' },
    { module: 'timesheets', action: 'approve', recordScope: 'department' },
    { module: 'team', action: 'view', recordScope: 'department' },
    { module: 'reports', action: 'view', recordScope: 'department' },
  ],
  sales: [
    { module: 'notifications', action: 'view', recordScope: 'all' },
    { module: 'notifications', action: 'manage', recordScope: 'all' },
    { module: 'projects', action: 'view', recordScope: 'all' },
    { module: 'milestones', action: 'view', recordScope: 'all' },
    { module: 'charter', action: 'view', recordScope: 'all' },
    { module: 'tasks', action: 'view', recordScope: 'all' },
    { module: 'financials', action: 'view', recordScope: 'all' },
    { module: 'reports', action: 'view', recordScope: 'all' },
  ],
  client: [
    { module: 'notifications', action: 'view', recordScope: 'shared' },
    { module: 'notifications', action: 'manage', recordScope: 'shared' },
    { module: 'projects', action: 'view', recordScope: 'shared' },
    { module: 'milestones', action: 'view', recordScope: 'shared' },
    { module: 'tasks', action: 'view', recordScope: 'shared' },
    { module: 'tasks', action: 'comment', recordScope: 'shared', fieldScope: { deny: ['internal'] } },
    { module: 'tasks', action: 'attach', recordScope: 'shared' },
    { module: 'documents', action: 'upload_shared', recordScope: 'shared' },
    { module: 'portal_client', action: 'view', recordScope: 'shared' },
  ],
  vendor: [
    { module: 'notifications', action: 'view', recordScope: 'assigned' },
    { module: 'notifications', action: 'manage', recordScope: 'assigned' },
    { module: 'tasks', action: 'view', recordScope: 'assigned' },
    { module: 'tasks', action: 'comment', recordScope: 'assigned', fieldScope: { deny: ['internal'] } },
    { module: 'tasks', action: 'attach', recordScope: 'assigned' },
    { module: 'documents', action: 'upload_shared', recordScope: 'assigned' },
    { module: 'portal_vendor', action: 'view', recordScope: 'assigned' },
  ],
};

export { ROLE_CATALOG, ROLE_ID_BY_CODE, SCOPE_BY_CODE, PERMISSIONS_BY_ROLE };

export function buildPermissionCatalog() {
  const seen = new Set<string>();
  const catalog: Array<{ module: string; action: string }> = [];

  for (const permissions of Object.values(PERMISSIONS_BY_ROLE)) {
    for (const permission of permissions) {
      const key = `${permission.module}:${permission.action}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      catalog.push({ module: permission.module, action: permission.action });
    }
  }

  return catalog.sort((a, b) => {
    const moduleCompare = a.module.localeCompare(b.module);
    return moduleCompare !== 0 ? moduleCompare : a.action.localeCompare(b.action);
  });
}

export function buildRolePermissionRows() {
  const rows: Array<{
    roleId: number;
    module: string;
    action: string;
    recordScope: string;
    fieldScope: Record<string, unknown> | null;
  }> = [];

  for (const [roleCode, permissions] of Object.entries(PERMISSIONS_BY_ROLE)) {
    const roleId = ROLE_ID_BY_CODE[roleCode as keyof typeof ROLE_ID_BY_CODE];
    for (const permission of permissions) {
      rows.push({
        roleId,
        module: permission.module,
        action: permission.action,
        recordScope: permission.recordScope ?? SCOPE_BY_CODE[roleCode],
        fieldScope: permission.fieldScope ?? null,
      });
    }
  }

  return rows;
}

/** @deprecated Use buildRolePermissionRows — kept as alias for scripts */
export function buildPermissionRows() {
  return buildRolePermissionRows();
}
