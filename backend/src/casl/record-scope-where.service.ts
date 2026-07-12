import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PermissionsCacheService } from './permissions-cache.service';
import { buildProjectWhere, buildTaskWhere, buildTeamApprovalProjectWhere, buildTeamDirectoryEmployeeWhere, buildReportsEmployeeWhere, buildTimesheetApprovalProjectWhere } from './record-scope.where';
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

  teamApprovalProjectWhere(user: CaslUserContext): Prisma.ProjectWhereInput {
    const permissions = this.permissionsCache.getByRoleId(user.roleId);
    return buildTeamApprovalProjectWhere(permissions, user);
  }

  teamDirectoryEmployeeWhere(user: CaslUserContext): Prisma.EmployeeWhereInput {
    const permissions = this.permissionsCache.getByRoleId(user.roleId);
    return buildTeamDirectoryEmployeeWhere(permissions, user);
  }

  reportsEmployeeWhere(user: CaslUserContext): Prisma.EmployeeWhereInput {
    const permissions = this.permissionsCache.getByRoleId(user.roleId);
    return buildReportsEmployeeWhere(permissions, user);
  }

  timesheetApprovalProjectWhere(user: CaslUserContext): Prisma.ProjectWhereInput {
    const permissions = this.permissionsCache.getByRoleId(user.roleId);
    return buildTimesheetApprovalProjectWhere(permissions, user);
  }
}
