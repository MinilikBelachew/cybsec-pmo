import { RoleEnum } from '../../roles/roles.enum';

export function resolveUserIsExternal(user: {
  isExternal?: boolean;
  role?: { isExternal?: boolean; code?: string } | null;
  roleCode?: string;
}): boolean {
  if (user.isExternal === true) {
    return true;
  }

  if (user.role?.isExternal === true) {
    return true;
  }

  const roleCode = user.role?.code ?? user.roleCode;
  return roleCode === RoleEnum.client || roleCode === RoleEnum.vendor;
}
