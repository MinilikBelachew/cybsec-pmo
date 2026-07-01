import type { PermissionRow } from '../casl/casl.types';
import { hasModulePermission } from '../casl/module-permission.util';

export function canViewDashboardStats(permissions: PermissionRow[]): boolean {
  return (
    hasModulePermission(permissions, 'projects', 'view') ||
    hasModulePermission(permissions, 'tasks', 'view') ||
    hasModulePermission(permissions, 'reports', 'view')
  );
}

export function canViewDashboardFinancials(permissions: PermissionRow[]): boolean {
  return hasModulePermission(permissions, 'financials', 'view');
}

export function canViewDashboardReports(permissions: PermissionRow[]): boolean {
  return hasModulePermission(permissions, 'reports', 'view');
}

export function canViewDashboardProjects(permissions: PermissionRow[]): boolean {
  return hasModulePermission(permissions, 'projects', 'view');
}

export function canViewDashboardTeam(permissions: PermissionRow[]): boolean {
  return hasModulePermission(permissions, 'team', 'view');
}

export function canViewDashboardAudit(permissions: PermissionRow[]): boolean {
  return hasModulePermission(permissions, 'audit', 'view');
}
