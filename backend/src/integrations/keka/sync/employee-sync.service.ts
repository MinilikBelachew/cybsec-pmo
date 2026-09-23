import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { ROLE_ID_BY_CODE } from '../../../roles/role-catalog';
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

/** Placeholder until first Entra SSO replaces it with the real oid. */
export function kekaPendingEntraObjectId(kekaEmployeeId: string): string {
  return `keka-pending:${kekaEmployeeId}`;
}

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
        const emailRaw = employee.email?.trim();
        if (!emailRaw) {
          throw new Error(`Employee ${employeeId} is missing email`);
        }
        const email = emailRaw.toLowerCase();

        const designation = resolveKekaDesignation(employee);
        const weeklyHours = new Prisma.Decimal(40);
        const isActive = isKekaEmployeeActive(employee);
        const kekaFields = mapKekaEmployeeFields(employee);

        const linkedUserId = isActive
          ? await this.ensureActiveUserForEmployee({
              kekaEmployeeId: employeeId,
              email,
              displayName: name,
            })
          : await this.deactivateLinkedUser(email);

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
            ...(linkedUserId ? { userId: linkedUserId } : {}),
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
            userId: linkedUserId,
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

  /**
   * Find or create an active engineer user for an active Keka employee.
   * Never changes role on an existing user (Settings may have promoted them).
   */
  private async ensureActiveUserForEmployee(input: {
    kekaEmployeeId: string;
    email: string;
    displayName: string;
  }): Promise<string> {
    const existing = await this.findUserByEmail(input.email);
    if (existing) {
      if (!existing.isActive) {
        await this.prisma.user.update({
          where: { id: existing.id },
          data: { isActive: true },
        });
      }
      return existing.id;
    }

    try {
      const created = await this.prisma.user.create({
        data: {
          email: input.email,
          displayName: input.displayName || input.email.split('@')[0],
          entraObjectId: kekaPendingEntraObjectId(input.kekaEmployeeId),
          roleId: ROLE_ID_BY_CODE.engineer,
          isActive: true,
          isExternal: false,
        },
        select: { id: true },
      });
      this.logger.log(
        `Created engineer user ${created.id} for Keka employee ${input.kekaEmployeeId} (${input.email})`,
      );
      return created.id;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced = await this.findUserByEmail(input.email);
        if (raced) {
          if (!raced.isActive) {
            await this.prisma.user.update({
              where: { id: raced.id },
              data: { isActive: true },
            });
          }
          return raced.id;
        }
      }
      throw error;
    }
  }

  /**
   * Deactivate any existing user for this email when Keka marks Relieved/exited.
   * Does not create users. Returns user id when found so the employee link is kept.
   */
  private async deactivateLinkedUser(email: string): Promise<string | null> {
    const existing = await this.findUserByEmail(email);
    if (!existing) {
      return null;
    }

    if (existing.isActive) {
      await this.prisma.user.update({
        where: { id: existing.id },
        data: { isActive: false },
      });
      this.logger.log(
        `Deactivated user ${existing.id} (${email}) — Keka employee inactive/relieved`,
      );
    }

    return existing.id;
  }

  private async findUserByEmail(
    email: string,
  ): Promise<{ id: string; isActive: boolean } | null> {
    return this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, isActive: true },
    });
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
