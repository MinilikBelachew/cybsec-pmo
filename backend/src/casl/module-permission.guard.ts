import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../database/prisma.service';
import { resolveCaslUser } from './casl-user.util';
import {
  CHECK_MODULE_PERMISSION_KEY,
  CheckModulePermissionMeta,
} from './decorators/check-module-permission.decorator';
import {
  CHECK_ANY_MODULE_PERMISSION_KEY,
  ModulePermissionRequirement,
} from './decorators/check-any-module-permission.decorator';
import { hasModulePermission } from './module-permission.util';
import { PermissionsCacheService } from './permissions-cache.service';
import { RequestWithAbility } from './casl.guard';

@Injectable()
export class ModulePermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsCache: PermissionsCacheService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const anyMeta = this.reflector.getAllAndOverride<
      ModulePermissionRequirement[] | undefined
    >(CHECK_ANY_MODULE_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const meta = this.reflector.getAllAndOverride<
      CheckModulePermissionMeta | undefined
    >(CHECK_MODULE_PERMISSION_KEY, [context.getHandler(), context.getClass()]);

    if (!meta && !anyMeta?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAbility>();

    if (!request.caslUser) {
      request.caslUser = await resolveCaslUser(this.prisma, request);
    }

    const permissions = this.permissionsCache.getByRoleId(request.caslUser.roleId);

    if (anyMeta?.length) {
      const allowed = anyMeta.some((requirement) =>
        hasModulePermission(permissions, requirement.module, requirement.action),
      );
      if (!allowed) {
        throw new ForbiddenException();
      }
      return true;
    }

    if (!hasModulePermission(permissions, meta!.module, meta!.action)) {
      throw new ForbiddenException();
    }

    return true;
  }
}
