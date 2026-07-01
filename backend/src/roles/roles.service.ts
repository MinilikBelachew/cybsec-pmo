import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLogsService } from '../audit/audit-logs.service';
import { PermissionsCacheService } from '../casl/permissions-cache.service';
import {
  RECORD_SCOPE_CODES,
  RECORD_SCOPE_LABELS,
} from '../casl/record-scope.registry';
import { PrismaService } from '../database/prisma.service';
import { GrantRolePermissionDto } from './dto/grant-role-permission.dto';
import { QueryAllPermissionsDto } from './dto/query-all-permissions.dto';
import { QueryRolePermissionsDto } from './dto/query-role-permissions.dto';
import { QueryRolesDto } from './dto/query-roles.dto';
import { UpdateRolePermissionDto } from './dto/update-role-permission.dto';

type RolePermissionWithCatalog = Prisma.RolePermissionGetPayload<{
  include: { permission: true; role: true };
}>;

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsCache: PermissionsCacheService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  private buildPaginationMeta(page: number, limit: number, total: number) {
    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    };
  }

  private parseFieldScope(
    fieldScope: Prisma.JsonValue | null,
  ): Record<string, unknown> | null {
    return fieldScope && typeof fieldScope === 'object' && !Array.isArray(fieldScope)
      ? (fieldScope as Record<string, unknown>)
      : null;
  }

  private mapRolePermissionGrant(grant: RolePermissionWithCatalog) {
    return {
      id: grant.id,
      permissionId: grant.permissionId,
      roleId: grant.roleId,
      module: grant.permission.module,
      action: grant.permission.action,
      recordScope: grant.recordScope,
      fieldScope: this.parseFieldScope(grant.fieldScope),
      roleCode: grant.role.code,
      roleLabel: grant.role.label,
    };
  }

  private mapGrantResponse(grant: RolePermissionWithCatalog) {
    const mapped = this.mapRolePermissionGrant(grant);
    return {
      id: mapped.id,
      permissionId: mapped.permissionId,
      roleId: mapped.roleId,
      module: mapped.module,
      action: mapped.action,
      recordScope: mapped.recordScope,
      fieldScope: mapped.fieldScope,
    };
  }

  private async ensureRole(roleId: number) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true, code: true, label: true },
    });

    if (!role) {
      throw new NotFoundException({
        status: 404,
        errors: { role: 'roleNotFound' },
      });
    }

    return role;
  }

  private async resolvePermission(dto: GrantRolePermissionDto) {
    if (dto.permissionId) {
      const permission = await this.prisma.permission.findUnique({
        where: { id: dto.permissionId },
      });
      if (!permission) {
        throw new NotFoundException({
          status: 404,
          errors: { permission: 'permissionNotFound' },
        });
      }
      return permission;
    }

    if (!dto.module?.trim() || !dto.action?.trim()) {
      throw new UnprocessableEntityException({
        status: 422,
        errors: { permission: 'permissionIdOrModuleActionRequired' },
      });
    }

    const permission = await this.prisma.permission.findUnique({
      where: {
        module_action: {
          module: dto.module.trim(),
          action: dto.action.trim(),
        },
      },
    });

    if (!permission) {
      throw new NotFoundException({
        status: 404,
        errors: { permission: 'permissionNotFound' },
      });
    }

    return permission;
  }

  private async getGrantForRole(roleId: number, grantId: string) {
    const grant = await this.prisma.rolePermission.findFirst({
      where: { id: grantId, roleId },
      include: { permission: true, role: true },
    });

    if (!grant) {
      throw new NotFoundException({
        status: 404,
        errors: { grant: 'rolePermissionNotFound' },
      });
    }

    return grant;
  }

  private async auditPermissionChange(params: {
    actorId: string;
    action: string;
    grantId: string;
    oldValue: Record<string, unknown> | null;
    newValue: Record<string, unknown> | null;
    ipAddress?: string | null;
    isExternal?: boolean;
  }) {
    await this.auditLogsService.create({
      action: params.action,
      objectType: 'RolePermission',
      objectId: params.grantId,
      oldValue: params.oldValue as Prisma.InputJsonValue,
      newValue: params.newValue as Prisma.InputJsonValue,
      ipAddress: params.ipAddress ?? null,
      isExternal: params.isExternal === true,
      source: 'WebAPI',
      user: { connect: { id: params.actorId } },
    });
  }

  private buildRoleOrderBy(
    sortBy?: QueryRolesDto['sortBy'],
    sortOrder?: QueryRolesDto['sortOrder'],
  ): Prisma.RoleOrderByWithRelationInput {
    const direction = sortOrder ?? 'asc';

    switch (sortBy) {
      case 'label':
        return { label: direction };
      case 'isExternal':
        return { isExternal: direction };
      case 'createdAt':
        return { createdAt: direction };
      case 'permissionCount':
        return { rolePermissions: { _count: direction } };
      case 'code':
      default:
        return { code: direction };
    }
  }

  private buildRolePermissionOrderBy(
    sortBy?: QueryRolePermissionsDto['sortBy'],
    sortOrder?: QueryRolePermissionsDto['sortOrder'],
  ): Prisma.RolePermissionOrderByWithRelationInput {
    const direction = sortOrder ?? 'asc';

    switch (sortBy) {
      case 'action':
        return { permission: { action: direction } };
      case 'recordScope':
        return { recordScope: direction };
      case 'module':
      default:
        return { permission: { module: direction } };
    }
  }

  private buildAllPermissionOrderBy(
    sortBy?: QueryAllPermissionsDto['sortBy'],
    sortOrder?: QueryAllPermissionsDto['sortOrder'],
  ): Prisma.RolePermissionOrderByWithRelationInput {
    const direction = sortOrder ?? 'asc';

    switch (sortBy) {
      case 'action':
        return { permission: { action: direction } };
      case 'recordScope':
        return { recordScope: direction };
      case 'roleCode':
        return { role: { code: direction } };
      case 'roleLabel':
        return { role: { label: direction } };
      case 'module':
      default:
        return { permission: { module: direction } };
    }
  }

  private buildRolePermissionSearchWhere(
    search: string | undefined,
    roleId?: number,
  ): Prisma.RolePermissionWhereInput {
    const trimmed = search?.trim();

    return {
      ...(roleId ? { roleId } : {}),
      ...(trimmed
        ? {
            OR: [
              { permission: { module: { contains: trimmed, mode: 'insensitive' } } },
              { permission: { action: { contains: trimmed, mode: 'insensitive' } } },
              { recordScope: { contains: trimmed, mode: 'insensitive' } },
              { role: { code: { contains: trimmed, mode: 'insensitive' } } },
              { role: { label: { contains: trimmed, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
  }

  async findRoles(query: QueryRolesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.RoleWhereInput = query.search?.trim()
      ? {
          OR: [
            { code: { contains: query.search.trim(), mode: 'insensitive' } },
            { label: { contains: query.search.trim(), mode: 'insensitive' } },
          ],
        }
      : {};

    const [roles, total] = await Promise.all([
      this.prisma.role.findMany({
        where,
        skip,
        take: limit,
        orderBy: this.buildRoleOrderBy(query.sortBy, query.sortOrder),
        include: {
          _count: { select: { rolePermissions: true } },
        },
      }),
      this.prisma.role.count({ where }),
    ]);

    return {
      data: roles.map((role) => ({
        id: role.id,
        code: role.code,
        label: role.label,
        isExternal: role.isExternal,
        permissionCount: role._count.rolePermissions,
        createdAt: role.createdAt,
      })),
      meta: this.buildPaginationMeta(page, limit, total),
    };
  }

  async findPermissionCatalog() {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
      select: { id: true, module: true, action: true },
    });

    return { data: permissions };
  }

  async findPermissionMatrix() {
    const [roles, catalog, grants] = await Promise.all([
      this.prisma.role.findMany({
        orderBy: { code: 'asc' },
        select: { id: true, code: true, label: true, isExternal: true },
      }),
      this.prisma.permission.findMany({
        orderBy: [{ module: 'asc' }, { action: 'asc' }],
        select: { id: true, module: true, action: true },
      }),
      this.prisma.rolePermission.findMany({
        select: {
          id: true,
          roleId: true,
          permissionId: true,
          recordScope: true,
        },
      }),
    ]);

    const grantByKey = new Map<
      string,
      { grantId: string; recordScope: string | null }
    >();
    for (const grant of grants) {
      grantByKey.set(`${grant.roleId}:${grant.permissionId}`, {
        grantId: grant.id,
        recordScope: grant.recordScope,
      });
    }

    return {
      roles,
      rows: catalog.map((permission) => ({
        module: permission.module,
        action: permission.action,
        permissionId: permission.id,
        cells: roles.map((role) => {
          const match = grantByKey.get(`${role.id}:${permission.id}`);
          return {
            roleId: role.id,
            granted: !!match,
            grantId: match?.grantId,
            recordScope: match?.recordScope ?? null,
          };
        }),
      })),
    };
  }

  findRecordScopeOptions() {
    return {
      data: RECORD_SCOPE_CODES.map((code) => ({
        code,
        label: RECORD_SCOPE_LABELS[code],
      })),
    };
  }

  async findRolePermissions(roleId: number, query: QueryRolePermissionsDto) {
    const role = await this.ensureRole(roleId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = this.buildRolePermissionSearchWhere(query.search, roleId);

    const [grants, total] = await Promise.all([
      this.prisma.rolePermission.findMany({
        where,
        skip,
        take: limit,
        orderBy: this.buildRolePermissionOrderBy(query.sortBy, query.sortOrder),
        include: {
          permission: true,
          role: true,
        },
      }),
      this.prisma.rolePermission.count({ where }),
    ]);

    return {
      role,
      data: grants.map((grant) => this.mapGrantResponse(grant)),
      meta: this.buildPaginationMeta(page, limit, total),
    };
  }

  async findAllPermissions(query: QueryAllPermissionsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = this.buildRolePermissionSearchWhere(query.search, query.roleId);

    const [grants, total] = await Promise.all([
      this.prisma.rolePermission.findMany({
        where,
        skip,
        take: limit,
        orderBy: this.buildAllPermissionOrderBy(query.sortBy, query.sortOrder),
        include: {
          permission: true,
          role: true,
        },
      }),
      this.prisma.rolePermission.count({ where }),
    ]);

    return {
      data: grants.map((grant) => {
        const mapped = this.mapRolePermissionGrant(grant);
        return {
          id: mapped.id,
          permissionId: mapped.permissionId,
          roleId: mapped.roleId,
          module: mapped.module,
          action: mapped.action,
          recordScope: mapped.recordScope,
          fieldScope: mapped.fieldScope,
          roleCode: mapped.roleCode,
          roleLabel: mapped.roleLabel,
        };
      }),
      meta: this.buildPaginationMeta(page, limit, total),
    };
  }

  async grantPermission(
    roleId: number,
    dto: GrantRolePermissionDto,
    actorId: string,
    ipAddress?: string | null,
    isExternal = false,
  ) {
    const role = await this.ensureRole(roleId);
    const permission = await this.resolvePermission(dto);

    const existing = await this.prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId: permission.id,
        },
      },
    });

    if (existing) {
      throw new ConflictException({
        status: 409,
        errors: { permission: 'alreadyGranted' },
      });
    }

    const grant = await this.prisma.rolePermission.create({
      data: {
        roleId,
        permissionId: permission.id,
        recordScope: dto.recordScope,
        fieldScope:
          dto.fieldScope != null
            ? (dto.fieldScope as Prisma.InputJsonValue)
            : Prisma.DbNull,
      },
      include: { permission: true, role: true },
    });

    const newValue = {
      roleId: role.id,
      roleCode: role.code,
      permissionId: permission.id,
      module: permission.module,
      action: permission.action,
      recordScope: grant.recordScope,
      fieldScope: this.parseFieldScope(grant.fieldScope),
    };

    await this.auditPermissionChange({
      actorId,
      action: 'GRANT_PERMISSION',
      grantId: grant.id,
      oldValue: null,
      newValue,
      ipAddress,
      isExternal,
    });

    await this.permissionsCache.refresh();

    return this.mapGrantResponse(grant);
  }

  async updatePermissionGrant(
    roleId: number,
    grantId: string,
    dto: UpdateRolePermissionDto,
    actorId: string,
    ipAddress?: string | null,
    isExternal = false,
  ) {
    const existing = await this.getGrantForRole(roleId, grantId);
    const oldValue = this.mapGrantResponse(existing);

    if (dto.recordScope === undefined && dto.fieldScope === undefined) {
      throw new UnprocessableEntityException({
        status: 422,
        errors: { grant: 'noChangesProvided' },
      });
    }

    const grant = await this.prisma.rolePermission.update({
      where: { id: grantId },
      data: {
        ...(dto.recordScope !== undefined ? { recordScope: dto.recordScope } : {}),
        ...(dto.fieldScope !== undefined
          ? {
              fieldScope:
                dto.fieldScope != null
                  ? (dto.fieldScope as Prisma.InputJsonValue)
                  : Prisma.DbNull,
            }
          : {}),
      },
      include: { permission: true, role: true },
    });

    await this.auditPermissionChange({
      actorId,
      action: 'UPDATE_PERMISSION',
      grantId: grant.id,
      oldValue,
      newValue: this.mapGrantResponse(grant),
      ipAddress,
      isExternal,
    });

    await this.permissionsCache.refresh();

    return this.mapGrantResponse(grant);
  }

  async revokePermission(
    roleId: number,
    grantId: string,
    actorId: string,
    ipAddress?: string | null,
    isExternal = false,
  ) {
    const existing = await this.getGrantForRole(roleId, grantId);
    const oldValue = this.mapGrantResponse(existing);

    await this.prisma.rolePermission.delete({ where: { id: grantId } });

    await this.auditPermissionChange({
      actorId,
      action: 'REVOKE_PERMISSION',
      grantId,
      oldValue,
      newValue: null,
      ipAddress,
      isExternal,
    });

    await this.permissionsCache.refresh();

    return { success: true };
  }
}
