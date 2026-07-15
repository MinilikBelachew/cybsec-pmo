import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { KekaHttpClient } from '../client/keka-http.client';
import {
  KEKA_ENTITY_TYPE,
  KEKA_SYNC_DIRECTION,
  KEKA_SYNC_STATUS,
} from '../keka.constants';
import { KekaBillingRole, KekaPagedResponse } from '../keka.types';
import { ProjectLinkService } from './project-link.service';
import { upsertFailedSyncRecord } from '../utils/failed-sync-record.util';

/** Keka allows 0–100, multiples of 10, plus 5. */
const KEKA_ALLOCATION_PERCENTAGES = [
  0, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
] as const;

type KekaAllocationPushPayload = {
  employeeId: string;
  allocationPercentage: number;
  billingRoleId: string;
  billingRate?: number;
  startDate: string;
  endDate?: string | null;
};

type KekaAllocationPushResponse = {
  succeeded?: boolean;
  data?: string | null;
  message?: string | null;
  errors?: string[] | null;
};

@Injectable()
export class AllocationPushService {
  private readonly logger = new Logger(AllocationPushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kekaClient: KekaHttpClient,
    private readonly projectLinkService: ProjectLinkService,
  ) {}

  async pushAllocation(allocationId: string): Promise<string | null> {
    const allocation = await this.prisma.allocation.findUnique({
      where: { id: allocationId },
      include: {
        employee: {
          select: {
            kekaEmployeeId: true,
            name: true,
            weeklyHours: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            kekaProjectId: true,
            kekaClientId: true,
            startDate: true,
            endDate: true,
            customer: { select: { kekaClientId: true, displayName: true } },
          },
        },
      },
    });

    if (!allocation || allocation.status !== 'Active') {
      return null;
    }

    if (allocation.kekaSyncRef) {
      return allocation.kekaSyncRef;
    }

    const kekaEmployeeId = allocation.employee.kekaEmployeeId?.trim();
    if (!kekaEmployeeId) {
      await this.logFailure(
        allocationId,
        { allocationId },
        `Employee ${allocation.employee.name} has no Keka ID`,
      );
      return null;
    }

    let payload: KekaAllocationPushPayload | { allocationId: string } = {
      allocationId,
    };

    try {
      const kekaProjectId =
        allocation.project.kekaProjectId?.trim() ||
        (await this.projectLinkService.ensureProjectLinked(
          allocation.project.id,
        ));

      const kekaClientId = await this.resolveKekaClientId(
        allocation.project.id,
        allocation.project.kekaClientId,
        allocation.project.customer?.kekaClientId,
        allocation.project.customer?.displayName,
      );

      const billingRole = await this.resolveBillingRole(
        kekaClientId,
        allocation.role,
      );

      const allocationPercentage = this.resolveAllocationPercentage(
        allocation.percent != null ? Number(allocation.percent) : null,
        allocation.hours != null ? Number(allocation.hours) : null,
        Number(allocation.employee.weeklyHours) || 40,
      );

      const { startDate, endDate } = this.clampAllocationDates(
        allocation.startDate,
        allocation.endDate,
        allocation.project.startDate,
        allocation.project.endDate,
      );

      payload = {
        employeeId: kekaEmployeeId,
        billingRoleId: billingRole.id,
        allocationPercentage,
        startDate,
        endDate,
        ...(billingRole.billingRate != null
          ? { billingRate: billingRole.billingRate }
          : {}),
      };

      const response = await this.kekaClient.post<KekaAllocationPushResponse>(
        `/psa/projects/${encodeURIComponent(kekaProjectId)}/allocations`,
        payload,
      );

      const ref =
        response.data?.trim() || `keka-alloc-${allocationId.slice(0, 8)}`;
      const syncedAt = new Date();

      await this.prisma.allocation.update({
        where: { id: allocationId },
        data: {
          kekaSyncRef: ref,
          kekaSyncedAt: syncedAt,
        },
      });

      await this.prisma.kekaSyncLog.create({
        data: {
          entityType: KEKA_ENTITY_TYPE.ALLOCATION,
          entityId: allocationId,
          direction: KEKA_SYNC_DIRECTION.OUTBOUND,
          status: KEKA_SYNC_STATUS.SUCCESS,
          payload: payload as unknown as Prisma.InputJsonValue,
        },
      });

      return ref;
    } catch (error) {
      const message = this.clarifyKekaError(
        error instanceof Error ? error.message : 'Keka allocation push failed',
      );
      this.logger.error(`Allocation push failed for ${allocationId}: ${message}`);
      await this.logFailure(allocationId, payload, message);
      return null;
    }
  }

  private clarifyKekaError(message: string): string {
    if (
      /non billable resource can not be allocated to the billable project/i.test(
        message,
      )
    ) {
      return (
        `${message} — In Keka this employee is a non-billable resource while the ` +
        `linked project is billable. Fix in Keka: enable "Non-billable resource allocation" ` +
        `(Projects → Policies and Settings → Resource Management → Allocation), ` +
        `mark the employee billable, or allocate a billable employee.`
      );
    }
    return message;
  }

