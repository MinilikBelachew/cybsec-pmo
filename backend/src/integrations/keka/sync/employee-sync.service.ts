import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { KekaHttpClient } from '../client/keka-http.client';
import {
  KEKA_ENTITY_TYPE,
  KEKA_SYNC_DIRECTION,
  KEKA_SYNC_STATUS,
} from '../keka.constants';
import { upsertFailedSyncRecord, resolveFailedSyncRecord } from '../utils/failed-sync-record.util';
import {
  isKekaEmployeeActive,
  mapKekaEmployeeFields,
  resolveKekaDepartmentGroupId,
  resolveKekaDepartmentName,
  resolveKekaDesignation,
  resolveKekaEmployeeName,
  resolveKekaManagerId,
} from '../keka.mapper';
import { KekaEmployeeProfile } from '../keka.types';

export type EmployeeSyncResult = {
  synced: number;
  failed: number;
};

type DepartmentLookup = {
  id: string;
  name: string;
  kekaDepartmentId: string | null;
};

@Injectable()
export class EmployeeSyncService {
  private readonly logger = new Logger(EmployeeSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kekaClient: KekaHttpClient,
  ) {}

  async syncEmployees(): Promise<EmployeeSyncResult> {
    const employees = await this.kekaClient.getAllPages<KekaEmployeeProfile>(
      '/hris/employees',
    );
    const departments = await this.prisma.department.findMany({
      select: { id: true, code: true, name: true, kekaDepartmentId: true },
    });

    const syncedAt = new Date();
    let synced = 0;
    let failed = 0;
    const managerLinks: Array<{ kekaEmployeeId: string; managerKekaId: string }> =
      [];

    for (const employee of employees) {
      const employeeId = employee.id?.trim();
      if (!employeeId) {
        failed += 1;
        await this.logFailure('unknown', employee, 'Employee record is missing id');
        continue;
      }

      try {
        const departmentId = this.resolveDepartmentId(employee, departments);
        if (!departmentId) {
          const departmentName = resolveKekaDepartmentName(employee) ?? 'unknown';
          throw new Error(
            `No local department match for "${departmentName}" (employee ${employeeId})`,
          );
        }

        const name = resolveKekaEmployeeName(employee);
        const email = employee.email?.trim();
        if (!email) {
          throw new Error(`Employee ${employeeId} is missing email`);
        }

        const designation = resolveKekaDesignation(employee);
        const weeklyHours = new Prisma.Decimal(40);
        const isActive = isKekaEmployeeActive(employee);
        const kekaFields = mapKekaEmployeeFields(employee);

        const linkedUser = await this.prisma.user.findUnique({
          where: { email },
          select: { id: true },
        });

        await this.prisma.employee.upsert({
          where: { kekaEmployeeId: employeeId },
          update: {
            name,
            email,
            departmentId,
            designation,
            weeklyHours,
            isActive,
            syncedAt,
            ...kekaFields,
            ...(linkedUser ? { userId: linkedUser.id } : {}),
          },
          create: {
            kekaEmployeeId: employeeId,
            name,
            email,
            departmentId,
            designation,
            weeklyHours,
            isActive,
            syncedAt,
            ...kekaFields,
            userId: linkedUser?.id,
          },
        });

        const managerKekaId = resolveKekaManagerId(employee);
        if (managerKekaId) {
          managerLinks.push({ kekaEmployeeId: employeeId, managerKekaId });
        }

        await this.logSuccess(employeeId, employee);
        synced += 1;
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : 'Unknown employee sync error';
        this.logger.warn(`Employee sync failed for ${employeeId}: ${message}`);
        await this.logFailure(employeeId, employee, message);
      }
    }

    for (const link of managerLinks) {
      const employee = await this.prisma.employee.findUnique({
        where: { kekaEmployeeId: link.kekaEmployeeId },
        select: { id: true },
      });
      const manager = await this.prisma.employee.findUnique({
        where: { kekaEmployeeId: link.managerKekaId },
        select: { id: true },
      });

      if (!employee || !manager) {
        continue;
      }

      await this.prisma.employee.update({
        where: { id: employee.id },
        data: { managerId: manager.id },
      });
    }

    return { synced, failed };
  }

  private resolveDepartmentId(
    employee: KekaEmployeeProfile,
    departments: DepartmentLookup[],
  ): string | null {
    const kekaGroupId = resolveKekaDepartmentGroupId(employee);
    if (kekaGroupId) {
      const byKekaId = departments.find(
        (department) => department.kekaDepartmentId === kekaGroupId,
      );
      if (byKekaId) {
        return byKekaId.id;
      }
    }

    const departmentName = resolveKekaDepartmentName(employee);
    if (!departmentName) {
      return null;
    }

    const byName = departments.find(
      (department) => department.name.toLowerCase() === departmentName.toLowerCase(),
    );
    return byName?.id ?? null;
  }

  private async logSuccess(entityId: string, payload: unknown): Promise<void> {
    await this.prisma.kekaSyncLog.create({
      data: {
        entityType: KEKA_ENTITY_TYPE.EMPLOYEE,
        entityId,
        direction: KEKA_SYNC_DIRECTION.INBOUND,
        status: KEKA_SYNC_STATUS.SUCCESS,
        payload: payload as Prisma.InputJsonValue,
      },
    });
    await resolveFailedSyncRecord(this.prisma, {
      entityType: KEKA_ENTITY_TYPE.EMPLOYEE,
      entityId,
    });
  }

  private async logFailure(
    entityId: string,
    payload: unknown,
    errorMsg: string,
  ): Promise<void> {
    await this.prisma.kekaSyncLog.create({
      data: {
        entityType: KEKA_ENTITY_TYPE.EMPLOYEE,
        entityId,
        direction: KEKA_SYNC_DIRECTION.INBOUND,
        status: KEKA_SYNC_STATUS.FAILED,
        payload: payload as Prisma.InputJsonValue,
        errorMsg,
        retryCount: 0,
      },
    });

    await upsertFailedSyncRecord(this.prisma, {
      entityType: KEKA_ENTITY_TYPE.EMPLOYEE,
      entityId: entityId,
      direction: KEKA_SYNC_DIRECTION.INBOUND,
      errorMsg,
      payload: payload as Prisma.InputJsonValue,
    });

  }
}
