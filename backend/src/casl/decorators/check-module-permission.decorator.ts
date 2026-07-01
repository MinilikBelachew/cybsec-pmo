import { SetMetadata } from '@nestjs/common';

export const CHECK_MODULE_PERMISSION_KEY = 'check_module_permission';

export type CheckModulePermissionMeta = {
  module: string;
  action: string;
};

export const CheckModulePermission = (module: string, action: string) =>
  SetMetadata(CHECK_MODULE_PERMISSION_KEY, {
    module,
    action,
  } satisfies CheckModulePermissionMeta);
