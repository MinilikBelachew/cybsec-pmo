import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PermissionRow } from './casl.types';
import { assertKnownRecordScopes } from './record-scope.validation';

@Injectable()
export class PermissionsCacheService implements OnModuleInit {
  private readonly logger = new Logger(PermissionsCacheService.name);
  private cache = new Map<number, PermissionRow[]>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const rows = await this.prisma.rolePermission.findMany({
      select: {
        roleId: true,
        recordScope: true,
        fieldScope: true,
        permission: {
          select: {
            module: true,
            action: true,
          },
        },
      },
    });

    assertKnownRecordScopes(rows.map((row) => row.recordScope));

    const next = new Map<number, PermissionRow[]>();
    for (const row of rows) {
      const list = next.get(row.roleId) ?? [];
      list.push({
        module: row.permission.module,
        action: row.permission.action,
        recordScope: row.recordScope,
        fieldScope: row.fieldScope as Record<string, unknown> | null,
      });
      next.set(row.roleId, list);
    }
    this.cache = next;
    this.logger.log(`Permissions cache loaded (${rows.length} role grants)`);
  }

  getByRoleId(roleId: number): PermissionRow[] {
    return this.cache.get(roleId) ?? [];
  }

  /** Fresh read from DB for the current session (avoids stale menu gates after matrix grants). */
  async getByRoleIdFromDb(roleId: number): Promise<PermissionRow[]> {
    const rows = await this.prisma.rolePermission.findMany({
      where: { roleId },
      select: {
        recordScope: true,
        fieldScope: true,
        permission: {
          select: {
            module: true,
            action: true,
          },
        },
      },
    });

    assertKnownRecordScopes(rows.map((row) => row.recordScope));

    const list = rows.map((row) => ({
      module: row.permission.module,
      action: row.permission.action,
      recordScope: row.recordScope,
      fieldScope: row.fieldScope as Record<string, unknown> | null,
    }));

    // Keep in-memory cache aligned so ModulePermissionGuard / CASL see the same grants.
    this.cache.set(roleId, list);
    return list;
  }
}
