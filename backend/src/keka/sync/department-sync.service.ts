import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { KekaHttpClient } from '../client/keka-http.client';
import {
  KEKA_ENTITY_TYPE,
  KEKA_SYNC_DIRECTION,
  KEKA_SYNC_STATUS,
} from '../keka.constants';
import { KekaDepartment } from '../keka.types';

export type DepartmentSyncResult = {
  synced: number;
  failed: number;
};

@Injectable()
export class DepartmentSyncService {
  private readonly logger = new Logger(DepartmentSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kekaClient: KekaHttpClient,
  ) {}

  async syncDepartments(): Promise<DepartmentSyncResult> {
    const departments = await this.kekaClient.getAllPages<KekaDepartment>(
      '/hris/departments',
    );

    let synced = 0;
    let failed = 0;

    for (const department of departments) {
      const departmentId = department.id?.trim() ?? 'unknown';

      try {
        await this.upsertDepartment(department);
        await this.logSuccess(departmentId, department);
        synced += 1;
      } catch (error) {
        failed += 1;
        const message =
          error instanceof Error ? error.message : 'Unknown department sync error';
        this.logger.warn(`Department sync failed for ${departmentId}: ${message}`);
        await this.logFailure(departmentId, department, message);
      }
    }

    return { synced, failed };
  }

  private async upsertDepartment(department: KekaDepartment): Promise<void> {
    const kekaDepartmentId = department.id?.trim();
    const name = department.name?.trim();
    if (!kekaDepartmentId || !name) {
      throw new Error('Department record is missing id or name');
    }

    const isActive = department.isArchived !== true;
    const existing = await this.prisma.department.findFirst({
      where: {
        OR: [
          { kekaDepartmentId },
          { name: { equals: name, mode: 'insensitive' } },
        ],
      },
    });

    if (existing) {
      await this.prisma.department.update({
        where: { id: existing.id },
        data: {
          name,
          kekaDepartmentId,
          isActive,
        },
      });
      return;
    }

    const code = await this.generateUniqueCode(name);
    await this.prisma.department.create({
      data: {
        code,
        name,
        kekaDepartmentId,
        isActive,
      },
    });
  }

  private async generateUniqueCode(name: string): Promise<string> {
    const base = name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 24) || 'DEPT';

    let candidate = base;
    let suffix = 1;

    while (true) {
      const conflict = await this.prisma.department.findUnique({
        where: { code: candidate },
        select: { id: true },
      });
      if (!conflict) {
        return candidate;
      }
      suffix += 1;
      candidate = `${base.slice(0, 20)}_${suffix}`;
    }
  }

  private async logSuccess(entityId: string, payload: unknown): Promise<void> {
    await this.prisma.kekaSyncLog.create({
      data: {
        entityType: KEKA_ENTITY_TYPE.DEPARTMENT,
        entityId,
        direction: KEKA_SYNC_DIRECTION.INBOUND,
        status: KEKA_SYNC_STATUS.SUCCESS,
        payload: payload as Prisma.InputJsonValue,
      },
    });
  }

  private async logFailure(
    entityId: string,
    payload: unknown,
    errorMsg: string,
  ): Promise<void> {
    await this.prisma.kekaSyncLog.create({
      data: {
        entityType: KEKA_ENTITY_TYPE.DEPARTMENT,
        entityId,
        direction: KEKA_SYNC_DIRECTION.INBOUND,
        status: KEKA_SYNC_STATUS.FAILED,
        payload: payload as Prisma.InputJsonValue,
        errorMsg,
        retryCount: 0,
      },
    });
  }
}
