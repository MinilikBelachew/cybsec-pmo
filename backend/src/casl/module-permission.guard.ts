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
    const meta = this.reflector.getAllAndOverride<
      CheckModulePermissionMeta | undefined
    >(CHECK_MODULE_PERMISSION_KEY, [context.getHandler(), context.getClass()]);

    if (!meta) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAbility>();

    if (!request.caslUser) {
      request.caslUser = await resolveCaslUser(this.prisma, request);
    }

    const permissions = this.permissionsCache.getByRoleId(request.caslUser.roleId);

    if (!hasModulePermission(permissions, meta.module, meta.action)) {
      throw new ForbiddenException();
    }

    return true;
  }
}
