import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PermissionsCacheService } from './permissions-cache.service';
import { buildProjectWhere, buildTaskWhere } from './record-scope.where';
import { CaslAction, CaslUserContext } from './casl.types';

@Injectable()
export class RecordScopeWhereService {
  constructor(private readonly permissionsCache: PermissionsCacheService) {}

  projectWhere(
    user: CaslUserContext,
    action: CaslAction,
  ): Prisma.ProjectWhereInput {
    const permissions = this.permissionsCache.getByRoleId(user.roleId);
    return buildProjectWhere(permissions, user, action);
  }

  taskWhere(user: CaslUserContext, action: CaslAction): Prisma.TaskWhereInput {
    const permissions = this.permissionsCache.getByRoleId(user.roleId);
    return buildTaskWhere(permissions, user, action);
  }
}
