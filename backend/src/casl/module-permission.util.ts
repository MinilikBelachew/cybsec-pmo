import type { PermissionRow } from './casl.types';

/** Checks raw RBAC module/action rows — avoids CASL subject collisions (e.g. issues.edit → Project.update). */
export function hasModulePermission(
  permissions: PermissionRow[],
  module: string,
  action: string,
): boolean {
  return permissions.some(
    (permission) => permission.module === module && permission.action === action,
  );
}
