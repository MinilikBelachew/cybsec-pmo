import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PermissionRow } from './casl.types';

@Injectable()
export class PermissionsCacheService implements OnModuleInit {
  private cache = new Map<number, PermissionRow[]>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const rows = await this.prisma.permission.findMany({
      select: {
        roleId: true,
        module: true,
        action: true,
        recordScope: true,
        fieldScope: true,
      },
    });

    const next = new Map<number, PermissionRow[]>();
    for (const row of rows) {
      const list = next.get(row.roleId) ?? [];
      list.push({
        module: row.module,
        action: row.action,
        recordScope: row.recordScope,
        fieldScope: row.fieldScope as Record<string, unknown> | null,
      });
      next.set(row.roleId, list);
    }
    this.cache = next;
  }

  getByRoleId(roleId: number): PermissionRow[] {
    return this.cache.get(roleId) ?? [];
  }
}
