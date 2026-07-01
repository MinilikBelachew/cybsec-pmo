import { SetMetadata } from '@nestjs/common';

export const CHECK_ANY_MODULE_PERMISSION_KEY = 'check_any_module_permission';

export type ModulePermissionRequirement = {
  module: string;
  action: string;
};

export const CheckAnyModulePermission = (
  ...requirements: ModulePermissionRequirement[]
) =>
  SetMetadata(CHECK_ANY_MODULE_PERMISSION_KEY, requirements);