  private async resolveKekaClientId(
    projectId: string,
    projectClientId: string | null | undefined,
    customerClientId: string | null | undefined,
    customerName: string | null | undefined,
  ): Promise<string> {
    const existing =
      projectClientId?.trim() || customerClientId?.trim() || null;
    if (existing) {
      return existing;
    }

    // ensureProjectLinked may have just written kekaClientId
    const refreshed = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        kekaClientId: true,
        customer: { select: { kekaClientId: true, displayName: true } },
      },
    });
    const linked =
      refreshed?.kekaClientId?.trim() ||
      refreshed?.customer?.kekaClientId?.trim();
    if (linked) {
      return linked;
    }

    throw new Error(
      `Project has no Keka client id` +
        (customerName ? ` (customer "${customerName}" is not linked)` : ''),
    );
  }

  private async resolveBillingRole(
    kekaClientId: string,
    allocationRole: string,
  ): Promise<{ id: string; name: string; billingRate: number | null }> {
    const roles = await this.fetchBillingRoles(kekaClientId);
    if (roles.length === 0) {
      throw new Error(
        `No Keka billing roles found for client ${kekaClientId}`,
      );
    }

    const needle = allocationRole.trim().toLowerCase();
    const exact = roles.find(
      (role) => role.name?.trim().toLowerCase() === needle,
    );
    const partial =
      exact ??
      roles.find((role) => {
        const name = role.name?.trim().toLowerCase() ?? '';
        return (
          needle.length > 2 &&
          (name.includes(needle) || needle.includes(name))
        );
      });

    if (!partial) {
      const fallback = roles[0];
      const fallbackId = fallback?.id?.trim();
      if (!fallbackId) {
        throw new Error(
          `No Keka billing role matches PMO role "${allocationRole}" for client ${kekaClientId}, ` +
            `and no fallback billing role is available.`,
        );
      }
      this.logger.warn(
        `No Keka billing role matches "${allocationRole}"; falling back to "${fallback.name ?? fallbackId}"`,
      );
      return {
        id: fallbackId,
        name: fallback.name?.trim() || fallbackId,
        billingRate:
          typeof fallback.billingRate?.rate === 'number'
            ? fallback.billingRate.rate
            : null,
      };
    }

    const id = partial.id?.trim();
    if (!id) {
      throw new Error(
        `Keka billing role for client ${kekaClientId} has no id`,
      );
    }

    if (!exact) {
      this.logger.warn(
        `Partial billing role match for "${allocationRole}" → "${partial.name ?? id}"`,
      );
    }

    return {
      id,
      name: partial.name?.trim() || id,
      billingRate:
        typeof partial.billingRate?.rate === 'number'
          ? partial.billingRate.rate
          : null,
    };
  }

  /** Keep Keka allocation window inside the linked project start/end dates. */
  private clampAllocationDates(
    allocationStart: Date,
    allocationEnd: Date | null,
    projectStart: Date | null | undefined,
    projectEnd: Date | null | undefined,
  ): { startDate: string; endDate: string | null } {
    let start = new Date(allocationStart);
    let end = allocationEnd ? new Date(allocationEnd) : null;

    if (projectStart && start < projectStart) {
      start = new Date(projectStart);
    }
    if (projectEnd && start > projectEnd) {
      start = new Date(projectEnd);
    }
    if (end && projectEnd && end > projectEnd) {
      end = new Date(projectEnd);
    }
    if (end && projectStart && end < projectStart) {
      end = new Date(projectStart);
    }
    if (end && end < start) {
      end = new Date(start);
    }

    return {
      startDate: start.toISOString(),
      endDate: end ? end.toISOString() : null,
    };
  }

  private async fetchBillingRoles(
    kekaClientId: string,
  ): Promise<KekaBillingRole[]> {
    const path = `/psa/clients/${encodeURIComponent(kekaClientId)}/billingroles`;
    try {
      return await this.kekaClient.getAllPages<KekaBillingRole>(path);
    } catch {
      const response =
        await this.kekaClient.get<KekaPagedResponse<KekaBillingRole>>(path);
      return response.data ?? [];
    }
  }

  private resolveAllocationPercentage(
    percent: number | null,
    hours: number | null,
    weeklyHours: number,
  ): number {
    let raw: number | null = null;

    if (percent != null && Number.isFinite(percent)) {
      raw = percent;
    } else if (hours != null && Number.isFinite(hours) && weeklyHours > 0) {
      raw = (hours / weeklyHours) * 100;
    }

    if (raw == null || !Number.isFinite(raw)) {
      throw new Error(
        'Allocation has no percent or hours to derive Keka allocationPercentage',
      );
    }

    return this.snapToKekaPercentage(raw);
  }

  private snapToKekaPercentage(value: number): number {
    const clamped = Math.max(0, Math.min(100, value));
    return KEKA_ALLOCATION_PERCENTAGES.reduce((best, candidate) =>
      Math.abs(candidate - clamped) < Math.abs(best - clamped)
        ? candidate
        : best,
    );
  }

  private async logFailure(
    entityId: string,
    payload: unknown,
    errorMsg: string,
  ): Promise<void> {
    await this.prisma.kekaSyncLog.create({
      data: {
        entityType: KEKA_ENTITY_TYPE.ALLOCATION,
        entityId,
        direction: KEKA_SYNC_DIRECTION.OUTBOUND,
        status: KEKA_SYNC_STATUS.FAILED,
        payload: payload as Prisma.InputJsonValue,
        errorMsg,
      },
    });

    await upsertFailedSyncRecord(this.prisma, {
      entityType: KEKA_ENTITY_TYPE.ALLOCATION,
      entityId,
      direction: KEKA_SYNC_DIRECTION.OUTBOUND,
      errorMsg,
      payload: payload as Prisma.InputJsonValue,
    });
  }
}
